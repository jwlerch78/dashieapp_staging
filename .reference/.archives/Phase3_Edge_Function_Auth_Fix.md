# Phase 3 - Edge Function Authentication Fix

## Problem Solved
**Issue:** 401 "Missing authorization header" when calling Supabase edge functions
**Date Fixed:** 2025-10-17

## Root Cause
When calling Supabase Edge Functions directly via fetch(), you **MUST** include the Supabase anon key in the `apikey` header. Without it, Supabase's API gateway rejects requests with a 401 error **before** they reach your edge function code.

## Solution
Added Supabase anon key to all edge function fetch requests.

### Files Modified

#### 1. js/auth/auth-config.js
Added centralized Supabase configuration:

```javascript
/**
 * Supabase Configuration
 * NOTE: Supabase anon key is SAFE to expose in client code - it's public by design
 * Only the service role key must be kept secret (server-side only)
 */
export const SUPABASE_CONFIG = {
  url: 'https://cwglbtosingboqepsmjk.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3Z2xidG9zaW5nYm9xZXBzbWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI1OTU3NzMsImV4cCI6MjAyODE3MTc3M30.xFAM4BzOPq4fv2qx8OWRsMpjZGh5k5ITY1hBVlDnYs8',
  edgeFunctionUrl: 'https://cwglbtosingboqepsmjk.supabase.co/functions/v1/jwt-auth'
};
```

#### 2. js/data/auth/providers/web-oauth.js
Updated to import from centralized config and include apikey header:

```javascript
import { SUPABASE_CONFIG } from '../../../auth/auth-config.js';

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.edgeFunctionUrl;
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey;

// In exchangeCodeForTokens():
const response = await fetch(EDGE_FUNCTION_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY  // ← This is required!
  },
  body: JSON.stringify({
    operation: 'exchange_code',
    data: { ... }
  })
});
```

#### 3. js/data/auth/providers/device-flow.js
Same pattern as web-oauth.js:

```javascript
import { SUPABASE_CONFIG } from '../../../auth/auth-config.js';

const EDGE_FUNCTION_URL = SUPABASE_CONFIG.edgeFunctionUrl;
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey;

// In requestTokens():
const response = await fetch(EDGE_FUNCTION_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY  // ← This is required!
  },
  body: JSON.stringify({
    operation: 'poll_device_code',
    data: { ... }
  })
});
```

## Important Notes

### What's Safe in Client Code vs Server-Only

**SAFE in client code (public by design):**
- ✅ Supabase anon key
- ✅ Google OAuth Client IDs
- ✅ Supabase project URL
- ✅ Edge function URLs

**MUST stay server-side only:**
- ❌ Google OAuth Client Secrets (environment variables in edge function)
- ❌ Supabase service role key (environment variables in edge function)
- ❌ JWT secret (environment variables in edge function)

### About the Supabase Anon Key
**IT IS SAFE** to have the Supabase anon key in client-side code:
- The anon key is **designed to be public**
- It's used by all official Supabase client SDKs
- It only grants access to data allowed by Row Level Security (RLS) policies
- The **service role key** is what must stay secret (server-side only)

### Why This Was Lost
During a context reset, the AI assistant may not have understood that the anon key was intentionally added to client code and removed it thinking it was a security issue. This is incorrect - the anon key is meant to be public.

### If This Breaks Again
1. Check that `SUPABASE_CONFIG` exists in [js/auth/auth-config.js](../js/auth/auth-config.js)
2. Check that both provider files import it:
   - [js/data/auth/providers/web-oauth.js](../js/data/auth/providers/web-oauth.js)
   - [js/data/auth/providers/device-flow.js](../js/data/auth/providers/device-flow.js)
3. Check that all edge function fetch() calls include `'apikey': SUPABASE_ANON_KEY` in headers
4. If edge function logs show no requests, the 401 is from Supabase gateway (missing apikey)
5. If edge function logs show requests, the 401 is from your function code (different issue)

## Testing
After this fix:
1. Google OAuth login flow should work without 401 errors
2. Edge function logs should show incoming requests
3. Token exchange should complete successfully

## Related Files
- Edge function: [supabase/functions/jwt-auth/index.ts](../supabase/functions/jwt-auth/index.ts)
- Auth config: [js/auth/auth-config.js](../js/auth/auth-config.js)
- Web OAuth: [js/data/auth/providers/web-oauth.js](../js/data/auth/providers/web-oauth.js)
- Device Flow: [js/data/auth/providers/device-flow.js](../js/data/auth/providers/device-flow.js)
