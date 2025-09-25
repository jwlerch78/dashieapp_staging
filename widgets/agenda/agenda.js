// widgets/agenda/agenda.js - Agenda Widget Implementation
// CHANGE SUMMARY: Added event selection mode with right arrow key, keyboard navigation, and modal integration

import { createLogger } from '../../js/utils/logger.js';
//import { AgendaEventModal } from './agenda_event.js';

const logger = createLogger('AgendaWidget');

export class AgendaWidget {
  constructor() {
    this.calendarData = { events: [], calendars: [], lastUpdated: null };
    this.isDataLoaded = false;
    this.connectionStatus = 'connecting';
    this.currentTheme = 'dark';

    // Event selection state - now auto-enters selection mode when focused
    this.isFocused = false;
    this.selectedEventIndex = -1;
    this.chronologicalEvents = []; // Flattened list for navigation
    this.eventElements = []; // DOM elements for highlighting
    this.eventsByDay = {}; // Grouped events for day navigation

    // Calendar color mapping - matches the calendar widget configuration
    this.calendarColors = new Map([
      ['jwlerch@gmail.com', { backgroundColor: '#1976d2', textColor: '#ffffff' }],
      ['fd5949d42a667f6ca3e88dcf1feb27818463bbdc19c5e56d2e0da62b87d881c5@group.calendar.google.com', 
       { backgroundColor: '#388e3c', textColor: '#ffffff' }]
    ]);

    // Initialize event modal
    //this.eventModal = new AgendaEventModal();

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.updateConnectionStatus('connecting');
    logger.info('Agenda widget initialized');
  }



  setupEventListeners() {
    // Listen for widget-messenger communications
    window.addEventListener('message', (event) => {
      // Handle navigation commands (single action strings)
      if (event.data && typeof event.data.action === 'string' && !event.data.type) {
        this.handleCommand(event.data.action);
      }
      // Handle message objects with type
      if (event.data && event.data.type) {
        this.handleDataServiceMessage(event.data);
      }
    });

    // Signal widget ready
    window.addEventListener('load', () => {
      if (window.parent !== window) {
        window.parent.postMessage({ 
          type: 'widget-ready', 
          widget: 'agenda' 
        }, '*');
      }
    });

    // Listen for modal closed event to restore focus
    window.addEventListener('modal-closed', () => {
      if (this.isFocused) {
        this.updateSelectionHighlight();
      }
    });
  }

  // Handle navigation commands (following calendar.js pattern)
  handleCommand(action) {
    logger.debug('Agenda widget received command', { action, isFocused: this.isFocused });

    // First check if modal should handle the command
    if (this.eventModal.isVisible && this.eventModal.handleCommand(action)) {
      return; // Modal handled the command
    }

    // Receiving any command means we're focused - auto-enter selection if not already
    if (!this.isFocused) {
      this.handleFocusChange(true);
    }

    // Handle agenda navigation commands
    switch (action) {
      case 'right':
        if (this.isFocused) {
          this.navigateToNextDay();
        }
        break;

      case 'left':
        if (this.isFocused) {
          this.navigateToPrevDay();
        }
        break;

      case 'up':
        if (this.isFocused) {
          this.navigateSelection(-1);
        }
        break;

      case 'down':
        if (this.isFocused) {
          this.navigateSelection(1);
        }
        break;

      case 'select':
        if (this.isFocused && this.selectedEventIndex >= 0) {
          this.showSelectedEventModal();
        }
        break;

      case 'back':
        // Back/escape clears focus (user navigating away from widget)
        if (this.isFocused) {
          this.handleFocusChange(false);
        }
        break;

      default:
        logger.debug('Unhandled command', { action });
        break;
    }
  }

  handleDataServiceMessage(data) {
    logger.debug('Agenda widget received message', { type: data.type, hasPayload: !!data.payload });
    
    switch (data.type) {
      case 'widget-update':
        if (data.action === 'state-update' && data.payload?.calendar) {
          logger.success('Calendar data received', {
            eventsCount: data.payload.calendar.events?.length,
            calendarsCount: data.payload.calendar.calendars?.length,
            lastUpdated: data.payload.calendar.lastUpdated
          });
          
          this.handleCalendarData({
            events: data.payload.calendar.events || [],
            calendars: data.payload.calendar.calendars || [],
            lastUpdated: data.payload.calendar.lastUpdated
          });
        }

        // Handle theme updates
        if (data.payload?.theme && data.payload.theme !== this.currentTheme) {
          this.applyTheme(data.payload.theme);
        }
        break;
        
      case 'theme-change':
        logger.info('Applying theme change', { theme: data.theme });
        this.applyTheme(data.theme);
        break;
        
      default:
        logger.debug('Unhandled message type', { type: data.type });
        break;
    }
  }

  handleCalendarData(data) {
    // Store calendar data - should already be deduplicated by the data manager
    this.calendarData = {
      events: data.events || [],
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
    
    // Store chronological events for navigation
    this.chronologicalEvents = [...agendaEvents];
    
    // Group events by day for day navigation
    this.eventsByDay = this.groupEventsByDay(agendaEvents);
    
    // Render the agenda
    contentEl.innerHTML = this.renderEventsByDay(this.eventsByDay);

    // Cache event elements for selection highlighting
    this.cacheEventElements();

    // If widget is focused, auto-select first event
    if (this.isFocused && this.chronologicalEvents.length > 0) {
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
    const fourteenDaysFromNow = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));

    // Filter events within the next 14 days
    const upcomingEvents = this.calendarData.events.filter(event => {
      const eventStart = new Date(event.start.dateTime || event.start.date);
      return eventStart >= now && eventStart <= fourteenDaysFromNow;
    });

    // Sort chronologically
    upcomingEvents.sort((a, b) => {
      const aStart = new Date(a.start.dateTime || a.start.date);
      const bStart = new Date(b.start.dateTime || b.start.date);
      return aStart - bStart;
    });

    logger.debug('Filtered events for next 14 days', {
      originalCount: this.calendarData.events.length,
      filteredCount: upcomingEvents.length
    });

    return upcomingEvents;
  }

  groupEventsByDay(events) {
    const eventsByDay = {};

    events.forEach(event => {
      const eventStart = new Date(event.start.dateTime || event.start.date);
      const dayKey = eventStart.toDateString(); // "Tue Sep 24 2024"

      if (!eventsByDay[dayKey]) {
        eventsByDay[dayKey] = {
          date: eventStart,
          allDayEvents: [],
          timedEvents: []
        };
      }

      const isAllDay = !!event.start.date;
      if (isAllDay) {
        eventsByDay[dayKey].allDayEvents.push(event);
      } else {
        eventsByDay[dayKey].timedEvents.push(event);
      }
    });

    // Sort timed events within each day
    Object.values(eventsByDay).forEach(dayData => {
      dayData.timedEvents.sort((a, b) => {
        const aStart = new Date(a.start.dateTime);
        const bStart = new Date(b.start.dateTime);
        return aStart - bStart;
      });
    });

    return eventsByDay;
  }

  renderEventsByDay(eventsByDay) {
    const dayKeys = Object.keys(eventsByDay).sort((a, b) => {
      return eventsByDay[a].date - eventsByDay[b].date;
    });

    if (dayKeys.length === 0) {
      return '<div class="no-events">No events in the next 14 days</div>';
    }

    return dayKeys.map(dayKey => {
      const dayData = eventsByDay[dayKey];
      const dayHeader = this.formatDayHeader(dayData.date);
      
      let eventsHtml = '';
      
      // Render all-day events first
      dayData.allDayEvents.forEach(event => {
        eventsHtml += this.renderEvent(event, true);
      });
      
      // Then render timed events
      dayData.timedEvents.forEach(event => {
        eventsHtml += this.renderEvent(event, false);
      });

      if (!eventsHtml) {
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

  formatDayHeader(date) {
    // Format like "**Tuesday Sep 23**"
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const monthName = date.toLocaleDateString('en-US', { month: 'short' });
    const dayNum = date.getDate();
    
    return `<strong>${dayName} ${monthName} ${dayNum}</strong>`;
  }

  renderEvent(event, isAllDay) {
    const calendarColors = this.calendarColors.get(event.calendarId) || 
      { backgroundColor: '#1976d2', textColor: '#ffffff' };
    
    const timeDisplay = isAllDay ? 'All day' : this.formatEventTime(event);
    const eventClass = isAllDay ? 'event-item all-day-event' : 'event-item';

    return `
      <div class="${eventClass}" data-event-id="${event.id}">
        <div class="event-time">${timeDisplay}</div>
        <div class="event-details">
          <div class="event-dot" style="background-color: ${calendarColors.backgroundColor}"></div>
          <div class="event-title">${this.escapeHtml(event.summary || 'No title')}</div>
        </div>
      </div>
    `;
  }

  formatEventTime(event) {
    const startTime = new Date(event.start.dateTime);
    const endTime = new Date(event.end.dateTime);

    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();
    const endHour = endTime.getHours();
    const endMinute = endTime.getMinutes();

    // Format time with smart AM/PM display and hide :00 for even hours
    const formatTime = (hour, minute, showPeriod = true) => {
      const period = hour >= 12 ? 'pm' : 'am';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      
      // Only show minutes if not :00
      const timeString = minute === 0 ? displayHour.toString() : `${displayHour}:${minute.toString().padStart(2, '0')}`;
      
      if (showPeriod) {
        return `${timeString}${period}`;
      } else {
        return timeString;
      }
    };

    // Determine if we need to show AM/PM for both times
    const startPeriod = startHour >= 12 ? 'pm' : 'am';
    const endPeriod = endHour >= 12 ? 'pm' : 'am';
    const samePeriod = startPeriod === endPeriod;

    if (samePeriod) {
      // Same period - show AM/PM only at the end
      return `${formatTime(startHour, startMinute, false)} - ${formatTime(endHour, endMinute, true)}`;
    } else {
      // Different periods - show AM/PM for both
      return `${formatTime(startHour, startMinute, true)} - ${formatTime(endHour, endMinute, true)}`;
    }
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
    this.currentTheme = theme;
    document.body.className = `theme-${theme}`;
    
    logger.info('Theme applied', { theme });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== FOCUS AND SELECTION METHODS ====================

  handleFocusChange(focused) {
    const wasFocused = this.isFocused;
    this.isFocused = focused;

    if (focused && !wasFocused) {
      // Widget gained focus - auto-select first event if available
      if (this.chronologicalEvents.length > 0) {
        this.selectedEventIndex = 0;
        this.updateSelectionHighlight();
        logger.info('Widget focused - auto-selected first event');
      }
    } else if (!focused && wasFocused) {
      // Widget lost focus - clear selection
      this.selectedEventIndex = -1;
      this.clearSelectionHighlight();
      logger.info('Widget lost focus - cleared selection');
    }
  }

  cacheEventElements() {
    this.eventElements = Array.from(document.querySelectorAll('.event-item'));
    logger.debug('Cached event elements', { count: this.eventElements.length });
  }

  navigateSelection(direction) {
    if (!this.isFocused || this.chronologicalEvents.length === 0) return;

    const newIndex = this.selectedEventIndex + direction;
    
    if (newIndex >= 0 && newIndex < this.chronologicalEvents.length) {
      this.selectedEventIndex = newIndex;
      this.updateSelectionHighlight();
      this.scrollToSelectedEvent();
      
      logger.debug('Navigation selection', { 
        direction, 
        newIndex: this.selectedEventIndex,
        totalEvents: this.chronologicalEvents.length
      });
    }
  }

  navigateToNextDay() {
    if (!this.isFocused || this.chronologicalEvents.length === 0) return;

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
      logger.info('Navigated to next day', { newIndex: this.selectedEventIndex });
    }
  }

  navigateToPrevDay() {
    if (!this.isFocused || this.chronologicalEvents.length === 0) return;

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

    // If we're already at the first event of current day, go to previous day
    if (currentDayStart === this.selectedEventIndex && currentDayStart > 0) {
      // Find first event of previous day
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
      // Go to first event of current day
      this.selectedEventIndex = currentDayStart;
    }

    this.updateSelectionHighlight();
    this.scrollToSelectedEvent();
    logger.info('Navigated to previous day', { newIndex: this.selectedEventIndex });
  }

  updateSelectionHighlight() {
    // Clear previous highlights
    this.clearSelectionHighlight();

    if (this.isFocused && this.selectedEventIndex >= 0 && this.selectedEventIndex < this.chronologicalEvents.length) {
      const selectedEvent = this.chronologicalEvents[this.selectedEventIndex];
      const eventElement = this.findEventElementById(selectedEvent.id);
      
      if (eventElement) {
        eventElement.classList.add('selected');
        // Use the same highlight styling as the main navigation system
        eventElement.style.background = 'var(--text-muted)';
        eventElement.style.borderRadius = '4px';
        eventElement.style.padding = '2px 4px';
        eventElement.style.margin = '1px 0';
      }
    }
  }

  clearSelectionHighlight() {
    this.eventElements.forEach(element => {
      element.classList.remove('selected');
      element.style.background = '';
      element.style.borderRadius = '';
      element.style.padding = '';
      element.style.margin = '';
    });
  }

  showSelectedEventModal() {
    if (this.selectedEventIndex >= 0 && this.selectedEventIndex < this.chronologicalEvents.length) {
      const selectedEvent = this.chronologicalEvents[this.selectedEventIndex];
      
      // Update modal with current calendar colors
      this.eventModal.updateCalendarColors(this.calendarColors);
      
      // Show the modal
      this.eventModal.showModal(selectedEvent);
      
      logger.info('Showing event modal', { 
        eventTitle: selectedEvent.summary,
        eventIndex: this.selectedEventIndex 
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
      const selectedEvent = this.chronologicalEvents[this.selectedEventIndex];
      const eventElement = this.findEventElementById(selectedEvent.id);
      
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