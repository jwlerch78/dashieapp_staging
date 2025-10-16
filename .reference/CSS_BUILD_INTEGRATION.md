# CSS Build Integration - Component-by-Component

**Version:** 1.0
**Date:** 2025-10-15
**Purpose:** CSS development integrated with each build phase

---

## Overview

CSS development happens **alongside** JavaScript development for each component/module. This ensures:
- Styling works from day one
- CSS tested immediately with functionality
- No big CSS rewrite at the end
- Fire TV compatibility verified early

---

## Phase 1: Foundation (Week 1) - Core CSS

### Day 1: CSS Setup & Core Styles

**✅ Set up CSS linting (Stylelint)**
- Install: `npm install --save-dev stylelint stylelint-config-standard`
- Create `.stylelintrc.json` with BEM pattern rules
- Configure VSCode integration
- Add npm scripts: `lint:css` and `lint:css:fix`

**✅ Create Core CSS Files**

**1. css/core/reset.css**
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

**2. css/core/variables.css**
```css
:root {
  /* Colors - Light Theme */
  --color-bg-primary: #f5f5f5;
  --color-bg-secondary: #ffffff;
  --color-text-primary: #333333;
  --color-accent: #007bff;

  /* Spacing */
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;

  /* Typography */
  --font-family-base: Arial, sans-serif;
  --font-size-base: 14px;

  /* Transitions */
  --transition-normal: 0.3s ease;

  /* Z-index */
  --z-widgets: 10;
  --z-menu: 20;
  --z-modal: 30;
}

[data-theme="dark"] {
  --color-bg-primary: #1a1a1a;
  --color-bg-secondary: #2a2a2a;
  --color-text-primary: #e0e0e0;
}
```

**3. css/core/base.css**
```css
body {
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  background-color: var(--color-bg-primary);
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
```

**4. css/core/utilities.css**
```css
.flex { display: flex; }
.flex-col { flex-direction: column; }
.hidden { display: none !important; }
.text-center { text-align: center; }
```

**✅ Update index.html**
```html
<head>
  <link rel="stylesheet" href="css/core/reset.css">
  <link rel="stylesheet" href="css/core/variables.css">
  <link rel="stylesheet" href="css/core/base.css">
  <link rel="stylesheet" href="css/core/utilities.css">
</head>
```

**Validation:**
- [ ] Stylelint works in VSCode
- [ ] No linting errors
- [ ] Variables work (test theme switching)
- [ ] Base styles apply

---

## Phase 2: Dashboard Module (Week 2) - Dashboard CSS

### Days 8-14: Dashboard CSS (Alongside JavaScript)

**Goal:** Rewrite legacy navigation.css as dashboard.css with Fire TV compatibility

#### Day 8-9: Dashboard Structure & Base Styles

**Create css/modules/dashboard.css**

**Part 1: Layout Structure**
```css
/* Dashboard container */
.dashboard {
  display: flex;
  height: 100vh;
  width: 100vw;
}

/* Sidebar menu */
.dashboard-sidebar {
  width: 60px;
  background-color: var(--color-bg-secondary);
  transition: width var(--transition-normal);
  z-index: var(--z-menu);
}

.dashboard-sidebar--expanded {
  width: 200px;
}

/* Grid container */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  flex: 1;
}
```

**Note:** Using percentages and grid fractions (NOT viewport units with transforms)

---

#### Day 10-11: Menu Styles (Replace legacy navigation.css issues)

**Part 2: Menu Items (BEM naming)**
```css
/* Menu container */
.dashboard-menu {
  padding: var(--spacing-lg);
}

/* Menu item base */
.dashboard-menu__item {
  display: block;
  width: 100%;
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  background-color: var(--color-bg-primary);
  border: 2px solid transparent;
  color: var(--color-text-primary);
  border-radius: var(--border-radius-sm);
  cursor: pointer;

  /* ✅ Simple transitions only (Fire TV safe) */
  transition:
    border-color var(--transition-normal),
    opacity var(--transition-normal);
}

/* Menu item - focused (NO !important needed) */
.dashboard-menu__item--focused {
  opacity: 1;
}

/* Menu item - selected (NO !important needed) */
.dashboard-menu__item--selected {
  border-color: var(--color-accent);
}

/* Menu item - centered (uses CSS variable for dynamic offset) */
.dashboard-menu__item--centered {
  /* CSS variable set by JS, styling in CSS */
  transform: translateX(var(--center-offset, 0px));
}
```

**✅ Improvements over legacy:**
- **NO !important declarations** (fixed specificity)
- **BEM naming** (clear ownership)
- **CSS variables for dynamic values** (JS sets `--center-offset`)
- **Simple transforms only** (Fire TV compatible)

---

#### Day 12-14: Grid & Widget Cell Styles

**Part 3: Grid Cells**
```css
/* Widget cell base */
.dashboard-grid__cell {
  border: 2px solid transparent;
  border-radius: var(--border-radius-md);
  background-color: var(--color-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;

  /* ✅ Simple transition (Fire TV safe) */
  transition: border-color var(--transition-normal);
}

/* Cell - focused */
.dashboard-grid__cell--focused {
  border-color: yellow; /* High contrast for TV viewing */
}

/* Cell - with active widget */
.dashboard-grid__cell--active {
  border-color: var(--color-accent);
}

/* Widget placeholder (temporary, until widgets load) */
.dashboard-grid__placeholder {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xl);
  opacity: 0.5;
}
```

---

#### Day 13-14: Focus Visual Effects (Replace -webkit-mask)

**Part 4: Focus Effects (WebView Compatible)**

**❌ Legacy approach (NOT Fire TV compatible):**
```css
/* DON'T DO THIS - webkit-mask may not render on Amazon WebView */
.menu-item::before {
  -webkit-mask: linear-gradient(90deg, transparent, black);
}
```

**✅ New approach (Fire TV compatible):**
```css
/* Option 1: Simple border highlight */
.dashboard-grid__cell--focused {
  border-color: yellow;
  border-width: 3px;
}

/* Option 2: Box-shadow glow (better than mask) */
.dashboard-grid__cell--focused {
  box-shadow: 0 0 20px rgba(255, 255, 0, 0.5);
}

/* Option 3: Pseudo-element overlay (if needed) */
.dashboard-grid__cell--focused::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 3px solid yellow;
  border-radius: inherit;
  pointer-events: none;
}
```

---

### Fire TV Compatibility Checklist (Dashboard CSS)

**Before committing dashboard.css:**
- [ ] **NO viewport units with transforms** (use percentages)
- [ ] **NO -webkit-mask** (use box-shadow or layered divs)
- [ ] **NO complex filters** (blur, drop-shadow)
- [ ] **Minimal transform usage** (only on focused elements)
- [ ] **NO !important** (except utilities)
- [ ] **All inline styles removed from navigation.js**
- [ ] **BEM naming throughout**
- [ ] **CSS variables for dynamic values**

**Test on Fire TV Hardware:**
- [ ] Visual rendering correct (no missing effects)
- [ ] Transforms work (no viewport unit issues)
- [ ] Animations smooth (30+ FPS)
- [ ] Focus states visible
- [ ] Menu transitions work
- [ ] Grid navigation smooth

---

## Phase 3: Data Layer (Week 3) - Component CSS

### Days 15-21: Auth & Service Components

**Create css/components/button.css**
```css
.btn {
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-accent);
  color: white;
  border: none;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.btn:hover,
.btn:focus {
  background-color: var(--color-accent-hover);
}

.btn--primary {
  background-color: var(--color-accent);
}

.btn--secondary {
  background-color: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-text-secondary);
}

.btn--large {
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--font-size-lg);
}
```

**Create css/components/modal.css**
```css
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}

.modal__content {
  background-color: var(--color-bg-secondary);
  border-radius: var(--border-radius-lg);
  padding: var(--spacing-xl);
  max-width: 80%;
  max-height: 80%;
}

.modal__header {
  margin-bottom: var(--spacing-lg);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
}

.modal__body {
  margin-bottom: var(--spacing-lg);
}

.modal__footer {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
}
```

**Update index.html:**
```html
<link rel="stylesheet" href="css/components/button.css">
<link rel="stylesheet" href="css/components/modal.css">
```

---

## Phase 4: Remaining Modules (Week 4-5) - Module CSS

### Days 22-28: Settings Module CSS

**Create css/modules/settings.css**

**Settings Modal Structure:**
```css
/* Settings modal (extends base modal) */
.settings-modal {
  /* Inherits from .modal */
}

.settings-modal__container {
  width: 90%;
  height: 90%;
  max-width: 1200px;
  max-height: 800px;
}

.settings-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--color-text-secondary);
}

.settings-modal__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
}

.settings-modal__close {
  /* Button styles */
}

/* Settings page container */
.settings-modal__page {
  padding: var(--spacing-xl);
  display: none; /* Hidden by default */
}

.settings-modal__page--active {
  display: block;
}
```

**Settings Form Elements:**
```css
/* Form group */
.settings-form__group {
  margin-bottom: var(--spacing-lg);
}

.settings-form__label {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-weight: var(--font-weight-bold);
}

.settings-form__input {
  width: 100%;
  padding: var(--spacing-sm);
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-text-secondary);
  border-radius: var(--border-radius-sm);
}

.settings-form__input:focus {
  outline: none;
  border-color: var(--color-accent);
}

/* Calendar list styles */
.settings-calendar-list {
  list-style: none;
}

.settings-calendar-list__item {
  display: flex;
  align-items: center;
  padding: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
  background-color: var(--color-bg-primary);
  border-radius: var(--border-radius-sm);
}

.settings-calendar-list__item--enabled {
  border: 2px solid var(--color-accent);
}

.settings-calendar-list__checkbox {
  margin-right: var(--spacing-sm);
}

.settings-calendar-list__name {
  flex: 1;
}

.settings-calendar-list__account-badge {
  padding: 2px var(--spacing-sm);
  background-color: var(--color-accent);
  color: white;
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-sm);
}
```

**Fire TV Considerations:**
- [ ] Form inputs large enough for D-pad selection
- [ ] High contrast focus states
- [ ] No complex animations during form interaction
- [ ] Clear visual hierarchy

---

### Days 29-31: Login Module CSS

**Create css/modules/login.css**
```css
.login {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: var(--spacing-xl);
}

.login__logo {
  margin-bottom: var(--spacing-2xl);
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
}

.login__title {
  margin-bottom: var(--spacing-lg);
  font-size: var(--font-size-xl);
}

.login__methods {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  width: 100%;
  max-width: 400px;
}

.login__button {
  /* Extends .btn */
  width: 100%;
  padding: var(--spacing-lg);
  font-size: var(--font-size-lg);
}

/* Device flow (TV) specific */
.login__qr-code {
  margin: var(--spacing-xl) 0;
  padding: var(--spacing-lg);
  background-color: white;
  border-radius: var(--border-radius-md);
}

.login__device-code {
  margin-top: var(--spacing-md);
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  text-align: center;
  letter-spacing: 0.2em;
}
```

---

### Days 32-33: Modals Module CSS

**Create css/modules/modals.css**
```css
/* Confirmation modal (sleep, exit) */
.confirm-modal {
  /* Extends .modal */
}

.confirm-modal__icon {
  font-size: var(--font-size-3xl);
  text-align: center;
  margin-bottom: var(--spacing-lg);
}

.confirm-modal__message {
  text-align: center;
  font-size: var(--font-size-lg);
  margin-bottom: var(--spacing-xl);
}

.confirm-modal__actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
}

.confirm-modal__button {
  min-width: 120px;
}

.confirm-modal__button--focused {
  border: 3px solid yellow; /* High contrast for TV */
}
```

---

### Days 34-35: Welcome Module CSS

**Create css/modules/welcome.css**
```css
.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: var(--spacing-xl);
}

.welcome__screen {
  width: 100%;
  max-width: 800px;
  text-align: center;
}

.welcome__title {
  font-size: var(--font-size-2xl);
  margin-bottom: var(--spacing-lg);
}

.welcome__content {
  margin-bottom: var(--spacing-xl);
}

.welcome__progress {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: center;
  margin-bottom: var(--spacing-xl);
}

.welcome__progress-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: var(--color-text-secondary);
}

.welcome__progress-dot--active {
  background-color: var(--color-accent);
}

.welcome__actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
}
```

**D-pad Bug Fix (Screen 4 location):**
```css
/* Prevent button from being "pressed" during transition */
.welcome__button {
  transition: background-color var(--transition-fast);
}

.welcome__button--transitioning {
  pointer-events: none; /* Prevent interaction during screen transition */
  opacity: 0.7;
}
```

---

## Phase 5: Refactoring (Week 6) - CSS Cleanup

### Days 36-42: CSS Optimization

**Tasks:**

1. **Audit for unused styles**
   ```bash
   # Use PurgeCSS or manual audit
   npm install --save-dev purgecss
   ```

2. **Remove all !important** (except utilities)
   ```bash
   # Grep for remaining !important
   grep -r "!important" css/ --exclude-dir=legacy
   ```

3. **Verify BEM naming**
   ```bash
   # Check stylelint passes
   npm run lint:css
   ```

4. **Optimize file sizes**
   - Target: < 50KB per CSS file (compressed)
   - Remove unused variables
   - Consolidate repeated rules

5. **Add compression**
   - Configure server to serve GZIP/Brotli compressed CSS
   - Test compression ratio

**Checklist:**
- [ ] Zero !important (except utilities)
- [ ] All BEM naming
- [ ] No inline styles in JS (except CSS variable sets)
- [ ] CSS file sizes acceptable
- [ ] Stylelint passes with zero errors
- [ ] All legacy CSS references removed

---

## Phase 6: Testing & Polish (Week 7) - CSS Testing

### Days 43-49: CSS Testing on Hardware

**Fire TV Testing (Days 43-45)**

**Test on actual Fire TV stick:**
- [ ] Dashboard renders correctly
- [ ] Menu animations smooth (30+ FPS)
- [ ] Grid navigation visual feedback works
- [ ] Focus states highly visible (yellow borders clear)
- [ ] No webkit-mask issues (effects render)
- [ ] Transform transitions smooth
- [ ] Theme switching works (dark/light)
- [ ] Settings forms usable with D-pad
- [ ] Login QR code displays correctly
- [ ] Welcome wizard buttons clear

**Performance Testing:**
```javascript
// Measure FPS during navigation
let lastTime = performance.now();
let frames = 0;

function measureFPS() {
  const now = performance.now();
  const delta = now - lastTime;
  frames++;

  if (delta >= 1000) {
    console.log(`FPS: ${(frames * 1000 / delta).toFixed(1)}`);
    frames = 0;
    lastTime = now;
  }

  requestAnimationFrame(measureFPS);
}

measureFPS();
```

**Target Metrics:**
- [ ] Navigation: 30+ FPS
- [ ] Menu open/close: 30+ FPS
- [ ] Widget focus: 30+ FPS
- [ ] Modal transitions: 30+ FPS

**Google TV Testing (Days 46-47)**
- [ ] All Fire TV tests repeated
- [ ] Platform-specific issues noted
- [ ] Performance compared to Fire TV

**Responsive Testing (Days 48-49)**
- [ ] Desktop browser (1920x1080)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)
- [ ] TV aspect ratio (16:9)

---

## CSS Maintenance Guidelines

### Adding New Styles

**1. Choose the right file:**
- Component (reusable UI) → `css/components/`
- Module (page-specific) → `css/modules/`
- Global utility → `css/core/utilities.css`
- Theme variable → `css/core/variables.css`

**2. Use BEM naming:**
```css
/* Good */
.dashboard-menu__item--selected { }

/* Bad */
.selected-menu-item { }
```

**3. Avoid !important:**
```css
/* Bad */
.override {
  color: red !important;
}

/* Good - proper specificity */
.dashboard-menu__item.dashboard-menu__item--override {
  color: red;
}
```

**4. Use CSS variables for dynamic values:**
```javascript
// Good
element.style.setProperty('--offset', `${value}px`);

// Bad
element.style.transform = `translateX(${value}px)`;
```

**5. Test on Fire TV before committing:**
- Run stylelint
- Check for webkit-mask, viewport units, complex transforms
- Test on actual hardware if possible

---

## Fire TV CSS Quick Reference

### ✅ Safe to Use

```css
/* Layout */
display: flex;
display: grid;
position: relative | absolute | fixed;

/* Sizing with percentages */
width: 50%;
height: 100%;

/* Simple transforms */
transform: scale(1.05);
transform: translateX(10px);

/* Simple transitions */
transition: opacity 0.3s ease;
transition: border-color 0.3s ease;

/* Box model */
padding, margin, border, border-radius

/* Colors & backgrounds */
background-color, color, opacity

/* Simple shadows */
box-shadow: 0 0 10px rgba(0,0,0,0.5);
```

### ❌ Avoid on Fire TV

```css
/* Viewport units with transforms */
width: 50vw;
transform: translate(-50%, 0); /* May not work */

/* Webkit-mask */
-webkit-mask: linear-gradient(...); /* May not render */

/* Complex filters */
filter: blur(10px) drop-shadow(...); /* Performance hit */

/* TranslateZ() overuse */
transform: translateZ(0); /* Each creates layer */

/* Complex animations */
@keyframes complex { /* 10 properties */ } /* Slow */
```

---

## Summary

**CSS Development Approach:**
1. **Incremental** - Build CSS alongside JS for each component
2. **Test Early** - Verify on Fire TV hardware frequently
3. **Component-Based** - Align CSS structure with JS modules
4. **BEM Naming** - Clear ownership and no specificity wars
5. **Fire TV First** - Design for lowest common denominator (old WebView)
6. **Performance** - Simple transforms, minimal animations
7. **Linting** - Stylelint catches issues before testing

**Tools:**
- Stylelint (linting)
- Fire TV stick (hardware testing)
- Google TV (hardware testing)
- Browser DevTools (performance profiling)

**Success Criteria:**
- Zero !important (except utilities)
- All BEM naming
- 30+ FPS on Fire TV
- < 50KB per CSS file
- Zero inline styles in JS
- Passes stylelint with zero errors

---

**End of CSS Build Integration Document**
