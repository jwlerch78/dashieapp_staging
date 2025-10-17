# Next Steps: EdgeClient Integration for Dual-Write Pattern

## Current Status

✅ **COMPLETED:**
1. TokenStore dual-write pattern implemented
2. EdgeClient class created
3. Save() method writes to both localStorage and Supabase
4. Load() method reads from Supabase with localStorage fallback

⚠️ **INCOMPLETE:**
- EdgeClient not yet integrated into initialization flow
- No JWT token retrieval after OAuth login
- Token Store not using EdgeClient (still localStorage-only)

---

## The Problem

**Chicken-and-Egg Situation:**
1. EdgeClient needs a Supabase JWT token to make authenticated requests
2. We only get JWT token AFTER successful Google OAuth login
3. TokenStore needs EdgeClient to sync to Supabase
4. But we initialize TokenStore BEFORE we have the JWT

**Current Flow:**
```
Initialize TokenStore (no EdgeClient) →
OAuth Login →
Get Google tokens →
Store in TokenStore →
❌ Only saved to localStorage (no Supabase sync!)
```

**Desired Flow:**
```
Initialize TokenStore (localStorage only) →
OAuth Login →
Get Google tokens →
Exchange for Supabase JWT →
✅ Initialize EdgeClient with JWT →
✅ Update TokenStore with EdgeClient →
✅ Save tokens (dual-write to localStorage + Supabase)
```

---

## Solution: Post-Login JWT Initialization

### Step 1: Add JWT Retrieval Function

**Location:** After successful OAuth callback in `index.html`

```javascript
// New function to get Supabase JWT from Google token
async function getSupabaseJWT(googleAccessToken) {
  logger.debug('Getting Supabase JWT from Google token');

  const response = await fetch(SUPABASE_CONFIG.edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
    },
    body: JSON.stringify({
      operation: 'get_jwt_from_google',
      googleAccessToken: googleAccessToken
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to get JWT: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success || !result.jwtToken) {
    throw new Error('JWT retrieval failed');
  }

  logger.success('Got Supabase JWT', {
    userId: result.user.id,
    tier: result.access.tier
  });

  return result.jwtToken;
}
```

### Step 2: Initialize EdgeClient After Login

**Location:** In `initializeAuth()` after successful OAuth

```javascript
// After storing tokens to TokenStore (currently line 270-281)
await tokenStore.storeAccountTokens('google', 'primary', tokenData);
logger.success('Tokens stored successfully');

// NEW: Get Supabase JWT and initialize EdgeClient
const jwtToken = await getSupabaseJWT(oauthResult.user.googleAccessToken);
edgeClient = new EdgeClient(jwtToken);
logger.success('EdgeClient initialized with JWT');

// NEW: Update TokenStore with EdgeClient for future saves
tokenStore.edgeClient = edgeClient;
logger.success('TokenStore now has EdgeClient - dual-write enabled');

// NEW: Re-save tokens to trigger Supabase sync
await tokenStore.save();
logger.success('Tokens synced to Supabase');
```

### Step 3: Store JWT for Session Persistence

**Location:** After getting JWT

```javascript
// Store JWT in localStorage for session persistence
localStorage.setItem('dashie-supabase-jwt', jwtToken);

// Also store user info
localStorage.setItem('dashie-user-info', JSON.stringify({
  id: result.user.id,
  email: result.user.email,
  name: result.user.name,
  tier: result.access.tier
}));
```

### Step 4: Load JWT on Page Refresh

**Location:** Early in `initializeAuth()`

```javascript
// Check if we have a stored JWT (session persistence)
const storedJWT = localStorage.getItem('dashie-supabase-jwt');
if (storedJWT) {
  try {
    edgeClient = new EdgeClient(storedJWT);
    tokenStore.edgeClient = edgeClient;
    logger.info('EdgeClient restored from stored JWT');

    // Trigger a load from Supabase to sync any server changes
    await tokenStore.loadTokens();
    logger.success('Tokens loaded from Supabase on session restore');
  } catch (error) {
    logger.warn('Stored JWT invalid or expired, will re-authenticate', error);
    localStorage.removeItem('dashie-supabase-jwt');
    localStorage.removeItem('dashie-user-info');
  }
}
```

---

## Complete Integration Code

### File: `index.html` (Updated `initializeAuth` function)

```javascript
async function initializeAuth() {
  try {
    logger.info('🔐 Initializing authentication...');
    updateLoginStatus('Setting up authentication system...');

    // 1. Initialize TokenStore (localStorage only initially)
    tokenStore = new TokenStore();

    // 1a. Check for existing session (JWT + tokens)
    const storedJWT = localStorage.getItem('dashie-supabase-jwt');
    if (storedJWT) {
      try {
        logger.info('Found stored JWT, attempting session restore...');
        edgeClient = new EdgeClient(storedJWT);
        await tokenStore.initialize(edgeClient);
        logger.success('TokenStore initialized with EdgeClient from session');

        // Load tokens from Supabase (authoritative)
        await tokenStore.loadTokens();

        if (tokenStore.hasTokens()) {
          logger.success('Session restored successfully');
          // Continue to check if user is authenticated...
        }
      } catch (error) {
        logger.warn('Session restore failed, clearing stored JWT', error);
        localStorage.removeItem('dashie-supabase-jwt');
        localStorage.removeItem('dashie-user-info');
        await tokenStore.initialize(); // Re-init without EdgeClient
      }
    } else {
      await tokenStore.initialize(); // No EdgeClient yet
      logger.success('TokenStore initialized (localStorage only - no session)');
    }

    // 2. Initialize OAuth providers...
    // (existing code)

    // 3. Check if OAuth callback returned a user
    if (oauthResult && oauthResult.success && oauthResult.user) {
      logger.success('OAuth callback detected! User authenticated', {
        email: oauthResult.user.email
      });

      // Store tokens to TokenStore (localStorage only at this point)
      const tokenData = {
        access_token: oauthResult.tokens.access_token,
        refresh_token: oauthResult.tokens.refresh_token,
        expires_at: new Date(Date.now() + (oauthResult.tokens.expires_in * 1000)).toISOString(),
        scopes: oauthResult.tokens.scope?.split(' ') || [],
        email: oauthResult.user.email,
        display_name: oauthResult.user.name,
        provider_info: {
          type: 'web_oauth',
          auth_method: oauthResult.user.authMethod,
          client_id: webOAuthProvider.config.client_id
        }
      };

      await tokenStore.storeAccountTokens('google', 'primary', tokenData);
      logger.success('Tokens stored to localStorage');

      // NEW: Get Supabase JWT using Google access token
      const jwtToken = await getSupabaseJWT(oauthResult.user.googleAccessToken);
      logger.success('Got Supabase JWT');

      // NEW: Initialize EdgeClient with JWT
      edgeClient = new EdgeClient(jwtToken);
      tokenStore.edgeClient = edgeClient;
      logger.success('EdgeClient initialized - dual-write now enabled');

      // NEW: Store JWT for session persistence
      localStorage.setItem('dashie-supabase-jwt', jwtToken);
      localStorage.setItem('dashie-user-info', JSON.stringify({
        id: oauthResult.user.id,
        email: oauthResult.user.email,
        name: oauthResult.user.name
      }));

      // NEW: Re-save tokens to trigger Supabase sync
      await tokenStore.save();
      logger.success('Tokens synced to Supabase');

      updateLoginStatus(`Welcome back, ${oauthResult.user.name}!`);
      isAuthenticated = true;

      setTimeout(() => {
        hideLoginScreen();
        initializeCore();
      }, 1000);

      return true;
    }

    // Continue with rest of auth flow...
  } catch (error) {
    logger.error('Auth initialization failed', error);
    // Error handling...
  }
}

// New helper function
async function getSupabaseJWT(googleAccessToken) {
  import { SUPABASE_CONFIG } from './js/auth/auth-config.js';

  logger.debug('Getting Supabase JWT from Google token');

  const response = await fetch(SUPABASE_CONFIG.edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
    },
    body: JSON.stringify({
      operation: 'get_jwt_from_google',
      googleAccessToken: googleAccessToken
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to get JWT: ${response.status} - ${errorData.error || ''}`);
  }

  const result = await response.json();

  if (!result.success || !result.jwtToken) {
    throw new Error('JWT retrieval failed: ' + (result.error || 'Unknown error'));
  }

  logger.success('Got Supabase JWT', {
    userId: result.user.id,
    tier: result.access?.tier
  });

  return result.jwtToken;
}
```

---

## Testing Checklist

After implementing:

### First Login (Fresh Browser)
1. [ ] Open app in fresh browser (no localStorage)
2. [ ] Click "Sign in with Google"
3. [ ] Complete OAuth flow
4. [ ] Check console logs:
   - [ ] "Tokens stored to localStorage"
   - [ ] "Got Supabase JWT"
   - [ ] "EdgeClient initialized - dual-write now enabled"
   - [ ] "Tokens synced to Supabase"
5. [ ] Check localStorage:
   - [ ] `dashie-auth-tokens` exists
   - [ ] `dashie-supabase-jwt` exists
6. [ ] Check Supabase dashboard:
   - [ ] `user_auth_tokens` table has entry for your user
   - [ ] Tokens match localStorage

### Page Refresh (Session Restore)
1. [ ] Refresh page
2. [ ] Check console logs:
   - [ ] "Found stored JWT, attempting session restore..."
   - [ ] "TokenStore initialized with EdgeClient from session"
   - [ ] "Session restored successfully"
3. [ ] App loads without requiring re-login

### Clear localStorage (Force Re-login)
1. [ ] Clear localStorage
2. [ ] Refresh page
3. [ ] Should show login screen
4. [ ] Login again
5. [ ] Tokens should be restored from Supabase

---

## Benefits After Implementation

1. **Automatic Sync:** All token saves automatically go to both localStorage AND Supabase
2. **Cross-Device:** Tokens available on any device user logs in from
3. **Offline Support:** localStorage fallback when Supabase unavailable
4. **Session Persistence:** JWT stored locally, no re-login needed on refresh
5. **Data Recovery:** Clearing localStorage doesn't lose tokens (restored from Supabase)

---

## Next Priority After This

Once EdgeClient integration is complete:

1. **Implement token refresh in GoogleAPIClient** using `edgeClient.getValidToken()`
2. **Apply same dual-write pattern to SettingsManager**
3. **Add retry queue for failed Supabase writes**

---

## Files to Modify

1. `index.html` - Add JWT retrieval and EdgeClient initialization
2. No other files needed - TokenStore and EdgeClient are already ready!

---

## Estimated Time

**30-45 minutes** to implement and test the integration.
