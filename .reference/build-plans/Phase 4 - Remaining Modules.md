# Phase 4: Remaining Modules - Quick Start Guide

**Estimated Time:** 2-3 weeks
**Status:** Ready after Phase 3.5 (Widgets) complete
**Prerequisites:**
- Phase 3 (Data Layer) ✅ COMPLETE
- Phase 3.5 (Widgets) - Complete before starting Phase 4

---

## What You're Building

The remaining UI modules:
- **Settings Module** - Complex modal with multiple pages + **calendar ID management**
- **Login Module** - Authentication UI
- **Modals Module** - Confirmation dialogs (sleep, exit)
- **Welcome Module** - First-run wizard (with D-pad bug fix)

**New in Phase 4:** Account-prefixed calendar ID implementation (deferred from Phase 3)

---

## 🎯 Key Architectural Decision: Calendar IDs

**Deferred from Phase 3:** Account-prefixed calendar ID system will be implemented in Phase 4 alongside the Settings UI.

**Why build it here instead of Phase 3:**
- Settings pages don't exist yet
- Calendar account management UI is part of Settings module
- Build calendar settings WITH prefixed IDs from day 1 (no migration needed)
- Natural fit: multi-account UI + multi-account data model together

**Implementation Details:** See [Settings Module → Calendar Settings Page](#calendar-settings-page-account-prefixed-ids) section below.

---

## Context to Load (Read These Sections)

### 1. ARCHITECTURE.md - Lines 1557-1858
**What to focus on:**
- Settings module architecture (lines 1557-1743)
- Login module structure (lines 1745-1795)
- Modals module structure (lines 1797-1822)
- Welcome module structure (lines 1824-1858)

### 2. API_INTERFACES.md - Lines 870-1021
**What to focus on:**
- Settings module API (lines 870-930)
- Login module API (lines 935-977)
- Modals module API (lines 984-1021)

### 3. PHASE_2_HANDOFF.md - Lines 447-539
**What to focus on:**
- Settings pages structure
- Modular composition pattern
- Welcome wizard D-pad bug fix

---

## Files to Create

```
js/modules/Settings/
├── settings.js                        # Public API
├── settings-input-handler.js          # Settings navigation
├── settings-state-manager.js          # Current page, navigation stack
├── settings-orchestrator.js           # Page transitions
├── settings-store.js                  # Settings persistence
├── settings-broadcast-manager.js      # Widget updates
├── ui/
│   ├── settings-modal-renderer.js       # Settings modal UI
│   └── settings-form-components.js      # Reusable form elements
└── pages/
    ├── settings-family-page.js          # Family settings
    ├── settings-interface-page.js       # UI settings
    ├── settings-calendar-page.js        # Calendar accounts (⚠️ WITH PREFIXED IDs)
    ├── settings-photos-page.js          # Photo settings
    ├── settings-system-page.js          # System settings
    └── settings-account-page.js         # User account

js/data/storage/
└── calendar-settings-manager.js       # ⚠️ NEW - Calendar ID storage with prefixes

js/data/services/
└── calendar-service.js                # ⚠️ UPDATED - Add prefix helper methods

js/modules/Login/
├── login.js                           # Public API
├── login-input-handler.js             # Login navigation
├── login-state-manager.js             # Login state
├── login-ui-renderer.js               # Login UI
└── login-auth-flow-manager.js         # Auth flow orchestration

js/modules/Modals/
├── modals.js                          # Public API
├── modals-input-handler.js            # Modal navigation
├── modals-state-manager.js            # Modal state
├── modals-ui-renderer.js              # Modal UI
└── modals-confirmation.js             # Sleep, exit confirmations

js/modules/Welcome/
├── welcome.js                         # Public API
├── welcome-input-handler.js           # Wizard navigation (with bug fix)
├── welcome-state-manager.js           # Current screen state
├── welcome-ui-renderer.js             # Wizard UI
└── welcome-wizard-controller.js       # Screen flow

css/modules/
├── settings.css                # Settings modal styles
├── login.css                   # Login screen styles
├── modals.css                  # Modal styles
└── welcome.css                 # Welcome wizard styles
```

---

## Implementation Order

### 1. Settings Module (Most Complex)

**Goal:** Full-featured settings modal with multiple pages

**Key Components:**

**Settings Store (Persistence Layer):**
```javascript
// js/modules/Settings/settings-store.js
class SettingsStore {
    constructor() {
        this.settings = null;
    }

    async load() {
        // Load from JWTService (Supabase)
        const jwtService = window.dashieJWT;
        this.settings = await jwtService.loadSettings();
    }

    async save() {
        const jwtService = window.dashieJWT;
        await jwtService.saveSettings(this.settings);
    }

    get(key) {
        return this.settings?.[key];
    }

    set(key, value) {
        if (!this.settings) this.settings = {};
        this.settings[key] = value;
    }
}
```

**Broadcast Manager (Widget Updates):**
```javascript
// js/modules/Settings/settings-broadcast-manager.js
class BroadcastManager {
    static notifySettingsChange(changedSettings) {
        // Update AppStateManager
        if (changedSettings.theme) {
            AppStateManager.setTheme(changedSettings.theme);
        }

        // Broadcast to widgets
        WidgetMessenger.broadcast('config', {
            action: 'settings-update',
            payload: changedSettings
        });

        // Publish event
        AppComms.publish(AppComms.events.SETTINGS_CHANGED, {
            settings: changedSettings
        });
    }
}
```

### Calendar Settings Page (Account-Prefixed IDs)

⚠️ **CRITICAL IMPLEMENTATION:** This is where we implement the account-prefixed calendar ID system deferred from Phase 3.

**Step 1: Update CalendarService with helper methods**

```javascript
// js/data/services/calendar-service.js - ADD THESE METHODS

/**
 * Create account-prefixed calendar ID
 * @param {string} accountType - 'primary', 'account2', etc.
 * @param {string} calendarId - Raw calendar ID from Google API
 * @returns {string} Prefixed ID like 'primary-user@gmail.com'
 */
createPrefixedId(accountType, calendarId) {
    return `${accountType}-${calendarId}`;
}

/**
 * Parse account-prefixed calendar ID
 * @param {string} prefixedId - Like 'primary-user@gmail.com'
 * @returns {{ accountType: string, calendarId: string }}
 */
parsePrefixedId(prefixedId) {
    // Handle edge case: calendar IDs can contain dashes
    const parts = prefixedId.split('-');
    const accountType = parts[0];
    const calendarId = parts.slice(1).join('-');

    return { accountType, calendarId };
}

/**
 * Get calendars with prefixed IDs
 * @param {string} accountType - Account type
 * @returns {Promise<Array>} Calendars with prefixed IDs
 */
async getCalendars(accountType = 'primary') {
    const rawCalendars = await this.googleClient.getCalendarList(accountType);

    // Add prefixed IDs to each calendar
    return rawCalendars.map(cal => ({
        ...cal,
        id: this.createPrefixedId(accountType, cal.id),  // Prefixed ID
        rawId: cal.id,                                    // Original ID
        accountType: accountType                          // Account ownership
    }));
}

/**
 * Get events using prefixed calendar ID
 * @param {string} prefixedCalendarId - Like 'primary-user@gmail.com'
 * @param {object} timeRange - Time range
 * @returns {Promise<Array>} Calendar events
 */
async getEvents(prefixedCalendarId, timeRange = {}) {
    // Parse the prefixed ID
    const { accountType, calendarId } = this.parsePrefixedId(prefixedCalendarId);

    // Fetch events using raw calendar ID
    const events = await this.googleClient.getCalendarEvents(
        calendarId,
        timeRange,
        accountType
    );

    return events;
}
```

**Step 2: Create CalendarSettingsManager**

```javascript
// js/data/storage/calendar-settings-manager.js - NEW FILE

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('CalendarSettingsManager');

/**
 * Manages active calendar IDs with account-prefixed format
 *
 * Format: {accountType}-{calendarId}
 * Examples:
 *   - 'primary-user@gmail.com'
 *   - 'account2-user@gmail.com'
 *   - 'primary-en.usa#holiday@group.v.calendar.google.com'
 */
export class CalendarSettingsManager {
    constructor(edgeClient) {
        if (!edgeClient) {
            throw new Error('EdgeClient is required for CalendarSettingsManager');
        }

        this.edgeClient = edgeClient;
        this.activeCalendarIds = [];
    }

    /**
     * Initialize and load active calendar IDs
     */
    async initialize() {
        logger.info('Initializing CalendarSettingsManager');

        try {
            // Load settings from Supabase/localStorage
            const settings = await this.edgeClient.loadSettings();
            this.activeCalendarIds = settings.activeCalendarIds || [];

            logger.info('Active calendar IDs loaded', {
                count: this.activeCalendarIds.length
            });

        } catch (error) {
            logger.error('Failed to load calendar settings', error);
            this.activeCalendarIds = [];
        }
    }

    /**
     * Enable a calendar
     * @param {string} accountType - Account type
     * @param {string} calendarId - Raw calendar ID
     */
    async enableCalendar(accountType, calendarId) {
        const prefixedId = `${accountType}-${calendarId}`;

        if (!this.activeCalendarIds.includes(prefixedId)) {
            this.activeCalendarIds.push(prefixedId);
            await this.save();

            logger.info('Calendar enabled', { prefixedId });
        }
    }

    /**
     * Disable a calendar
     * @param {string} accountType - Account type
     * @param {string} calendarId - Raw calendar ID
     */
    async disableCalendar(accountType, calendarId) {
        const prefixedId = `${accountType}-${calendarId}`;
        const originalLength = this.activeCalendarIds.length;

        this.activeCalendarIds = this.activeCalendarIds.filter(id => id !== prefixedId);

        if (this.activeCalendarIds.length !== originalLength) {
            await this.save();
            logger.info('Calendar disabled', { prefixedId });
        }
    }

    /**
     * Remove ALL calendars from an account
     * (When user disconnects account)
     * @param {string} accountType - Account type to remove
     */
    async removeAccountCalendars(accountType) {
        const prefix = `${accountType}-`;
        const originalLength = this.activeCalendarIds.length;

        this.activeCalendarIds = this.activeCalendarIds.filter(
            id => !id.startsWith(prefix)
        );

        const removed = originalLength - this.activeCalendarIds.length;

        if (removed > 0) {
            await this.save();
            logger.info('Account calendars removed', {
                accountType,
                removedCount: removed
            });
        }
    }

    /**
     * Get active calendars for an account
     * @param {string} accountType - Account type
     * @returns {Array<string>} Prefixed calendar IDs for this account
     */
    getActiveCalendarsForAccount(accountType) {
        const prefix = `${accountType}-`;
        return this.activeCalendarIds.filter(id => id.startsWith(prefix));
    }

    /**
     * Get all active calendar IDs
     * @returns {Array<string>} All active prefixed calendar IDs
     */
    getAllActiveCalendars() {
        return [...this.activeCalendarIds];
    }

    /**
     * Check if a calendar is active
     * @param {string} accountType - Account type
     * @param {string} calendarId - Raw calendar ID
     * @returns {boolean}
     */
    isCalendarActive(accountType, calendarId) {
        const prefixedId = `${accountType}-${calendarId}`;
        return this.activeCalendarIds.includes(prefixedId);
    }

    /**
     * Save active calendar IDs to storage
     */
    async save() {
        try {
            const settings = {
                activeCalendarIds: this.activeCalendarIds
            };

            await this.edgeClient.saveSettings(settings);

            logger.debug('Calendar settings saved', {
                count: this.activeCalendarIds.length
            });

        } catch (error) {
            logger.error('Failed to save calendar settings', error);
            throw error;
        }
    }
}

// Export singleton
let calendarSettingsInstance = null;

export function initializeCalendarSettings(edgeClient) {
    if (!calendarSettingsInstance) {
        calendarSettingsInstance = new CalendarSettingsManager(edgeClient);
    }
    return calendarSettingsInstance;
}

export function getCalendarSettings() {
    if (!calendarSettingsInstance) {
        throw new Error('CalendarSettingsManager not initialized');
    }
    return calendarSettingsInstance;
}
```

**Step 3: Calendar Settings Page UI**

```javascript
// js/modules/Settings/pages/settings-calendar-page.js
class CalendarPage {
    constructor() {
        this.calendarService = null;
        this.calendarSettings = null;
    }

    async initialize() {
        this.calendarService = window.sessionManager.calendarService;
        this.calendarSettings = window.calendarSettings;
    }

    async render() {
        // Get connected accounts (from TokenStore)
        const accounts = await this.getConnectedAccounts();

        let html = '<div class="settings-calendar">';

        // For each account, show calendars with enable/disable toggles
        for (const account of accounts) {
            html += `<div class="settings-calendar__account">`;
            html += `<h3>${account.name} (${account.type})</h3>`;

            // Fetch calendars with prefixed IDs
            const calendars = await this.calendarService.getCalendars(account.type);

            for (const cal of calendars) {
                const isActive = this.calendarSettings.isCalendarActive(
                    account.type,
                    cal.rawId
                );

                html += `
                    <div class="settings-calendar__item">
                        <label>
                            <input
                                type="checkbox"
                                ${isActive ? 'checked' : ''}
                                data-prefixed-id="${cal.id}"
                                data-account-type="${account.type}"
                                data-calendar-id="${cal.rawId}"
                            >
                            <span class="calendar-name">${cal.summary}</span>
                        </label>
                    </div>
                `;
            }

            // Remove account button
            html += `
                <button
                    class="settings-calendar__remove-account"
                    data-account-type="${account.type}"
                >
                    Remove ${account.name}
                </button>
            `;

            html += `</div>`;
        }

        html += '</div>';

        return html;
    }

    async toggleCalendar(accountType, calendarId, enabled) {
        if (enabled) {
            await this.calendarSettings.enableCalendar(accountType, calendarId);
        } else {
            await this.calendarSettings.disableCalendar(accountType, calendarId);
        }

        // Notify widgets of calendar change
        this.notifyCalendarChange();
    }

    async removeAccount(accountType) {
        // Remove all calendars from this account
        await this.calendarSettings.removeAccountCalendars(accountType);

        // Remove tokens
        const tokenStore = window.sessionManager.tokenStore;
        await tokenStore.removeAccountTokens('google', accountType);

        // Refresh UI
        await this.render();

        // Notify widgets
        this.notifyCalendarChange();
    }

    notifyCalendarChange() {
        // Broadcast to widgets
        WidgetMessenger.broadcast('config', {
            action: 'calendars-changed',
            activeCalendarIds: this.calendarSettings.getAllActiveCalendars()
        });
    }

    async getConnectedAccounts() {
        // Get all connected Google accounts from TokenStore
        const tokenStore = window.sessionManager.tokenStore;
        const allTokens = await tokenStore.getAllTokens();

        const accounts = [];
        for (const [key, tokenData] of Object.entries(allTokens)) {
            if (key.startsWith('google/')) {
                const accountType = key.split('/')[1];
                accounts.push({
                    type: accountType,
                    name: tokenData.email || accountType,
                    email: tokenData.email
                });
            }
        }

        return accounts;
    }
}
```

**Success criteria:**
- [ ] Settings modal opens and closes
- [ ] Page navigation works
- [ ] Settings persist to Supabase
- [ ] Widget updates broadcast
- [ ] ⚠️ **Calendar page uses prefixed IDs (account-calendar format)**
- [ ] ⚠️ **CalendarSettingsManager stores/loads prefixed IDs**
- [ ] ⚠️ **Account removal cleans up all account calendars**
- [ ] ⚠️ **Shared calendars work across multiple accounts**
- [ ] ⚠️ **Calendar widget receives prefixed IDs**

---

### 2. Login Module

**Goal:** Authentication UI for all platforms (TV, Desktop, Mobile)

**Key Components:**

**Login UI (Platform Detection):**
```javascript
// js/modules/Login/login-ui-renderer.js
class LoginUIRenderer {
    static render() {
        const platform = AppStateManager.getPlatform();

        if (platform === 'tv') {
            this.renderDeviceFlow(); // QR code + device code
        } else if (platform === 'mobile') {
            this.renderNativeOAuth(); // Native Android OAuth
        } else {
            this.renderWebOAuth(); // Web OAuth popup
        }
    }

    static renderDeviceFlow() {
        // Show QR code + 6-digit code
        // User scans QR or visits URL and enters code
    }

    static renderWebOAuth() {
        // Show "Sign in with Google" button
        // Opens OAuth popup
    }

    static renderNativeOAuth() {
        // Use Android native OAuth
    }
}
```

**Auth Flow Manager:**
```javascript
// js/modules/Login/login-auth-flow-manager.js
class AuthFlowManager {
    static async startSignIn() {
        const sessionManager = window.dashieAuth;
        const result = await sessionManager.signIn();

        if (result.success) {
            // Transition to dashboard
            AppStateManager.setCurrentModule('dashboard');
        }
    }
}
```

**Success criteria:**
- [ ] Login screen renders
- [ ] Platform detection works
- [ ] Device flow works on TV
- [ ] Web OAuth works on desktop
- [ ] Native OAuth works on Android
- [ ] Successful login transitions to dashboard

---

### 3. Modals Module

**Goal:** Simple confirmation modals (sleep, exit)

**Key Components:**

**Modal Renderer:**
```javascript
// js/modules/Modals/modals-ui-renderer.js
class ModalUIRenderer {
    static renderConfirmation(config) {
        const html = `
            <div class="modal">
                <div class="modal__content">
                    <div class="modal__icon">${config.icon}</div>
                    <div class="modal__message">${config.message}</div>
                    <div class="modal__actions">
                        <button class="modal__button modal__button--confirm" data-focused="true">
                            ${config.confirmText}
                        </button>
                        <button class="modal__button modal__button--cancel">
                            ${config.cancelText}
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
    }
}
```

**Input Handler (2-button focus):**
```javascript
// js/modules/Modals/modals-input-handler.js
class ModalsInputHandler {
    static currentButton = 0; // 0 = confirm, 1 = cancel

    static handleLeft() {
        this.currentButton = 0;
        this.updateFocus();
        return true;
    }

    static handleRight() {
        this.currentButton = 1;
        this.updateFocus();
        return true;
    }

    static handleEnter() {
        if (this.currentButton === 0) {
            this.confirmAction();
        } else {
            this.cancelAction();
        }
        return true;
    }
}
```

**Success criteria:**
- [ ] Sleep confirmation modal works
- [ ] Exit confirmation modal works
- [ ] Left/right arrow toggles focus
- [ ] Enter executes action
- [ ] Escape cancels modal

---

### 4. Welcome Module (with D-pad Bug Fix)

**Goal:** First-run wizard (4 screens) with proper event handling

**The Bug:**
On Screen 4 (location services), pressing Enter to continue triggers the button on the next screen.

**The Fix:**
```javascript
// js/modules/Welcome/welcome-input-handler.js
class WelcomeInputHandler {
    static transitioning = false;

    static async handleEnter() {
        if (this.transitioning) {
            logger.debug('Ignoring Enter - transition in progress');
            return true; // ✅ Block Enter during transition
        }

        this.transitioning = true;

        // Execute current screen action
        await this.currentScreen.onEnter();

        // Move to next screen
        await this.nextScreen();

        // Re-enable after transition complete
        setTimeout(() => {
            this.transitioning = false;
        }, 300); // ✅ Delay matches screen transition time

        return true;
    }
}
```

**Welcome UI (Screen Transitions):**
```javascript
// js/modules/Welcome/welcome-ui-renderer.js
class WelcomeUIRenderer {
    static async showScreen(screenIndex) {
        const screens = document.querySelectorAll('.welcome__screen');

        // Hide current
        screens.forEach(s => s.classList.remove('welcome__screen--active'));

        // Show new
        screens[screenIndex].classList.add('welcome__screen--active');

        // ✅ Disable buttons during transition
        const buttons = screens[screenIndex].querySelectorAll('button');
        buttons.forEach(btn => btn.classList.add('welcome__button--transitioning'));

        // Re-enable after transition
        setTimeout(() => {
            buttons.forEach(btn => btn.classList.remove('welcome__button--transitioning'));
        }, 300);
    }
}
```

**CSS to support fix:**
```css
/* css/modules/welcome.css */
.welcome__button--transitioning {
    pointer-events: none;
    opacity: 0.7;
}
```

**Success criteria:**
- [ ] 4 welcome screens render
- [ ] Navigation between screens works
- [ ] D-pad bug fixed (no double Enter)
- [ ] Screen transitions smooth
- [ ] Final screen completes wizard

---

## Testing Checklist

### Settings Module
- [ ] Settings modal opens
- [ ] All 6 pages accessible
- [ ] Form inputs work with D-pad
- [ ] Settings save to Supabase
- [ ] Widget updates broadcast
- [ ] Calendar page shows all accounts
- [ ] Account removal works
- [ ] ⚠️ **Prefixed calendar IDs work (test with 2+ accounts)**
- [ ] ⚠️ **Shared calendar appears in both accounts**
- [ ] ⚠️ **Enabling calendar in account A doesn't affect account B**
- [ ] ⚠️ **Removing account removes only its calendars**

### Login Module
- [ ] Correct auth method for platform
- [ ] Device flow works (TV)
- [ ] Web OAuth works (Desktop)
- [ ] Native OAuth works (Android)
- [ ] Successful login transitions

### Modals Module
- [ ] Sleep confirmation shows
- [ ] Exit confirmation shows
- [ ] Button focus toggles
- [ ] Confirm action executes
- [ ] Cancel action works
- [ ] Escape closes modal

### Welcome Module
- [ ] All 4 screens render
- [ ] Screen navigation works
- [ ] D-pad bug fixed
- [ ] Location services screen works
- [ ] Final screen completes

---

## Success Criteria

### Phase 4 Complete When:
- [ ] Settings module working
- [ ] Login module working
- [ ] Modals module working
- [ ] Welcome module working
- [ ] All modules registered with ActionRouter
- [ ] All modules use standard interface
- [ ] D-pad navigation works in all modules
- [ ] Welcome wizard D-pad bug fixed
- [ ] All CSS uses BEM naming
- [ ] Zero console errors

---

## Next Steps

When Phase 4 is complete, move to:
**Phase 5: Refactoring** (Code cleanup, optimization)

See: `.reference/build-plans/Phase 5 - Refactoring.md`

---

**Four modules, clean architecture. You've got this!** ⚙️
