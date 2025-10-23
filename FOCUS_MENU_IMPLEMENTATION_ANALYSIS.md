# Focus Menu Implementation - Code Changes Analysis

## Overview
This document outlines all code changes needed to implement widget focus menus, with before/after LOC estimates.

---

## Summary Statistics

| Category | Files | Current LOC | Added LOC | Final LOC | Change % |
|----------|-------|-------------|-----------|-----------|----------|
| **New Files** | 2 | 0 | ~790 | 790 | +100% |
| **Modified Files** | 6 | 2,219 | ~350 | 2,569 | +16% |
| **CSS Updates** | 1 | N/A | ~231 | 231 | New |
| **Total** | 9 | 2,219 | ~1,371 | 3,590 | +62% |

---

## Files to Create (New)

### 1. `js/modules/Dashboard/components/focus-menu-renderer.js`
**Purpose**: Render and manage focus menu UI overlay

**Estimated LOC**: ~430 lines (based on legacy focus-menu.js)

**Key Functions**:
```javascript
// Menu lifecycle
showFocusMenu(widgetElement, menuConfig)    // ~50 LOC
hideFocusMenu()                             // ~10 LOC
isFocusMenuVisible()                        // ~5 LOC

// Menu creation
createMenuSection(items, selectedIndex)     // ~40 LOC
createMenuItem(item, isSelected, isActive)  // ~35 LOC
getMenuIcon(itemId)                         // ~80 LOC (icon SVG map)

// Menu updates
updateMenuSelection(selectedIndex)          // ~25 LOC
dimFocusMenu()                              // ~10 LOC
undimFocusMenu()                            // ~10 LOC

// Positioning
positionMenu(menu, widgetElement)           // ~60 LOC
centerWidgetWithMenu(widgetElement)         // ~40 LOC

// Event handlers
handleMenuItemClick(itemId)                 // ~15 LOC

// Cleanup
cleanup()                                   // ~10 LOC
```

**Dependencies**:
- DashboardStateManager (for state access)
- WidgetMessenger (for sending commands to widget)
- Logger

**Complexity**: Medium - mostly DOM manipulation and positioning logic

---

### 2. `js/modules/Dashboard/components/focus-menu-state-manager.js`
**Purpose**: Track widget menu configurations and state

**Estimated LOC**: ~130 lines (based on legacy focus-menu-state.js)

**Key Functions**:
```javascript
// Registration
registerWidgetMenu(widgetId, menuConfig)    // ~20 LOC
unregisterWidgetMenu(widgetId)              // ~10 LOC

// Retrieval
getWidgetMenuConfig(widgetId)               // ~10 LOC
hasWidgetMenu(widgetId)                     // ~5 LOC
getRegisteredWidgets()                      // ~5 LOC

// Navigation
moveMenuSelection(direction)                // ~25 LOC
getCurrentMenuItem()                        // ~10 LOC

// Validation
validateMenuConfig(config)                  // ~30 LOC
```

**Data Structure**:
```javascript
// Map: widgetId → menuConfig
widgetMenuConfigs = new Map();

// menuConfig structure:
{
  enabled: boolean,
  defaultIndex: number,
  currentView: string,
  items: [
    { id: string, label: string, type: 'action'|'view' }
  ]
}
```

**Complexity**: Low - simple state management and Map operations

---

### 3. `css/components/focus-menu.css`
**Purpose**: Visual styling for focus menu overlay

**Estimated LOC**: ~230 lines (port from legacy)

**Key Styles**:
```css
/* Menu container */
.focus-menu { }                              // ~20 LOC

/* Menu states */
.focus-menu.dimmed { }                       // ~5 LOC

/* Menu items */
.focus-menu-item { }                         // ~15 LOC
.focus-menu-item.selected { }                // ~5 LOC
.focus-menu-item.active { }                  // ~10 LOC
.menu-action-button { }                      // ~15 LOC

/* Menu sections */
.menu-section { }                            // ~10 LOC
.menu-divider { }                            // ~5 LOC

/* Icons and labels */
.menu-icon { }                               // ~5 LOC
.menu-label { }                              // ~5 LOC

/* Controls guide (footer) */
.controls-guide { }                          // ~20 LOC

/* Animations */
@keyframes slideIn { }                       // ~10 LOC

/* Responsive */
@media queries { }                           // ~20 LOC
```

**Complexity**: Low - mostly straightforward CSS rules

---

## Files to Modify (Existing)

### 4. `js/modules/Dashboard/dashboard-state-manager.js`
**Current LOC**: 222
**Added LOC**: ~50
**Final LOC**: ~272
**Change**: +22%

#### Changes Required:

**A. Add focus menu state to state object** (line ~23)
```javascript
// BEFORE:
static state = {
  gridPosition: { row: 1, col: 1 },
  focusedWidget: null,
  menuOpen: false,
  selectedMenuItem: 0,
  isActive: false,
  isIdle: true
};

// AFTER:
static state = {
  gridPosition: { row: 1, col: 1 },
  focusedWidget: null,
  menuOpen: false,
  selectedMenuItem: 0,
  isActive: false,
  isIdle: true,

  // Focus menu state
  focusMenuState: {
    active: false,        // Is focus menu visible?
    widgetId: null,       // Which widget has menu?
    menuConfig: null,     // Menu configuration
    selectedIndex: 0,     // Currently selected menu item
    inMenu: true          // true = in menu, false = in widget content
  }
};
```

**B. Add focus menu state methods** (add at end, ~40 LOC)
```javascript
/**
 * Set focus menu active state
 * @param {string} widgetId - Widget with focus menu
 * @param {Object} menuConfig - Menu configuration
 */
static setFocusMenuActive(widgetId, menuConfig) {
  this.state.focusMenuState = {
    active: true,
    widgetId,
    menuConfig,
    selectedIndex: menuConfig.defaultIndex || 0,
    inMenu: true
  };
  logger.debug('Focus menu activated', { widgetId });
}

/**
 * Clear focus menu state
 */
static clearFocusMenuState() {
  this.state.focusMenuState = {
    active: false,
    widgetId: null,
    menuConfig: null,
    selectedIndex: 0,
    inMenu: true
  };
  logger.debug('Focus menu cleared');
}

/**
 * Set focus menu selection
 * @param {number} selectedIndex - Menu item index
 */
static setFocusMenuSelection(selectedIndex) {
  this.state.focusMenuState.selectedIndex = selectedIndex;
}

/**
 * Toggle between menu and widget control
 * @param {boolean} inMenu - True if in menu, false if in widget
 */
static setFocusMenuInWidget(inMenu) {
  this.state.focusMenuState.inMenu = inMenu;
  logger.debug('Focus menu mode changed', { inMenu });
}
```

**Complexity**: Low - straightforward state management additions

---

### 5. `js/modules/Dashboard/dashboard-navigation-manager.js`
**Current LOC**: 511
**Added LOC**: ~60
**Final LOC**: ~571
**Change**: +12%

#### Changes Required:

**A. Import focus menu modules** (line ~10)
```javascript
// ADD:
import FocusMenuRenderer from './components/focus-menu-renderer.js';
import FocusMenuStateManager from './components/focus-menu-state-manager.js';
```

**B. Update `focusWidget()` method** (line ~400, replace ~40 LOC with ~70 LOC)
```javascript
// BEFORE:
static focusWidget() {
  const state = DashboardStateManager.getState();
  const { row, col } = state.gridPosition;
  const widget = getWidgetAtPosition(row, col);

  if (!widget) {
    logger.warn('No widget at position', { row, col });
    return false;
  }

  const shouldCenter = canWidgetCenter(widget.id);
  const hasFocusMenu = false; // TODO: Check widget config for focus menu

  DashboardStateManager.setFocusedWidget(widget.id);
  UIRenderer.focusWidget(widget.id, hasFocusMenu, shouldCenter);

  WidgetMessenger.sendCommandToWidget(widget.id, 'enter-focus');

  if (!hasFocusMenu) {
    WidgetMessenger.sendCommandToWidget(widget.id, 'enter-active');
  }

  AppStateManager.setState({ activeWidget: widget.id, focusContext: 'widget' });

  logger.info('Widget focused', { widgetId: widget.id, hasFocusMenu });
  return true;
}

// AFTER:
static focusWidget() {
  const state = DashboardStateManager.getState();
  const { row, col } = state.gridPosition;
  const widget = getWidgetAtPosition(row, col);

  if (!widget) {
    logger.warn('No widget at position', { row, col });
    return false;
  }

  const shouldCenter = canWidgetCenter(widget.id);
  const menuConfig = FocusMenuStateManager.getWidgetMenuConfig(widget.id);
  const hasFocusMenu = menuConfig?.enabled === true;

  DashboardStateManager.setFocusedWidget(widget.id);
  UIRenderer.focusWidget(widget.id, hasFocusMenu, shouldCenter);

  WidgetMessenger.sendCommandToWidget(widget.id, 'enter-focus');

  if (hasFocusMenu) {
    // Show focus menu and stay in menu state
    const widgetElement = document.getElementById(widget.id);
    FocusMenuRenderer.showFocusMenu(widgetElement, menuConfig);
    DashboardStateManager.setFocusMenuActive(widget.id, menuConfig);

    // Tell widget menu is active
    WidgetMessenger.sendCommandToWidget(widget.id, {
      type: 'command',
      action: 'menu-active',
      selectedItem: menuConfig.defaultIndex || 0,
      itemId: menuConfig.items[menuConfig.defaultIndex || 0].id
    });

    logger.info('Widget focused with menu', { widgetId: widget.id });
  } else {
    // No menu - go straight to active
    WidgetMessenger.sendCommandToWidget(widget.id, 'enter-active');
    logger.info('Widget focused (no menu)', { widgetId: widget.id });
  }

  AppStateManager.setState({
    activeWidget: widget.id,
    focusContext: hasFocusMenu ? 'widget-menu' : 'widget'
  });

  return true;
}
```

**C. Update `defocusWidget()` method** (line ~430, add ~10 LOC)
```javascript
// BEFORE:
static defocusWidget() {
  const state = DashboardStateManager.getState();
  const widgetId = state.focusedWidget;

  if (!widgetId) return false;

  WidgetMessenger.sendCommandToWidget(widgetId, 'exit-active');
  WidgetMessenger.sendCommandToWidget(widgetId, 'exit-focus');

  DashboardStateManager.setFocusedWidget(null);
  UIRenderer.defocusWidget();
  UIRenderer.updateFocus();

  AppStateManager.setState({ activeWidget: null, focusContext: 'grid' });

  logger.info('Widget defocused', { widgetId });
  return true;
}

// AFTER:
static defocusWidget() {
  const state = DashboardStateManager.getState();
  const widgetId = state.focusedWidget;

  if (!widgetId) return false;

  // Hide focus menu if active
  if (state.focusMenuState.active) {
    FocusMenuRenderer.hideFocusMenu();
    DashboardStateManager.clearFocusMenuState();
  }

  WidgetMessenger.sendCommandToWidget(widgetId, 'exit-active');
  WidgetMessenger.sendCommandToWidget(widgetId, 'exit-focus');

  DashboardStateManager.setFocusedWidget(null);
  UIRenderer.defocusWidget();
  UIRenderer.updateFocus();

  AppStateManager.setState({ activeWidget: null, focusContext: 'grid' });

  logger.info('Widget defocused', { widgetId });
  return true;
}
```

**Complexity**: Medium - logic additions to existing methods

---

### 6. `js/modules/Dashboard/dashboard-input-handler.js`
**Current LOC**: 185
**Added LOC**: ~180
**Final LOC**: ~365
**Change**: +97%

#### Changes Required:

**A. Import focus menu modules** (line ~10)
```javascript
// ADD:
import FocusMenuRenderer from './components/focus-menu-renderer.js';
import FocusMenuStateManager from './components/focus-menu-state-manager.js';
```

**B. Update `handleUp()` method** (line ~55, add ~20 LOC at start)
```javascript
// BEFORE:
static handleUp(originalEvent) {
  if (!this.enabled) return false;

  logger.debug('Handling UP action');
  DashboardTimers.reset();

  const state = DashboardStateManager.getState();

  if (state.focusedWidget) {
    // Forward to widget
    widgetMessenger.sendCommandToWidget(state.focusedWidget, 'up');
    return true;
  }

  return NavigationManager.moveUp();
}

// AFTER:
static handleUp(originalEvent) {
  if (!this.enabled) return false;

  logger.debug('Handling UP action');
  DashboardTimers.reset();

  const state = DashboardStateManager.getState();

  // If focus menu is active and in menu state
  if (state.focusMenuState.active && state.focusMenuState.inMenu) {
    const newIndex = Math.max(0, state.focusMenuState.selectedIndex - 1);
    DashboardStateManager.setFocusMenuSelection(newIndex);
    FocusMenuRenderer.updateMenuSelection(newIndex);

    // Send preview to widget
    const selectedItem = state.focusMenuState.menuConfig.items[newIndex];
    widgetMessenger.sendCommandToWidget(state.focusedWidget, {
      type: 'command',
      action: 'menu-selection-changed',
      selectedItem: newIndex,
      itemId: selectedItem.id
    });

    logger.debug('Menu selection moved up', { newIndex });
    return true;
  }

  // If widget focused (not in menu)
  if (state.focusedWidget) {
    widgetMessenger.sendCommandToWidget(state.focusedWidget, 'up');
    return true;
  }

  return NavigationManager.moveUp();
}
```

**C. Update `handleDown()` method** (similar pattern, ~20 LOC)

**D. Update `handleRight()` method** (line ~90, add ~30 LOC at start)
```javascript
// AFTER:
static handleRight(originalEvent) {
  if (!this.enabled) return false;

  logger.debug('Handling RIGHT action');
  DashboardTimers.reset();

  const state = DashboardStateManager.getState();

  // If focus menu is active and in menu state
  if (state.focusMenuState.active && state.focusMenuState.inMenu) {
    // Activate widget (exit menu, enter widget control)
    DashboardStateManager.setFocusMenuInWidget(false);
    FocusMenuRenderer.dimFocusMenu();

    // Send enter-active to widget
    widgetMessenger.sendCommandToWidget(state.focusedWidget, {
      type: 'command',
      action: 'enter-active'
    });

    logger.info('Widget activated from menu');
    return true;
  }

  // If widget focused (not in menu)
  if (state.focusedWidget) {
    widgetMessenger.sendCommandToWidget(state.focusedWidget, 'right');
    return true;
  }

  return NavigationManager.moveRight();
}
```

**E. Update `handleLeft()` method** (line ~105, add ~30 LOC at start)
```javascript
// AFTER:
static handleLeft(originalEvent) {
  if (!this.enabled) return false;

  logger.debug('Handling LEFT action');
  DashboardTimers.reset();

  const state = DashboardStateManager.getState();

  // If focus menu is active and widget is in control (not in menu)
  if (state.focusMenuState.active && !state.focusMenuState.inMenu) {
    // Return to menu (exit widget, enter menu control)
    DashboardStateManager.setFocusMenuInWidget(true);
    FocusMenuRenderer.undimFocusMenu();

    // Send exit-active to widget
    widgetMessenger.sendCommandToWidget(state.focusedWidget, {
      type: 'command',
      action: 'exit-active'
    });

    logger.info('Returned to menu from widget');
    return true;
  }

  // If widget focused (in menu already), forward to widget
  if (state.focusedWidget) {
    widgetMessenger.sendCommandToWidget(state.focusedWidget, 'left');
    return true;
  }

  return NavigationManager.moveLeft();
}
```

**F. Update `handleEnter()` method** (line ~130, add ~25 LOC at start)
```javascript
// AFTER:
static handleEnter(originalEvent) {
  if (!this.enabled) return false;

  logger.debug('Handling ENTER action');
  DashboardTimers.reset();

  const state = DashboardStateManager.getState();

  // If focus menu is active and in menu state
  if (state.focusMenuState.active && state.focusMenuState.inMenu) {
    // Execute selected menu item
    const selectedItem = state.focusMenuState.menuConfig.items[
      state.focusMenuState.selectedIndex
    ];

    widgetMessenger.sendCommandToWidget(state.focusedWidget, {
      type: 'command',
      action: 'menu-item-selected',
      itemId: selectedItem.id
    });

    logger.info('Menu item selected', { itemId: selectedItem.id });
    return true;
  }

  // If widget focused (not in menu)
  if (state.focusedWidget) {
    widgetMessenger.sendCommandToWidget(state.focusedWidget, 'enter');
    return true;
  }

  return NavigationManager.handleEnter();
}
```

**G. Update `handleEscape()` method** (line ~145, add ~20 LOC at start)
```javascript
// AFTER:
static handleEscape(originalEvent) {
  if (!this.enabled) return false;

  logger.debug('Handling ESCAPE action');
  DashboardTimers.reset();

  const state = DashboardStateManager.getState();

  // If focus menu is active
  if (state.focusMenuState.active) {
    // If in widget control, return to menu first
    if (!state.focusMenuState.inMenu) {
      DashboardStateManager.setFocusMenuInWidget(true);
      FocusMenuRenderer.undimFocusMenu();

      widgetMessenger.sendCommandToWidget(state.focusedWidget, {
        type: 'command',
        action: 'exit-active'
      });

      logger.info('Returned to menu from widget (ESC)');
      return true;
    }

    // If in menu, exit focus mode entirely
    NavigationManager.defocusWidget();
    return true;
  }

  // If widget focused (no menu)
  if (state.focusedWidget) {
    NavigationManager.defocusWidget();
    return true;
  }

  return NavigationManager.handleEscape();
}
```

**Complexity**: Medium-High - significant logic additions to all input handlers

---

### 7. `js/modules/Dashboard/dashboard-ui-renderer.js`
**Current LOC**: 307
**Added LOC**: ~15
**Final LOC**: ~322
**Change**: +5%

#### Changes Required:

**A. Update `focusWidget()` method** (line ~236, modify signature)
```javascript
// BEFORE:
static focusWidget(widgetId, hasFocusMenu = false, shouldCenter = true) {
  // TODO: Handle focus menu display
  logger.debug('Focusing widget', { widgetId, hasFocusMenu, shouldCenter });
}

// AFTER:
static focusWidget(widgetId, hasFocusMenu = false, shouldCenter = true) {
  const widgetElement = document.getElementById(widgetId);
  if (!widgetElement) {
    logger.warn('Widget element not found', { widgetId });
    return;
  }

  widgetElement.classList.add('widget-focused');

  if (shouldCenter) {
    widgetElement.classList.add('centered');
  }

  logger.debug('Widget focused', { widgetId, hasFocusMenu, shouldCenter });
}
```

**B. Add `setWidgetActive()` implementation** (line ~252, replace stub)
```javascript
// BEFORE:
static setWidgetActive() {
  // TODO: Implement widget active state visual
  logger.debug('Setting widget active state');
}

// AFTER:
static setWidgetActive(widgetId, isActive) {
  const widgetElement = document.getElementById(widgetId);
  if (!widgetElement) return;

  if (isActive) {
    widgetElement.classList.add('widget-active');
  } else {
    widgetElement.classList.remove('widget-active');
  }

  logger.debug('Widget active state set', { widgetId, isActive });
}
```

**Complexity**: Low - simple class manipulation additions

---

### 8. `js/widgets/calendar/core/focus-manager.js`
**Current LOC**: 220
**Added LOC**: ~5
**Final LOC**: ~225
**Change**: +2%

#### Changes Required:

**A. Enable focus menu** (line ~29)
```javascript
// BEFORE:
focusMenu: {
  enabled: false, // TODO: Re-enable when focus menu UI is implemented
  defaultIndex: 2,
  currentView: 'week',
  items: [...]
}

// AFTER:
focusMenu: {
  enabled: true, // Focus menu now implemented!
  defaultIndex: 2,
  currentView: 'week',
  items: [...]
}
```

**B. Update comments** (line ~1-5)
```javascript
// BEFORE:
// Focus menu support prepared but disabled pending UI implementation

// AFTER:
// Focus menu integration - communicates with parent Dashboard focus menu
```

**Complexity**: Trivial - one-line change + comment update

---

### 9. `js/core/widget-data-manager.js`
**Current LOC**: 774
**Added LOC**: ~40
**Final LOC**: ~814
**Change**: +5%

#### Changes Required:

**A. Add focus menu registration listener** (line ~200, in message handler)
```javascript
// In handleWidgetMessage() method, add case for widget-config:

case 'widget-config':
  if (data.focusMenu) {
    // Import FocusMenuStateManager
    const FocusMenuStateManager = await import(
      '../modules/Dashboard/components/focus-menu-state-manager.js'
    ).then(m => m.default);

    // Register widget menu config
    FocusMenuStateManager.registerWidgetMenu(data.widget, data.focusMenu);
    logger.info('Widget menu registered', {
      widgetId: data.widget,
      enabled: data.focusMenu.enabled
    });
  }
  break;
```

**Complexity**: Low - single case addition to message handler

---

## Implementation Order

### Phase 1: Foundation (2-3 hours)
1. Create `focus-menu-state-manager.js` (130 LOC)
2. Create `focus-menu.css` (231 LOC)
3. Update `dashboard-state-manager.js` (+50 LOC)
4. Update `widget-data-manager.js` (+40 LOC)

### Phase 2: UI Components (3-4 hours)
5. Create `focus-menu-renderer.js` (430 LOC)
6. Update `dashboard-ui-renderer.js` (+15 LOC)

### Phase 3: Navigation Logic (2-3 hours)
7. Update `dashboard-navigation-manager.js` (+60 LOC)
8. Update `dashboard-input-handler.js` (+180 LOC)

### Phase 4: Enable & Test (1 hour)
9. Update `calendar/core/focus-manager.js` (+5 LOC)
10. Test all navigation flows

---

## Potential Issues & Cleanup Recommendations

### 1. WidgetDataManager Duplication
**Issue**: WidgetDataManager (774 LOC) duplicates some WidgetMessenger functionality
**Recommendation**: Consider consolidating before adding more widget state tracking
**Impact**: Would reduce from 774 → ~500 LOC if cleaned up first

### 2. Input Handler Size Growth
**Issue**: dashboard-input-handler.js will grow from 185 → 365 LOC (+97%)
**Recommendation**: Consider extracting menu-specific logic to separate handler
**Alternative**: Create `dashboard-focus-menu-input-handler.js` to isolate menu logic
**Impact**: Would keep input-handler.js at ~220 LOC instead of 365

### 3. CSS Organization
**Issue**: Adding new CSS file increases stylesheet count
**Recommendation**: Already well-organized, no changes needed
**Note**: Consider adding to index.html near other component CSS

### 4. State Management Complexity
**Issue**: Focus menu state nested in dashboard-state-manager.js
**Recommendation**: Current approach is fine, state is dashboard-specific
**Alternative**: Could use FocusMenuStateManager as single source of truth
**Impact**: Minimal - current approach aligns with existing patterns

---

## Recommended Pre-Implementation Cleanup

### Option A: Minimal (Recommended)
- No cleanup needed
- Proceed with implementation as-is
- Total new code: ~1,371 LOC

### Option B: Input Handler Refactor (Optional)
- Extract focus menu input logic to separate file
- Create `dashboard-focus-menu-input-handler.js` (~150 LOC)
- Keep `dashboard-input-handler.js` cleaner (~220 LOC instead of 365)
- Total new code: ~1,371 LOC (same total, better organized)

### Option C: WidgetDataManager Consolidation (Aggressive)
- Merge WidgetDataManager into WidgetMessenger or refactor
- Would require larger changes to existing code
- Benefit: Cleaner architecture long-term
- Cost: 4-6 hours additional work, risk of regressions
- **Not recommended** before focus menu implementation

---

## Final Recommendation

**Proceed with implementation as-is (Option A)** because:

1. ✅ Code is well-structured and maintainable
2. ✅ Growth is reasonable (16% increase in modified files)
3. ✅ New files are isolated and focused
4. ✅ No major architectural issues blocking implementation
5. ✅ Can refactor later if input handler becomes unwieldy

**Total effort**: 8-12 hours (as previously estimated)

**If you want cleaner code**: Consider Option B (extract focus menu input handler)
- Adds 1-2 hours to implementation
- Makes code more maintainable long-term
- Total: 10-14 hours

---

## Next Steps

1. Review this analysis
2. Decide on Option A (as-is) vs Option B (refactor input handler)
3. Approve to begin implementation
4. I'll proceed phase-by-phase with regular commits

Let me know which option you prefer!
