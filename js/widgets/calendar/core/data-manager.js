// js/widgets/Calendar/core/data-manager.js
// Manages calendar data loading, caching, and updates

import { createLogger } from '/js/utils/logger.js';

const logger = createLogger('CalendarDataManager');

export class CalendarDataManager {
  constructor(widget) {
    this.widget = widget;
    this.calendarData = { events: [], calendars: [], lastUpdated: null };
    this.isDataLoaded = false;
    this.midnightTimer = null;
    this.connectionStatus = 'connecting';
  }

  /**
   * Load calendar data from CalendarService
   */
  async loadCalendarData() {
    try {
      const calendarService = window.parent?.calendarService || window.calendarService;
      const sessionManager = window.parent?.sessionManager || window.sessionManager;

      if (!calendarService || !sessionManager) {
        logger.warn('CalendarService or SessionManager not available - waiting...');
        // Try again after a delay
        setTimeout(() => this.loadCalendarData(), 1000);
        return;
      }

      logger.debug('Loading calendar data from CalendarService...');

      // Get all accounts
      const tokenStore = sessionManager.getTokenStore();
      const googleAccounts = await tokenStore.getProviderAccounts('google');
      const accountTypes = Object.keys(googleAccounts || {});

      logger.debug('Found accounts:', { count: accountTypes.length, accounts: accountTypes });

      // Get active calendar IDs
      const activeCalendarIds = calendarService.getActiveCalendarIds();

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
          const calendars = await calendarService.getCalendars(accountType);
          allCalendars.push(...calendars);

          // Get events from each active calendar in this account
          for (const prefixedCalendarId of activeCalendarIds) {
            // Check if this calendar belongs to this account
            if (!prefixedCalendarId.startsWith(`${accountType}-`)) {
              continue;
            }

            // Extract the actual calendar ID (remove account prefix)
            const calendarId = prefixedCalendarId.substring(`${accountType}-`.length);

            // Find the calendar object to get color info
            const calendarObj = calendars.find(cal => cal.id === calendarId);

            try {
              const events = await calendarService.getEvents(
                accountType,
                calendarId,
                timeRange
              );

              // Add metadata to each event
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
      this.connectionStatus = 'error';
      this.widget.settingsManager.updateConnectionStatus('error');
    }
  }

  /**
   * Get date range for fetching events
   */
  getDateRange() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start date: daysInPast days ago
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - this.widget.config.daysInPast);

    // End date: daysInFuture days from now
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + this.widget.config.daysInFuture);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }

  /**
   * Handle incoming calendar data
   */
  handleCalendarData(data) {
    if (data.status === 'error') {
      this.connectionStatus = 'error';
      this.widget.settingsManager.updateConnectionStatus('error');
      logger.error('Calendar data error', { error: data.status });
      return;
    }

    // Merge multi-calendar events
    const rawEvents = data.events || [];
    const events = this.widget.events.mergeMultiCalendarEvents(rawEvents);

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
    this.connectionStatus = 'connected';
    this.widget.settingsManager.updateConnectionStatus('connected');
    this.updateCalendarConfigurations();

    // Update last updated timestamp
    this.widget.settingsManager.startLastUpdatedInterval(Date.now());

    // Set up midnight detection timer
    this.setupMidnightTimer();

    // Render events in weekly view
    this.widget.weekly.renderEvents(this.calendarData);

    // Trigger scroll positioning after first data load
    this.widget.weekly.setOptimalScrollPosition();

    this.showCalendar();
    this.widget.navigationManager.updateCalendarHeader();
  }

  /**
   * Update calendar configurations
   */
  updateCalendarConfigurations() {
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
    this.widget.config.updateCalendars(updatedCalendars);
    this.widget.events.updateCalendars(updatedCalendars);
    this.widget.weekly.updateCalendars(updatedCalendars);
    if (this.widget.monthly) {
      this.widget.monthly.updateCalendars(updatedCalendars);
    }

    logger.debug('Calendar configurations updated with Google colors', {
      calendars: updatedCalendars.length,
      calendarNames: updatedCalendars.map(c => c.name)
    });
  }

  /**
   * Show calendar UI
   */
  showCalendar() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('calendarHeader').style.display = 'flex';
    document.getElementById('calendar').style.display = 'flex';
  }

  /**
   * Set up timer to detect midnight and update calendar
   */
  setupMidnightTimer() {
    // Clear existing timer if any
    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer);
    }

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0); // Next midnight

    const msUntilMidnight = tomorrow - now;

    logger.debug('Setting up midnight timer', {
      now: now.toISOString(),
      midnight: tomorrow.toISOString(),
      msUntilMidnight: msUntilMidnight
    });

    this.midnightTimer = setTimeout(() => {
      logger.info('Midnight detected - updating calendar to new day');

      // Update current date to new day
      this.widget.navigationManager.goToToday();

      // Refresh data for new day
      this.loadCalendarData();

      // Set up timer for next midnight
      this.setupMidnightTimer();

      logger.info('Calendar updated for new day');
    }, msUntilMidnight);
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer);
    }
  }
}
