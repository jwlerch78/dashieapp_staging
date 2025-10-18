# JWT Architecture Analysis: Legacy vs Phase 3

## User's Concern

> "Right now we have google tokens in local storage and no JWT token. In our legacy code that was working, we would receive a JWT token to store locally, then use that to authenticate with supabase, which would handle refreshing google tokens with the edge function. I want to utilize that same approach."

## Legacy Architecture (What Was Working)

### 1. **JWT Storage & Lifecycle**

**Stored in localStorage as**: `dashie-supabase-jwt`

```javascript
// Stored structure
{
  jwt: "eyJhbGciOiJIUzI1NiIs...",
  expiry: 1234567890000,
  userId: "uuid-from-supabase",
  userEmail: "user@example.com",
  savedAt: 1234567890000
}
```

**JWT Characteristics:**
- **Lifetime**: 72 hours (set by edge function)
- **Proactive refresh**: Refreshes when < 24 hours remaining
- **Refresh method**: Calls edge function `refresh_jwt` operation using CURRENT JWT (no Google token needed)
- **Primary purpose**: Authenticate to Supabase edge functions

### 2. **Google Token Storage**

**Stored in Supabase `user_settings.settings.tokenAccounts`** (NOT in localStorage)

```javascript
// In Supabase database
{
  tokenAccounts: {
    google: {
      primary: {
        access_token: "ya29...",
        refresh_token: "1//...",
        expires_at: "2025-10-17T12:00:00Z",
        scopes: ["calendar", "email"],
        email: "user@example.com",
        provider_info: { type: "web_oauth", client_id: "..." }
      }
    }
  }
}
```

**Google Token Characteristics:**
- **NOT in localStorage** - only in Supabase
- **Managed by edge function** - edge function handles all refresh operations
- **Accessed via JWT**: Browser sends JWT to edge function, edge function loads/refreshes Google tokens

### 3. **Authentication Flow (Legacy)**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. INITIAL LOGIN (OAuth)                                     │
└─────────────────────────────────────────────────────────────┘
User completes Google OAuth
  ↓
Browser receives: access_token, refresh_token
  ↓
Browser calls edge function:
  operation: 'get_jwt_from_google'
  googleAccessToken: access_token
  ↓
Edge function:
  - Verifies Google token
  - Creates/finds Supabase auth user
  - Stores Google tokens to Supabase (user_settings)
  - Generates Supabase JWT (72h expiry)
  - Returns JWT to browser
  ↓
Browser stores ONLY JWT in localStorage
  (Google tokens stay in Supabase only)

┌─────────────────────────────────────────────────────────────┐
│ 2. SESSION RESTORATION (Page refresh)                        │
└─────────────────────────────────────────────────────────────┘
Browser loads JWT from localStorage
  ↓
JWT still valid? (< 72h old, > 60min remaining)
  ✓ YES → Use JWT for edge function calls
  ✗ NO → Refresh JWT:
      operation: 'refresh_jwt'
      Authorization: Bearer <current-jwt>
      ↓
      Edge function returns fresh JWT (72h)
      ↓
      Browser stores new JWT in localStorage

┌─────────────────────────────────────────────────────────────┐
│ 3. CALLING GOOGLE APIs (e.g., fetch calendars)              │
└─────────────────────────────────────────────────────────────┘
Browser needs Google access_token
  ↓
Browser calls edge function:
  operation: 'get_valid_token'
  provider: 'google'
  account_type: 'primary'
  Authorization: Bearer <supabase-jwt>
  ↓
Edge function:
  - Loads Google tokens from Supabase
  - Checks if access_token expired (< 5min buffer)
  - If expired → refresh with Google OAuth
  - Returns valid access_token to browser
  ↓
Browser uses access_token for Google API call
  (Does NOT store it - discards after use)
```

### 4. **Key Insight: Two Separate Token Systems**

| Token Type | Storage | Purpose | Refresh Mechanism |
|------------|---------|---------|-------------------|
| **Supabase JWT** | localStorage | Authenticate to edge functions | `refresh_jwt` operation (uses current JWT) |
| **Google Tokens** | Supabase database | Access Google APIs | `get_valid_token` operation (edge function refreshes with Google OAuth) |

**Browser only stores JWT. Google tokens managed entirely by edge function.**

## Phase 3 Architecture (Current Implementation)

### What We Built

**Token storage**: `localStorage` key `dashie-auth-tokens`

```javascript
{
  google: {
    primary: {
      access_token: "ya29...",
      refresh_token: "1//...",
      expires_at: "2025-10-17T12:00:00Z",
      scopes: ["calendar", "email"],
      email: "user@example.com",
      provider_info: { type: "web_oauth", client_id: "..." }
    },
    "primary-tv": { /* Fire TV tokens */ }
  }
}
```

**Dual-write pattern**: Saves to BOTH localStorage AND Supabase `user_auth_tokens` table

**JWT handling**:
- JWT generated during bootstrap (`bootstrap_jwt` operation)
- JWT stored in `EdgeClient.jwtToken` (in-memory only)
- **NO localStorage persistence of JWT**

### The Problem

1. ❌ **JWT not persisted**: When page refreshes, JWT is lost
2. ❌ **Google tokens in localStorage**: Security risk (XSS exposure)
3. ❌ **Dual-write complexity**: Unnecessary since browser should only manage JWT
4. ❌ **Can't restore session**: No JWT in localStorage → can't call edge functions → can't load Google tokens from Supabase

## Recommended Fix: Align Phase 3 with Legacy Architecture

### Changes Needed

#### 1. **Add JWT Persistence**

**File**: `js/data/auth/edge-client.js`

Add method to save JWT to localStorage:

```javascript
setJWT(token) {
    this.jwtToken = token;

    // Parse expiry from JWT
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiry = payload.exp ? payload.exp * 1000 : null;
        const userId = payload.sub;
        const userEmail = payload.email;

        // Save to localStorage
        const jwtData = {
            jwt: token,
            expiry,
            userId,
            userEmail,
            savedAt: Date.now()
        };

        localStorage.setItem('dashie-supabase-jwt', JSON.stringify(jwtData));
        logger.debug('JWT saved to localStorage');

    } catch (error) {
        logger.error('Failed to parse/save JWT', error);
    }
}
```

Add method to load JWT on initialization:

```javascript
constructor() {
    this.jwtToken = null;
    this.jwtExpiry = null;
    this.edgeFunctionUrl = SUPABASE_CONFIG.edgeFunctionUrl;
    this.anonKey = SUPABASE_CONFIG.anonKey;

    // Try to load JWT from localStorage
    this._loadJWTFromStorage();
}

_loadJWTFromStorage() {
    try {
        const stored = localStorage.getItem('dashie-supabase-jwt');
        if (!stored) return;

        const data = JSON.parse(stored);

        // Check if expired
        if (Date.now() >= data.expiry) {
            logger.debug('Stored JWT expired, removing');
            localStorage.removeItem('dashie-supabase-jwt');
            return;
        }

        this.jwtToken = data.jwt;
        this.jwtExpiry = data.expiry;

        logger.info('JWT loaded from localStorage', {
            expiresIn: Math.round((data.expiry - Date.now()) / 1000 / 60) + ' minutes'
        });

    } catch (error) {
        logger.error('Failed to load JWT from localStorage', error);
        localStorage.removeItem('dashie-supabase-jwt');
    }
}
```

#### 2. **Add JWT Refresh Method**

```javascript
/**
 * Refresh Supabase JWT using current JWT
 * @returns {Promise<string>} New JWT token
 */
async refreshJWT() {
    if (!this.jwtToken) {
        throw new Error('No JWT to refresh');
    }

    logger.info('Refreshing Supabase JWT');

    const response = await this.request({
        operation: 'refresh_jwt'
    });

    if (response.jwtToken) {
        this.setJWT(response.jwtToken);
        logger.success('JWT refreshed successfully');
        return response.jwtToken;
    }

    throw new Error('JWT refresh failed');
}
```

#### 3. **Remove Google Tokens from localStorage**

**File**: `js/data/auth/token-store.js`

```javascript
// REMOVE this entire class or simplify to ONLY track metadata
// Google tokens should NEVER be in localStorage

// Option 1: Delete TokenStore entirely
// Option 2: Convert to metadata-only storage:
class TokenStore {
    constructor() {
        // Store only account metadata (which accounts exist)
        this.accountMetadata = {};
    }

    async getValidToken(provider, accountType) {
        // Always call edge function - never use localStorage
        if (!this.edgeClient || !this.edgeClient.jwtToken) {
            throw new Error('EdgeClient not authenticated');
        }

        return await this.edgeClient.getValidToken(provider, accountType);
    }
}
```

#### 4. **Update Session Restoration Flow**

**File**: `index.html`

```javascript
// Session restoration (simplified)
async function restoreSession() {
    // EdgeClient already loaded JWT from localStorage in constructor

    if (!edgeClient.jwtToken) {
        logger.info('No JWT found - show login screen');
        showLoginScreen();
        return;
    }

    // Check if JWT expired
    if (edgeClient.isJWTExpired()) {
        logger.info('JWT expired, refreshing...');
        try {
            await edgeClient.refreshJWT();
        } catch (error) {
            logger.error('JWT refresh failed', error);
            showLoginScreen();
            return;
        }
    }

    // JWT is valid - authenticated!
    logger.success('Session restored from JWT');
    hideLoginScreen();
    initializeCore();
}
```

#### 5. **Update Google API Calls**

```javascript
// When Google Calendar API needs access token
async function fetchCalendars() {
    // ALWAYS get fresh token from edge function
    const tokenResult = await edgeClient.getValidToken('google', 'primary');

    // Use token for Google API call (don't store it)
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
            'Authorization': `Bearer ${tokenResult.access_token}`
        }
    });

    // Token is discarded after use - edge function manages refresh
    return await response.json();
}
```

## Migration Path

### Phase 1: Add JWT Persistence (Without Breaking Current Code)
1. Add JWT localStorage save/load to EdgeClient
2. Test that JWT persists across page refresh
3. Verify JWT refresh works

### Phase 2: Remove Google Tokens from localStorage
1. Stop writing Google tokens to localStorage
2. Keep dual-write to Supabase (for now)
3. Update all token retrieval to use `edgeClient.getValidToken()`

### Phase 3: Remove Dual-Write Complexity
1. Simplify TokenStore to metadata-only
2. Remove localStorage writes for Google tokens
3. Edge function becomes single source of truth

## Benefits of Legacy Architecture

1. ✅ **Security**: Google tokens never exposed to XSS
2. ✅ **Simplicity**: Browser only manages JWT (single token)
3. ✅ **Reliability**: Edge function handles all OAuth refresh complexity
4. ✅ **Session restoration**: Just need JWT in localStorage
5. ✅ **Multi-device**: Each device has own JWT, but shares Google tokens in Supabase

## Summary

**Current Phase 3**: Browser stores Google tokens in localStorage + Supabase, JWT in memory only

**Legacy (Working)**: Browser stores JWT in localStorage, Google tokens in Supabase only

**Recommendation**: Adopt legacy architecture - it's simpler, more secure, and proven to work.
