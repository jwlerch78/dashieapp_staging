# Hybrid Device Flow Authentication Architecture

**Status**: Planning / Phase 5.5
**Priority**: High
**Author**: Architecture Document
**Last Updated**: 2025-10-20

---

## Table of Contents

1. [Overview](#overview)
2. [Motivation](#motivation)
3. [Architecture Principles](#architecture-principles)
4. [System Architecture](#system-architecture)
5. [Token Architecture](#token-architecture)
6. [Database Schema](#database-schema)
7. [Edge Function Specifications](#edge-function-specifications)
8. [Client Implementation - Fire TV](#client-implementation---fire-tv)
9. [Client Implementation - Phone](#client-implementation---phone)
10. [Security Implementation](#security-implementation)
11. [Error Handling](#error-handling)
12. [Implementation Checklist](#implementation-checklist)
13. [Testing Strategy](#testing-strategy)

---

## Overview

Hybrid Device Flow is a custom OAuth authentication flow that enables **dual-device authentication** with a single OAuth consent. A user scans a QR code on their Fire TV with their phone, signs in with Google once, and both devices are authenticated simultaneously.

### Key Features

- ✅ **Single OAuth Consent** - User signs in with Google once on their phone
- ✅ **Dual Device Auth** - Both Fire TV and phone get authenticated
- ✅ **Unified Token Management** - Both devices share the same OAuth tokens (`primary`)
- ✅ **No Device-Specific Tokens** - Eliminates `primary-tv` complexity
- ✅ **Better UX** - No typing codes on Fire TV remote
- ✅ **Provider Agnostic** - Works with any OAuth provider
- ✅ **Your Control** - Custom device flow, not Google's

---

## Motivation

### Current Limitations

**Current Implementation:**
```
Fire TV → Google Device Flow → primary-tv tokens
Phone   → Google OAuth      → primary tokens
```

**Problems:**
1. Two separate OAuth consents required
2. Managing `primary` vs `primary-tv` tokens is complex
3. Tokens can get out of sync between devices
4. Fire TV QR code uses Google's device flow (less control)

### Hybrid Flow Solution

**New Implementation:**
```
Fire TV → Custom Device Code → QR Code
Phone   → Scan QR → Google OAuth → Links to Fire TV
Result  → Both devices share 'primary' tokens
```

**Benefits:**
1. Single OAuth consent
2. Only `primary` tokens needed (no more `primary-tv`)
3. Both devices always in sync (same tokens)
4. Full control over device flow
5. Device differentiation via JWT (not OAuth tokens)

---

## Architecture Principles

### 1. **Token Unification**

All devices share the same OAuth tokens stored at `tokens.google.primary`. Device differentiation happens at the **JWT session level**, not the OAuth token level.

### 2. **JWT-Based Device Identity**

Each device gets a unique JWT with device metadata:

```javascript
// Fire TV JWT
{
  sub: "user-id-123",
  email: "user@gmail.com",
  device_type: "firetv",
  device_id: "unique-firetv-id",
  session_id: "session-abc"
}

// Phone JWT
{
  sub: "user-id-123",
  email: "user@gmail.com",
  device_type: "phone",
  device_id: "unique-phone-id",
  session_id: "session-xyz"
}
```

Both JWTs grant access to the same `tokens.google.primary` when accessing Google Calendar API.

### 3. **Server-Side Security**

All critical operations happen server-side:
- Device code generation
- OAuth token exchange
- Device linking
- JWT generation

### 4. **Graceful Degradation**

Keep existing `WebOAuthProvider` and `DeviceFlowProvider` as fallback options during rollout.

---

## System Architecture

### High-Level Flow Diagram

```
┌─────────────┐                                      ┌──────────────┐
│   Fire TV   │                                      │    Phone     │
└──────┬──────┘                                      └──────┬───────┘
       │                                                    │
       │ 1. Create Device Code                             │
       ├──────────────────────────────────────────────────>│
       │    POST /jwt-auth                                 │
       │    { operation: "create_device_code" }            │
       │                                                    │
       │<─────────────────────────────────────────────────┤
       │    { device_code, user_code, qr_url }             │
       │                                                    │
       │ 2. Display QR Code                                │
       │    + User Code (ABCD-EFGH)                        │
       │    + Polling Status                               │
       │                                                    │
       │                                     3. Scan QR     │
       │                                        Code        │
       │                                                    │
       │                              4. Google OAuth Flow │
       │                                 (user consents)    │
       │                                                    │
       │                              5. Link Device Code  │
       │<─────────────────────────────────────────────────┤
       │    POST /jwt-auth                                 │
       │    { operation: "authorize_device_code",          │
       │      device_code, googleAccessToken }             │
       │                                                    │
       │    ┌──────────────────────────────────┐           │
       │    │  Edge Function Actions:          │           │
       │    │  - Verify Google token           │           │
       │    │  - Get/create auth user          │           │
       │    │  - Store tokens.google.primary   │           │
       │    │  - Mark device session authorized│           │
       │    │  - Generate Phone JWT            │           │
       │    └──────────────────────────────────┘           │
       │                                                    │
       │                                                    │
       │ 6. Polling Detects Authorization                  │
       ├──────────────────────────────────────────────────>│
       │    POST /jwt-auth                                 │
       │    { operation: "poll_device_code_status" }       │
       │                                                    │
       │<─────────────────────────────────────────────────┤
       │    { success: true, jwtToken (Fire TV) }          │
       │                                                    │
       │ 7. Both Devices Authenticated                     │
       │    - Fire TV has JWT (device_type: "firetv")      │
       │    - Phone has JWT (device_type: "phone")         │
       │    - Both access tokens.google.primary            │
       │                                                    │
```

### Component Interaction

```
┌──────────────────┐
│    Fire TV       │
│  Client Code     │
└────────┬─────────┘
         │
         │ creates device code
         │ polls for status
         │
         ▼
┌──────────────────┐         ┌──────────────────┐
│  HybridDeviceAuth│◄────────│  AuthCoordinator │
│   (new class)    │         │   (updated)      │
└────────┬─────────┘         └──────────────────┘
         │
         │ Edge function calls
         │
         ▼
┌──────────────────────────────────────────────┐
│        Edge Function: /jwt-auth              │
│                                              │
│  Operations:                                 │
│  - create_device_code                        │
│  - poll_device_code_status                   │
│  - authorize_device_code                     │
│                                              │
│  Database:                                   │
│  - device_auth_sessions                      │
│  - user_auth_tokens                          │
│  - auth.users                                │
└────────────────┬─────────────────────────────┘
                 │
                 │ stores/retrieves
                 │
                 ▼
┌──────────────────────────────────────────────┐
│            Supabase Database                 │
│                                              │
│  Tables:                                     │
│  - device_auth_sessions                      │
│  - user_auth_tokens (tokens.google.primary)  │
│  - auth.users                                │
└──────────────────────────────────────────────┘
```

---

## Token Architecture

### Single Primary Token Model

**All devices share the same OAuth tokens:**

```javascript
// user_auth_tokens table
{
  auth_user_id: "user-123",
  tokens: {
    google: {
      primary: {
        access_token: "ya29.a0...",
        refresh_token: "1//0g...",
        expires_at: "2025-10-20T15:30:00Z",
        scopes: ["profile", "email", "calendar.readonly"],
        email: "user@gmail.com",
        display_name: "John Doe",
        is_active: true,
        created_at: "2025-10-20T10:00:00Z",
        updated_at: "2025-10-20T10:00:00Z",
        provider_info: {
          type: "web_oauth",
          client_id: "221142210647-58t8hr48rk7nlgl56j969himso1qjjoo.apps.googleusercontent.com"
        }
      }
      // NO MORE primary-tv!
      // account2, account3, etc. for additional calendars only
    }
  }
}
```

### JWT Session Differentiation

**Fire TV Session:**
```javascript
{
  aud: "authenticated",
  exp: 1729612800,
  iat: 1729351600,
  iss: "supabase",
  sub: "user-123",
  email: "user@gmail.com",
  role: "authenticated",

  // Device-specific metadata
  device_type: "firetv",
  device_id: "firetv-abc123-xyz",
  session_id: "sess-firetv-20251020-001",

  app_metadata: {
    provider: "google",
    providers: ["google"]
  },
  user_metadata: {
    email: "user@gmail.com"
  }
}
```

**Phone Session:**
```javascript
{
  aud: "authenticated",
  exp: 1729612800,
  iat: 1729351600,
  iss: "supabase",
  sub: "user-123",
  email: "user@gmail.com",
  role: "authenticated",

  // Device-specific metadata
  device_type: "phone",
  device_id: "phone-xyz789-abc",
  session_id: "sess-phone-20251020-001",

  app_metadata: {
    provider: "google",
    providers: ["google"]
  },
  user_metadata: {
    email: "user@gmail.com"
  }
}
```

### Token Access Flow

**Both devices access the same token:**

```javascript
// Fire TV
const token = await edgeClient.getValidToken('google', 'primary');
// Returns tokens.google.primary

// Phone
const token = await edgeClient.getValidToken('google', 'primary');
// Returns tokens.google.primary (same as Fire TV)
```

---

## Database Schema

### device_auth_sessions Table

```sql
-- Create device_auth_sessions table
CREATE TABLE device_auth_sessions (
  -- Primary Key
  device_code VARCHAR(64) PRIMARY KEY,

  -- User-facing code (displayed on TV)
  user_code VARCHAR(8) NOT NULL UNIQUE,

  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- Values: 'pending', 'authorized', 'expired', 'consumed'

  -- User linkage (set when authorized)
  user_id UUID REFERENCES auth.users(id),

  -- OAuth token data (stored when authorized)
  google_token_data JSONB,
  -- Structure: { access_token, refresh_token, expires_in, scope }

  -- Device metadata
  device_type VARCHAR(50),
  -- Values: 'firetv', 'androidtv', 'appletv', etc.
  device_info JSONB,
  -- Structure: { model, os_version, app_version, ip_address }

  -- Phone metadata (recorded during authorization)
  phone_user_agent TEXT,
  phone_ip_address INET,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  authorized_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  consumed_at TIMESTAMP WITH TIME ZONE,

  -- Verification URL
  verification_url TEXT NOT NULL,

  -- Indexes
  CONSTRAINT valid_status CHECK (status IN ('pending', 'authorized', 'expired', 'consumed'))
);

-- Indexes
CREATE INDEX idx_device_auth_user_code ON device_auth_sessions(user_code);
CREATE INDEX idx_device_auth_status ON device_auth_sessions(status);
CREATE INDEX idx_device_auth_expires ON device_auth_sessions(expires_at);
CREATE INDEX idx_device_auth_status_expires ON device_auth_sessions(status, expires_at);

-- Comments
COMMENT ON TABLE device_auth_sessions IS 'Hybrid device flow authentication sessions';
COMMENT ON COLUMN device_auth_sessions.device_code IS 'Server-side device code (64 char hex)';
COMMENT ON COLUMN device_auth_sessions.user_code IS 'User-facing code displayed on TV (8 chars)';
COMMENT ON COLUMN device_auth_sessions.status IS 'Session status: pending, authorized, expired, consumed';
COMMENT ON COLUMN device_auth_sessions.consumed_at IS 'When JWT was issued to Fire TV (prevents replay)';
```

### Cleanup Function

```sql
-- Auto-cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_device_sessions()
RETURNS void AS $$
BEGIN
  -- Delete expired sessions older than 24 hours (for audit)
  DELETE FROM device_auth_sessions
  WHERE status = 'expired' AND expires_at < NOW() - INTERVAL '24 hours';

  -- Delete old consumed sessions (older than 7 days)
  DELETE FROM device_auth_sessions
  WHERE status = 'consumed' AND consumed_at < NOW() - INTERVAL '7 days';

  -- Mark pending sessions as expired if past expiration
  UPDATE device_auth_sessions
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW();

  RAISE NOTICE 'Cleaned up expired device sessions';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup job (every 15 minutes)
SELECT cron.schedule(
  'cleanup-device-sessions',
  '*/15 * * * *',
  'SELECT cleanup_expired_device_sessions()'
);
```

### user_auth_tokens Table

**No schema changes needed!** Existing structure supports unified tokens:

```sql
-- user_auth_tokens (existing)
CREATE TABLE user_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tokens JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tokens structure (JSONB):
{
  "google": {
    "primary": {
      "access_token": "...",
      "refresh_token": "...",
      "expires_at": "...",
      "scopes": [...],
      "email": "...",
      "display_name": "...",
      "is_active": true,
      "created_at": "...",
      "updated_at": "...",
      "provider_info": {...}
    }
  }
}
```

---

## Edge Function Specifications

### Operation: create_device_code

**Purpose:** Generate a device code and user code for Fire TV authentication.

**Request:**
```typescript
POST /functions/v1/jwt-auth
Content-Type: application/json

{
  "operation": "create_device_code",
  "data": {
    "device_type": "firetv",
    "device_info": {
      "model": "Fire TV Stick 4K",
      "os_version": "Fire OS 7",
      "app_version": "0.3.0",
      "ip_address": "192.168.1.100"
    }
  }
}
```

**Response (Success):**
```typescript
{
  "success": true,
  "device_code": "a1b2c3d4e5f6...", // 64 char hex
  "user_code": "ABCD-EFGH",          // 8 chars, formatted
  "verification_url": "https://dashieapp.com/auth?code=ABCD-EFGH&type=firetv",
  "expires_in": 600,                 // seconds (10 minutes)
  "interval": 5                      // polling interval in seconds
}
```

**Implementation:**
```typescript
async function handleCreateDeviceCode(data: any) {
  // 1. Generate device code (32 random bytes → 64 char hex)
  const deviceCode = crypto.randomBytes(32).toString('hex');

  // 2. Generate user code (8 chars, no ambiguous chars)
  const userCode = generateUserCode(); // Returns "ABCD-EFGH"

  // 3. Build verification URL
  const verificationUrl = `https://dashieapp.com/auth?code=${userCode}&type=${data.device_type || 'firetv'}`;

  // 4. Set expiration (10 minutes)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // 5. Insert into database
  await supabase.from('device_auth_sessions').insert({
    device_code: deviceCode,
    user_code: userCode,
    status: 'pending',
    device_type: data.device_type || 'firetv',
    device_info: data.device_info,
    verification_url: verificationUrl,
    expires_at: expiresAt.toISOString()
  });

  // 6. Return response
  return {
    success: true,
    device_code: deviceCode,
    user_code: userCode,
    verification_url: verificationUrl,
    expires_in: 600,
    interval: 5
  };
}
```

**User Code Generation:**
```typescript
function generateUserCode(): string {
  // No ambiguous characters: O, I, 0, 1
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  for (let i = 0; i < 8; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }

  // Format as XXXX-XXXX
  return code.slice(0, 4) + '-' + code.slice(4);
}
```

---

### Operation: poll_device_code_status

**Purpose:** Fire TV polls to check if phone has authorized the device code.

**Request:**
```typescript
POST /functions/v1/jwt-auth
Content-Type: application/json

{
  "operation": "poll_device_code_status",
  "data": {
    "device_code": "a1b2c3d4e5f6..."
  }
}
```

**Response (Pending):**
```typescript
{
  "success": false,
  "status": "authorization_pending",
  "message": "Waiting for user authorization"
}
```

**Response (Authorized):**
```typescript
{
  "success": true,
  "status": "authorized",
  "jwtToken": "eyJhbGc...",  // Fire TV JWT
  "user": {
    "id": "user-123",
    "email": "user@gmail.com",
    "name": "John Doe",
    "picture": "https://..."
  }
}
```

**Response (Expired):**
```typescript
{
  "success": false,
  "status": "expired_token",
  "message": "Device code has expired. Please restart authentication."
}
```

**Implementation:**
```typescript
async function handlePollDeviceCodeStatus(data: any) {
  const { device_code } = data;

  // 1. Look up device session
  const { data: session } = await supabase
    .from('device_auth_sessions')
    .select('*')
    .eq('device_code', device_code)
    .single();

  if (!session) {
    return { success: false, status: 'invalid_code', message: 'Invalid device code' };
  }

  // 2. Check if expired
  if (new Date() > new Date(session.expires_at)) {
    await supabase
      .from('device_auth_sessions')
      .update({ status: 'expired' })
      .eq('device_code', device_code);

    return { success: false, status: 'expired_token', message: 'Device code has expired' };
  }

  // 3. Check status
  if (session.status === 'pending') {
    return { success: false, status: 'authorization_pending', message: 'Waiting for authorization' };
  }

  if (session.status === 'authorized') {
    // 4. Generate Fire TV JWT
    const jwtToken = await generateSupabaseJWT(
      session.user_id,
      session.google_token_data.email,
      {
        device_type: session.device_type || 'firetv',
        device_id: `${session.device_type}-${Date.now()}`,
        session_id: `sess-${session.device_type}-${Date.now()}`
      }
    );

    // 5. Mark as consumed (prevent replay)
    await supabase
      .from('device_auth_sessions')
      .update({ status: 'consumed', consumed_at: new Date().toISOString() })
      .eq('device_code', device_code);

    // 6. Get user info
    const { data: tokenData } = await supabase
      .from('user_auth_tokens')
      .select('tokens')
      .eq('auth_user_id', session.user_id)
      .single();

    const userEmail = tokenData?.tokens?.google?.primary?.email || session.google_token_data.email;
    const displayName = tokenData?.tokens?.google?.primary?.display_name || '';

    return {
      success: true,
      status: 'authorized',
      jwtToken,
      user: {
        id: session.user_id,
        email: userEmail,
        name: displayName,
        provider: 'google'
      }
    };
  }

  return { success: false, status: session.status, message: `Session status: ${session.status}` };
}
```

---

### Operation: authorize_device_code

**Purpose:** Phone authorizes a device code after Google OAuth success.

**Request:**
```typescript
POST /functions/v1/jwt-auth
Content-Type: application/json

{
  "operation": "authorize_device_code",
  "googleAccessToken": "ya29.a0...",  // Google OAuth token from phone
  "data": {
    "device_code": "a1b2c3d4e5f6...",
    "google_tokens": {
      "access_token": "ya29.a0...",
      "refresh_token": "1//0g...",
      "expires_in": 3600,
      "scope": "profile email calendar.readonly"
    },
    "phone_info": {
      "user_agent": "Mozilla/5.0...",
      "ip_address": "192.168.1.101"
    }
  }
}
```

**Response (Success):**
```typescript
{
  "success": true,
  "jwtToken": "eyJhbGc...",  // Phone JWT
  "user": {
    "id": "user-123",
    "email": "user@gmail.com",
    "name": "John Doe",
    "picture": "https://...",
    "provider": "google"
  },
  "message": "Device authorized. Your Fire TV is now authenticated."
}
```

**Response (Error):**
```typescript
{
  "success": false,
  "error": "invalid_device_code",
  "message": "Device code not found or expired"
}
```

**Implementation:**
```typescript
async function handleAuthorizeDeviceCode(data: any, googleAccessToken: string) {
  const { device_code, google_tokens, phone_info } = data;

  // 1. Verify Google token
  const googleUser = await verifyGoogleToken(googleAccessToken);
  if (!googleUser || !googleUser.verified_email) {
    throw new Error('Invalid Google token');
  }

  // 2. Look up device session
  const { data: session, error } = await supabase
    .from('device_auth_sessions')
    .select('*')
    .eq('device_code', device_code)
    .single();

  if (error || !session) {
    return { success: false, error: 'invalid_device_code', message: 'Device code not found' };
  }

  // 3. Check if expired
  if (new Date() > new Date(session.expires_at)) {
    return { success: false, error: 'expired_code', message: 'Device code has expired' };
  }

  // 4. Check if already authorized
  if (session.status !== 'pending') {
    return { success: false, error: 'code_already_used', message: 'Device code already authorized' };
  }

  // 5. Get or create auth user
  const authUserId = await getOrCreateAuthUser(supabase, googleUser);

  // 6. Ensure user profile exists
  await ensureUserProfile(supabase, authUserId, googleUser.email, 'beta');

  // 7. Store OAuth tokens as tokens.google.primary
  await handleStoreTokensOperation(
    supabase,
    authUserId,
    googleUser.email,
    {
      access_token: google_tokens.access_token,
      refresh_token: google_tokens.refresh_token,
      expires_in: google_tokens.expires_in || 3600,
      scope: google_tokens.scope,
      email: googleUser.email,
      display_name: googleUser.name,
      provider_info: {
        type: 'web_oauth',
        client_id: GOOGLE_CLIENT_ID
      }
    },
    'google',
    'primary'  // Always primary!
  );

  // 8. Update device session
  await supabase
    .from('device_auth_sessions')
    .update({
      status: 'authorized',
      user_id: authUserId,
      google_token_data: {
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture
      },
      phone_user_agent: phone_info?.user_agent,
      phone_ip_address: phone_info?.ip_address,
      authorized_at: new Date().toISOString()
    })
    .eq('device_code', device_code);

  // 9. Generate Phone JWT
  const jwtToken = await generateSupabaseJWT(
    authUserId,
    googleUser.email,
    {
      device_type: 'phone',
      device_id: `phone-${Date.now()}`,
      session_id: `sess-phone-${Date.now()}`
    }
  );

  // 10. Return response
  return {
    success: true,
    jwtToken,
    user: {
      id: authUserId,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
      provider: 'google'
    },
    message: 'Device authorized. Your Fire TV is now authenticated.'
  };
}
```

---

### Updated generateSupabaseJWT Function

```typescript
async function generateSupabaseJWT(
  userId: string,
  email: string,
  deviceMetadata?: {
    device_type?: string;
    device_id?: string;
    session_id?: string;
  }
) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60 * 72; // 72 hours

  const payload = {
    aud: 'authenticated',
    exp: exp,
    iat: now,
    iss: 'supabase',
    sub: userId,
    email: email,
    role: 'authenticated',

    // Device metadata (new)
    device_type: deviceMetadata?.device_type || 'web',
    device_id: deviceMetadata?.device_id || `web-${Date.now()}`,
    session_id: deviceMetadata?.session_id || `sess-${Date.now()}`,

    app_metadata: {
      provider: 'google',
      providers: ['google']
    },
    user_metadata: {
      email: email
    }
  };

  const encoder = new TextEncoder();
  const keyData = encoder.encode(JWT_SECRET);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const jwt = await create({ alg: 'HS256', typ: 'JWT' }, payload, key);
  return jwt;
}
```

---

## Client Implementation - Fire TV

### New Class: HybridDeviceAuth

**Location:** `js/data/auth/providers/hybrid-device-auth.js`

```javascript
/**
 * HybridDeviceAuth - Custom device flow for Fire TV
 *
 * Flow:
 * 1. Request device code from backend
 * 2. Display QR code and user code
 * 3. Poll backend for authorization
 * 4. Return JWT when authorized
 */
export class HybridDeviceAuth {
  constructor(edgeClient) {
    this.edgeClient = edgeClient;
    this.pollingInterval = null;
    this.deviceCode = null;
  }

  /**
   * Main sign-in flow
   */
  async signIn() {
    try {
      // Step 1: Create device code
      const deviceData = await this.createDeviceCode();
      this.deviceCode = deviceData.device_code;

      // Step 2: Show UI and start polling
      const result = await this.showUIAndPoll(deviceData);

      return result;
    } catch (error) {
      console.error('Hybrid device auth failed:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Request device code from backend
   */
  async createDeviceCode() {
    console.log('🔐 Creating device code...');

    const response = await this.edgeClient.call({
      operation: 'create_device_code',
      data: {
        device_type: 'firetv',
        device_info: {
          model: this.getDeviceModel(),
          os_version: navigator.userAgent,
          app_version: '0.3.0',
          ip_address: 'client-side' // Server will get actual IP
        }
      }
    });

    if (!response.success) {
      throw new Error('Failed to create device code');
    }

    console.log('✅ Device code created:', {
      user_code: response.user_code,
      expires_in: response.expires_in
    });

    return {
      device_code: response.device_code,
      user_code: response.user_code,
      verification_url: response.verification_url,
      expires_in: response.expires_in,
      interval: response.interval || 5
    };
  }

  /**
   * Display QR code and user code, start polling
   */
  async showUIAndPoll(deviceData) {
    const overlay = this.createDeviceCodeOverlay(deviceData);
    document.body.appendChild(overlay);

    // Generate QR code
    await this.generateQRCode(deviceData.verification_url);

    // Start countdown timer
    this.startCountdownTimer(deviceData.expires_in);

    // Start polling
    return new Promise((resolve, reject) => {
      this.startPolling(
        deviceData.device_code,
        deviceData.interval,
        deviceData.expires_in,
        resolve,
        reject
      );
    });
  }

  /**
   * Create UI overlay
   */
  createDeviceCodeOverlay(deviceData) {
    const overlay = document.createElement('div');
    overlay.id = 'device-code-overlay';
    overlay.className = 'device-code-overlay';
    overlay.innerHTML = `
      <div class="device-code-modal">
        <div class="device-code-header">
          <img src="/assets/dashie-logo.svg" alt="Dashie" class="dashie-logo">
          <h1>Sign in to Dashie</h1>
        </div>

        <div class="device-code-content">
          <div class="qr-section">
            <div id="qr-code-container"></div>
            <p class="qr-instructions">
              Scan this code with your phone to sign in
            </p>
          </div>

          <div class="divider">
            <span>OR</span>
          </div>

          <div class="user-code-section">
            <p class="code-label">Enter this code on your phone:</p>
            <p class="user-code" id="display-user-code">${deviceData.user_code}</p>
            <p class="code-url">Go to: dashieapp.com/auth</p>
          </div>
        </div>

        <div class="device-code-footer">
          <div class="status-section">
            <div class="status-indicator">
              <div class="spinner"></div>
              <span id="auth-status">Waiting for authorization...</span>
            </div>
            <div class="timer" id="auth-timer">
              Expires in ${Math.floor(deviceData.expires_in / 60)}:00
            </div>
          </div>

          <button class="cancel-button" id="cancel-auth">Cancel</button>
        </div>
      </div>
    `;

    // Cancel button handler
    overlay.querySelector('#cancel-auth').addEventListener('click', () => {
      this.cleanup();
      overlay.remove();
    });

    return overlay;
  }

  /**
   * Generate QR code
   */
  async generateQRCode(url) {
    // Load QRCode library if not already loaded
    if (typeof QRCode === 'undefined') {
      await this.loadQRCodeLibrary();
    }

    const container = document.getElementById('qr-code-container');
    container.innerHTML = ''; // Clear any existing QR code

    new QRCode(container, {
      text: url,
      width: 200,
      height: 200,
      colorDark: '#1a73e8',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  }

  /**
   * Load QRCode.js library
   */
  loadQRCodeLibrary() {
    return new Promise((resolve, reject) => {
      if (typeof QRCode !== 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Start polling for authorization
   */
  startPolling(deviceCode, interval, expiresIn, resolve, reject) {
    const startTime = Date.now();
    const expirationTime = startTime + (expiresIn * 1000);
    let pollCount = 0;

    this.pollingInterval = setInterval(async () => {
      pollCount++;

      // Check if expired
      if (Date.now() >= expirationTime) {
        this.cleanup();
        this.showError('Code expired. Please try again.');
        reject(new Error('Device code expired'));
        return;
      }

      try {
        console.log(`📱 Polling attempt ${pollCount}...`);

        const response = await this.edgeClient.call({
          operation: 'poll_device_code_status',
          data: { device_code: deviceCode }
        });

        if (response.success && response.status === 'authorized') {
          // Success!
          console.log('✅ Authorization successful!');
          this.cleanup();
          this.showSuccess();

          // Extract user and JWT
          const user = {
            id: response.user.id,
            email: response.user.email,
            name: response.user.name,
            picture: response.user.picture,
            provider: 'google'
          };

          setTimeout(() => {
            document.getElementById('device-code-overlay')?.remove();
            resolve({ user, jwtToken: response.jwtToken });
          }, 2000);

        } else if (response.status === 'expired_token') {
          this.cleanup();
          this.showError('Code expired. Please try again.');
          reject(new Error('Device code expired'));

        } else {
          // Still pending, continue polling
          console.log(`⏳ Status: ${response.status || 'pending'}`);
        }

      } catch (error) {
        console.error('Polling error:', error);
        // Continue polling on error (network blip)
      }
    }, interval * 1000);
  }

  /**
   * Start countdown timer
   */
  startCountdownTimer(expiresIn) {
    const timerElement = document.getElementById('auth-timer');
    let remainingSeconds = expiresIn;

    const timerInterval = setInterval(() => {
      remainingSeconds--;

      if (remainingSeconds <= 0) {
        clearInterval(timerInterval);
        timerElement.textContent = 'Expired';
        return;
      }

      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;
      timerElement.textContent = `Expires in ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);

    // Store for cleanup
    this.timerInterval = timerInterval;
  }

  /**
   * Show success state
   */
  showSuccess() {
    const statusElement = document.getElementById('auth-status');
    const statusSection = document.querySelector('.status-indicator');

    statusSection.classList.add('success');
    statusElement.textContent = '✓ Authenticated successfully!';
  }

  /**
   * Show error state
   */
  showError(message) {
    const statusElement = document.getElementById('auth-status');
    const statusSection = document.querySelector('.status-indicator');

    statusSection.classList.add('error');
    statusElement.textContent = `✗ ${message}`;
  }

  /**
   * Cleanup polling and timers
   */
  cleanup() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Get device model
   */
  getDeviceModel() {
    const ua = navigator.userAgent;
    if (ua.includes('AFTMM')) return 'Fire TV Stick 4K';
    if (ua.includes('AFTT')) return 'Fire TV';
    if (ua.includes('AFTB')) return 'Fire TV (Basic)';
    return 'Fire TV (Unknown Model)';
  }

  /**
   * Sign out (not applicable for device flow)
   */
  async signOut() {
    this.cleanup();
  }
}
```

### Styles for Device Code Overlay

**Location:** `css/auth/device-code-overlay.css`

```css
/* Device Code Overlay */
.device-code-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.3s ease-in;
}

.device-code-modal {
  background: var(--bg-primary, #1a1a1a);
  border-radius: 20px;
  padding: 40px;
  max-width: 600px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.4s ease-out;
}

.device-code-header {
  text-align: center;
  margin-bottom: 30px;
}

.dashie-logo {
  height: 60px;
  margin-bottom: 20px;
}

.device-code-header h1 {
  font-size: 32px;
  font-weight: 600;
  color: var(--text-primary, #ffffff);
  margin: 0;
}

.device-code-content {
  display: flex;
  flex-direction: column;
  gap: 30px;
  margin-bottom: 30px;
}

.qr-section {
  text-align: center;
}

#qr-code-container {
  display: inline-block;
  padding: 20px;
  background: white;
  border-radius: 12px;
  margin-bottom: 15px;
}

.qr-instructions {
  font-size: 16px;
  color: var(--text-secondary, #aaa);
  margin: 0;
}

.divider {
  text-align: center;
  position: relative;
  margin: 20px 0;
}

.divider::before,
.divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 45%;
  height: 1px;
  background: var(--border-color, #333);
}

.divider::before { left: 0; }
.divider::after { right: 0; }

.divider span {
  background: var(--bg-primary, #1a1a1a);
  padding: 0 15px;
  color: var(--text-muted, #666);
  font-size: 14px;
}

.user-code-section {
  text-align: center;
}

.code-label {
  font-size: 14px;
  color: var(--text-secondary, #aaa);
  margin: 0 0 10px 0;
}

.user-code {
  font-size: 48px;
  font-weight: 700;
  letter-spacing: 8px;
  color: var(--accent-color, #1a73e8);
  margin: 10px 0;
  font-family: 'Courier New', monospace;
}

.code-url {
  font-size: 14px;
  color: var(--text-muted, #666);
  margin: 10px 0 0 0;
}

.device-code-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 20px;
  border-top: 1px solid var(--border-color, #333);
}

.status-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-secondary, #aaa);
  font-size: 14px;
}

.status-indicator.success {
  color: #4caf50;
}

.status-indicator.error {
  color: #f44336;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-color, #333);
  border-top-color: var(--accent-color, #1a73e8);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.status-indicator.success .spinner {
  display: none;
}

.timer {
  font-size: 12px;
  color: var(--text-muted, #666);
}

.cancel-button {
  padding: 12px 24px;
  background: transparent;
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  color: var(--text-secondary, #aaa);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-button:hover {
  background: var(--bg-secondary, #222);
  border-color: var(--text-secondary, #aaa);
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## Client Implementation - Phone

### Phone Auth Page

**Location:** `phone/auth.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authenticate Fire TV - Dashie</title>

  <!-- Google Identity Services -->
  <script src="https://accounts.google.com/gsi/client" async defer></script>

  <link rel="stylesheet" href="auth.css">
</head>
<body>
  <div class="auth-container">
    <div class="auth-header">
      <img src="/assets/dashie-logo.svg" alt="Dashie" class="logo">
      <h1>Authenticate Your Device</h1>
    </div>

    <div class="device-info" id="device-info">
      <div class="device-icon">📺</div>
      <p class="device-name" id="device-name">Fire TV</p>
      <p class="device-code" id="device-code">----</p>
    </div>

    <div class="auth-content">
      <div class="status-message" id="status-message">
        <!-- Status messages will appear here -->
      </div>

      <div class="sign-in-section" id="sign-in-section">
        <p class="instructions">Sign in with Google to authenticate your device</p>
        <div id="google-signin-button"></div>
      </div>

      <div class="success-section hidden" id="success-section">
        <div class="success-icon">✓</div>
        <h2>Device Authenticated!</h2>
        <p>Your Fire TV is now signed in. You can close this page.</p>
        <button class="primary-button" onclick="window.close()">Close Window</button>
      </div>

      <div class="error-section hidden" id="error-section">
        <div class="error-icon">✗</div>
        <h2 id="error-title">Authentication Failed</h2>
        <p id="error-message"></p>
        <button class="primary-button" onclick="location.reload()">Try Again</button>
      </div>
    </div>

    <div class="auth-footer">
      <p class="help-text">
        Having trouble? <a href="/help">Get help</a>
      </p>
    </div>
  </div>

  <script src="auth.js"></script>
</body>
</html>
```

### Phone Auth JavaScript

**Location:** `phone/auth.js`

```javascript
/**
 * Phone Auth Handler
 * Handles QR scan → Google OAuth → Device linking
 */
class PhoneAuthHandler {
  constructor() {
    this.deviceCode = null;
    this.deviceType = null;
    this.edgeFunctionUrl = this.getEdgeFunctionUrl();
  }

  /**
   * Initialize auth handler
   */
  async init() {
    // Parse URL parameters
    const params = new URLSearchParams(window.location.search);
    const userCode = params.get('code');
    this.deviceType = params.get('type') || 'firetv';

    if (!userCode) {
      this.showError('Invalid Link', 'No device code found in URL. Please scan the QR code again.');
      return;
    }

    // Display device info
    this.displayDeviceInfo(userCode);

    // Load device code from user code
    // Note: In production, you might want to validate the user code with backend
    // For now, we'll pass it through the OAuth flow
    this.userCode = userCode;

    // Initialize Google Sign-In
    this.initializeGoogleSignIn();
  }

  /**
   * Display device information
   */
  displayDeviceInfo(userCode) {
    const deviceNameEl = document.getElementById('device-name');
    const deviceCodeEl = document.getElementById('device-code');

    const deviceNames = {
      'firetv': 'Fire TV',
      'androidtv': 'Android TV',
      'appletv': 'Apple TV'
    };

    deviceNameEl.textContent = deviceNames[this.deviceType] || 'TV Device';
    deviceCodeEl.textContent = userCode;
  }

  /**
   * Initialize Google Sign-In button
   */
  initializeGoogleSignIn() {
    google.accounts.id.initialize({
      client_id: '221142210647-58t8hr48rk7nlgl56j969himso1qjjoo.apps.googleusercontent.com',
      callback: this.handleGoogleCallback.bind(this)
    });

    google.accounts.id.renderButton(
      document.getElementById('google-signin-button'),
      {
        theme: 'filled_blue',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: 300
      }
    );
  }

  /**
   * Handle Google Sign-In callback
   */
  async handleGoogleCallback(response) {
    try {
      console.log('Google sign-in successful');

      // Hide sign-in section
      document.getElementById('sign-in-section').classList.add('hidden');

      // Show loading status
      this.showStatus('Authenticating your device...', 'loading');

      // Get the Google ID token
      const googleIdToken = response.credential;

      // Decode JWT to get user info (client-side only for display)
      const userInfo = this.parseJwt(googleIdToken);
      console.log('User info:', userInfo.email);

      // First, we need to exchange the ID token for access token and refresh token
      // This requires the OAuth flow, so we'll initiate it
      await this.initiateOAuthFlow();

    } catch (error) {
      console.error('Google sign-in error:', error);
      this.showError('Sign-In Failed', error.message);
    }
  }

  /**
   * Initiate OAuth flow for access token
   */
  initiateOAuthFlow() {
    const redirectUri = window.location.origin + window.location.pathname;
    const state = JSON.stringify({
      user_code: this.userCode,
      device_type: this.deviceType
    });

    // Store state in sessionStorage
    sessionStorage.setItem('oauth_state', state);

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=221142210647-58t8hr48rk7nlgl56j969himso1qjjoo.apps.googleusercontent.com&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent('profile email https://www.googleapis.com/auth/calendar.readonly')}&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=${encodeURIComponent(state)}`;

    window.location.href = authUrl;
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      this.showError('OAuth Error', error);
      return;
    }

    if (!code) {
      return; // Not an OAuth callback
    }

    try {
      // Parse state
      const stateData = JSON.parse(state);
      this.userCode = stateData.user_code;
      this.deviceType = stateData.device_type;

      // Display device info
      this.displayDeviceInfo(this.userCode);

      // Hide sign-in section
      document.getElementById('sign-in-section').classList.add('hidden');

      // Show loading
      this.showStatus('Authenticating your device...', 'loading');

      // Exchange code for tokens
      console.log('Exchanging OAuth code for tokens...');
      const tokenResponse = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'exchange_code',
          data: {
            code: code,
            redirect_uri: window.location.origin + window.location.pathname,
            provider_type: 'web_oauth'
          }
        })
      });

      const tokenData = await tokenResponse.json();

      if (!tokenData.success) {
        throw new Error(tokenData.error || 'Failed to exchange code for tokens');
      }

      console.log('✅ Tokens received');

      // Now link the device code
      await this.linkDeviceCode(tokenData.tokens, tokenData.user);

    } catch (error) {
      console.error('OAuth callback error:', error);
      this.showError('Authentication Failed', error.message);
    }
  }

  /**
   * Link device code with Google tokens
   */
  async linkDeviceCode(googleTokens, googleUser) {
    try {
      console.log('Linking device code with Google account...');

      // We need to get the device_code from user_code
      // For now, we'll send the user_code and let backend look it up
      // In production, you might want to include device_code in the QR URL

      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'authorize_device_code',
          googleAccessToken: googleTokens.access_token,
          data: {
            user_code: this.userCode,  // Backend will look up device_code
            google_tokens: {
              access_token: googleTokens.access_token,
              refresh_token: googleTokens.refresh_token,
              expires_in: googleTokens.expires_in || 3600,
              scope: googleTokens.scope
            },
            phone_info: {
              user_agent: navigator.userAgent,
              ip_address: 'client-side'
            }
          }
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to authorize device');
      }

      console.log('✅ Device authorized successfully');

      // Store phone JWT
      localStorage.setItem('dashie_jwt', result.jwtToken);
      localStorage.setItem('dashie_user', JSON.stringify(result.user));

      // Show success
      this.showSuccess();

    } catch (error) {
      console.error('Device linking error:', error);
      this.showError('Linking Failed', error.message);
    }
  }

  /**
   * Show status message
   */
  showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status-message');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.classList.remove('hidden');
  }

  /**
   * Show success state
   */
  showSuccess() {
    document.getElementById('sign-in-section').classList.add('hidden');
    document.getElementById('error-section').classList.add('hidden');
    document.getElementById('success-section').classList.remove('hidden');
  }

  /**
   * Show error state
   */
  showError(title, message) {
    document.getElementById('sign-in-section').classList.add('hidden');
    document.getElementById('success-section').classList.add('hidden');

    document.getElementById('error-title').textContent = title;
    document.getElementById('error-message').textContent = message;
    document.getElementById('error-section').classList.remove('hidden');
  }

  /**
   * Parse JWT (client-side only for display)
   */
  parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Failed to parse JWT:', e);
      return {};
    }
  }

  /**
   * Get edge function URL
   */
  getEdgeFunctionUrl() {
    const hostname = window.location.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'https://cwglbtosingboqepsmjk.supabase.co/functions/v1/jwt-auth';
    } else {
      return 'https://cseaywxcvnxcsypaqaid.supabase.co/functions/v1/jwt-auth';
    }
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const handler = new PhoneAuthHandler();

  // Check if this is an OAuth callback
  const params = new URLSearchParams(window.location.search);
  if (params.get('code')) {
    handler.handleOAuthCallback();
  } else {
    handler.init();
  }
});
```

### Phone Auth Styles

**Location:** `phone/auth.css`

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.auth-container {
  background: white;
  border-radius: 20px;
  padding: 40px;
  max-width: 450px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.auth-header {
  text-align: center;
  margin-bottom: 30px;
}

.logo {
  height: 60px;
  margin-bottom: 20px;
}

.auth-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.device-info {
  background: #f5f7fa;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  margin-bottom: 30px;
}

.device-icon {
  font-size: 48px;
  margin-bottom: 10px;
}

.device-name {
  font-size: 16px;
  color: #666;
  margin-bottom: 8px;
}

.device-code {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 4px;
  color: #667eea;
  font-family: 'Courier New', monospace;
}

.auth-content {
  margin-bottom: 20px;
}

.status-message {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 14px;
  text-align: center;
}

.status-message.loading {
  background: #e3f2fd;
  color: #1976d2;
}

.status-message.error {
  background: #ffebee;
  color: #c62828;
}

.status-message.hidden {
  display: none;
}

.sign-in-section {
  text-align: center;
}

.instructions {
  font-size: 14px;
  color: #666;
  margin-bottom: 20px;
}

#google-signin-button {
  display: flex;
  justify-content: center;
}

.success-section,
.error-section {
  text-align: center;
  padding: 20px 0;
}

.success-section.hidden,
.error-section.hidden {
  display: none;
}

.success-icon {
  width: 80px;
  height: 80px;
  background: #4caf50;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  margin: 0 auto 20px;
}

.error-icon {
  width: 80px;
  height: 80px;
  background: #f44336;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  margin: 0 auto 20px;
}

.success-section h2,
.error-section h2 {
  font-size: 24px;
  margin-bottom: 10px;
  color: #333;
}

.success-section p,
.error-section p {
  font-size: 14px;
  color: #666;
  margin-bottom: 20px;
}

.primary-button {
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 32px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.primary-button:hover {
  background: #5568d3;
}

.auth-footer {
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.help-text {
  font-size: 12px;
  color: #999;
}

.help-text a {
  color: #667eea;
  text-decoration: none;
}

.help-text a:hover {
  text-decoration: underline;
}

/* Mobile responsiveness */
@media (max-width: 480px) {
  .auth-container {
    padding: 30px 20px;
  }

  .device-code {
    font-size: 24px;
  }

  .auth-header h1 {
    font-size: 20px;
  }
}
```

---

## Security Implementation

### Rate Limiting

**Implementation in Edge Function:**

```typescript
// Rate limiting configuration
const RATE_LIMITS = {
  create_device_code: {
    max: 10,
    window: 3600,  // 10 codes per hour per IP
    key: (req) => getClientIP(req)
  },
  poll_device_code_status: {
    max: 120,
    window: 600,   // 120 polls per 10 minutes per device_code
    key: (data) => data.device_code
  },
  authorize_device_code: {
    max: 5,
    window: 300,   // 5 attempts per 5 minutes per IP
    key: (req) => getClientIP(req)
  }
};

// Rate limiter function (using Supabase table or Redis)
async function checkRateLimit(operation: string, key: string): Promise<boolean> {
  const config = RATE_LIMITS[operation];
  if (!config) return true;

  const now = Date.now();
  const windowStart = now - (config.window * 1000);

  // Get request count from database
  const { count } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact' })
    .eq('operation', operation)
    .eq('key', key)
    .gte('created_at', new Date(windowStart).toISOString());

  if (count >= config.max) {
    console.warn(`Rate limit exceeded: ${operation} for ${key}`);
    return false;
  }

  // Record this request
  await supabase
    .from('rate_limits')
    .insert({
      operation,
      key,
      created_at: new Date().toISOString()
    });

  return true;
}
```

### Device Code Security

**Secure Code Generation:**

```typescript
// Device code: 32 random bytes → 64 char hex
function generateDeviceCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// User code: 8 chars, no ambiguous characters
function generateUserCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O, I, 0, 1
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);

  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }

  return code.slice(0, 4) + '-' + code.slice(4);
}
```

### Session Security

**Prevent Replay Attacks:**

```typescript
// Mark session as consumed when JWT is issued
await supabase
  .from('device_auth_sessions')
  .update({
    status: 'consumed',
    consumed_at: new Date().toISOString()
  })
  .eq('device_code', deviceCode);

// Reject if already consumed
if (session.status === 'consumed') {
  return {
    success: false,
    error: 'code_already_used',
    message: 'This device code has already been used'
  };
}
```

---

## Error Handling

### Error Codes and Messages

| Error Code | When It Occurs | User Message | Action |
|------------|----------------|--------------|--------|
| `invalid_device_code` | Device code not found in database | Device code not found. Please restart authentication. | Show error, offer retry |
| `expired_token` | Device code past expiration time | Code expired. Please try again. | Show error, offer retry |
| `code_already_used` | Device code already consumed | This code has already been used. | Show error, generate new code |
| `authorization_pending` | User hasn't authorized yet | Waiting for authorization... | Continue polling |
| `rate_limit_exceeded` | Too many requests | Too many attempts. Please wait and try again. | Show error with countdown |
| `network_error` | Network connection failed | Network error. Checking connection... | Auto-retry with backoff |

### Error Handling in Fire TV Client

```javascript
// In HybridDeviceAuth.startPolling()
try {
  const response = await this.edgeClient.call({
    operation: 'poll_device_code_status',
    data: { device_code: deviceCode }
  });

  if (response.status === 'expired_token') {
    this.cleanup();
    this.showError('Code expired. Please restart authentication on your TV.');
    reject(new Error('Device code expired'));
    return;
  }

  if (response.status === 'invalid_device_code') {
    this.cleanup();
    this.showError('Invalid code. Please restart authentication.');
    reject(new Error('Invalid device code'));
    return;
  }

  // Continue polling for pending status
  if (response.status === 'authorization_pending') {
    console.log('⏳ Still waiting for authorization...');
    return;
  }

} catch (error) {
  console.error('Polling error:', error);

  // Network error - retry with backoff
  if (error.message.includes('network') || error.message.includes('fetch')) {
    console.log('Network error, will retry...');
    // Continue polling (don't reject)
    return;
  }

  // Unknown error - show and stop
  this.cleanup();
  this.showError(`Error: ${error.message}`);
  reject(error);
}
```

---

## Implementation Checklist

### Database Setup

- [ ] Create `device_auth_sessions` table
- [ ] Create indexes for performance
- [ ] Create `cleanup_expired_device_sessions()` function
- [ ] Schedule cron job for cleanup
- [ ] Create `rate_limits` table (optional, for rate limiting)
- [ ] Test database schema

### Edge Function Updates

- [ ] Add `create_device_code` operation to `jwt-auth/index.ts`
- [ ] Add `poll_device_code_status` operation
- [ ] Add `authorize_device_code` operation
- [ ] Update `generateSupabaseJWT()` to accept device metadata
- [ ] Implement rate limiting
- [ ] Add comprehensive logging
- [ ] Test all operations
- [ ] Deploy to development environment
- [ ] Test in development
- [ ] Deploy to production

### Fire TV Client

- [ ] Create `HybridDeviceAuth` class
- [ ] Implement device code creation
- [ ] Implement QR code generation
- [ ] Implement polling mechanism
- [ ] Create device code overlay UI
- [ ] Add countdown timer
- [ ] Add error handling
- [ ] Add success/failure states
- [ ] Create CSS styles for overlay
- [ ] Test on Fire TV device
- [ ] Test error scenarios
- [ ] Test network interruptions

### Phone Client

- [ ] Create `phone/auth.html` page
- [ ] Create `phone/auth.js` handler
- [ ] Create `phone/auth.css` styles
- [ ] Implement QR code parameter parsing
- [ ] Integrate Google Sign-In button
- [ ] Implement OAuth flow
- [ ] Implement device linking
- [ ] Add success state
- [ ] Add error handling
- [ ] Test on mobile browsers (iOS Safari, Android Chrome)
- [ ] Test OAuth flow
- [ ] Test error scenarios

### AuthCoordinator Updates

- [ ] Update `selectProvider()` to support HybridDeviceAuth
- [ ] Add platform detection for Fire TV
- [ ] Keep existing providers as fallback
- [ ] Test provider selection logic
- [ ] Update SessionManager integration

### Code Cleanup

- [ ] Remove `getAccountTypeForDevice()` from GoogleAccountAuth
- [ ] Update all `account_type` references to use `'primary'`
- [ ] Remove `primary-tv` references
- [ ] Update GoogleCalendarAuth to always use `'primary'`
- [ ] Update EdgeClient calls
- [ ] Remove device-specific token logic
- [ ] Test token access with unified approach

### Testing

- [ ] Unit tests for edge function operations
- [ ] Integration tests for full flow
- [ ] Test QR code generation
- [ ] Test polling mechanism
- [ ] Test expiration handling
- [ ] Test rate limiting
- [ ] Test network failure recovery
- [ ] Test concurrent sessions
- [ ] Test on real Fire TV device
- [ ] Test on real phone (iOS and Android)
- [ ] Test with slow network
- [ ] Test with network interruption

### Documentation

- [ ] Update API documentation
- [ ] Create user-facing help docs
- [ ] Add troubleshooting guide
- [ ] Document error codes
- [ ] Update developer guide
- [ ] Create demo video

---

## Testing Strategy

### Unit Tests

**Edge Function Tests:**
```typescript
// Test create_device_code
test('create_device_code generates valid codes', async () => {
  const response = await callEdgeFunction({
    operation: 'create_device_code',
    data: { device_type: 'firetv' }
  });

  expect(response.success).toBe(true);
  expect(response.device_code).toHaveLength(64);
  expect(response.user_code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  expect(response.expires_in).toBe(600);
});

// Test authorize_device_code
test('authorize_device_code links device successfully', async () => {
  // Create device code
  const deviceCodeResponse = await createDeviceCode();

  // Authorize it
  const authResponse = await callEdgeFunction({
    operation: 'authorize_device_code',
    googleAccessToken: mockGoogleToken,
    data: {
      device_code: deviceCodeResponse.device_code,
      google_tokens: mockTokens
    }
  });

  expect(authResponse.success).toBe(true);
  expect(authResponse.jwtToken).toBeDefined();
});

// Test poll_device_code_status
test('poll returns pending before authorization', async () => {
  const deviceCodeResponse = await createDeviceCode();

  const pollResponse = await callEdgeFunction({
    operation: 'poll_device_code_status',
    data: { device_code: deviceCodeResponse.device_code }
  });

  expect(pollResponse.success).toBe(false);
  expect(pollResponse.status).toBe('authorization_pending');
});
```

### Integration Tests

**Full Flow Test:**
```typescript
test('complete hybrid auth flow', async () => {
  // 1. Fire TV creates device code
  const deviceResponse = await createDeviceCode();

  // 2. Phone authorizes
  const authResponse = await authorizeDeviceCode(
    deviceResponse.device_code,
    mockGoogleTokens
  );
  expect(authResponse.success).toBe(true);

  // 3. Fire TV polls and gets JWT
  const pollResponse = await pollDeviceCodeStatus(deviceResponse.device_code);
  expect(pollResponse.success).toBe(true);
  expect(pollResponse.jwtToken).toBeDefined();

  // 4. Verify both JWTs access same tokens
  const firetvToken = pollResponse.jwtToken;
  const phoneToken = authResponse.jwtToken;

  const firetvCalToken = await getValidToken(firetvToken, 'google', 'primary');
  const phoneCalToken = await getValidToken(phoneToken, 'google', 'primary');

  expect(firetvCalToken).toEqual(phoneCalToken);
});
```

### Manual Testing Checklist

**Fire TV:**
- [ ] QR code displays correctly
- [ ] User code is readable (no ambiguous characters)
- [ ] Polling starts automatically
- [ ] Timer counts down correctly
- [ ] Success message appears after authorization
- [ ] Error message appears on expiration
- [ ] Cancel button works
- [ ] Overlay is removed on success
- [ ] App loads after authentication

**Phone:**
- [ ] QR scan redirects to auth page
- [ ] Device type displays correctly
- [ ] User code displays correctly
- [ ] Google Sign-In button appears
- [ ] OAuth flow completes successfully
- [ ] Success message appears
- [ ] Error handling works for expired codes
- [ ] Error handling works for invalid codes
- [ ] "Close window" button works

**Edge Cases:**
- [ ] Multiple devices authenticating simultaneously
- [ ] Network interruption during polling
- [ ] Code expiration during OAuth flow
- [ ] User cancels OAuth consent
- [ ] User signs in with different Google account
- [ ] Rapid clicking on sign-in button
- [ ] QR code scanned multiple times
- [ ] Browser back button during OAuth

---

## Next Steps

Once hybrid auth is implemented and tested:

1. **Monitor Usage**
   - Track auth success rates
   - Track average auth time
   - Monitor error rates
   - Identify common failure points

2. **Optimize**
   - Reduce polling interval if needed
   - Optimize QR code size
   - Improve error messages
   - Add retry logic

3. **Expand**
   - Support additional OAuth providers (Microsoft, Apple)
   - Support additional device types (Android TV, Apple TV)
   - Add biometric authentication on phone
   - Add device management (revoke specific devices)

4. **User Experience**
   - Add animation to QR code display
   - Add sound effects on success
   - Add haptic feedback on phone
   - Improve error recovery UX

---

## Conclusion

Hybrid Device Flow provides a superior authentication experience by:

- Simplifying the user experience (scan vs type)
- Unifying token management (single `primary` token)
- Giving full control over the device flow
- Enabling future extensibility (new providers, new devices)

This architecture is production-ready and scalable for Dashie's growth.
