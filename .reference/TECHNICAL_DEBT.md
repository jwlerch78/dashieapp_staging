# Dashie Technical Debt Backlog

**Last Updated:** October 9, 2025

This document tracks known technical debt, architectural improvements, and refactoring tasks that should be addressed in future development cycles.

---

## 🔴 High Priority (Security/Stability Risk)

### 0. Multi-Provider Authentication Architecture Refactor
**Issue:** Current auth system is tightly coupled to Google and conflates two separate concerns:
- **Layer 1:** Account authentication (how users log into Dashie)
- **Layer 2:** Calendar API authentication (how we access calendar data)

This prevents us from supporting multiple login providers (Amazon, Email/Password) and multiple calendar providers (iCloud, Microsoft).

**Impact:**
- Cannot add non-Google login options
- Cannot support iCloud or Microsoft calendars
- Fire TV users forced into slow device flow instead of native Amazon auth
- Tight coupling makes changes risky

**Proposed Solution:**

**Phase 1: Token Optimization Fixes** (2 days)
- Fix cache not updating after token refresh
- Fix force refresh not invalidating cache
- Fix localStorage not syncing after refresh

**Phase 2: Two-Layer Architecture** (5 days)
- Create base classes for account auth vs calendar auth
- Refactor existing Google code into new structure
- Implement auth-bridge edge function for token exchange
- Maintain 100% backward compatibility

**Phase 3: Additional Calendar Providers** (7 days)
- Apple iCloud Calendar (CalDAV protocol)
- Microsoft Exchange/Outlook (Graph API)
- Multi-provider calendar display

**Phase 4: Additional Account Providers** (4 days)
- Amazon OAuth for account login
- Email/Password via Supabase Auth
- Multi-provider login UI

**Phase 5: Fire TV Native Auth** (2 days)
- Native Amazon auth on Fire TV (5-10 sec vs 60+ sec device flow)
- JavaScript bridge to Android native code

**Effort:** Large (3-4 weeks)
**Documentation:** See `.reference/Multi-Provider Auth Implementation Plan.md`
**Related Code:**
- `js/apis/api-auth/` (entire directory needs refactor)
- `js/apis/google/google-client.js`
- `supabase/functions/` (new auth-bridge function needed)

**Current Status:** Planning complete, awaiting scheduling

### 1. Separate Authentication Tokens from User Settings
**Issue:** OAuth refresh tokens (`tokenAccounts`) are stored in the same `user_settings` table/object as UI preferences (theme, sleep time, etc.). This creates risk where settings changes could accidentally wipe authentication data.

**Impact:** 
- Authentication tokens can be lost during settings operations
- Theme/UI changes shouldn't be able to break auth
- Mixing critical auth data with preferences is architecturally unsound

**Proposed Solution:**
- Create separate `user_auth_tokens` table in database
- Store tokens in dedicated localStorage key (`dashie-auth-tokens`)
- Update edge functions to handle separate token storage
- Migrate existing tokens during deployment

**Effort:** Medium (2-3 days)
**Related Code:**
- `js/settings/settings-controller-core.js`
- `js/apis/api-auth/jwt-token-operations.js`
- `supabase/functions/jwt-auth/index.ts`
- `supabase/functions/database-operations/index.ts`

**Workaround in place:** Lines 255-264 in `settings-controller-core.js` preserve `tokenAccounts` when using default settings.

---

## 🟡 Medium Priority (Code Quality/Maintainability)

### 1. Welcome Wizard D-pad Enter Key Auto-Confirmation Bug
**Issue:** When using d-pad/keyboard navigation on Screen 4 (Weather Setup), pressing Enter on "Share My Location" button triggers geolocation AND auto-confirms the detected location on Screen 4B without giving user time to review.

**Behavior:**
- **With Mouse:** Works correctly - shows location, user can choose Yes/No
- **With D-pad/Keyboard:** Enter key press bubbles through, auto-confirms location immediately

**Root Cause:** Enter keydown event from Screen 4 is either:
1. Bubbling through event handlers despite preventDefault/stopPropagation
2. Being held down during screen transition
3. Creating a timing issue where Screen 4B appears with focused button + lingering Enter event

**Attempted Fixes (None Successful):**
- Added `preventDefault()` and `stopPropagation()` to all location screen Enter handlers
- Added `wizard.ignoreEnterKey` flag with 400ms debounce on Screen 4B
- All fixes work with mouse but fail with d-pad

**Impact:**
- Users can't review detected location when using d-pad
- Violates expected behavior and UX flow
- Makes d-pad navigation feel broken/unreliable

**Related Code:**
- `js/welcome/screens/screen-4-location.js` (Lines 115-130, 354-368)
- Screen 4 handlers (Lines 305-330)
- Screen 4B handlers (Lines 340-368)

**Workaround:** Mouse works fine, only affects d-pad users

**Effort:** Medium (investigate event handling, modal navigation system interaction)
**Priority:** Medium - affects Fire TV users significantly
**Date Added:** October 10, 2025

---

### 2. Settings System Re-Architecture
**Issue:** Settings system has accumulated architectural debt:
- Calendar service bypasses settings controller to read localStorage directly (violates single source of truth)
- Dual widget communication patterns (WidgetMessenger + direct postMessage)
- Complex controller with mixin pattern inheritance (core + features)
- Timeout-based initialization creates race conditions
- No schema validation or type safety
- Local-only vs synced settings not clearly separated

**Impact:**
- Brittle code prone to race conditions
- Hard to add new settings safely
- Widget communication is inconsistent
- Difficult to debug initialization issues
- No validation prevents invalid data

**Proposed Solution (8 Phases):**

**Phase 1: Foundation & Schema** (Week 1)
- Create settings schema with validation
- Add type safety and defaults
- Validate on load/save

**Phase 2: Eliminate Calendar localStorage Coupling** (Week 1-2)
- Create SettingsObserver pattern for services
- Remove CalendarService's direct localStorage access
- Single source of truth through SettingsController

**Phase 3: Consolidate Widget Communication** (Week 2)
- Expand WidgetMessenger for settings broadcasts
- Remove direct postMessage patterns
- Standardize all widget message handling

**Phase 4: Simplify Controller Architecture** (Week 2-3)
- Replace mixin inheritance with composition
- Create focused manager classes:
  - CoreSettingsManager (get/set/save)
  - SyncManager (real-time sync)
  - LocalSettingsManager (device-specific)
  - MigrationManager (version handling)
- Delete old core/features files

**Phase 5: Event-Driven Architecture** (Week 3)
- Create SettingsEvents system
- Decouple components via events
- Better testability and debugging

**Phase 6: Promise-Based Initialization** (Week 3-4)
- Replace timeouts with deterministic flow
- Create InitializationCoordinator
- Clear dependency ordering
- Better error handling

**Phase 7: Settings Migration System** (Week 4)
- Version-based migrations
- Handle schema changes gracefully
- Backward compatibility for old settings

**Phase 8: Testing & Validation** (Ongoing)
- Unit tests (90% coverage)
- Integration tests
- Manual testing checklist

**Effort:** Large (3-4 weeks)
**Documentation:** See `.reference/Settings System Re-Architecture Plan.md`
**Related Code:**
- `js/settings/` (entire directory needs refactor)
- `js/services/calendar-service.js` (remove localStorage access)
- `js/services/widget-messenger.js` (expand capabilities)
- `js/main.js` (initialization refactor)
- All widgets (standardize message handling)

**Benefits:**
- Clearer code structure
- Easier to add new settings
- Better testability
- No more race conditions
- Type safety and validation
- Reliable multi-device sync

**Current Status:** Planning complete, awaiting scheduling

---

### 2. Settings Schema Validation
**Issue:** No type checking or schema validation for settings object. We don't explicitly define required vs optional fields.

**Impact:**
- Easy to accidentally break things by modifying settings structure
- No compile-time safety for settings changes
- Hard to know what fields are critical vs optional

**Proposed Solution:**
- Add schema validation (Zod, JSON Schema, or TypeScript types)
- Validate settings on load/save
- Explicit required/optional/protected field definitions

**Effort:** Small (1 day)

---

### 3. Implicit Data Dependencies
**Issue:** Services have implicit dependencies on specific settings fields:
- JWT service depends on `settings.tokenAccounts`
- Calendar service depends on `settings.calendar`
- Theme system depends on `settings.interface.theme`

None of these dependencies are explicit or enforced.

**Impact:**
- Brittle code that breaks in unexpected ways
- Hard to understand data flow
- Easy to introduce bugs

**Proposed Solution:**
- Document required fields for each service
- Add runtime checks for required dependencies
- Consider dependency injection pattern

**Effort:** Medium (2 days)

---

## 🟢 Low Priority (Nice to Have)

### 1. Offline Mode & Graceful Degradation
**Issue:** Dashboard has no explicit offline handling:
- No visual indication when internet connection is lost
- Calendar events disappear if offline when refresh attempts
- Photos go blank if connection lost during slideshow
- User has no idea if data is stale or current
- No offline-first data strategy

**Impact:**
- Poor user experience during network outages
- Dashboard appears "broken" when it's just offline
- No way to know if displayed data is current
- Calendar becomes useless without internet

**Proposed Solution:**

**Phase 1: Connection Detection & UI**
- Add online/offline event listeners
- Subtle status indicator (corner badge, not intrusive)
- Show "Last updated: X minutes ago" for stale data
- Toast notification on connection change

**Phase 2: Calendar Offline Caching**
- IndexedDB cache for calendar events (7-14 days ahead)
- Cache on every successful fetch
- Serve from cache when offline
- Show "Offline Mode" indicator with last sync time
- Auto-refresh when connection returns

**Phase 3: Photo Offline Caching**
- Cache last 20-50 photos in IndexedDB as blobs
- LRU (Least Recently Used) eviction strategy
- Rotate through cached photos when offline
- Show "Offline - Showing cached photos" message
- Clear indication that not all photos available

**Phase 4: Smart Retry Logic**
- Exponential backoff for failed requests
- Queue failed operations for retry
- Don't spam failed requests during outage
- Batch operations when connection returns

**Phase 5: Service Worker (Optional)**
- Full offline-first architecture
- Background sync for data updates
- Push notifications when back online
- Precache critical assets

**UI/UX Considerations:**
- Subtle, non-alarming indicator (e.g., small icon in corner)
- Don't interrupt user with modals/alerts
- Clear distinction between "offline" vs "error"
- Show last successful update time
- Color coding: green (online), yellow (stale), grey (offline)

**Technical Approach:**
```javascript
// Connection monitoring
window.addEventListener('online', () => {
  showToast('Connection restored', 'success');
  triggerDataRefresh();
});

window.addEventListener('offline', () => {
  showToast('No internet connection', 'warning');
  switchToOfflineMode();
});

// Status indicator
<div class="connection-status" data-status="online">
  <span class="status-dot"></span>
  <span class="status-text">Last updated: 2 min ago</span>
</div>
```

**Data Caching Strategy:**
- Calendar: IndexedDB with 14-day sliding window
- Photos: IndexedDB with size limit (50MB?), LRU eviction
- Settings: Already in localStorage (works offline)
- Theme/UI: Already works offline

**Effort:** Medium (1-2 weeks)
**Priority:** Low but valuable for user experience
**Related Code:**
- `js/services/calendar-service.js` (add cache layer)
- `js/services/photo-data-service.js` (add cache layer)
- `js/services/data-manager.js` (offline detection)
- `js/ui/connection-status.js` (new file)
- `js/utils/offline-cache.js` (new file - IndexedDB wrapper)

**Success Metrics:**
- Calendar works offline for 7+ days
- Photos show cached content instead of blank
- Users know when data is stale
- Auto-recovery when online
- No console errors during offline periods

**Open Questions:**
- How many photos to cache? (storage vs user experience tradeoff)
- Cache all calendars or just primary?
- Show reduced photo set or rotate through cached?
- Clear cache after X days of staleness?

---

### 4. Consolidate Storage Patterns
**Issue:** We have multiple patterns for storing data:
- `dashie-settings` (main settings)
- `dashie-local-settings` (device-specific)
- `dashie-calendar-settings` (calendar cache)
- `dashie-theme` (theme cache)
- `dashie-supabase-jwt` (JWT token)

**Impact:**
- Inconsistent naming (dash vs underscore)
- Hard to track what's stored where
- No clear strategy for localStorage usage

**Proposed Solution:**
- Document all localStorage keys
- Consistent naming convention
- Clear strategy for what goes where

**Effort:** Small (4 hours)

---

### 5. Settings Default Values Strategy
**Issue:** Default values are spread across:
- `getDefaultSettings()` in settings-controller-core
- Fallbacks in individual widgets
- Hardcoded values in various places

**Impact:**
- Hard to know canonical default values
- Inconsistent behavior across components
- Changes require updating multiple places

**Proposed Solution:**
- Single source of truth for defaults
- Typed constants for default values
- Clear documentation of what can be null vs must have default

**Effort:** Small (4 hours)

---

## 📋 Process Improvements

### 6. Settings Change Testing Protocol
**Issue:** Settings changes (like default theme) can have cascading effects that aren't immediately obvious.

**Proposed Solution:**
- Checklist for settings-related changes:
  - [ ] Are tokens preserved?
  - [ ] Are calendar settings preserved?
  - [ ] Test with empty database
  - [ ] Test with existing account
  - [ ] Test with partial settings
  - [ ] Verify localStorage state
  - [ ] Check auth still works after change

**Effort:** Immediate (add to development workflow)

---

## 📝 How to Use This Document

### Adding Items:
```
Ask Claude: "Add to technical debt: [description of issue]"
Claude will add it to the appropriate priority section
```

### Prioritizing:
- 🔴 **High:** Security risks, data loss potential, breaks core functionality
- 🟡 **Medium:** Code quality, maintainability, developer experience
- 🟢 **Low:** Nice-to-haves, optimizations, polish

### When Addressing Items:
1. Move item to a new "## 🚧 In Progress" section
2. Link the PR/commit that addresses it
3. Move to "## ✅ Completed" with completion date
4. Leave in completed section for historical context

---

## 🚧 In Progress

*Nothing currently in progress*

---

## ✅ Completed

*No items completed yet - backlog created October 9, 2025*
