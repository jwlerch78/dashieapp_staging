// js/services/calendar-service.js - Calendar Data Service
// CHANGE SUMMARY: FIXED - Load active calendar IDs from settings instead of using hardcoded config

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
   * Load active calendar IDs from settings
   * @returns {Array} Array of active calendar IDs, or null if no settings
   */
  loadActiveCalendarIds() {
    try {
      // Try localStorage first (fast)
      const localStorage = window.parent?.localStorage || window.localStorage;
      const cached = localStorage.getItem('dashie_calendar_settings');
      
      if (cached) {
        const settings = JSON.parse(cached);
        const activeIds = settings.activeCalendarIds || [];
        
        logger.debug('Loaded active calendar IDs from localStorage', {
          count: activeIds.length,
          calendarIds: activeIds
        });
        
        return activeIds.length > 0 ? activeIds : null;
      }
      
      // Try database settings as fallback
      const settingsInstance = window.parent?.settingsInstance || window.settingsInstance;
      if (settingsInstance && settingsInstance.controller) {
        const dbSettings = settingsInstance.controller.getSetting('calendar');
        if (dbSettings && dbSettings.activeCalendarIds) {
          const activeIds = dbSettings.activeCalendarIds;
          
          logger.debug('Loaded active calendar IDs from database', {
            count: activeIds.length,
            calendarIds: activeIds
          });
          
          return activeIds.length > 0 ? activeIds : null;
        }
      }
      
      logger.debug('No active calendar IDs found in settings');
      return null;
      
    } catch (error) {
      logger.warn('Error loading active calendar IDs from settings', error);
      return null;
    }
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

  // CHANGE SUMMARY: Fixed calendar metadata loading to include calendars from all accounts, not just 'personal'

/**
 * Refresh calendar data from Google APIs
 * FIXED: Now fetches calendar metadata from ALL accounts to get correct colors
 * @param {Object} options - Refresh options
 * @param {Array} options.calendars - Cached calendars to reuse
 * @returns {Promise<Object>} Calendar data with events and calendars
 */
async refreshCalendarData(options = {}) {
  logger.data('refresh', 'calendar', 'pending');
  
  const timer = logger.startTimer('Calendar Data Refresh');
  
  try {
    // Load active calendar IDs and account mapping from settings
    const activeCalendarIds = this.loadActiveCalendarIds();
    
    if (activeCalendarIds) {
      logger.info('Using active calendar IDs from settings', {
        count: activeCalendarIds.length,
        calendarIds: activeCalendarIds
      });
    } else {
      logger.info('No calendar settings found, using config defaults');
    }
    
    let calendarsPromise;
    let eventsPromise;
    
    // FIXED: Always fetch fresh calendar metadata from ALL accounts
    // We can't reuse cached calendars because they might be missing accounts
    calendarsPromise = this.fetchAllCalendarsMetadata();
    eventsPromise = this.googleAPI.getAllCalendarEvents({
      calendarIds: activeCalendarIds
    });
    
    logger.debug('Fetching calendars metadata from all accounts and events');
    
    const [rawEvents, calendars] = await Promise.all([eventsPromise, calendarsPromise]);
    
    // Call transformEvents to normalize events before returning
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
      events: transformedEvents,
      calendars,
      lastUpdated: Date.now()
    };
    
  } catch (error) {
    timer();
    logger.data('refresh', 'calendar', 'error', error.message);
    throw error;
  }
}

// CHANGE SUMMARY: Fixed calendar color conflicts by tracking which account each calendar is fetched from, ensuring correct colors for shared calendars

/**
 * Fetch calendar metadata from all accounts
 * UPDATED: Now tracks which account each calendar comes from and only includes calendars that are actually enabled
 * This ensures correct colors for shared calendars (same calendar ID, different colors in different accounts)
 * @returns {Promise<Array>} Array of calendar objects with account-specific colors
 */
async fetchAllCalendarsMetadata() {
  try {
    // Get calendar settings to know which accounts exist
    const localStorage = window.parent?.localStorage || window.localStorage;
    const calendarSettings = localStorage.getItem('dashie_calendar_settings');
    
    if (!calendarSettings) {
      logger.warn('No calendar settings found, fetching from personal account only');
      return await this.googleAPI.getCalendarList('personal');
    }

    const settings = JSON.parse(calendarSettings);
    const accounts = Object.keys(settings.accounts || {});
    const calendarAccountMap = settings.calendarAccountMap || {};
    const activeCalendarIds = settings.activeCalendarIds || [];
    
    if (accounts.length === 0) {
      logger.warn('No accounts in settings, fetching from personal account only');
      return await this.googleAPI.getCalendarList('personal');
    }

    logger.debug('Fetching calendar metadata from all accounts', {
      accountCount: accounts.length,
      accounts: accounts,
      activeCalendars: activeCalendarIds.length
    });

    // Fetch calendars from each account in parallel
    const calendarPromises = accounts.map(async accountType => {
      try {
        const calendars = await this.googleAPI.getCalendarList(accountType);
        // Tag each calendar with its source account
        return calendars.map(cal => ({
          ...cal,
          sourceAccount: accountType
        }));
      } catch (error) {
        logger.warn(`Failed to fetch calendars for account ${accountType}`, error);
        return [];
      }
    });

    const calendarArrays = await Promise.all(calendarPromises);
    const allCalendars = calendarArrays.flat();

    // CRITICAL: For each active calendar, only include the version from the account that's actually using it
    // This ensures we get the right color for shared calendars
    const calendarsByActiveAccount = [];
    
    for (const calendarId of activeCalendarIds) {
      const accountType = calendarAccountMap[calendarId] || 'personal';
      
      // Find the calendar metadata from the specific account that's using it
      const calendar = allCalendars.find(cal => 
        cal.id === calendarId && cal.sourceAccount === accountType
      );
      
      if (calendar) {
        calendarsByActiveAccount.push(calendar);
        logger.debug(`Using calendar ${calendar.summary} from account ${accountType}`, {
          calendarId: calendar.id,
          color: calendar.backgroundColor,
          account: accountType
        });
      } else {
        // Fallback: if we can't find it in the specific account, use any version
        const fallbackCalendar = allCalendars.find(cal => cal.id === calendarId);
        if (fallbackCalendar) {
          calendarsByActiveAccount.push(fallbackCalendar);
          logger.warn(`Calendar ${calendarId} not found in account ${accountType}, using fallback`, {
            calendarId,
            fallbackAccount: fallbackCalendar.sourceAccount
          });
        } else {
          logger.warn(`Calendar ${calendarId} not found in any account`);
        }
      }
    }

    logger.success('Fetched calendar metadata from all accounts (account-specific)', {
      totalCalendars: calendarsByActiveAccount.length,
      accountCount: accounts.length,
      activeCalendars: activeCalendarIds.length
    });

    return calendarsByActiveAccount;

  } catch (error) {
    logger.error('Failed to fetch calendars from all accounts', error);
    // Fallback to personal account only
    return await this.googleAPI.getCalendarList('personal');
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
    // Clean the events first
    const cleanedEvents = this.cleanEventData(events);
    
    // ADDED: Deduplicate based on content, not event IDs
    const deduplicated = this.deduplicateEvents(cleanedEvents);
    
    return deduplicated.map(event => ({
      ...event,
      displayTitle: event.summary || '(No title)',
      isAllDay: !!event.start.date,
      startTime: new Date(event.start.dateTime || event.start.date),
      endTime: new Date(event.end.dateTime || event.end.date)
    }));
  }

  /**
   * Deduplicate events based on content (title, start, end, calendar)
   * Catches duplicate events with different Google IDs
   * @param {Array} events - Events to deduplicate
   * @returns {Array} Deduplicated events
   */
  deduplicateEvents(events) {
    const eventMap = new Map();

    for (const event of events) {
      const title = (event.summary || '').trim().toLowerCase();
      const startTime = event.start?.dateTime || event.start?.date || '';
      const endTime = event.end?.dateTime || event.end?.date || '';
      const calendarId = event.calendarId || '';
      
      const identifier = `${calendarId}::${title}::${startTime}::${endTime}`;
      
      if (!eventMap.has(identifier)) {
        eventMap.set(identifier, event);
      }
    }

    const deduplicated = Array.from(eventMap.values());

    logger.info('Event deduplication in CalendarService', {
      originalCount: events.length,
      deduplicatedCount: deduplicated.length,
      duplicatesRemoved: events.length - deduplicated.length
    });

    return deduplicated;
  }
}