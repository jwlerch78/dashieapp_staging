# Phase 3 v2: Edge Function Integration Guide

**Purpose:** Integrate access control and dashboard heartbeat into edge functions
**Prerequisites:** Phase 3 v2 database migration completed

---

## Table of Contents

1. [Access Control Flow](#access-control-flow)
2. [JWT Edge Function Updates](#jwt-edge-function-updates)
3. [Dashboard Heartbeat System](#dashboard-heartbeat-system)
4. [Version Check & Update System](#version-check--update-system)
5. [Client-Side Integration](#client-side-integration)

---

## Access Control Flow

### Overview

```
Client requests JWT
  ↓
Edge function checks access_control_config
  ↓
Beta mode? → Check beta_whitelist
Trial mode? → Check/create user_profile
  ↓
Access granted? → Issue JWT with tier info
Access denied? → Return error with reason
  ↓
Client handles response
```

---

## JWT Edge Function Updates

### Current JWT Function Location
**File:** `supabase/functions/jwt/index.ts` (or similar)

### Add Access Control Logic

```typescript
// supabase/functions/jwt/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  tier?: string;
  tier_expires_at?: string;
  trial_days_left?: number;
  max_dashboards?: number;
  max_calendars?: number;
  needs_update?: boolean;
  latest_version?: string;
}

serve(async (req) => {
  try {
    // 1. Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid auth token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 2. Check user access
    const access = await checkUserAccess(supabaseClient, user.id, user.email!)

    if (!access.allowed) {
      return new Response(JSON.stringify({
        error: 'access_denied',
        reason: access.reason,
        message: getAccessDeniedMessage(access.reason!)
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 3. Generate JWT with access info
    const jwt = await generateJWT({
      userId: user.id,
      email: user.email,
      tier: access.tier,
      tierExpiresAt: access.tier_expires_at,
      maxDashboards: access.max_dashboards,
      maxCalendars: access.max_calendars
    })

    // 4. Update user activity
    await updateUserActivity(supabaseClient, user.id)

    // 5. Return JWT with access info
    return new Response(JSON.stringify({
      jwt,
      access: {
        tier: access.tier,
        trial_days_left: access.trial_days_left,
        max_dashboards: access.max_dashboards,
        max_calendars: access.max_calendars,
        needs_update: access.needs_update,
        latest_version: access.latest_version
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('JWT function error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

// ============================================================================
// ACCESS CONTROL LOGIC
// ============================================================================

async function checkUserAccess(
  supabase: any,
  userId: string,
  email: string
): Promise<AccessCheckResult> {

  // 1. Get access control config
  const { data: configData } = await supabase
    .from('access_control_config')
    .select('key, value')

  const config: Record<string, string> = {}
  configData?.forEach((item: any) => {
    config[item.key] = item.value
  })

  // 2. Check maintenance mode
  if (config.maintenance_mode === 'true') {
    return { allowed: false, reason: 'maintenance_mode' }
  }

  // 3. BETA MODE
  if (config.beta_mode_enabled === 'true') {
    // Check beta whitelist
    const { data: whitelist } = await supabase
      .from('beta_whitelist')
      .select('email, access_granted_at')
      .eq('email', email)
      .single()

    if (!whitelist) {
      return { allowed: false, reason: 'beta_not_whitelisted' }
    }

    // Update access_granted_at if first sign-in
    if (!whitelist.access_granted_at) {
      await supabase
        .from('beta_whitelist')
        .update({ access_granted_at: new Date().toISOString() })
        .eq('email', email)
    }

    // Ensure user profile exists with beta tier
    await ensureUserProfile(supabase, userId, email, 'beta')

    const profile = await getUserProfile(supabase, userId)
    return {
      allowed: true,
      tier: 'beta',
      max_dashboards: profile.max_dashboards || 999,
      max_calendars: profile.max_calendars || 999,
      needs_update: await checkVersionUpdate(supabase, userId, config.current_app_version),
      latest_version: config.current_app_version
    }
  }

  // 4. TRIAL MODE (post-beta)
  if (config.trial_enabled === 'true') {
    let profile = await getUserProfile(supabase, userId)

    // New user - create trial
    if (!profile) {
      const trialDays = parseInt(config.trial_duration_days || '14')
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + trialDays)

      await createUserProfile(supabase, {
        auth_user_id: userId,
        email,
        tier: 'trial',
        tier_started_at: new Date().toISOString(),
        tier_expires_at: expiresAt.toISOString(),
        max_dashboards: 1,
        max_calendars: 2
      })

      return {
        allowed: true,
        tier: 'trial',
        tier_expires_at: expiresAt.toISOString(),
        trial_days_left: trialDays,
        max_dashboards: 1,
        max_calendars: 2,
        needs_update: await checkVersionUpdate(supabase, userId, config.current_app_version),
        latest_version: config.current_app_version
      }
    }

    // Existing trial user
    if (profile.tier === 'trial') {
      const now = new Date()
      const expiresAt = new Date(profile.tier_expires_at)

      if (now > expiresAt) {
        return { allowed: false, reason: 'trial_expired' }
      }

      const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

      return {
        allowed: true,
        tier: 'trial',
        tier_expires_at: profile.tier_expires_at,
        trial_days_left: daysLeft,
        max_dashboards: profile.max_dashboards,
        max_calendars: profile.max_calendars,
        needs_update: await checkVersionUpdate(supabase, userId, config.current_app_version),
        latest_version: config.current_app_version
      }
    }

    // Paid user
    if (profile.tier === 'basic' || profile.tier === 'pro') {
      if (profile.subscription_status !== 'active' && profile.subscription_status !== 'trialing') {
        return { allowed: false, reason: 'subscription_inactive' }
      }

      return {
        allowed: true,
        tier: profile.tier,
        max_dashboards: profile.max_dashboards,
        max_calendars: profile.max_calendars,
        needs_update: await checkVersionUpdate(supabase, userId, config.current_app_version),
        latest_version: config.current_app_version
      }
    }

    // Beta user (grandfathered)
    if (profile.tier === 'beta') {
      return {
        allowed: true,
        tier: 'beta',
        max_dashboards: profile.max_dashboards || 999,
        max_calendars: profile.max_calendars || 999,
        needs_update: await checkVersionUpdate(supabase, userId, config.current_app_version),
        latest_version: config.current_app_version
      }
    }
  }

  // Default: no access
  return { allowed: false, reason: 'unknown' }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getUserProfile(supabase: any, userId: string) {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('auth_user_id', userId)
    .single()

  return data
}

async function createUserProfile(supabase: any, profile: any) {
  const { data, error } = await supabase
    .from('user_profiles')
    .insert({
      ...profile,
      first_sign_in_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString()
    })
    .single()

  if (error) throw error
  return data
}

async function ensureUserProfile(
  supabase: any,
  userId: string,
  email: string,
  tier: string
) {
  const existing = await getUserProfile(supabase, userId)

  if (!existing) {
    await createUserProfile(supabase, {
      auth_user_id: userId,
      email,
      tier,
      tier_started_at: new Date().toISOString(),
      max_dashboards: tier === 'beta' ? 999 : 1,
      max_calendars: tier === 'beta' ? 999 : 2
    })
  }
}

async function updateUserActivity(supabase: any, userId: string) {
  await supabase
    .from('user_profiles')
    .update({
      last_sign_in_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString()
    })
    .eq('auth_user_id', userId)
}

async function checkVersionUpdate(
  supabase: any,
  userId: string,
  latestVersion: string
): Promise<boolean> {
  const { data } = await supabase
    .from('dashboard_heartbeats')
    .select('current_version')
    .eq('auth_user_id', userId)
    .single()

  if (!data || !data.current_version) return false

  // Simple version comparison (assumes semver: "1.2.3")
  return compareVersions(data.current_version, latestVersion) < 0
}

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)

  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1
    if (parts1[i] < parts2[i]) return -1
  }
  return 0
}

function getAccessDeniedMessage(reason: string): string {
  switch (reason) {
    case 'beta_not_whitelisted':
      return 'Dashie is currently in private beta. Request access at https://dashie.app/beta'
    case 'trial_expired':
      return 'Your trial has expired. Upgrade to continue using Dashie.'
    case 'subscription_inactive':
      return 'Your subscription is inactive. Please update your billing information.'
    case 'maintenance_mode':
      return 'Dashie is currently undergoing maintenance. Please try again later.'
    default:
      return 'Access denied. Please contact support.'
  }
}

async function generateJWT(payload: any): Promise<string> {
  // TODO: Implement actual JWT generation
  // For now, return a placeholder
  return 'jwt_token_placeholder'
}
```

---

## Dashboard Heartbeat System

### Heartbeat Edge Function

**Create:** `supabase/functions/heartbeat/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // 1. Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid auth token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 2. Parse heartbeat data
    const { version, device_type, device_fingerprint, user_agent } = await req.json()

    // 3. Upsert heartbeat
    const now = new Date().toISOString()
    const { data, error } = await supabaseClient
      .from('dashboard_heartbeats')
      .upsert({
        auth_user_id: user.id,
        current_version: version,
        device_type,
        device_fingerprint_hash: await hashString(device_fingerprint),
        user_agent,
        ip_address_hash: await hashString(req.headers.get('CF-Connecting-IP') || 'unknown'),
        is_online: true,
        last_heartbeat_at: now,
        session_started_at: now, // Will be overwritten if record exists
        total_heartbeats: 1 // Will be incremented if record exists
      }, {
        onConflict: 'auth_user_id',
        ignoreDuplicates: false
      })
      .select()
      .single()

    if (error && error.code !== '23505') { // Ignore duplicate key errors
      throw error
    }

    // 4. Increment heartbeat count if existing record
    if (data) {
      await supabaseClient.rpc('increment_heartbeat_count', {
        user_id: user.id
      })
    }

    // 5. Check if update needed
    const { data: config } = await supabaseClient
      .from('access_control_config')
      .select('value')
      .eq('key', 'current_app_version')
      .single()

    const latestVersion = config?.value || version
    const needsUpdate = compareVersions(version, latestVersion) < 0

    // 6. Update user_profiles.last_seen_at
    await supabaseClient
      .from('user_profiles')
      .update({ last_seen_at: now })
      .eq('auth_user_id', user.id)

    // 7. Return response
    return new Response(JSON.stringify({
      success: true,
      needs_update: needsUpdate,
      latest_version: latestVersion,
      is_online: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Heartbeat function error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

async function hashString(input: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)

  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1
    if (parts1[i] < parts2[i]) return -1
  }
  return 0
}
```

### Create RPC Function for Heartbeat Count

Add to your migration SQL:

```sql
-- Increment heartbeat count (called by heartbeat edge function)
CREATE OR REPLACE FUNCTION increment_heartbeat_count(user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE dashboard_heartbeats
  SET total_heartbeats = total_heartbeats + 1
  WHERE auth_user_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Version Check & Update System

### How it Works

1. **Admin updates version:**
   ```sql
   UPDATE access_control_config
   SET value = '0.4.0'
   WHERE key = 'current_app_version';
   ```

2. **Dashboard sends heartbeat every 60 seconds:**
   - Includes current app version
   - Edge function compares with latest version
   - Sets `needs_update = true` if outdated

3. **Client receives heartbeat response:**
   ```javascript
   {
     "success": true,
     "needs_update": true,
     "latest_version": "0.4.0",
     "is_online": true
   }
   ```

4. **Client reloads app:**
   - Shows "Updating..." message
   - Calls `location.reload()` to get new version from cache/server

---

## Client-Side Integration

### Heartbeat Service

**Create:** `js/data/services/heartbeat-service.js`

```javascript
import { createLogger } from '../../utils/logger.js';
import { JWTService } from '../auth/jwt/jwt.js';

const logger = createLogger('HeartbeatService');

class HeartbeatService {
  constructor() {
    this.heartbeatInterval = null;
    this.heartbeatFrequency = 60000; // 60 seconds
    this.currentVersion = '0.3.0'; // TODO: Get from build config
    this.deviceFingerprint = null;
  }

  async initialize() {
    logger.info('Initializing heartbeat service...');

    // Generate device fingerprint
    this.deviceFingerprint = await this.generateDeviceFingerprint();

    // Start heartbeat loop
    this.startHeartbeat();

    logger.success('Heartbeat service initialized');
  }

  async generateDeviceFingerprint() {
    // Simple fingerprint: browser + screen + timezone
    const data = [
      navigator.userAgent,
      screen.width + 'x' + screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language
    ].join('|');

    // Hash it
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  startHeartbeat() {
    // Send first heartbeat immediately
    this.sendHeartbeat();

    // Then send every 60 seconds
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatFrequency);

    logger.info(`Heartbeat started (every ${this.heartbeatFrequency / 1000}s)`);
  }

  async sendHeartbeat() {
    try {
      const jwt = await JWTService.getToken();
      if (!jwt) {
        logger.warn('No JWT token, skipping heartbeat');
        return;
      }

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
          user_agent: navigator.userAgent
        })
      });

      if (!response.ok) {
        throw new Error(`Heartbeat failed: ${response.status}`);
      }

      const data = await response.json();

      // Check if update needed
      if (data.needs_update) {
        logger.warn(`New version available: ${data.latest_version}`);
        this.handleUpdateAvailable(data.latest_version);
      }

    } catch (error) {
      logger.error('Heartbeat error:', error);
      // Don't throw - heartbeat failures shouldn't crash the app
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
    // Show update notification
    const shouldUpdate = confirm(
      `New version ${latestVersion} available. Update now? (Recommended)`
    );

    if (shouldUpdate) {
      logger.info('User accepted update, reloading...');
      this.stopHeartbeat();

      // Show loading indicator
      const app = document.getElementById('app');
      app.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-size: 24px;">
          Updating Dashie to ${latestVersion}...
        </div>
      `;

      // Force reload (bypass cache)
      setTimeout(() => {
        location.reload(true);
      }, 1000);
    } else {
      logger.info('User declined update');
      // Ask again in 5 minutes
      setTimeout(() => {
        this.handleUpdateAvailable(latestVersion);
      }, 5 * 60 * 1000);
    }
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.info('Heartbeat stopped');
    }
  }

  shutdown() {
    this.stopHeartbeat();
  }
}

export default new HeartbeatService();
```

### Add to main.js

```javascript
// main.js
import HeartbeatService from './js/data/services/heartbeat-service.js';

async function initializeApp() {
  // ... existing initialization ...

  // Start heartbeat service
  await HeartbeatService.initialize();

  // ... rest of initialization ...
}
```

---

## Admin Monitoring

### Check Online Dashboards

```sql
SELECT
  u.email,
  dh.is_online,
  dh.last_heartbeat_at,
  dh.current_version,
  dh.device_type,
  dh.total_heartbeats,
  EXTRACT(EPOCH FROM (NOW() - dh.last_heartbeat_at)) / 60 AS minutes_since_heartbeat
FROM dashboard_heartbeats dh
JOIN auth.users u ON u.id = dh.auth_user_id
WHERE dh.is_online = true
ORDER BY dh.last_heartbeat_at DESC;
```

### Mark Stale Dashboards Offline

Run this every 5 minutes via cron or scheduled function:

```sql
SELECT check_dashboard_online_status();
```

---

## Testing Checklist

### Access Control
- [ ] Beta user with whitelisted email can access
- [ ] Non-whitelisted email is blocked in beta mode
- [ ] Trial user gets correct expiration date
- [ ] Expired trial user is blocked
- [ ] Paid user with active subscription can access
- [ ] User with inactive subscription is blocked

### Heartbeat
- [ ] Dashboard sends heartbeat every 60 seconds
- [ ] Heartbeat updates last_heartbeat_at
- [ ] is_online flag is set to true
- [ ] Heartbeat count increments
- [ ] last_seen_at updates in user_profiles

### Version Check
- [ ] Dashboard with old version gets needs_update = true
- [ ] Dashboard with current version gets needs_update = false
- [ ] User can update when prompted
- [ ] Update reload works correctly

### Admin Monitoring
- [ ] Can see online dashboards in database
- [ ] Stale dashboards marked offline after 5 min

---

## Next Steps

1. **Deploy migration:** Run Phase 3 v2 migration SQL
2. **Add beta emails:** Insert test emails into beta_whitelist
3. **Update JWT edge function:** Implement access control logic
4. **Create heartbeat edge function:** Deploy heartbeat endpoint
5. **Integrate client-side:** Add HeartbeatService to app
6. **Test access flow:** Beta → Trial → Paid transitions
7. **Monitor dashboards:** Check real-time online status

---

## Summary

**Access Control:** Config-driven beta → trial → paid transitions
**Heartbeat:** Real-time dashboard status tracking (60s interval)
**Version Check:** Auto-update system for critical releases
**Monitoring:** Admin visibility into active users

All implemented via edge functions for security and scalability.
