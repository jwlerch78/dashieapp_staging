# Phase 5: Refactoring & Cleanup - Quick Start Guide

**Estimated Time:** 0.5-1 day
**Status:** Ready after Phase 4 complete
**Prerequisites:** Phase 4 (All Modules) complete

---

## What You're Doing

Code cleanup and optimization:
- Remove unused legacy code
- Consolidate duplicated patterns
- Optimize imports
- Clean up CSS
- Update documentation
- Performance audit

---

## Refactoring Tasks

### 1. Remove Unused Legacy Code

**Goal:** Clean up `.legacy/` references and dead code

**Tasks:**
```bash
# Find all imports from .legacy/
grep -r "from.*\.legacy" js/ --include="*.js"

# Review each and ensure new implementation exists
# Remove .legacy/ imports once confirmed
```

**Checklist:**
- [ ] No imports from `.legacy/` in production code
- [ ] `.legacy/` folder only for reference
- [ ] All legacy patterns replaced

---

### 2. Consolidate Duplicated Patterns

**Goal:** DRY up repeated code

**Common duplication areas:**
- State management patterns (each module has similar logic)
- Input handler boilerplate
- LocalStorage patterns
- CSS class manipulation

**Example consolidation:**
```javascript
// Before: Duplicated in every module
class DashboardStateManager {
    static persist() {
        localStorage.setItem('dashie-dashboard-state', JSON.stringify(this.state));
    }
}

class SettingsStateManager {
    static persist() {
        localStorage.setItem('dashie-settings-state', JSON.stringify(this.state));
    }
}

// After: Shared utility
// js/utils/state-persistence.js
export function persistState(key, state) {
    try {
        localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
        logger.error(`Failed to persist ${key}:`, error);
    }
}

export function loadState(key, defaultState) {
    try {
        const saved = localStorage.getItem(key);
        return saved ? { ...defaultState, ...JSON.parse(saved) } : defaultState;
    } catch (error) {
        logger.error(`Failed to load ${key}:`, error);
        return defaultState;
    }
}

// Usage
import { persistState, loadState } from '../../utils/state-persistence.js';

class DashboardStateManager {
    static persist() {
        persistState('dashie-dashboard-state', this.state);
    }

    static async initialize() {
        this.state = loadState('dashie-dashboard-state', this.getDefaultState());
    }
}
```

**Checklist:**
- [ ] State persistence consolidated
- [ ] LocalStorage access patterns shared
- [ ] CSS class manipulation utilities created
- [ ] Input handler boilerplate reduced

---

### 3. Optimize Imports

**Goal:** Tree-shaking friendly imports, no circular dependencies

**Tasks:**
```bash
# Find circular dependencies
# Use a tool like madge or dpdm
npx madge --circular js/

# Optimize imports (named exports vs default)
# Prefer named exports for tree-shaking
```

**Checklist:**
- [ ] No circular dependencies
- [ ] Named exports preferred where appropriate
- [ ] Import paths consistent
- [ ] No unused imports

---

### 4. CSS Cleanup

**Goal:** Remove unused CSS, consolidate duplicates

**Tasks:**
```bash
# Find unused CSS (use PurgeCSS or manual audit)
npx purgecss --css css/**/*.css --content js/**/*.js index.html

# Check for !important (should be zero except utilities)
grep -r "!important" css/ --exclude-dir=legacy

# Verify BEM naming throughout
npm run lint:css
```

**Checklist:**
- [ ] Unused CSS removed
- [ ] Zero `!important` (except utilities)
- [ ] All BEM naming verified
- [ ] CSS file sizes optimized
- [ ] CSS variables used consistently

---

### 5. Documentation Update

**Goal:** Ensure docs match implementation

**Files to update:**
- `README.md` - Project overview
- `ARCHITECTURE.md` - Update if patterns changed
- `API_INTERFACES.md` - Update if interfaces changed
- Add JSDoc comments to all public APIs

**Example JSDoc:**
```javascript
/**
 * Dashboard module - Main application view
 * @module Dashboard
 */

/**
 * Initialize dashboard module
 * @returns {Promise<void>}
 * @fires AppComms.events.MODULE_INITIALIZED
 */
static async initialize() {
    // ...
}

/**
 * Navigate grid up
 * @returns {boolean} True if navigation succeeded
 */
static moveUp() {
    // ...
}
```

**Checklist:**
- [ ] README.md updated
- [ ] ARCHITECTURE.md reflects reality
- [ ] API_INTERFACES.md accurate
- [ ] All public APIs have JSDoc
- [ ] Examples in docs work

---

### 6. Performance Audit

**Goal:** Identify and fix performance bottlenecks

**Metrics to measure:**
- App startup time (< 2 seconds target)
- Module activation time (< 100ms target)
- Input response time (< 16ms target for 60fps)
- Memory usage (< 50MB target)

**Tools:**
```javascript
// Measure module initialization
console.time('Dashboard.initialize');
await Dashboard.initialize();
console.timeEnd('Dashboard.initialize');

// Measure input latency
const start = performance.now();
DashboardInputHandler.handleUp();
const latency = performance.now() - start;
console.log(`Input latency: ${latency.toFixed(2)}ms`);

// Memory usage
if (performance.memory) {
    const mb = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
    console.log(`Memory usage: ${mb} MB`);
}
```

**Common optimizations:**
- Lazy load modules
- Debounce expensive operations
- Use requestAnimationFrame for visual updates
- Cache DOM queries
- Minimize re-renders

**Checklist:**
- [ ] Startup time measured
- [ ] Input latency measured
- [ ] Memory usage measured
- [ ] All metrics within targets
- [ ] Performance regressions identified

---

### 7. Code Style Consistency

**Goal:** Consistent formatting, naming, patterns

**ESLint + Prettier:**
```bash
# Set up ESLint + Prettier
npm install --save-dev eslint prettier eslint-config-prettier

# Create .eslintrc.json
{
  "env": { "browser": true, "es2021": true },
  "extends": ["eslint:recommended", "prettier"],
  "parserOptions": { "ecmaVersion": 12, "sourceType": "module" },
  "rules": {
    "no-console": ["warn", { "allow": ["error", "warn"] }],
    "no-unused-vars": "warn"
  }
}

# Create .prettierrc.json
{
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 4,
  "semi": true
}

# Run linters
npm run lint
npm run lint:fix
```

**Naming conventions:**
- Classes: PascalCase (`DashboardModule`)
- Functions: camelCase (`handleUp`)
- Constants: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- CSS: BEM kebab-case (`.dashboard-menu__item--selected`)
- Files: kebab-case (`input-handler.js`)

**Checklist:**
- [ ] ESLint configured and passing
- [ ] Prettier configured
- [ ] All code formatted consistently
- [ ] Naming conventions followed
- [ ] No linter warnings

---

### 8. Error Handling Audit

**Goal:** Consistent error handling throughout

**Pattern:**
```javascript
// ✅ Good: Try-catch with logging
async function loadData() {
    try {
        const data = await fetchFromAPI();
        return data;
    } catch (error) {
        logger.error('Failed to load data:', error);
        AppComms.publish(AppComms.events.ERROR_OCCURRED, {
            error,
            context: 'data-loading',
            severity: 'error'
        });
        throw error; // Re-throw if caller needs to handle
    }
}

// ✅ Good: Error boundary for UI
class ModuleRenderer {
    static render() {
        try {
            // Render logic
        } catch (error) {
            this.renderError(error);
        }
    }

    static renderError(error) {
        logger.error('Render failed:', error);
        document.getElementById('app').innerHTML = `
            <div class="error-state">
                <p>Something went wrong</p>
                <button onclick="location.reload()">Reload</button>
            </div>
        `;
    }
}
```

**Checklist:**
- [ ] All async operations have try-catch
- [ ] Errors logged consistently
- [ ] Critical errors have user-facing messages
- [ ] Error events published
- [ ] No silent failures

---

### 9. Security Review

**Goal:** Ensure no security issues

**Common issues to check:**
- XSS vulnerabilities (unsanitized HTML)
- Token exposure (logging, error messages)
- CORS misconfiguration
- localStorage token storage (should use TokenStore)

**Checklist:**
- [ ] No `innerHTML` with unsanitized user input
- [ ] Tokens never logged or exposed
- [ ] TokenStore used for all auth tokens
- [ ] CORS configured correctly
- [ ] No sensitive data in error messages

---

### 10. Accessibility Audit

**Goal:** Ensure app is accessible

**ARIA attributes:**
```html
<!-- Good: Accessible modal -->
<div class="modal" role="dialog" aria-labelledby="modal-title" aria-modal="true">
    <h2 id="modal-title">Confirm Sleep Mode</h2>
    <div class="modal__actions">
        <button aria-label="Confirm sleep mode">Yes</button>
        <button aria-label="Cancel">No</button>
    </div>
</div>

<!-- Good: Accessible navigation -->
<nav aria-label="Dashboard menu">
    <button aria-label="Calendar settings">Calendar</button>
    <button aria-label="Map settings">Map</button>
</nav>
```

**Keyboard navigation:**
- Tab order logical
- Focus indicators visible
- All interactive elements keyboard accessible
- Escape closes modals

**Checklist:**
- [ ] ARIA labels on interactive elements
- [ ] Focus indicators visible
- [ ] Tab order logical
- [ ] Keyboard navigation works
- [ ] Screen reader tested (if possible)

---

## Success Criteria

### Phase 5 Complete When:
- [ ] All legacy code removed or isolated
- [ ] No code duplication
- [ ] Imports optimized
- [ ] CSS cleaned up
- [ ] Documentation updated
- [ ] Performance measured and acceptable
- [ ] Code style consistent
- [ ] Error handling robust
- [ ] Security reviewed
- [ ] Accessibility verified

---

## Next Steps

When Phase 5 is complete, move to:
**Phase 6: Testing & Polish** (Unit tests, integration tests, final polish)

See: `.reference/build-plans/Phase 6 - Testing & Polish.md`

---

**Clean code is happy code. Polish it up!** ✨
