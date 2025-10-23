# Calendar Services Architecture

**Location:** `js/data/services/calendar-services/`
**Orchestrator:** `js/data/services/calendar-service.js`
**Config Store:** `js/data/services/calendar-config-store.js`

---

## Overview

The Calendar Services system uses a **modular architecture** where specialized services handle specific responsibilities. This separation of concerns makes the system easier to test, maintain, and extend.

### Key Design Principles

1. **Separation of Concerns** - Each module has one job and does it well
2. **Single Responsibility** - Fetching, processing, and refreshing are separate
3. **Multi-Account Support** - Handle multiple Google accounts seamlessly
4. **Background Refresh** - Update data without blocking UI
5. **Caching Strategy** - Smart cache with age-based refresh

---

## Architecture Diagram

```
CalendarService (Orchestrator)
        │
        ├─→ CalendarFetcher ───────→ Google Calendar API
        │   (Data Fetching)          (Multi-account, multi-calendar)
        │
        ├─→ EventProcessor ─────────→ Data Transformation
        │   (Data Cleaning)          (Normalize, dedupe, format)
        │
        ├─→ CalendarRefreshManager ─→ Background Refresh
        │   (Auto Refresh)           (Periodic updates)
        │
        └─→ CalendarConfigStore ────→ Config Persistence
            (Active Calendars)        (localStorage + Database)
```

**Data Flow:**
```
1. User requests calendar data
   ↓
2. CalendarService.loadData()
   ↓
3. CalendarFetcher fetches raw events from Google
   ↓
4. EventProcessor transforms & cleans data
   ↓
5. Return ready-to-display events to caller
   ↓
6. CalendarRefreshManager refreshes in background
```

---

## Module Breakdown

### 1. CalendarService (Orchestrator)

**File:** `js/data/services/calendar-service.js`

**Purpose:** High-level API that coordinates all calendar operations

**Responsibilities:**
- Initialize sub-modules
- Coordinate data flow between modules
- Provide simple public API for application
- Manage active calendars list
- Handle multi-account support

**Public API:**
```javascript
import { initializeCalendarService, getCalendarService } from './calendar-service.js';

// Initialize (once, during app startup)
const calendarService = initializeCalendarService(edgeClient);
await calendarService.initialize();

// Load all calendar data (main entry point)
const { calendars, events } = await calendarService.loadData({
  forceRefresh: false,
  timeRange: {
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  }
});

// Get calendars for an account
const calendars = await calendarService.getCalendars('primary');

// Enable/disable calendars
await calendarService.enableCalendar('primary', 'user@gmail.com');
await calendarService.disableCalendar('primary', 'user@gmail.com');

// Get active calendars
const activeIds = calendarService.getActiveCalendarIds();
// Returns: ['primary-user@gmail.com', 'account2-work@gmail.com']

// Start auto-refresh (every 30 minutes)
calendarService.startAutoRefresh(30 * 60 * 1000);
```

**Account-Prefixed IDs:**

To support multiple Google accounts, calendar IDs are prefixed with the account type:

```javascript
// Format: {accountType}-{calendarId}
'primary-user@gmail.com'      // Primary account
'account2-work@gmail.com'     // Secondary account
'primary-holidays@google.com' // Primary account (different calendar)
```

**Helper methods:**
```javascript
// Create prefixed ID
const prefixedId = calendarService.createPrefixedId('primary', 'user@gmail.com');
// Returns: 'primary-user@gmail.com'

// Parse prefixed ID
const { accountType, calendarId } = calendarService.parsePrefixedId('primary-user@gmail.com');
// Returns: { accountType: 'primary', calendarId: 'user@gmail.com' }
```

---

### 2. CalendarFetcher

**File:** `js/data/services/calendar-services/calendar-fetcher.js`

**Purpose:** Fetch calendar and event data from Google Calendar API

**Responsibilities:**
- Fetch calendar lists from multiple accounts
- Fetch events from multiple calendars
- Group calendars by account type
- Add calendar metadata (colors, names) to events
- Aggregate data from all accounts

**Does NOT:**
- Transform or clean event data (that's EventProcessor's job)
- Manage active calendars (that's CalendarService's job)
- Cache data (handled by caller)

**Key Methods:**
```javascript
const fetcher = new CalendarFetcher(calendarService);

// Main entry point - fetch all calendar data
const { calendars, events } = await fetcher.fetchAllCalendarData(
  activeCalendarIds,  // ['primary-user@gmail.com', 'account2-work@gmail.com']
  {
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    maxResults: 2500
  }
);

// Fetch calendars for specific account
const calendars = await fetcher.fetchAccountCalendars('primary');

// Fetch raw events (without metadata enrichment)
const events = await fetcher.fetchRawEvents('primary', 'user@gmail.com', timeRange);
```

**How It Works:**

1. **Groups calendars by account:**
   ```javascript
   // Input: ['primary-user@gmail.com', 'account2-work@gmail.com']
   // Output: {
   //   'primary': [{ prefixedId: 'primary-user@gmail.com', calendarId: 'user@gmail.com' }],
   //   'account2': [{ prefixedId: 'account2-work@gmail.com', calendarId: 'work@gmail.com' }]
   // }
   ```

2. **Fetches data for each account:**
   - Fetches calendar list (for colors/names)
   - Fetches events for each active calendar
   - Adds calendar metadata to events

3. **Aggregates all data:**
   - Combines calendars from all accounts
   - Combines events from all accounts
   - Returns single unified dataset

**Event Metadata Enrichment:**

Each event is enriched with calendar information:
```javascript
{
  ...event,
  calendarId: 'user@gmail.com',
  accountType: 'primary',
  prefixedCalendarId: 'primary-user@gmail.com',
  backgroundColor: '#1976d2',
  foregroundColor: '#ffffff',
  calendarName: 'Personal Calendar'
}
```

---

### 3. EventProcessor

**File:** `js/data/services/calendar-services/event-processor.js`

**Purpose:** Transform and normalize calendar events for widget consumption

**Responsibilities:**
- Clean and standardize event data
- Normalize all-day events (Google's exclusive end dates → inclusive)
- Deduplicate events across calendars
- Add computed fields for display
- Format event descriptions safely (XSS prevention)

**Key Methods:**
```javascript
const processor = new EventProcessor();

// Main entry point - transform raw events
const transformedEvents = processor.transformEvents(rawEvents);

// Clean event data (normalize structure)
const cleanedEvents = processor.cleanEventData(rawEvents);

// Deduplicate events
const uniqueEvents = processor.deduplicateEvents(events);

// Check if event is all-day
const isAllDay = processor.isEffectivelyAllDay(event);

// Format date safely (timezone-aware)
const dateString = processor.formatDateSafe(new Date());
// Returns: "2025-10-23"
```

**Google All-Day Event Normalization:**

**The Problem:**
Google Calendar uses **exclusive** end dates for all-day events:
```javascript
// Event on Jan 15 (single day)
{
  start: { date: "2025-01-15" },
  end: { date: "2025-01-16" }  // ← Day AFTER event ends
}
```

**The Solution:**
EventProcessor converts to **inclusive** end dates:
```javascript
// After normalization
{
  start: { date: "2025-01-15" },
  end: { date: "2025-01-15" }  // ← Actual last day
}
```

**Implementation:**
```javascript
cleanEventData(events) {
  return events.map(event => {
    if (event.start.date) {
      // Parse Google's end date
      const endDateParts = event.end.date.split('-');
      const endYear = parseInt(endDateParts[0]);
      const endMonth = parseInt(endDateParts[1]) - 1;
      const endDay = parseInt(endDateParts[2]);

      // Subtract 1 day
      const endDateObj = new Date(endYear, endMonth, endDay);
      endDateObj.setDate(endDateObj.getDate() - 1);

      // Format back to YYYY-MM-DD
      const adjustedEndDate = this.formatDateSafe(endDateObj);

      return {
        ...event,
        start: { date: event.start.date, dateTime: null },
        end: { date: adjustedEndDate, dateTime: null }
      };
    }
    return event;
  });
}
```

**Effectively All-Day Events:**

Some events have `dateTime` but span midnight to midnight (00:00 to 00:00). EventProcessor detects and normalizes these:

```javascript
isEffectivelyAllDay(event) {
  if (event.start.date) return true;

  if (event.start.dateTime && event.end.dateTime) {
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);

    const isStartMidnight = start.getHours() === 0 &&
                            start.getMinutes() === 0 &&
                            start.getSeconds() === 0;

    const isEndMidnight = end.getHours() === 0 &&
                          end.getMinutes() === 0 &&
                          end.getSeconds() === 0;

    return isStartMidnight && isEndMidnight;
  }

  return false;
}
```

**Event Deduplication:**

Deduplicates events based on content (not just IDs):

```javascript
deduplicateEvents(events) {
  const eventMap = new Map();

  for (const event of events) {
    const identifier = `${event.calendarId}::${event.summary}::${event.start}::${event.end}`;

    if (!eventMap.has(identifier)) {
      eventMap.set(identifier, event);
    }
  }

  return Array.from(eventMap.values());
}
```

**XSS Protection:**

Event descriptions are sanitized to prevent XSS attacks:

```javascript
formatEventDescription(description) {
  // Escape all HTML
  const escaped = description
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  // Allow safe formatting back (<br>, <p>)
  return escaped
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    .replace(/&lt;p&gt;/gi, '<p>')
    .replace(/&lt;\/p&gt;/gi, '</p>')
    .replace(/\n/g, '<br>');
}
```

---

### 4. CalendarRefreshManager

**File:** `js/data/services/calendar-services/calendar-refresh-manager.js`

**Purpose:** Automatic background refresh of calendar data

**Responsibilities:**
- Start/stop automatic refresh timers
- Trigger calendar data reload at intervals
- Broadcast updates to listening components
- Manage refresh state

**Does NOT:**
- Fetch data (that's CalendarFetcher's job)
- Cache data (handled by caller)
- Transform data (that's EventProcessor's job)

**Key Methods:**
```javascript
const refreshManager = new CalendarRefreshManager(calendarService);

// Start auto-refresh (every 30 minutes)
refreshManager.startAutoRefresh(30 * 60 * 1000);

// Stop auto-refresh
refreshManager.stopAutoRefresh();

// Manual refresh
await refreshManager.triggerRefresh();

// Get status
const status = refreshManager.getStatus();
// Returns: {
//   isActive: true,
//   isRefreshing: false,
//   refreshInterval: 1800000,
//   lastRefreshTime: 1729702800000,
//   nextRefreshIn: 1200000
// }

// Change refresh interval (restarts timer if active)
refreshManager.setRefreshInterval(15 * 60 * 1000); // 15 minutes
```

**How It Works:**

1. **Starts timer on initialization:**
   ```javascript
   startAutoRefresh(intervalMs) {
     this.refreshTimer = setInterval(async () => {
       await this.performRefresh();
     }, intervalMs);

     // Perform initial refresh immediately
     this.performRefresh();
   }
   ```

2. **Performs refresh cycle:**
   ```javascript
   async performRefresh() {
     // Prevent concurrent refreshes
     if (this.isRefreshing) return;

     this.isRefreshing = true;

     // Reload calendar data (force refresh)
     const data = await this.calendarService.loadData({ forceRefresh: true });

     // Broadcast update event
     this.broadcastUpdate(data);

     this.isRefreshing = false;
   }
   ```

3. **Broadcasts updates:**
   ```javascript
   broadcastUpdate(data) {
     const event = new CustomEvent('calendar-data-updated', {
       detail: {
         calendars: data.calendars,
         events: data.events,
         timestamp: Date.now()
       }
     });

     window.dispatchEvent(event);
   }
   ```

**Listening for Updates:**

Components can listen for calendar updates:

```javascript
window.addEventListener('calendar-data-updated', (event) => {
  const { calendars, events, timestamp } = event.detail;

  logger.info('Calendar data updated', {
    events: events.length,
    calendars: calendars.length
  });

  // Update UI with new data
  renderCalendar(events);
});
```

---

### 5. CalendarConfigStore

**File:** `js/data/services/calendar-config-store.js`

**Purpose:** Manage calendar configuration separately from user settings

**Responsibilities:**
- Store active calendar IDs
- Manage account metadata
- Map calendars to accounts
- Persist calendar-specific settings
- Migrate from old settings format

**Storage Strategy:**
- **Primary:** localStorage (fast)
- **Future:** Supabase `user_calendar_config` table (authoritative)
- **Pattern:** Dual-write to both locations

**Config Structure:**
```javascript
{
  active_calendar_ids: [
    "primary-user@gmail.com",
    "account2-shared@gmail.com"
  ],
  accounts: {
    "primary": {
      email: "user@gmail.com",
      display_name: "John",
      provider: "google",
      is_active: true,
      created_at: "2025-10-22T12:00:00Z",
      updated_at: "2025-10-22T12:00:00Z"
    },
    "account2": {
      email: "shared@gmail.com",
      display_name: "Family",
      provider: "google",
      is_active: true,
      created_at: "2025-10-22T12:00:00Z",
      updated_at: "2025-10-22T12:00:00Z"
    }
  },
  calendar_account_map: {
    "user@gmail.com": "primary",
    "shared@gmail.com": "account2"
  },
  calendar_settings: {
    default_view: "week",
    show_declined_events: false
  }
}
```

**Key Methods:**
```javascript
import { calendarConfigStore } from './calendar-config-store.js';

// Initialize
await calendarConfigStore.initialize(edgeClient);

// Active calendar management
const activeIds = calendarConfigStore.getActiveCalendarIds();
await calendarConfigStore.addActiveCalendar('primary-user@gmail.com');
await calendarConfigStore.removeActiveCalendar('primary-user@gmail.com');
const isActive = calendarConfigStore.isCalendarActive('primary-user@gmail.com');

// Account management
const account = calendarConfigStore.getAccount('primary');
await calendarConfigStore.setAccount('primary', {
  email: 'user@gmail.com',
  display_name: 'John Doe'
});
await calendarConfigStore.removeAccount('account2');

// Calendar settings
const settings = calendarConfigStore.getCalendarSettings();
await calendarConfigStore.updateCalendarSettings({
  default_view: 'month',
  show_declined_events: true
});

// Migration
await calendarConfigStore.migrateFromSettings(oldSettings);
```

**Note:** This module is prepared for future database integration but currently uses localStorage only.

---

## Caching Strategy

### Configuration

**In `config.js`:**
```javascript
// Cache TTL: 5 minutes
export const CALENDAR_CACHE_TTL_MS = 5 * 60 * 1000;

// Start background refresh after 2 minutes
export const CALENDAR_CACHE_REFRESH_THRESHOLD_MS = 2 * 60 * 1000;

// Auto-refresh interval: 5 minutes (default)
export const DEFAULT_CALENDAR_REFRESH_INTERVAL = 5;
```

### Cache Strategy

**Age-Based Refresh:**

```
Age 0-2 min:  Serve cache (fresh)
Age 2-5 min:  Serve cache + background refresh
Age 5+ min:   Serve STALE cache + background refresh
```

**Implementation:**

```javascript
async loadCalendarData() {
  const cached = this.cache.get('calendar-events');
  const age = Date.now() - (cached?.timestamp || 0);

  // Cache fresh (0-2 min) → Serve immediately
  if (age < CALENDAR_CACHE_REFRESH_THRESHOLD_MS) {
    return cached.data;
  }

  // Cache aging (2-5 min) → Serve cache + refresh in background
  if (age < CALENDAR_CACHE_TTL_MS) {
    // Trigger background refresh (don't wait)
    this.refreshInBackground();

    return cached.data;
  }

  // Cache stale (5+ min) → Show stale + refresh in background
  this.refreshInBackground();

  return cached.data || []; // Show stale data while refreshing
}
```

**Benefits:**
- ✅ No loading screens after initial load
- ✅ Always show *something* to user
- ✅ Data stays reasonably fresh (2-5 minutes)
- ✅ Background refresh doesn't block UI

---

## Multi-Account Support

### How It Works

**1. TokenStore manages accounts:**
```javascript
const accounts = await tokenStore.getProviderAccounts('google');
// Returns: {
//   'primary': { email: 'user@gmail.com', ... },
//   'account2': { email: 'work@gmail.com', ... }
// }
```

**2. CalendarService prefixes calendar IDs:**
```javascript
// Calendars from primary account
'primary-user@gmail.com'
'primary-holidays@google.com'

// Calendars from account2
'account2-work@gmail.com'
'account2-shared@gmail.com'
```

**3. CalendarFetcher groups by account:**
```javascript
const grouped = {
  'primary': [
    { prefixedId: 'primary-user@gmail.com', calendarId: 'user@gmail.com' }
  ],
  'account2': [
    { prefixedId: 'account2-work@gmail.com', calendarId: 'work@gmail.com' }
  ]
};
```

**4. Fetch data for each account separately:**
```javascript
for (const [accountType, calendars] of Object.entries(grouped)) {
  const data = await fetcher.fetchAccountData(accountType, calendars, timeRange);
  allEvents.push(...data.accountEvents);
}
```

**5. Events know which account they belong to:**
```javascript
{
  summary: 'Team Meeting',
  accountType: 'account2',
  calendarId: 'work@gmail.com',
  prefixedCalendarId: 'account2-work@gmail.com',
  backgroundColor: '#1976d2',
  calendarName: 'Work Calendar'
}
```

---

## Data Flow Example

### Complete End-to-End Flow

```javascript
// 1. User opens calendar widget
//    Widget requests calendar data via WidgetDataManager

// 2. WidgetDataManager calls CalendarService
const { calendars, events } = await calendarService.loadData();

// 3. CalendarService orchestrates the fetch
//    a. Checks active calendars
const activeIds = ['primary-user@gmail.com', 'account2-work@gmail.com'];

//    b. Delegates to CalendarFetcher
const rawData = await fetcher.fetchAllCalendarData(activeIds, timeRange);
//    CalendarFetcher:
//    - Groups calendars by account
//    - Fetches calendar lists (for colors)
//    - Fetches events for each calendar
//    - Enriches events with metadata

// 4. CalendarService delegates to EventProcessor
const processedEvents = processor.transformEvents(rawData.events);
//    EventProcessor:
//    - Cleans event data
//    - Normalizes all-day events
//    - Deduplicates events
//    - Adds computed fields

// 5. CalendarService returns ready-to-display data
return {
  calendars: rawData.calendars,
  events: processedEvents
};

// 6. WidgetDataManager caches the data
cache.set('calendar-events', { data: events, timestamp: Date.now() });

// 7. WidgetDataManager sends data to calendar widget
widgetMessenger.sendToWidget('calendar', {
  type: 'data',
  action: 'calendar-data',
  payload: { calendars, events }
});

// 8. CalendarRefreshManager starts background refresh
refreshManager.startAutoRefresh(5 * 60 * 1000); // Every 5 minutes

// 9. After 5 minutes, refresh manager triggers reload
await calendarService.loadData({ forceRefresh: true });

// 10. Broadcast update event
window.dispatchEvent(new CustomEvent('calendar-data-updated', {
  detail: { calendars, events, timestamp: Date.now() }
}));

// 11. WidgetDataManager listens for update, sends fresh data to widgets
window.addEventListener('calendar-data-updated', (event) => {
  widgetMessenger.broadcast('calendar-refreshed', event.detail);
});
```

---

## Usage Examples

### Example 1: Basic Calendar Loading

```javascript
import { initializeCalendarService } from './calendar-service.js';

// Initialize service
const calendarService = initializeCalendarService(edgeClient);
await calendarService.initialize();

// Load calendar data
const { calendars, events } = await calendarService.loadData();

console.log(`Loaded ${events.length} events from ${calendars.length} calendars`);

// Start auto-refresh
calendarService.startAutoRefresh(5 * 60 * 1000); // Every 5 minutes
```

### Example 2: Multi-Account Calendar Selection

```javascript
// Get calendars for primary account
const primaryCalendars = await calendarService.getCalendars('primary');

// Get calendars for secondary account
const account2Calendars = await calendarService.getCalendars('account2');

// Display calendar selection UI
primaryCalendars.forEach(cal => {
  renderCheckbox({
    id: cal.prefixedId,
    name: cal.summary,
    color: cal.backgroundColor,
    checked: cal.isActive,
    onChange: async (checked) => {
      if (checked) {
        await calendarService.enableCalendar('primary', cal.id);
      } else {
        await calendarService.disableCalendar('primary', cal.id);
      }
    }
  });
});
```

### Example 3: Custom Date Range

```javascript
// Load events for next 7 days
const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const { events } = await calendarService.loadData({
  timeRange: {
    timeMin: new Date().toISOString(),
    timeMax: oneWeekFromNow.toISOString()
  }
});

console.log(`${events.length} events in next 7 days`);
```

### Example 4: Listen for Background Updates

```javascript
// Widget listens for calendar updates
window.addEventListener('calendar-data-updated', (event) => {
  const { calendars, events, timestamp } = event.detail;

  logger.info('Calendar data updated in background', {
    events: events.length,
    timestamp: new Date(timestamp).toLocaleTimeString()
  });

  // Update widget display
  renderEvents(events);
});
```

---

## Configuration

### Calendar Cache Settings

**In `config.js`:**
```javascript
// Cache time-to-live (5 minutes)
export const CALENDAR_CACHE_TTL_MS = 5 * 60 * 1000;

// Background refresh threshold (2 minutes)
export const CALENDAR_CACHE_REFRESH_THRESHOLD_MS = 2 * 60 * 1000;

// Default auto-refresh interval (5 minutes)
export const DEFAULT_CALENDAR_REFRESH_INTERVAL = 5;
```

**Adjust refresh frequency:**
```javascript
// More frequent refresh (every 2 minutes)
calendarService.startAutoRefresh(2 * 60 * 1000);

// Less frequent refresh (every 30 minutes)
calendarService.startAutoRefresh(30 * 60 * 1000);
```

### Date Range Settings

**Default time range:**
```javascript
// Default: Next 30 days
{
  timeMin: new Date().toISOString(),
  timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  maxResults: 2500
}
```

**Custom time range:**
```javascript
// Load events for specific date range
const { events } = await calendarService.loadData({
  timeRange: {
    timeMin: '2025-01-01T00:00:00Z',
    timeMax: '2025-12-31T23:59:59Z',
    maxResults: 5000
  }
});
```

---

## Best Practices

### DO:

✅ **Use background refresh to avoid blocking UI**
```javascript
// GOOD: Background refresh
calendarService.startAutoRefresh(5 * 60 * 1000);

// BAD: Blocking refresh
setInterval(async () => {
  showLoadingSpinner();
  await calendarService.loadData({ forceRefresh: true });
  hideLoadingSpinner();
}, 5 * 60 * 1000);
```

✅ **Show stale cache while refreshing**
```javascript
// Serve cached data immediately
const cached = cache.get('calendar-events');
if (cached) {
  renderEvents(cached.data);
}

// Refresh in background
refreshInBackground();
```

✅ **Use account-prefixed IDs for all calendar operations**
```javascript
// GOOD: Prefixed IDs
await calendarService.enableCalendar('primary', 'user@gmail.com');

// BAD: Raw IDs (breaks multi-account)
await enableCalendar('user@gmail.com'); // Which account?
```

✅ **Clean up refresh timers on destroy**
```javascript
destroy() {
  calendarService.stopAutoRefresh();
}
```

### DON'T:

❌ **Don't block UI for refresh**
```javascript
// BAD: Blocks UI
async function refreshCalendar() {
  showLoadingScreen(); // ← User waits
  await calendarService.loadData({ forceRefresh: true });
  hideLoadingScreen();
}

// GOOD: Background refresh
function refreshCalendar() {
  // Show cached data immediately
  renderEvents(cachedEvents);

  // Refresh in background
  calendarService.triggerRefresh();
}
```

❌ **Don't fetch without checking cache**
```javascript
// BAD: Fetches every time
async function getEvents() {
  return await calendarService.loadData();
}

// GOOD: Check cache first
async function getEvents() {
  const cached = cache.get('calendar-events');
  const age = Date.now() - (cached?.timestamp || 0);

  if (age < CALENDAR_CACHE_TTL_MS) {
    return cached.data;
  }

  return await calendarService.loadData();
}
```

❌ **Don't make multiple concurrent refresh calls**
```javascript
// BAD: Multiple refreshes
await calendarService.triggerRefresh();
await calendarService.triggerRefresh(); // ← Duplicate work

// GOOD: RefreshManager prevents concurrent refreshes
async performRefresh() {
  if (this.isRefreshing) return; // ← Guard
  this.isRefreshing = true;
  // ... perform refresh
  this.isRefreshing = false;
}
```

❌ **Don't transform data in CalendarFetcher**
```javascript
// BAD: Mixing concerns
class CalendarFetcher {
  async fetchEvents() {
    const events = await api.getEvents();

    // ❌ Don't transform here - that's EventProcessor's job
    return events.map(e => this.normalizeAllDayEvent(e));
  }
}

// GOOD: Separation of concerns
class CalendarFetcher {
  async fetchEvents() {
    return await api.getEvents(); // Just fetch
  }
}

class EventProcessor {
  transformEvents(events) {
    return events.map(e => this.normalizeAllDayEvent(e)); // ✅ Transform here
  }
}
```

---

## Troubleshooting

### Calendar Not Loading

**Symptoms:**
- No events displayed
- Empty calendar widget
- No errors in console

**Checks:**
1. **Are calendars active?**
   ```javascript
   const activeIds = calendarService.getActiveCalendarIds();
   console.log('Active calendars:', activeIds);
   // Should see: ['primary-user@gmail.com', ...]
   ```

2. **Check auth tokens:**
   ```javascript
   const account = await tokenStore.getAccountTokens('google', 'primary');
   console.log('Has access token:', !!account?.accessToken);
   ```

3. **Check API errors:**
   ```javascript
   // Look for network errors in console
   // Check Network tab for failed requests to Google API
   ```

### Events Not Updating

**Symptoms:**
- Events show old data
- Changes in Google Calendar don't appear
- Manual refresh doesn't help

**Checks:**
1. **Force cache clear:**
   ```javascript
   await calendarService.loadData({ forceRefresh: true });
   ```

2. **Check refresh manager:**
   ```javascript
   const status = calendarService.refreshManager.getStatus();
   console.log('Refresh active:', status.isActive);
   console.log('Last refresh:', new Date(status.lastRefreshTime));
   ```

3. **Verify calendar IDs haven't changed:**
   ```javascript
   // Google sometimes changes calendar IDs
   const calendars = await calendarService.getCalendars('primary');
   console.log('Available calendars:', calendars.map(c => c.id));
   ```

### Cache Not Expiring

**Symptoms:**
- Same data shows forever
- Background refresh not triggering
- Events stuck in past

**Checks:**
1. **Check cache timestamps:**
   ```javascript
   const cached = cache.get('calendar-events');
   const age = Date.now() - cached.timestamp;
   console.log(`Cache age: ${age / 1000 / 60} minutes`);
   ```

2. **Verify refresh interval:**
   ```javascript
   const status = calendarService.refreshManager.getStatus();
   console.log(`Refresh interval: ${status.refreshInterval / 1000 / 60} minutes`);
   ```

3. **Check if refresh manager is running:**
   ```javascript
   console.log('Refresh active:', !!calendarService.refreshManager.refreshTimer);
   ```

### Multiple Refresh Calls

**Symptoms:**
- Duplicate API requests
- Console shows multiple "Fetching calendar data" logs
- High network usage

**Cause:**
Multiple components calling `loadData()` simultaneously

**Solution:**
Use guard in refresh manager (already implemented):
```javascript
async performRefresh() {
  if (this.isRefreshing) {
    logger.debug('Refresh already in progress, skipping');
    return; // ← Prevents duplicate calls
  }

  this.isRefreshing = true;
  // ... perform refresh
  this.isRefreshing = false;
}
```

### All-Day Events Showing Wrong Dates

**Symptoms:**
- Event shows "Jan 15-16" but should be "Jan 15"
- Multi-day events off by one day

**Cause:**
Google uses exclusive end dates (day AFTER event ends)

**Fix:**
Already handled by EventProcessor:
```javascript
// Google returns: { start: "2025-01-15", end: "2025-01-16" }
// EventProcessor normalizes to: { start: "2025-01-15", end: "2025-01-15" }
```

---

## Related Documentation

- [DASHBOARD_SYNC.md](../DASHBOARD_SYNC.md) - Cross-dashboard synchronization
- [README.md](../../core/initialization/README.md) - Initialization system
- [SETTINGS_PAGE_BASE_GUIDE.md](../../modules/Settings/SETTINGS_PAGE_BASE_GUIDE.md) - Settings integration
- [config.js](../../../config.js) - Cache configuration

---

## Summary

The Calendar Services architecture provides:

1. **Modular Design** - Specialized modules for fetching, processing, and refreshing
2. **Multi-Account Support** - Handle multiple Google accounts seamlessly
3. **Background Refresh** - Update data without blocking UI
4. **Smart Caching** - Age-based refresh strategy (0-2 min fresh, 2-5 min background refresh)
5. **Data Normalization** - Google's quirks handled transparently

**Key Components:**
- **CalendarService** - Orchestrator with simple public API
- **CalendarFetcher** - Google API interaction
- **EventProcessor** - Data transformation & cleaning
- **CalendarRefreshManager** - Automatic background refresh
- **CalendarConfigStore** - Configuration persistence

**Best Practices:**
- ✅ Use background refresh to avoid blocking UI
- ✅ Show stale cache while refreshing
- ✅ Use account-prefixed IDs for multi-account support
- ✅ Clean up timers on destroy
- ❌ Don't block UI for refresh
- ❌ Don't fetch without checking cache
- ❌ Don't mix transformation logic into fetcher
- ❌ Don't make multiple concurrent refresh calls

The modular architecture makes it easy to test, maintain, and extend each component independently while maintaining clean separation of concerns.
