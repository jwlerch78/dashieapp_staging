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
// Fix the cleanEventData method in calendar-service.js:

// CHANGE SUMMARY: Normalize ALL all-day events to displayable format upstream - subtract 24hrs from Google's exclusive end dates
cleanEventData(events) {
  return events.map(event => {
    const isEffectivelyAllDay = this.isEffectivelyAllDay(event);

    // DEBUG: Log original event data
    logger.debug('=== PROCESSING EVENT ===', {
      title: event.summary || 'Untitled Event',
      isEffectivelyAllDay,
      hasStartDate: !!event.start.date,
      originalStart: {
        date: event.start.date,
        dateTime: event.start.dateTime,
        timeZone: event.start.timeZone
      },
      originalEnd: {
        date: event.end.date,
        dateTime: event.end.dateTime,
        timeZone: event.end.timeZone
      }
    });

    // Normalize the event structure
    let normalizedEvent = {
      ...event,
      // Clean and format description for safe HTML rendering
      description: this.formatEventDescription(event.description),
      
      // Add other universal cleaning/formatting
      summary: event.summary || 'Untitled Event',
      location: event.location || '',
      attendees: event.attendees || []
    };

    // NORMALIZE ALL-DAY EVENTS: Convert Google's "exclusive" end date format to "displayable" format
    // Google's format: end date = actual end + 1 day (exclusive)
    // Displayable format: end date = actual end date (inclusive)
    if (event.start.date) {
      // This is already a Google all-day event - convert to displayable format
      const startDate = event.start.date; // Keep as-is
      const endDateTime = new Date(event.end.date);
      
      // DEBUG: Log before adjustment
      logger.debug('BEFORE adjustment for Google all-day event', {
        title: event.summary,
        startDate: startDate,
        endDate: event.end.date,
        endDateTime: endDateTime.toString(),
        endDateTimeISO: endDateTime.toISOString(),
        endDateTimeLocal: endDateTime.toLocaleDateString()
      });
      
      // Subtract 24 hours to convert from Google's exclusive format to displayable inclusive format
      const displayableEndDateTime = new Date(endDateTime.getTime() - 24 * 60 * 60 * 1000);
      const displayableEndDate = this.formatDateSafe(displayableEndDateTime);
      
      normalizedEvent.start = {
        date: startDate,
        dateTime: null
      };
      
      normalizedEvent.end = {
        date: displayableEndDate,
        dateTime: null
      };
      
      // DEBUG: Log after adjustment
      logger.debug('AFTER adjustment for Google all-day event', {
        title: event.summary,
        originalGoogleStart: event.start.date,
        originalGoogleEnd: event.end.date,
        adjustedStart: normalizedEvent.start.date,
        adjustedEnd: normalizedEvent.end.date,
        displayableEndDateTime: displayableEndDateTime.toString(),
        displayableEndDateTimeISO: displayableEndDateTime.toISOString(),
        displayableEndDateTimeLocal: displayableEndDateTime.toLocaleDateString()
      });
    }
    // NORMALIZE "EFFECTIVELY ALL-DAY" EVENTS: Convert timed events to displayable all-day format
    else if (isEffectivelyAllDay && !event.start.date) {
      // This is a timed event that should be treated as all-day
      // Convert it directly to displayable all-day format (no Google +1 day quirk)
      
      const startDateTime = new Date(event.start.dateTime);
      const endDateTime = new Date(event.end.dateTime);
      
      // DEBUG: Log before adjustment
      logger.debug('BEFORE adjustment for effectively all-day event', {
        title: event.summary,
        startDateTime: startDateTime.toString(),
        endDateTime: endDateTime.toString(),
        startDateTimeISO: startDateTime.toISOString(),
        endDateTimeISO: endDateTime.toISOString(),
        startDateTimeLocal: startDateTime.toLocaleDateString(),
        endDateTimeLocal: endDateTime.toLocaleDateString()
      });
      
      // Use timezone-safe date extraction
      const startDate = this.formatDateSafe(startDateTime);
      
      // For displayable format: end date should be the actual last day (inclusive)
      let endDate;
      
      // Check if this spans multiple calendar days
      const startDateOnly = new Date(startDateTime.getFullYear(), startDateTime.getMonth(), startDateTime.getDate());
      const endDateOnly = new Date(endDateTime.getFullYear(), endDateTime.getMonth(), endDateTime.getDate());
      
      if (startDateOnly.getTime() === endDateOnly.getTime()) {
        // Same day event (like 12am-11:59pm) - end date should be same as start date
        endDate = startDate;
      } else {
        // Multi-day event - end date should be the actual last day (inclusive)
        endDate = this.formatDateSafe(endDateTime);
      }
      
      normalizedEvent.start = {
        date: startDate,
        dateTime: null
      };
      
      normalizedEvent.end = {
        date: endDate,
        dateTime: null
      };
      
      // DEBUG: Log after adjustment
      logger.debug('AFTER adjustment for effectively all-day event', {
        title: event.summary,
        originalStartDateTime: event.start.dateTime,
        originalEndDateTime: event.end.dateTime,
        adjustedStartDate: normalizedEvent.start.date,
        adjustedEndDate: normalizedEvent.end.date,
        startDateOnly: startDateOnly.toString(),
        endDateOnly: endDateOnly.toString(),
        isSameDay: startDateOnly.getTime() === endDateOnly.getTime()
      });
    }

    // DEBUG: Log final result
    logger.debug('=== FINAL NORMALIZED EVENT ===', {
      title: normalizedEvent.summary,
      finalStart: {
        date: normalizedEvent.start.date,
        dateTime: normalizedEvent.start.dateTime
      },
      finalEnd: {
        date: normalizedEvent.end.date,
        dateTime: normalizedEvent.end.dateTime
      }
    });

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