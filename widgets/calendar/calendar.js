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

  // FIXED: Better data handling for widget-data-response
  handleDataServiceMessage(data) {
    console.log('📅 Calendar widget received message:', data.type, data);
    
    switch (data.type) {
      case 'calendar-data-ready':
        this.handleCalendarData(data.data);
        break;
        
      case 'widget-data-response':
        if (data.success) {
          // FIXED: Handle multiple possible response formats
          let calendarData = null;
          
          if (data.events && Array.isArray(data.events)) {
            // Format 1: events directly in response (flattened format)
            calendarData = {
              events: data.events,
              calendars: data.calendars || [],
              lastUpdated: data.lastUpdated || data.timestamp
            };
            console.log('📅 Using flattened events format');
          } else if (data.data && data.data.events && Array.isArray(data.data.events)) {
            // Format 2: events in data.events
            calendarData = {
              events: data.data.events,
              calendars: data.data.calendars || [],
              lastUpdated: data.data.lastUpdated || data.timestamp
            };
            console.log('📅 Using nested events format');
          } else if (data.data && Array.isArray(data.data)) {
            // Format 3: data.data is directly the events array
            calendarData = {
              events: data.data,
              calendars: data.calendars || [],
              lastUpdated: data.timestamp
            };
            console.log('📅 Using direct array format');
          } else {
            console.error('📅 ❌ No valid events array found in response:', data);
            this.updateConnectionStatus('error');
            return;
          }
          
          console.log('📅 📊 Processing calendar data:', {
            eventsCount: calendarData.events.length,
            calendarsCount: calendarData.calendars.length,
            eventsType: typeof calendarData.events,
            isArray: Array.isArray(calendarData.events)
          });
          
          this.handleCalendarData(calendarData);
          
        } else {
          console.error('📅 ❌ Widget data response error:', data.error);
          this.updateConnectionStatus('error');
        }
        break;
        
      case 'theme-change':
        this.applyTheme(data.theme);
        break;
        
      case 'google-apis-ready':
        console.log('📅 Google APIs ready, requesting calendar data...');
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
        borderRadius: 6,
        isReadOnly: true,
        classNames: ['force-opacity'],
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
  try {
    // ensure we start on the week's Monday
    const monday = this.getStartOfWeek(this.currentDate);
    this.currentDate = monday;

    // Create TUI Calendar using the current this.tuiCalendars (IDs + colors)
    this.calendar = new tui.Calendar('#calendar', {
      defaultView: this.currentView,
      useCreationPopup: false,
      useDetailPopup: false,
      disableKeyboard: true,
      calendars: this.tuiCalendars,

      // Disable unwanted sections
      taskView: false,
      scheduleView: true,
      milestoneView: false,

      week: {
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
      },

      month: {
        startDayOfWeek: 1,
        dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        visibleWeeksCount: 6,
        isAlways6Week: false,
        workweek: false
      },

      template: {
        // Use per-calendar text color if available
        time: (schedule) => {
          const calendar = this.tuiCalendars.find(cal => cal.id === schedule.calendarId);
          const textColor = '#ffffff';  //forced white
          // schedule.title is the event title
          return `<span style="color: ${textColor}; font-weight: 500;">${schedule.title}</span>`;
        },
        allday: (schedule) => {
          const calendar = this.tuiCalendars.find(cal => cal.id === schedule.calendarId);
          const textColor = '#ffffff';  //forced white
          return `<span style="color: ${textColor}; font-weight: 500;">${schedule.title}</span>`;
        }
      }
    });

    // Set the initial date and show the UI
    this.calendar.setDate(this.currentDate);
    this.showCalendar();
    this.updateCalendarHeader();

    // When TUI finishes rendering the view, update the all-day height and header.
    // afterRender runs when the view/layout finishes rendering.
    this.calendar.on && this.calendar.on('afterRender', () => {
      // Keep header in sync and recalc all-day size
      this.updateCalendarHeader();
      this.updateAllDayHeight();
    });

    // After schedules are rendered (new events added), recalc all-day height
    if (this.calendar.on) {
      this.calendar.on('afterRenderSchedule', () => {
        this.updateAllDayHeight();
      });
    }

    // If user clicks "more" or expands, recalc (covering click-more events)
    if (this.calendar.on) {
      this.calendar.on('clickMore', () => {
        this.updateAllDayHeight();
      });
    }

    // Request centralized calendar data (keeps original behavior)
    console.log('📅 Requesting calendar data from centralized service...');
    this.requestCalendarData();

    // Optional: scroll to a friendly hour after render
    setTimeout(() => this.scrollToTime(8), 200);

    console.log('📅 TUI Calendar initialized in', this.currentView, 'view');

  } catch (error) {
    console.error('📅 Failed to initialize calendar:', error);
    const loader = document.getElementById('loading');
    if (loader) loader.textContent = 'Failed to load calendar';
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

    this.updateAllDayHeight();

  }

// Update all-day bar height dynamically
// CHANGE SUMMARY: Complete rewrite - Fixed overall calendar container height to grow/shrink with all-day events while maintaining time panel hours
updateAllDayHeight() {
  if (!this.calendar || (this.currentView !== 'week' && this.currentView !== 'daily')) return;

  const allDayContainer = document.querySelector('.toastui-calendar-allday');
  const timePanelContainer = document.querySelector('.toastui-calendar-panel.toastui-calendar-time');
  
  // Try multiple possible calendar container selectors
  let calendarContainer = document.querySelector('.toastui-calendar') ||
                         document.querySelector('.toastui-calendar-main') ||
                         document.querySelector('.toastui-calendar-week-view') ||
                         document.querySelector('.toastui-calendar-container') ||
                         document.querySelector('[class*="toastui-calendar"]');
  
  // Debug what we found
  console.log('📅 Container search results:', {
    allDay: !!allDayContainer,
    timePanel: !!timePanelContainer, 
    calendar: !!calendarContainer,
    calendarClass: calendarContainer ? calendarContainer.className : 'not found',
    calendarId: calendarContainer ? calendarContainer.id : 'no id'
  });
  
  // If we have 200+ elements, let's find the main container more precisely
  if (calendarContainer) {
    console.log('📅 Using calendar container:', {
      tagName: calendarContainer.tagName,
      className: calendarContainer.className,
      currentHeight: window.getComputedStyle(calendarContainer).height,
      parentClass: calendarContainer.parentElement ? calendarContainer.parentElement.className : 'no parent'
    });
  }
  
  if (!allDayContainer || !timePanelContainer) {
    console.log('📅 Missing required containers - exiting');
    return;
  }

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

  // Store TUI's baseline heights in their natural state (not forcing all-day to be hidden)
  if (!this.dashieBaselineHeights) {
    console.log('📅 Capturing baseline heights in natural state...');
    
    // Don't force hide - let TUI calculate with all-day in its current state
    // This should give us the "real" space TUI thinks it has to work with
    
    setTimeout(() => {
      const timePanelStyle = window.getComputedStyle(timePanelContainer);
      const calendarStyle = window.getComputedStyle(calendarContainer || document.body);
      
      // Get the current all-day height to understand what TUI is working with
      const allDayStyle = window.getComputedStyle(allDayContainer);
      const currentAllDayHeight = parseInt(allDayStyle.height, 10) || 0;
      
      this.dashieBaselineHeights = {
        timePanel: parseInt(timePanelStyle.height, 10),
        calendar: parseInt(calendarStyle.height, 10),
        currentAllDayHeight: currentAllDayHeight
      };
      
      console.log('📅 NEW: Captured natural baseline heights:', this.dashieBaselineHeights);
      
      // Continue with the adjustment using the natural baseline
      this.applyHeightAdjustmentNew(allDayContainer, timePanelContainer, calendarContainer, maxEvents, rowHeight, padding);
    }, 100);
    
    return; // Exit early on first run to let async capture complete
  }
  
  // Apply adjustment using captured TUI baseline
  this.applyHeightAdjustmentNew(allDayContainer, timePanelContainer, calendarContainer, maxEvents, rowHeight, padding);
}

applyHeightAdjustmentNew(allDayContainer, timePanelContainer, calendarContainer, maxEvents, rowHeight, padding) {
  // Calculate all-day section height
  let allDayHeight = 0;
  if (maxEvents === 0) {
    allDayContainer.style.height = '0px';
    allDayContainer.style.display = 'none';
  } else {
    allDayHeight = maxEvents * rowHeight + padding;
    allDayContainer.style.height = `${allDayHeight}px`;
    allDayContainer.style.display = 'block';
  }

  // Keep the overall calendar container height FIXED at baseline
  if (calendarContainer) {
    calendarContainer.style.height = `${this.dashieBaselineHeights.calendar}px`;
  }
  
  // Calculate the space redistribution
  // We want: timePanel + allDayHeight = constant total
  // The constant total should be: baseline timePanel + whatever all-day space TUI naturally reserved
  const totalAvailableSpace = this.dashieBaselineHeights.timePanel + this.dashieBaselineHeights.currentAllDayHeight;
  const adjustedTimePanelHeight = totalAvailableSpace - allDayHeight;
  
  timePanelContainer.style.height = `${adjustedTimePanelHeight}px`;
  
  console.log('📅 NEW: Applied FIXED height adjustment:', {
    maxEvents,
    allDayHeight,
    baselineTimePanel: this.dashieBaselineHeights.timePanel,
    baselineAllDayHeight: this.dashieBaselineHeights.currentAllDayHeight,
    totalAvailableSpace,
    adjustedTimePanelHeight,
    verification: `${adjustedTimePanelHeight} + ${allDayHeight} = ${adjustedTimePanelHeight + allDayHeight} (target: ${totalAvailableSpace})`
  });
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
