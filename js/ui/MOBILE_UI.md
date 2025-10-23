# Mobile UI System

**Location:** `js/ui/mobile-ui.js`
**CSS:** `css/components/mobile-landing.css`
**HTML:** `index.html` (mobile-container section)

---

## Overview

The mobile UI system provides a separate, touch-optimized interface for phones and tablets. Mobile devices skip the dashboard grid and show a dedicated landing page with Settings access.

### Key Differences from Desktop

| Feature | Desktop/TV | Mobile |
|---------|-----------|--------|
| Dashboard Grid | ✅ 2x3 widget grid | ❌ No widgets |
| Widgets | ✅ Calendar, Photos, etc. | ❌ None |
| Settings | ✅ Module in Dashboard | ✅ Modal-only |
| Input | D-pad/keyboard | Touch only |
| Loading | Login screen | Progress bar |
| Focus styles | ✅ D-pad highlighting | ❌ Disabled (touch) |

---

## Mobile Detection

Mobile is detected in `js/main.js`:

```javascript
const platformDetector = getPlatformDetector();
const isMobile = platformDetector.isMobile();
```

**Detection Logic:**
1. User agent patterns: `/Android|iPhone|iPad|iPod|Mobile|Tablet/`
2. OR viewport width ≤ 768px

**Result:**
- Desktop/TV: Shows dashboard grid with widgets
- Mobile: Shows mobile landing page (Settings-only)

---

## Mobile Landing Page

### HTML Structure

**Complete markup from `index.html`:**

```html
<div id="mobile-container" class="mobile-mode" style="display: none;">
  <!-- Header with family name and profile picture -->
  <div class="mobile-header">
    <span class="family-name"></span>
    <img class="profile-pic" src="" alt="Profile" style="display: none;">
  </div>

  <!-- Main content area -->
  <div class="mobile-content">
    <!-- Dashie Logo -->
    <img class="dashie-logo" src="/artwork/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie">

    <!-- Loading Bar (shown during initialization) -->
    <div id="mobile-loading-bar" class="mobile-loading-bar">
      <div class="mobile-progress-container">
        <div class="mobile-progress-bar">
          <div id="mobile-progress-fill" class="mobile-progress-fill"></div>
        </div>
        <p id="mobile-progress-text" class="mobile-progress-text"></p>
      </div>
    </div>

    <!-- Settings Button (disabled until initialization complete) -->
    <button id="mobile-settings-btn" class="orange-button" disabled>Settings</button>

    <!-- Logout Button -->
    <button id="mobile-logout-btn" class="secondary-button" disabled>Logout</button>
  </div>
</div>
```

### Visual Layout

```
┌─────────────────────────────────┐
│  The Smith Family       [pic]   │  ← Header
├─────────────────────────────────┤
│                                 │
│        [Dashie Logo]            │  ← 15vh from top
│                                 │
│      ════════ 50%               │  ← Loading bar
│      "Loading services..."      │
│                                 │
│                                 │
│                                 │
│      ┌───────────────┐          │
│      │   Settings    │          │  ← 66vh from top
│      └───────────────┘          │
│      ┌───────────────┐          │
│      │    Logout     │          │  ← Below Settings
│      └───────────────┘          │
│                                 │
└─────────────────────────────────┘
```

**Responsive positioning:**
- Logo: `margin-top: 15vh` (adapts to viewport height)
- Settings button: `top: 66vh` (2/3 down the screen)
- Loading bar: Between logo and button
- All elements use viewport units for responsive sizing

---

## Mobile-Specific CSS

### Body Class

When mobile mode is active, the body gets a class:

```css
body.mobile-mode-active {
  /* Applied by showMobileLandingPage() */
}
```

**Effects:**
- Hides dashboard container (`#dashboard-container`)
- Disables focus styles (no D-pad highlighting needed)
- Shows mobile container

### Container Styling

```css
#mobile-container {
  display: none;              /* Hidden by default */
  position: fixed;            /* Fullscreen overlay */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #FCFCFF;        /* Light theme */
  flex-direction: column;
  z-index: 100;               /* Above dashboard, below modals */
}

#mobile-container.mobile-mode {
  display: flex;              /* Show when active */
}

/* Dark theme support */
body.theme-dark #mobile-container {
  background: #1c1c1e;
}
```

### Header Styling

```css
.mobile-header {
  background: transparent;
  padding: 12px 16px;
  display: flex;
  justify-content: flex-end;   /* Right-aligned */
  align-items: center;
  gap: 12px;
  min-height: 60px;
}

.mobile-header .family-name {
  font-size: 17px;
  font-weight: 600;
  color: #9e9e9e;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.mobile-header .profile-pic {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid #FFFFFF;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
```

### Logo Styling

```css
#mobile-container .dashie-logo {
  width: min(250px, 70vw);     /* Responsive: max 250px or 70% of viewport */
  height: auto;
  margin-top: 15vh;
  /* Force orange logo on mobile */
  content: url('/artwork/Dashie_Full_Logo_Orange_Transparent.png') !important;
}
```

**Note:** Logo is always orange on mobile (overrides theme changes).

### Button Styling

**Settings button (orange gradient):**
```css
.orange-button {
  background: linear-gradient(135deg, #EE9828 0%, #F5A942 100%);
  color: #FFFFFF;
  border: none;
  border-radius: 12px;
  padding: 16px 48px;
  font-size: 18px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(238, 152, 40, 0.3);
  position: absolute;
  top: 66vh;                   /* 2/3 down the screen */
  left: 50%;
  transform: translateX(-50%); /* Center horizontally */
  width: 200px;
}

.orange-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**Logout button (secondary):**
```css
.secondary-button {
  background: transparent;
  color: #999999;
  border: 1px solid #333333;
  border-radius: 12px;
  padding: 12px 36px;
  font-size: 16px;
  position: absolute;
  top: calc(66vh + 70px);      /* Below Settings button */
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
}
```

### Loading Bar Styling

```css
.mobile-loading-bar {
  width: 100%;
  max-width: 300px;
  position: absolute;
  top: calc(15vh + min(250px, 70vw) + 40px);  /* Below logo */
  left: 50%;
  transform: translateX(-50%);
  opacity: 0;                  /* Hidden by default */
  transition: opacity 0.3s ease;
}

.mobile-loading-bar.active {
  opacity: 1;                  /* Shown when active */
}

.mobile-progress-bar {
  width: 100%;
  height: 6px;
  background: #e9ecef;
  border-radius: 3px;
  overflow: hidden;
}

.mobile-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #EE9828 0%, #F5A942 100%);
  width: 0%;                   /* Animated from 0% to 100% */
  transition: width 0.3s ease-out;
}

.mobile-progress-text {
  font-size: 14px;
  color: #616161;
  text-align: center;
  margin-top: 0.5rem;
  min-height: 1.2em;
}
```

### Responsive Breakpoints

**Small phones (height < 670px):**
```css
@media (max-height: 670px) {
  #mobile-container .dashie-logo {
    width: min(200px, 60vw);
    margin-top: 10vh;
  }

  .orange-button {
    top: 63vh;
    font-size: 17px;
    width: 180px;
  }
}
```

**Very small phones (height < 568px):**
```css
@media (max-height: 568px) {
  #mobile-container .dashie-logo {
    width: min(160px, 50vw);
    margin-top: 8vh;
  }

  .orange-button {
    top: 60vh;
    font-size: 16px;
    width: 160px;
  }
}
```

**Tall phones (height > 844px):**
```css
@media (min-height: 844px) {
  #mobile-container .dashie-logo {
    width: min(280px, 75vw);
    margin-top: 18vh;
  }

  .orange-button {
    font-size: 19px;
    width: 220px;
  }
}
```

**Landscape orientation:**
```css
@media (orientation: landscape) and (max-height: 500px) {
  #mobile-container .dashie-logo {
    width: min(140px, 40vw);
    margin-top: 5vh;
  }

  .orange-button {
    top: 55vh;
  }
}
```

### Focus Styles (Disabled)

On mobile, D-pad focus highlighting is disabled:

```css
body.mobile-mode-active *:focus,
body.mobile-mode-active *:focus-visible {
  outline: none !important;
  box-shadow: none !important;
  border-color: inherit !important;
}
```

**Reason:** Touchscreen devices don't need keyboard focus styles.

---

## Profile Picture & Family Name

### Loading Family Name

**Priority:**
1. SettingsStore (in-memory)
2. localStorage fallback
3. Default: "Dashie"

**Code:**
```javascript
export async function initializeMobileUI() {
  let familyName = 'Dashie'; // Default

  try {
    // Try SettingsStore first
    if (window.settingsStore) {
      familyName = window.settingsStore.get('family.familyName') || 'Dashie';
    } else {
      // Fallback to localStorage
      const savedSettings = localStorage.getItem('dashie-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        familyName = settings?.family?.familyName || 'Dashie';
      }
    }
  } catch (error) {
    logger.warn('Could not get family name from settings', error);
  }

  updateMobileFamilyName(familyName);
}
```

**Formatting:**
```javascript
function formatFamilyName(baseName) {
  if (!baseName || baseName === 'Dashie') {
    return 'The Dashie Family';
  }

  // Remove any existing "The " or " Family"
  let cleanName = baseName.trim();
  if (cleanName.startsWith('The ')) {
    cleanName = cleanName.substring(4);
  }
  if (cleanName.endsWith(' Family')) {
    cleanName = cleanName.substring(0, cleanName.length - 7);
  }

  // Format to "The [Name] Family"
  return `The ${cleanName.trim()} Family`;
}
```

**Examples:**
- `"Smith"` → `"The Smith Family"`
- `"The Johnson"` → `"The Johnson Family"`
- `"Lee Family"` → `"The Lee Family"`
- `"Dashie"` → `"The Dashie Family"`

### Loading Profile Picture

**Source:** User's Google profile picture from SessionManager

```javascript
try {
  if (window.sessionManager) {
    const user = window.sessionManager.getUser();

    if (user?.picture) {
      updateMobileProfilePicture(user.picture);
    }
  }
} catch (error) {
  logger.warn('Could not get profile picture', error);
}
```

**Update function:**
```javascript
export function updateMobileProfilePicture(photoURL) {
  const profilePic = document.querySelector('.mobile-header .profile-pic');
  if (profilePic && photoURL) {
    profilePic.src = photoURL;
    profilePic.style.display = 'block';  // Show (hidden by default)
  }
}
```

**Fallback:** If no profile picture, element stays hidden (`display: none`).

---

## Button Handlers

### Settings Button

**Setup:**
```javascript
export function setupMobileSettings() {
  const settingsBtn = document.getElementById('mobile-settings-btn');

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      logger.info('Mobile Settings button clicked');

      // Open Settings module
      if (window.Settings) {
        window.Settings.activate();  // Opens Settings modal
      } else {
        logger.error('Settings module not available');
      }
    });
  }
}
```

**Button States:**
- **Disabled** (`disabled` attribute): During initialization
- **Enabled**: After `hideMobileLoadingBar()` is called

**Flow:**
1. User taps Settings button
2. `window.Settings.activate()` is called
3. Settings modal opens (full-screen on mobile)
4. User can navigate settings pages
5. User closes modal to return to landing page

### Logout Button

**Setup:**
```javascript
export function setupMobileLogout() {
  const logoutBtn = document.getElementById('mobile-logout-btn');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      // Confirm logout
      const confirmed = confirm('Are you sure you want to log out?');
      if (!confirmed) return;

      try {
        if (window.sessionManager) {
          await window.sessionManager.signOut();
          // Reload page to return to login screen
          window.location.reload();
        }
      } catch (error) {
        logger.error('Failed to log out', error);
        alert('Failed to log out. Please try again.');
      }
    });
  }
}
```

**Button States:**
- **Disabled** (`disabled` attribute): During initialization
- **Enabled**: After `initializeMobileUI()` completes

**Flow:**
1. User taps Logout button
2. Browser confirm dialog: "Are you sure you want to log out?"
3. If confirmed:
   - SessionManager signs out user
   - Clears JWT from localStorage
   - Reloads page → Returns to login screen

---

## Loading Progress

### Progress Tracking

**During 3-phase initialization:**

```javascript
// Phase 1: Platform Detection
updateMobileProgress(10, 'Platform detected');

// Phase 2: Authentication
updateMobileProgress(30, 'Authenticating...');

// Phase 3: Core Initialization
updateMobileProgress(50, 'Loading services...');
updateMobileProgress(70, 'Loading settings...');
updateMobileProgress(90, 'Initializing mobile UI...');
updateMobileProgress(100, 'Ready!');
```

**Visual Feedback:**
- Progress bar fills from 0% to 100%
- Status message updates below bar
- Settings/Logout buttons stay disabled until 100%

### Progress API

```javascript
export function updateMobileProgress(progress, message) {
  const progressFill = document.getElementById('mobile-progress-fill');
  const progressText = document.getElementById('mobile-progress-text');

  if (progressFill) {
    progressFill.style.width = `${progress}%`;  // Animate width
  }

  if (progressText && message) {
    progressText.textContent = message;  // Update status text
  }
}
```

**Parameters:**
- `progress` (number): 0-100
- `message` (string): Status message

**Example:**
```javascript
updateMobileProgress(75, 'Almost there...');
```

---

## Integration with Initialization

### Mobile Initialization Flow

**Complete flow from `js/main.js` and `js/core/initialization/core-initializer.js`:**

```javascript
// 1. Detect mobile platform (main.js)
const isMobile = platformDetector.isMobile();

if (isMobile) {
  // 2. Show mobile landing page immediately
  showMobileLandingPage();

  // 3. Show loading bar
  showMobileLoadingBar();
  updateMobileProgress(10, 'Platform detected');
}

// 4. Phase 2: Authentication
updateMobileProgress(30, 'Authenticating...');
await initializeAuth({ isMobile });

// 5. Phase 3: Core Initialization
updateMobileProgress(50, 'Loading services...');
await initializeServices();

updateMobileProgress(70, 'Loading settings...');
await settingsService.loadSettings();

// 6. Initialize Settings module (modal-only on mobile)
if (isMobile) {
  await Settings.initialize({ mobileMode: true });
  updateMobileProgress(90, 'Initializing mobile UI...');
}

// 7. Complete initialization
if (isMobile) {
  await initializeMobileUI();  // Load family name, profile pic, wire buttons
  updateMobileProgress(100, 'Ready!');

  // 8. Hide loading bar and enable buttons
  hideMobileLoadingBar();

  // Settings and Logout buttons are now enabled
}
```

**Key Differences from Desktop:**
- Widget initialization skipped
- Dashboard module not initialized
- Settings module initialized in modal-only mode
- Visual progress feedback via loading bar

---

## API Functions

### Core Functions

```javascript
import {
  showMobileLandingPage,
  hideMobileLandingPage,
  showMobileLoadingBar,
  hideMobileLoadingBar,
  updateMobileProgress,
  updateMobileFamilyName,
  updateMobileProfilePicture,
  setupMobileSettings,
  setupMobileLogout,
  initializeMobileUI
} from './ui/mobile-ui.js';
```

**showMobileLandingPage()**
- Shows mobile container
- Hides dashboard container
- Adds `mobile-mode-active` body class

**hideMobileLandingPage()**
- Hides mobile container
- Shows dashboard container
- Removes `mobile-mode-active` body class

**showMobileLoadingBar()**
- Adds `active` class to loading bar
- Makes loading bar visible (opacity transition)

**hideMobileLoadingBar()**
- Removes `active` class from loading bar
- Enables Settings button

**updateMobileProgress(progress, message)**
- Updates progress bar width (0-100%)
- Updates status message text

**updateMobileFamilyName(familyName)**
- Updates header family name
- Formats as "The [Name] Family"

**updateMobileProfilePicture(photoURL)**
- Sets profile picture src
- Shows profile picture (display: block)

**setupMobileSettings()**
- Wires Settings button click handler
- Opens Settings modal on click

**setupMobileLogout()**
- Wires Logout button click handler
- Signs out user and reloads page

**initializeMobileUI()**
- Loads family name from settings
- Loads profile picture from session
- Calls `setupMobileSettings()` and `setupMobileLogout()`
- Enables Logout button

---

## Error Handling

### Mobile Container Not Found

**Fallback to desktop UI:**

```javascript
export function showMobileLandingPage() {
  const mobileContainer = document.getElementById('mobile-container');

  if (!mobileContainer) {
    logger.error('Mobile container element not found');
    // Falls through - desktop UI will show instead
    return;
  }

  // ... show mobile UI
}
```

**Result:** If mobile container is missing from HTML, desktop UI shows as fallback.

### Settings Module Not Available

**Log error but don't crash:**

```javascript
settingsBtn.addEventListener('click', () => {
  if (window.Settings) {
    window.Settings.activate();
  } else {
    logger.error('Settings module not available on window object');
    // User sees no response - button doesn't work
    // TODO: Show error toast to user
  }
});
```

### SessionManager Not Available

**Graceful fallback:**

```javascript
if (window.sessionManager) {
  await window.sessionManager.signOut();
  window.location.reload();
} else {
  logger.error('SessionManager not available');
  alert('Failed to log out. Please try again.');
}
```

---

## Testing Mobile UI

### Desktop Browser Testing

**1. Resize browser window:**
- Width ≤ 768px triggers mobile detection
- Reload page to re-run platform detection

**2. Use responsive mode:**
- Chrome DevTools: Toggle device toolbar (Cmd+Shift+M)
- Select mobile device (iPhone, Pixel, etc.)
- Reload page

**3. Test touch events:**
- Chrome DevTools: Emulate touch events
- Verify button taps work

### Actual Mobile Device Testing

**1. Network access:**
- Run local server: `python -m http.server 8000`
- Get local IP: `ifconfig` (Mac/Linux) or `ipconfig` (Windows)
- Access from phone: `http://192.168.x.x:8000`

**2. HTTPS requirement:**
- OAuth callbacks require HTTPS
- Use ngrok for HTTPS tunnel: `ngrok http 8000`
- Access from phone: `https://abc123.ngrok.io`

**3. Test on multiple devices:**
- iPhone SE (small screen)
- iPhone 14 Pro Max (tall screen)
- iPad (tablet, may show desktop UI)
- Android phones (various sizes)

**4. Test orientations:**
- Portrait (normal)
- Landscape (compressed spacing)

---

## Viewport Meta Tag Requirements

**In `<head>` of `index.html`:**

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

**Parameters:**
- `width=device-width` - Use device width (not zoomed)
- `initial-scale=1.0` - No initial zoom
- `maximum-scale=1.0` - Disable zoom
- `user-scalable=no` - Disable pinch-to-zoom

**Reason:** Prevents accidental zooming on touch gestures.

---

## Migration Notes

### How Mobile UI Evolved

**Phase 1 (Early Development):**
- Desktop-only dashboard
- No mobile support

**Phase 2 (Mobile Detection):**
- Added platform detector
- Redirect mobile users to "Use desktop" message

**Phase 3 (Mobile Landing Page):**
- Created dedicated mobile UI
- Settings-only access (no widgets)
- Touch-optimized buttons

**Phase 4 (Current):**
- Full responsive design
- Loading progress feedback
- Profile picture integration
- Theme support (dark mode)

### Why Widgets Were Skipped

**Reasons:**
1. **Screen Size** - Widget grid too small on phones
2. **Touch Complexity** - Widgets designed for D-pad navigation
3. **Performance** - Loading 6 iframes on mobile is heavy
4. **User Need** - Mobile users primarily want Settings access

**Future Enhancements:**
- Potential mobile dashboard (single widget view)
- Swipeable widget carousel
- Native mobile app (React Native)

---

## Best Practices

### DO:

✅ **Always show loading progress on mobile**
```javascript
showMobileLoadingBar();
updateMobileProgress(10, 'Starting...');
// ... initialization steps
updateMobileProgress(100, 'Ready!');
hideMobileLoadingBar();
```

✅ **Disable buttons until initialization complete**
```html
<button id="mobile-settings-btn" disabled>Settings</button>
```

✅ **Use touch-friendly button sizes**
```css
.orange-button {
  padding: 16px 48px;  /* Min 44px touch target */
  font-size: 18px;
}
```

✅ **Test on actual mobile devices**
- Don't rely on desktop responsive mode alone
- Test on iPhone, Android, various screen sizes

✅ **Handle missing profile picture gracefully**
```javascript
if (user?.picture) {
  updateMobileProfilePicture(user.picture);
} // Else: picture stays hidden
```

### DON'T:

❌ **Don't try to show widgets on mobile**
```javascript
if (isMobile) {
  // Skip widget initialization entirely
  return;
}
```

❌ **Don't use D-pad navigation patterns**
```css
/* Focus styles disabled on mobile */
body.mobile-mode-active *:focus {
  outline: none !important;
}
```

❌ **Don't skip progress updates**
```javascript
// BAD: No feedback during long operations
await heavyOperation();

// GOOD: Show progress
updateMobileProgress(50, 'Processing...');
await heavyOperation();
updateMobileProgress(100, 'Done!');
```

❌ **Don't assume mobile = touch**
- Some tablets support keyboards
- Some phones support mice (Samsung DeX)
- Buttons should work with both touch and click events

---

## Troubleshooting

### Mobile UI Not Showing

**Check:**
1. Platform detector result: `platformDetector.isMobile()` should be `true`
2. Mobile container exists: `document.getElementById('mobile-container')` not null
3. CSS file loaded: `css/components/mobile-landing.css`
4. Body class applied: `document.body.classList.contains('mobile-mode-active')`

**Fix:**
```javascript
// Debug platform detection
console.log('Is mobile:', platformDetector.isMobile());
console.log('User agent:', navigator.userAgent);
console.log('Viewport width:', window.innerWidth);
```

### Settings Button Not Working

**Check:**
1. Button exists: `document.getElementById('mobile-settings-btn')` not null
2. Button enabled: `settingsBtn.disabled` is `false`
3. Settings module loaded: `window.Settings` exists
4. Click handler registered: Check event listeners in DevTools

**Fix:**
```javascript
// Debug Settings button
const btn = document.getElementById('mobile-settings-btn');
console.log('Button:', btn);
console.log('Disabled:', btn?.disabled);
console.log('Settings:', window.Settings);
```

### Progress Bar Not Updating

**Check:**
1. Loading bar visible: `loadingBar.classList.contains('active')`
2. Progress fill element exists: `document.getElementById('mobile-progress-fill')` not null
3. Width being set: Check element style in DevTools

**Fix:**
```javascript
// Debug progress bar
const fill = document.getElementById('mobile-progress-fill');
console.log('Fill element:', fill);
console.log('Current width:', fill?.style.width);
updateMobileProgress(50, 'Test');
console.log('After update:', fill?.style.width);  // Should be "50%"
```

### Profile Picture Not Showing

**Check:**
1. User object has picture: `sessionManager.getUser()?.picture` exists
2. Image element exists: `.mobile-header .profile-pic` found
3. Image src set: Check `img.src` in DevTools
4. Display not none: Check `img.style.display`

**Fix:**
```javascript
// Debug profile picture
const user = window.sessionManager?.getUser();
console.log('User picture URL:', user?.picture);
const img = document.querySelector('.mobile-header .profile-pic');
console.log('Img element:', img);
console.log('Img src:', img?.src);
console.log('Img display:', img?.style.display);
```

### Responsive Breakpoints Not Working

**Check:**
1. Viewport meta tag present in `<head>`
2. Browser zoom at 100%
3. Device height matches media query

**Fix:**
```javascript
// Debug viewport
console.log('Viewport height:', window.innerHeight);
console.log('Device pixel ratio:', window.devicePixelRatio);
```

---

## Related Documentation

- [README.md](../core/initialization/README.md) - Initialization flow (includes mobile path)
- [TOUCH_CONTROLS.md](../widgets/shared/TOUCH_CONTROLS.md) - Touch interactions
- [SETTINGS_PAGE_BASE_GUIDE.md](../modules/Settings/SETTINGS_PAGE_BASE_GUIDE.md) - Settings system
- [THEME_OVERLAY.md](../ui/themes/THEME_OVERLAY.md) - Theme system (dark mode support)
- [ARCHITECTURE.md](../../.reference/ARCHITECTURE.md) - System architecture

---

## Summary

Mobile UI provides:

1. **Dedicated Landing Page** - No dashboard grid, Settings-only access
2. **Touch-Optimized Interface** - Large buttons, responsive sizing
3. **Loading Progress** - Visual feedback during initialization
4. **Settings Access** - Full settings modal on mobile
5. **Theme Support** - Dark mode compatible
6. **Responsive Design** - Adapts to all phone sizes and orientations
7. **Profile Integration** - Shows family name and user profile picture

**Key Components:**
- **Mobile Container** - Full-screen landing page
- **Header** - Family name + profile picture
- **Dashie Logo** - Always orange (brand consistency)
- **Loading Bar** - Animated progress with status text
- **Settings Button** - Opens Settings modal
- **Logout Button** - Signs out and reloads

**Best Practices:**
- ✅ Show loading progress during initialization
- ✅ Disable buttons until ready
- ✅ Use touch-friendly sizes (min 44px)
- ✅ Test on actual devices
- ❌ Don't show widgets on mobile
- ❌ Don't use D-pad navigation patterns
- ❌ Don't skip progress updates

Mobile users get a streamlined, touch-optimized experience focused on Settings configuration.
