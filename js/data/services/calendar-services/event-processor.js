// js/data/services/calendar-services/event-processor.js
// Handles all event data transformation, cleaning, and normalization
// Extracted from legacy calendar-service for single responsibility

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('EventProcessor');

/**
 * EventProcessor - Transform and normalize calendar events
 *
 * Responsibilities:
 * - Clean and standardize event data
 * - Normalize all-day events (Google's exclusive end dates → inclusive)
 * - Deduplicate events across calendars
 * - Add computed fields for display (displayTitle, isAllDay, etc.)
 * - Format event descriptions safely
 */
export class EventProcessor {
  constructor() {
    logger.verbose('EventProcessor constructed');
  }

  /**
   * Transform raw calendar events for widget consumption
   * This is the main entry point - it orchestrates all transformations
   *
   * @param {Array} events - Raw events from Google API
   * @returns {Array} Fully transformed events ready for display
   */
  transformEvents(events) {
    if (!events || events.length === 0) {
      return [];
    }

    logger.debug('Transforming events', { count: events.length });

    // Step 1: Clean the events (normalize structure, format descriptions)
    const cleanedEvents = this.cleanEventData(events);

    // Step 2: Deduplicate based on content (not just IDs)
    const deduplicated = this.deduplicateEvents(cleanedEvents);

    // Step 3: Add computed fields for display
    const transformed = deduplicated.map(event => ({
      ...event,
      displayTitle: event.summary || '(No title)',
      isAllDay: !!event.start.date,
      startTime: new Date(event.start.dateTime || event.start.date),
      endTime: new Date(event.end.dateTime || event.end.date)
    }));

    logger.success('Events transformed', {
      original: events.length,
      final: transformed.length,
      removed: events.length - transformed.length
    });

    return transformed;
  }

  /**
   * Clean and standardize event data
   * Normalizes Google's all-day event format and event structure
   *
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
      // Google returns end date as the day AFTER the event ends
      // Example: Event on Jan 15 has start: "2025-01-15", end: "2025-01-16"
      // We need to convert end to "2025-01-15"
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
      // Some events have dateTime but span midnight to midnight (00:00 to 00:00)
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

  /**
   * Deduplicate events based on content (title, start, end, calendar)
   * Catches duplicate events with different Google IDs (e.g., same event in multiple calendars)
   *
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

      // Create unique identifier based on content, not ID
      const identifier = `${calendarId}::${title}::${startTime}::${endTime}`;

      if (!eventMap.has(identifier)) {
        eventMap.set(identifier, event);
      } else {
        logger.debug('Duplicate event detected', {
          title: event.summary,
          start: startTime,
          calendarId
        });
      }
    }

    return Array.from(eventMap.values());
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  /**
   * Detect if an event should be treated as all-day
   * Checks if event has date field OR spans midnight to midnight
   *
   * @param {Object} event - Calendar event
   * @returns {boolean} True if event is all-day or effectively all-day
   */
  isEffectivelyAllDay(event) {
    // If it has a date field (not dateTime), it's definitely all-day
    if (event.start.date) {
      return true;
    }

    // Check if it's a dateTime event that spans midnight to midnight
    if (event.start.dateTime && event.end.dateTime) {
      const start = new Date(event.start.dateTime);
      const end = new Date(event.end.dateTime);

      // Check if start is at midnight
      const isStartMidnight = start.getHours() === 0 &&
                              start.getMinutes() === 0 &&
                              start.getSeconds() === 0;

      // Check if end is at midnight
      const isEndMidnight = end.getHours() === 0 &&
                            end.getMinutes() === 0 &&
                            end.getSeconds() === 0;

      return isStartMidnight && isEndMidnight;
    }

    return false;
  }

  /**
   * Format event description safely
   * Escapes HTML to prevent XSS, but allows basic formatting (<br>, <p>)
   *
   * @param {string} description - Raw description from Google
   * @returns {string} Sanitized description
   */
  formatEventDescription(description) {
    if (!description) {
      return '';
    }

    // First escape all HTML
    const escaped = description
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    // Then convert safe formatting back to HTML
    return escaped
      .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
      .replace(/&lt;\/p&gt;\s*&lt;p&gt;/gi, '</p><p>')
      .replace(/&lt;p&gt;/gi, '<p>')
      .replace(/&lt;\/p&gt;/gi, '</p>')
      .replace(/\n/g, '<br>'); // Also handle plain newlines
  }

  /**
   * Format date object to YYYY-MM-DD string (timezone-safe)
   * Uses local date components to avoid timezone shifts
   *
   * @param {Date} date - Date object
   * @returns {string} Formatted date string
   */
  formatDateSafe(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}

// Export singleton instance for convenience
export const eventProcessor = new EventProcessor();
