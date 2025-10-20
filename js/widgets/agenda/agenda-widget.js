// js/widgets/agenda/agenda-widget.js - Agenda Widget Implementation
// Displays upcoming calendar events in a vertical list format

import { createLogger } from '/js/utils/logger.js';
import { AgendaEventModal } from './agenda-event.js';
import { DEFAULT_THEME } from '/js/core/theme.js';

const logger = createLogger('AgendaWidget');

export class AgendaWidget {
  constructor() {
    this.calendarData = { events: [], calendars: [], lastUpdated: null };
    this.isDataLoaded = false;
    this.connectionStatus = 'connecting';
    this.currentTheme = null;

    // Event selection state - Two-part state model
    this.hasFocus = false;  // FOCUSED state (widget centered, has attention)
    this.isActive = false;  // ACTIVE state (receiving commands)
    this.selectedEventIndex = -1;
    this.chronologicalEvents = []; // Flattened list for navigation
    this.eventElements = []; // DOM elements for highlighting
    this.eventsByDay = {}; // Grouped events for day navigation

    // Calendar color mapping
    this.calendarColors = new Map();

    // Initialize event modal
    this.eventModal = new AgendaEventModal();

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.detectAndApplyInitialTheme();
    this.updateConnectionStatus('connecting');
  }

  /**
   * Detect initial theme from DOM or localStorage
   */
  detectAndApplyInitialTheme() {
    let initialTheme = DEFAULT_THEME;

    // Try to detect theme from body class
    if (document.body.classList.contains('theme-light')) {
      initialTheme = 'light';
    } else if (document.body.classList.contains('theme-dark')) {
      initialTheme = 'dark';
    } else {
      // Fallback: try localStorage
      try {
        const savedTheme = localStorage.getItem('dashie-theme');
        if (savedTheme && (savedTheme === 'dark' || savedTheme === 'light')) {
          initialTheme = savedTheme;
        }
      } catch (error) {
        logger.debug('Could not read theme from localStorage, using default');
      }
    }

    this.applyTheme(initialTheme);
  }

  setupEventListeners() {
    // Listen for messages from parent
    window.addEventListener('message', (event) => {
      if (!event.data) return;

      logger.debug('Agenda widget received message', { type: event.data.type, payload: event.data.payload });

      // Handle calendar data from widget-data-manager
      if (event.data.type === 'data' && event.data.payload?.dataType === 'calendar') {
        logger.debug('Received calendar data from parent', {
          events: event.data.payload.events?.length,
          calendars: event.data.payload.calendars?.length
        });

        this.handleCalendarData({
          events: event.data.payload.events || [],
          calendars: event.data.payload.calendars || [],
          lastUpdated: new Date().toISOString()
        });
        return;
      }

      // Handle command messages
      if (event.data.type === 'command') {
        const action = event.data.payload?.action || event.data.action;

        if (!action) {
          logger.warn('Command message missing action', event.data);
          return;
        }

        this.handleCommand(action);
        return;
      }

      // Handle theme changes
      if (event.data.type === 'theme-change') {
        this.applyTheme(event.data.theme);
        return;
      }
    });

    // Signal widget ready
    window.addEventListener('load', () => {
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'event',
          widgetId: 'agenda',
          payload: {
            eventType: 'widget-ready',
            data: { hasMenu: false }
          }
        }, '*');
        logger.debug('📤 Sent widget-ready message to parent');
      }
    });

    // Listen for modal closed event to restore focus
    window.addEventListener('modal-closed', () => {
      if (this.isActive) {
        this.updateSelectionHighlight();
      }
    });
  }

  // Handle navigation commands
  handleCommand(action) {
    logger.debug('Agenda widget received command', {
      action,
      hasFocus: this.hasFocus,
      isActive: this.isActive
    });

    // Handle state transition messages
    switch (action) {
      case 'enter-focus':
        this.handleEnterFocus();
        return;

      case 'enter-active':
        this.handleEnterActive();
        return;

      case 'exit-active':
        this.handleExitActive();
        return;

      case 'exit-focus':
        this.handleExitFocus();
        return;
    }

    // Handle navigation ONLY if ACTIVE
    if (!this.isActive) {
      logger.debug('Navigation command ignored - widget not active', { action });
      return;
    }

    // Handle agenda navigation commands
    switch (action) {
      case 'right':
        this.navigateToNextDay();
        break;

      case 'left':
        this.navigateToPrevDay();
        break;

      case 'up':
        this.navigateSelection(-1);
        break;

      case 'down':
        this.navigateSelection(1);
        break;

      case 'enter':
        logger.info('Enter pressed in agenda', {
          selectedEventIndex: this.selectedEventIndex,
          hasEvents: this.chronologicalEvents.length > 0
        });
        if (this.selectedEventIndex >= 0) {
          this.showSelectedEventModal();
        } else {
          logger.warn('No event selected for modal');
        }
        break;

      case 'back':
      case 'escape':
        this.clearSelectionHighlight();
        // Reset scroll to top
        const container = document.getElementById('agendaContent');
        if (container) {
          container.scrollTop = 0;
        }
        this.selectedEventIndex = -1;
        break;

      default:
        logger.debug('Unhandled command', { action });
        break;
    }
  }

  handleCalendarData(data) {
    // Merge multi-calendar events (events on multiple calendars get combined)
    const rawEvents = data.events || [];
    const mergedEvents = this.mergeMultiCalendarEvents(rawEvents);

    logger.debug('Event merge complete', {
      raw: rawEvents.length,
      merged: mergedEvents.length,
      multiCalendar: mergedEvents.filter(e => e.isMultiCalendar).length
    });

    // Store calendar data
    this.calendarData = {
      events: mergedEvents,
      calendars: data.calendars || [],
      lastUpdated: data.lastUpdated
    };

    // Update calendar colors from actual calendar data
    this.updateCalendarColors(data.calendars);

    this.isDataLoaded = true;
    this.updateConnectionStatus('connected');
    this.renderAgenda();

    logger.success('Calendar data loaded successfully', {
      eventsCount: this.calendarData.events.length,
      calendarsCount: this.calendarData.calendars.length,
      lastUpdated: this.calendarData.lastUpdated
    });
  }

  updateCalendarColors(calendars) {
    // Update color mapping from actual calendar data
    calendars.forEach(calendar => {
      this.calendarColors.set(calendar.id, {
        backgroundColor: calendar.backgroundColor || '#1976d2',
        textColor: calendar.foregroundColor || '#ffffff'
      });
    });

    logger.debug('Updated calendar colors', {
      calendarsCount: calendars.length,
      colorsCount: this.calendarColors.size
    });
  }

  /**
   * Merge multi-calendar events
   * Events that appear on multiple calendars get combined with all calendar colors
   * @param {Array} events - Array of events
   * @returns {Array} Events with multi-calendar info merged
   */
  mergeMultiCalendarEvents(events) {
    const eventMap = new Map();

    for (const event of events) {
      const identifier = this.generateEventIdentifier(event);

      if (!eventMap.has(identifier)) {
        // First occurrence - create base event with calendar array
        eventMap.set(identifier, {
          ...event,
          calendars: [{
            id: event.prefixedCalendarId || event.calendarId,
            backgroundColor: event.backgroundColor,
            foregroundColor: event.foregroundColor,
            name: event.calendarName || 'Calendar'
          }],
          isMultiCalendar: false
        });
      } else {
        // Duplicate - add this calendar to the existing event
        const existingEvent = eventMap.get(identifier);

        existingEvent.calendars.push({
          id: event.prefixedCalendarId || event.calendarId,
          backgroundColor: event.backgroundColor,
          foregroundColor: event.foregroundColor,
          name: event.calendarName || 'Calendar'
        });

        existingEvent.isMultiCalendar = true;
      }
    }

    const mergedEvents = Array.from(eventMap.values());

    const multiCalendarCount = mergedEvents.filter(e => e.isMultiCalendar).length;
    if (multiCalendarCount > 0) {
      logger.info('🎨 Multi-calendar events found', {
        total: mergedEvents.length,
        multiCalendar: multiCalendarCount,
        samples: mergedEvents
          .filter(e => e.isMultiCalendar)
          .slice(0, 5)
          .map(e => ({
            title: e.summary,
            calendars: e.calendars.map(c => ({ name: c.name, color: c.backgroundColor }))
          }))
      });
    }

    return mergedEvents;
  }

  /**
   * Generate a unique identifier for an event
   * Based on event title, start time, and end time
   * This catches duplicates across different calendars/accounts
   */
  generateEventIdentifier(event) {
    const title = (event.summary || '').toLowerCase().trim();
    const startTime = event.start?.dateTime || event.start?.date || '';
    const endTime = event.end?.dateTime || event.end?.date || '';

    return `${title}::${startTime}::${endTime}`;
  }

  renderAgenda() {
    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('agendaContent');

    if (!this.isDataLoaded || !this.calendarData.events.length) {
      loadingEl.style.display = this.isDataLoaded ? 'flex' : 'flex';
      loadingEl.textContent = this.isDataLoaded ? 'No upcoming events' : 'Loading agenda...';
      contentEl.style.display = 'none';
      return;
    }

    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';

    // Get events for next 14 days
    const agendaEvents = this.getNext14DaysEvents();

    // Group events by day for day navigation
    this.eventsByDay = this.groupEventsByDay(agendaEvents);

    // Build chronological list in rendering order
    this.chronologicalEvents = [];
    const dayKeys = Object.keys(this.eventsByDay).sort((a, b) => {
      return this.eventsByDay[a].date - this.eventsByDay[b].date;
    });

    dayKeys.forEach(dayKey => {
      const dayData = this.eventsByDay[dayKey];

      // Add all-day events first
      dayData.allDayEvents.forEach(event => {
        this.chronologicalEvents.push(event);
      });

      // Then add timed events
      dayData.timedEvents.forEach(event => {
        this.chronologicalEvents.push(event);
      });
    });

    // Render the agenda
    contentEl.innerHTML = this.renderEventsByDay(this.eventsByDay);

    // Cache event elements for selection highlighting
    this.cacheEventElements();

    // If widget is active, auto-select first event
    if (this.isActive && this.chronologicalEvents.length > 0) {
      this.selectedEventIndex = 0;
      this.updateSelectionHighlight();
    }

    logger.info('Agenda rendered', {
      totalEvents: agendaEvents.length,
      daysWithEvents: Object.keys(this.eventsByDay).length
    });
  }

  getNext14DaysEvents() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fourteenDaysFromNow = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));

    // Filter events from start of today through next 14 days
    const upcomingEvents = this.calendarData.events.filter(event => {
      const eventStart = new Date(event.start.dateTime || event.start.date);
      return eventStart >= startOfToday && eventStart <= fourteenDaysFromNow;
    });

    // Sort chronologically
    upcomingEvents.sort((a, b) => {
      const aStart = new Date(a.start.dateTime || a.start.date);
      const bStart = new Date(b.start.dateTime || b.start.date);
      return aStart - bStart;
    });

    return upcomingEvents;
  }

  groupEventsByDay(events) {
    const eventsByDay = {};

    events.forEach(event => {
      const isAllDay = !!event.start.date;

      if (isAllDay) {
        const startDateString = event.start.date;
        const endDateString = event.end.date;

        const [startYear, startMonth, startDay] = startDateString.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDateString.split('-').map(Number);

        const startDate = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
        const endDate = new Date(endYear, endMonth - 1, endDay, 12, 0, 0);

        // Add event to all days it spans
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dayKey = currentDate.toDateString();

          if (!eventsByDay[dayKey]) {
            eventsByDay[dayKey] = {
              date: new Date(currentDate),
              allDayEvents: [],
              timedEvents: []
            };
          }

          eventsByDay[dayKey].allDayEvents.push(event);

          currentDate.setDate(currentDate.getDate() + 1);
        }

      } else {
        const eventDateForGrouping = new Date(event.start.dateTime);
        const dayKey = eventDateForGrouping.toDateString();

        if (!eventsByDay[dayKey]) {
          eventsByDay[dayKey] = {
            date: eventDateForGrouping,
            allDayEvents: [],
            timedEvents: []
          };
        }

        eventsByDay[dayKey].timedEvents.push(event);
      }
    });

    return eventsByDay;
  }

  renderEventsByDay(eventsByDay) {
    const now = new Date();
    const today = new Date();
    const todayKey = today.toDateString();

    // Always ensure today is included, even if no events
    if (!eventsByDay[todayKey]) {
      eventsByDay[todayKey] = {
        date: today,
        allDayEvents: [],
        timedEvents: []
      };
    }

    const dayKeys = Object.keys(eventsByDay).sort((a, b) => {
      return eventsByDay[a].date - eventsByDay[b].date;
    });

    if (dayKeys.length === 0) {
      return '<div class="no-events">No events in the next 14 days</div>';
    }

    return dayKeys.map(dayKey => {
      const dayData = eventsByDay[dayKey];
      const isToday = dayKey === todayKey;
      const dayHeader = this.formatDayHeader(dayData.date);

      let eventsHtml = '';

      // Render all-day events first
      dayData.allDayEvents.forEach(event => {
        eventsHtml += this.renderEvent(event, true, false);
      });

      // For today, insert current time indicator at right position
      if (isToday && dayData.timedEvents.length > 0) {
        let timeIndicatorInserted = false;

        dayData.timedEvents.forEach(event => {
          const isPast = this.isEventPast(event, now);

          if (!timeIndicatorInserted && !isPast) {
            eventsHtml += this.renderCurrentTimeIndicator(now);
            timeIndicatorInserted = true;
          }

          eventsHtml += this.renderEvent(event, false, isPast);
        });

        if (!timeIndicatorInserted) {
          eventsHtml += this.renderCurrentTimeIndicator(now);
        }
      } else {
        dayData.timedEvents.forEach(event => {
          const isPast = this.isEventPast(event, now);
          eventsHtml += this.renderEvent(event, false, isPast);
        });
      }

      // Show "No events" if empty
      if (!eventsHtml && isToday) {
        eventsHtml = '<div class="no-events">No events today</div>';
      } else if (!eventsHtml) {
        eventsHtml = '<div class="no-events">No events</div>';
      }

      return `
        <div class="day-section">
          <div class="day-header">${dayHeader}</div>
          <div class="events-list">
            ${eventsHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  renderCurrentTimeIndicator(now) {
    return `
      <div class="current-time-indicator">
        <div class="current-time-line"></div>
      </div>
    `;
  }

  isEventPast(event, now) {
    const eventEnd = new Date(event.end?.dateTime);
    return eventEnd <= now;
  }

  formatDayHeader(date) {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const monthName = date.toLocaleDateString('en-US', { month: 'short' });
    const dayNum = date.getDate();

    return `<strong>${dayName} ${monthName} ${dayNum}</strong>`;
  }

  renderEvent(event, isAllDay, isPast = false) {
    const timeDisplay = isAllDay ? 'All day' : this.formatEventStartTime(event);
    const pastClass = isPast ? 'event-past' : '';
    const eventClass = isAllDay ? `event-item all-day-event ${pastClass}` : `event-item ${pastClass}`;

    // Render multiple dots if event is on multiple calendars
    let dotsHtml = '';
    if (event.calendars && event.calendars.length > 0) {
      // Get unique colors only (deduplicate same colors)
      const uniqueColors = [...new Set(event.calendars.map(cal => cal.backgroundColor))];

      // Multi-calendar event - show a dot for each unique color, centered
      const dots = uniqueColors
        .map(color => `<div class="event-dot" style="background-color: ${color}"></div>`)
        .join('');
      dotsHtml = `<div class="event-dots-container">${dots}</div>`;
    } else {
      // Single calendar event - fallback to old behavior
      const calendarColors = this.calendarColors.get(event.calendarId) ||
        { backgroundColor: '#1976d2', textColor: '#ffffff' };
      dotsHtml = `<div class="event-dots-container"><div class="event-dot" style="background-color: ${calendarColors.backgroundColor}"></div></div>`;
    }

    return `
      <div class="${eventClass}" data-event-id="${event.id}">
        <div class="event-time">${timeDisplay}</div>
        <div class="event-details">
          ${dotsHtml}
          <div class="event-title">${this.escapeHtml(event.summary || 'No title')}</div>
        </div>
      </div>
    `;
  }

  formatEventStartTime(event) {
    const startTime = new Date(event.start.dateTime);
    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();

    const period = startHour >= 12 ? 'pm' : 'am';
    const displayHour = startHour === 0 ? 12 : startHour > 12 ? startHour - 12 : startHour;

    const timeString = startMinute === 0 ? displayHour.toString() : `${displayHour}:${startMinute.toString().padStart(2, '0')}`;

    return `${timeString}${period}`;
  }

  updateConnectionStatus(status) {
    this.connectionStatus = status;
    const indicator = document.getElementById('statusIndicator');
    if (indicator) {
      indicator.className = `status-indicator ${status}`;
    }

    logger.debug('Connection status updated', { status });
  }

  applyTheme(theme) {
    if (this.currentTheme === theme) {
      return;
    }

    const previousTheme = this.currentTheme;
    this.currentTheme = theme;

    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(`theme-${theme}`);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== FOCUS AND SELECTION METHODS ====================

  handleEnterFocus() {
    logger.info('Agenda entered FOCUSED state');
    this.hasFocus = true;
    this.isActive = false;
  }

  handleEnterActive() {
    logger.info('Agenda entered ACTIVE state');
    this.isActive = true;

    // Auto-select first event if available
    if (this.chronologicalEvents.length > 0 && this.selectedEventIndex === -1) {
      this.selectedEventIndex = 0;
      this.updateSelectionHighlight();
      this.scrollToSelectedEvent();
    }
  }

  handleExitActive() {
    logger.info('Agenda exited ACTIVE state');
    this.isActive = false;
    this.clearSelectionHighlight();
  }

  handleExitFocus() {
    logger.info('Agenda exited FOCUSED state');
    this.hasFocus = false;
    this.isActive = false;

    // Full cleanup
    this.selectedEventIndex = -1;
    this.clearSelectionHighlight();

    // Reset scroll to top
    const container = document.getElementById('agendaContent');
    if (container) {
      container.scrollTop = 0;
    }
  }

  cacheEventElements() {
    this.eventElements = Array.from(document.querySelectorAll('.event-item'));
    logger.debug('Cached event elements', { count: this.eventElements.length });
  }

  navigateSelection(direction) {
    if (!this.isActive || this.chronologicalEvents.length === 0) return;

    const oldIndex = this.selectedEventIndex;
    const newIndex = this.selectedEventIndex + direction;

    // Stop at boundaries
    if (newIndex < 0) {
      logger.debug('Navigation blocked at top boundary');

      const container = document.getElementById('agendaContent');
      if (container) {
        container.scrollTop = 0;
      }
      return;
    }

    if (newIndex >= this.chronologicalEvents.length) {
      logger.debug('Navigation blocked at bottom boundary');
      return;
    }

    this.selectedEventIndex = newIndex;

    logger.debug('Navigation selection', {
      direction,
      oldIndex,
      newIndex: this.selectedEventIndex,
      totalEvents: this.chronologicalEvents.length
    });

    this.updateSelectionHighlight();
    this.scrollToSelectedEvent();
  }

  navigateToNextDay() {
    if (!this.isActive || this.chronologicalEvents.length === 0) return;

    const currentEvent = this.chronologicalEvents[this.selectedEventIndex];
    if (!currentEvent) return;

    const currentEventDate = new Date(currentEvent.start.dateTime || currentEvent.start.date).toDateString();

    // Find first event of next day
    let nextDayIndex = -1;
    for (let i = this.selectedEventIndex + 1; i < this.chronologicalEvents.length; i++) {
      const eventDate = new Date(this.chronologicalEvents[i].start.dateTime || this.chronologicalEvents[i].start.date).toDateString();
      if (eventDate !== currentEventDate) {
        nextDayIndex = i;
        break;
      }
    }

    if (nextDayIndex >= 0) {
      this.selectedEventIndex = nextDayIndex;
      this.updateSelectionHighlight();
      this.scrollToSelectedEvent();
    }
  }

  navigateToPrevDay() {
    if (!this.isActive || this.chronologicalEvents.length === 0) return;

    const currentEvent = this.chronologicalEvents[this.selectedEventIndex];
    if (!currentEvent) return;

    const currentEventDate = new Date(currentEvent.start.dateTime || currentEvent.start.date).toDateString();

    // Find first event of current day
    let currentDayStart = this.selectedEventIndex;
    while (currentDayStart > 0) {
      const prevEventDate = new Date(this.chronologicalEvents[currentDayStart - 1].start.dateTime || this.chronologicalEvents[currentDayStart - 1].start.date).toDateString();
      if (prevEventDate !== currentEventDate) {
        break;
      }
      currentDayStart--;
    }

    // If already at first event of current day, go to previous day
    if (currentDayStart === this.selectedEventIndex && currentDayStart > 0) {
      const targetDate = new Date(this.chronologicalEvents[currentDayStart - 1].start.dateTime || this.chronologicalEvents[currentDayStart - 1].start.date).toDateString();

      for (let i = currentDayStart - 1; i >= 0; i--) {
        const eventDate = new Date(this.chronologicalEvents[i].start.dateTime || this.chronologicalEvents[i].start.date).toDateString();
        if (eventDate === targetDate) {
          this.selectedEventIndex = i;
        } else {
          break;
        }
      }
    } else {
      this.selectedEventIndex = currentDayStart;
    }

    this.updateSelectionHighlight();
    this.scrollToSelectedEvent();
  }

  updateSelectionHighlight() {
    this.clearSelectionHighlight();

    if (this.isActive && this.selectedEventIndex >= 0 && this.selectedEventIndex < this.chronologicalEvents.length) {
      // Use index directly since chronologicalEvents and eventElements are built in same order
      const eventElement = this.eventElements[this.selectedEventIndex];

      if (eventElement) {
        eventElement.classList.add('selected');
      }
    }
  }

  clearSelectionHighlight() {
    this.eventElements.forEach(element => {
      element.classList.remove('selected');
    });
  }

  showSelectedEventModal() {
    if (this.selectedEventIndex >= 0 && this.selectedEventIndex < this.chronologicalEvents.length) {
      const selectedEvent = this.chronologicalEvents[this.selectedEventIndex];

      logger.info('Opening event modal', {
        eventTitle: selectedEvent.summary,
        eventId: selectedEvent.id
      });

      // Update modal with current calendar colors
      this.eventModal.updateCalendarColors(this.calendarColors);

      // Show the modal
      this.eventModal.showModal(selectedEvent);
    } else {
      logger.warn('Cannot show modal - invalid event index', {
        selectedEventIndex: this.selectedEventIndex,
        totalEvents: this.chronologicalEvents.length
      });
    }
  }

  findEventElementById(eventId) {
    return this.eventElements.find(element =>
      element.getAttribute('data-event-id') === eventId
    );
  }

  scrollToSelectedEvent() {
    if (this.selectedEventIndex >= 0 && this.selectedEventIndex < this.chronologicalEvents.length) {
      // Use index directly since chronologicalEvents and eventElements are built in same order
      const eventElement = this.eventElements[this.selectedEventIndex];

      if (eventElement) {
        const container = document.getElementById('agendaContent');
        const containerRect = container.getBoundingClientRect();
        const eventRect = eventElement.getBoundingClientRect();

        // Check if event is outside visible area
        if (eventRect.top < containerRect.top || eventRect.bottom > containerRect.bottom) {
          eventElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }
    }
  }
}

// Initialize the widget
new AgendaWidget();
