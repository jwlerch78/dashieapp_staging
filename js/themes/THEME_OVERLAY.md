# Theme Overlay System

The Theme Overlay System provides advanced animated decorations that can be applied to themes. It supports complex positioning, movement animations, and visibility patterns for creating immersive seasonal or thematic experiences.

## Architecture

The overlay system is split into two components:

1. **theme-overlay-applier.js** - The core engine that manages overlay elements
2. **theme-overlay-{theme}.js** - Theme-specific configuration files (e.g., `theme-overlay-halloween.js`)

This separation allows:
- Easy addition of new themed overlays without modifying core engine
- Cleaner code organization and maintainability
- Independent testing of configurations vs. engine logic

## Files

```
js/themes/
├── theme-overlay-applier.js     # Core overlay engine (ThemeOverlay class)
├── theme-overlay-halloween.js   # Halloween theme configuration
└── THEME_OVERLAY.md            # This documentation
```

## How It Works

### 1. Initialization

The overlay system is initialized during theme application:

```javascript
// In theme-applier.js
import { themeOverlay } from './themes/theme-overlay-applier.js';

// Apply overlay when theme is applied
themeOverlay.applyOverlay(themeId);
```

### 2. Re-Application for Widget Iframes

Since some overlay elements target widget iframes (which don't exist during initial theme application), the overlay is **re-applied** after widgets are initialized:

```javascript
// In core-initializer.js (after initializeWidgets)
const { themeOverlay } = await import('../../themes/theme-overlay-applier.js');
themeOverlay.clearOverlay();  // Clear first attempt
themeOverlay.applyOverlay(themeApplier.getCurrentTheme());  // Re-apply with widgets ready
```

### 3. Element Creation

For each overlay element configuration, the engine:
1. Creates a wrapper `<div>` with class `overlay-element-wrapper`
2. Creates an `<img>` element with the specified source
3. Applies positioning (static or randomized)
4. Applies movement animation (if specified)
5. Applies visibility pattern (always, periodic, or rotating)
6. Appends to target container (dashboard or widget iframe)

## Configuration Schema

Each theme configuration file exports an object with an `elements` array:

```javascript
export const THEME_OVERLAY_CONFIG = {
    elements: [
        {
            id: 'unique-element-id',
            src: '/path/to/animated.gif',
            container: 'dashboard',  // or 'widget-{name}'
            size: { width: '100px', height: 'auto' },
            position: { /* position config */ },
            movement: { /* movement config */ },
            visibility: { /* visibility config */ }
        }
        // ... more elements
    ]
};
```

### Container Options

- **`dashboard`** - Appends to main dashboard overlay container
- **`widget-{name}`** - Appends to specific widget iframe's overlay container
  - Example: `widget-main` for calendar widget
  - Example: `widget-clock` for clock widget

### Position Types

#### `static-xy`
Fixed position, no randomization.

```javascript
position: {
    type: 'static-xy',
    x: '50%',      // CSS left value
    y: '10px'      // CSS top value
}
```

#### `variable-x`
Random X position, fixed Y position.

```javascript
position: {
    type: 'variable-x',
    xRange: [10, 90],  // Random X between 10% and 90%
    y: '50px'          // Fixed Y at 50px
}
```

#### `variable-y`
Fixed X position, random Y position.

```javascript
position: {
    type: 'variable-y',
    x: '-100px',       // Fixed X at -100px (offscreen)
    yRange: [20, 80]   // Random Y between 20% and 80%
}
```

#### `variable-xy`
Random X and Y positions.

```javascript
position: {
    type: 'variable-xy',
    xRange: [10, 90],   // Random X between 10% and 90%
    yRange: [10, 90]    // Random Y between 10% and 90%
}
```

### Movement Types

#### `none`
No movement animation (static element or GIF already animated).

```javascript
movement: {
    type: 'none'
}
```

#### `right` / `left`
Horizontal movement.

```javascript
movement: {
    type: 'right',
    distance: 'calc(100vw + 200px)',  // CSS distance value
    duration: 12,                      // Seconds
    easing: 'linear'                   // CSS easing function
}
```

#### `down` / `up`
Vertical movement.

```javascript
movement: {
    type: 'down',
    distance: '300px',
    duration: 3,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
}
```

### Visibility Types

#### `always`
Element is always visible.

```javascript
visibility: {
    type: 'always'
}
```

#### `periodic`
Show/hide cycle - element appears for `onDuration`, hides for `offDuration`, then repeats.

```javascript
visibility: {
    type: 'periodic',
    onDuration: 12,    // Seconds visible
    offDuration: 6     // Seconds hidden
}
```

**Periodic Behavior:**
- On each cycle start, variable positions are **re-randomized**
- Movement animations restart from the beginning
- Element fades in (opacity 0 → 1), animates, fades out, waits, then repeats

#### `rotating`
Group rotation - elements in the same group take turns being visible.

```javascript
visibility: {
    type: 'rotating',
    group: 'flying-creatures',  // Group name (all members with same name take turns)
    onDuration: 12,             // Seconds this element is visible when it's its turn
    offDuration: 30             // (Optional) Wait time after last member before restarting cycle
}
```

**Rotating Behavior:**
- Elements with the same `group` name take turns being visible
- Each element shows for its `onDuration`, then the next member shows
- If the last member in the group has `offDuration`, the system waits before restarting the cycle
- Position re-randomization and animation restart happen on each turn
- Useful for alternating between similar effects (e.g., bat flies across → ghosts float across → wait → repeat)

## Example: Halloween Configuration

See [theme-overlay-halloween.js](theme-overlay-halloween.js) for a complete example with 7 overlay elements:

1. **bat-drop-1** - Periodic bat dropping from random X positions
2. **spider-walk-1** - Periodic spider appearing at random positions (GIF animated)
3. **bat-fly-1** - Rotating group "flying-creatures": bat flying across calendar widget (12s)
4. **pumpkin-bat-1** - Rotating group "pumpkins": pumpkin with bat (15s)
5. **pumpkin-glow-1** - Rotating group "pumpkins": glowing pumpkin (15s)
6. **spider-drop** - Static hanging spider at top
7. **ghosts-circle** - Rotating group "flying-creatures": ghosts floating across bottom (20s)

**Rotating Group "flying-creatures":**
- Shows bat-fly-1 for 12 seconds
- Then shows ghosts-circle for 20 seconds
- Waits 30 seconds
- Repeats cycle

**Rotating Group "pumpkins":**
- Shows pumpkin-bat-1 for 15 seconds
- Then shows pumpkin-glow-1 for 15 seconds
- Repeats immediately (no gap)

## Creating a New Theme Overlay

To add overlay support for a new theme:

### Step 1: Create Configuration File

Create `js/themes/theme-overlay-{themename}.js`:

```javascript
export const MYTHEME_OVERLAY_CONFIG = {
    elements: [
        {
            id: 'snowflake-1',
            src: '/assets/themes/winter/snowflake.gif',
            container: 'dashboard',
            size: { width: '50px' },
            position: { type: 'variable-x', xRange: [0, 100], y: '-50px' },
            movement: { type: 'down', distance: '100vh', duration: 10, easing: 'linear' },
            visibility: { type: 'periodic', onDuration: 10, offDuration: 5 }
        }
    ]
};
```

### Step 2: Import in Applier

Update [theme-overlay-applier.js](theme-overlay-applier.js):

```javascript
import { MYTHEME_OVERLAY_CONFIG } from './theme-overlay-mytheme.js';

// In applyOverlay() method:
if (themeId === 'winter-theme') {
    this.applyMyThemeOverlay();
}

// Add method:
applyMyThemeOverlay(configOverride) {
    const config = configOverride || MYTHEME_OVERLAY_CONFIG;
    const elements = config.elements;
    elements.forEach(elementConfig => {
        this.createElement(elementConfig);
    });
}
```

### Step 3: Add Assets

Place your GIF/PNG assets in `/assets/themes/{themename}/` directory.

## Performance Considerations

### Reduced Motion

The overlay system respects the `prefers-reduced-motion` media query:

```javascript
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // All overlays are disabled
}
```

### GPU Acceleration

Overlays use CSS transforms for animations (GPU-accelerated) rather than changing `left`/`top` positions (CPU-based).

### Memory Management

- All intervals and timeouts are tracked and cleared when overlay is removed
- Element references are stored in a Map for efficient cleanup
- Widget iframe overlays are removed when theme changes

## Debugging

Use the console command `inspectOverlay()` to debug overlay elements:

```javascript
// Inspect all overlay elements
inspectOverlay();

// Inspect specific element
inspectOverlay('bat-drop-1');
```

This shows:
- Element opacity, display, position, transform
- Animation state and timing
- Widget iframe overlay status

## Technical Notes

### Animation Fill-Mode

Periodic elements use `animation-fill-mode: forwards` to prevent the "jump back" issue where elements would snap to starting position after animation completes.

### Widget Iframe Injection

When targeting a widget (`container: 'widget-{name}'`):
1. Engine finds the iframe element by ID
2. Accesses `iframe.contentDocument`
3. Creates or finds `.widget-theme-overlay` container in iframe body
4. Appends overlay elements to that container

This allows overlays to appear INSIDE widget iframes, not just on the dashboard.

### Timing Sequence

For periodic visibility:
1. Element made visible (`display: block`, `opacity: 0`)
2. Position randomized (if variable)
3. Transform reset to `translate(0, 0)`
4. Brief delay (10ms)
5. Fade in (`opacity: 1`)
6. Movement animation starts (if configured)
7. After `onDuration`: Fade out (`opacity: 0`)
8. After fade completes: Hide (`display: none`)
9. Wait `offDuration`
10. Repeat from step 1

## Limitations

- **Lottie animations** are not yet supported (only GIF/PNG)
- **Widget detection** assumes widgets use standard IDs (`widget-{name}`)
- **Cross-origin iframes** cannot have overlays injected (security restriction)

## Future Enhancements

- [x] ~~Implement rotating group visibility~~ (Completed!)
- [ ] Add Lottie animation support
- [ ] Add particle effect system (canvas-based)
- [ ] Add sound effects for overlay elements
- [ ] Add interactive overlays (click events)
- [ ] Add overlay intensity slider in settings
