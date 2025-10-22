// js/widgets/calendar/calendar-events.js - Event Handling and Deduplication Module
// Migrated from legacy dcal widget - Phase 4.5

import { createLogger } from '/js/utils/logger.js';

const logger = createLogger('CalendarEvents');

export class CalendarEvents {
  constructor(calendars) {
    this.calendars = calendars;
  }

  updateCalendars(calendars) {
    if (calendars && calendars.length > 0) {
      this.calendars = calendars.map(cal => ({
        id: cal.id,
        name: cal.summary || cal.name,
        backgroundColor: cal.backgroundColor || '#1976d2',
        color: cal.foregroundColor || '#ffffff'
      }));
    }
  }

  /**
   * Deduplicate events based on unique identifier
   * Migrated from original calendar-events.js
   */
  deduplicateEvents(events) {
    const seen = new Map(); // Changed to Map to track first occurrence
    const deduplicated = [];
    const duplicates = [];

    logger.debug('Starting deduplication', { totalEvents: events.length });

    // Group events by title to find potential duplicates
    const eventsByTitle = {};
    events.forEach(event => {
      const title = event.summary || '';
      if (!eventsByTitle[title]) {
        eventsByTitle[title] = [];
      }
      eventsByTitle[title].push(event);
    });

    // Log events that appear multiple times (potential duplicates)
    const potentialDuplicates = Object.entries(eventsByTitle).filter(([title, evts]) => evts.length > 1);
    if (potentialDuplicates.length > 0) {
      logger.info('🔍 Found events with duplicate titles', {
        count: potentialDuplicates.length,
        samples: potentialDuplicates.slice(0, 20).map(([title, evts]) => ({
          title,
          occurrences: evts.length,
          identifiers: evts.map(e => this.generateEventIdentifier(e)),
          startDates: evts.map(e => e.start?.dateTime || e.start?.date),
          endDates: evts.map(e => e.end?.dateTime || e.end?.date),
          hasDateTime: evts.map(e => !!e.start?.dateTime),
          calendarIds: evts.map(e => e.prefixedCalendarId || e.calendarId)
        }))
      });
    }

    for (const event of events) {
      const identifier = this.generateEventIdentifier(event);

      if (!seen.has(identifier)) {
        seen.set(identifier, event);
        deduplicated.push(event);
      } else {
        duplicates.push({
          identifier,
          title: event.summary,
          calendarId: event.prefixedCalendarId || event.calendarId,
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date
        });
      }
    }

    if (duplicates.length > 0) {
      logger.info('✅ Duplicates actually removed', {
        count: duplicates.length,
        samples: duplicates.slice(0, 20).map(dup => ({
          title: dup.title,
          identifier: dup.identifier,
          start: dup.start,
          end: dup.end,
          calendarId: dup.calendarId
        }))
      });
    } else {
      logger.debug('No duplicates found');
    }

    return deduplicated;
  }

  /**
   * Merge multi-calendar events
   * Events that appear on multiple calendars get combined with all calendar colors
   * Creates split-color events like Skylight calendar
   *
   * @param {Array} events - Array of events
   * @returns {Array} Events with multi-calendar info merged
   */
  mergeMultiCalendarEvents(events) {
    const eventMap = new Map(); // identifier → merged event

    logger.debug('Starting multi-calendar merge', { totalEvents: events.length });

    for (const event of events) {
      const identifier = this.generateEventIdentifier(event);

      if (!eventMap.has(identifier)) {
        // First occurrence - create base event with calendar array
        eventMap.set(identifier, {
          ...event,
          calendars: [{
            id: event.prefixedCalendarId || event.calendarId,
            backgroundColor: event.backgroundColor,
            foregroundColor: event.foregroundColor,
            name: event.calendarName || 'Calendar'
          }],
          isMultiCalendar: false // Will be set to true if more are added
        });
      } else {
        // Duplicate - add this calendar to the existing event
        const existingEvent = eventMap.get(identifier);

        existingEvent.calendars.push({
          id: event.prefixedCalendarId || event.calendarId,
          backgroundColor: event.backgroundColor,
          foregroundColor: event.foregroundColor,
          name: event.calendarName || 'Calendar'
        });

        existingEvent.isMultiCalendar = true;
      }
    }

    const mergedEvents = Array.from(eventMap.values());

    const multiCalendarCount = mergedEvents.filter(e => e.isMultiCalendar).length;
    if (multiCalendarCount > 0) {
      logger.debug('🎨 Multi-calendar events found', {
        total: mergedEvents.length,
        multiCalendar: multiCalendarCount,
        samples: mergedEvents
          .filter(e => e.isMultiCalendar)
          .slice(0, 5)
          .map(e => ({
            title: e.summary,
            calendars: e.calendars.map(c => ({ name: c.name, color: c.backgroundColor }))
          }))
      });
    }

    return mergedEvents;
  }

  /**
   * Generate a unique identifier for an event
   * Based on event title, start time, and end time (not event ID or calendar ID)
   * This catches duplicates across different calendars/accounts
   * Uses lowercase title to handle case variations (e.g., "Birthday" vs "birthday")
   */
  generateEventIdentifier(event) {
    const title = (event.summary || '').toLowerCase().trim();
    const startTime = event.start?.dateTime || event.start?.date || '';
    const endTime = event.end?.dateTime || event.end?.date || '';

    return `${title}::${startTime}::${endTime}`;
  }

  /**
   * Filter events for a specific date range
   */
  getEventsInRange(events, startDate, endDate) {
    return events.filter(event => {
      const eventStart = this.getEventStartDate(event);
      const eventEnd = this.getEventEndDate(event);
      
      // Event overlaps with range if it starts before range ends and ends after range starts
      return eventStart <= endDate && eventEnd >= startDate;
    });
  }

  /**
   * Get event start date
   */
  getEventStartDate(event) {
    if (event.start?.dateTime) {
      return new Date(event.start.dateTime);
    } else if (event.start?.date) {
      // All-day event - parse as local date
      const [year, month, day] = event.start.date.split('-').map(Number);
      return new Date(year, month - 1, day, 0, 0, 0);
    }
    return new Date();
  }

  /**
   * Get event end date
   */
  getEventEndDate(event) {
    if (event.end?.dateTime) {
      return new Date(event.end.dateTime);
    } else if (event.end?.date) {
      // All-day event - parse as local date
      const [year, month, day] = event.end.date.split('-').map(Number);
      return new Date(year, month - 1, day, 0, 0, 0);
    }
    return new Date();
  }

  /**
   * Check if event is all-day
   */
  isAllDayEvent(event) {
    return !!(event.start?.date && !event.start?.dateTime);
  }

  /**
   * Get events for a specific date
   */
  getEventsForDate(events, date) {
    const dateStr = date.toDateString();
    
    return events.filter(event => {
      if (this.isAllDayEvent(event)) {
        // Check if date falls within all-day event range
        const eventStart = this.getEventStartDate(event);
        const eventEnd = this.getEventEndDate(event);
        return date >= eventStart && date < eventEnd;
      } else {
        // For timed events, check if date matches
        const eventDate = this.getEventStartDate(event);
        return eventDate.toDateString() === dateStr;
      }
    });
  }

  /**
   * Sort events chronologically
   */
  sortEvents(events) {
    return [...events].sort((a, b) => {
      const aStart = this.getEventStartDate(a);
      const bStart = this.getEventStartDate(b);
      return aStart - bStart;
    });
  }

  /**
   * Group events by day
   */
  groupEventsByDay(events) {
    const grouped = {};
    
    events.forEach(event => {
      const eventDate = this.getEventStartDate(event);
      const dateKey = eventDate.toDateString();
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      
      grouped[dateKey].push(event);
    });
    
    // Sort events within each day
    Object.keys(grouped).forEach(dateKey => {
      grouped[dateKey] = this.sortEvents(grouped[dateKey]);
    });
    
    return grouped;
  }

  /**
   * Get calendar info for an event
   */
  getEventCalendar(event) {
    return this.calendars.find(cal => cal.id === event.calendarId) || {
      id: event.calendarId,
      name: 'Unknown',
      backgroundColor: '#1976d2',
      color: '#ffffff'
    };
  }

  /**
   * Format event for display
   */
  formatEvent(event) {
    const calendar = this.getEventCalendar(event);
    const isAllDay = this.isAllDayEvent(event);
    
    return {
      id: event.id,
      title: event.summary || 'Untitled Event',
      description: event.description || '',
      location: event.location || '',
      start: this.getEventStartDate(event),
      end: this.getEventEndDate(event),
      isAllDay,
      calendarId: event.calendarId,
      calendarName: calendar.name,
      color: calendar.backgroundColor,
      textColor: calendar.color,
      attendees: event.attendees || [],
      rawEvent: event
    };
  }
}