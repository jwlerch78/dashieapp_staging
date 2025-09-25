// js/services/calendar-service.js - Calendar Data Service
// CHANGE SUMMARY: Added description formatting for HTML content - works for all calendar sources

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
   * Format event descriptions to handle basic HTML formatting safely
   * @param {string} description - Raw description from any calendar source
   * @returns {string} Formatted description with safe HTML
   */
  formatEventDescription(description) {
    if (!description || !description.trim()) return '';
    
    // First escape potentially dangerous HTML
    const escaped = description
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    
    // Then convert safe formatting back to HTML
    return escaped
      .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
      .replace(/&lt;\/p&gt;\s*&lt;p&gt;/gi, '</p><p>')
      .replace(/&lt;p&gt;/gi, '<p>')
      .replace(/&lt;\/p&gt;/gi, '</p>')
      .replace(/\n/g, '<br>'); // Also handle plain newlines
  }

  /**
   * Transform and clean event data from any calendar source
   * @param {Array} events - Raw events from any calendar API
   * @returns {Array} Cleaned and formatted events
   */
  cleanEventData(events) {
    return events.map(event => ({
      ...event,
      // Clean and format description for safe HTML rendering
      description: this.formatEventDescription(event.description),
      
      // Add other universal cleaning/formatting here as needed
      summary: event.summary || 'Untitled Event',
      location: event.location || '',
      attendees: event.attendees || []
    }));
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
      
      const [rawEvents, calendars] = await Promise.all([eventsPromise, calendarsPromise]);
      
      // IMPORTANT: Clean and format all event data regardless of source
      const events = this.cleanEventData(rawEvents);
      
      const duration = timer();
      
      logger.data('refresh', 'calendar', 'success', {
        eventsCount: events.length,
        calendarsCount: calendars.length,
        duration,
        processedDescriptions: events.filter(e => e.description).length
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
    // Clean the events first, then add display transformations
    const cleanedEvents = this.cleanEventData(events);
    
    return cleanedEvents.map(event => ({
      ...event,
      // Add any calendar-specific fields or transformations
      displayTitle: event.summary || '(No title)',
      isAllDay: !!event.start.date,
      startTime: new Date(event.start.dateTime || event.start.date),
      endTime: new Date(event.end.dateTime || event.end.date)
    }));
  }
}