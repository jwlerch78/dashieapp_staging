// js/services/calendar-service.js - Calendar Data Service
// CHANGE SUMMARY: Extracted calendar logic from data-manager.js, maintains same API methods

import { createLogger } from '../utils/logger.js';

const logger = createLogger('CalendarService');

/**
 * Calendar data service - handles Google Calendar API calls and data transformation
 * Extracted from DataManager to maintain single responsibility
 */
export class CalendarService {
  constructor(googleAPIClient) {
    this.googleAPI = googleAPIClient;
    
    logger.info('Calendar service initialized');
  }

  /**
   * Refresh calendar data from Google APIs
   * @param {Object} options - Refresh options
   * @param {Array} options.calendars - Cached calendars to reuse
   * @returns {Promise<Object>} Calendar data with events and calendars
   */
  async refreshCalendarData(options = {}) {
    logger.data('refresh', 'calendar', 'pending');
    
    const timer = logger.startTimer('Calendar Data Refresh');
    
    try {
      let calendarsPromise;
      let eventsPromise;
      
      // OPTIMIZED: Reuse calendar metadata if provided
      if (options.calendars && options.calendars.length > 0) {
        calendarsPromise = Promise.resolve(options.calendars);
        eventsPromise = this.googleAPI.getAllCalendarEvents({ calendars: options.calendars });
        logger.debug('Reusing provided calendar metadata to avoid redundant API call');
      } else {
        // Need fresh calendar metadata
        calendarsPromise = this.googleAPI.getCalendarList();
        eventsPromise = calendarsPromise.then(calendars => 
          this.googleAPI.getAllCalendarEvents({ calendars })
        );
        logger.debug('Fetching fresh calendar metadata');
      }
      
      const [events, calendars] = await Promise.all([eventsPromise, calendarsPromise]);
      
      const duration = timer();
      
      logger.data('refresh', 'calendar', 'success', {
        eventsCount: events.length,
        calendarsCount: calendars.length,
        duration
      });
      
      return {
        events,
        calendars,
        lastUpdated: Date.now()
      };
      
    } catch (error) {
      timer();
      logger.data('refresh', 'calendar', 'error', error.message);
      throw error;
    }
  }

  /**
   * Handle calendar-specific widget requests
   * @param {string} requestType - Type of request (events, calendars, etc.)
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  async handleCalendarRequest(requestType, params) {
    switch (requestType) {
      case 'events':
      case 'all':
        return await this.refreshCalendarData(params);
        
      case 'calendars':
        return {
          calendars: await this.googleAPI.getCalendarList(),
          lastUpdated: Date.now()
        };
        
      default:
        throw new Error(`Unknown calendar request type: ${requestType}`);
    }
  }

  /**
   * Transform raw calendar events for widget consumption
   * @param {Array} events - Raw events from API
   * @returns {Array} Transformed events
   */
  transformEvents(events) {
    // Add any calendar-specific transformations here
    return events.map(event => ({
      ...event,
      // Add any calendar-specific fields or transformations
      displayTitle: event.summary || '(No title)',
      isAllDay: !!event.start.date,
      startTime: new Date(event.start.dateTime || event.start.date),
      endTime: new Date(event.end.dateTime || event.end.date)
    }));
  }
}