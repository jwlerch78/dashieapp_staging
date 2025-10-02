// widgets/calendar/calendar.js - Main Calendar Widget Class
// CHANGE SUMMARY: Removed visual hint controls-info div, added last-updated timestamp display in bottom-right corner

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
    this.lastUpdatedTimestamp = null;

    // ADDED: Theme support
    this.currentTheme = null;

    // Initialize helper modules
    this.config = new CalendarConfig(this.tuiCalendars);
    this.events = new CalendarEvents(this.tuiCalendars);
    this.layout = new CalendarLayout();

    this.init();
  }

  init() {
    // ADDED: Theme detection first
    this.detectAndApplyInitialTheme();
    
    this.setupEventListeners();
    this.setupKeyboardControls();  // Added missing keyboard controls
    this.setupUI();
    setTimeout(() => this.initializeCalendar(), 100);
  }

  // ADDED: Theme detection method
  detectAndApplyInitialTheme() {
    let initialTheme = 'dark'; // fallback

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
          <div class="last-updated" id="lastUpdated"></div>
        </div>
      </div>
    `;
  }

  // Message handling for widget-messenger system
  handleDataServiceMessage(data) {
    switch (data.type) {
      case 'widget-update':
        if (data.action === 'state-update') {
          // Check if this update contains anything relevant to calendar widget
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

        // Update last updated timestamp
    this.lastUpdatedTimestamp = Date.now();
    this.updateLastUpdatedDisplay();

    // Update calendar configurations
    this.updateCalendarConfigurations();
    
    // Load events using the events module (will skip deduplication since already done)
    this.events.loadEventsIntoCalendar(this.calendar, this.calendarData);
    this.updateCalendarHeader();
  }

  /**
   * Update the "last updated" display with relative time
   */
  updateLastUpdatedDisplay() {
    const element = document.getElementById('lastUpdated');
    if (!element || !this.lastUpdatedTimestamp) {
      return;
    }

    const now = Date.now();
    const diffMs = now - this.lastUpdatedTimestamp;
    const diffMins = Math.floor(diffMs / 60000);

    let displayText;
    if (diffMins < 1) {
      displayText = 'Updated just now';
    } else if (diffMins === 1) {
      displayText = 'Updated 1 min ago';
    } else if (diffMins < 60) {
      displayText = `Updated ${diffMins} mins ago`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours === 1) {
        displayText = 'Updated 1 hour ago';
      } else {
        displayText = `Updated ${diffHours} hours ago`;
      }
    }

    element.textContent = displayText;

    // Schedule next update in 1 minute
    setTimeout(() => this.updateLastUpdatedDisplay(), 60000);
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
        logger.debug('Applied optimal scroll position', { targetScrollTop });
      }
    }
  }

  setupCalendarEventListeners() {
    // Track when user scrolls the calendar
    const scrollContainer = document.querySelector('.toastui-calendar-time-scroll-wrapper')
      || document.querySelector('.toastui-calendar-time')
      || document.querySelector('.toastui-calendar-timegrid-scroll-area');
      
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', () => {
        this.userHasScrolled = true;
      });
    }
  }

  showCalendar() {
    const calendarEl = document.getElementById('calendar');
    const headerEl = document.getElementById('calendarHeader');
    const loadingEl = document.getElementById('loading');

    if (calendarEl) calendarEl.style.display = 'block';
    if (headerEl) headerEl.style.display = 'flex';
    if (loadingEl) loadingEl.style.display = 'none';
  }

  updateConnectionStatus(status) {
    const statusEl = document.querySelector('.status');
    if (!statusEl) return;

    this.connectionStatus = status;
    switch (status) {
      case 'connecting':
        statusEl.textContent = '○';
        statusEl.style.color = 'var(--text-muted, #999)';
        break;
      case 'connected':
        statusEl.textContent = '●';
        statusEl.style.color = '#4caf50';
        break;
      case 'error':
        statusEl.textContent = '●';
        statusEl.style.color = '#f44336';
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

    // Maintain optimal scroll position after navigation
    if (this.currentView === 'week' || this.currentView === 'day') {
      setTimeout(() => this.setOptimalScrollPosition(), 50);
    }
  }

  scrollCalendar(direction) {
    if (this.currentView === 'week' || this.currentView === 'day') {
      // Use the correct scroll container that TUI Calendar actually uses
      const scrollContainer = document.querySelector('.toastui-calendar-time-scroll-wrapper')
        || document.querySelector('.toastui-calendar-time')
        || document.querySelector('.toastui-calendar-timegrid-scroll-area');
      
      if (scrollContainer) {
        const scrollAmount = 100;
        scrollContainer.scrollTop += (direction === 'down' ? scrollAmount : -scrollAmount);
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
    
    // Apply theme classes for CSS variables to work
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.body.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(`theme-${theme}`);
    document.body.classList.add(`theme-${theme}`);
    
  }
}

// Initialize widget when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const calendarWidget = new CalendarWidget();
});