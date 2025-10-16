# Build Strategy - Implementation Guide

**Version:** 2.0
**Date:** 2025-10-15
**Status:** Ready for Implementation

---

## Table of Contents
1. [Overview](#overview)
2. [Build Phases](#build-phases)
3. [Implementation Order](#implementation-order)
4. [Phase 1: Foundation](#phase-1-foundation)
5. [Phase 2: First Module](#phase-2-first-module)
6. [Phase 3: Data Layer](#phase-3-data-layer)
7. [Phase 4: Remaining Modules](#phase-4-remaining-modules)
8. [Phase 5: Refactoring](#phase-5-refactoring)
9. [Phase 6: Testing & Polish](#phase-6-testing--polish)
10. [Testing Strategy](#testing-strategy)
11. [Migration Checklist](#migration-checklist)

---

## Overview

This document provides a **step-by-step guide** to building the new Dashie architecture from the ground up.

### Guiding Principles

1. **Build Incrementally** - One component at a time
2. **Test Early** - Test each component before moving on
3. **Cherry-Pick from Legacy** - Copy working code, refactor as needed
4. **Validate Architecture** - Prove the design works before going all-in
5. **Keep Legacy Running** - Don't break the old app until new app works

### Timeline Estimate

- **Phase 1:** Foundation (Week 1) - 5-7 days
- **Phase 2:** Dashboard Module (Week 2) - 5-7 days
- **Phase 3:** Data Layer (Week 3) - 5-7 days
- **Phase 4:** Remaining Modules (Week 4-5) - 10-14 days
- **Phase 5:** Refactoring (Week 6) - 5-7 days
- **Phase 6:** Testing & Polish (Week 7) - 5-7 days

**Total:** 6-8 weeks for complete rebuild

---

## Build Phases

```
Phase 1: Foundation
    ↓
Phase 2: First Module (Dashboard)
    ↓
Phase 3: Data Layer (Auth, Services, JWT)
    ↓
Phase 4: Remaining Modules (Settings, Login, Modals, Welcome)
    ↓
Phase 5: Refactoring (JWT, Navigation consolidation)
    ↓
Phase 6: Testing & Polish
```

---

## Implementation Order

### Why This Order?

1. **Foundation first** - Core infrastructure everything depends on
2. **Dashboard first** - Simplest module, validates architecture
3. **Data layer next** - Needed by all modules
4. **Settings after data** - Most complex module, needs stable foundation
5. **Refactoring after working** - Don't optimize until it works
6. **Testing throughout** - Test as we build, not at the end

---

## Technical Debt Integration

### High-Priority Fixes (Address During Build)

These items from `.reference/TECHNICAL_DEBT.md` are integrated into the build phases:

#### 1. Multi-Provider Authentication Architecture (Phase 3)
**When:** Days 15-17 (Auth System build)

**Implementation:**
- **Phase 1: Token Optimization (Day 17)** - 2 hours
  - Fix token cache not updating after refresh
  - Fix force refresh not invalidating cache
  - Fix localStorage sync after refresh
  - Integrate into `js/data/auth/jwt/token-cache.js`

- **Phase 2: Two-Layer Architecture (Days 15-17)** - 5 days
  - Create `js/data/auth/account-auth/` folder with base classes
  - Create `js/data/auth/calendar-auth/` folder with base classes
  - Implement `base-account-auth.js` (Layer 1 - user login)
  - Implement `base-calendar-auth.js` (Layer 2 - calendar access)
  - Refactor existing Google code to use new structure
  - **NOTE:** Additional providers (iCloud, Outlook, Amazon) are post-launch

**Deliverables:**
- Two-layer auth architecture supporting future providers
- Google auth refactored to fit new pattern
- Foundation for multi-provider calendar support

---

#### 2. Separate Auth Tokens from Settings (Phase 3)
**When:** Days 18-19 (JWT Service build)

**Implementation:**
- Create `js/data/auth/token-store.js` (separate storage layer)
- Create `user_auth_tokens` table in Supabase
- Store tokens in `dashie-auth-tokens` localStorage key (NOT dashie-settings)
- Update `js/data/auth/jwt/settings-integration.js` to exclude tokens
- Update Supabase edge functions:
  - `supabase/functions/jwt-auth/index.ts` - separate token operations
  - `supabase/functions/database-operations/index.ts` - new table
- Migration: Extract `tokenAccounts` from existing settings, move to new storage

**Deliverables:**
- Auth tokens stored separately from user settings
- Settings changes can't accidentally wipe auth data
- Clean separation of concerns

---

#### 3. Shared Calendar Identification (Phase 3 & 4)
**When:** Days 20-21 (Data Services) + Days 22-28 (Settings Module)

**Implementation:**
- Update `js/data/services/calendar-service.js` (Day 20-21):
  - Implement account-prefixed calendar IDs: `{accountType}-{calendarId}`
  - Add `parsePrefixedId()` and `createPrefixedId()` methods
  - Add `migrateCalendarIds()` for backward compatibility
  - Update `enableCalendar()`, `disableCalendar()` to use prefixes
  - Add `removeAccountCalendars(accountType)` for clean removal
  - Eliminate `calendarAccountMap` workaround

- Update Settings Calendar Page (Day 24-25):
  - Generate prefixed IDs when toggling calendars
  - Store prefixed IDs in `activeCalendarIds` array
  - Remove account from calendar list cleanly by prefix

- Update Calendar Widgets (Day 26):
  - Handle prefixed calendar IDs
  - Strip prefix when calling Google API

**Deliverables:**
- Calendar IDs globally unique even when shared
- Clean account removal (no orphaned calendars)
- Backward compatibility with migration

---

### Medium-Priority Debt (Post-Launch)

#### Settings System Re-Architecture
**Status:** Partially addressed in Phase 4 (Settings Module)

**What's Included:**
- Modular settings pages (domain-based structure)
- Settings store with persistence
- Broadcast manager for widget updates
- Composition over mixin inheritance

**What's Deferred:**
- Full schema validation (Zod)
- Promise-based init (instead of timeouts)
- Complete elimination of calendar service localStorage bypass

**Timeline:** Address remaining items 2-4 weeks post-launch

---

#### Welcome Wizard D-pad Bug
**Status:** Fix during Welcome Module build (Phase 4, Days 34-35)

**Fix:** Add proper event handling to prevent Enter key bubbling between screens

---

### Low-Priority Debt (Future Enhancements)

#### Offline Mode
**Timeline:** 4-8 weeks post-launch
- IndexedDB caching for calendar/photos
- Connection status indicator
- Smart retry logic

#### Already Addressed
✅ **Consolidate Storage Patterns** - config.js provides STORAGE_KEYS
✅ **Settings Default Values** - config.js getDefaultSettings()

---

## Phase 1: Foundation (Week 1)

**Goal:** Build core infrastructure that all modules depend on

### Day 1: Project Setup & Configuration

#### 1.1 Create Folder Structure

```bash
mkdir -p js/core/initialization
mkdir -p js/modules/Dashboard
mkdir -p js/modules/Settings
mkdir -p js/modules/Login
mkdir -p js/modules/Modals
mkdir -p js/modules/Welcome
mkdir -p js/data/auth/jwt
mkdir -p js/data/auth/providers
mkdir -p js/data/services
mkdir -p js/data/database
mkdir -p js/ui/components
mkdir -p js/utils
mkdir -p js/widgets
```

#### 1.2 Create config.js

**Source:** `.legacy/js/config.js`

**Tasks:**
- Copy config.js to root
- Extract Supabase config to `js/data/database/supabase-config.js`
- Extract widget config to appropriate locations
- Keep app version, environment detection, theme in root config.js

**Files to create:**
- `config.js` (root level)
- `js/data/database/supabase-config.js`

**Validation:**
- [ ] Config loads without errors
- [ ] Supabase URLs accessible
- [ ] Environment detection works

---

### Day 2: Core Infrastructure - AppComms

#### 1.3 Build AppComms (Event Bus)

**New file:** `js/core/app-comms.js`

**Implementation:**
```javascript
// Simple pub/sub implementation
class AppComms {
    static subscribers = new Map();

    static subscribe(eventName, callback) {
        if (!this.subscribers.has(eventName)) {
            this.subscribers.set(eventName, []);
        }
        this.subscribers.get(eventName).push(callback);

        // Return unsubscribe function
        return () => this.unsubscribe(eventName, callback);
    }

    static unsubscribe(eventName, callback) {
        if (!this.subscribers.has(eventName)) return;
        const callbacks = this.subscribers.get(eventName);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    static publish(eventName, data) {
        if (!this.subscribers.has(eventName)) return;
        const callbacks = this.subscribers.get(eventName);
        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                logger.error('Error in event subscriber:', error);
            }
        });
    }

    static events = {
        MODULE_CHANGED: 'module:changed',
        STATE_UPDATED: 'state:updated',
        AUTH_STATUS_CHANGED: 'auth:status_changed',
        WIDGET_MESSAGE: 'widget:message',
        THEME_CHANGED: 'theme:changed',
        DATA_UPDATED: 'data:updated',
        SETTINGS_CHANGED: 'settings:changed',
        ERROR_OCCURRED: 'error:occurred'
    }
}

export default AppComms;
```

**Testing:**
```javascript
// Test pub/sub
const unsubscribe = AppComms.subscribe('test', (data) => {
    logger.info('Received:', data);
});

AppComms.publish('test', { message: 'Hello' });
// Should log: "Received: { message: 'Hello' }"

unsubscribe();
AppComms.publish('test', { message: 'Hello again' });
// Should not log anything
```

**Validation:**
- [ ] Subscribe works
- [ ] Publish triggers callbacks
- [ ] Unsubscribe works
- [ ] Multiple subscribers work
- [ ] Errors in one subscriber don't break others

---

### Day 3: Core Infrastructure - AppStateManager

#### 1.4 Build AppStateManager

**New file:** `js/core/app-state-manager.js`

**Source:** Cherry-pick from `.legacy/js/core/state.js`

**Implementation:**
```javascript
import AppComms from './app-comms.js';

class AppStateManager {
    static state = {
        currentModule: null,
        previousModule: null,
        focusContext: null,
        activeWidget: null,
        user: {
            isAuthenticated: false,
            userId: null,
            email: null
        },
        theme: 'dark',
        platform: 'desktop',
        isSleeping: false,
        isInitialized: false
    };

    static async initialize() {
        // Load from localStorage
        const saved = localStorage.getItem('dashie-app-state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.state = { ...this.state, ...parsed };
            } catch (error) {
                logger.error('Failed to load state:', error);
            }
        }

        this.state.isInitialized = true;
        this.publish();
    }

    static getState() {
        return { ...this.state };
    }

    static setState(partialState) {
        this.state = { ...this.state, ...partialState };
        this.persist();
        this.publish();
    }

    static setCurrentModule(moduleName) {
        const previous = this.state.currentModule;
        this.state.previousModule = previous;
        this.state.currentModule = moduleName;

        this.persist();

        AppComms.publish(AppComms.events.MODULE_CHANGED, {
            from: previous,
            to: moduleName
        });

        this.publish();
    }

    static persist() {
        try {
            localStorage.setItem('dashie-app-state', JSON.stringify(this.state));
        } catch (error) {
            logger.error('Failed to persist state:', error);
        }
    }

    static publish() {
        AppComms.publish(AppComms.events.STATE_UPDATED, this.getState());
    }

    static subscribe(callback) {
        return AppComms.subscribe(AppComms.events.STATE_UPDATED, callback);
    }

    // Convenience getters
    static getCurrentModule() {
        return this.state.currentModule;
    }

    static getFocusContext() {
        return this.state.focusContext;
    }

    static setFocusContext(context) {
        this.setState({ focusContext: context });
    }
}

export default AppStateManager;
```

**Testing:**
```javascript
// Test state updates
await AppStateManager.initialize();
logger.info(AppStateManager.getState()); // Should show initial state

AppStateManager.setState({ theme: 'light' });
logger.info(AppStateManager.getState().theme); // Should be 'light'

// Test module change
AppStateManager.setCurrentModule('dashboard');
// Should trigger MODULE_CHANGED event

// Test persistence
AppStateManager.setState({ activeWidget: 'calendar' });
// Check localStorage
const saved = JSON.parse(localStorage.getItem('dashie-app-state'));
logger.info(saved.activeWidget); // Should be 'calendar'
```

**Validation:**
- [ ] State initializes
- [ ] setState updates state
- [ ] State persists to localStorage
- [ ] State loads from localStorage
- [ ] Events publish on changes
- [ ] Subscribers receive updates

---

### Day 4: Core Infrastructure - ActionRouter & WidgetMessenger

#### 1.5 Build ActionRouter

**New file:** `js/core/action-router.js`

**Implementation:**
```javascript
import AppStateManager from './app-state-manager.js';

class ActionRouter {
    static modules = new Map();

    static registerModule(moduleName, inputHandler) {
        this.modules.set(moduleName, inputHandler);
        logger.info(`Module registered: ${moduleName}`);
    }

    static unregisterModule(moduleName) {
        this.modules.delete(moduleName);
        logger.info(`Module unregistered: ${moduleName}`);
    }

    static route(action, data) {
        const currentModule = AppStateManager.getCurrentModule();

        if (!currentModule) {
            logger.warn('No active module');
            return false;
        }

        const handler = this.modules.get(currentModule);

        if (!handler) {
            logger.warn(`No handler registered for module: ${currentModule}`);
            return false;
        }

        const methodName = `handle${action.charAt(0).toUpperCase() + action.slice(1)}`;

        if (typeof handler[methodName] !== 'function') {
            logger.warn(`Handler ${currentModule} has no method: ${methodName}`);
            return false;
        }

        try {
            return handler[methodName](data);
        } catch (error) {
            logger.error(`Error in ${currentModule}.${methodName}:`, error);
            return false;
        }
    }

    static actions = {
        UP: 'up',
        DOWN: 'down',
        LEFT: 'left',
        RIGHT: 'right',
        ENTER: 'enter',
        ESCAPE: 'escape',
        BACK: 'back'
    }
}

export default ActionRouter;
```

**Testing:**
```javascript
// Mock input handler
const mockHandler = {
    handleUp: () => { logger.info('Up pressed'); return true; },
    handleDown: () => { logger.info('Down pressed'); return true; }
};

ActionRouter.registerModule('test', mockHandler);
AppStateManager.setCurrentModule('test');

ActionRouter.route(ActionRouter.actions.UP);
// Should log "Up pressed" and return true
```

**Validation:**
- [ ] Modules register/unregister
- [ ] Routes to correct module
- [ ] Calls correct handler method
- [ ] Returns handler result
- [ ] Handles errors gracefully

---

#### 1.6 Build WidgetMessenger

**New file:** `js/core/widget-messenger.js`

**Source:** Cherry-pick from `.legacy/js/services/widget-messenger.js`

**Implementation:**
```javascript
import AppComms from './app-comms.js';

class WidgetMessenger {
    static widgets = new Map();
    static messageQueue = [];

    static registerWidget(widgetId, iframe) {
        this.widgets.set(widgetId, iframe);
        logger.info(`Widget registered: ${widgetId}`);

        // Process queued messages
        this.processQueue(widgetId);
    }

    static unregisterWidget(widgetId) {
        this.widgets.delete(widgetId);
        logger.info(`Widget unregistered: ${widgetId}`);
    }

    static sendToWidget(widgetId, messageType, data) {
        const iframe = this.widgets.get(widgetId);

        if (!iframe || !iframe.contentWindow) {
            // Queue message if widget not ready
            this.messageQueue.push({ widgetId, messageType, data });
            return;
        }

        const message = {
            type: messageType,
            widgetId: widgetId,
            payload: data,
            timestamp: Date.now()
        };

        try {
            iframe.contentWindow.postMessage(message, '*');
        } catch (error) {
            logger.error(`Failed to send message to ${widgetId}:`, error);
        }
    }

    static broadcast(messageType, data) {
        this.widgets.forEach((iframe, widgetId) => {
            this.sendToWidget(widgetId, messageType, data);
        });
    }

    static onMessage(callback) {
        const handler = (event) => {
            // Validate message origin if needed
            if (event.data && event.data.widgetId) {
                callback(event.data);

                // Also publish to AppComms
                AppComms.publish(AppComms.events.WIDGET_MESSAGE, event.data);
            }
        };

        window.addEventListener('message', handler);

        // Return unsubscribe
        return () => window.removeEventListener('message', handler);
    }

    static processQueue(widgetId) {
        const queued = this.messageQueue.filter(msg => msg.widgetId === widgetId);
        queued.forEach(msg => {
            this.sendToWidget(msg.widgetId, msg.messageType, msg.data);
        });
        this.messageQueue = this.messageQueue.filter(msg => msg.widgetId !== widgetId);
    }

    static messageTypes = {
        COMMAND: 'command',
        DATA: 'data',
        CONFIG: 'config',
        EVENT: 'event'
    }
}

export default WidgetMessenger;
```

**Validation:**
- [ ] Widgets register/unregister
- [ ] Messages send to widgets
- [ ] Broadcast sends to all widgets
- [ ] Message queue works for unregistered widgets
- [ ] Widget messages trigger callbacks

---

### Day 5: Initialization System

#### 1.7 Build Initialization System

**Create files:**
- `js/core/initialization/startup-checks.js`
- `js/core/initialization/theme-initializer.js`

**startup-checks.js:**
```javascript
import { getPlatformDetector } from '../../utils/platform-detector.js';

export async function runStartupChecks() {
    logger.info('🚀 Running startup checks...');

    // Platform detection
    const platform = getPlatformDetector();
    logger.info(`Platform: ${platform.platform}, Device: ${platform.deviceType}`);

    // Check dependencies
    if (!window.localStorage) {
        throw new Error('localStorage not available');
    }

    if (!window.fetch) {
        throw new Error('fetch API not available');
    }

    logger.info('✅ Startup checks passed');

    return {
        platform: platform.platform,
        deviceType: platform.deviceType,
        isTV: platform.isTV(),
        isMobile: platform.isMobile()
    };
}
```

**theme-initializer.js:**
```javascript
export async function initializeTheme() {
    logger.info('🎨 Initializing theme...');

    // Load saved theme or default to dark
    const savedTheme = localStorage.getItem('dashie-theme') || 'dark';

    // Apply theme class to body
    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(`${savedTheme}-theme`);

    logger.info(`✅ Theme initialized: ${savedTheme}`);

    return savedTheme;
}
```

**Copy from legacy:**
- Copy `.legacy/js/utils/platform-detector.js` → `js/utils/platform-detector.js`
- Copy `.legacy/js/utils/logger.js` → `js/utils/logger.js`
- Copy `.legacy/js/utils/logger-config.js` → `js/utils/logger-config.js`

**Validation:**
- [ ] Platform detection works
- [ ] Theme applies correctly
- [ ] Startup checks pass

---

### Day 6-7: Main.js Bootstrap

#### 1.8 Build new main.js

**New file:** `main.js`

**Implementation:**
```javascript
import { runStartupChecks } from './js/core/initialization/startup-checks.js';
import { initializeTheme } from './js/core/initialization/theme-initializer.js';
import AppComms from './js/core/app-comms.js';
import AppStateManager from './js/core/app-state-manager.js';
import ActionRouter from './js/core/action-router.js';
import WidgetMessenger from './js/core/widget-messenger.js';
import { createLogger } from './js/utils/logger.js';

const logger = createLogger('Main');

async function initializeApp() {
    try {
        logger.info('🚀 Starting Dashie application...');

        // Step 1: Startup checks
        const platformInfo = await runStartupChecks();

        // Step 2: Initialize theme
        const theme = await initializeTheme();

        // Step 3: Initialize core state
        await AppStateManager.initialize();
        AppStateManager.setState({
            platform: platformInfo.platform,
            theme: theme
        });

        // Step 4: Set up keyboard input routing
        setupInputHandlers();

        logger.success('✅ Core infrastructure initialized');

        // TODO: Initialize modules, auth, services
        // For now, just show a message
        showInitMessage();

    } catch (error) {
        logger.error('❌ Application initialization failed', error);
        showErrorMessage(error);
    }
}

function setupInputHandlers() {
    document.addEventListener('keydown', (e) => {
        let action = null;

        switch (e.key) {
            case 'ArrowUp': action = ActionRouter.actions.UP; break;
            case 'ArrowDown': action = ActionRouter.actions.DOWN; break;
            case 'ArrowLeft': action = ActionRouter.actions.LEFT; break;
            case 'ArrowRight': action = ActionRouter.actions.RIGHT; break;
            case 'Enter': action = ActionRouter.actions.ENTER; break;
            case 'Escape': action = ActionRouter.actions.ESCAPE; break;
            case 'Backspace': action = ActionRouter.actions.BACK; break;
        }

        if (action) {
            const handled = ActionRouter.route(action);
            if (handled) {
                e.preventDefault();
            }
        }
    });

    logger.debug('Input handlers set up');
}

function showInitMessage() {
    document.body.innerHTML = `
        <div style="padding: 40px; font-family: sans-serif;">
            <h1>✅ Dashie Core Infrastructure Ready</h1>
            <p>Platform: ${AppStateManager.getState().platform}</p>
            <p>Theme: ${AppStateManager.getState().theme}</p>
            <p>Next: Build Dashboard module</p>
        </div>
    `;
}

function showErrorMessage(error) {
    document.body.innerHTML = `
        <div style="padding: 40px; font-family: sans-serif; color: red;">
            <h1>❌ Initialization Failed</h1>
            <p>${error.message}</p>
            <pre>${error.stack}</pre>
        </div>
    `;
}

// Start the app
initializeApp();
```

**Update index.html:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashie v2.0</title>
    <script src="config.js"></script>
</head>
<body>
    <div id="app">Loading...</div>
    <script type="module" src="main.js"></script>
</body>
</html>
```

**Validation:**
- [ ] App loads without errors
- [ ] Platform detected correctly
- [ ] Theme applies
- [ ] State initializes
- [ ] Keyboard input captured
- [ ] Shows "Core Infrastructure Ready" message

---

## Phase 2: First Module - Dashboard (Week 2)

**Goal:** Build Dashboard module to validate architecture

### Day 8-9: Dashboard Structure

#### 2.1 Create Dashboard Module Structure

**Create files:**
- `js/modules/Dashboard/index.js`
- `js/modules/Dashboard/input-handler.js`
- `js/modules/Dashboard/state-manager.js`
- `js/modules/Dashboard/navigation-manager.js`
- `js/modules/Dashboard/ui-renderer.js`

#### 2.2 Build Dashboard Index

**js/modules/Dashboard/index.js:**
```javascript
import InputHandler from './input-handler.js';
import StateManager from './state-manager.js';
import NavigationManager from './navigation-manager.js';
import UIRenderer from './ui-renderer.js';

class Dashboard {
    static metadata = {
        name: 'dashboard',
        version: '1.0.0',
        description: 'Main dashboard module'
    }

    static async initialize() {
        logger.info('Dashboard: Initializing...');
        await StateManager.initialize();
        logger.info('Dashboard: Initialized');
    }

    static activate() {
        logger.info('Dashboard: Activating...');
        UIRenderer.render();
        InputHandler.enable();
        logger.info('Dashboard: Activated');
    }

    static deactivate() {
        logger.info('Dashboard: Deactivating...');
        InputHandler.disable();
        UIRenderer.hide();
        logger.info('Dashboard: Deactivated');
    }

    static destroy() {
        logger.info('Dashboard: Destroying...');
        StateManager.destroy();
    }

    static getState() {
        return StateManager.getState();
    }

    static setState(state) {
        StateManager.setState(state);
    }

    // Dashboard-specific API
    static focusWidget(widgetId) {
        NavigationManager.focusWidget(widgetId);
    }

    static defocusWidget() {
        NavigationManager.defocusWidget();
    }

    static openMenu() {
        NavigationManager.openMenu();
    }

    static closeMenu() {
        NavigationManager.closeMenu();
    }

    static getGridPosition() {
        return StateManager.getState().gridPosition;
    }

    static setGridPosition(row, col) {
        StateManager.setState({
            gridPosition: { row, col }
        });
    }
}

export default Dashboard;
```

---

### Day 10-11: Dashboard Implementation

#### 2.3 Build Dashboard State Manager

**Source:** Cherry-pick from `.legacy/js/core/state.js`

**js/modules/Dashboard/state-manager.js:**
```javascript
class DashboardStateManager {
    static state = {
        gridPosition: { row: 0, col: 0 },
        focusedWidget: null,
        menuOpen: false,
        selectedMenuItem: 0,
        widgets: [],
        isActive: false
    };

    static async initialize() {
        // Load saved position if any
        const saved = localStorage.getItem('dashie-dashboard-state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.state = { ...this.state, ...parsed };
            } catch (error) {
                logger.error('Failed to load dashboard state:', error);
            }
        }
    }

    static getState() {
        return { ...this.state };
    }

    static setState(partialState) {
        this.state = { ...this.state, ...partialState };
        this.persist();
    }

    static persist() {
        try {
            localStorage.setItem('dashie-dashboard-state', JSON.stringify(this.state));
        } catch (error) {
            logger.error('Failed to persist dashboard state:', error);
        }
    }

    static destroy() {
        this.state = {
            gridPosition: { row: 0, col: 0 },
            focusedWidget: null,
            menuOpen: false,
            selectedMenuItem: 0,
            widgets: [],
            isActive: false
        };
    }
}

export default DashboardStateManager;
```

#### 2.4 Build Dashboard Input Handler

**js/modules/Dashboard/input-handler.js:**
```javascript
import NavigationManager from './navigation-manager.js';

class DashboardInputHandler {
    static enabled = false;

    static enable() {
        this.enabled = true;
    }

    static disable() {
        this.enabled = false;
    }

    static handleUp() {
        if (!this.enabled) return false;
        return NavigationManager.moveUp();
    }

    static handleDown() {
        if (!this.enabled) return false;
        return NavigationManager.moveDown();
    }

    static handleLeft() {
        if (!this.enabled) return false;
        return NavigationManager.moveLeft();
    }

    static handleRight() {
        if (!this.enabled) return false;
        return NavigationManager.moveRight();
    }

    static handleEnter() {
        if (!this.enabled) return false;
        return NavigationManager.handleEnter();
    }

    static handleEscape() {
        if (!this.enabled) return false;
        return NavigationManager.handleEscape();
    }

    static handleBack() {
        if (!this.enabled) return false;
        return NavigationManager.handleBack();
    }
}

export default DashboardInputHandler;
```

#### 2.5 Build Dashboard Navigation Manager

**Source:** Cherry-pick from `.legacy/js/core/navigation.js`

**js/modules/Dashboard/navigation-manager.js:**
```javascript
import StateManager from './state-manager.js';
import UIRenderer from './ui-renderer.js';

class DashboardNavigationManager {
    static moveUp() {
        const state = StateManager.getState();

        if (state.menuOpen) {
            // Navigate menu
            return this.moveMenuSelection(-1);
        } else {
            // Navigate grid
            const { row, col } = state.gridPosition;
            if (row > 0) {
                StateManager.setState({
                    gridPosition: { row: row - 1, col }
                });
                UIRenderer.updateFocus();
                return true;
            }
        }

        return false;
    }

    static moveDown() {
        const state = StateManager.getState();

        if (state.menuOpen) {
            return this.moveMenuSelection(1);
        } else {
            const { row, col } = state.gridPosition;
            if (row < 1) {
                StateManager.setState({
                    gridPosition: { row: row + 1, col }
                });
                UIRenderer.updateFocus();
                return true;
            }
        }

        return false;
    }

    static moveLeft() {
        const state = StateManager.getState();

        if (!state.menuOpen) {
            const { row, col } = state.gridPosition;
            if (col === 0) {
                // Open menu
                this.openMenu();
                return true;
            } else {
                StateManager.setState({
                    gridPosition: { row, col: col - 1 }
                });
                UIRenderer.updateFocus();
                return true;
            }
        }

        return false;
    }

    static moveRight() {
        const state = StateManager.getState();

        if (state.menuOpen) {
            this.closeMenu();
            return true;
        } else {
            const { row, col } = state.gridPosition;
            if (col < 2) {
                StateManager.setState({
                    gridPosition: { row, col: col + 1 }
                });
                UIRenderer.updateFocus();
                return true;
            }
        }

        return false;
    }

    static handleEnter() {
        const state = StateManager.getState();

        if (state.menuOpen) {
            // Execute menu action
            return this.executeMenuAction(state.selectedMenuItem);
        } else {
            // Focus widget
            return this.focusCurrentWidget();
        }
    }

    static handleEscape() {
        return this.defocusWidget();
    }

    static handleBack() {
        return this.defocusWidget();
    }

    static openMenu() {
        StateManager.setState({ menuOpen: true });
        UIRenderer.showMenu();
    }

    static closeMenu() {
        StateManager.setState({ menuOpen: false });
        UIRenderer.hideMenu();
    }

    static focusWidget(widgetId) {
        StateManager.setState({ focusedWidget: widgetId });
        UIRenderer.focusWidget(widgetId);
    }

    static defocusWidget() {
        StateManager.setState({ focusedWidget: null });
        UIRenderer.defocusWidget();
        return true;
    }

    static focusCurrentWidget() {
        const state = StateManager.getState();
        const { row, col } = state.gridPosition;
        const widgetId = this.getWidgetAtPosition(row, col);

        if (widgetId) {
            this.focusWidget(widgetId);
            return true;
        }

        return false;
    }

    static getWidgetAtPosition(row, col) {
        // 2x3 grid layout
        const index = row * 3 + col;
        const widgetIds = ['calendar', 'photos', 'clock', 'agenda', 'location', 'map'];
        return widgetIds[index] || null;
    }

    static moveMenuSelection(direction) {
        const state = StateManager.getState();
        const menuItems = 7; // calendar, map, camera, reload, sleep, settings, exit

        let newSelection = state.selectedMenuItem + direction;
        if (newSelection < 0) newSelection = menuItems - 1;
        if (newSelection >= menuItems) newSelection = 0;

        StateManager.setState({ selectedMenuItem: newSelection });
        UIRenderer.updateMenuSelection();

        return true;
    }

    static executeMenuAction(index) {
        const actions = ['calendar', 'map', 'camera', 'reload', 'sleep', 'settings', 'exit'];
        const action = actions[index];

        logger.info(`Menu action: ${action}`);

        // TODO: Implement menu actions

        return true;
    }
}

export default DashboardNavigationManager;
```

---

### Day 12-14: Dashboard UI & Integration

#### 2.6 Build Dashboard UI Renderer

**Source:** Cherry-pick from `.legacy/js/ui/grid.js`, `.legacy/js/ui/focus-menu.js`, parts of `.legacy/js/core/navigation.js`

**js/modules/Dashboard/ui-renderer.js:**
```javascript
import StateManager from './state-manager.js';

class DashboardUIRenderer {
    static elements = {
        grid: null,
        sidebar: null,
        widgets: []
    };

    static render() {
        const app = document.getElementById('app');

        app.innerHTML = `
            <div class="dashboard">
                <aside id="sidebar" class="sidebar">
                    <div class="menu-items">
                        <button class="menu-item" data-action="calendar">Calendar</button>
                        <button class="menu-item" data-action="map">Map</button>
                        <button class="menu-item" data-action="camera">Camera</button>
                        <button class="menu-item" data-action="reload">Reload</button>
                        <button class="menu-item" data-action="sleep">Sleep</button>
                        <button class="menu-item" data-action="settings">Settings</button>
                        <button class="menu-item" data-action="exit">Exit</button>
                    </div>
                </aside>
                <main id="grid" class="grid">
                    <div class="widget-cell" data-row="0" data-col="0">
                        <div class="widget-placeholder">Calendar</div>
                    </div>
                    <div class="widget-cell" data-row="0" data-col="1">
                        <div class="widget-placeholder">Photos</div>
                    </div>
                    <div class="widget-cell" data-row="0" data-col="2">
                        <div class="widget-placeholder">Clock</div>
                    </div>
                    <div class="widget-cell" data-row="1" data-col="0">
                        <div class="widget-placeholder">Agenda</div>
                    </div>
                    <div class="widget-cell" data-row="1" data-col="1">
                        <div class="widget-placeholder">Location</div>
                    </div>
                    <div class="widget-cell" data-row="1" data-col="2">
                        <div class="widget-placeholder">Map</div>
                    </div>
                </main>
            </div>
        `;

        this.elements.grid = document.getElementById('grid');
        this.elements.sidebar = document.getElementById('sidebar');
        this.elements.widgets = Array.from(document.querySelectorAll('.widget-cell'));

        this.updateFocus();
    }

    static hide() {
        const app = document.getElementById('app');
        app.innerHTML = '';
    }

    static updateFocus() {
        const state = StateManager.getState();
        const { row, col } = state.gridPosition;

        // Remove all focus classes
        this.elements.widgets.forEach(cell => {
            cell.classList.remove('focused');
        });

        // Add focus to current position
        const focusedCell = this.elements.widgets.find(
            cell => cell.dataset.row == row && cell.dataset.col == col
        );

        if (focusedCell) {
            focusedCell.classList.add('focused');
        }
    }

    static showMenu() {
        this.elements.sidebar.classList.add('expanded');
        this.updateMenuSelection();
    }

    static hideMenu() {
        this.elements.sidebar.classList.remove('expanded');
    }

    static updateMenuSelection() {
        const state = StateManager.getState();
        const menuItems = Array.from(document.querySelectorAll('.menu-item'));

        menuItems.forEach((item, index) => {
            if (index === state.selectedMenuItem) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    static focusWidget(widgetId) {
        logger.info(`Focusing widget: ${widgetId}`);
        // TODO: Implement widget focus visual
    }

    static defocusWidget() {
        logger.info('Defocusing widget');
        // TODO: Implement widget defocus visual
    }
}

export default DashboardUIRenderer;
```

#### 2.7 Add Basic Dashboard CSS

**Create:** `css/modules/dashboard.css`

```css
.dashboard {
    display: flex;
    height: 100vh;
    width: 100vw;
}

.sidebar {
    width: 60px;
    background: #222;
    transition: width 0.3s;
}

.sidebar.expanded {
    width: 200px;
}

.menu-items {
    padding: 20px;
}

.menu-item {
    display: block;
    width: 100%;
    padding: 10px;
    margin-bottom: 10px;
    background: #333;
    border: 2px solid transparent;
    color: white;
    cursor: pointer;
}

.menu-item.selected {
    border-color: cyan;
}

.grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: 10px;
    padding: 20px;
    flex: 1;
}

.widget-cell {
    border: 2px solid transparent;
    border-radius: 8px;
    background: #333;
    display: flex;
    align-items: center;
    justify-content: center;
}

.widget-cell.focused {
    border-color: yellow;
}

.widget-placeholder {
    color: #888;
    font-size: 24px;
}
```

#### 2.8 Update main.js to Load Dashboard

**Update main.js:**
```javascript
import Dashboard from './js/modules/Dashboard/index.js';

// ... existing code ...

async function initializeApp() {
    // ... existing initialization ...

    // Step 5: Initialize Dashboard
    await Dashboard.initialize();
    ActionRouter.registerModule('dashboard', Dashboard.inputHandler);

    // Step 6: Activate Dashboard
    AppStateManager.setCurrentModule('dashboard');
    Dashboard.activate();

    logger.success('✅ Dashboard loaded');
}
```

**Validation:**
- [ ] Dashboard renders
- [ ] Grid shows 2x3 layout
- [ ] Arrow keys move focus
- [ ] Left arrow opens menu
- [ ] Right arrow closes menu
- [ ] Up/down navigate menu
- [ ] State persists to localStorage

---

## Phase 3: Data Layer (Week 3)

**Goal:** Build auth system, JWT service, and data services

### Day 15-17: Auth System

#### 3.1 Copy Auth Components from Legacy

**Copy these files:**
- `.legacy/js/auth/auth-config.js` → `js/data/auth/auth-config.js`
- `.legacy/js/apis/api-auth/auth-coordinator.js` → `js/data/auth/auth-coordinator.js`
- `.legacy/js/apis/api-auth/account-manager.js` → `js/data/auth/account-manager.js`
- `.legacy/js/apis/api-auth/providers/device-flow.js` → `js/data/auth/providers/device-flow.js`
- `.legacy/js/apis/api-auth/providers/web-oauth.js` → `js/data/auth/providers/web-oauth.js`
- `.legacy/js/apis/api-auth/providers/native-android.js` → `js/data/auth/providers/native-android.js`
- `.legacy/js/utils/redirect-manager.js` → `js/utils/redirect-manager.js`

**Update imports** in each file to match new paths.

#### 3.2 Build Session Manager

**New file:** `js/data/auth/session-manager.js`

**Source:** Cherry-pick from `.legacy/js/auth/simple-auth.js`

**Implementation:**
```javascript
import { AuthCoordinator } from './auth-coordinator.js';
import AppComms from '../../core/app-comms.js';
import AppStateManager from '../../core/app-state-manager.js';

class SessionManager {
    constructor() {
        this.authenticated = false;
        this.currentUser = null;
        this.authCoordinator = new AuthCoordinator();
    }

    async initialize() {
        logger.info('SessionManager: Initializing...');

        const result = await this.authCoordinator.init();

        if (result.authenticated) {
            this.authenticated = true;
            this.currentUser = result.user;

            // Update app state
            AppStateManager.setState({
                user: {
                    isAuthenticated: true,
                    userId: result.user.id,
                    email: result.user.email
                }
            });

            // Publish event
            AppComms.publish(AppComms.events.AUTH_STATUS_CHANGED, {
                authenticated: true,
                user: result.user
            });
        }

        logger.info('SessionManager: Initialized');
    }

    isAuthenticated() {
        return this.authenticated;
    }

    getUser() {
        return this.currentUser;
    }

    async signIn() {
        const result = await this.authCoordinator.signIn();

        if (result.success) {
            this.authenticated = true;
            this.currentUser = result.user;

            AppStateManager.setState({
                user: {
                    isAuthenticated: true,
                    userId: result.user.id,
                    email: result.user.email
                }
            });

            AppComms.publish(AppComms.events.AUTH_STATUS_CHANGED, {
                authenticated: true,
                user: result.user
            });
        }

        return result;
    }

    async signOut() {
        await this.authCoordinator.signOut();

        this.authenticated = false;
        this.currentUser = null;

        AppStateManager.setState({
            user: {
                isAuthenticated: false,
                userId: null,
                email: null
            }
        });

        AppComms.publish(AppComms.events.AUTH_STATUS_CHANGED, {
            authenticated: false,
            user: null
        });
    }
}

export default SessionManager;
```

#### 3.3 Create auth-initializer.js

**New file:** `js/core/initialization/auth-initializer.js`

```javascript
import SessionManager from '../../data/auth/session-manager.js';

let sessionManager = null;

export async function initializeAuth() {
    logger.info('🔐 Initializing authentication...');

    sessionManager = new SessionManager();
    await sessionManager.initialize();

    // Make available globally
    window.dashieAuth = sessionManager;

    logger.info('✅ Authentication initialized');

    return sessionManager.isAuthenticated();
}

export function getSessionManager() {
    return sessionManager;
}
```

**Update main.js to include auth:**
```javascript
import { initializeAuth } from './js/core/initialization/auth-initializer.js';

// ... in initializeApp() ...

// After theme initialization
const isAuthenticated = await initializeAuth();

if (!isAuthenticated) {
    // TODO: Show login screen
    logger.info('Not authenticated - would show login');
    // For now, continue to dashboard
}
```

---

### Day 18-19: JWT Service Refactoring

Follow the JWT refactoring plan from [JWT_REFACTORING_SUMMARY.md](.reference/JWT_REFACTORING_SUMMARY.md)

**Build in order:**
1. `js/data/auth/jwt/jwt-storage.js`
2. `js/data/auth/jwt/token-cache.js`
3. `js/data/auth/jwt/edge-client.js`
4. `js/data/auth/jwt/jwt-manager.js`
5. `js/data/auth/jwt/settings-integration.js`
6. `js/data/auth/jwt/index.js`

**Create jwt-initializer.js:**

**New file:** `js/core/initialization/jwt-initializer.js`

```javascript
import { initializeJWTService } from '../../data/auth/jwt/index.js';

export async function initializeJWT() {
    logger.info('🔑 Initializing JWT service...');

    const isReady = await initializeJWTService();

    if (isReady) {
        logger.info('✅ JWT service ready');
    } else {
        logger.warn('⚠️ JWT service not ready (may need auth first)');
    }

    return isReady;
}
```

**Update main.js:**
```javascript
import { initializeJWT } from './js/core/initialization/jwt-initializer.js';

// ... after auth initialization ...
await initializeJWT();
```

---

### Day 20-21: Data Services

#### 3.4 Copy Service Files

**Copy these:**
- `.legacy/js/services/calendar-service.js` → `js/data/services/calendar-service.js`
- `.legacy/js/services/photo-data-service.js` → `js/data/services/photo-service.js`
- `.legacy/js/services/telemetry-service.js` → `js/data/services/telemetry-service.js`
- `.legacy/js/services/data-cache.js` → `js/data/data-cache.js`
- `.legacy/js/apis/google/google-client.js` → `js/data/services/google/google-client.js`

**Update imports** in each file.

#### 3.5 Create service-initializer.js

**New file:** `js/core/initialization/service-initializer.js`

```javascript
import CalendarService from '../../data/services/calendar-service.js';
import PhotoService from '../../data/services/photo-service.js';
import TelemetryService from '../../data/services/telemetry-service.js';

export async function initializeServices() {
    logger.info('📊 Initializing data services...');

    try {
        await CalendarService.initialize();
        await PhotoService.initialize();
        await TelemetryService.initialize();

        logger.info('✅ Data services initialized');
    } catch (error) {
        logger.error('Failed to initialize services:', error);
        throw error;
    }
}
```

---

## Phase 4: Remaining Modules (Week 4-5)

### Settings Module (Days 22-28)

Follow settings refactoring plan from ARCHITECTURE.md

**Build in order:**
1. Settings core (store, broadcast-manager)
2. Settings UI infrastructure
3. Settings pages (family, interface, calendar, photos, system, account)
4. Settings orchestrator
5. Settings module wrapper

### Login Module (Days 29-31)

**Build:**
1. Login UI (absorb auth-ui.js from legacy)
2. Login input handler
3. Login state manager
4. Login module wrapper

### Modals Module (Days 32-33)

**Build:**
1. Modal renderer
2. Modal input handler
3. Modal state manager
4. Confirmation modals (sleep, exit)

### Welcome Module (Days 34-35)

**Build:**
1. Welcome wizard controller
2. Welcome screens
3. Welcome module wrapper

---

## Phase 5: Refactoring (Week 6)

### JWT Refactoring (Days 36-38)

If not done in Phase 3, complete JWT refactoring now.

### Navigation Consolidation (Days 39-40)

Ensure all navigation is properly consolidated in Dashboard module.

### Code Review & Cleanup (Days 41-42)

- Remove unused legacy code
- Clean up comments
- Optimize imports
- Update documentation

---

## Phase 6: Testing & Polish (Week 7)

### Unit Testing (Days 43-45)

Write tests for:
- Core infrastructure (AppComms, AppStateManager, ActionRouter)
- Dashboard module
- JWT service
- Settings system

### Integration Testing (Days 46-47)

Test full user flows:
- App startup
- Dashboard navigation
- Widget interaction
- Settings changes
- Auth flows

### Bug Fixes & Polish (Days 48-49)

- Fix identified bugs
- Polish UI
- Performance optimization
- Accessibility improvements

---

## Testing Strategy

### Unit Tests

**Framework:** Jest or Vitest

**Test Coverage Goals:**
- Core: 90%+
- Modules: 80%+
- Services: 80%+
- Utils: 90%+

**Example Test:**
```javascript
describe('AppComms', () => {
    it('should subscribe and publish events', () => {
        const callback = jest.fn();
        AppComms.subscribe('test', callback);

        AppComms.publish('test', { data: 'value' });

        expect(callback).toHaveBeenCalledWith({ data: 'value' });
    });
});
```

### Integration Tests

**Framework:** Playwright

**Test Scenarios:**
- App loads successfully
- Dashboard navigation works
- Settings can be changed
- Auth flow completes
- Widgets load and respond

---

## Migration Checklist

### Phase 1 Complete
- [ ] Folder structure created
- [ ] config.js in place
- [ ] AppComms working
- [ ] AppStateManager working
- [ ] ActionRouter working
- [ ] WidgetMessenger working
- [ ] Initialization system working
- [ ] main.js loads app successfully
- [ ] Keyboard input captured

### Phase 2 Complete
- [ ] Dashboard module structure created
- [ ] Dashboard renders
- [ ] Grid navigation works
- [ ] Menu navigation works
- [ ] Dashboard state persists
- [ ] Input routing works

### Phase 3 Complete
- [ ] Auth system integrated
- [ ] JWT service working
- [ ] Services initialized
- [ ] Data flows to dashboard
- [ ] Auth state tracked

### Phase 4 Complete
- [ ] Settings module working
- [ ] Login module working
- [ ] Modals module working
- [ ] Welcome module working
- [ ] All modules tested

### Phase 5 Complete
- [ ] JWT refactored
- [ ] Navigation consolidated
- [ ] Code cleaned up
- [ ] Documentation updated

### Phase 6 Complete
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Bugs fixed
- [ ] Performance optimized
- [ ] Ready for production

---

## Success Criteria

### Technical
- ✅ All modules implement standard interface
- ✅ All tests passing
- ✅ No console errors
- ✅ Performance equal or better than legacy
- ✅ Memory usage acceptable

### Functional
- ✅ App loads successfully
- ✅ Navigation works smoothly
- ✅ Widgets load and respond
- ✅ Settings save and apply
- ✅ Auth works on all platforms (TV, Desktop, Mobile)

### Code Quality
- ✅ Clean, organized code
- ✅ Consistent naming conventions
- ✅ Well-documented interfaces
- ✅ No code duplication
- ✅ Follows design principles

---

## Risk Mitigation

### Risk: Breaking Changes

**Mitigation:**
- Keep legacy code in .legacy/
- Test new code alongside old
- Gradual migration
- Rollback plan

### Risk: Timeline Slippage

**Mitigation:**
- Buffer time in estimates
- Focus on MVP first
- Iterate on polish
- Skip nice-to-haves if needed

### Risk: Architecture Doesn't Work

**Mitigation:**
- Validate early (Dashboard module)
- Adjust architecture if needed
- Document learnings
- Be flexible

---

## Next Steps After Completion

1. **Deploy to staging** - Test on actual devices
2. **User testing** - Get feedback
3. **Performance profiling** - Optimize if needed
4. **Documentation** - Complete user/dev docs
5. **Production deploy** - Roll out gradually

---

## Summary of Technical Debt Integration

### Addressed During Build (6-8 weeks)

✅ **Multi-Provider Auth Architecture** - Two-layer design (Phase 3, Days 15-17)
- Foundation for Google, Amazon, iCloud, Outlook providers
- Account auth vs. calendar auth separation
- Token cache fixes

✅ **Separate Auth Tokens from Settings** - Security improvement (Phase 3, Days 18-19)
- Prevents accidental token loss during settings operations
- Clean separation of concerns
- Database and localStorage migration

✅ **Shared Calendar IDs** - Architecture fix (Phase 3-4, Days 20-28)
- Account-prefixed calendar IDs (`{accountType}-{calendarId}`)
- Clean account removal
- Eliminates calendarAccountMap workaround

✅ **Settings Module** - Partial re-architecture (Phase 4, Days 22-28)
- Modular pages (domain-based)
- Composition over inheritance
- Full schema validation deferred to post-launch

✅ **Welcome Wizard D-pad Bug** - User experience fix (Phase 4, Days 34-35)
- Proper event handling
- Prevents Enter key bubbling

### Deferred to Post-Launch (2-8 weeks after)

**Medium Priority (2-4 weeks post-launch):**
- Settings schema validation (Zod)
- Promise-based initialization
- Complete calendar service localStorage bypass elimination

**Low Priority (4-8 weeks post-launch):**
- Offline mode with IndexedDB caching
- Connection status indicator
- Advanced retry logic

### Already Complete

✅ Storage pattern consolidation (config.js STORAGE_KEYS)
✅ Default values centralization (config.js getDefaultSettings())

---

## Document Version History

- **v2.1** (2025-10-15) - Integrated technical debt fixes into build phases
  - Added Technical Debt Integration section
  - Mapped high-priority debt to specific days/phases
  - Documented deliverables and timelines
  - Clarified what's in-scope vs. post-launch
- **v2.0** (2025-10-15) - Initial comprehensive build strategy

---

**End of Build Strategy Document**
