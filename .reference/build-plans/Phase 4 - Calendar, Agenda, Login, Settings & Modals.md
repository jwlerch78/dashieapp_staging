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
- [4.3: Calendar Data & Settings System](#43-calendar-data--settings-system) 🔄 IN PROGRESS
- [4.4: Test Calendar Settings with Multi-Accounts](#44-test-calendar-settings-with-multi-accounts)
- [4.5: Calendar Widget Migration](#45-calendar-widget-migration)
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

## 4.3: Calendar Data & Settings System 🔄

**Goal:** Implement calendar settings interface from legacy codebase to allow users to select which calendars to display

**Status:** IN PROGRESS

### Current State

**What We Have:**
- ✅ [CalendarService.js](../../js/services/CalendarService.js) - Fetches calendar lists and events from Google Calendar API
- ✅ Calendar data stored in IndexedDB: `calendar_list_{accountId}`, `calendar_events_{accountId}`
- ✅ [SettingsService.js](../../js/services/SettingsService.js) - Generic settings persistence
- ✅ Settings UI pattern working (theme switcher in settings-display.html)

**What We Need:**
- Calendar settings interface to select which calendars to show
- UI to display available calendars with checkboxes
- Settings to persist selected calendar IDs
- Calendar/Agenda widgets to respect these settings when displaying events

### Legacy Calendar Settings Reference

The legacy codebase has a working calendar settings interface at:
- **Settings UI:** `.reference/.archives/widgets/legacy_settings_widget_20250118_225633/legacy_settings.js:152-399`
- **Settings Data Interaction:** Same file, lines showing calendar list fetching and UI building

**Key Features from Legacy:**
1. **Calendar List Display** - Shows all available calendars with colored indicators
2. **Multi-Select Interface** - Checkboxes to enable/disable calendars
3. **Persistence** - Saves selected calendar IDs to settings
4. **Color Coding** - Visual indicators matching Google Calendar colors
5. **Loading States** - Spinner while fetching calendar data

### Implementation Plan

#### Step 1: Add Calendar Settings to Settings Service

**Update SettingsService.js to include calendar settings:**

```javascript
// In SettingsService.js
getDefaultSettings() {
  return {
    theme: 'dark',
    language: 'en',
    // Add calendar settings
    calendar: {
      selectedCalendarIds: [], // Array of calendar IDs to display
      lastUpdated: null
    }
  };
}

// Add helper methods
async getSelectedCalendars(accountId) {
  const settings = await this.getSettings(accountId);
  return settings.calendar?.selectedCalendarIds || [];
}

async setSelectedCalendars(accountId, calendarIds) {
  const settings = await this.getSettings(accountId);
  settings.calendar = {
    selectedCalendarIds: calendarIds,
    lastUpdated: new Date().toISOString()
  };
  await this.saveSettings(accountId, settings);
}
```

#### Step 2: Create Calendar Settings UI Component

**Create new file:** `js/modules/settings/CalendarSettings.js`

This module should:
1. Fetch calendar list from CalendarService
2. Build UI showing all calendars with checkboxes
3. Load current selections from SettingsService
4. Save selections when user changes them
5. Handle loading states and errors

**UI Structure:**
```html
<div class="settings-section">
  <h3>Calendar Selection</h3>
  <p class="settings-description">Choose which calendars to display</p>

  <div id="calendar-list-loading" class="loading-state">
    <div class="spinner"></div>
    <p>Loading calendars...</p>
  </div>

  <div id="calendar-list-content" class="hidden">
    <!-- Dynamically generated calendar checkboxes -->
    <div class="calendar-item">
      <input type="checkbox" id="cal-xxx" value="calendar-id">
      <span class="calendar-color" style="background-color: #..."></span>
      <label for="cal-xxx">Calendar Name</label>
    </div>
  </div>

  <div id="calendar-list-error" class="error-state hidden">
    <p>Failed to load calendars</p>
    <button id="retry-calendars">Retry</button>
  </div>
</div>
```

**Key Methods:**
```javascript
class CalendarSettings {
  constructor(calendarService, settingsService) {
    this.calendarService = calendarService;
    this.settingsService = settingsService;
    this.container = null;
  }

  async init(container, accountId) {
    this.container = container;
    this.accountId = accountId;
    await this.render();
  }

  async render() {
    // Show loading state
    // Fetch calendar list from CalendarService
    // Fetch current selections from SettingsService
    // Build calendar checkbox UI
    // Attach event listeners
  }

  async loadCalendarList() {
    // Get calendars from CalendarService
    // Handle errors (network, API, etc.)
  }

  async loadCurrentSelections() {
    // Get selectedCalendarIds from SettingsService
  }

  buildCalendarUI(calendars, selectedIds) {
    // Create checkbox elements
    // Apply calendar colors
    // Mark selected calendars as checked
  }

  async handleSelectionChange(calendarId, isChecked) {
    // Update selection state
    // Save to SettingsService
    // Emit event for widgets to refresh (optional)
  }
}
```

#### Step 3: Integrate into Settings Display

**Update settings-display.html:**
```html
<!-- After theme section -->
<div id="calendar-settings-section"></div>
```

**Update settings display initialization:**
```javascript
import { CalendarSettings } from './js/modules/settings/CalendarSettings.js';

// In init function
const calendarSettings = new CalendarSettings(
  window.dashie.services.calendar,
  window.dashie.services.settings
);
await calendarSettings.init(
  document.getElementById('calendar-settings-section'),
  currentAccountId
);
```

#### Step 4: Create Calendar Settings CSS

**Create new file:** `css/modules/settings-calendar.css`

```css
/* Calendar Settings Section */
.settings-section {
  margin: 20px 0;
  padding: 20px;
  background: var(--card-bg);
  border-radius: 8px;
}

.settings-section h3 {
  margin-bottom: 8px;
  font-size: 18px;
}

.settings-description {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 16px;
}

/* Calendar List */
.calendar-item {
  display: flex;
  align-items: center;
  padding: 12px;
  margin: 8px 0;
  background: var(--input-bg);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.calendar-item:hover {
  background: var(--input-hover-bg);
}

.calendar-item:focus-within {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

.calendar-item input[type="checkbox"] {
  margin-right: 12px;
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.calendar-color {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  margin-right: 12px;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.calendar-item label {
  flex: 1;
  cursor: pointer;
  font-size: 14px;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
}

.loading-state .spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Error State */
.error-state {
  text-align: center;
  padding: 20px;
  color: var(--error-color);
}

.error-state button {
  margin-top: 12px;
  padding: 8px 16px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
```

#### Step 5: Update Calendar/Agenda Widgets to Use Settings

**When widgets fetch events, they should:**
1. Load selected calendar IDs from SettingsService
2. Filter events to only show events from selected calendars
3. Handle case where no calendars are selected (show all by default?)

**Example in Calendar Widget:**
```javascript
async loadEvents(accountId) {
  // Get selected calendar IDs from settings
  const selectedCalendarIds = await this.settingsService.getSelectedCalendars(accountId);

  // Fetch all events
  const allEvents = await this.calendarService.getUpcomingEvents(accountId);

  // Filter by selected calendars if any are selected
  const filteredEvents = selectedCalendarIds.length > 0
    ? allEvents.filter(event => selectedCalendarIds.includes(event.calendarId))
    : allEvents; // Show all if none selected

  this.renderEvents(filteredEvents);
}
```

### Files to Reference from Legacy

1. **Settings UI Pattern:**
   - `.reference/.archives/widgets/legacy_settings_widget_20250118_225633/legacy_settings.js:152-399`
   - Shows calendar list building, checkbox handling, settings persistence

2. **Calendar Color Handling:**
   - Same file - shows how to extract and apply Google Calendar colors

3. **Loading States:**
   - Same file - spinner implementation while fetching data

### Testing Checklist

- [ ] Calendar list loads from Google Calendar API
- [ ] All calendars display with correct names and colors
- [ ] Checkboxes reflect current saved settings
- [ ] Checking/unchecking calendars saves immediately
- [ ] Settings persist across page reloads
- [ ] Multiple accounts maintain separate calendar selections
- [ ] Error handling for API failures
- [ ] Loading states work correctly
- [ ] D-pad navigation works (focus states)
- [ ] Calendar widget respects selected calendars
- [ ] Agenda widget respects selected calendars

### Technical Notes

**Calendar ID Format:**
- Google returns calendar IDs like `"primary"` or `"user@gmail.com"`
- Store these IDs directly in settings array
- No need for account prefixing (that's handled at the IndexedDB key level)

**Default Behavior:**
- If no calendars selected → show all calendars
- If some calendars selected → show only those
- First-time users → all calendars selected by default?

**Performance:**
- Calendar list is cached in IndexedDB (`calendar_list_{accountId}`)
- No need to fetch from API every time settings screen opens
- Refresh calendar list periodically (daily?) or on user request

---

## 4.4: Test Calendar Settings with Multi-Accounts

**Goal:** Verify calendar settings work correctly with multiple Google accounts

### Test Cases

1. **Account Isolation:**
   - [ ] Account A selects calendars 1, 2
   - [ ] Account B selects calendars 3, 4
   - [ ] Switch between accounts - selections remain separate

2. **Settings Persistence:**
   - [ ] Select calendars for Account A
   - [ ] Logout
   - [ ] Login to Account A
   - [ ] Verify selections persisted

3. **Widget Integration:**
   - [ ] Calendar widget shows only selected calendars
   - [ ] Agenda widget shows only events from selected calendars
   - [ ] Switching accounts updates widgets to show correct calendars

---

## 4.5: Calendar Widget Migration

**Goal:** Migrate Calendar widget from legacy codebase

### Implementation Steps

1. **Create Widget Structure:**
   ```
   js/widgets/
   └── CalendarWidget/
       ├── CalendarWidget.js       # Main widget class
       ├── calendar-widget.css     # Widget styles
       └── index.js                # Export
   ```

2. **Implement Calendar Widget:**
   - Extend BaseWidget
   - Use CalendarService to fetch events
   - Respect calendar settings from SettingsService
   - Render monthly calendar view
   - Handle date navigation
   - Show events on calendar days

3. **Add to Widget System:**
   - Register in WidgetFactory
   - Add default settings to SettingsService
   - Create widget configuration UI

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
- [ ] 4.3: Calendar settings interface implemented
- [ ] 4.4: Multi-account calendar settings tested
- [ ] 4.5: Calendar widget migrated and working
- [ ] 4.6: Widget lifecycle verified
- [ ] 4.7: Logout modal tested
- [ ] 4.8: Agenda widget migrated and working
- [ ] 4.9: Account settings with delete implemented
- [ ] 4.10: Token refresh thoroughly tested
- [ ] All widgets respect user settings
- [ ] Multi-account support works flawlessly
- [ ] No memory leaks or performance issues
- [ ] D-pad navigation works everywhere

---

## Next Steps

After Phase 4 completion:
- **Phase 5:** Remaining widget migrations
- **Phase 6:** Polish, optimization, and final testing
