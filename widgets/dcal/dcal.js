// widgets/dcal/dcal.js - Main Dashie Calendar Widget Class
// CHANGE SUMMARY: Migrated from calendar.js, removed TUI dependencies, added custom weekly view rendering

import { createLogger } from '../../js/utils/logger.js';
import { DCalConfig } from './dcal-config.js';
import { DCalEvents } from './dcal-events.js';
import { DCalWeekly } from './dcal-weekly.js';

const logger = createLogger('DCalWidget');

export class DCalWidget {
  constructor() {
    // ============== CONFIG VARIABLES ==============
    
    // Hard-coded Google calendar IDs (migrated from original calendar.js)
    this.GOOGLE_CALENDARS = [
      { id: 'jwlerch@gmail.com', summary: 'jwlerch@gmail.com', color: '#1976d2', textColor: '#ffffff' },
      { id: 'fd5949d42a667f6ca3e88dcf1feb27818463bbdc19c5e56d2e0da62b87d881c5@group.calendar.google.com', summary: 'Veeva', color: '#388e3c', textColor: '#ffffff' }
    ];

    // Build calendar definitions
    this.calendars = this.GOOGLE_CALENDARS.map(cal => ({
      id: cal.id,
      name: cal.summary,
      backgroundColor: cal.color,
      borderColor: cal.color,
      color: cal.textColor
    }));

    this.currentView = 'week'; // Only week view for now
    this.currentDate = new Date();
    
    this.calendarData = { events: [], calendars: [], lastUpdated: null };
    this.isDataLoaded = false;
    this.connectionStatus = 'connecting';
    this.currentTheme = null;
    this.isFocused = false;
    this.focusedDayIndex = -1;

    // Initialize helper modules
    this.config = new DCalConfig(this.calendars);
    this.events = new DCalEvents(this.calendars);
    this.weekly = new DCalWeekly(this.calendars);

    this.init();
  }

  init() {
    this.detectAndApplyInitialTheme();
    this.setupEventListeners();
    this.setupKeyboardControls();
    this.setupUI();
    
    // Initialize weekly view
    this.weekly.initialize(this.currentDate);
    
    logger.info('DCal widget initialized');
  }

  detectAndApplyInitialTheme() {
    const htmlClassList = document.documentElement.classList;
    const bodyClassList = document.body.classList;
    
    let detectedTheme = null;
    if (htmlClassList.contains('theme-dark') || bodyClassList.contains('theme-dark')) {
      detectedTheme = 'dark';
    } else if (htmlClassList.contains('theme-light') || bodyClassList.contains('theme-light')) {
      detectedTheme = 'light';
    }
    
    if (detectedTheme) {
      this.currentTheme = detectedTheme;
      logger.info('Initial theme detected', { theme: detectedTheme });
    } else {
      this.applyTheme('dark');
      logger.info('No initial theme detected, defaulting to dark');
    }
  }

  setupKeyboardControls() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'ArrowLeft':
          e.preventDefault();
          if (this.isFocused) {
            this.weekly.navigateDay(-1);
          } else {
            this.navigateCalendar('previous');
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (this.isFocused) {
            this.weekly.navigateDay(1);
          } else {
            this.navigateCalendar('next');
          }
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
        window.parent.postMessage({ type: 'widget-ready', widget: 'dcal' }, '*');
      }
    });
  }

  setupUI() {
    // UI is already in HTML, just ensure calendar container exists
    const calendarContainer = document.getElementById('calendar');
    if (!calendarContainer) {
      logger.error('Calendar container not found');
    }
  }

  handleCommand(action) {
    // AUTO-FOCUS: Detect focus from receiving commands
    if (!this.isFocused && ['up', 'down', 'left', 'right'].includes(action)) {
      this.handleFocusChange(true);
    }

    logger.debug('DCal widget received command', { action });
    
    const indicator = document.getElementById('commandIndicator');
    
    switch (action) {
      case 'left':
        if (this.isFocused) {
          this.weekly.navigateDay(-1);
        } else {
          this.navigateCalendar('previous');
        }
        break;
      case 'right':
        if (this.isFocused) {
          this.weekly.navigateDay(1);
        } else {
          this.navigateCalendar('next');
        }
        break;
      case 'up':
        this.scrollCalendar('up');
        break;
      case 'down':
        this.scrollCalendar('down');
        break;
      case 'select':
        logger.info('Select pressed on weekly view');
        break;
      case 'back':
        if (this.isFocused) {
          this.handleFocusChange(false);
        }
        break;
      default:
        logger.debug('DCal widget ignoring command', { action });
        break;
    }
    
    // Show command feedback
    if (['up', 'down', 'left', 'right', 'select'].includes(action)) {
      indicator.textContent = `⬆️ ${action.toUpperCase()}`;
      indicator.classList.add('active');
      
      setTimeout(() => {
        indicator.classList.remove('active');
        indicator.textContent = this.isFocused ? '← → Day' : '← → Week';
      }, 600);
    }
  }

  handleFocusChange(focused) {
    const wasFocused = this.isFocused;
    this.isFocused = focused;
    
    if (focused && !wasFocused) {
      this.weekly.setFocused(true);
      document.getElementById('commandIndicator').textContent = '← → Day';
      logger.debug('DCal widget gained focus');
    } else if (!focused && wasFocused) {
      this.weekly.setFocused(false);
      document.getElementById('commandIndicator').textContent = '← → Week';
      logger.debug('DCal widget lost focus');
    }
  }

  navigateCalendar(direction) {
    const newDate = new Date(this.currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    
    this.currentDate = newDate;
    this.weekly.setDate(this.currentDate);
    this.updateCalendarHeader();
    
    // Re-render with current data
    if (this.isDataLoaded) {
      this.weekly.renderEvents(this.calendarData);
    }
    
    logger.debug('Navigated calendar', { direction, newWeek: this.weekly.getWeekTitle() });
  }

  scrollCalendar(direction) {
    this.weekly.scroll(direction);
  }

  updateCalendarHeader() {
    const titleEl = document.getElementById('calendarTitle');
    const modeEl = document.getElementById('calendarMode');
    
    titleEl.textContent = this.weekly.getWeekTitle();
    modeEl.textContent = 'Week';
  }

  handleDataServiceMessage(data) {
    logger.debug('DCal widget received message', { type: data.type, hasPayload: !!data.payload });
    
    switch (data.type) {
      case 'widget-update':
        if (data.action === 'state-update' && data.payload?.calendar) {
          this.handleCalendarData({
            events: data.payload.calendar.events || [],
            calendars: data.payload.calendar.calendars || [],
            lastUpdated: data.payload.calendar.lastUpdated
          });
        }
        
        if (data.payload?.theme && data.payload.theme !== this.currentTheme) {
          this.applyTheme(data.payload.theme);
        }
        break;
        
      case 'theme-change':
        this.applyTheme(data.theme);
        break;
    }
  }

  handleCalendarData(data) {
    if (data.status === 'error') {
      this.updateConnectionStatus('error');
      logger.error('Calendar data error', { error: data.status });
      return;
    }

    // Deduplicate events
    const deduplicatedEvents = this.events.deduplicateEvents(data.events || []);
    
    logger.info('Event deduplication complete', {
      originalCount: data.events?.length || 0,
      deduplicatedCount: deduplicatedEvents.length,
      duplicatesRemoved: (data.events?.length || 0) - deduplicatedEvents.length
    });

    // Store deduplicated calendar data
    this.calendarData = {
      events: deduplicatedEvents,
      calendars: data.calendars || [],
      lastUpdated: data.lastUpdated
    };
    
    this.isDataLoaded = true;
    this.updateConnectionStatus('connected');
    this.config.updateCalendars(this.calendarData.calendars);
    this.events.updateCalendars(this.calendarData.calendars);
    
    // Render events in weekly view
    this.weekly.renderEvents(this.calendarData);
    
    this.showCalendar();
    this.updateCalendarHeader();
    
    logger.info('Calendar data loaded', {
      events: deduplicatedEvents.length,
      calendars: this.calendarData.calendars.length
    });
  }

  updateConnectionStatus(status) {
    this.connectionStatus = status;
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = status === 'connected' ? '●' : '○';
      statusElement.style.color = status === 'connected' ? 'var(--accent-blue, #00aaff)' : 'var(--text-muted, #999)';
    }
  }

  showCalendar() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('calendarHeader').style.display = 'flex';
    document.getElementById('calendar').style.display = 'flex';
  }

  applyTheme(theme) {
    if (theme === this.currentTheme) {
      logger.debug('Theme already applied, skipping', { theme });
      return;
    }

    logger.info('Applying theme to DCal widget', { 
      from: this.currentTheme, 
      to: theme 
    });

    this.currentTheme = theme;
    
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.body.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(`theme-${theme}`);
    document.body.classList.add(`theme-${theme}`);
    
    logger.info('Theme applied successfully', { theme });
  }
}

// Initialize widget when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const dcalWidget = new DCalWidget();
});