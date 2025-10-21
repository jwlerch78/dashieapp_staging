# Dashie Development Guide

**Before implementing or modifying features, consult the relevant guide below.**

This document routes you to the appropriate technical guides for different types of work in the Dashie codebase.

---

## 📋 Quick Reference

| Task | Guide to Read | Location |
|------|---------------|----------|
| Adding/modifying Settings pages | Settings Page Base Guide | `js/modules/Settings/SETTINGS_PAGE_BASE_GUIDE.md` |
| Working with theme overlays | Theme Overlay Documentation | `js/themes/THEME_OVERLAY.md` |
| Implementing device flow auth | Hybrid Device Flow Guide | `js/data/auth/HYBRID_DEVICE_FLOW.md` |
| Adding new widgets | (TODO: Create widget guide) | - |
| Working with calendar integration | (TODO: Create calendar guide) | - |

---

## 🎨 Settings Module

### When to read: `js/modules/Settings/SETTINGS_PAGE_BASE_GUIDE.md`

**Read this guide when you are:**
- Adding a new settings page
- Adding sub-screens to existing settings pages
- Modifying selection behavior (click, enter, d-pad)
- Implementing toggle switches or multi-select items
- Debugging focus issues in settings

**DO NOT:**
- Hard-code selection handlers in `settings-modal-renderer.js`
- Add special-case logic to the input handler
- Create custom focus management without consulting the guide

**Key principle:** Settings pages should extend `SettingsPageBase` and implement `handleItemClick()` for custom behavior. The renderer delegates to the page - it should NOT contain page-specific logic.

---

## 🎃 Theme Overlay System

### When to read: `js/themes/THEME_OVERLAY.md`

**Read this guide when you are:**
- Creating new seasonal theme overlays
- Adding animated decorations to themes
- Modifying overlay positioning or animation
- Implementing new visibility patterns (periodic, rotating)
- Adding animation level controls

**DO NOT:**
- Modify `theme-overlay-applier.js` without understanding the architecture
- Create theme-specific logic outside of configuration files
- Hard-code overlay elements in theme files

**Key principle:** Overlay engine (`theme-overlay-applier.js`) is generic. Theme-specific configurations (`theme-overlay-halloween.js`) define what to show. Keep them separate.

---

## 🔐 Authentication

### When to read: `js/data/auth/HYBRID_DEVICE_FLOW.md`

**Read this guide when you are:**
- Implementing OAuth device flow
- Modifying authentication flows
- Adding new OAuth providers
- Working with token refresh logic

---

## 📝 General Coding Principles

### Before Writing Code

1. **Search for existing patterns** - If a similar feature exists, follow the same pattern
2. **Read the relevant guide** - Use the quick reference above to find it
3. **Check for base classes** - Many features extend base classes (SettingsPageBase, etc.)
4. **Look at recent examples** - Find a similar recent implementation and match its style

### When Modifying Existing Code

1. **Understand the architecture first** - Don't patch without understanding
2. **Check for guides** - There may be documentation explaining the pattern
3. **Look for TODO comments** - They often explain why things are done a certain way
4. **Preserve existing patterns** - Don't introduce new patterns unless necessary

### Anti-Patterns to Avoid

❌ **Hard-coding page-specific logic in renderers/orchestrators**
- Violates separation of concerns
- Makes code hard to maintain
- Use delegation instead

❌ **Creating special cases in input handlers**
- Makes the codebase inconsistent
- Hard to discover which pages have special behavior
- Use base class methods instead

❌ **Modifying core systems without reading guides**
- High risk of breaking existing functionality
- May miss important architectural decisions
- Leads to technical debt

---

## 🔍 Finding Documentation

### In-Code Documentation
- Most modules have JSDoc comments explaining parameters and return values
- Look for `@param`, `@returns`, `@example` tags

### Architecture Documentation
- Check for `.md` files in module directories
- Look in the module's parent directory (e.g., `js/modules/Settings/`)
- Check for `GUIDE`, `README`, or `ARCHITECTURE` files

### When Documentation is Missing
- Look at existing implementations of similar features
- Check git history for recent changes (`git log --all -- path/to/file`)
- Add documentation after implementing (help future developers!)

---

## 📐 Code Style

### File Organization
```
js/
├── core/           # Core application logic (initialization, app-comms)
├── data/           # Data layer (API clients, database)
├── modules/        # Feature modules (Settings, Calendar, Photos)
├── themes/         # Theme system (registry, overlays)
├── ui/             # UI components (modals, overlays)
├── utils/          # Utilities (logger, formatters)
└── widgets/        # Widget implementations
```

### Naming Conventions
- **Classes:** PascalCase (`ThemeApplier`, `SettingsPageBase`)
- **Files:** kebab-case (`theme-applier.js`, `settings-page-base.js`)
- **Methods:** camelCase (`handleClick`, `applyTheme`)
- **Constants:** UPPER_SNAKE_CASE (`DEFAULT_THEME`, `API_BASE_URL`)

### Logger Usage
```javascript
import { createLogger } from '../utils/logger.js';
const logger = createLogger('MyModule');

logger.verbose('Detailed debug info');  // Development only
logger.debug('Debug information');       // Debugging
logger.info('Important state change');   // Normal operation
logger.success('Operation completed');   // Success feedback
logger.warn('Unexpected but handled');   // Warnings
logger.error('Failed operation', error); // Errors
```

---

## 🧪 Testing Changes

### Before Committing
- [ ] Test with d-pad navigation
- [ ] Test with enter/select button
- [ ] Test with mouse clicks
- [ ] Test with keyboard (arrow keys, enter, escape)
- [ ] Check console for errors/warnings
- [ ] Verify changes work across all relevant themes
- [ ] Test edge cases (empty states, errors, etc.)

### Settings Module Specific
- [ ] Test navigation flow (forward and back)
- [ ] Verify focus highlights correctly
- [ ] Test toggle switches work
- [ ] Confirm settings persist (check localStorage/database)
- [ ] Test with reduced motion preference enabled

---

## 🚀 Deployment

### Committing Changes
- Use clear, descriptive commit messages
- Reference related issues/features
- Keep commits focused (one feature/fix per commit)

### Code Review Checklist
- [ ] Read relevant guide before reviewing
- [ ] Check if new patterns match existing patterns
- [ ] Verify proper use of base classes
- [ ] Look for hard-coded logic that should be configurable
- [ ] Check for missing documentation

---

## 📚 Adding New Documentation

If you create a new feature area that needs documentation:

1. Create a `.md` file in the relevant module directory
2. Follow the structure of existing guides (Overview, Examples, Anti-patterns)
3. Update this `CONTRIBUTING.md` file to reference your new guide
4. Add inline JSDoc comments to your code

**Good guide sections:**
- Overview (what is this system?)
- When to use (clear use cases)
- Quick start (minimal working example)
- Common patterns (how to do common tasks)
- Anti-patterns (what NOT to do)
- Complete examples (real implementations)

---

## 💡 Questions?

If you can't find documentation for what you're working on:
1. Look for similar existing code
2. Check git blame to see who last worked on it
3. Add documentation after you figure it out
4. Update this guide if a new documentation file is needed

**Remember:** Good documentation prevents bugs. Take time to read guides before implementing features.
