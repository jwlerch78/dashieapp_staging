# Delete Account - Implementation & Testing Guide

**Created:** 2025-10-18
**Phase:** 4.9 - Account Settings & Delete Account
**Status:** Edge Function Complete ✅ | Client & UI Pending ⏳

---

## Table of Contents

1. [What Was Implemented](#what-was-implemented)
2. [How It Works](#how-it-works)
3. [Current Database Schema](#current-database-schema)
4. [What Still Needs To Be Done](#what-still-needs-to-be-done)
5. [Testing Guide](#testing-guide)
6. [Code Reference](#code-reference)
7. [Troubleshooting](#troubleshooting)

---

## What Was Implemented

### ✅ Edge Function Complete

**File:** `supabase/functions/database-operations/index.ts`

#### Added Features:

1. **Deletion Configuration** (Lines 42-89)
   - Explicit list of 7 user tables to delete
   - Configuration for storage bucket cleanup
   - Updated based on current production schema

2. **Delete Account Operation** (Line 154-155)
   - Added routing for `delete_account` operation
   - Integrated with existing JWT authentication

3. **Complete Handler Function** (Lines 602-734)
   - `handleDeleteAccount(supabase, authUserId)`
   - 3-step deletion process
   - Detailed result tracking
   - Error handling with partial results

#### Tables Configured for Deletion:

```typescript
const DELETION_CONFIG = {
  tablesToDelete: [
    'user_photos',           // Photo metadata
    'user_storage_quota',    // Storage tracking
    'user_calendar_config',  // Calendar selections (NEW)
    'user_auth_tokens',      // OAuth tokens (NEW)
    'user_settings',         // User preferences
    'dashboard_heartbeats',  // Activity tracking (NEW)
    'user_profiles'          // Profile/billing (NEW)
  ],

  tablesWithStorage: [
    {
      table: 'user_photos',
      storagePathColumns: ['storage_path', 'thumbnail_path'],
      bucket: 'photos'
    }
  ]
};
```

---

## How It Works

### Architecture Overview

```
User clicks "Delete Account" in Settings
    ↓
Client calls EdgeClient.deleteAccount()
    ↓
EdgeClient calls edge function: operation='delete_account'
    ↓
Edge function (database-operations):
  1. Collects storage paths from user_photos
  2. Deletes records from all 7 user tables
  3. Deletes auth.users record (CASCADE cleanup)
  4. Returns storage paths + deletion counts
    ↓
Client receives result with storage_paths[]
    ↓
Client deletes files from Supabase storage bucket
    ↓
Client clears local data (localStorage, IndexedDB)
    ↓
Redirect user to login/goodbye page
```

### Detailed Edge Function Flow

#### Step 1: Collect Storage Paths (BEFORE Deletion)

```typescript
// For each table with storage (currently just user_photos)
SELECT storage_path, thumbnail_path
FROM user_photos
WHERE auth_user_id = userId;

// Collect all non-null paths into array:
storage_paths = [
  { path: "userId/all-photos/photo-123.jpg", bucket: "photos", table: "user_photos" },
  { path: "userId/all-photos/thumb-123.jpg", bucket: "photos", table: "user_photos" },
  // ... etc
]
```

**Why first?** Need paths before deleting records!

#### Step 2: Delete from All Tables

```typescript
// For each table in tablesToDelete array:
for (const tableName of DELETION_CONFIG.tablesToDelete) {
  DELETE FROM tableName WHERE auth_user_id = userId;
  // Track: tables_deleted[tableName] = count
}
```

**Order matters!** Tables deleted in order specified in config.

#### Step 3: Delete Auth User

```typescript
// Delete Supabase auth user (triggers CASCADE on foreign keys)
await supabase.auth.admin.deleteUser(authUserId);
```

**CASCADE cleanup:** Any remaining records with `ON DELETE CASCADE` foreign keys are auto-deleted.

#### Return Results

```typescript
{
  deleted: true,
  user_id: "abc-123-def",
  storage_paths: [
    { path: "abc-123-def/photo.jpg", bucket: "photos", table: "user_photos" }
  ],
  tables_deleted: {
    "user_photos": 25,
    "user_storage_quota": 1,
    "user_calendar_config": 1,
    "user_auth_tokens": 1,
    "user_settings": 1,
    "dashboard_heartbeats": 5,
    "user_profiles": 1
  },
  total_records_deleted: 35,
  errors: [] // Any errors encountered (doesn't abort)
}
```

---

## Current Database Schema

Based on production schema export (2025-10-18):

### Tables with `auth_user_id` (Will Be Deleted)

| Table | Purpose | Typical Records per User | Has Storage Files? |
|-------|---------|--------------------------|-------------------|
| `user_photos` | Photo metadata | 0-1000+ | ✅ Yes (photos bucket) |
| `user_storage_quota` | Storage tracking | 1 | ❌ No |
| `user_calendar_config` | Calendar selections | 1 | ❌ No |
| `user_auth_tokens` | OAuth tokens (Google) | 1 | ❌ No |
| `user_settings` | Theme, preferences | 1 | ❌ No |
| `dashboard_heartbeats` | Activity tracking | 1-100+ | ❌ No |
| `user_profiles` | Profile, tier, Stripe | 1 | ❌ No |

### Tables WITHOUT `auth_user_id` (Will NOT Be Deleted)

| Table | Purpose | Why Keep? |
|-------|---------|-----------|
| `beta_whitelist` | Beta access control | Audit trail |
| `access_control_config` | Global config | Not user-specific |

### Foreign Key Relationships

All user tables have:
```sql
auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
```

**This means:** When `auth.users` record is deleted, all related records auto-delete.

**Why delete explicitly then?**
1. To get accurate counts for logging
2. To collect storage paths before deletion
3. To handle errors gracefully per table

---

## What Still Needs To Be Done

### 1. ⏳ Client-Side Service (Not Started)

**File to Create:** `js/services/account-deletion-service.js`

**Purpose:** Orchestrate the full deletion flow from client side.

**What it needs to do:**

```javascript
class AccountDeletionService {
  async deleteAccount() {
    // 1. Call edge function
    const result = await edgeClient.callDatabaseOperation('delete_account');

    // 2. Delete storage files
    for (const item of result.storage_paths) {
      await photoService.deleteFile(item.path, item.bucket);
    }

    // 3. Clear local data
    localStorage.clear();
    sessionStorage.clear();
    indexedDB.deleteDatabase('dashie');

    // 4. Return success
    return result;
  }
}
```

**Reference for photo deletion:**
- See `.legacy/js/supabase/photo-storage-service.js`
- Method `deleteUserFolder(userId)` or `deleteFile(path)`

### 2. ⏳ Settings UI Page (Not Started)

**File to Create:** `js/modules/Settings/pages/settings-account-page.js`

**Purpose:** Add "Account" page to Settings modal with delete button.

**What it needs:**

```javascript
class SettingsAccountPage extends SettingsPageBase {
  render() {
    return `
      <div class="settings-modal__section">
        <div class="settings-modal__section-header">Account Info</div>
        <div>Email: ${user.email}</div>
      </div>

      <div class="settings-modal__section">
        <div class="settings-modal__section-header" style="color: red;">
          Danger Zone
        </div>
        <button data-action="delete">Delete Account</button>
      </div>
    `;
  }

  async handleItemClick(item) {
    if (item.dataset.action === 'delete') {
      await this.confirmAndDelete();
    }
  }

  async confirmAndDelete() {
    // Show double confirmation using modals.showConfirmation()
    // Call accountDeletionService.deleteAccount()
    // Redirect to goodbye page
  }
}
```

**Reference:**
- See `js/modules/Settings/pages/settings-calendar-page.js` for pattern
- Use `window.modals.showConfirmation()` for confirmations
- Already implemented in this session! See modal docs: `js/modules/Modals/README.md`

### 3. ⏳ Integration (Not Started)

**Files to Update:**

1. **Register service:**
   - File: `js/core/initialization/service-initializer.js`
   - Add: `window.accountDeletionService = new AccountDeletionService(...)`

2. **Register settings page:**
   - File: `js/modules/Settings/settings.js`
   - Add: `this.pages.set('account', new SettingsAccountPage())`

3. **Add menu item:**
   - File: `js/modules/Settings/pages/settings-main-page.js`
   - Add "Account" option to main settings menu

---

## Testing Guide

### Prerequisites

1. **Deploy edge function to Supabase:**
   ```bash
   cd supabase
   supabase functions deploy database-operations
   ```

2. **Verify deployment:**
   - Check Supabase dashboard → Edge Functions
   - Ensure `database-operations` is deployed
   - Check logs for any errors

### Test 1: Edge Function Only (Direct Call)

**Purpose:** Test the edge function works before building UI.

**Setup:**
1. Create test account
2. Add some photos, calendars, tokens
3. Note the user ID

**Test Code (Run in browser console):**

```javascript
// Get JWT token
const jwtToken = await window.jwtAuth.getSupabaseJWT();

// Call edge function directly
const response = await fetch('https://YOUR_PROJECT.supabase.co/functions/v1/database-operations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    operation: 'delete_account'
  })
});

const result = await response.json();
console.log('Delete result:', result);

// Expected result:
// {
//   success: true,
//   deleted: true,
//   user_id: "...",
//   storage_paths: [...],
//   tables_deleted: { ... },
//   total_records_deleted: N,
//   errors: []
// }
```

**Verify:**
1. Check result has `deleted: true`
2. Check `tables_deleted` counts match expected
3. Check `storage_paths` array has photo paths
4. Check `errors` array is empty
5. **Verify in database:**
   ```sql
   SELECT COUNT(*) FROM user_photos WHERE auth_user_id = 'test-user-id';
   -- Should return 0

   SELECT COUNT(*) FROM user_profiles WHERE auth_user_id = 'test-user-id';
   -- Should return 0

   SELECT * FROM auth.users WHERE id = 'test-user-id';
   -- Should return no rows
   ```

### Test 2: Full Integration (With Client Service)

**After implementing client service and UI.**

**Test Flow:**

1. **Create Test Account:**
   - Sign up new account
   - Add some photos (5-10)
   - Add calendar accounts (1-2)
   - Change settings (theme, etc.)

2. **Verify Data Exists:**
   ```sql
   SELECT
     (SELECT COUNT(*) FROM user_photos WHERE auth_user_id = 'USER_ID') as photos,
     (SELECT COUNT(*) FROM user_calendar_config WHERE auth_user_id = 'USER_ID') as calendars,
     (SELECT COUNT(*) FROM user_auth_tokens WHERE auth_user_id = 'USER_ID') as tokens,
     (SELECT COUNT(*) FROM user_settings WHERE auth_user_id = 'USER_ID') as settings,
     (SELECT COUNT(*) FROM user_profiles WHERE auth_user_id = 'USER_ID') as profile;
   ```

3. **Delete Account via UI:**
   - Go to Settings → Account
   - Click "Delete Account"
   - Confirm first modal (Are you sure?)
   - Confirm second modal (Type email?)
   - Wait for deletion

4. **Verify Everything Deleted:**
   - Database: All tables = 0 rows (see SQL above)
   - Storage bucket: `photos/USER_ID/` folder is empty
   - Local storage: `localStorage` is cleared
   - User: Cannot log back in

5. **Check Logs:**
   - Supabase Dashboard → Edge Functions → Logs
   - Look for `🗑️ DELETING ACCOUNT` messages
   - Verify no errors

### Test 3: Error Handling

**Test Case 1: Network Failure**
- Disconnect internet mid-deletion
- Expected: Graceful error message, partial results returned

**Test Case 2: Storage Deletion Fails**
- Manually remove storage permissions
- Expected: Database still deleted, storage error logged

**Test Case 3: User Cancels**
- Start delete flow
- Cancel at first confirmation
- Expected: No data deleted, user can continue using app

**Test Case 4: No Data**
- Create account with NO photos, NO calendars
- Delete account
- Expected: Clean deletion, no errors, counts = 0

**Test Case 5: Lots of Data**
- Create account with 100+ photos, multiple calendar accounts
- Delete account
- Expected: All deleted, no timeout errors

### Test 4: Edge Cases

**Case 1: Account with Stripe Subscription**
- Create account with `stripe_customer_id` in `user_profiles`
- Delete account
- Verify: Stripe customer ID is removed from DB
- Manual check: Cancel Stripe subscription (separate process)

**Case 2: Multiple Calendar Accounts**
- Add 5 Google calendar accounts
- Delete account
- Verify: All tokens removed from `user_auth_tokens`

**Case 3: Shared Calendars**
- Add shared calendar from another user
- Delete account
- Verify: Your access is revoked, calendar still exists for owner

---

## Code Reference

### Edge Function Call (From Client)

**Using EdgeClient (recommended):**

```javascript
// Via EdgeClient service
const result = await window.edgeClient.callDatabaseOperation(
  'delete_account',
  {} // No data needed
);
```

**Direct fetch (for testing):**

```javascript
const jwtToken = await window.jwtAuth.getSupabaseJWT();

const response = await fetch(
  `${window.currentDbConfig.supabaseUrl}/functions/v1/database-operations`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      operation: 'delete_account'
    })
  }
);

const result = await response.json();
```

### Delete Storage Files

**Using PhotoStorageService:**

```javascript
const photoService = window.dataManager.photoService;

// Option 1: Delete individual files
for (const item of result.storage_paths) {
  await photoService.deleteFile(item.path);
}

// Option 2: Delete entire user folder (more efficient)
const userId = window.sessionManager.currentUser.id;
await photoService.deleteUserFolder(userId);
```

**Direct Supabase call:**

```javascript
const client = await photoService._getAuthenticatedClient();

// Delete multiple files
const paths = result.storage_paths.map(item => item.path);
const { data, error } = await client.storage
  .from('photos')
  .remove(paths);
```

### Double Confirmation Pattern

**Using Modals module:**

```javascript
// First confirmation
window.modals.showConfirmation({
  title: 'Delete Account?',
  message: 'This will permanently delete your account and all data.',
  confirmLabel: 'Continue',
  cancelLabel: 'Cancel',
  confirmStyle: 'primary',
  onConfirm: () => {
    // Show second confirmation
    this.showFinalConfirmation();
  }
});

// Second confirmation
showFinalConfirmation() {
  window.modals.showConfirmation({
    title: 'Final Confirmation',
    message: `Type your email (${user.email}) to confirm deletion.`,
    confirmLabel: 'Delete Everything',
    cancelLabel: 'Cancel',
    confirmStyle: 'primary', // NOT destructive (we don't want red)
    onConfirm: async () => {
      // TODO: Verify user typed email correctly
      await this.performDeletion();
    }
  });
}
```

**Reference:** See `js/modules/Modals/README.md` for complete modal documentation.

---

## Troubleshooting

### Problem: Edge function not found

**Symptoms:**
- Error: "Function not found"
- 404 response

**Solution:**
1. Check deployment: `supabase functions list`
2. Redeploy: `supabase functions deploy database-operations`
3. Verify URL in browser console: `console.log(window.currentDbConfig.supabaseUrl)`

---

### Problem: JWT authentication fails

**Symptoms:**
- Error: "Invalid Supabase JWT"
- 401 response

**Solution:**
1. Check JWT exists: `const jwt = await window.jwtAuth.getSupabaseJWT(); console.log(jwt);`
2. Check JWT secret matches in Supabase env vars
3. Try refreshing JWT: `await window.jwtAuth.refreshJWT()`

---

### Problem: Some tables not deleted

**Symptoms:**
- `tables_deleted` counts are 0 for some tables
- Errors in `errors` array

**Solution:**
1. Check table exists: `SELECT * FROM information_schema.tables WHERE table_name = 'table_name';`
2. Check RLS policies allow deletion
3. Check user has records: `SELECT COUNT(*) FROM table_name WHERE auth_user_id = 'user-id';`
4. Check error details in result.errors array

---

### Problem: Storage files not deleted

**Symptoms:**
- Files still visible in Supabase Storage
- Client can't delete files

**Solution:**
1. Check storage_paths in result: `console.log(result.storage_paths)`
2. Check bucket permissions (RLS)
3. Manually delete via Supabase dashboard → Storage → photos
4. Check PhotoStorageService has auth: `photoService._getAuthenticatedClient()`

---

### Problem: CASCADE deletion not working

**Symptoms:**
- `auth.users` deleted but user tables still have records
- Orphaned data

**Solution:**
1. Check foreign key constraints:
   ```sql
   SELECT
     tc.table_name,
     kcu.column_name,
     rc.delete_rule
   FROM information_schema.table_constraints AS tc
   JOIN information_schema.key_column_usage AS kcu
     ON tc.constraint_name = kcu.constraint_name
   JOIN information_schema.referential_constraints AS rc
     ON tc.constraint_name = rc.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY'
     AND kcu.column_name = 'auth_user_id';
   ```
2. Ensure `delete_rule = 'CASCADE'` for all user tables
3. If missing, add constraint:
   ```sql
   ALTER TABLE table_name
   ADD CONSTRAINT table_name_auth_user_id_fkey
   FOREIGN KEY (auth_user_id)
   REFERENCES auth.users(id)
   ON DELETE CASCADE;
   ```

---

## Quick Start Checklist

When resuming work on this feature:

### Immediate Testing (Edge Function Only)
- [ ] Deploy edge function: `supabase functions deploy database-operations`
- [ ] Create test account
- [ ] Run Test 1 (direct edge function call via console)
- [ ] Verify database records deleted
- [ ] Verify result structure matches expected

### Full Implementation
- [ ] Create `AccountDeletionService` class
- [ ] Create `SettingsAccountPage` class
- [ ] Register service in service-initializer
- [ ] Register page in settings
- [ ] Add "Account" menu item
- [ ] Implement double confirmation flow
- [ ] Implement storage cleanup
- [ ] Test full flow end-to-end

### Production Deployment
- [ ] Test on staging environment first
- [ ] Verify all 7 tables delete correctly
- [ ] Verify storage files delete
- [ ] Test with real Stripe subscriptions (separate cancellation)
- [ ] Add analytics event for account deletion (optional)
- [ ] Create "goodbye" page or redirect to login
- [ ] Deploy to production
- [ ] Monitor logs for errors

---

## Additional Notes

### Stripe Subscriptions

**⚠️ Important:** Account deletion does NOT cancel Stripe subscriptions!

**Recommended flow:**
1. Check if user has active subscription
2. If yes, show warning: "Cancel subscription first"
3. Provide link to Stripe customer portal
4. Only allow deletion after subscription cancelled

**OR:**

1. Delete account
2. Separately call Stripe API to cancel subscription
3. Keep `stripe_customer_id` in separate audit table for billing history

### Analytics / Audit Trail

**Consider keeping:**
- Account deletion timestamp
- Deletion reason (user-provided)
- Deleted user email (hashed?) for support queries

**Add audit table (optional):**
```sql
CREATE TABLE account_deletion_audit (
  id UUID PRIMARY KEY,
  email_hash TEXT,
  deleted_at TIMESTAMPTZ,
  reason TEXT,
  tables_deleted JSONB,
  total_records INTEGER
);
```

### Recovery / Soft Delete

**Current implementation:** HARD DELETE (permanent)

**Alternative:** Soft delete with 30-day grace period
1. Mark account as `deleted_at = NOW()`
2. Hide from UI
3. Keep data for 30 days
4. After 30 days, run cleanup job to hard delete
5. User can "undelete" within 30 days

**Not implemented** - current implementation is permanent deletion.

---

## Related Documentation

- **Modal System:** `js/modules/Modals/README.md`
- **Settings System:** `js/modules/Settings/`
- **Edge Functions:** `.reference/EDGE_FUNCTION_*.md`
- **Database Schema:** `supabase/migrations/20251016_phase3_v2_complete.sql`
- **Build Plan:** `.reference/build-plans/Phase 4 - Calendar, Agenda, Login, Settings & Modals.md`

---

## File Locations

### Edge Function
- **Deployed:** `supabase/functions/database-operations/index.ts` ✅
- **Legacy reference:** `.legacy/supabase edge functions/database-operations.js`

### Client Service (TODO)
- **To create:** `js/services/account-deletion-service.js`

### Settings UI (TODO)
- **To create:** `js/modules/Settings/pages/settings-account-page.js`

### Integration (TODO)
- **To update:** `js/core/initialization/service-initializer.js`
- **To update:** `js/modules/Settings/settings.js`
- **To update:** `js/modules/Settings/pages/settings-main-page.js`

---

**END OF DOCUMENT**

Resume work by starting with Test 1 (edge function direct call) to verify the backend works, then build out client service and UI.
