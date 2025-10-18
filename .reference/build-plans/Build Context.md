# Build Context - Dashie Dashboard Rebuild

**Last Updated:** 2025-10-18
**For Use With:** Phase 4 & Phase 5 Build Plans

---

## Table of Contents

1. [Purpose of This Document](#purpose-of-this-document)
2. [Architecture Overview](#architecture-overview)
3. [Working with Legacy Code](#working-with-legacy-code)
4. [Current State Assessment](#current-state-assessment)
5. [Key Architectural Principles](#key-architectural-principles)
6. [Technology Stack](#technology-stack)
7. [File Organization](#file-organization)
8. [Common Patterns](#common-patterns)
9. [Testing Strategy](#testing-strategy)
10. [Important Notes](#important-notes)

---

## Purpose of This Document

This document provides essential context for working on Phases 4 and 5 of the Dashie dashboard rebuild. Read this **before** starting any implementation work to understand:

- The desired architecture and why it was designed this way
- How to work with legacy code (`.legacy/` folder)
- Current implementation status
- Coding standards and patterns to follow

---

## Architecture Overview

### High-Level Design

Dashie uses a **modular, event-driven architecture** with iframe-isolated widgets:

```
┌─────────────────────────────────────────────────┐
│                   index.html                     │
│              Application Entry Point             │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│                  Core Layer                      │
│  app-comms • app-state-manager • action-router  │
│  widget-messenger • input-handler               │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│                 Module Layer                     │
│  Dashboard • Settings • Login • Modals • Welcome│
└─────────────────────────────────────────────────┘
                        ↓
┌──────────────────┬──────────────────────────────┐
│   Data Layer     │      UI Layer                │
│  auth • services │  theme • toast • components  │
└──────────────────┴──────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│                 Widgets Layer                    │
│  Calendar • Photos • Clock • Weather • etc.     │
│  (Iframe-isolated, postMessage communication)   │
└─────────────────────────────────────────────────┘
```

### Why This Architecture?

**Separation of Concerns:**
- Core handles infrastructure (events, state, routing)
- Modules handle features (dashboard, settings, login)
- Data layer handles all API/database operations
- Widgets are isolated for security and performance

**Event-Driven Communication:**
- Modules don't call each other directly
- Use pub/sub pattern via `AppComms`
- Loose coupling enables testing and maintenance

**Iframe-Isolated Widgets:**
- Style isolation (widget CSS won't affect main app)
- Script isolation (widget errors won't crash app)
- Security (widgets can't access main app DOM)
- Performance (widgets can be lazy-loaded)

---

## Working with Legacy Code

### **CRITICAL: Preserve Working Functionality**

The `.legacy/` folder contains a **fully functional** 27,000-line codebase. Your job is **NOT** to rewrite from scratch, but to:

1. **Migrate working code** to the new architecture
2. **Modify only** what's necessary to fit architectural standards
3. **Preserve** all business logic, UI behavior, and functionality

### Legacy Code Philosophy

**✅ DO:**
- Copy working functions, classes, and logic from `.legacy/`
- Keep variable names, algorithms, and UI layouts
- Preserve all edge case handling and bug fixes
- Maintain compatibility with Fire TV, Desktop, and Mobile
- Keep existing CSS styling and animations

**❌ DON'T:**
- Rewrite logic from scratch unless absolutely necessary
- Change working algorithms "to make them better"
- Remove code you don't understand (it may handle edge cases)
- Simplify complex logic without understanding why it's complex
- Break existing Fire TV compatibility

### Migration Pattern

```javascript
// GOOD MIGRATION EXAMPLE:

// Step 1: Copy working function from .legacy/
// .legacy/widgets/dcal/calendar.js
function formatEventTime(event) {
    // Complex logic that handles:
    // - All-day events
    // - Multi-day events
    // - Timezone conversions
    // - Fire TV display quirks
    if (event.start.dateTime) {
        const start = new Date(event.start.dateTime);
        // ... 20 lines of working logic ...
        return formattedTime;
    } else {
        return 'All day';
    }
}

// Step 2: Migrate to new location with minimal changes
// js/widgets/calendar/calendar.js
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('CalendarWidget');

class CalendarWidget {
    formatEventTime(event) {
        // PRESERVED: Original working logic from legacy
        if (event.start.dateTime) {
            const start = new Date(event.start.dateTime);
            // ... exact same 20 lines ...
            return formattedTime;
        } else {
            return 'All day';
        }
    }
}

// ONLY architectural changes:
// - Wrapped in class (architectural requirement)
// - Added logger import (architectural standard)
// - LOGIC UNCHANGED
```

```javascript
// BAD MIGRATION EXAMPLE (DON'T DO THIS):

// Step 1: See legacy function
// .legacy/widgets/dcal/calendar.js (working code)
function formatEventTime(event) {
    // ... 20 lines of battle-tested logic ...
}

// Step 2: "Improve" it by rewriting
// js/widgets/calendar/calendar.js
class CalendarWidget {
    formatEventTime(event) {
        // "I'll make it simpler!"
        return event.start.dateTime
            ? new Date(event.start.dateTime).toLocaleTimeString()
            : 'All day';

        // ❌ PROBLEM: Lost timezone handling
        // ❌ PROBLEM: Lost Fire TV compatibility fixes
        // ❌ PROBLEM: Lost multi-day event handling
        // ❌ PROBLEM: Lost edge case handling
    }
}
```

### Legacy Code Structure

```
.legacy/
├── js/
│   ├── navigation.js             (1,052 lines - Dashboard grid/menu/focus)
│   ├── data-manager.js           (451 lines - Data orchestration)
│   ├── jwt-service-core.js       (702 lines - JWT lifecycle)
│   ├── jwt-token-operations.js   (687 lines - Token operations)
│   ├── simple-auth.js            (Supabase auth)
│   └── ...
│
├── widgets/
│   ├── dcal/                     # Calendar widget (MIGRATE IN PHASE 4.5)
│   │   ├── index.html
│   │   ├── calendar.js           # Complex event rendering logic
│   │   └── styles.css
│   │
│   ├── agenda/                   # Agenda widget (MIGRATE IN PHASE 4.8)
│   ├── dphotos/                  # Photos widget (MIGRATE IN PHASE 5.2)
│   ├── weather/                  # Weather widget (DEFER TO PHASE 5.5+)
│   └── ...
│
├── settings/
│   ├── settings.js               # Settings orchestration
│   ├── settings-ui.js            # Settings modal rendering
│   └── pages/                    # Settings page implementations
│
└── css/
    ├── navigation.css            # Dashboard styles
    ├── settings.css              # Settings styles
    └── ...
```

### What to Migrate vs. What's Already Done

**✅ Already Migrated (Don't Duplicate):**
- Core infrastructure (app-comms, app-state-manager, action-router, input-handler, widget-messenger)
- Dashboard module (fully refactored, working)
- Settings module (scaffolding exists)
- Modals module (basic implementation)
- Auth system (two-layer architecture, token-store, edge-client, session-manager)
- Logger, platform-detector, console-commands

**📦 Ready to Migrate in Phase 4:**
- Login UI (currently in index.html inline)
- Calendar widget (`.legacy/widgets/dcal/`)
- Agenda widget (`.legacy/widgets/agenda/`)
- Settings pages (calendar, account)

**📦 Ready to Migrate in Phase 5:**
- Welcome wizard (`.legacy/welcome/`)
- Photos widget (`.legacy/widgets/dphotos/`)
- Remaining settings pages

---

## Current State Assessment

### What's Working (✅)

**Core Layer (95% complete):**
- ✅ AppComms pub/sub system
- ✅ AppStateManager global state
- ✅ InputHandler (normalizes keyboard/D-pad/touch)
- ✅ ActionRouter (routes to modules)
- ✅ WidgetMessenger (widget communication)

**Dashboard Module (95% complete):**
- ✅ Grid navigation (2×3 layout)
- ✅ Sidebar menu
- ✅ Widget focus/defocus
- ✅ Modular refactor (dom-builder, event-handlers, visual-effects)
- ⚠️ Focus overlay (has bugs - FIX IN PHASE 4.1)

**Auth System (85% complete):**
- ✅ Two-layer architecture (account-auth vs calendar-auth)
- ✅ Google OAuth (web + device flow)
- ✅ Token store (dual-write pattern)
- ✅ EdgeClient (Supabase edge functions)
- ✅ Session manager

**Settings Module (70% complete):**
- ✅ Modal rendering
- ✅ Page navigation
- ✅ Display settings page
- ⚠️ Calendar settings page (needs account-prefixed IDs)
- ⚠️ Account settings page (needs delete account)
- ⚠️ Settings service (needs verification)

**Widgets (25% complete):**
- ✅ Clock widget (working)
- ✅ Header widget (working, may need lifecycle fixes)
- ❌ Calendar widget (MIGRATE IN PHASE 4.5)
- ❌ Agenda widget (MIGRATE IN PHASE 4.8)
- ❌ Photos widget (MIGRATE IN PHASE 5.2)

### What Needs Work (⚠️ / ❌)

**Phase 4 Priorities:**
- ❌ Extract index.html inline JavaScript → main.js + initializers + Login module
- ❌ Extract index.html inline CSS → module CSS files
- ❌ Fix focus overlay bugs
- ⚠️ Verify settings-service.js works with EdgeClient
- ❌ Implement calendar ID prefixing (`{accountType}-{calendarId}`)
- ❌ Complete calendar-service.js implementation
- ❌ Migrate Calendar widget from `.legacy/widgets/dcal/`
- ❌ Migrate Agenda widget from `.legacy/widgets/agenda/`
- ❌ Build Account settings page (delete account functionality)

**Phase 5 Priorities:**
- ❌ Migrate Welcome wizard from `.legacy/welcome/`
- ❌ Migrate Photos widget from `.legacy/widgets/dphotos/`
- ❌ Build photo-service.js
- ❌ Build Photos settings page
- ❌ Complete remaining settings pages

---

## Key Architectural Principles

### 1. Single Responsibility Principle

Each file should do **one thing** well:

```javascript
// ✅ GOOD: dashboard-dom-builder.js (155 lines)
// ONLY creates DOM elements, no event handling, no state management
export function createGridCell(row, col, widgetId) {
    const cell = document.createElement('div');
    cell.className = 'dashboard-grid__cell';
    cell.dataset.row = row;
    cell.dataset.col = col;
    return cell;
}

// ❌ BAD: Mixing concerns
export function createGridCell(row, col, widgetId) {
    const cell = document.createElement('div');
    cell.className = 'dashboard-grid__cell';

    // ❌ Event handling (should be in event-handlers.js)
    cell.addEventListener('click', () => {
        focusWidget(widgetId);
    });

    // ❌ State management (should be in state-manager.js)
    currentFocusedCell = { row, col };

    return cell;
}
```

### 2. Module Standard Interface

Every module must implement:

```javascript
// js/modules/ModuleName/module-name.js
export default {
    // Lifecycle methods
    async initialize() {
        // Called once on app startup
        // Set up event listeners, load config
    },

    activate() {
        // Called when module becomes active
        // Render UI, start listening to input
    },

    deactivate() {
        // Called when module becomes inactive
        // Hide UI, stop listening to input
    },

    destroy() {
        // Rarely used - complete cleanup
    },

    // State methods
    getState() {
        // Return module state
    },

    setState(state) {
        // Update module state
    }
};
```

### 3. Event-Driven Communication

Use `AppComms` for cross-module communication:

```javascript
// ✅ GOOD: Publish event
import AppComms from '../../core/app-comms.js';

function updateTheme(newTheme) {
    // Update local state
    currentTheme = newTheme;

    // Broadcast to interested parties
    AppComms.publish(AppComms.events.THEME_CHANGED, {
        oldTheme: previousTheme,
        newTheme: newTheme
    });
}

// ✅ GOOD: Subscribe to event
AppComms.subscribe(AppComms.events.THEME_CHANGED, (data) => {
    applyTheme(data.newTheme);
});

// ❌ BAD: Direct module coupling
import Settings from '../Settings/settings.js';

function updateTheme(newTheme) {
    Settings.applyTheme(newTheme); // ❌ Direct dependency
}
```

### 4. CSS-First Styling

Keep styling in CSS, JavaScript only manages state:

```javascript
// ✅ GOOD: JavaScript toggles classes
function focusWidget(widgetId) {
    element.classList.add('dashboard-grid__cell--focused');
}

// ❌ BAD: JavaScript applies inline styles
function focusWidget(widgetId) {
    element.style.transform = 'scale(1.1)';
    element.style.opacity = '1';
}
```

```css
/* ✅ GOOD: CSS handles presentation */
.dashboard-grid__cell {
    transform: scale(1);
    opacity: 0.7;
    transition: all 0.3s ease;
}

.dashboard-grid__cell--focused {
    transform: scale(1.1);
    opacity: 1;
}
```

### 5. BEM Naming Convention

Use `.module-component__element--modifier`:

```css
/* Dashboard module */
.dashboard-grid { }                          /* Block */
.dashboard-grid__cell { }                    /* Element */
.dashboard-grid__cell--focused { }           /* Modifier */

/* Settings module */
.settings-modal { }                          /* Block */
.settings-modal__header { }                  /* Element */
.settings-modal__page { }                    /* Element */
.settings-modal__page--active { }            /* Modifier */
```

### 6. Widget 3-State Model

Widgets transition through 3 states:

```
UNFOCUSED → FOCUSED → ACTIVE

State 1: UNFOCUSED
- Widget in grid, not centered
- No commands received

State 2: FOCUSED
- Widget centered
- Focus menu shown
- NOT receiving navigation

State 3: ACTIVE
- User inside widget
- Receiving navigation (up/down/left/right)
- Focus menu dimmed
```

```javascript
// Widget handles state transitions
function handleMessage(data) {
    if (data.action === 'enter-focus') {
        this.hasFocus = true;
        showFocusIndicator();
    }

    if (data.action === 'enter-active') {
        this.isActive = true;
        dimFocusMenu();
    }

    // Navigation only when active
    if (this.isActive && data.action === 'up') {
        navigateUp();
    }
}
```

---

## Technology Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - BEM naming, CSS variables, no preprocessor
- **JavaScript ES6+** - Modules, async/await, classes
- **No frameworks** - Vanilla JS for Fire TV compatibility

### Backend
- **Supabase** - PostgreSQL database + storage
- **Edge Functions** - Serverless TypeScript functions
- **OAuth2** - Google authentication

### Platforms
- **Fire TV** - Primary target (Amazon WebView ~Chromium v25-40)
- **Desktop** - Chrome, Firefox, Safari
- **Mobile** - Android, iOS

### Development Tools
- **Logger** - Custom logging system with localStorage persistence
- **Console Commands** - Debug helpers (`window.dashie.*`)
- **Platform Detector** - Auto-detect device type

---

## File Organization

### Current Directory Structure

```
dashieapp_staging/
├── index.html                    # Entry point (NEEDS REFACTORING IN PHASE 4.1)
├── config.js                     # Global configuration
│
├── js/
│   ├── core/                     # Core infrastructure (95% complete)
│   │   ├── app-comms.js          # ✅ Pub/sub event system
│   │   ├── app-state-manager.js  # ✅ Global state
│   │   ├── input-handler.js      # ✅ Input normalization
│   │   ├── action-router.js      # ✅ Input routing
│   │   ├── widget-messenger.js   # ✅ Widget communication
│   │   ├── widget-data-manager.js # ✅ Widget data orchestration
│   │   └── theme.js              # ✅ Theme management
│   │
│   ├── modules/                  # Feature modules
│   │   ├── Dashboard/            # ✅ 95% complete
│   │   ├── Settings/             # ⚠️ 70% complete (PHASE 4)
│   │   ├── Modals/               # ⚠️ Basic implementation (PHASE 4)
│   │   ├── Login/                # ❌ Empty (BUILD IN PHASE 4.1)
│   │   └── Welcome/              # ❌ Empty (BUILD IN PHASE 5.1)
│   │
│   ├── data/                     # Data layer
│   │   ├── auth/                 # ✅ 85% complete
│   │   │   ├── account-auth/     # ✅ Google account login
│   │   │   ├── calendar-auth/    # ✅ Google calendar API
│   │   │   ├── orchestration/    # ✅ Session manager, coordinator
│   │   │   ├── providers/        # ✅ Web OAuth, device flow
│   │   │   ├── token-store.js    # ✅ Dual-write token storage
│   │   │   └── edge-client.js    # ✅ Supabase edge functions
│   │   │
│   │   └── services/             # Business logic services
│   │       ├── calendar-service.js      # ⚠️ Minimal (COMPLETE IN PHASE 4.3)
│   │       ├── calendar-config-store.js # ✅ Calendar settings
│   │       ├── settings-service.js      # ⚠️ Needs verification (PHASE 4.2)
│   │       ├── heartbeat-service.js     # ✅ Session heartbeat
│   │       └── google/
│   │           └── google-api-client.js # ✅ Google API HTTP client
│   │
│   ├── widgets/                  # Widget implementations (25% complete)
│   │   ├── clock/                # ✅ Working
│   │   ├── header/               # ✅ Working (may need lifecycle fixes)
│   │   ├── calendar/             # ❌ BUILD IN PHASE 4.5
│   │   ├── agenda/               # ❌ BUILD IN PHASE 4.8
│   │   └── photos/               # ❌ BUILD IN PHASE 5.2
│   │
│   ├── ui/                       # Global UI components
│   │   ├── theme-applier.js      # ✅ Theme switching
│   │   └── toast.js              # ✅ Notifications
│   │
│   └── utils/                    # Utilities
│       ├── logger.js             # ✅ Logging system
│       ├── platform-detector.js  # ✅ Platform detection
│       ├── console-commands.js   # ✅ Debug commands
│       ├── modal-navigation-manager.js # ✅ Modal D-pad navigation
│       └── geocoding-helper.js   # ✅ Location services
│
├── css/
│   ├── core/
│   │   └── variables.css         # ✅ CSS custom properties
│   └── modules/
│       ├── dashboard.css         # ✅ Dashboard styles
│       ├── settings.css          # ✅ Settings styles
│       └── modals.css            # ✅ Modal styles
│
└── .legacy/                      # Legacy codebase (REFERENCE ONLY)
    ├── js/
    ├── widgets/
    ├── settings/
    └── css/
```

---

## Common Patterns

### Pattern 1: Module Registration

```javascript
// index.html or main.js
import Dashboard from './js/modules/Dashboard/dashboard.js';
import DashboardInputHandler from './js/modules/Dashboard/dashboard-input-handler.js';
import ActionRouter from './js/core/action-router.js';
import AppStateManager from './js/core/app-state-manager.js';

// Initialize module
await Dashboard.initialize();

// Register input handler
ActionRouter.registerModule('dashboard', DashboardInputHandler);

// Set as active
AppStateManager.setCurrentModule('dashboard');

// Activate
Dashboard.activate();
```

### Pattern 2: Widget Communication

```javascript
// Main app sends data to widget
import WidgetMessenger from './js/core/widget-messenger.js';

const events = await calendarService.getEvents();
WidgetMessenger.sendToWidget('calendar', 'data', {
    dataType: 'events',
    data: events
});

// Widget receives data
window.addEventListener('message', (event) => {
    if (event.data.type === 'data' && event.data.dataType === 'events') {
        this.events = event.data.data;
        this.renderEvents();
    }
});
```

### Pattern 3: Settings Persistence

```javascript
// Save settings
import settingsService from './js/data/services/settings-service.js';

await settingsService.set('theme', 'dark');
await settingsService.save(); // Dual-write: localStorage + Supabase

// Load settings
const theme = await settingsService.get('theme');
```

### Pattern 4: Event Publishing

```javascript
import AppComms from './js/core/app-comms.js';

// Publish event
AppComms.publish(AppComms.events.THEME_CHANGED, {
    oldTheme: 'light',
    newTheme: 'dark'
});

// Subscribe to event
const unsubscribe = AppComms.subscribe(AppComms.events.THEME_CHANGED, (data) => {
    console.log('Theme changed:', data.newTheme);
});

// Cleanup
unsubscribe();
```

---

## Testing Strategy

### Test After Each Step

Every phase step should include:

1. **Manual Testing** - Test in browser + Fire TV simulator
2. **Console Verification** - Use `window.dashie` debug commands
3. **Logger Verification** - Check logs for errors
4. **Visual Verification** - UI looks correct, animations smooth

### Example Test Plan (Phase 4.1)

```javascript
// After extracting index.html JavaScript to main.js

// TEST 1: Core initialization
// - Open browser console
// - Check for initialization logs
// - Verify no errors
window.dashie.core.getStatus() // Should show all core systems initialized

// TEST 2: Module activation
window.dashie.state.getCurrentModule() // Should return 'dashboard'
window.dashie.dashboard.getState() // Should show dashboard state

// TEST 3: Input routing
// - Press arrow keys
// - Verify grid navigation works
// - Check ActionRouter logs

// TEST 4: Login flow
// - Sign out
// - Reload page
// - Verify login screen shows
// - Sign in
// - Verify dashboard loads
```

### Console Commands Available

```javascript
// Core system
window.dashie.core.getStatus()           // Core system status
window.dashie.state.getState()           // App state
window.dashie.logger.getStats()          // Logger statistics

// Modules
window.dashie.dashboard.getState()       // Dashboard state
window.Settings.getState()               // Settings state

// Auth
window.sessionManager.getUser()          // Current user
window.sessionManager.isAuthenticated()  // Auth status
window.edgeClient.getStatus()            // EdgeClient status

// Services
window.dashie.calendar.getEvents()       // Calendar events (once implemented)
```

---

## Important Notes

### Fire TV Compatibility

**Critical constraints for Fire TV (Amazon WebView ~Chromium v25-40):**

1. **Avoid viewport units with transforms:**
   ```css
   /* ❌ BAD: May not work on Fire TV */
   .element {
       width: 50vw;
       transform: translate(-50%, 0);
   }

   /* ✅ GOOD: Use percentages */
   .element {
       width: 50%;
       transform: translate(-50%, 0);
   }
   ```

2. **Minimize transform usage:**
   - Don't use `translateZ(0)` everywhere (GPU memory)
   - Use `will-change` sparingly

3. **Avoid complex filters:**
   ```css
   /* ❌ BAD: May not render */
   .element {
       filter: blur(10px) drop-shadow(0 0 10px rgba(0,0,0,0.5));
   }

   /* ✅ GOOD: Simple transforms only */
   .element {
       opacity: 0.8;
       transform: scale(1.05);
   }
   ```

4. **No `-webkit-mask`:**
   - Use alternative approaches (box-shadow, layered divs)

### Multi-Account Calendar Architecture

**Critical:** Implement account-prefixed calendar IDs in Phase 4.3:

```javascript
// Format: {accountType}-{calendarId}
'primary-user@gmail.com'
'account2-user@gmail.com'
'primary-holidays@group.v.calendar.google.com'

// Why: Shared calendars appear in multiple accounts
// Without prefixes: Can't distinguish which account a calendar belongs to
// With prefixes: Each calendar is globally unique
```

### Token Storage Separation

**Already implemented but needs verification:**
- Auth tokens stored separately from user settings
- Separate localStorage key: `dashie-auth-tokens`
- Separate Supabase table: `user_auth_tokens`
- Prevents settings changes from wiping auth data

### Widget Lifecycle

**3-state model must be implemented:**

```javascript
// State 1: UNFOCUSED (default)
this.hasFocus = false;
this.isActive = false;

// State 2: FOCUSED (centered, menu shown)
handleEnterFocus() {
    this.hasFocus = true;
    showFocusMenu();
}

// State 3: ACTIVE (receiving navigation)
handleEnterActive() {
    this.isActive = true;
    dimFocusMenu();
}

// Navigation only when active
handleUp() {
    if (!this.isActive) return;
    // ... navigate up
}
```

---

## Quick Reference Checklist

Before starting a phase step, verify:

- [ ] Read this Build Context document
- [ ] Read relevant architecture sections (`.reference/architecture.md`)
- [ ] Read API interfaces for components you'll touch (`.reference/API_INTERFACES.md`)
- [ ] Check `.legacy/` for existing working code to migrate
- [ ] Understand the testing plan for this step
- [ ] Have Fire TV simulator ready (or test device)

During implementation:

- [ ] Preserve working logic from `.legacy/` code
- [ ] Follow module interface pattern
- [ ] Use BEM naming for CSS
- [ ] Keep JavaScript minimal (delegate to CSS)
- [ ] Test on Fire TV compatibility
- [ ] Add logger statements for debugging
- [ ] Update state via managers (not direct manipulation)
- [ ] Use AppComms for cross-module communication

After implementation:

- [ ] Manual testing in browser
- [ ] Test on Fire TV simulator
- [ ] Check logger for errors/warnings
- [ ] Verify console commands work
- [ ] Document any deviations from architecture
- [ ] Update build plan with completion notes

---

## Getting Help

If stuck on architectural decisions:

1. **Check architecture.md** - Detailed system design
2. **Check API_INTERFACES.md** - Component APIs and contracts
3. **Check .legacy/ code** - Working implementation reference
4. **Check logger output** - Often reveals issues
5. **Use console commands** - `window.dashie.*` for debugging

---

**Remember:** Your goal is to migrate working code to a better architecture, not to rewrite everything from scratch. Preserve what works, improve what doesn't.

---

**End of Build Context Document**
