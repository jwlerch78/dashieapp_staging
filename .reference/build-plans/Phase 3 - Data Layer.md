# Phase 3: Data Layer - Quick Start Guide

**Estimated Time:** 1-2 days
**Status:** Ready after Phase 2 complete
**Prerequisites:** Phase 2 (Dashboard Module) complete

---

## What You're Building

The **data infrastructure** that powers the app:
- **Authentication system** (Google OAuth, Supabase)
- **JWT service** (token management, settings sync)
- **Data services** (Calendar, Photos, Telemetry)
- **High-priority technical debt fixes**:
  - Multi-provider auth architecture (2-layer design)
  - Separate auth tokens from settings (security fix)
  - Account-prefixed calendar IDs (shared calendar support)

---

## Context to Load (Read These Sections)

### 1. PHASE_2_HANDOFF.md - Lines 540-639
**What to focus on:**
- Auth system overview
- JWT service role
- High-priority technical debt fixes

### 2. API_INTERFACES.md - Lines 1027-1462
**What to focus on:**
- SessionManager interface (lines 1030-1071)
- JWTService interface (lines 1085-1159)
- TokenStore interface (lines 1173-1219)
- BaseAccountAuth interface (lines 1225-1273)
- BaseCalendarAuth interface (lines 1278-1335)
- CalendarService interface (lines 1342-1442)
- PhotoService interface (lines 1466-1518)

### 3. BUILD_STRATEGY.md - Lines 86-156
**What to focus on:**
- Multi-provider auth architecture (lines 86-108)
- Separate auth tokens from settings (lines 111-128)
- Shared calendar identification (lines 131-156)

---

## Files to Create

```
js/data/auth/
├── session-manager.js          # Auth orchestration
├── auth-coordinator.js         # (copy from legacy)
├── account-manager.js          # (copy from legacy)
├── token-store.js              # NEW: Separate token storage
├── account-auth/               # NEW: Layer 1 (user login)
│   ├── base-account-auth.js    # Base class
│   └── google-account-auth.js  # Google implementation
├── calendar-auth/              # NEW: Layer 2 (calendar access)
│   ├── base-calendar-auth.js   # Base class
│   └── google-calendar-auth.js # Google implementation
├── jwt/
│   ├── jwt-storage.js
│   ├── token-cache.js
│   ├── edge-client.js
│   ├── jwt-manager.js
│   ├── settings-integration.js
│   └── jwt.js
└── providers/
    ├── device-flow.js          # (copy from legacy)
    ├── web-oauth.js            # (copy from legacy)
    └── native-android.js       # (copy from legacy)

js/data/services/
├── calendar-service.js         # UPDATED: Account-prefixed IDs
├── photo-service.js            # (copy from legacy)
├── telemetry-service.js        # (copy from legacy)
└── google/
    └── google-client.js        # (copy from legacy)

js/data/
└── data-cache.js               # (copy from legacy)

js/core/initialization/
├── auth-initializer.js         # NEW: Auth setup
├── jwt-initializer.js          # NEW: JWT setup
└── service-initializer.js      # NEW: Services setup
```

---

## Legacy Code Reference

1. **`.legacy/js/auth/simple-auth.js`** - Lines 1-200
   - Session management patterns
   - Auth state handling

2. **`.legacy/js/apis/api-auth/auth-coordinator.js`** - Lines 1-300
   - Auth provider orchestration
   - Platform detection for auth method

3. **`.legacy/js/services/calendar-service.js`** - Lines 1-500
   - Calendar data fetching patterns
   - **Note:** Will be updated with account-prefixed IDs

4. **`.legacy/js/services/photo-data-service.js`** - Lines 1-200
   - Photo storage patterns

---

## Implementation Steps

### Step 1: Multi-Provider Auth Architecture (High Priority)

**Goal:** Create 2-layer auth architecture for future multi-provider support

**Layer 1: Account Auth (How users log into Dashie)**
```javascript
// js/data/auth/account-auth/base-account-auth.js
export class BaseAccountAuth {
    getProviderName() { return 'unknown'; }
    async initialize() {}
    async signIn() { return { user }; }
    async signOut() {}
    isAuthenticated() { return false; }
    getUser() { return null; }
    async refresh() {}
}

// js/data/auth/account-auth/google-account-auth.js
import { BaseAccountAuth } from './base-account-auth.js';

export class GoogleAccountAuth extends BaseAccountAuth {
    getProviderName() { return 'google'; }

    async signIn() {
        // Use existing Google OAuth flow from legacy
        // Return: { user: { id, email, name, provider: 'google' } }
    }
}
```

**Layer 2: Calendar Auth (How users connect calendar accounts)**
```javascript
// js/data/auth/calendar-auth/base-calendar-auth.js
export class BaseCalendarAuth {
    getProviderName() { return 'unknown'; }
    async initialize() {}
    async connectAccount(accountType) { return { tokenData }; }
    async disconnectAccount(accountType) {}
    async getCalendarList(accountType) { return []; }
    async getCalendarEvents(calendarId, timeRange, accountType) { return []; }
    async refreshToken(accountType) { return { tokenData }; }
}

// js/data/auth/calendar-auth/google-calendar-auth.js
import { BaseCalendarAuth } from './base-calendar-auth.js';

export class GoogleCalendarAuth extends BaseCalendarAuth {
    getProviderName() { return 'google-calendar'; }

    async connectAccount(accountType) {
        // OAuth flow for calendar access
        // Store token via TokenStore
        // Return: { access_token, expires_at, scopes }
    }

    async getCalendarList(accountType) {
        // Get token from TokenStore
        // Call Google Calendar API
        // Return: [{ id, summary, backgroundColor, ... }]
    }
}
```

**Success criteria:**
- [ ] BaseAccountAuth and BaseCalendarAuth classes created
- [ ] GoogleAccountAuth refactored from legacy
- [ ] GoogleCalendarAuth refactored from legacy
- [ ] Clear separation between user auth and calendar auth
- [ ] Foundation for adding Amazon, iCloud, Outlook later

---

### Step 2: Separate Auth Tokens from Settings (High Priority)

**Goal:** Security improvement - prevent settings operations from wiping auth tokens

**Create TokenStore:**
```javascript
// js/data/auth/token-store.js
export class TokenStore {
    constructor() {
        this.STORAGE_KEY = 'dashie-auth-tokens'; // Separate from settings
        this.tokens = null;
    }

    async initialize() {
        await this.loadTokens();
    }

    async loadTokens() {
        // Load from localStorage (for now)
        // TODO: Later migrate to Supabase user_auth_tokens table
        const stored = localStorage.getItem(this.STORAGE_KEY);
        this.tokens = stored ? JSON.parse(stored) : {};
    }

    async storeAccountTokens(accountType, tokenData) {
        this.tokens[accountType] = {
            access_token: tokenData.access_token,
            expires_at: tokenData.expires_at,
            scopes: tokenData.scopes,
            updated_at: new Date().toISOString()
        };
        await this.save();
    }

    async getAccountTokens(accountType) {
        return this.tokens[accountType] || null;
    }

    async removeAccountTokens(accountType) {
        delete this.tokens[accountType];
        await this.save();
    }

    async getAllTokens() {
        return { ...this.tokens };
    }

    async clearAllTokens() {
        this.tokens = {};
        await this.save();
    }

    async save() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.tokens));
        // TODO: Later also sync to Supabase user_auth_tokens table
    }
}
```

**Update JWTService settings-integration.js:**
```javascript
// Ensure settings DO NOT include auth tokens
async loadSettings() {
    const settings = await this.fetchFromSupabase();

    // ✅ Settings should NOT contain tokenAccounts
    // ✅ Tokens stored separately in TokenStore

    return {
        theme: settings.theme,
        activeCalendarIds: settings.activeCalendarIds,
        // ... other settings, but NO tokens
    };
}

async saveSettings(settings) {
    // ✅ Only save settings, never tokens
    const safeSettings = { ...settings };
    delete safeSettings.tokenAccounts; // Remove if accidentally included

    await this.sendToSupabase(safeSettings);
}
```

**Migration script:**
```javascript
// One-time migration from old settings to new TokenStore
async function migrateTokensFromSettings() {
    const oldSettings = localStorage.getItem('dashie-settings');
    if (!oldSettings) return;

    const parsed = JSON.parse(oldSettings);
    if (!parsed.tokenAccounts) return;

    const tokenStore = new TokenStore();
    await tokenStore.initialize();

    // Migrate each account's tokens
    for (const [accountType, tokenData] of Object.entries(parsed.tokenAccounts)) {
        await tokenStore.storeAccountTokens(accountType, tokenData);
    }

    // Remove tokens from settings
    delete parsed.tokenAccounts;
    localStorage.setItem('dashie-settings', JSON.stringify(parsed));

    console.log('✅ Migrated auth tokens to separate storage');
}
```

**Success criteria:**
- [ ] TokenStore class created
- [ ] Tokens stored in separate localStorage key
- [ ] Settings operations never touch tokens
- [ ] Migration script tested
- [ ] No more `tokenAccounts` in settings

---

### Step 3: Account-Prefixed Calendar IDs (High Priority)

**Goal:** Support shared calendars across multiple accounts

**Update CalendarService:**
```javascript
// js/data/services/calendar-service.js

class CalendarService {
    // NEW: Create prefixed ID
    createPrefixedId(accountType, calendarId) {
        return `${accountType}-${calendarId}`;
        // Examples:
        // 'primary-user@gmail.com'
        // 'account2-shared@gmail.com'
    }

    // NEW: Parse prefixed ID
    parsePrefixedId(prefixedId) {
        const [accountType, ...calendarIdParts] = prefixedId.split('-');
        return {
            accountType,
            calendarId: calendarIdParts.join('-') // Handle IDs with dashes
        };
    }

    async getCalendarList(accountType = 'primary') {
        // Get calendars for specific account
        const calendarAuth = this.getCalendarAuthProvider();
        const rawCalendars = await calendarAuth.getCalendarList(accountType);

        // Add prefixed IDs
        return rawCalendars.map(cal => ({
            ...cal,
            id: this.createPrefixedId(accountType, cal.id),
            rawId: cal.id,
            accountType
        }));
    }

    async getCalendarEvents(prefixedCalendarId, timeRange) {
        // Parse prefixed ID
        const { accountType, calendarId } = this.parsePrefixedId(prefixedCalendarId);

        // Get events using raw calendar ID
        const calendarAuth = this.getCalendarAuthProvider();
        return await calendarAuth.getCalendarEvents(calendarId, timeRange, accountType);
    }

    async enableCalendar(calendarId, accountType) {
        const prefixedId = this.createPrefixedId(accountType, calendarId);

        // Get current active calendars
        const activeIds = await this.getActiveCalendarIds();

        // Add if not already active
        if (!activeIds.includes(prefixedId)) {
            activeIds.push(prefixedId);
            await this.setActiveCalendarIds(activeIds);
        }
    }

    async disableCalendar(calendarId, accountType) {
        const prefixedId = this.createPrefixedId(accountType, calendarId);

        const activeIds = await this.getActiveCalendarIds();
        const filtered = activeIds.filter(id => id !== prefixedId);
        await this.setActiveCalendarIds(filtered);
    }

    async removeAccountCalendars(accountType) {
        // Remove ALL calendars from this account
        const activeIds = await this.getActiveCalendarIds();
        const filtered = activeIds.filter(id => !id.startsWith(`${accountType}-`));
        await this.setActiveCalendarIds(filtered);
    }

    async migrateCalendarIds(oldIds) {
        // Migrate old non-prefixed IDs to prefixed format
        // Assume all old IDs are from 'primary' account
        return oldIds.map(id => {
            if (id.includes('-')) return id; // Already prefixed
            return this.createPrefixedId('primary', id);
        });
    }
}
```

**Success criteria:**
- [ ] Calendar IDs use `{accountType}-{calendarId}` format
- [ ] `enableCalendar()` and `disableCalendar()` use prefixed IDs
- [ ] `removeAccountCalendars()` cleanly removes by account
- [ ] Migration function tested with old IDs
- [ ] Shared calendars work across multiple accounts

---

### Step 4: Build JWT Service

**Follow the refactoring plan** from existing Phase 1:

**Build in order:**
1. `jwt-storage.js` - localStorage abstraction
2. `token-cache.js` - In-memory token cache (with fixes)
3. `edge-client.js` - Supabase edge function client
4. `jwt-manager.js` - Main JWT orchestration
5. `settings-integration.js` - Settings sync (updated to exclude tokens)
6. `jwt.js` - Public API

**Token cache fixes (from technical debt):**
- Fix: Cache not updating after refresh
- Fix: Force refresh not invalidating cache
- Fix: localStorage sync after refresh

**Success criteria:**
- [ ] JWT service initializes
- [ ] Tokens refresh automatically
- [ ] Settings sync works (without tokens)
- [ ] Token cache properly invalidates
- [ ] Edge functions work

---

### Step 5: Copy and Update Services

**Copy these files from legacy:**
1. CalendarService (with updates for prefixed IDs)
2. PhotoService (minimal changes)
3. TelemetryService (minimal changes)
4. DataCache (no changes needed)

**Update imports** to match new paths.

**Create service-initializer.js:**
```javascript
// js/core/initialization/service-initializer.js
import CalendarService from '../../data/services/calendar-service.js';
import PhotoService from '../../data/services/photo-service.js';
import TelemetryService from '../../data/services/telemetry-service.js';

export async function initializeServices() {
    logger.info('📊 Initializing data services...');

    await CalendarService.initialize();
    await PhotoService.initialize();
    await TelemetryService.initialize();

    logger.info('✅ Data services initialized');
}
```

**Success criteria:**
- [ ] All services initialize without errors
- [ ] Calendar service uses prefixed IDs
- [ ] Photo service loads data
- [ ] Telemetry service connects

---

### Step 6: Update main.js

**Add initialization sequence:**
```javascript
// main.js
import { initializeAuth } from './js/core/initialization/auth-initializer.js';
import { initializeJWT } from './js/core/initialization/jwt-initializer.js';
import { initializeServices } from './js/core/initialization/service-initializer.js';

async function initializeApp() {
    // ... existing core initialization ...

    // Auth
    const isAuthenticated = await initializeAuth();


    if (!isAuthenticated) {
        // Show login screen (Phase 4)
        logger.info('Not authenticated - would show login');
        return;
    }

    // JWT
    await initializeJWT();

    // Services
    await initializeServices();

    // Dashboard
    await Dashboard.initialize();
    Dashboard.activate();

    logger.success('✅ App ready');
}
```

**Success criteria:**
- [ ] Auth initializes first
- [ ] JWT initializes if authenticated
- [ ] Services initialize after JWT
- [ ] Dashboard loads with data access

---

## Testing Checklist

### Auth System
- [ ] Google OAuth flow works
- [ ] Session persists on refresh
- [ ] Sign out clears session
- [ ] Auth state propagates to AppStateManager

### JWT Service
- [ ] JWT token obtained
- [ ] Token refreshes automatically
- [ ] Settings load from Supabase
- [ ] Settings save to Supabase
- [ ] Token cache invalidates properly

### Token Storage
- [ ] Tokens stored separately from settings
- [ ] Settings operations don't affect tokens
- [ ] Migration from old settings works
- [ ] Multiple account tokens stored

### Calendar Service
- [ ] Calendar list loads with prefixed IDs
- [ ] Events load for prefixed calendar IDs
- [ ] Enable/disable calendar works
- [ ] Remove account calendars works
- [ ] Shared calendars across accounts work

### Photo Service
- [ ] Photo list loads
- [ ] Photo upload works
- [ ] Photo URLs resolve

---

## Common Pitfalls to Avoid

### 1. Don't Mix Auth Tokens and Settings
❌ **Wrong:** Store tokens in settings object
✅ **Right:** Use separate TokenStore

### 2. Don't Forget to Prefix Calendar IDs
❌ **Wrong:** Use raw calendar IDs from API
✅ **Right:** Always use `{accountType}-{calendarId}`

### 3. Don't Skip Migration
❌ **Wrong:** Assume all users start fresh
✅ **Right:** Provide migration for existing users

### 4. Don't Hardcode 'primary' Account
❌ **Wrong:** Assume only one account
✅ **Right:** Support multiple accounts from day 1

---

## Success Criteria

### Phase 3 Complete When:
- [ ] Auth system works (Google OAuth)
- [ ] JWT service functioning
- [ ] Settings sync working (without tokens)
- [ ] TokenStore implemented and tested
- [ ] Two-layer auth architecture in place
- [ ] Account-prefixed calendar IDs working
- [ ] Calendar service updated
- [ ] Photo service working
- [ ] Telemetry service working
- [ ] All services integrated with auth
- [ ] No token/settings mixing
- [ ] Migration tested

---

## Next Steps

When Phase 3 is complete, move to:
**Phase 4: Remaining Modules** (Settings, Login, Modals, Welcome)

See: `.reference/build-plans/Phase 4 - Remaining Modules.md`

---

**This phase is critical - get auth and data right, and everything else becomes easier.** 🔐
