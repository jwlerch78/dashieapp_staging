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

  <!-- CRITICAL: Import theme variables -->
  <link rel="stylesheet" href="/css/core/variables.css">

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

const logger = createLogger('MyWidget');

class MyWidget {
  constructor() {
    // Widget state
    this.isFocused = false;
    this.isActive = false;

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
   */
  detectAndApplyInitialTheme() {
    let detectedTheme = null;

    // Try parent window first
    try {
      if (window.parent && window.parent !== window && window.parent.document) {
        const parentBody = window.parent.document.body;
        if (parentBody.classList.contains('theme-light')) {
          detectedTheme = 'light';
        } else if (parentBody.classList.contains('theme-dark')) {
          detectedTheme = 'dark';
        }
      }
    } catch (e) {
      // Cross-origin - can't access parent
    }

    // Fallback to localStorage
    if (!detectedTheme) {
      try {
        const savedTheme = localStorage.getItem('dashie-theme');
        if (savedTheme === 'light' || savedTheme === 'dark') {
          detectedTheme = savedTheme;
        }
      } catch (e) {
        // Ignore
      }
    }

    // Apply theme or default to light
    this.applyTheme(detectedTheme || 'light');
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
   * CRITICAL: Use correct message format!
   */
  signalReady() {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'event',              // MUST be 'event'
        widgetId: 'my-widget',      // MUST match widget ID in config
        payload: {
          eventType: 'widget-ready', // MUST be 'widget-ready'
          data: {
            hasMenu: this.focusMenu.enabled
          }
        }
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
   */
  applyTheme(theme) {
    // Remove old theme classes
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    document.body.classList.remove('theme-light', 'theme-dark');

    // Add new theme class
    document.documentElement.classList.add(`theme-${theme}`);
    document.body.classList.add(`theme-${theme}`);

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
  type: 'event',              // MUST be 'event'
  widgetId: 'widget-id',      // MUST match config
  payload: {
    eventType: 'widget-ready', // MUST be 'widget-ready'
    data: {
      hasMenu: false
    }
  }
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
```

**Available variables:**
- `--bg-primary` - Primary background
- `--bg-secondary` - Secondary background
- `--text-primary` - Primary text color
- `--text-secondary` - Secondary text color
- `--text-muted` - Muted text color
- `--accent-blue` - Accent color
- And many more in `/css/core/variables.css`

### Theme Detection

**Order of detection:**
1. Parent window `document.body` classes (if accessible)
2. `localStorage.getItem('dashie-theme')`
3. Default to `'light'`

### Theme Application

**Apply to both `<html>` and `<body>`:**
```javascript
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
  type: 'event',
  widgetId: 'photos',
  payload: {
    eventType: 'widget-ready',
    data: { hasMenu: false }
  }
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

**Wrong:**
```javascript
window.parent.postMessage({
  type: 'widget-ready',  // ❌ Wrong!
  widget: 'photos',
  config: { hasMenu: false }
}, '*');
```

**Correct:**
```javascript
window.parent.postMessage({
  type: 'event',         // ✅ Correct
  widgetId: 'photos',
  payload: {
    eventType: 'widget-ready',
    data: { hasMenu: false }
  }
}, '*');
```

### ❌ Mistake 2: Missing CSS Variables

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
<!-- ✅ Import first -->
<link rel="stylesheet" href="/css/core/variables.css">

<style>
  body {
    background: var(--bg-primary);  /* ✅ Now defined */
  }
</style>
```

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

### ❌ Mistake 4: Theme Not Applied to Both Elements

**Wrong:**
```javascript
document.body.classList.add(`theme-${theme}`);  // ❌ Only body
```

**Correct:**
```javascript
document.documentElement.classList.add(`theme-${theme}`);  // ✅ Both
document.body.classList.add(`theme-${theme}`);
```

### ❌ Mistake 5: Registering Before iframes Exist

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
  - [ ] Use CSS variables for colors
  - [ ] Import widget JS as module
- [ ] Create `{name}.js` with:
  - [ ] `detectAndApplyInitialTheme()` in constructor
  - [ ] `setupMessageListener()` with all message handlers
  - [ ] `signalReady()` with correct format
  - [ ] `applyTheme()` method applying to both html and body
  - [ ] `handleCommand()` for d-pad commands
- [ ] Add widget to `dashboard-widget-config.js`
- [ ] Add widget registration to `widget-initializer.js`
- [ ] Add data loader to `widget-data-manager.js` (if needed)
- [ ] Test theme switching (light ↔ dark)
- [ ] Test data loading
- [ ] Test commands (if applicable)

### Porting Legacy Widget

- [ ] Copy HTML/CSS/JS from legacy folder
- [ ] Add CSS variables import
- [ ] Update message format in `signalReady()`
- [ ] Add `detectAndApplyInitialTheme()` method
- [ ] Add `applyTheme()` method
- [ ] Update message listener to handle new formats
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

- **Widget Messenger:** `js/core/widget-messenger.js` - Handles widget command routing
- **Widget Data Manager:** `js/core/widget-data-manager.js` - Handles widget data loading
- **Theme Applier:** `js/ui/theme-applier.js` - Broadcasts theme changes
- **CSS Variables:** `css/core/variables.css` - All available theme variables
