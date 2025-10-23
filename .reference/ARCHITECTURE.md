# Dashie Application Architecture v3.0

**Last Updated:** 2025-10-22
**Status:** Phase 5.5+ Complete - Production Ready with Advanced Features

---

## Table of Contents

### Part I: System Design
1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [System Architecture](#system-architecture)
4. [Directory Structure](#directory-structure)

### Part II: Core Components
5. [Core Layer](#core-layer)
6. [Module Layer](#module-layer)
7. [Data Layer](#data-layer)
8. [UI Layer](#ui-layer)
9. [Widgets Layer](#widgets-layer)
10. [Utilities Layer](#utilities-layer)

### Part III: Detailed Systems
11. [Authentication & JWT System](#authentication--jwt-system)
12. [Settings System](#settings-system)
13. [Dashboard Module](#dashboard-module)
14. [Theme System](#theme-system)
15. [Mobile & Touch System](#mobile--touch-system)
16. [Cross-Dashboard Synchronization](#cross-dashboard-synchronization)

### Part IV: Implementation
14. [Component Communication](#component-communication)
15. [State Management](#state-management)
16. [Initialization Sequence](#initialization-sequence)
17. [Module Lifecycle](#module-lifecycle)
18. [Widget Communication Protocol](#widget-communication-protocol)

### Part V: Refactoring Plans
19. [JWT Service Refactoring](#jwt-service-refactoring)
20. [Navigation Consolidation](#navigation-consolidation)
21. [Priority Refactoring List](#priority-refactoring-list)

### Part VI: Migration & Testing
22. [Migration from Legacy](#migration-from-legacy)
23. [Testing Strategy](#testing-strategy)
24. [Glossary](#glossary)

---

# Part I: System Design

## Overview

Dashie is a smart home dashboard application supporting multiple platforms (Desktop, TV, Mobile). The application displays customizable widgets showing calendar events, photos, weather, clock, and more.

### Key Characteristics
- **Platform:** Web-based (HTML/CSS/JavaScript ES Modules)
- **Target Devices:** Smart TVs (Fire TV), Desktop browsers, Mobile devices
- **Input Methods:** D-pad navigation (TV), keyboard (Desktop), touch (Mobile)
- **Architecture Style:** Modular, event-driven, iframe-based widgets
- **Backend:** Supabase (PostgreSQL + Storage)
- **Authentication:** OAuth2 (Google), Hybrid Device Flow, JWT
- **Total Codebase:** ~120+ active JS files, 215 total (including legacy)
- **Current Phase:** Phase 5.5+ (Advanced Theming, Touch Controls, Hybrid Auth)

---

## Design Principles

### 1. Single Responsibility Principle
Each module, file, and function should have ONE clear purpose. No god objects.

### 2. Separation of Concerns
- **Core:** Infrastructure and orchestration only
- **Modules:** Self-contained features with input/state/navigation/UI
- **Data:** All data operations (API calls, caching, persistence)
- **UI:** Presentation layer only, no business logic
- **Widgets:** Isolated iframe components

### 3. Dependency Inversion
Core systems should not depend on specific modules. Use interfaces and pub/sub for communication.

### 4. Progressive Enhancement
Desktop-first with TV/Mobile adaptations. Graceful degradation on limited devices.

### 5. Testability
Pure functions, dependency injection, mockable interfaces. Every module should be unit-testable.

### 6. Domain-Driven Design
Group by business domain (Settings pages, Widget types) not technical layers.

### 7. Explicit Over Implicit
Clear naming, documented interfaces, typed communication (via JSDoc).

---

## System Architecture

### High-Level Layers

```
┌─────────────────────────────────────────────────┐
│                   main.js                        │
│              Application Bootstrap               │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│                  Core Layer                      │
│  app-comms • app-state-manager • action-router  │
│  widget-messenger • initialization              │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│                 Module Layer                     │
│  Dashboard • Settings • Login • Modals • Welcome│
│  Each: input-handler, state-manager,            │
│        navigation-manager, ui-renderer          │
└─────────────────────────────────────────────────┘
                        ↓
┌──────────────────┬──────────────────────────────┐
│   Data Layer     │      UI Layer                │
│  auth • services │  theme • toast • components  │
│  database        │                              │
└──────────────────┴──────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│                 Widgets Layer                    │
│  Calendar • Photos • Clock • Weather • etc.     │
│  (Iframe-isolated, postMessage communication)   │
└─────────────────────────────────────────────────┘
```

### Data Flow

```
User Input (D-pad/Keyboard/Touch)
    ↓
action-router.js (determines context)
    ↓
Active Module's input-handler.js
    ↓
Module's state-manager.js (updates state)
    ↓
app-state-manager.js (updates global state)
    ↓
app-comms.js (broadcasts state change)
    ↓
Module's ui-renderer.js (re-renders)
    ↓
DOM Update
```

---

## Directory Structure

```
dashieapp_staging/
├── index.html                          # Application entry point
├── main.js                             # Bootstrap and initialization
├── config.js                           # Global configuration
│
├── js/
│   ├── core/                           # Core infrastructure
│   │   ├── app-comms.js
│   │   ├── app-state-manager.js
│   │   ├── widget-messenger.js
│   │   ├── action-router.js
│   │   └── initialization/
│   │       ├── startup-checks.js
│   │       ├── auth-initializer.js
│   │       ├── jwt-initializer.js
│   │       ├── widget-initializer.js
│   │       ├── service-initializer.js
│   │       └── theme-initializer.js
│   │
│   ├── modules/                        # Feature modules
│   │   ├── Dashboard/
│   │   │   ├── dashboard.js            # Public API (module interface)
│   │   │   ├── input-handler.js        # Input routing
│   │   │   ├── state-manager.js        # Dashboard state (grid, menu, focus)
│   │   │   ├── navigation-manager.js   # Navigation logic
│   │   │   ├── timers.js               # Timeout management
│   │   │   ├── widget-config.js        # Widget configuration
│   │   │   ├── ui-renderer.js          # Orchestration layer (REFACTORED v2.0)
│   │   │   ├── dom-builder.js          # DOM creation (NEW v2.0)
│   │   │   ├── event-handlers.js       # Event handling (NEW v2.0)
│   │   │   ├── visual-effects.js       # Visual updates (NEW v2.0)
│   │   │   └── focus-menu-manager.js   # Focus menu system
│   │   │
│   │   ├── Settings/
│   │   │   ├── settings.js                # Public API (module interface)
│   │   │   ├── settings-orchestrator.js
│   │   │   ├── settings-config.js
│   │   │   ├── settings-input-handler.js
│   │   │   ├── settings-state-manager.js
│   │   │   ├── settings-navigation-manager.js
│   │   │   ├── settings-ui-renderer.js
│   │   │   ├── core/
│   │   │   │   ├── settings-store.js
│   │   │   │   ├── broadcast-manager.js
│   │   │   │   └── widget-registry.js
│   │   │   ├── pages/
│   │   │   │   ├── family/
│   │   │   │   ├── interface/
│   │   │   │   ├── calendar/
│   │   │   │   ├── photos/
│   │   │   │   ├── system/
│   │   │   │   └── account/
│   │   │   └── shared/
│   │   │
│   │   ├── Login/
│   │   │   ├── login.js                   # Public API (module interface)
│   │   │   ├── login-input-handler.js
│   │   │   ├── login-state-manager.js
│   │   │   └── login-ui-renderer.js       # Absorbs auth-ui.js
│   │   │
│   │   ├── Modals/
│   │   │   ├── modals.js                  # Public API (module interface)
│   │   │   ├── modals-input-handler.js
│   │   │   ├── modals-state-manager.js
│   │   │   └── modals-ui-renderer.js
│   │   │
│   │   └── Welcome/
│   │       ├── welcome.js                 # Public API (module interface)
│   │       ├── welcome-wizard-controller.js
│   │       └── screens/
│   │
│   ├── data/                           # Data layer
│   │   ├── auth/
│   │   │   ├── auth-config.js          # ✅ Environment config (dev/prod, Supabase)
│   │   │   ├── token-store.js          # ✅ Dual-write token storage
│   │   │   ├── edge-client.js          # ✅ Edge function HTTP client
│   │   │   │
│   │   │   ├── orchestration/          # ✅ COMPLETE - Auth orchestration layer
│   │   │   │   ├── session-manager.js  # ✅ Orchestrates auth
│   │   │   │   └── auth-coordinator.js # ✅ Routes to correct auth provider
│   │   │   │
│   │   │   ├── providers/              # ✅ COMPLETE - Account Authentication
│   │   │   │   ├── web-oauth.js            # ✅ Browser OAuth flow
│   │   │   │   ├── device-flow.js          # ✅ Fire TV OAuth flow
│   │   │   │   └── hybrid-device-auth.js   # ✅ Hybrid phone+TV auth
│   │   │   │
│   │   │   ├── account-auth/           # ✅ COMPLETE - Account providers
│   │   │   │   ├── base-account-auth.js    # ✅ Base class for account auth
│   │   │   │   └── google-account-auth.js  # ✅ Google account login
│   │   │   │
│   │   │   ├── calendar-auth/          # ✅ COMPLETE - Calendar API Access
│   │   │   │   ├── base-calendar-auth.js       # ✅ Base class
│   │   │   │   └── google-calendar-auth.js     # ✅ Google Calendar API
│   │   │   │
│   │   │   └── mobile-auth/            # ✅ NEW - Mobile authentication
│   │   │       └── phone-auth-handler.js   # ✅ Phone auth for hybrid flow
│   │   │
│   │   ├── services/                   # ✅ COMPLETE - Data services
│   │   │   ├── calendar-service.js     # ✅ COMPLETE - Calendar orchestrator
│   │   │   ├── calendar-services/      # ✅ NEW - Modular calendar architecture
│   │   │   │   ├── calendar-fetcher.js      # ✅ Data fetching
│   │   │   │   ├── event-processor.js       # ✅ Data transformation
│   │   │   │   └── calendar-refresh-manager.js  # ✅ Refresh logic
│   │   │   ├── calendar-config-store.js  # ✅ COMPLETE - Config management
│   │   │   ├── photo-service.js        # ✅ COMPLETE - Photo library
│   │   │   ├── settings-service.js     # ✅ COMPLETE - Settings persistence
│   │   │   ├── weather-service.js      # ✅ COMPLETE - Weather data
│   │   │   ├── heartbeat-service.js    # ✅ NEW - Dashboard health tracking
│   │   │   ├── dashboard-sync-service.js  # ✅ NEW - Cross-window sync
│   │   │   └── google/
│   │   │       └── google-api-client.js     # ✅ Google API HTTP client
│   │   │
│   │   ├── storage/                    # ⏳ TO BUILD - Data persistence
│   │   │   ├── settings-manager.js     # User settings with dual-write
│   │   │   ├── calendar-cache.js       # Calendar event caching
│   │   │   └── photo-storage.js        # Photo storage management
│   │   │
│   │   ├── sync/                       # ⏳ TO BUILD - Synchronization layer
│   │   │   ├── calendar-sync.js        # Calendar sync engine
│   │   │   ├── photo-sync.js           # Photo sync
│   │   │   └── conflict-resolver.js    # Data conflict resolution
│   │   │
│   │   ├── models/                     # ⏳ TO BUILD - Data models
│   │   │   ├── calendar-event.js       # Calendar event model
│   │   │   ├── calendar.js             # Calendar model
│   │   │   ├── user-profile.js         # User profile model
│   │   │   └── photo.js                # Photo model
│   │   │
│   │   ├── data-manager.js             # ⏳ TO BUILD - Orchestrates data flow
│   │   ├── data-cache.js               # ⏳ TO BUILD - In-memory caching
│   │   └── data-handler.js             # ⏳ TO BUILD - Persistence interface
│   │
│   ├── ui/                             # Global UI components
│   │   ├── theme-applier.js            # ✅ Theme application engine
│   │   ├── themes/                     # ✅ NEW - Advanced theme system
│   │   │   ├── theme-registry.js           # ✅ Theme definitions
│   │   │   ├── theme-overlay-applier.js    # ✅ Theme overlay engine
│   │   │   ├── theme-overlay-halloween.js  # ✅ Halloween theme
│   │   │   ├── theme-overlay-config-registry.js  # ✅ Overlay configs
│   │   │   ├── theme-overlay-element-creator.js  # ✅ DOM creation
│   │   │   ├── theme-overlay-container-manager.js  # ✅ Containers
│   │   │   ├── theme-overlay-visibility-manager.js  # ✅ Visibility
│   │   │   └── THEME_OVERLAY.md            # ✅ Documentation
│   │   ├── mobile-ui.js                # ✅ NEW - Mobile interface
│   │   ├── toast.js                    # ✅ Toast notifications
│   │   ├── offline-indicator.js        # ✅ NEW - Offline status
│   │   └── components/
│   │
│   ├── widgets/                        # ✅ Widget implementations
│   │   ├── calendar/                   # ✅ Calendar widget (weekly/monthly)
│   │   ├── agenda/                     # ✅ Agenda widget (event list)
│   │   ├── photos/                     # ✅ Photo carousel
│   │   ├── clock/                      # ✅ Time & weather display
│   │   ├── header/                     # ✅ App header
│   │   ├── shared/                     # ✅ NEW - Shared widget utilities
│   │   │   ├── widget-theme-detector.js    # ✅ Theme detection
│   │   │   ├── widget-touch-controls.js    # ✅ NEW - Touch buttons
│   │   │   └── widget-touch-controls.css   # ✅ NEW - Touch UI styles
│   │   └── WIDGETS_README.md           # ✅ Widget development guide
│   │
│   └── utils/                          # Utilities
│       ├── logger.js                   # ✅ Comprehensive logging
│       ├── logger-config.js            # ✅ Log configuration
│       ├── platform-detector.js        # ✅ Platform/device detection
│       ├── console-commands.js         # ✅ Debug commands
│       ├── modal-navigation-manager.js # ✅ Modal navigation
│       ├── dashie-modal.js             # ✅ Modal system
│       ├── calendar-cache.js           # ✅ Calendar caching
│       ├── geocoding-helper.js         # ✅ Location services
│       └── connection-status.js        # ✅ NEW - Network monitoring
│
├── css/
│   ├── core/
│   ├── components/
│   └── modules/
│
├── .legacy/                            # Legacy code (reference only)
└── .reference/                         # Documentation
    ├── ARCHITECTURE.md                 # This file
    ├── API_INTERFACES.md               # Component APIs
    └── BUILD_STRATEGY.md               # Implementation plan
```

---

# Part II: Core Components

## Core Layer

### Purpose
Provides foundational infrastructure for the entire application. No business logic, no UI rendering.

### 1. app-comms.js - Event Bus

**Responsibility:** Central pub/sub event system for cross-module communication.

**API:**
```javascript
AppComms.subscribe(eventName, callback)   // Returns unsubscribe function
AppComms.unsubscribe(eventName, callback)
AppComms.publish(eventName, data)

AppComms.events = {
    MODULE_CHANGED: 'module:changed',
    STATE_UPDATED: 'state:updated',
    AUTH_STATUS_CHANGED: 'auth:status_changed',
    WIDGET_MESSAGE: 'widget:message',
    THEME_CHANGED: 'theme:changed',
    DATA_UPDATED: 'data:updated',
    SETTINGS_CHANGED: 'settings:changed',
    ERROR_OCCURRED: 'error:occurred'
}
```

### 2. app-state-manager.js - Global State

**State Structure:**
```javascript
{
    currentModule: 'dashboard' | 'settings' | 'login' | 'modals' | 'welcome',
    previousModule: string,
    focusContext: 'grid' | 'menu' | 'widget' | 'modal',
    activeWidget: string | null,
    user: {
        isAuthenticated: boolean,
        userId: string | null,
        email: string | null
    },
    theme: 'light' | 'dark',
    platform: 'tv' | 'desktop' | 'mobile',
    isSleeping: boolean,
    isInitialized: boolean
}
```

**API:**
```javascript
AppStateManager.getState()
AppStateManager.setState(partialState)
AppStateManager.setCurrentModule(moduleName)
AppStateManager.subscribe(callback)
```

### 3. action-router.js - Input Routing

**API:**
```javascript
ActionRouter.registerModule(moduleName, inputHandler)
ActionRouter.route(action, data)

ActionRouter.actions = {
    UP, DOWN, LEFT, RIGHT, ENTER, ESCAPE, BACK
}
```

### 4. widget-messenger.js - Widget Communication

**API:**
```javascript
WidgetMessenger.sendToWidget(widgetId, messageType, data)
WidgetMessenger.broadcast(messageType, data)
WidgetMessenger.onMessage(callback)
WidgetMessenger.registerWidget(widgetId, iframe)
```

---

## Module Layer

### Standard Module Pattern

Every module follows this structure:

```
js/modules/[ModuleName]/
├── [module-name].js                 # Public API (module interface)
├── [module-name]-input-handler.js   # Input processing
├── [module-name]-state-manager.js   # Module-specific state
├── [module-name]-navigation-manager.js   # Internal navigation
└── [module-name]-ui-renderer.js     # DOM rendering
```

### Module Interface

```javascript
// Every module's main file (e.g., dashboard.js, settings.js) exports:
{
    // Lifecycle
    initialize: async () => {},
    activate: () => {},
    deactivate: () => {},
    destroy: () => {},

    // State
    getState: () => {},
    setState: (state) => {},

    // Metadata
    name: 'module-name',
    version: '1.0.0'
}
```

### Input Handler Interface

```javascript
// Every module's input-handler.js exports:
{
    handleUp: () => boolean,
    handleDown: () => boolean,
    handleLeft: () => boolean,
    handleRight: () => boolean,
    handleEnter: () => boolean,
    handleEscape: () => boolean,
    handleBack: () => boolean
}
```

---

## Data Layer

### Architecture

```
┌────────────────────────────────────┐
│       data-manager.js              │  ← Orchestrates data flow
├────────────────────────────────────┤
│    services/                       │  ← Business logic
│    calendar • photos • weather     │
├────────────────────────────────────┤
│    auth/                           │  ← Authentication
│    session • JWT • providers       │
├────────────────────────────────────┤
│    database/                       │  ← Persistence
│    supabase-client • storage       │
├────────────────────────────────────┤
│    data-cache.js                   │  ← In-memory cache
└────────────────────────────────────┘
```

See [Authentication & JWT System](#authentication--jwt-system) for details.

---

## UI Layer

### Global UI Components

- **theme-applier.js** - Theme switching (dark/light)
- **toast.js** - Global notifications
- **components/** - Reusable UI elements

**Rule:** UI components are pure presentation - no business logic, no API calls.

---

## Widgets Layer

### Widget Structure

```
js/widgets/[WidgetName]/
├── index.html              # Widget entry point
├── widget.js               # Widget logic
├── styles.css              # Widget-specific styles
└── config.js               # Widget configuration
```

Widgets are iframe-isolated and communicate via postMessage. See [Widget Communication Protocol](#widget-communication-protocol).

---

## Utilities Layer

### Key Utilities

- **logger.js** (600 lines) - Comprehensive logging with localStorage persistence
- **crash-monitor.js** (511 lines) - Error tracking for Fire TV
- **platform-detector.js** (483 lines) - Platform/device detection
- **redirect-manager.js** (499 lines) - OAuth redirect handling
- **feature-flags.js** - Feature toggles

---

## CSS/Styling Architecture

### Overview

Dashie uses vanilla CSS with a component-based architecture aligned to the JavaScript module structure. The styling system prioritizes **Fire TV WebView compatibility** and **performance** over modern CSS features.

### Design Principles

1. **CSS-First Approach** - All styling in CSS files, minimal inline styles
2. **Component Alignment** - CSS structure matches JavaScript module structure
3. **WebView Compatibility** - Avoid features that break on older Chromium (v25-40)
4. **Performance First** - Minimize transforms, animations, and file size
5. **Maintainable Specificity** - No `!important` except for utility overrides
6. **Progressive Enhancement** - Base styles work everywhere, layer on enhancements

### Why Vanilla CSS (No Preprocessor)

**Decision: Use vanilla CSS**

**Rationale:**
- ✅ **Zero build complexity** - No compilation step, works immediately
- ✅ **Native CSS variables** - Modern browsers support custom properties
- ✅ **Simple debugging** - What you write is what runs
- ✅ **Fire TV compatibility** - Preprocessor features don't guarantee WebView support
- ✅ **Small team** - Preprocessor adds complexity without significant benefit
- ⚠️ **CSS nesting** - Not supported on older WebView, avoid even in preprocessor

**When to Reconsider:**
- Team grows beyond 3 developers
- Need advanced mixins or functions
- Multi-theme system becomes complex

### CSS File Organization

```
css/
├── core/
│   ├── reset.css              # Browser normalization
│   ├── variables.css          # CSS custom properties (theme, spacing, typography)
│   ├── base.css               # Base element styles (body, html, h1-h6, etc.)
│   └── utilities.css          # Utility classes (.text-center, .mt-2, etc.)
│
├── components/                # Reusable UI components
│   ├── button.css             # All button styles
│   ├── input.css              # Form input styles
│   ├── modal.css              # Modal dialog styles
│   ├── toast.css              # Toast notification styles
│   └── widget-container.css   # Widget iframe container styles
│
├── modules/                   # Module-specific styles (aligned with JS)
│   ├── dashboard.css          # Dashboard module (absorbs navigation.css)
│   ├── settings.css           # Settings module
│   ├── login.css              # Login module
│   ├── welcome.css            # Welcome wizard
│   └── modals.css             # Modal system styles
│
└── themes/
    ├── light.css              # Light theme variable overrides
    └── dark.css               # Dark theme variable overrides
```

### Naming Convention: Component-Based BEM

**Pattern:** `.module-component__element--modifier`

**Examples:**
```css
/* Dashboard module */
.dashboard-grid { }                          /* Block */
.dashboard-grid__cell { }                    /* Element */
.dashboard-grid__cell--focused { }           /* Modifier */

.dashboard-menu { }                          /* Block */
.dashboard-menu__item { }                    /* Element */
.dashboard-menu__item--selected { }          /* Modifier */
.dashboard-menu__item--centered { }          /* Modifier */

/* Settings module */
.settings-modal { }                          /* Block */
.settings-modal__header { }                  /* Element */
.settings-modal__page { }                    /* Element */
.settings-modal__page--active { }            /* Modifier */

/* Reusable component */
.btn { }                                     /* Block */
.btn--primary { }                            /* Modifier */
.btn--large { }                              /* Modifier */
```

**Benefits:**
- Clear ownership (dashboard-menu belongs to Dashboard module)
- No specificity wars
- No need for `!important`
- Easy to understand and maintain
- Self-documenting

### State Management Pattern

**Use CSS classes for states, CSS variables for dynamic values**

```css
/* Default state */
.dashboard-menu__item {
    transform: translateX(0) scale(1);
    opacity: 0.7;
    transition: all 0.3s ease;
}

/* Focused state */
.dashboard-menu__item--focused {
    opacity: 1;
}

/* Selected state */
.dashboard-menu__item--selected {
    transform: scale(1.05);
    opacity: 1;
}

/* Centered state (uses CSS variable for dynamic offset) */
.dashboard-menu__item--centered {
    transform: translateX(var(--center-offset, 0px)) scale(1.1);
}
```

```javascript
// JavaScript only toggles classes and sets CSS variables
function selectMenuItem(element, offset) {
    // Remove previous states
    element.classList.remove('focused');

    // Add new states
    element.classList.add('selected', 'centered');

    // Set dynamic values via CSS variables
    element.style.setProperty('--center-offset', `${offset}px`);
}
```

**Benefits:**
- All styling logic in CSS (themeable, maintainable)
- JavaScript only manages state
- No inline styles to override
- Performance: browser can optimize CSS transitions

### Fire TV WebView Constraints

**Critical Rules for Fire TV Compatibility:**

#### 1. Viewport Units + Transform Bug
```css
/* ❌ AVOID: Viewport units with translate() */
.element {
    width: 50vw;
    transform: translate(-50%, 0);  /* May not work on Chromium v25 */
}

/* ✅ SAFE: Use percentages instead */
.element {
    width: 50%;
    transform: translate(-50%, 0);
}
```

#### 2. TranslateZ() Performance
```css
/* ❌ AVOID: Overuse of translateZ() */
.many-elements {
    transform: translateZ(0);  /* Each creates composited layer = GPU memory */
}

/* ✅ SAFE: Use sparingly, only for elements that need hardware acceleration */
.animated-element {
    will-change: transform;  /* Modern alternative */
    /* or sparingly: transform: translateZ(0); */
}
```

#### 3. CSS Animations and Filters
```css
/* ❌ AVOID: Complex filters on older hardware */
.element {
    filter: blur(10px) drop-shadow(0 0 10px rgba(0,0,0,0.5));
}

/* ✅ SAFE: Simple opacity and transform only */
.element {
    opacity: 0.8;
    transform: scale(1.05);
    transition: opacity 0.3s ease, transform 0.3s ease;
}
```

#### 4. Webkit-Mask Compatibility
```css
/* ❌ AVOID: -webkit-mask may not render on Amazon WebView */
.element::before {
    -webkit-mask: linear-gradient(90deg, transparent, black);
}

/* ✅ SAFE: Use alternative approaches */
.element::before {
    /* Option 1: Box-shadow gradient */
    box-shadow: 0 0 20px rgba(0,0,0,0.5);

    /* Option 2: Layered divs with overflow:hidden */
    /* (implement in HTML structure) */
}
```

#### 5. CSS File Size
```css
/* Target: < 50KB compressed per CSS file */
/* Use GZIP/Brotli compression */
/* Remove unused styles regularly */
```

### CSS Variable System

**css/core/variables.css:**
```css
:root {
    /* Colors - Light Theme (Default) */
    --color-bg-primary: #f5f5f5;
    --color-bg-secondary: #ffffff;
    --color-text-primary: #333333;
    --color-text-secondary: #666666;
    --color-accent: #007bff;
    --color-accent-hover: #0056b3;
    --color-error: #dc3545;
    --color-success: #28a745;

    /* Spacing */
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 16px;
    --spacing-lg: 24px;
    --spacing-xl: 32px;
    --spacing-2xl: 48px;

    /* Typography */
    --font-family-base: Arial, sans-serif;
    --font-family-heading: Arial, sans-serif;
    --font-size-sm: 12px;
    --font-size-base: 14px;
    --font-size-lg: 16px;
    --font-size-xl: 20px;
    --font-size-2xl: 24px;
    --font-weight-normal: 400;
    --font-weight-bold: 700;

    /* Layout */
    --border-radius-sm: 4px;
    --border-radius-md: 8px;
    --border-radius-lg: 12px;

    /* Transitions */
    --transition-fast: 0.15s ease;
    --transition-normal: 0.3s ease;
    --transition-slow: 0.5s ease;

    /* Z-index layers */
    --z-base: 0;
    --z-widgets: 10;
    --z-menu: 20;
    --z-modal: 30;
    --z-toast: 40;
    --z-overlay: 50;
}

/* Dark theme overrides */
[data-theme="dark"] {
    --color-bg-primary: #1a1a1a;
    --color-bg-secondary: #2a2a2a;
    --color-text-primary: #e0e0e0;
    --color-text-secondary: #a0a0a0;
    --color-accent: #4a9eff;
    --color-accent-hover: #357abd;
}
```

### Utility Classes

**css/core/utilities.css:**
```css
/* Layout */
.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.hidden { display: none !important; }  /* Only !important for utilities */

/* Spacing */
.m-0 { margin: 0; }
.mt-1 { margin-top: var(--spacing-sm); }
.mt-2 { margin-top: var(--spacing-md); }
.mb-2 { margin-bottom: var(--spacing-md); }
.p-2 { padding: var(--spacing-md); }

/* Text */
.text-center { text-align: center; }
.text-bold { font-weight: var(--font-weight-bold); }
.text-sm { font-size: var(--font-size-sm); }
.text-lg { font-size: var(--font-size-lg); }

/* Note: Keep utilities minimal, prefer semantic classes */
```

### Eliminating !important

**Problem (Legacy):**
```css
/* Fighting specificity with !important */
.menu-item::before {
    opacity: 1;
    transform: scale(1);
}

.highlights-hidden .menu-item::before {
    opacity: 0 !important;      /* Fighting specificity */
    transform: scale(0.95) !important;
}
```

**Solution (New):**
```css
/* Proper specificity without !important */
.menu-item::before {
    opacity: 1;
    transform: scale(1);
}

.menu-item.highlights-hidden::before {
    opacity: 0;                 /* No !important needed */
    transform: scale(0.95);
}

/* Or better: use modifier class */
.dashboard-menu__item::before {
    opacity: 1;
    transform: scale(1);
}

.dashboard-menu__item--hidden::before {
    opacity: 0;
    transform: scale(0.95);
}
```

### Eliminating Inline Styles

**Problem (Legacy navigation.js):**
```javascript
// Runtime overhead, hard to theme, high specificity
function centerMenuItem(element) {
    const rect = element.getBoundingClientRect();
    const offset = calculateOffset(rect);

    element.style.transform = `translateX(${offset}px) scale(1.1)`;  // ❌
    element.style.opacity = '1';  // ❌
}
```

**Solution (New Dashboard module):**
```javascript
// CSS manages presentation, JS manages state
function centerMenuItem(element, offset) {
    // Set CSS variable for dynamic value
    element.style.setProperty('--center-offset', `${offset}px`);

    // Toggle classes for states
    element.classList.add('dashboard-menu__item--centered');
    element.classList.remove('dashboard-menu__item--focused');
}
```

```css
/* All styling logic in CSS */
.dashboard-menu__item {
    transform: translateX(0) scale(1);
    opacity: 0.7;
    transition: all var(--transition-normal);
}

.dashboard-menu__item--focused {
    opacity: 1;
}

.dashboard-menu__item--centered {
    transform: translateX(var(--center-offset, 0px)) scale(1.1);
    opacity: 1;
}
```

### Performance Optimization

#### 1. Batch Layout Reads/Writes

**Bad (Causes multiple reflows):**
```javascript
// Read
const rect1 = el1.getBoundingClientRect();
el1.style.left = `${rect1.left + 10}px`;  // Write (forces reflow)

// Read again (forces another reflow!)
const rect2 = el2.getBoundingClientRect();
el2.style.left = `${rect2.left + 10}px`;
```

**Good (Single reflow):**
```javascript
// Read phase
const rect1 = el1.getBoundingClientRect();
const rect2 = el2.getBoundingClientRect();

// Write phase (single reflow)
el1.style.left = `${rect1.left + 10}px`;
el2.style.left = `${rect2.left + 10}px`;
```

#### 2. Minimize Transform Usage

```css
/* ✅ Good: Limit to active elements */
.dashboard-grid__cell--focused {
    transform: scale(1.05);
}

/* ❌ Bad: Every element transformed */
.dashboard-grid__cell {
    transform: scale(1);  /* Unnecessary, default is no transform */
}
```

#### 3. Use `will-change` Sparingly

```css
/* ✅ Good: Only on elements that will animate */
.dashboard-menu__item--selected {
    will-change: transform;  /* Signals browser to optimize */
    transform: scale(1.1);
}

/* ❌ Bad: All elements */
.dashboard-menu__item {
    will-change: transform;  /* Creates layers unnecessarily */
}
```

### Loading Strategy

**index.html load order:**
```html
<head>
    <!-- 1. Reset first -->
    <link rel="stylesheet" href="css/core/reset.css">

    <!-- 2. Variables -->
    <link rel="stylesheet" href="css/core/variables.css">

    <!-- 3. Base styles -->
    <link rel="stylesheet" href="css/core/base.css">

    <!-- 4. Utilities -->
    <link rel="stylesheet" href="css/core/utilities.css">

    <!-- 5. Components -->
    <link rel="stylesheet" href="css/components/button.css">
    <link rel="stylesheet" href="css/components/modal.css">
    <!-- ... other components ... -->

    <!-- 6. Modules -->
    <link rel="stylesheet" href="css/modules/dashboard.css">
    <link rel="stylesheet" href="css/modules/settings.css">
    <!-- ... other modules ... -->

    <!-- 7. Theme (loaded dynamically based on user preference) -->
    <link rel="stylesheet" href="css/themes/dark.css" id="theme-stylesheet">
</head>
```

### CSS Linting Setup

**Tool:** Stylelint

**Why Stylelint:**
- Industry standard for CSS linting
- Catches errors (invalid properties, syntax errors)
- Enforces conventions (naming, ordering, specificity)
- Integrates with VSCode
- Configurable rules

**Installation:**
```bash
npm install --save-dev stylelint stylelint-config-standard
```

**Configuration (.stylelintrc.json):**
```json
{
  "extends": "stylelint-config-standard",
  "rules": {
    "selector-class-pattern": "^[a-z]+(-[a-z]+)*((__[a-z]+(-[a-z]+)*)|(--[a-z]+(-[a-z]+)*))?$",
    "declaration-no-important": true,
    "max-nesting-depth": 3,
    "selector-max-id": 0,
    "selector-max-type": 2,
    "color-hex-length": "short",
    "indentation": 2,
    "no-duplicate-selectors": true,
    "font-weight-notation": "numeric",
    "comment-empty-line-before": "always",
    "rule-empty-line-before": "always",
    "at-rule-no-unknown": [true, {
      "ignoreAtRules": ["supports"]
    }]
  },
  "customSyntax": "postcss-html",
  "ignoreFiles": [".legacy/**/*.css"]
}
```

**VSCode Integration (.vscode/settings.json):**
```json
{
  "stylelint.enable": true,
  "css.validate": false,
  "stylelint.validate": ["css"],
  "editor.codeActionsOnSave": {
    "source.fixAll.stylelint": true
  }
}
```

**NPM Scripts (package.json):**
```json
{
  "scripts": {
    "lint:css": "stylelint \"css/**/*.css\"",
    "lint:css:fix": "stylelint \"css/**/*.css\" --fix",
    "lint": "npm run lint:css"
  }
}
```

**Usage:**
```bash
# Check for issues
npm run lint:css

# Auto-fix fixable issues
npm run lint:css:fix
```

### Migration from Legacy CSS

**Phase 1: Core Styles (Week 1)**
- Copy variables.css → refactor to use CSS custom properties
- Copy base.css → minimal changes needed
- Create utilities.css (new)

**Phase 2: Component Styles (Week 2)**
- Migrate button styles from legacy
- Migrate modal styles from legacy
- Create new component files

**Phase 3: Module Styles (Week 2-5)**
- **Dashboard (Week 2):** Rewrite navigation.css as dashboard.css
  - Eliminate 13 `!important` declarations
  - Replace `-webkit-mask` with compatible alternative
  - Simplify transforms
  - Use BEM naming

- **Settings (Week 4):** Migrate settings CSS
  - Modular page styles
  - Form component styles

- **Login/Welcome (Week 5):** Migrate remaining module CSS

**Phase 4: Testing & Optimization (Week 6-7)**
- Test on Fire TV hardware
- Performance profiling
- Remove unused styles
- Compress assets

### Testing Checklist

**Fire TV WebView Compatibility:**
- [ ] Visual rendering matches design (no missing masks/gradients)
- [ ] Transforms work correctly (no viewport unit issues)
- [ ] Animations are smooth (30+ FPS during navigation)
- [ ] Theme switching works (light/dark)
- [ ] No layout shifts or glitches
- [ ] Focus states are visible and correct

**Performance Targets:**
- [ ] CSS file size < 50KB per file (compressed)
- [ ] Initial render < 100ms
- [ ] Navigation transitions 30+ FPS
- [ ] No forced reflows in hot paths
- [ ] Memory usage stable

**Code Quality:**
- [ ] Zero `!important` declarations (except utility overrides)
- [ ] Zero inline styles in JavaScript (except CSS variable sets)
- [ ] All styles in CSS files
- [ ] Consistent naming convention (BEM)
- [ ] CSS passes linter (stylelint)

---

# Part III: Detailed Systems

## Authentication & JWT System

### Overview

The auth system handles:
- **User authentication** (Account login - Google OAuth, Amazon, Email/Password)
- **Calendar API authentication** (Calendar provider access - Google, iCloud, Microsoft)
- **Multi-provider support** (Two-layer architecture separating account auth from calendar auth)
- **Multi-account calendar support** (Multiple calendar accounts per user)
- **JWT token management** (Supabase)
- **Session persistence**
- **Separate token storage** (auth tokens stored separately from user settings)

### Two-Layer Authentication Architecture

**Critical Design:** The auth system separates two distinct concerns:

1. **Layer 1: Account Authentication** (How users log into Dashie)
   - Google OAuth
   - Amazon OAuth (Fire TV native)
   - Email/Password (Supabase Auth)
   - Device Flow (TV devices)

2. **Layer 2: Calendar API Authentication** (How we access calendar data)
   - Google Calendar API
   - Apple iCloud Calendar (CalDAV)
   - Microsoft Exchange/Outlook (Graph API)
   - User can connect multiple calendar providers regardless of login method

**Benefits:**
- Fire TV users can use native Amazon login (5-10s vs 60s device flow)
- Users can log in with Google but access iCloud calendars
- Decoupled architecture supports any provider combination
- Future-proof for additional providers

### Auth Architecture (Phase 5.5+ - COMPLETE)

```
js/data/auth/
├── auth-config.js              # ✅ Environment config (dev/prod detection)
│                               # - Supabase URL & anon keys
│                               # - Environment detection based on hostname
│
├── token-store.js              # ✅ Dual-write token storage
│                               # - save() writes to localStorage + Supabase
│                               # - loadTokens() reads Supabase-first, fallback localStorage
│                               # - Separate storage key: 'dashie-auth-tokens'
│
├── edge-client.js              # ✅ Edge function HTTP client
│                               # - All edge function operations
│                               # - JWT-authenticated requests
│                               # - Error handling & retries
│
├── orchestration/              # ✅ COMPLETE - Auth orchestration layer
│   ├── session-manager.js      # ✅ Orchestrates entire auth system
│   └── auth-coordinator.js     # ✅ Routes to correct auth provider
│
├── providers/                  # ✅ COMPLETE - OAuth flows
│   ├── web-oauth.js            # ✅ Browser OAuth flow
│   ├── device-flow.js          # ✅ Fire TV device flow
│   └── hybrid-device-auth.js   # ✅ NEW - Hybrid phone+TV auth
│
├── account-auth/               # ✅ COMPLETE - Account providers
│   ├── base-account-auth.js    # ✅ Base class for account auth
│   └── google-account-auth.js  # ✅ Google OAuth for account login
│
├── calendar-auth/              # ✅ COMPLETE - Calendar providers
│   ├── base-calendar-auth.js   # ✅ Base class for calendar providers
│   └── google-calendar-auth.js # ✅ Google Calendar API auth
│
└── mobile-auth/                # ✅ NEW - Mobile authentication
    └── phone-auth-handler.js   # ✅ Phone auth for hybrid flow
    └── HYBRID_DEVICE_FLOW.md   # ✅ Documentation
```

**Status: PHASE 5.5+ COMPLETE**

**✅ Fully Implemented:**
- Two-layer auth architecture (account vs calendar)
- Hybrid device flow (phone + Fire TV simultaneous auth)
- Session manager orchestration
- Auth coordinator for provider selection
- Dual-write pattern for tokens (localStorage + Supabase)
- EdgeClient abstraction
- Google OAuth (web + device + hybrid flows)
- Environment-based configuration
- Mobile phone authentication handler
- Complete documentation (HYBRID_DEVICE_FLOW.md)

**🎯 Production Features:**
- QR code authentication for Fire TV
- Simultaneous phone + TV authentication
- Session persistence across devices
- JWT refresh management
- Multi-account calendar support

### JWT Service Design

**Old Structure (Legacy):**
```
jwt-service-core.js (702 lines)
    ↓ extends
jwt-token-operations.js (687 lines)
= 1,389 lines, tight coupling
```

**New Structure (Refactored):**
```
JWT Service (jwt.js)
    ├── JWTManager         - JWT lifecycle & refresh
    ├── JWTStorage         - localStorage operations
    ├── TokenCache         - OAuth token caching
    ├── EdgeClient         - HTTP communication
    └── SettingsIntegration - Settings bridge
= 950 lines across 6 focused, testable modules
```

### JWT Refresh Strategy

- JWT has **72-hour expiry** on server
- Client refreshes proactively at **24-hour remaining** threshold
- On-demand refresh if JWT expires within **60 minutes**
- Uses **setTimeout** (not setInterval) to refresh at exact threshold time
- **Token cache fixes:** Cache updates after refresh, force refresh invalidates cache properly

**Example:**
```
JWT expires in 48 hours
→ Timer set to refresh in 24 hours (48 - 24 = 24hrs from now)
→ When timer fires, refresh JWT and restart timer
```

### Token Storage Separation

**Critical:** Auth tokens are stored SEPARATELY from user settings to prevent accidental data loss.

**Storage Strategy:**
- **User Settings:** `user_settings` table + `dashie-settings` localStorage
  - Theme, sleep time, wake time, calendar preferences, photo settings, etc.
- **Auth Tokens:** `user_auth_tokens` table + `dashie-auth-tokens` localStorage
  - OAuth refresh tokens, calendar provider tokens, account credentials
  - Protected from settings operations

**Benefits:**
- Settings changes cannot wipe auth data
- Clear separation of concerns
- Reduced risk during settings operations
- Easier to debug auth issues

**Migration Required:**
- Extract `tokenAccounts` from settings object
- Move to separate storage layer
- Update edge functions to handle separate token storage
- Migrate existing tokens during deployment

### Session Manager

**Purpose:** Orchestrates the entire auth system (refactored from simple-auth.js)

**Responsibilities:**
- Initialize auth providers
- Check for existing session
- Manage sign-in/sign-out
- Coordinate with JWT service
- Update global state on auth changes

**API:**
```javascript
sessionManager.initialize()
sessionManager.isAuthenticated()
sessionManager.getUser()
sessionManager.signIn()
sessionManager.signOut()
```

### Auth Flow

```
1. User opens app
    ↓
2. auth-initializer checks for session (via session-manager)
    ↓
3a. No session found
    → Show Login module
    → User initiates OAuth
    → Auth provider handles flow
    → Tokens received and stored
    → JWT service initialized
    → Session created
    → Redirect to Dashboard

3b. Session found
    → Validate token
    → Initialize JWT service
    → If JWT expired, refresh
    → If refresh fails, go to Login
    → If valid, go to Dashboard
```

### Google API Client

**Location:** `js/data/services/google/google-client.js`

**Features:**
- **Retry Logic** - Exponential backoff (3 retries max)
- **Rate Limiting** - Prevents exceeding API quotas
- **Auto-Refresh** - Refreshes tokens on 401 errors
- **Multi-Account** - Supports multiple Google accounts
- **JWT Integration** - Waits for JWT service to be ready

**Example:**
```javascript
// Get calendars from primary account
const primaryCals = await googleClient.getCalendarList('primary');

// Get calendars from second account
const account2Cals = await googleClient.getCalendarList('account2');

// Get events (auto-refreshes token if expired)
const events = await googleClient.getCalendarEvents(
    'calendar_id@gmail.com',
    { start, end },
    'account2'
);
```

---

### Calendar Service & Shared Calendar Architecture

**Location:** `js/data/services/calendar-service.js`

**Critical Design Fix:** Account-Prefixed Calendar IDs

**Problem (Legacy):**
Calendar IDs are not unique when shared across multiple accounts. Using raw calendar IDs (e.g., `jwlerch@gmail.com`) as identifiers causes issues when the same calendar exists in multiple accounts.

**Example Scenario:**
- User has `jwlerch@gmail.com` calendar in both `primary` and `account2`
- User enables it only in `account2`
- When `account2` is removed, system can't tell which account's version is enabled
- Calendar may still show events from wrong account

**Solution: Account-Prefixed Calendar IDs**

**Format:** `{accountType}-{calendarId}`

**Examples:**
- `primary-jwlerch@gmail.com`
- `account2-jwlerch@gmail.com`
- `primary-holidays@group.v.calendar.google.com`

**Benefits:**
- Each calendar globally unique even when shared
- Eliminates need for separate `calendarAccountMap` tracking
- Simplifies removal logic (filter by prefix)
- Clear ownership of calendar data
- Easier debugging

**Implementation:**

```javascript
// Calendar settings manager
function toggleCalendar(calendarId, accountType, enabled) {
  const prefixedId = `${accountType}-${calendarId}`;

  if (enabled) {
    activeCalendarIds.push(prefixedId);
  } else {
    activeCalendarIds = activeCalendarIds.filter(id => id !== prefixedId);
  }
}

// Remove all calendars from an account
function removeAccountCalendars(accountType) {
  const prefix = `${accountType}-`;
  activeCalendarIds = activeCalendarIds.filter(id => !id.startsWith(prefix));
}

// Fetch events
async function fetchCalendarEvents(prefixedId) {
  const [accountType, calendarId] = prefixedId.split('-', 2);
  const events = await googleClient.getCalendarEvents(calendarId, options, accountType);
  return events;
}
```

**Files Requiring Updates:**
1. `js/data/services/calendar-service.js` - Parse prefixed IDs, fetch events
2. `js/modules/Settings/pages/calendar/` - Generate prefixed IDs
3. `js/widgets/Calendar/` - Handle prefixed IDs, strip for display
4. `js/utils/calendar-sync-helper.js` - Auto-enable with prefixes

**Migration Strategy:**
- Detect old format (non-prefixed IDs) on load
- Automatically convert to prefixed format
- Maintain backward compatibility for 1-2 versions

**Testing Checklist:**
- [ ] Calendar shared between 2 accounts shows correctly in both
- [ ] Enabling calendar in account A doesn't affect account B
- [ ] Removing account A removes only its calendars from active list
- [ ] Events load correctly after account removal
- [ ] Migration from old format works seamlessly

---

## Settings System

### Architecture

```
js/modules/Settings/
├── settings.js                        # Public API (module interface)
├── settings-orchestrator.js           # Main coordinator (~400 lines)
├── settings-config.js                 # Page registry (~100 lines)
├── settings-input-handler.js          # D-pad navigation
├── settings-state-manager.js          # Settings state
├── settings-navigation-manager.js     # Screen transitions & nav stack
├── settings-ui-renderer.js            # Modal building
│
├── core/
│   ├── settings-store.js       # Persistence (~300 lines)
│   │                           # - Supabase + localStorage
│   │
│   ├── broadcast-manager.js    # Applies settings (~250 lines)
│   │                           # - Broadcasts to widgets
│   │                           # - Theme changes
│   │                           # - Feature toggles
│   │
│   └── widget-registry.js      # Plugin system (~150 lines)
│                               # - Widget-specific settings
│
├── pages/                      # Domain-based settings pages
│   ├── family/
│   │   ├── settings-family-page.js        # Page registration (~30 lines)
│   │   ├── settings-family-template.js    # HTML template (~100 lines)
│   │   ├── settings-family-handlers.js    # Page logic (~150 lines)
│   │   └── settings-family-applicator.js  # Apply settings (~80 lines)
│   │
│   ├── interface/
│   │   ├── settings-interface-page.js
│   │   ├── settings-interface-template.js
│   │   ├── settings-interface-time-handler.js
│   │   └── settings-interface-applicator.js
│   │
│   ├── calendar/
│   ├── photos/
│   ├── system/
│   └── account/
│
└── shared/
    ├── field-populator.js      # Populate form fields
    ├── validation-helpers.js   # Validation logic
    └── formatting-helpers.js   # Format display values
```

### Settings Pages

Each page is self-contained:
- **template.js** - Defines form fields
- **handlers.js** - Page-specific logic (geocoding, calendar sync, etc.)
- **applicator.js** - Applies settings to app/widgets

### Adding a New Settings Page

```javascript
// 1. Create page folder
js/modules/Settings/pages/my-page/

// 2. Create settings-my-page.js
export default {
    id: 'my-page',
    title: 'My Page Settings',
    template: MyPageTemplate,
    handlers: MyPageHandlers,
    applicator: MyPageApplicator
}

// 3. Register in settings-config.js
import MyPage from './pages/my-page/settings-my-page.js';
SettingsConfig.registerPage(MyPage);
```

---

## Dashboard Module

### Purpose

The Dashboard module is the main view showing the 2x3 widget grid, sidebar menu, and focus navigation.

### Architecture (Refactored v2.0 - October 2025)

```
js/modules/Dashboard/
├── dashboard.js                       # Public API
├── dashboard-input-handler.js         # Routes D-pad/keyboard input to navigation-manager
├── dashboard-state-manager.js         # Dashboard state (~100 lines)
│                                      # - Grid position (row, col)
│                                      # - Focused widget
│                                      # - Menu state (open/closed, selected item)
│                                      # - isIdle flag (visual state vs position)
│
├── dashboard-navigation-manager.js    # Navigation logic (~400 lines)
│                                      # - Grid movement (3 rows × 2 columns)
│                                      # - Menu navigation (7 items)
│                                      # - Widget focus/defocus
│                                      # - ESCAPE handling
│                                      # - Delegates visual updates to ui-renderer
│
├── dashboard-timers.js                # Timeout management (~150 lines)
│                                      # - 20s selection timeout
│                                      # - 60s focus timeout
│                                      # - Auto-hide system
│
├── dashboard-widget-config.js         # Widget configuration (~100 lines)
│                                      # - Grid layout (row, col, span)
│                                      # - Per-widget focusScale
│                                      # - Centerability flags
│
├── dashboard-ui-renderer.js           # Orchestration layer (~295 lines)
│   (REFACTORED v2.0)                  # - Thin coordinator (65% size reduction!)
│                                      # - Initializes sub-modules
│                                      # - Delegates to specialized modules
│                                      # - Manages lifecycle (render, hide, destroy)
│                                      # - Pass-through API for backward compatibility
│
├── dashboard-dom-builder.js           # DOM creation (~155 lines)
│   (NEW - Extracted from ui-renderer) # - createContainer()
│                                      # - createSidebarWrapper()
│                                      # - createSidebar() + createMenuItem()
│                                      # - createGrid() + createGridCell()
│                                      # - Pure functions, no side effects
│
├── dashboard-event-handlers.js        # Event handling (~470 lines)
│   (NEW - Extracted from ui-renderer) # - GridEventHandler (hover/click/leave)
│                                      # - MenuEventHandler (hover/click/touch)
│                                      # - SidebarEventHandler (expand/collapse)
│                                      # - OverlayEventHandler (click-to-defocus)
│                                      # - Mouse/touch/d-pad integration
│
├── dashboard-visual-effects.js        # Visual updates (~420 lines)
│   (NEW - Extracted from ui-renderer) # - updateFocus() / clearGridFocus()
│                                      # - updateMenuSelection() / clearMenuFocus()
│                                      # - showMenu() / hideMenu()
│                                      # - focusWidget() / defocusWidget()
│                                      # - setWidgetActive() / setWidgetFocused()
│                                      # - All CSS class manipulation
│                                      # - No event handling logic
│
└── dashboard-focus-menu-manager.js    # Focus menu system (~150 lines)
                                       # - Menu item tracking
                                       # - Selection state
                                       # - Active/inactive transitions
```

### Refactoring Summary (October 2025)

**Before:** Monolithic `dashboard-ui-renderer.js` (853 lines)

**After:** Modular architecture (4 files)
- **dashboard-ui-renderer.js** (295 lines) - Orchestration only
- **dashboard-dom-builder.js** (155 lines) - DOM creation
- **dashboard-event-handlers.js** (470 lines) - Event handling
- **dashboard-visual-effects.js** (420 lines) - Visual updates

**Benefits:**
- ✅ Clear separation of concerns (DOM, Events, Visual, Orchestration)
- ✅ 65% reduction in core renderer size
- ✅ Easier to maintain and test
- ✅ Reusable components (event handlers can be tested in isolation)
- ✅ No breaking changes to public API

### Navigation Consolidation

**Key Decision:** navigation.js (1,052 lines) is **dashboard-specific** and absorbed into Dashboard module.

**Why?**
- 80% of navigation.js is Dashboard UI logic (grid, menu, focus, centering)
- Only 20% is generic widget communication (already exists as widget-messenger.js in core)
- Keeps Dashboard module self-contained
- Easier to test and maintain

**What Goes Where:**

| Functionality | Goes To |
|--------------|---------|
| Grid navigation (2x3 movement) | `Dashboard/dashboard-navigation-manager.js` |
| Menu navigation | `Dashboard/dashboard-navigation-manager.js` |
| Widget focus/defocus | `Dashboard/dashboard-navigation-manager.js` |
| Widget centering & overlay | `Dashboard/dashboard-ui-renderer.js` |
| Focus menu display | `Dashboard/dashboard-ui-renderer.js` |
| Timeout management | `Dashboard/dashboard-navigation-manager.js` |
| Widget postMessage | `core/widget-messenger.js` (already exists) |

---

## Theme System

### Overview

The theme system provides comprehensive theming capabilities including light/dark modes, seasonal themes (Halloween), and advanced overlay decorations with animations.

### Architecture

```
js/ui/themes/
├── theme-registry.js                    # Theme definitions (light, dark, halloween)
├── theme-overlay-applier.js             # Overlay engine (manages decorative elements)
├── theme-overlay-config-registry.js     # Overlay configurations per theme
├── theme-overlay-element-creator.js     # Creates DOM elements for overlays
├── theme-overlay-container-manager.js   # Manages overlay containers
├── theme-overlay-visibility-manager.js  # Controls visibility/animations
├── theme-overlay-halloween.js           # Halloween-specific overlay config
└── THEME_OVERLAY.md                     # Documentation
```

### Theme Applier (js/ui/theme-applier.js)

**Responsibilities:**
- Apply theme CSS classes to document
- Store/load theme preference (localStorage: `dashie-theme`)
- Coordinate with theme overlay system
- Broadcast theme changes via AppComms

**API:**
```javascript
ThemeApplier.applyTheme(themeName)
ThemeApplier.getCurrentTheme()
ThemeApplier.loadThemeFromStorage()
ThemeApplier.saveThemeToStorage(themeName)
```

### Theme Overlay System

**Design Pattern:** Separation of concerns
- **Overlay Engine** (`theme-overlay-applier.js`) - Generic application logic
- **Overlay Configs** (`theme-overlay-halloween.js`) - Theme-specific decorations

**Key Features:**
- Decorative elements positioned via CSS (no JavaScript positioning)
- Click-through overlays (don't block dashboard interaction)
- Duplicate prevention (clears existing before applying)
- Visibility management (show/hide animations)
- Container management (creates/destroys overlay containers)
- Widget iframe injection (applies overlays to widgets)

**Halloween Theme Example:**
- Animated GIFs (spiders, bats, ghosts)
- Static SVG decorations (pumpkins, cobwebs)
- CSS animations (glow effects, floating)
- Seasonal auto-activation (October)

### Theme Configuration

Themes defined in `theme-registry.js`:
```javascript
{
  id: 'halloween',
  name: 'Halloween',
  cssClass: 'theme-halloween',
  overlay: {
    enabled: true,
    configId: 'halloween'  // References theme-overlay-halloween.js
  }
}
```

### Integration Points

1. **Application Startup** - Load saved theme
2. **Settings Module** - Theme selection UI
3. **Widget Iframes** - Theme propagation via postMessage
4. **Cross-Dashboard Sync** - Theme changes sync across windows

---

## Mobile & Touch System

### Overview

Complete mobile platform support with touch-optimized UI, gesture controls, and mobile-specific initialization path.

### Mobile UI (js/ui/mobile-ui.js)

**Features:**
- Mobile landing page with family name/profile
- Settings button and logout button
- Loading progress bar (10% increments)
- Mobile-optimized layout (no dashboard grid)
- Touch-first interaction model

**Initialization Flow:**
```javascript
// Detects mobile via user agent OR viewport width <= 768px
if (isMobile) {
  showMobileLandingPage();
  initializeMobileUI();
  skipWidgetInitialization();  // No widgets on mobile
  initializeSettingsModule();  // Settings accessible via modal
}
```

### Touch Controls (js/widgets/shared/widget-touch-controls.js)

**Components:**

**1. TouchButton Class**
- Circular themed buttons
- Configurable positions: `left`, `right`, `top-right`, `bottom-left`, etc.
- Auto-theming via CSS variables
- Icon/label support
- Click/tap handlers

**2. LongPressDetector Class**
- Configurable duration (default: 500ms)
- Progress indicators
- Cancel detection (touch move/leave)
- Callback system

**Usage Example:**
```javascript
const nextButton = new TouchButton({
  position: 'right',
  icon: '→',
  label: 'Next',
  onClick: () => { /* handler */ }
});

const longPress = new LongPressDetector(element, {
  duration: 1000,
  onLongPress: () => { /* handler */ }
});
```

### Platform Detection

**Mobile Detection Logic:**
```javascript
// User agent patterns
/Android|iPhone|iPad|iPod|Mobile|Tablet/

// OR viewport width
window.innerWidth <= 768
```

**Platform Values:**
- `tv` - Fire TV devices
- `desktop` - Desktop browsers
- `mobile` - Phones/tablets

### Mobile-Specific Features

1. **Skip Dashboard** - No widget grid on mobile
2. **Modal Settings** - Settings accessed via modal, not separate module
3. **Touch Gestures** - Swipe, tap, long-press support
4. **Loading Progress** - Visual feedback during initialization
5. **Simplified Navigation** - No D-pad/keyboard navigation

---

## Cross-Dashboard Synchronization

### Overview

Real-time synchronization across multiple browser windows/tabs using Supabase Realtime and Broadcast channels.

### Dashboard Sync Service (js/data/services/dashboard-sync-service.js)

**Responsibilities:**
- Detect multiple dashboard instances
- Synchronize state changes across windows
- Broadcast events to other dashboards
- Handle version mismatches
- Coordinate settings updates

**Synchronization Scope:**
- Theme changes (instant sync)
- Settings updates (calendar, photos, interface)
- Calendar data refresh triggers
- Photo library updates
- User authentication state

### Communication Channels

**1. Supabase Broadcast Channel**
```javascript
const channel = supabase.channel('dashboard-sync')
  .on('broadcast', { event: 'theme-changed' }, (payload) => {
    ThemeApplier.applyTheme(payload.theme);
  })
  .on('broadcast', { event: 'settings-updated' }, (payload) => {
    SettingsService.reloadSettings();
  })
  .subscribe();
```

**2. Broadcast Events**
- `theme-changed` - Theme selection changed
- `settings-updated` - Settings modified
- `calendar-refreshed` - Calendar data updated
- `photos-updated` - Photo library changed
- `auth-state-changed` - Login/logout

### Heartbeat Service (js/data/services/heartbeat-service.js)

**Purpose:** Track dashboard health and version across instances

**Functionality:**
- Send heartbeat every 60 seconds
- Store: Dashboard ID, version, last active timestamp
- Detect version mismatches
- Notify user if refresh needed
- Clean up stale heartbeats

**Database Schema:**
```sql
CREATE TABLE dashboard_heartbeats (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  dashboard_id TEXT,
  version TEXT,
  last_heartbeat TIMESTAMP,
  metadata JSONB
);
```

### Synchronization Patterns

**Optimistic Updates:**
1. Update local state immediately
2. Broadcast change to other dashboards
3. Write to database asynchronously
4. Handle conflicts gracefully

**Example: Theme Change**
```javascript
// Dashboard A changes theme
ThemeApplier.applyTheme('dark');
DashboardSyncService.broadcast('theme-changed', { theme: 'dark' });

// Dashboard B receives broadcast
channel.on('broadcast', { event: 'theme-changed' }, ({ theme }) => {
  ThemeApplier.applyTheme(theme);
  // Updates UI instantly without page reload
});
```

---

# Part IV: Implementation

## Component Communication

### Communication Patterns

#### 1. Module → Core (via AppStateManager)
```javascript
AppStateManager.setCurrentModule('settings');
```

#### 2. Core → Module (via AppComms)
```javascript
// Core broadcasts
AppComms.publish(AppComms.events.STATE_UPDATED, state);

// Module subscribes
AppComms.subscribe(AppComms.events.STATE_UPDATED, handleStateChange);
```

#### 3. Module → Data Layer (direct import)
```javascript
import CalendarService from '../../data/services/calendar-service.js';
const events = await CalendarService.getEvents(startDate, endDate);
```

#### 4. Data Layer → Modules (via AppComms)
```javascript
// Service publishes
AppComms.publish(AppComms.events.DATA_UPDATED, { type: 'calendar', data });
```

#### 5. Module → Widget (via WidgetMessenger)
```javascript
WidgetMessenger.sendToWidget('calendar', 'data', { events });
```

#### 6. Widget → Module (via postMessage)
```javascript
// Widget sends message
window.parent.postMessage({ type: 'event', action: 'open-settings' }, '*');

// WidgetMessenger receives and publishes
AppComms.publish(AppComms.events.WIDGET_MESSAGE, message);
```

---

## State Management

### State Layers

1. **Global State** - `app-state-manager.js` (current module, auth, theme)
2. **Module State** - Each module's `state-manager.js` (module-specific)
3. **Widget State** - Isolated within widget iframe

### State Flow

```
User Action
    ↓
Module updates its state-manager
    ↓
Module calls AppStateManager.setState() if global state affected
    ↓
AppStateManager publishes STATE_UPDATED event
    ↓
Interested modules react
    ↓
UI re-renders
```

### Persistence

- **Global State** → localStorage (theme, last module)
- **Settings** → Supabase + localStorage (via JWT service)
- **Auth Tokens** → Secure token-store
- **Data Cache** → In-memory (data-cache.js)

---

## Initialization Sequence

### 3-Phase Initialization Architecture

The application uses a streamlined 3-phase initialization process optimized for different platforms.

### Phase 1: Platform Detection & Auth Check (main.js)

```javascript
1. DOMContentLoaded event fires
    ↓
2. Platform detection
   - Detect mobile (user agent OR viewport width <= 768px)
   - Detect Fire TV
   - Detect desktop
   - Set global platform flag
    ↓
3. Check for auth bypass mode
   - Query parameter: ?bypass-auth
   - Skip authentication for UI development
    ↓
4. Session restoration
   - Check for stored JWT (localStorage: 'dashie-supabase-jwt')
   - Validate JWT expiry
   - Restore user session if valid
    ↓
5. Platform-specific UI
   - If mobile: Show mobile landing page
   - If desktop/TV: Show login screen or dashboard
```

### Phase 2: Authentication (auth-initializer.js)

```javascript
1. SessionManager initialization
    ↓
2. AuthCoordinator setup
   - Register auth providers (WebOAuth, DeviceFlow, HybridDeviceAuth)
   - Select appropriate provider based on platform
    ↓
3. Check existing session
   - JWT validation
   - Token refresh if needed
   - User profile loading
    ↓
4. OAuth flow (if not authenticated)
   - Web OAuth: Standard browser flow
   - Device Flow: QR code for Fire TV
   - Hybrid Flow: Phone + TV simultaneous auth
    ↓
5. EdgeClient initialization
   - JWT lifecycle management
   - Token refresh scheduling (24hr threshold)
   - Supabase edge function communication
```

### Phase 3: Core Initialization (core-initializer.js)

```javascript
1. AppStateManager initialization
   - Load platform state
   - Set authentication state
   - Initialize global state structure
    ↓
2. Service initialization (service-initializer.js)
   - CalendarService (with modular architecture)
   - PhotoService
   - SettingsService (dual read/write pattern)
   - WeatherService
   - HeartbeatService
   - DashboardSyncService (cross-window sync)
    ↓
3. Load settings from database
   - Fetch user_settings via SettingsService
   - Apply theme from settings
   - Configure widgets
    ↓
4. Dashboard module initialization (if not mobile)
   - Create widget grid (2x3)
   - Initialize widget iframes
   - Set up postMessage communication
    ↓
5. Widget initialization (widget-initializer.js)
   - Wait for widget iframes to load
   - Register widgets with WidgetMessenger
   - Send initial configuration
   - Send initial data (calendar, photos, weather)
    ↓
6. Theme overlay re-application
   - Apply theme overlays to dashboard
   - Inject overlays into widget iframes
   - Initialize overlay animations
    ↓
7. Critical widget wait
   - Wait for calendar, agenda, photos widgets
   - Timeout: 10 seconds
   - Show dashboard when ready
    ↓
8. Check for first-time setup
   - If no family name: Show Welcome wizard
   - Otherwise: Show Dashboard
    ↓
9. Hide login screen, show dashboard
    ↓
10. Initialize cross-dashboard sync
    - Subscribe to Supabase broadcast channel
    - Start heartbeat service (60s interval)
    ↓
11. Application ready
```

### Mobile-Specific Initialization Path

```javascript
// Mobile skips steps 4-7 from Phase 3
if (isMobile) {
  showMobileLandingPage();
  initializeMobileUI();
  // Skip widget initialization
  initializeSettingsModule();  // Modal-only access
  updateMobileLoadingProgress(100);
}
```

### Auth Bypass Mode (Development)

```javascript
// URL: http://localhost:8000?bypass-auth
if (bypassAuth) {
  skipAuthenticationEntirely();
  proceedDirectlyToCoreInitialization();
  // Useful for UI development without auth flow
}
```

### Initialization State Tracking

```javascript
AppStateManager.state = {
  isInitialized: false,  // Set to true when all phases complete
  currentModule: null,   // Set when module activates
  platform: 'desktop',   // Set in Phase 1
  user: {
    isAuthenticated: false,  // Set in Phase 2
    userId: null,
    email: null
  }
}
```

---

## Module Lifecycle

### Lifecycle Methods

```javascript
// Called once during app initialization
async initialize() {
    // Set up event listeners
    // Load module configuration
    // Prepare resources
}

// Called when module becomes active
activate() {
    // Render UI
    // Start listening to inputs
    // Subscribe to events
}

// Called when module becomes inactive
deactivate() {
    // Clean up UI (hide, not destroy)
    // Stop listening to inputs
    // Unsubscribe from events
}

// Called when module is destroyed (rarely)
destroy() {
    // Remove all event listeners
    // Clean up memory
    // Clear state
}
```

### Module Transitions

```javascript
// User navigates from Dashboard to Settings
AppStateManager.setCurrentModule('settings');
    ↓
ActionRouter triggers module change
    ↓
Dashboard.deactivate()
    ↓
Settings.activate()
    ↓
UI updates
```

---

## Widget Communication Protocol

⚠️ **See also:** [`js/core/WIDGET_MESSENGER.md`](../js/core/WIDGET_MESSENGER.md) for critical deduplication requirements when adding new state properties.

### Message Structure

```javascript
{
    type: 'command' | 'data' | 'config' | 'event',
    widgetId: string,
    payload: any,
    timestamp: number
}
```

### Commands (App → Widget)

```javascript
// Navigation
{ type: 'command', widgetId: 'calendar', payload: { action: 'up' } }
{ type: 'command', widgetId: 'calendar', payload: { action: 'enter' } }

// State changes
{ type: 'command', widgetId: 'calendar', payload: { action: 'enter-focus' } }
{ type: 'command', widgetId: 'calendar', payload: { action: 'exit-focus' } }
{ type: 'command', widgetId: 'calendar', payload: { action: 'enter-active' } }
{ type: 'command', widgetId: 'calendar', payload: { action: 'exit-active' } }
```

### Data (App → Widget)

```javascript
{
    type: 'data',
    widgetId: 'calendar',
    payload: {
        dataType: 'events',
        data: [ /* events array */ ]
    }
}
```

### Events (Widget → App)

```javascript
// Widget ready
{
    type: 'event',
    widgetId: 'calendar',
    payload: {
        eventType: 'widget-ready',
        data: { hasMenu: true, menuItems: ['Today', 'Week', 'Month'] }
    }
}

// Return to menu
{
    type: 'event',
    widgetId: 'calendar',
    payload: { eventType: 'return-to-menu', data: {} }
}

// Settings requested
{
    type: 'event',
    widgetId: 'calendar',
    payload: { eventType: 'settings-requested', data: {} }
}
```

---

# Part V: Refactoring Plans

## JWT Service Refactoring

### Rationale

The legacy JWT service works well but has architectural issues:
- ❌ Class inheritance creates tight coupling
- ❌ Mixed concerns (JWT, tokens, settings, HTTP)
- ❌ Hard to test (700+ line classes)

### Refactoring Plan

**Old Structure:**
```
jwt-service-core.js (702 lines)
    ↓ extends
jwt-token-operations.js (687 lines)
```

**New Structure:**
```
jwt/
├── jwt.js                      (~150 lines)
├── jwt-manager.js              (~250 lines)
├── jwt-storage.js              (~100 lines)
├── token-cache.js              (~150 lines)
├── edge-client.js              (~200 lines)
└── settings-integration.js     (~100 lines)
```

### Module Breakdown

#### 1. jwt-manager.js
- JWT lifecycle management
- Auto-refresh timer (24hr threshold)
- Expiry parsing
- Auto-logout on failure

#### 2. jwt-storage.js
- localStorage save/load
- Expiry validation
- User validation

#### 3. token-cache.js
- OAuth token caching (10min buffer)
- Request deduplication
- Cache invalidation

#### 4. edge-client.js
- HTTP communication with Supabase
- All edge function operations (get JWT, store tokens, load settings, etc.)
- Error handling

#### 5. settings-integration.js
- Settings save/load bridge
- Token refresh notifications

#### 6. jwt.js (Coordinator)
- Initializes all subsystems
- Exposes unified API
- Delegates to appropriate subsystem

### Benefits

✅ **Single responsibility** per file
✅ **Composition** over inheritance
✅ **Testable** with dependency injection
✅ **Smaller files** (100-250 lines vs 700+)
✅ **Reusable** components (TokenCache can be used elsewhere)

### Implementation Timeline

**Week 1:** Build new modules + unit tests
**Week 2:** Migration + integration tests + cleanup

---

## Navigation Consolidation

### Decision

**navigation.js (1,052 lines) → Dashboard module**

### Breakdown

| Current (navigation.js) | New Location |
|------------------------|--------------|
| Grid navigation (200 lines) | `Dashboard/navigation-manager.js` |
| Menu navigation (150 lines) | `Dashboard/navigation-manager.js` |
| Widget centering (200 lines) | `Dashboard/ui-renderer.js` |
| Timeout management (100 lines) | `Dashboard/navigation-manager.js` |
| Focus menu (150 lines) | `Dashboard/focus-menu-manager.js` |
| Widget postMessage (150 lines) | `core/widget-messenger.js` (already exists) |

### Result

**Dashboard module total:** ~1,100 lines across 5 focused files

**Benefits:**
- ✅ Dashboard is self-contained
- ✅ Clear module boundaries
- ✅ Easy to test
- ✅ Core stays lean (only generic infrastructure)

---

## Priority Refactoring List

### 🔴 Must Refactor (Do First)

1. **navigation.js** (1,052 lines) → Dashboard module (6 files)
2. **main.js** (621 lines) → initialization system (7 initializers)

### ⚠️ Should Refactor (Do During Build)

3. **JWT service** (1,389 lines) → 6 modular files
4. **data-manager.js** (451 lines) → orchestrator + distributor
5. **welcome-wizard.js** (801 lines) → modular screens

### ✅ Keep As-Is (Well-Designed)

- logger.js (600 lines) - complex but well-designed
- crash-monitor.js (511 lines)
- platform-detector.js (483 lines)
- redirect-manager.js (499 lines)
- All service files (calendar, photo, telemetry)
- All auth provider files (device-flow, web-oauth, native-android)

---

## Technical Debt Integration

### High-Priority Technical Debt (Address During Refactor)

These items from `.reference/TECHNICAL_DEBT.md` are being integrated into the refactor:

#### 1. Multi-Provider Authentication Architecture ⚠️ **HIGH PRIORITY**

**Status:** Integrated into architecture design (see [Authentication & JWT System](#authentication--jwt-system))

**Implementation Phases:**
- **Phase 1: Token Optimization Fixes** (2 days) - With JWT refactor
  - Fix cache not updating after token refresh ✅ Documented in jwt/token-cache.js
  - Fix force refresh not invalidating cache ✅ Documented in jwt/token-cache.js
  - Fix localStorage not syncing after refresh

- **Phase 2: Two-Layer Architecture** (5 days) - During auth layer build
  - Create base classes for account auth vs calendar auth ✅ Documented
  - Refactor existing Google code into new structure
  - Implement auth-bridge edge function for token exchange
  - Maintain 100% backward compatibility

- **Phase 3: Additional Calendar Providers** (7 days) - Post-launch enhancement
  - Apple iCloud Calendar (CalDAV protocol)
  - Microsoft Exchange/Outlook (Graph API)
  - Multi-provider calendar display

- **Phase 4: Additional Account Providers** (4 days) - Post-launch enhancement
  - Amazon OAuth for account login
  - Email/Password via Supabase Auth
  - Multi-provider login UI

- **Phase 5: Fire TV Native Auth** (2 days) - Post-launch optimization
  - Native Amazon auth on Fire TV (5-10 sec vs 60+ sec device flow)
  - JavaScript bridge to Android native code

**Total Effort:** 3-4 weeks (Phase 1-2 during refactor, Phase 3-5 post-launch)

---

#### 2. Separate Authentication Tokens from User Settings ⚠️ **HIGH PRIORITY**

**Status:** Integrated into architecture design (see [Token Storage Separation](#token-storage-separation))

**Implementation:**
- Create `user_auth_tokens` table in database
- Store tokens in dedicated localStorage key (`dashie-auth-tokens`)
- Update edge functions to handle separate token storage
- Migrate existing tokens during deployment
- Extract `tokenAccounts` from settings object
- Update jwt/settings-integration.js to NOT store auth tokens in settings

**Effort:** 2-3 days (during JWT refactor)

**Files to Update:**
- `js/data/auth/token-store.js` (new storage layer)
- `js/data/auth/jwt/settings-integration.js` (remove token storage)
- `supabase/functions/jwt-auth/index.ts` (separate token operations)
- `supabase/functions/database-operations/index.ts` (new table)

---

#### 3. Shared Calendar Identification Architecture ⚠️ **HIGH PRIORITY**

**Status:** Integrated into architecture design (see [Calendar Service & Shared Calendar Architecture](#calendar-service--shared-calendar-architecture))

**Implementation:**
- Account-prefixed calendar IDs: `{accountType}-{calendarId}`
- Eliminates `calendarAccountMap` workaround
- Clean removal logic by prefix matching
- Migration from old format

**Effort:** 3-5 days (during calendar service build)

**Files to Update:**
- `js/data/services/calendar-service.js`
- `js/modules/Settings/pages/calendar/`
- `js/widgets/Calendar/`
- `js/utils/calendar-sync-helper.js`

---

### Medium-Priority Technical Debt (Consider Post-Launch)

#### 1. Settings System Re-Architecture
**Status:** Referenced in [Settings System](#settings-system) section

**Key Improvements:**
- Schema validation (Zod or JSON Schema)
- Event-driven architecture
- Composition over mixin inheritance
- Promise-based initialization (no timeouts)
- Single source of truth (no calendar service localStorage bypass)

**Effort:** 3-4 weeks
**Timing:** Post-launch (Settings module works, but could be cleaner)

---

#### 2. Welcome Wizard D-pad Enter Key Bug
**Status:** Known issue, workaround exists

**Impact:** Fire TV users can't review detected location with d-pad
**Timing:** Fix during Welcome module refactor

---

### Low-Priority Technical Debt (Future Enhancements)

#### 1. Offline Mode & Graceful Degradation
**Implementation:** Post-launch enhancement
- IndexedDB caching for calendar events (7-14 days)
- Photo offline caching (LRU eviction)
- Connection status indicator
- Smart retry logic with exponential backoff

**Effort:** 1-2 weeks

---

#### 2. Consolidate Storage Patterns
**Implementation:** During initial build
- Use config.js STORAGE_KEYS for all localStorage keys ✅ Already done
- Consistent naming convention

**Effort:** Already addressed in config.js

---

#### 3. Settings Default Values Strategy
**Implementation:** Already addressed
- config.js provides single source of truth ✅ Already done
- getDefaultSettings() in config.js

**Effort:** Already complete

---

# Part VI: Migration & Testing

## Migration from Legacy

### Process

1. ✅ **Move legacy code to `.legacy/`** (Done)
2. **Build core infrastructure** (app-comms, app-state-manager, action-router)
3. **Build Dashboard module** (validate architecture)
4. **Build data layer** (auth, JWT, services)
5. **Build remaining modules** (Settings, Login, Modals, Welcome)
6. **Refactor complex systems** (JWT, navigation consolidation)
7. **Test thoroughly**
8. **Remove legacy code**

### Migration Order (6-8 weeks)

**Week 1:** Core infrastructure
**Week 2:** Dashboard module
**Week 3:** Data layer (auth, JWT, services)
**Week 4-5:** Remaining modules
**Week 6:** Refactoring (JWT, cleanup)
**Week 7:** Testing & polish

### Cherry-Picking from Legacy

When migrating, look for:
- ✅ Pure functions (easy to move)
- ✅ Well-isolated logic
- ⚠️ Tightly coupled code (refactor first)
- ❌ God objects (rewrite)

**Example:**
```javascript
// Good: Pure function from legacy
function calculateGridPosition(row, col) {
    return { index: row * 3 + col };
}
// → Copy directly to new code

// Bad: Tightly coupled god object
class Navigation {
    // 1,052 lines of mixed concerns
}
// → Refactor into focused modules
```

---

## Testing Strategy

### Unit Tests

**Framework:** Jest or Vitest
**Coverage Target:** 80%+

**Test Each:**
- Core infrastructure (AppComms, AppStateManager, ActionRouter)
- Module lifecycle methods
- State managers
- Navigation logic
- JWT service components
- Settings store

**Example:**
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
- Dashboard navigation works (grid, menu, focus)
- Settings can be changed and saved
- Auth flow completes
- Widgets load and respond to commands
- Module transitions work

### Testing Checklist

**Core Layer:**
- [ ] AppComms pub/sub works
- [ ] AppStateManager persists state
- [ ] ActionRouter routes to correct module
- [ ] WidgetMessenger sends/receives messages

**Dashboard Module:**
- [ ] Grid navigation (up/down/left/right)
- [ ] Menu navigation
- [ ] Widget focus/defocus
- [ ] State persistence
- [ ] Input handling

**Data Layer:**
- [ ] Auth flow (sign-in, sign-out)
- [ ] JWT lifecycle (get, refresh, auto-refresh)
- [ ] Token caching works
- [ ] Services fetch data correctly

**Settings Module:**
- [ ] Settings load/save
- [ ] Navigation between pages
- [ ] Field validation
- [ ] Settings apply to widgets

---

## Glossary

- **Module** - Self-contained feature with input/state/navigation/UI
- **Widget** - Iframe-isolated UI component
- **Core** - Foundational infrastructure (app-comms, app-state-manager, etc.)
- **Data Layer** - All data operations (API calls, auth, persistence)
- **pub/sub** - Publish/subscribe pattern for events
- **D-pad** - Directional pad (TV remote navigation)
- **RLS** - Row Level Security (Supabase database)
- **JWT** - JSON Web Token (authentication)
- **Edge Function** - Serverless function on Supabase
- **Device Flow** - OAuth2 flow for devices without browsers (TV)

---

## Implementation Status Summary

### ✅ COMPLETED PHASES

**Phase 5.5+ Status: PRODUCTION READY**

All major features from Phase 5.5 build plan completed except Quotables Widget:

1. **Halloween Theme & Overlay System** - ✅ COMPLETE
   - Advanced theme overlay engine with visibility management
   - Halloween theme with animated decorations
   - Click-through overlays that don't block interaction
   - Comprehensive documentation (THEME_OVERLAY.md)

2. **Touch & Mobile System** - ✅ COMPLETE
   - TouchButton and LongPressDetector classes
   - Mobile-specific UI and initialization path
   - Mobile landing page with loading progress
   - Touch controls for widgets

3. **Hybrid Device Authentication** - ✅ COMPLETE
   - Session manager and auth coordinator
   - Hybrid device flow (phone + Fire TV simultaneous auth)
   - QR code authentication for Fire TV
   - Complete documentation (HYBRID_DEVICE_FLOW.md)

4. **Cross-Dashboard Synchronization** - ✅ COMPLETE
   - Real-time sync via Supabase broadcast channels
   - Heartbeat service for version tracking
   - Optimistic update pattern
   - Theme, settings, and data synchronization

5. **Modular Widget Architecture** - ✅ IN PLACE
   - 5 widgets implemented (Calendar, Agenda, Photos, Clock, Header)
   - Widget communication via WidgetMessenger
   - Widget data manager with refresh intervals
   - Widget development guide (WIDGETS_README.md)

### ⏳ REMAINING ITEMS

**Not Yet Implemented:**
- Quotables Widget (Phase 5.5 item)
  - Themed quotes/facts display
  - Background images
  - Content cycling
  - Theme-aware content switching

**Future Enhancements:**
- Custom theme builder UI
- Additional auth providers (Amazon, Microsoft, Apple)
- Additional calendar providers (iCloud, Outlook)
- Widget picker and drag-and-drop layout

### 🎯 PRODUCTION FEATURES

**Enterprise-Grade Capabilities:**
- Multi-platform support (Desktop, Fire TV, Mobile)
- Hybrid authentication with QR codes
- Real-time cross-dashboard sync
- Advanced theming with seasonal overlays
- Touch-optimized mobile interface
- Modular calendar service architecture
- Comprehensive logging and error tracking
- Offline capability with localStorage caching
- JWT refresh management (24hr threshold)
- Settings dual read/write pattern

**Performance Optimizations:**
- Calendar TTL caching (5 minutes)
- Stale cache served during refresh
- Background refresh without loading screens
- Widget state deduplication
- Batch layout reads/writes

**Developer Experience:**
- Auth bypass mode (?bypass-auth)
- Console debug commands
- Comprehensive logging system
- Inline documentation (.md files)
- Clear separation of concerns
- Testable modular architecture

---

## Related Documents

- **[CLAUDE.md](/CLAUDE.md)** - Project-level documentation and development guidelines
- **[THEME_OVERLAY.md](js/ui/themes/THEME_OVERLAY.md)** - Theme overlay system documentation
- **[HYBRID_DEVICE_FLOW.md](js/data/auth/HYBRID_DEVICE_FLOW.md)** - Hybrid authentication documentation
- **[WIDGETS_README.md](js/widgets/WIDGETS_README.md)** - Widget development guide
- **[SETTINGS_PAGE_BASE_GUIDE.md](js/modules/Settings/SETTINGS_PAGE_BASE_GUIDE.md)** - Settings page development
- **[Phase 5.5 Build Plan](.reference/build-plans/Phase 5.5 - Theming & Hybrid Auth.md)** - Original phase 5.5 plan

---

**End of Architecture Document**

*Last Updated: 2025-10-22*
*Version: 3.0 (Phase 5.5+ Complete - Production Ready)*
