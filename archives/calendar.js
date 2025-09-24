// widgets/calendar/calendar.js - UPDATED: Converted to new widget-messenger system - pure receiver pattern
// CHANGE SUMMARY: Added proper logger system, improved debugging output for widget-update message handling

import { createLogger } from '../../js/utils/logger.js';

const logger = createLogger('CalendarWidget');

class CalendarWidget {
  constructor() {
    // ============== CONFIG VARIABLES ==============
    
    // Hard-coded Google calendar IDs you're using
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
      // Handle navigation commands (single action strings)
      if (event.data && typeof event.data.action === 'string' && !event.data.type) {
        this.handleCommand(event.data.action);
      }
      // Handle message objects with type
      if (event.data && event.data.type) {
        this.handleDataServiceMessage(event.data);
      }
    });

    window.addEventListener('load', () => {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'widget-ready', widget: 'calendar' }, '*');
      }
    });



    
  }


  

  // NEW: Simplified message handler for widget-messenger system
  handleDataServiceMessage(data) {
    logger.debug('Calendar widget received message', { type: data.type, hasPayload: !!data.payload });
    
    switch (data.type) {
      case 'widget-update':
        logger.info('Processing widget-update', { action: data.action });
        logger.debug('Payload structure', data.payload);
        logger.info('Calendar data available', { hasCalendarData: !!data.payload?.calendar });
        
        if (data.action === 'state-update' && data.payload?.calendar) {
          logger.success('Calendar data details', {
            eventsCount: data.payload.calendar.events?.length,
            calendarsCount: data.payload.calendar.calendars?.length,
            lastUpdated: data.payload.calendar.lastUpdated
          });
          
          this.handleCalendarData({
            events: data.payload.calendar.events || [],
            calendars: data.payload.calendar.calendars || [],
            lastUpdated: data.payload.calendar.lastUpdated
          });
        } else if (data.action === 'state-update' && !data.payload?.calendar) {
          logger.warn('No calendar data in payload', { 
            payloadKeys: Object.keys(data.payload || {}),
            hasPayload: !!data.payload 
          });
        }
        break;
        
      case 'theme-change':
        logger.info('Applying theme change', { theme: data.theme });
        this.applyTheme(data.theme);
        break;
        
      default:
        logger.debug('Unhandled message type', { type: data.type });
        break;
    }
  }

  handleCalendarData(data) {
    if (data.status === 'error') {
      this.updateConnectionStatus('error');
      logger.error('Calendar data error', { error: data.status });
      return;
    }

    this.calendarData = {
      events: data.events || [],
      calendars: data.calendars || [],
      lastUpdated: data.lastUpdated
    };
    this.isDataLoaded = true;
    this.updateConnectionStatus('connected');

    logger.success('Calendar data loaded successfully', {
      eventsCount: this.calendarData.events.length,
      calendarsCount: this.calendarData.calendars.length,
      lastUpdated: this.calendarData.lastUpdated
    });

    // Merge Google's actual colors if provided by the centralized service
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
    if (!this.calendar || !this.isDataLoaded) {
      logger.warn('Cannot load events', { 
        hasCalendar: !!this.calendar, 
        isDataLoaded: this.isDataLoaded 
      });
      return;
    }
    
    this.calendar.clear();

    const tuiEvents = this.calendarData.events.map((event, i) => {
      const tuiCalendar = this.tuiCalendars.find(cal => cal.id === event.calendarId) || this.tuiCalendars[0];
      const start = new Date(event.start.dateTime || event.start.date);
      let end = new Date(event.end.dateTime || event.end.date);
      let isAllDay = !!event.start.date;

      if (!isAllDay && start.getHours() === end.getHours() && start.toDateString() !== end.toDateString()) {
        isAllDay = true;
       } if (isAllDay) { 
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

    if (tuiEvents.length) {
      this.calendar.createEvents(tuiEvents);
      logger.success('Events loaded into TUI Calendar', { eventCount: tuiEvents.length });
    } else {
      logger.info('No events to display');
    }
    
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

// Key section of calendar.js that needs updating for monthly view
// CHANGE SUMMARY: Fixed monthly view to show full 6-week calendar and added month template for proper event display

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
        isAlways6Week: true, // FIXED: Force full 6-week month display
        workweek: false,
        // ADDED: Monthly view specific settings
        visibleEventCount: 6, // Show more events before "more" button
        moreLayerSize: {
          height: 'auto'
        }
      },

// CHANGE SUMMARY: Fixed monthly view configuration to show full 6-week calendar and added month template

// Replace the month configuration section in calendar.js initializeCalendar() function:

month: {
  startDayOfWeek: 1,
  dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  visibleWeeksCount: 6,
  isAlways6Week: true, // FIXED: Force full 6-week month display
  workweek: false,
  // ADDED: Monthly view specific settings
  visibleEventCount: 6, // Show more events before "more" button
  moreLayerSize: {
    height: 'auto'
  }
},

// Replace the template section to add month template:

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
  },
  // FIXED: Monthly view template for proper event display
  month: (schedule) => {
    const calendar = this.tuiCalendars.find(cal => cal.id === schedule.calendarId);
    const backgroundColor = calendar?.backgroundColor || '#4285f4';
    const textColor = '#ffffff';
    
    // For all-day events, show as colored bar with text
    if (schedule.category === 'allday') {
      return `<span style="color: ${textColor}; font-weight: 500; background-color: ${backgroundColor}; padding: 2px 4px; border-radius: 3px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${schedule.title}</span>`;
    }
    
    // For timed events, show as colored dot + text
    return `
      <span style="display: flex; align-items: center; font-size: 11px; color: var(--text-primary, #fff);">
        <span style="
          width: 6px; 
          height: 6px; 
          background-color: ${backgroundColor}; 
          border-radius: 50%; 
          margin-right: 4px; 
          flex-shrink: 0;
        "></span>
        <span style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary, #fff);">
          ${schedule.title}
        </span>
      </span>
    `;
  }
  // REMOVED: The broken monthGridHeader and monthGridHeaderExceed templates
  // Let Toast UI handle these with default behavior
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

    // REMOVED: No longer request data - widget will receive state updates automatically
    logger.info('TUI Calendar initialized - waiting for state updates...');

    // Optional: scroll to a friendly hour after render
    setTimeout(() => this.scrollToTime(8), 200);

  } catch (error) {
    logger.error('Failed to initialize calendar', error);
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
// CHANGE SUMMARY: Cleaned up debugging - maintains fixed calendar height while redistributing space between time panel and all-day section
updateAllDayHeight() {
  if (!this.calendar || (this.currentView !== 'week' && this.currentView !== 'daily')) return;

  const allDayContainer = document.querySelector('.toastui-calendar-allday');
  const timePanelContainer = document.querySelector('.toastui-calendar-panel.toastui-calendar-time');
  const calendarContainer = document.querySelector('.toastui-calendar');
  
  if (!allDayContainer || !timePanelContainer) {
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

  // Store TUI's baseline heights in their natural state
  if (!this.dashieBaselineHeights) {
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
      
      // Continue with the adjustment using the natural baseline
      this.applyHeightAdjustmentNew(allDayContainer, timePanelContainer, calendarContainer, maxEvents, rowHeight, padding);
    }, 100);
    
    return;
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
}

  handleCommand(action) {
    logger.debug('Calendar widget received command', { action });
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
        logger.debug('Enter pressed on calendar widget'); 
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
        logger.debug('Calendar widget ignoring command', { action }); 
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
    logger.info('Applied theme to TUI Calendar', { theme });
  }

 
}

document.addEventListener('DOMContentLoaded', () => {
  const calendarWidget = new CalendarWidget();
});