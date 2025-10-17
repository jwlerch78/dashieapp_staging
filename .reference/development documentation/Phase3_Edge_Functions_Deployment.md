# Phase 3 v2: Edge Functions Deployment Guide

**Status:** Ready to deploy
**Functions:** jwt-auth, heartbeat

---

## What Changed

### Updated: `jwt-auth` Edge Function

**Key Changes:**
1. ✅ **Access Control** - Checks `beta_whitelist` before allowing access
2. ✅ **User Profiles** - Creates `user_profiles` on first login
3. ✅ **Token Storage** - Uses `user_auth_tokens` table (NOT `user_settings.tokenAccounts`)
4. ✅ **Settings Separation** - General settings still in `user_settings` (backward compatible)
5. ✅ **Tier Management** - Returns tier info in JWT response

**New Operations:**
- Access control check on every authentication
- Automatic user profile creation
- Beta whitelist enforcement

**Backward Compatibility:**
- ✅ `user_settings` table still works for general app preferences
- ✅ Existing operations (`load`, `save`, `get_valid_token`) work with new tables
- ✅ Token refresh logic preserved

---

### New: `heartbeat` Edge Function

**Purpose:** Track dashboard online status and version updates

**Called every 60 seconds with:**
```javascript
POST /heartbeat
Authorization: Bearer <jwt>
{
  "version": "0.3.0",
  "device_type": "fire_tv",
  "device_fingerprint": "unique-device-id",
  "user_agent": "Mozilla/5.0...",
  "dashboard_name": "Living Room TV"
}
```

**Returns:**
```javascript
{
  "success": true,
  "is_online": true,
  "needs_update": false,
  "latest_version": "0.3.0",
  "heartbeat_count": 42,
  "is_first_heartbeat": false
}
```

**What it does:**
- Updates `dashboard_heartbeats` table
- Updates `user_profiles.last_seen_at`
- Compares version with `access_control_config.current_app_version`
- Returns `needs_update: true` if client is outdated

---

## Deployment Steps

### 1. Deploy Edge Functions

```bash
# Deploy jwt-auth function
supabase functions deploy jwt-auth

# Deploy heartbeat function
supabase functions deploy heartbeat
```

### 2. Set Environment Variables

Make sure these are set in Supabase Dashboard → Edge Functions → Secrets:

```bash
JWT_SECRET=<your-jwt-secret>
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_DEVICE_CLIENT_ID=<your-device-client-id>
GOOGLE_DEVICE_CLIENT_SECRET=<your-device-client-secret>
```

**Get these from:**
- Supabase Dashboard → Settings → API
- Google Cloud Console → APIs & Services → Credentials

---

## Testing the Functions

### Test 1: JWT Auth with Access Control

```bash
# Test with Google access token (replace with real token)
curl -X POST https://your-project.supabase.co/functions/v1/jwt-auth \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "get_jwt_from_google",
    "googleAccessToken": "ya29.a0..."
  }'
```

**Expected (if whitelisted):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "your-email@gmail.com",
    "name": "Your Name",
    "provider": "google"
  },
  "jwtToken": "eyJ...",
  "access": {
    "tier": "beta",
    "max_dashboards": 999,
    "max_calendars": 999
  }
}
```

**Expected (if NOT whitelisted):**
```json
{
  "error": "access_denied",
  "reason": "beta_not_whitelisted",
  "message": "Dashie is currently in private beta. Request access at https://dashie.app/beta"
}
```

---

### Test 2: Heartbeat Function

```bash
# Test heartbeat (replace JWT with real token from step 1)
curl -X POST https://your-project.supabase.co/functions/v1/heartbeat \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "version": "0.3.0",
    "device_type": "browser",
    "device_fingerprint": "test-device-123",
    "user_agent": "Mozilla/5.0",
    "dashboard_name": "Test Dashboard"
  }'
```

**Expected:**
```json
{
  "success": true,
  "is_online": true,
  "needs_update": false,
  "latest_version": "0.3.0",
  "heartbeat_count": 1,
  "is_first_heartbeat": true
}
```

Then check database:
```sql
SELECT * FROM dashboard_heartbeats;
```

---

### Test 3: Token Storage (New Table)

```bash
# Store OAuth tokens (use JWT from test 1)
curl -X POST https://your-project.supabase.co/functions/v1/jwt-auth \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "store_tokens",
    "provider": "google",
    "account_type": "primary",
    "data": {
      "email": "your-email@gmail.com",
      "access_token": "ya29.test123",
      "refresh_token": "1//refresh123",
      "expires_in": 3600,
      "scope": "calendar.readonly calendar.events",
      "display_name": "Primary Calendar",
      "provider_info": {
        "type": "web_oauth",
        "client_id": "test-client-id"
      }
    }
  }'
```

Check tokens were stored:
```sql
SELECT
  auth_user_id,
  tokens->'google'->'primary'->>'email' as email,
  tokens->'google'->'primary'->>'access_token' as token,
  created_at
FROM user_auth_tokens;
```

**Expected:** Tokens stored in `user_auth_tokens`, NOT `user_settings`

---

### Test 4: Get Valid Token (with auto-refresh)

```bash
# Get valid token (will refresh if expired)
curl -X POST https://your-project.supabase.co/functions/v1/jwt-auth \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "get_valid_token",
    "provider": "google",
    "account_type": "primary"
  }'
```

**Expected:**
```json
{
  "success": true,
  "access_token": "ya29.test123",
  "expires_at": "2025-10-17T12:00:00Z",
  "scopes": ["calendar.readonly", "calendar.events"],
  "refreshed": false
}
```

---

## Database Verification

After testing, verify data in correct tables:

```sql
-- 1. User profiles created
SELECT
  email,
  tier,
  max_dashboards,
  max_calendars,
  first_sign_in_at,
  last_sign_in_at
FROM user_profiles;

-- 2. Tokens stored separately
SELECT
  auth_user_id,
  jsonb_pretty(tokens) as tokens,
  created_at
FROM user_auth_tokens;

-- 3. Settings still work (but no tokens)
SELECT
  email,
  settings ? 'tokenAccounts' as has_token_accounts,
  settings->>'theme' as theme,
  updated_at
FROM user_settings;
-- Should show: has_token_accounts = false (tokens moved to user_auth_tokens)

-- 4. Dashboard heartbeats tracked
SELECT
  u.email,
  dh.is_online,
  dh.last_heartbeat_at,
  dh.current_version,
  dh.total_heartbeats,
  dh.device_type
FROM dashboard_heartbeats dh
JOIN auth.users u ON u.id = dh.auth_user_id;

-- 5. Beta whitelist working
SELECT
  email,
  access_granted_at,
  invited_by
FROM beta_whitelist
ORDER BY access_granted_at DESC;
```

---

## Client Integration

### Update Your Client Code

**1. Update JWT Service to handle access info:**

```javascript
// js/data/auth/jwt/jwt-manager.js
async obtainJWT(googleAccessToken) {
  const response = await fetch(`${this.edgeBaseUrl}/jwt-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operation: 'get_jwt_from_google',
      googleAccessToken
    })
  });

  const data = await response.json();

  if (!response.ok) {
    // Handle access denied
    if (data.error === 'access_denied') {
      throw new Error(`Access Denied: ${data.message}`);
    }
    throw new Error(data.error || 'Failed to obtain JWT');
  }

  // Store JWT and access info
  this.jwtToken = data.jwtToken;
  this.accessInfo = data.access; // { tier, max_dashboards, max_calendars, trial_days_left }

  return data;
}
```

**2. Implement Heartbeat Service:**

```javascript
// js/data/services/heartbeat-service.js
import { createLogger } from '../../utils/logger.js';
import { JWTService } from '../auth/jwt/jwt.js';

const logger = createLogger('HeartbeatService');

class HeartbeatService {
  constructor() {
    this.heartbeatInterval = null;
    this.heartbeatFrequency = 60000; // 60 seconds
    this.currentVersion = '0.3.0'; // TODO: Get from build
    this.deviceFingerprint = null;
  }

  async initialize() {
    logger.info('Initializing heartbeat service...');
    this.deviceFingerprint = await this.generateDeviceFingerprint();
    this.startHeartbeat();
  }

  async generateDeviceFingerprint() {
    const data = [
      navigator.userAgent,
      screen.width + 'x' + screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language
    ].join('|');

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  startHeartbeat() {
    this.sendHeartbeat(); // First heartbeat immediately
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatFrequency);
  }

  async sendHeartbeat() {
    try {
      const jwt = await JWTService.getToken();
      if (!jwt) return;

      const response = await fetch(`${JWTService.edgeBaseUrl}/heartbeat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          version: this.currentVersion,
          device_type: this.getDeviceType(),
          device_fingerprint: this.deviceFingerprint,
          user_agent: navigator.userAgent,
          dashboard_name: 'My Dashboard' // TODO: Let user customize
        })
      });

      if (!response.ok) {
        throw new Error(`Heartbeat failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.needs_update) {
        logger.warn(`Update available: ${data.latest_version}`);
        this.handleUpdateAvailable(data.latest_version);
      }
    } catch (error) {
      logger.error('Heartbeat error:', error);
    }
  }

  getDeviceType() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('aftm')) return 'fire_tv';
    if (ua.includes('android') && ua.includes('tv')) return 'android_tv';
    if (ua.includes('android')) return 'native_android';
    return 'browser';
  }

  handleUpdateAvailable(latestVersion) {
    if (confirm(`New version ${latestVersion} available. Update now?`)) {
      location.reload(true);
    }
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

export default new HeartbeatService();
```

**3. Add to main.js:**

```javascript
// main.js
import HeartbeatService from './js/data/services/heartbeat-service.js';

async function initializeApp() {
  // ... existing auth initialization ...

  // Start heartbeat after authentication
  await HeartbeatService.initialize();

  // ... rest of initialization ...
}
```

---

## Monitoring & Admin Queries

### See Online Users

```sql
SELECT
  u.email,
  dh.is_online,
  dh.last_heartbeat_at,
  dh.current_version,
  dh.device_type,
  EXTRACT(EPOCH FROM (NOW() - dh.last_heartbeat_at)) / 60 AS minutes_since_heartbeat
FROM dashboard_heartbeats dh
JOIN auth.users u ON u.id = dh.auth_user_id
WHERE dh.is_online = true
ORDER BY dh.last_heartbeat_at DESC;
```

### Mark Stale Dashboards Offline

Run this every 5 minutes (via cron or scheduled function):

```sql
SELECT check_dashboard_online_status();
```

### Force Update for All Users

```sql
-- Update app version (all users will see needs_update: true)
UPDATE access_control_config
SET value = '0.4.0'
WHERE key = 'current_app_version';
```

---

## Troubleshooting

### Issue: "Access denied - beta_not_whitelisted"

**Solution:** Add email to beta whitelist
```sql
INSERT INTO beta_whitelist (email, invited_by, notes)
VALUES ('user@example.com', 'Admin', 'Beta tester');
```

### Issue: Tokens still in user_settings.tokenAccounts

**Solution:** Old tokens might still be there. They're ignored now. Clean up:
```sql
UPDATE user_settings
SET settings = settings - 'tokenAccounts'
WHERE settings ? 'tokenAccounts';
```

### Issue: Heartbeat not updating

**Check:**
1. JWT is valid (`Authorization: Bearer <jwt>`)
2. User has profile in `user_profiles`
3. Check edge function logs in Supabase Dashboard

---

## Next Steps

1. ✅ Deploy functions: `supabase functions deploy jwt-auth heartbeat`
2. ✅ Test access control with whitelisted/non-whitelisted emails
3. ✅ Test token storage in new `user_auth_tokens` table
4. ✅ Test heartbeat updates `dashboard_heartbeats`
5. ✅ Integrate HeartbeatService in client app
6. ✅ Test version update prompt
7. ✅ Monitor online users in database

---

## Summary

**New Architecture:**
- ✅ Access control enforced (beta whitelist)
- ✅ User profiles created automatically
- ✅ Tokens stored in `user_auth_tokens` (secure)
- ✅ General settings in `user_settings` (backward compatible)
- ✅ Heartbeat tracking (online status, version checking)

**Backward Compatible:**
- ✅ Existing `user_settings` operations work
- ✅ Token refresh logic preserved
- ✅ All existing edge function operations work

**Ready for:**
- ✅ Beta launch with whitelist
- ✅ Stripe integration (user_profiles has tier/billing fields)
- ✅ Trial → Paid transitions (just flip config flags)
