# Supabase Edge Functions - Developer Guide

This guide documents how to properly call Supabase edge functions, including the **critical requirement** to include JWT tokens in both headers AND payload.

## Table of Contents

1. [Critical Requirements](#critical-requirements)
2. [Authentication Flow](#authentication-flow)
3. [Available Edge Functions](#available-edge-functions)
4. [Calling Edge Functions](#calling-edge-functions)
5. [Common Mistakes](#common-mistakes)
6. [Examples](#examples)

---

## Critical Requirements

### ⚠️ IMPORTANT: Two Different Authentication Patterns

Supabase edge functions use **TWO DIFFERENT authentication patterns** depending on whether the operation requires user authentication:

---

### Pattern 1: Unauthenticated Operations (No JWT Required)

**Use Case:** Operations that happen BEFORE user authentication (e.g., device code creation, polling)

**Header Format:**
```javascript
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`  // ✅ Anon key in Authorization header
}
```

**Example Operations:**
- `create_device_code` - Fire TV generates device code
- `poll_device_code_status` - Fire TV polls for authorization
- `authorize_device_code` - Phone authorizes device code

**Example Call:**
```javascript
const response = await fetch(edgeFunctionUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`  // ✅ Anon key in Authorization
  },
  body: JSON.stringify({
    operation: 'create_device_code',
    data: { device_type: 'firetv' }
    // ❌ NO jwtToken - user hasn't authenticated yet!
  })
});
```

**Common Mistake:** Using `apikey` header instead of `Authorization: Bearer`
```javascript
// ❌ WRONG - This will fail with 401 Missing authorization header
headers: {
  'apikey': SUPABASE_ANON_KEY  // Wrong!
}

// ✅ CORRECT
headers: {
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`  // Right!
}
```

---

### Pattern 2: Authenticated Operations (JWT Required)

**Use Case:** Operations that require user authentication (e.g., database operations, photo storage)

**JWT tokens MUST be sent in THREE places:**

1. ✅ **Authorization header** - `Bearer ${jwtToken}`
2. ✅ **apikey header** - Supabase anon key
3. ✅ **Request body payload** - `{ ..., jwtToken }`

**Forgetting any of these will result in a 400 Bad Request error: "JWT token required"**

**Example Operations:**
- `list_photos` - List user's photos
- `save_calendar_config` - Save calendar settings
- `delete_account` - Delete user account

**Example Call:**
```javascript
const response = await fetch(edgeFunctionUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`,    // ✅ JWT in header
    'apikey': supabaseAnonKey                  // ✅ Anon key in header
  },
  body: JSON.stringify({
    operation: 'list_photos',
    data: { folder: null },
    jwtToken: jwtToken                         // ✅ JWT in payload
  })
});
```

---

## Authentication Flow

### 1. Get JWT Token

JWT tokens are obtained from `EdgeClient`:

```javascript
const edgeClient = window.edgeClient;
const jwtToken = await edgeClient.getSupabaseJWT();
```

### 2. Get Supabase Anon Key

Anon key is stored in `EdgeClient`:

```javascript
const supabaseAnonKey = edgeClient.anonKey;

// OR from config:
const config = window.currentDbConfig;
const supabaseAnonKey = config.supabaseAnonKey;
```

### 3. Verify JWT is Ready

Always check before calling:

```javascript
if (!edgeClient.isServiceReady()) {
  throw new Error('JWT service not ready');
}

const jwtToken = await edgeClient.getSupabaseJWT();
if (!jwtToken) {
  throw new Error('Failed to get valid JWT token');
}
```

---

## Available Edge Functions

### 1. database-operations

**URL:** `https://{project}.supabase.co/functions/v1/database-operations`

**Purpose:** Handles database CRUD operations requiring JWT authentication

**Operations:**

#### Calendar Operations

- `save_calendar_config` - Save active calendar IDs
- `load_calendar_config` - Load active calendar IDs

#### Photo Storage Operations

- `list_photos` - List all photos for user
- `list_folders` - List all photo folders
- `create_photo_record` - Create database record for uploaded photo
- `delete_photo` - Delete a single photo
- `delete_all_photos` - Delete all photos
- `get_storage_quota` - Get user's storage quota
- `init_storage_quota` - Initialize storage quota for new user
- `update_storage_quota` - Update storage usage

#### Account Operations

- `delete_account` - Delete user account and all data

### 2. jwt-auth

**URL:** `https://{project}.supabase.co/functions/v1/jwt-auth`

**Purpose:** Handles authentication and token management

**Operations:**

#### Hybrid Device Flow (Phase 5.5) - Unauthenticated

- `create_device_code` - Fire TV generates device code and user code for QR scan
- `poll_device_code_status` - Fire TV polls to check if device code was authorized
- `authorize_device_code` - Phone authorizes device code after Google OAuth

**Authentication Pattern:** Use Pattern 1 (Anon Key in Authorization header)

#### Legacy Operations - Authenticated

- `exchange_code` - Exchange OAuth code for tokens (web/phone)
- `refresh_token` - Refresh expired tokens
- `bootstrap_jwt` - Exchange Google token for Supabase JWT
- `store_tokens`, `load`, `save` - Token storage operations

**Authentication Pattern:** Use Pattern 2 (JWT + apikey)

---

## Calling Edge Functions

### Method 1: Using EdgeClient (Recommended)

EdgeClient automatically handles JWT and apikey headers.

```javascript
const edgeClient = window.edgeClient;

// For database operations
const result = await edgeClient.databaseRequest({
  operation: 'list_photos',
  data: { folder: null, limit: 100 }
});
```

**EdgeClient automatically adds:**
- `Authorization: Bearer ${jwtToken}` header
- `apikey: ${anonKey}` header
- `jwtToken` to request body

### Method 2: Using PhotoStorageService

For photo operations, use PhotoStorageService which handles edge function calls:

```javascript
const photoDataService = window.photoDataService;
const photos = await photoDataService.loadPhotos(folder, shuffle);
```

PhotoStorageService internally calls the edge function with proper authentication.

### Method 3: Direct Fetch (Not Recommended)

If you must call directly, follow this template exactly:

```javascript
const edgeClient = window.edgeClient;

// 1. Get JWT token
const jwtToken = await edgeClient.getSupabaseJWT();
if (!jwtToken) {
  throw new Error('Failed to get JWT token');
}

// 2. Get anon key
const supabaseAnonKey = edgeClient.anonKey;

// 3. Build request body WITH jwtToken
const requestBody = {
  operation: 'operation_name',
  data: { /* your data */ },
  jwtToken: jwtToken  // ✅ CRITICAL: Include JWT in payload
};

// 4. Make request with ALL headers
const response = await fetch(edgeFunctionUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`,  // ✅ JWT in header
    'apikey': supabaseAnonKey                // ✅ Anon key in header
  },
  body: JSON.stringify(requestBody)
});

// 5. Handle response
if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`Edge function failed: ${response.status} ${errorText}`);
}

const result = await response.json();
if (!result.success) {
  throw new Error(result.error || 'Operation failed');
}

return result;
```

---

## Common Mistakes

### ❌ Mistake 1: JWT Only in Headers

**Wrong:**
```javascript
const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${jwtToken}`,  // ✅ Good
    'apikey': anonKey                       // ✅ Good
  },
  body: JSON.stringify({
    operation: 'list_photos',
    data: { folder: null }
    // ❌ Missing jwtToken in payload!
  })
});
```

**Error:** `400 Bad Request: JWT token required`

**Fix:**
```javascript
body: JSON.stringify({
  operation: 'list_photos',
  data: { folder: null },
  jwtToken: jwtToken  // ✅ Add JWT to payload
})
```

### ❌ Mistake 2: Missing apikey Header

**Wrong:**
```javascript
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${jwtToken}`
  // ❌ Missing apikey!
}
```

**Error:** `400 Bad Request: JWT token required`

**Fix:**
```javascript
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${jwtToken}`,
  'apikey': supabaseAnonKey  // ✅ Add apikey
}
```

### ❌ Mistake 3: Using callEdgeFunction (Doesn't Exist)

**Wrong:**
```javascript
const result = await edgeClient.callEdgeFunction('list_photos', {...});
// ❌ No such method!
```

**Fix:**
```javascript
// For database operations:
const result = await edgeClient.databaseRequest({
  operation: 'list_photos',
  data: {...}
});

// OR use PhotoDataService:
const result = await photoDataService.loadPhotos(folder, shuffle);
```

### ❌ Mistake 4: Wrong Request Body Structure

**Wrong:**
```javascript
body: JSON.stringify({
  op: 'list_photos',        // ❌ Wrong key (should be 'operation')
  params: { folder: null }, // ❌ Wrong key (should be 'data')
  token: jwtToken           // ❌ Wrong key (should be 'jwtToken')
})
```

**Fix:**
```javascript
body: JSON.stringify({
  operation: 'list_photos',  // ✅ Correct
  data: { folder: null },    // ✅ Correct
  jwtToken: jwtToken         // ✅ Correct
})
```

### ❌ Mistake 5: Not Checking for Errors

**Wrong:**
```javascript
const response = await fetch(url, {...});
const result = await response.json();
return result.data;  // ❌ Might be undefined if error!
```

**Fix:**
```javascript
const response = await fetch(url, {...});

if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`Edge function failed: ${response.status} ${errorText}`);
}

const result = await response.json();

if (!result.success) {
  throw new Error(result.error || 'Operation failed');
}

return result;  // ✅ Now we know it succeeded
```

---

## Examples

### Example 1: List Photos

```javascript
async function listPhotos(folder = null) {
  const edgeClient = window.edgeClient;

  // Method A: Using EdgeClient (Recommended)
  const result = await edgeClient.databaseRequest({
    operation: 'list_photos',
    data: { folder }
  });

  return result.photos;

  // Method B: Using PhotoDataService (Even Better)
  const photoDataService = window.photoDataService;
  const photos = await photoDataService.loadPhotos(folder, true);
  return photos;
}
```

### Example 2: Save Calendar Config

```javascript
async function saveCalendarConfig(activeCalendarIds) {
  const edgeClient = window.edgeClient;

  const result = await edgeClient.databaseRequest({
    operation: 'save_calendar_config',
    active_calendar_ids: activeCalendarIds  // Note: special param name
  });

  return result;
}
```

### Example 3: Get Storage Quota

```javascript
async function getStorageQuota() {
  const edgeClient = window.edgeClient;

  const result = await edgeClient.databaseRequest({
    operation: 'get_storage_quota',
    data: null  // No data needed
  });

  return {
    used: result.bytes_used,
    limit: result.quota_bytes,
    tier: result.storage_tier
  };
}
```

### Example 4: Delete Photo

```javascript
async function deletePhoto(photoId) {
  const edgeClient = window.edgeClient;

  const result = await edgeClient.databaseRequest({
    operation: 'delete_photo',
    data: {
      photo_id: photoId  // photoId is actually the storage_path
    }
  });

  // Result includes storage_paths to delete from bucket
  return result.storage_paths;
}
```

### Example 5: Direct Fetch (Complete Example)

```javascript
async function callDatabaseOperation(operation, data) {
  try {
    // 1. Get EdgeClient
    const edgeClient = window.edgeClient;
    if (!edgeClient) {
      throw new Error('EdgeClient not available');
    }

    // 2. Verify JWT service is ready
    if (!edgeClient.isServiceReady()) {
      throw new Error('JWT service not ready');
    }

    // 3. Get JWT token
    const jwtToken = await edgeClient.getSupabaseJWT();
    if (!jwtToken) {
      throw new Error('Failed to get valid JWT token');
    }

    // 4. Get anon key
    const supabaseAnonKey = edgeClient.anonKey;
    if (!supabaseAnonKey) {
      throw new Error('Supabase anon key not available');
    }

    // 5. Build URL
    const edgeFunctionUrl = 'https://cwglbtosingboqepsmjk.supabase.co/functions/v1/database-operations';

    // 6. Build request body (MUST include jwtToken)
    const requestBody = {
      operation,
      data,
      jwtToken  // ✅ CRITICAL
    };

    // 7. Make request
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,  // ✅ JWT in header
        'apikey': supabaseAnonKey                // ✅ Anon key in header
      },
      body: JSON.stringify(requestBody)
    });

    // 8. Check HTTP status
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge function failed: ${response.status} ${errorText}`);
    }

    // 9. Parse response
    const result = await response.json();

    // 10. Check success flag
    if (!result.success) {
      throw new Error(result.error || 'Operation failed');
    }

    // 11. Return result
    return result;

  } catch (error) {
    console.error(`Edge function ${operation} failed:`, error);
    throw error;
  }
}
```

---

## Response Format

All edge functions return responses in this format:

### Success Response

```javascript
{
  success: true,
  // Operation-specific data:
  photos: [...],           // For list_photos
  folders: [...],          // For list_folders
  active_calendar_ids: [], // For load_calendar_config
  // etc.
}
```

### Error Response

```javascript
{
  success: false,
  error: "Error message",
  details: "Detailed error info"
}
```

**OR** HTTP error (400, 401, 500):

```javascript
{
  error: "Error message"
}
```

---

## Security Notes

### JWT Token Security

- JWT tokens expire after a set time (check expiry before using)
- Tokens are user-specific (contain user ID in payload)
- Never log full JWT tokens (log prefix only: `jwtToken?.substring(0, 20)`)
- Tokens are stored in localStorage as `dashie-supabase-jwt`

### Anon Key Security

- Anon key is public (safe to expose in client code)
- Used for project identification, not authentication
- Different from service role key (which is server-only)

### Row Level Security (RLS)

Edge functions use the JWT token to verify:
- User identity (extracted from token)
- User owns the data being accessed (via RLS policies)
- Operations are scoped to authenticated user only

**Example:** `list_photos` operation:
```sql
-- RLS policy ensures user can only see their own photos
SELECT * FROM user_photos
WHERE auth_user_id = ${user_id_from_jwt}
```

---

## Debugging

### Enable Debug Logging

In EdgeClient:
```javascript
logger.debug('🔍 DEBUG: Making database-operations request', {
  url: this.databaseOpsUrl,
  operation: payload.operation,
  hasJwtToken: !!this.jwtToken,
  jwtTokenLength: this.jwtToken?.length,
  jwtTokenPrefix: this.jwtToken?.substring(0, 20)
});
```

In PhotoStorageService:
```javascript
logger.debug('🔍 DEBUG: JWT token retrieved', {
  hasToken: !!jwtToken,
  tokenLength: jwtToken?.length,
  tokenPrefix: jwtToken?.substring(0, 30)
});

logger.debug('🔍 DEBUG: Config and anon key', {
  hasConfig: !!config,
  hasAnonKey: !!supabaseAnonKey,
  anonKeyPrefix: supabaseAnonKey?.substring(0, 30)
});
```

### Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| `JWT token required` | Missing JWT in payload | Add `jwtToken` to request body |
| `Invalid Supabase JWT` | JWT expired or malformed | Refresh JWT token |
| `Invalid operation` | Unknown operation name | Check operation spelling |
| `Missing required parameters` | Missing data fields | Check operation requirements |
| `No account found for google:...` | Wrong account type format | Check accountType format |

### Test Edge Function

```javascript
// In browser console:
async function testEdgeFunction() {
  const edgeClient = window.edgeClient;

  console.log('EdgeClient:', edgeClient);
  console.log('Is ready:', edgeClient.isServiceReady());

  const jwt = await edgeClient.getSupabaseJWT();
  console.log('JWT:', jwt?.substring(0, 30) + '...');
  console.log('Anon key:', edgeClient.anonKey?.substring(0, 30) + '...');

  try {
    const result = await edgeClient.databaseRequest({
      operation: 'list_photos',
      data: { folder: null }
    });
    console.log('Success:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testEdgeFunction();
```

---

## Additional Resources

- **EdgeClient:** `js/data/auth/edge-client.js` - Handles edge function calls
- **PhotoStorageService:** `.legacy/js/supabase/photo-storage-service.js` - Photo operations
- **PhotoDataService:** `.legacy/js/services/photo-data-service.js` - Photo data management
- **Edge Function Source:** `supabase/functions/database-operations/index.ts` - Server-side implementation

---

## Quick Reference

### Checklist for Edge Function Calls

- [ ] Get JWT token: `await edgeClient.getSupabaseJWT()`
- [ ] Verify JWT exists and is not null
- [ ] Get anon key: `edgeClient.anonKey`
- [ ] Set Authorization header: `Bearer ${jwtToken}`
- [ ] Set apikey header: `${supabaseAnonKey}`
- [ ] Include jwtToken in request body
- [ ] Set Content-Type header: `application/json`
- [ ] Check HTTP response status
- [ ] Check response.success flag
- [ ] Handle errors appropriately

### Template

```javascript
const edgeClient = window.edgeClient;
const jwtToken = await edgeClient.getSupabaseJWT();

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`,
    'apikey': edgeClient.anonKey
  },
  body: JSON.stringify({
    operation: 'operation_name',
    data: { /* data */ },
    jwtToken: jwtToken
  })
});

if (!response.ok) throw new Error(`${response.status}`);
const result = await response.json();
if (!result.success) throw new Error(result.error);
return result;
```
