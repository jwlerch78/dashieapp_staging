# Dashie Widgets - Developer Guide

This guide documents how to create, port, and integrate widgets into the Dashie dashboard based on lessons learned from successfully porting the calendar and photos widgets.

## Table of Contents

1. [Widget Architecture](#widget-architecture)
2. [Creating a New Widget](#creating-a-new-widget)
3. [Message Protocol](#message-protocol)
4. [Theme Support](#theme-support)
5. [Widget Registration](#widget-registration)
6. [Data Loading](#data-loading)
7. [Common Pitfalls](#common-pitfalls)
8. [Checklist](#checklist)

---

## Widget Architecture

Widgets are isolated iframe-based components that communicate with the dashboard through `postMessage`. Each widget:

- Lives in its own folder: `js/widgets/{widget-name}/`
- Has its own HTML, JS, and optional CSS files
- Runs in an isolated context (iframe sandbox)
- Receives theme updates and data from the dashboard
- Implements a 3-state focus model (unfocused → focused → active)

### File Structure

```
js/widgets/
├── {widget-name}/
│   ├── {widget-name}.html     # Widget UI
│   ├── {widget-name}.js       # Widget logic (class-based)
│   └── {widget-name}.css      # Optional: widget-specific styles
```

---

## Creating a New Widget

### Step 1: Create Widget HTML

**Required elements:**
- Import theme variables: `<link rel="stylesheet" href="/css/core/variables.css">`
- Import theme classes: `<link rel="stylesheet" href="/css/core/themes.css">`
- Use CSS variables for theming: `var(--bg-primary)`, `var(--text-primary)`, etc.
- Import widget JS as module: `<script type="module" src="./widget.js"></script>`

**Example:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Widget</title>

  <!-- CRITICAL: Import theme variables and theme classes -->
  <link rel="stylesheet" href="/css/core/variables.css">
  <link rel="stylesheet" href="/css/core/themes.css">

  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: var(--bg-primary);  /* Use CSS variables */
      color: var(--text-primary);
    }
  </style>
</head>
<body>
  <div id="widget-container">
    <!-- Your widget UI -->
  </div>

  <script type="module" src="./my-widget.js"></script>
</body>
</html>
```

### Step 2: Create Widget JavaScript Class

**Required methods:**
- `constructor()` - Initialize widget, set up listeners, detect theme
- `setupMessageListener()` - Listen for messages from dashboard
- `signalReady()` - Send ready signal to dashboard
- `detectAndApplyInitialTheme()` - Detect and apply initial theme
- `applyTheme(theme)` - Apply theme dynamically
- `handleCommand(action)` - Handle d-pad/keyboard commands

**Example:**

```javascript
import { createLogger } from '/js/utils/logger.js';
import { detectCurrentTheme, applyThemeToWidget } from '/js/widgets/shared/widget-theme-detector.js';

const logger = createLogger('MyWidget');

class MyWidget {
  constructor() {
    // Widget state
    this.isFocused = false;
    this.isActive = false;
    this.currentTheme = null;

    // Focus menu configuration
    this.focusMenu = {
      enabled: false  // Set to true if widget has a focus menu
    };

    // Initialize
    this.detectAndApplyInitialTheme();
    this.setupMessageListener();
    this.signalReady();

    logger.info('MyWidget initialized');
  }

  /**
   * Detect and apply initial theme from parent or localStorage
   * Uses utility for robust, future-proof theme detection
   */
  detectAndApplyInitialTheme() {
    const initialTheme = detectCurrentTheme('dark'); // Fallback to 'dark'
    this.applyTheme(initialTheme);
    logger.debug('Initial theme detected', { theme: initialTheme });
  }

  /**
   * Set up message listener for dashboard communication
   */
  setupMessageListener() {
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data) return;

      logger.debug('Widget received message', { type: data.type, action: data.action });

      // Handle commands (action at top level)
      if (data.type === 'command' && data.action) {
        this.handleCommand(data.action);
        return;
      }

      // Handle data updates (dataType inside payload)
      if (data.type === 'data' && data.payload?.dataType === 'my-data') {
        this.loadData(data.payload.payload);
        return;
      }

      // Handle theme changes
      if (data.type === 'theme-change' && data.theme) {
        this.applyTheme(data.theme);
        return;
      }
    });
  }

  /**
   * Send ready signal to dashboard
   * CRITICAL: Use standard widget-ready format!
   */
  signalReady() {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'widget-ready',           // MUST be 'widget-ready'
        widget: 'my-widget',            // Widget name
        widgetId: 'my-widget',          // MUST match widget ID in config
        hasMenu: this.focusMenu.enabled // Boolean: does widget have focus menu?
      }, '*');

      logger.info('Ready signal sent to parent');
    }
  }

  /**
   * Handle commands from dashboard
   */
  handleCommand(action) {
    logger.debug('Command received', { action, isActive: this.isActive });

    // State transitions
    switch (action) {
      case 'enter-focus':
        this.isFocused = true;
        break;
      case 'enter-active':
        this.isActive = true;
        break;
      case 'exit-active':
        this.isActive = false;
        break;
      case 'exit-focus':
        this.isFocused = false;
        this.isActive = false;
        break;
    }

    // Handle navigation only if active
    if (!this.isActive) {
      return;
    }

    switch (action) {
      case 'up':
        // Handle up
        break;
      case 'down':
        // Handle down
        break;
      case 'left':
        // Handle left
        break;
      case 'right':
        // Handle right
        break;
    }
  }

  /**
   * Apply theme to widget
   * Uses utility for robust theme class management
   */
  applyTheme(theme) {
    if (this.currentTheme === theme) return; // Skip if unchanged

    this.currentTheme = theme;
    applyThemeToWidget(theme); // Utility handles all class removal/application

    logger.debug('Theme applied', { theme });
  }

  /**
   * Load data from dashboard
   */
  loadData(payload) {
    // Handle your data
    logger.info('Data received', payload);
  }
}

// Auto-initialize
new MyWidget();
```

### Step 3: Register Widget in Config

Add your widget to `js/modules/Dashboard/dashboard-widget-config.js`:

```javascript
{
  id: 'my-widget',           // MUST match widgetId in signalReady()
  name: 'My Widget',
  path: '/js/widgets/my-widget/my-widget.html',
  gridPosition: {
    row: 1,
    col: 1,
    width: 2,
    height: 2
  }
}
```

### Step 4: Register Widget in Initializer

Add your widget to `js/core/initialization/widget-initializer.js`:

```javascript
// Get iframe
const myWidgetIframe = document.getElementById('widget-my-widget');

// Register
if (myWidgetIframe) {
  widgetDataManager.registerWidget('my-widget', myWidgetIframe);
}
```

### Step 5: Implement Data Loading (Optional)

If your widget needs data from the dashboard, add to `js/core/widget-data-manager.js`:

```javascript
// In loadWidgetData() switch:
case 'my-widget':
  await this.loadMyWidgetData();
  break;

// Add loader method:
async loadMyWidgetData() {
  try {
    logger.info('Loading my widget data');

    // Fetch your data
    const data = await someService.getData();

    // Send to widget
    this.sendToWidget('my-widget', 'data', {
      dataType: 'my-data',
      payload: data
    });
  } catch (error) {
    logger.error('Failed to load my widget data', { error: error.message });
  }
}
```

---

## Message Protocol

### Dashboard → Widget Messages

**Commands:**
```javascript
{
  type: 'command',
  action: 'up' | 'down' | 'left' | 'right' | 'enter-focus' | 'exit-focus' | 'enter-active' | 'exit-active'
}
```

**Data:**
```javascript
{
  type: 'data',
  widgetId: 'widget-id',
  payload: {
    dataType: 'data-type',
    payload: { /* your data */ }
  }
}
```

**Theme:**
```javascript
{
  type: 'theme-change',
  theme: 'light' | 'dark'
}
```

### Widget → Dashboard Messages

**Ready Signal:**
```javascript
{
  type: 'widget-ready',       // MUST be 'widget-ready'
  widget: 'widget-id',        // Widget name
  widgetId: 'widget-id',      // MUST match config
  hasMenu: false              // Boolean: does widget have focus menu?
}
```

**Return to Menu:**
```javascript
{
  type: 'return-to-menu'
}
```

---

## Theme Support

### CSS Variables (Required)

**MUST import in widget HTML:**
```html
<link rel="stylesheet" href="/css/core/variables.css">
<link rel="stylesheet" href="/css/core/themes.css">
```

**Available variables:**
- `--bg-primary` - Primary background
- `--bg-secondary` - Secondary background
- `--bg-tertiary` - Tertiary background
- `--text-primary` - Primary text color
- `--text-secondary` - Secondary text color
- `--text-muted` - Muted text color
- `--accent-blue` - Accent color (may change per theme)
- `--accent-orange` - Orange accent
- `--accent-current-time` - Color for current time indicators
- And many more in `/css/core/variables.css`

### Theme Detection Utility (RECOMMENDED)

**Use the widget theme detector utility for robust theme support:**

```javascript
import { detectCurrentTheme, applyThemeToWidget } from '/js/widgets/shared/widget-theme-detector.js';

// In your widget class:
detectAndApplyInitialTheme() {
  const initialTheme = detectCurrentTheme('dark'); // Fallback to 'dark'
  this.applyTheme(initialTheme);
  logger.debug('Initial theme detected', { theme: initialTheme });
}

applyTheme(theme) {
  if (this.currentTheme === theme) return;

  this.currentTheme = theme;
  applyThemeToWidget(theme); // Handles all theme class removal/application

  logger.debug('Theme applied', { theme });
}
```

**Benefits of using the utility:**
- ✅ Reads from parent window (works in iframes)
- ✅ Falls back to localStorage automatically
- ✅ Supports ALL themes dynamically (light, dark, halloween-dark, halloween-light, future themes)
- ✅ No hardcoded theme names
- ✅ Removes ALL existing theme classes before applying new one
- ✅ Applies to both `<html>` and `<body>` elements

### Theme Detection (Manual Implementation)

**⚠️ Only use if you cannot use the utility above**

**Order of detection:**
1. Parent window `document.body` classes (if accessible) - Check for ANY `theme-*` class
2. `localStorage.getItem('dashie-theme')`
3. Default fallback

**❌ WRONG - Hardcoded theme checks:**
```javascript
// DON'T DO THIS - Only works for light/dark, breaks for halloween/seasonal themes
if (parentBody.classList.contains('theme-light')) {
  detectedTheme = 'light';
} else if (parentBody.classList.contains('theme-dark')) {
  detectedTheme = 'dark';
}
```

**✅ CORRECT - Dynamic theme detection:**
```javascript
// Extract any theme-* class dynamically
const themeClasses = Array.from(parentBody.classList).filter(cls => cls.startsWith('theme-'));
if (themeClasses.length > 0) {
  const themeName = themeClasses[0].replace('theme-', ''); // e.g., 'halloween-dark'
  detectedTheme = themeName;
}
```

### Theme Application (Manual Implementation)

**⚠️ Only use if you cannot use `applyThemeToWidget()` utility**

**❌ WRONG - Only removes specific themes:**
```javascript
// DON'T DO THIS - Leaves halloween themes stuck
document.body.classList.remove('theme-light', 'theme-dark');
document.body.classList.add(`theme-${theme}`);
```

**✅ CORRECT - Removes ALL theme classes:**
```javascript
// Remove ALL existing theme-* classes first
const existingThemeClasses = Array.from(document.body.classList)
  .filter(cls => cls.startsWith('theme-'));
existingThemeClasses.forEach(cls => {
  document.body.classList.remove(cls);
  document.documentElement.classList.remove(cls);
});

// Add new theme class to both elements
document.documentElement.classList.add(`theme-${theme}`);
document.body.classList.add(`theme-${theme}`);
```

---

## Widget Registration

### Timing is Critical!

Widgets MUST be registered **after** `Dashboard.activate()` creates the iframes.

**Initialization order in `core-initializer.js`:**
```javascript
1. Dashboard.initialize()
2. Dashboard.activate()      // Creates widget iframes
3. initializeWidgets()        // NOW register widgets
```

### Registration Code

In `widget-initializer.js`:

```javascript
const widgetDataManager = initializeWidgetDataManager();

// Wait for iframes to exist
await waitForWidgetIframes();

// Get iframe by ID (prefixed with 'widget-')
const myIframe = document.getElementById('widget-my-widget');

// Register with widget ID (no 'widget-' prefix)
if (myIframe) {
  widgetDataManager.registerWidget('my-widget', myIframe);
}
```

**Key points:**
- Iframe DOM ID: `widget-{id}` (e.g., `widget-photos`)
- Widget ID for registration: `{id}` (e.g., `photos`)
- Widget ID in config: `{id}` (e.g., `photos`)
- Widget ID in signalReady(): `{id}` (e.g., `photos`)

**All must match!**

---

## Data Loading

### Flow

```
1. Widget loads and sends ready signal
   ↓
2. WidgetDataManager receives ready signal
   ↓
3. WidgetDataManager.loadWidgetData(widgetId)
   ↓
4. Widget-specific loader fetches data
   ↓
5. Data sent to widget via sendToWidget()
   ↓
6. Widget receives message and updates UI
```

### Example: Photos Widget

**Widget sends ready:**
```javascript
// photos.js
window.parent.postMessage({
  type: 'widget-ready',
  widget: 'photos',
  widgetId: 'photos',
  hasMenu: false
}, '*');
```

**WidgetDataManager loads data:**
```javascript
// widget-data-manager.js
async loadPhotosData() {
  const photoDataService = window.photoDataService;
  const result = await photoDataService.loadPhotos(null, true);

  this.sendToWidget('photos', 'data', {
    dataType: 'photos',
    payload: {
      urls: result?.urls || [],
      folder: result?.folder || null
    }
  });
}
```

**Widget receives data:**
```javascript
// photos.js
if (data.type === 'data' && data.payload?.dataType === 'photos') {
  this.loadPhotosFromData(data.payload.payload);
}
```

---

## Common Pitfalls

### ❌ Mistake 1: Wrong Message Format

**Wrong (legacy format):**
```javascript
window.parent.postMessage({
  type: 'event',         // ❌ Legacy format - don't use!
  widgetId: 'photos',
  payload: {
    eventType: 'widget-ready',
    data: { hasMenu: false }
  }
}, '*');
```

**Correct (standard format):**
```javascript
window.parent.postMessage({
  type: 'widget-ready',  // ✅ Correct!
  widget: 'photos',
  widgetId: 'photos',
  hasMenu: false
}, '*');
```

### ❌ Mistake 2: Missing CSS Variables or Theme Classes

**Wrong:**
```html
<style>
  body {
    background: var(--bg-primary);  /* ❌ Undefined, falls back to nothing */
  }
</style>
```

**Correct:**
```html
<!-- ✅ Import BOTH variables and themes -->
<link rel="stylesheet" href="/css/core/variables.css">
<link rel="stylesheet" href="/css/core/themes.css">

<style>
  body {
    background: var(--bg-primary);  /* ✅ Now defined */
  }
</style>
```

**Why both are needed:**
- `variables.css` - Defines CSS variable names with default values
- `themes.css` - Provides theme-specific overrides via `body.theme-*` classes

### ❌ Mistake 3: Widget ID Mismatch

**Wrong:**
```javascript
// config: id = 'photos'
// signalReady: widgetId = 'photo-widget'  // ❌ Doesn't match!
```

**Correct:**
```javascript
// config: id = 'photos'
// signalReady: widgetId = 'photos'  // ✅ Match!
```

### ❌ Mistake 4: Hardcoding Theme Names

**Wrong:**
```javascript
// ❌ Only works for light/dark, breaks for halloween/seasonal themes
detectAndApplyInitialTheme() {
  if (document.body.classList.contains('theme-light')) {
    this.applyTheme('light');
  } else if (document.body.classList.contains('theme-dark')) {
    this.applyTheme('dark');
  }
}

applyTheme(theme) {
  // ❌ Leaves halloween themes stuck when switching
  document.body.classList.remove('theme-light', 'theme-dark');
  document.body.classList.add(`theme-${theme}`);
}
```

**Correct:**
```javascript
// ✅ Use the utility - supports all themes dynamically
import { detectCurrentTheme, applyThemeToWidget } from '/js/widgets/shared/widget-theme-detector.js';

detectAndApplyInitialTheme() {
  const theme = detectCurrentTheme('dark');
  this.applyTheme(theme);
}

applyTheme(theme) {
  this.currentTheme = theme;
  applyThemeToWidget(theme); // Removes ALL theme classes, adds new one
}
```

### ❌ Mistake 5: Theme Not Applied to Both Elements

**Wrong:**
```javascript
document.body.classList.add(`theme-${theme}`);  // ❌ Only body
```

**Correct:**
```javascript
document.documentElement.classList.add(`theme-${theme}`);  // ✅ Both
document.body.classList.add(`theme-${theme}`);

// OR better, use the utility:
applyThemeToWidget(theme);  // ✅ Handles both automatically
```

### ❌ Mistake 6: Registering Before iframes Exist

**Wrong:**
```javascript
await Dashboard.initialize();
await initializeWidgets();    // ❌ Iframes don't exist yet!
Dashboard.activate();
```

**Correct:**
```javascript
await Dashboard.initialize();
Dashboard.activate();         // Creates iframes
await initializeWidgets();    // ✅ Now iframes exist!
```

---

## Checklist

### Creating a New Widget

- [ ] Create widget folder: `js/widgets/{name}/`
- [ ] Create `{name}.html` with:
  - [ ] Import CSS variables: `<link rel="stylesheet" href="/css/core/variables.css">`
  - [ ] Import theme classes: `<link rel="stylesheet" href="/css/core/themes.css">`
  - [ ] Use CSS variables for colors (no hardcoded colors)
  - [ ] Import widget JS as module
- [ ] Create `{name}.js` with:
  - [ ] Import theme utilities: `import { detectCurrentTheme, applyThemeToWidget } from '/js/widgets/shared/widget-theme-detector.js'`
  - [ ] `detectAndApplyInitialTheme()` in constructor using `detectCurrentTheme()`
  - [ ] `setupMessageListener()` with all message handlers
  - [ ] `signalReady()` with correct format
  - [ ] `applyTheme()` method using `applyThemeToWidget()` utility
  - [ ] `handleCommand()` for d-pad commands
- [ ] Add widget to `dashboard-widget-config.js`
- [ ] Add widget registration to `widget-initializer.js`
- [ ] Add data loader to `widget-data-manager.js` (if needed)
- [ ] Test theme switching (light ↔ dark ↔ halloween-dark ↔ halloween-light)
- [ ] Test data loading
- [ ] Test commands (if applicable)

### Porting Legacy Widget

- [ ] Copy HTML/CSS/JS from legacy folder
- [ ] Add CSS variables import: `<link rel="stylesheet" href="/css/core/variables.css">`
- [ ] Add theme classes import: `<link rel="stylesheet" href="/css/core/themes.css">`
- [ ] Import theme utilities in JS: `import { detectCurrentTheme, applyThemeToWidget } from '/js/widgets/shared/widget-theme-detector.js'`
- [ ] Update message format in `signalReady()`
- [ ] Add `detectAndApplyInitialTheme()` method using `detectCurrentTheme()`
- [ ] Add `applyTheme()` method using `applyThemeToWidget()`
- [ ] Update message listener to handle new formats
- [ ] Remove any hardcoded theme checks (only 'light'/'dark')
- [ ] Follow "Creating a New Widget" checklist above

---

## Examples

### Minimal Widget (No Data)

See: `js/widgets/clock/` - Simple widget with no data loading

### Widget with Data Loading

See: `js/widgets/photos/` - Loads photo URLs from service

### Widget with Complex State

See: `js/widgets/calendar/` - Calendar events, navigation, multiple views

---

## Debugging

### Check Widget Registration

```javascript
// In browser console:
widgetDataManager.getRegisteredWidgets()
```

Expected output:
```javascript
[
  { widgetId: 'header', iframeId: 'widget-header', ready: true, hasContentWindow: true },
  { widgetId: 'clock', iframeId: 'widget-clock', ready: true, hasContentWindow: true },
  { widgetId: 'photos', iframeId: 'widget-photos', ready: true, hasContentWindow: true },
  { widgetId: 'main', iframeId: 'widget-main', ready: true, hasContentWindow: true }
]
```

### Check Message Flow

Add logging in widget:
```javascript
window.addEventListener('message', (event) => {
  console.log('Widget received:', event.data);
});
```

### Check Theme

In widget, check classes:
```javascript
console.log('HTML classes:', document.documentElement.classList);
console.log('Body classes:', document.body.classList);
```

Should see: `theme-light` or `theme-dark`

---

## Additional Resources

- **Widget Theme Detector:** `js/widgets/shared/widget-theme-detector.js` - Utility for robust theme detection and application
- **Widget Messenger:** `js/core/widget-messenger.js` - Handles widget command routing
- **Widget Data Manager:** `js/core/widget-data-manager.js` - Handles widget data loading
- **Theme Applier:** `js/ui/theme-applier.js` - Broadcasts theme changes
- **Theme Registry:** `js/themes/theme-registry.js` - Central theme definitions
- **CSS Variables:** `css/core/variables.css` - All available theme variables
- **Theme Classes:** `css/core/themes.css` - All theme class definitions

### Working Widget Examples

- **Header Widget:** `js/widgets/header/` - Simple widget with theme-aware dynamic greetings
- **Clock Widget:** `js/widgets/clock/` - Widget with weather integration
- **Calendar Widget:** `js/widgets/calendar/` - Complex widget with navigation and multiple views
- **Agenda Widget:** `js/widgets/agenda/` - List-based widget with event selection
- **Photos Widget:** `js/widgets/photos/` - Slideshow widget with data loading

All widgets now use the `widget-theme-detector.js` utility for robust theme support.
