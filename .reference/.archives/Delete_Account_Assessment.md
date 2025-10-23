# Delete Account Functionality - Implementation Assessment

**Date:** 2025-10-18
**Phase:** 4.9 - Account Settings & Delete Account
**Status:** Planning/Assessment

---

## Overview

Implement a comprehensive delete account feature that removes all user data from the database, storage, and cleans up associated resources.

---

## Current System Analysis

### 1. Database Tables (Confirmed)

Based on `supabase/migrations/20251016_phase3_v2_complete.sql`:

#### ✅ Tables That Exist:
1. **`user_profiles`** - User subscription, tier, billing info
   - Links to: `auth.users(id)` via `auth_user_id`
   - Has CASCADE DELETE: ✅ Will auto-delete when auth user deleted

2. **`user_auth_tokens`** - OAuth tokens (Google Calendar, etc.)
   - Links to: `auth.users(id)` via `auth_user_id`
   - Has CASCADE DELETE: ✅ Will auto-delete when auth user deleted
   - Structure: `{ "google": { "primary": {...}, "account2": {...} } }`

3. **`user_calendar_config`** - Calendar selections and settings
   - Links to: `auth.users(id)` via `auth_user_id`
   - Has CASCADE DELETE: ✅ Will auto-delete when auth user deleted
   - Contains: `active_calendar_ids`, `accounts`, `calendar_settings`

#### ⚠️ Tables Referenced But Not in Migration:
4. **`user_photos`** - Photo metadata (NOT YET MIGRATED)
   - Expected columns: `auth_user_id`, `storage_path`, `thumbnail_path`, etc.
   - **ACTION NEEDED:** Check if this table exists in production, or needs migration

5. **`user_storage_quota`** - Storage usage tracking (NOT YET MIGRATED)
   - Expected columns: `auth_user_id`, `bytes_used`, `last_calculated`
   - **ACTION NEEDED:** Check if this table exists in production, or needs migration

### 2. Storage Buckets

From `PhotoStorageService` analysis:

#### Photo Storage:
- **Bucket Name:** `photos`
- **Folder Structure:** `{userId}/{folder-name}/`
  - Default folder: `all-photos`
  - User can create custom folders
- **File Types:**
  - Full-size photos: `{userId}/folder-name/photo-{timestamp}.jpg`
  - Thumbnails: `{userId}/folder-name/thumb-{timestamp}.jpg`

#### Storage Paths Format:
```
photos/
  ├── {userId}/
  │   ├── all-photos/
  │   │   ├── photo-123456.jpg
  │   │   └── thumb-123456.jpg
  │   └── vacation/
  │       ├── photo-789012.jpg
  │       └── thumb-789012.jpg
```

### 3. Existing Delete Operations

#### Current `delete_all_photos` Edge Function:
Location: `supabase/functions/database-operations/index.ts`

**What it does:**
1. Fetches all photo records from `user_photos` for user
2. Deletes all records from `user_photos`
3. Resets `user_storage_quota.bytes_used` to 0
4. Returns list of storage paths to delete

**What it DOESN'T do:**
- ❌ Does NOT delete actual files from storage
- ❌ Client must delete files separately

**Why?** Edge functions can't delete from storage buckets (limitation). Client-side code handles file deletion.

---

## Implementation Plan

### Phase 1: Database Schema (If Needed)

**⚠️ PREREQUISITE:** Verify if `user_photos` and `user_storage_quota` tables exist.

If they don't exist, create migration:

```sql
-- user_photos table
CREATE TABLE IF NOT EXISTS user_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  folder_name TEXT DEFAULT 'all-photos',
  file_size BIGINT NOT NULL,
  thumbnail_size BIGINT DEFAULT 0,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(auth_user_id, storage_path)
);

CREATE INDEX idx_user_photos_user_id ON user_photos(auth_user_id);
CREATE INDEX idx_user_photos_folder ON user_photos(auth_user_id, folder_name);

ALTER TABLE user_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own photos"
  ON user_photos
  FOR ALL
  USING (auth.uid() = auth_user_id);

-- user_storage_quota table
CREATE TABLE IF NOT EXISTS user_storage_quota (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bytes_used BIGINT DEFAULT 0,
  bytes_limit BIGINT DEFAULT 1073741824, -- 1GB default
  last_calculated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(auth_user_id)
);

CREATE INDEX idx_user_storage_quota_user_id ON user_storage_quota(auth_user_id);

ALTER TABLE user_storage_quota ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own storage quota"
  ON user_storage_quota
  FOR SELECT
  USING (auth.uid() = auth_user_id);
```

**Note:** All tables have `ON DELETE CASCADE` so they'll auto-delete when the `auth.users` record is deleted.

---

### Phase 2: Edge Function - Delete Account

**File:** `supabase/functions/database-operations/index.ts`

Add new operation: `delete_account`

```typescript
// In operation routing
} else if (operation === 'delete_account') {
  result = await handleDeleteAccount(supabase, userId);
}

// Handler implementation
async function handleDeleteAccount(supabase: any, authUserId: string) {
  try {
    console.log(`🗑️ Deleting account for user: ${authUserId}`);

    // STEP 1: Get all photo storage paths (before deleting records)
    let photoStoragePaths: string[] = [];

    const { data: photos } = await supabase
      .from('user_photos')
      .select('storage_path, thumbnail_path')
      .eq('auth_user_id', authUserId);

    if (photos) {
      photos.forEach((photo: any) => {
        if (photo.storage_path) photoStoragePaths.push(photo.storage_path);
        if (photo.thumbnail_path) photoStoragePaths.push(photo.thumbnail_path);
      });
    }

    // STEP 2: Get user folder path for bulk deletion
    // Photos are stored in: photos/{userId}/...
    const userFolderPath = `${authUserId}`;

    // STEP 3: Delete from all data tables
    // Note: These will auto-delete via CASCADE when auth user is deleted,
    // but we do it explicitly for clarity and to return counts

    const deletions = {
      photos: 0,
      storage_quota: 0,
      calendar_config: 0,
      auth_tokens: 0,
      profile: 0
    };

    // Delete photos
    const { data: deletedPhotos, error: photosError } = await supabase
      .from('user_photos')
      .delete()
      .eq('auth_user_id', authUserId)
      .select();

    if (photosError) {
      console.warn('⚠️ Error deleting photos:', photosError);
    } else {
      deletions.photos = deletedPhotos?.length || 0;
    }

    // Delete storage quota
    const { error: quotaError } = await supabase
      .from('user_storage_quota')
      .delete()
      .eq('auth_user_id', authUserId);

    if (quotaError) {
      console.warn('⚠️ Error deleting storage quota:', quotaError);
    } else {
      deletions.storage_quota = 1;
    }

    // Delete calendar config
    const { error: calendarError } = await supabase
      .from('user_calendar_config')
      .delete()
      .eq('auth_user_id', authUserId);

    if (calendarError) {
      console.warn('⚠️ Error deleting calendar config:', calendarError);
    } else {
      deletions.calendar_config = 1;
    }

    // Delete auth tokens
    const { error: tokensError } = await supabase
      .from('user_auth_tokens')
      .delete()
      .eq('auth_user_id', authUserId);

    if (tokensError) {
      console.warn('⚠️ Error deleting auth tokens:', tokensError);
    } else {
      deletions.auth_tokens = 1;
    }

    // Delete user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('auth_user_id', authUserId);

    if (profileError) {
      console.warn('⚠️ Error deleting profile:', profileError);
    } else {
      deletions.profile = 1;
    }

    // STEP 4: Delete auth user (CASCADE will clean up any remaining records)
    const { error: authError } = await supabase.auth.admin.deleteUser(
      authUserId
    );

    if (authError) {
      throw new Error(`Failed to delete auth user: ${authError.message}`);
    }

    console.log(`✅ Account deleted for user: ${authUserId}`, deletions);

    return {
      deleted: true,
      user_id: authUserId,
      deletions,
      storage_cleanup: {
        user_folder: userFolderPath,
        individual_paths: photoStoragePaths,
        total_files: photoStoragePaths.length
      }
    };
  } catch (error) {
    console.error('🚨 handleDeleteAccount error:', error);
    throw error;
  }
}
```

**Key Points:**
- Returns storage paths for client-side cleanup
- Deletes records in dependency order
- Final `deleteUser()` triggers CASCADE cleanup
- Returns detailed deletion counts for logging

---

### Phase 3: Client-Side Service

**File:** Create `js/services/account-deletion-service.js`

```javascript
import { createLogger } from '../utils/logger.js';

const logger = createLogger('AccountDeletion');

export class AccountDeletionService {
  constructor(edgeClient, photoService) {
    this.edgeClient = edgeClient;
    this.photoService = photoService;
  }

  /**
   * Delete user account and all associated data
   * @returns {Promise<Object>} Deletion result
   */
  async deleteAccount() {
    try {
      logger.info('Starting account deletion process');

      // STEP 1: Call edge function to delete database records
      const result = await this.edgeClient.callDatabaseOperation(
        'delete_account'
      );

      if (!result || !result.deleted) {
        throw new Error('Failed to delete account from database');
      }

      logger.info('Database records deleted', {
        deletions: result.deletions
      });

      // STEP 2: Delete photos from storage
      const storageCleanup = result.storage_cleanup;

      if (storageCleanup && storageCleanup.user_folder) {
        try {
          // Delete entire user folder (more efficient than individual files)
          await this.photoService.deleteUserFolder(storageCleanup.user_folder);

          logger.success('User photo folder deleted', {
            folder: storageCleanup.user_folder,
            fileCount: storageCleanup.total_files
          });
        } catch (storageError) {
          // Log but don't fail - database is already cleaned
          logger.error('Failed to delete photo storage', storageError);
        }
      }

      // STEP 3: Clear local storage / IndexedDB
      this.clearLocalData();

      logger.success('Account deletion complete', {
        userId: result.user_id,
        photosDeleted: result.deletions.photos
      });

      return {
        success: true,
        ...result
      };

    } catch (error) {
      logger.error('Account deletion failed', error);
      throw error;
    }
  }

  /**
   * Clear all local data (IndexedDB, localStorage, sessionStorage)
   * @private
   */
  clearLocalData() {
    try {
      // Clear localStorage
      localStorage.clear();

      // Clear sessionStorage
      sessionStorage.clear();

      // Clear IndexedDB
      if (window.indexedDB) {
        indexedDB.databases().then(dbs => {
          dbs.forEach(db => {
            if (db.name) {
              indexedDB.deleteDatabase(db.name);
            }
          });
        });
      }

      logger.info('Local data cleared');
    } catch (error) {
      logger.warn('Failed to clear all local data', error);
    }
  }
}
```

---

### Phase 4: Photo Storage Cleanup

**File:** Update `.legacy/js/supabase/photo-storage-service.js`

Add method to delete entire user folder:

```javascript
/**
 * Delete entire user folder (all photos and thumbnails)
 * More efficient than deleting individual files
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Deletion result
 */
async deleteUserFolder(userId) {
  try {
    logger.info('Deleting user folder', { userId });

    const client = await this._getAuthenticatedClient();

    // List all files in user's folder
    const { data: files, error: listError } = await client.storage
      .from(this.bucketName)
      .list(userId, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (listError) {
      throw new Error(`Failed to list files: ${listError.message}`);
    }

    if (!files || files.length === 0) {
      logger.info('No files to delete');
      return { deleted: 0 };
    }

    // Build file paths
    const filePaths = files.map(file => `${userId}/${file.name}`);

    // Delete all files
    const { data, error: deleteError } = await client.storage
      .from(this.bucketName)
      .remove(filePaths);

    if (deleteError) {
      throw new Error(`Failed to delete files: ${deleteError.message}`);
    }

    logger.success('User folder deleted', {
      userId,
      filesDeleted: filePaths.length
    });

    return {
      deleted: filePaths.length,
      paths: filePaths
    };

  } catch (error) {
    logger.error('Failed to delete user folder', error);
    throw error;
  }
}
```

---

### Phase 5: Settings UI

**File:** Create `js/modules/Settings/pages/settings-account-page.js`

```javascript
import { SettingsPageBase } from '../core/settings-page-base.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('SettingsAccountPage');

export class SettingsAccountPage extends SettingsPageBase {
  constructor() {
    super('account');
    this.accountDeletionService = null;
  }

  async initialize() {
    await super.initialize();

    // Get services
    this.accountDeletionService = window.accountDeletionService;
    this.sessionManager = window.sessionManager;
  }

  render() {
    const user = this.sessionManager?.currentUser;
    const email = user?.email || 'Unknown';

    return `
      <div class="settings-modal__list">
        <!-- Account Info -->
        <div class="settings-modal__section">
          <div class="settings-modal__section-header">Account Information</div>

          <div class="settings-modal__menu-item">
            <span class="settings-modal__menu-label">Email</span>
            <span class="settings-modal__cell-value">${email}</span>
          </div>

          <div class="settings-modal__menu-item">
            <span class="settings-modal__menu-label">User ID</span>
            <span class="settings-modal__cell-value" style="font-size: 11px; color: var(--text-muted);">
              ${user?.id?.substring(0, 8) || 'N/A'}...
            </span>
          </div>
        </div>

        <!-- Danger Zone -->
        <div class="settings-modal__section">
          <div class="settings-modal__section-header" style="color: var(--color-error);">
            Danger Zone
          </div>

          <div class="settings-modal__menu-item settings-modal__menu-item--navigable"
               data-account-action="delete"
               role="button"
               tabindex="0">
            <span class="settings-modal__menu-label" style="color: var(--color-error);">
              Delete Account
            </span>
            <span class="settings-modal__cell-description">
              Permanently delete your account and all data
            </span>
            <span class="settings-modal__cell-chevron">›</span>
          </div>
        </div>

        <!-- Warning -->
        <div class="settings-modal__section">
          <div style="padding: 12px 16px; color: var(--text-muted); font-size: 13px; line-height: 1.4;">
            ⚠️ Deleting your account is permanent and cannot be undone.
            All photos, calendars, and settings will be lost.
          </div>
        </div>
      </div>
    `;
  }

  async handleItemClick(item) {
    const action = item.dataset.accountAction;

    if (action === 'delete') {
      await this.handleDeleteAccount();
      return { shouldNavigate: false };
    }

    return { shouldNavigate: false };
  }

  async handleDeleteAccount() {
    // Show first confirmation
    window.modals.showConfirmation({
      title: 'Delete Account?',
      message: 'This will permanently delete your account and all associated data. This action cannot be undone.',
      confirmLabel: 'Continue',
      cancelLabel: 'Cancel',
      confirmStyle: 'destructive',
      onConfirm: () => {
        // Show second confirmation (double-check)
        this.showFinalDeleteConfirmation();
      }
    });
  }

  showFinalDeleteConfirmation() {
    const email = this.sessionManager?.currentUser?.email || '';

    window.modals.showConfirmation({
      title: 'Final Confirmation',
      message: `Type your email (${email}) to confirm account deletion. All data will be permanently lost.`,
      confirmLabel: 'Delete Everything',
      cancelLabel: 'Cancel',
      confirmStyle: 'destructive',
      onConfirm: async () => {
        // TODO: Add email input validation
        await this.performAccountDeletion();
      }
    });
  }

  async performAccountDeletion() {
    try {
      logger.info('User confirmed account deletion');

      // Close settings modal
      if (window.Settings) {
        window.Settings.hide();
      }

      // Show loading state (could use a progress modal)
      console.log('Deleting account...');

      // Perform deletion
      const result = await this.accountDeletionService.deleteAccount();

      logger.success('Account deleted successfully', result);

      // Redirect to goodbye page or login
      window.location.href = '/goodbye.html'; // Or back to login

    } catch (error) {
      logger.error('Failed to delete account', error);

      // Show error modal
      window.modals.showConfirmation({
        title: 'Deletion Failed',
        message: 'An error occurred while deleting your account. Please try again or contact support.',
        confirmLabel: 'OK',
        confirmStyle: 'primary',
        onConfirm: () => {}
      });
    }
  }
}
```

---

### Phase 6: Integration

**File:** `js/core/initialization/service-initializer.js`

Initialize the account deletion service:

```javascript
import { AccountDeletionService } from '../../services/account-deletion-service.js';

export async function initializeServices() {
  // ... existing service initialization ...

  // Initialize account deletion service
  const photoService = window.dataManager?.photoService;
  const edgeClient = window.edgeClient;

  if (edgeClient && photoService) {
    window.accountDeletionService = new AccountDeletionService(
      edgeClient,
      photoService
    );
    logger.info('Account deletion service initialized');
  }
}
```

**File:** `js/modules/Settings/settings.js`

Register the account page:

```javascript
import { SettingsAccountPage } from './pages/settings-account-page.js';

// In initialize()
this.pages.set('account', new SettingsAccountPage());
```

---

## Data Deletion Checklist

When a user deletes their account, the following data is removed:

### Database Tables
- [x] `user_profiles` - Profile, tier, billing
- [x] `user_auth_tokens` - OAuth tokens (Google, etc.)
- [x] `user_calendar_config` - Calendar selections
- [x] `user_photos` - Photo metadata
- [x] `user_storage_quota` - Storage usage
- [x] `auth.users` - Supabase auth record (triggers CASCADE)

### Storage Buckets
- [x] All files in `photos/{userId}/` folder
  - Full-size photos
  - Thumbnails

### Local Storage
- [x] localStorage (all keys)
- [x] sessionStorage (all keys)
- [x] IndexedDB (all databases)

---

## Safety Features

### Double Confirmation
1. First modal: "Are you sure?"
2. Second modal: "Type your email to confirm"

### Explanation
- Clear message about what will be deleted
- "Cannot be undone" warning
- List of data types being removed

### Error Handling
- If database deletion fails → abort, show error
- If storage deletion fails → log warning, continue (data already removed from DB)
- If local cleanup fails → log warning, continue

### Logging
- Log every step for debugging
- Track deletion counts
- Record user ID and timestamp

---

## Testing Plan

### Unit Tests
1. Test edge function with mock data
2. Test service methods independently
3. Test UI confirmation flow

### Integration Tests
1. Create test account
2. Add photos, calendars, tokens
3. Delete account
4. Verify all data removed from:
   - Database (all tables)
   - Storage bucket
   - Local storage

### Edge Cases
1. Account with no photos
2. Account with many photos (1000+)
3. Account with multiple calendar accounts
4. Network failure during deletion
5. User cancels at each confirmation step

---

## Risks & Mitigations

### Risk 1: Incomplete Deletion
**Issue:** Some data might not be deleted
**Mitigation:** Use CASCADE DELETE + explicit deletion + return detailed counts

### Risk 2: Storage Deletion Failure
**Issue:** Photos might remain in storage after DB deletion
**Mitigation:** Delete storage BEFORE deleting DB (if possible), or log failures for manual cleanup

### Risk 3: Accidental Deletion
**Issue:** User deletes account by mistake
**Mitigation:** Double confirmation + email typing + clear warnings

### Risk 4: Photo Tables Don't Exist
**Issue:** `user_photos` / `user_storage_quota` tables might not be migrated yet
**Mitigation:** Check production schema first, create migration if needed

---

## Estimated Effort

### Development
- Edge function updates: **2 hours**
- Client service creation: **2 hours**
- Settings UI page: **3 hours**
- Photo storage cleanup: **2 hours**
- Integration & testing: **3 hours**
- **Total: ~12 hours** (1.5 days)

### Testing
- Unit tests: **2 hours**
- Integration tests: **3 hours**
- Manual QA: **2 hours**
- **Total: ~7 hours** (1 day)

### Documentation
- Update settings docs: **1 hour**
- User-facing help: **1 hour**
- **Total: ~2 hours**

**Grand Total: ~21 hours** (2.5-3 days)

---

## Open Questions

1. ✅ **Do `user_photos` and `user_storage_quota` tables exist in production?**
   - If NO → Need to create migration first
   - If YES → Proceed with implementation

2. ❓ **Should we add a "cooling off" period?**
   - E.g., mark account as "deleted" but keep data for 30 days
   - Allows user to recover if they change their mind
   - Complicates implementation

3. ❓ **What happens to Stripe subscriptions?**
   - Should we cancel subscription first?
   - Should we notify Stripe of account deletion?
   - Check if `user_profiles.stripe_customer_id` needs cleanup

4. ❓ **Should we send a confirmation email?**
   - "Your account has been deleted" email
   - Requires email service integration

5. ❓ **Where should user land after deletion?**
   - Create `/goodbye.html` page?
   - Redirect to login?
   - Show "Account Deleted" message?

---

## Next Steps

1. **Verify Schema** - Check if photo tables exist in production
2. **Create Migration** - If needed, add photo tables with CASCADE DELETE
3. **Implement Edge Function** - Add `delete_account` operation
4. **Build Client Service** - Create `AccountDeletionService`
5. **Add Settings Page** - Create account settings with delete button
6. **Test Thoroughly** - Run through full deletion flow
7. **Deploy** - Push to production with monitoring

---

## Dependencies

- ✅ EdgeClient (for calling edge functions)
- ✅ PhotoStorageService (for deleting photos)
- ✅ Modals module (for confirmations)
- ✅ Settings modal infrastructure
- ⚠️ Photo tables migration (might be needed)

---

## Success Criteria

Account deletion is complete when:

- [ ] All database records deleted (verified via SQL query)
- [ ] All storage files deleted (verified via bucket check)
- [ ] All local data cleared
- [ ] User cannot log back in
- [ ] No orphaned data remains
- [ ] Deletion process logged for audit
- [ ] User sees clear confirmation of deletion
