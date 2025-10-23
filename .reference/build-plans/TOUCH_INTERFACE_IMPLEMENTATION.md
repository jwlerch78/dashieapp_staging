# Touch Interface Implementation Plan

**Created:** 2025-10-22
**Status:** Ready to Implement
**Prerequisite:** Calendar Widget Refactoring (✅ Complete)

---

## Overview

Add comprehensive touch support to Dashie widgets, starting with the Calendar widget. The implementation uses a shared utility library to ensure consistency across all widgets while maintaining the existing action-router architecture.

### Key Features

- **Touch Buttons** - Circular, 48px minimum (Amazon Fire TV requirements)
- **Long Press Detection** - Enter focus mode with 500ms press
- **Theme-Aware** - Automatically adapts to dark/light/halloween themes
- **Consistent Actions** - Touch buttons trigger same handlers as D-pad
- **Widget Self-Contained** - Controls live inside iframe, no parent coordination needed

---

## Architecture

### Design Principle: Widgets Own Their Touch Controls

Touch buttons live **inside the widget iframe** (not in Dashboard), enabling:
- ✅ Widgets fully self-contained
- ✅ No message passing overhead for button clicks
- ✅ Buttons can respond to widget state (disable when no next item)
- ✅ Works without focus mode

### Action Flow

```
User clicks "Next" button in Calendar widget
    ↓
TouchButton onClick handler fires
    ↓
Calls actionHandler.handleAction('right')
    ↓
Same handler as D-pad RIGHT action
    ↓
Calendar navigates to next period
```

**Key:** Touch buttons and D-pad use the **same action handlers** - no duplicate logic!

---

## File Structure

### New Shared Utilities

```
js/widgets/shared/
├── widget-touch-controls.js      (~200 lines)
│   ├── TouchButton class
│   ├── LongPressDetector class
│   └── Standard icon library
│
└── widget-touch-controls.css     (~105 lines)
    ├── Theme-aware button styles
    ├── Standard positions (left, right, top-right, etc.)
    └── Hover/active/disabled states
```

### Calendar Widget Integration

```
js/widgets/Calendar/core/
└── action-handler.js             (117 → 197 lines, +80)
    ├── Existing: handleAction() method
    ├── NEW: setupTouchControls() method
    └── NEW: Touch button creation & wiring
```

---

## Implementation Details

### 1. Shared Touch Control Utilities

**File:** `js/widgets/shared/widget-touch-controls.js` (~200 lines)

```javascript
/**
 * TouchButton class - Renders themeable circular button
 */
export class TouchButton {
    constructor(config) {
        this.id = config.id;
        this.position = config.position;  // 'left', 'right', 'top-right', etc.
        this.icon = config.icon;          // 'chevron-left', 'chevron-right', 'magnify'
        this.onClick = config.onClick;    // Handler function
        this.ariaLabel = config.ariaLabel;
        this.enabled = config.enabled !== false;

        this.element = this.create();
    }

    create() { /* Creates button DOM element */ }
    getIconSVG(icon) { /* Returns SVG for standard icons */ }
    appendTo(container) { /* Adds to DOM */ }
    show() { /* Show button */ }
    hide() { /* Hide button */ }
    enable() { /* Enable button */ }
    disable() { /* Disable button */ }
    destroy() { /* Remove from DOM */ }
}

/**
 * LongPressDetector class - Detects long press for focus mode entry
 */
export class LongPressDetector {
    constructor(element, onLongPress, options = {}) {
        this.element = element;
        this.onLongPress = onLongPress;
        this.threshold = options.threshold || 500; // ms
        this.moveThreshold = 10; // pixels (cancel if user drags)

        this.bindEvents();
    }

    handleStart(e) { /* Start timer, ignore if on button */ }
    handleEnd(e) { /* Clear timer if short press */ }
    handleMove(e) { /* Cancel if user drags beyond threshold */ }
    handleCancel() { /* Clean cancel */ }
    destroy() { /* Remove event listeners */ }
}
```

**Standard Icons:**
- `chevron-left` - Previous action
- `chevron-right` - Next action
- `chevron-up` - Up navigation
- `chevron-down` - Down navigation
- `magnify` - Focus/expand
- `cog` - Settings
- `refresh` - Reload

**Standard Positions:**
- `left` - Left side, vertically centered
- `right` - Right side, vertically centered
- `top-left` - Top left corner
- `top-right` - Top right corner
- `bottom-left` - Bottom left corner
- `bottom-right` - Bottom right corner

---

### 2. Shared Touch Control CSS

**File:** `js/widgets/shared/widget-touch-controls.css` (~105 lines)

```css
/**
 * Theme-aware touch button styles
 */
.widget-touch-button {
    position: absolute;
    width: 48px;
    height: 48px;
    border-radius: 50%;

    /* Theme-aware colors */
    background: var(--bg-tertiary, #444);
    border: 2px solid var(--text-muted, rgba(255, 255, 255, 0.3));
    color: var(--text-primary, white);

    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    transition: all 0.2s ease;
    user-select: none;
}

.widget-touch-button:hover {
    background: var(--bg-button, #666);
    border-color: var(--accent-orange, #ffaa00);
    transform: scale(1.1);
}

.widget-touch-button:active {
    background: var(--accent-orange, #ffaa00);
    transform: scale(0.95);
}

.widget-touch-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

/* Standard positions */
.widget-touch-button[data-position="left"] {
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
}

.widget-touch-button[data-position="right"] {
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
}

.widget-touch-button[data-position="top-right"] {
    top: 16px;
    right: 16px;
}

/* ... other positions ... */
```

**Theme Integration:**
- Uses CSS variables from `css/core/themes.css`
- Automatically adapts to dark/light/halloween themes
- No widget-specific theme code needed

---

### 3. Calendar Widget Integration

**File:** `js/widgets/Calendar/core/action-handler.js`

**Add imports:**
```javascript
import { TouchButton, LongPressDetector } from '/js/widgets/shared/widget-touch-controls.js';
```

**Add to constructor:**
```javascript
export class CalendarActionHandler {
  constructor(widget) {
    this.widget = widget;
    this.touchButtons = [];
    this.longPressDetector = null;

    // Set up touch controls if on touch device
    this.setupTouchControls();
  }
```

**New method:**
```javascript
  /**
   * Set up touch controls (buttons + long press)
   */
  setupTouchControls() {
    const container = document.body;

    // Previous period button (triggers 'left' action)
    const prevButton = new TouchButton({
      id: 'prev',
      position: 'left',
      icon: 'chevron-left',
      ariaLabel: `Previous ${this.widget.navigationManager.currentView}`,
      onClick: () => this.handleAction('left')
    });
    prevButton.appendTo(container);
    this.touchButtons.push(prevButton);

    // Next period button (triggers 'right' action)
    const nextButton = new TouchButton({
      id: 'next',
      position: 'right',
      icon: 'chevron-right',
      ariaLabel: `Next ${this.widget.navigationManager.currentView}`,
      onClick: () => this.handleAction('right')
    });
    nextButton.appendTo(container);
    this.touchButtons.push(nextButton);

    // Focus mode button (top-right)
    const focusButton = new TouchButton({
      id: 'focus',
      position: 'top-right',
      icon: 'magnify',
      ariaLabel: 'Expand calendar',
      onClick: () => this.enterFocusMode()
    });
    focusButton.appendTo(container);
    this.touchButtons.push(focusButton);

    // Long press detector (500ms threshold)
    this.longPressDetector = new LongPressDetector(
      container,
      () => this.enterFocusMode(),
      { threshold: 500 }
    );
  }

  /**
   * Enter focus mode (tell parent to focus this widget)
   */
  enterFocusMode() {
    window.parent.postMessage({
      type: 'event',
      widgetId: 'calendar',
      payload: {
        eventType: 'enter-focus',
        data: {}
      }
    }, '*');
  }
```

**Update cleanup:**
```javascript
  cleanup() {
    // Clean up touch controls
    this.touchButtons.forEach(btn => btn.destroy());
    this.touchButtons = [];
    this.longPressDetector?.destroy();
  }
```

**Import CSS in widget:**
```css
/* In calendar-widget.css - add at top */
@import '/js/widgets/shared/widget-touch-controls.css';
```

---

### 4. Dashboard Changes (Minimal)

**Remove hover-to-select on widgets:**

**File:** `css/modules/dashboard.css`

```css
/* REMOVE: Widget hover effects */
.dashboard-grid__cell:hover {
    /* Remove - widgets handle their own touch interactions */
}
```

**Handle focus requests from widgets:**

**File:** `js/core/widget-messenger.js`

```javascript
onMessage(message) {
    // ... existing code ...

    // Handle focus mode requests from widgets
    if (message.payload?.eventType === 'enter-focus') {
        AppComms.publish(AppComms.events.WIDGET_MESSAGE, {
            type: 'focus-requested',
            widgetId: message.widgetId
        });
    }
}
```

**File:** `js/modules/Dashboard/dashboard-navigation-manager.js`

```javascript
// Subscribe to focus requests
AppComms.subscribe(AppComms.events.WIDGET_MESSAGE, (data) => {
    if (data.type === 'focus-requested') {
        this.focusWidget(data.widgetId);
    }
});
```

---

## Implementation Timeline

### Week 1: Shared Utilities (2 days)

**Day 1: Touch Button & Long Press**
- [ ] Create `js/widgets/shared/widget-touch-controls.js`
  - [ ] TouchButton class (2-3 hours)
  - [ ] LongPressDetector class (2 hours)
  - [ ] SVG icon library (1 hour)
- [ ] Create `js/widgets/shared/widget-touch-controls.css`
  - [ ] Base button styles (1 hour)
  - [ ] Position variants (1 hour)
  - [ ] Theme integration (1 hour)

**Day 2: Testing & Documentation**
- [ ] Unit tests for TouchButton (2 hours)
- [ ] Unit tests for LongPressDetector (2 hours)
- [ ] Create example usage (1 hour)
- [ ] Document widget integration pattern (1 hour)

### Week 2: Calendar Integration (2-3 days)

**Day 3: Calendar Touch Controls**
- [ ] Update `action-handler.js` (2 hours)
  - [ ] Add setupTouchControls() method
  - [ ] Wire up button clicks to handleAction()
  - [ ] Add cleanup logic
- [ ] Import CSS in calendar-widget.css (30 mins)
- [ ] Test in browser (2 hours)

**Day 4: Dashboard Integration**
- [ ] Update widget-messenger.js (30 mins)
- [ ] Update dashboard-navigation-manager.js (30 mins)
- [ ] Remove widget hover styling (30 mins)
- [ ] Integration testing (3 hours)

**Day 5: Fire TV Testing**
- [ ] Test on Fire TV hardware (2 hours)
- [ ] Fix any Fire TV-specific issues (2-3 hours)
- [ ] Performance optimization (1 hour)

### Week 3: Sidebar & Polish (2 days)

**Day 6: Sidebar Touch Improvements**
- [ ] Increase sidebar icon sizes to 48px (1 hour)
- [ ] Remove hover-to-expand behavior (1 hour)
- [ ] Implement click-to-expand (2 hours)
- [ ] Test accessibility (2 hours)

**Day 7: Final Testing & Documentation**
- [ ] Cross-browser testing (2 hours)
- [ ] Mobile browser testing (2 hours)
- [ ] Update architecture docs (1 hour)
- [ ] Create widget integration guide (1 hour)

**Total: 7-8 days**

---

## Testing Checklist

### Functional Testing

**Calendar Widget:**
- [ ] Previous button navigates backward
- [ ] Next button navigates forward
- [ ] Focus button enters focus mode
- [ ] Long press (500ms) enters focus mode
- [ ] Short press does nothing (no accidental focus)
- [ ] Buttons work without focus mode
- [ ] D-pad navigation still works
- [ ] No duplicate actions (button + d-pad)

**Theme Testing:**
- [ ] Buttons visible in dark theme
- [ ] Buttons visible in light theme
- [ ] Buttons visible in halloween-dark theme
- [ ] Buttons visible in halloween-light theme
- [ ] Hover states match theme
- [ ] Active states match theme

**Platform Testing:**
- [ ] Desktop Chrome (mouse + keyboard)
- [ ] Desktop Firefox (mouse + keyboard)
- [ ] Desktop Safari (mouse + keyboard)
- [ ] Fire TV WebView (d-pad + touch)
- [ ] Mobile Chrome (touch only)
- [ ] Mobile Safari (touch only)

### Performance Testing

- [ ] Button render time < 50ms
- [ ] Touch response time < 100ms
- [ ] No jank during navigation transitions
- [ ] Memory usage stable (no leaks)
- [ ] No layout thrashing

### Accessibility Testing

- [ ] Buttons have aria-labels
- [ ] Buttons keyboard accessible (tab + enter)
- [ ] Focus indicators visible
- [ ] Screen reader announces buttons
- [ ] Minimum 48px touch target size
- [ ] Color contrast ratios pass WCAG AA

---

## Rollout Strategy

### Phase 1: Calendar Widget Only (Week 1-2)
- Implement touch controls
- Test thoroughly
- Validate architecture

### Phase 2: Expand to Other Widgets (Future)

**Easy wins (similar to Calendar):**
- Photos widget (prev/next photo)
- Weather widget (location selector)
- Clock widget (time zone selector)

**More complex:**
- Map widget (pan/zoom controls)
- Camera widget (PTZ controls)

### Phase 3: Sidebar Improvements (Week 3)
- Larger touch targets
- Click-to-expand behavior
- Mobile-first interaction model

---

## Success Criteria

- ✅ Touch buttons work on all platforms
- ✅ No duplicate action triggers
- ✅ Amazon Fire TV requirements met (48px minimum)
- ✅ Themes apply automatically
- ✅ No performance degradation
- ✅ Code reusable for other widgets
- ✅ Accessibility standards met
- ✅ Zero breaking changes to existing D-pad navigation

---

## Future Enhancements

### Multi-Touch Gestures (Post-MVP)
- Swipe left/right for navigation
- Pinch-to-zoom for focus mode
- Two-finger drag for scrolling

### Contextual Buttons (Post-MVP)
- Show/hide buttons based on widget state
- Different buttons for different view modes
- Adaptive button placement

### Haptic Feedback (Post-MVP)
- Vibration on button press (mobile only)
- Tactile feedback for actions

---

## Related Documents

- [Architecture](../architecture.md) - Overall system design
- [CSS Architecture](../architecture.md#cssstyling-architecture) - Styling guidelines
- [Widget Communication Protocol](../architecture.md#widget-communication-protocol) - postMessage spec

---

**End of Touch Interface Implementation Plan**

*Last Updated: 2025-10-22*
*Status: Ready to Implement*
