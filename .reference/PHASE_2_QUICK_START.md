# Phase 2 Quick Start - Copy/Paste This

**Copy this entire message and paste it into your new Claude Code session:**

---

I'm continuing the Dashie dashboard refactor. We've completed Phase 1 (core infrastructure) and are starting Phase 2 (Dashboard module).

## Context

**Project:** Ground-up rebuild of Dashie smart home dashboard for Fire TV
**Tech:** Vanilla JavaScript (ES6 modules), Vanilla CSS, Supabase backend
**Platform:** Fire TV (Amazon WebView), Desktop, Mobile
**Current Phase:** Phase 2 - Dashboard Module (Week 2, Days 8-14)

## Phase 1 Complete ✅

Core infrastructure is built, tested, and working:
- ✅ config.js - Single source of truth
- ✅ Logger infrastructure (logger.js, console-commands.js)
- ✅ Core components (singletons): AppComms, AppStateManager, InputHandler, ActionRouter, WidgetMessenger
- ✅ Test page (index.html) - All tests passing
- ✅ Complete documentation (ARCHITECTURE.md, API_INTERFACES.md, BUILD_STRATEGY.md, CSS guides)

**See full details:** `.reference/PHASE_2_HANDOFF.md`

## Phase 2 Goal: Dashboard Module

Build the Dashboard module - main view with 2x3 widget grid, sidebar menu, and focus navigation.

**Module Structure:**
```
js/modules/Dashboard/
├── index.js                    # Public API
├── input-handler.js            # D-pad/keyboard input
├── state-manager.js            # Grid position, focus state
├── navigation-manager.js       # Grid + menu navigation
├── ui-renderer.js              # Dashboard UI
└── focus-menu-manager.js       # Focus menu system
```

**CSS:** `css/modules/dashboard.css` (replaces legacy navigation.css)

## Key Architecture Points

1. **Navigation Consolidation:** Legacy navigation.js (1,052 lines) absorbed into Dashboard module
2. **CSS Refactoring:** Rewrite with Fire TV compatibility (eliminate 13 `!important`, replace `-webkit-mask`, use BEM naming)
3. **Input Flow:** User Input → InputHandler → AppComms → ActionRouter → Dashboard handlers
4. **State Pattern:** CSS classes for states, CSS variables for dynamic values (no inline styles)

## Fire TV CSS Rules

**❌ AVOID:**
- Viewport units with transforms (`width: 50vw; transform: translate(-50%, 0)`)
- `-webkit-mask` (may not render)
- Complex filters (`blur`, `drop-shadow`)
- TranslateZ() overuse

**✅ SAFE:**
- Percentages with transforms (`width: 50%; transform: translate(-50%, 0)`)
- Simple shadows (`box-shadow`)
- Simple transitions (opacity, border-color)
- CSS variables for dynamic values

## Starting Tasks (Day 8)

1. Create Dashboard module structure:
   - `js/modules/Dashboard/index.js`
   - `js/modules/Dashboard/input-handler.js`
   - `js/modules/Dashboard/state-manager.js`

2. Implement module interface:
```javascript
// index.js exports
{
  initialize: async () => {},
  activate: () => {},
  deactivate: () => {},
  name: 'dashboard'
}
```

3. Implement input handler:
```javascript
// input-handler.js exports
{
  handleUp: (event) => true,
  handleDown: (event) => true,
  handleLeft: (event) => true,
  handleRight: (event) => true,
  handleEnter: (event) => true,
  handleEscape: (event) => true,
  // ... other handlers
}
```

4. Register with ActionRouter:
```javascript
import ActionRouter from '../../core/action-router.js';
import inputHandler from './input-handler.js';

ActionRouter.registerModule('dashboard', inputHandler);
```

## Important Notes

- **Action names updated:** `prev`/`next` (not prev-view/next-view), `play-pause` (not sleep-toggle)
- **Use logger, not console.log:** `import { createLogger } from '../utils/logger.js'`
- **Singleton pattern:** All core components use lowercase exports (instances, not classes)
- **BEM naming for CSS:** `.dashboard-menu__item--selected`
- **No inline styles in JS** (except CSS variable sets via `style.setProperty()`)

## Key Documentation

- **Full handoff:** `.reference/PHASE_2_HANDOFF.md`
- **Architecture:** `.reference/ARCHITECTURE.md` (Dashboard Module section + CSS/Styling Architecture)
- **Interfaces:** `.reference/API_INTERFACES.md` (Module interface)
- **CSS Plan:** `.reference/CSS_BUILD_INTEGRATION.md` (Phase 2 section)
- **Testing:** `.reference/TESTING_NOTES.md` (Phase 1 results)

## Success Criteria

- [ ] Dashboard module structure created
- [ ] Input handler registered with ActionRouter
- [ ] Grid navigation works (2×3)
- [ ] Menu navigation works (7 items)
- [ ] Widget focus/defocus works
- [ ] CSS refactored (dashboard.css) with BEM naming
- [ ] No `!important` in CSS (except utilities)
- [ ] Fire TV compatibility rules followed
- [ ] All tests passing on desktop

## Legacy Code Reference

**DO NOT copy directly** - use for understanding behavior only:
- `.legacy/js/core/navigation.js` (1,052 lines)
- `.legacy/css/components/navigation.css` (203 lines)

## Ready to Begin Phase 2!

Please help me implement the Dashboard module following the architecture and guidelines above. Start with Day 8 tasks: create module structure, implement input handler, and register with ActionRouter.

Let me know if you need any clarification on the architecture or implementation approach!
