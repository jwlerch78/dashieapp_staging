# Phase 2 Handoff - Dashboard Module Implementation

**Date:** 2025-10-15
**Phase:** Phase 2 - Dashboard Module (Week 2)
**Status:** Ready to Begin
**Context:** Fresh session starting Phase 2 implementation

---

## Quick Start Instructions

This is a **ground-up rebuild** of the Dashie dashboard application. We've completed Phase 1 (core infrastructure) and are now beginning Phase 2 (Dashboard module).

**Key Information:**
- **Platform:** Fire TV (Amazon WebView), Desktop, Mobile
- **Stack:** Vanilla JavaScript (ES6 modules), Vanilla CSS, Supabase backend
- **Architecture:** Modular, event-driven, component-based
- **Target:** Smart TV D-pad navigation with keyboard/mouse support

---

## What's Been Completed (Phase 1)

### ✅ Core Infrastructure (Week 1)

All core components are **built, tested, and working**:

1. **config.js** - Single source of truth for all defaults ✅
   - Location: [config.js](../config.js)
   - Includes: STORAGE_KEYS, getDefaultSettings(), widget commands, validation rules

2. **Utility Infrastructure** ✅
   - [js/utils/logger.js](../js/utils/logger.js) - Comprehensive logging with log levels
   - [js/utils/logger-config.js](../js/utils/logger-config.js) - Debug mode toggle
   - [js/utils/console-commands.js](../js/utils/console-commands.js) - Browser console debugging
   - [js/utils/platform-detector.js](../js/utils/platform-detector.js) - Platform detection (copied from legacy)
   - [js/utils/fs-bridge.js](../js/utils/fs-bridge.js) - MCP filesystem bridge placeholder

3. **Core Components (Singletons)** ✅
   - [js/core/app-comms.js](../js/core/app-comms.js) - Pub/sub event bus (25+ events)
   - [js/core/app-state-manager.js](../js/core/app-state-manager.js) - Global state (runtime-only, no localStorage)
   - [js/core/input-handler.js](../js/core/input-handler.js) - Input normalization (keyboard/dpad/touch)
   - [js/core/action-router.js](../js/core/action-router.js) - Routes actions to modules
   - [js/core/widget-messenger.js](../js/core/widget-messenger.js) - Widget postMessage communication

4. **Test Page** ✅
   - [index.html](../index.html) - Beautiful test page with live log output
   - All tests passing (see [TESTING_NOTES.md](.reference/TESTING_NOTES.md))

### ✅ Documentation Complete

1. **[ARCHITECTURE.md](.reference/ARCHITECTURE.md)** - Complete system architecture
   - Two-layer authentication (account auth vs calendar auth)
   - Token storage separation (HIGH PRIORITY technical debt integrated)
   - Shared calendar ID prefixing (HIGH PRIORITY technical debt integrated)
   - **CSS/Styling Architecture section** (Fire TV compatibility guidelines)

2. **[API_INTERFACES.md](.reference/API_INTERFACES.md)** - Component interfaces (v2.2)
   - Core component APIs
   - Module interface specification
   - Data layer interfaces
   - **Multi-provider auth interfaces** (BaseAccountAuth, BaseCalendarAuth)
   - **TokenStore interface** (separate auth token storage)
   - **CalendarService with prefixed calendar IDs**

3. **[BUILD_STRATEGY.md](.reference/BUILD_STRATEGY.md)** - Implementation guide (v2.1)
   - Phase-by-phase build plan
   - **Technical debt integration** (multi-provider auth, token separation, shared calendar IDs)
   - Timeline: 6-8 weeks total

4. **[CSS_ASSESSMENT.md](.reference/CSS_ASSESSMENT.md)** - Legacy CSS analysis
   - 87 `!important` declarations to eliminate
   - 24 JS files with inline styles
   - Fire TV WebView compatibility issues identified

5. **[CSS_BUILD_INTEGRATION.md](.reference/CSS_BUILD_INTEGRATION.md)** - CSS development plan
   - Phase-by-phase CSS implementation
   - Fire TV compatibility rules
   - **Stylelint configuration** (linting setup)
   - **Why vanilla CSS** (no preprocessor needed)

6. **[TECHNICAL_DEBT.md](.reference/TECHNICAL_DEBT.md)** - Known issues and fixes
   - High-priority items integrated into architecture
   - Medium/low priority items documented for post-launch

7. **[TESTING_NOTES.md](.reference/TESTING_NOTES.md)** - Phase 1 test results
   - All tests passing ✅
   - Action names updated (prev/next, play-pause)

---

## Phase 2 Goal: Dashboard Module

**Timeline:** Days 8-14 (Week 2)

**Objective:** Build the Dashboard module - the main view showing the 2x3 widget grid, sidebar menu, and focus navigation.

### What We're Building

**Dashboard Module Structure:**
```
js/modules/Dashboard/
├── index.js                    # Public API
├── input-handler.js            # D-pad/keyboard input handling
├── state-manager.js            # Dashboard state (grid position, focused widget)
├── navigation-manager.js       # Grid + menu + focus navigation
├── ui-renderer.js              # Dashboard UI rendering
└── focus-menu-manager.js       # Focus menu system
```

**Dashboard CSS:**
```
css/modules/dashboard.css       # Replaces legacy navigation.css
```

### Key Architecture Decisions

#### 1. Navigation Consolidation
**Decision:** Legacy navigation.js (1,052 lines) is absorbed into Dashboard module

**Why?**
- 80% of navigation.js is Dashboard-specific UI logic
- 20% generic widget communication already exists (widget-messenger.js)
- Keeps Dashboard self-contained

**What goes where:**
| Functionality | Location |
|--------------|----------|
| Grid navigation (2x3) | Dashboard/navigation-manager.js |
| Menu navigation | Dashboard/navigation-manager.js |
| Widget focus/defocus | Dashboard/navigation-manager.js |
| Widget centering & overlay | Dashboard/ui-renderer.js |
| Timeout management | Dashboard/navigation-manager.js |
| Widget postMessage | core/widget-messenger.js (already exists) |

#### 2. CSS Refactoring
**Decision:** Rewrite legacy navigation.css as dashboard.css with Fire TV compatibility

**Critical Changes:**
- ✅ Eliminate 13 `!important` declarations (use proper specificity)
- ✅ Replace `-webkit-mask` with Fire TV-compatible alternatives
- ✅ Use BEM naming: `.dashboard-menu__item--selected`
- ✅ CSS variables for dynamic values: `--center-offset`
- ✅ No viewport units with transforms (use percentages)
- ✅ Minimal transform usage (only on focused elements)

**See:** [CSS_BUILD_INTEGRATION.md](.reference/CSS_BUILD_INTEGRATION.md) Phase 2 section

#### 3. Input Flow
```
User Input (D-pad/Keyboard)
  ↓
InputHandler (normalizes to 'up', 'down', 'enter', etc.)
  ↓
AppComms.publish('input:action', { action, originalEvent })
  ↓
ActionRouter (routes based on currentModule)
  ↓
Dashboard.inputHandler.handleUp() / handleDown() / etc.
  ↓
Dashboard.navigationManager (updates grid position)
  ↓
Dashboard.stateManager (updates state)
  ↓
Dashboard.uiRenderer (re-renders UI)
```

---

## Important Context

### 1. Action Names (UPDATED)

Action names were updated for function-agnosticism:

**Updated Actions:**
- `prev` (was: prev-view) - Generic previous view/page
- `next` (was: next-view) - Generic next view/page
- `play-pause` (was: sleep-toggle) - Generic play/pause or toggle

**Handler Methods:**
```javascript
// Module input handler interface
{
  handleUp: (event) => boolean,
  handleDown: (event) => boolean,
  handleLeft: (event) => boolean,
  handleRight: (event) => boolean,
  handleEnter: (event) => boolean,
  handleEscape: (event) => boolean,
  handleMenu: (event) => boolean,
  handleSpace: (event) => boolean,
  handlePrev: (event) => boolean,        // ← Updated
  handleNext: (event) => boolean,        // ← Updated
  handlePlayPause: (event) => boolean,   // ← New
}
```

Return `true` if handled, `false` to bubble up.

---

### 2. CSS Guidelines (Fire TV Compatibility)

**❌ AVOID on Fire TV:**
```css
/* Viewport units with transforms */
width: 50vw;
transform: translate(-50%, 0); /* ❌ May not work on Chromium v25 */

/* Webkit-mask */
-webkit-mask: linear-gradient(...); /* ❌ May not render on Amazon WebView */

/* Complex filters */
filter: blur(10px) drop-shadow(...); /* ❌ Performance hit */

/* TranslateZ() overuse */
transform: translateZ(0); /* ❌ Each creates composited layer */
```

**✅ SAFE on Fire TV:**
```css
/* Percentages with transforms */
width: 50%;
transform: translate(-50%, 0); /* ✅ Works */

/* Simple shadows */
box-shadow: 0 0 20px rgba(0,0,0,0.5); /* ✅ Use instead of webkit-mask */

/* Simple transitions */
transition: opacity 0.3s ease, border-color 0.3s ease; /* ✅ Fast */

/* CSS variables */
transform: translateX(var(--center-offset, 0px)); /* ✅ Dynamic values */
```

**See:** [ARCHITECTURE.md](.reference/ARCHITECTURE.md) CSS/Styling Architecture section

---

### 3. State Management Pattern

**Use CSS classes for states, CSS variables for dynamic values:**

```css
.dashboard-menu__item {
  transform: translateX(0) scale(1);
  opacity: 0.7;
  transition: all 0.3s ease;
}

.dashboard-menu__item--focused {
  opacity: 1;
}

.dashboard-menu__item--centered {
  transform: translateX(var(--center-offset, 0px)) scale(1.1);
}
```

```javascript
// JavaScript only toggles classes and sets CSS variables
function selectMenuItem(element, offset) {
  element.classList.add('centered');
  element.style.setProperty('--center-offset', `${offset}px`);
}
```

**Benefits:**
- All styling in CSS (themeable)
- JS only manages state
- No inline styles
- Browser can optimize transitions

---

### 4. Singleton Pattern

All core components use singleton instances (lowercase exports):

```javascript
// ✅ Correct (singleton instance)
import AppComms from './js/core/app-comms.js';
AppComms.publish('event', data);

// ❌ Wrong (static class - not used)
class AppComms {
  static publish() {}
}
```

**Why singletons:**
- Better testability (can be mocked/reset)
- Clearer dependency management
- Easier to extend

---

### 5. Logging

**Use logger, not console.log:**

```javascript
import { createLogger } from '../utils/logger.js';
const logger = createLogger('Dashboard');

logger.debug('Debug info');  // Only if dashieDebug.enable()
logger.info('General info');
logger.warn('Warning');
logger.error('Error', errorObject);
logger.success('Success');
```

---

## Phase 2 Implementation Steps

### Day 8: Dashboard Module Structure

**Tasks:**
1. Create Dashboard module folder structure
2. Create index.js (public API)
3. Create input-handler.js (stub handlers)
4. Create state-manager.js (grid position, focus state)
5. Register Dashboard with ActionRouter
6. Test that ActionRouter routes to Dashboard handlers

**Files to create:**
- `js/modules/Dashboard/index.js`
- `js/modules/Dashboard/input-handler.js`
- `js/modules/Dashboard/state-manager.js`

**Success criteria:**
- [ ] Dashboard module loads
- [ ] Input handler registered with ActionRouter
- [ ] ActionRouter routes actions to Dashboard
- [ ] No more "no handler registered" warnings

---

### Day 9-10: Dashboard CSS Setup

**Tasks:**
1. Set up Stylelint (if not already done)
2. Create `css/modules/dashboard.css`
3. Implement base dashboard layout (sidebar + grid)
4. Use BEM naming throughout
5. Apply Fire TV compatibility rules

**CSS Structure:**
```css
/* Dashboard container */
.dashboard { }

/* Sidebar */
.dashboard-sidebar { }
.dashboard-sidebar--expanded { }

/* Grid */
.dashboard-grid { }
.dashboard-grid__cell { }
.dashboard-grid__cell--focused { }

/* Menu */
.dashboard-menu { }
.dashboard-menu__item { }
.dashboard-menu__item--focused { }
.dashboard-menu__item--selected { }
.dashboard-menu__item--centered { }
```

**Success criteria:**
- [ ] Dashboard CSS file created
- [ ] BEM naming used
- [ ] No `!important` declarations
- [ ] No viewport units with transforms
- [ ] No `-webkit-mask`
- [ ] Passes stylelint

---

### Day 11-12: Grid Navigation

**Tasks:**
1. Implement `navigation-manager.js`
2. Grid navigation (2x3 grid)
3. Focus indicators
4. State persistence (grid position)
5. Update UI on navigation

**Grid Logic:**
- 2 rows × 3 columns
- Arrow key navigation (up/down/left/right)
- Wrap-around or boundary detection
- Visual focus indicator

**Success criteria:**
- [ ] Grid navigation works with arrow keys
- [ ] Focus indicator visible
- [ ] Grid position persists in state
- [ ] UI updates on navigation

---

### Day 13: Menu Navigation

**Tasks:**
1. Implement menu navigation in `navigation-manager.js`
2. Menu items (7 items)
3. Menu focus states
4. Menu selection
5. Escape to return to grid

**Menu Items:**
1. Settings
2. Calendar
3. Photos
4. Weather
5. Sleep
6. Refresh
7. Exit

**Success criteria:**
- [ ] Menu navigation works with arrow keys
- [ ] Menu focus indicator visible
- [ ] Enter key selects menu item
- [ ] Escape returns to grid

---

### Day 14: Widget Focus & Polish

**Tasks:**
1. Implement widget focus/defocus
2. Widget centering (if needed)
3. Timeout management (20s selection, 60s focus)
4. Focus menu system
5. Polish transitions

**Success criteria:**
- [ ] Widget focus works (Enter key)
- [ ] Widget defocus works (Escape key)
- [ ] Timeouts work correctly
- [ ] Transitions smooth (30+ FPS target)
- [ ] Dashboard module complete!

---

## Key Files to Reference

### Core Components (Already Built)
- [js/core/app-comms.js](../js/core/app-comms.js) - Use for pub/sub
- [js/core/app-state-manager.js](../js/core/app-state-manager.js) - Use for global state
- [js/core/input-handler.js](../js/core/input-handler.js) - Already normalizing input
- [js/core/action-router.js](../js/core/action-router.js) - Already routing actions
- [js/core/widget-messenger.js](../js/core/widget-messenger.js) - Use for widget communication

### Configuration
- [config.js](../config.js) - Use for defaults (GRID_ROWS, GRID_COLS, etc.)

### Utilities
- [js/utils/logger.js](../js/utils/logger.js) - Use for logging

### Documentation
- [.reference/ARCHITECTURE.md](.reference/ARCHITECTURE.md) - System architecture
- [.reference/API_INTERFACES.md](.reference/API_INTERFACES.md) - Component interfaces
- [.reference/BUILD_STRATEGY.md](.reference/BUILD_STRATEGY.md) - Build plan
- [.reference/CSS_BUILD_INTEGRATION.md](.reference/CSS_BUILD_INTEGRATION.md) - CSS plan

### Legacy Code (Reference Only)
- `.legacy/js/core/navigation.js` - Legacy navigation logic (1,052 lines)
- `.legacy/css/components/navigation.css` - Legacy navigation CSS (203 lines)

**NOTE:** Do NOT copy legacy code directly. Use as reference for understanding behavior, then rewrite with new architecture.

---

## Testing Strategy

### Test on Desktop First
- Use index.html test page
- Verify with keyboard navigation
- Check browser console for errors
- Validate with logger output

### Defer Fire TV Testing
**Wait until we have:**
- Dashboard module complete
- CSS refactored
- Functional widget focus

**Then deploy to:**
- Fire TV stick (hardware)
- Google Play TV (hardware)

---

## Success Criteria for Phase 2

### Dashboard Module Complete ✅ When:
- [ ] Dashboard module structure created
- [ ] Input handler registered and working
- [ ] Grid navigation works (2×3)
- [ ] Menu navigation works (7 items)
- [ ] Widget focus/defocus works
- [ ] CSS refactored (dashboard.css)
- [ ] No `!important` in CSS (except utilities)
- [ ] No inline styles in JS (except CSS variables)
- [ ] BEM naming throughout CSS
- [ ] Fire TV compatibility rules followed
- [ ] All tests passing on desktop
- [ ] Smooth transitions (30+ FPS target)

### Ready for Phase 3 ✅ When:
- Dashboard module fully functional
- Can navigate grid with keyboard/D-pad
- Can open menu and select items
- Can focus/defocus widgets
- CSS is Fire TV-compatible

---

## Common Pitfalls to Avoid

### 1. Don't Copy Legacy Code Directly
❌ **Wrong:** Copy navigation.js and make minor changes

✅ **Right:** Understand behavior, rewrite with new architecture

### 2. Don't Use Inline Styles
❌ **Wrong:** `element.style.transform = 'translateX(10px)'`

✅ **Right:** Use CSS classes and CSS variables

### 3. Don't Use !important
❌ **Wrong:** `.override { color: red !important; }`

✅ **Right:** Proper specificity with BEM naming

### 4. Don't Skip Fire TV Compatibility Checks
❌ **Wrong:** Use any CSS feature that looks cool

✅ **Right:** Check against Fire TV compatibility rules

### 5. Don't Forget to Use Logger
❌ **Wrong:** `console.log('Debug info')`

✅ **Right:** `logger.debug('Debug info')`

---

## Questions to Ask if Stuck

1. **Architecture questions:** Check [ARCHITECTURE.md](.reference/ARCHITECTURE.md)
2. **Interface questions:** Check [API_INTERFACES.md](.reference/API_INTERFACES.md)
3. **Implementation questions:** Check [BUILD_STRATEGY.md](.reference/BUILD_STRATEGY.md)
4. **CSS questions:** Check [CSS_BUILD_INTEGRATION.md](.reference/CSS_BUILD_INTEGRATION.md)
5. **Legacy behavior questions:** Check `.legacy/` folder (reference only)

---

## Quick Reference

### Event Names (AppComms)
```javascript
AppComms.events.MODULE_CHANGED
AppComms.events.STATE_UPDATED
AppComms.events.INPUT_ACTION
AppComms.events.FOCUS_CHANGED
AppComms.events.WIDGET_MESSAGE
// ... 20+ more (see app-comms.js)
```

### Action Names (InputHandler)
```javascript
['up', 'down', 'left', 'right', 'enter', 'escape',
 'menu', 'space', 'prev', 'next', 'play-pause']
```

### Module Names (Valid)
```javascript
['dashboard', 'settings', 'login', 'modals', 'welcome']
```

### Focus Contexts
```javascript
['grid', 'menu', 'widget', 'modal']
```

---

## Final Notes

### Phase 1 Status: COMPLETE ✅
- Core infrastructure built and tested
- All components working
- Documentation complete
- Ready for Phase 2

### Phase 2 Status: READY TO BEGIN 🚀
- Clear goals defined
- Architecture decided
- Implementation steps outlined
- Success criteria established

### Confidence Level: HIGH 💪
- Core foundation proven to work
- Architecture validated with tests
- CSS plan addresses Fire TV compatibility
- Legacy code available for reference

---

**Good luck with Phase 2! The foundation is solid - now let's build something great on top of it.** 🎉

---

## To Start Phase 2

1. **Read this entire document** ✅
2. **Review key documentation:**
   - [ARCHITECTURE.md](.reference/ARCHITECTURE.md) - Dashboard Module section
   - [API_INTERFACES.md](.reference/API_INTERFACES.md) - Module interfaces
   - [CSS_BUILD_INTEGRATION.md](.reference/CSS_BUILD_INTEGRATION.md) - Phase 2 section
3. **Create Dashboard module structure:**
   - `js/modules/Dashboard/index.js`
   - `js/modules/Dashboard/input-handler.js`
   - `js/modules/Dashboard/state-manager.js`
4. **Start with Day 8 tasks** (see above)
5. **Test incrementally** as you build
6. **Ask questions** if anything is unclear

**Let's build! 🚀**
