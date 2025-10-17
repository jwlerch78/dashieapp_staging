# Phase 3.5: Widget Integration - Quick Start Guide

**Estimated Time:** 1-2 days
**Status:** Ready after Phase 3 complete
**Prerequisites:** Phase 3 (Data Layer) complete - so widgets can test with live calendar/photo data

---

## What You're Building

Integration and refactoring of **8 existing widgets** into the new Dashboard:
- **dcal** - Dashboard calendar (week/month views)
- **photos** - Photo slideshow
- **clock** - Time display
- **agenda** - Upcoming events list
- **location** - Location info
- **map** - Map display
- **camera** - Photo capture
- **header** - Header bar

**Focus:** Fire TV CSS fixes, widget registration, focus menu integration, testing

---

## Context to Load (Read These Sections)

### 1. API_INTERFACES.md - Lines 1562-2033
**What to focus on:**
- Widget Layer Interface (NEW in v2.3)
- 3-state model (UNFOCUSED → FOCUSED → ACTIVE)
- Focus Menu System
- "Home Position" pattern
- Required widget methods

### 2. PHASE_2_HANDOFF.md - Lines 447-539
**What to focus on:**
- Widget communication overview
- WidgetMessenger role
- Widget loading strategy

### 3. CSS_BUILD_INTEGRATION.md - Lines 869-888
**What to focus on:**
- Fire TV CSS compatibility rules
- What to avoid (webkit-mask, blur, complex filters)
- What's safe (simple transforms, box-shadow, percentages)

---

## Existing Widgets Overview

### Widget Inventory

```
.legacy/widgets/
├── dcal/                  # Calendar widget (week/month views)
│   ├── calendar_dcal.html
│   ├── dcal.js            # Main widget class
│   ├── dcal.css           # Widget styles
│   ├── dcal-weekly.js     # Week view renderer
│   ├── dcal-monthly.js    # Month view renderer
│   └── dcal-settings/     # Settings modal
├── photos/                # Photo slideshow widget
│   ├── photos.html
│   ├── photos.js
│   └── photos.css
├── clock/                 # Time display widget
├── agenda/                # Upcoming events list
├── location/              # Location info
├── map/                   # Map display
├── camera/                # Photo capture
└── header/                # Header bar
```

### Widget States (Already Implemented)

Your widgets already follow the 3-state model:
- `hasFocus` = false/true (FOCUSED state)
- `isActive` = false/true (ACTIVE state)
- Proper state transition handling

**Good news:** The architecture is already solid! Just needs Fire TV CSS fixes and integration.

---

## Fire TV CSS Issues Found

### Critical Fixes Needed

**1. Focus Menu CSS (`.legacy/css/components/focus-menu.css`)**

**Problem:** Lines 31-35 use `-webkit-mask` (won't render on Fire TV)

```css
/* ❌ BROKEN ON FIRE TV */
.focus-menu:not(.dimmed)::before {
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
```

**Fix:** Replace with solid border or box-shadow

```css
/* ✅ FIRE TV COMPATIBLE */
.focus-menu:not(.dimmed)::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--border-radius);
  border: var(--outline-width-selected) solid transparent;
  background: var(--widget-border-gradient-active) border-box;
  pointer-events: none;
  z-index: -1;
}

/* OR use box-shadow */
.focus-menu:not(.dimmed) {
  box-shadow: 0 0 0 var(--outline-width-selected) var(--outline-color-nav);
}
```

**2. Focus Menu Scale Property**

**Problem:** Line 45 uses `scale` property (CSS Transform Level 2, may not work)

```css
/* ❌ MAY NOT WORK ON FIRE TV */
.focus-menu.dimmed {
  scale: 0.95;
}
```

**Fix:** Use standard `transform: scale()`

```css
/* ✅ FIRE TV COMPATIBLE */
.focus-menu.dimmed {
  transform: scale(0.95);
}
```

**3. Widget Settings CSS (`.legacy/widgets/dcal/dcal-settings/dcal-settings.css`)**

**Problems found:**
- `backdrop-filter: blur(4px)` (line ~50) - May be slow/broken
- Multiple `!important` declarations (lines with gradient, outline)

**Fixes:**

```css
/* ❌ BROKEN */
.dcal-settings-modal {
  backdrop-filter: blur(4px);
}

/* ✅ FIXED */
.dcal-settings-modal {
  background: rgba(34, 34, 34, 0.95); /* Solid background, no blur */
}

/* ❌ BAD */
.dcal-settings-button:focus {
  outline: 2px solid #EE9828 !important;
}

/* ✅ GOOD */
.dcal-settings-button:focus {
  outline: 2px solid #EE9828;
}
/* If specificity issue, use BEM naming instead of !important */
```

---

## Implementation Steps

### Step 1: Copy Widgets to New Location

**Create widget structure:**

```bash
# Create widgets folder
mkdir -p widgets

# Copy all widgets from legacy
cp -r .legacy/widgets/* widgets/

# Update widget imports to use new core paths
# (They currently import from ../../js/utils/logger.js, etc.)
```

**Update widget imports:**

Each widget imports from legacy paths:
```javascript
// ❌ Old path
import { createLogger } from '../../js/utils/logger.js';
import { DEFAULT_THEME } from '../../js/core/theme.js';

// ✅ New path (from widget iframe to app core)
import { createLogger } from '../../js/utils/logger.js'; // Same path, actually!
```

**Note:** Widget iframes are loaded from `/widgets/[name]/[name].html`, so relative paths to `/js/` stay the same!

**Success criteria:**
- [ ] All 8 widgets copied to `widgets/` folder
- [ ] Imports verified (should work as-is)
- [ ] No compilation errors

---

### Step 2: Fix Focus Menu CSS

**File:** `css/components/focus-menu.css` (copy from legacy, then fix)

**Tasks:**

1. **Replace -webkit-mask (lines 31-35):**

```css
/* Remove webkit-mask approach entirely */
.focus-menu:not(.dimmed)::before {
  display: none; /* Disable gradient border for now */
}

/* OR implement with box-shadow */
.focus-menu:not(.dimmed) {
  box-shadow: 0 0 0 3px var(--outline-color-nav);
}
```

2. **Replace scale property (line 45):**

```css
.focus-menu.dimmed {
  transform: scale(0.95); /* Changed from scale: 0.95 */
  opacity: 0.85;
  transition: transform 0.3s ease, opacity 0.3s ease;
}
```

3. **Remove !important declarations:**

Search and replace pattern:
```bash
# Find all !important in focus-menu.css
grep -n "!important" css/components/focus-menu.css

# Remove each one, fix specificity if needed
```

**Success criteria:**
- [ ] Zero `-webkit-mask` usage
- [ ] `scale` replaced with `transform: scale()`
- [ ] Zero `!important` declarations
- [ ] CSS passes linting
- [ ] Visual appearance preserved (test in browser)

---

### Step 3: Fix Widget-Specific CSS

**dcal-settings.css:**

```bash
# Copy widget CSS
cp .legacy/widgets/dcal/dcal-settings/dcal-settings.css widgets/dcal/dcal-settings/

# Fix in widgets/dcal/dcal-settings/dcal-settings.css
```

**Changes needed:**

1. Remove `backdrop-filter: blur()`
2. Remove `!important` declarations
3. Test in browser

**Photos widget CSS:**
- Check `widgets/photos/photos.css` for issues
- No major issues expected (simple styles)

**Other widgets:**
- Quick audit of each widget's CSS
- Most should be fine (minimal styling)

**Success criteria:**
- [ ] Zero `backdrop-filter` usage
- [ ] Zero `!important` in widget CSS
- [ ] All widget CSS passes linting
- [ ] Visual appearance preserved

---

### Step 4: Register Widgets in Dashboard

**Update Dashboard to load widgets:**

**File:** `js/modules/Dashboard/dashboard-ui-renderer.js`

**Add widget loading:**

```javascript
class DashboardUIRenderer {
    static widgets = [
        { id: 'dcal', name: 'Calendar', src: '/widgets/dcal/calendar_dcal.html', row: 0, col: 0 },
        { id: 'photos', name: 'Photos', src: '/widgets/photos/photos.html', row: 0, col: 1 },
        { id: 'clock', name: 'Clock', src: '/widgets/clock/clock.html', row: 0, col: 2 },
        { id: 'agenda', name: 'Agenda', src: '/widgets/agenda/agenda.html', row: 1, col: 0 },
        { id: 'location', name: 'Location', src: '/widgets/location/location.html', row: 1, col: 1 },
        { id: 'map', name: 'Map', src: '/widgets/map/map.html', row: 1, col: 2 }
    ];

    static render() {
        const app = document.getElementById('app');

        // Render dashboard structure
        app.innerHTML = `
            <div class="dashboard">
                <aside class="dashboard-sidebar">
                    ${this.renderMenu()}
                </aside>
                <main class="dashboard-grid">
                    ${this.renderWidgetGrid()}
                </main>
            </div>
        `;

        this.elements.grid = document.getElementById('grid');
        this.elements.sidebar = document.getElementById('sidebar');

        // Load widgets into iframes
        this.loadWidgets();
    }

    static renderWidgetGrid() {
        return this.widgets.map(widget => `
            <div class="dashboard-grid__cell"
                 data-row="${widget.row}"
                 data-col="${widget.col}"
                 data-widget-id="${widget.id}">
                <iframe
                    id="widget-${widget.id}"
                    class="widget-iframe"
                    src="${widget.src}"
                    frameborder="0"
                    sandbox="allow-scripts allow-same-origin"
                ></iframe>
            </div>
        `).join('');
    }

    static loadWidgets() {
        this.widgets.forEach(widget => {
            const iframe = document.getElementById(`widget-${widget.id}`);

            iframe.addEventListener('load', () => {
                logger.info(`Widget loaded: ${widget.id}`);

                // Register with WidgetMessenger
                WidgetMessenger.registerWidget(widget.id, iframe);
            });
        });
    }
}
```

**Success criteria:**
- [ ] All 6 widgets render in grid (2×3)
- [ ] Iframes load without errors
- [ ] Widgets register with WidgetMessenger
- [ ] No console errors

---

### Step 5: Test Focus Menu System with Live Data

**Test Calendar Widget (dcal) - Has Focus Menu:**

1. **Navigate to calendar widget in grid**
   - Press Enter to focus widget
   - Calendar should center
   - Focus menu should appear on the right
   - **NEW: Verify live calendar events display** (from Phase 3 auth/data)

2. **Test menu navigation**
   - Up/down arrows navigate menu items
   - Selected item highlighted with shading
   - Active item (current view) has thick left border

3. **Test menu → widget transition**
   - Press Enter on menu item (e.g., "Month View")
   - Widget should switch to month view
   - Menu item should update (Month becomes active)
   - **NEW: Verify events display in month view**

4. **Test widget → menu transition**
   - Press Enter again to enter widget (ACTIVE state)
   - Focus menu should dim and scale to 95%
   - Left/right arrows now navigate calendar
   - **NEW: Events should be clickable/visible in detail**

5. **Test return to menu**
   - Navigate calendar to past/future
   - Navigate back to "home" position (today)
   - Press left at home → Should return to focus menu
   - Focus menu should restore to 100% scale

**Test Photos Widget with Live Data (No Focus Menu):**

1. Navigate to photos widget
2. Press Enter → Should go straight to ACTIVE state
3. **NEW: Verify actual photos load from Google Photos** (from Phase 3 photo service)
4. Left/right arrows change photos
5. Verify photo metadata displays
6. Press Escape → Should exit to grid

**Success criteria:**
- [ ] Focus menu appears for dcal widget
- [ ] Menu navigation works (up/down)
- [ ] Menu item selection works (Enter)
- [ ] Menu dims when entering ACTIVE state
- [ ] Return-to-menu works at home position
- [ ] Widgets without menu work correctly
- [ ] **Live calendar events display correctly**
- [ ] **Live photos load and display correctly**

---

### Step 6: Integrate with WidgetMessenger

**Verify WidgetMessenger handles:**

1. **widget-ready messages**
   - Widgets send on load
   - WidgetMessenger registers them

2. **State transition messages**
   - `enter-focus` → Widget centers
   - `enter-active` → Widget receives commands
   - `exit-active` → Widget returns to menu
   - `exit-focus` → Widget defocuses

3. **Data updates**
   - Calendar data → dcal widget
   - Photo data → photos widget
   - Theme changes → all widgets

4. **Focus menu messages**
   - `menu-active` (menu vs. widget navigation)
   - `menu-selection-changed` (cursor moves)
   - `menu-item-selected` (Enter on menu item)

**File to check:** `js/core/widget-messenger.js` (already built in Phase 1)

**Success criteria:**
- [ ] WidgetMessenger routes state transitions correctly
- [ ] Data updates reach widgets
- [ ] Focus menu messages work
- [ ] No message routing errors

---

### Step 7: Test on Fire TV Hardware

**Critical: Test CSS fixes on actual Fire TV device**

**Setup:**
1. Sideload app to Fire TV
2. Connect Chrome DevTools via IP
3. Test with Fire TV remote

**Test checklist:**

**Visual Rendering:**
- [ ] Focus menu renders correctly (no missing borders)
- [ ] Focus menu scales to 95% when dimmed
- [ ] Widget iframes render
- [ ] No visual artifacts or missing effects
- [ ] Calendar widget displays correctly
- [ ] Photos widget displays correctly

**Navigation:**
- [ ] D-pad navigates grid
- [ ] Enter focuses widget
- [ ] Focus menu appears (for calendar)
- [ ] D-pad navigates focus menu
- [ ] Enter activates widget
- [ ] Widget navigation works (left/right in calendar)
- [ ] Return-to-menu works

**Performance:**
- [ ] Focus menu transitions smooth (30+ FPS)
- [ ] Widget loading fast (< 1 second)
- [ ] No jank during navigation
- [ ] Memory usage acceptable (< 50MB)

**Measure FPS during navigation:**
```javascript
// In browser console
let lastTime = performance.now();
let frames = 0;

function measureFPS() {
  const now = performance.now();
  frames++;

  if (now - lastTime >= 1000) {
    console.log(`FPS: ${frames}`);
    frames = 0;
    lastTime = now;
  }

  requestAnimationFrame(measureFPS);
}

measureFPS();
```

**Target: 30+ FPS for all transitions**

---

## Common Patterns Across Widgets

### Widget Initialization Pattern

All widgets follow this pattern:

```javascript
// 1. Constructor - set up state
constructor() {
    this.hasFocus = false;
    this.isActive = false;
    this.currentTheme = null;
    this.widgetId = 'widget-name';
}

// 2. Setup - listeners and UI
init() {
    this.setupMessageListener();
    this.setupUI();
    this.signalReady();
}

// 3. Signal ready to parent
signalReady() {
    window.parent.postMessage({
        type: 'widget-ready',
        widget: this.widgetId
    }, '*');
}
```

### State Transition Pattern

All widgets handle state transitions:

```javascript
handleCommand(action) {
    // STEP 1: State transitions FIRST
    switch (action) {
        case 'enter-focus':
            this.hasFocus = true;
            this.showFocusIndicator();
            if (this.hasFocusMenu) {
                this.sendMenuConfig();
            }
            return;

        case 'enter-active':
            this.isActive = true;
            this.homePosition = this.getCurrentPosition();
            this.isAtHome = true;
            if (this.hasFocusMenu) {
                this.dimMenu();
            }
            return;

        case 'exit-active':
            this.isActive = false;
            if (this.hasFocusMenu) {
                this.restoreMenu();
            }
            return;

        case 'exit-focus':
            this.hasFocus = false;
            this.hideFocusIndicator();
            return;
    }

    // STEP 2: Navigation (only if active)
    if (!this.isActive) return;

    switch (action) {
        case 'up': this.handleUp(); break;
        case 'down': this.handleDown(); break;
        case 'left': this.handleLeft(); break;
        case 'right': this.handleRight(); break;
        case 'enter': this.handleEnter(); break;
    }
}
```

### Focus Menu Pattern (Optional)

Widgets with focus menu:

```javascript
sendMenuConfig() {
    window.parent.postMessage({
        type: 'widget-config',
        widget: this.widgetId,
        config: {
            hasFocusMenu: true,
            menuItems: [
                { id: 'view-week', label: 'Week', icon: '📅', type: 'view', active: true },
                { id: 'view-month', label: 'Month', icon: '📆', type: 'view', active: false },
                { id: 'action-today', label: 'Today', icon: '🏠', type: 'action' }
            ]
        }
    }, '*');
}

handleMenuAction(data) {
    if (data.action === 'menu-item-selected') {
        const item = this.menuItems.find(i => i.id === data.itemId);

        if (item.type === 'view') {
            this.switchView(data.itemId);
        }

        if (item.type === 'action') {
            this.executeAction(data.itemId);
        }
    }
}
```

---

## Widget-Specific Notes

### dcal (Calendar Widget)

**Complexity: High**
- Has focus menu (Week/Month views, Go to Today)
- Complex navigation (week/month switching, scrolling)
- "Home position" logic (return to menu at today)

**Files:**
- `calendar_dcal.html` - Main HTML
- `dcal.js` - Main widget class (~500 lines)
- `dcal-weekly.js` - Week view renderer
- `dcal-monthly.js` - Month view renderer
- `dcal.css` - Widget styles
- `dcal-settings/` - Settings modal (has backdrop-filter to fix)

**Refactoring needed:**
- Fix dcal-settings CSS (backdrop-filter, !important)
- Already implements 3-state model correctly
- Already implements focus menu correctly

---

### photos (Photos Widget)

**Complexity: Medium**
- No focus menu (simple slideshow)
- Auto-advance with configurable timing
- Click empty state to upload photos

**Files:**
- `photos.html`
- `photos.js` (~350 lines)
- `photos.css`

**Refactoring needed:**
- Minimal - already implements 3-state model
- CSS should be clean (simple styles)

---

### clock (Clock Widget)

**Complexity: Low**
- No focus menu
- Simple time display
- Updates every second

**Refactoring needed:**
- Minimal - straightforward widget

---

### Other Widgets (agenda, location, map, camera, header)

**Test each individually** - likely minimal refactoring needed.

---

## Testing Checklist

### Integration Tests

**Grid Navigation:**
- [ ] Arrow keys navigate 2×3 grid
- [ ] Focus indicator moves correctly
- [ ] Enter focuses widget

**Widget Focus:**
- [ ] Calendar widget centers on focus
- [ ] Focus menu appears (for calendar)
- [ ] Photos widget centers on focus
- [ ] Clock widget centers on focus

**Focus Menu:**
- [ ] Menu navigation works (up/down)
- [ ] Menu item selection works (Enter)
- [ ] Active item has thick border
- [ ] Selected item has shading
- [ ] Menu dims when entering ACTIVE

**Widget Navigation:**
- [ ] Calendar: left/right navigate weeks
- [ ] Calendar: up/down scroll calendar
- [ ] Calendar: return-to-menu at home
- [ ] Photos: left/right change photos
- [ ] All widgets: Escape exits to grid

**Data Updates (Live Data from Phase 3):**
- [ ] Calendar receives live event data from Google Calendar API
- [ ] Photos receives live photo URLs from Google Photos API
- [ ] Theme changes apply to all widgets
- [ ] Data updates happen in real-time (no stale data)

**Fire TV Hardware:**
- [ ] All visual effects render correctly
- [ ] No webkit-mask issues
- [ ] Performance acceptable (30+ FPS)
- [ ] D-pad navigation works

---

## Success Criteria

### Phase 3.5 Complete When:

**Widget Integration:**
- [ ] All 8 widgets copied to `/widgets/` folder
- [ ] All widgets load in Dashboard grid
- [ ] All widgets register with WidgetMessenger
- [ ] Widget iframes render correctly

**CSS Fixes:**
- [ ] Focus menu CSS fixed (no webkit-mask)
- [ ] Focus menu scale property fixed
- [ ] dcal-settings CSS fixed (no backdrop-filter)
- [ ] Zero `!important` in widget CSS
- [ ] All widget CSS passes linting

**Functionality:**
- [ ] Grid navigation works
- [ ] Widget focus works
- [ ] Focus menu appears for calendar
- [ ] Focus menu navigation works
- [ ] Widget ACTIVE state works
- [ ] Return-to-menu works
- [ ] **Live data updates reach widgets (calendar events, photos)**
- [ ] **Widgets display live data correctly**

**Fire TV Compatibility:**
- [ ] All effects render on Fire TV
- [ ] Performance acceptable (30+ FPS)
- [ ] D-pad navigation smooth
- [ ] No visual artifacts

**Code Quality:**
- [ ] No console errors
- [ ] No console warnings
- [ ] Linting passes
- [ ] Imports verified

---

## Common Pitfalls to Avoid

### 1. Don't Break Widget Isolation
❌ **Wrong:** Access widget internals from parent
✅ **Right:** Use postMessage for all communication

### 2. Don't Skip Fire TV Testing
❌ **Wrong:** Test only in browser
✅ **Right:** Test on actual Fire TV hardware

### 3. Don't Use Inline Styles for State
❌ **Wrong:** `iframe.style.transform = 'scale(0.95)'`
✅ **Right:** `iframe.classList.add('widget--dimmed')` with CSS

### 4. Don't Forget Iframe Sandbox
❌ **Wrong:** `<iframe src="...">`
✅ **Right:** `<iframe src="..." sandbox="allow-scripts allow-same-origin">`

### 5. Don't Mix State Transitions and Navigation
❌ **Wrong:** Handle 'left' and 'enter-focus' the same way
✅ **Right:** State transitions FIRST, then navigation

---

## Next Steps

When Phase 3.5 is complete, move to:
**Phase 4: Remaining Modules** (Settings, Login, Modals, Welcome)

See: `.reference/build-plans/Phase 4 - Remaining Modules.md`

---

## Quick Reference

### Widget States
```
UNFOCUSED → enter-focus → FOCUSED → enter-active → ACTIVE
ACTIVE → exit-active → FOCUSED → exit-focus → UNFOCUSED
```

### Fire TV CSS Rules
- ❌ NO `-webkit-mask`
- ❌ NO `backdrop-filter: blur()`
- ❌ NO `!important`
- ❌ NO `scale` property (use `transform: scale()`)
- ✅ USE `box-shadow` for borders
- ✅ USE `transform: scale()` for scaling
- ✅ USE solid backgrounds (no blur)

### Widget Registration
```javascript
// Dashboard registers widget
WidgetMessenger.registerWidget('calendar', iframeElement);

// Widget signals ready
window.parent.postMessage({ type: 'widget-ready', widget: 'calendar' }, '*');
```

---

**Your widget architecture is solid! This phase is mostly CSS fixes and integration. Let's make it Fire TV perfect!** 🔥📺
