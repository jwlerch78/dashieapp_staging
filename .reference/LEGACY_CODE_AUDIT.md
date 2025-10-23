# Legacy Code Audit - Active Dependencies

**Date:** 2025-10-23
**Status:** 🔴 **2 ACTIVE IMPORTS FROM .legacy/** (Should be 0)

---

## Summary

The new codebase (`js/`) currently has **2 active import statements** from the `.legacy/` folder:

1. ✅ **PhotosSettingsManager** - Photos settings modal manager
2. ✅ **PhotoStorageService** - Supabase photo storage operations

Both are related to the **photos feature** and need migration.

---

## Detailed Findings

### 1. Direct Imports from `.legacy/`

#### Import #1: PhotosSettingsManager
**File:** `js/core/initialization/service-initializer.js:12`
```javascript
import { PhotosSettingsManager } from '../../../.legacy/widgets/photos/photos-settings-manager.js';
```

**Impact:**
- Used in service initialization
- Creates `window.photosSettingsManager`
- Connected to by `js/modules/Settings/pages/settings-photos-page.js`

**Transitive Dependencies (files this imports):**
- ✅ `js/utils/logger.js` (NEW codebase - OK)

**Transitive Usage (what it loads at runtime):**
- Loads iframe: `.legacy/widgets/photos/photos-settings.html`
- Which runs: `.legacy/widgets/photos/photos-settings-modal.js`
- Which imports: `.legacy/js/supabase/photo-storage-service.js`

---

#### Import #2: PhotoStorageService
**File:** `js/data/services/photo-service.js:6`
```javascript
import { PhotoStorageService } from '../../../.legacy/js/supabase/photo-storage-service.js';
```

**Impact:**
- Used by PhotoService as low-level storage handler
- Handles uploads, downloads, deletions

**Transitive Dependencies (files this imports):**
- ⚠️ `.legacy/js/supabase/supabase-config.js` (LEGACY)
- ⚠️ `.legacy/widgets/photos/utils/photo-file-processor.js` (LEGACY)
- ✅ `js/utils/logger.js` (NEW codebase - OK)
- External: `https://cdn.skypack.dev/@supabase/supabase-js@2` (CDN - OK)

---

### 2. Legacy Dependencies Chain

```
NEW CODEBASE IMPORTS:
├─ PhotosSettingsManager (.legacy/widgets/photos/)
│  └─ Loads iframe → photos-settings.html (.legacy/widgets/photos/)
│     └─ Runs → photos-settings-modal.js (.legacy/widgets/photos/)
│        └─ Imports → PhotoStorageService (.legacy/js/supabase/)
│           ├─ supabase-config.js (.legacy/js/supabase/)
│           └─ PhotoFileProcessor (.legacy/widgets/photos/utils/)
│
└─ PhotoStorageService (.legacy/js/supabase/)
   ├─ supabase-config.js (.legacy/js/supabase/)
   └─ PhotoFileProcessor (.legacy/widgets/photos/utils/)
```

---

### 3. Files That Must Be Migrated

#### Primary Files (Directly Imported)
1. ✅ `.legacy/widgets/photos/photos-settings-manager.js` (348 lines)
2. ✅ `.legacy/js/supabase/photo-storage-service.js` (690 lines)

#### Secondary Files (Runtime Dependencies)
3. ✅ `.legacy/widgets/photos/photos-settings-modal.js` (816 lines)
4. ✅ `.legacy/widgets/photos/photos-settings.html` (125 lines)
5. ✅ `.legacy/widgets/photos/photos-settings.css` (304 lines)
6. ✅ `.legacy/widgets/photos/photos-modal-overlays.js` (estimated ~200 lines)

#### Tertiary Files (Transitive Dependencies)
7. ✅ `.legacy/js/supabase/supabase-config.js` (60 lines)
8. ✅ `.legacy/widgets/photos/utils/photo-file-processor.js` (10,882 bytes)

**Total:** 8 files need migration

---

### 4. Comment-Only References (Safe to Ignore)

These files have comments mentioning `.legacy/` but don't import from it:

- `js/modules/Welcome/*.js` - Comments say "Ported from .legacy" ✅ (documentation only)
- `js/data/services/photo-service.js:3` - Comment says "Ported from .legacy" ✅ (documentation only)
- `js/widgets/photos/photos.js:2` - Comment says "Ported from .legacy" ✅ (documentation only)

**Status:** ✅ These are SAFE - just documentation of migration history

---

## Migration Plan

### Phase 1: Create New Directory Structure
```
js/
├── data/services/
│   ├── photo-storage-service.js        ⭐ MIGRATE from .legacy/js/supabase/
│   └── supabase/
│       └── supabase-config.js          ⭐ MIGRATE from .legacy/js/supabase/
│
└── modules/Settings/photos/            ⭐ NEW FOLDER
    ├── photos-settings-manager.js      ⭐ MIGRATE from .legacy/widgets/photos/
    ├── photos-settings-modal.js        ⭐ MIGRATE from .legacy/widgets/photos/
    ├── photos-settings.html            ⭐ MIGRATE from .legacy/widgets/photos/
    ├── photos-settings.css             ⭐ MIGRATE from .legacy/widgets/photos/
    ├── overlays/
    │   └── photos-modal-overlays.js    ⭐ MIGRATE from .legacy/widgets/photos/
    └── utils/
        └── photo-file-processor.js     ⭐ MIGRATE from .legacy/widgets/photos/utils/
```

### Phase 2: Update Import Paths

**File:** `js/core/initialization/service-initializer.js`
```diff
- import { PhotosSettingsManager } from '../../../.legacy/widgets/photos/photos-settings-manager.js';
+ import { PhotosSettingsManager } from '../../modules/Settings/photos/photos-settings-manager.js';
```

**File:** `js/data/services/photo-service.js`
```diff
- import { PhotoStorageService } from '../../../.legacy/js/supabase/photo-storage-service.js';
+ import { PhotoStorageService } from './photo-storage-service.js';
```

**File:** `js/data/services/photo-storage-service.js` (after migration)
```diff
- import { supabase } from './supabase-config.js';
+ import { supabase } from './supabase/supabase-config.js';
- import { createLogger } from '../utils/logger.js';
+ import { createLogger } from '../../utils/logger.js';
- import { PhotoFileProcessor } from '../../widgets/photos/utils/photo-file-processor.js';
+ import { PhotoFileProcessor } from '../../modules/Settings/photos/utils/photo-file-processor.js';
```

**File:** `js/modules/Settings/photos/photos-settings-manager.js` (after migration)
```diff
- import { createLogger } from '../../js/utils/logger.js';
+ import { createLogger } from '../../../utils/logger.js';
- iframe.src = '.legacy/widgets/photos/photos-settings.html';
+ iframe.src = '/js/modules/Settings/photos/photos-settings.html';
```

**File:** `js/modules/Settings/photos/photos-settings-modal.js` (after migration)
```diff
- import { createLogger } from '../../js/utils/logger.js';
+ import { createLogger } from '../../../utils/logger.js';
- import { PhotoStorageService } from '../../js/supabase/photo-storage-service.js';
+ import { PhotoStorageService } from '../../../data/services/photo-storage-service.js';
- import { ... } from './photos-modal-overlays.js';
+ import { ... } from './overlays/photos-modal-overlays.js';
```

**File:** `js/modules/Settings/photos/photos-settings.html` (after migration)
```diff
- import { PhotosSettingsModal } from './photos-settings-modal.js';
+ import { PhotosSettingsModal } from '/js/modules/Settings/photos/photos-settings-modal.js';
```

### Phase 3: Verify No Remaining Dependencies

After migration, run:
```bash
grep -rn "\.legacy" js/ --include="*.js" | grep -v "^.*// "
```

**Expected result:** No output (zero dependencies)

---

## Recommendations

### Immediate Action (Tomorrow)
1. ✅ Migrate all 8 files to new locations
2. ✅ Update all import paths
3. ✅ Test photos functionality
4. ✅ Delete migrated files from `.legacy/`

### Optional Refactoring (Can be separate task)
- Extract `photos-settings-modal.js` (816 lines) into smaller modules
- This can be done AFTER migration to avoid mixing concerns

---

## Conclusion

**Current State:** 🔴 2 active imports from `.legacy/`
**Target State:** 🟢 0 imports from `.legacy/`
**Effort Required:** ~2-3 hours for clean migration

**All issues are contained within the photos feature.** No other parts of the new codebase depend on legacy code.
