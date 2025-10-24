# Theme Variable Mapping Table
**Version:** 1.0
**Date:** 2025-10-23

This document provides a complete mapping from old visual-based variable names to new semantic variable names.

---

## Quick Reference

| Old Variable | New Variable | Category |
|--------------|--------------|----------|
| `--accent-blue` | `--color-interactive-primary` | Interactive |
| `--accent-orange` | `--color-interactive-secondary` | Interactive |
| `--accent-silver` | `--color-selection-border` | Focus/Selection |
| `--accent-current-time` | `--color-time-current` | Temporal |
| `--bg-primary` | `--surface-base` | Surfaces |
| `--bg-secondary` | `--surface-raised` | Surfaces |
| `--bg-tertiary` | `--surface-overlay` | Surfaces |
| `--bg-active` | `--surface-interactive` | Surfaces |
| `--bg-button` | `--surface-button` | Surfaces |
| `--bg-modal-backdrop` | `--surface-modal-backdrop` | Surfaces |
| `--text-primary` | `--text-emphasis-high` | Text |
| `--text-secondary` | `--text-emphasis-medium` | Text |
| `--text-muted` | `--text-emphasis-low` | Text |
| `--outline-selected` | `--color-selection-border` | Focus/Selection |
| `--outline-focused` | `--color-focus-ring` | Focus/Selection |
| `--glow-selected` | `--effect-glow-selection` | Effects |
| `--glow-focused` | `--effect-glow-focus` | Effects |

---

## Detailed Mapping with Context

### **Interactive Colors**

#### `--accent-blue` → `--color-interactive-primary`
**Purpose:** Primary interactive color for main actions and active states

**Current Usage:**
- Active widget border (blue glow when controlling widget)
- Primary button highlights
- Current time indicator (in some themes)
- Active menu items

**Theme Values:**
- Dark: `#00aaff` (Blue)
- Light: `#2196f3` (Material Blue)
- Halloween Dark: `#39FF14` (Neon Green)

**Migration Example:**
```css
/* OLD */
.widget--active {
  border-color: var(--accent-blue);
}

/* NEW */
.widget--active {
  border-color: var(--color-interactive-primary);
}
```

---

#### `--accent-orange` → `--color-interactive-secondary`
**Purpose:** Secondary interactive color for alternative actions

**Current Usage:**
- Secondary highlights
- Alternative time indicators
- Decorative accents
- Legacy focus states

**Theme Values:**
- Dark: `#ffaa00` (Orange)
- Light: `#ff9800` (Material Orange)
- Halloween Dark: `#FF6B1A` (Halloween Orange)

**Migration Example:**
```css
/* OLD */
.button--secondary {
  background: var(--accent-orange);
}

/* NEW */
.button--secondary {
  background: var(--color-interactive-secondary);
}
```

---

#### `--accent-silver` → `--color-selection-border`
**Purpose:** Grid navigation selection indicator

**Current Usage:**
- Grid cell selection border (silver outline when navigating with D-pad)
- Menu item selection borders
- Navigation highlights

**Theme Values:**
- Dark: `#a8b0b8` (Silver-gray)
- Light: `#6b7280` (Gray)
- Halloween Dark: `#a8b0b8` (Silver-gray)

**Migration Example:**
```css
/* OLD */
.grid-cell--selected {
  border-color: var(--accent-silver);
}

/* NEW */
.grid-cell--selected {
  border-color: var(--color-selection-border);
}
```

---

#### `--accent-current-time` → `--color-time-current`
**Purpose:** Current time indicator in calendar widgets

**Current Usage:**
- Calendar current time line
- "Now" marker in agenda
- Time-based highlights

**Theme Values:**
- Dark: `#00aaff` (Blue)
- Light: `#00aaff` (Blue)
- Halloween Dark: `#FF6B1A` (Orange)

**Migration Example:**
```css
/* OLD */
.calendar-current-time {
  background: var(--accent-current-time);
}

/* NEW */
.calendar-current-time {
  background: var(--color-time-current);
}
```

---

### **Surface Colors (Backgrounds)**

#### `--bg-primary` → `--surface-base`
**Purpose:** Base background layer

**Current Usage:**
- Body background
- Main container backgrounds
- Default widget backgrounds

**Theme Values:**
- Dark: `#222` (Dark gray)
- Light: `#FCFCFF` (Off-white)
- Halloween Dark: `#1A0A1F` (Purple-black)

**Migration Example:**
```css
/* OLD */
body {
  background: var(--bg-primary);
}

/* NEW */
body {
  background: var(--surface-base);
}
```

---

#### `--bg-secondary` → `--surface-raised`
**Purpose:** Elevated surfaces (cards, widgets)

**Current Usage:**
- Widget backgrounds
- Card backgrounds
- Elevated panels

**Theme Values:**
- Dark: `#333` (Medium gray)
- Light: `#FCFCFF` (Off-white, same as primary)
- Halloween Dark: `#2D1F1A` (Dark orange-brown)

**Migration Example:**
```css
/* OLD */
.widget {
  background: var(--bg-secondary);
}

/* NEW */
.widget {
  background: var(--surface-raised);
}
```

---

#### `--bg-tertiary` → `--surface-overlay`
**Purpose:** Overlay surfaces (modals, dropdowns)

**Current Usage:**
- Modal backgrounds
- Dropdown backgrounds
- Popover backgrounds
- Navigation bar backgrounds

**Theme Values:**
- Dark: `#444` (Light gray)
- Light: `#eeeeee` (Light gray)
- Halloween Dark: `#3D2F2A` (Brown-purple)

**Migration Example:**
```css
/* OLD */
.dropdown {
  background: var(--bg-tertiary);
}

/* NEW */
.dropdown {
  background: var(--surface-overlay);
}
```

---

#### `--bg-active` → `--surface-interactive`
**Purpose:** Interactive surface overlay/tint

**Current Usage:**
- Hover state overlays
- Active state backgrounds
- Interactive element tints
- Page navigation arrow overlays

**Theme Values:**
- Dark: `rgba(255, 255, 255, 0.2)` (White tint)
- Light: `rgba(33, 150, 243, 0.2)` (Blue tint)
- Halloween Dark: `rgba(255, 107, 26, 0.3)` (Orange tint)

**Migration Example:**
```css
/* OLD */
.button:hover::after {
  background: var(--bg-active);
}

/* NEW */
.button:hover::after {
  background: var(--surface-interactive);
}
```

---

#### `--bg-button` → `--surface-button`
**Purpose:** Button backgrounds

**Current Usage:**
- Button default backgrounds
- Clickable element backgrounds

**Theme Values:**
- Dark: `#666` (Medium gray)
- Light: `#90a4ae` (Blue-gray)
- Halloween Dark: `#6B1FA0` (Deep purple)

**Migration Example:**
```css
/* OLD */
button {
  background: var(--bg-button);
}

/* NEW */
button {
  background: var(--surface-button);
}
```

---

#### `--bg-modal-backdrop` → `--surface-modal-backdrop`
**Purpose:** Modal backdrop overlay

**Current Usage:**
- Modal background overlays
- Dimmed backgrounds behind modals

**Theme Values:**
- Dark: `rgba(0, 0, 0, 0.7)` (Black overlay)
- Light: `rgba(0, 0, 0, 0.5)` (Black overlay)
- Halloween Dark: `rgba(26, 10, 31, 0.8)` (Purple-tinted overlay)

**Migration Example:**
```css
/* OLD */
.modal-backdrop {
  background: var(--bg-modal-backdrop);
}

/* NEW */
.modal-backdrop {
  background: var(--surface-modal-backdrop);
}
```

---

#### Additional Surface Variables

**Unchanged (already semantic):**
- `--bg-primary-transparent` → Keep as `--surface-base-transparent`
- `--bg-primary-semi-transparent` → Keep as `--surface-base-semi-transparent`
- `--bg-menu-overlay` → Keep as `--surface-menu-overlay`
- `--bg-selected-fill` → Rename to `--surface-selection-fill`
- `--bg-widget-iframe` → Keep as `--surface-widget-iframe`
- `--bg-fallback-widget` → Keep as `--surface-fallback-widget`

---

### **Text Colors**

#### `--text-primary` → `--text-emphasis-high`
**Purpose:** High-emphasis text (headings, labels)

**Current Usage:**
- Widget titles
- Form labels
- Headings
- Primary content

**Theme Values:**
- Dark: `#fff` (White)
- Light: `#424242` (Dark gray)
- Halloween Dark: `#fff` (White)

**Migration Example:**
```css
/* OLD */
h1 {
  color: var(--text-primary);
}

/* NEW */
h1 {
  color: var(--text-emphasis-high);
}
```

---

#### `--text-secondary` → `--text-emphasis-medium`
**Purpose:** Medium-emphasis text (body, descriptions)

**Current Usage:**
- Body text
- Descriptions
- Secondary labels
- Form values

**Theme Values:**
- Dark: `#ccc` (Light gray)
- Light: `#616161` (Medium gray)
- Halloween Dark: `#ccc` (Light gray)

**Migration Example:**
```css
/* OLD */
p {
  color: var(--text-secondary);
}

/* NEW */
p {
  color: var(--text-emphasis-medium);
}
```

---

#### `--text-muted` → `--text-emphasis-low`
**Purpose:** Low-emphasis text (hints, timestamps)

**Current Usage:**
- Timestamps
- Hints/placeholders
- Metadata
- Disabled text

**Theme Values:**
- Dark: `#999` (Medium gray)
- Light: `#9e9e9e` (Gray)
- Halloween Dark: `#999` (Medium gray)

**Migration Example:**
```css
/* OLD */
.timestamp {
  color: var(--text-muted);
}

/* NEW */
.timestamp {
  color: var(--text-emphasis-low);
}
```

---

### **Focus & Selection States**

#### `--outline-selected` → `--color-selection-border`
**Purpose:** Selection border for grid navigation

**Current Usage:**
- Grid cell selection outlines
- Menu item selection
- Navigation highlights

**Note:** Same as `--accent-silver` (consolidate during migration)

**Migration Example:**
```css
/* OLD */
.cell--selected {
  outline-color: var(--outline-selected);
}

/* NEW */
.cell--selected {
  outline-color: var(--color-selection-border);
}
```

---

#### `--outline-focused` → `--color-focus-ring`
**Purpose:** Active focus ring indicator

**Current Usage:**
- Active widget borders
- Keyboard focus indicators
- Control state borders

**Note:** Same as `--accent-blue` (consolidate during migration)

**Migration Example:**
```css
/* OLD */
.widget--active {
  border-color: var(--outline-focused);
}

/* NEW */
.widget--active {
  border-color: var(--color-focus-ring);
}
```

---

#### `--outline-selected-legacy` → `--color-selection-legacy`
**Purpose:** Legacy orange selection indicator

**Current Usage:**
- Older widgets still using orange selection
- Legacy focus states

**Migration Note:** Consider migrating to `--color-selection-border` instead

---

### **Navigation Colors**

#### `--outline-color-nav` → `--color-navigation-highlight`
**Purpose:** Navigation highlight color

**Current Usage:**
- Navigation menu highlights
- Grid navigation indicators

**Note:** Same as `--accent-silver` (consolidate during migration)

---

### **Glow Effects**

#### `--glow-selected` → `--effect-glow-selection`
**Purpose:** Glow effect for selected items

**Current Usage:**
- Grid cell selection glow
- Menu item selection glow

**Theme Values:**
- Dark: `0 0 20px rgba(168, 176, 184, 0.6), 0 0 45px rgba(168, 176, 184, 0.3)`
- Light: `0 0 15px rgba(107, 114, 128, 0.5), 0 0 30px rgba(107, 114, 128, 0.25)`
- Halloween Dark: `0 0 20px rgba(255, 107, 26, 0.6), 0 0 45px rgba(255, 107, 26, 0.3)`

**Migration Example:**
```css
/* OLD */
.cell--selected {
  box-shadow: var(--glow-selected);
}

/* NEW */
.cell--selected {
  box-shadow: var(--effect-glow-selection);
}
```

---

#### `--glow-focused` → `--effect-glow-focus`
**Purpose:** Glow effect for active/focused items

**Current Usage:**
- Active widget glow
- Focused element highlights

**Theme Values:**
- Dark: `0 0 25px rgba(0, 170, 255, 0.9), 0 0 55px rgba(0, 170, 255, 0.5)`
- Light: (Similar but with light theme blue)
- Halloween Dark: (Similar but with neon green)

**Migration Example:**
```css
/* OLD */
.widget--active {
  box-shadow: var(--glow-focused);
}

/* NEW */
.widget--active {
  box-shadow: var(--effect-glow-focus);
}
```

---

#### `--glow-selected-legacy` → `--effect-glow-selection-legacy`
**Purpose:** Legacy orange glow effect

**Migration Note:** Consider migrating to `--effect-glow-selection` instead

---

### **Gradient Effects**

#### `--widget-border-gradient` → `--effect-border-gradient-selection`
**Purpose:** Selection border gradient

**Current Usage:**
- Widget selection borders
- Animated border effects

---

#### `--widget-border-gradient-active` → `--effect-border-gradient-focus`
**Purpose:** Active/focused border gradient

**Current Usage:**
- Active widget borders
- Focused element borders

---

### **Semantic Colors (Unchanged)**

These already use semantic naming:

- `--color-error`: Error states, destructive actions
- `--color-success`: Success states, confirmations
- `--color-warning`: Warning states, alerts

**New Addition:**
- `--color-info`: Informational states, tips

---

### **Grid-Specific**

#### `--grid-gap-color` → `--surface-grid-gap`
**Purpose:** Color visible between grid items

**Current Usage:**
- Dashboard grid gaps
- Widget spacing backgrounds

---

### **Theme Assets (Unchanged)**

These are already descriptive:

- `--sidebar-logo-src`: Sidebar logo image path
- `--sidebar-icon-filter`: Icon color filter for theme

---

## Migration Cheat Sheet

### Find & Replace Patterns

**Interactive Colors:**
```
--accent-blue          → --color-interactive-primary
--accent-orange        → --color-interactive-secondary
--accent-silver        → --color-selection-border
--accent-current-time  → --color-time-current
```

**Surfaces:**
```
--bg-primary   → --surface-base
--bg-secondary → --surface-raised
--bg-tertiary  → --surface-overlay
--bg-active    → --surface-interactive
--bg-button    → --surface-button
```

**Text:**
```
--text-primary   → --text-emphasis-high
--text-secondary → --text-emphasis-medium
--text-muted     → --text-emphasis-low
```

**Focus/Selection:**
```
--outline-selected → --color-selection-border
--outline-focused  → --color-focus-ring
```

**Effects:**
```
--glow-selected → --effect-glow-selection
--glow-focused  → --effect-glow-focus
```

---

## Consolidation Opportunities

Some old variables map to the same new variable - consolidate during migration:

### Same: Selection Border
- `--accent-silver`
- `--outline-selected`
- `--outline-color-nav`

**All become:** `--color-selection-border`

### Same: Focus Ring
- `--accent-blue` (in focus contexts)
- `--outline-focused`

**All become:** `--color-focus-ring`

---

## Special Cases

### Context-Dependent Variables

Some variables need different mappings based on context:

#### `--accent-blue`
- **In focus/active states:** → `--color-focus-ring`
- **In interactive elements:** → `--color-interactive-primary`
- **In time indicators:** → `--color-time-current` (if appropriate)

**Review each usage individually!**

---

## Automated Migration Script

```bash
#!/bin/bash
# migrate-theme-variables.sh
# Usage: ./migrate-theme-variables.sh path/to/file.css

FILE=$1

# Surfaces
sed -i '' 's/--bg-primary/--surface-base/g' "$FILE"
sed -i '' 's/--bg-secondary/--surface-raised/g' "$FILE"
sed -i '' 's/--bg-tertiary/--surface-overlay/g' "$FILE"
sed -i '' 's/--bg-active/--surface-interactive/g' "$FILE"
sed -i '' 's/--bg-button/--surface-button/g' "$FILE"

# Text
sed -i '' 's/--text-primary/--text-emphasis-high/g' "$FILE"
sed -i '' 's/--text-secondary/--text-emphasis-medium/g' "$FILE"
sed -i '' 's/--text-muted/--text-emphasis-low/g' "$FILE"

# Simple mappings
sed -i '' 's/--accent-silver/--color-selection-border/g' "$FILE"
sed -i '' 's/--accent-current-time/--color-time-current/g' "$FILE"
sed -i '' 's/--outline-selected/--color-selection-border/g' "$FILE"
sed -i '' 's/--grid-gap-color/--surface-grid-gap/g' "$FILE"

# Effects
sed -i '' 's/--glow-selected/--effect-glow-selection/g' "$FILE"
sed -i '' 's/--glow-focused/--effect-glow-focus/g' "$FILE"

# Context-dependent (review manually!)
echo "⚠️  Manual review needed for:"
grep -n "accent-blue\|accent-orange\|outline-focused" "$FILE"

echo "✅ Automated migration complete for $FILE"
echo "📝 Please review context-dependent variables manually"
```

**Warning:** Script handles simple cases only. Review all changes manually, especially context-dependent variables!

---

## Testing Checklist

After migrating a file:

- [ ] Visual check in Dark theme
- [ ] Visual check in Light theme
- [ ] Visual check in Halloween Dark theme
- [ ] Test interactive states (hover, focus, active)
- [ ] Test keyboard navigation
- [ ] Check console for undefined variable warnings
- [ ] Compare screenshots before/after
- [ ] Test on Fire TV (if dashboard/widget component)

---

## Questions?

If unsure which variable to use:
1. Check this mapping table
2. Review `THEME_MIGRATION_PLAN.md`
3. Look at semantic variable comments in `variables-semantic.css`
4. Check existing usage in migrated files
