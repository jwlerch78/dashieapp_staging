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
 * Clean and standardize event data
 * @param {Array} events - Raw events from API
 * @returns {Array} Cleaned and standardized events
 */
// CHANGE SUMMARY: Production cleanEventData - debug logging removed, data normalization intact
cleanEventData(events) {
  return events.map(event => {
    const isEffectivelyAllDay = this.isEffectivelyAllDay(event);

    // Normalize the event structure
    let normalizedEvent = {
      ...event,
      description: this.formatEventDescription(event.description),
      summary: event.summary || 'Untitled Event',
      location: event.location || '',
      attendees: event.attendees || []
    };

    // NORMALIZE GOOGLE ALL-DAY EVENTS: Convert Google's "exclusive" end date to "inclusive"
    if (event.start.date) {
      const startDate = event.start.date; // Keep as-is
      
      // Parse the date string directly and subtract 1 day properly
      const endDateParts = event.end.date.split('-');
      const endYear = parseInt(endDateParts[0]);
      const endMonth = parseInt(endDateParts[1]) - 1; // Month is 0-indexed
      const endDay = parseInt(endDateParts[2]);
      
      // Create date object and subtract 1 day
      const endDateObj = new Date(endYear, endMonth, endDay);
      const adjustedEndDateObj = new Date(endDateObj);
      adjustedEndDateObj.setDate(adjustedEndDateObj.getDate() - 1);
      
      // Format back to YYYY-MM-DD
      const adjustedEndDate = this.formatDateSafe(adjustedEndDateObj);
      
      normalizedEvent.start = {
        date: startDate,
        dateTime: null
      };
      
      normalizedEvent.end = {
        date: adjustedEndDate,
        dateTime: null
      };
    }
    // NORMALIZE "EFFECTIVELY ALL-DAY" EVENTS
    else if (isEffectivelyAllDay && !event.start.date) {
      const startDateTime = new Date(event.start.dateTime);
      const endDateTime = new Date(event.end.dateTime);
      
      const startDate = this.formatDateSafe(startDateTime);
      
      // For effectively all-day events, check if they span multiple days
      const startDateOnly = new Date(startDateTime.getFullYear(), startDateTime.getMonth(), startDateTime.getDate());
      const endDateOnly = new Date(endDateTime.getFullYear(), endDateTime.getMonth(), endDateTime.getDate());
      
      let endDate;
      if (startDateOnly.getTime() === endDateOnly.getTime()) {
        // Same day event - end date same as start date
        endDate = startDate;
      } else {
        // Multi-day event - use the actual last day, not Google's +1 format
        // Subtract 1 day from the end to get the actual last day
        const actualEndDate = new Date(endDateOnly);
        actualEndDate.setDate(actualEndDate.getDate() - 1);
        endDate = this.formatDateSafe(actualEndDate);
      }
      
      normalizedEvent.start = {
        date: startDate,
        dateTime: null
      };
      
      normalizedEvent.end = {
        date: endDate,
        dateTime: null
      };
    }

    return normalizedEvent;
  });
}


// Helper method for timezone-safe date formatting
formatDateSafe(date) {
  // Use local date components to avoid timezone shifts
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Normalize all-day event end times (Google includes next day, we need to adjust)
 * @param {Object} event - Calendar event
 * @returns {Date} Adjusted end date for all-day events
 */
normalizeAllDayEndTime(event) {
  const end = new Date(event.end.dateTime || event.end.date);
  
  // For all-day events, Google includes the next day in the end date
  // We need to subtract a day to get the actual last day of the event
  if (this.isEffectivelyAllDay(event)) {
    return new Date(end.getTime() - 24 * 60 * 60 * 1000);
  }
  
  return end;
}


/**
 * Detect if an event should be treated as all-day
 * @param {Object} event - Calendar event
 * @returns {boolean} True if event should be treated as all-day
 */
isEffectivelyAllDay(event) {
  // Already marked as all-day in the data
  if (event.start?.date) {
    return true;
  }

  // Check for timed events that are effectively all-day
  if (event.start?.dateTime && event.end?.dateTime) {
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    
    // Handle edge case: events that span across days but aren't marked as all-day
    if (start.getHours() === end.getHours() && start.toDateString() !== end.toDateString()) {
      return true;
    }
    
    // Check for midnight-to-midnight or midnight-to-noon patterns
    const startHour = start.getHours();
    const startMinute = start.getMinutes();
    const endHour = end.getHours();
    const endMinute = end.getMinutes();
    
    // Starts at midnight (12:00 AM)
    const startsAtMidnight = startHour === 0 && startMinute === 0;
    
    // Ends at midnight next day, or 11:59 PM same day, or noon (12:00 PM)
    const endsAtEndOfDay = (endHour === 0 && endMinute === 0) || // Next day midnight
                           (endHour === 23 && endMinute >= 59); // 11:59 PM
                               
    if (startsAtMidnight && endsAtEndOfDay) {
      return true;
    }
  }

  return false;
}



  /**
   * Refresh calendar data from Google APIs
   * @param {Object} options - Refresh options
   * @param {Array} options.calendars - Cached calendars to reuse
   * @returns {Promise<Object>} Calendar data with events and calendars
   */
 // CHANGE SUMMARY: Hook up cleanEventData method - actually normalize events before returning to widgets
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
    
    // FIXED: Call transformEvents (which calls cleanEventData) to normalize events before returning
    logger.info('Processing raw events through transformEvents', {
      rawEventsCount: rawEvents.length
    });
    
    const transformedEvents = this.transformEvents(rawEvents);
    
    logger.info('Events transformed and normalized', {
      originalCount: rawEvents.length,
      transformedCount: transformedEvents.length
    });
    
    const duration = timer();
    
    logger.data('refresh', 'calendar', 'success', {
      eventsCount: transformedEvents.length,
      calendarsCount: calendars.length,
      duration
    });
    
    return {
      events: transformedEvents, // Return transformed events instead of raw events
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