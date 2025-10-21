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
5. Applies visibility pattern (always, periodic, or rotation sequence)
6. Appends to target container (dashboard or widget iframe)

## Configuration Schema

Each theme configuration file exports an object with **two parts**:

```javascript
// 1. Rotation Sequences (optional) - Centralized timing
const ROTATION_SEQUENCES = {
    'sequence-name': [
        { element: 'element-id-1', duration: 12 },  // Show element for 12s
        { element: 'element-id-2', duration: 20 },  // Then show this for 20s
        { blank: 30 }                               // Then show nothing for 30s
        // Loops back to first step
    ]
};

// 2. Individual Elements - Visual configuration
const ELEMENTS = [
    {
        id: 'unique-element-id',
        src: '/path/to/animated.gif',
        container: 'dashboard',  // or 'widget-{name}'
        size: { width: '100px', height: 'auto' },
        position: { /* position config */ },
        movement: { /* movement config */ },
        visibility: { /* visibility config (optional if using rotation) */ }
    }
];

// 3. Export both
export const THEME_OVERLAY_CONFIG = {
    rotations: ROTATION_SEQUENCES,  // Optional
    elements: ELEMENTS
};
```

### Container Options

- **`dashboard`** - Appends to main dashboard overlay container
- **`widget-{name}`** - Appends to specific widget iframe's overlay container
  - Example: `widget-main` for calendar widget
  - Example: `widget-clock` for clock widget

## Position Types

### `static-xy`
Fixed position, no randomization.

```javascript
position: {
    type: 'static-xy',
    x: '50%',      // CSS left value
    y: '10px'      // CSS top value
}
```

### `variable-x`
Random X position, fixed Y position.

```javascript
position: {
    type: 'variable-x',
    xRange: [10, 90],  // Random X between 10% and 90%
    y: '50px'          // Fixed Y at 50px
}
```

### `variable-y`
Fixed X position, random Y position.

```javascript
position: {
    type: 'variable-y',
    x: '-100px',       // Fixed X at -100px (offscreen)
    yRange: [20, 80]   // Random Y between 20% and 80%
}
```

### `variable-xy`
Random X and Y positions.

```javascript
position: {
    type: 'variable-xy',
    xRange: [10, 90],   // Random X between 10% and 90%
    yRange: [10, 90]    // Random Y between 10% and 90%
}
```

## Movement Types

### `none`
No movement animation (static element or GIF already animated).

```javascript
movement: {
    type: 'none'
}
```

### `right` / `left`
Horizontal movement.

```javascript
movement: {
    type: 'right',
    distance: 'calc(100vw + 200px)',  // CSS distance value
    duration: 12,                      // Seconds
    easing: 'linear'                   // CSS easing function
}
```

### `down` / `up`
Vertical movement.

```javascript
movement: {
    type: 'down',
    distance: '300px',
    duration: 3,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
}
```

## Visibility Patterns

### `always`
Element is always visible.

```javascript
visibility: {
    type: 'always'
}
```

### `periodic`
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

### Rotation Sequences (Centralized Timing)

For elements that should alternate or appear in sequence, use **rotation sequences** instead of individual visibility config.

**Key Benefits:**
- All timing visible in one place at the top of the config
- Explicit blank gaps (no animation showing)
- Clear order of appearance
- No confusion about individual `offDuration` settings

**Configuration:**

```javascript
// At the top of your theme config file
const ROTATION_SEQUENCES = {
    'flying-creatures': [
        { element: 'bat-fly-1', duration: 12 },      // Show bat for 12s
        { element: 'ghosts-circle', duration: 20 },  // Show ghosts for 20s
        { blank: 30 }                                // Show NOTHING for 30s
        // Then loops back to bat
    ],

    'pumpkins': [
        { element: 'pumpkin-bat-1', duration: 15 },
        { element: 'pumpkin-glow-1', duration: 15 }
        // Loops immediately, no blank gap
    ]
};

// Elements referenced by rotation sequences should NOT have visibility config
const ELEMENTS = [
    {
        id: 'bat-fly-1',
        src: '/path/to/bat.gif',
        // ... position, movement config ...
        // NO visibility property - controlled by rotation sequence
    },
    {
        id: 'ghosts-circle',
        src: '/path/to/ghosts.gif',
        // ... position, movement config ...
        // NO visibility property - controlled by rotation sequence
    }
];

export const THEME_OVERLAY_CONFIG = {
    rotations: ROTATION_SEQUENCES,
    elements: ELEMENTS
};
```

**How Rotation Sequences Work:**
1. Engine reads the `rotations` object
2. For each sequence, starts at step 0
3. If step has `element`: Shows that element for `duration` seconds
4. If step has `blank`: Shows nothing for `blank` seconds
5. Moves to next step, loops back to step 0 after last step
6. Position re-randomization and animation restart happen each time element appears

**When to use Rotation Sequences:**
- Multiple elements should alternate (bat → ghosts → bat → ...)
- You need explicit blank periods between animations
- Timing should be clear and centralized
- Elements share a thematic relationship (flying creatures, decorations, etc.)

**When to use Periodic visibility:**
- Element operates independently
- Simple on/off cycle
- No relationship to other elements

## Example: Halloween Configuration

See [theme-overlay-halloween.js](theme-overlay-halloween.js) for a complete example.

**Structure:**
```javascript
// Rotation Sequences at the top
const ROTATION_SEQUENCES = {
    'flying-creatures': [
        { element: 'bat-fly-1', duration: 12 },
        { element: 'ghosts-circle', duration: 20 },
        { blank: 30 }
    ],
    'pumpkins': [
        { element: 'pumpkin-bat-1', duration: 15 },
        { element: 'pumpkin-glow-1', duration: 15 }
    ]
};

// Elements below
const ELEMENTS = [
    // Periodic elements (independent)
    { id: 'bat-drop-1', visibility: { type: 'periodic', ... } },
    { id: 'spider-walk-1', visibility: { type: 'periodic', ... } },

    // Rotation elements (no visibility config)
    { id: 'bat-fly-1' },  // Controlled by 'flying-creatures' sequence
    { id: 'ghosts-circle' },  // Controlled by 'flying-creatures' sequence
    { id: 'pumpkin-bat-1' },  // Controlled by 'pumpkins' sequence
    { id: 'pumpkin-glow-1' },  // Controlled by 'pumpkins' sequence

    // Always visible
    { id: 'spider-drop', visibility: { type: 'always' } }
];
```

**Elements:**
1. **bat-drop-1** - Periodic bat dropping from random X positions (6s on, 10s off)
2. **spider-walk-1** - Periodic spider appearing at random positions (10s on, 8s off)
3. **bat-fly-1** - Part of 'flying-creatures' rotation (12s)
4. **pumpkin-bat-1** - Part of 'pumpkins' rotation (15s)
5. **pumpkin-glow-1** - Part of 'pumpkins' rotation (15s)
6. **spider-drop** - Always visible static spider at top
7. **ghosts-circle** - Part of 'flying-creatures' rotation (20s)

**Rotation Sequences:**
- **flying-creatures**: bat (12s) → ghosts (20s) → blank (30s) → repeat
- **pumpkins**: pumpkin-bat (15s) → pumpkin-glow (15s) → repeat continuously

## Creating a New Theme Overlay

To add overlay support for a new theme:

### Step 1: Create Configuration File

Create `js/themes/theme-overlay-{themename}.js`:

```javascript
// Define rotation sequences (optional)
const ROTATION_SEQUENCES = {
    'snowfall': [
        { element: 'snowflake-1', duration: 10 },
        { element: 'snowflake-2', duration: 10 },
        { blank: 5 }
    ]
};

// Define individual elements
const ELEMENTS = [
    {
        id: 'snowflake-1',
        src: '/assets/themes/winter/snowflake-1.gif',
        container: 'dashboard',
        size: { width: '50px' },
        position: { type: 'variable-x', xRange: [0, 100], y: '-50px' },
        movement: { type: 'down', distance: '100vh', duration: 10, easing: 'linear' }
        // No visibility - controlled by 'snowfall' rotation
    },
    {
        id: 'snowflake-2',
        src: '/assets/themes/winter/snowflake-2.gif',
        container: 'dashboard',
        size: { width: '60px' },
        position: { type: 'variable-x', xRange: [0, 100], y: '-50px' },
        movement: { type: 'down', distance: '100vh', duration: 8, easing: 'linear' }
        // No visibility - controlled by 'snowfall' rotation
    }
];

// Export configuration
export const WINTER_OVERLAY_CONFIG = {
    rotations: ROTATION_SEQUENCES,
    elements: ELEMENTS
};
```

### Step 2: Import in Applier

Update [theme-overlay-applier.js](theme-overlay-applier.js):

```javascript
import { WINTER_OVERLAY_CONFIG } from './theme-overlay-winter.js';

// In applyOverlay() method:
if (themeId === 'winter-theme') {
    this.applyWinterOverlay();
}

// Add method:
applyWinterOverlay(configOverride) {
    const config = configOverride || WINTER_OVERLAY_CONFIG;
    const elements = config.elements;
    const rotations = config.rotations;

    // Create each element
    elements.forEach(elementConfig => {
        this.createElement(elementConfig);
    });

    // Initialize rotation sequences
    if (rotations) {
        Object.keys(rotations).forEach(sequenceName => {
            const sequence = rotations[sequenceName];
            this.startRotationSequence(sequenceName, sequence);
        });
    }
}
```

### Step 3: Add Assets

Place your GIF/PNG assets in `/assets/themes/{themename}/` directory.

## Performance Considerations

### Animation Level Settings

Users can control animation intensity via Settings > Display > Manage Themes:
- **Disabled**: No overlays shown
- **Low**: Only static elements (no movement)
- **High**: All elements including movement

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
- Rotation sequence timeouts are cleared on theme change
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

Periodic and rotation elements use `animation-fill-mode: forwards` to prevent the "jump back" issue where elements would snap to starting position after animation completes.

### Widget Iframe Injection

When targeting a widget (`container: 'widget-{name}'`):
1. Engine finds the iframe element by ID
2. Accesses `iframe.contentDocument`
3. Creates or finds `.widget-theme-overlay` container in iframe body
4. Appends overlay elements to that container

This allows overlays to appear INSIDE widget iframes, not just on the dashboard.

### Timing Sequence

**For periodic visibility:**
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

**For rotation sequences:**
1. Sequence starts at step 0
2. If step is `{ element: 'id', duration: N }`:
   - Element made visible with fade in
   - Position randomized (if variable)
   - Movement animation starts (if configured)
   - After `duration`: Fade out and hide
   - Move to next step
3. If step is `{ blank: N }`:
   - Nothing shown
   - Wait `N` seconds
   - Move to next step
4. After last step, loop back to step 0

### Rotation Sequences vs Old Rotating Groups

The current system uses **centralized rotation sequences** defined at the top of the config file. This is cleaner and more explicit than the old rotating group system where timing was scattered across individual element definitions.

**Benefits:**
- All timing in one place (easy to understand)
- Explicit blank gaps
- Clear sequence order
- No confusion about which element's `offDuration` applies

## Limitations

- **Lottie animations** are not yet supported (only GIF/PNG)
- **Widget detection** assumes widgets use standard IDs (`widget-{name}`)
- **Cross-origin iframes** cannot have overlays injected (security restriction)

## Future Enhancements

- [ ] Add Lottie animation support
- [ ] Add particle effect system (canvas-based)
- [ ] Add sound effects for overlay elements
- [ ] Add interactive overlays (click events)
- [ ] Add per-element animation level override
