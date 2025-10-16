// widgets/dcal/dcal-events.js - Event Handling and Deduplication Module
// CHANGE SUMMARY: Migrated from calendar-events.js, removed TUI-specific code

import { createLogger } from '../../js/utils/logger.js';

const logger = createLogger('DCalEvents');

export class DCalEvents {
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
    const seen = new Set();
    const deduplicated = [];

    for (const event of events) {
      const identifier = this.generateEventIdentifier(event);
      
      if (!seen.has(identifier)) {
        seen.add(identifier);
        deduplicated.push(event);
      }
    }

    return deduplicated;
  }

  /**
   * Generate a unique identifier for an event
   */
  generateEventIdentifier(event) {
    const calendarId = event.calendarId || '';
    const eventId = event.id || '';
    const startTime = event.start?.dateTime || event.start?.date || '';
    const title = event.summary || '';
    
    return `${calendarId}::${eventId}::${startTime}::${title}`;
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