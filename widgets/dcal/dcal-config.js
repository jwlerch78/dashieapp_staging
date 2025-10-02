// widgets/dcal/dcal-config.js - Calendar Configuration Module
// CHANGE SUMMARY: Migrated from calendar-config.js, adapted for custom calendar (no TUI)

export class DCalConfig {
  constructor(calendars) {
    this.calendars = calendars;
    this.hourHeight = 60; // pixels per hour
    this.startHour = 0;
    this.endHour = 24;
  }

  updateCalendars(calendars) {
    // Update with actual calendar data from Google
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

  getCalendarById(calendarId) {
    return this.calendars.find(cal => cal.id === calendarId);
  }

  getCalendarColor(calendarId) {
    const calendar = this.getCalendarById(calendarId);
    return calendar ? calendar.backgroundColor : '#1976d2';
  }

  getHourHeight() {
    return this.hourHeight;
  }

  getTimeRange() {
    return {
      start: this.startHour,
      end: this.endHour
    };
  }

  formatTime(date) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  formatTimeLabel(hour) {
    if (hour === 0) {
      return '12 AM';
    } else if (hour < 12) {
      return `${hour} AM`;
    } else if (hour === 12) {
      return '12 PM';
    } else {
      return `${hour - 12} PM`;
    }
  }
}