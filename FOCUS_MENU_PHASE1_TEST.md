# Focus Menu Phase 1 - Testing Guide

## What Phase 1 Does

Phase 1 creates the **foundation** for focus menus but doesn't display anything yet. It sets up:
- State management for focus menus
- Widget menu registration system
- CSS styling (loaded but not used yet)

## How to Test Phase 1

Since there's no UI yet, we'll test that the infrastructure is working via browser console.

### Test 1: Verify Files Loaded

1. **Start your app** (with auth bypass if needed):
   ```
   http://localhost:8000?bypass-auth
   ```

2. **Open browser console** (F12 → Console tab)

3. **Check that FocusMenuStateManager is accessible**:
   ```javascript
   // This should work (imported by widget-data-manager.js)
   import('../js/modules/Dashboard/components/focus-menu-state-manager.js')
     .then(m => console.log('✓ FocusMenuStateManager loaded:', m.default))
   ```

4. **Check DashboardStateManager has focus menu state**:
   ```javascript
   const state = DashboardStateManager.getState();
   console.log('Focus menu state:', state.focusMenuState);
   // Should output: { active: false, widgetId: null, menuConfig: null, selectedIndex: 0, inMenu: true }
   ```

### Test 2: Verify State Management

Test the focus menu state methods:

```javascript
// Get current state
const initialState = DashboardStateManager.getState();
console.log('Initial focus menu state:', initialState.focusMenuState);

// Create a mock menu config
const mockConfig = {
  enabled: true,
  defaultIndex: 1,
  currentView: 'week',
  items: [
    { id: 'action1', label: 'Test Action', type: 'action' },
    { id: 'view1', label: 'View 1', type: 'view' },
    { id: 'view2', label: 'View 2', type: 'view' }
  ]
};

// Set focus menu active
DashboardStateManager.setFocusMenuActive('calendar', mockConfig);

// Check state updated
const activeState = DashboardStateManager.getState();
console.log('Active focus menu state:', activeState.focusMenuState);
// Should show: active: true, widgetId: 'calendar', selectedIndex: 1

// Change selection
DashboardStateManager.setFocusMenuSelection(2);
console.log('After selection change:', DashboardStateManager.getState().focusMenuState.selectedIndex);
// Should output: 2

// Toggle to widget mode
DashboardStateManager.setFocusMenuInWidget(false);
console.log('In widget mode:', DashboardStateManager.getState().focusMenuState.inMenu);
// Should output: false

// Clear state
DashboardStateManager.clearFocusMenuState();
console.log('After clear:', DashboardStateManager.getState().focusMenuState);
// Should output: { active: false, widgetId: null, ... }
```

### Test 3: Verify Menu Registration System

Test that widget menus can be registered:

```javascript
// Import the state manager
const module = await import('../js/modules/Dashboard/components/focus-menu-state-manager.js');
const FocusMenuStateManager = module.default;

// Register a test menu
const testMenu = {
  enabled: true,
  defaultIndex: 0,
  currentView: 'week',
  items: [
    { id: 'go-to-today', label: 'Go to Today', type: 'action' },
    { id: 'monthly', label: 'Month', type: 'view' },
    { id: 'week', label: 'Week', type: 'view' }
  ]
};

FocusMenuStateManager.registerWidgetMenu('calendar', testMenu);

// Check registration
console.log('Has calendar menu:', FocusMenuStateManager.hasWidgetMenu('calendar'));
// Should output: true

console.log('Calendar menu config:', FocusMenuStateManager.getWidgetMenuConfig('calendar'));
// Should output: the testMenu object

console.log('Registered widgets:', FocusMenuStateManager.getRegisteredWidgets());
// Should output: ['calendar']

// Get stats
console.log('Stats:', FocusMenuStateManager.getStats());
// Should output: { totalRegistered: 1, enabledCount: 1, disabledCount: 0, widgetIds: ['calendar'] }
```

### Test 4: Verify Widget Config Message Handling

This tests that the widget-data-manager listens for widget-config messages:

```javascript
// Check that widget data manager is initialized
console.log('Widget data manager:', window.widgetDataManager);

// Simulate a widget sending a config message
const mockMessage = {
  type: 'widget-config',
  widget: 'calendar',
  focusMenu: {
    enabled: true,
    defaultIndex: 2,
    currentView: 'week',
    items: [
      { id: 'go-to-today', label: 'Go to Today', type: 'action' },
      { id: 'monthly', label: 'Month', type: 'view' },
      { id: 'week', label: 'Week', type: 'view' }
    ]
  }
};

// Send the message (simulate widget postMessage)
await window.widgetDataManager.handleWidgetMessage(mockMessage);

// Check it was registered
const module = await import('../js/modules/Dashboard/components/focus-menu-state-manager.js');
const FocusMenuStateManager = module.default;

console.log('Calendar menu registered:', FocusMenuStateManager.hasWidgetMenu('calendar'));
// Should output: true

console.log('Menu config:', FocusMenuStateManager.getWidgetMenuConfig('calendar'));
// Should output: the focusMenu object
```

### Test 5: Verify CSS Loaded

Check that focus menu CSS is loaded:

```javascript
// Check for focus-menu.css in document stylesheets
const stylesheets = Array.from(document.styleSheets);
const focusMenuCSS = stylesheets.find(sheet =>
  sheet.href && sheet.href.includes('focus-menu.css')
);

if (focusMenuCSS) {
  console.log('✓ Focus menu CSS loaded:', focusMenuCSS.href);
  console.log('  Rules count:', focusMenuCSS.cssRules?.length || 0);
} else {
  console.log('✗ Focus menu CSS NOT loaded');
}
```

---

## Expected Results

If Phase 1 is working correctly, you should see:

✅ **State Management:**
- DashboardStateManager has focusMenuState property
- State methods work correctly (set, clear, update)

✅ **Menu Registration:**
- FocusMenuStateManager can register widget menus
- Validation works (rejects invalid configs)
- Can retrieve registered menus

✅ **Message Handling:**
- WidgetDataManager handles 'widget-config' messages
- Automatically registers menus when widgets send configs

✅ **CSS Loaded:**
- focus-menu.css is present in document stylesheets
- Contains ~40+ CSS rules

---

## What You Won't See Yet

❌ **No visual focus menu** - That's Phase 2 (the renderer)
❌ **No menu appearing** when you focus a widget
❌ **No D-pad navigation** in menus - Phase 3

These are expected! Phase 1 is just the foundation.

---

## Quick All-in-One Test Script

Copy/paste this into browser console for a quick test of everything:

```javascript
(async function testPhase1() {
  console.log('=== Phase 1 Focus Menu Test ===\n');

  // Test 1: State management
  console.log('1. Testing state management...');
  const state = DashboardStateManager.getState();
  console.log('  ✓ focusMenuState exists:', !!state.focusMenuState);
  console.log('  ✓ Initial state:', state.focusMenuState);

  // Test 2: FocusMenuStateManager
  console.log('\n2. Testing FocusMenuStateManager...');
  const module = await import('../js/modules/Dashboard/components/focus-menu-state-manager.js');
  const FocusMenuStateManager = module.default;

  const testMenu = {
    enabled: true,
    defaultIndex: 1,
    items: [
      { id: 'test1', label: 'Test 1', type: 'action' },
      { id: 'test2', label: 'Test 2', type: 'view' }
    ]
  };

  FocusMenuStateManager.registerWidgetMenu('test-widget', testMenu);
  console.log('  ✓ Menu registered:', FocusMenuStateManager.hasWidgetMenu('test-widget'));
  console.log('  ✓ Stats:', FocusMenuStateManager.getStats());

  // Test 3: CSS loaded
  console.log('\n3. Testing CSS...');
  const stylesheets = Array.from(document.styleSheets);
  const focusMenuCSS = stylesheets.find(sheet =>
    sheet.href && sheet.href.includes('focus-menu.css')
  );
  console.log('  ✓ CSS loaded:', !!focusMenuCSS);

  // Test 4: Message handling
  console.log('\n4. Testing message handling...');
  if (window.widgetDataManager) {
    await window.widgetDataManager.handleWidgetMessage({
      type: 'widget-config',
      widget: 'calendar',
      focusMenu: testMenu
    });
    console.log('  ✓ Message handled:', FocusMenuStateManager.hasWidgetMenu('calendar'));
  } else {
    console.log('  ⚠ widgetDataManager not available (app not fully initialized)');
  }

  console.log('\n=== Phase 1 Test Complete ===');
  console.log('If all checks passed, Phase 1 is working correctly! ✓');
})();
```

---

## Troubleshooting

**"DashboardStateManager is not defined"**
- Dashboard module might not be initialized yet
- Try: `window.DashboardStateManager` or wait for app to load

**"Cannot find module"**
- Make sure you're using the correct relative path
- Or use full path: `import('http://localhost:8000/js/modules/Dashboard/components/focus-menu-state-manager.js')`

**"widgetDataManager is not available"**
- App might still be loading
- This is OK - widget manager will be available once Dashboard initializes

**"CSS not loaded"**
- Check browser network tab for 404 errors
- Verify `focus-menu.css` exists at `/css/components/focus-menu.css`

---

## Next: Phase 2

Once Phase 1 tests pass, we'll move to Phase 2 which creates:
- `focus-menu-renderer.js` - The visual UI component
- Actual menu display when widgets are focused
- Menu positioning and animations

Let me know when you're ready to continue!
