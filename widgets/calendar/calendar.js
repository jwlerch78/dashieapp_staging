// widgets/calendar/calendar.js - UPDATED: TUI Calendar Widget with centralized data service
// Preserves all existing TUI Calendar functionality while using centralized Google Calendar data

class CalendarWidget {
  constructor() {
    // ============== CONFIG VARIABLES ==============
    this.MONTHS_TO_PULL = 3;
    this.GOOGLE_CALENDARS = [
      { summary: 'jwlerch@gmail.com', color: '#1976d2', textColor: '#ffffff' },
      { summary: 'Veeva', color: '#388e3c', textColor: '#ffffff' }
    ];

    this.tuiCalendars = this.GOOGLE_CALENDARS.map((cal, index) => ({
      id: `google-cal-${index}`,
      name: cal.summary,
      backgroundColor: cal.color,
      borderColor: cal.color,
      color: cal.textColor
    }));

    this.calendar = null;
    this.currentView = 'week';
    this.currentDate = new Date();
    this.viewCycle = ['week', 'month', 'daily'];

    // NEW: Centralized data service state
    this.calendarData = {
      events: [],
      calendars: [],
      lastUpdated: null
    };
    this.isDataLoaded = false;
    this.connectionStatus = 'connecting';

    this.init();
  }

  init() {
    this.setupEventListeners();
    setTimeout(() => this.initializeCalendar(), 100);
  }

  setupEventListeners() {
    // Existing navigation event listeners
    window.addEventListener('message', (event) => {
      if (event.data && event.data.action) this.handleCommand(event.data.action);
      if (event.data && event.data.type) this.handleDataServiceMessage(event.data);
    });

    document.addEventListener('keydown', (e) => {
      if (document.hasFocus()) {
        switch (e.key) {
          case ',': e.preventDefault(); this.cycleView('forward'); break;
          case '.': e.preventDefault(); this.cycleView('backward'); break;
        }
      }
    });

    window.addEventListener('load', () => {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'widget-ready', widget: 'calendar' }, '*');
      }
    });
  }

  handleDataServiceMessage(data) {
    switch (data.type) {
      case 'calendar-data-ready': this.handleCalendarData(data.data); break;
      case 'theme-change': this.applyTheme(data.theme); break;
      case 'google-apis-ready': setTimeout(() => this.requestCalendarData(), 1000); break;
    }
  }

  requestCalendarData() {
    try {
      window.parent.postMessage({ type: 'request-calendar-data', widget: 'calendar', timestamp: Date.now() }, '*');
      this.updateConnectionStatus('connecting');
    } catch (error) {
      console.error('📅 ❌ Failed to request calendar data:', error);
      this.updateConnectionStatus('error');
    }
  }

  handleCalendarData(data) {
    if (data.status === 'error') { this.updateConnectionStatus('error'); return; }

    this.calendarData = {
      events: data.events || [],
      calendars: data.calendars || [],
      lastUpdated: data.lastUpdated
    };

    this.isDataLoaded = true;
    this.updateConnectionStatus('connected');
    this.loadEventsIntoCalendar();
  }

  loadEventsIntoCalendar() {
    if (!this.calendar || !this.isDataLoaded) return;

    this.calendar.clear();
    const tuiEvents = [];

    this.calendarData.events.forEach((event, i) => {
      const calendarIndex = this.GOOGLE_CALENDARS.findIndex(cal => cal.summary === event.calendarName);
      const tuiCalendar = this.tuiCalendars[calendarIndex >= 0 ? calendarIndex : 0];

      const start = new Date(event.startDateTime);
      const end = new Date(event.endDateTime);

      // Convert to all-day if start and end are same hour but different day
      const isAllDay = event.isAllDay ||
                       (start.getHours() === end.getHours() && start.toDateString() !== end.toDateString());

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
        raw: event
      };

      tuiEvents.push(tuiEvent);
    });

    if (tuiEvents.length > 0) {
      this.calendar.createEvents(tuiEvents);
      console.log(`📅 ✅ Loaded ${tuiEvents.length} events into TUI Calendar`);
    }
  }

  updateConnectionStatus(status) {
    this.connectionStatus = status;
    const statusEl = document.querySelector('.status');
    if (statusEl) {
      switch (status) {
        case 'connected': statusEl.textContent = '●'; statusEl.style.color = '#51cf66'; break;
        case 'connecting': statusEl.textContent = '○'; statusEl.style.color = '#ffaa00'; break;
        case 'error': statusEl.textContent = '✕'; statusEl.style.color = '#ff6b6b'; break;
      }
    }
  }

  async initializeCalendar() {
    try {
      const monday = this.getStartOfWeek(this.currentDate);
      this.currentDate = monday;

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
        month: { startDayOfWeek: 1, visibleWeeksCount: 6, isAlways6Week: false, workweek: false },
        template: { time: (schedule) => schedule.title }
      });

      this.calendar.setDate(this.currentDate);
      document.getElementById('loading').style.display = 'none';
      document.getElementById('calendarHeader').style.display = 'flex';
      document.getElementById('calendar').style.display = 'block';
      this.requestCalendarData();

      setTimeout(() => this.scrollToTime(8), 200);
    } catch (error) {
      console.error('📅 Failed to initialize calendar:', error);
      document.getElementById('loading').textContent = 'Failed to load calendar';
    }
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

    const options = { year: 'numeric', month: 'long', ...(this.currentView === 'daily' ? { day: 'numeric' } : {}) };
    titleEl.textContent = this.currentDate.toLocaleDateString('en-US', options);
    modeEl.textContent = this.currentView.charAt(0).toUpperCase() + this.currentView.slice(1);
  }

  handleCommand(action) {
    switch (action) {
      case 'right': case 'next-view': this.navigateCalendar('next'); break;
      case 'left': case 'prev-view': this.navigateCalendar('previous'); break;
      case 'up': this.scrollCalendar('up'); break;
      case 'down': this.scrollCalendar('down'); break;
      case 'enter': break;
      case 'fastforward': case 'ff': case ',': this.cycleView('forward'); break;
      case 'rewind': case 'rw': case '.': this.cycleView('backward'); break;
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
      const scrollContainer = document.querySelector('.toastui-calendar-time-scroll-wrapper') || document.querySelector('.toastui-calendar-time');
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
      if (newView === 'week' || newView === 'daily') setTimeout(() => this.scrollToTime(8), 100);
    }
  }

  cycleView(direction) {
    const currentIndex = this.viewCycle.indexOf(this.currentView);
    const newIndex = direction === 'forward'
      ? (currentIndex + 1) % this.viewCycle.length
      : (currentIndex - 1 + this.viewCycle.length) % this.viewCycle.length;
    this.changeView(this.viewCycle[newIndex]);
  }

  applyTheme(theme) {
    const themeClass = `theme-${theme}`;
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.body.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(themeClass);
    document.body.classList.add(themeClass);
  }

  requestTheme() {
    try { window.parent.postMessage({ type: 'widget-request-theme', widget: 'calendar' }, '*'); } 
    catch (error) { console.log('📅 Could not request theme'); }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const calendarWidget = new CalendarWidget();
  setTimeout(() => calendarWidget.requestTheme(), 500);
});
