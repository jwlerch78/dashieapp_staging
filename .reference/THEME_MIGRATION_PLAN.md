# Theme System Migration Plan
**Version:** 1.0
**Date:** 2025-10-23
**Status:** Planning Phase

## Executive Summary

This document outlines the migration from our current visual-based CSS variable naming (e.g., `--accent-blue`) to a semantic/functional naming system (e.g., `--color-interactive-primary`). This change will make our theme system more maintainable, scalable, and intuitive.

---

## Problem Statement

### Current Issues

1. **Misleading Names**: `--accent-blue` becomes neon green in Halloween theme
2. **Purpose Ambiguity**: Unclear what each "accent" color is actually used for
3. **Inconsistent Naming**: Mix of visual (`accent-blue`) and semantic (`text-primary`) naming
4. **Hard to Extend**: Adding new themes requires guessing which colors to override
5. **Documentation Gap**: No clear guide for what each variable does

### Impact

- Developers guess which variable to use for new features
- Theme designers must read code to understand variable purposes
- Color changes can have unexpected effects across the app
- Difficult to maintain visual consistency

---

## Migration Strategy

### Approach: Gradual Migration with Backward Compatibility

We'll use a **three-phase approach** to minimize risk and allow incremental progress:

#### **Phase 1: Add Semantic Layer (Week 1)**
- Create new semantic variables
- Map semantic variables to existing visual variables
- No breaking changes
- Both old and new systems coexist

#### **Phase 2: Migrate Codebase (Weeks 2-4)**
- Update files incrementally to use semantic variables
- Test each change thoroughly
- Old variables remain functional via aliases

#### **Phase 3: Deprecation (Week 5+)**
- Mark old variables as deprecated in comments
- Remove unused old variables after full migration
- Clean up documentation

---

## New Semantic Naming System

### Tier 1: Semantic Tokens (What Developers Use)

#### **Interactive Elements**
```css
--color-interactive-primary       /* Main interactive color (primary actions, focus) */
--color-interactive-secondary     /* Secondary actions, alternative highlights */
--color-interactive-tertiary      /* Subtle interactive elements, disabled states */
```

**Used for:**
- Buttons, links, clickable elements
- Active/pressed states
- Primary navigation highlights

---

#### **Focus & Selection**
```css
--color-focus-ring                /* Keyboard focus indicator */
--color-focus-glow                /* Enhanced focus glow effect */
--color-selection-background      /* Selected item background fill */
--color-selection-border          /* Selected item border/outline */
--color-navigation-highlight      /* Grid/menu navigation highlight */
```

**Used for:**
- Widget focus borders (silver border when navigating grid)
- Active widget state (blue border when controlling widget)
- Menu item selection
- Grid cell selection

---

#### **Temporal/Calendar**
```css
--color-time-current              /* Current time indicator line */
--color-calendar-today            /* Today's date highlight */
--color-event-primary             /* Primary event color */
```

**Used for:**
- Calendar current time line
- "Today" markers in agenda
- Event indicators

---

#### **Surfaces (Backgrounds)**
```css
--surface-base                    /* Base background (body, main areas) */
--surface-raised                  /* Elevated surfaces (cards, widgets) */
--surface-overlay                 /* Overlays, popovers, dropdowns */
--surface-interactive             /* Interactive surface tint/overlay */
--surface-input                   /* Input fields, form elements */
```

**Used for:**
- Widget backgrounds
- Modal backgrounds
- Button backgrounds
- Input fields

---

#### **Text Hierarchy**
```css
--text-emphasis-high              /* Primary text (headings, labels) */
--text-emphasis-medium            /* Secondary text (body, descriptions) */
--text-emphasis-low               /* Muted text (hints, timestamps) */
--text-on-interactive             /* Text on interactive colored backgrounds */
```

**Used for:**
- All text content
- Labels vs values
- Timestamps and metadata

---

#### **Borders & Dividers**
```css
--border-subtle                   /* Subtle dividers, borders */
--border-medium                   /* Standard borders */
--border-strong                   /* Emphasized borders */
--border-interactive              /* Borders on interactive elements */
```

**Used for:**
- Widget borders
- Divider lines
- Container outlines

---

#### **Semantic States**
```css
--color-error                     /* Error states, destructive actions */
--color-success                   /* Success states, confirmations */
--color-warning                   /* Warning states, alerts */
--color-info                      /* Informational states */
```

**Used for:**
- Toast notifications
- Form validation
- Status indicators

---

### Tier 2: Theme-Specific Mappings

Each theme maps semantic tokens to actual color values:

```css
body.theme-dark {
  /* Interactive */
  --color-interactive-primary: #00aaff;      /* Blue */
  --color-interactive-secondary: #ffaa00;    /* Orange */

  /* Surfaces */
  --surface-base: #222;
  --surface-raised: #333;
  /* ... */
}

body.theme-halloween-dark {
  /* Interactive */
  --color-interactive-primary: #39FF14;      /* Neon green! */
  --color-interactive-secondary: #FF6B1A;    /* Halloween orange */

  /* Surfaces */
  --surface-base: #1A0A1F;                   /* Purple-black */
  --surface-raised: #2D1F1A;                 /* Dark orange-brown */
  /* ... */
}
```

---

## Variable Mapping Table

| **Old Variable** | **New Variable** | **Purpose** | **Usage Examples** |
|------------------|------------------|-------------|-------------------|
| `--accent-blue` | `--color-interactive-primary` | Primary interactive color | Widget focus (active), primary buttons |
| `--accent-orange` | `--color-interactive-secondary` | Secondary interactive | Alternative highlights, secondary actions |
| `--accent-silver` | `--color-selection-border` | Grid navigation selection | Grid cell selection border |
| `--accent-current-time` | `--color-time-current` | Current time indicator | Calendar current time line |
| `--bg-primary` | `--surface-base` | Base background | Body, main containers |
| `--bg-secondary` | `--surface-raised` | Elevated surfaces | Widget backgrounds, cards |
| `--bg-tertiary` | `--surface-overlay` | Overlay surfaces | Modals, dropdowns |
| `--bg-active` | `--surface-interactive` | Interactive overlay | Hover states, active backgrounds |
| `--text-primary` | `--text-emphasis-high` | Primary text | Headings, labels |
| `--text-secondary` | `--text-emphasis-medium` | Secondary text | Body text, descriptions |
| `--text-muted` | `--text-emphasis-low` | Muted text | Timestamps, hints |
| `--outline-selected` | `--color-selection-border` | Selection border | Grid navigation |
| `--outline-focused` | `--color-focus-ring` | Focus indicator | Active widget border |
| `--glow-selected` | `--effect-glow-selection` | Selection glow | Grid cell glow |
| `--glow-focused` | `--effect-glow-focus` | Focus glow | Active widget glow |

---

## Migration Process (Step-by-Step)

### **Step 1: Backup Current System**
```bash
# Create backups
cp css/core/variables.css css/core/variables.css.backup
cp css/core/themes.css css/core/themes.css.backup
```

### **Step 2: Create New Files**
- `css/core/variables-semantic.css` - New semantic variable definitions
- `css/core/themes-semantic.css` - New theme mappings
- Keep old files for backward compatibility

### **Step 3: Update index.html**
```html
<!-- Load semantic variables first -->
<link rel="stylesheet" href="css/core/variables-semantic.css">
<link rel="stylesheet" href="css/core/themes-semantic.css">

<!-- Keep old variables for backward compatibility -->
<link rel="stylesheet" href="css/core/variables.css">
<link rel="stylesheet" href="css/core/themes.css">
```

### **Step 4: Add Compatibility Aliases**
In `variables.css`, add:
```css
/* BACKWARD COMPATIBILITY ALIASES - Remove after migration */
:root {
  --accent-blue: var(--color-interactive-primary);
  --accent-orange: var(--color-interactive-secondary);
  --accent-silver: var(--color-selection-border);
  /* ... etc */
}
```

### **Step 5: Migrate Files Incrementally**

**Priority Order:**
1. **High Impact, Low Risk** - New features (page navigation arrows)
2. **Core Components** - Dashboard, widgets
3. **Settings & Modals** - Settings pages, modal dialogs
4. **Legacy Components** - Older widgets, archived code

**Per-File Process:**
1. Find all CSS variable references in file
2. Replace with semantic equivalents using mapping table
3. Test visually in all themes (dark, light, Halloween)
4. Commit with message: `refactor(theme): migrate [filename] to semantic variables`

### **Step 6: Update Documentation**
1. Add comments to new variable files explaining each variable's purpose
2. Create theme development guide
3. Update CONTRIBUTING.md with theme guidelines

### **Step 7: Cleanup**
1. Search codebase for old variable usage: `grep -r "accent-blue" css/`
2. Remove compatibility aliases from old files
3. Archive old variables.css and themes.css
4. Update import statements

---

## Testing Strategy

### **Visual Regression Testing**

For each migrated file:
1. **Dark Theme**: Compare before/after screenshots
2. **Light Theme**: Compare before/after screenshots
3. **Halloween Dark**: Compare before/after screenshots
4. **Focus States**: Test keyboard navigation appearance
5. **Interactive States**: Test hover, active, disabled states

### **Browser Testing**
- Chrome/Desktop
- Safari/Desktop
- Fire TV browser
- Mobile Safari
- Mobile Chrome

### **Checklist Per Component**
- [ ] All colors render correctly
- [ ] No console warnings about undefined variables
- [ ] Focus states work in all themes
- [ ] Interactive states (hover, active) work
- [ ] Text is readable in all themes
- [ ] No visual regressions from before migration

---

## File-by-File Migration Order

### **Week 1: Foundation & High-Impact Files**
1. ✅ Create new semantic variable files
2. ✅ Add compatibility aliases
3. ✅ Update build/import system
4. `css/modules/dashboard.css` - Dashboard grid & sidebar
5. `js/widgets/shared/widget-touch-controls.css` - Widget controls

### **Week 2: Widgets**
6. `js/widgets/calendar/styles/calendar-widget.css` - Calendar widget
7. `js/widgets/agenda/agenda.html` (inline styles) - Agenda widget
8. `js/widgets/clock/` - Clock widget
9. `js/widgets/photos/` - Photo widget
10. `js/widgets/header/` - Header widget

### **Week 3: Settings & Modals**
11. Settings modal styles (already using separate variables - may skip)
12. Modal styles (already using separate variables - may skip)
13. `css/modules/welcome.css` - Welcome wizard

### **Week 4: Remaining & Legacy**
14. Any remaining active CSS files
15. Update `.legacy/` files (low priority)
16. Final testing and cleanup

---

## Rollback Plan

If issues arise:

### **Quick Rollback (Emergency)**
```html
<!-- In index.html, comment out new files -->
<!-- <link rel="stylesheet" href="css/core/variables-semantic.css"> -->
<!-- <link rel="stylesheet" href="css/core/themes-semantic.css"> -->

<!-- Old files remain and will work -->
<link rel="stylesheet" href="css/core/variables.css">
<link rel="stylesheet" href="css/core/themes.css">
```

### **Partial Rollback (Per-File)**
```bash
# Revert specific file
git checkout HEAD -- css/modules/dashboard.css

# Or restore from backup
cp css/modules/dashboard.css.backup css/modules/dashboard.css
```

---

## Success Metrics

- [ ] All active CSS files migrated to semantic variables
- [ ] Zero visual regressions across all themes
- [ ] New theme can be created in < 30 minutes
- [ ] Theme documentation complete
- [ ] All old variable references removed
- [ ] No undefined CSS variable warnings in console

---

## Future Benefits

### **For Developers**
- Clear variable names that describe purpose
- No guessing which variable to use
- Easier to maintain consistency
- Better autocomplete/IntelliSense

### **For Designers**
- Can create themes without reading code
- Clear documentation of what each variable affects
- Faster theme creation (30 min vs 2+ hours)

### **For Maintainability**
- Themes are data, not code
- Easy to A/B test color schemes
- User-customizable themes possible in future
- Reduced CSS specificity issues

---

## Questions & Decisions

### **Open Questions**
1. Should we support per-widget theme overrides?
2. Do we want light/dark auto-detection in future?
3. Should theme switching be animated or instant?

### **Decisions Made**
1. ✅ Use two-tier system (semantic + theme-specific)
2. ✅ Backward compatibility during migration
3. ✅ Settings/modals remain separate from main themes
4. ✅ Gradual migration approach (not big-bang)

---

## Resources

- **Mapping Table**: `THEME_VARIABLE_MAPPING.md`
- **New Variables**: `css/core/variables-semantic.css`
- **New Themes**: `css/core/themes-semantic.css`
- **Theme Guide**: `THEME_DEVELOPMENT_GUIDE.md`
- **Migration Script**: `scripts/migrate-theme-variables.sh` (optional)

---

## Timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1 | Foundation | New variable files, compatibility layer, dashboard migrated |
| 2 | Widgets | All widget styles migrated |
| 3 | Settings/Modals | Settings & modal styles reviewed/migrated if needed |
| 4 | Cleanup | Legacy files, testing, documentation |
| 5+ | Deprecation | Remove old variables, final cleanup |

---

## Contact & Support

For questions about this migration:
- Review this document
- Check `THEME_DEVELOPMENT_GUIDE.md` for theme creation
- Check `THEME_VARIABLE_MAPPING.md` for specific variable conversions
