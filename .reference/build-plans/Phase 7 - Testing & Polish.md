# Phase 6: Testing & Polish - Quick Start Guide

**Estimated Time:** 1-2 days
**Status:** Ready after Phase 5 complete
**Prerequisites:** Phase 5 (Refactoring) complete

---

## What You're Doing

Final testing and polish:
- Unit tests for core components
- Integration tests for user flows
- Hardware testing (Fire TV, Google TV)
- Bug fixes
- Performance optimization
- Final polish

---

## Testing Strategy

### 1. Unit Tests

**Framework:** Vitest (fast, ESM-native) or Jest

**Setup:**
```bash
npm install --save-dev vitest @vitest/ui
```

**vitest.config.js:**
```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        coverage: {
            provider: 'c8',
            reporter: ['text', 'html'],
            exclude: ['.legacy/**', 'node_modules/**']
        }
    }
});
```

**Test structure:**
```
tests/
├── unit/
│   ├── core/
│   │   ├── app-comms.test.js
│   │   ├── app-state-manager.test.js
│   │   ├── action-router.test.js
│   │   └── widget-messenger.test.js
│   ├── modules/
│   │   ├── dashboard.test.js
│   │   ├── settings.test.js
│   │   └── login.test.js
│   └── utils/
│       ├── logger.test.js
│       └── platform-detector.test.js
└── integration/
    ├── auth-flow.test.js
    ├── dashboard-navigation.test.js
    ├── settings-persistence.test.js
    └── widget-communication.test.js
```

---

### 2. Core Component Tests

**Example: AppComms (Event Bus)**
```javascript
// tests/unit/core/app-comms.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import AppComms from '../../../js/core/app-comms.js';

describe('AppComms', () => {
    beforeEach(() => {
        AppComms.clear(); // Reset before each test
    });

    it('should subscribe and publish events', () => {
        let received = null;

        AppComms.subscribe('test', (data) => {
            received = data;
        });

        AppComms.publish('test', { message: 'Hello' });

        expect(received).toEqual({ message: 'Hello' });
    });

    it('should unsubscribe from events', () => {
        let count = 0;

        const callback = () => { count++; };
        AppComms.subscribe('test', callback);

        AppComms.publish('test');
        expect(count).toBe(1);

        AppComms.unsubscribe('test', callback);
        AppComms.publish('test');
        expect(count).toBe(1); // Still 1, not 2
    });

    it('should handle errors in subscribers', () => {
        AppComms.subscribe('test', () => {
            throw new Error('Subscriber error');
        });

        // Should not throw
        expect(() => {
            AppComms.publish('test');
        }).not.toThrow();
    });

    it('should return unsubscribe function', () => {
        let count = 0;

        const unsubscribe = AppComms.subscribe('test', () => { count++; });

        AppComms.publish('test');
        expect(count).toBe(1);

        unsubscribe();
        AppComms.publish('test');
        expect(count).toBe(1);
    });
});
```

**Example: AppStateManager**
```javascript
// tests/unit/core/app-state-manager.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import AppStateManager from '../../../js/core/app-state-manager.js';

describe('AppStateManager', () => {
    beforeEach(async () => {
        localStorage.clear();
        await AppStateManager.initialize();
    });

    it('should initialize with default state', () => {
        const state = AppStateManager.getState();

        expect(state.currentModule).toBeNull();
        expect(state.theme).toBe('dark');
        expect(state.isInitialized).toBe(true);
    });

    it('should update state', () => {
        AppStateManager.setState({ theme: 'light' });

        const state = AppStateManager.getState();
        expect(state.theme).toBe('light');
    });

    it('should persist state to localStorage', () => {
        AppStateManager.setState({ theme: 'light' });

        const saved = JSON.parse(localStorage.getItem('dashie-app-state'));
        expect(saved.theme).toBe('light');
    });

    it('should load state from localStorage', async () => {
        localStorage.setItem('dashie-app-state', JSON.stringify({ theme: 'light' }));

        await AppStateManager.initialize();

        const state = AppStateManager.getState();
        expect(state.theme).toBe('light');
    });

    it('should publish MODULE_CHANGED event', () => {
        let eventData = null;

        AppComms.subscribe(AppComms.events.MODULE_CHANGED, (data) => {
            eventData = data;
        });

        AppStateManager.setCurrentModule('dashboard');

        expect(eventData).toEqual({
            from: null,
            to: 'dashboard'
        });
    });
});
```

**Example: ActionRouter**
```javascript
// tests/unit/core/action-router.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ActionRouter from '../../../js/core/action-router.js';
import AppStateManager from '../../../js/core/app-state-manager.js';

describe('ActionRouter', () => {
    beforeEach(() => {
        ActionRouter.modules.clear();
    });

    it('should register modules', () => {
        const handler = { handleUp: () => true };

        ActionRouter.registerModule('test', handler);

        expect(ActionRouter.isModuleRegistered('test')).toBe(true);
    });

    it('should route actions to current module', () => {
        const handler = {
            handleUp: vi.fn(() => true)
        };

        ActionRouter.registerModule('test', handler);
        AppStateManager.setCurrentModule('test');

        const result = ActionRouter.route('up');

        expect(handler.handleUp).toHaveBeenCalled();
        expect(result).toBe(true);
    });

    it('should return false if no handler method', () => {
        const handler = {};

        ActionRouter.registerModule('test', handler);
        AppStateManager.setCurrentModule('test');

        const result = ActionRouter.route('up');

        expect(result).toBe(false);
    });

    it('should handle errors in handlers', () => {
        const handler = {
            handleUp: () => { throw new Error('Handler error'); }
        };

        ActionRouter.registerModule('test', handler);
        AppStateManager.setCurrentModule('test');

        const result = ActionRouter.route('up');

        expect(result).toBe(false);
    });
});
```

**Coverage targets:**
- Core components: 90%+
- Modules: 80%+
- Utils: 90%+

**Checklist:**
- [ ] AppComms tests pass
- [ ] AppStateManager tests pass
- [ ] ActionRouter tests pass
- [ ] InputHandler tests pass
- [ ] WidgetMessenger tests pass
- [ ] Coverage targets met

---

### 3. Integration Tests

**Framework:** Playwright (E2E testing)

**Setup:**
```bash
npm install --save-dev @playwright/test
npx playwright install
```

**Test example:**
```javascript
// tests/integration/dashboard-navigation.test.js
import { test, expect } from '@playwright/test';

test.describe('Dashboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForSelector('.dashboard');
    });

    test('should navigate grid with arrow keys', async ({ page }) => {
        // Focus should start at [0,0]
        const firstCell = page.locator('[data-row="0"][data-col="0"]');
        await expect(firstCell).toHaveClass(/focused/);

        // Press down arrow
        await page.keyboard.press('ArrowDown');

        // Focus should move to [1,0]
        const secondCell = page.locator('[data-row="1"][data-col="0"]');
        await expect(secondCell).toHaveClass(/focused/);

        // Press right arrow
        await page.keyboard.press('ArrowRight');

        // Focus should move to [1,1]
        const thirdCell = page.locator('[data-row="1"][data-col="1"]');
        await expect(thirdCell).toHaveClass(/focused/);
    });

    test('should open menu with left arrow at column 0', async ({ page }) => {
        const sidebar = page.locator('.dashboard-sidebar');

        // Should not be expanded initially
        await expect(sidebar).not.toHaveClass(/expanded/);

        // Press left arrow (at column 0)
        await page.keyboard.press('ArrowLeft');

        // Menu should expand
        await expect(sidebar).toHaveClass(/expanded/);
    });

    test('should close menu with right arrow', async ({ page }) => {
        // Open menu first
        await page.keyboard.press('ArrowLeft');

        const sidebar = page.locator('.dashboard-sidebar');
        await expect(sidebar).toHaveClass(/expanded/);

        // Close with right arrow
        await page.keyboard.press('ArrowRight');

        await expect(sidebar).not.toHaveClass(/expanded/);
    });

    test('should navigate menu with up/down arrows', async ({ page }) => {
        // Open menu
        await page.keyboard.press('ArrowLeft');

        // First item should be selected
        const firstItem = page.locator('.dashboard-menu__item').first();
        await expect(firstItem).toHaveClass(/selected/);

        // Press down
        await page.keyboard.press('ArrowDown');

        // Second item should be selected
        const secondItem = page.locator('.dashboard-menu__item').nth(1);
        await expect(secondItem).toHaveClass(/selected/);
    });

    test('should persist grid position on reload', async ({ page }) => {
        // Navigate to [1,2]
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');

        // Reload page
        await page.reload();
        await page.waitForSelector('.dashboard');

        // Focus should restore to [1,2]
        const cell = page.locator('[data-row="1"][data-col="2"]');
        await expect(cell).toHaveClass(/focused/);
    });
});
```

**Test flows:**
- [ ] App startup
- [ ] Dashboard navigation
- [ ] Menu navigation
- [ ] Widget focus/defocus
- [ ] Settings modal
- [ ] Login flow
- [ ] State persistence

---

### 4. Hardware Testing

**Fire TV Testing:**

**Setup:**
1. Sideload app to Fire TV stick
2. Connect Chrome DevTools for debugging
3. Test with Fire TV remote

**Test checklist:**
- [ ] App loads without errors
- [ ] Dashboard renders correctly
- [ ] Menu animations smooth (30+ FPS)
- [ ] Grid navigation with D-pad works
- [ ] Focus indicators highly visible
- [ ] No webkit-mask rendering issues
- [ ] Transform transitions smooth
- [ ] Settings modal usable with D-pad
- [ ] Login device flow works
- [ ] Welcome wizard works

**Performance metrics:**
```javascript
// Measure FPS during navigation
let lastTime = performance.now();
let frames = 0;

function measureFPS() {
    const now = performance.now();
    frames++;

    if (now - lastTime >= 1000) {
        console.log(`FPS: ${frames}`);
        frames = 0;
        lastTime = now;
    }

    requestAnimationFrame(measureFPS);
}

measureFPS();
```

**Target metrics:**
- Navigation: 30+ FPS
- Menu transitions: 30+ FPS
- Input latency: < 100ms
- Memory: < 50MB

---

### 5. Bug Fixes

**Bug tracking:**
Create issues for each bug found during testing

**Priority levels:**
- P0: Blocks core functionality (fix immediately)
- P1: Major feature broken (fix before launch)
- P2: Minor issue (fix if time allows)
- P3: Nice-to-have (post-launch)

**Common bug categories:**
- Navigation bugs
- State persistence bugs
- UI rendering bugs
- Performance issues
- Edge cases

**Checklist:**
- [ ] All P0 bugs fixed
- [ ] All P1 bugs fixed
- [ ] P2 bugs triaged
- [ ] P3 bugs documented for later

---

### 6. Performance Optimization

**Profiling:**
```javascript
// Chrome DevTools Performance tab
// Record while navigating dashboard
// Look for:
// - Long tasks (> 50ms)
// - Layout thrashing
// - Memory leaks
// - Excessive repaints
```

**Common optimizations:**

**1. Debounce expensive operations:**
```javascript
// Before: Expensive on every keystroke
input.addEventListener('input', (e) => {
    searchCalendars(e.target.value);
});

// After: Debounced
import { debounce } from './utils/debounce.js';

input.addEventListener('input', debounce((e) => {
    searchCalendars(e.target.value);
}, 300));
```

**2. Cache DOM queries:**
```javascript
// Before: Query DOM every time
function updateFocus() {
    const cells = document.querySelectorAll('.widget-cell'); // Slow
    cells.forEach(cell => cell.classList.remove('focused'));
}

// After: Cache elements
class UIRenderer {
    static elements = {
        cells: null
    };

    static render() {
        // Cache once during render
        this.elements.cells = Array.from(document.querySelectorAll('.widget-cell'));
    }

    static updateFocus() {
        // Use cached elements
        this.elements.cells.forEach(cell => cell.classList.remove('focused'));
    }
}
```

**3. Use requestAnimationFrame for visual updates:**
```javascript
// Before: May cause jank
function animate() {
    element.style.transform = `translateX(${x}px)`;
}

// After: Smooth animation
function animate() {
    requestAnimationFrame(() => {
        element.style.transform = `translateX(${x}px)`;
    });
}
```

**Checklist:**
- [ ] No long tasks > 50ms
- [ ] No layout thrashing
- [ ] DOM queries cached
- [ ] Animations use RAF
- [ ] Memory usage stable

---

### 7. Final Polish

**UI polish:**
- [ ] All transitions smooth
- [ ] Focus indicators consistent
- [ ] Colors accessible (WCAG AA)
- [ ] Spacing consistent
- [ ] Typography consistent
- [ ] Loading states implemented
- [ ] Error states implemented

**UX polish:**
- [ ] Keyboard shortcuts work
- [ ] Escape key closes modals
- [ ] Confirmation for destructive actions
- [ ] Toast notifications for feedback
- [ ] Helpful error messages

**Code polish:**
- [ ] All TODOs addressed
- [ ] Console.logs removed (except errors)
- [ ] Comments updated
- [ ] Dead code removed
- [ ] File names consistent

---

## Launch Checklist

### Pre-Launch
- [ ] All tests passing
- [ ] All P0/P1 bugs fixed
- [ ] Performance metrics met
- [ ] Hardware testing complete
- [ ] Documentation updated
- [ ] README accurate
- [ ] Version bumped

### Launch
- [ ] Deploy to staging
- [ ] Test on staging
- [ ] Deploy to production
- [ ] Monitor for errors
- [ ] User feedback collected

### Post-Launch
- [ ] Monitor performance metrics
- [ ] Address user-reported bugs
- [ ] Plan Phase 7 (Future Enhancements)

---

## Success Criteria

### Phase 6 Complete When:
- [ ] Unit tests passing (90%+ coverage on core)
- [ ] Integration tests passing
- [ ] Fire TV testing complete (30+ FPS)
- [ ] Google TV testing complete
- [ ] All P0/P1 bugs fixed
- [ ] Performance optimized
- [ ] UI polished
- [ ] UX polished
- [ ] Code polished
- [ ] Ready for production launch

---

## Next Steps

After Phase 6, the rebuild is **complete**! 🎉

Next phases (post-launch):
- **Phase 7:** Medium-priority technical debt
- **Phase 8:** Future enhancements (offline mode, etc.)

---

**The finish line is in sight. Test thoroughly, polish well, ship with confidence!** 🚀
