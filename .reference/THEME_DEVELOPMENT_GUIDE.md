# Theme Development Guide
**Version:** 1.0
**Date:** 2025-10-23

Complete guide for creating and customizing themes in Dashie using the semantic variable system.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Theme Architecture](#theme-architecture)
4. [Creating a New Theme](#creating-a-new-theme)
5. [Variable Reference](#variable-reference)
6. [Testing Your Theme](#testing-your-theme)
7. [Best Practices](#best-practices)
8. [Common Patterns](#common-patterns)
9. [Troubleshooting](#troubleshooting)
10. [Examples](#examples)

---

## Overview

### What is a Theme?

A theme in Dashie is a collection of color values mapped to semantic variables. Themes control the visual appearance of the entire application without changing any component code.

### Two-Tier System

**Tier 1: Semantic Variables** (in components)
```css
.button {
  background: var(--color-interactive-primary);  /* Semantic name */
}
```

**Tier 2: Theme-Specific Values** (in theme file)
```css
body.theme-dark {
  --color-interactive-primary: #00aaff;  /* Blue in dark theme */
}

body.theme-halloween-dark {
  --color-interactive-primary: #39FF14;  /* Green in Halloween! */
}
```

### Benefits

- ✅ No code changes needed to add themes
- ✅ Consistent naming across all themes
- ✅ Easy to understand what each color does
- ✅ Quick theme creation (~30 minutes)
- ✅ Type-safe with CSS custom properties

---

## Quick Start

### Creating Your First Theme (5 Minutes)

1. **Open** `css/core/themes-semantic.css`

2. **Copy** an existing theme block (e.g., `body.theme-dark`)

3. **Rename** the class:
```css
body.theme-my-theme {
  /* Your theme here */
}
```

4. **Change** the colors to your liking:
```css
body.theme-my-theme {
  --color-interactive-primary: #ff1493;  /* Hot pink! */
  --surface-base: #000;                   /* Black base */
  --text-emphasis-high: #fff;             /* White text */
  /* ... etc ... */
}
```

5. **Test** by applying the theme class in browser console:
```javascript
document.body.className = 'theme-my-theme';
```

6. **Done!** Your theme is live.

---

## Theme Architecture

### File Structure

```
css/core/
├── variables.css              # Structural constants (spacing, typography)
├── variables-semantic.css     # Semantic variable definitions (Tier 1)
├── themes-semantic.css        # Theme-specific values (Tier 2) ← YOU EDIT THIS
└── themes.css                 # Legacy theme file (deprecated)
```

### How Themes Work

1. **Page loads** → CSS variables set to defaults from `variables-semantic.css`
2. **Body class applied** → Theme overrides kick in from `themes-semantic.css`
3. **Components render** → Use semantic variables, get themed colors automatically

### Theme Activation

Themes are activated by applying a class to the `<body>` element:

```html
<body class="theme-dark">           <!-- Dark theme -->
<body class="theme-light">          <!-- Light theme -->
<body class="theme-halloween-dark"> <!-- Halloween theme -->
<body class="theme-my-custom">      <!-- Your custom theme -->
```

---

## Creating a New Theme

### Step 1: Choose a Base Theme

Start with the theme closest to what you want:

- **Dark theme** → For dark backgrounds with light text
- **Light theme** → For light backgrounds with dark text
- **Halloween dark** → For vibrant colors on dark
- **Halloween light** → For vibrant colors on light

### Step 2: Define Your Color Palette

Before coding, decide on your colors:

```
Interactive:
  Primary:   #______  (main actions, focus states)
  Secondary: #______  (secondary actions)
  Tertiary:  #______  (subtle interactions)

Surfaces:
  Base:      #______  (main background)
  Raised:    #______  (widget backgrounds)
  Overlay:   #______  (modals, dropdowns)

Text:
  High:      #______  (headings, labels)
  Medium:    #______  (body text)
  Low:       #______  (timestamps, hints)
```

### Step 3: Create Theme Block

In `css/core/themes-semantic.css`:

```css
/* ============================================================================
   MY CUSTOM THEME - Short Description
   ============================================================================ */

body.theme-my-custom {
  /* ===== INTERACTIVE COLORS ===== */
  --color-interactive-primary: #______;
  --color-interactive-secondary: #______;
  --color-interactive-tertiary: #______;

  /* ===== FOCUS & SELECTION ===== */
  --color-focus-ring: #______;
  --color-selection-border: #______;
  --color-selection-fill: rgba(_, _, _, 0.2);
  --color-navigation-highlight: #______;

  /* ===== TEMPORAL/CALENDAR ===== */
  --color-time-current: #______;
  --color-calendar-today: #______;
  --color-event-primary: #______;

  /* ===== SURFACES ===== */
  --surface-base: #______;
  --surface-raised: #______;
  --surface-overlay: #______;
  --surface-interactive: rgba(_, _, _, 0.2);
  --surface-button: #______;
  --surface-input: #______;
  --surface-modal-backdrop: rgba(0, 0, 0, 0.7);
  --surface-grid-gap: #______;

  /* ===== TEXT ===== */
  --text-emphasis-high: #______;
  --text-emphasis-medium: #______;
  --text-emphasis-low: #______;
  --text-on-interactive: #______;

  /* ===== BORDERS ===== */
  --border-subtle: rgba(_, _, _, 0.1);
  --border-medium: rgba(_, _, _, 0.2);
  --border-strong: rgba(_, _, _, 0.3);

  /* ===== EFFECTS ===== */
  --effect-glow-selection: 0 0 20px rgba(_, _, _, 0.6), 0 0 45px rgba(_, _, _, 0.3);
  --effect-glow-focus: 0 0 25px rgba(_, _, _, 0.9), 0 0 55px rgba(_, _, _, 0.5);

  /* ===== ASSETS ===== */
  --asset-sidebar-logo: url('/artwork/Dashie_Full_Logo________.png');
  --asset-icon-filter: invert(____%);
}
```

### Step 4: Fill in the Blanks

Use your color palette from Step 2 to fill in all the `#______` placeholders.

### Step 5: Test

See [Testing Your Theme](#testing-your-theme) section below.

---

## Variable Reference

### Interactive Colors

#### `--color-interactive-primary`
**Purpose:** Main interactive color for primary actions

**Used in:**
- Primary buttons
- Active widget borders (when controlling widget)
- Main action highlights
- Primary links

**Examples:**
- Dark: `#00aaff` (Blue)
- Light: `#2196f3` (Material Blue)
- Halloween Dark: `#39FF14` (Neon Green)

**Tip:** Should be vibrant and eye-catching. This is your brand color.

---

#### `--color-interactive-secondary`
**Purpose:** Secondary interactive color for alternative actions

**Used in:**
- Secondary buttons
- Alternative highlights
- Decorative accents
- Secondary actions

**Examples:**
- Dark: `#ffaa00` (Orange)
- Light: `#ff9800` (Material Orange)
- Halloween Dark: `#FF6B1A` (Halloween Orange)

**Tip:** Should complement primary color but be visually distinct.

---

#### `--color-interactive-tertiary`
**Purpose:** Subtle interactive elements and disabled states

**Used in:**
- Disabled buttons
- Subtle interactive elements
- Low-emphasis actions

**Examples:**
- Dark: `#666` (Gray)
- Light: `#90a4ae` (Blue-gray)
- Halloween Dark: `#6B1FA0` (Purple)

**Tip:** Should be muted/subtle. Often a gray or desaturated color.

---

### Focus & Selection

#### `--color-focus-ring`
**Purpose:** Keyboard focus indicator and active widget border

**Used in:**
- Active widget border (blue glow when controlling widget)
- Keyboard focus outlines
- Input field focus rings

**Examples:**
- Dark: `#00aaff` (Blue)
- Halloween Dark: `#39FF14` (Green)

**Tip:** Should be highly visible. Often same as `--color-interactive-primary`.

**Accessibility:** Must have 3:1 contrast ratio with adjacent colors.

---

#### `--color-selection-border`
**Purpose:** Grid/menu navigation selection indicator

**Used in:**
- Grid cell selection border (when navigating with D-pad)
- Menu item selection highlights
- Navigation focus indicators

**Examples:**
- Dark: `#a8b0b8` (Silver)
- Light: `#6b7280` (Gray)
- Halloween Dark: `#FF6B1A` (Orange)

**Tip:** Should be distinct from focus color. Often silver/gray or secondary color.

---

#### `--color-selection-fill`
**Purpose:** Selected item background fill

**Used in:**
- Selected grid cell backgrounds
- Selected menu item fills
- Highlighted items

**Examples:**
- Dark: `rgba(168, 176, 184, 0.2)` (Translucent silver)
- Light: `rgba(33, 150, 243, 0.2)` (Translucent blue)

**Tip:** Use rgba with low opacity (0.1-0.3) for subtle fill.

---

### Temporal/Calendar Colors

#### `--color-time-current`
**Purpose:** Current time indicator in calendar

**Used in:**
- Calendar current time line
- "Now" markers
- Real-time indicators

**Examples:**
- Dark: `#00aaff` (Blue)
- Halloween Dark: `#FF6B1A` (Orange)

**Tip:** Should stand out from events. Often primary or secondary color.

---

#### `--color-calendar-today`
**Purpose:** Today's date highlight

**Used in:**
- Today marker in calendar
- Current day highlights

**Tip:** Can be same as `--color-time-current` or `--color-interactive-primary`.

---

### Surface Colors (Backgrounds)

#### `--surface-base`
**Purpose:** Base background layer

**Used in:**
- Body background
- Main container backgrounds
- Default areas

**Examples:**
- Dark: `#222` (Dark gray)
- Light: `#FCFCFF` (Off-white)
- Halloween Dark: `#1A0A1F` (Purple-black)

**Tip:** This is your app's main background color. All other surfaces layer on top.

---

#### `--surface-raised`
**Purpose:** Elevated surfaces (cards, widgets)

**Used in:**
- Widget backgrounds
- Card backgrounds
- Elevated panels

**Examples:**
- Dark: `#333` (Lighter than base)
- Light: `#FCFCFF` (Often same as base)
- Halloween Dark: `#2D1F1A` (Orange-tinted)

**Tip:** Should be slightly lighter/different from base to show elevation.

---

#### `--surface-overlay`
**Purpose:** Overlay surfaces (modals, dropdowns)

**Used in:**
- Modal backgrounds
- Dropdown menus
- Popovers
- Navigation bars

**Examples:**
- Dark: `#444` (Even lighter)
- Light: `#eeeeee` (Light gray)

**Tip:** Another step lighter for layering.

---

#### `--surface-interactive`
**Purpose:** Interactive surface tint/overlay

**Used in:**
- Hover state overlays
- Active state tints
- Button press effects
- Page navigation arrow overlays

**Examples:**
- Dark: `rgba(255, 255, 255, 0.2)` (White tint)
- Light: `rgba(33, 150, 243, 0.2)` (Blue tint)
- Halloween Dark: `rgba(255, 107, 26, 0.3)` (Orange tint)

**Tip:** Use rgba with low opacity. Creates hover/active effects.

---

#### `--surface-button`
**Purpose:** Button backgrounds

**Used in:**
- Default button backgrounds
- Clickable element backgrounds

**Tip:** Should be distinct from other surfaces. Often mid-tone gray.

---

#### `--surface-grid-gap`
**Purpose:** Color visible between grid items

**Used in:**
- Dashboard grid gaps
- Spacing between widgets

**Examples:**
- Dark: `#333` (Often same as base)
- Halloween Dark: `#1A0A1F` (Match base for seamless look)

**Tip:** Use base color for seamless grid, or contrasting color for visible gaps.

---

### Text Hierarchy

#### `--text-emphasis-high`
**Purpose:** High-emphasis text (headings, labels)

**Used in:**
- Headings (h1, h2, etc.)
- Form labels
- Widget titles
- Primary content

**Examples:**
- Dark: `#fff` (White)
- Light: `#424242` (Dark gray)

**Tip:** Maximum contrast with background for readability.

**Accessibility:** Must have 4.5:1 contrast ratio with surface colors.

---

#### `--text-emphasis-medium`
**Purpose:** Medium-emphasis text (body, descriptions)

**Used in:**
- Body text
- Descriptions
- Secondary labels
- Form values

**Examples:**
- Dark: `#ccc` (Light gray)
- Light: `#616161` (Medium gray)

**Tip:** Slightly reduced contrast from high-emphasis.

**Accessibility:** Should have at least 4.5:1 contrast for body text.

---

#### `--text-emphasis-low`
**Purpose:** Low-emphasis text (hints, timestamps)

**Used in:**
- Timestamps
- Hints/placeholders
- Metadata
- Disabled text

**Examples:**
- Dark: `#999` (Medium gray)
- Light: `#9e9e9e` (Gray)

**Tip:** Lower contrast for de-emphasized text.

**Accessibility:** Minimum 3:1 contrast for large text only.

---

### Border Colors

#### `--border-subtle`
**Purpose:** Subtle borders and dividers

**Used in:**
- Subtle divider lines
- Low-contrast borders

**Tip:** Use rgba with very low opacity (0.05-0.1).

---

#### `--border-medium`
**Purpose:** Standard borders

**Used in:**
- Default borders
- Container outlines

**Tip:** Medium opacity (0.1-0.2).

---

#### `--border-strong`
**Purpose:** Emphasized borders

**Used in:**
- Strong borders
- Important dividers

**Tip:** Higher opacity (0.2-0.3).

---

### Visual Effects

#### `--effect-glow-selection`
**Purpose:** Glow effect for selected items

**Used in:**
- Grid cell selection glow
- Menu selection glow

**Format:** `box-shadow` value with two layers (inner + outer glow)

**Example:**
```css
--effect-glow-selection:
  0 0 20px rgba(168, 176, 184, 0.6),    /* Inner glow */
  0 0 45px rgba(168, 176, 184, 0.3);    /* Outer glow */
```

**Tip:** Use color from `--color-selection-border` with rgba.

---

#### `--effect-glow-focus`
**Purpose:** Glow effect for active/focused items

**Used in:**
- Active widget glow
- Focus state effects

**Example:**
```css
--effect-glow-focus:
  0 0 25px rgba(0, 170, 255, 0.9),      /* Inner glow */
  0 0 55px rgba(0, 170, 255, 0.5);      /* Outer glow */
```

**Tip:** Use color from `--color-focus-ring` with rgba. Should be stronger than selection glow.

---

### Theme Assets

#### `--asset-sidebar-logo`
**Purpose:** Sidebar logo image path

**Values:**
- Dark themes: `url('/artwork/Dashie_Full_Logo_White_Transparent.png')`
- Light themes: `url('/artwork/Dashie_Full_Logo_Black_Transparent.png')`

**Tip:** Use white logo for dark themes, black logo for light themes.

---

#### `--asset-icon-filter`
**Purpose:** CSS filter to apply to sidebar icons

**Values:**
- Dark themes: `invert(100%)` (makes icons white)
- Light themes: `invert(20%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(0.3)` (makes icons dark)

**Tip:** Use filter to tint icons to match theme without separate icon files.

---

## Testing Your Theme

### Manual Testing Checklist

#### Visual Inspection
- [ ] Dashboard grid renders correctly
- [ ] Widgets visible and readable
- [ ] Sidebar icons visible
- [ ] Logo displays correctly

#### Interactive States
- [ ] Grid navigation selection visible
- [ ] Widget focus (ENTER key) shows blue glow
- [ ] Widget active (RIGHT key) shows active state
- [ ] Hover states work on buttons

#### Text Readability
- [ ] Headings readable
- [ ] Body text readable
- [ ] Timestamps/hints readable
- [ ] Text on buttons readable

#### All Components
- [ ] Dashboard
- [ ] Calendar widget
- [ ] Agenda widget
- [ ] Clock widget
- [ ] Photo widget
- [ ] Settings modal
- [ ] Welcome wizard

### Browser Testing

Test in:
- Chrome/Desktop
- Safari/Desktop
- Fire TV browser (critical!)
- Mobile Safari
- Mobile Chrome

### Accessibility Testing

Use browser DevTools to check:

1. **Contrast Ratios:**
   - Text on background: 4.5:1 minimum
   - Large text (18pt+): 3:1 minimum
   - UI components: 3:1 minimum

2. **Focus Indicators:**
   - Keyboard focus visible
   - Focus ring has 3:1 contrast with background

3. **Color Blindness:**
   - Test with color blindness simulators
   - Don't rely on color alone for information

### Automated Testing

```javascript
// In browser console:

// Apply your theme
document.body.className = 'theme-my-custom';

// Check for undefined variables (should be empty array)
Array.from(document.styleSheets)
  .flatMap(sheet => Array.from(sheet.cssRules || []))
  .filter(rule => rule.style && rule.style.getPropertyValue('background-color')?.includes('undefined'));

// Get computed values
getComputedStyle(document.documentElement).getPropertyValue('--color-interactive-primary');
```

---

## Best Practices

### Do's ✅

1. **Use Semantic Names**
   - ✅ `--color-interactive-primary`
   - ❌ `--blue-button-color`

2. **Maintain Consistency**
   - Use same color for same purpose across all themes
   - Interactive primary should always be the main action color

3. **Test Accessibility**
   - Check contrast ratios
   - Test with screen readers
   - Verify keyboard navigation

4. **Document Your Choices**
   - Add comments explaining color choices
   - Note any special considerations

5. **Start from Existing Theme**
   - Copy similar theme and modify
   - Don't start from scratch

### Don'ts ❌

1. **Don't Hardcode Colors**
   - ❌ `background: #00aaff;`
   - ✅ `background: var(--color-interactive-primary);`

2. **Don't Skip Variables**
   - Define all required variables
   - Missing variables = broken theme

3. **Don't Ignore Accessibility**
   - Low contrast = unusable for many users
   - Always check contrast ratios

4. **Don't Make Similar Colors**
   - Selection border vs focus ring should be distinct
   - Users need to see difference

5. **Don't Forget Effects**
   - Glow effects enhance UX
   - Define them for your theme colors

---

## Common Patterns

### Dark Theme Pattern

```css
body.theme-my-dark {
  /* Dark surfaces, light text */
  --surface-base: #222;             /* Dark background */
  --surface-raised: #333;           /* Slightly lighter */
  --surface-overlay: #444;          /* Even lighter */

  --text-emphasis-high: #fff;       /* White text */
  --text-emphasis-medium: #ccc;     /* Light gray */
  --text-emphasis-low: #999;        /* Medium gray */

  /* Vibrant interactive colors stand out on dark */
  --color-interactive-primary: #00aaff;
  --color-interactive-secondary: #ffaa00;
}
```

### Light Theme Pattern

```css
body.theme-my-light {
  /* Light surfaces, dark text */
  --surface-base: #FCFCFF;          /* Light background */
  --surface-raised: #FCFCFF;        /* Same or slightly darker */
  --surface-overlay: #eeeeee;       /* Gray overlay */

  --text-emphasis-high: #424242;    /* Dark text */
  --text-emphasis-medium: #616161;  /* Medium gray */
  --text-emphasis-low: #9e9e9e;     /* Light gray */

  /* Slightly muted interactive colors */
  --color-interactive-primary: #2196f3;
  --color-interactive-secondary: #ff9800;
}
```

### Themed Variant Pattern

```css
body.theme-my-vibrant-dark {
  /* Start with dark theme pattern */
  --surface-base: #1A0A1F;          /* Tinted dark background */
  --text-emphasis-high: #fff;

  /* Use theme-specific vibrant colors */
  --color-interactive-primary: #FF1493;  /* Hot pink */
  --color-interactive-secondary: #00FF00; /* Lime */

  /* Tint interactive surfaces with theme color */
  --surface-interactive: rgba(255, 20, 147, 0.2); /* Pink tint */

  /* Match glow effects to theme */
  --effect-glow-focus:
    0 0 25px rgba(255, 20, 147, 0.9),
    0 0 55px rgba(255, 20, 147, 0.5);
}
```

---

## Troubleshooting

### Problem: Colors Not Applying

**Symptoms:** Theme class applied but colors unchanged

**Solutions:**
1. Check CSS file is loaded: View Source → verify `themes-semantic.css` link
2. Check class name matches exactly: `theme-my-custom` vs `theme-mycustom`
3. Check browser cache: Hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)
4. Check CSS specificity: Theme selector should be `body.theme-name`

---

### Problem: Some Colors Wrong

**Symptoms:** Most colors work, but some elements use wrong color

**Solutions:**
1. Check variable name spelling: `--color-interactive-primary` not `--color-primary-interactive`
2. Ensure all required variables defined (see Required Variables list)
3. Check for typos in rgba values: `rgba(255, 0, 0, 0.5)` not `rgba(255, 0, 0, .5)`
4. Clear browser cache

---

### Problem: Poor Contrast/Readability

**Symptoms:** Text hard to read, colors blend together

**Solutions:**
1. Use contrast checker: https://webaim.org/resources/contrastchecker/
2. Increase difference between text and surface colors
3. Use darker text on light backgrounds, lighter text on dark backgrounds
4. Test with actual users

---

### Problem: Glow Effects Not Showing

**Symptoms:** No glow around selected/focused items

**Solutions:**
1. Check `--effect-glow-*` variables defined
2. Verify rgba values are correct format
3. Increase opacity in rgba (try 0.8-0.9 for inner glow)
4. Check if hardware acceleration enabled in browser

---

### Problem: Theme Looks Different on Fire TV

**Symptoms:** Theme perfect on desktop, broken on Fire TV

**Solutions:**
1. Fire TV has limited CSS support - avoid:
   - Complex gradients
   - CSS filters (except simple invert)
   - Backdrop filters
   - WebKit-specific properties
2. Test on actual Fire TV device, not just emulator
3. Use simpler color values (hex instead of complex rgba)

---

## Examples

### Example 1: Ocean Theme

```css
/* ============================================================================
   OCEAN THEME - Calming blues and teals
   ============================================================================ */

body.theme-ocean {
  /* Interactive - Various ocean blues */
  --color-interactive-primary: #0077BE;      /* Deep ocean blue */
  --color-interactive-secondary: #40E0D0;    /* Turquoise */
  --color-interactive-tertiary: #5F9EA0;     /* Cadet blue */

  /* Focus/Selection - Bright cyan for visibility */
  --color-focus-ring: #00CED1;               /* Dark turquoise */
  --color-selection-border: #48D1CC;         /* Medium turquoise */
  --color-selection-fill: rgba(72, 209, 204, 0.2);

  /* Surfaces - Deep ocean gradient */
  --surface-base: #001F3F;                   /* Navy blue */
  --surface-raised: #003459;                 /* Dark blue */
  --surface-overlay: #004973;                /* Medium blue */
  --surface-interactive: rgba(0, 206, 209, 0.2); /* Cyan tint */
  --surface-button: #0077BE;
  --surface-grid-gap: #001F3F;

  /* Text - White/light for contrast */
  --text-emphasis-high: #FFFFFF;
  --text-emphasis-medium: #B0E0E6;           /* Powder blue */
  --text-emphasis-low: #7FB3D5;              /* Light blue */

  /* Borders - Subtle cyan */
  --border-subtle: rgba(0, 206, 209, 0.1);
  --border-medium: rgba(0, 206, 209, 0.2);
  --border-strong: rgba(0, 206, 209, 0.3);

  /* Effects - Cyan glows */
  --effect-glow-selection:
    0 0 20px rgba(72, 209, 204, 0.6),
    0 0 45px rgba(72, 209, 204, 0.3);
  --effect-glow-focus:
    0 0 25px rgba(0, 206, 209, 0.9),
    0 0 55px rgba(0, 206, 209, 0.5);

  /* Assets - White logo for dark theme */
  --asset-sidebar-logo: url('/artwork/Dashie_Full_Logo_White_Transparent.png');
  --asset-icon-filter: invert(100%);
}
```

---

### Example 2: Sunset Theme

```css
/* ============================================================================
   SUNSET THEME - Warm oranges and purples
   ============================================================================ */

body.theme-sunset {
  /* Interactive - Sunset colors */
  --color-interactive-primary: #FF6B35;      /* Coral orange */
  --color-interactive-secondary: #9B59B6;    /* Purple */
  --color-interactive-tertiary: #E67E22;     /* Carrot orange */

  /* Focus/Selection */
  --color-focus-ring: #FF6B35;
  --color-selection-border: #9B59B6;
  --color-selection-fill: rgba(155, 89, 182, 0.2);

  /* Surfaces - Dark purple to orange gradient feel */
  --surface-base: #2C1E3A;                   /* Dark purple */
  --surface-raised: #3E2753;                 /* Medium purple */
  --surface-overlay: #4A2C5E;                /* Light purple */
  --surface-interactive: rgba(255, 107, 53, 0.2); /* Orange tint */
  --surface-button: #E67E22;
  --surface-grid-gap: #2C1E3A;

  /* Text */
  --text-emphasis-high: #FFF8DC;             /* Cornsilk */
  --text-emphasis-medium: #F5DEB3;           /* Wheat */
  --text-emphasis-low: #DEB887;              /* Burlywood */

  /* Borders */
  --border-subtle: rgba(255, 107, 53, 0.1);
  --border-medium: rgba(255, 107, 53, 0.2);
  --border-strong: rgba(255, 107, 53, 0.3);

  /* Effects */
  --effect-glow-selection:
    0 0 20px rgba(155, 89, 182, 0.6),
    0 0 45px rgba(155, 89, 182, 0.3);
  --effect-glow-focus:
    0 0 25px rgba(255, 107, 53, 0.9),
    0 0 55px rgba(255, 107, 53, 0.5);

  /* Assets */
  --asset-sidebar-logo: url('/artwork/Dashie_Full_Logo_White_Transparent.png');
  --asset-icon-filter: invert(100%);
}
```

---

### Example 3: Forest Theme (Light)

```css
/* ============================================================================
   FOREST THEME - Natural greens, light variant
   ============================================================================ */

body.theme-forest-light {
  /* Interactive - Forest greens */
  --color-interactive-primary: #228B22;      /* Forest green */
  --color-interactive-secondary: #8B4513;    /* Saddle brown */
  --color-interactive-tertiary: #9ACD32;     /* Yellow green */

  /* Focus/Selection */
  --color-focus-ring: #228B22;
  --color-selection-border: #8B4513;
  --color-selection-fill: rgba(34, 139, 34, 0.15);

  /* Surfaces - Light natural tones */
  --surface-base: #F5F5DC;                   /* Beige */
  --surface-raised: #FAFAF0;                 /* Off-white */
  --surface-overlay: #E8E8D0;                /* Light tan */
  --surface-interactive: rgba(34, 139, 34, 0.1); /* Green tint */
  --surface-button: #8B4513;
  --surface-grid-gap: #D3D3C8;

  /* Text - Dark for light background */
  --text-emphasis-high: #2F4F2F;             /* Dark green */
  --text-emphasis-medium: #556B2F;           /* Olive green */
  --text-emphasis-low: #808000;              /* Olive */

  /* Borders */
  --border-subtle: rgba(34, 139, 34, 0.1);
  --border-medium: rgba(34, 139, 34, 0.2);
  --border-strong: rgba(34, 139, 34, 0.3);

  /* Effects */
  --effect-glow-selection:
    0 0 15px rgba(139, 69, 19, 0.5),
    0 0 30px rgba(139, 69, 19, 0.25);
  --effect-glow-focus:
    0 0 20px rgba(34, 139, 34, 0.8),
    0 0 40px rgba(34, 139, 34, 0.4);

  /* Assets - Dark logo for light theme */
  --asset-sidebar-logo: url('/artwork/Dashie_Full_Logo_Black_Transparent.png');
  --asset-icon-filter: invert(20%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(0.3);
}
```

---

## Advanced Topics

### Dynamic Theme Generation

You can generate themes programmatically using JavaScript:

```javascript
function createTheme(name, baseColor) {
  const style = document.createElement('style');
  style.textContent = `
    body.theme-${name} {
      --color-interactive-primary: ${baseColor};
      --color-focus-ring: ${baseColor};
      /* ... generate other colors based on base ... */
    }
  `;
  document.head.appendChild(style);
}

// Create a theme on the fly
createTheme('dynamic-blue', '#0099ff');
```

### Theme Mixing (Advanced)

Combine multiple theme classes for layered effects:

```html
<body class="theme-dark theme-high-contrast">
```

```css
/* Base theme */
body.theme-dark { /* ... */ }

/* Modifier theme */
body.theme-high-contrast {
  /* Override just contrast-related variables */
  --text-emphasis-high: #fff !important;
  --border-medium: rgba(255, 255, 255, 0.5) !important;
}
```

---

## Quick Reference Card

### Required Variables (Minimum)

```css
/* Interactive */
--color-interactive-primary
--color-interactive-secondary
--color-focus-ring
--color-selection-border

/* Surfaces */
--surface-base
--surface-raised
--surface-overlay
--surface-interactive
--surface-button

/* Text */
--text-emphasis-high
--text-emphasis-medium
--text-emphasis-low

/* Effects */
--effect-glow-selection
--effect-glow-focus

/* Assets */
--asset-sidebar-logo
--asset-icon-filter
```

### Contrast Requirements

- Body text: **4.5:1** minimum
- Large text (18pt+): **3:1** minimum
- UI components: **3:1** minimum
- Focus indicators: **3:1** vs adjacent

### Testing Commands

```javascript
// Apply theme
document.body.className = 'theme-name';

// Get variable value
getComputedStyle(document.documentElement)
  .getPropertyValue('--color-interactive-primary');

// Check for undefined vars
[...document.querySelectorAll('*')]
  .map(el => getComputedStyle(el).getPropertyValue('background-color'))
  .filter(c => c.includes('undefined'));
```

---

## Resources

- **W3C Contrast Checker:** https://webaim.org/resources/contrastchecker/
- **Color Palette Generator:** https://coolors.co/
- **Accessibility Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/
- **CSS Variables Guide:** https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties

---

## Getting Help

If you're stuck:
1. Review this guide
2. Check `THEME_VARIABLE_MAPPING.md` for variable meanings
3. Look at existing themes in `themes-semantic.css`
4. Test with browser DevTools
5. Ask in team chat with screenshots

---

**Happy Theming! 🎨**
