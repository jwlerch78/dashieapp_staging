# Dashie Initialization System

**Location:** `js/core/initialization/`
**Entry Point:** `js/main.js`

---

## Overview

Dashie uses a **3-phase initialization system** that handles platform detection, authentication, and core component setup. The system is designed to support multiple platforms (Desktop, Fire TV, Mobile) with different initialization paths.

### Key Design Principles

1. **Platform-First** - Detect platform before loading any modules
2. **Auth-Aware** - Different auth flows for different platforms
3. **Progressive** - Load only what's needed for each platform
4. **Resilient** - Graceful fallbacks and bypass modes

---

## Initialization Flow

```
DOMContentLoaded
     ↓
┌────────────────────────────────────────┐
│ Phase 1: Platform & Auth Detection    │
│ (js/main.js)                           │
├────────────────────────────────────────┤
│ 1. Detect platform (mobile/desktop/TV)│
│ 2. Check for ?bypass-auth parameter   │
│ 3. Check for stored JWT session        │
│ 4. Show appropriate UI                 │
└────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────┐
│ Phase 2: Authentication               │
│ (auth-initializer.js)                  │
├────────────────────────────────────────┤
│ 1. Initialize SessionManager           │
│ 2. Initialize EdgeClient               │
│ 3. Check session validity              │
│ 4. Run OAuth flow if needed            │
│   - Web OAuth (Desktop)                │
│   - Device Flow (Fire TV)              │
│   - Hybrid Flow (Phone + TV)           │
└────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────┐
│ Phase 3: Core Initialization          │
│ (core-initializer.js)                  │
├────────────────────────────────────────┤
│ 1. Initialize AppStateManager          │
│ 2. Initialize Services                 │
│ 3. Load User Settings                  │
│ 4. Initialize Dashboard (if not mobile)│
│ 5. Initialize Widgets                  │
│ 6. Apply Theme Overlays                │
│ 7. Wait for Critical Widgets           │
│ 8. Check for Welcome Wizard            │
│ 9. Hide Login Screen                   │
│10. Initialize Cross-Dashboard Sync     │
└────────────────────────────────────────┘
     ↓
Application Ready ✅
```

---

## Phase 1: Platform Detection & Auth Check

**File:** `js/main.js`

### What It Does

1. **Detects Platform:**
   ```javascript
   const platformDetector = getPlatformDetector();
   const isMobile = platformDetector.isMobile();
   ```
   - Checks user agent for mobile/tablet patterns
   - Falls back to viewport width (≤ 768px)
   - Sets platform flag for rest of initialization

2. **Checks Auth Bypass:**
   ```javascript
   const bypassAuth = isAuthBypassEnabled();
   // Checks for ?bypass-auth parameter in URL
   ```
   - Developer mode for UI/theme work
   - Skips authentication entirely
   - Loads dashboard without data

3. **Checks Stored Session:**
   ```javascript
   const hasStoredSession = checkForStoredSession();
   ```
   - Looks for `dashie-supabase-jwt` in localStorage
   - Validates JWT expiry
   - Returns true if valid session exists

4. **Shows Appropriate UI:**
   ```javascript
   if (isMobile) {
     showMobileLandingPage();
     showMobileLoadingBar();
   }
   ```

### Platform-Specific Paths

**Desktop/TV:**
- Shows login screen
- Waits for auth
- Loads full dashboard with widgets

**Mobile:**
- Shows mobile landing page immediately
- Shows loading progress bar
- Skips widget initialization
- Only loads Settings module (modal-only)

---

## Phase 2: Authentication

**File:** `js/core/initialization/auth-initializer.js`

### What It Does

1. **Initializes Auth System:**
   ```javascript
   import { sessionManager } from '../data/auth/orchestration/session-manager.js';
   await sessionManager.initialize();
   ```

2. **Checks Existing Session:**
   - Validates stored JWT
   - Checks expiry (refreshes if needed)
   - Loads user profile

3. **Runs OAuth Flow (if needed):**
   - **Web OAuth** - Desktop browsers
   - **Device Flow** - Fire TV (QR code)
   - **Hybrid Flow** - Phone + TV simultaneous

### Auth Bypass Mode

When `?bypass-auth` is present:
```javascript
await initializeCore({ bypassAuth: true, isMobile });
```
- Skips auth entirely
- No SessionManager or EdgeClient
- Dashboard loads empty (no data)
- Settings don't save to database

**Use Cases:**
- Theme development
- CSS/layout work
- UI component testing

---

## Phase 3: Core Initialization

**File:** `js/core/initialization/core-initializer.js`

### Step-by-Step Breakdown

#### 1. Initialize AppStateManager
```javascript
AppStateManager.setState({
  platform: platformDetector.platform,
  theme: themeApplier.getCurrentTheme(),
  user: { isAuthenticated: !bypassAuth }
});
```

#### 2. Initialize Services
```javascript
import { initializeServices } from './service-initializer.js';
await initializeServices();
```

Services initialized:
- CalendarService
- PhotoService
- SettingsService
- WeatherService
- HeartbeatService
- DashboardSyncService

#### 3. Load User Settings
```javascript
await settingsService.loadSettings();
const theme = settingsService.get('interface.theme', 'dark');
themeApplier.applyTheme(theme);
```

#### 4. Initialize Dashboard (Desktop/TV Only)
```javascript
if (!isMobile) {
  await dashboard.initialize();
  // Creates widget iframes
  // Sets up postMessage listeners
}
```

**Mobile skips this** - No dashboard grid on mobile

#### 5. Initialize Widgets
```javascript
await initializeWidgets(widgetMessenger);
```
- Waits for iframes to load
- Registers widgets with messenger
- Sends initial configuration
- Sends initial data

#### 6. Apply Theme Overlays
```javascript
themeApplier.applyTheme(currentTheme);
```
- Re-applies theme to dashboard
- Injects overlays into widget iframes
- Initializes animations (if enabled)

#### 7. Wait for Critical Widgets
```javascript
await waitForWidgetsToLoad(['calendar', 'agenda', 'photos'], 10000);
```
- Waits for `widget-ready` messages
- 10 second timeout
- Prevents showing empty dashboard

#### 8. Check for Welcome Wizard
```javascript
const familyName = settingsService.get('family.name');
if (!familyName) {
  await welcome.initialize();
  welcome.activate();
}
```

#### 9. Hide Login Screen
```javascript
const loginScreen = document.getElementById('oauth-login-screen');
loginScreen.classList.add('hidden');
```

#### 10. Initialize Cross-Dashboard Sync
```javascript
await dashboardSyncService.initialize();
```
- Subscribes to Supabase broadcast channel
- Starts heartbeat service (60s interval)
- Enables cross-window state sync

---

## Mobile-Specific Initialization

### What's Different on Mobile

**Skipped:**
- Dashboard module initialization
- Widget initialization
- Widget data loading
- Critical widget wait

**Included:**
- Mobile landing page
- Mobile loading progress (10% increments)
- Settings module (modal-only access)
- Authentication
- Services (Calendar, Photos, etc.)

### Mobile Loading Progress

```javascript
updateMobileProgress(10);  // Platform detected
// ...
updateMobileProgress(50);  // Services loaded
// ...
updateMobileProgress(100); // Initialization complete
```

Visual feedback during initialization:
- Shows family name
- Shows profile picture
- Shows progress bar
- Shows status message

---

## Auth Bypass Mode

### When to Use

✅ **Good for:**
- Theme development
- CSS/layout work
- Widget UI testing
- Component styling

❌ **Don't use for:**
- Testing settings (they won't save)
- Testing data flows
- Testing authentication
- Testing API integrations

### How It Works

**URL:**
```
http://localhost:8000?bypass-auth
```

**What happens:**
1. Skips Phase 2 (authentication)
2. `bypassAuth: true` flag passed to core initializer
3. Services don't initialize (no API calls)
4. Dashboard loads with empty widgets
5. Settings stay in localStorage (don't sync to DB)

**Console logs:**
```
⚠️ AUTH BYPASS ACTIVE - Developer Mode
Dashboard will load without authentication or data
To disable: Remove ?bypass-auth from URL
```

---

## Configuration

### Loading Messages

Update loading screen during initialization:
```javascript
updateLoadingMessage('Loading calendar...', 40);
// Shows message + sets mobile progress to 40%
```

### Critical Widgets

Configure which widgets to wait for:
```javascript
const criticalWidgets = ['calendar', 'agenda', 'photos'];
await waitForWidgetsToLoad(criticalWidgets, 10000);
```

### Timeout Settings

```javascript
// Widget load timeout (default: 10 seconds)
const WIDGET_LOAD_TIMEOUT = 10000;

// JWT validation timeout
const JWT_VALIDATION_TIMEOUT = 5000;
```

---

## Error Handling

### Common Initialization Errors

**1. Widget Load Timeout**
```javascript
// After 10 seconds, continues anyway
logger.warn('Widget load timeout - continuing anyway');
```
Dashboard shows even if some widgets aren't ready.

**2. Auth Failure**
```javascript
// Falls back to login screen
loginScreen.classList.remove('hidden');
```
User sees login prompt if auth fails.

**3. Service Init Failure**
```javascript
// Services fail gracefully
logger.error('Service initialization failed', error);
// Dashboard still loads with degraded functionality
```

**4. Mobile UI Not Found**
```javascript
// Falls back to desktop UI
if (!mobileLandingPage) {
  logger.warn('Mobile UI not found, showing desktop');
}
```

---

## Debugging Initialization

### Console Logs

Enable verbose logging:
```javascript
// In logger-config.js
logLevels: {
  Main: 'debug',
  CoreInitializer: 'debug',
  AuthInitializer: 'debug'
}
```

### Key Log Messages

**Phase 1:**
```
🚀 Starting Dashie Dashboard...
Platform detected: { platform: 'desktop', isMobile: false }
```

**Phase 2 (Auth Bypass):**
```
⚠️ AUTH BYPASS ACTIVE - Developer Mode
```

**Phase 2 (Normal):**
```
Initializing authentication...
Session validated: { userId: '...', email: '...' }
```

**Phase 3:**
```
Loading dashboard...
Initializing services...
All critical widgets loaded
✅ Dashboard ready
```

### Console Commands

```javascript
// Check app state
getAppState()

// Check auth status
getAuthStatus()

// Check widget status
window.widgetMessenger.getState()
```

---

## Module Integration

### Adding New Initialization Steps

**1. Add to core-initializer.js:**
```javascript
export async function initializeCore({ bypassAuth, isMobile }) {
  // ... existing code

  // YOUR NEW STEP
  updateLoadingMessage('Loading my feature...', 75);
  await myFeature.initialize();

  // ... rest of initialization
}
```

**2. Update mobile progress:**
```javascript
if (isMobile) {
  updateMobileProgress(75); // Match loading message
}
```

**3. Add error handling:**
```javascript
try {
  await myFeature.initialize();
} catch (error) {
  logger.error('My feature init failed', error);
  // Continue anyway or show error
}
```

---

## File Structure

```
js/
├── main.js                              # Entry point (Phase 1)
└── core/
    └── initialization/
        ├── README.md                     # This file
        ├── core-initializer.js          # Phase 3 orchestrator
        ├── auth-initializer.js          # Phase 2 auth setup
        ├── service-initializer.js       # Service initialization
        └── widget-initializer.js        # Widget setup
```

---

## Best Practices

### DO:
✅ Keep initialization phases separate
✅ Use loading messages to show progress
✅ Handle errors gracefully (continue if possible)
✅ Support auth bypass for development
✅ Respect platform differences (mobile vs desktop)

### DON'T:
❌ Load modules synchronously (use async/await)
❌ Block on non-critical initialization
❌ Assume all widgets will load successfully
❌ Skip error handling
❌ Hard-code initialization order

---

## Related Documentation

- [HYBRID_DEVICE_FLOW.md](../../data/auth/HYBRID_DEVICE_FLOW.md) - Authentication flows
- [MOBILE_UI.md](../../ui/MOBILE_UI.md) - Mobile initialization details
- [WIDGET_COMMUNICATION.md](../WIDGET_COMMUNICATION.md) - Widget initialization
- [DASHBOARD_SYNC.md](../../data/services/DASHBOARD_SYNC.md) - Cross-dashboard sync
- [ARCHITECTURE.md](../../../.reference/ARCHITECTURE.md) - System architecture

---

## Troubleshooting

### Dashboard Won't Load

**Check:**
1. Console for JavaScript errors
2. Network tab for failed API calls
3. localStorage for `dashie-supabase-jwt`
4. Widget load timeout (increase if needed)

### Auth Bypass Not Working

**Check:**
1. URL has `?bypass-auth` parameter
2. Console shows bypass warning
3. No other query parameters breaking it

### Mobile UI Not Showing

**Check:**
1. Platform detection (user agent)
2. Viewport width (should be ≤ 768px)
3. Mobile UI elements exist in HTML

### Widgets Not Loading

**Check:**
1. Iframe src attributes are correct
2. Widget-ready messages being sent
3. Critical widget timeout (default 10s)
4. Console for widget errors

---

## Summary

The initialization system is a **3-phase, platform-aware bootstrap process** that:

1. **Detects platform** and chooses appropriate UI path
2. **Handles authentication** with multiple OAuth flows
3. **Initializes core systems** in the right order

Key features:
- Auth bypass mode for development
- Mobile-specific initialization path
- Graceful error handling
- Progressive loading with visual feedback
- Cross-dashboard synchronization

The system is designed to be resilient, supporting multiple platforms with different capabilities while maintaining a consistent initialization flow.
