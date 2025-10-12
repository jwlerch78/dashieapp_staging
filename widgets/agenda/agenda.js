// widgets/agenda/agenda.js - Agenda Widget Implementation
// v2.0 - 10/11/25 - Updated to 3-state messaging protocol
// CHANGE SUMMARY: Added proper state transition handling (enter-focus/enter-active/exit-active/exit-focus)

import { createLogger } from '../../js/utils/logger.js';
import { AgendaEventModal } from './agenda_event.js';
import { DEFAULT_THEME } from '../../js/core/theme.js';


const logger = createLogger('AgendaWidget');

export class AgendaWidget {
  constructor() {
    this.calendarData = { events: [], calendars: [], lastUpdated: null };
    this.isDataLoaded = false;
    this.connectionStatus = 'connecting';
    this.currentTheme = null;

    // Event selection state - NEW: Two-part state model
    this.hasFocus = false;  // FOCUSED state (widget centered, has attention)
    this.isActive = false;  // ACTIVE state (receiving commands)
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

    // Initialize event modal with unified navigation
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
    let initialTheme = DEFAULT_THEME; // fallback

    // Try to detect theme from body class (applied by early theme loading)
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

    // Apply the detected theme immediately
    this.applyTheme(initialTheme);
    
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
      if (this.isActive) {
        this.updateSelectionHighlight();
      }
    });
  }

  // Handle navigation commands (following calendar.js pattern)
  handleCommand(action) {
    logger.debug('Agenda widget received command', { 
      action, 
      hasFocus: this.hasFocus,
      isActive: this.isActive 
    });

    // STEP 1: Handle state transition messages
    switch (action) {
      case 'enter-focus':
        // Widget is now FOCUSED (centered, has attention)
        this.handleEnterFocus();
        return;

      case 'enter-active':
        // Widget is now ACTIVE (can receive navigation)
        this.handleEnterActive();
        return;

      case 'exit-active':
        // Widget no longer active (shouldn't happen for widgets without menus)
        this.handleExitActive();
        return;

      case 'exit-focus':
        // Leave centered view entirely
        this.handleExitFocus();
        return;
    }

    // STEP 2: Handle navigation ONLY if ACTIVE
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
        if (this.selectedEventIndex >= 0) {
          this.showSelectedEventModal();
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

  handleDataServiceMessage(data) {
    switch (data.type) {
      case 'widget-update':
        if (data.action === 'state-update') {
          // Check if this update contains anything relevant to agenda widget
          const hasCalendarData = data.payload?.calendar;
          const hasTheme = data.payload?.theme;
          
          // Only log if update is relevant
          if (hasCalendarData || hasTheme) {
            logger.debug('Processing relevant state update', { hasCalendarData, hasTheme });
          }
          
          // Handle calendar data updates
          if (hasCalendarData) {
            this.handleCalendarData({
              events: data.payload.calendar.events || [],
              calendars: data.payload.calendar.calendars || [],
              lastUpdated: data.payload.calendar.lastUpdated
            });
          }
          
          // Handle theme updates
          if (hasTheme) {
            this.applyTheme(data.payload.theme);
          }
        }
        break;
        
      case 'theme-change':
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
    
    // Group events by day for day navigation
    this.eventsByDay = this.groupEventsByDay(agendaEvents);
    
    // Build chronological list in rendering order (fixes navigation order)
    this.chronologicalEvents = [];
    const dayKeys = Object.keys(this.eventsByDay).sort((a, b) => {
      return this.eventsByDay[a].date - this.eventsByDay[b].date;
    });

    dayKeys.forEach(dayKey => {
      const dayData = this.eventsByDay[dayKey];
      
      // Add all-day events first (matching rendering order)
      dayData.allDayEvents.forEach(event => {
        this.chronologicalEvents.push(event);
      });
      
      // Then add timed events (matching rendering order)  
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

  // Use pre-normalized dates from calendar service directly
  groupEventsByDay(events) {
    const eventsByDay = {};
    
    events.forEach(event => {
      const isAllDay = !!event.start.date;

      if (isAllDay) {
        // The calendar service has already normalized the dates correctly
        const startDateString = event.start.date;
        const endDateString = event.end.date;
        
        // Parse as local dates using the date parts directly
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
          
          // Move to next day
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
      } else {
        // For timed events, use the existing logic
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
        eventsHtml += this.renderEvent(event, true, false); // All-day events are never "past"
      });
      
      // For today, we need to insert the current time indicator at the right position
      if (isToday && dayData.timedEvents.length > 0) {
        let timeIndicatorInserted = false;
        
        dayData.timedEvents.forEach(event => {
          const isPast = this.isEventPast(event, now);
          
          // Insert current time indicator after the last past event (before first future event)
          if (!timeIndicatorInserted && !isPast) {
            eventsHtml += this.renderCurrentTimeIndicator(now);
            timeIndicatorInserted = true;
          }
          
          eventsHtml += this.renderEvent(event, false, isPast);
        });
        
        // If all events are past, add the indicator at the end
        if (!timeIndicatorInserted) {
          eventsHtml += this.renderCurrentTimeIndicator(now);
        }
      } else {
        // Not today, just render timed events normally
        dayData.timedEvents.forEach(event => {
          const isPast = this.isEventPast(event, now);
          eventsHtml += this.renderEvent(event, false, isPast);
        });
      }

      // Show "No events today" if today has no events
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
    // Format like "**Tuesday Sep 23**"
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const monthName = date.toLocaleDateString('en-US', { month: 'short' });
    const dayNum = date.getDate();
    
    return `<strong>${dayName} ${monthName} ${dayNum}</strong>`;
  }

  renderEvent(event, isAllDay, isPast = false) {
    const calendarColors = this.calendarColors.get(event.calendarId) || 
      { backgroundColor: '#1976d2', textColor: '#ffffff' };
    
    const timeDisplay = isAllDay ? 'All day' : this.formatEventStartTime(event);
    const pastClass = isPast ? 'event-past' : '';
    const eventClass = isAllDay ? `event-item all-day-event ${pastClass}` : `event-item ${pastClass}`;

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

  formatEventStartTime(event) {
    const startTime = new Date(event.start.dateTime);
    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();

    // Format time with smart AM/PM display and hide :00 for even hours
    const period = startHour >= 12 ? 'pm' : 'am';
    const displayHour = startHour === 0 ? 12 : startHour > 12 ? startHour - 12 : startHour;
    
    // Only show minutes if not :00
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

  /**
   * Apply theme - FIXED: Only apply if theme actually changed
   */
  applyTheme(theme) {
    // Skip if theme hasn't changed - prevents redundant applications
    if (this.currentTheme === theme) {
      return;
    }
    
    const previousTheme = this.currentTheme;
    this.currentTheme = theme;
    
    // Remove any existing theme classes
    document.body.classList.remove('theme-dark', 'theme-light');
    
    // Apply new theme class
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
    
    // Stop at boundaries - don't wrap
    if (newIndex < 0) {
      logger.debug('Navigation blocked at top boundary', { 
        direction, 
        currentIndex: this.selectedEventIndex,
        totalEvents: this.chronologicalEvents.length
      });
      
      // At top boundary, reset scroll to show day headers
      const container = document.getElementById('agendaContent');
      if (container) {
        container.scrollTop = 0;
      }
      return;
    }
    
    if (newIndex >= this.chronologicalEvents.length) {
      logger.debug('Navigation blocked at bottom boundary', { 
        direction, 
        currentIndex: this.selectedEventIndex,
        totalEvents: this.chronologicalEvents.length
      });
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

  }

  updateSelectionHighlight() {
    // Clear previous highlights
    this.clearSelectionHighlight();

    if (this.isActive && this.selectedEventIndex >= 0 && this.selectedEventIndex < this.chronologicalEvents.length) {
      const selectedEvent = this.chronologicalEvents[this.selectedEventIndex];
      const eventElement = this.findEventElementById(selectedEvent.id);
      
      if (eventElement) {
        eventElement.classList.add('selected');
        // Use the same highlight styling as the main navigation system
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
      
      // Update modal with current calendar colors
      this.eventModal.updateCalendarColors(this.calendarColors);
      
      // Show the modal
      this.eventModal.showModal(selectedEvent);
      

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