// js/data/services/calendar-services/calendar-fetcher.js
// Handles all Google Calendar API interactions
// Extracted from widget-data-manager for single responsibility

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('CalendarFetcher');

/**
 * CalendarFetcher - Fetch calendar and event data from Google Calendar API
 *
 * Responsibilities:
 * - Fetch calendar lists from multiple accounts
 * - Fetch events from multiple calendars
 * - Group calendars by account type
 * - Add calendar metadata (colors, names) to events
 * - Aggregate data from all accounts
 *
 * Does NOT:
 * - Transform or clean event data (that's EventProcessor's job)
 * - Manage active calendars (that's CalendarConfigManager's job)
 * - Cache data (that's handled by caller)
 */
export class CalendarFetcher {
  constructor(calendarService) {
    if (!calendarService) {
      throw new Error('CalendarService is required for CalendarFetcher');
    }

    this.calendarService = calendarService;
    logger.verbose('CalendarFetcher constructed');
  }

  /**
   * Fetch all calendar data for active calendars
   * This is the main entry point for loading calendar data
   *
   * @param {Array<string>} activeCalendarIds - Account-prefixed calendar IDs
   * @param {object} timeRange - Time range options (timeMin, timeMax, etc.)
   * @returns {Promise<{calendars: Array, events: Array}>}
   */
  async fetchAllCalendarData(activeCalendarIds, timeRange = {}) {
    try {
      logger.debug('Fetching calendar data', {
        activeCalendars: activeCalendarIds.length,
        timeRange
      });

      if (activeCalendarIds.length === 0) {
        logger.info('No active calendars, returning empty data');
        return {
          calendars: [],
          events: []
        };
      }

      // Set default time range if not provided (next 30 days)
      const finalTimeRange = {
        timeMin: timeRange.timeMin || new Date().toISOString(),
        timeMax: timeRange.timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        maxResults: timeRange.maxResults || 2500,
        singleEvents: true,
        orderBy: 'startTime',
        ...timeRange
      };

      // Group calendars by account type
      const calendarsByAccount = this.groupCalendarsByAccount(activeCalendarIds);

      logger.debug('Calendars grouped by account', {
        accounts: Object.keys(calendarsByAccount).length,
        details: Object.entries(calendarsByAccount).map(([type, cals]) => ({
          account: type,
          count: cals.length
        }))
      });

      // Fetch data for each account
      const allCalendars = [];
      const allEvents = [];

      for (const [accountType, calendars] of Object.entries(calendarsByAccount)) {
        try {
          const { accountCalendars, accountEvents } = await this.fetchAccountData(
            accountType,
            calendars,
            finalTimeRange
          );

          allCalendars.push(...accountCalendars);
          allEvents.push(...accountEvents);

        } catch (error) {
          logger.error('Failed to fetch data for account', {
            accountType,
            error: error.message
          });
          // Continue with other accounts even if one fails
        }
      }

      logger.success('All calendar data fetched', {
        calendars: allCalendars.length,
        events: allEvents.length
      });

      return {
        calendars: allCalendars,
        events: allEvents
      };

    } catch (error) {
      logger.error('Failed to fetch calendar data', error);

      // Return empty data on error
      return {
        calendars: [],
        events: []
      };
    }
  }

  /**
   * Fetch calendar and event data for a single account
   *
   * @param {string} accountType - Account type (e.g., 'primary', 'account2')
   * @param {Array} calendars - Array of {prefixedId, calendarId}
   * @param {object} timeRange - Time range options
   * @returns {Promise<{accountCalendars: Array, accountEvents: Array}>}
   * @private
   */
  async fetchAccountData(accountType, calendars, timeRange) {
    const accountCalendars = [];
    const accountEvents = [];

    try {
      // Step 1: Fetch calendar list for this account (to get colors/names)
      logger.debug('Fetching calendar list', { accountType });
      const calendarList = await this.calendarService.getCalendars(accountType);
      accountCalendars.push(...calendarList);

      // Step 2: Fetch events for each active calendar in this account
      for (const { prefixedId, calendarId } of calendars) {
        try {
          const events = await this.fetchCalendarEvents(
            accountType,
            calendarId,
            timeRange,
            calendarList
          );

          // Add prefixed calendar ID to events for tracking
          const eventsWithPrefixedId = events.map(event => ({
            ...event,
            prefixedCalendarId: prefixedId
          }));

          accountEvents.push(...eventsWithPrefixedId);

          logger.debug('Fetched events for calendar', {
            accountType,
            calendarId,
            eventCount: events.length
          });

        } catch (error) {
          logger.error('Failed to fetch events for calendar', {
            accountType,
            calendarId,
            error: error.message
          });
          // Continue with other calendars even if one fails
        }
      }

      return {
        accountCalendars,
        accountEvents
      };

    } catch (error) {
      logger.error('Failed to fetch account data', {
        accountType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Fetch events for a single calendar with metadata
   *
   * @param {string} accountType - Account type
   * @param {string} calendarId - Calendar ID
   * @param {object} timeRange - Time range options
   * @param {Array} calendarList - Calendar list for this account (for colors/names)
   * @returns {Promise<Array>} Events with calendar metadata
   * @private
   */
  async fetchCalendarEvents(accountType, calendarId, timeRange, calendarList) {
    // Fetch raw events from Google API
    const events = await this.calendarService.getEvents(
      accountType,
      calendarId,
      timeRange
    );

    // Find the calendar object to get color info
    const calendarObj = calendarList.find(cal => cal.id === calendarId);

    // Add calendar metadata to each event (needed for rendering and split colors)
    const eventsWithMetadata = events.map(event => ({
      ...event,
      calendarId: calendarId,
      accountType: accountType,
      backgroundColor: calendarObj?.backgroundColor || '#1976d2',
      foregroundColor: calendarObj?.foregroundColor || '#ffffff',
      calendarName: calendarObj?.summary || 'Calendar'
    }));

    return eventsWithMetadata;
  }

  /**
   * Group active calendar IDs by account type
   *
   * @param {Array<string>} activeCalendarIds - Account-prefixed IDs
   * @returns {Object} Calendars grouped by account type
   * @private
   *
   * Example input: ['primary-user@gmail.com', 'account2-work@gmail.com', 'primary-holidays@google.com']
   * Example output: {
   *   'primary': [
   *     { prefixedId: 'primary-user@gmail.com', calendarId: 'user@gmail.com' },
   *     { prefixedId: 'primary-holidays@google.com', calendarId: 'holidays@google.com' }
   *   ],
   *   'account2': [
   *     { prefixedId: 'account2-work@gmail.com', calendarId: 'work@gmail.com' }
   *   ]
   * }
   */
  groupCalendarsByAccount(activeCalendarIds) {
    const grouped = {};

    for (const prefixedId of activeCalendarIds) {
      const { accountType, calendarId } = this.calendarService.parsePrefixedId(prefixedId);

      if (!grouped[accountType]) {
        grouped[accountType] = [];
      }

      grouped[accountType].push({ prefixedId, calendarId });
    }

    return grouped;
  }

  /**
   * Fetch calendars for a specific account
   *
   * @param {string} accountType - Account type
   * @returns {Promise<Array>} Calendar list
   */
  async fetchAccountCalendars(accountType) {
    try {
      return await this.calendarService.getCalendars(accountType);
    } catch (error) {
      logger.error('Failed to fetch calendars for account', {
        accountType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Fetch events for a specific calendar (without metadata enrichment)
   *
   * @param {string} accountType - Account type
   * @param {string} calendarId - Calendar ID
   * @param {object} timeRange - Time range options
   * @returns {Promise<Array>} Raw events
   */
  async fetchRawEvents(accountType, calendarId, timeRange) {
    try {
      return await this.calendarService.getEvents(
        accountType,
        calendarId,
        timeRange
      );
    } catch (error) {
      logger.error('Failed to fetch raw events', {
        accountType,
        calendarId,
        error: error.message
      });
      throw error;
    }
  }
}
