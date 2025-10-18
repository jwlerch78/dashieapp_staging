# Settings Screen Framework

A reusable, declarative framework for creating settings screens with automatic:
- Selection management (starts on checked/current item)
- Navigation flow handling
- Data persistence
- Auto-scrolling
- Multi-step flows

## Problem This Solves

Previously, every settings screen required manual implementation of:
1. Rendering HTML with proper data attributes
2. Finding the current/checked item and setting initial selection
3. Handling navigation between screens
4. Persisting data to settings store
5. Managing multi-step flows (like time selection)
6. Auto-scrolling to keep selected items in view

This framework **codifies all these patterns** so you just declare what your screen does, not how to do it.

## Core Concepts

### 1. SettingsScreenBase
Base class that provides:
- `render(currentValue)` - Renders screen HTML automatically
- `getInitialSelectionIndex(currentValue)` - Finds checked item
- `handleSelection(element, settingsStore)` - Handles selection logic
- `isItemChecked(item, currentValue)` - Determines if item should be checked

### 2. SettingsScreenRegistry
Singleton that manages all screens:
- `register(screen)` - Register a screen
- `render(screenId)` - Render a screen by ID
- `getInitialSelectionIndex(screenId)` - Get starting selection
- `handleSelection(screenId, element)` - Handle selection on screen
- `getChildScreens(parentId)` - Get all sub-screens

### 3. Screen Factory Functions
Helpers for creating common screen types:
- `createSelectionScreen()` - Simple choice screen (e.g., Theme: Dark/Light)
- `createNavigationScreen()` - Menu with navigable items (e.g., main Display page)
- `createTimeSelectionScreens()` - 3-step time selection (hour → minute → period)
- `createMultiStepScreen()` - Custom multi-step flows

## Usage Examples

### Example 1: Simple Selection Screen

```javascript
import { screenRegistry } from '../core/settings-screen-registry.js';
import { createSelectionScreen } from '../core/settings-screen-factory.js';

// Create theme selection screen
const themeScreen = createSelectionScreen({
    id: 'display-theme',
    title: 'Theme',
    parentId: 'display',
    settingPath: 'interface.theme',
    options: [
        { label: 'Dark', value: 'dark' },
        { label: 'Light', value: 'light' },
        { label: 'Auto', value: 'auto' }  // Easy to add new options!
    ],
    stayOnScreen: true  // Don't auto-navigate back after selection
});

screenRegistry.register(themeScreen);
```

**What you get automatically:**
- ✅ Renders with checkmark on current theme
- ✅ Selection starts on current theme
- ✅ Saves to `interface.theme` when selected
- ✅ Shows toast notification
- ✅ Updates checkmark on screen

### Example 2: Navigation Screen

```javascript
import { createNavigationScreen } from '../core/settings-screen-factory.js';

const displayScreen = createNavigationScreen({
    id: 'display',
    title: 'Display',
    parentId: 'main',
    getItems: (currentValue) => {
        const theme = settingsStore.get('interface.theme', 'dark');
        const sleepTime = settingsStore.get('interface.sleepTime', '22:00');

        return [
            {
                label: 'Theme',
                value: theme.charAt(0).toUpperCase() + theme.slice(1),
                navigate: 'display-theme'
            },
            {
                label: 'Sleep Timer',
                value: formatTime(sleepTime),
                navigate: 'display-sleep-time-hour'
            }
        ];
    }
});

screenRegistry.register(displayScreen);
```

**What you get automatically:**
- ✅ Renders with chevrons on navigable items
- ✅ Shows current values
- ✅ Navigates to sub-screens when selected

### Example 3: Time Selection (Multi-Step)

```javascript
import { createTimeSelectionScreens } from '../core/settings-screen-factory.js';
import { TimeSelectionHandler } from '../utils/time-selection-handler.js';

const timeHandler = new TimeSelectionHandler();

// Creates 3 screens automatically: hour, minute, period
const sleepScreens = createTimeSelectionScreens({
    prefix: 'display-sleep-time',
    title: 'Sleep Timer',
    parentId: 'display',
    settingPath: 'interface.sleepTime',
    timeHandler: timeHandler
});

sleepScreens.forEach(screen => screenRegistry.register(screen));
```

**What you get automatically:**
- ✅ Three screens: `-hour`, `-min`, `-period`
- ✅ Auto-navigation: hour → minute → period
- ✅ State management across steps
- ✅ Saves complete time value (e.g., "22:00")
- ✅ Navigates back to parent when complete

## Integration with Modal Renderer

### Old Way (Manual)
```javascript
// In settings-modal-renderer.js
buildDisplaySubScreens() {
    const displayPage = this.pages.display;

    return `
        <div data-screen="display-theme">
            ${displayPage.renderThemeScreen()}
        </div>
        <div data-screen="display-sleep-time-hour">
            ${displayPage.renderSleepTimeHourScreen()}
        </div>
        <!-- ... 5 more manual screens -->
    `;
}

// Manually handle navigation
if (target.dataset.navigate) {
    this.stateManager.navigateToPage(target.dataset.navigate);
    this.showCurrentPage('forward');
}

// Manually handle selection
if (screenId.startsWith('display-')) {
    const checkedItem = screen.querySelector('.settings-modal__menu-item--checked');
    // ... manual index finding logic
}
```

### New Way (Declarative)
```javascript
// In settings initialization
import { registerDisplayScreens } from './screens/display-screens.js';
screenRegistry.initialize(settingsStore);
registerDisplayScreens(settingsStore);

// In modal renderer
buildDynamicScreens() {
    // Get all registered sub-screens
    const allScreenIds = screenRegistry.getAllScreenIds();

    return allScreenIds
        .filter(id => id !== 'main')  // Exclude main menu
        .map(id => {
            const parentId = screenRegistry.getParentId(id);
            const title = screenRegistry.getTitle(id);

            return `
                <div class="settings-modal__screen"
                     data-screen="${id}"
                     data-title="${title}"
                     ${parentId ? `data-parent="${parentId}"` : ''}>
                    ${screenRegistry.render(id)}
                </div>
            `;
        }).join('');
}

// Handle navigation (unified)
if (target.dataset.navigate) {
    const screenId = target.dataset.navigate;

    // Automatically set selection to checked item
    const initialIndex = screenRegistry.getInitialSelectionIndex(screenId);
    this.stateManager.setSelectedIndex(initialIndex);

    this.stateManager.navigateToPage(screenId);
    this.showCurrentPage('forward');
}

// Handle selection (unified)
if (target.dataset.setting || target.dataset.hour || target.dataset.minute) {
    const screenId = this.stateManager.getCurrentPage();
    const action = await screenRegistry.handleSelection(screenId, target);

    if (action.type === 'navigate') {
        // Navigate to next screen in multi-step flow
        this.stateManager.navigateToPage(action.screenId);
    } else if (action.type === 'complete') {
        // Save complete, navigate back
        this.stateManager.navigateBack();
    } else if (action.type === 'refresh') {
        // Re-render current screen
        this.refreshCurrentScreen();
    }
}
```

## Benefits

### 1. **DRY (Don't Repeat Yourself)**
- Write screen config once, get all behavior automatically
- No manual HTML generation
- No manual selection management

### 2. **Consistency**
- All screens behave the same way
- Same patterns for navigation, selection, persistence
- Predictable user experience

### 3. **Maintainability**
- Change behavior in one place (base class)
- Easy to add new screens (just register them)
- Clear separation of concerns

### 4. **Testability**
- Screens are just data configurations
- Easy to test in isolation
- Mock settings store for unit tests

### 5. **Extensibility**
- Easy to add new screen types
- Can override behavior per screen
- Composable patterns

## Adding a New Settings Page

To add a new settings page with sub-screens:

1. Create screen definitions file:
```javascript
// js/modules/Settings/screens/calendar-screens.js
export function registerCalendarScreens(settingsStore) {
    // Main Calendar navigation screen
    const calendarScreen = createNavigationScreen({
        id: 'calendar',
        title: 'Calendar',
        parentId: 'main',
        getItems: () => [
            { label: 'Default Calendar', navigate: 'calendar-default' },
            { label: 'Sync Frequency', navigate: 'calendar-sync' }
        ]
    });
    screenRegistry.register(calendarScreen);

    // Default Calendar selection
    const defaultCalendarScreen = createSelectionScreen({
        id: 'calendar-default',
        title: 'Default Calendar',
        parentId: 'calendar',
        settingPath: 'calendar.defaultCalendar',
        options: [
            { label: 'Personal', value: 'personal' },
            { label: 'Work', value: 'work' },
            { label: 'Family', value: 'family' }
        ]
    });
    screenRegistry.register(defaultCalendarScreen);
}
```

2. Register in initialization:
```javascript
// In settings initialization
registerCalendarScreens(settingsStore);
```

3. Done! All screens render, navigate, persist automatically.

## Advanced: Custom Screen Types

For screens that don't fit the factory patterns, extend `SettingsScreenBase`:

```javascript
class CustomToggleScreen extends SettingsScreenBase {
    constructor(config) {
        super(config);
    }

    render(currentValue) {
        // Custom rendering logic
        return `<div>Custom toggle: ${currentValue}</div>`;
    }

    async handleSelection(element, settingsStore) {
        // Custom selection logic
        const newValue = !currentValue;
        await settingsStore.set(this.settingPath, newValue);
        return { type: 'refresh' };
    }
}
```

## Migration Path

You don't have to migrate everything at once:

1. **Phase 1**: Add new screens using framework
2. **Phase 2**: Migrate Display screens (example provided)
3. **Phase 3**: Migrate other pages as needed
4. **Phase 4**: Remove old manual code

The old and new systems can coexist during migration.

## File Structure

```
js/modules/Settings/
├── core/
│   ├── settings-screen-base.js          # Base class
│   ├── settings-screen-registry.js      # Screen manager
│   ├── settings-screen-factory.js       # Factory functions
│   └── README.md                         # This file
├── screens/
│   ├── display-screens.js               # Display screen definitions
│   ├── calendar-screens.js              # Calendar screen definitions
│   └── ...
└── utils/
    └── time-selection-handler.js        # Existing helper
```

## Performance

- **Rendering**: Screens render on-demand (lazy)
- **Memory**: Screens are lightweight config objects
- **Registry**: HashMap lookup (O(1) access)
- **No overhead** for screens not in use

## Summary

This framework **codifies the patterns** we kept reinventing:
- ✅ Selection starts on checked item
- ✅ Auto-scroll to keep item in view
- ✅ Navigation flows (forward/back)
- ✅ Multi-step flows with state
- ✅ Data persistence
- ✅ Toast notifications
- ✅ Re-rendering after changes

**Before**: 300+ lines per page with duplicated logic
**After**: ~50 lines of declarative configuration
