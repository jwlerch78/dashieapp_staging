# Dashie Reference Documentation

**Last Updated:** 2025-10-22

This directory contains reference documentation, build plans, and archived development notes for the Dashie project.

---

## 📚 Core Documentation

### Getting Started
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - **Start here!** Developer routing guide to find the right documentation for your task

### Architecture & Design
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture (v3.0, Phase 5.5+ complete)
- **[API_INTERFACES.md](API_INTERFACES.md)** - Component API contracts and interfaces
- **[FEATURE_ROADMAP.md](FEATURE_ROADMAP.md)** - Planned features and enhancements

### Database
- **[DATABASE_SCHEMA.md](../supabase/DATABASE_SCHEMA.md)** - Database schema reference (moved inline with Supabase code)

---

## 🗺️ Build Plans

Future development phases and feature plans:

**Directory:** [build-plans/](build-plans/)

- **[phase-6-refactoring.md](build-plans/phase-6-refactoring.md)** - Code refactoring and optimization
- **[phase-7-testing-polish.md](build-plans/phase-7-testing-polish.md)** - Testing framework and polish
- **[ios-app-development-guide.md](build-plans/ios-app-development-guide.md)** - iOS app development plan
- **[voice-ai-assistant-plan.md](build-plans/voice-ai-assistant-plan.md)** - Voice assistant integration
- **[voice-ai-assistant-plan-phase-0.md](build-plans/voice-ai-assistant-plan-phase-0.md)** - Voice assistant phase 0

---

## 🧪 Testing Guides

Testing documentation and guides:

**Directory:** [testing-guides/](testing-guides/)

- **[offline-mode-testing.md](testing-guides/offline-mode-testing.md)** - Offline mode testing and console commands

---

## 📦 Archives

Historical documentation, completed build plans, and development notes:

**Directory:** [.archives/](.archives/)

### What's Archived:
- Completed build plans (Phase 2-5.5)
- Development session notes
- Implementation guides for completed features
- Phase verification checklists
- Historical architecture documents
- Completed feature documentation

**Note:** Archives are kept for historical reference and context but are no longer actively maintained.

---

## 📖 Documentation Elsewhere

### Inline Code Documentation

Documentation that lives with the code:

- **[CLAUDE.md](../CLAUDE.md)** - Project overview for AI assistant
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Contribution guidelines
- **[js/data/auth/HYBRID_DEVICE_FLOW.md](../js/data/auth/HYBRID_DEVICE_FLOW.md)** - Hybrid device authentication
- **[js/modules/Settings/SETTINGS_PAGE_BASE_GUIDE.md](../js/modules/Settings/SETTINGS_PAGE_BASE_GUIDE.md)** - Settings page framework
- **[js/modules/Settings/core/README.md](../js/modules/Settings/core/README.md)** - Settings screen registry
- **[js/ui/themes/THEME_OVERLAY.md](../js/ui/themes/THEME_OVERLAY.md)** - Theme overlay system
- **[js/widgets/WIDGETS_README.md](../js/widgets/WIDGETS_README.md)** - Widget development guide
- **[js/modules/Modals/README.md](../js/modules/Modals/README.md)** - Modal system
- **[supabase/functions/EDGE_FUNCTIONS.md](../supabase/functions/EDGE_FUNCTIONS.md)** - Edge function documentation

---

## 🔍 Finding Documentation

### By Topic

**Authentication:**
- [Hybrid Device Flow](../js/data/auth/HYBRID_DEVICE_FLOW.md)
- [Architecture - Auth System](ARCHITECTURE.md#authentication--jwt-system)

**Settings:**
- [Settings Page Guide](../js/modules/Settings/SETTINGS_PAGE_BASE_GUIDE.md)
- [Settings Screen Registry](../js/modules/Settings/core/README.md)

**Themes:**
- [Theme Overlay System](../js/ui/themes/THEME_OVERLAY.md)
- [Architecture - Theme System](ARCHITECTURE.md#theme-system)

**Widgets:**
- [Widget Development Guide](../js/widgets/WIDGETS_README.md)
- [Architecture - Widgets Layer](ARCHITECTURE.md#widgets-layer)

**Database:**
- [Database Schema](../supabase/DATABASE_SCHEMA.md)
- [Feature Roadmap - Database Tables](FEATURE_ROADMAP.md#database-tables-roadmap)

**Testing:**
- [Offline Mode Testing](testing-guides/offline-mode-testing.md)

---

## 📝 Documentation Guidelines

### When to Use .reference/

Use `.reference/` for:
- ✅ System architecture and design documents
- ✅ Future build plans and roadmaps
- ✅ API contracts and interfaces
- ✅ Testing strategies and guides
- ✅ Historical archives

### When to Use Inline Documentation

Use inline `.md` files next to code for:
- ✅ Component-specific documentation
- ✅ Implementation guides
- ✅ Feature-specific architecture
- ✅ Usage examples and tutorials

### Documentation Standards

- Use lowercase with hyphens for filenames: `phase-6-refactoring.md`
- Keep docs focused (200-400 lines)
- Link to related documentation
- Update "Last Updated" dates
- Move completed items to archives

---

## 🎯 Current Status

**Phase:** 5.5+ Complete - Production Ready

**Recent Updates:**
- Architecture updated to v3.0 (2025-10-22)
- Database schema moved inline with Supabase code
- Development notes archived
- Build plans reorganized (future phases only)
- Feature roadmap consolidated

**Next Phase:** Phase 6 - Refactoring & Optimization

---

**Questions?** See [CLAUDE.md](../CLAUDE.md) for project overview or [ARCHITECTURE.md](ARCHITECTURE.md) for detailed system architecture.
