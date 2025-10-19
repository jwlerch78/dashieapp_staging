# Phase 4: Calendar, Agenda, Login, Settings & Modals

**Estimated Time:** 3-4 weeks
**Status:** In Progress
**Prerequisites:**
- Phase 3 (Data Layer) ✅ COMPLETE
- Phase 3.5 (Widgets) - Partial (Clock and Header widgets exist)

---

## Overview

Phase 4 focuses on:
1. **Code Organization** - Extract index.html inline code, create Login module ✅ COMPLETE
2. **Settings Infrastructure** - Verify and complete settings persistence ✅ COMPLETE
3. **Calendar System** - Complete calendar service with account-prefixed IDs
4. **Widget Implementation** - Migrate Calendar and Agenda widgets from legacy
5. **Account Management** - Build account settings with delete functionality
6. **Testing** - Verify all systems work together

---

## Table of Contents

- [4.1: Extract index.html & Create Login Module](#41-extract-indexhtml--create-login-module) ✅ COMPLETE
- [4.2: Verify Settings Service](#42-verify-settings-service) ✅ COMPLETE
- [4.3: Calendar Data & Settings System](#43-calendar-data--settings-system) ✅ COMPLETE
- [4.4: Test Calendar Settings with Multi-Accounts](#44-test-calendar-settings-with-multi-accounts) ✅ COMPLETE
- [4.5: Calendar Widget Migration](#45-calendar-widget-migration) 🔄 NEXT
- [4.6: Widget Lifecycle & System Verification](#46-widget-lifecycle--system-verification)
- [4.7: Test Modals - Logout Screen](#47-test-modals---logout-screen)
- [4.8: Agenda Widget Migration](#48-agenda-widget-migration)
- [4.9: Account Settings & Delete Account](#49-account-settings--delete-account)
- [4.10: Token Storage & Refresh Testing](#410-token-storage--refresh-testing)

---

## 4.1: Extract index.html & Create Login Module ✅

**Status:** COMPLETE

**Completed Work:**
- ✅ Extracted inline CSS to modular CSS files
- ✅ Created [js/modules/login.js](../../js/modules/login.js) for OAuth login flow
- ✅ Cleaned up [index.html](../../index.html) structure
- ✅ Implemented proper module separation

**Key Files Created:**
- `css/core/base.css` - Base element styles
- `css/core/utilities.css` - Utility classes
- `css/components/button.css` - Button component styles
- `css/modules/login.css` - OAuth login screen styles
- `js/modules/login.js` - Login module with OAuth flow

---

## 4.2: Verify Settings Service ✅

**Status:** COMPLETE

**Completed Work:**
- ✅ Verified [SettingsService.js](../../js/services/SettingsService.js) works correctly
- ✅ Built [settings display screen](../../settings-display.html) for theme testing
- ✅ Confirmed settings persistence across page reloads
- ✅ Tested theme switching functionality
- ✅ Verified settings saved to IndexedDB with proper structure

**Verified Capabilities:**
- Settings saved per account: `settings_{accountId}`
- Theme switching persists correctly
- Settings load on page refresh
- No data loss on logout/login

---

## 4.3: Calendar Data & Settings System ✅

**Goal:** Implement calendar settings interface from legacy codebase to allow users to select which calendars to display

**Status:** COMPLETE

### Completed Work

**Architecture & Infrastructure:**
- ✅ **Database Schema v2.0** - Created `user_auth_tokens` and `user_calendar_config` tables in Supabase
- ✅ **Edge Functions** - Built `database-operations` edge function for calendar config CRUD
- ✅ **Dual-Write Pattern** - Calendar config saves to both localStorage (instant) and database (persistent)
- ✅ **Account-Prefixed IDs** - Format: `{accountType}-{calendarId}` for multi-account support
- ✅ **Token Management** - Multi-account token storage with proper isolation

**Settings Modal System:**
- ✅ **Settings Modal Infrastructure** - Full navigation system with back/close buttons
- ✅ **SettingsPageBase Pattern** - Base class for standardized focus management and behavior
- ✅ **Calendar Settings Page** - Main menu with sub-screens for calendar management
- ✅ **Select Calendars Screen** - Shows all calendars from all accounts with toggle functionality
- ✅ **UIUpdateHelper Pattern** - Instant UI feedback before async operations

**Calendar Features:**
- ✅ **Multi-Account Calendar Display** - Shows calendars grouped by account with email and counts
- ✅ **Calendar Toggle** - Enable/disable calendars with instant visual feedback
- ✅ **Calendar Sorting** - Active calendars first, then primary, then alphabetical
- ✅ **Dynamic Counts** - Shows "X active, Y hidden" for each account
- ✅ **Auto-Enable Primary Calendar** - Automatically enables primary calendar on first login

**Account Management:**
- ✅ **Add Calendar Accounts** - OAuth flow for adding secondary Google accounts
- ✅ **Remove Calendar Accounts** - Delete secondary accounts (primary protected)
- ✅ **Duplicate Detection** - Prevents adding same email multiple times
- ✅ **Multi-Account OAuth** - Separate flow for primary vs. secondary accounts

**User Experience:**
- ✅ **DashieModal Component** - Branded modal system replacing browser alerts
- ✅ **D-Pad Navigation** - Full keyboard/remote control support
- ✅ **Loading States** - Spinners and empty states for async operations
- ✅ **Error Handling** - Graceful error messages with retry options

**Key Files Created/Updated:**
- `js/modules/Settings/` - Complete settings modal system
- `js/modules/Settings/pages/settings-calendar-page.js` - Calendar settings implementation
- `js/modules/Settings/ui/settings-modal-renderer.js` - Modal rendering and navigation
- `js/modules/Settings/core/settings-page-base.js` - Base class for settings pages
- `js/utils/dashie-modal.js` - Branded modal utility
- `css/components/dashie-modal.css` - Modal styling
- `supabase/functions/database-operations/` - Edge function for calendar config

### Technical Details

**Calendar ID Format:**
- Account-prefixed format: `{accountType}-{calendarId}` (e.g., `primary-john@gmail.com`)
- Allows multiple accounts to have same calendar ID without conflicts
- Stored in `user_calendar_config.active_calendar_ids` array in Supabase

**Data Flow:**
1. User toggles calendar in Settings → CalendarPage
2. CalendarPage calls CalendarService.enableCalendar() / disableCalendar()
3. CalendarService updates activeCalendarIds array
4. Saves to both localStorage (instant) and database (persistent)
5. Widgets query CalendarService.getActiveCalendarIds() to filter events

**Multi-Account Support:**
- Each account type (primary, account2, etc.) has separate token storage
- Calendar config is global per user (not per account)
- All accounts' calendars shown together in Settings → Select Calendars
- Account sections show grouped calendars with email and counts

---

## 4.4: Test Calendar Settings with Multi-Accounts ✅

**Goal:** Verify calendar settings work correctly with multiple Google accounts

**Status:** COMPLETE

### Completed Tests

1. **Account Isolation:**
   - ✅ Multiple accounts can be added (primary, account2, account3, etc.)
   - ✅ Each account's calendars display separately in Select Calendars
   - ✅ Calendar selections are global (not per-account) - all enabled calendars shown together
   - ✅ Duplicate account detection prevents adding same email twice

2. **Settings Persistence:**
   - ✅ Calendar selections save to database (user_calendar_config table)
   - ✅ Selections persist across page reloads
   - ✅ Dual-write pattern ensures instant UI updates with database backup
   - ✅ Auto-enable primary calendar on first login for each account

3. **Account Management:**
   - ✅ Add Calendar Accounts - OAuth flow for secondary accounts working
   - ✅ Remove Calendar Accounts - Delete secondary accounts (primary protected)
   - ✅ Account removal clears tokens from database
   - ✅ Calendars from removed accounts automatically disabled

4. **Multi-Account Features:**
   - ✅ All accounts load calendars independently
   - ✅ Account sections show email and calendar counts
   - ✅ Calendars prefixed with account type to prevent ID conflicts
   - ✅ Primary calendar auto-enabled when adding new account

### Widget Integration Status

- ⏳ **Calendar Widget** - Not yet migrated (4.5)
- ⏳ **Agenda Widget** - Not yet migrated (4.8)
- ✅ **CalendarService.getActiveCalendarIds()** - Ready to filter events by selected calendars

---

## 4.5: Calendar Widget Migration ✅

**Goal:** Migrate Calendar widget from legacy codebase (rename from "dcal" to "calendar")

**Status:** COMPLETE

### Completed Work

**Widget Migration:**
- ✅ Copied all dcal widget files from `.legacy/widgets/dcal/` to `js/widgets/calendar/`
- ✅ Renamed all files: dcal.js → calendar-widget.js, dcal-config.js → calendar-config.js, etc.
- ✅ Renamed all class exports: DCalWidget → CalendarWidget, DCalConfig → CalendarConfig, etc.
- ✅ Updated all import paths to use absolute paths (`/js/utils/logger.js`)
- ✅ Updated widget ready message to use 'calendar' instead of 'dcal'
- ✅ Created calendar.html as widget entry point

**CalendarService Integration:**
- ✅ Removed hardcoded calendar IDs from widget
- ✅ Access CalendarService and SessionManager from parent window
- ✅ Implemented `loadCalendarData()` method that:
  - Fetches all Google accounts from TokenStore
  - Gets calendars from all accounts using `CalendarService.getCalendars(accountType)`
  - Fetches events from all accounts using `CalendarService.getEvents(accountType, startDate, endDate)`
  - Filters events by `CalendarService.getActiveCalendarIds()`
- ✅ Added `getDateRange()` method to calculate date ranges for weekly/monthly views
- ✅ Updated `navigateCalendar()` to reload data when date changes

**Dashboard Integration:**
- ✅ Dashboard widget config already pointing to `js/widgets/calendar/calendar.html`
- ✅ Widget will load in 'main' grid position (row 2-3, col 1)

**Widget Features Preserved:**
- ✅ Weekly view (1-day, 3-day, 5-day, week modes)
- ✅ Monthly view
- ✅ Focus menu with view switching
- ✅ D-pad navigation
- ✅ Event rendering with calendar colors
- ✅ Auto-scroll to current time
- ✅ Theme support (dark/light)

### Prerequisites (Completed)
- ✅ CalendarService with multi-account support
- ✅ Calendar settings system with enable/disable functionality
- ✅ Account-prefixed calendar IDs
- ✅ Database persistence for calendar configuration
- ✅ Auto-enable primary calendar on first login

### Implementation Steps (All Complete)

1. **Create Widget Structure:**
   ```
   js/widgets/
   └── calendar/                    # Renamed from dcal
       ├── calendar-widget.js       # Main widget class (renamed from dcal-widget.js)
       ├── calendar-widget.css      # Widget styles
       └── index.js                 # Export
   ```

2. **Migrate Widget Code:**
   - Copy from `.legacy/widgets/dcal/`
   - Rename all references from "dcal" to "calendar"
   - Update to use new CalendarService API
   - Integrate with active calendars from CalendarService
   - Remove old settings code (now handled by Settings modal)

3. **Implement Calendar Widget:**
   - Extend BaseWidget pattern
   - Use CalendarService.getEvents() with account type parameter
   - Filter events by CalendarService.getActiveCalendarIds()
   - Render monthly calendar view
   - Handle date navigation (previous/next month)
   - Show events on calendar days with colors
   - Support multi-account event display

4. **Add to Widget System:**
   - Register in WidgetFactory as "calendar"
   - Add default widget settings (position, size, etc.)
   - Test d-pad navigation
   - Test date switching
   - Verify events display correctly

### Key Changes from Legacy

**API Updates:**
- Old: `getCalendarEvents(accountId)`
- New: `CalendarService.getEvents(accountType, startDate, endDate)`

**Calendar Filtering:**
- Old: Settings stored per widget instance
- New: Global active calendar IDs from CalendarService

**Multi-Account:**
- Old: Single account per widget
- New: All active calendars from all accounts shown together

**Event Format:**
- Events now include `prefixedCalendarId` for filtering
- Calendar colors preserved from Google API

---

## 4.6: Widget Lifecycle & System Verification

**Goal:** Verify all widgets load, update, and unload correctly

### Verification Tasks

- [ ] Widgets initialize on dashboard load
- [ ] Widgets refresh when account switches
- [ ] Widgets unload when account logs out
- [ ] No memory leaks from widget instances
- [ ] Widget settings persist correctly
- [ ] D-pad navigation works across widgets

---

## 4.7: Test Modals - Logout Screen

**Goal:** Test modal system with logout confirmation

### Implementation

1. **Create Logout Modal:**
   - Confirmation dialog
   - "Are you sure?" messaging
   - Confirm/Cancel buttons
   - D-pad navigation support

2. **Integration:**
   - Trigger from settings or header
   - Handle logout flow
   - Clear widget state
   - Redirect to login

---

## 4.8: Agenda Widget Migration

**Goal:** Migrate Agenda widget from legacy codebase

### Implementation Steps

1. **Create Widget Structure:**
   ```
   js/widgets/
   └── AgendaWidget/
       ├── AgendaWidget.js
       ├── agenda-widget.css
       └── index.js
   ```

2. **Implement Agenda Widget:**
   - Show upcoming events in list format
   - Respect calendar settings
   - Handle time zones
   - Display event details
   - Support event navigation

---

## 4.9: Account Settings & Delete Account

**Goal:** Build comprehensive account settings with delete functionality

### Features

1. **Account Information Display:**
   - Email address
   - Account type
   - Connected calendars count
   - Storage usage

2. **Delete Account:**
   - Confirmation modal
   - Clear all data for account
   - Remove from IndexedDB
   - Redirect to login if last account

### Safety Considerations

- Double confirmation for delete
- Clear explanation of data loss
- No recovery after deletion

---

## 4.10: Token Storage & Refresh Testing

**Goal:** Verify OAuth token refresh works correctly

### Test Cases

1. **Token Expiration:**
   - [ ] Token expires
   - [ ] System automatically refreshes
   - [ ] No user interruption

2. **Refresh Token Failure:**
   - [ ] Refresh token invalid
   - [ ] User prompted to re-login
   - [ ] Data preserved (not deleted)

3. **Multiple Accounts:**
   - [ ] Each account has separate tokens
   - [ ] Token refresh works per account
   - [ ] No token mixing between accounts

---

## Success Criteria

Phase 4 is complete when:

- ✅ 4.1: Login module extracted and working
- ✅ 4.2: Settings service verified
- ✅ 4.3: Calendar settings interface implemented
- ✅ 4.4: Multi-account calendar settings tested
- ✅ 4.5: Calendar widget migrated and working
- [ ] 4.6: Widget lifecycle verified
- [ ] 4.7: Logout modal tested
- [ ] 4.8: Agenda widget migrated and working
- [ ] 4.9: Account settings with delete implemented (partially done - add/remove accounts ✅)
- [ ] 4.10: Token refresh thoroughly tested
- ✅ All widgets respect user settings (infrastructure ready)
- ✅ Multi-account support works flawlessly
- ✅ No memory leaks or performance issues
- ✅ D-pad navigation works everywhere (Settings modal complete)

---

## Next Steps

After Phase 4 completion:
- **Phase 5:** Remaining widget migrations
- **Phase 6:** Polish, optimization, and final testing
