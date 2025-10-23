# Documentation TODO - Complete List

**Created:** 2025-10-22
**Status:** Partially Complete - Need to finish 2 guides + update CONTRIBUTING.md

---

## ✅ COMPLETED DOCUMENTATION

### Core System Documentation
1. **js/core/initialization/README.md** ✅ COMPLETE
   - 3-phase initialization architecture
   - Platform detection & auth check
   - Authentication flow
   - Core component setup
   - Mobile-specific paths
   - Auth bypass mode
   - Debugging tips

2. **js/widgets/shared/TOUCH_CONTROLS.md** ✅ COMPLETE
   - TouchButton class documentation
   - LongPressDetector class documentation
   - Usage examples
   - Styling & theming
   - Best practices
   - Platform compatibility

3. **js/ui/MOBILE_UI.md** ✅ COMPLETE (but could be expanded)
   - Mobile landing page
   - Loading progress system
   - Mobile vs Desktop differences
   - Settings access on mobile
   - API functions

---

## ⏳ REMAINING DOCUMENTATION TO CREATE

### 1. js/data/services/DASHBOARD_SYNC.md

**Status:** NOT STARTED

**What to document:**

#### Overview
- Real-time synchronization across browser windows/tabs
- Uses Supabase Realtime broadcast channels
- Optimistic update pattern

#### Key Files to Reference
- `js/data/services/dashboard-sync-service.js` - Main sync service
- `js/data/services/heartbeat-service.js` - Dashboard health tracking

#### Topics to Cover

**1. Cross-Dashboard Synchronization**
- How multiple dashboard instances detect each other
- Broadcast channel setup (Supabase Realtime)
- What data is synchronized:
  - Theme changes (instant sync)
  - Settings updates (calendar, photos, interface)
  - Calendar data refresh triggers
  - Photo library updates
  - User authentication state

**2. Broadcast Events**
List and document each event:
- `theme-changed` - Theme selection changed
- `settings-updated` - Settings modified
- `calendar-refreshed` - Calendar data updated
- `photos-updated` - Photo library changed
- `auth-state-changed` - Login/logout

**3. Heartbeat Service**
- Purpose: Track dashboard health and version
- Frequency: 60 seconds
- What it stores:
  - Dashboard ID
  - Version
  - Last active timestamp
  - Metadata
- Database schema: `dashboard_heartbeats` table

**4. Synchronization Patterns**
Document the optimistic update pattern:
```javascript
// Dashboard A changes theme
ThemeApplier.applyTheme('dark');
DashboardSyncService.broadcast('theme-changed', { theme: 'dark' });

// Dashboard B receives broadcast
channel.on('broadcast', { event: 'theme-changed' }, ({ theme }) => {
  ThemeApplier.applyTheme(theme);
  // Updates UI instantly without page reload
});
```

**5. Version Mismatch Detection**
- How version mismatches are detected
- User notification flow
- Refresh prompting

**6. Usage Examples**
- Setting up sync in a new service
- Broadcasting custom events
- Subscribing to events
- Clean up on destroy

**7. Configuration**
- Heartbeat interval (default: 60s)
- Broadcast channel name
- Cleanup strategies for stale heartbeats

**8. Best Practices**
- DO: Use optimistic updates
- DO: Clean up subscriptions on destroy
- DON'T: Broadcast on every keystroke (debounce)
- DON'T: Send large payloads

**9. Troubleshooting**
- Events not syncing
- Heartbeat not updating
- Version mismatch warnings

---

### 2. js/data/services/calendar-services/README.md

**Status:** NOT STARTED

**What to document:**

#### Overview
- Modular calendar service architecture
- Separation of concerns (fetch, process, refresh)
- Multi-account support

#### Key Files to Reference
- `js/data/services/calendar-service.js` - Main orchestrator
- `js/data/services/calendar-services/calendar-fetcher.js` - Data fetching
- `js/data/services/calendar-services/event-processor.js` - Data transformation
- `js/data/services/calendar-services/calendar-refresh-manager.js` - Refresh logic
- `js/data/services/calendar-config-store.js` - Config management

#### Topics to Cover

**1. Architecture Overview**
Explain the modular split:
```
CalendarService (Orchestrator)
    ↓
CalendarFetcher (Data fetching)
    ↓
EventProcessor (Data transformation)
    ↓
CalendarRefreshManager (Refresh logic)
    ↓
CalendarConfigStore (Config persistence)
```

**2. CalendarService (Main Orchestrator)**
- Initialize all sub-services
- Coordinate data flow
- Public API for widgets
- Error handling

**3. CalendarFetcher**
- Fetches events from Google Calendar API
- Handles multiple calendars
- Date range management
- API error handling
- Token refresh coordination

**4. EventProcessor**
- Transform Google Calendar events to Dashie format
- Filter events by criteria
- Sort and group events
- Handle all-day events
- Timezone conversion

**5. CalendarRefreshManager**
- Refresh strategy:
  - Age 0-2 min: Serve cache (fresh)
  - Age 2-5 min: Serve cache + background refresh
  - Age 5+ min: Serve STALE cache + background refresh
- TTL: 5 minutes (configurable in config.js)
- Refresh threshold: 2 minutes
- Background refresh (no loading screen after first fetch)

**6. CalendarConfigStore**
- Store calendar configuration
- Active calendars
- Display preferences
- Sync with database

**7. Caching Strategy**
Document the caching pattern:
```javascript
// Calendar TTL: 5 minutes (configured in config.js)
CALENDAR_CACHE_TTL_MS = 5 * 60 * 1000;

// Start background refresh after 2 minutes
CALENDAR_CACHE_REFRESH_THRESHOLD_MS = 2 * 60 * 1000;
```

**8. Multi-Account Support**
- How multiple Google accounts are handled
- Calendar selection per account
- Token management per account

**9. Data Flow Diagram**
Show the flow from widget request to data delivery

**10. Usage Examples**
- Getting calendar events
- Refreshing calendar data
- Adding a new calendar
- Handling errors

**11. Configuration**
- Cache TTL settings
- Refresh thresholds
- Max events to fetch
- Date range settings

**12. Best Practices**
- DO: Use background refresh
- DO: Show stale cache while refreshing
- DON'T: Block UI for refresh
- DON'T: Fetch without checking cache

**13. Troubleshooting**
- Calendar not loading
- Events not updating
- Cache not expiring
- Multiple refresh calls

---

## 🔄 UPDATES TO EXISTING DOCUMENTATION

### 3. js/ui/MOBILE_UI.md - EXPAND

**Status:** CREATED but SHORT - Needs expansion

**Current state:** Basic overview, covers main functions
**What to add:**

#### Additional Topics

**1. Detailed HTML Structure**
- Complete mobile container breakdown
- CSS classes and their purposes
- Responsive breakpoints

**2. Mobile-Specific CSS**
Document mobile-specific styles:
- `.mobile-mode-active` body class
- Touch-friendly button sizing
- Mobile header styling
- Loading bar animations

**3. Profile Picture & Family Name**
- How they're loaded from settings/auth
- Fallback behavior
- Update flow when settings change

**4. Button Handlers**
Document in detail:
- Settings button (opens modal)
- Logout button (clears session, reloads)
- Button states (disabled during loading)

**5. Integration with Initialization**
Show how mobile UI integrates with the 3-phase init:
```javascript
// Phase 1: Show mobile landing page
if (isMobile) {
  showMobileLandingPage();
  showMobileLoadingBar();
}

// Phase 3: Update progress during init
updateMobileProgress(10, 'Platform detected');
updateMobileProgress(30, 'Authenticating...');
// ... etc
```

**6. Error Handling**
- What happens if mobile container not found
- Fallback to desktop UI
- Error messages to user

**7. Testing Mobile UI**
- How to test on desktop (resize browser)
- How to test on actual mobile devices
- Viewport meta tag requirements
- Touch event testing

**8. Migration Notes**
- How the mobile UI evolved
- Why widgets were skipped
- Future enhancements (potential mobile dashboard)

---

## 📝 FINAL STEP: Update CONTRIBUTING.md

### 4. Update .reference/CONTRIBUTING.md

**Status:** HAS TODO MARKERS - Need to remove them

**What to update:**

#### In Quick Reference Table

**Currently has:**
```markdown
| Understanding initialization | Initialization Flow *(TODO)* | `js/core/initialization/README.md` |
| Working with touch controls | Touch Controls Guide *(TODO)* | `js/widgets/shared/TOUCH_CONTROLS.md` |
| Mobile UI development | Mobile UI Guide *(TODO)* | `js/ui/MOBILE_UI.md` |
| Cross-dashboard sync | Dashboard Sync Guide *(TODO)* | `js/data/services/DASHBOARD_SYNC.md` |
```

**Should be:**
```markdown
| Understanding initialization | Initialization Flow | [`js/core/initialization/README.md`](../js/core/initialization/README.md) |
| Working with touch controls | Touch Controls Guide | [`js/widgets/shared/TOUCH_CONTROLS.md`](../js/widgets/shared/TOUCH_CONTROLS.md) |
| Mobile UI development | Mobile UI Guide | [`js/ui/MOBILE_UI.md`](../js/ui/MOBILE_UI.md) |
| Cross-dashboard sync | Dashboard Sync Guide | [`js/data/services/DASHBOARD_SYNC.md`](../js/data/services/DASHBOARD_SYNC.md) |
| Calendar service architecture | Calendar Services Guide | [`js/data/services/calendar-services/README.md`](../js/data/services/calendar-services/README.md) |
```

#### Add New Sections

After the existing sections (Settings, Theme Overlay, Auth), add:

**## 🚀 Initialization System**
```markdown
### When to read: [`js/core/initialization/README.md`](../js/core/initialization/README.md)

**Read this guide when you are:**
- Understanding the 3-phase initialization flow
- Adding new initialization steps
- Debugging startup issues
- Working with platform-specific initialization
- Implementing auth bypass for development

**DO NOT:**
- Skip phases in initialization
- Block on non-critical initialization
- Assume all widgets will load successfully

**Key principle:** Initialization is platform-aware (mobile vs desktop), supports auth bypass, and loads progressively with visual feedback.
```

**## 📱 Mobile & Touch**
```markdown
### When to read: [`js/ui/MOBILE_UI.md`](../js/ui/MOBILE_UI.md) and [`js/widgets/shared/TOUCH_CONTROLS.md`](../js/widgets/shared/TOUCH_CONTROLS.md)

**Read these guides when you are:**
- Working on mobile interface
- Adding touch controls to widgets
- Implementing long-press gestures
- Testing on mobile devices

**Key principles:**
- Mobile skips dashboard grid (Settings only)
- Touch controls supplement D-pad (not replace)
- TouchButton auto-themes via CSS variables
- LongPressDetector for secondary actions (focus mode)
```

**## 🔄 Cross-Dashboard Sync**
```markdown
### When to read: [`js/data/services/DASHBOARD_SYNC.md`](../js/data/services/DASHBOARD_SYNC.md)

**Read this guide when you are:**
- Adding features that should sync across windows
- Working with real-time updates
- Implementing heartbeat tracking
- Debugging sync issues

**Key principle:** Use optimistic updates (update local immediately, broadcast to others, write to DB async).
```

**## 📅 Calendar Services**
```markdown
### When to read: [`js/data/services/calendar-services/README.md`](../js/data/services/calendar-services/README.md)

**Read this guide when you are:**
- Working with calendar data
- Modifying calendar refresh logic
- Adding calendar providers
- Understanding the caching strategy

**Key principle:** Modular architecture (fetcher, processor, refresh manager) with background refresh to avoid blocking UI.
```

---

## 📋 EXECUTION CHECKLIST

For the next Claude session, complete these tasks in order:

### Step 1: Create DASHBOARD_SYNC.md
- [ ] Read `js/data/services/dashboard-sync-service.js`
- [ ] Read `js/data/services/heartbeat-service.js`
- [ ] Create comprehensive guide covering all topics listed above
- [ ] Include code examples
- [ ] Add troubleshooting section

### Step 2: Create calendar-services/README.md
- [ ] Read all files in `js/data/services/calendar-services/`
- [ ] Read `js/data/services/calendar-service.js`
- [ ] Read `js/data/services/calendar-config-store.js`
- [ ] Create comprehensive guide covering all topics listed above
- [ ] Include architecture diagram (text-based)
- [ ] Document caching strategy in detail
- [ ] Add usage examples

### Step 3: Expand MOBILE_UI.md
- [ ] Read `js/ui/mobile-ui.js` completely
- [ ] Check HTML structure in `index.html` for mobile elements
- [ ] Add all additional topics listed above
- [ ] Include CSS documentation
- [ ] Add testing guide

### Step 4: Update CONTRIBUTING.md
- [ ] Remove all `*(TODO)*` markers from quick reference table
- [ ] Make all paths clickable markdown links
- [ ] Add new sections for:
  - Initialization System
  - Mobile & Touch
  - Cross-Dashboard Sync
  - Calendar Services
- [ ] Update "Finding Documentation" section to reference new guides

### Step 5: Verify All Links
- [ ] Test all markdown links work
- [ ] Verify paths are correct (relative from CONTRIBUTING.md location)
- [ ] Check cross-references between documents

---

## 📚 DOCUMENTATION STANDARDS TO FOLLOW

When creating the remaining guides, follow these patterns from the completed guides:

### Structure
1. **Title + Location** at top
2. **Overview** section (what it is, why it exists)
3. **Key Concepts** or **Architecture** section
4. **Detailed Topics** (main content)
5. **Usage Examples** with code
6. **Configuration** section
7. **Best Practices** (DO/DON'T lists)
8. **Troubleshooting** section
9. **Related Documentation** links
10. **Summary** at end

### Style
- Use code blocks with language hints: ```javascript
- Include inline code with backticks: `functionName()`
- Use tables for comparisons
- Use emoji sparingly (only in headings if at all)
- Include file paths: `js/path/to/file.js`
- Use ✅ ❌ for DO/DON'T lists

### Code Examples
- Show complete, working examples
- Include comments explaining key parts
- Demonstrate common use cases
- Show both simple and complex examples

### Length
- Aim for 200-400 lines per guide
- Be comprehensive but concise
- Break complex topics into subsections
- Use tables and diagrams (text-based) where helpful

---

## 🎯 ESTIMATED TIME

- **DASHBOARD_SYNC.md:** 1-1.5 hours
- **calendar-services/README.md:** 1.5-2 hours (most complex)
- **MOBILE_UI.md expansion:** 30-45 minutes
- **CONTRIBUTING.md updates:** 15-20 minutes
- **Link verification:** 10 minutes

**Total: ~4-5 hours of focused work**

---

## ✨ SUCCESS CRITERIA

Documentation will be complete when:
1. ✅ All 5 guides exist and are comprehensive
2. ✅ No TODO markers remain in CONTRIBUTING.md
3. ✅ All markdown links work correctly
4. ✅ Each guide follows the standard structure
5. ✅ Code examples are complete and runnable
6. ✅ Cross-references between documents are accurate
7. ✅ CONTRIBUTING.md quick reference table is 100% complete

---

## 📖 REFERENCE MATERIALS

Point the next Claude session to these completed guides as examples:

**Excellent structure examples:**
- `js/core/initialization/README.md` - Comprehensive, well-organized
- `js/widgets/shared/TOUCH_CONTROLS.md` - Great API documentation + examples
- `js/modules/Settings/SETTINGS_PAGE_BASE_GUIDE.md` - Framework documentation pattern
- `js/ui/themes/THEME_OVERLAY.md` - Architecture + config pattern

**Cross-reference examples:**
- See how guides link to each other in "Related Documentation"
- See how CLAUDE.md links to guides in "Documentation Quick Links"
- See how CONTRIBUTING.md routes to guides in "Quick Reference"

---

## 🚀 READY TO EXECUTE

This TODO file provides everything needed for the next Claude session to:
1. Know exactly what to create
2. Understand the required content for each guide
3. Follow consistent patterns from existing docs
4. Complete the documentation system

Hand this file to the next session and they'll have full context!
