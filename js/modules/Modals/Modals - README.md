# Modals Module Documentation

**Author:** Claude Code Modal Master 🎓
**Last Updated:** 2025-10-18

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Built-in Modals](#built-in-modals)
4. [Creating Custom Modals](#creating-custom-modals)
5. [Input Routing & Navigation](#input-routing--navigation)
6. [Modal Stacking](#modal-stacking)
7. [Common Pitfalls](#common-pitfalls)
8. [Debugging Guide](#debugging-guide)

---

## Overview

The Modals module provides a centralized, keyboard/gamepad-navigable modal system for Dashie. It handles:

- ✅ Sleep overlay
- ✅ Exit/Logout confirmation
- ✅ Generic confirmation dialogs
- ✅ Keyboard & gamepad navigation
- ✅ Theme support (dark/light)
- ✅ Modal stacking (modals on top of modals)

**Location:** `js/modules/Modals/`

**Key Files:**
- `modals.js` - Main API
- `modals-state-manager.js` - State management
- `modals-ui-renderer.js` - DOM rendering
- `modals-input-handler.js` - Input handling
- `css/modules/modals.css` - Styling

---

## Architecture

### Component Structure

```
┌─────────────────────────────────────┐
│         modals.js (API)             │
│  - showSleep()                      │
│  - showExitConfirmation()           │
│  - showConfirmation()               │
│  - handleUp/Down/Left/Right/Enter   │
└──────────┬──────────────────────────┘
           │
    ┌──────┴────────┬────────────────┐
    │               │                │
┌───▼────┐  ┌──────▼──────┐  ┌─────▼────────┐
│ State  │  │  UI Renderer│  │Input Handler │
│Manager │  │             │  │              │
└────────┘  └─────────────┘  └──────────────┘
```

### Input Flow

```
User Input (keyboard/gamepad)
    ↓
InputHandler (captures all inputs)
    ↓
AppComms.publish('input:action')
    ↓
ActionRouter.routeAction()
    ↓
┌─ IF Modals.isModalOpen() → Modals Module
│    ↓
│  Modals.handleUp/Down/Enter/Escape()
│    ↓
│  ModalsInputHandler.handleAction()
│    ↓
│  Updates UI & calls callbacks
│
└─ ELSE IF dashieModalManager.hasActiveModal() → dashieModalManager
     ↓
   (Legacy modals like photos settings)
```

---

## Built-in Modals

### 1. Sleep Overlay

**Purpose:** Full-screen dark overlay when app goes to sleep.

**Usage:**
```javascript
window.modals.showSleep();
window.modals.hideSleep();
```

**Features:**
- Covers entire screen
- Any key press wakes up
- Smooth fade in/out

---

### 2. Exit/Logout Confirmation

**Purpose:** Confirm before exiting app or logging out.

**Usage:**
```javascript
window.modals.showExitConfirmation();
```

**Features:**
- Detects authentication status automatically
- **If authenticated:** Shows 3 options (Logout, Exit, Cancel)
- **If not authenticated:** Shows 2 options (Yes, No)
- Displays user photo if available
- Handles logout via SessionManager

**Example:**
```javascript
// In dashboard-navigation-manager.js
case 'exit':
  window.modals.showExitConfirmation();
  break;
```

---

### 3. Generic Confirmation Dialog

**Purpose:** Reusable confirmation for any action requiring user approval.

**Usage:**
```javascript
window.modals.showConfirmation({
  title: 'Delete All Photos?',
  message: 'This will permanently delete all 25 photos...',
  confirmLabel: 'Delete All',
  cancelLabel: 'Cancel',
  confirmStyle: 'primary', // 'default', 'primary', or 'destructive'
  onConfirm: () => {
    // User clicked confirm
    performDeleteAction();
  },
  onCancel: () => {
    // Optional: User clicked cancel or pressed Escape
    console.log('User cancelled');
  }
});
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `title` | string | No | "Confirm" | Modal title |
| `message` | string | No | "" | Modal message body |
| `confirmLabel` | string | No | "Confirm" | Confirm button text |
| `cancelLabel` | string | No | "Cancel" | Cancel button text |
| `confirmStyle` | string | No | "default" | Button style: `default`, `primary` (orange), or `destructive` (red) |
| `onConfirm` | function | **Yes** | - | Called when user confirms |
| `onCancel` | function | No | - | Called when user cancels |

**Button Styles:**
- `default` - Gray button
- `primary` - Orange button (recommended for important actions)
- `destructive` - Red button (use sparingly, for dangerous actions)

---

## Creating Custom Modals

To add a new modal type to the Modals module:

### Step 1: Add State Management

**File:** `modals-state-manager.js`

```javascript
// 1. Add to constructor state
constructor() {
  this.state = {
    currentModal: null,  // Add 'yourModal' as valid type
    yourModalData: null  // Custom data for your modal
  };
}

// 2. Add open method
openYourModal(config) {
  this.state.currentModal = 'yourModal';
  this.state.yourModalData = config;
  this.state.optionsList = ['option1', 'option2'];
  this.state.selectedOption = 'option1';
  logger.info('Your modal state set');
}

// 3. Update close() to clear your data
close() {
  this.state = {
    currentModal: null,
    yourModalData: null,
    // ...
  };
}
```

### Step 2: Add UI Rendering

**File:** `modals-ui-renderer.js`

```javascript
showYourModal(config) {
  const backdrop = document.createElement('div');
  backdrop.id = 'your-modal-backdrop';
  backdrop.className = 'modal-backdrop';

  const dialog = document.createElement('div');
  dialog.id = 'your-modal-dialog';
  dialog.className = 'your-modal-dialog';

  dialog.innerHTML = `
    <h2>${config.title}</h2>
    <p>${config.message}</p>
    <button data-action="option1">Option 1</button>
    <button data-action="option2">Option 2</button>
  `;

  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  return { backdrop, dialog };
}

hideYourModal() {
  const backdrop = document.getElementById('your-modal-backdrop');
  if (backdrop) {
    backdrop.remove();
  }
}

updateYourModalHighlight(selectedOption) {
  const dialog = document.getElementById('your-modal-dialog');
  if (!dialog) return;

  dialog.querySelectorAll('[data-action]').forEach(btn => {
    btn.classList.remove('selected');
  });

  const selectedBtn = dialog.querySelector(`[data-action="${selectedOption}"]`);
  if (selectedBtn) {
    selectedBtn.classList.add('selected');
  }
}
```

### Step 3: Add Input Handling

**File:** `modals-input-handler.js`

```javascript
// Add to handleAction() switch statement
switch (action) {
  case 'up':
  case 'down':
    if (modalType === 'yourModal') {
      return this.handleUpDown();
    }
    break;
  case 'enter':
    if (modalType === 'yourModal') {
      // Handle selection
    }
    break;
}

// Update handleUp/Down to work with your modal
handleUp() {
  if (modalsStateManager.movePrevious()) {
    const modalType = modalsStateManager.getCurrentModal();
    const selectedOption = modalsStateManager.getSelectedOption();

    if (modalType === 'yourModal') {
      modalsUIRenderer.updateYourModalHighlight(selectedOption);
    }
    return true;
  }
  return false;
}
```

### Step 4: Add Public API

**File:** `modals.js`

```javascript
showYourModal(config) {
  if (!this.isInitialized) {
    logger.error('Cannot show modal - Modals not initialized');
    return;
  }

  logger.info('Showing your modal', { title: config.title });

  // Update state
  modalsStateManager.openYourModal(config);

  // Show UI
  const { backdrop } = modalsUIRenderer.showYourModal(config);

  // Update initial highlight
  modalsUIRenderer.updateYourModalHighlight(
    modalsStateManager.getSelectedOption()
  );

  // Enable input handling
  modalsInputHandler.enable(
    (action) => this.handleYourModalAction(action, config),
    () => this.handleYourModalCancel(config)
  );

  // Add click listeners
  backdrop.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.getAttribute('data-action');
      this.handleYourModalAction(action, config);
    });
  });

  AppComms.publish('modal:opened', { type: 'yourModal' });
}

hideYourModal() {
  modalsStateManager.close();
  modalsUIRenderer.hideYourModal();
  modalsInputHandler.disable();
  AppComms.publish('modal:closed', { type: 'yourModal' });
}
```

### Step 5: Add Styling

**File:** `css/modules/modals.css`

```css
#your-modal-backdrop {
  z-index: var(--z-modal);
}

.your-modal-dialog {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-radius: 14px;
  padding: 24px;
  /* ... */
}

.your-modal-dialog button.selected {
  outline: 3px solid #EE9828;
  outline-offset: 2px;
  transform: scale(1.05);
}
```

---

## Input Routing & Navigation

### How It Works

1. **User presses a key** (Arrow, Enter, Escape, etc.)
2. **InputHandler** captures the event via keyboard listeners
3. **InputHandler** normalizes it to an action (`up`, `down`, `enter`, `escape`)
4. **InputHandler** publishes `AppComms.publish('input:action', { action })`
5. **ActionRouter** receives the action and checks priorities:

```javascript
// ActionRouter priority order:
1. Play/Pause (sleep toggle) → always handled first
2. Sleep mode → any key wakes up
3. Settings modal → route to Settings module
4. Modals module modal open → route to Modals module ⭐
5. dashieModalManager modal open → call dashieModalManager.handleAction() ⭐
6. Current module → route to active module (Dashboard, etc.)
```

### Key Methods

**In Modals module:**
```javascript
handleUp()    // Arrow up / D-pad up
handleDown()  // Arrow down / D-pad down
handleLeft()  // Arrow left / D-pad left
handleRight() // Arrow right / D-pad right
handleEnter() // Enter / Select button
handleEscape()// Escape / Back button
```

**These are automatically called by ActionRouter when a modal is open.**

---

## Modal Stacking

### The Problem

What happens when you have **multiple modals open at once**?

Example:
1. Settings modal (managed by Settings module)
2. Photos settings modal (managed by dashieModalManager)
3. Delete confirmation (managed by Modals module)

### The Solution: Two Systems

Dashie uses **two modal management systems** that work together:

#### 1. Modals Module (New Architecture)
- Manages: Sleep, Exit, Confirmation dialogs
- Uses: `modalsStateManager.isModalOpen()`
- Input: ActionRouter checks `modals.isModalOpen()` → routes to Modals module

#### 2. dashieModalManager (Legacy)
- Manages: Photos modal, Calendar settings, etc.
- Uses: Modal stack (array of registered modals)
- Input: ActionRouter checks `dashieModalManager.hasActiveModal()` → calls `handleAction()`

### Stack Example

```
┌─────────────────────────────────┐
│  Confirmation Modal (Top)       │ ← Modals module
│  z-index: 15000                 │   isModalOpen() = true
├─────────────────────────────────┤
│  Photos Settings Modal          │ ← dashieModalManager
│  z-index: 10000                 │   stack[0]
├─────────────────────────────────┤
│  Settings Modal                 │ ← Settings module
│  z-index: 999                   │   isVisible() = true
└─────────────────────────────────┘
```

### Input Flow with Stacked Modals

```javascript
// ActionRouter.routeAction()

// 1. Check if Modals module has a modal open
if (window.modals && window.modals.isModalOpen()) {
  // Route to Modals module
  // Confirmation modal handles input ✅
  return modals.handleUp();
}

// 2. Check if dashieModalManager has a modal open
if (window.dashieModalManager && window.dashieModalManager.hasActiveModal()) {
  // Call dashieModalManager directly
  // Photos modal handles input ✅
  return window.dashieModalManager.handleAction(action);
}

// 3. Otherwise route to current module
return this.routeToModule(currentModule, action);
```

### Registering with dashieModalManager

When creating a confirmation modal that appears **on top of** a dashieModalManager modal:

```javascript
// After rendering the confirmation modal
if (window.dashieModalManager) {
  const buttons = Array.from(backdrop.querySelectorAll('[data-action]'));

  window.dashieModalManager.registerModal(backdrop, {
    buttons: buttons.map(btn => ({ id: btn.id, element: btn })),
    horizontalNavigation: true,
    initialFocus: 0,
    customHandler: (action) => {
      // Handle the action
      return modalsInputHandler.handleAction(action);
    },
    onEscape: () => {
      // Handle escape
      this.hideConfirmation();
    }
  });
}
```

**IMPORTANT:** When the modal closes, **unregister it**:

```javascript
hideConfirmation() {
  // Unregister from modal manager
  if (window.dashieModalManager) {
    window.dashieModalManager.unregisterModal();
  }

  // Clean up
  modalsStateManager.close();
  modalsUIRenderer.hideConfirmationModal();
  modalsInputHandler.disable();
}
```

### Z-Index Management

Use CSS variables for consistent stacking:

```css
/* css/core/variables.css */
--z-sidebar: 10;
--z-widget-selected: 100;
--z-widget-focused: 200;
--z-modal: 999;              /* Regular modals */
--z-modal-confirmation: 15000; /* Confirmation on top of everything */
--z-sleep: 1000;             /* Sleep overlay */
```

Apply in your modal CSS:

```css
#confirmation-backdrop {
  z-index: var(--z-modal-confirmation);
}
```

---

## Common Pitfalls

### 1. ❌ Forgetting to Disable Input Handler

**Problem:**
```javascript
hideConfirmation() {
  modalsStateManager.close();
  modalsUIRenderer.hideConfirmationModal();
  // Oops! Forgot to disable input handler
}
```

**Result:** Input handler is still enabled, tries to handle inputs even though modal is gone.

**Fix:**
```javascript
hideConfirmation() {
  modalsStateManager.close();
  modalsUIRenderer.hideConfirmationModal();
  modalsInputHandler.disable(); // ✅ Always disable!
}
```

---

### 2. ❌ Not Unregistering from dashieModalManager

**Problem:**
```javascript
hideConfirmation() {
  // Forgot to unregister!
  modalsUIRenderer.hideConfirmationModal();
  modalsInputHandler.disable();
}
```

**Result:** Modal is removed from DOM, but still in dashieModalManager's stack. Inputs get routed to a non-existent modal.

**Fix:**
```javascript
hideConfirmation() {
  if (window.dashieModalManager) {
    window.dashieModalManager.unregisterModal(); // ✅ Unregister first!
  }
  modalsUIRenderer.hideConfirmationModal();
  modalsInputHandler.disable();
}
```

---

### 3. ❌ Wrong Z-Index

**Problem:**
```css
#my-modal {
  z-index: 100; /* Too low! */
}
```

**Result:** Modal appears **behind** other modals.

**Fix:**
```css
#my-modal {
  z-index: var(--z-modal-confirmation); /* Use CSS variable */
}
```

**Z-Index Hierarchy:**
- `15000` - Confirmation modals (always on top)
- `10000` - Photos/Calendar settings
- `1000` - Sleep overlay
- `999` - Regular modals

---

### 4. ❌ Calling modals.isModalOpen() Too Early

**Problem:**
```javascript
// Inside modal's close handler
hideConfirmation() {
  modalsStateManager.close(); // Sets currentModal = null

  // Later in the code...
  if (window.modals.isModalOpen()) {
    // This is now false! State was already cleared
  }
}
```

**Result:** Code that depends on modal state doesn't work.

**Fix:** Check state **before** clearing it, or use local variables:

```javascript
hideConfirmation() {
  const wasOpen = modalsStateManager.isModalOpen(); // Save state

  modalsStateManager.close();

  if (wasOpen) {
    // Can still check
  }
}
```

---

### 5. ❌ Not Preventing Event Default

**Problem:**
```javascript
handleEnter() {
  // Handle the action
  return true; // Handled!
}

// But in routeAction():
const handled = this.handleEnter();
// Forgot to preventDefault!
```

**Result:** Browser also handles the event (e.g., scrolls page, submits form).

**Fix:** ActionRouter automatically prevents default if `handled = true`:
```javascript
// In ActionRouter
const handled = this.routeToModule('modals', action, originalEvent);
if (handled && originalEvent) {
  originalEvent.preventDefault(); // ✅ Prevent browser action
}
```

---

### 6. ❌ Modal Events Not Being Captured (DashieModal Issue)

**Problem:**
```javascript
// Adding event listener in default (bubble) phase
document.addEventListener('keydown', this.handleKeydown);
```

**Result:** Other event handlers (like Settings input handler) process the event **before** the modal can intercept it. This causes:
- Pressing Enter on "Cancel" re-triggers the action that showed the modal
- Modal doesn't close when expected
- Background handlers execute even though modal is visible
- Modal gets shown multiple times ("Modal already visible" warnings)

**Symptoms:**
```
[DashieModal] ⚠️ Modal already visible, hiding current modal first
[SettingsInputHandler] ℹ️ Triggering click on selected element
```

**Root Cause:** Event listeners fire in this order:
1. **Capture phase** (window → target) - Parent elements first
2. **Target phase** - Element itself
3. **Bubble phase** (target → window) - Back up to parents

By default, `addEventListener` uses **bubble phase**, which fires AFTER other handlers at the same level may have already processed the event.

**Fix:** Use **capture phase** by passing `true` as third parameter:

```javascript
// ✅ Correct: Capture phase (fires FIRST)
document.addEventListener('keydown', this.handleKeydown, true);

// Also use capture phase when removing
document.removeEventListener('keydown', this.handleKeydown, true);
```

**Complete Example:**

```javascript
show({ title, message, buttons }) {
  return new Promise((resolve) => {
    // ... render modal ...

    // ✅ Add listener in CAPTURE phase to intercept events first
    document.addEventListener('keydown', this.handleKeydown, true);

    this.isVisible = true;
  });
}

hide() {
  if (!this.isVisible) return;

  // ✅ Remove with same capture flag
  document.removeEventListener('keydown', this.handleKeydown, true);

  this.isVisible = false;
}

handleKeydown(event) {
  if (!this.isVisible) return;

  // ✅ Stop event from reaching other handlers
  event.preventDefault();
  event.stopImmediatePropagation();

  switch (event.key) {
    case 'Enter':
      // Handle enter
      break;
    case 'Escape':
      // Handle escape
      break;
  }
}
```

**Why This Works:**
- **Capture phase** fires before other handlers can see the event
- `stopImmediatePropagation()` prevents ALL other handlers (including same-level ones) from firing
- Modal handles the event exclusively, preventing background interference

**When to Use:**
- ✅ Use capture phase for **overlay modals** that need exclusive input control
- ✅ Use `stopImmediatePropagation()` when you want to block all other handlers
- ⚠️ Don't use capture phase for normal UI elements (buttons, inputs, etc.)

---

## Debugging Guide

### Enable Debug Logging

The modal system has extensive debug logging with color-coded console output:

- 🟢 **Green** = Modals module
- 🟡 **Yellow** = Modals input handler
- 🟠 **Orange** = Action router
- 🔵 **Blue** = Photos modal
- 🔷 **Blue Diamond** = dashieModalManager

### Common Debug Scenarios

#### Scenario 1: Modal Not Receiving Input

**Symptoms:** Press arrow keys, nothing happens.

**Debug Steps:**
1. Check console for `🟠 ACTION ROUTER` logs
2. Look for: `"Modals module modal is active, routing to modals module"`
3. Check if you see: `🟢 MODALS MODULE: handleUp() called`
4. Check if you see: `🟡 MODALS INPUT HANDLER: handleAction called`

**Common Causes:**
- Input handler not enabled: Check for `enabled: false` in logs
- Modal not in state: Check `isModalOpen: false` in logs
- Z-index too low: Modal is behind another element

**Fix:**
```javascript
// Make sure to enable input handler when showing modal
modalsInputHandler.enable(onConfirm, onCancel);

// Make sure state is set
modalsStateManager.openConfirmation(config);
```

---

#### Scenario 2: Modal Won't Close

**Symptoms:** Press Escape, modal stays open.

**Debug Steps:**
1. Check for `🟢 MODALS MODULE: handleEscape() called`
2. Check for `🟡 MODALS INPUT HANDLER: Not handling - disabled or no modal open`
3. Check dashieModalManager stack: `🔷 MODAL MANAGER: hasActiveModal()`

**Common Causes:**
- Escape handler not implemented
- Input handler disabled too early
- Modal still registered with dashieModalManager

**Fix:**
```javascript
// Make sure to handle escape in input handler
case 'escape':
  return this.handleEscape();

// Make sure to unregister
hideConfirmation() {
  if (window.dashieModalManager) {
    window.dashieModalManager.unregisterModal();
  }
  // ...
}
```

---

#### Scenario 3: Stacked Modals - Wrong One Receives Input

**Symptoms:** Have 2 modals open, bottom one receives input instead of top one.

**Debug Steps:**
1. Check `🔷 MODAL MANAGER: hasActiveModal()` - look at `stack` array
2. Check `stackDepth` - should be 2
3. Check which modal is at `stack[1]` (top)
4. Look for registration order in logs

**Common Causes:**
- Top modal didn't register with dashieModalManager
- Top modal registered but didn't provide `customHandler`
- ActionRouter routing to wrong modal

**Fix:**
```javascript
// When showing modal on top of another modal, register it
if (window.dashieModalManager) {
  window.dashieModalManager.registerModal(backdrop, {
    buttons: buttonElements,
    customHandler: (action) => {
      return modalsInputHandler.handleAction(action);
    }
  });
}
```

---

### Manual Stack Inspection

You can manually inspect the modal stack in the browser console:

```javascript
// Check if Modals module has a modal open
window.modals.isModalOpen()
// Returns: true/false

// Check current modal type
window.modals.getCurrentModalType()
// Returns: 'sleep', 'exit', 'confirmation', or null

// Check dashieModalManager stack
window.dashieModalManager.modalStack
// Returns: Array of {modal, config, focusableElements, currentIndex}

// Check stack depth
window.dashieModalManager.modalStack.length
// Returns: 0, 1, 2, etc.

// Check top modal
window.dashieModalManager.modalStack[window.dashieModalManager.modalStack.length - 1]
```

---

### Debug Logging Toggles

To temporarily disable debug logging:

```javascript
// In console:
const originalLog = console.log;
console.log = function(...args) {
  // Filter out modal debug logs
  if (args[0] && typeof args[0] === 'string' && args[0].includes('🟢')) return;
  if (args[0] && typeof args[0] === 'string' && args[0].includes('🟠')) return;
  originalLog.apply(console, args);
};
```

To re-enable:
```javascript
// Restore original
console.log = originalLog;
```

---

## Best Practices

### ✅ DO

1. **Always enable AND disable input handler**
   ```javascript
   showModal() {
     modalsInputHandler.enable(onConfirm, onCancel);
   }
   hideModal() {
     modalsInputHandler.disable(); // Don't forget!
   }
   ```

2. **Use CSS variables for z-index**
   ```css
   #my-modal { z-index: var(--z-modal-confirmation); }
   ```

3. **Unregister from dashieModalManager**
   ```javascript
   hideModal() {
     if (window.dashieModalManager) {
       window.dashieModalManager.unregisterModal();
     }
   }
   ```

4. **Provide both `onConfirm` and `onCancel`**
   ```javascript
   window.modals.showConfirmation({
     onConfirm: () => { /* Required */ },
     onCancel: () => { /* Optional but recommended */ }
   });
   ```

5. **Clear state in the right order**
   ```javascript
   hideModal() {
     // 1. Unregister
     if (window.dashieModalManager) {
       window.dashieModalManager.unregisterModal();
     }
     // 2. Clear state
     modalsStateManager.close();
     // 3. Remove UI
     modalsUIRenderer.hideModal();
     // 4. Disable input
     modalsInputHandler.disable();
   }
   ```

### ❌ DON'T

1. **Don't create modals outside the Modals module for UI consistency**
   - Use `modals.showConfirmation()` instead of `confirm()`
   - Add to Modals module if you need custom behavior

2. **Don't hardcode z-index values**
   ```css
   /* Bad */
   #my-modal { z-index: 10000; }

   /* Good */
   #my-modal { z-index: var(--z-modal-confirmation); }
   ```

3. **Don't assume event propagation works**
   - New InputHandler captures events before legacy systems
   - ActionRouter must explicitly call handlers

4. **Don't forget to check if modal is already open**
   ```javascript
   showModal() {
     if (modalsStateManager.isModalOpen()) {
       logger.warn('Modal already open');
       return;
     }
     // ...
   }
   ```

---

## Examples

### Example 1: Simple Confirmation

```javascript
// Ask user to confirm deletion
window.modals.showConfirmation({
  title: 'Delete Item?',
  message: 'This action cannot be undone.',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
  confirmStyle: 'primary',
  onConfirm: () => {
    deleteItem();
  }
});
```

### Example 2: Dangerous Action

```javascript
// Use destructive style for dangerous actions
window.modals.showConfirmation({
  title: 'Reset Everything?',
  message: 'This will delete all your data and settings.',
  confirmLabel: 'Reset',
  cancelLabel: 'Keep My Data',
  confirmStyle: 'destructive', // Red button
  onConfirm: () => {
    resetAllData();
  },
  onCancel: () => {
    console.log('User chose to keep data');
  }
});
```

### Example 3: Chained Modals

```javascript
// First confirmation
window.modals.showConfirmation({
  title: 'Export Data?',
  message: 'Prepare your data for export?',
  confirmLabel: 'Export',
  onConfirm: () => {
    const data = prepareExport();

    // Second confirmation
    window.modals.showConfirmation({
      title: 'Ready to Download',
      message: `Export contains ${data.items.length} items.`,
      confirmLabel: 'Download',
      onConfirm: () => {
        downloadData(data);
      }
    });
  }
});
```

---

## Troubleshooting Checklist

When things aren't working:

- [ ] Is the Modals module initialized? Check `window.modals`
- [ ] Is `modalsStateManager.isModalOpen()` returning the right value?
- [ ] Is `modalsInputHandler` enabled?
- [ ] Are you seeing ActionRouter logs in console?
- [ ] Is the z-index high enough?
- [ ] Did you unregister from dashieModalManager when closing?
- [ ] Did you clear the state?
- [ ] Did you disable the input handler?
- [ ] Are there any JavaScript errors in console?
- [ ] Is the modal actually in the DOM? (Check Elements tab)

---

## Version History

- **v1.0** (2025-10-18) - Initial documentation
  - Documented architecture
  - Explained input routing
  - Covered modal stacking
  - Added debugging guide
  - Included examples and best practices

---

**Questions?** Check the source code or add debug logging to trace the issue! 🔍
