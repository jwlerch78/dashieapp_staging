# SettingsPageBase - Developer Guide

## Overview

`SettingsPageBase` is a base class that standardizes focus management and selection behavior across all settings pages. It eliminates the need for special-case handling in the settings renderer and provides a consistent pattern for building new settings pages.

## Benefits

- ✅ **Standardized Focus Management** - No more "first item not highlighted" issues
- ✅ **Consistent Behavior Patterns** - Toggle, navigate, and mixed behaviors work the same way
- ✅ **Reduced Boilerplate** - Common functionality inherited from base class
- ✅ **Easy Customization** - Override methods to customize behavior
- ✅ **No Renderer Changes** - Add new pages without modifying the renderer

---

## Quick Start

### 1. Extend SettingsPageBase

```javascript
import { SettingsPageBase } from '../core/settings-page-base.js';

export class SettingsMyPage extends SettingsPageBase {
    constructor() {
        super('my-page');  // Pass page ID to parent
        // Your custom properties here
    }

    render() {
        // Return HTML string for your page
        return `<div class="settings-modal__list">...</div>`;
    }
}
```

### 2. Define Selection Behavior

Override `getSelectionBehavior(item)` to define what happens when items are clicked:

```javascript
getSelectionBehavior(item) {
    // Navigate to sub-screens
    if (item.dataset.navigate) {
        return { type: 'navigate' };
    }

    // Toggle items (multi-select)
    if (item.classList.contains('toggleable-item')) {
        return { type: 'toggle' };
    }

    // Toggle switches (checkboxes)
    if (item.classList.contains('settings-modal__menu-item--toggle')) {
        return { type: 'toggle-switch' };
    }

    // No automatic behavior
    return { type: 'none' };
}
```

### 3. Implement Toggle Handler (if needed)

If you use `type: 'toggle'`, implement the toggle logic:

```javascript
async handleToggleItem(item) {
    // Your toggle logic here
    const id = item.dataset.id;
    const isActive = item.classList.contains('enabled');

    // Update UI
    item.classList.toggle('enabled');

    // Save to backend
    await this.myService.toggleItem(id, !isActive);
}
```

---

## Behavior Types

### `'navigate'`

**Use for:** Menu items that navigate to sub-screens

**Example:** Theme selection, Time pickers, Sub-menus

**How it works:**
- Clicks trigger navigation to `data-navigate` target
- Page stays inactive until navigated back
- Focus resets to first item on sub-screen

**HTML:**
```html
<div class="settings-modal__menu-item" data-navigate="my-subscreen">
    <span class="settings-modal__menu-label">Sub Menu</span>
    <span class="settings-modal__cell-chevron">›</span>
</div>
```

---

### `'toggle'`

**Use for:** Multi-select items that stay on the same page

**Example:** Calendar selection, Feature toggles

**How it works:**
- Clicks trigger `handleToggleItem(item)`
- Page stays active
- Item state updates visually
- Multiple items can be selected

**HTML:**
```html
<div class="settings-modal__menu-item my-toggle-item ${isEnabled ? 'enabled' : ''}">
    <span class="settings-modal__menu-label">Feature Name</span>
    <span class="settings-modal__cell-checkmark">${isEnabled ? '✓' : ''}</span>
</div>
```

**Implementation:**
```javascript
getSelectionBehavior(item) {
    if (item.classList.contains('my-toggle-item')) {
        return { type: 'toggle' };
    }
}

async handleToggleItem(item) {
    const id = item.dataset.id;
    const isEnabled = !item.classList.contains('enabled');

    // Update UI instantly
    item.classList.toggle('enabled');
    const checkmark = item.querySelector('.settings-modal__cell-checkmark');
    if (checkmark) checkmark.textContent = isEnabled ? '✓' : '';

    // Save to backend
    await this.service.toggleItem(id, isEnabled);
}
```

---

### `'toggle-switch'`

**Use for:** Checkbox/toggle switch controls

**Example:** Dynamic Greeting toggle

**How it works:**
- Handled automatically by renderer
- No custom code needed
- State managed by checkbox element

**HTML:**
```html
<div class="settings-modal__menu-item settings-modal__menu-item--toggle">
    <span class="settings-modal__menu-label">Feature Name</span>
    <label class="settings-modal__toggle-switch">
        <input type="checkbox" ${isEnabled ? 'checked' : ''} data-setting="interface.myFeature">
        <span class="settings-modal__toggle-slider"></span>
    </label>
</div>
```

---

### `'none'`

**Use for:** Custom behavior or non-interactive items

**Example:** "Coming Soon" items, Info displays

**How it works:**
- No automatic behavior
- Override `handleItemClick()` for custom logic

**HTML:**
```html
<div class="settings-modal__menu-item coming-soon">
    <span class="settings-modal__menu-label">Coming Soon</span>
    <span class="settings-modal__cell-status">Coming Soon</span>
</div>
```

---

## Mixed Interface Example

The **Display page** has both navigation items (theme) and toggle switches (dynamic greeting):

```javascript
export class SettingsDisplayPage extends SettingsPageBase {
    getSelectionBehavior(item) {
        // Toggle switch - handled automatically
        if (item.classList.contains('settings-modal__menu-item--toggle')) {
            return { type: 'toggle-switch' };
        }

        // Navigation items
        if (item.dataset.navigate) {
            return { type: 'navigate' };
        }

        return { type: 'none' };
    }
}
```

This works because `getSelectionBehavior()` **receives the clicked item** as a parameter, allowing dynamic behavior based on the element type.

---

## Advanced Customization

### Custom Focus Behavior

Override `getInitialFocusIndex()` to start focus on a specific item:

```javascript
getInitialFocusIndex() {
    // Focus on the checked item instead of first item
    const focusableElements = this.getFocusableElements();
    const checkedIndex = focusableElements.findIndex(el =>
        el.classList.contains('settings-modal__menu-item--checked')
    );
    return checkedIndex !== -1 ? checkedIndex : 0;
}
```

### Custom Focusable Elements

Override `getFocusableElements()` for complex layouts:

```javascript
getFocusableElements() {
    const screen = document.querySelector(`[data-screen="${this.pageId}"].settings-modal__screen--active`);
    if (!screen) return [];

    // Custom query - exclude disabled items
    return Array.from(screen.querySelectorAll('.settings-modal__menu-item:not(.disabled)'));
}
```

### Lifecycle Hooks

```javascript
async activate() {
    await super.activate();  // Call parent first

    // Custom activation logic
    await this.loadData();
    this.attachCustomListeners();
}

deactivate() {
    super.deactivate();  // Call parent first

    // Custom deactivation logic
    this.detachCustomListeners();
}
```

---

## Complete Example: Calendar Page

```javascript
import { SettingsPageBase } from '../core/settings-page-base.js';
import UIUpdateHelper from '../utils/ui-update-helper.js';

export class SettingsCalendarPage extends SettingsPageBase {
    constructor() {
        super('calendar');
        this.calendarData = {};
    }

    render() {
        return `
            <div class="settings-modal__list">
                <div class="settings-modal__menu-item" data-navigate="calendar-select">
                    <span>Select Calendars</span>
                    <span class="settings-modal__cell-chevron">›</span>
                </div>
            </div>
        `;
    }

    getSelectionBehavior(item) {
        // Calendar items: toggle
        if (item.classList.contains('calendar-item')) {
            return { type: 'toggle' };
        }

        // Coming soon items: no behavior
        if (item.classList.contains('coming-soon')) {
            return { type: 'none' };
        }

        // Menu items: navigate
        if (item.dataset.navigate) {
            return { type: 'navigate' };
        }

        return { type: 'none' };
    }

    async handleToggleItem(item) {
        const calendarId = item.dataset.calendarId;
        const isActive = !item.classList.contains('enabled');

        // Instant UI update + async save with rollback on error
        await UIUpdateHelper.updateThenSave(
            () => {
                UIUpdateHelper.toggleCalendarItem(item, isActive);
            },
            async () => {
                await this.calendarService.toggleCalendar(calendarId, isActive);
            },
            () => {
                UIUpdateHelper.toggleCalendarItem(item, !isActive);  // Rollback
            }
        );
    }
}
```

---

## Migration Checklist

When migrating an existing page to use `SettingsPageBase`:

- [ ] Import and extend `SettingsPageBase`
- [ ] Call `super(pageId)` in constructor
- [ ] Keep existing `render()` method
- [ ] Override `getSelectionBehavior(item)` to define behavior
- [ ] Implement `handleToggleItem(item)` if using toggle behavior
- [ ] Override `getFocusableElements()` if page has sub-screens or custom layout
- [ ] Remove any custom focus management code (now handled by base class)
- [ ] Test focus behavior on page load and navigation
- [ ] Test all interaction patterns (clicks, D-pad, keyboard)

---

## Testing

Test these scenarios for every page:

1. **Focus on Entry**
   - Navigate from main menu to page
   - First item should be highlighted immediately

2. **D-Pad Navigation**
   - Arrow keys move focus correctly
   - Enter key triggers selection

3. **Click Behavior**
   - Clicks perform expected action (toggle, navigate, etc.)
   - Visual feedback is instant

4. **Sub-Screens** (if applicable)
   - Navigate to sub-screen
   - Focus resets to first item
   - Back navigation returns correctly

5. **Mixed Behaviors** (if applicable)
   - Navigate items work
   - Toggle items work
   - Toggle switches work
   - All on the same page

---

## Time Selection Exception

The time selection pages (`display-sleep-time-*`, `display-wake-time-*`) use a special sequential flow that's handled independently:

- Hour → Minute → Period (AM/PM)
- Auto-advances on each selection
- Returns to parent after final selection

These pages **do NOT** need to extend `SettingsPageBase` - they're handled by the `TimeSelectionHandler` class which is already optimized for this pattern.

---

## Support

If you encounter issues or need help:

1. Check existing pages for examples (`SettingsCalendarPage`, `SettingsDisplayPage`)
2. Review this guide
3. Check console for `SettingsPageBase` debug logs
4. Verify HTML structure matches expected patterns
