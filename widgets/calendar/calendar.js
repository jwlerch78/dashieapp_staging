// widgets/calendar/calendar.js - UPDATED: TUI Calendar Widget with centralized data service
// Preserves all existing TUI Calendar functionality while using centralized Google Calendar data

class CalendarWidget {
  constructor() {
    // ============== CONFIG VARIABLES ==============
    
    // Hard-coded Google calendar IDs you’re using
    this.GOOGLE_CALENDARS = [
      { id: 'jwlerch@gmail.com', summary: 'jwlerch@gmail.com', color: '#1976d2', textColor: '#ffffff' },
      { id: 'fd5949d42a667f6ca3e88dcf1feb27818463bbdc19c5e56d2e0da62b87d881c5@group.calendar.google.com', summary: 'Veeva', color: '#388e3c', textColor: '#ffffff' }
    ];

    // Build TUI calendar definitions initially
    this.tuiCalendars = this.GOOGLE_CALENDARS.map(cal => ({
      id: cal.id, // real Google ID here
      name: cal.summary,
      backgroundColor: cal.color,
      borderColor: cal.color,
      color: cal.textColor
    }));

    this.calendar = null;
    this.currentView = 'week';
    this.currentDate = new Date();
    this.viewCycle = ['week', 'month', 'daily'];

    this.calendarData = { events: [], calendars: [], lastUpdated: null };
    this.isDataLoaded = false;
    this.connectionStatus = 'connecting';

    this.init();
  }

  init() {
    this.setupEventListeners();
    setTimeout(() => this.initializeCalendar(), 100);
  }

  setupEventListeners() {
    window.addEventListener('message', (event) => {
      if (event.data && event.data.action) this.handleCommand(event.data.action);
      if (event.data && event.data.type) this.handleDataServiceMessage(event.data);
    });

    window.addEventListener('load', () => {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'widget-ready', widget: 'calendar' }, '*');
      }
    });
  }

  handleDataServiceMessage(data) {
    switch (data.type) {
      case 'calendar-data-ready':
        this.handleCalendarData(data.data);
        break;
      case 'widget-data-response':
        if (data.success && data.data) {
          this.handleCalendarData({
            events: data.data,
            calendars: data.calendars || [],
            lastUpdated: data.timestamp
          });
        } else {
          console.error('📅 ❌ Widget data response error:', data.error);
          this.updateConnectionStatus('error');
        }
        break;
      case 'theme-change':
        this.applyTheme(data.theme);
        break;
      case 'google-apis-ready':
        setTimeout(() => this.requestCalendarData(), 1000);
        break;
    }
  }

  requestCalendarData() {
    window.parent.postMessage({
      type: 'widget-data-request',
      dataType: 'calendar',
      requestType: 'events',
      requestId: Date.now(),
      params: {}
    }, '*');
    this.updateConnectionStatus('connecting');
  }

  handleCalendarData(data) {
    if (data.status === 'error') {
      this.updateConnectionStatus('error');
      return;
    }

    this.calendarData = {
      events: data.events || [],
      calendars: data.calendars || [],
      lastUpdated: data.lastUpdated
    };
    this.isDataLoaded = true;
    this.updateConnectionStatus('connected');

    // Merge Google’s actual colors if provided by the centralized service
    this.tuiCalendars = this.GOOGLE_CALENDARS.map((cal) => {
      const remoteCal = this.calendarData.calendars.find(rc => rc.id === cal.id || rc.summary === cal.summary);
      return {
        id: cal.id,
        name: cal.summary,
        backgroundColor: remoteCal?.backgroundColor || cal.color,
        borderColor: remoteCal?.backgroundColor || cal.color,
        color: remoteCal?.foregroundColor || cal.textColor
      };
    });

    this.loadEventsIntoCalendar();
  }

  loadEventsIntoCalendar() {
    if (!this.calendar || !this.isDataLoaded) return;
    this.calendar.clear();

    const tuiEvents = this.calendarData.events.map((event, i) => {
      const tuiCalendar = this.tuiCalendars.find(cal => cal.id === event.calendarId) || this.tuiCalendars[0];
      const start = new Date(event.start.dateTime || event.start.date);
      let end = new Date(event.end.dateTime || event.end.date);
      let isAllDay = !!event.start.date;

      if (!isAllDay && start.getHours() === end.getHours() && start.toDateString() !== end.toDateString()) {
        isAllDay = true;
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
        raw: event
      };
    });

    if (tuiEvents.length) this.calendar.createEvents(tuiEvents);
    this.updateCalendarHeader();
  }

  updateConnectionStatus(status) {
    this.connectionStatus = status;
    const statusEl = document.querySelector('.status');
    if (statusEl) {
      switch (status) {
        case 'connected':
          statusEl.textContent = '●';
          statusEl.style.color = '#51cf66';
          break;
        case 'connecting':
          statusEl.textContent = '○';
          statusEl.style.color = '#ffaa00';
          break;
        case 'error':
          statusEl.textContent = '✕';
          statusEl.style.color = '#ff6b6b';
          break;
      }
    }
  }

async initializeCalendar() {
  console.log('📅 Initializing TUI Calendar');

  this.calendar = new tui.Calendar('#calendar', {
    defaultView: this.currentView,
    calendars: this.tuiCalendars, // Google IDs + colors
    useDetailPopup: true,
    useFormPopup: false,
    isReadOnly: true,
    timezone: {
      zones: [
        {
          timezoneName: 'America/New_York',
          displayLabel: 'ET'
        }
      ]
    },
    template: {
      // optionally customize event template
      time: (event) => {
        // event.title already styled by TUI color settings
        return `<span style="color: ${event.color || '#fff'}; font-weight:500;">${event.title}</span>`;
      },
      allday: (event) => {
        return `<span style="color: ${event.color || '#fff'}; font-weight:500;">${event.title}</span>`;
      }
    }
  });

  // optional: automatically adjust the all-day section height after render
  this.calendar.on('afterRender', () => {
    this.updateAllDayHeight();
  });

  // optional: auto-scroll to 8am each day
  this.calendar.on('afterRenderSchedule', () => {
    this.scrollToTime(8);
  });

  this.showCalendar();
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

    this.updateAllDayHeight();

  }

  // Update all-day bar height dynamically
updateAllDayHeight() {
  if (!this.calendar || (this.currentView !== 'week' && this.currentView !== 'daily')) return;

  const allDayContainer = document.querySelector('.toastui-calendar-allday');
  if (!allDayContainer) return;

  // Determine visible date range
  let startDate = new Date(this.currentDate);
  let endDate = new Date(this.currentDate);

  if (this.currentView === 'week') {
    startDate = this.getStartOfWeek(this.currentDate);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
  }

  // Count all-day events per day
  const dayCounts = {};

  this.calendarData.events.forEach(ev => {
    // Determine start/end
    let start = new Date(ev.start.dateTime || ev.start.date);
    let end = new Date(ev.end.dateTime || ev.end.date);

    // Determine if all-day
    let isAllDay = !!ev.start.date;
    if (!isAllDay && start.getHours() === end.getHours() && start.toDateString() !== end.toDateString()) {
      isAllDay = true;
    }

    if (isAllDay) {
      // Adjust end date for Google all-day events
      end = new Date(end.getTime() - 24*60*60*1000);

      // Iterate over each day of the event
      let current = new Date(start);
      while (current <= end) {
        if (current >= startDate && current <= endDate) {
          const dayKey = current.toDateString();
          dayCounts[dayKey] = (dayCounts[dayKey] || 0) + 1;
        }
        current.setDate(current.getDate() + 1);
      }
    }
  });

  const maxEvents = Math.max(0, ...Object.values(dayCounts));

  const rowHeight = 24;  // slightly taller to prevent clipping
  const padding = 1;

  if (maxEvents === 0) {
    allDayContainer.style.height = '0px';
    allDayContainer.style.display = 'none';
  } else {
    allDayContainer.style.height = `${maxEvents * rowHeight + padding}px`;
    allDayContainer.style.display = 'block';
  }
}


  

  handleCommand(action) {
    console.log('📅 Calendar widget received command:', action);
    switch (action) {
      case 'right': 
        this.navigateCalendar('next'); 
        break;
      case 'left': 
        this.navigateCalendar('previous'); 
        break;
      case 'up': 
        this.scrollCalendar('up'); 
        break;
      case 'down': 
        this.scrollCalendar('down'); 
        break;
      case 'enter': 
        console.log('📅 Enter pressed on calendar widget'); 
        break;
      case 'next-view':
      case 'fastforward': 
      case 'ff': 
      case ',': 
        this.cycleView('forward'); 
        break;
      case 'prev-view':
      case 'rewind': 
      case 'rw': 
      case '.': 
        this.cycleView('backward'); 
        break;
      default: 
        console.log('📅 Calendar widget ignoring command:', action); 
        break;
    }
  }

  navigateCalendar(direction) {
    const currentDateObj = this.calendar.getDate();
    let newDate = new Date(currentDateObj);

    switch (this.currentView) {
      case 'daily': 
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1)); 
        break;
      case 'week': 
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7)); 
        break;
      case 'month': 
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1)); 
        break;
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
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
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

  applyTheme(theme) {
    const themeClass = `theme-${theme}`;
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.body.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(themeClass);
    document.body.classList.add(themeClass);
    console.log(`📅 Applied ${theme} theme to TUI Calendar`);
  }

  requestTheme() {
    try {
      window.parent.postMessage({
        type: 'widget-request-theme',
        widget: 'calendar'
      }, '*');
    } catch (error) {
      console.log('📅 Could not request theme');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const calendarWidget = new CalendarWidget();
  setTimeout(() => calendarWidget.requestTheme(), 500);
});
