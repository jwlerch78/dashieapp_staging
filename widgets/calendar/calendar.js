// widgets/calendar/calendar.js - Main Calendar Widget Class
// CHANGE SUMMARY: Enhanced scroll positioning logic - intelligent time-based scrolling instead of extremes, replaces scrollToTime(8) and changeView scrollToTime(14)

import { createLogger } from '../../js/utils/logger.js';
import { CalendarConfig } from './calendar-config.js';
import { CalendarEvents } from './calendar-events.js';
import { CalendarLayout } from './calendar-layout.js';

const logger = createLogger('CalendarWidget');

export class CalendarWidget {
  constructor() {
    // ============== CONFIG VARIABLES ==============
    
    // Hard-coded Google calendar IDs you're using
    this.GOOGLE_CALENDARS = [
      { id: 'jwlerch@gmail.com', summary: 'jwlerch@gmail.com', color: '#1976d2', textColor: '#ffffff' },
      { id: 'fd5949d42a667f6ca3e88dcf1feb27818463bbdc19c5e56d2e0da62b87d881c5@group.calendar.google.com', summary: 'Veeva', color: '#388e3c', textColor: '#ffffff' }
    ];

    // Build TUI calendar definitions initially
    this.tuiCalendars = this.GOOGLE_CALENDARS.map(cal => ({
      id: cal.id, // real Google ID here
      name: cal.summary,
      backgroundColor: cal.color,
      borderColor: cal.color,
      color: cal.textColor
    }));

    this.calendar = null;
    this.currentView = 'week';
    this.currentDate = new Date();
    this.viewCycle = ['week', 'month', 'day'];  // Changed 'daily' to 'day' to match TUI Calendar

    this.calendarData = { events: [], calendars: [], lastUpdated: null };
    this.isDataLoaded = false;
    this.connectionStatus = 'connecting';

    // Initialize helper modules
    this.config = new CalendarConfig(this.tuiCalendars);
    this.events = new CalendarEvents(this.tuiCalendars);
    this.layout = new CalendarLayout();

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupKeyboardControls();  // Added missing keyboard controls
    this.setupUI();
    setTimeout(() => this.initializeCalendar(), 100);
  }

  setupKeyboardControls() {
    document.addEventListener('keydown', (e) => {
      // Skip if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.cycleView('forward');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.navigateCalendar('previous');
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.navigateCalendar('next');
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.scrollCalendar('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.scrollCalendar('down');
          break;
      }
    });
  }

  setupEventListeners() {
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

    window.addEventListener('load', () => {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'widget-ready', widget: 'calendar' }, '*');
      }
    });
  }

  setupUI() {
    document.body.innerHTML = `
      <div class="calendar-zoom-container">
        <div id="calendar-container">
          <div class="calendar-header" id="calendarHeader" style="display: none;">
            <div class="calendar-title" id="calendarTitle">Loading...</div>
            <div class="calendar-mode" id="calendarMode">Week</div>
          </div>
          <div id="calendar"></div>
          <div class="loading" id="loading">Initializing calendar...</div>
          <div class="status">○</div>
          <div class="controls-info">Space: Change View | ←→: Navigate | ↑↓: Scroll</div>
        </div>
      </div>
    `;
  }

  // Message handling for widget-messenger system
  handleDataServiceMessage(data) {
    logger.debug('Calendar widget received message', { type: data.type, hasPayload: !!data.payload });
    
    switch (data.type) {
      case 'widget-update':
        logger.info('Processing widget-update', { action: data.action });
        logger.debug('Payload structure', data.payload);
        logger.info('Calendar data available', { hasCalendarData: !!data.payload?.calendar });
        
        if (data.action === 'state-update' && data.payload?.calendar) {
          logger.success('Calendar data details', {
            eventsCount: data.payload.calendar.events?.length,
            calendarsCount: data.payload.calendar.calendars?.length,
            lastUpdated: data.payload.calendar.lastUpdated
          });
          
          this.handleCalendarData({
            events: data.payload.calendar.events || [],
            calendars: data.payload.calendar.calendars || [],
            lastUpdated: data.payload.calendar.lastUpdated
          });
        } else if (data.action === 'state-update' && !data.payload?.calendar) {
          logger.warn('No calendar data in payload', { 
            payloadKeys: Object.keys(data.payload || {}),
            hasPayload: !!data.payload 
          });
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
    if (data.status === 'error') {
      this.updateConnectionStatus('error');
      logger.error('Calendar data error', { error: data.status });
      return;
    }

    // Store raw calendar data
    const rawCalendarData = {
      events: data.events || [],
      calendars: data.calendars || [],
      lastUpdated: data.lastUpdated
    };

    // Deduplicate events at the main widget level so both modules work with clean data
    const deduplicatedEvents = this.events.deduplicateEvents(rawCalendarData.events);
    logger.info('Event deduplication complete at widget level', {
      originalCount: rawCalendarData.events.length,
      deduplicatedCount: deduplicatedEvents.length,
      duplicatesRemoved: rawCalendarData.events.length - deduplicatedEvents.length
    });

    // Store deduplicated calendar data for use by all modules
    this.calendarData = {
      events: deduplicatedEvents,
      calendars: rawCalendarData.calendars,
      lastUpdated: rawCalendarData.lastUpdated
    };
    
    this.isDataLoaded = true;
    this.updateConnectionStatus('connected');

    logger.success('Calendar data loaded successfully', {
      eventsCount: this.calendarData.events.length,
      calendarsCount: this.calendarData.calendars.length,
      lastUpdated: this.calendarData.lastUpdated
    });

    // Update calendar configurations
    this.updateCalendarConfigurations();
    
    // Load events using the events module (will skip deduplication since already done)
    this.events.loadEventsIntoCalendar(this.calendar, this.calendarData);
    this.updateCalendarHeader();
  }

  updateCalendarConfigurations() {
    // Merge Google's actual colors if provided by the centralized service
    this.tuiCalendars = this.GOOGLE_CALENDARS.map((cal) => {
      const remoteCal = this.calendarData.calendars.find(rc => rc.id === cal.id || rc.summary === cal.summary);
      return {
        id: cal.id,
        name: cal.summary,
        backgroundColor: remoteCal?.backgroundColor || cal.color,
        borderColor: remoteCal?.backgroundColor || cal.color,
        color: remoteCal?.foregroundColor || cal.textColor
      };
    });

    // Update configurations in helper modules
    this.config.updateCalendars(this.tuiCalendars);
    this.events.updateCalendars(this.tuiCalendars);
  }

  async initializeCalendar() {
    try {
      // ensure we start on the week's Monday
      const monday = this.getStartOfWeek(this.currentDate);
      this.currentDate = monday;

      // Get calendar configuration from config module
      const calendarOptions = this.config.getCalendarOptions(this.currentView);

      // Create TUI Calendar
      this.calendar = new tui.Calendar('#calendar', calendarOptions);

      // Set initial date and show UI
      this.calendar.setDate(this.currentDate);
      this.showCalendar();
      this.updateCalendarHeader();

      // Setup calendar event listeners
      this.setupCalendarEventListeners();

      logger.info('TUI Calendar initialized - waiting for state updates...');

      // ENHANCED: Apply intelligent scroll positioning after initialization
      setTimeout(() => this.setOptimalScrollPosition(), 200);

    } catch (error) {
      logger.error('Failed to initialize calendar', error);
      const loader = document.getElementById('loading');
      if (loader) loader.textContent = 'Failed to load calendar';
    }
  }

  /**
   * Simple scroll positioning using the working scroll container logic
   */
  setOptimalScrollPosition() {
    if (this.currentView === 'week' || this.currentView === 'day') {
      // Use the same container logic that works for scrollCalendar
      const scrollContainer = document.querySelector('.toastui-calendar-time-scroll-wrapper')
        || document.querySelector('.toastui-calendar-time')
        || document.querySelector('.toastui-calendar-timegrid-scroll-area');
      
      if (scrollContainer) {
        // Set to a fixed position - roughly 11am (about 45% down the day)
        const targetScrollTop = scrollContainer.scrollHeight * 0.45;
        scrollContainer.scrollTop = targetScrollTop;
        logger.debug('Set scroll position using working container logic', { 
          targetScrollTop, 
          scrollHeight: scrollContainer.scrollHeight 
        });
      }
    }
  }

  setupCalendarEventListeners() {
    // When TUI finishes rendering the view, update header and layout
    this.calendar.on && this.calendar.on('afterRender', () => {
      this.updateCalendarHeader();
      this.layout.updateAllDayHeight(this.calendar, this.currentView, this.calendarData, this.currentDate);
      
      // ENHANCED: Apply optimal scroll positioning after renders too
      setTimeout(() => this.setOptimalScrollPosition(), 100);
    });

    // After schedules are rendered (new events added), recalc all-day height
    if (this.calendar.on) {
      this.calendar.on('afterRenderSchedule', () => {
        this.layout.updateAllDayHeight(this.calendar, this.currentView, this.calendarData, this.currentDate);
      });
    }

    // If user clicks "more" or expands, recalc
    if (this.calendar.on) {
      this.calendar.on('clickMore', () => {
        this.layout.updateAllDayHeight(this.calendar, this.currentView, this.calendarData, this.currentDate);
      });
    }
  }

  updateConnectionStatus(status) {
    this.connectionStatus = status;
    const statusEl = document.querySelector('.status');
    if (statusEl) {
      switch (status) {
        case 'connected':
          statusEl.textContent = '●';
          statusEl.style.color = '#51cf66';
          break;
        case 'connecting':
          statusEl.textContent = '○';
          statusEl.style.color = '#ffaa00';
          break;
        case 'error':
          statusEl.textContent = '✕';
          statusEl.style.color = '#ff6b6b';
          break;
      }
    }
  }

  showCalendar() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('calendarHeader').style.display = 'flex';
    document.getElementById('calendar').style.display = 'block';
  }

  getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  updateCalendarHeader() {
    const titleEl = document.getElementById('calendarTitle');
    const modeEl = document.getElementById('calendarMode');

    const options = {
      year: 'numeric',
      month: 'long',
      ...(this.currentView === 'day' ? { day: 'numeric' } : {})  // Changed 'daily' to 'day'
    };

    titleEl.textContent = this.currentDate.toLocaleDateString('en-US', options);
    modeEl.textContent = this.currentView.charAt(0).toUpperCase() + this.currentView.slice(1);

    // Update layout for current view
    this.layout.updateAllDayHeight(this.calendar, this.currentView, this.calendarData, this.currentDate);
  }

  // Command handling for navigation
  handleCommand(action) {
    logger.debug('Calendar widget received command', { action });
    switch (action) {
      case 'right': 
        this.navigateCalendar('next'); 
        break;
      case 'left': 
        this.navigateCalendar('previous'); 
        break;
      case 'up': 
        this.scrollCalendar('up'); 
        break;
      case 'down': 
        this.scrollCalendar('down'); 
        break;
      case 'enter': 
        logger.debug('Enter pressed on calendar widget'); 
        break;
      case 'next-view':
      case 'fastforward': 
      case 'ff': 
      case ',': 
        this.cycleView('forward'); 
        break;
      case 'prev-view':
      case 'rewind': 
      case 'rw': 
      case '.': 
        this.cycleView('backward'); 
        break;
      default: 
        logger.debug('Calendar widget ignoring command', { action }); 
        break;
    }
  }

  navigateCalendar(direction) {
    const currentDateObj = this.calendar.getDate();
    let newDate = new Date(currentDateObj);

    switch (this.currentView) {
      case 'day':  // Changed 'daily' to 'day'
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1)); 
        break;
      case 'week': 
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7)); 
        break;
      case 'month': 
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1)); 
        break;
    }

    this.currentDate = newDate;
    this.calendar.setDate(newDate);
    this.updateCalendarHeader();
  }

  /**
   * Enhanced: Improved scroll positioning using working container logic
   * @param {number} hour - Hour to scroll to (0-23) - converted to percentage
   */
  scrollToTime(hour) {
    if (this.currentView === 'week' || this.currentView === 'day') {
      // Use the same container logic that works for scrollCalendar
      const scrollContainer = document.querySelector('.toastui-calendar-time-scroll-wrapper')
        || document.querySelector('.toastui-calendar-time')
        || document.querySelector('.toastui-calendar-timegrid-scroll-area');
        
      if (scrollContainer) {
        // Convert hour to percentage (11am = 45% down the day)
        const percentage = Math.max(0.1, Math.min(0.9, hour / 24));
        const targetScrollTop = scrollContainer.scrollHeight * percentage;
        scrollContainer.scrollTop = targetScrollTop;
        logger.debug(`Scrolled to ${hour}:00 using percentage`, { 
          hour, 
          percentage, 
          targetScrollTop 
        });
      }
    }
  }

  scrollCalendar(direction) {
    if (this.currentView === 'week' || this.currentView === 'day') {
      // Try multiple possible scroll container selectors for different views
      const scrollContainer = document.querySelector('.toastui-calendar-time-scroll-wrapper')
        || document.querySelector('.toastui-calendar-time')
        || document.querySelector('.toastui-calendar-timegrid-scroll-area');
      if (scrollContainer) {
        const scrollAmount = 60;
        scrollContainer.scrollTop += (direction === 'up' ? -scrollAmount : scrollAmount);
      }
    }
  }

  changeView(newView) {
    if (this.viewCycle.includes(newView)) {
      this.currentView = newView;
      this.calendar.changeView(newView);
      this.updateCalendarHeader();
      
      // ENHANCED: Apply optimal scroll positioning after view change
      if (newView === 'week' || newView === 'day') {
        setTimeout(() => this.setOptimalScrollPosition(), 100);
      }
    }
  }

  cycleView(direction) {
    const currentIndex = this.viewCycle.indexOf(this.currentView);
    const newIndex = direction === 'forward'
      ? (currentIndex + 1) % this.viewCycle.length
      : (currentIndex - 1 + this.viewCycle.length) % this.viewCycle.length;
    this.changeView(this.viewCycle[newIndex]);
  }

  applyTheme(theme) {
    const themeClass = `theme-${theme}`;
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.body.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(themeClass);
    document.body.classList.add(themeClass);
    logger.info('Applied theme to TUI Calendar', { theme });
  }
}

// Initialize widget when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const calendarWidget = new CalendarWidget();
});