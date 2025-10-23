# Touch Controls System

**Location:** `js/widgets/shared/widget-touch-controls.js`
**CSS:** `js/widgets/shared/widget-touch-controls.css`

---

## Overview

The touch controls system provides two reusable classes for implementing touch-friendly interactions in widgets:

1. **TouchButton** - Circular themed buttons with auto-theming
2. **LongPressDetector** - Long press gesture detection

Both classes are designed for Fire TV remote (D-pad + touch), mobile touch screens, and desktop (mouse) compatibility.

---

## TouchButton Class

### Purpose

Creates circular, themed touch buttons that adapt to the current Dashie theme. Perfect for widget navigation controls (next/previous, zoom, settings, etc.).

### Features

✅ **Auto-theming** - Uses CSS variables to match current theme
✅ **Multiple positions** - Pre-configured positions (left, right, top-right, etc.)
✅ **Built-in icons** - Common icons (chevrons, cog, refresh, magnify)
✅ **Accessible** - ARIA labels for screen readers
✅ **Event handling** - Click/tap with proper event propagation
✅ **State management** - Enable/disable, show/hide

### Basic Usage

```javascript
import { TouchButton } from '/js/widgets/shared/widget-touch-controls.js';

// Create a "next" button on the right side
const nextButton = new TouchButton({
  id: 'next',
  position: 'right',
  icon: 'chevron-right',
  ariaLabel: 'Next',
  onClick: () => {
    // Navigate to next item
    showNextPhoto();
  }
});

// Append to widget container
nextButton.appendTo(document.body);
```

### Configuration Options

```javascript
{
  id: string,              // Unique identifier (e.g., 'prev', 'next', 'zoom')
  position: string,        // Position name (see below)
  icon: string,            // Icon name (see below)
  onClick: Function,       // Click/tap handler
  ariaLabel: string,       // Accessibility label
  enabled: boolean         // Optional, default: true
}
```

### Supported Positions

Position values and their CSS positioning:

| Position | Location | CSS |
|----------|----------|-----|
| `left` | Left side, vertically centered | `left: 20px; top: 50%` |
| `right` | Right side, vertically centered | `right: 20px; top: 50%` |
| `top-left` | Top left corner | `top: 20px; left: 20px` |
| `top-right` | Top right corner | `top: 20px; right: 20px` |
| `bottom-left` | Bottom left corner | `bottom: 20px; left: 20px` |
| `bottom-right` | Bottom right corner | `bottom: 20px; right: 20px` |
| `top-center` | Top center | `top: 20px; left: 50%` |
| `bottom-center` | Bottom center | `bottom: 20px; left: 50%` |

Custom positioning via CSS:
```css
.widget-touch-button[data-position="custom"] {
  top: 100px;
  left: 100px;
}
```

### Built-in Icons

Available icon names:
- `chevron-left` - Left arrow
- `chevron-right` - Right arrow
- `chevron-up` - Up arrow
- `chevron-down` - Down arrow
- `magnify` - Zoom/search
- `cog` - Settings
- `refresh` - Refresh/reload

Icons are SVG with `currentColor` stroke, so they adapt to theme automatically.

### Methods

```javascript
// Show/hide
button.show();
button.hide();

// Enable/disable
button.enable();
button.disable();

// Append to container
button.appendTo(containerElement);

// Clean up
button.destroy();
```

### Complete Example

```javascript
import { TouchButton } from '/js/widgets/shared/widget-touch-controls.js';

class PhotoWidget {
  constructor() {
    this.currentIndex = 0;
    this.photos = [];
    this.buttons = [];
  }

  initializeTouchControls() {
    // Previous button
    const prevButton = new TouchButton({
      id: 'photo-prev',
      position: 'left',
      icon: 'chevron-left',
      ariaLabel: 'Previous photo',
      onClick: () => this.showPrevious()
    });

    // Next button
    const nextButton = new TouchButton({
      id: 'photo-next',
      position: 'right',
      icon: 'chevron-right',
      ariaLabel: 'Next photo',
      onClick: () => this.showNext()
    });

    // Zoom button
    const zoomButton = new TouchButton({
      id: 'photo-zoom',
      position: 'top-right',
      icon: 'magnify',
      ariaLabel: 'Zoom',
      onClick: () => this.toggleZoom()
    });

    // Add all buttons to widget
    [prevButton, nextButton, zoomButton].forEach(btn => {
      btn.appendTo(document.body);
      this.buttons.push(btn);
    });

    // Update button states
    this.updateButtonStates();
  }

  updateButtonStates() {
    const prevBtn = this.buttons.find(b => b.id === 'photo-prev');
    const nextBtn = this.buttons.find(b => b.id === 'photo-next');

    // Disable prev button at start
    if (this.currentIndex === 0) {
      prevBtn.disable();
    } else {
      prevBtn.enable();
    }

    // Disable next button at end
    if (this.currentIndex >= this.photos.length - 1) {
      nextBtn.disable();
    } else {
      nextBtn.enable();
    }
  }

  destroy() {
    // Clean up all buttons
    this.buttons.forEach(btn => btn.destroy());
    this.buttons = [];
  }
}
```

---

## LongPressDetector Class

### Purpose

Detects long press gestures on widgets. Used to enter "focus mode" or trigger secondary actions.

### Features

✅ **Configurable duration** - Default 500ms, adjustable
✅ **Movement detection** - Cancels if user moves (scrolling vs pressing)
✅ **Mouse + Touch support** - Works on desktop and mobile
✅ **Button exclusion** - Ignores long press on TouchButtons

### Basic Usage

```javascript
import { LongPressDetector } from '/js/widgets/shared/widget-touch-controls.js';

// Detect long press on widget container
const detector = new LongPressDetector(
  widgetContainer,
  () => {
    // Enter focus mode
    enterFocusMode();
  },
  {
    threshold: 500,      // 500ms = long press
    moveThreshold: 10    // 10px movement = cancel
  }
);

// Later, clean up
detector.destroy();
```

### Configuration Options

```javascript
{
  threshold: number,        // Long press duration in ms (default: 500)
  moveThreshold: number     // Max movement in pixels before cancel (default: 10)
}
```

### How It Works

1. User touches/clicks element
2. Timer starts (500ms default)
3. If user moves > 10px → Cancel (they're scrolling)
4. If timer completes → Trigger `onLongPress` callback
5. If user lifts finger → Cancel

### Movement Threshold

The `moveThreshold` prevents false positives when scrolling:

```javascript
// Tight threshold (less forgiving, good for static widgets)
new LongPressDetector(element, onLongPress, {
  moveThreshold: 5
});

// Loose threshold (more forgiving, good for scrollable widgets)
new LongPressDetector(element, onLongPress, {
  moveThreshold: 20
});
```

### Complete Example

```javascript
import { LongPressDetector } from '/js/widgets/shared/widget-touch-controls.js';

class CalendarWidget {
  constructor() {
    this.detector = null;
    this.isFocused = false;
  }

  initialize() {
    const widgetContainer = document.querySelector('.calendar-container');

    // Set up long press to enter focus mode
    this.detector = new LongPressDetector(
      widgetContainer,
      () => this.enterFocusMode(),
      {
        threshold: 500,       // 500ms long press
        moveThreshold: 10     // 10px movement cancels
      }
    );
  }

  enterFocusMode() {
    if (this.isFocused) return;

    this.isFocused = true;

    // Send message to parent dashboard
    window.parent.postMessage({
      type: 'enter-focus',
      widgetId: 'calendar'
    }, '*');

    // Visual feedback
    document.body.classList.add('focused');
  }

  exitFocusMode() {
    this.isFocused = false;
    document.body.classList.remove('focused');
  }

  destroy() {
    if (this.detector) {
      this.detector.destroy();
      this.detector = null;
    }
  }
}
```

### Button Exclusion

LongPressDetector automatically ignores long presses that start on TouchButtons:

```javascript
handleTouchStart(e) {
  // Ignore if touch started on a button
  if (e.target.closest('.widget-touch-button')) {
    return;  // Don't start long press detection
  }
  // ... continue with long press detection
}
```

This prevents conflicts when user is trying to tap a button.

---

## Styling & Theming

### CSS Structure

```css
/* Base button styles (widget-touch-controls.css) */
.widget-touch-button {
  position: absolute;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 2px solid var(--touch-button-border);
  background: var(--touch-button-bg);
  color: var(--touch-button-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 100;
}

.widget-touch-button:hover {
  background: var(--touch-button-bg-hover);
  transform: scale(1.1);
}

.widget-touch-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
```

### Theme Variables

Touch buttons use CSS variables that update with the theme:

```css
/* Automatically set by theme system */
:root {
  --touch-button-bg: rgba(0, 0, 0, 0.5);
  --touch-button-bg-hover: rgba(0, 0, 0, 0.7);
  --touch-button-border: rgba(255, 255, 255, 0.3);
  --touch-button-color: #ffffff;
}

/* Dark theme adjustments */
.theme-dark {
  --touch-button-bg: rgba(255, 255, 255, 0.1);
  --touch-button-border: rgba(255, 255, 255, 0.2);
}

/* Light theme adjustments */
.theme-light {
  --touch-button-bg: rgba(0, 0, 0, 0.1);
  --touch-button-border: rgba(0, 0, 0, 0.2);
  --touch-button-color: #000000;
}
```

No manual theme handling required - buttons adapt automatically!

### Custom Styling

Override specific button styles:

```css
/* Make settings button smaller and transparent */
#touch-btn-settings {
  width: 40px;
  height: 40px;
  background: transparent;
  border-color: var(--accent-color);
}

/* Make next/prev buttons larger */
#touch-btn-next,
#touch-btn-prev {
  width: 60px;
  height: 60px;
}
```

---

## Best Practices

### DO:
✅ Use consistent positions across widgets (e.g., always put "next" on right)
✅ Provide descriptive `ariaLabel` for accessibility
✅ Clean up buttons on widget destroy (`button.destroy()`)
✅ Update button states (enable/disable) based on context
✅ Use long press for secondary actions (enter focus mode)

### DON'T:
❌ Create too many buttons (max 3-4 per widget)
❌ Use tiny hit targets (< 40px)
❌ Forget to call `destroy()` when removing buttons
❌ Use long press for primary actions (confusing for users)
❌ Hardcode colors/sizes (use CSS variables)

---

## Platform Compatibility

| Platform | TouchButton | LongPressDetector |
|----------|-------------|-------------------|
| Fire TV (D-pad + touch) | ✅ Full support | ✅ Full support |
| Mobile (touch) | ✅ Full support | ✅ Full support |
| Desktop (mouse) | ✅ Full support | ✅ Full support (for testing) |
| Desktop (keyboard) | ⚠️ No keyboard nav | ⚠️ No keyboard trigger |

**Note:** Touch controls are supplementary. Widgets should still support D-pad/keyboard navigation as the primary input method.

---

## Troubleshooting

### Buttons not appearing

**Check:**
1. CSS file is imported: `<link rel="stylesheet" href="/js/widgets/shared/widget-touch-controls.css">`
2. Button was appended: `button.appendTo(container)`
3. Container has `position: relative` or `absolute`
4. Z-index is high enough (`z-index: 100` default)

### Buttons not responding to clicks

**Check:**
1. Button is enabled: `button.enabled === true`
2. onClick handler is defined
3. No element covering the button (check z-index)
4. Console for JavaScript errors

### Long press not triggering

**Check:**
1. Element exists when creating detector
2. Threshold duration (default 500ms)
3. User isn't moving during press (movement > 10px cancels)
4. Not pressing on a TouchButton (excluded by default)

### Buttons don't match theme

**Check:**
1. CSS variables are defined in theme
2. Widget imports theme CSS: `/css/core/variables.css` and `/css/core/themes.css`
3. Theme class applied to body: `theme-dark` or `theme-light`

---

## Migration Guide

### From Custom Buttons to TouchButton

**Before:**
```javascript
const button = document.createElement('button');
button.className = 'custom-nav-button';
button.innerHTML = '→';
button.style.position = 'absolute';
button.style.right = '20px';
button.style.top = '50%';
button.onclick = () => next();
container.appendChild(button);
```

**After:**
```javascript
const button = new TouchButton({
  id: 'next',
  position: 'right',
  icon: 'chevron-right',
  ariaLabel: 'Next',
  onClick: () => next()
});
button.appendTo(container);
```

**Benefits:**
- Auto-theming
- Consistent styling
- Built-in accessibility
- State management (enable/disable)

---

## Related Documentation

- [WIDGETS_README.md](../WIDGETS_README.md) - Widget development guide
- [MOBILE_UI.md](../../ui/MOBILE_UI.md) - Mobile interface
- [THEME_OVERLAY.md](../../ui/themes/THEME_OVERLAY.md) - Theme system
- [WIDGET_COMMUNICATION.md](../../core/WIDGET_COMMUNICATION.md) - Widget messaging

---

## Summary

The touch controls system provides:

1. **TouchButton** - Circular themed buttons that auto-adapt to themes
2. **LongPressDetector** - Gesture detection for secondary actions

Both classes are:
- ✅ Platform-agnostic (Fire TV, mobile, desktop)
- ✅ Theme-aware (auto-theming via CSS variables)
- ✅ Accessible (ARIA labels, keyboard-friendly)
- ✅ Easy to use (simple API, minimal code)

Use them to add touch-friendly navigation to any widget!
