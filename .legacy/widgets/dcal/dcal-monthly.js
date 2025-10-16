// widgets/dcal/dcal-monthly.js - Monthly View Rendering Module
// v1.0 - 10/10/25 7:15pm - Initial implementation for monthly calendar view
// CHANGE SUMMARY: Created monthly view with CSS Grid, multi-day event spanning, up to 4 events per day

import { createLogger } from '../../js/utils/logger.js';

const logger = createLogger('DCalMonthly');

export class DCalMonthly {
  constructor(calendars, settings = {}) {
    this.calendars = calendars;
    this.currentDate = new Date();
    this.monthDates = []; // Array of 42 dates (6 weeks x 7 days)
    this.startWeekOn = settings.startWeekOn || 'sun'; // 'sun' or 'mon'
  }

  updateCalendars(calendars) {
    if (calendars && calendars.length > 0) {
      this.calendars = calendars.map(cal => ({
        id: cal.id,
        name: cal.summary || cal.name,
        backgroundColor: cal.backgroundColor || '#1976d2',
        borderColor: cal.backgroundColor || '#1976d2',
        color: cal.foregroundColor || '#ffffff'
      }));
    }
  }

  initialize(date) {
    this.currentDate = date;
    this.calculateMonthGrid();
    this.render();
  }

  setDate(date) {
    this.currentDate = date;
    this.calculateMonthGrid();
    this.render();
  }

  updateSettings(settings) {
    this.startWeekOn = settings.startWeekOn || 'sun';
    this.calculateMonthGrid();
    this.render();
  }

  /**
   * Calculate 6 weeks x 7 days grid for the month
   * Always shows 6 weeks to prevent height jumping between months
   */
  calculateMonthGrid() {
    this.monthDates = [];
    
    // Get first day of current month
    const firstOfMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
    
    // Calculate starting date (could be from previous month)
    const firstDayOfWeek = firstOfMonth.getDay(); // 0 = Sunday
    const offset = this.startWeekOn === 'mon'
      ? (firstDayOfWeek === 0 ? -6 : 1 - firstDayOfWeek)
      : -firstDayOfWeek;
    
    const startDate = new Date(firstOfMonth);
    startDate.setDate(startDate.getDate() + offset);
    
    // Generate 42 dates (6 weeks)
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      this.monthDates.push(date);
    }
    
    logger.debug('Month grid calculated', {
      firstOfMonth: firstOfMonth.toDateString(),
      startDate: startDate.toDateString(),
      totalDates: this.monthDates.length
    });
  }

  /**
   * Render the month grid HTML
   */
  render() {
    const monthGrid = document.querySelector('.month-grid');
    if (!monthGrid) {
      logger.error('Month grid container not found');
      return;
    }

    const today = new Date();
    const currentMonth = this.currentDate.getMonth();
    const dayNames = this.startWeekOn === 'mon'
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Build HTML
    let html = `
      <div class="month-day-names">
        ${dayNames.map(name => `<div class="month-day-name">${name}</div>`).join('')}
      </div>
      <div class="month-weeks">
    `;

    // Render 6 weeks
    for (let week = 0; week < 6; week++) {
      html += `<div class="month-week" id="monthWeek${week}">`;
      
      // Render 7 days in this week
      for (let day = 0; day < 7; day++) {
        const dateIndex = week * 7 + day;
        const date = this.monthDates[dateIndex];
        const isToday = date.toDateString() === today.toDateString();
        const isOtherMonth = date.getMonth() !== currentMonth;
        
        html += `
          <div class="month-day-cell" data-date="${date.toISOString().split('T')[0]}" data-day="${day}">
            <div class="month-day-number ${isToday ? 'today' : ''} ${isOtherMonth ? 'other-month' : ''}">
              ${date.getDate()}
            </div>
          </div>
        `;
      }
      
      html += `</div>`;
    }

    html += `</div>`;
    monthGrid.innerHTML = html;
    
    logger.debug('Month grid rendered', {
      weekCount: 6,
      dayCount: 42
    });
  }

  /**
   * Render events onto the month grid
   */
  renderEvents(calendarData) {
    if (!calendarData || !calendarData.events) {
      logger.warn('No calendar data provided for rendering');
      return;
    }

    // Clear existing events from all weeks
    for (let week = 0; week < 6; week++) {
      const weekElement = document.getElementById(`monthWeek${week}`);
      if (weekElement) {
        weekElement.querySelectorAll('.month-event, .month-more-events').forEach(e => e.remove());
      }
    }

    // Separate all-day and timed events
    const allDayEvents = [];
    const timedEvents = [];

    calendarData.events.forEach(event => {
      const isAllDay = !!(event.start?.date && !event.start?.dateTime);
      if (isAllDay) {
        allDayEvents.push(event);
      } else {
        timedEvents.push(event);
      }
    });

    // Render all-day events first (they take priority)
    this.renderAllDayEvents(allDayEvents);

    // Render timed events
    this.renderTimedEvents(timedEvents);

    logger.info('Events rendered in monthly view', {
      eventCount: calendarData.events.length,
      allDayCount: allDayEvents.length,
      timedCount: timedEvents.length
    });
  }

  /**
   * Render all-day events with multi-day spanning
   */
  renderAllDayEvents(allDayEvents) {
    // Group events by week
    const eventsByWeek = Array.from({ length: 6 }, () => []);

    allDayEvents.forEach(event => {
      const startDateString = event.start.date;
      const endDateString = event.end.date;

      const [startYear, startMonth, startDay] = startDateString.split('-').map(Number);
      const [endYear, endMonth, endDay] = endDateString.split('-').map(Number);

      // Create dates at noon to avoid timezone issues
      let eventStart = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
      let eventEnd = new Date(endYear, endMonth - 1, endDay, 12, 0, 0);

      // Find which week(s) this event belongs to
      this.addEventToWeeks(event, eventStart, eventEnd, eventsByWeek, 'all-day');
    });

    // Render events for each week
    eventsByWeek.forEach((weekEvents, weekIndex) => {
      this.renderWeekEvents(weekIndex, weekEvents);
    });
  }

  /**
   * Render timed events with time prefix
   */
  renderTimedEvents(timedEvents) {
    // Group events by week
    const eventsByWeek = Array.from({ length: 6 }, () => []);

    timedEvents.forEach(event => {
      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end.dateTime);

      // Find which week(s) this event belongs to
      this.addEventToWeeks(event, eventStart, eventEnd, eventsByWeek, 'timed');
    });

    // Render events for each week (appending to existing all-day events)
    eventsByWeek.forEach((weekEvents, weekIndex) => {
      this.renderWeekEvents(weekIndex, weekEvents);
    });
  }

  /**
   * Add event to appropriate week(s) with spanning information
   */
  addEventToWeeks(event, eventStart, eventEnd, eventsByWeek, eventType) {
    // Process each week
    for (let week = 0; week < 6; week++) {
      const weekStartIndex = week * 7;
      const weekEndIndex = weekStartIndex + 6;
      
      const weekStartDate = this.monthDates[weekStartIndex];
      const weekEndDate = this.monthDates[weekEndIndex];

      // Check if event overlaps with this week
      if (eventEnd < weekStartDate || eventStart > weekEndDate) {
        continue; // Event doesn't belong to this week
      }

      // Find start day index within this week (0-6)
      let startDayIndex = -1;
      for (let i = 0; i < 7; i++) {
        const date = this.monthDates[weekStartIndex + i];
        if (date.toDateString() === eventStart.toDateString() || 
            (eventStart < date && startDayIndex === -1)) {
          startDayIndex = i;
          break;
        }
      }

      // If event starts before this week, start from day 0
      if (startDayIndex === -1 && eventStart < weekStartDate) {
        startDayIndex = 0;
      }

      if (startDayIndex === -1) continue;

      // Calculate span within this week
      let spanDays = 1;
      let current = new Date(this.monthDates[weekStartIndex + startDayIndex]);
      current.setDate(current.getDate() + 1);

      while (current <= eventEnd && startDayIndex + spanDays < 7) {
        spanDays++;
        current.setDate(current.getDate() + 1);
      }

      // Add event info to this week
      eventsByWeek[week].push({
        event,
        startDayIndex,
        spanDays,
        eventType,
        endDayIndex: startDayIndex + spanDays - 1
      });
    }
  }

  /**
   * Render events for a specific week with stacking logic
   */
  renderWeekEvents(weekIndex, weekEvents) {
    const weekElement = document.getElementById(`monthWeek${weekIndex}`);
    if (!weekElement) return;

    // Stack events into rows to avoid overlaps
    const eventRows = [];

    weekEvents.forEach(eventInfo => {
      // Find first row where this event doesn't overlap
      let placed = false;
      for (let rowIndex = 0; rowIndex < eventRows.length; rowIndex++) {
        const row = eventRows[rowIndex];
        let hasOverlap = false;

        for (const existingEvent of row) {
          if (!(eventInfo.endDayIndex < existingEvent.startDayIndex || 
                eventInfo.startDayIndex > existingEvent.endDayIndex)) {
            hasOverlap = true;
            break;
          }
        }

        if (!hasOverlap) {
          row.push(eventInfo);
          placed = true;
          break;
        }
      }

      if (!placed) {
        eventRows.push([eventInfo]);
      }
    });

    // Limit to 4 events per day, count overflow
    const maxVisibleRows = 4;
    const visibleRows = eventRows.slice(0, maxVisibleRows);
    const hiddenCount = eventRows.length - maxVisibleRows;

    // Render visible events
    visibleRows.forEach((row, rowIndex) => {
      row.forEach(eventInfo => {
        this.renderMonthEvent(weekElement, eventInfo, rowIndex + 2); // +2 because row 1 is day numbers
      });
    });

    // Show "+N more" if there are hidden events
    if (hiddenCount > 0) {
      const moreElement = document.createElement('div');
      moreElement.className = 'month-more-events';
      moreElement.textContent = `+${hiddenCount} more`;
      moreElement.style.gridRow = `${maxVisibleRows + 2}`;
      moreElement.style.gridColumn = '1 / 8';
      weekElement.appendChild(moreElement);
    }
  }

  /**
   * Render a single month event element
   */
  renderMonthEvent(weekElement, eventInfo, gridRow) {
    const { event, startDayIndex, spanDays, eventType } = eventInfo;

    // Get calendar color
    const calendar = this.calendars.find(cal => cal.id === event.calendarId);
    const backgroundColor = calendar?.backgroundColor || '#1976d2';

    const eventElement = document.createElement('div');
    eventElement.className = `month-event ${eventType}`;
    eventElement.dataset.eventId = event.id;
    eventElement.dataset.calendarId = event.calendarId || '';
    eventElement.dataset.span = spanDays;

    // Format event text
    let eventText = event.summary || 'Untitled Event';
    if (eventType === 'timed') {
      const eventStart = new Date(event.start.dateTime);
      const hours = eventStart.getHours();
      const minutes = eventStart.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const timePrefix = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      eventText = `${timePrefix} ${eventText}`;
    }

    eventElement.textContent = eventText;
    eventElement.title = event.summary || 'Untitled Event';

    // Apply styles
    eventElement.style.backgroundColor = backgroundColor;
    eventElement.style.border = `1px solid var(--bg-secondary, #333)`;
    eventElement.style.gridColumnStart = startDayIndex + 1;
    eventElement.style.gridRow = gridRow;

    logger.debug('Rendering month event', {
      summary: event.summary,
      gridColumnStart: startDayIndex + 1,
      span: spanDays,
      gridRow
    });

    weekElement.appendChild(eventElement);
  }

  /**
   * Get month title for header
   */
  getMonthTitle() {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
  }
}
