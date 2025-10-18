# Phase 4: Calendar, Agenda, Login, Settings & Modals

**Estimated Time:** 3-4 weeks
**Status:** Ready to start
**Prerequisites:**
- Phase 3 (Data Layer) ✅ COMPLETE
- Phase 3.5 (Widgets) - Partial (Clock and Header widgets exist)

---

## Overview

Phase 4 focuses on:
1. **Code Organization** - Extract index.html inline code, create Login module
2. **Settings Infrastructure** - Verify and complete settings persistence
3. **Calendar System** - Complete calendar service with account-prefixed IDs
4. **Widget Implementation** - Migrate Calendar and Agenda widgets from legacy
5. **Account Management** - Build account settings with delete functionality
6. **Testing** - Verify all systems work together

---

## Table of Contents

- [4.1: Extract index.html & Create Login Module](#41-extract-indexhtml--create-login-module)
- [4.2: Verify Settings Service](#42-verify-settings-service)
- [4.3: Calendar Data & Settings System](#43-calendar-data--settings-system)
- [4.4: Test Calendar Settings with Multi-Accounts](#44-test-calendar-settings-with-multi-accounts)
- [4.5: Calendar Widget Migration](#45-calendar-widget-migration)
- [4.6: Widget Lifecycle & System Verification](#46-widget-lifecycle--system-verification)
- [4.7: Test Modals - Logout Screen](#47-test-modals---logout-screen)
- [4.8: Agenda Widget Migration](#48-agenda-widget-migration)
- [4.9: Account Settings & Delete Account](#49-account-settings--delete-account)
- [4.10: Token Storage & Refresh Testing](#410-token-storage--refresh-testing)

---

## 4.1: Extract index.html & Create Login Module

**Goal:** Clean up index.html by extracting all inline JavaScript and CSS into proper modules.

**Current Problem:**
- [index.html](../../index.html) is 875 lines with 450+ lines of inline JavaScript (414-872)
- 325 lines of inline CSS (20-364)
- Violates separation of concerns
- Hard to test and maintain

### Step 1: Extract Inline CSS (1-2 days)

**Create new CSS files:**

```
css/
├── core/
│   ├── base.css           # NEW - Base element styles
│   └── utilities.css      # NEW - Utility classes
│
├── components/
│   └── button.css         # NEW - Button component styles
│
└── modules/
    └── login.css          # NEW - OAuth login screen styles
```

**Migration tasks:**

1. **Create css/modules/login.css** - Move OAuth login styles from index.html:37-406
   ```css
   /* OAuth Login Screen */
   #oauth-login-screen { }
   .sign-in-modal { }
   .dashie-logo-signin { }
   .sign-in-header h2 { }
   .signin-button { }
   /* ... all login styles */
   ```

2. **Create css/components/button.css** - Extract reusable button styles
   ```css
   .signin-button { }
   .signin-button--primary { }
   .signin-button--secondary { }
   .signin-button:focus { } /* D-pad focus */
   ```

3. **Create css/core/base.css** - Base HTML element styles
   ```css
   * { margin: 0; padding: 0; box-sizing: border-box; }
   body { font-family: ...; background: ...; }
   ```

4. **Create css/core/utilities.css** - Utility classes
   ```css
   .hidden { display: none !important; }
   .visible { opacity: 1; }
   .spinner { /* ... */ }
   ```

5. **Update index.html** - Replace inline styles with CSS file links
   ```html
   <head>
     <!-- Core CSS -->
     <link rel="stylesheet" href="./css/core/base.css">
     <link rel="stylesheet" href="./css/core/variables.css">
     <link rel="stylesheet" href="./css/core/utilities.css">

     <!-- Component CSS -->
     <link rel="stylesheet" href="./css/components/button.css">

     <!-- Module CSS -->
     <link rel="stylesheet" href="./css/modules/login.css">
     <link rel="stylesheet" href="./css/modules/dashboard.css">
     <link rel="stylesheet" href="./css/modules/settings.css">
     <link rel="stylesheet" href="./css/modules/modals.css">
   </head>
   ```

**Testing:**
- [ ] Login screen looks identical to before
- [ ] All buttons have correct focus states
- [ ] Spinner animation works
- [ ] Modal styling intact
- [ ] Fire TV compatibility maintained

---

### Step 2: Fix Focus Overlay Bugs (1 day)

**Current Problem:**
- Recent commits mention "focus overlay problem" and "debugging focus overlay"
- Overlay may not show/hide correctly when widget focused/defocused

**Location:** [dashboard-visual-effects.js](../../js/modules/Dashboard/dashboard-visual-effects.js)

**Tasks:**

1. **Review focus overlay implementation**
   ```javascript
   // Check focusWidget() and defocusWidget() methods
   // Verify overlay creation, positioning, and removal
   ```

2. **Test scenarios:**
   - Widget focuses → overlay appears correctly
   - Widget defocuses → overlay disappears
   - Click overlay → widget defocuses
   - Multiple rapid focus changes → no overlay stuck

3. **Common bugs to fix:**
   - Overlay not removed when widget defocused
   - Overlay z-index wrong
   - Overlay click handler not working
   - Overlay positioning incorrect on scaled widgets

**Testing:**
- [ ] Focus any widget → overlay appears
- [ ] Defocus widget → overlay disappears
- [ ] Click overlay → widget defocuses
- [ ] Rapid navigation → no stuck overlays
- [ ] Check logger for overlay-related errors

---

### Step 3: Extract JavaScript to Modules (2-3 days)

**Create initialization system:**

```
js/
├── main.js                           # NEW - Application bootstrap
│
└── core/
    └── initialization/               # NEW - Initialization modules
        ├── auth-initializer.js       # Auth system setup
        ├── service-initializer.js    # Services setup
        ├── widget-initializer.js     # Widgets setup
        └── core-initializer.js       # Core components setup
```

**Migration tasks:**

1. **Create js/main.js** - Main bootstrap file (~150 lines)
   ```javascript
   // Import all initializers
   import { initializeAuth } from './core/initialization/auth-initializer.js';
   import { initializeServices } from './core/initialization/service-initializer.js';
   import { initializeWidgets } from './core/initialization/widget-initializer.js';
   import { initializeCore } from './core/initialization/core-initializer.js';
   import { createLogger } from './utils/logger.js';
   import consoleCommands from './utils/console-commands.js';

   const logger = createLogger('Main');

   // Initialize console commands
   consoleCommands.initialize();

   // Main initialization sequence
   async function initialize() {
       try {
           // Step 1: Auth (may show login screen)
           const authenticated = await initializeAuth();

           if (!authenticated) {
               logger.info('User not authenticated - login screen active');
               return; // Wait for user to sign in
           }

           // Step 2: Services (EdgeClient, Settings, Calendar)
           await initializeServices();

           // Step 3: Core components
           await initializeCore();

           // Step 4: Widgets
           await initializeWidgets();

           logger.success('Application initialized successfully');

       } catch (error) {
           logger.error('Initialization failed', error);
       }
   }

   // Start on DOMContentLoaded
   window.addEventListener('DOMContentLoaded', initialize);
   ```

2. **Create js/core/initialization/auth-initializer.js** (~200 lines)
   - Move `initializeAuth()` from index.html
   - Move `updateLoginStatus()`, `updateLoginButton()`, `showLoginError()` helpers
   - Move `populateSiteInfo()` function
   - Move `setupLoginNavigation()` function
   - Return authentication result

3. **Create js/core/initialization/service-initializer.js** (~100 lines)
   - Move `initializeDataServices()` from index.html
   - Initialize EdgeClient, SettingsService, CalendarService
   - Export for use in main.js

4. **Create js/core/initialization/widget-initializer.js** (~100 lines)
   - Move `initializeWidgets()` from index.html
   - Register widget iframes
   - Export for use in main.js

5. **Create js/core/initialization/core-initializer.js** (~150 lines)
   - Move `initializeCore()` from index.html
   - Initialize AppStateManager, InputHandler, ActionRouter, WidgetMessenger
   - Initialize and register all modules
   - Set Dashboard as active

**Testing:**
- [ ] App starts successfully
- [ ] Login screen shows if not authenticated
- [ ] Dashboard loads after successful login
- [ ] All modules initialized (check console logs)
- [ ] No errors in console

---

### Step 4: Create Login Module (2 days)

**Create Login module structure:**

```
js/modules/Login/
├── login.js                    # Module interface
├── login-ui-renderer.js        # OAuth login screen UI
├── login-input-handler.js      # D-pad navigation
└── login-state-manager.js      # Login state
```

**Implementation:**

1. **Create login.js** - Module interface
   ```javascript
   import LoginUIRenderer from './login-ui-renderer.js';
   import LoginInputHandler from './login-input-handler.js';
   import LoginStateManager from './login-state-manager.js';
   import { createLogger } from '../../utils/logger.js';

   const logger = createLogger('LoginModule');

   export default {
       async initialize() {
           logger.info('Initializing Login module');
           LoginStateManager.initialize();
       },

       activate() {
           logger.info('Activating Login module');
           LoginUIRenderer.render();
           LoginInputHandler.activate();
       },

       deactivate() {
           logger.info('Deactivating Login module');
           LoginUIRenderer.hide();
           LoginInputHandler.deactivate();
       },

       show() {
           LoginUIRenderer.show();
       },

       hide() {
           LoginUIRenderer.hide();
       },

       getState() {
           return LoginStateManager.getState();
       },

       getInputHandler() {
           return LoginInputHandler;
       }
   };
   ```

2. **Create login-ui-renderer.js** - Extract OAuth login HTML from index.html
   ```javascript
   import { createLogger } from '../../utils/logger.js';

   const logger = createLogger('LoginUIRenderer');

   class LoginUIRenderer {
       render() {
           // Create login screen HTML (currently in index.html:368-406)
           const container = document.getElementById('oauth-login-screen');
           if (!container) {
               logger.error('Login screen container not found');
               return;
           }

           container.innerHTML = `
               <div class="sign-in-modal">
                   <img src="./artwork/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie" class="dashie-logo-signin">
                   <!-- ... rest of login UI ... -->
               </div>
           `;

           this.attachEventHandlers();
       }

       show() {
           document.getElementById('oauth-login-screen').classList.remove('hidden');
       }

       hide() {
           document.getElementById('oauth-login-screen').classList.add('hidden');
       }

       updateStatus(message) {
           document.getElementById('login-status').textContent = message;
       }

       updateButton(text, enabled = true, showSpinner = false) {
           // Implementation
       }

       showError(message) {
           // Implementation
       }

       attachEventHandlers() {
           // Attach sign-in button handler
           // Attach exit button handler
       }
   }

   export default new LoginUIRenderer();
   ```

3. **Create login-input-handler.js** - D-pad navigation
   ```javascript
   import { createModalNavigation } from '../../utils/modal-navigation-manager.js';
   import { createLogger } from '../../utils/logger.js';

   const logger = createLogger('LoginInputHandler');

   class LoginInputHandler {
       activate() {
           const loginScreen = document.getElementById('oauth-login-screen');
           const buttons = ['login-button', 'exit-app-btn', 'site-switch-link'];

           createModalNavigation(loginScreen, buttons, {
               initialFocus: 0,
               onEscape: () => {
                   logger.info('Escape pressed - exiting app');
                   window.close();
               }
           });

           logger.info('Login input handler activated');
       }

       deactivate() {
           // Cleanup
           if (window.dashieModalManager) {
               window.dashieModalManager.unregisterModal();
           }
       }

       // Input handler interface (required by ActionRouter)
       handleUp() { return window.dashieModalManager?.handleAction('up') || false; }
       handleDown() { return window.dashieModalManager?.handleAction('down') || false; }
       handleEnter() { return window.dashieModalManager?.handleAction('enter') || false; }
       handleEscape() { return window.dashieModalManager?.handleAction('escape') || false; }
   }

   export default new LoginInputHandler();
   ```

4. **Create login-state-manager.js** - Login state
   ```javascript
   class LoginStateManager {
       constructor() {
           this.state = {
               isSigningIn: false,
               error: null,
               platform: null
           };
       }

       initialize() {
           // Initialize state
       }

       getState() {
           return { ...this.state };
       }

       setState(updates) {
           this.state = { ...this.state, ...updates };
       }
   }

   export default new LoginStateManager();
   ```

5. **Update index.html** - Remove inline JavaScript, add script tag
   ```html
   <body>
     <!-- OAuth Login Screen (empty container) -->
     <div id="oauth-login-screen"></div>

     <!-- Dashboard Container -->
     <div id="dashboard-container" class="dashboard-container"></div>

     <!-- Single script import -->
     <script type="module" src="./js/main.js"></script>
   </body>
   ```

**Testing:**
- [ ] Login screen renders correctly
- [ ] D-pad navigation works (up/down between buttons)
- [ ] Sign in button works (OAuth flow starts)
- [ ] Exit button works
- [ ] Site switch link navigable
- [ ] Login module registered with ActionRouter
- [ ] No console errors

---

### Step 5: Final Cleanup (1 day)

1. **Remove all inline JavaScript from index.html**
   - Only `<script type="module" src="./js/main.js"></script>` should remain

2. **Remove all inline CSS from index.html**
   - Only `<link>` tags should remain

3. **Verify index.html is clean**
   - Target: ~100 lines total
   - Only HTML structure + CSS/JS links

4. **Update auth-initializer.js to use Login module**
   ```javascript
   import Login from '../../modules/Login/login.js';

   if (!authenticated) {
       // Use Login module instead of inline UI
       Login.activate();
       return false;
   }
   ```

**Testing:**
- [ ] App starts correctly
- [ ] Login screen shows when not authenticated
- [ ] Dashboard shows when authenticated
- [ ] All functionality preserved
- [ ] index.html is clean and readable
- [ ] File organization matches architecture

---

### 4.1 Success Criteria

- [ ] index.html reduced from 875 lines → ~100 lines
- [ ] All inline CSS extracted to proper CSS files
- [ ] All inline JavaScript extracted to modules
- [ ] Login module created and working
- [ ] Focus overlay bugs fixed
- [ ] Initialization system modular and testable
- [ ] File organization matches architecture
- [ ] No regressions in functionality
- [ ] All tests passing

**Estimated Time:** 5-7 days

---

## 4.2: Verify Settings Service

**Goal:** Ensure settings-service.js works correctly with EdgeClient for database persistence.

**Current State:**
- [settings-service.js](../../js/data/services/settings-service.js) exists (~310 lines)
- EdgeClient integration may need verification
- Dual-write pattern (localStorage + Supabase) needs testing

### Step 1: Review Settings Service Implementation (1 day)

**Check current implementation:**

1. **Verify EdgeClient integration**
   ```javascript
   // settings-service.js should have:
   setEdgeClient(edgeClient) {
       this.edgeClient = edgeClient;
   }

   async save() {
       // Save to localStorage
       localStorage.setItem('dashie-settings', JSON.stringify(this.settings));

       // Save to Supabase via EdgeClient
       await this.edgeClient.saveSettings(this.settings);
   }

   async load() {
       // Try Supabase first
       const dbSettings = await this.edgeClient.loadSettings();

       // Fallback to localStorage
       if (!dbSettings) {
           const localSettings = localStorage.getItem('dashie-settings');
           return localSettings ? JSON.parse(localSettings) : this.getDefaultSettings();
       }

       return dbSettings;
   }
   ```

2. **Verify API methods exist**
   - `get(key)` - Get setting value
   - `set(key, value)` - Set setting value
   - `save()` - Persist to storage
   - `load()` - Load from storage
   - `getAll()` - Get all settings
   - `setAll(settings)` - Set multiple settings
   - `reset()` - Reset to defaults

3. **Check default settings**
   ```javascript
   getDefaultSettings() {
       return {
           theme: 'dark',
           use24HourTime: false,
           sleepTime: '22:00',
           wakeTime: '06:00',
           locationLat: null,
           locationLon: null,
           locationName: '',
           activeCalendarIds: [], // Account-prefixed IDs
           photoSlideshowInterval: 30,
           // ... other defaults
       };
   }
   ```

**Testing:**
- [ ] Settings service exports correct API
- [ ] EdgeClient setter works
- [ ] Default settings structure complete
- [ ] No missing methods

---

### Step 2: Test EdgeClient Integration (1 day)

**Test dual-write pattern:**

1. **Test save() method**
   ```javascript
   // In browser console:
   await window.settingsService.set('theme', 'light');
   await window.settingsService.save();

   // Check localStorage
   localStorage.getItem('dashie-settings'); // Should show theme: 'light'

   // Check Supabase (via EdgeClient)
   const dbSettings = await window.edgeClient.loadSettings();
   console.log(dbSettings.theme); // Should be 'light'
   ```

2. **Test load() method**
   ```javascript
   // Clear localStorage
   localStorage.removeItem('dashie-settings');

   // Reload settings (should fetch from Supabase)
   const settings = await window.settingsService.load();
   console.log(settings.theme); // Should be 'light' (from database)
   ```

3. **Test fallback to localStorage**
   ```javascript
   // Simulate Supabase failure
   await window.edgeClient.disconnect(); // If method exists

   // Try loading settings
   const settings = await window.settingsService.load();
   // Should fallback to localStorage or defaults
   ```

**Testing:**
- [ ] Settings save to localStorage
- [ ] Settings save to Supabase
- [ ] Settings load from Supabase first
- [ ] Fallback to localStorage works
- [ ] Default settings returned if both fail
- [ ] No errors in console

---

### Step 3: Test Theme Application (1 day)

**Test theme changes persist and apply:**

1. **Test theme change flow**
   ```javascript
   // Change theme
   await window.settingsService.set('theme', 'dark');
   await window.settingsService.save();

   // Apply theme
   window.themeApplier.applyTheme('dark');

   // Check DOM
   document.body.dataset.theme; // Should be 'dark'

   // Reload page
   location.reload();

   // After reload, theme should still be 'dark'
   ```

2. **Test theme broadcast to widgets**
   ```javascript
   import AppComms from './js/core/app-comms.js';

   // Subscribe to theme changes
   AppComms.subscribe(AppComms.events.THEME_CHANGED, (data) => {
       console.log('Theme changed:', data);
   });

   // Change theme
   await settingsService.set('theme', 'light');
   await settingsService.save();

   // Verify THEME_CHANGED event published
   // Verify widgets receive theme update
   ```

3. **Test Settings module integration**
   ```javascript
   // Open Settings
   window.Settings.activate();

   // Change theme in Settings UI
   // Click "Save" button

   // Verify:
   // - Theme applies immediately
   // - Theme persists to database
   // - Widgets update
   // - No errors
   ```

**Testing:**
- [ ] Theme changes persist across sessions
- [ ] Theme applies to document.body
- [ ] THEME_CHANGED event published
- [ ] Widgets receive theme updates
- [ ] Settings UI reflects current theme
- [ ] No console errors

---

### 4.2 Success Criteria

- [ ] Settings service API complete and working
- [ ] EdgeClient integration verified
- [ ] Dual-write pattern (localStorage + Supabase) working
- [ ] Theme persistence tested
- [ ] Theme broadcast to widgets working
- [ ] Settings module integration verified
- [ ] All tests documented and passing

**Estimated Time:** 3 days

---

## 4.3: Calendar Data & Settings System

**Goal:** Complete calendar-service.js with account-prefixed calendar IDs, build calendar settings UI, create test interface.

**Why Critical:** Without account-prefixed IDs, shared calendars across multiple accounts won't work correctly.

### Step 1: Complete Calendar Service Implementation (2-3 days)

**Current State:**
- [calendar-service.js](../../js/data/services/calendar-service.js) is minimal (~170 lines)
- Missing core methods for calendar management

**Add account-prefixed ID methods:**

```javascript
// js/data/services/calendar-service.js

import { createLogger } from '../../utils/logger.js';
import GoogleAPIClient from './google/google-api-client.js';

const logger = createLogger('CalendarService');

class CalendarService {
    constructor(edgeClient) {
        this.edgeClient = edgeClient;
        this.googleClient = null;
        this.activeCalendarIds = []; // Account-prefixed IDs
    }

    async initialize() {
        logger.info('Initializing CalendarService');

        // Initialize Google API client
        this.googleClient = new GoogleAPIClient(this.edgeClient);

        // Load active calendar IDs from settings
        const settings = await this.edgeClient.loadSettings();
        this.activeCalendarIds = settings.activeCalendarIds || [];

        logger.success('CalendarService initialized', {
            activeCalendars: this.activeCalendarIds.length
        });
    }

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
        const firstDashIndex = prefixedId.indexOf('-');
        if (firstDashIndex === -1) {
            logger.warn('Invalid prefixed ID format', { prefixedId });
            return { accountType: 'primary', calendarId: prefixedId };
        }

        const accountType = prefixedId.substring(0, firstDashIndex);
        const calendarId = prefixedId.substring(firstDashIndex + 1);

        return { accountType, calendarId };
    }

    /**
     * Get calendars with prefixed IDs
     * @param {string} accountType - Account type
     * @returns {Promise<Array>} Calendars with prefixed IDs
     */
    async getCalendars(accountType = 'primary') {
        logger.info('Fetching calendars', { accountType });

        const rawCalendars = await this.googleClient.getCalendarList(accountType);

        // Add prefixed IDs to each calendar
        return rawCalendars.map(cal => ({
            ...cal,
            prefixedId: this.createPrefixedId(accountType, cal.id),
            rawId: cal.id,
            accountType: accountType
        }));
    }

    /**
     * Get events using prefixed calendar ID
     * @param {string} prefixedCalendarId - Like 'primary-user@gmail.com'
     * @param {object} timeRange - Time range options
     * @returns {Promise<Array>} Calendar events
     */
    async getEvents(prefixedCalendarId, timeRange = {}) {
        const { accountType, calendarId } = this.parsePrefixedId(prefixedCalendarId);

        logger.info('Fetching events', { prefixedCalendarId, accountType, calendarId });

        const events = await this.googleClient.getCalendarEvents(
            calendarId,
            timeRange,
            accountType
        );

        // Add calendar metadata to events
        return events.map(event => ({
            ...event,
            calendarId: prefixedCalendarId,
            accountType: accountType
        }));
    }

    /**
     * Get all events from all active calendars
     * @param {object} timeRange - Time range options
     * @returns {Promise<Array>} All events
     */
    async getAllEvents(timeRange = {}) {
        logger.info('Fetching all events from active calendars', {
            activeCount: this.activeCalendarIds.length
        });

        const eventPromises = this.activeCalendarIds.map(prefixedId =>
            this.getEvents(prefixedId, timeRange).catch(err => {
                logger.error('Failed to fetch events', { prefixedId, error: err });
                return [];
            })
        );

        const eventArrays = await Promise.all(eventPromises);
        const allEvents = eventArrays.flat();

        // Sort by start time
        allEvents.sort((a, b) => {
            const aTime = new Date(a.start.dateTime || a.start.date);
            const bTime = new Date(b.start.dateTime || b.start.date);
            return aTime - bTime;
        });

        logger.success('Fetched all events', { totalEvents: allEvents.length });
        return allEvents;
    }

    /**
     * Enable a calendar
     * @param {string} accountType - Account type
     * @param {string} calendarId - Raw calendar ID
     */
    async enableCalendar(accountType, calendarId) {
        const prefixedId = this.createPrefixedId(accountType, calendarId);

        if (!this.activeCalendarIds.includes(prefixedId)) {
            this.activeCalendarIds.push(prefixedId);
            await this.saveActiveCalendars();

            logger.info('Calendar enabled', { prefixedId });
        }
    }

    /**
     * Disable a calendar
     * @param {string} accountType - Account type
     * @param {string} calendarId - Raw calendar ID
     */
    async disableCalendar(accountType, calendarId) {
        const prefixedId = this.createPrefixedId(accountType, calendarId);
        const originalLength = this.activeCalendarIds.length;

        this.activeCalendarIds = this.activeCalendarIds.filter(id => id !== prefixedId);

        if (this.activeCalendarIds.length !== originalLength) {
            await this.saveActiveCalendars();
            logger.info('Calendar disabled', { prefixedId });
        }
    }

    /**
     * Remove all calendars from an account
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
            await this.saveActiveCalendars();
            logger.info('Account calendars removed', {
                accountType,
                removedCount: removed
            });
        }
    }

    /**
     * Get active calendar IDs
     * @returns {Array<string>} Prefixed calendar IDs
     */
    getActiveCalendarIds() {
        return [...this.activeCalendarIds];
    }

    /**
     * Check if calendar is active
     * @param {string} accountType - Account type
     * @param {string} calendarId - Raw calendar ID
     * @returns {boolean}
     */
    isCalendarActive(accountType, calendarId) {
        const prefixedId = this.createPrefixedId(accountType, calendarId);
        return this.activeCalendarIds.includes(prefixedId);
    }

    /**
     * Save active calendars to settings
     */
    async saveActiveCalendars() {
        try {
            // Save to settings service (which handles dual-write)
            const settings = await this.edgeClient.loadSettings();
            settings.activeCalendarIds = this.activeCalendarIds;
            await this.edgeClient.saveSettings(settings);

            logger.debug('Active calendars saved', {
                count: this.activeCalendarIds.length
            });

        } catch (error) {
            logger.error('Failed to save active calendars', error);
            throw error;
        }
    }

    /**
     * Migrate old calendar IDs to prefixed format
     * @param {Array<string>} oldIds - Old non-prefixed IDs
     * @param {string} defaultAccount - Default account type for migration
     * @returns {Array<string>} New prefixed IDs
     */
    migrateCalendarIds(oldIds, defaultAccount = 'primary') {
        logger.info('Migrating calendar IDs to prefixed format', {
            oldCount: oldIds.length
        });

        const prefixedIds = oldIds.map(id => {
            // If already prefixed, keep as-is
            if (id.includes('-')) {
                return id;
            }
            // Otherwise, prefix with default account
            return this.createPrefixedId(defaultAccount, id);
        });

        logger.success('Migration complete', {
            oldIds,
            prefixedIds
        });

        return prefixedIds;
    }
}

// Export singleton factory
let calendarServiceInstance = null;

export function initializeCalendarService(edgeClient) {
    if (!calendarServiceInstance) {
        calendarServiceInstance = new CalendarService(edgeClient);
    }
    return calendarServiceInstance;
}

export function getCalendarService() {
    if (!calendarServiceInstance) {
        throw new Error('CalendarService not initialized');
    }
    return calendarServiceInstance;
}

export default {
    initialize: initializeCalendarService,
    get: getCalendarService
};
```

**Testing:**
- [ ] Calendar service initializes
- [ ] `createPrefixedId()` returns correct format
- [ ] `parsePrefixedId()` parses correctly (handles dashes in calendar IDs)
- [ ] `getCalendars()` returns calendars with prefixed IDs
- [ ] `getEvents()` fetches events for prefixed ID
- [ ] `getAllEvents()` combines events from multiple calendars
- [ ] `enableCalendar()` / `disableCalendar()` work
- [ ] `removeAccountCalendars()` removes all for account
- [ ] Migration function works
- [ ] No console errors

---

### Step 2: Build Calendar Settings Page (2 days)

**Update settings-calendar-page.js:**

```javascript
// js/modules/Settings/pages/settings-calendar-page.js

import { createLogger } from '../../../utils/logger.js';
import { getCalendarService } from '../../../data/services/calendar-service.js';
import { sessionManager } from '../../../data/auth/orchestration/session-manager.js';
import SettingsScreenBase from '../core/settings-screen-base.js';

const logger = createLogger('CalendarSettingsPage');

export default class CalendarSettingsPage extends SettingsScreenBase {
    constructor() {
        super('calendar', 'Calendar Settings');
        this.calendarService = null;
        this.connectedAccounts = [];
    }

    async onInit() {
        logger.info('Initializing calendar settings page');
        this.calendarService = getCalendarService();

        // Get connected Google accounts
        this.connectedAccounts = await this.getConnectedAccounts();

        logger.info('Connected accounts', {
            count: this.connectedAccounts.length,
            accounts: this.connectedAccounts
        });
    }

    async render() {
        logger.info('Rendering calendar settings page');

        let html = '<div class="settings-page settings-calendar-page">';
        html += '<h2>Calendar Settings</h2>';

        if (this.connectedAccounts.length === 0) {
            html += '<p class="settings-info">No calendar accounts connected.</p>';
            html += '<button class="settings-button" id="add-calendar-account">Add Calendar Account</button>';
            html += '</div>';
            return html;
        }

        // Render each account's calendars
        for (const account of this.connectedAccounts) {
            html += await this.renderAccountCalendars(account);
        }

        html += '</div>';
        return html;
    }

    async renderAccountCalendars(account) {
        let html = `<div class="settings-calendar-account" data-account="${account.accountType}">`;
        html += `<h3>${account.email} <span class="account-badge">(${account.accountType})</span></h3>`;

        try {
            // Fetch calendars for this account (with prefixed IDs)
            const calendars = await this.calendarService.getCalendars(account.accountType);

            logger.info('Calendars fetched', {
                accountType: account.accountType,
                count: calendars.length
            });

            html += '<div class="calendar-list">';

            for (const calendar of calendars) {
                const isActive = this.calendarService.isCalendarActive(
                    account.accountType,
                    calendar.rawId
                );

                html += `
                    <div class="calendar-item" data-prefixed-id="${calendar.prefixedId}">
                        <label class="calendar-checkbox">
                            <input
                                type="checkbox"
                                ${isActive ? 'checked' : ''}
                                data-account="${account.accountType}"
                                data-calendar-id="${calendar.rawId}"
                                data-prefixed-id="${calendar.prefixedId}"
                            >
                            <span class="calendar-color" style="background-color: ${calendar.backgroundColor}"></span>
                            <span class="calendar-name">${calendar.summary}</span>
                        </label>
                    </div>
                `;
            }

            html += '</div>';

            // Add "Remove Account" button
            html += `
                <button
                    class="settings-button settings-button--danger remove-account-btn"
                    data-account="${account.accountType}"
                >
                    Remove ${account.email}
                </button>
            `;

        } catch (error) {
            logger.error('Failed to fetch calendars', { account, error });
            html += '<p class="settings-error">Failed to load calendars for this account.</p>';
        }

        html += '</div>';
        return html;
    }

    async onAttach() {
        logger.info('Attaching calendar settings event handlers');

        // Calendar checkbox handlers
        const checkboxes = document.querySelectorAll('.calendar-item input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', async (e) => {
                const accountType = e.target.dataset.account;
                const calendarId = e.target.dataset.calendarId;
                const enabled = e.target.checked;

                logger.info('Calendar toggled', {
                    accountType,
                    calendarId,
                    enabled
                });

                try {
                    if (enabled) {
                        await this.calendarService.enableCalendar(accountType, calendarId);
                    } else {
                        await this.calendarService.disableCalendar(accountType, calendarId);
                    }

                    logger.success('Calendar updated');

                    // Broadcast change to widgets
                    this.broadcastCalendarChange();

                } catch (error) {
                    logger.error('Failed to update calendar', error);
                    e.target.checked = !enabled; // Revert
                }
            });
        });

        // Remove account buttons
        const removeButtons = document.querySelectorAll('.remove-account-btn');
        removeButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                const accountType = e.target.dataset.account;
                await this.removeAccount(accountType);
            });
        });
    }

    async getConnectedAccounts() {
        // Get all connected Google accounts from TokenStore
        const tokenStore = sessionManager.getTokenStore();
        const allTokens = await tokenStore.getAllTokens();

        const accounts = [];
        for (const [key, tokenData] of Object.entries(allTokens)) {
            if (key.startsWith('google/')) {
                const accountType = key.split('/')[1];
                accounts.push({
                    accountType: accountType,
                    email: tokenData.email || accountType,
                    provider: 'google'
                });
            }
        }

        return accounts;
    }

    async removeAccount(accountType) {
        logger.warn('Removing account', { accountType });

        // Confirm with user
        const confirmed = confirm(`Remove all calendars from this account?\n\nThis will disconnect the account and remove all associated calendars.`);
        if (!confirmed) return;

        try {
            // Remove all calendars from this account
            await this.calendarService.removeAccountCalendars(accountType);

            // Remove tokens
            const tokenStore = sessionManager.getTokenStore();
            await tokenStore.removeAccountTokens('google', accountType);

            logger.success('Account removed', { accountType });

            // Re-render page
            const container = document.querySelector('.settings-page');
            container.innerHTML = await this.render();
            await this.onAttach();

            // Broadcast change
            this.broadcastCalendarChange();

        } catch (error) {
            logger.error('Failed to remove account', error);
            alert('Failed to remove account. Please try again.');
        }
    }

    broadcastCalendarChange() {
        import('../../../core/app-comms.js').then(({ default: AppComms }) => {
            AppComms.publish(AppComms.events.CALENDAR_UPDATED, {
                activeCalendarIds: this.calendarService.getActiveCalendarIds()
            });
        });
    }

    async onSave() {
        // Calendars are saved immediately on toggle
        logger.info('Calendar settings saved (already persisted)');
        return true;
    }
}
```

**Testing:**
- [ ] Calendar settings page renders
- [ ] Shows all connected accounts
- [ ] Displays calendars for each account with checkboxes
- [ ] Checkbox toggles enable/disable calendar
- [ ] Prefixed IDs used correctly
- [ ] "Remove Account" button works
- [ ] Page re-renders after account removal
- [ ] No console errors

---

### Step 3: Create Test Interface in index.html (1 day)

**Add temporary test UI above dashboard:**

```html
<!-- Add after <body> tag in index.html -->
<div id="calendar-test-interface" style="
    position: fixed;
    top: 10px;
    left: 10px;
    background: rgba(0,0,0,0.9);
    color: white;
    padding: 20px;
    border-radius: 8px;
    z-index: 10000;
    font-family: monospace;
    font-size: 12px;
    max-width: 600px;
    display: none;
">
    <h3>Calendar Service Test Interface</h3>

    <div style="margin: 10px 0;">
        <button id="test-get-calendars" class="test-btn">Get Calendars (Primary)</button>
        <button id="test-get-events" class="test-btn">Get Events (All Active)</button>
        <button id="test-enable-calendar" class="test-btn">Enable Test Calendar</button>
        <button id="test-disable-calendar" class="test-btn">Disable Test Calendar</button>
    </div>

    <div style="margin: 10px 0;">
        <button id="test-show-active" class="test-btn">Show Active Calendars</button>
        <button id="test-migrate-ids" class="test-btn">Test Migration</button>
        <button id="test-remove-account" class="test-btn">Remove Account2</button>
    </div>

    <div style="margin: 10px 0;">
        <button id="toggle-test-ui" class="test-btn">Hide Test UI</button>
    </div>

    <pre id="test-output" style="
        background: #1a1a1a;
        padding: 10px;
        border-radius: 4px;
        max-height: 300px;
        overflow-y: auto;
        margin-top: 10px;
    ">Test output will appear here...</pre>
</div>

<style>
.test-btn {
    padding: 8px 12px;
    margin: 4px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
}
.test-btn:hover {
    background: #0056b3;
}
</style>

<script type="module">
// Add to main.js or separate test script

import { getCalendarService } from './js/data/services/calendar-service.js';
import { createLogger } from './js/utils/logger.js';

const logger = createLogger('CalendarTest');

function showTestUI() {
    document.getElementById('calendar-test-interface').style.display = 'block';
}

function hideTestUI() {
    document.getElementById('calendar-test-interface').style.display = 'none';
}

function outputTest(message, data) {
    const output = document.getElementById('test-output');
    const timestamp = new Date().toLocaleTimeString();
    output.textContent = `[${timestamp}] ${message}\n${data ? JSON.stringify(data, null, 2) : ''}`;
}

// Test button handlers
document.getElementById('test-get-calendars').addEventListener('click', async () => {
    try {
        const calendarService = getCalendarService();
        const calendars = await calendarService.getCalendars('primary');
        outputTest('Calendars fetched', calendars);
    } catch (error) {
        outputTest('ERROR', error.message);
    }
});

document.getElementById('test-get-events').addEventListener('click', async () => {
    try {
        const calendarService = getCalendarService();
        const now = new Date();
        const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const events = await calendarService.getAllEvents({
            timeMin: now.toISOString(),
            timeMax: endDate.toISOString()
        });

        outputTest('Events fetched', {
            count: events.length,
            events: events.slice(0, 5) // First 5 events
        });
    } catch (error) {
        outputTest('ERROR', error.message);
    }
});

document.getElementById('test-show-active').addEventListener('click', () => {
    const calendarService = getCalendarService();
    const activeIds = calendarService.getActiveCalendarIds();
    outputTest('Active Calendar IDs', activeIds);
});

document.getElementById('toggle-test-ui').addEventListener('click', () => {
    hideTestUI();
});

// Show test UI on Ctrl+Shift+T
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        showTestUI();
    }
});

// Expose test functions globally
window.calendarTests = {
    show: showTestUI,
    hide: hideTestUI
};
</script>
```

**Testing:**
- [ ] Test UI shows with Ctrl+Shift+T
- [ ] "Get Calendars" button works
- [ ] "Get Events" button works
- [ ] "Show Active" displays prefixed IDs
- [ ] Output displays correctly
- [ ] Hide button works
- [ ] No interference with main app

---

### 4.3 Success Criteria

- [ ] Calendar service complete with all methods
- [ ] Account-prefixed ID system implemented
- [ ] `createPrefixedId()` and `parsePrefixedId()` working
- [ ] Calendar settings page renders and works
- [ ] Test interface functional
- [ ] All calendar operations use prefixed IDs
- [ ] Migration function tested
- [ ] Documentation updated

**Estimated Time:** 5-6 days

---

## 4.4: Test Calendar Settings with Multi-Accounts

**Goal:** Verify calendar settings work correctly with multiple Google accounts and shared calendars.

### Step 1: Setup Multi-Account Testing (1 day)

**Prerequisites:**
- Have 2+ Google accounts available for testing
- Both accounts should have calendar access

**Setup tasks:**

1. **Connect first account (primary)**
   ```javascript
   // Sign in with first Google account
   // This becomes 'primary' account
   ```

2. **Add second account (account2)**
   ```javascript
   // In Settings → Calendar Settings
   // Click "Add Calendar Account"
   // Sign in with second Google account
   // This becomes 'account2'
   ```

3. **Create shared calendar scenario**
   - Create a calendar in Account 1
   - Share it with Account 2 (read access)
   - Verify it appears in both accounts

**Testing:**
- [ ] Primary account connects successfully
- [ ] Second account connects successfully
- [ ] Both accounts visible in calendar settings
- [ ] Shared calendar appears in both accounts
- [ ] Each has unique prefixed ID

---

### Step 2: Test Calendar Enable/Disable (1 day)

**Test scenarios:**

1. **Enable calendar in primary account**
   ```javascript
   // In Calendar Settings:
   // - Find calendar under "Primary Account"
   // - Check the checkbox
   // - Verify:
   const calendarService = getCalendarService();
   const activeIds = calendarService.getActiveCalendarIds();
   console.log(activeIds);
   // Should include: 'primary-user@gmail.com'
   ```

2. **Enable same calendar in account2**
   ```javascript
   // If calendar is shared:
   // - Find same calendar under "Account 2"
   // - Check the checkbox
   // - Verify both IDs are active:
   // ['primary-user@gmail.com', 'account2-user@gmail.com']
   ```

3. **Disable calendar in one account**
   ```javascript
   // Uncheck calendar in Account 2
   // Verify:
   // - Only 'primary-user@gmail.com' remains active
   // - 'account2-user@gmail.com' removed
   ```

4. **Test persistence**
   ```javascript
   // Reload page
   // Open Calendar Settings
   // Verify:
   // - Checked calendars still checked
   // - Unchecked calendars still unchecked
   // - Active IDs match
   ```

**Testing:**
- [ ] Enabling calendar adds prefixed ID to active list
- [ ] Disabling calendar removes prefixed ID
- [ ] Shared calendar can be enabled in both accounts independently
- [ ] Changes persist across page reloads
- [ ] Database updates correctly
- [ ] localStorage syncs with database

---

### Step 3: Test Remove Account (1 day)

**Test account removal:**

1. **Remove account with active calendars**
   ```javascript
   // Setup:
   // - Enable 2 calendars in Account 2
   // - Enable 1 calendar in Primary

   const before = calendarService.getActiveCalendarIds();
   console.log('Before:', before);
   // ['primary-cal1', 'account2-cal1', 'account2-cal2']

   // Action:
   // - Click "Remove Account2"
   // - Confirm removal

   const after = calendarService.getActiveCalendarIds();
   console.log('After:', after);
   // ['primary-cal1']
   // Account2 calendars removed
   ```

2. **Verify token cleanup**
   ```javascript
   const tokenStore = sessionManager.getTokenStore();
   const tokens = await tokenStore.getAllTokens();
   console.log('Remaining tokens:', Object.keys(tokens));
   // Should NOT include 'google/account2'
   ```

3. **Test persistence after removal**
   ```javascript
   // Reload page
   // Open Calendar Settings
   // Verify:
   // - Account2 not shown
   // - Only primary account visible
   // - Primary calendar still active
   ```

**Testing:**
- [ ] Remove account deletes all account calendars
- [ ] Tokens removed from token store
- [ ] Active calendar IDs updated
- [ ] Changes persist across reload
- [ ] No orphaned calendar IDs
- [ ] No errors in console

---

### Step 4: Test Event Fetching with Multiple Accounts (1 day)

**Test event retrieval:**

1. **Fetch events from multiple calendars**
   ```javascript
   const calendarService = getCalendarService();

   // Enable calendars from both accounts
   await calendarService.enableCalendar('primary', 'primary-cal@gmail.com');
   await calendarService.enableCalendar('account2', 'account2-cal@gmail.com');

   // Fetch all events
   const events = await calendarService.getAllEvents({
       timeMin: new Date().toISOString(),
       timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
   });

   console.log('Events:', events);

   // Verify each event has correct metadata
   events.forEach(event => {
       console.log({
           summary: event.summary,
           calendarId: event.calendarId, // Should be prefixed
           accountType: event.accountType
       });
   });
   ```

2. **Test event from shared calendar**
   ```javascript
   // If calendar is shared and enabled in both accounts:
   // - Create event in shared calendar
   // - Verify event appears only once
   // - Verify it's associated with correct account
   ```

**Testing:**
- [ ] Events fetched from multiple accounts
- [ ] Each event has prefixed calendar ID
- [ ] Each event has account type
- [ ] Shared calendar events not duplicated
- [ ] Events sorted by time
- [ ] No errors during fetch

---

### 4.4 Success Criteria

- [ ] Multiple accounts can be connected
- [ ] Each account's calendars displayed separately
- [ ] Prefixed IDs unique across accounts
- [ ] Shared calendars work correctly
- [ ] Enable/disable works independently per account
- [ ] Account removal cleans up all calendars
- [ ] Event fetching works with multiple accounts
- [ ] All changes persist across reloads
- [ ] No console errors
- [ ] Test results documented

**Estimated Time:** 4 days

---

## 4.5: Calendar Widget Migration

**Goal:** Migrate the Calendar widget (dcal) from `.legacy/widgets/dcal/` to the new architecture with 3-state model and focus menu.

### Step 1: Copy Legacy Calendar Widget (1 day)

**Copy files from legacy:**

```bash
# Copy legacy widget
cp -r .legacy/widgets/dcal/* js/widgets/calendar/

# Files to migrate:
# - index.html → calendar.html
# - calendar.js → calendar.js (widget logic)
# - styles.css → calendar.css
# - Any other assets
```

**Review legacy implementation:**

1. **Study calendar.js**
   - Event rendering logic
   - Date formatting
   - View modes (day/week/month)
   - Navigation logic
   - ⚠️ **DO NOT REWRITE** - preserve working logic!

2. **Study styles.css**
   - Layout and styling
   - Event display
   - Animations
   - Fire TV compatibility fixes

3. **Study index.html**
   - Widget structure
   - Element IDs and classes

**Testing:**
- [ ] Legacy widget files copied
- [ ] All assets present
- [ ] Files reviewed and understood
- [ ] Notes taken on complex logic

---

### Step 2: Adapt to New Architecture (2-3 days)

**Update calendar.js to use new widget pattern:**

```javascript
// js/widgets/calendar/calendar.js

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('CalendarWidget');

class CalendarWidget {
    constructor() {
        // Widget state (3-state model)
        this.hasFocus = false;      // FOCUSED state
        this.isActive = false;       // ACTIVE state

        // Widget data
        this.events = [];
        this.currentDate = new Date();
        this.currentView = 'week'; // 'day' | 'week' | 'month'

        // Focus menu
        this.focusMenuConfig = {
            hasFocusMenu: true,
            menuItems: [
                { id: 'view-week', label: 'Week View', icon: '📅', type: 'view', active: true },
                { id: 'view-month', label: 'Month View', icon: '📆', type: 'view', active: false },
                { id: 'action-today', label: 'Go to Today', icon: '🏠', type: 'action' }
            ]
        };

        // Home position (for navigation)
        this.homeDate = null;
        this.isAtHome = true;

        // DOM references
        this.container = null;
        this.eventsContainer = null;
    }

    async initialize() {
        logger.info('Initializing calendar widget');

        // Get DOM references
        this.container = document.getElementById('calendar-widget');
        this.eventsContainer = document.getElementById('events-container');

        // Set up message listener
        window.addEventListener('message', (event) => {
            this.handleMessage(event.data);
        });

        // Send ready signal to parent
        this.sendEvent('widget-ready', {
            hasMenu: true,
            menuConfig: this.focusMenuConfig
        });

        logger.success('Calendar widget ready');
    }

    handleMessage(data) {
        if (!data || !data.action) return;

        // STEP 1: Handle menu actions first
        const menuActions = ['menu-active', 'menu-selection-changed', 'menu-item-selected'];
        if (menuActions.includes(data.action)) {
            this.handleMenuAction(data);
            return;
        }

        // STEP 2: Handle state transitions
        if (data.action === 'enter-focus') {
            this.handleEnterFocus();
            return;
        }

        if (data.action === 'enter-active') {
            this.handleEnterActive();
            return;
        }

        if (data.action === 'exit-active') {
            this.handleExitActive();
            return;
        }

        if (data.action === 'exit-focus') {
            this.handleExitFocus();
            return;
        }

        // STEP 3: Handle data messages
        if (data.type === 'data' && data.dataType === 'events') {
            this.events = data.data;
            this.renderEvents();
            return;
        }

        // STEP 4: Handle navigation (only if active)
        if (!this.isActive) return;

        switch (data.action) {
            case 'up':
                this.handleUp();
                break;
            case 'down':
                this.handleDown();
                break;
            case 'left':
                this.handleLeft();
                break;
            case 'right':
                this.handleRight();
                break;
            case 'enter':
                this.handleEnter();
                break;
            case 'escape':
                this.handleEscape();
                break;
        }
    }

    // STATE TRANSITIONS

    handleEnterFocus() {
        logger.info('Widget entering FOCUSED state');
        this.hasFocus = true;
        this.container.classList.add('widget--focused');
        // Focus menu shown by parent
    }

    handleEnterActive() {
        logger.info('Widget entering ACTIVE state');
        this.isActive = true;
        this.container.classList.add('widget--active');

        // Remember home position
        this.homeDate = new Date(this.currentDate);
        this.isAtHome = true;

        // Focus menu dimmed by parent
    }

    handleExitActive() {
        logger.info('Widget exiting ACTIVE state');
        this.isActive = false;
        this.container.classList.remove('widget--active');

        // Reset to home position
        this.currentDate = new Date(this.homeDate);
        this.renderEvents();

        // Focus menu restored by parent
    }

    handleExitFocus() {
        logger.info('Widget exiting FOCUSED state');
        this.hasFocus = false;
        this.container.classList.remove('widget--focused');
        // Focus menu hidden by parent
    }

    // NAVIGATION (only when active)

    handleUp() {
        // Scroll events up
        logger.debug('Scroll up');
        // PRESERVE LEGACY LOGIC HERE
    }

    handleDown() {
        // Scroll events down
        logger.debug('Scroll down');
        // PRESERVE LEGACY LOGIC HERE
    }

    handleLeft() {
        // Navigate backward in time

        // Check if at home position
        if (this.isAtHome) {
            logger.info('At home position - returning to menu');
            this.sendEvent('return-to-menu');
            return;
        }

        // Navigate backward
        this.navigatePrevious();
        this.updateHomeStatus();
    }

    handleRight() {
        // Navigate forward in time
        this.navigateNext();
        this.updateHomeStatus();
    }

    handleEnter() {
        // Open event details (if event selected)
        logger.debug('Enter pressed - open event details');
        // TO DO: Implement in 4.8 with Agenda widget
    }

    handleEscape() {
        // Return to menu
        this.sendEvent('return-to-menu');
    }

    // MENU ACTIONS

    handleMenuAction(data) {
        if (data.action === 'menu-item-selected') {
            const item = this.focusMenuConfig.menuItems.find(i => i.id === data.itemId);

            if (item.type === 'view') {
                // Switch view mode
                this.switchView(data.itemId);
                this.updateMenuActiveItem(data.itemId);
            }

            if (item.type === 'action') {
                if (data.itemId === 'action-today') {
                    this.goToToday();
                }
            }
        }
    }

    switchView(viewId) {
        const viewMap = {
            'view-week': 'week',
            'view-month': 'month'
        };

        this.currentView = viewMap[viewId] || 'week';
        logger.info('View switched', { view: this.currentView });
        this.renderEvents();
    }

    goToToday() {
        this.currentDate = new Date();
        this.homeDate = new Date();
        this.isAtHome = true;
        logger.info('Jumped to today');
        this.renderEvents();
    }

    updateMenuActiveItem(activeId) {
        this.focusMenuConfig.menuItems.forEach(item => {
            item.active = (item.id === activeId && item.type === 'view');
        });

        // Send updated config to parent
        this.sendEvent('widget-config-update', {
            menuConfig: this.focusMenuConfig
        });
    }

    // NAVIGATION HELPERS

    navigatePrevious() {
        if (this.currentView === 'week') {
            this.currentDate.setDate(this.currentDate.getDate() - 7);
        } else if (this.currentView === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        }
        this.renderEvents();
    }

    navigateNext() {
        if (this.currentView === 'week') {
            this.currentDate.setDate(this.currentDate.getDate() + 7);
        } else if (this.currentView === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        }
        this.renderEvents();
    }

    updateHomeStatus() {
        // Check if current date matches home date
        const current = this.currentDate.toDateString();
        const home = this.homeDate.toDateString();
        this.isAtHome = (current === home);

        logger.debug('Home status', { isAtHome: this.isAtHome });
    }

    // RENDERING (PRESERVE LEGACY LOGIC)

    renderEvents() {
        // ⚠️ PRESERVE LEGACY RENDERING LOGIC
        // Copy from .legacy/widgets/dcal/calendar.js

        logger.info('Rendering events', {
            view: this.currentView,
            date: this.currentDate.toDateString(),
            eventCount: this.events.length
        });

        // Filter events for current view period
        const visibleEvents = this.filterEventsForView();

        // Clear container
        this.eventsContainer.innerHTML = '';

        // Render events
        visibleEvents.forEach(event => {
            const eventEl = this.createEventElement(event);
            this.eventsContainer.appendChild(eventEl);
        });
    }

    filterEventsForView() {
        // PRESERVE LEGACY FILTERING LOGIC
        return this.events; // Placeholder
    }

    createEventElement(event) {
        // PRESERVE LEGACY EVENT RENDERING
        const div = document.createElement('div');
        div.className = 'calendar-event';
        div.textContent = event.summary;
        return div;
    }

    // UTILITIES

    sendEvent(eventType, data = {}) {
        window.parent.postMessage({
            type: 'event',
            widgetId: 'calendar',
            payload: { eventType, data }
        }, '*');
    }
}

// Initialize widget
const widget = new CalendarWidget();
widget.initialize();
```

**Testing:**
- [ ] Widget loads in iframe
- [ ] Widget sends 'widget-ready' event
- [ ] Widget receives events via postMessage
- [ ] Events render correctly
- [ ] 3-state model implemented
- [ ] Focus menu config sent to parent
- [ ] No console errors

---

### Step 3: Implement Focus Menu System (1 day)

**Update Dashboard to handle focus menu:**

This may already be implemented in [dashboard-focus-menu-manager.js](../../js/modules/Dashboard/dashboard-focus-menu-manager.js). Verify and complete if needed.

**Required features:**
- Display menu when widget focused
- Highlight selected menu item
- Dim menu when widget becomes active
- Restore menu when widget exits active
- Send menu actions to widget

**Testing:**
- [ ] Focus menu appears when calendar widget focused
- [ ] Menu items displayed correctly
- [ ] Up/down navigation selects menu items
- [ ] Enter activates menu item
- [ ] View changes work (Week/Month)
- [ ] "Go to Today" action works
- [ ] Menu dims when widget active
- [ ] Menu restores when widget inactive

---

### Step 4: Test Widget with WidgetDataManager (1 day)

**Test data flow:**

```javascript
// In browser console:

// 1. Test widget registration
const widgetDataManager = window.widgetDataManager;
const calendarIframe = document.getElementById('widget-calendar');
widgetDataManager.registerWidget('calendar', calendarIframe);

// 2. Send test events
const testEvents = [
    {
        summary: 'Test Event 1',
        start: { dateTime: new Date().toISOString() },
        end: { dateTime: new Date(Date.now() + 3600000).toISOString() }
    }
];

widgetDataManager.sendToWidget('calendar', 'data', {
    dataType: 'events',
    data: testEvents
});

// 3. Verify widget received and rendered events
// Check calendar widget DOM

// 4. Test auto-refresh
widgetDataManager.startAutoRefresh('calendar', 300000); // 5 min
```

**Testing:**
- [ ] WidgetDataManager registers calendar widget
- [ ] Widget receives calendar events
- [ ] Widget renders events correctly
- [ ] Auto-refresh works
- [ ] 'widget-ready' event handled
- [ ] Data updates when calendars enabled/disabled
- [ ] No errors in console

---

### 4.5 Success Criteria

- [ ] Calendar widget migrated from legacy
- [ ] 3-state model (UNFOCUSED → FOCUSED → ACTIVE) implemented
- [ ] Focus menu system working
- [ ] Widget receives and renders events
- [ ] Navigation works (up/down/left/right)
- [ ] View switching works (week/month)
- [ ] "Go to Today" action works
- [ ] Home position pattern implemented
- [ ] WidgetDataManager integration complete
- [ ] All legacy functionality preserved
- [ ] No regressions
- [ ] Fire TV compatibility maintained

**Estimated Time:** 5-6 days

---

## 4.6: Widget Lifecycle & System Verification

**Goal:** Verify widget lifecycle is properly implemented in all widgets, test input routing, and verify theme system.

### Step 1: Verify Widget Lifecycle in Existing Widgets (1-2 days)

**Widgets to verify:**
- Clock widget ([clock.js](../../js/widgets/clock/clock.js))
- Header widget ([header.js](../../js/widgets/header/header.js))
- Calendar widget (newly migrated in 4.5)

**For each widget, verify:**

1. **3-State Model Implementation**
   ```javascript
   // Each widget should have:
   this.hasFocus = false;  // FOCUSED state
   this.isActive = false;  // ACTIVE state

   // And handle transitions:
   handleEnterFocus() { this.hasFocus = true; }
   handleEnterActive() { this.isActive = true; }
   handleExitActive() { this.isActive = false; }
   handleExitFocus() { this.hasFocus = false; }
   ```

2. **Message Handling**
   ```javascript
   // Widget should handle:
   window.addEventListener('message', (event) => {
       // State transitions
       // Data updates
       // Commands (only when active)
       // Menu actions (if has focus menu)
   });
   ```

3. **Ready Signal**
   ```javascript
   // Widget sends on load:
   window.parent.postMessage({
       type: 'widget-ready',
       widget: 'widget-id'
   }, '*');
   ```

**Fix any issues found:**

- Clock widget: Add state transitions if missing
- Header widget: Add state transitions if missing
- Calendar widget: Already implemented in 4.5

**Testing:**
- [ ] Clock widget implements 3-state model
- [ ] Header widget implements 3-state model
- [ ] Calendar widget implements 3-state model
- [ ] All widgets send 'widget-ready' event
- [ ] All widgets handle state transitions
- [ ] Widgets ignore navigation when not active
- [ ] No console errors

---

### Step 2: Test Input Handler & ActionRouter (1 day)

**Test input normalization:**

```javascript
// In browser console:

// 1. Test InputHandler normalizes keyboard input
window.InputHandler.getSupportedActions();
// Should return: ['up', 'down', 'left', 'right', 'enter', 'escape', 'menu', ...]

// Press arrow keys and verify logs show normalized actions

// 2. Test ActionRouter routes to correct module
window.ActionRouter.getRegisteredModules();
// Should show: ['dashboard', 'settings', 'modals']

// 3. Test module transitions
window.AppStateManager.setCurrentModule('settings');
// Press keys → should route to Settings input handler

window.AppStateManager.setCurrentModule('dashboard');
// Press keys → should route to Dashboard input handler
```

**Test scenarios:**

1. **Dashboard module active**
   - Arrow keys → grid navigation
   - Menu key → sidebar opens
   - Enter → widget focuses

2. **Settings module active**
   - Arrow keys → field navigation
   - Enter → activates field
   - Escape → closes settings

3. **Modal active**
   - Arrow keys → button navigation
   - Enter → activates button
   - Escape → closes modal

4. **Widget active**
   - Arrow keys → widget navigation
   - Escape → return to menu
   - Widget sends 'return-to-menu' → Dashboard takes over

**Testing:**
- [ ] InputHandler normalizes all input types
- [ ] ActionRouter routes to correct module
- [ ] Module transitions work smoothly
- [ ] Input handled correctly in each module
- [ ] Widgets receive commands only when active
- [ ] No input leakage between modules
- [ ] No console errors

---

### Step 3: Test Theme System (1 day)

**Test theme persistence:**

```javascript
// In browser console:

// 1. Test theme change
await window.settingsService.set('theme', 'dark');
await window.settingsService.save();

// 2. Verify DOM update
document.body.dataset.theme; // Should be 'dark'

// 3. Verify widgets receive update
// Check widget DOM (should have dark theme)

// 4. Reload page
location.reload();

// 5. After reload, verify theme persisted
document.body.dataset.theme; // Should still be 'dark'

// 6. Test theme toggle
window.themeApplier.applyTheme('light');
document.body.dataset.theme; // Should be 'light'

// 7. Test broadcast
import AppComms from './js/core/app-comms.js';
AppComms.subscribe(AppComms.events.THEME_CHANGED, (data) => {
    console.log('Theme changed event:', data);
});

window.themeApplier.applyTheme('dark');
// Should see event logged
```

**Test widget theme updates:**

```javascript
// Open browser DevTools → Check widget iframes

// Clock widget:
const clockIframe = document.getElementById('widget-clock');
const clockDoc = clockIframe.contentDocument;
clockDoc.body.dataset.theme; // Should match main app theme

// Calendar widget:
const calIframe = document.getElementById('widget-calendar');
const calDoc = calIframe.contentDocument;
calDoc.body.dataset.theme; // Should match main app theme

// Change theme and verify all widgets update
```

**Testing:**
- [ ] Theme changes apply to document.body
- [ ] Theme changes persist across reloads
- [ ] THEME_CHANGED event published
- [ ] All widgets receive theme updates
- [ ] Widget themes sync with main app
- [ ] Dark/light mode switching works
- [ ] No visual glitches during theme change
- [ ] No console errors

---

### 4.6 Success Criteria

- [ ] All widgets implement 3-state model correctly
- [ ] Widget lifecycle verified and working
- [ ] InputHandler normalizes all input types
- [ ] ActionRouter routes to correct modules
- [ ] Module transitions work smoothly
- [ ] Theme system working and persistent
- [ ] Theme broadcasts to all widgets
- [ ] All tests documented and passing
- [ ] No regressions found
- [ ] No console errors

**Estimated Time:** 3-4 days

---

## 4.7: Test Modals - Logout Screen

**Goal:** Test the Modals module with a practical use case: logout confirmation screen.

### Step 1: Build Logout Confirmation Modal (1 day)

**Add logout method to Modals module:**

```javascript
// js/modules/Modals/modals.js

async showLogoutConfirmation() {
    logger.info('Showing logout confirmation');

    return this.showConfirmation({
        title: 'Sign Out',
        message: 'Are you sure you want to sign out?\n\nYou\'ll need to sign in again to access your dashboard.',
        icon: '🚪',
        confirmText: 'Sign Out',
        cancelText: 'Cancel',
        confirmDanger: true // Red button for destructive action
    });
}
```

**Update modals-ui-renderer.js to support icons:**

```javascript
// js/modules/Modals/modals-ui-renderer.js

renderConfirmation(config) {
    const html = `
        <div class="modal-overlay" id="modal-overlay">
            <div class="modal">
                <div class="modal__content">
                    ${config.icon ? `<div class="modal__icon">${config.icon}</div>` : ''}
                    <h2 class="modal__title">${config.title}</h2>
                    <p class="modal__message">${config.message}</p>
                    <div class="modal__actions">
                        <button
                            class="modal__button modal__button--confirm ${config.confirmDanger ? 'modal__button--danger' : ''}"
                            data-action="confirm"
                            tabindex="1"
                        >
                            ${config.confirmText}
                        </button>
                        <button
                            class="modal__button modal__button--cancel"
                            data-action="cancel"
                            tabindex="2"
                        >
                            ${config.cancelText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
}
```

**Add danger button style to modals.css:**

```css
/* css/modules/modals.css */

.modal__button--danger {
    background: #dc3545;
    color: white;
}

.modal__button--danger:hover {
    background: #c82333;
}

.modal__button--danger:focus {
    outline: 3px solid #ffaa00;
    box-shadow: 0 0 15px rgba(255, 170, 0, 0.5);
}
```

**Testing:**
- [ ] Logout modal renders correctly
- [ ] Icon displays
- [ ] Confirm button is red (danger style)
- [ ] Message displays correctly
- [ ] Modal styling looks good

---

### Step 2: Add Logout Trigger in Dashboard (1 day)

**Add logout option to Dashboard sidebar menu:**

```javascript
// js/modules/Dashboard/dashboard-widget-config.js or dashboard.js

// Add to sidebar menu items:
{
    id: 'logout',
    label: 'Sign Out',
    icon: '🚪',
    action: 'logout'
}
```

**Handle logout menu action:**

```javascript
// js/modules/Dashboard/dashboard-navigation-manager.js

async handleMenuAction(menuItem) {
    if (menuItem.action === 'logout') {
        logger.info('Logout menu item selected');

        // Import modals
        const modals = (await import('../Modals/modals.js')).default;

        // Show confirmation
        const confirmed = await modals.showLogoutConfirmation();

        if (confirmed) {
            await this.performLogout();
        }
    }
}

async performLogout() {
    logger.info('Performing logout');

    try {
        // Sign out via SessionManager
        await window.sessionManager.signOut();

        // Reload page (will show login screen)
        window.location.reload();

    } catch (error) {
        logger.error('Logout failed', error);
        alert('Failed to sign out. Please try again.');
    }
}
```

**Testing:**
- [ ] Logout menu item appears in sidebar
- [ ] Clicking logout opens confirmation modal
- [ ] D-pad navigation works in modal
- [ ] "Sign Out" button works
- [ ] "Cancel" button works
- [ ] Confirming signs out and reloads to login screen
- [ ] Canceling returns to dashboard
- [ ] No console errors

---

### Step 3: Test Modal Navigation (1 day)

**Test D-pad navigation in modal:**

1. **Test button focus**
   ```javascript
   // Open logout modal
   // Verify:
   // - Confirm button has initial focus
   // - Button has orange focus outline
   ```

2. **Test left/right navigation**
   ```javascript
   // Press right arrow
   // - Focus moves to Cancel button

   // Press left arrow
   // - Focus moves back to Confirm button
   ```

3. **Test enter key**
   ```javascript
   // Focus on Confirm button
   // Press Enter
   // - Modal closes
   // - Logout happens

   // Focus on Cancel button
   // Press Enter
   // - Modal closes
   // - No logout
   ```

4. **Test escape key**
   ```javascript
   // Open modal
   // Press Escape
   // - Modal closes
   // - No logout (same as cancel)
   ```

**Testing:**
- [ ] Initial focus on confirm button
- [ ] Focus outline visible (orange)
- [ ] Left/right arrow navigation works
- [ ] Enter activates focused button
- [ ] Escape closes modal (cancel)
- [ ] Modal manager handles navigation correctly
- [ ] No console errors

---

### Step 4: Test Modal Overlay Click (1 day)

**Test click-to-close functionality:**

```javascript
// Add overlay click handler in modals-ui-renderer.js

const overlay = document.getElementById('modal-overlay');
overlay.addEventListener('click', (e) => {
    // Only close if clicking overlay, not modal content
    if (e.target === overlay) {
        this.close();
    }
});
```

**Testing:**
- [ ] Clicking outside modal closes it (cancel)
- [ ] Clicking inside modal does NOT close it
- [ ] Overlay background dims dashboard
- [ ] Modal centered correctly
- [ ] Z-index correct (modal above dashboard)

---

### 4.7 Success Criteria

- [ ] Logout confirmation modal implemented
- [ ] Logout triggers from dashboard menu
- [ ] Modal D-pad navigation working
- [ ] Confirm/cancel buttons work correctly
- [ ] Escape key cancels modal
- [ ] Overlay click closes modal
- [ ] Actual logout works (signs out, reloads to login)
- [ ] Modal styling looks good
- [ ] No regressions in dashboard
- [ ] No console errors

**Estimated Time:** 3-4 days

---

## 4.8: Agenda Widget Migration

**Goal:** Migrate the Agenda widget from `.legacy/widgets/agenda/` and integrate event details modal.

### Step 1: Copy Legacy Agenda Widget (1 day)

**Copy files from legacy:**

```bash
cp -r .legacy/widgets/agenda/* js/widgets/agenda/

# Files:
# - index.html → agenda.html
# - agenda.js → agenda.js
# - styles.css → agenda.css
```

**Review agenda widget:**
- Displays upcoming events in list format
- Shows event details on selection
- May have different view modes

**Testing:**
- [ ] Files copied
- [ ] Structure reviewed
- [ ] Notes taken on event details handling

---

### Step 2: Adapt Agenda Widget to New Architecture (2 days)

**Similar to Calendar widget, implement:**

```javascript
// js/widgets/agenda/agenda.js

class AgendaWidget {
    constructor() {
        // 3-state model
        this.hasFocus = false;
        this.isActive = false;

        // Data
        this.events = [];
        this.selectedEventIndex = 0;

        // Focus menu
        this.focusMenuConfig = {
            hasFocusMenu: true,
            menuItems: [
                { id: 'view-upcoming', label: 'Upcoming', type: 'view', active: true },
                { id: 'view-all', label: 'All Events', type: 'view', active: false }
            ]
        };
    }

    // ... implement same pattern as Calendar widget
    // - State transitions
    // - Message handling
    // - Navigation (up/down to select events)
    // - Enter to view event details
}
```

**Testing:**
- [ ] Agenda widget loads
- [ ] 3-state model implemented
- [ ] Widget receives events
- [ ] Events render in list format
- [ ] Up/down navigation selects events
- [ ] Selected event highlighted

---

### Step 3: Build Event Details Modal (2 days)

**Add event details modal to Modals module:**

```javascript
// js/modules/Modals/modals.js

async showEventDetails(event) {
    logger.info('Showing event details', { event });

    return new Promise((resolve) => {
        ModalUIRenderer.renderEventDetails(event);
        ModalInputHandler.activate({
            onClose: () => {
                ModalUIRenderer.hide();
                resolve();
            }
        });
    });
}
```

**Create event details renderer:**

```javascript
// js/modules/Modals/modals-ui-renderer.js

renderEventDetails(event) {
    const startTime = this.formatEventTime(event.start);
    const endTime = this.formatEventTime(event.end);
    const isAllDay = !event.start.dateTime;

    const html = `
        <div class="modal-overlay" id="modal-overlay">
            <div class="modal modal--event-details">
                <div class="modal__content">
                    <h2 class="modal__title">${event.summary || 'Untitled Event'}</h2>

                    <div class="event-details">
                        <div class="event-details__row">
                            <span class="event-details__label">📅 Date:</span>
                            <span class="event-details__value">${this.formatEventDate(event.start)}</span>
                        </div>

                        ${!isAllDay ? `
                            <div class="event-details__row">
                                <span class="event-details__label">🕐 Time:</span>
                                <span class="event-details__value">${startTime} - ${endTime}</span>
                            </div>
                        ` : `
                            <div class="event-details__row">
                                <span class="event-details__label">🕐 Time:</span>
                                <span class="event-details__value">All Day</span>
                            </div>
                        `}

                        ${event.location ? `
                            <div class="event-details__row">
                                <span class="event-details__label">📍 Location:</span>
                                <span class="event-details__value">${event.location}</span>
                            </div>
                        ` : ''}

                        ${event.description ? `
                            <div class="event-details__row event-details__row--description">
                                <span class="event-details__label">📝 Description:</span>
                                <p class="event-details__description">${event.description}</p>
                            </div>
                        ` : ''}

                        ${event.attendees && event.attendees.length > 0 ? `
                            <div class="event-details__row">
                                <span class="event-details__label">👥 Attendees:</span>
                                <ul class="event-details__attendees">
                                    ${event.attendees.map(a => `<li>${a.email}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>

                    <div class="modal__actions">
                        <button class="modal__button modal__button--primary" data-action="close" tabindex="1">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
}

formatEventTime(dateObj) {
    if (dateObj.dateTime) {
        const date = new Date(dateObj.dateTime);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }
    return '';
}

formatEventDate(dateObj) {
    const date = new Date(dateObj.dateTime || dateObj.date);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}
```

**Add styling for event details modal:**

```css
/* css/modules/modals.css */

.modal--event-details {
    max-width: 600px;
}

.event-details {
    margin: 20px 0;
    text-align: left;
}

.event-details__row {
    margin-bottom: 15px;
    display: flex;
    gap: 10px;
}

.event-details__row--description {
    flex-direction: column;
}

.event-details__label {
    font-weight: bold;
    min-width: 100px;
    color: var(--color-text-secondary);
}

.event-details__value {
    color: var(--color-text-primary);
}

.event-details__description {
    margin-top: 8px;
    padding: 10px;
    background: var(--color-bg-tertiary);
    border-radius: 4px;
    white-space: pre-wrap;
}

.event-details__attendees {
    list-style: none;
    margin: 8px 0 0 0;
    padding: 0;
}

.event-details__attendees li {
    padding: 4px 0;
}
```

**Testing:**
- [ ] Event details modal renders
- [ ] All event fields display correctly
- [ ] All-day events show "All Day"
- [ ] Timed events show start/end time
- [ ] Location displays if present
- [ ] Description displays if present
- [ ] Attendees display if present
- [ ] Close button works
- [ ] Modal styling looks good

---

### Step 4: Connect Agenda Widget to Event Details Modal (1 day)

**Handle Enter key in Agenda widget:**

```javascript
// js/widgets/agenda/agenda.js

handleEnter() {
    if (this.events.length === 0) return;

    const selectedEvent = this.events[this.selectedEventIndex];
    logger.info('Opening event details', { event: selectedEvent });

    // Send event to parent to open modal
    this.sendEvent('open-event-details', { event: selectedEvent });
}
```

**Handle event details request in Dashboard:**

```javascript
// js/modules/Dashboard/dashboard-navigation-manager.js or dashboard.js

// Listen for widget events
AppComms.subscribe(AppComms.events.WIDGET_MESSAGE, async (data) => {
    if (data.payload.eventType === 'open-event-details') {
        const event = data.payload.data.event;

        // Import modals
        const modals = (await import('../Modals/modals.js')).default;

        // Show event details
        await modals.showEventDetails(event);
    }
});
```

**Testing:**
- [ ] Selecting event in Agenda widget works
- [ ] Pressing Enter opens event details modal
- [ ] Event details display correctly
- [ ] Closing modal returns to Agenda widget
- [ ] Widget remains active after modal closes
- [ ] No console errors

---

### 4.8 Success Criteria

- [ ] Agenda widget migrated and working
- [ ] 3-state model implemented
- [ ] Widget lists upcoming events
- [ ] Up/down navigation selects events
- [ ] Event details modal built and styled
- [ ] Enter key opens event details
- [ ] Event details show all information
- [ ] Modal navigation works (D-pad)
- [ ] Close button returns to Agenda widget
- [ ] All legacy functionality preserved
- [ ] Fire TV compatibility maintained

**Estimated Time:** 5-6 days

---

## 4.9: Account Settings & Delete Account

**Goal:** Build the Account settings page with functional delete account feature.

### Step 1: Create Account Settings Page (1-2 days)

**Create account settings page file:**

```javascript
// js/modules/Settings/pages/settings-account-page.js

import { createLogger } from '../../../utils/logger.js';
import { sessionManager } from '../../../data/auth/orchestration/session-manager.js';
import SettingsScreenBase from '../core/settings-screen-base.js';

const logger = createLogger('AccountSettingsPage');

export default class AccountSettingsPage extends SettingsScreenBase {
    constructor() {
        super('account', 'Account Settings');
        this.user = null;
    }

    async onInit() {
        logger.info('Initializing account settings page');
        this.user = sessionManager.getUser();
    }

    async render() {
        if (!this.user) {
            return '<p class="settings-error">No user information available.</p>';
        }

        let html = '<div class="settings-page settings-account-page">';
        html += '<h2>Account Settings</h2>';

        // User information
        html += '<div class="account-info">';
        html += `<div class="account-info__row">`;
        html += `<span class="account-info__label">Name:</span>`;
        html += `<span class="account-info__value">${this.user.name || 'N/A'}</span>`;
        html += `</div>`;

        html += `<div class="account-info__row">`;
        html += `<span class="account-info__label">Email:</span>`;
        html += `<span class="account-info__value">${this.user.email || 'N/A'}</span>`;
        html += `</div>`;

        html += `<div class="account-info__row">`;
        html += `<span class="account-info__label">Provider:</span>`;
        html += `<span class="account-info__value">${this.user.provider || 'Google'}</span>`;
        html += `</div>`;

        html += `<div class="account-info__row">`;
        html += `<span class="account-info__label">User ID:</span>`;
        html += `<span class="account-info__value account-info__value--mono">${this.user.id || 'N/A'}</span>`;
        html += `</div>`;
        html += '</div>';

        // Danger zone
        html += '<div class="settings-danger-zone">';
        html += '<h3>Danger Zone</h3>';
        html += '<p class="settings-warning">⚠️ The following actions are permanent and cannot be undone.</p>';

        html += `
            <button class="settings-button settings-button--danger" id="delete-account-btn" tabindex="1">
                🗑️ Delete Account
            </button>
        `;

        html += '</div>';
        html += '</div>';

        return html;
    }

    async onAttach() {
        const deleteBtn = document.getElementById('delete-account-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.handleDeleteAccount());
        }
    }

    async handleDeleteAccount() {
        logger.warn('Delete account initiated');

        // Import modals for confirmation
        const modals = (await import('../../Modals/modals.js')).default;

        // First confirmation
        const confirmed = await modals.showConfirmation({
            title: 'Delete Account?',
            message: 'This will permanently delete your Dashie account and all associated data.\n\nThis action cannot be undone.\n\nAre you sure?',
            icon: '⚠️',
            confirmText: 'Yes, Delete My Account',
            cancelText: 'Cancel',
            confirmDanger: true
        });

        if (!confirmed) {
            logger.info('Account deletion cancelled (first prompt)');
            return;
        }

        // Second confirmation (extra safety)
        const doubleConfirmed = await modals.showConfirmation({
            title: 'Final Confirmation',
            message: `Type your email address to confirm:\n${this.user.email}\n\nThis action is permanent and irreversible.`,
            icon: '🚨',
            confirmText: 'I Understand, Delete Account',
            cancelText: 'Cancel',
            confirmDanger: true,
            requireEmailConfirmation: true,
            expectedEmail: this.user.email
        });

        if (!doubleConfirmed) {
            logger.info('Account deletion cancelled (second prompt)');
            return;
        }

        // Perform deletion
        await this.performAccountDeletion();
    }

    async performAccountDeletion() {
        logger.warn('Performing account deletion');

        try {
            // Show loading state
            const deleteBtn = document.getElementById('delete-account-btn');
            if (deleteBtn) {
                deleteBtn.disabled = true;
                deleteBtn.textContent = 'Deleting Account...';
            }

            // Call account deletion service
            const edgeClient = sessionManager.getEdgeClient();
            await edgeClient.deleteAccount(this.user.id);

            logger.success('Account deleted successfully');

            // Sign out
            await sessionManager.signOut();

            // Show success message
            alert('Your account has been deleted successfully.\n\nYou will now be signed out.');

            // Reload to login screen
            window.location.reload();

        } catch (error) {
            logger.error('Failed to delete account', error);

            // Show error
            alert(`Failed to delete account:\n${error.message}\n\nPlease contact support if this problem persists.`);

            // Re-enable button
            const deleteBtn = document.getElementById('delete-account-btn');
            if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.textContent = '🗑️ Delete Account';
            }
        }
    }
}
```

**Add account deletion to EdgeClient:**

```javascript
// js/data/auth/edge-client.js

async deleteAccount(userId) {
    logger.warn('Deleting account', { userId });

    try {
        const response = await fetch(`${this.edgeFunctionUrl}/account-deletion`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await this.getValidJWT()}`
            },
            body: JSON.stringify({ userId })
        });

        if (!response.ok) {
            throw new Error(`Account deletion failed: ${response.statusText}`);
        }

        const result = await response.json();
        logger.success('Account deleted', result);

        return result;

    } catch (error) {
        logger.error('Account deletion error', error);
        throw error;
    }
}
```

**Create account deletion edge function:**

```typescript
// supabase/functions/account-deletion/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
    try {
        // Get JWT from Authorization header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response('Unauthorized', { status: 401 });
        }

        const jwt = authHeader.replace('Bearer ', '');

        // Create Supabase client with JWT
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        // Verify JWT and get user
        const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
        if (authError || !user) {
            return new Response('Unauthorized', { status: 401 });
        }

        // Get request body
        const { userId } = await req.json();

        // Verify user is deleting their own account
        if (user.id !== userId) {
            return new Response('Forbidden', { status: 403 });
        }

        console.log(`Deleting account for user: ${userId}`);

        // Delete user data (RLS will ensure user can only delete their own data)
        const { error: settingsError } = await supabase
            .from('user_settings')
            .delete()
            .eq('user_id', userId);

        const { error: tokensError } = await supabase
            .from('user_auth_tokens')
            .delete()
            .eq('user_id', userId);

        // Delete user account from auth.users
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

        if (deleteError) {
            console.error('Failed to delete user:', deleteError);
            return new Response(JSON.stringify({ error: deleteError.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log(`Account deleted successfully: ${userId}`);

        return new Response(JSON.stringify({
            success: true,
            message: 'Account deleted successfully'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Account deletion error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});
```

**Testing:**
- [ ] Account settings page renders
- [ ] User information displays correctly
- [ ] Delete account button appears
- [ ] Button is styled as danger (red)
- [ ] Page loads without errors

---

### Step 2: Test Account Deletion Flow (1 day)

**Test deletion process:**

1. **First confirmation**
   - Click "Delete Account"
   - Verify warning modal appears
   - Verify message is clear and scary
   - Test "Cancel" → modal closes, nothing deleted

2. **Second confirmation**
   - Click "Delete Account"
   - Confirm first modal
   - Verify second modal appears
   - Test "Cancel" → modal closes, nothing deleted

3. **Actual deletion**
   - Click "Delete Account"
   - Confirm both modals
   - Verify deletion happens
   - Verify success message
   - Verify sign out
   - Verify redirect to login screen

4. **Data verification**
   - Check Supabase database
   - Verify user_settings deleted
   - Verify user_auth_tokens deleted
   - Verify auth.users entry deleted

**Testing:**
- [ ] First confirmation modal works
- [ ] Second confirmation modal works
- [ ] Cancel works at both prompts
- [ ] Deletion edge function works
- [ ] All user data deleted from database
- [ ] User signed out after deletion
- [ ] Redirect to login screen works
- [ ] Can't log back in with deleted account
- [ ] No console errors

---

### Step 3: Register Account Settings Page (1 day)

**Register in Settings module:**

```javascript
// js/modules/Settings/settings.js or settings-orchestrator.js

import AccountSettingsPage from './pages/settings-account-page.js';

// Register page
this.pages.set('account', new AccountSettingsPage());
```

**Add to settings menu:**

```javascript
// Settings navigation menu
const menuItems = [
    { id: 'family', label: 'Family Settings', icon: '👨‍👩‍👧‍👦' },
    { id: 'display', label: 'Display Settings', icon: '🎨' },
    { id: 'calendar', label: 'Calendar Settings', icon: '📅' },
    { id: 'photos', label: 'Photos Settings', icon: '📷' },
    { id: 'system', label: 'System Settings', icon: '⚙️' },
    { id: 'account', label: 'Account Settings', icon: '👤' } // NEW
];
```

**Testing:**
- [ ] Account settings appears in Settings menu
- [ ] Clicking menu item navigates to Account page
- [ ] Page renders correctly when opened
- [ ] Navigation back to menu works
- [ ] No console errors

---

### 4.9 Success Criteria

- [ ] Account settings page built and working
- [ ] User information displays correctly
- [ ] Delete account button implemented
- [ ] Double-confirmation flow working
- [ ] Account deletion edge function deployed
- [ ] Actual account deletion works
- [ ] All user data removed from database
- [ ] Sign out after deletion
- [ ] Redirect to login screen
- [ ] Page registered in Settings module
- [ ] Accessible from Settings menu
- [ ] No console errors

**Estimated Time:** 3-4 days

---

## 4.10: Token Storage & Refresh Testing

**Goal:** Verify that auth tokens are stored separately from user settings and that token refresh works correctly.

### Step 1: Verify Token Storage Separation (1 day)

**Check current token storage:**

```javascript
// In browser console:

// 1. Check localStorage keys
Object.keys(localStorage);
// Should show:
// - 'dashie-settings' (user settings)
// - 'dashie-auth-tokens' (auth tokens - SEPARATE)

// 2. Inspect settings
const settings = JSON.parse(localStorage.getItem('dashie-settings'));
console.log('Settings:', settings);
// Should NOT contain tokenAccounts or auth tokens

// 3. Inspect auth tokens
const tokens = JSON.parse(localStorage.getItem('dashie-auth-tokens'));
console.log('Auth tokens:', tokens);
// Should contain:
// {
//   'google/primary': { access_token, refresh_token, expires_at, ... },
//   'google/account2': { ... }
// }

// 4. Verify Supabase separation
const edgeClient = window.edgeClient;

const dbSettings = await edgeClient.loadSettings();
console.log('DB Settings:', dbSettings);
// Should NOT contain tokens

const dbTokens = await edgeClient.loadTokens();
console.log('DB Tokens:', dbTokens);
// Should contain auth tokens
```

**Verify token operations don't affect settings:**

```javascript
// Change a setting
await window.settingsService.set('theme', 'dark');
await window.settingsService.save();

// Verify tokens unchanged
const tokens = JSON.parse(localStorage.getItem('dashie-auth-tokens'));
console.log('Tokens still intact:', tokens);

// Add a calendar account (gets new tokens)
// ... add account2 ...

// Verify settings unchanged
const settings = JSON.parse(localStorage.getItem('dashie-settings'));
console.log('Settings still intact:', settings);
```

**Testing:**
- [ ] localStorage has separate keys for settings and tokens
- [ ] Settings object does NOT contain tokens
- [ ] Tokens object does NOT contain settings
- [ ] Supabase has separate tables
- [ ] Changing settings doesn't affect tokens
- [ ] Adding accounts doesn't affect settings
- [ ] Dual-write pattern works for both

---

### Step 2: Test Token Refresh (1 day)

**Test automatic token refresh:**

```javascript
// In browser console:

// 1. Get current token info
const tokenStore = window.sessionManager.getTokenStore();
const primaryToken = await tokenStore.getAccountTokens('google', 'primary');

console.log('Current token:', {
    expires_at: primaryToken.expires_at,
    expiresIn: (new Date(primaryToken.expires_at) - new Date()) / 1000 / 60, // minutes
    refreshToken: primaryToken.refresh_token ? 'present' : 'missing'
});

// 2. Check if token needs refresh
const expiresAt = new Date(primaryToken.expires_at);
const now = new Date();
const minutesUntilExpiry = (expiresAt - now) / 1000 / 60;

console.log(`Token expires in ${minutesUntilExpiry.toFixed(2)} minutes`);

// 3. Force token refresh (if needed)
const edgeClient = window.edgeClient;
await edgeClient.invalidateTokenCache('google', 'primary');

// 4. Get calendar data (will trigger refresh if expired)
const calendarService = window.calendarService;
const calendars = await calendarService.getCalendars('primary');

// 5. Check if token was refreshed
const newToken = await tokenStore.getAccountTokens('google', 'primary');
console.log('New token:', {
    expires_at: newToken.expires_at,
    wasRefreshed: newToken.expires_at !== primaryToken.expires_at
});
```

**Test token refresh edge cases:**

1. **Test expired token**
   ```javascript
   // Manually expire token in localStorage
   const tokens = JSON.parse(localStorage.getItem('dashie-auth-tokens'));
   tokens['google/primary'].expires_at = new Date(Date.now() - 1000).toISOString();
   localStorage.setItem('dashie-auth-tokens', JSON.stringify(tokens));

   // Try to fetch calendar data
   const calendars = await calendarService.getCalendars('primary');

   // Should trigger refresh automatically
   ```

2. **Test refresh token missing**
   ```javascript
   // Remove refresh token
   const tokens = JSON.parse(localStorage.getItem('dashie-auth-tokens'));
   delete tokens['google/primary'].refresh_token;
   localStorage.setItem('dashie-auth-tokens', JSON.stringify(tokens));

   // Try to fetch data
   // Should fail and prompt re-authentication
   ```

**Testing:**
- [ ] Token refresh works when token expired
- [ ] Refresh updates localStorage
- [ ] Refresh updates Supabase
- [ ] New token has later expires_at
- [ ] Token cache invalidation works
- [ ] Missing refresh token handled gracefully
- [ ] Multiple account tokens refreshed independently
- [ ] No console errors

---

### Step 3: Test Token Persistence Across Sessions (1 day)

**Test token persistence:**

1. **Before reload**
   ```javascript
   // Get current token
   const token = await tokenStore.getAccountTokens('google', 'primary');
   console.log('Token before reload:', token.expires_at);
   ```

2. **Reload page**
   ```javascript
   location.reload();
   ```

3. **After reload**
   ```javascript
   // Check token restored
   const token = await tokenStore.getAccountTokens('google', 'primary');
   console.log('Token after reload:', token.expires_at);
   // Should match pre-reload token
   ```

4. **Test Supabase fallback**
   ```javascript
   // Clear localStorage
   localStorage.removeItem('dashie-auth-tokens');

   // Reload
   location.reload();

   // After reload, verify tokens loaded from Supabase
   const token = await tokenStore.getAccountTokens('google', 'primary');
   console.log('Token from Supabase:', token.expires_at);
   ```

**Testing:**
- [ ] Tokens persist across page reloads
- [ ] Tokens load from localStorage first
- [ ] Fallback to Supabase works
- [ ] All account tokens restored
- [ ] No re-authentication required
- [ ] Calendar data loads without errors

---

### Step 4: Test Token Cleanup on Sign Out (1 day)

**Test sign-out clears tokens:**

```javascript
// 1. Before sign out
const tokens = JSON.parse(localStorage.getItem('dashie-auth-tokens'));
console.log('Tokens before sign out:', Object.keys(tokens));

// 2. Sign out
await window.sessionManager.signOut();

// 3. After sign out
const tokensAfter = localStorage.getItem('dashie-auth-tokens');
console.log('Tokens after sign out:', tokensAfter); // Should be null or {}

// 4. Verify Supabase tokens cleared
// (would need to check database directly)
```

**Testing:**
- [ ] Sign out clears localStorage tokens
- [ ] Sign out clears Supabase tokens
- [ ] Settings preserved (NOT cleared)
- [ ] Re-login creates new tokens
- [ ] No orphaned tokens remain

---

### 4.10 Success Criteria

- [ ] Tokens stored separately from settings (localStorage + Supabase)
- [ ] Separate keys: 'dashie-settings' and 'dashie-auth-tokens'
- [ ] Settings operations don't affect tokens
- [ ] Token operations don't affect settings
- [ ] Token refresh works automatically
- [ ] Expired tokens refreshed on API calls
- [ ] Token cache invalidation works
- [ ] Tokens persist across page reloads
- [ ] Fallback from localStorage to Supabase works
- [ ] Sign out clears all tokens
- [ ] Re-authentication creates new tokens
- [ ] Multi-account tokens managed independently
- [ ] No console errors
- [ ] Documentation updated

**Estimated Time:** 4 days

---

## Phase 4 Complete! 🎉

### Overall Success Criteria

- [ ] index.html clean (~100 lines, no inline JS/CSS)
- [ ] Login module built and working
- [ ] Settings service verified with EdgeClient
- [ ] Calendar service complete with account-prefixed IDs
- [ ] Calendar settings page working with multi-accounts
- [ ] Calendar widget migrated and functional
- [ ] Widget lifecycle verified in all widgets
- [ ] Input routing and theme system tested
- [ ] Modals working (logout confirmation)
- [ ] Agenda widget migrated with event details modal
- [ ] Account settings page built
- [ ] Delete account functionality working
- [ ] Token storage separation verified
- [ ] Token refresh tested and working
- [ ] All tests passing
- [ ] No regressions
- [ ] Fire TV compatibility maintained
- [ ] Documentation complete

**Total Estimated Time:** 3-4 weeks

---

## Next Steps

After completing Phase 4, proceed to **Phase 5: Welcome & Photos** to:
- Migrate Welcome wizard
- Build Photos widget and service
- Complete remaining settings pages
- Finalize all legacy migrations

---

**End of Phase 4 Build Plan**
