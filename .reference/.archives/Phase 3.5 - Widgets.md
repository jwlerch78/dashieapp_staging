# Phase 3.5: Widgets - Quick Start Guide

**Estimated Time:** 1-2 weeks
**Status:** Ready to start
**Prerequisites:** Phase 3 (Data Layer) ✅ COMPLETE

---

## What You're Building

Standalone widget components that display data in the Dashboard:
- **Clock Widget** - Time and date display
- **Calendar Widget (dcal)** - Upcoming events
- **Photos Widget** - Photo carousel (optional)
- **Header Widget** - Greeting and weather (optional)

**Goal:** Get the visual dashboard working with real calendar data!

---

## Why Phase 3.5?

**Bridge between data layer and UI modules:**
- Phase 3 built the data infrastructure (auth, services) ✅
- Phase 4 will build the UI modules (Settings, Login, etc.)
- **Phase 3.5** validates the data layer works end-to-end with visual feedback

**Benefits:**
1. ✅ **Visual progress** - See your calendar data displayed!
2. ✅ **Test token refresh** - Widgets will reveal data layer issues
3. ✅ **Validate architecture** - Ensure widget communication works
4. ✅ **Easier debugging** - Visual feedback beats console logs
5. ✅ **Confidence boost** - Seeing it work is motivating!

---

## Widget Architecture

### Widget Structure

Every widget is an **iframe-isolated component**:

```
js/widgets/[WidgetName]/
├── [widget-name].html      # Widget entry point (loaded in iframe)
├── [widget-name].js        # Widget logic
├── [widget-name].css       # Widget-specific styles
└── config.js               # Widget configuration (optional)

Example (Clock widget):
js/widgets/clock/
├── clock.html
├── clock.js
├── clock.css
```

### Why Iframes?

**Isolation Benefits:**
- ✅ **Style isolation** - Widget CSS won't affect main app
- ✅ **Script isolation** - Widget JS errors won't crash app
- ✅ **Security** - Widgets can't access main app DOM directly
- ✅ **Performance** - Widgets can be lazy-loaded
- ✅ **Modularity** - Each widget is self-contained

**Communication:**
- Main app → Widget: `postMessage()` (send data/commands)
- Widget → Main app: `postMessage()` (send events/requests)

---

## Widget Communication Protocol

### Message Types

**App → Widget:**
```javascript
// 1. Data messages (send calendar events, photos, etc.)
{
    type: 'data',
    widgetId: 'calendar',
    payload: {
        dataType: 'events',
        data: [ /* array of events */ ]
    }
}

// 2. Command messages (navigate, focus, etc.)
{
    type: 'command',
    widgetId: 'calendar',
    payload: {
        action: 'up',           // Navigation: up, down, left, right, enter, escape
        action: 'enter-focus',  // State: enter-focus, exit-focus, enter-active, exit-active
    }
}

// 3. Config messages (settings changed)
{
    type: 'config',
    widgetId: 'calendar',
    payload: {
        action: 'settings-update',
        settings: { /* updated settings */ }
    }
}
```

**Widget → App:**
```javascript
// 1. Ready event (widget loaded and initialized)
{
    type: 'event',
    widgetId: 'calendar',
    payload: {
        eventType: 'widget-ready',
        data: { hasMenu: true, menuItems: ['Today', 'Week', 'Month'] }
    }
}

// 2. Navigation events (return to menu, etc.)
{
    type: 'event',
    widgetId: 'calendar',
    payload: {
        eventType: 'return-to-menu'
    }
}

// 3. Settings request
{
    type: 'event',
    widgetId: 'calendar',
    payload: {
        eventType: 'settings-requested'
    }
}
```

---

## Widget Priority List

### 1. Clock Widget (EASIEST - Start Here!)

**Why first:**
- ✅ No data dependencies (uses browser time)
- ✅ Simple logic (update every second)
- ✅ Tests widget loading and iframe communication
- ✅ Quick win to validate architecture

**What it displays:**
- Current time (12h or 24h format)
- Current date
- Optional: Day of week

**Migration:**
- Copy from `.legacy/widgets/clock/`
- Update HTML structure if needed
- Test in Dashboard

**Estimated time:** 2-3 hours

---

### 2. Calendar Widget (dcal) (HIGH VALUE - Do Second!)

**Why second:**
- ✅ Tests CalendarService integration
- ✅ Tests automatic token refresh
- ✅ Displays real user data
- ✅ Most important widget for the app

**What it displays:**
- Upcoming calendar events
- Event titles, times, locations
- All-day events
- Multi-day events

**Data flow:**
```
1. Widget sends 'widget-ready' event
2. Main app calls CalendarService.getEvents()
3. CalendarService calls EdgeClient.getValidToken() (auto-refresh!)
4. CalendarService fetches events from Google API
5. Main app sends events to widget via postMessage
6. Widget displays events
```

**Migration:**
- Copy from `.legacy/widgets/dcal/`
- Update to receive events via postMessage
- Remove old data fetching logic (now in CalendarService)
- Test with real calendar data

**Estimated time:** 4-6 hours

---

### 3. Header Widget (OPTIONAL - For Polish)

**What it displays:**
- Personalized greeting ("Good morning, John!")
- Weather summary
- Location

**Can defer to Phase 4/5** - Not critical for validating data layer

**Estimated time:** 3-4 hours

---

### 4. Photos Widget (OPTIONAL - For Phase 5)

**What it displays:**
- Photo carousel from Google Photos
- Slideshow mode

**Can defer to Phase 5** - Photos service not built yet

**Estimated time:** 6-8 hours

---

## Implementation Steps

### Step 1: Create Widget Infrastructure (30 minutes)

**Create directories:**
```bash
mkdir -p js/widgets/clock
mkdir -p js/widgets/calendar
mkdir -p js/widgets/header
mkdir -p js/widgets/photos
```

**Create widget configuration file:**
```javascript
// js/data/widget-config.js
export const WIDGET_CONFIG = {
    clock: {
        id: 'clock',
        name: 'Clock',
        path: 'js/widgets/clock/index.html',
        gridPosition: { row: 0, col: 0 },
        size: { rows: 1, cols: 1 },
        focusable: false,
        centerOnFocus: false
    },
    calendar: {
        id: 'calendar',
        name: 'Calendar',
        path: 'js/widgets/calendar/index.html',
        gridPosition: { row: 0, col: 1 },
        size: { rows: 2, cols: 1 },
        focusable: true,
        centerOnFocus: true,
        focusScale: 1.1
    },
    header: {
        id: 'header',
        name: 'Header',
        path: 'js/widgets/header/index.html',
        gridPosition: { row: 1, col: 0 },
        size: { rows: 1, cols: 1 },
        focusable: false,
        centerOnFocus: false
    },
    photos: {
        id: 'photos',
        name: 'Photos',
        path: 'js/widgets/photos/index.html',
        gridPosition: { row: 2, col: 0 },
        size: { rows: 1, cols: 2 },
        focusable: true,
        centerOnFocus: true,
        focusScale: 1.05
    }
};
```

---

### Step 2: Migrate Clock Widget (2-3 hours)

**Copy legacy widget:**
```bash
cp -r .legacy/widgets/clock/* js/widgets/clock/
```

**Update clock/index.html:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clock Widget</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="clock-widget">
        <div class="clock-widget__time" id="time">12:00</div>
        <div class="clock-widget__date" id="date">Monday, January 1</div>
    </div>

    <script type="module" src="widget.js"></script>
</body>
</html>
```

**Update clock/widget.js:**
```javascript
// Import logger if needed
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('ClockWidget');

class ClockWidget {
    constructor() {
        this.timeElement = document.getElementById('time');
        this.dateElement = document.getElementById('date');
        this.updateInterval = null;
        this.use24Hour = false;
    }

    initialize() {
        logger.info('Clock widget initializing');

        // Start updating time
        this.updateTime();
        this.updateInterval = setInterval(() => this.updateTime(), 1000);

        // Listen for config messages from main app
        window.addEventListener('message', (event) => {
            this.handleMessage(event.data);
        });

        // Send ready event to main app
        this.sendEvent('widget-ready', {
            hasMenu: false
        });

        logger.info('Clock widget ready');
    }

    updateTime() {
        const now = new Date();

        // Format time
        const hours = this.use24Hour
            ? now.getHours()
            : now.getHours() % 12 || 12;
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = this.use24Hour ? '' : (now.getHours() >= 12 ? ' PM' : ' AM');

        this.timeElement.textContent = `${hours}:${minutes}${ampm}`;

        // Format date
        const options = { weekday: 'long', month: 'long', day: 'numeric' };
        this.dateElement.textContent = now.toLocaleDateString('en-US', options);
    }

    handleMessage(message) {
        if (message.type === 'config') {
            if (message.payload.action === 'settings-update') {
                // Update time format if settings changed
                if (message.payload.settings.use24HourTime !== undefined) {
                    this.use24Hour = message.payload.settings.use24HourTime;
                    this.updateTime();
                }
            }
        }
    }

    sendEvent(eventType, data = {}) {
        window.parent.postMessage({
            type: 'event',
            widgetId: 'clock',
            payload: { eventType, data }
        }, '*');
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

// Initialize widget
const widget = new ClockWidget();
widget.initialize();
```

**Update clock/styles.css:**
```css
/* Widget container */
.clock-widget {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: var(--color-bg-secondary, #fff);
    border-radius: var(--border-radius-md, 8px);
    padding: var(--spacing-lg, 24px);
    color: var(--color-text-primary, #333);
}

/* Time display */
.clock-widget__time {
    font-size: 3rem;
    font-weight: bold;
    margin-bottom: var(--spacing-sm, 8px);
}

/* Date display */
.clock-widget__date {
    font-size: 1.2rem;
    color: var(--color-text-secondary, #666);
}

/* Dark theme support */
[data-theme="dark"] .clock-widget {
    background: var(--color-bg-secondary, #2a2a2a);
    color: var(--color-text-primary, #e0e0e0);
}
```

---

### Step 3: Integrate Widget into Dashboard (1-2 hours)

**Update index.html to include widget iframes:**
```html
<!-- Add this inside your dashboard container -->
<div class="dashboard-grid">
    <div class="dashboard-grid__cell" data-row="0" data-col="0">
        <iframe
            id="widget-clock"
            src="js/widgets/clock/index.html"
            class="widget-iframe"
            sandbox="allow-scripts allow-same-origin">
        </iframe>
    </div>

    <div class="dashboard-grid__cell" data-row="0" data-col="1">
        <iframe
            id="widget-calendar"
            src="js/widgets/calendar/index.html"
            class="widget-iframe"
            sandbox="allow-scripts allow-same-origin">
        </iframe>
    </div>

    <!-- Add more widget cells as needed -->
</div>
```

**Add CSS for widget iframes:**
```css
/* css/modules/dashboard.css */

.widget-iframe {
    width: 100%;
    height: 100%;
    border: none;
    border-radius: var(--border-radius-md, 8px);
    background: var(--color-bg-secondary, #fff);
}
```

---

### Step 4: Migrate Calendar Widget (4-6 hours)

**Copy legacy widget:**
```bash
cp -r .legacy/widgets/dcal/* js/widgets/calendar/
```

**Update calendar/widget.js to receive data via postMessage:**
```javascript
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('CalendarWidget');

class CalendarWidget {
    constructor() {
        this.events = [];
        this.eventsContainer = document.getElementById('events');
    }

    initialize() {
        logger.info('Calendar widget initializing');

        // Listen for messages from main app
        window.addEventListener('message', (event) => {
            this.handleMessage(event.data);
        });

        // Send ready event
        this.sendEvent('widget-ready', {
            hasMenu: true,
            menuItems: ['Today', 'Week', 'Month']
        });

        logger.info('Calendar widget ready');
    }

    handleMessage(message) {
        if (message.type === 'data' && message.payload.dataType === 'events') {
            logger.info('Received calendar events', { count: message.payload.data.length });
            this.events = message.payload.data;
            this.renderEvents();
        } else if (message.type === 'command') {
            this.handleCommand(message.payload.action);
        }
    }

    handleCommand(action) {
        // Handle navigation commands
        if (action === 'up' || action === 'down') {
            // Scroll through events
        } else if (action === 'enter') {
            // Open event details
        } else if (action === 'escape') {
            this.sendEvent('return-to-menu');
        }
    }

    renderEvents() {
        this.eventsContainer.innerHTML = '';

        if (this.events.length === 0) {
            this.eventsContainer.innerHTML = '<p class="no-events">No upcoming events</p>';
            return;
        }

        this.events.forEach(event => {
            const eventEl = this.createEventElement(event);
            this.eventsContainer.appendChild(eventEl);
        });
    }

    createEventElement(event) {
        const div = document.createElement('div');
        div.className = 'calendar-event';

        const title = document.createElement('div');
        title.className = 'calendar-event__title';
        title.textContent = event.summary || 'Untitled Event';

        const time = document.createElement('div');
        time.className = 'calendar-event__time';
        time.textContent = this.formatEventTime(event);

        div.appendChild(title);
        div.appendChild(time);

        return div;
    }

    formatEventTime(event) {
        if (event.start.dateTime) {
            const start = new Date(event.start.dateTime);
            return start.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit'
            });
        } else {
            return 'All day';
        }
    }

    sendEvent(eventType, data = {}) {
        window.parent.postMessage({
            type: 'event',
            widgetId: 'calendar',
            payload: { eventType, data }
        }, '*');
    }
}

// Initialize widget
const widget = new CalendarWidget();
widget.initialize();
```

---

### Step 5: Feed Data to Calendar Widget (2 hours)

**Create widget data manager in main app:**
```javascript
// js/core/widget-data-manager.js
import { createLogger } from '../utils/logger.js';
import { getCalendarService } from '../data/services/calendar-service.js';

const logger = createLogger('WidgetDataManager');

export class WidgetDataManager {
    constructor() {
        this.widgets = new Map();
        this.refreshIntervals = new Map();
    }

    registerWidget(widgetId, iframe) {
        this.widgets.set(widgetId, iframe);
        logger.info('Widget registered', { widgetId });

        // Listen for widget messages
        window.addEventListener('message', (event) => {
            if (event.data.widgetId === widgetId) {
                this.handleWidgetMessage(widgetId, event.data);
            }
        });
    }

    async handleWidgetMessage(widgetId, message) {
        if (message.type === 'event') {
            const { eventType, data } = message.payload;

            if (eventType === 'widget-ready') {
                logger.info('Widget ready', { widgetId });
                await this.loadWidgetData(widgetId);
            }
        }
    }

    async loadWidgetData(widgetId) {
        if (widgetId === 'calendar') {
            await this.loadCalendarData();
        }
    }

    async loadCalendarData() {
        try {
            logger.info('Loading calendar data');

            // Get calendar service
            const calendarService = getCalendarService();

            // Get events for next 7 days
            const now = new Date();
            const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            const events = await calendarService.getEvents(
                'primary',
                'primary',
                {
                    timeMin: now.toISOString(),
                    timeMax: endDate.toISOString(),
                    maxResults: 10,
                    singleEvents: true,
                    orderBy: 'startTime'
                }
            );

            logger.success('Calendar data loaded', { count: events.length });

            // Send events to widget
            this.sendToWidget('calendar', 'data', {
                dataType: 'events',
                data: events
            });

        } catch (error) {
            logger.error('Failed to load calendar data', error);
        }
    }

    sendToWidget(widgetId, messageType, payload) {
        const iframe = this.widgets.get(widgetId);
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: messageType,
                widgetId,
                payload
            }, '*');
        }
    }

    startAutoRefresh(widgetId, intervalMs = 300000) { // 5 minutes default
        if (this.refreshIntervals.has(widgetId)) {
            clearInterval(this.refreshIntervals.get(widgetId));
        }

        const interval = setInterval(() => {
            this.loadWidgetData(widgetId);
        }, intervalMs);

        this.refreshIntervals.set(widgetId, interval);
    }

    destroy() {
        this.refreshIntervals.forEach(interval => clearInterval(interval));
        this.refreshIntervals.clear();
        this.widgets.clear();
    }
}

// Export singleton
let widgetDataManagerInstance = null;

export function initializeWidgetDataManager() {
    if (!widgetDataManagerInstance) {
        widgetDataManagerInstance = new WidgetDataManager();
    }
    return widgetDataManagerInstance;
}

export function getWidgetDataManager() {
    if (!widgetDataManagerInstance) {
        throw new Error('WidgetDataManager not initialized');
    }
    return widgetDataManagerInstance;
}
```

**Use in index.html:**
```javascript
import { initializeWidgetDataManager } from './js/core/widget-data-manager.js';

// After widgets are loaded
const widgetDataManager = initializeWidgetDataManager();

// Register widgets
const clockIframe = document.getElementById('widget-clock');
const calendarIframe = document.getElementById('widget-calendar');

widgetDataManager.registerWidget('clock', clockIframe);
widgetDataManager.registerWidget('calendar', calendarIframe);

// Start auto-refresh for calendar (every 5 minutes)
widgetDataManager.startAutoRefresh('calendar', 300000);
```

---

## Testing Checklist

### Clock Widget
- [ ] Widget loads in iframe
- [ ] Time updates every second
- [ ] Date displays correctly
- [ ] Sends 'widget-ready' event
- [ ] Responds to settings changes (12h/24h toggle)

### Calendar Widget
- [ ] Widget loads in iframe
- [ ] Sends 'widget-ready' event
- [ ] Receives calendar events via postMessage
- [ ] Displays events correctly
- [ ] Shows event times
- [ ] Shows "No upcoming events" when empty
- [ ] Token refresh works (wait for expiry or force expire)

### Widget Communication
- [ ] postMessage works (app → widget)
- [ ] postMessage works (widget → app)
- [ ] WidgetDataManager receives 'widget-ready' events
- [ ] WidgetDataManager sends data to widgets
- [ ] Auto-refresh works (calendar updates every 5 min)

---

## Success Criteria

### Phase 3.5 Complete When:
- [ ] Clock widget displays current time
- [ ] Calendar widget displays real calendar events
- [ ] Widget communication protocol works
- [ ] Token refresh happens automatically
- [ ] Visual dashboard shows data
- [ ] No console errors
- [ ] Widgets are iframe-isolated

---

## Next Steps

When Phase 3.5 is complete, move to:
**Phase 4: Remaining Modules** (Settings, Login, Modals, Welcome)

See: `.reference/build-plans/Phase 4 - Remaining Modules.md`

---

**Get those widgets on screen and see your data come to life!** 🎨📅
