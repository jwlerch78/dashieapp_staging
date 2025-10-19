// js/widgets/calendar/calendar-widget.js - Calendar Widget Class
// Migrated from legacy dcal widget - Phase 4.5
// v1.16 - 10/12/25 10:30pm - FIXED: LEFT at home returns to menu without navigating (prevents going into past)
// v1.15 - 10/12/25 10:25pm - FIXED: Simplified left navigation - returns to menu when arriving at home position
// v1.14 - 10/12/25 9:45pm - FIXED: D-pad left navigation now only returns to menu when AT home position
// v1.13 - 10/12/25 9:25pm - FIXED: Added scroll tracking reset on "Go to Today" and view mode switch
// v1.12 - 10/11/25 - Updated to 3-state messaging protocol
// CHANGE SUMMARY: Check isAtHome AFTER navigation, not wasAtHome before - simpler and correct

import { createLogger } from '/js/utils/logger.js';
import { CalendarConfig } from './calendar-config.js';
import { CalendarEvents } from './calendar-events.js';
import { CalendarWeekly } from './calendar-weekly.js';
import { CalendarMonthly } from './calendar-monthly.js';

const logger = createLogger('CalendarWidget');

export class CalendarWidget {
  constructor() {
    // ============== CONFIG VARIABLES ==============

    // Access CalendarService from parent window
    this.calendarService = (window.parent?.calendarService || window.calendarService);
    this.sessionManager = (window.parent?.sessionManager || window.sessionManager);

    // Calendar list will be loaded from CalendarService
    this.calendars = [];

    // Load settings and set initial view mode
    const settings = this.loadSettings();
    this.currentView = settings.viewMode || 'week';
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

    // NEW: Focus menu state
    this.menuActive = false;        // Is menu currently active?
    this.homeDate = null;           // Home position (today) when entering from menu
    this.isAtHome = true;          // Are we at home position?

    // Initialize helper modules with settings
    this.config = new CalendarConfig(this.calendars);
    this.events = new CalendarEvents(this.calendars);
    this.weekly = new CalendarWeekly(this.calendars, settings);
    this.monthly = null; // Monthly view renderer (lazy init)

    this.init();
  }

  async init() {
    this.detectAndApplyInitialTheme();
    this.setupEventListeners();
    this.setupKeyboardControls();
    this.setupUI();

    // Initialize weekly view
    this.weekly.initialize(this.currentDate);

    // NEW: Send focus menu configuration to parent
    this.sendMenuConfig();

    // Calendar data will be loaded by widget-data-manager and sent via postMessage
    // No need to load data here - prevents duplicate loading

    logger.info('Calendar widget initialized');
  }

  /**
   * Load calendar data from CalendarService
   */
  async loadCalendarData() {
    try {
      if (!this.calendarService || !this.sessionManager) {
        logger.warn('CalendarService or SessionManager not available - waiting...');
        // Try again after a delay
        setTimeout(() => this.loadCalendarData(), 1000);
        return;
      }

      logger.debug('Loading calendar data from CalendarService...');

      // Get all accounts
      const tokenStore = this.sessionManager.getTokenStore();
      const googleAccounts = await tokenStore.getProviderAccounts('google');
      const accountTypes = Object.keys(googleAccounts || {});

      logger.debug('Found accounts:', { count: accountTypes.length, accounts: accountTypes });

      // Get active calendar IDs
      const activeCalendarIds = this.calendarService.getActiveCalendarIds();

      logger.debug('Active calendar IDs:', { count: activeCalendarIds.length, ids: activeCalendarIds });

      // Calculate date range for current view
      const { startDate, endDate } = this.getDateRange();
      const timeRange = { start: startDate, end: endDate };

      // Fetch all calendars and events from all accounts
      const allCalendars = [];
      const allEvents = [];

      for (const accountType of accountTypes) {
        try {
          // Get calendars for this account
          const calendars = await this.calendarService.getCalendars(accountType);
          allCalendars.push(...calendars);

          // Get events from each active calendar in this account
          for (const prefixedCalendarId of activeCalendarIds) {
            // Check if this calendar belongs to this account
            if (!prefixedCalendarId.startsWith(`${accountType}-`)) {
              continue;
            }

            // Extract the actual calendar ID (remove account prefix)
            // Format is: "accountType-calendarId"
            const calendarId = prefixedCalendarId.substring(`${accountType}-`.length);

            // Find the calendar object to get color info
            const calendarObj = calendars.find(cal => cal.id === calendarId);

            try {
              const events = await this.calendarService.getEvents(
                accountType,
                calendarId,
                timeRange
              );

              // Add prefixedCalendarId and calendar colors to each event
              const eventsWithMetadata = events.map(event => ({
                ...event,
                prefixedCalendarId: prefixedCalendarId,
                calendarId: calendarId,
                accountType: accountType,
                backgroundColor: calendarObj?.backgroundColor || '#1976d2',
                foregroundColor: calendarObj?.foregroundColor || '#ffffff'
              }));

              allEvents.push(...eventsWithMetadata);
            } catch (error) {
              logger.warn(`Failed to load events from ${prefixedCalendarId}`, error);
            }
          }

          logger.debug(`Loaded ${calendars.length} calendars from ${accountType}`);
        } catch (error) {
          logger.warn(`Failed to load calendar data from ${accountType}`, error);
        }
      }

      // Events are already filtered (we only fetched from active calendars)
      const filteredEvents = allEvents;

      logger.debug('Calendar data loaded', {
        calendars: allCalendars.length,
        totalEvents: allEvents.length,
        filteredEvents: filteredEvents.length,
        activeCalendars: activeCalendarIds.length
      });

      // Update calendar data
      this.handleCalendarData({
        events: filteredEvents,
        calendars: allCalendars,
        lastUpdated: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to load calendar data', error);
      this.updateConnectionStatus('error');
    }
  }

  /**
   * Get date range for fetching events
   * Uses configuration to fetch events from past and future
   */
  getDateRange() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start date: daysInPast days ago
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - this.config.daysInPast);

    // End date: daysInFuture days from now
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + this.config.daysInFuture);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }

  detectAndApplyInitialTheme() {
    let detectedTheme = null;

    // Try to get theme from parent window first (since we're in an iframe)
    try {
      if (window.parent && window.parent !== window && window.parent.document) {
        const parentBody = window.parent.document.body;
        if (parentBody.classList.contains('theme-light')) {
          detectedTheme = 'light';
        } else if (parentBody.classList.contains('theme-dark')) {
          detectedTheme = 'dark';
        }
      }
    } catch (e) {
      // Cross-origin error - can't access parent
      logger.debug('Cannot access parent window for theme detection');
    }

    // Fallback: try localStorage
    if (!detectedTheme) {
      try {
        const savedTheme = localStorage.getItem('dashie-theme');
        if (savedTheme === 'light' || savedTheme === 'dark') {
          detectedTheme = savedTheme;
        }
      } catch (e) {
        logger.debug('Cannot read theme from localStorage');
      }
    }

    // Apply detected theme or default to light
    if (detectedTheme) {
      this.currentTheme = detectedTheme;
      this.applyThemeToElements(detectedTheme);
      logger.debug('Initial theme detected', { theme: detectedTheme });
    } else {
      this.applyTheme('light'); // Default to light theme
      logger.debug('No initial theme detected, using default light theme');
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
      if (!event.data) return;

      logger.debug('Calendar widget received message', { type: event.data.type, payload: event.data.payload });

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

        // Check if it's a state change action (enter-focus, exit-focus, enter-active, exit-active)
        const stateActions = ['enter-focus', 'exit-focus', 'enter-active', 'exit-active'];
        // Check if it's a menu action
        const menuActions = ['menu-active', 'menu-selection-changed', 'menu-item-selected'];

        if (stateActions.includes(action) || menuActions.includes(action)) {
          this.handleMenuAction({ ...event.data, action });
        } else {
          // Regular navigation command (up, down, left, right, select, back)
          this.handleCommand(action);
        }
        return;
      }

      // Handle data/theme updates
      if (event.data.type === 'widget-update' || event.data.type === 'theme-change') {
        this.handleDataServiceMessage(event.data);
        return;
      }

      // Handle other widget messages
      if (event.data.type) {
        this.handleDataServiceMessage(event.data);
      }
    });

    const self = this; // Capture 'this' for use in callbacks

    window.addEventListener('load', () => {
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'event',
          widgetId: 'main', // Must match ID in dashboard-widget-config.js
          payload: {
            eventType: 'widget-ready',
            data: { hasMenu: false }
          }
        }, '*');
        logger.debug('📤 Sent widget-ready message to parent');
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
  logger.debug('📥 Calendar widget received command', {
    action,
    isFocused: this.isFocused,
    menuActive: this.menuActive,
    isAtHome: this.isAtHome
  });

  // Check if widget is active (able to receive commands)
  if (!this.isFocused) {
    logger.warn('⚠️ Command ignored - widget not focused/active', { action });
    return;
  }

  switch (action) {
    case 'left':
      // ✅ FIXED: If at home position, don't navigate - return to menu instead
      if (this.isAtHome && !this.menuActive) {
        logger.info('📍 At home position - returning to menu instead of navigating past');
        this.requestReturnToMenu();
        break;
      }
      
      // Navigate backward
      this.navigateCalendar('previous');
      
      // Update home status after navigation
      this.updateHomeStatus();
      break;
      
    case 'right':
      // Navigate forward
      this.navigateCalendar('next');
      
      // Update home status after navigation
      this.updateHomeStatus();
      break;
    case 'up':
      this.scrollCalendar('up');
      break;
    case 'down':
      this.scrollCalendar('down');
      break;
    case 'select':
      logger.debug('Select pressed on weekly view');
      break;
    case 'back':
    case 'escape':
      const timeGrid = document.querySelector('.time-grid');
      if (timeGrid) {
        this.weekly.setOptimalScrollPosition();
      }
      break;
    default:
      logger.debug('Calendar widget ignoring command', { action });
      break;
  }
}

  handleFocusChange(focused) {
    const wasFocused = this.isFocused;
    this.isFocused = focused;
    
    if (focused && !wasFocused) {
      this.weekly.setFocused(true);
      logger.debug('Calendar widget gained focus');
    } else if (!focused && wasFocused) {
      this.weekly.setFocused(false);
      logger.debug('Calendar widget lost focus');
    }
  }

  navigateCalendar(direction) {
    const newDate = new Date(this.currentDate);

    if (this.currentView === 'monthly') {
      // Navigate by month
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      this.currentDate = newDate;
      this.monthly.setDate(this.currentDate);

      // Re-render with existing events (already fetched broad range)
      if (this.isDataLoaded) {
        this.monthly.renderEvents(this.calendarData);
      }

      logger.debug('Navigated month', { direction, newMonth: this.monthly.getMonthTitle() });
    } else {
      // Weekly/n-day navigation
      const increment = this.weekly.dayCount || 7;
      newDate.setDate(newDate.getDate() + (direction === 'next' ? increment : -increment));

      this.currentDate = newDate;
      this.weekly.setDate(this.currentDate);

      // Re-render with existing events (already fetched broad range)
      if (this.isDataLoaded) {
        this.weekly.renderEvents(this.calendarData);
      }

      logger.debug('Navigated calendar', { direction, increment, newWeek: this.weekly.getWeekTitle() });
    }

    this.updateCalendarHeader();
  }

  scrollCalendar(direction) {
    // Monthly view has no scrolling
    if (this.currentView === 'monthly') {
      return;
    }
    this.weekly.scroll(direction);
  }

  updateCalendarHeader() {
    const titleEl = document.getElementById('calendarTitle');
    const modeEl = document.getElementById('calendarMode');
    
    if (this.currentView === 'monthly') {
      titleEl.textContent = this.monthly.getMonthTitle();
      modeEl.textContent = 'Month';
    } else {
      titleEl.textContent = this.weekly.getWeekTitle();
      
      const modeLabels = {
        '1': 'Day',
        '2': '2-Day',
        '3': '3-Day',
        '5': '5-Day',
        'week': 'Week'
      };
      modeEl.textContent = modeLabels[this.currentView] || 'Week';
    }
  }

  handleDataServiceMessage(data) {
    logger.debug('Calendar widget received message', { type: data.type, hasPayload: !!data.payload });
    
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

    // Merge multi-calendar events (events on multiple calendars get combined with all colors)
    const rawEvents = data.events || [];
    const events = this.events.mergeMultiCalendarEvents(rawEvents);

    logger.debug('Event merge complete', {
      raw: rawEvents.length,
      merged: events.length,
      multiCalendar: events.filter(e => e.isMultiCalendar).length
    });

    // Store merged calendar data
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
    
    // Start the recurring update interval (clear any existing one first)
    if (this.displayUpdateInterval) {
      clearInterval(this.displayUpdateInterval);
    }
    this.displayUpdateInterval = setInterval(() => {
      this.updateLastUpdatedDisplay();
    }, 60000); // Update every 60 seconds

   
    // Render events in weekly view
    this.weekly.renderEvents(this.calendarData);
    
    // v1.14 - 10/13/25 12:00am - FIXED: Trigger scroll positioning after first data load
    // On first render (after welcome wizard), events weren't present during initialize,
    // so we need to scroll again now that events have been loaded
    this.weekly.setOptimalScrollPosition();
    
    this.showCalendar();
    this.updateCalendarHeader();
    
  }

     updateCalendarConfigurations() {
    // FIXED: Use the actual calendars from the data instead of hardcoded list
    const updatedCalendars = this.calendarData.calendars.map((cal) => {
      return {
        id: cal.id,
        name: cal.summary,
        backgroundColor: cal.backgroundColor || '#1976d2',
        borderColor: cal.backgroundColor || '#1976d2',
        color: cal.foregroundColor || '#ffffff'
      };
    });

    // Update configurations in helper modules
    this.config.updateCalendars(updatedCalendars);
    this.events.updateCalendars(updatedCalendars);
    this.weekly.updateCalendars(updatedCalendars);
    if (this.monthly) {
      this.monthly.updateCalendars(updatedCalendars);
    }
    
    logger.debug('Calendar configurations updated with Google colors', {
      calendars: updatedCalendars.length,
      calendarNames: updatedCalendars.map(c => c.name)
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

    logger.debug('Applying theme to Calendar widget', {
      from: this.currentTheme,
      to: theme
    });

    this.currentTheme = theme;
    this.applyThemeToElements(theme);

    logger.debug('Theme applied successfully', { theme });
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

  // ==================== FOCUS MENU METHODS ====================

  /**
   * Load settings from localStorage
   */
  loadSettings() {
    try {
      const localStorage = window.parent?.localStorage || window.localStorage;
      const settings = localStorage.getItem('dashie-settings');
      
      if (settings) {
        const parsed = JSON.parse(settings);
        return {
          viewMode: parsed.calendar?.dcalViewMode || 'week',
          startWeekOn: parsed.calendar?.startWeekOn || 'sun',
          scrollTime: parsed.calendar?.scrollTime || 8
        };
      }
    } catch (error) {
      logger.error('Failed to load calendar settings', error);
    }
    
    // Defaults
    return { viewMode: 'week', startWeekOn: 'sun', scrollTime: 8 };
  }

  /**
   * Send focus menu configuration to parent
   */
  sendMenuConfig() {
    if (window.parent !== window) {
      const settings = this.loadSettings();
      const currentViewMode = settings.viewMode || 'week';

      window.parent.postMessage({
        type: 'widget-config',
        widget: 'calendar',
        focusMenu: {
          enabled: false, // TODO: Re-enable when focus menu UI is implemented
          defaultIndex: this.getMenuIndexForView(currentViewMode),
          currentView: currentViewMode, // Highlight active view
          items: [
            // Action button
            { 
              id: 'go-to-today', 
              label: 'Go to Today', 
              type: 'action' 
            },
            // View options (swapped 3-Day and Day order)
            { 
              id: 'monthly', 
              label: 'Month',
              type: 'view' 
            },
            { 
              id: 'week', 
              label: 'Week',
              type: 'view' 
            },
            { 
              id: '3', 
              label: '3-Day',
              type: 'view' 
            },
            { 
              id: '1', 
              label: 'Day',
              type: 'view' 
            }
          ]
        }
      }, '*');
      
      logger.debug('✓ Sent enhanced focus menu config', { currentViewMode });
    }
  }

  /**
   * Get menu index for current view mode (for default selection)
   */
  getMenuIndexForView(viewMode) {
    const viewMap = {
      'go-to-today': 0,
      'monthly': 1,
      'week': 2,
      '3': 3,  // 3-Day now at index 3
      '1': 4   // Day now at index 4
    };
    return viewMap[viewMode] || 2; // Default to week
  }

  /**
   * Handle menu-related actions from parent
   */
  handleMenuAction(data) {
    logger.debug('🎯 handleMenuAction called', {
      action: data.action,
      itemId: data.itemId,
      beforeState: { isFocused: this.isFocused, menuActive: this.menuActive, isAtHome: this.isAtHome }
    });

    switch (data.action) {
      case 'menu-active':
        // Menu is now active, note the selected item
        this.menuActive = true;
        logger.debug('📋 Menu activated, selected:', data.selectedItem);
        break;

      case 'menu-selection-changed':
        // User is navigating menu (preview only, don't change view)
        logger.debug('📋 Menu selection preview:', data.selectedItem);
        break;

      case 'menu-item-selected':
        // User pressed ENTER on menu item
        if (data.itemId === 'go-to-today') {
          // Reset to today
          this.currentDate = new Date();
          this.homeDate = new Date();
          this.homeDate.setHours(0, 0, 0, 0);
          this.isAtHome = true;

          // Reset scroll tracking to enable auto-scroll
          this.weekly.resetScrollTracking();

          // Update weekly view
          this.weekly.setDate(this.currentDate);
          this.updateCalendarHeader();

          // Re-render with current data
          if (this.isDataLoaded) {
            this.weekly.renderEvents(this.calendarData);
          }

          logger.info('📅 Returned to today - scroll tracking reset');
        } else {
          // View mode change (1, 2, 3, 5, week)
          this.switchViewMode(data.itemId);
        }
        break;

      case 'enter-focus':
        // Widget is now FOCUSED (centered, has attention)
        // If no menu: auto-enter active
        // If has menu: user starts in menu
        this.isFocused = false; // Will become true on enter-active
        this.menuActive = false;
        logger.debug('🎯 ENTER-FOCUS: Widget is now centered/focused');
        break;

      case 'enter-active':
        // Widget now ACTIVE (user pressed → from menu or auto-entry)
        this.menuActive = false;
        this.isFocused = true;

        // Set home position to today
        this.homeDate = new Date();
        this.homeDate.setHours(0, 0, 0, 0);
        this.isAtHome = true;

        logger.debug('✅ ENTER-ACTIVE: Widget is NOW ACTIVE and can receive d-pad commands!', {
          isFocused: this.isFocused,
          menuActive: this.menuActive,
          isAtHome: this.isAtHome
        });
        logger.debug('📍 Calendar home set to today');
        break;

      case 'exit-active':
        // Menu regained control (user pressed ← from widget)
        this.menuActive = true;
        this.isFocused = false;
        logger.debug('❌ EXIT-ACTIVE: Widget is NO LONGER ACTIVE (returned to menu)', {
          isFocused: this.isFocused,
          menuActive: this.menuActive
        });
        break;

      case 'exit-focus':
        // Leaving focused view entirely (back to grid)
        this.menuActive = true;
        this.isFocused = false;
        this.isAtHome = true;
        this.homeDate = null;
        logger.debug('❌ EXIT-FOCUS: Returned to grid view', {
          isFocused: this.isFocused,
          menuActive: this.menuActive
        });
        break;
    }

    logger.debug('🎯 State AFTER handleMenuAction', {
      action: data.action,
      afterState: { isFocused: this.isFocused, menuActive: this.menuActive, isAtHome: this.isAtHome }
    });
  }

  /**
   * Check if current date matches home date
   */
  updateHomeStatus() {
    if (!this.homeDate) {
      this.isAtHome = false;
      return;
    }
    
    const current = new Date(this.currentDate);
    current.setHours(0, 0, 0, 0);
    
    const home = new Date(this.homeDate);
    home.setHours(0, 0, 0, 0);
    
    this.isAtHome = (current.getTime() === home.getTime());
    
    logger.debug('Home status updated', { 
      isAtHome: this.isAtHome,
      currentDate: current.toDateString(),
      homeDate: home.toDateString()
    });
  }

  /**
   * Request return to menu
   */
  requestReturnToMenu() {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'return-to-menu'
      }, '*');
      logger.info('📍 Requested return to menu (at home position)');
    }
  }

  /**
   * Switch to a new view mode and save to settings
   * @param {string} viewMode - View mode ID ('1', '3', 'week', 'monthly')
   */
  async switchViewMode(viewMode) {
    logger.debug('Switching view mode', { from: this.currentView, to: viewMode });
    
    // NEW: Save current scroll position if switching from a weekly/day view
    let savedScroll = null;
    if (this.currentView !== 'monthly') {
      const timeGrid = document.querySelector('.time-grid');
      if (timeGrid && timeGrid.scrollTop > 0) {
        savedScroll = timeGrid.scrollTop;
        logger.debug('Saved scroll position before view switch', { scrollTop: savedScroll });
      }
    }
    
    // Update current view
    this.currentView = viewMode;
    
    // Save to settings (localStorage + database)
    await this.saveViewModeSetting(viewMode);
    
    if (viewMode === 'monthly') {
      // Initialize monthly view if needed
      if (!this.monthly) {
        const settings = this.loadSettings();
        this.monthly = new CalendarMonthly(this.calendars, settings);
        this.monthly.initialize(this.currentDate);
      }
      
      // Hide weekly, show monthly
      document.querySelector('.allday-section')?.classList.add('hidden');
      document.querySelector('.time-grid')?.classList.add('hidden');
      document.querySelector('.month-grid')?.classList.remove('hidden');
      
      // Reset to today when switching to monthly
      this.currentDate = new Date();
      this.homeDate = new Date();
      this.homeDate.setHours(0, 0, 0, 0);
      this.isAtHome = true;
      
      this.monthly.setDate(this.currentDate);
      
      if (this.isDataLoaded) {
        this.monthly.renderEvents(this.calendarData);
      }
    } else {
      // Weekly/n-day mode
      document.querySelector('.month-grid')?.classList.add('hidden');
      document.querySelector('.allday-section')?.classList.remove('hidden');
      document.querySelector('.time-grid')?.classList.remove('hidden');
      
      // Update weekly renderer with new settings
      const settings = this.loadSettings();
      this.weekly.updateSettings(settings); // This calls resetScrollTracking internally
      
      // Reset to today when changing views
      this.currentDate = new Date();
      this.homeDate = new Date();
      this.homeDate.setHours(0, 0, 0, 0);
      this.isAtHome = true;
      
      // Reset scroll tracking for fresh view
      this.weekly.resetScrollTracking();
      
      this.weekly.setDate(this.currentDate);
      
      if (this.isDataLoaded) {
        this.weekly.renderEvents(this.calendarData);
      }
      
      // NEW: Restore scroll position if we saved one
      if (savedScroll !== null) {
        const timeGrid = document.querySelector('.time-grid');
        if (timeGrid) {
          // Poll until content is ready, then restore scroll
          let checkCount = 0;
          const maxChecks = 20;
          
          const scrollWhenReady = () => {
            checkCount++;
            
            if (timeGrid.scrollHeight > 0) {
              timeGrid.scrollTop = savedScroll;
              logger.debug('Restored scroll position after view switch', { 
                scrollTop: savedScroll,
                checksNeeded: checkCount
              });
            } else if (checkCount < maxChecks) {
              setTimeout(scrollWhenReady, 250);
            }
          };
          
          setTimeout(scrollWhenReady, 50);
        }
      }
    }
    
    this.updateCalendarHeader();

    // Update menu to reflect new active view
    this.sendMenuConfig();

    logger.debug('✓ View mode switched', { viewMode });
  }

  /**
   * Save view mode setting to localStorage and database
   * v1.14 - 10/12/25 11:45pm - CRITICAL FIX: Use dashie-calendar-settings instead of dashie-settings
   */
  async saveViewModeSetting(viewMode) {
    try {
      const localStorage = window.parent?.localStorage || window.localStorage;
      
      // Load existing calendar settings from dashie-calendar-settings (NOT dashie-settings)
      let calendarSettings = {};
      try {
        const existing = localStorage.getItem('dashie-calendar-settings');
        if (existing) {
          calendarSettings = JSON.parse(existing);
        }
      } catch (e) {
        logger.warn('Failed to parse existing calendar settings', e);
      }
      
      // Update view mode in calendar settings
      calendarSettings.dcalViewMode = viewMode;
      
      // Save to dashie-calendar-settings (NOT dashie-settings)
      localStorage.setItem('dashie-calendar-settings', JSON.stringify(calendarSettings));
      logger.debug('✓ Saved viewMode to dashie-calendar-settings', { viewMode });
      
      // Save to database
      const settingsInstance = window.parent?.settingsInstance || window.settingsInstance;
      if (settingsInstance && typeof settingsInstance.handleSettingChange === 'function') {
        await settingsInstance.handleSettingChange('calendar', calendarSettings);
        logger.debug('✓ Saved viewMode to database', { viewMode });
      }
      
    } catch (error) {
      logger.error('Failed to save view mode setting', error);
    }
  }

}

// Initialize widget when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const calendarWidget = new CalendarWidget();

  // Expose for debugging
  window.calendarWidget = calendarWidget;
});