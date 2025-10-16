# Dashie Application Architecture v2.0

**Last Updated:** 2025-10-15
**Status:** Design Phase - Ground-Up Rebuild

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
- **Platform:** Web-based (HTML/CSS/JavaScript)
- **Target Devices:** Smart TVs (Fire TV), Desktop browsers, Mobile devices
- **Input Methods:** D-pad navigation (TV), keyboard (Desktop), touch (Mobile)
- **Architecture Style:** Modular, event-driven, iframe-based widgets
- **Backend:** Supabase (PostgreSQL + Storage)
- **Authentication:** OAuth2 (Google), Device Flow, JWT
- **Total Codebase:** 27,300 lines across 75 files (legacy)

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
│   │   │   ├── index.js                # Public API
│   │   │   ├── input-handler.js
│   │   │   ├── state-manager.js
│   │   │   ├── navigation-manager.js   # Grid + menu + focus navigation
│   │   │   ├── ui-renderer.js          # Absorbs grid.js, focus-menu.js
│   │   │   └── focus-menu-manager.js   # Focus menu system
│   │   │
│   │   ├── Settings/
│   │   │   ├── index.js
│   │   │   ├── orchestrator.js
│   │   │   ├── config.js
│   │   │   ├── input-handler.js
│   │   │   ├── state-manager.js
│   │   │   ├── navigation-manager.js
│   │   │   ├── ui-renderer.js
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
│   │   │   ├── index.js
│   │   │   ├── input-handler.js
│   │   │   ├── state-manager.js
│   │   │   └── ui-renderer.js          # Absorbs auth-ui.js
│   │   │
│   │   ├── Modals/
│   │   │   ├── index.js
│   │   │   ├── input-handler.js
│   │   │   ├── state-manager.js
│   │   │   └── ui-renderer.js
│   │   │
│   │   └── Welcome/
│   │       ├── index.js
│   │       ├── wizard-controller.js
│   │       └── screens/
│   │
│   ├── data/                           # Data layer
│   │   ├── auth/
│   │   │   ├── session-manager.js      # Orchestrates auth (from simple-auth.js)
│   │   │   ├── token-store.js
│   │   │   ├── auth-coordinator.js
│   │   │   ├── account-manager.js
│   │   │   │
│   │   │   ├── jwt/                    # JWT Service (REFACTORED)
│   │   │   │   ├── index.js            # Public API & coordinator
│   │   │   │   ├── jwt-manager.js      # JWT lifecycle (~250 lines)
│   │   │   │   ├── jwt-storage.js      # localStorage (~100 lines)
│   │   │   │   ├── token-cache.js      # OAuth caching (~150 lines)
│   │   │   │   ├── edge-client.js      # HTTP communication (~200 lines)
│   │   │   │   └── settings-integration.js (~100 lines)
│   │   │   │
│   │   │   └── providers/
│   │   │       ├── device-flow.js      # OAuth2 Device Flow (TV)
│   │   │       ├── web-oauth.js        # Standard OAuth2
│   │   │       └── native-android.js
│   │   │
│   │   ├── services/
│   │   │   ├── calendar-service.js
│   │   │   ├── photo-service.js
│   │   │   ├── weather-service.js
│   │   │   ├── telemetry-service.js
│   │   │   ├── greeting-service.js
│   │   │   ├── account-deletion-service.js
│   │   │   └── google/
│   │   │       └── google-client.js
│   │   │
│   │   ├── database/
│   │   │   ├── supabase-client.js
│   │   │   ├── supabase-storage.js
│   │   │   └── supabase-config.js
│   │   │
│   │   ├── data-manager.js             # Orchestrates data flow
│   │   ├── data-cache.js               # In-memory caching
│   │   └── data-handler.js             # Persistence interface
│   │
│   ├── ui/                             # Global UI components
│   │   ├── theme-applier.js
│   │   ├── toast.js
│   │   └── components/
│   │
│   ├── widgets/                        # Widget implementations
│   │   ├── Calendar/
│   │   ├── Photos/
│   │   ├── Clock/
│   │   ├── Weather/
│   │   ├── Header/
│   │   ├── Agenda/
│   │   ├── Location/
│   │   ├── Map/
│   │   └── Camera/
│   │
│   └── utils/                          # Utilities
│       ├── logger.js
│       ├── logger-config.js
│       ├── crash-monitor.js
│       ├── platform-detector.js
│       ├── feature-flags.js
│       ├── redirect-manager.js
│       └── console-commands.js
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
├── index.js                # Public API
├── input-handler.js        # Input processing
├── state-manager.js        # Module-specific state
├── navigation-manager.js   # Internal navigation
└── ui-renderer.js          # DOM rendering
```

### Module Interface

```javascript
// Every module's index.js exports:
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

### Auth Architecture

```
js/data/auth/
├── session-manager.js          # Orchestrates entire auth system
│                               # (refactored from simple-auth.js)
│
├── auth-coordinator.js         # Routes to correct auth provider
├── account-manager.js          # Multi-account calendar switching
├── token-store.js              # Secure credential storage (SEPARATE from settings)
│
├── jwt/                        # JWT Service (REFACTORED)
│   ├── index.js                # Public API & coordinator (~150 lines)
│   ├── jwt-manager.js          # JWT lifecycle (~250 lines)
│   │                           # - Auto-refresh at 24hr threshold
│   │                           # - Token expiry management
│   │                           # - Auto-logout on failure
│   │
│   ├── jwt-storage.js          # localStorage persistence (~100 lines)
│   ├── token-cache.js          # OAuth token caching (~150 lines)
│   │                           # - Request deduplication
│   │                           # - 10-minute buffer
│   │                           # - Fixed: cache updates after refresh
│   │                           # - Fixed: force refresh invalidates cache
│   │
│   ├── edge-client.js          # HTTP to Supabase (~200 lines)
│   │                           # - All edge function operations
│   │                           # - Error handling & retries
│   │
│   └── settings-integration.js # Settings persistence (~100 lines)
│                               # - Save/load via JWT
│                               # - Does NOT store auth tokens in settings
│
├── account-auth/               # Layer 1: Account Authentication (User Login)
│   ├── base-account-auth.js    # Base class for account auth providers
│   ├── google-account-auth.js  # Google OAuth for account login
│   ├── amazon-account-auth.js  # Amazon OAuth (Fire TV native)
│   ├── email-account-auth.js   # Email/Password (Supabase Auth)
│   └── device-flow-auth.js     # Device Flow (TV fallback)
│
├── calendar-auth/              # Layer 2: Calendar API Authentication
│   ├── base-calendar-auth.js   # Base class for calendar providers
│   ├── google-calendar-auth.js # Google Calendar API
│   ├── icloud-calendar-auth.js # Apple iCloud (CalDAV)
│   └── outlook-calendar-auth.js # Microsoft Outlook (Graph API)
│
└── providers/                  # Legacy providers (refactored to two-layer)
    ├── device-flow.js          # OAuth2 Device Flow for TV (839 lines)
    │                           # - QR code generation
    │                           # - Device code polling
    │                           # - Multi-client support
    │
    ├── web-oauth.js            # Standard OAuth2 (625 lines)
    │                           # - Browser redirect flow
    │                           # - State management
    │
    └── native-android.js       # Android-specific auth (200 lines)
```

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
JWT Service (index.js)
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
├── index.js                    # Public API
├── orchestrator.js             # Main coordinator (~400 lines)
├── config.js                   # Page registry (~100 lines)
├── input-handler.js            # D-pad navigation
├── state-manager.js            # Settings state
├── navigation-manager.js       # Screen transitions & nav stack
├── ui-renderer.js              # Modal building
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
│   │   ├── index.js            # Page registration (~30 lines)
│   │   ├── template.js         # HTML template (~100 lines)
│   │   ├── handlers.js         # Page logic (~150 lines)
│   │   └── applicator.js       # Apply settings (~80 lines)
│   │
│   ├── interface/
│   │   ├── index.js
│   │   ├── template.js
│   │   ├── time-selection-handler.js
│   │   └── applicator.js
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

// 2. Create index.js
export default {
    id: 'my-page',
    title: 'My Page Settings',
    template: MyPageTemplate,
    handlers: MyPageHandlers,
    applicator: MyPageApplicator
}

// 3. Register in config.js
import MyPage from './pages/my-page/index.js';
SettingsConfig.registerPage(MyPage);
```

---

## Dashboard Module

### Purpose

The Dashboard module is the main view showing the 2x3 widget grid, sidebar menu, and focus navigation.

### Architecture

```
js/modules/Dashboard/
├── index.js                    # Public API
├── input-handler.js            # Routes D-pad to navigation-manager
├── state-manager.js            # Dashboard state
│                               # - Grid position (row, col)
│                               # - Focused widget
│                               # - Menu state
│
├── navigation-manager.js       # Grid + menu + focus navigation (~350 lines)
│                               # - Grid movement (2x3)
│                               # - Menu navigation (7 items)
│                               # - Widget focus/defocus
│                               # - Timeout management (20s selection, 60s focus)
│
├── ui-renderer.js              # Dashboard UI (~350 lines)
│                               # - Grid rendering
│                               # - Sidebar rendering
│                               # - Focus menu display
│                               # - Widget centering & overlay
│                               # - Highlight show/hide
│                               # (Absorbs grid.js, focus-menu.js from legacy)
│
└── focus-menu-manager.js       # Focus menu system (~150 lines)
                                # - Menu item tracking
                                # - Selection state
                                # - Active/inactive transitions
```

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
| Grid navigation (2x3 movement) | `Dashboard/navigation-manager.js` |
| Menu navigation | `Dashboard/navigation-manager.js` |
| Widget focus/defocus | `Dashboard/navigation-manager.js` |
| Widget centering & overlay | `Dashboard/ui-renderer.js` |
| Focus menu display | `Dashboard/ui-renderer.js` |
| Timeout management | `Dashboard/navigation-manager.js` |
| Widget postMessage | `core/widget-messenger.js` (already exists) |

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

### Detailed Startup Flow

```
1. main.js starts
    ↓
2. startup-checks.js
   - Platform detection (TV, Desktop, Mobile)
   - Dependency validation (localStorage, fetch)
   - Feature flag loading
    ↓
3. auth-initializer.js
   - Initialize session-manager
   - Check for existing session
   - Validate tokens
   - Set auth state
    ↓
4. jwt-initializer.js
   - Initialize JWT service
   - Load cached JWT or fetch new one
   - Start 24hr refresh timer
    ↓
5. theme-initializer.js
   - Load saved theme
   - Apply CSS classes
    ↓
6. AppStateManager.initialize()
   - Load saved state from localStorage
   - Set platform, theme, auth state
    ↓
7. service-initializer.js
   - Initialize calendar-service
   - Initialize photo-service
   - Initialize telemetry-service
    ↓
8. widget-initializer.js
   - Load widget configurations
   - Set up postMessage listeners
   - Register widgets with WidgetMessenger
    ↓
9. Determine initial module
   - If not authenticated → Login
   - If first time → Welcome
   - Otherwise → Dashboard
    ↓
10. Activate initial module
    - module.initialize()
    - ActionRouter.registerModule(moduleName, inputHandler)
    - AppStateManager.setCurrentModule(moduleName)
    - module.activate()
    ↓
11. Application ready
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
├── index.js                    (~150 lines)
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

#### 6. index.js (Coordinator)
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

## Related Documents

- **[API_INTERFACES.md](.reference/API_INTERFACES.md)** - Detailed API contracts for all components
- **[BUILD_STRATEGY.md](.reference/BUILD_STRATEGY.md)** - Day-by-day implementation guide

---

**End of Architecture Document**

*Last Updated: 2025-10-15*
*Version: 2.0 (Consolidated)*
