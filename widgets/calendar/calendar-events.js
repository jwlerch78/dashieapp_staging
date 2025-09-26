// widgets/calendar/calendar-events.js - Event Processing, Deduplication, and Calendar Loading
// CHANGE SUMMARY: Fixed timezone issues in convertToTuiEvents for all-day events to ensure proper display

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

    // DEBUG: Log all incoming events before conversion
    calendarData.events.forEach((event, i) => {
      const isAllDay = !!event.start.date;
    });

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

      } else {
        eventMap.set(eventKey, event);
      }
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

  // FIXED: Timezone-safe date parsing for all-day events
  convertToTuiEvents(events) {
    
    const tuiEvents = events.map((event, i) => {
      const tuiCalendar = this.tuiCalendars.find(cal => cal.id === event.calendarId) || this.tuiCalendars[0];
      const isAllDay = !!event.start.date;

      let start, end;

      if (isAllDay) {
        // FIXED: For all-day events, parse date string safely in local timezone
        // The calendar service has already normalized these dates to the correct display dates
        const startDateString = event.start.date; // e.g., "2025-10-03"
        const endDateString = event.end.date; // e.g., "2025-10-03"
        
        // Parse as local dates to avoid timezone conversion issues
        const [startYear, startMonth, startDay] = startDateString.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDateString.split('-').map(Number);
        
        // Create dates at noon local time to avoid any timezone edge cases
        start = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
        end = new Date(endYear, endMonth - 1, endDay, 12, 0, 0);
        
        } else {
        // For timed events, use the existing logic (already works correctly)
        start = new Date(event.start.dateTime);
        end = new Date(event.end.dateTime);
  
      }

      const tuiEvent = {
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

    
      return tuiEvent;
    });



    // DEBUG: Check for specific date range (Sep 28 - Oct 5)
    const targetStart = new Date(2025, 8, 28); // Sep 28, 2025
    const targetEnd = new Date(2025, 9, 5);   // Oct 5, 2025
    
    const eventsInRange = tuiEvents.filter(event => {
      return event.start >= targetStart && event.start <= targetEnd;
    });

    return tuiEvents;
  }

  // FIXED: Timezone-safe event filtering for getEventsByDay
  getEventsByDay(events, targetDate) {
    const targetDateString = targetDate.toDateString();
    return events.filter(event => {
      const isAllDay = !!event.start.date;
      
      if (isAllDay) {
        // FIXED: For all-day events, parse dates safely to avoid timezone issues
        const startDateString = event.start.date;
        const endDateString = event.end.date;
        
        const [startYear, startMonth, startDay] = startDateString.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDateString.split('-').map(Number);
        
        const eventStart = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
        const eventEnd = new Date(endYear, endMonth - 1, endDay, 12, 0, 0);
        
        // Check if event overlaps with target date
        return eventStart <= targetDate && targetDate <= eventEnd;
      } else {
        // Timed event - check if it's on the same day
        const eventStart = new Date(event.start.dateTime);
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

      // Track date range - use same timezone-safe parsing
      let eventDate;
      if (isAllDay) {
        const dateString = event.start.date;
        const [year, month, day] = dateString.split('-').map(Number);
        eventDate = new Date(year, month - 1, day, 12, 0, 0);
      } else {
        eventDate = new Date(event.start.dateTime);
      }
      
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