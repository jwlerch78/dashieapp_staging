# Migration Guide: Old → New Settings Framework

## Overview

This guide shows how to migrate from manual screen implementation to the declarative framework.

## Side-by-Side Comparison

### Creating a Theme Selection Screen

#### ❌ Old Way (settings-display-page.js)
```javascript
class SettingsDisplayPage {
    // 50+ lines of manual rendering
    renderThemeScreen() {
        const currentTheme = this.getCurrentTheme();
        const themes = ['Dark', 'Light'];

        return `
            <div class="settings-modal__list">
                <div class="settings-modal__section">
                    ${themes.map(theme => {
                        const themeValue = theme.toLowerCase();
                        return `
                            <div class="settings-modal__menu-item settings-modal__menu-item--selectable ${themeValue === currentTheme ? 'settings-modal__menu-item--checked' : ''}"
                                 data-setting="interface.theme"
                                 data-value="${themeValue}">
                                <span class="settings-modal__menu-label">${theme}</span>
                                <span class="settings-modal__cell-checkmark">${themeValue === currentTheme ? '✓' : ''}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // Manual selection handling
    async setTheme(theme) {
        await window.settingsStore.set('interface.theme', theme);
        await window.settingsStore.save();
        // ... more manual logic
    }

    // Manual initial selection
    getFocusableElements() {
        const screen = document.querySelector('[data-screen="display"].settings-modal__screen--active');
        return Array.from(screen.querySelectorAll('.settings-modal__menu-item'));
    }
}

// Then in modal renderer:
buildDisplaySubScreens() {
    return `
        <div data-screen="display-theme" data-title="Theme" data-parent="display">
            ${displayPage.renderThemeScreen()}
        </div>
    `;
}

// And manual navigation handling:
if (target.dataset.navigate) {
    this.stateManager.navigateToPage(target.dataset.navigate);
    this.showCurrentPage('forward');
}

// And manual selection handling:
if (target.dataset.setting === 'interface.theme') {
    await displayPage.setTheme(value);
    // Re-render manually
    currentScreen.innerHTML = displayPage.renderThemeScreen();
}

// And manual initial selection:
const checkedItem = screen.querySelector('.settings-modal__menu-item--checked');
const allItems = Array.from(screen.querySelectorAll('.settings-modal__menu-item'));
const checkedIndex = allItems.indexOf(checkedItem);
```

**Total: ~150 lines across multiple files**

#### ✅ New Way (display-screens.js)
```javascript
import { screenRegistry } from '../core/settings-screen-registry.js';
import { createSelectionScreen } from '../core/settings-screen-factory.js';

export function registerDisplayScreens(settingsStore) {
    const themeScreen = createSelectionScreen({
        id: 'display-theme',
        title: 'Theme',
        parentId: 'display',
        settingPath: 'interface.theme',
        options: [
            { label: 'Dark', value: 'dark' },
            { label: 'Light', value: 'light' }
        ],
        stayOnScreen: true
    });

    screenRegistry.register(themeScreen);
}

// In modal renderer (universal for ALL screens):
const html = screenRegistry.render(screenId);
const initialIndex = screenRegistry.getInitialSelectionIndex(screenId);
const action = await screenRegistry.handleSelection(screenId, element);
```

**Total: ~15 lines, one file**

---

### Time Selection (Multi-Step Flow)

#### ❌ Old Way
```javascript
// In settings-display-page.js
renderSleepTimeHourScreen() {
    const currentTime = this.getSleepTime();
    const { hour12 } = this.timeHandler.parseTime24(currentTime);
    const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

    return `
        <div class="settings-modal__list">
            <div class="settings-modal__section">
                ${hours.map(h => `
                    <div class="settings-modal__menu-item ${h === hour12 ? 'settings-modal__menu-item--checked' : ''}"
                         data-hour="${h}"
                         data-setting="interface.sleepTime"
                         data-navigate="display-sleep-time-min">
                        <span>${h}</span>
                        ${h === hour12 ? '<span>✓</span>' : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

renderSleepTimeMinScreen() { /* Similar 30 lines */ }
renderSleepTimePeriodScreen() { /* Similar 30 lines */ }

// Repeat for wake time (3 more screens, 90+ more lines)

// In modal renderer:
buildDisplaySubScreens() {
    return `
        <div data-screen="display-sleep-time-hour">
            ${displayPage.renderSleepTimeHourScreen()}
        </div>
        <div data-screen="display-sleep-time-min">
            ${displayPage.renderSleepTimeMinScreen()}
        </div>
        <div data-screen="display-sleep-time-period">
            ${displayPage.renderSleepTimePeriodScreen()}
        </div>
        <!-- Repeat 3 more times for wake timer -->
    `;
}

// Manual state management in TimeSelectionHandler
// Manual navigation logic
// Manual save logic
```

**Total: ~300 lines**

#### ✅ New Way
```javascript
import { createTimeSelectionScreens } from '../core/settings-screen-factory.js';

const timeHandler = new TimeSelectionHandler();

const sleepScreens = createTimeSelectionScreens({
    prefix: 'display-sleep-time',
    title: 'Sleep Timer',
    parentId: 'display',
    settingPath: 'interface.sleepTime',
    timeHandler: timeHandler
});

sleepScreens.forEach(screen => screenRegistry.register(screen));

// Same for wake timer (4 lines)
```

**Total: ~10 lines**

---

## Migration Steps

### Step 1: Install the Framework (Already Done)
Files created:
- `core/settings-screen-base.js`
- `core/settings-screen-registry.js`
- `core/settings-screen-factory.js`

### Step 2: Initialize Registry

In `settings.js` or wherever settings module initializes:

```javascript
import { screenRegistry } from './core/settings-screen-registry.js';
import { registerDisplayScreens } from './screens/display-screens.js';

class Settings {
    async initialize() {
        // ... existing initialization ...

        // Initialize screen registry
        screenRegistry.initialize(this.store);

        // Register all screens
        registerDisplayScreens(this.store);

        // ... rest of initialization ...
    }
}
```

### Step 3: Update Modal Renderer

Replace manual screen building with registry:

```javascript
// OLD:
buildDisplaySubScreens() {
    const displayPage = this.pages.display;
    return `
        <div data-screen="display-theme">${displayPage.renderThemeScreen()}</div>
        <!-- ... manual screens -->
    `;
}

// NEW:
buildDynamicScreens() {
    const allScreenIds = screenRegistry.getAllScreenIds();

    return allScreenIds.map(id => {
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
```

### Step 4: Simplify Navigation Logic

```javascript
// OLD (in handleClick):
if (target.dataset.navigate) {
    const targetScreen = target.dataset.navigate;

    // Manual initial selection
    const checkedItem = screen.querySelector('.settings-modal__menu-item--checked');
    // ... 10 lines of finding index ...

    this.stateManager.navigateToPage(targetScreen);
    this.showCurrentPage('forward');
}

// NEW (in handleClick):
if (target.dataset.navigate) {
    const targetScreen = target.dataset.navigate;

    // Automatic initial selection
    const initialIndex = screenRegistry.getInitialSelectionIndex(targetScreen);
    this.stateManager.setSelectedIndex(initialIndex);

    this.stateManager.navigateToPage(targetScreen);
    this.showCurrentPage('forward');
}
```

### Step 5: Simplify Selection Handling

```javascript
// OLD (in handleClick):
if (target.dataset.setting || target.dataset.hour || target.dataset.minute) {
    const displayPage = this.pages.display;

    // Theme selection
    if (target.dataset.setting === 'interface.theme') {
        await displayPage.setTheme(value);
        currentScreen.innerHTML = displayPage.renderThemeScreen();
    }

    // Time selection
    if (displayPage && displayPage.getTimeHandler) {
        const action = timeHandler.handleSelection(target);
        if (action.type === 'navigate') { /* ... */ }
        if (action.type === 'complete') { /* ... */ }
    }
}

// NEW (in handleClick):
if (target.dataset.setting || target.dataset.hour || target.dataset.minute) {
    const currentScreen = this.stateManager.getCurrentPage();

    // Registry handles ALL selection logic
    const action = await screenRegistry.handleSelection(currentScreen, target);

    if (action.type === 'navigate') {
        this.stateManager.navigateToPage(action.screenId);
        this.showCurrentPage('forward');
    } else if (action.type === 'complete') {
        if (action.navigateTo) {
            this.stateManager.navigateToPage(action.navigateTo);
        } else {
            this.stateManager.navigateBack();
        }
        this.showCurrentPage('backward');
    } else if (action.type === 'refresh') {
        this.refreshCurrentScreen(action.screenId);
    }
}
```

### Step 6: Clean Up Old Code

After migration is complete and tested:

1. Delete old render methods from `settings-display-page.js`
2. Remove manual screen building from modal renderer
3. Remove manual selection logic
4. Keep only the page-level logic (like Dynamic Greeting toggle)

---

## What Changes, What Stays

### ✅ Stays the Same
- CSS classes (no changes needed)
- HTML structure (same output)
- Settings store API
- State manager
- Input handler (D-pad navigation)
- Auto-scroll logic
- Toast notifications

### 🔄 Changes
- Screen definitions (move to config files)
- Rendering logic (use registry)
- Selection handling (use registry)
- Navigation logic (simplified)
- Initial selection (automatic)

---

## Benefits of Migration

### Before
- ❌ 300+ lines per settings page
- ❌ Duplicate logic everywhere
- ❌ Hard to add new screens
- ❌ Inconsistent behavior
- ❌ Hard to test

### After
- ✅ 50 lines per settings page
- ✅ Logic in one place (framework)
- ✅ Add screen = 10 lines of config
- ✅ Consistent behavior guaranteed
- ✅ Easy to test (just config)

---

## Gradual Migration

You can migrate **one page at a time**:

1. **Week 1**: Migrate Display screens
2. **Week 2**: Migrate Calendar screens
3. **Week 3**: Migrate Photos screens
4. **Week 4**: Clean up old code

Old and new systems coexist during migration.

---

## Testing Migration

1. Test theme selection (stays on screen, checkmark updates)
2. Test time selection (3-step flow, saves correctly)
3. Test D-pad navigation (starts on checked item, scrolls)
4. Test ENTER key (works on all items)
5. Test Back button (returns to parent)

If all work the same as before, migration is successful! ✅
