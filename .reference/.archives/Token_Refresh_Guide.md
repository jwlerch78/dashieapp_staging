# Token Refresh Implementation Guide

**Date:** 2025-10-17
**Status:** Ready for implementation

---

## Token Storage Structure

Tokens now include `provider_info` that tells us which OAuth method was used:

```javascript
{
  "google": {
    "primary": {
      "access_token": "ya29.a0...",
      "refresh_token": "1//0e...",
      "expires_at": "2025-10-17T20:30:00.000Z",
      "scopes": ["profile", "email", "calendar.readonly"],
      "email": "user@gmail.com",
      "display_name": "John Doe",
      "is_active": true,
      "created_at": "2025-10-17T18:30:00.000Z",
      "updated_at": "2025-10-17T18:30:00.000Z",
      "provider_info": {
        "type": "web_oauth" | "device_flow",
        "auth_method": "web_oauth" | "device_flow",
        "client_id": "221142210647-..."
      }
    }
  }
}
```

---

## Why Provider Info Matters

### Different Refresh Endpoints:

**Web OAuth:**
- Client ID: `221142210647-58t8hr48rk7nlgl56j969himso1qjjoo`
- Client Secret: `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`
- Requires: `client_id` + `client_secret` + `refresh_token`

**Device Flow:**
- Client ID: `221142210647-m9vf7t0qgm6nlc6gggfsqefmjrak1mo9`
- Client Secret: `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`
- May work without client_secret (public client)
- Requires: `client_id` + `refresh_token`

### Token Refresh Flow:

```
Token Expired (detected in GoogleAPIClient)
     │
     ├─> Read token from TokenStore
     │
     ├─> Check provider_info.type
     │   ├─> "web_oauth" → Use WebOAuthProvider.refreshAccessToken()
     │   └─> "device_flow" → Use DeviceFlowProvider.refreshAccessToken()
     │
     ├─> Call Google Token Endpoint with correct client credentials
     │
     ├─> Receive new access_token (refresh_token usually stays same)
     │
     └─> Update TokenStore with new access_token + new expires_at
```

---

## Implementation in GoogleAPIClient

### Current Code (throws error):
```javascript
async getAccessToken(forceRefresh = false, accountType = 'primary') {
  const tokenData = await this.tokenStore.getAccountTokens('google', accountType);

  if (tokenData.isExpired) {
    throw new Error(`Token expired for google/${accountType}. Refresh not implemented yet.`);
  }

  return tokenData.access_token;
}
```

### Updated Code (with refresh):
```javascript
async getAccessToken(forceRefresh = false, accountType = 'primary') {
  let tokenData = await this.tokenStore.getAccountTokens('google', accountType);

  if (!tokenData) {
    throw new Error(`No tokens found for google/${accountType}`);
  }

  // Refresh if expired or force refresh requested
  if (tokenData.isExpired || forceRefresh) {
    logger.info('Token expired or refresh forced, refreshing...', { accountType });

    try {
      // Refresh based on provider type
      const newTokenData = await this.refreshToken(tokenData, accountType);

      // Update token store with new tokens
      await this.tokenStore.storeAccountTokens('google', accountType, {
        ...tokenData,
        access_token: newTokenData.access_token,
        expires_at: new Date(Date.now() + (newTokenData.expires_in * 1000)).toISOString(),
        updated_at: new Date().toISOString()
      });

      logger.success('Token refreshed successfully', { accountType });

      // Re-fetch updated token
      tokenData = await this.tokenStore.getAccountTokens('google', accountType);

    } catch (error) {
      logger.error('Token refresh failed', { accountType, error: error.message });
      throw new Error(`Failed to refresh token: ${error.message}`);
    }
  }

  return tokenData.access_token;
}

/**
 * Refresh token based on provider type
 * @private
 */
async refreshToken(tokenData, accountType) {
  const providerType = tokenData.provider_info?.type || 'web_oauth';
  const clientId = tokenData.provider_info?.client_id;

  logger.debug('Refreshing token', {
    accountType,
    providerType,
    clientId
  });

  // Use appropriate client secret based on provider
  let clientSecret;
  if (providerType === 'web_oauth') {
    clientSecret = AUTH_CONFIG.client_secret_web_oauth;
  } else if (providerType === 'device_flow') {
    clientSecret = AUTH_CONFIG.client_secret_device_flow;
  } else {
    throw new Error(`Unknown provider type: ${providerType}`);
  }

  // Make refresh request to Google
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
  }

  const newTokens = await response.json();

  return {
    access_token: newTokens.access_token,
    expires_in: newTokens.expires_in || 3600, // Default 1 hour
    // Note: refresh_token usually NOT returned (same one continues to work)
  };
}
```

---

## Where to Add This

**File:** `js/data/services/google/google-api-client.js`

**Lines to update:**
- Line 25-40: Update `getAccessToken()` method
- Add new: `refreshToken()` private method

**Import needed:**
```javascript
import { AUTH_CONFIG } from '../../../auth/auth-config.js';
```

---

## Testing Token Refresh

### Manual Test (Expire Token Early):

1. **Sign in** normally (get tokens)

2. **Manually expire token** in DevTools console:
   ```javascript
   // Get current tokens
   const tokens = JSON.parse(localStorage.getItem('dashie-auth-tokens'));

   // Set expiry to past
   tokens.google.primary.expires_at = new Date(Date.now() - 3600000).toISOString();

   // Save back
   localStorage.setItem('dashie-auth-tokens', JSON.stringify(tokens));

   // Reload page
   location.reload();
   ```

3. **Try to fetch calendars** - should automatically refresh

4. **Check console** - should see "Token refreshed successfully"

5. **Verify new token** in localStorage

### Natural Test (Wait for Expiry):

1. Sign in and use app
2. Wait ~1 hour (access token expiry)
3. Try to use calendar features
4. Should auto-refresh seamlessly

---

## Error Handling

### Refresh Token Expired/Revoked:

```javascript
catch (error) {
  if (error.message.includes('invalid_grant')) {
    // Refresh token no longer valid
    logger.error('Refresh token revoked or expired - user must re-authenticate');

    // Clear tokens
    await this.tokenStore.removeAccountTokens('google', accountType);

    // Redirect to login
    window.location.reload();
  } else {
    throw error;
  }
}
```

### Network Error During Refresh:

```javascript
catch (error) {
  if (error.name === 'TypeError' || error.message.includes('fetch')) {
    // Network error - retry once
    logger.warn('Network error during token refresh, retrying...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await this.refreshToken(tokenData, accountType);
  } else {
    throw error;
  }
}
```

---

## Token Lifecycle

```
1. User Signs In
   ↓
2. Tokens Stored with provider_info
   ├─> access_token (expires in ~1 hour)
   └─> refresh_token (expires in days/weeks)
   ↓
3. App Uses access_token for API calls
   ↓
4. access_token Expires (after ~1 hour)
   ↓
5. GoogleAPIClient Detects Expiry
   ↓
6. Reads provider_info.type from TokenStore
   ↓
7. Calls Google with refresh_token + correct client credentials
   ↓
8. Receives New access_token
   ↓
9. Updates TokenStore
   ↓
10. Returns New access_token to caller
    ↓
11. API Call Succeeds
    ↓
12. Repeat from step 3 (next hour)
```

---

## Refresh Token Validity

### Web OAuth:
- **Expiry:** Up to 6 months of inactivity
- **Revoked if:** User revokes app permissions, changes password, or reaches token limit (50 per client per user)

### Device Flow:
- **Expiry:** Same as Web OAuth
- **Additional:** May expire if user doesn't complete flow within expiry window (usually 15 min)

### Best Practice:
- Always check for `invalid_grant` error
- Clear tokens and require re-authentication
- Don't retry infinitely - 1-2 retries max

---

## Priority

**HIGH** - Users will hit this within first hour of usage.

Suggested timeline:
- **Day 1:** Test device flow on Fire TV
- **Day 2:** Implement token refresh
- **Day 3:** Test token refresh naturally (wait for expiry)
- **Day 4:** Deploy with confidence

---

*Generated: 2025-10-17*
*Critical for production readiness!*
