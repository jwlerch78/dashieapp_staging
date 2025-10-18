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

## Async Data Loading Pattern

When your page needs to load data asynchronously (like fetching calendars from an API), follow this pattern:

### 1. Show Loading State Initially

```javascript
buildMySubScreen() {
    return `
        <div class="settings-modal__screen" data-screen="my-subscreen">
            <div class="settings-modal__page-content">
                <div class="settings-modal__empty">
                    <div class="settings-modal__spinner"></div>
                    <div class="settings-modal__empty-text">Loading data...</div>
                </div>
            </div>
        </div>
    `;
}
```

### 2. Load Data and Replace HTML

In the renderer's `showCurrentPage()`:

```javascript
if (screenId === 'my-subscreen' && this.pages.mypage) {
    this.pages.mypage.loadData().then(() => {
        const screen = this.modalElement.querySelector('[data-screen="my-subscreen"]');
        if (screen) {
            // Replace loading spinner with actual content
            screen.innerHTML = this.pages.mypage.renderData();
            this.pages.mypage.attachEventListeners();

            // CRITICAL: Apply focus after DOM updates
            setTimeout(() => {
                this.stateManager.setSelectedIndex(0);
                this.updateSelection();
            }, 100); // Give DOM time to render
        }
    });
}
```

### 3. Why setTimeout is Needed

After replacing HTML with `innerHTML`, the browser needs time to:
- Parse the new HTML
- Render elements to the DOM
- Apply CSS classes
- Make elements "focusable"

**Without setTimeout:** Focus applies before elements exist → no highlight
**With setTimeout:** Focus applies after rendering → highlight works

### 4. Data Persistence Pattern

Save data to **both** localStorage (fast) and database (persistent):

```javascript
async saveData() {
    // 1. Save to localStorage first (instant)
    localStorage.setItem('my-data', JSON.stringify(this.data));

    // 2. Save to database (async, may fail)
    try {
        await this.edgeClient.saveMyData(this.data);
        logger.success('Data saved to database');
    } catch (error) {
        logger.error('Database save failed, but localStorage succeeded');
        // Don't throw - data is still saved locally
    }
}

async loadData() {
    try {
        // Try database first (most up-to-date)
        this.data = await this.edgeClient.loadMyData();

        // Sync to localStorage for fast future loads
        localStorage.setItem('my-data', JSON.stringify(this.data));
    } catch (error) {
        // Fallback to localStorage
        const cached = localStorage.getItem('my-data');
        this.data = cached ? JSON.parse(cached) : [];
        logger.warn('Loaded from localStorage fallback');
    }
}
```

### 5. Auto-Enable Pattern

Auto-enable default selections on first use:

```javascript
async initialize() {
    await this.loadData();

    // Auto-enable defaults if nothing is selected
    if (this.activeItems.length === 0) {
        const defaultItem = await this.findDefaultItem();
        if (defaultItem) {
            this.activeItems = [defaultItem.id];
            await this.saveData();
            logger.success('Auto-enabled default item');
        }
    }
}
```

---

## Common Pitfalls

### ❌ DON'T Override getFocusableElements() for Sub-Screens

**Wrong:**
```javascript
// In calendar page
getFocusableElements() {
    return document.querySelectorAll('.calendar-item');  // Returns empty!
}
```

**Why it fails:** When `updateSelection()` calls `this.pages.calendar.getFocusableElements()`, the method runs in the page's context but the DOM might not be ready yet.

**Right:** Let the renderer query the DOM directly (it already does this for `calendar-*` screens)

### ❌ DON'T Apply Focus Before Async Data Loads

**Wrong:**
```javascript
this.loadData().then(() => {
    screen.innerHTML = this.renderData();
});
// Focus happens before data loads!
this.stateManager.setSelectedIndex(0);
this.updateSelection();
```

**Right:**
```javascript
this.loadData().then(() => {
    screen.innerHTML = this.renderData();

    // Apply focus AFTER data loads and renders
    setTimeout(() => {
        this.stateManager.setSelectedIndex(0);
        this.updateSelection();
    }, 100);
});
```

### ❌ DON'T Forget to Attach Event Listeners After Replacing HTML

**Wrong:**
```javascript
screen.innerHTML = this.renderData();  // Old listeners are gone!
```

**Right:**
```javascript
screen.innerHTML = this.renderData();
this.attachEventListeners();  // Re-attach to new elements
```

### ❌ DON'T Reload Data After Every Toggle

**Wrong:**
```javascript
async toggleItem(item) {
    await this.service.toggleItem(item.id);
    await this.loadAllData();  // Race condition! May overwrite UI
}
```

**Right:**
```javascript
async toggleItem(item) {
    // Update local state
    this.updateLocalState(item.id);

    // Save to backend (no reload needed)
    await this.service.toggleItem(item.id);
}
```

---

## Sub-Screen Focus Management

The renderer handles focus differently for different screen types:

### Main Menu
```javascript
// Queries main screen menu items
const menuItems = document.querySelectorAll('[data-screen="main"] .settings-modal__menu-item');
```

### Display Sub-Screens (`display-*`)
```javascript
// Queries active display screen
const screen = document.querySelector(`[data-screen="${currentPage}"].settings-modal__screen--active`);
const menuItems = screen.querySelectorAll('.settings-modal__menu-item');
```

### Calendar Sub-Screens (`calendar-*`)
```javascript
// Queries active calendar screen (same pattern as display)
const screen = document.querySelector(`[data-screen="${currentPage}"].settings-modal__screen--active`);
const menuItems = screen.querySelectorAll('.settings-modal__menu-item');
```

### Other Pages
```javascript
// Uses page's getFocusableElements() method
const focusable = this.pages[currentPage].getFocusableElements();
```

**Key Insight:** Sub-screens with the `-` suffix (`display-*`, `calendar-*`) are queried directly from the DOM. Only root-level pages use `getFocusableElements()`.

---

## Support

If you encounter issues or need help:

1. Check existing pages for examples (`SettingsCalendarPage`, `SettingsDisplayPage`)
2. Review this guide, especially **Common Pitfalls**
3. Check console for `SettingsPageBase` debug logs
4. Verify HTML structure matches expected patterns
5. Add `🔍 DEBUG` logs to trace focus application timing
