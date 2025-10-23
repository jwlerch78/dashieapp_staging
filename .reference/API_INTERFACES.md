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
5. [Widget Layer Interface](#widget-layer-interface)
6. [Widget Communication Protocol](#widget-communication-protocol)
7. [Event System](#event-system)
8. [Type Definitions](#type-definitions)

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
     * Get all registered event names
     * @returns {Array<string>} List of event names with subscribers
     */
    getRegisteredEvents() {}

    /**
     * Check if event has any subscribers
     * @param {string} eventName - Event name to check
     * @returns {boolean} True if event has subscribers
     */
    hasSubscribers(eventName) {}

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
     * @param {string|Object} command - Command to send
     *   - If string: wraps as {type: 'command', action: 'string', payload: null}
     *   - If object: wraps with {type: 'command', action: command.action, ...additionalFields}
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

### 5. WidgetDataManager (Widget Data Loading)

**Purpose:** Manages data loading and distribution to widgets

**Relationship to WidgetMessenger:**
- **WidgetMessenger** handles communication infrastructure (sending messages, managing connections)
- **WidgetDataManager** handles data loading logic (fetching calendar data, photos, weather)
- **WidgetDataManager** listens for `widget-ready` messages and triggers data loading
- **WidgetDataManager** uses WidgetMessenger to send data to widgets

**Interface:**
```javascript
/**
 * WidgetDataManager - Singleton instance
 * Exported as: import { getWidgetDataManager } from './js/core/widget-data-manager.js'
 */
class WidgetDataManager {
    /**
     * Initialize the widget data manager
     * Sets up message listeners and calendar cache
     * @returns {Promise<void>}
     */
    async initialize() {}

    /**
     * Register a widget iframe
     * @param {string} widgetId - Widget identifier
     * @param {HTMLIFrameElement} iframe - Widget iframe element
     * @returns {void}
     */
    registerWidget(widgetId, iframe) {}

    /**
     * Unregister a widget
     * @param {string} widgetId - Widget identifier
     * @returns {void}
     */
    unregisterWidget(widgetId) {}

    /**
     * Handle widget message (widget-ready, widget-config, etc.)
     * @param {Object} message - Message from widget
     * @returns {Promise<void>}
     */
    async handleWidgetMessage(message) {}

    /**
     * Load calendar data and send to calendar/agenda widgets
     * @returns {Promise<void>}
     */
    async loadCalendarData() {}

    /**
     * Load photos data and send to photos widget
     * @returns {Promise<void>}
     */
    async loadPhotosData() {}

    /**
     * Refresh calendar data (force refetch)
     * @returns {Promise<void>}
     */
    async refreshCalendarData() {}

    /**
     * Send data to specific widget
     * @param {string} widgetId - Widget ID
     * @param {string} messageType - Message type ('data', 'config', etc.)
     * @param {Object} payload - Data payload
     * @returns {void}
     */
    sendToWidget(widgetId, messageType, payload) {}

    /**
     * Start auto-refresh for widget data
     * @param {string} widgetId - Widget ID
     * @param {number} intervalMs - Refresh interval in milliseconds
     * @returns {void}
     */
    startAutoRefresh(widgetId, intervalMs) {}

    /**
     * Stop auto-refresh for widget
     * @param {string} widgetId - Widget ID
     * @returns {void}
     */
    stopAutoRefresh(widgetId) {}
}

// Singleton export
export function getWidgetDataManager() { return widgetDataManager; }
```

**Usage Example:**
```javascript
import { getWidgetDataManager } from './js/core/widget-data-manager.js';

// Initialize
const widgetDataManager = getWidgetDataManager();
await widgetDataManager.initialize();

// Register widget
const iframe = document.getElementById('widget-calendar');
widgetDataManager.registerWidget('calendar', iframe);

// Load calendar data (automatically sends to registered calendar widgets)
await widgetDataManager.loadCalendarData();

// WidgetDataManager automatically:
// - Listens for widget-ready messages
// - Loads appropriate data for each widget type
// - Handles auto-refresh intervals
// - Coordinates with WidgetMessenger for message sending
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

## Widget Layer Interface

### Widget Lifecycle Contract

**Every widget must implement this lifecycle:**

```javascript
/**
 * Widget Lifecycle (runs in iframe)
 * Each widget is an isolated HTML page loaded in an iframe
 */

// 1. On page load - Signal ready to parent
window.addEventListener('load', () => {
    if (window.parent !== window) {
        window.parent.postMessage({
            type: 'widget-ready',
            widget: 'widgetId',
            widgetId: 'widgetId',
            hasMenu: false
        }, '*');
    }
});

// 2. Listen for messages from parent
window.addEventListener('message', (event) => {
    const data = event.data;

    if (!data) return;

    // Handle commands (navigation actions)
    if (data.action && !data.type) {
        handleCommand(data.action);
    }

    // Handle system messages (data updates, theme changes)
    if (data.type) {
        handleSystemMessage(data);
    }
});

// 3. Handle state transitions and navigation
function handleCommand(action) {
    // State transitions FIRST
    if (action === 'enter-focus') {
        // Widget is now FOCUSED (centered, has attention)
        this.hasFocus = true;
        showFocusIndicator();
        return;
    }

    if (action === 'enter-active') {
        // Widget is now ACTIVE (receiving navigation)
        this.isActive = true;
        dimFocusMenu(); // If widget has focus menu
        return;
    }

    if (action === 'exit-active') {
        // Widget no longer active
        this.isActive = false;
        restoreFocusMenu(); // If widget has focus menu
        return;
    }

    if (action === 'exit-focus') {
        // Widget is defocused
        this.hasFocus = false;
        hideFocusIndicator();
        return;
    }

    // Navigation ONLY if active
    if (!this.isActive) return;

    switch (action) {
        case 'up': navigateUp(); break;
        case 'down': navigateDown(); break;
        case 'left': navigateLeft(); break;
        case 'right': navigateRight(); break;
        case 'enter': handleEnter(); break;
    }
}
```

---

### Widget States (3-State Model)

Widgets transition through 3 distinct states:

```
UNFOCUSED → FOCUSED → ACTIVE

State 1: UNFOCUSED
- Widget in grid, not centered
- No attention, no commands
- Default visual state

State 2: FOCUSED
- Widget is centered
- Has visual attention
- Focus menu shown (if configured)
- NOT yet receiving navigation commands

State 3: ACTIVE
- User inside widget content
- Receiving navigation commands
- Focus menu dimmed (if present)
- Widget controls navigation
```

**State Transitions:**

```javascript
// Grid → Focused
App sends: { action: 'enter-focus' }
Widget: this.hasFocus = true
Widget: Show focus indicator
Widget: Display focus menu (if configured)

// Focused → Active
App sends: { action: 'enter-active' }
Widget: this.isActive = true
Widget: Dim focus menu (scale to 95%)
Widget: Begin accepting navigation commands

// Active → Focused (return to menu)
Widget sends: { type: 'return-to-menu' }
App sends: { action: 'exit-active' }
Widget: this.isActive = false
Widget: Restore focus menu (scale to 100%)
Widget: Stop accepting navigation commands

// Focused → Grid
App sends: { action: 'exit-focus' }
Widget: this.hasFocus = false
Widget: Hide focus indicator
Widget: Hide focus menu
```

---

### Focus Menu System (Optional)

Widgets can optionally provide a focus menu with navigation shortcuts, view options, or actions.

**Focus Menu Configuration:**

```javascript
// Widget sends menu config on init
window.parent.postMessage({
    type: 'widget-config',
    widget: 'calendar',
    config: {
        hasFocusMenu: true,
        menuItems: [
            {
                id: 'view-week',
                label: 'Week View',
                icon: '📅',
                type: 'view', // 'view' | 'action' | 'setting'
                active: true  // Currently selected
            },
            {
                id: 'view-month',
                label: 'Month View',
                icon: '📆',
                type: 'view',
                active: false
            },
            {
                id: 'action-today',
                label: 'Go to Today',
                icon: '🏠',
                type: 'action'
            }
        ]
    }
}, '*');
```

**Menu Item Types:**

1. **View Items** - Mutually exclusive options (radio button style)
   - Only one active at a time
   - Shown with left border when active
   - Used for: Week/Day/Month views, display modes

2. **Action Items** - One-time actions
   - No active state
   - Shown with icon only
   - Used for: "Go to Today", "Refresh", "Settings"

3. **Setting Items** - Toggle settings
   - Can be active/inactive independently
   - Used for: Show weekends, Show all-day events

**Focus Menu Messages:**

```javascript
// App → Widget: Menu navigation
{
    action: 'menu-selection-changed',
    selectedIndex: 2 // Which menu item is highlighted
}

// App → Widget: Menu item selected
{
    action: 'menu-item-selected',
    itemId: 'view-month'
}

// App → Widget: Menu active state
{
    action: 'menu-active',
    active: true // User navigating menu vs. widget content
}
```

**Widget Handling Menu Actions:**

```javascript
function handleMenuAction(data) {
    if (data.action === 'menu-selection-changed') {
        // Update visual highlight (optional - parent handles this)
        // Just track for debugging
        this.currentMenuSelection = data.selectedIndex;
    }

    if (data.action === 'menu-item-selected') {
        const item = this.menuConfig.menuItems.find(i => i.id === data.itemId);

        if (item.type === 'view') {
            // Switch view mode
            this.switchView(data.itemId);

            // Update menu config
            this.updateMenuActiveItem(data.itemId);
        }

        if (item.type === 'action') {
            // Execute action
            if (data.itemId === 'action-today') {
                this.goToToday();
            }
        }
    }
}
```

---

### "Home Position" Pattern

Widgets with navigation (calendar, map) use a "home position" to decide when to return control to the focus menu.

**Pattern:**

```javascript
class WidgetWithNavigation {
    constructor() {
        this.homeDate = null;        // Home position
        this.isAtHome = true;         // Currently at home?
    }

    handleEnterActive() {
        // Remember starting position as "home"
        this.homeDate = new Date(this.currentDate);
        this.isAtHome = true;
        this.isActive = true;
    }

    handleLeft() {
        if (!this.isActive) return;

        // If already at home, don't navigate - return to menu
        if (this.isAtHome) {
            this.requestReturnToMenu();
            return;
        }

        // Navigate backward
        this.navigatePrevious();

        // Check if we arrived at home
        this.updateHomeStatus();
    }

    updateHomeStatus() {
        // Check if current position matches home
        this.isAtHome = this.isSamePosition(this.currentDate, this.homeDate);
    }

    requestReturnToMenu() {
        // Tell parent we're done
        window.parent.postMessage({
            type: 'return-to-menu'
        }, '*');
    }
}
```

**Why this pattern:**
- Prevents user from accidentally navigating into the past
- Provides clear "exit point" back to focus menu
- Works for calendar (date navigation), map (pan/zoom), etc.

---

### Widget Message Handling Pattern

**Recommended structure:**

```javascript
function setupMessageListener() {
    window.addEventListener('message', (event) => {
        const data = event.data;
        if (!data) return;

        // STEP 1: Check for menu actions FIRST
        const menuActions = ['menu-active', 'menu-selection-changed', 'menu-item-selected'];
        if (menuActions.includes(data.action)) {
            handleMenuAction(data);
            return; // Don't process as navigation command
        }

        // STEP 2: Handle state transitions
        if (['enter-focus', 'enter-active', 'exit-active', 'exit-focus'].includes(data.action)) {
            handleStateTransition(data.action);
            return;
        }

        // STEP 3: Handle navigation (only if active)
        if (data.action && !data.type) {
            if (!this.isActive) return; // Ignore if not active
            handleNavigation(data.action);
            return;
        }

        // STEP 4: Handle system messages
        if (data.type) {
            handleSystemMessage(data);
        }
    });
}
```

---

### Required Widget Methods

**Every widget must implement:**

```javascript
class Widget {
    constructor() {
        this.hasFocus = false;   // FOCUSED state
        this.isActive = false;   // ACTIVE state
        this.currentTheme = null;
        this.widgetId = 'unique-id';
    }

    // REQUIRED: Signal ready
    signalReady() {
        window.parent.postMessage({
            type: 'widget-ready',
            widget: this.widgetId
        }, '*');
    }

    // REQUIRED: Handle state transitions
    handleEnterFocus() {
        this.hasFocus = true;
        // Show focus indicator, display menu
    }

    handleEnterActive() {
        this.isActive = true;
        // Dim menu, start accepting navigation
    }

    handleExitActive() {
        this.isActive = false;
        // Restore menu, stop navigation
    }

    handleExitFocus() {
        this.hasFocus = false;
        // Hide focus indicator, hide menu
    }

    // REQUIRED: Handle navigation (if isActive)
    handleUp() {}
    handleDown() {}
    handleLeft() {}
    handleRight() {}
    handleEnter() {}
    handleEscape() {}

    // REQUIRED: Handle system messages
    handleThemeChange(theme) {
        this.currentTheme = theme;
        this.applyTheme(theme);
    }

    handleDataUpdate(payload) {
        // Update with fresh data
    }

    // OPTIONAL: Send menu config (if has focus menu)
    sendMenuConfig() {
        window.parent.postMessage({
            type: 'widget-config',
            widget: this.widgetId,
            config: {
                hasFocusMenu: true,
                menuItems: [/* ... */]
            }
        }, '*');
    }

    // OPTIONAL: Request return to menu
    requestReturnToMenu() {
        window.parent.postMessage({
            type: 'return-to-menu'
        }, '*');
    }
}
```

---

### Widget-Specific Interfaces

**Calendar Widget:**
```javascript
class CalendarWidget extends Widget {
    constructor() {
        super();
        this.currentView = 'week'; // 'week' | 'month' | 'day'
        this.currentDate = new Date();
        this.homeDate = null;
        this.isAtHome = true;
    }

    // Calendar-specific
    switchView(viewMode) {}
    navigatePrevious() {}  // Left arrow - previous week/month
    navigateNext() {}      // Right arrow - next week/month
    scrollUp() {}          // Up arrow - scroll calendar up
    scrollDown() {}        // Down arrow - scroll calendar down
    goToToday() {}         // Menu action - jump to today
}
```

**Photos Widget:**
```javascript
class PhotosWidget extends Widget {
    constructor() {
        super();
        this.currentPhotoIndex = 0;
        this.autoAdvanceInterval = null;
        this.transitionTime = 5000;
    }

    // Photos-specific
    showNext() {}          // Right arrow - next photo
    showPrevious() {}      // Left arrow - previous photo
    pauseSlideshow() {}    // Space - pause/resume
    openSettings() {}      // Enter - open photo settings
}
```

---

## Widget Communication Protocol

**Note:** All messages use standard format with explicit `type` field. Legacy formats (messages without `type` field) have been removed as of 2025-10-23.

### Messages: App → Widget

```javascript
// Command message (STANDARD FORMAT - always includes type field)
{
    type: 'command',
    action: 'up' | 'down' | 'left' | 'right' | 'enter' | 'escape' | 'enter-focus' | 'exit-focus' | 'enter-active' | 'exit-active',
    payload: null
}

// Complex command message (with additional fields)
{
    type: 'command',
    action: 'menu-item-selected',
    payload: null,
    itemId: 'view-week',          // Additional fields preserved
    selectedItem: { id: '...', label: '...' }
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
    widget: 'calendar',
    widgetId: 'calendar',
    hasMenu: boolean
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

- **v2.4** (2025-10-23) - Widget messaging standardization and documentation audit
  - BREAKING: Removed legacy command message format (messages without `type` field)
  - All command messages now use standard format: `{type: 'command', action: X, payload: null}`
  - Added WidgetDataManager to Core Layer Interfaces (previously undocumented)
  - Updated WidgetMessenger.sendCommandToWidget() to document `{string|Object}` parameter
  - Added AppComms.getRegisteredEvents() and hasSubscribers() methods
  - Added note about legacy format removal (2025-10-23)
  - Added complex command message example (with itemId, selectedItem fields)
- **v2.3** (2025-10-16) - Added Widget Layer Interface documentation
  - NEW: Widget Layer Interface section (complete widget contracts)
  - Documented 3-state model (UNFOCUSED → FOCUSED → ACTIVE)
  - Documented Focus Menu System (optional widget feature)
  - Documented "Home Position" pattern for navigation widgets
  - Documented widget message handling patterns
  - Added widget-specific interfaces (Calendar, Photos)
  - Updated Table of Contents
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
