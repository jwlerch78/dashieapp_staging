# API Interfaces - Component Communication Contracts

**Version:** 2.1 (Updated)
**Date:** 2025-10-15
**Status:** Implementation Phase - Core Complete

---

## Table of Contents
1. [Overview](#overview)
2. [Core Layer Interfaces](#core-layer-interfaces)
3. [Module Layer Interfaces](#module-layer-interfaces)
4. [Data Layer Interfaces](#data-layer-interfaces)
5. [Widget Communication Protocol](#widget-communication-protocol)
6. [Event System](#event-system)
7. [Type Definitions](#type-definitions)

---

## Overview

This document defines the **contracts between all system components**. Each interface is a promise of what a component provides and expects.

### Design Principles

1. **Explicit Contracts** - Clear input/output expectations
2. **Singleton Pattern** - Core components use singleton instances (not static classes) for better testability
3. **Promise-Based** - Async operations return Promises
4. **Error Handling** - All async methods can throw, callers must handle
5. **TypeScript-Ready** - JSDoc types for future TS migration

### Implementation Notes

All core components (AppComms, AppStateManager, InputHandler, ActionRouter, WidgetMessenger) are implemented as **singleton instances** rather than static classes. This provides:
- Better testability (can be mocked/reset)
- Clearer dependency management
- Easier to extend and refactor

---

## Core Layer Interfaces

### 0. InputHandler (Raw Input Normalization) ⭐ NEW

**Purpose:** Normalizes raw input from keyboard, D-pad, touch, and remote controls into unified action strings

**Input Flow:**
```
Raw Input (keyboard/dpad/touch)
  ↓
InputHandler (normalizes to actions)
  ↓
AppComms.publish('input:action', { action, originalEvent })
  ↓
ActionRouter (subscribes and routes)
  ↓
Module's Input Handler
```

**Interface:**
```javascript
/**
 * InputHandler - Singleton instance
 * Exported as: import InputHandler from './js/core/input-handler.js'
 */
class InputHandler {
    /**
     * Initialize input handler
     * Sets up keyboard, mouse, widget message, and Android remote listeners
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {}

    /**
     * Get list of supported actions
     * @returns {Array<string>} ['up', 'down', 'left', 'right', 'enter', 'escape', 'menu', 'space', 'prev', 'next', 'play-pause']
     */
    getSupportedActions() {}

    /**
     * Cleanup - remove all event listeners
     * @returns {void}
     */
    destroy() {}
}

// Singleton export
export default inputHandler; // lowercase instance
```

**Usage Example:**
```javascript
import InputHandler from './js/core/input-handler.js';

// Initialize (done once at app startup)
await InputHandler.initialize();

// InputHandler automatically publishes normalized actions via AppComms
// No need to call InputHandler directly - it works automatically!

// Listen for normalized actions:
AppComms.subscribe('input:action', (data) => {
    console.log('Action:', data.action); // 'up', 'down', 'enter', etc.
});
```

---

### 1. AppComms (Event Bus)

**Purpose:** Central pub/sub event system for cross-module communication

**Interface:**
```javascript
/**
 * AppComms - Singleton instance
 * Exported as: import AppComms from './js/core/app-comms.js'
 */
class AppComms {
    /**
     * Subscribe to an event
     * @param {string} eventName - Event name (use AppComms.events constants)
     * @param {Function} callback - Called when event fires
     * @returns {Function} Unsubscribe function
     */
    subscribe(eventName, callback) {}

    /**
     * Unsubscribe from an event
     * @param {string} eventName - Event name
     * @param {Function} callback - Previously registered callback
     * @returns {void}
     */
    unsubscribe(eventName, callback) {}

    /**
     * Publish an event
     * @param {string} eventName - Event name
     * @param {*} data - Event data (any type)
     * @returns {void}
     */
    publish(eventName, data) {}

    /**
     * Unsubscribe all callbacks for specific event
     * @param {string} eventName - Event name
     * @returns {void}
     */
    unsubscribeAll(eventName) {}

    /**
     * Clear all subscriptions
     * @returns {void}
     */
    clear() {}

    /**
     * Get statistics
     * @returns {Object} { subscribes, unsubscribes, publishes, activeEvents, eventCounts }
     */
    getStats() {}

    /**
     * Event name constants (25+ predefined events)
     * @type {Object}
     */
    events = {
        // Module lifecycle
        MODULE_CHANGED: 'module:changed',
        MODULE_INITIALIZED: 'module:initialized',
        MODULE_ACTIVATED: 'module:activated',
        MODULE_DEACTIVATED: 'module:deactivated',

        // State changes
        STATE_UPDATED: 'state:updated',
        FOCUS_CHANGED: 'focus:changed',

        // Authentication
        AUTH_STATUS_CHANGED: 'auth:status_changed',
        AUTH_USER_CHANGED: 'auth:user_changed',
        JWT_REFRESHED: 'jwt:refreshed',
        SESSION_EXPIRED: 'session:expired',

        // Widget events
        WIDGET_MESSAGE: 'widget:message',
        WIDGET_READY: 'widget:ready',
        WIDGET_ERROR: 'widget:error',
        WIDGET_DATA_UPDATED: 'widget:data_updated',

        // UI events
        THEME_CHANGED: 'theme:changed',
        TOAST_SHOW: 'toast:show',
        MODAL_OPEN: 'modal:open',
        MODAL_CLOSE: 'modal:close',

        // Data events
        DATA_UPDATED: 'data:updated',
        DATA_ERROR: 'data:error',
        CALENDAR_UPDATED: 'calendar:updated',
        PHOTOS_UPDATED: 'photos:updated',
        WEATHER_UPDATED: 'weather:updated',

        // Settings events
        SETTINGS_CHANGED: 'settings:changed',
        SETTINGS_SAVED: 'settings:saved',
        SETTINGS_LOADED: 'settings:loaded',

        // System events
        ERROR_OCCURRED: 'error:occurred',
        SLEEP_MODE_CHANGED: 'sleep:mode_changed',
        NETWORK_STATUS_CHANGED: 'network:status_changed',
        PLATFORM_DETECTED: 'platform:detected'
    }
}

// Singleton export
export default appComms; // lowercase instance
```

**Usage Example:**
```javascript
import AppComms from './js/core/app-comms.js';

// Subscribe
const unsubscribe = AppComms.subscribe(AppComms.events.STATE_UPDATED, (data) => {
    logger.info('State changed:', data);
});

// Publish
AppComms.publish(AppComms.events.STATE_UPDATED, { currentModule: 'dashboard' });

// Unsubscribe
unsubscribe(); // or AppComms.unsubscribe(eventName, callback)
```

---

### 2. AppStateManager (Global State)

**Purpose:** Manages application-wide runtime state (no localStorage persistence)

**Interface:**
```javascript
/**
 * @typedef {Object} AppState
 * @property {string|null} currentModule - 'dashboard' | 'settings' | 'login' | 'modals' | 'welcome' | null
 * @property {string|null} previousModule - Previous module name
 * @property {string} focusContext - 'grid' | 'menu' | 'widget' | 'modal'
 * @property {string|null} activeWidget - Widget ID or null
 * @property {Object} user - User object
 * @property {boolean} user.isAuthenticated - Auth status
 * @property {string|null} user.userId - User ID or null
 * @property {string|null} user.email - User email or null
 * @property {string} theme - 'light' | 'dark'
 * @property {string} platform - 'tv' | 'desktop' | 'mobile'
 * @property {boolean} isSleeping - Sleep mode active
 * @property {boolean} isInitialized - App initialized
 * @property {number|null} lastUpdated - Timestamp of last update
 */

/**
 * AppStateManager - Singleton instance
 * Exported as: import AppStateManager from './js/core/app-state-manager.js'
 *
 * NOTE: Runtime-only state, no localStorage persistence
 */
class AppStateManager {
    /**
     * Initialize state manager
     * @returns {Promise<boolean>} Success status
     * @fires AppComms.events.STATE_UPDATED
     */
    async initialize() {}

    /**
     * Get entire state object (immutable copy)
     * @returns {AppState}
     */
    getState() {}

    /**
     * Get current module
     * @returns {string|null}
     */
    getCurrentModule() {}

    /**
     * Get user
     * @returns {Object} User object
     */
    getUser() {}

    /**
     * Check if authenticated
     * @returns {boolean}
     */
    isAuthenticated() {}

    /**
     * Get theme
     * @returns {string}
     */
    getTheme() {}

    /**
     * Get platform
     * @returns {string}
     */
    getPlatform() {}

    /**
     * Check if in sleep mode
     * @returns {boolean}
     */
    isSleeping() {}

    /**
     * Update state (partial update)
     * @param {Partial<AppState>} partialState - State updates
     * @returns {void}
     * @fires AppComms.events.STATE_UPDATED
     */
    setState(partialState) {}

    /**
     * Set current module
     * @param {string} moduleName - Module to activate
     * @returns {void}
     * @fires AppComms.events.MODULE_CHANGED
     */
    setCurrentModule(moduleName) {}

    /**
     * Set focus context
     * @param {string} context - 'grid' | 'menu' | 'widget' | 'modal'
     * @returns {void}
     * @fires AppComms.events.FOCUS_CHANGED
     */
    setFocusContext(context) {}

    /**
     * Set active widget
     * @param {string|null} widgetId - Widget ID or null
     * @returns {void}
     */
    setActiveWidget(widgetId) {}

    /**
     * Set user authentication state
     * @param {Object} user - User object { isAuthenticated, userId, email }
     * @returns {void}
     * @fires AppComms.events.AUTH_USER_CHANGED
     */
    setUser(user) {}

    /**
     * Set theme
     * @param {string} theme - 'light' | 'dark'
     * @returns {void}
     * @fires AppComms.events.THEME_CHANGED
     */
    setTheme(theme) {}

    /**
     * Set platform
     * @param {string} platform - 'tv' | 'desktop' | 'mobile'
     * @returns {void}
     * @fires AppComms.events.PLATFORM_DETECTED
     */
    setPlatform(platform) {}

    /**
     * Set sleep mode
     * @param {boolean} isSleeping - Sleep mode status
     * @returns {void}
     * @fires AppComms.events.SLEEP_MODE_CHANGED
     */
    setSleepMode(isSleeping) {}

    /**
     * Subscribe to state changes
     * @param {Function} callback - Called with (newState, oldState)
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {}

    /**
     * Reset state to initial values
     * @returns {void}
     * @fires AppComms.events.STATE_UPDATED
     */
    reset() {}

    /**
     * Get initialization status
     * @returns {boolean}
     */
    isInitialized() {}
}

// Singleton export
export default appStateManager; // lowercase instance
```

**Usage Example:**
```javascript
import AppStateManager from './js/core/app-state-manager.js';

// Initialize
await AppStateManager.initialize();

// Get state
const state = AppStateManager.getState();

// Update state
AppStateManager.setState({
    currentModule: 'settings',
    focusContext: 'modal'
});

// Subscribe to changes
const unsubscribe = AppStateManager.subscribe((newState, oldState) => {
    logger.info('State updated:', newState);
});
```

---

### 3. ActionRouter (Input Routing)

**Purpose:** Routes normalized user input actions to the appropriate module's input handler

**Input Flow:**
```
InputHandler publishes 'input:action'
  ↓
ActionRouter (subscribes to 'input:action')
  ↓
Routes to currentModule's input handler
  ↓
Module.handleUp() / handleDown() / etc.
```

**Interface:**
```javascript
/**
 * ActionRouter - Singleton instance
 * Exported as: import ActionRouter from './js/core/action-router.js'
 */
class ActionRouter {
    /**
     * Initialize action router
     * Subscribes to 'input:action' events from InputHandler
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {}

    /**
     * Register a module's input handler
     * @param {string} moduleName - Module name
     * @param {ModuleInputHandler} inputHandler - Module's input handler object
     * @returns {void}
     */
    registerModule(moduleName, inputHandler) {}

    /**
     * Unregister a module
     * @param {string} moduleName - Module name
     * @returns {void}
     */
    unregisterModule(moduleName) {}

    /**
     * Route action to appropriate handler (called internally, subscribed to 'input:action')
     * @param {string} action - Action string ('up', 'down', etc.)
     * @param {Event|null} originalEvent - Original DOM event
     * @returns {boolean} True if handled
     */
    routeAction(action, originalEvent) {}

    /**
     * Get list of registered modules
     * @returns {Array<string>}
     */
    getRegisteredModules() {}

    /**
     * Check if module is registered
     * @param {string} moduleName - Module name
     * @returns {boolean}
     */
    isModuleRegistered(moduleName) {}

    /**
     * Get statistics
     * @returns {Object} { isInitialized, registeredModules, totalModules }
     */
    getStats() {}

    /**
     * Cleanup
     * @returns {void}
     */
    destroy() {}
}

// Singleton export
export default actionRouter; // lowercase instance
```

**Usage Example:**
```javascript
import ActionRouter from './js/core/action-router.js';

// Initialize (subscribes to InputHandler automatically)
await ActionRouter.initialize();

// Register module's input handler
const dashboardInputHandler = {
    handleUp: () => { /* ... */ return true; },
    handleDown: () => { /* ... */ return true; },
    handleEnter: () => { /* ... */ return true; },
    // ... other handlers
};

ActionRouter.registerModule('dashboard', dashboardInputHandler);

// ActionRouter automatically routes actions when user presses keys!
// No need to call routeAction manually
```

---

### 4. WidgetMessenger (Widget Communication)

**Purpose:** Manages postMessage communication with widget iframes

**Interface:**
```javascript
/**
 * @typedef {Object} WidgetMessage
 * @property {string} type - 'command' | 'data' | 'config' | 'event'
 * @property {string} action - Action or event type
 * @property {*} payload - Message payload
 */

/**
 * WidgetMessenger - Singleton instance
 * Exported as: import WidgetMessenger from './js/core/widget-messenger.js'
 */
class WidgetMessenger {
    /**
     * Initialize widget messenger
     * Sets up message listeners and event subscriptions
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {}

    /**
     * Send command to specific widget
     * @param {Window} targetWindow - Widget window
     * @param {string} command - Command ('up', 'down', 'enter', etc.)
     * @returns {void}
     */
    sendCommand(targetWindow, command) {}

    /**
     * Send command to widget by ID
     * @param {string} widgetId - Widget element ID
     * @param {string} command - Command to send
     * @returns {void}
     */
    sendCommandToWidget(widgetId, command) {}

    /**
     * Broadcast current state to all widgets (with deduplication)
     * @returns {void}
     */
    broadcastCurrentState() {}

    /**
     * Send current state to specific widget
     * @param {Window} targetWindow - Widget window
     * @param {string} widgetName - Widget name for logging
     * @returns {void}
     */
    sendCurrentStateToWidget(targetWindow, widgetName) {}

    /**
     * Send message to specific widget
     * @param {Window} targetWindow - Widget window
     * @param {Object} message - Message object
     * @returns {void}
     */
    sendMessage(targetWindow, message) {}

    /**
     * Update current state (for data services to call)
     * @param {string} dataType - 'calendar' | 'photos' | 'weather' | 'auth' | 'theme' | 'settings'
     * @param {*} data - Data to set
     * @returns {void}
     */
    updateState(dataType, data) {}

    /**
     * Get widget name from window source
     * @param {Window} windowSource - Widget window
     * @returns {string} Widget name
     */
    getWidgetName(windowSource) {}

    /**
     * Get all registered widgets
     * @returns {Array<Object>} Widget info objects
     */
    getRegisteredWidgets() {}

    /**
     * Get status for debugging
     * @returns {Object} Status object
     */
    getStatus() {}

    /**
     * Cleanup
     * @returns {void}
     */
    destroy() {}
}

// Singleton export
export default widgetMessenger; // lowercase instance
```

**Usage Example:**
```javascript
import WidgetMessenger from './js/core/widget-messenger.js';

// Initialize
await WidgetMessenger.initialize();

// Send command to widget
const iframe = document.getElementById('calendar-widget');
WidgetMessenger.sendCommand(iframe.contentWindow, 'enter');

// Or send by widget ID
WidgetMessenger.sendCommandToWidget('calendar-widget', 'enter');

// Update state (automatically broadcasts to widgets)
WidgetMessenger.updateState('calendar', calendarData);

// WidgetMessenger automatically handles widget-ready messages
// and broadcasts state updates with deduplication
```

---

## Module Layer Interfaces

### Standard Module Interface

**Every module must implement this interface:**

```javascript
/**
 * @typedef {Object} ModuleInterface
 */
class Module {
    /**
     * Module metadata
     * @type {Object}
     */
    static metadata = {
        name: 'module-name',
        version: '1.0.0',
        description: 'Module description'
    }

    /**
     * Initialize module (called once on app startup)
     * @returns {Promise<void>}
     */
    static async initialize() {}

    /**
     * Activate module (called when module becomes active)
     * @returns {void}
     */
    static activate() {}

    /**
     * Deactivate module (called when module becomes inactive)
     * @returns {void}
     */
    static deactivate() {}

    /**
     * Destroy module (called on app shutdown, rarely used)
     * @returns {void}
     */
    static destroy() {}

    /**
     * Get module state
     * @returns {Object}
     */
    static getState() {}

    /**
     * Set module state
     * @param {Object} state - State update
     * @returns {void}
     */
    static setState(state) {}
}
```

---

### Module Input Handler Interface

**Every module must provide an input handler:**

```javascript
/**
 * @typedef {Object} ModuleInputHandler
 */
class ModuleInputHandler {
    /**
     * Handle up action
     * @param {Event|null} originalEvent - Original DOM event
     * @returns {boolean} True if handled
     */
    handleUp(originalEvent) {}

    /**
     * Handle down action
     * @param {Event|null} originalEvent - Original DOM event
     * @returns {boolean} True if handled
     */
    handleDown(originalEvent) {}

    /**
     * Handle left action
     * @param {Event|null} originalEvent - Original DOM event
     * @returns {boolean} True if handled
     */
    handleLeft(originalEvent) {}

    /**
     * Handle right action
     * @param {Event|null} originalEvent - Original DOM event
     * @returns {boolean} True if handled
     */
    handleRight(originalEvent) {}

    /**
     * Handle enter action
     * @param {Event|null} originalEvent - Original DOM event
     * @returns {boolean} True if handled
     */
    handleEnter(originalEvent) {}

    /**
     * Handle escape action
     * @param {Event|null} originalEvent - Original DOM event
     * @returns {boolean} True if handled
     */
    handleEscape(originalEvent) {}

    /**
     * Handle menu action (optional)
     * @param {Event|null} originalEvent - Original DOM event
     * @returns {boolean} True if handled
     */
    handleMenu(originalEvent) {}

    /**
     * Handle space action (optional)
     * @param {Event|null} originalEvent - Original DOM event
     * @returns {boolean} True if handled
     */
    handleSpace(originalEvent) {}

    /**
     * Handle prev action (optional) - Previous view/page
     * @param {Event|null} originalEvent - Original DOM event
     * @returns {boolean} True if handled
     */
    handlePrev(originalEvent) {}

    /**
     * Handle next action (optional) - Next view/page
     * @param {Event|null} originalEvent - Original DOM event
     * @returns {boolean} True if handled
     */
    handleNext(originalEvent) {}

    /**
     * Handle play-pause action (optional) - Play/pause media or toggle sleep
     * @param {Event|null} originalEvent - Original DOM event
     * @returns {boolean} True if handled
     */
    handlePlayPause(originalEvent) {}
}
```

**Return `true`** if the action was handled, **`false`** if it should bubble up.

---

### Dashboard Module Specific

```javascript
/**
 * Dashboard module public API
 */
class Dashboard {
    // Implements ModuleInterface
    static async initialize() {}
    static activate() {}
    static deactivate() {}

    // Dashboard-specific methods

    /**
     * Focus a specific widget
     * @param {string} widgetId - Widget to focus
     * @returns {void}
     */
    static focusWidget(widgetId) {}

    /**
     * Defocus current widget
     * @returns {void}
     */
    static defocusWidget() {}

    /**
     * Open sidebar menu
     * @returns {void}
     */
    static openMenu() {}

    /**
     * Close sidebar menu
     * @returns {void}
     */
    static closeMenu() {}

    /**
     * Get current grid position
     * @returns {{row: number, col: number}}
     */
    static getGridPosition() {}

    /**
     * Set grid position
     * @param {number} row - Row (0-1)
     * @param {number} col - Column (0-2)
     * @returns {void}
     */
    static setGridPosition(row, col) {}
}
```

---

### Settings Module Specific

```javascript
/**
 * Settings module public API
 */
class Settings {
    // Implements ModuleInterface
    static async initialize() {}
    static activate() {}
    static deactivate() {}

    // Settings-specific methods

    /**
     * Show settings modal
     * @param {string} [pageId] - Optional page to open directly
     * @returns {void}
     */
    static show(pageId) {}

    /**
     * Hide settings modal
     * @returns {void}
     */
    static hide() {}

    /**
     * Get setting value
     * @param {string} key - Setting key
     * @returns {*} Setting value
     */
    static get(key) {}

    /**
     * Set setting value
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     * @returns {void}
     */
    static set(key, value) {}

    /**
     * Save all settings
     * @returns {Promise<void>}
     */
    static async save() {}

    /**
     * Load settings
     * @returns {Promise<void>}
     */
    static async load() {}

    /**
     * Navigate to page
     * @param {string} pageId - Page to navigate to
     * @returns {void}
     */
    static navigateToPage(pageId) {}
}
```

---

### Login Module Specific

```javascript
/**
 * Login module public API
 */
class Login {
    // Implements ModuleInterface
    static async initialize() {}
    static activate() {}
    static deactivate() {}

    // Login-specific methods

    /**
     * Show login screen
     * @returns {void}
     */
    static show() {}

    /**
     * Hide login screen
     * @returns {void}
     */
    static hide() {}

    /**
     * Start sign-in flow
     * @returns {Promise<void>}
     */
    static async signIn() {}

    /**
     * Sign out
     * @returns {Promise<void>}
     */
    static async signOut() {}

    /**
     * Check if authenticated
     * @returns {boolean}
     */
    static isAuthenticated() {}
}
```

---

### Modals Module Specific

```javascript
/**
 * Modals module public API
 */
class Modals {
    // Implements ModuleInterface
    static async initialize() {}
    static activate() {}
    static deactivate() {}

    // Modals-specific methods

    /**
     * Show sleep confirmation
     * @returns {Promise<boolean>} True if confirmed
     */
    static async showSleepConfirmation() {}

    /**
     * Show exit confirmation
     * @returns {Promise<boolean>} True if confirmed
     */
    static async showExitConfirmation() {}

    /**
     * Show custom modal
     * @param {Object} config - Modal configuration
     * @returns {Promise<*>} Modal result
     */
    static async showModal(config) {}

    /**
     * Close current modal
     * @returns {void}
     */
    static close() {}
}
```

---

## Data Layer Interfaces

### 1. Auth System

#### SessionManager

```javascript
/**
 * Session manager - orchestrates auth flow
 */
class SessionManager {
    /**
     * Initialize session manager
     * @returns {Promise<void>}
     */
    async initialize() {}

    /**
     * Check if authenticated
     * @returns {boolean}
     */
    isAuthenticated() {}

    /**
     * Get current user
     * @returns {User|null}
     */
    getUser() {}

    /**
     * Sign in
     * @returns {Promise<User>}
     */
    async signIn() {}

    /**
     * Sign out
     * @returns {Promise<void>}
     */
    async signOut() {}

    /**
     * Add additional account
     * @returns {Promise<void>}
     */
    async addAccount() {}
}

/**
 * @typedef {Object} User
 * @property {string} id - User ID
 * @property {string} email - User email
 * @property {string} name - User name
 * @property {string} provider - Auth provider (google)
 */
```

---

#### JWTService

```javascript
/**
 * JWT service - manages Supabase JWT
 * NOTE: Auth tokens are stored SEPARATELY from user settings
 */
class JWTService {
    /**
     * Initialize JWT service
     * @returns {Promise<boolean>} True if ready
     */
    async initialize() {}

    /**
     * Get current JWT (refreshes if needed)
     * @returns {Promise<string>} JWT token
     */
    async getJWT() {}

    /**
     * Force refresh JWT
     * @returns {Promise<string>} New JWT token
     */
    async refreshJWT() {}

    /**
     * Get Supabase user ID
     * @returns {string|null}
     */
    getSupabaseUserId() {}

    /**
     * Check if service is ready
     * @returns {boolean}
     */
    isServiceReady() {}

    /**
     * Get OAuth token for provider/account
     * @param {string} provider - Provider (e.g., 'google')
     * @param {string} accountType - Account type (e.g., 'primary')
     * @returns {Promise<TokenData>}
     */
    async getValidToken(provider, accountType) {}

    /**
     * Store OAuth tokens (in separate storage, NOT settings)
     * @param {string} provider - Provider
     * @param {string} accountType - Account type
     * @param {TokenData} tokenData - Token data
     * @returns {Promise<void>}
     */
    async storeTokens(provider, accountType, tokenData) {}

    /**
     * Invalidate token cache
     * @param {string} provider - Provider
     * @param {string} accountType - Account type
     * @returns {Promise<void>}
     */
    async invalidateTokenCache(provider, accountType) {}

    /**
     * Load settings via JWT (does NOT include auth tokens)
     * @returns {Promise<Object>}
     */
    async loadSettings() {}

    /**
     * Save settings via JWT (does NOT save auth tokens)
     * @param {Object} settings - Settings object
     * @returns {Promise<void>}
     */
    async saveSettings(settings) {}
}

/**
 * @typedef {Object} TokenData
 * @property {string} access_token - Access token
 * @property {string} expires_at - ISO date string
 * @property {string[]} scopes - Token scopes
 * @property {boolean} [refreshed] - True if token was refreshed
 */
```

---

#### TokenStore

```javascript
/**
 * Token store - Secure credential storage
 * CRITICAL: Auth tokens stored SEPARATELY from user settings
 */
class TokenStore {
    /**
     * Initialize token store
     * @returns {Promise<void>}
     */
    async initialize() {}

    /**
     * Store auth tokens for account
     * @param {string} accountType - Account type ('primary', 'account2', etc.)
     * @param {TokenData} tokenData - Token data
     * @returns {Promise<void>}
     */
    async storeAccountTokens(accountType, tokenData) {}

    /**
     * Get auth tokens for account
     * @param {string} accountType - Account type
     * @returns {Promise<TokenData|null>}
     */
    async getAccountTokens(accountType) {}

    /**
     * Remove auth tokens for account
     * @param {string} accountType - Account type
     * @returns {Promise<void>}
     */
    async removeAccountTokens(accountType) {}

    /**
     * Get all auth tokens
     * @returns {Promise<Object>} { primary: TokenData, account2: TokenData, ... }
     */
    async getAllTokens() {}

    /**
     * Clear all tokens
     * @returns {Promise<void>}
     */
    async clearAllTokens() {}
}
```

---

#### BaseAccountAuth

```javascript
/**
 * Base class for account authentication providers (Layer 1)
 * Handles how users log into Dashie
 */
class BaseAccountAuth {
    /**
     * Get provider name
     * @returns {string} 'google' | 'amazon' | 'email'
     */
    getProviderName() {}

    /**
     * Initialize provider
     * @returns {Promise<void>}
     */
    async initialize() {}

    /**
     * Start sign-in flow
     * @returns {Promise<User>}
     */
    async signIn() {}

    /**
     * Sign out
     * @returns {Promise<void>}
     */
    async signOut() {}

    /**
     * Check if authenticated
     * @returns {boolean}
     */
    isAuthenticated() {}

    /**
     * Get current user
     * @returns {User|null}
     */
    getUser() {}

    /**
     * Refresh authentication if needed
     * @returns {Promise<void>}
     */
    async refresh() {}
}
```

---

#### BaseCalendarAuth

```javascript
/**
 * Base class for calendar authentication providers (Layer 2)
 * Handles access to calendar data
 */
class BaseCalendarAuth {
    /**
     * Get provider name
     * @returns {string} 'google-calendar' | 'icloud' | 'outlook'
     */
    getProviderName() {}

    /**
     * Initialize provider
     * @returns {Promise<void>}
     */
    async initialize() {}

    /**
     * Connect calendar account
     * @param {string} accountType - Account type ('primary', 'account2', etc.)
     * @returns {Promise<TokenData>}
     */
    async connectAccount(accountType) {}

    /**
     * Disconnect calendar account
     * @param {string} accountType - Account type
     * @returns {Promise<void>}
     */
    async disconnectAccount(accountType) {}

    /**
     * Get calendar list
     * @param {string} accountType - Account type
     * @returns {Promise<Calendar[]>}
     */
    async getCalendarList(accountType) {}

    /**
     * Get calendar events
     * @param {string} calendarId - Calendar ID (account-prefixed)
     * @param {Object} timeRange - Time range
     * @param {string} accountType - Account type
     * @returns {Promise<Event[]>}
     */
    async getCalendarEvents(calendarId, timeRange, accountType) {}

    /**
     * Refresh auth token for account
     * @param {string} accountType - Account type
     * @returns {Promise<TokenData>}
     */
    async refreshToken(accountType) {}
}
```

---

### 2. Services

#### CalendarService

```javascript
/**
 * Calendar service - Multi-provider calendar integration
 * CRITICAL: Uses account-prefixed calendar IDs: {accountType}-{calendarId}
 */
class CalendarService {
    /**
     * Initialize calendar service
     * @returns {Promise<void>}
     */
    async initialize() {}

    /**
     * Get calendar list for an account
     * @param {string} [accountType] - Account type (default: 'primary')
     * @returns {Promise<Calendar[]>} Calendars with prefixed IDs
     */
    async getCalendarList(accountType) {}

    /**
     * Get calendar events
     * @param {string} prefixedCalendarId - Account-prefixed calendar ID (e.g., 'primary-user@gmail.com')
     * @param {Object} timeRange - Time range
     * @param {Date} timeRange.start - Start date
     * @param {Date} timeRange.end - End date
     * @returns {Promise<Event[]>}
     */
    async getCalendarEvents(prefixedCalendarId, timeRange) {}

    /**
     * Get all events from all active calendars
     * @returns {Promise<Event[]>}
     */
    async getAllCalendarEvents() {}

    /**
     * Get active calendar IDs (all account-prefixed)
     * @returns {Promise<string[]>} ['primary-user@gmail.com', 'account2-calendar@gmail.com', ...]
     */
    async getActiveCalendarIds() {}

    /**
     * Set active calendar IDs (with account prefixes)
     * @param {string[]} prefixedIds - Account-prefixed calendar IDs
     * @returns {Promise<void>}
     */
    async setActiveCalendarIds(prefixedIds) {}

    /**
     * Add calendar to active list
     * @param {string} calendarId - Raw calendar ID
     * @param {string} accountType - Account type
     * @returns {Promise<void>}
     */
    async enableCalendar(calendarId, accountType) {}

    /**
     * Remove calendar from active list
     * @param {string} calendarId - Raw calendar ID
     * @param {string} accountType - Account type
     * @returns {Promise<void>}
     */
    async disableCalendar(calendarId, accountType) {}

    /**
     * Remove all calendars from an account
     * @param {string} accountType - Account type to remove
     * @returns {Promise<void>}
     */
    async removeAccountCalendars(accountType) {}

    /**
     * Parse prefixed calendar ID
     * @param {string} prefixedId - Account-prefixed ID
     * @returns {{accountType: string, calendarId: string}}
     */
    parsePrefixedId(prefixedId) {}

    /**
     * Create prefixed calendar ID
     * @param {string} accountType - Account type
     * @param {string} calendarId - Raw calendar ID
     * @returns {string} Prefixed ID (e.g., 'primary-user@gmail.com')
     */
    createPrefixedId(accountType, calendarId) {}

    /**
     * Refresh calendar data
     * @returns {Promise<void>}
     */
    async refresh() {}

    /**
     * Migrate old calendar IDs to prefixed format
     * @param {string[]} oldIds - Old non-prefixed IDs
     * @returns {Promise<string[]>} New prefixed IDs
     */
    async migrateCalendarIds(oldIds) {}
}

/**
 * @typedef {Object} Calendar
 * @property {string} id - Account-prefixed calendar ID (e.g., 'primary-user@gmail.com')
 * @property {string} rawId - Raw calendar ID (e.g., 'user@gmail.com')
 * @property {string} summary - Calendar name
 * @property {string} backgroundColor - Background color
 * @property {string} accountType - Account type ('primary', 'account2', etc.)
 * @property {string} provider - Provider ('google-calendar', 'icloud', 'outlook')
 */

/**
 * @typedef {Object} Event
 * @property {string} id - Event ID
 * @property {string} summary - Event title
 * @property {Object} start - Start time
 * @property {Object} end - End time
 * @property {string} calendarId - Account-prefixed calendar ID
 * @property {string} accountType - Account type
 */
```

---

#### PhotoService

```javascript
/**
 * Photo service - Photo storage and retrieval
 */
class PhotoService {
    /**
     * Initialize photo service
     * @returns {Promise<void>}
     */
    async initialize() {}

    /**
     * List photos
     * @param {number} [limit] - Max photos to return
     * @param {number} [offset] - Offset for pagination
     * @returns {Promise<Photo[]>}
     */
    async listPhotos(limit, offset) {}

    /**
     * Upload photo
     * @param {File} file - Photo file
     * @param {Object} [metadata] - Optional metadata
     * @returns {Promise<Photo>}
     */
    async uploadPhoto(file, metadata) {}

    /**
     * Delete photo
     * @param {string} photoId - Photo ID
     * @returns {Promise<void>}
     */
    async deletePhoto(photoId) {}

    /**
     * Get photo URL
     * @param {string} photoId - Photo ID
     * @returns {Promise<string>} Photo URL
     */
    async getPhotoUrl(photoId) {}
}

/**
 * @typedef {Object} Photo
 * @property {string} id - Photo ID
 * @property {string} url - Photo URL
 * @property {string} name - File name
 * @property {number} size - File size in bytes
 * @property {string} uploadedAt - ISO date string
 */
```

---

#### DataCache

```javascript
/**
 * Data cache - In-memory caching layer
 */
class DataCache {
    /**
     * Get cached data
     * @param {string} key - Cache key
     * @returns {*|null} Cached data or null
     */
    static get(key) {}

    /**
     * Set cached data
     * @param {string} key - Cache key
     * @param {*} data - Data to cache
     * @param {number} [ttl] - Time to live in ms (default: 5min)
     * @returns {void}
     */
    static set(key, data, ttl) {}

    /**
     * Invalidate cache
     * @param {string} key - Cache key
     * @returns {void}
     */
    static invalidate(key) {}

    /**
     * Clear all cache
     * @returns {void}
     */
    static clear() {}
}
```

---

## Widget Communication Protocol

### Messages: App → Widget

```javascript
// Command message
{
    type: 'command',
    action: 'up' | 'down' | 'left' | 'right' | 'enter' | 'escape' | 'enter-focus' | 'exit-focus' | 'enter-active' | 'exit-active',
    payload: null
}

// Data message
{
    type: 'data',
    action: 'state-update' | 'data-response',
    payload: {
        calendar: { /* ... */ },
        photos: { /* ... */ },
        weather: { /* ... */ },
        auth: { ready: boolean, user: {} },
        theme: 'light' | 'dark',
        settings: { /* ... */ },
        timestamp: number
    }
}

// Config message
{
    type: 'config',
    action: 'settings-response',
    payload: {
        theme: 'light' | 'dark',
        platform: 'tv' | 'desktop' | 'mobile',
        settings: { /* ... */ }
    }
}
```

### Messages: Widget → App

```javascript
// Widget ready
{
    type: 'widget-ready',
    widget: 'calendar'
}

// Widget error
{
    type: 'widget-error',
    widget: 'calendar',
    error: 'Error message',
    details: { /* ... */ }
}

// Return to menu (widget done navigating internally)
{
    type: 'return-to-menu'
}

// Settings requested
{
    type: 'settings-requested',
    path: 'optional.setting.path'
}

// Data requested
{
    type: 'data-requested',
    dataType: 'calendar' | 'photos' | 'weather'
}
```

---

## Event System

### Event Flow

```
User presses arrow key
    ↓
InputHandler detects keydown
    ↓
InputHandler normalizes to 'up' action
    ↓
InputHandler publishes 'input:action' via AppComms
    ↓
ActionRouter receives 'input:action'
    ↓
ActionRouter gets currentModule from AppStateManager
    ↓
ActionRouter calls Module.inputHandler.handleUp()
    ↓
Module handles action, returns true
    ↓
ActionRouter prevents default on original event
```

### Standard Events

```javascript
// Module changed
AppComms.publish(AppComms.events.MODULE_CHANGED, {
    previousModule: 'dashboard',
    currentModule: 'settings'
});

// State updated
AppComms.publish(AppComms.events.STATE_UPDATED, {
    type: 'updated',
    oldState: { /* ... */ },
    newState: { /* ... */ },
    changes: { currentModule: 'settings' }
});

// Auth user changed
AppComms.publish(AppComms.events.AUTH_USER_CHANGED, {
    oldUser: { /* ... */ },
    newUser: { isAuthenticated: true, userId: '...', email: '...' }
});

// Theme changed
AppComms.publish(AppComms.events.THEME_CHANGED, {
    oldTheme: 'light',
    newTheme: 'dark'
});

// Calendar updated
AppComms.publish(AppComms.events.CALENDAR_UPDATED, {
    events: [ /* ... */ ],
    lastUpdated: 1234567890
});

// Settings changed
AppComms.publish(AppComms.events.SETTINGS_CHANGED, {
    settings: { /* ... */ }
});

// Error occurred
AppComms.publish(AppComms.events.ERROR_OCCURRED, {
    error: new Error('...'),
    context: 'calendar-service',
    severity: 'error' | 'warn' | 'info'
});
```

---

## Type Definitions

### Common Types

```javascript
/**
 * @typedef {Object} AppState
 * See AppStateManager interface above
 */

/**
 * @typedef {Object} ModuleConfig
 * @property {string} name - Module name
 * @property {string} version - Module version
 * @property {string} description - Module description
 * @property {string[]} dependencies - Required dependencies
 */

/**
 * @typedef {Object} WidgetConfig
 * @property {string} id - Widget ID
 * @property {string} name - Widget display name
 * @property {string} type - Widget type
 * @property {boolean} hasMenu - Widget has navigation menu
 * @property {string[]} [menuItems] - Menu items if hasMenu
 * @property {Object} [settings] - Widget-specific settings
 */

/**
 * @typedef {Object} NavigationState
 * @property {number} row - Current row (0-1)
 * @property {number} col - Current column (0-2)
 * @property {string|null} focusedWidget - Focused widget ID
 * @property {boolean} menuOpen - Sidebar menu open
 * @property {number} selectedMenuItem - Selected menu item index
 */

/**
 * @typedef {Object} SettingsState
 * @property {string} currentPage - Current settings page ID
 * @property {string[]} navigationStack - Page history
 * @property {Object} values - Setting values
 * @property {boolean} isDirty - Has unsaved changes
 */
```

---

## Usage Examples

### Example 1: Module Communication

```javascript
// Dashboard tells Settings to open
AppStateManager.setCurrentModule('settings');

// AppStateManager publishes MODULE_CHANGED event
// Settings module's activate() is called by main.js

// Settings subscribes to data updates
AppComms.subscribe(AppComms.events.DATA_UPDATED, (event) => {
    if (event.type === 'calendar') {
        // Update calendar settings UI
    }
});
```

---

### Example 2: Widget Data Flow

```javascript
// Service fetches data
const events = await CalendarService.getAllCalendarEvents();

// Publish data event
AppComms.publish(AppComms.events.CALENDAR_UPDATED, {
    events,
    lastUpdated: Date.now()
});

// WidgetMessenger listens to CALENDAR_UPDATED
// Updates internal state and broadcasts to all widgets
WidgetMessenger.updateState('calendar', events);
```

---

### Example 3: Input Handling

```javascript
// User presses enter
// InputHandler automatically detects and normalizes to 'enter' action
// Publishes 'input:action' via AppComms

// ActionRouter (subscribed to 'input:action') receives it
// Routes to Dashboard.inputHandler.handleEnter()

const dashboardInputHandler = {
    handleEnter(originalEvent) {
        // Handle enter key
        // ... do something
        return true; // Handled
    }
};

ActionRouter.registerModule('dashboard', dashboardInputHandler);
AppStateManager.setCurrentModule('dashboard');

// Now when user presses Enter, it routes to dashboardInputHandler.handleEnter()
```

---

### Example 4: Settings Change Flow

```javascript
// User changes theme in settings
Settings.set('theme', 'dark');

// Settings publishes event
AppComms.publish(AppComms.events.SETTINGS_CHANGED, {
    settings: { theme: 'dark' }
});

// AppStateManager subscribes and updates
AppComms.subscribe(AppComms.events.SETTINGS_CHANGED, (event) => {
    if (event.settings.theme) {
        AppStateManager.setTheme(event.settings.theme);
        // AppStateManager publishes THEME_CHANGED
    }
});

// WidgetMessenger subscribes to THEME_CHANGED
// Broadcasts new theme to all widgets
```

---

## Contract Guarantees

### What Every Component Promises

1. **Modules:**
   - Implement standard lifecycle (initialize, activate, deactivate, destroy)
   - Provide input handler with all action methods
   - Return true/false from input handlers
   - Clean up on deactivate (remove listeners, timers)

2. **Services:**
   - Return Promises for async operations
   - Throw descriptive errors
   - Emit events via AppComms on data changes
   - Handle auth token refresh automatically

3. **Core:**
   - AppComms delivers events to all subscribers
   - AppStateManager maintains runtime state (no persistence)
   - InputHandler normalizes all input sources to standard actions
   - ActionRouter routes to correct module based on AppStateManager.currentModule
   - WidgetMessenger delivers messages to all widgets with deduplication

4. **Widgets:**
   - Send 'widget-ready' event on load
   - Handle all command types (up, down, etc.)
   - Send 'return-to-menu' when ready to defocus
   - Clean up on 'exit-active'

---

## Testing Contracts

### How to Verify Compliance

```javascript
// Test: Module implements interface
describe('Dashboard Module', () => {
    it('implements ModuleInterface', () => {
        expect(Dashboard.initialize).toBeDefined();
        expect(Dashboard.activate).toBeDefined();
        expect(Dashboard.deactivate).toBeDefined();
        expect(Dashboard.destroy).toBeDefined();
    });

    it('input handler returns boolean', () => {
        const result = DashboardInputHandler.handleUp();
        expect(typeof result).toBe('boolean');
    });
});

// Test: Service emits events
describe('CalendarService', () => {
    it('emits CALENDAR_UPDATED on refresh', async () => {
        const callback = jest.fn();
        AppComms.subscribe(AppComms.events.CALENDAR_UPDATED, callback);

        await CalendarService.refresh();

        expect(callback).toHaveBeenCalledWith(
            expect.objectContaining({ events: expect.any(Array) })
        );
    });
});

// Test: InputHandler normalizes input
describe('InputHandler', () => {
    it('normalizes arrow keys to actions', () => {
        const callback = jest.fn();
        AppComms.subscribe('input:action', callback);

        // Simulate arrow up keypress
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
        document.dispatchEvent(event);

        expect(callback).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'up' })
        );
    });
});
```

---

## Version History

- **v2.2** (2025-10-15) - Integrated high-priority technical debt fixes
  - Added TokenStore interface (separate auth token storage)
  - Added BaseAccountAuth and BaseCalendarAuth (two-layer auth architecture)
  - Updated JWTService to emphasize token/settings separation
  - Updated CalendarService with account-prefixed calendar IDs
  - Added calendar ID migration methods
  - Documented multi-provider auth support (Google, Amazon, iCloud, Outlook)
- **v2.1** (2025-10-15) - Updated to reflect actual implementation
  - All core components are singletons (not static classes)
  - Added InputHandler component (new)
  - Removed AppStateManager.persist() (runtime-only now)
  - Updated ActionRouter to pub/sub pattern
  - Expanded event catalog to 25+ events
- **v2.0** (2025-10-15) - Initial complete interface specification
- **v1.0** (Legacy) - Implicit interfaces in legacy code

---

**End of API Interfaces Document**
