// widgets/calendar/calendar-config.js - TUI Calendar Configuration and Templates
// CHANGE SUMMARY: Extracted calendar configuration and templates into separate module for better organization

export class CalendarConfig {
  constructor(tuiCalendars) {
    this.tuiCalendars = tuiCalendars;
  }

  updateCalendars(tuiCalendars) {
    this.tuiCalendars = tuiCalendars;
  }

  getCalendarOptions(currentView) {
    return {
      defaultView: currentView,
      useCreationPopup: false,
      useDetailPopup: false,
      disableKeyboard: true,
      calendars: this.tuiCalendars,

      // Disable unwanted sections
      taskView: false,
      scheduleView: true,
      milestoneView: false,

      week: this.getWeekConfig(),
      month: this.getMonthConfig(),
      day: this.getDailyConfig(),  // Added daily view config
      template: this.getTemplates()
    };
  }

  getWeekConfig() {
    return {
      startDayOfWeek: 1,
      dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      narrowWeekend: false,
      workweek: false,
      hourStart: 0,
      hourEnd: 24,
      hourHeight: 15,
      showNowIndicator: true,
      eventView: ['time', 'allday'],
      taskView: false
    };
  }

  getMonthConfig() {
    return {
      startDayOfWeek: 1,
      dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      visibleWeeksCount: 6,
      isAlways6Week: true, // Force full 6-week month display
      workweek: false,
      // Monthly view specific settings
      visibleEventCount: 6, // Show more events before "more" button
      moreLayerSize: {
        height: 'auto'
      }
    };
  }

  getTemplates() {
    return {
      // Weekly/Daily view templates - forced white text for colored backgrounds
      time: (schedule) => {
        const calendar = this.tuiCalendars.find(cal => cal.id === schedule.calendarId);
        const textColor = '#ffffff';  // forced white for weekly view
        return `<span style="color: ${textColor}; font-weight: 500;">${schedule.title}</span>`;
      },

      allday: (schedule) => {
        const calendar = this.tuiCalendars.find(cal => cal.id === schedule.calendarId);
        const textColor = '#ffffff';  // forced white for weekly view
        return `<span style="color: ${textColor}; font-weight: 500;">${schedule.title}</span>`;
      },

      // Monthly view template for proper event display
      month: (schedule) => {
        const calendar = this.tuiCalendars.find(cal => cal.id === schedule.calendarId);
        //const backgroundColor = calendar?.backgroundColor || '#4285f4';
        
        // For all-day events, show as colored bar with white text (since they have colored backgrounds)
        if (schedule.category === 'allday') {
          return `<span style="color: #ffffff; font-weight: 500; background-color: ${backgroundColor}; padding: 2px 4px; border-radius: 3px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${schedule.title}</span>`;
        }
        
        // For timed events, show as colored dot + black text (since they have light backgrounds)
        return `
          <span style="display: flex; align-items: center; font-size: 11px;">
            <span style="
              width: 6px; 
              height: 6px;  
              border-radius: 50%; 
              margin-right: 4px; 
              flex-shrink: 0;
            "></span>
            <span style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #000;">
              ${schedule.title}
            </span>
          </span>
        `;
      }
    };
  }

  // Daily view configuration
  getDailyConfig() {
    return {
      startDayOfWeek: 1,
      dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      hourStart: 0,
      hourEnd: 24,
      hourHeight: 20,  // Slightly taller than weekly view for better readability
      showNowIndicator: true,
      eventView: ['time', 'allday'],
      taskView: false
    };
  }
}