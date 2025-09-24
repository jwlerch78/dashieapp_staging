// widgets/calendar/calendar-events.js - Event Processing, Deduplication, and Calendar Loading
// CHANGE SUMMARY: Extracted event handling into separate module with deduplication logic to prevent duplicate events

import { createLogger } from '../../js/utils/logger.js';

const logger = createLogger('CalendarEvents');

export class CalendarEvents {
  constructor(tuiCalendars) {
    this.tuiCalendars = tuiCalendars;
  }

  updateCalendars(tuiCalendars) {
    this.tuiCalendars = tuiCalendars;
  }

  loadEventsIntoCalendar(calendar, calendarData) {
    if (!calendar || !calendarData || !calendarData.events) {
      logger.warn('Cannot load events', { 
        hasCalendar: !!calendar, 
        hasCalendarData: !!calendarData,
        hasEvents: !!calendarData?.events
      });
      return;
    }
    
    calendar.clear();

    // Events are already deduplicated at the widget level, so just convert them
    const tuiEvents = this.convertToTuiEvents(calendarData.events);

    if (tuiEvents.length) {
      calendar.createEvents(tuiEvents);
      logger.success('Events loaded into TUI Calendar', { eventCount: tuiEvents.length });
    } else {
      logger.info('No events to display');
    }
  }

  deduplicateEvents(events) {
    const eventMap = new Map();
    const duplicates = [];

    for (const event of events) {
      // Create a unique key based on event content, not ID
      // This handles cases where the same event appears with different IDs
      const eventKey = this.createEventKey(event);
      
      if (eventMap.has(eventKey)) {
        duplicates.push({
          original: eventMap.get(eventKey),
          duplicate: event,
          key: eventKey
        });
        logger.debug('Duplicate event detected', {
          title: event.summary,
          start: event.start.dateTime || event.start.date,
          originalId: eventMap.get(eventKey).id,
          duplicateId: event.id
        });
      } else {
        eventMap.set(eventKey, event);
      }
    }

    if (duplicates.length > 0) {
      logger.info('Removed duplicate events', {
        duplicatesFound: duplicates.length,
        uniqueEvents: eventMap.size
      });
    }

    return Array.from(eventMap.values());
  }

  createEventKey(event) {
    // Create a unique key based on event content rather than ID
    // This catches duplicates even when they have different IDs
    const title = (event.summary || '').trim().toLowerCase();
    const startTime = event.start.dateTime || event.start.date;
    const endTime = event.end.dateTime || event.end.date;
    const calendarId = event.calendarId || '';
    
    return `${title}|${startTime}|${endTime}|${calendarId}`;
  }

  convertToTuiEvents(events) {
    return events.map((event, i) => {
      const tuiCalendar = this.tuiCalendars.find(cal => cal.id === event.calendarId) || this.tuiCalendars[0];
      const start = new Date(event.start.dateTime || event.start.date);
      let end = new Date(event.end.dateTime || event.end.date);
      let isAllDay = !!event.start.date;

      // Handle edge case: events that span across days but aren't marked as all-day
      if (!isAllDay && start.getHours() === end.getHours() && start.toDateString() !== end.toDateString()) {
        isAllDay = true;
      } 
      
      // Adjust all-day event end time (Google includes the next day, we need to subtract)
      if (isAllDay) { 
        end = new Date(end.getTime() - 24 * 60 * 60 * 1000); 
      }

      return {
        id: `event-${i}`,
        calendarId: tuiCalendar.id,
        title: event.summary || '(No title)',
        start,
        end,
        category: isAllDay ? 'allday' : 'time',
        backgroundColor: tuiCalendar.backgroundColor,
        borderColor: tuiCalendar.borderColor,
        color: tuiCalendar.color,
        borderRadius: 6,
        isReadOnly: true,
        classNames: ['force-opacity'],
        raw: event
      };
    });
  }

  // Utility methods for event analysis
  getEventsByDay(events, targetDate) {
    const targetDateString = targetDate.toDateString();
    return events.filter(event => {
      const eventStart = new Date(event.start.dateTime || event.start.date);
      const eventEnd = new Date(event.end.dateTime || event.end.date);
      
      // Check if event overlaps with target date
      if (event.start.date) {
        // All-day event - check date range
        const adjustedEnd = new Date(eventEnd.getTime() - 24 * 60 * 60 * 1000);
        return eventStart <= targetDate && targetDate <= adjustedEnd;
      } else {
        // Timed event - check if it's on the same day
        return eventStart.toDateString() === targetDateString;
      }
    });
  }

  getEventStatistics(events) {
    const stats = {
      total: events.length,
      allDay: 0,
      timed: 0,
      byCalendar: {},
      dateRange: {
        earliest: null,
        latest: null
      }
    };

    events.forEach(event => {
      const isAllDay = !!event.start.date;
      if (isAllDay) {
        stats.allDay++;
      } else {
        stats.timed++;
      }

      // Count by calendar
      const calendarId = event.calendarId;
      stats.byCalendar[calendarId] = (stats.byCalendar[calendarId] || 0) + 1;

      // Track date range
      const eventDate = new Date(event.start.dateTime || event.start.date);
      if (!stats.dateRange.earliest || eventDate < stats.dateRange.earliest) {
        stats.dateRange.earliest = eventDate;
      }
      if (!stats.dateRange.latest || eventDate > stats.dateRange.latest) {
        stats.dateRange.latest = eventDate;
      }
    });

    return stats;
  }
}