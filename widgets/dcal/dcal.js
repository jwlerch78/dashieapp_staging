// widgets/dcal/dcal.js - Main Dashie Calendar Widget Class
// CHANGE SUMMARY: Fixed theme detection to check html element, removed command indicator references

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
    
    // Last updated timestamp tracking
    this.lastUpdatedTimestamp = null;
    this.displayUpdateInterval = null;

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
    // FIXED: Check both html and body elements for theme class
    const htmlClassList = document.documentElement.classList;
    const bodyClassList = document.body.classList;
    
    let detectedTheme = null;
    
    // Check html element first (where parent applies theme)
    if (htmlClassList.contains('theme-dark')) {
      detectedTheme = 'dark';
    } else if (htmlClassList.contains('theme-light')) {
      detectedTheme = 'light';
    }
    // Then check body element as fallback
    else if (bodyClassList.contains('theme-dark')) {
      detectedTheme = 'dark';
    } else if (bodyClassList.contains('theme-light')) {
      detectedTheme = 'light';
    }
    
    if (detectedTheme) {
      this.currentTheme = detectedTheme;
      // Apply to both html and body to ensure CSS variables work
      this.applyThemeToElements(detectedTheme);
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
  logger.debug('DCal widget received command', { action });
  
  switch (action) {
    case 'left':
      this.navigateCalendar('previous');
      break;
    case 'right':
      this.navigateCalendar('next');
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
    case 'escape':
      const timeGrid = document.querySelector('.time-grid');
      if (timeGrid) {
        this.weekly.setOptimalScrollPosition();
      }
      break;
    default:
      logger.debug('DCal widget ignoring command', { action });
      break;
  }
}

  handleFocusChange(focused) {
    const wasFocused = this.isFocused;
    this.isFocused = focused;
    
    if (focused && !wasFocused) {
      this.weekly.setFocused(true);
      logger.debug('DCal widget gained focus');
    } else if (!focused && wasFocused) {
      this.weekly.setFocused(false);
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
    const events = data.events || [];


    // Store deduplicated calendar data
    this.calendarData = {
      events: events,
      calendars: data.calendars || [],
      lastUpdated: data.lastUpdated
    };
    
    this.isDataLoaded = true;
    this.updateConnectionStatus('connected');
    this.updateCalendarConfigurations();
    
    // Update last updated timestamp
    this.lastUpdatedTimestamp = Date.now();
    this.updateLastUpdatedDisplay();
    
   
    // Render events in weekly view
    this.weekly.renderEvents(this.calendarData);
    
    this.showCalendar();
    this.updateCalendarHeader();
    
  }

    updateCalendarConfigurations() {
    // Merge Google's actual colors if provided by the centralized service
    const updatedCalendars = this.GOOGLE_CALENDARS.map((cal) => {
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
    this.config.updateCalendars(updatedCalendars);
    this.events.updateCalendars(updatedCalendars);
    this.weekly.updateCalendars(updatedCalendars);
    
    logger.debug('Calendar configurations updated with Google colors', {
        calendars: updatedCalendars
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
    this.applyThemeToElements(theme);
    
    logger.info('Theme applied successfully', { theme });
  }

  // FIXED: Apply theme to both html and body elements
  applyThemeToElements(theme) {
    // Remove both theme classes
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.body.classList.remove('theme-dark', 'theme-light');
    
    // Add new theme class to both elements
    document.documentElement.classList.add(`theme-${theme}`);
    document.body.classList.add(`theme-${theme}`);
  }

  // ==================== LAST UPDATED DISPLAY ====================

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
}   

}

// Initialize widget when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const dcalWidget = new DCalWidget();
});