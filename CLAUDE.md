# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Dashie** is a smart home dashboard application for families, supporting desktop, TV (Fire TV), and mobile platforms. Built with vanilla JavaScript ES modules, Supabase backend, and iframe-based widget architecture.

- **Tech Stack:** Vanilla JavaScript (ES modules), Supabase (auth + database), Vercel hosting
- **Platforms:** Desktop, Fire TV, Mobile (responsive)
- **Codebase Size:** ~39,000 lines across 118 JavaScript files

---

## Development Commands

### Local Development
```bash
# No build step required - pure ES modules
# Open index.html directly in browser or use a local server:
python -m http.server 8000

# Access at: http://localhost:8000
```

### Auth Bypass Mode (for UI development)
```bash
# Skip authentication entirely for UI work:
http://localhost:8000?bypass-auth
```

### Deployment
```bash
# Deploy staging to production
./deploy-to-prod.sh

# This script:
# 1. Ensures clean git state
# 2. Pulls latest from main
# 3. Pushes to production remote (dashieapp repo)
```

### Git Workflow
```bash
# Standard workflow
git add .
git commit -m "Your message"
git push origin main

# Production deployment is handled by deploy-to-prod.sh
```

---

## Architecture Overview

### Application Initialization Flow

**Entry Point:** `js/main.js` (DOMContentLoaded)

**3-Phase Initialization:**

1. **Platform Detection & Auth Check**
   - Detect platform (mobile/desktop/TV)
   - Check for auth bypass mode (`?bypass-auth`)
   - Restore stored JWT session or show login

2. **Authentication** (`core/initialization/auth-initializer.js`)
   - SessionManager coordinates OAuth flow
   - EdgeClient manages JWT tokens
   - Support for web OAuth and hybrid device flow (for Fire TV)

3. **Core Initialization** (`core/initialization/core-initializer.js`)
   - Initialize AppStateManager (global state)
   - Initialize data services (Calendar, Photos, Weather, Settings)
   - Apply theme from database
   - Initialize Dashboard module (creates widget iframes)
   - Initialize ActionRouter & WidgetMessenger
   - Register module input handlers

### Module System

All modules implement a standard interface:
```javascript
{
  initialize(options?)    // Setup phase
  activate()              // Show & enable input
  deactivate()            // Hide & disable input
  destroy()               // Cleanup
  getInputHandler()       // Returns handler for ActionRouter
}
```

**Key Modules:**
- **Dashboard** (`js/modules/Dashboard/`) - Main 2x3 widget grid with sidebar
- **Settings** (`js/modules/Settings/`) - Configuration interface (extends SettingsPageBase)
- **Modals** (`js/modules/Modals/`) - Modal stack management
- **Welcome** (`js/modules/Welcome/`) - Onboarding wizard

### Widget Architecture

**Design:** Iframe-based isolation with postMessage communication

**Widget Communication Protocol:**
```javascript
// Messages TO widgets:
{
  type: 'command|data|config',
  action: string,
  payload: {}
}

// Messages FROM widgets:
{
  type: 'widget-ready|widget-error|return-to-menu|event',
  widgetId?: string,
  payload?: {}
}
```

**Core Components:**
- **WidgetMessenger** (`js/core/widget-messenger.js`) - Singleton managing widget communication
- **WidgetDataManager** (`js/core/widget-data-manager.js`) - Data loading & refresh intervals

**Widget Locations:**
- `js/widgets/calendar/` - Calendar widget (main events display)
- `js/widgets/agenda/` - Agenda widget (list view)
- `js/widgets/photos/` - Photo carousel
- `js/widgets/clock/` - Time & weather display
- `js/widgets/header/` - App header

**Documentation:** See `js/widgets/WIDGETS_README.md` for widget development guide

### Data Layer

**Services** (`js/data/services/`):
- **CalendarService** - Calendar data & configuration
- **PhotoService** - Photo library management
- **SettingsService** - App configuration persistence
- **WeatherService** - Weather data for widgets
- **HeartbeatService** - Dashboard health tracking

**Authentication** (`js/data/auth/`):
- **SessionManager** - Main auth orchestrator
- **EdgeClient** - JWT lifecycle management
- **TokenStore** - Google token metadata
- **AuthCoordinator** - Platform-aware OAuth handling
- **Hybrid Device Flow** - See `js/data/auth/HYBRID_DEVICE_FLOW.md`

### State Management

**AppStateManager** (`js/core/app-state-manager.js`):
Runtime-only global state (no persistence):
```javascript
{
  currentModule: 'dashboard' | 'settings',
  focusContext: 'grid' | 'menu' | 'widget' | 'modal',
  activeWidget: 'calendar' | null,
  user: { isAuthenticated, userId, email },
  theme: 'light' | 'dark',
  platform: 'tv' | 'desktop' | 'mobile',
  isSleeping: boolean,
  isInitialized: boolean
}
```

**AppComms** (Event Bus):
Decoupled pub/sub for cross-module communication. Key events:
- `MODULE_CHANGED`, `THEME_CHANGED`, `CALENDAR_UPDATED`, `PHOTOS_UPDATED`
- `SETTINGS_LOADED`, `SETTINGS_CHANGED`, `WIDGET_READY`, `AUTH_USER_CHANGED`

**ActionRouter** (`js/core/action-router.js`):
Routes input actions to active module's input handler

---

## Code Organization

```
js/
├── core/              # Core application logic
│   ├── initialization/   # Startup sequence (auth, services, widgets)
│   ├── app-state-manager.js
│   ├── action-router.js
│   ├── widget-messenger.js
│   └── widget-data-manager.js
├── data/              # Data layer
│   ├── auth/            # Authentication (SessionManager, EdgeClient)
│   └── services/        # Data services (Calendar, Photos, Settings)
├── modules/           # Feature modules
│   ├── Dashboard/       # Main grid & sidebar
│   ├── Settings/        # Configuration UI (read SETTINGS_PAGE_BASE_GUIDE.md)
│   ├── Modals/          # Modal management
│   └── Welcome/         # Onboarding
├── widgets/           # Widget implementations (iframe-based)
│   ├── calendar/
│   ├── agenda/
│   ├── photos/
│   ├── clock/
│   ├── header/
│   └── shared/          # Shared widget utilities
├── ui/                # UI components
│   ├── themes/          # Theme system (read THEME_OVERLAY.md)
│   ├── theme-applier.js
│   └── toast.js
├── utils/             # Utilities
│   ├── logger.js        # Logging system
│   ├── platform-detector.js
│   └── console-commands.js
└── main.js            # Application entry point
```

---

## Important Development Guidelines

### Before Making Changes

**ALWAYS read relevant documentation first:**
- **Settings pages:** `js/modules/Settings/SETTINGS_PAGE_BASE_GUIDE.md`
- **Theme overlays:** `js/ui/themes/THEME_OVERLAY.md`
- **Auth flows:** `js/data/auth/HYBRID_DEVICE_FLOW.md`
- **Widgets:** `js/widgets/WIDGETS_README.md`
- **General principles:** `CONTRIBUTING.md`

### Key Architectural Patterns

1. **Settings Pages:** Extend `SettingsPageBase` and implement `handleItemClick()` for custom behavior. DO NOT add page-specific logic to `settings-modal-renderer.js` - the renderer delegates to the page.

2. **Theme Overlays:** The overlay engine (`theme-overlay-applier.js`) is generic. Theme-specific configurations (`theme-overlay-halloween.js`) define what to show. Keep them separate.

3. **Widget Communication:** Always use WidgetMessenger for broadcasting state. Never directly access iframe contentWindow.

4. **State Updates:** Use AppStateManager.setState() for global state changes. This triggers AppComms events and widget broadcasts automatically.

5. **Event-Driven:** Modules should communicate via AppComms events, not direct references.

### Naming Conventions

- **Classes:** PascalCase (`ThemeApplier`, `SettingsPageBase`)
- **Files:** kebab-case (`theme-applier.js`, `settings-page-base.js`)
- **Methods:** camelCase (`handleClick`, `applyTheme`)
- **Constants:** UPPER_SNAKE_CASE (`DEFAULT_THEME`, `API_BASE_URL`)

### Logging

Use the logger utility for all logging:
```javascript
import { createLogger } from '../utils/logger.js';
const logger = createLogger('MyModule');

logger.verbose('Detailed debug info');   // Development only
logger.debug('Debug information');        // Debugging
logger.info('Important state change');    // Normal operation
logger.success('Operation completed');    // Success feedback
logger.warn('Unexpected but handled');    // Warnings
logger.error('Failed operation', error);  // Errors
```

### Configuration

**Single source of truth:** `config.js`

Import default values from config.js - never hardcode defaults:
```javascript
import { DEFAULT_THEME, PLATFORMS, MODULES } from '../config.js';
```

---

## Testing Checklist

Before committing changes:
- [ ] Test with D-pad navigation (arrow keys)
- [ ] Test with enter/select button
- [ ] Test with mouse clicks
- [ ] Test with keyboard (arrow keys, enter, escape)
- [ ] Check console for errors/warnings
- [ ] Verify changes work across themes (light/dark)
- [ ] Test edge cases (empty states, errors)

**Settings Module Specific:**
- [ ] Test navigation flow (forward and back)
- [ ] Verify focus highlights correctly
- [ ] Test toggle switches work
- [ ] Confirm settings persist (check database)
- [ ] Test with reduced motion preference enabled

---

## Platform-Specific Behavior

| Aspect | Desktop/TV | Mobile |
|--------|-----------|--------|
| Widgets | Full 2x3 grid + iframes | None |
| Input | D-pad/arrow keys | Touch-based |
| Modules | All (Dashboard, Settings) | Settings only |
| UI | Full dashboard + sidebar | Landing page + modals |
| Auth | Standard OAuth | Device flow friendly |

**Mobile Initialization:**
- Shows landing page immediately
- Skips widget initialization
- Initializes Settings for modal access
- Touch controls enabled

---

## Common Anti-Patterns (Avoid These)

❌ **Hard-coding page-specific logic in renderers/orchestrators**
- Violates separation of concerns
- Use delegation to page classes instead

❌ **Creating special cases in input handlers**
- Makes the codebase inconsistent
- Use base class methods instead

❌ **Modifying core systems without reading guides**
- High risk of breaking existing functionality
- Always read documentation first

❌ **Bypassing WidgetMessenger for widget communication**
- Breaks state deduplication
- Always use WidgetMessenger.broadcast()

❌ **Hard-coding default values**
- Import from config.js instead
- Maintains single source of truth

---

## Deployment & Hosting

**Hosting:** Vercel (SPA with client-side routing)

**Configuration:** `vercel.json`
- OAuth callback rewrite: `/oauth2/idpresponse` → `/index.html`
- Security headers (X-Frame-Options, X-Content-Type-Options)

**Deployment Process:**
1. Staging repo: `dashieapp_staging` (main branch) - this repo
2. Production repo: `dashieapp` (main branch)
3. Run `./deploy-to-prod.sh` to push staging to production

**No Build Step:**
- Pure ES modules (type="module")
- Browser-native module loading
- Dynamic imports for code splitting

---

## Database Schema (Supabase)

**Tables:**
- `user_settings` - User configuration (theme, interface, calendar, photos)
- `user_photos` - Photo library entries
- `dashboard_heartbeats` - Health tracking

**Authentication:**
- JWT stored in localStorage (`dashie-supabase-jwt`)
- Session restoration on page load
- Token refresh handled by EdgeClient

---

## Key Architecture Decisions

1. **Iframe Isolation** - Widgets in iframes for sandbox + independent updates
2. **Event-Driven** - AppComms decouples modules; AppState drives UI
3. **Service Layer** - Data operations isolated in services
4. **No Build Step** - Pure ES modules for simplicity and dev speed
5. **Single-Page App** - Vercel rewrites handle client-side routing
6. **Session-Based Auth** - JWT in localStorage with Supabase backend
7. **State Deduplication** - WidgetMessenger avoids redundant broadcasts
8. **Module Registration** - ActionRouter doesn't hardcode dependencies

---

## Finding Documentation

**In-Code Documentation:**
- Most modules have JSDoc comments
- Look for `@param`, `@returns`, `@example` tags

**Architecture Documentation:**
- Check for `.md` files in module directories
- Look in module parent directories
- Check for `GUIDE`, `README`, or `ARCHITECTURE` files

**When Documentation is Missing:**
- Look at existing implementations of similar features
- Check git history: `git log --all -- path/to/file`
- Add documentation after implementing

---

## Development Tips

1. **Use Auth Bypass for UI Work:**
   ```
   http://localhost:8000?bypass-auth
   ```
   Skips authentication entirely - useful for theme/UI development

2. **Console Commands:**
   Available debugging commands (check `js/utils/console-commands.js`)

3. **Platform Testing:**
   - Desktop: Default browser
   - TV: Fire TV simulator or actual device
   - Mobile: Responsive mode or actual device

4. **Widget Development:**
   - Must import theme CSS: `/css/core/variables.css` and `/css/core/themes.css`
   - Use shared utilities: `/js/widgets/shared/widget-theme-detector.js`
   - Send 'widget-ready' message after initialization
   - Implement handleCommand() for D-pad navigation

5. **State Debugging:**
   ```javascript
   // Access in console:
   window.appStateManager.getState()
   window.sessionManager
   ```

---

## Critical References

Before modifying these systems, read the documentation:

- **Settings System:** `js/modules/Settings/SETTINGS_PAGE_BASE_GUIDE.md`
- **Theme Overlays:** `js/ui/themes/THEME_OVERLAY.md`
- **Widget Development:** `js/widgets/WIDGETS_README.md`
- **Authentication:** `js/data/auth/HYBRID_DEVICE_FLOW.md`
- **Contributing Guide:** `CONTRIBUTING.md`

---

## Repository Structure

- **Staging Repo:** `dashieapp_staging` (this repo)
- **Production Repo:** `dashieapp`
- **Main Branch:** `main` (used for both staging and production)
- **Deployment:** Via `deploy-to-prod.sh` script
