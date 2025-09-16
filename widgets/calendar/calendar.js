// widgets/calendar/calendar.js - Calendar Widget Logic with Google Calendar events

class CalendarWidget {
  constructor() {
    // ============== CONFIG VARIABLES ==============
    this.MONTHS_TO_PULL = 3;
    this.GOOGLE_CALENDARS = [
      { summary: 'jwlerch@gmail.com', color: '#1976d2', textColor: '#ffffff' },
      { summary: 'Veeva', color: '#388e3c', textColor: '#ffffff' }
    ];

    this.calendar = null;
    this.currentView = 'week';
    this.currentDate = new Date();
    this.viewCycle = ['week', 'month', 'daily'];

    this.init();
  }

  init() {
    this.setupEventListeners();
    setTimeout(() => this.initializeCalendar(), 100);
  }

  setupEventListeners() {
    window.addEventListener('message', (event) => {
      if (event.data && event.data.action) {
        this.handleCommand(event.data.action);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (document.hasFocus()) {
        switch (e.key) {
          case ',':
            e.preventDefault();
            this.cycleView('forward');
            break;
          case '.':
            e.preventDefault();
            this.cycleView('backward');
            break;
        }
      }
    });

    window.addEventListener('load', () => {
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'widget-ready',
          widget: 'calendar'
        }, '*');
      }
    });
  }

  initializeCalendar() {
    try {
      const monday = this.getStartOfWeek(this.currentDate);
      this.currentDate = monday;

      // Build TUI calendars array from GOOGLE_CALENDARS
      this.tuiCalendars = this.GOOGLE_CALENDARS.map((cal, idx) => ({
        id: `google-${idx}`,
        name: cal.summary,
        color: cal.textColor,
        backgroundColor: cal.color,
        borderColor: cal.color
      }));

      this.calendar = new tui.Calendar('#calendar', {
        defaultView: this.currentView,
        useCreationPopup: false,
        useDetailPopup: false,
        calendars: this.tuiCalendars,
        week: {
          startDayOfWeek: 1,
          dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          narrowWeekend: false,
          workweek: false,
          hourStart: 6,
          hourEnd: 24,
          showNowIndicator: true,
          eventView: ['time'],
          taskView: false
        },
        month: {
          startDayOfWeek: 1,
          dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          visibleWeeksCount: 6,
          isAlways6Week: false,
          workweek: false
        },
        template: {
          time: (schedule) => {
            const calendar = this.tuiCalendars.find(cal => cal.id === schedule.calendarId);
            const textColor = calendar ? calendar.color : '#ffffff';
            return `<span style="color: ${textColor}; font-weight: 500;">${schedule.title}</span>`;
          }
        }
      });

      this.calendar.setDate(this.currentDate);
      this.showCalendar();
      this.updateCalendarHeader();

      this.loadGoogleCalendarData();

      setTimeout(() => this.scrollToTime(8), 200);

      console.log('📅 Calendar initialized in', this.currentView, 'view');
    } catch (error) {
      console.error('📅 Failed to initialize calendar:', error);
      document.getElementById('loading').textContent = 'Failed to load calendar';
    }
  }

  showCalendar() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('calendarHeader').style.display = 'flex';
    document.getElementById('calendar').style.display = 'block';
  }

  getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  updateCalendarHeader() {
    const titleEl = document.getElementById('calendarTitle');
    const modeEl = document.getElementById('calendarMode');

    const options = {
      year: 'numeric',
      month: 'long',
      ...(this.currentView === 'daily' ? { day: 'numeric' } : {})
    };

    titleEl.textContent = this.currentDate.toLocaleDateString('en-US', options);
    modeEl.textContent = this.currentView.charAt(0).toUpperCase() + this.currentView.slice(1);
  }

  handleCommand(action) {
    console.log('📅 Calendar widget received command:', action);
    switch (action) {
      case 'right': this.navigateCalendar('next'); break;
      case 'left': this.navigateCalendar('previous'); break;
      case 'up': this.scrollCalendar('up'); break;
      case 'down': this.scrollCalendar('down'); break;
      case 'enter': console.log('📅 Enter pressed on calendar widget'); break;
      case 'fastforward': case 'ff': case ',': this.cycleView('forward'); break;
      case 'rewind': case 'rw': case '.': this.cycleView('backward'); break;
      default: console.log('📅 Calendar widget ignoring command:', action); break;
    }
  }

  navigateCalendar(direction) {
    const currentDateObj = this.calendar.getDate();
    let newDate = new Date(currentDateObj);

    switch (this.currentView) {
      case 'daily': newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1)); break;
      case 'week': newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7)); break;
      case 'month': newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1)); break;
    }

    this.currentDate = newDate;
    this.calendar.setDate(newDate);
    this.updateCalendarHeader();
  }

  scrollToTime(hour) {
    if (this.currentView === 'week' || this.currentView === 'daily') {
      const timeElements = document.querySelectorAll('.toastui-calendar-time-hour');
      const targetElement = Array.from(timeElements).find(el => {
        const hourText = el.textContent || el.innerText;
        return hourText.includes(hour + ':00') || hourText.includes((hour % 12 || 12) + ':00');
      });
      if (targetElement) targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  scrollCalendar(direction) {
    if (this.currentView === 'week' || this.currentView === 'daily') {
      const scrollContainer = document.querySelector('.toastui-calendar-time-scroll-wrapper')
        || document.querySelector('.toastui-calendar-time');
      if (scrollContainer) {
        const scrollAmount = 60;
        scrollContainer.scrollTop += (direction === 'up' ? -scrollAmount : scrollAmount);
      }
    }
  }

  changeView(newView) {
    if (this.viewCycle.includes(newView)) {
      this.currentView = newView;
      this.calendar.changeView(newView);
      this.updateCalendarHeader();
      if (newView === 'week' || newView === 'daily') {
        setTimeout(() => this.scrollToTime(8), 100);
      }
    }
  }

  cycleView(direction) {
    const currentIndex = this.viewCycle.indexOf(this.currentView);
    const newIndex = direction === 'forward'
      ? (currentIndex + 1) % this.viewCycle.length
      : (currentIndex - 1 + this.viewCycle.length) % this.viewCycle.length;
    this.changeView(this.viewCycle[newIndex]);
  }

  async loadGoogleCalendarData() {
    console.log('📅 Loading Google Calendar data...');
    const authManager = window.authManager; // you already have this globally
    const api = new GoogleAPIClient(authManager);

    // Compute timeMin and timeMax
    const timeMin = new Date().toISOString();
    const timeMax = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + this.MONTHS_TO_PULL);
      return d.toISOString();
    })();

    for (let i = 0; i < this.GOOGLE_CALENDARS.length; i++) {
      const cal = this.GOOGLE_CALENDARS[i];
      try {
        // getCalendarList then find ID by summary
        const allCals = await api.getCalendarList();
        const matching = allCals.find(c => c.summary === cal.summary);
        if (!matching) {
          console.warn(`Calendar ${cal.summary} not found in user’s account`);
          continue;
        }

        const events = await api.getCalendarEvents(matching.id, timeMin, timeMax);

        // Map to TUI events
        const tuiEvents = events.map((e, idx) => ({
          id: `${matching.id}-${idx}`,
          calendarId: this.tuiCalendars[i].id,
          title: e.summary || '(No title)',
          start: new Date(e.startDateTime),
          end: new Date(e.endDateTime),
          category: e.isAllDay ? 'allday' : 'time',
          backgroundColor: this.tuiCalendars[i].backgroundColor,
          borderColor: this.tuiCalendars[i].borderColor,
          color: this.tuiCalendars[i].color
        }));

        this.calendar.createEvents(tuiEvents);
        console.log(`📅 Loaded ${tuiEvents.length} events for ${cal.summary}`);
      } catch (err) {
        console.error(`📅 Failed to load Google events for ${cal.summary}:`, err);
      }
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new CalendarWidget();
});
