# Build Plans - Quick Start Guides

**Purpose:** Focused, phase-specific guides for implementing the Dashie rebuild.

---

## How to Use These Guides

Each phase has a dedicated quick start guide that contains **only** what you need for that phase:
- **Specific sections to read** (with line numbers)
- **Files to create** (exact paths)
- **Legacy code references** (what to look at, not copy)
- **Implementation steps** (clear, actionable tasks)
- **Success criteria** (how you know you're done)

**Estimated token usage per guide: ~15-20K tokens** (vs. 85K+ for reading all docs)

---

## Phase Overview

```
Phase 1: Core Infrastructure ✅ COMPLETE
  └─ Already built in previous session

Phase 2: Dashboard Module (1-2 days)
  └─ Validates architecture with first real feature

Phase 2.5: Widget Integration (1-2 days)
  └─ Fire TV CSS fixes, widget loading, focus menu system

Phase 3: Data Layer (1-2 days)
  └─ Auth, JWT, Services + High-priority technical debt

Phase 4: Remaining Modules (2-3 days)
  └─ Settings, Login, Modals, Welcome

Phase 5: Refactoring (0.5-1 day)
  └─ Cleanup, optimization, consolidation

Phase 6: Testing & Polish (1-2 days)
  └─ Unit tests, integration tests, hardware testing

Total estimate: 6-10 days
```

---

## Phase Guides

### [Phase 2: Dashboard Module](./Phase%202%20-%20Dashboard%20Module.md)
**Start here** - Build the main dashboard view
- 2×3 widget grid
- Sidebar menu navigation
- D-pad/keyboard input
- Fire TV compatible CSS

**Prerequisites:** Phase 1 complete
**Estimated time:** 1-2 days

---

### [Phase 2.5: Widget Integration](./Phase%202.5%20-%20Widget%20Integration.md)
Integrate and refactor existing widgets
- Copy 8 widgets from legacy
- Fire TV CSS fixes (webkit-mask, backdrop-filter, scale)
- Focus menu system integration
- Widget loading and registration
- Hardware testing

**Prerequisites:** Phase 2 complete
**Estimated time:** 1-2 days

---

### [Phase 3: Data Layer](./Phase%203%20-%20Data%20Layer.md)
Build authentication and data infrastructure
- Multi-provider auth architecture (2-layer design)
- JWT service with token management
- Calendar service with account-prefixed IDs
- Photo service
- **High-priority technical debt fixes included**

**Prerequisites:** Phase 2 complete
**Estimated time:** 1-2 days

---

### [Phase 4: Remaining Modules](./Phase%204%20-%20Remaining%20Modules.md)
Complete the UI with remaining modules
- Settings module (6 pages, modular composition)
- Login module (platform-specific flows)
- Modals module (confirmations)
- Welcome module (with D-pad bug fix)

**Prerequisites:** Phase 3 complete
**Estimated time:** 2-3 days

---

### [Phase 5: Refactoring](./Phase%205%20-%20Refactoring.md)
Clean up and optimize
- Remove unused legacy code
- Consolidate duplicated patterns
- Optimize imports
- CSS cleanup
- Performance audit

**Prerequisites:** Phase 4 complete
**Estimated time:** 0.5-1 day

---

### [Phase 6: Testing & Polish](./Phase%206%20-%20Testing%20&%20Polish.md)
Final testing and polish
- Unit tests (Vitest)
- Integration tests (Playwright)
- Fire TV hardware testing
- Bug fixes
- Performance optimization
- Final polish

**Prerequisites:** Phase 5 complete
**Estimated time:** 1-2 days

---

## For a New Claude Session

**Starting Phase 2? Use this prompt:**

```
I'm continuing the Dashie rebuild. Phase 1 (core infrastructure) is complete and tested.

I'm starting Phase 2: Dashboard Module.

Please read:
.reference/build-plans/Phase 2 - Dashboard Module.md

This guide contains everything you need, including:
- Specific sections to read from other docs (with line numbers)
- Files to create
- Implementation steps
- Success criteria

Ready to build the Dashboard module!
```

**This loads ~15K tokens instead of 85K tokens.**

---

## Key Benefits

### 1. **Token Efficient**
- Only load what's needed for current phase
- ~80% reduction in context loading
- More tokens available for implementation

### 2. **Focused Context**
- No information overload
- Clear task boundaries
- Specific line number references

### 3. **Self-Contained**
- Each guide is complete for its phase
- No jumping between multiple docs
- Clear prerequisites and next steps

### 4. **Handoff Friendly**
- Easy to pick up where you left off
- Clear success criteria
- Points to next phase when done

---

## What's Different from BUILD_STRATEGY.md?

**BUILD_STRATEGY.md:**
- Comprehensive overview of entire rebuild
- Implementation details for all components
- ~2,000 lines covering all phases
- Reference document

**Phase guides (these files):**
- Focused on ONE phase at a time
- Only essential context
- Actionable steps
- Quick start format

**Use BUILD_STRATEGY.md for:** Planning, understanding overall strategy
**Use phase guides for:** Actually building each phase

---

## Document Maintenance

When updating architecture or design:
1. Update master docs (ARCHITECTURE.md, API_INTERFACES.md, etc.)
2. Update relevant phase guides with new line numbers/content
3. Keep phase guides lean - only include what's needed

---

## Quick Reference

### Updated Action Names (Fire TV)
- `prev` (not prev-view)
- `next` (not next-view)
- `play-pause` (not sleep-toggle)

### Fire TV CSS Rules
- ❌ NO viewport units with transforms
- ❌ NO `-webkit-mask`
- ❌ NO complex filters
- ❌ NO `!important` (except utilities)
- ✅ USE percentages for sizing
- ✅ USE CSS variables for dynamic values
- ✅ USE BEM naming
- ✅ USE simple transitions

### Module Interface (All Modules Must Implement)
```javascript
{
  initialize: async () => {},
  activate: () => {},
  deactivate: () => {},
  destroy: () => {},
  getState: () => {},
  setState: (state) => {}
}
```

### Input Handler Interface (All Modules Must Implement)
```javascript
{
  handleUp: (event) => boolean,
  handleDown: (event) => boolean,
  handleLeft: (event) => boolean,
  handleRight: (event) => boolean,
  handleEnter: (event) => boolean,
  handleEscape: (event) => boolean
}
```

---

## Support

If a phase guide is missing information:
1. Check the referenced master documents (with line numbers provided)
2. Update the phase guide with missing context
3. Keep it focused - only add what's essential

---

**Ready to build? Start with [Phase 2: Dashboard Module](./Phase%202%20-%20Dashboard%20Module.md)!** 🚀
