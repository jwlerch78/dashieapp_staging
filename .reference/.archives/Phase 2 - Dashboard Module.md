# Phase 2: Dashboard Module - Quick Start Guide

**Estimated Time:** 1-2 days
**Status:** Ready to start
**Prerequisites:** Phase 1 (Core Infrastructure) complete

---

## What You're Building

The **Dashboard module** - the main application view with:
- 2×3 widget grid
- Sidebar menu with 7 items
- D-pad/keyboard navigation
- Widget focus/defocus system

**This phase validates the new architecture** - if Dashboard works smoothly, the pattern is solid.

---

## Context to Load (Read These Sections)

### 1. PHASE_2_HANDOFF.md - Lines 92-446
**What to focus on:**
- Dashboard module structure (lines 100-109)
- Navigation consolidation decisions (lines 116-135)
- Input flow diagram (lines 149-166)
- Fire TV CSS rules (lines 202-238)
- Implementation steps for Day 8-14 (lines 316-446)

### 2. ARCHITECTURE.md - Lines 1495-1555
**What to focus on:**
- Dashboard module purpose
- File breakdown (what goes where)
- Navigation consolidation table

### 3. API_INTERFACES.md - Lines 658-865
**What to focus on:**
- Standard Module Interface (lines 664-716)
- Module Input Handler Interface (lines 720-808)
- Dashboard-specific API (lines 814-865)

### 4. CSS_BUILD_INTEGRATION.md - Lines 125-318
**What to focus on:**
- Dashboard CSS structure (Phase 2 section)
- Fire TV compatibility rules
- BEM naming examples
- What to avoid (webkit-mask, viewport units)

---

## Files to Create

```
js/modules/Dashboard/
├── dashboard.js                       # Module public API
├── dashboard-input-handler.js         # D-pad/keyboard input handlers
├── dashboard-state-manager.js         # Dashboard state (grid position, menu state)
├── dashboard-navigation-manager.js    # Grid + menu navigation logic
├── dashboard-ui-renderer.js           # DOM rendering & updates
└── dashboard-focus-menu-manager.js    # Focus menu system (optional, can be in ui-renderer)

css/modules/
└── dashboard.css                      # Dashboard styles (BEM naming)
```

---

## Legacy Code Reference

**Use these for understanding behavior ONLY - don't copy directly:**

1. **`.legacy/js/core/navigation.js`** - Lines 1-1052
   - Grid navigation patterns (lines 120-350)
   - Menu navigation (lines 351-500)
   - Widget focus logic (lines 501-750)
   - **Note:** This is being consolidated INTO Dashboard module

2. **`.legacy/js/core/state.js`** - Lines 42-120
   - Grid position state structure
   - State persistence patterns

3. **`.legacy/js/ui/grid.js`** - Lines 1-250
   - Grid rendering patterns
   - Focus indicator updates

4. **`.legacy/css/components/navigation.css`** - Lines 1-203
   - **Note:** Has 13 `!important` declarations to eliminate
   - Has `-webkit-mask` to replace (not Fire TV compatible)
   - Transform patterns (some need fixing)

---

## Implementation Steps

### Step 1: Create Module Structure

**Create files with stubs:**
1. `js/modules/Dashboard/dashboard.js` - Module interface skeleton
2. `js/modules/Dashboard/dashboard-input-handler.js` - Stub handlers (return false)
3. `js/modules/Dashboard/dashboard-state-manager.js` - Initial state structure

**Register with ActionRouter:**
```javascript
// In main.js
import Dashboard from './js/modules/Dashboard/dashboard.js';
import DashboardInputHandler from './js/modules/Dashboard/dashboard-input-handler.js';

await Dashboard.initialize();
ActionRouter.registerModule('dashboard', DashboardInputHandler);
AppStateManager.setCurrentModule('dashboard');
```

**Success criteria:**
- [ ] Dashboard module loads without errors
- [ ] ActionRouter recognizes Dashboard handlers
- [ ] No "no handler registered" warnings in console

---

### Step 2: Implement State Management

**Create dashboard-state-manager.js:**
```javascript
class DashboardStateManager {
    static state = {
        gridPosition: { row: 0, col: 0 },
        focusedWidget: null,
        menuOpen: false,
        selectedMenuItem: 0,
        isActive: false
    };

    static async initialize() {
        // Load from localStorage if exists
    }

    static getState() {
        return { ...this.state };
    }

    static setState(partialState) {
        this.state = { ...this.state, ...partialState };
        this.persist();
    }

    static persist() {
        localStorage.setItem('dashie-dashboard-state', JSON.stringify(this.state));
    }
}
```

**Success criteria:**
- [ ] State initializes with defaults
- [ ] State persists to localStorage
- [ ] State loads on refresh

---

### Step 3: Implement Input Handlers

**Create dashboard-input-handler.js:**
```javascript
import NavigationManager from './dashboard-navigation-manager.js';

class DashboardInputHandler {
    static enabled = false;

    static enable() { this.enabled = true; }
    static disable() { this.enabled = false; }

    static handleUp(originalEvent) {
        if (!this.enabled) return false;
        return NavigationManager.moveUp();
    }

    static handleDown(originalEvent) {
        if (!this.enabled) return false;
        return NavigationManager.moveDown();
    }

    static handleLeft(originalEvent) {
        if (!this.enabled) return false;
        return NavigationManager.moveLeft();
    }

    static handleRight(originalEvent) {
        if (!this.enabled) return false;
        return NavigationManager.moveRight();
    }

    static handleEnter(originalEvent) {
        if (!this.enabled) return false;
        return NavigationManager.handleEnter();
    }

    static handleEscape(originalEvent) {
        if (!this.enabled) return false;
        return NavigationManager.handleEscape();
    }
}

export default DashboardInputHandler;
```

**Success criteria:**
- [ ] Arrow keys trigger correct handlers
- [ ] Handlers return true when handled
- [ ] enabled/disabled state works

---

### Step 4: Implement Navigation Logic

**Create dashboard-navigation-manager.js:**

Key methods needed:
- `moveUp()` - Navigate grid up or menu up
- `moveDown()` - Navigate grid down or menu down
- `moveLeft()` - Navigate grid left or open menu at column 0
- `moveRight()` - Navigate grid right or close menu
- `handleEnter()` - Select menu item or focus widget
- `handleEscape()` - Close menu or defocus widget
- `openMenu()` / `closeMenu()`
- `focusWidget()` / `defocusWidget()`

**Grid logic:**
- 2 rows × 3 columns (6 widgets total)
- Positions: [0,0] [0,1] [0,2] [1,0] [1,1] [1,2]
- Boundary detection (don't wrap around)
- Left at column 0 → open menu

**Menu logic:**
- 7 menu items (calendar, map, camera, reload, sleep, settings, exit)
- Up/down cycles through items
- Enter executes action
- Right arrow closes menu

**Success criteria:**
- [ ] Grid navigation works with arrow keys
- [ ] Focus indicator moves correctly
- [ ] Menu opens/closes correctly
- [ ] Menu navigation cycles through items

---

### Step 5: Implement UI Rendering

**Create dashboard-ui-renderer.js:**

Key methods needed:
- `render()` - Create initial DOM structure
- `hide()` - Remove/hide DOM
- `updateFocus()` - Update visual focus indicator
- `showMenu()` / `hideMenu()` - Menu expand/collapse
- `updateMenuSelection()` - Update selected menu item
- `focusWidget()` / `defocusWidget()` - Widget focus visuals

**DOM structure:**
```html
<div class="dashboard">
    <aside class="dashboard-sidebar">
        <div class="dashboard-menu">
            <button class="dashboard-menu__item">Calendar</button>
            <button class="dashboard-menu__item">Map</button>
            <!-- ... 5 more items -->
        </div>
    </aside>
    <main class="dashboard-grid">
        <div class="dashboard-grid__cell" data-row="0" data-col="0">
            <div class="widget-placeholder">Calendar</div>
        </div>
        <!-- ... 5 more cells -->
    </main>
</div>
```

**Success criteria:**
- [ ] Dashboard renders on activation
- [ ] Focus indicator visible and updates
- [ ] Menu expands/collapses smoothly
- [ ] Selected menu item highlights

---

### Step 6: Create Dashboard CSS

**Create css/modules/dashboard.css:**

**CRITICAL: Follow Fire TV compatibility rules:**
- ❌ NO `!important` (except utility classes)
- ❌ NO viewport units with transforms
- ❌ NO `-webkit-mask`
- ❌ NO complex filters
- ✅ USE percentages for sizing
- ✅ USE simple transitions (opacity, border-color)
- ✅ USE CSS variables for dynamic values
- ✅ USE BEM naming

**Example structure:**
```css
/* Container */
.dashboard {
  display: flex;
  height: 100vh;
  width: 100vw;
}

/* Sidebar */
.dashboard-sidebar {
  width: 60px;
  transition: width var(--transition-normal);
}

.dashboard-sidebar--expanded {
  width: 200px;
}

/* Menu items */
.dashboard-menu__item {
  /* Base styles */
  border: 2px solid transparent;
  transition: border-color var(--transition-normal);
}

.dashboard-menu__item--selected {
  border-color: var(--color-accent);
}

/* Grid */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: var(--spacing-md);
}

.dashboard-grid__cell {
  border: 2px solid transparent;
  transition: border-color var(--transition-normal);
}

.dashboard-grid__cell--focused {
  border-color: yellow; /* High contrast for TV */
}
```

**Success criteria:**
- [ ] CSS uses BEM naming throughout
- [ ] Zero `!important` declarations
- [ ] No webkit-mask, viewport units, or complex filters
- [ ] Passes stylelint with zero errors
- [ ] Visual rendering correct on desktop

---

## Key Architecture Points

### 1. Input Flow
```
User presses arrow key
  ↓
InputHandler (core) normalizes to 'up' action
  ↓
AppComms publishes 'input:action'
  ↓
ActionRouter receives event
  ↓
ActionRouter calls Dashboard.inputHandler.handleUp()
  ↓
Dashboard.navigationManager.moveUp()
  ↓
Dashboard.stateManager updates gridPosition
  ↓
Dashboard.uiRenderer.updateFocus()
```

### 2. CSS State Management Pattern
```javascript
// ❌ BAD: Inline styles
element.style.transform = 'translateX(10px)';

// ✅ GOOD: CSS classes + CSS variables
element.classList.add('dashboard-menu__item--centered');
element.style.setProperty('--center-offset', '10px');
```

```css
.dashboard-menu__item--centered {
  transform: translateX(var(--center-offset, 0px));
}
```

### 3. Singleton Pattern
All Dashboard sub-components use static methods (singleton pattern):
```javascript
// ✅ Correct
import StateManager from './state-manager.js';
StateManager.setState({ ... });

// ❌ Don't do this
const manager = new StateManager(); // No instances
```

---

## Testing Checklist

### Functional Tests
- [ ] App loads and shows dashboard
- [ ] Arrow keys navigate grid (2×3)
- [ ] Focus indicator visible and moves correctly
- [ ] Left arrow at column 0 opens menu
- [ ] Right arrow closes menu
- [ ] Up/down arrows navigate menu
- [ ] Enter on menu item logs action
- [ ] Escape closes menu
- [ ] Grid position persists on refresh

### Code Quality Tests
- [ ] No console errors
- [ ] No console warnings
- [ ] ActionRouter routes correctly
- [ ] State persists to localStorage
- [ ] CSS passes stylelint
- [ ] BEM naming throughout CSS
- [ ] Zero `!important` in CSS
- [ ] Module implements standard interface

---

## Common Pitfalls to Avoid

### 1. Don't Copy Legacy Code Directly
❌ **Wrong:** Copy navigation.js and make minor tweaks
✅ **Right:** Understand the behavior, rewrite with new patterns

### 2. Don't Use Inline Styles
❌ **Wrong:** `element.style.transform = 'translateX(10px)'`
✅ **Right:** CSS classes + CSS variables

### 3. Don't Use !important
❌ **Wrong:** `.override { color: red !important; }`
✅ **Right:** Proper CSS specificity with BEM

### 4. Don't Forget Fire TV Compatibility
❌ **Wrong:** Use any CSS feature that looks cool
✅ **Right:** Check against compatibility rules first

### 5. Don't Skip Testing Each Step
❌ **Wrong:** Build everything then test
✅ **Right:** Test after each step (state, input, nav, UI, CSS)

---

## Success Criteria

### Phase 2 Complete When:
- [ ] Dashboard module structure created
- [ ] Input handler registered and working
- [ ] Grid navigation works (2×3)
- [ ] Menu navigation works (7 items)
- [ ] Dashboard CSS complete with BEM naming
- [ ] Zero `!important` in CSS
- [ ] Zero inline styles in JavaScript
- [ ] All Fire TV compatibility rules followed
- [ ] State persists correctly
- [ ] No console errors or warnings

---

## Next Steps

When Phase 2 is complete, move to:
**Phase 3: Data Layer** (Auth, JWT, Services)

See: `.reference/build-plans/Phase 3 - Data Layer.md`

---

## Quick Reference

### Updated Action Names
- `prev` (not prev-view)
- `next` (not next-view)
- `play-pause` (not sleep-toggle)

### Module Interface (Must Implement)
```javascript
{
  initialize: async () => {},
  activate: () => {},
  deactivate: () => {},
  destroy: () => {},
  getState: () => {},
  setState: (state) => {}
}
```

### Input Handler Interface (Must Implement)
```javascript
{
  handleUp: (event) => boolean,
  handleDown: (event) => boolean,
  handleLeft: (event) => boolean,
  handleRight: (event) => boolean,
  handleEnter: (event) => boolean,
  handleEscape: (event) => boolean
}
```

---

**Ready to build! You've got this. The foundation is solid - now let's build the first real feature on top of it.** 🚀
