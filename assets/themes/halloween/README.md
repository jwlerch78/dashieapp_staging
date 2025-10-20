# Halloween Theme Assets

## Directory Structure

```
halloween/
├── animated/    - Animated GIFs for overlay effects
├── static/      - Static SVG/PNG decorations
└── lottie/      - Lottie JSON animations (future)
```

## animated/

Place your Halloween GIF files here:
- `spider-drop.gif` - Spider dropping animation
- `bat-fly.gif` - Bat flying across screen
- `ghost-float.gif` - Floating ghost
- `pumpkin-glow.gif` - Glowing pumpkin
- etc.

**Recommended specs:**
- Format: GIF (optimized)
- Max size: 200-300px width
- File size: < 500KB each
- Transparent background preferred

## static/

Static decorative elements (future):
- Corner decorations
- Border elements
- Background patterns

## Usage

These assets are loaded by the `ThemeOverlay` component when a Halloween theme is active.

See: `js/ui/theme-overlay.js` for implementation.
