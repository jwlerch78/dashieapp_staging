// widgets/calendar/calendar.js - Calendar Widget Logic with Preserved Event Colors

class CalendarWidget {
  constructor() {
    this.calendar = null;
    this.currentView = 'week';
    this.currentDate = new Date();
    this.viewCycle = ['week', 'month', 'daily'];
    
    // Calendar configuration with distinct colors that won't be overridden
    this.calendars = [
      {
        id: 'calendar1',
        name: 'Main Calendar',
        url: 'https://calendar.playmetrics.com/calendars/c1334/t398340/p0/t2BDEDC4E/f/calendar.ics',
        // Use strong, distinct colors for better visibility
        color: '#ffffff', // White text on colored background
        backgroundColor: '#1976d2', // Material Blue
        borderColor: '#1976d2'
      },
      {
        id: 'calendar2', 
        name: 'Secondary Calendar',
        url: 'https://calendar.playmetrics.com/calendars/c379/t346952/p0/tEB6F077C/f/calendar.ics',
        // Use contrasting color
        color: '#ffffff', // White text on colored background
        backgroundColor: '#388e3c', // Material Green
        borderColor: '#388e3c'
      }
    ];
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    setTimeout(() => this.initializeCalendar(), 100);
  }

  setupEventListeners() {
    // D-pad Navigation
    window.addEventListener('message', (event) => {
      if (event.data && event.data.action) {
        this.handleCommand(event.data.action);
      }
    });

    // PC testing keys
    document.addEventListener('keydown', (e) => {
      if (document.hasFocus()) {
        switch(e.key) {
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

    // Send ready signal
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
      
      this.calendar = new tui.Calendar('#calendar', {
        defaultView: this.currentView,
        useCreationPopup: false,
        useDetailPopup: false,
        calendars: this.calendars,
        week: {
          startDayOfWeek: 1,
          dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          narrowWeekend: false,
          workweek: false,
          hourStart: 6,
          hourEnd: 24,
          showNowIndicator: true,
          eventView: ['time'],    // Only show time panel, hide allday panel
          taskView: false         // Hide milestone and task panels
        },
        month: {
          startDayOfWeek: 1,
          dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          visibleWeeksCount: 6,
          isAlways6Week: false,
          workweek: false
        },
        template: {
          // Custom template to ensure colors are preserved
          time: (schedule) => {
            const calendar = this.calendars.find(cal => cal.id === schedule.calendarId);
            const bgColor = calendar ? calendar.backgroundColor : '#1976d2';
            const textColor = calendar ? calendar.color : '#ffffff';
            
            return `<span style="color: ${textColor}; font-weight: 500;">${schedule.title}</span>`;
          }
        }
      });

      this.calendar.setDate(this.currentDate);
      this.showCalendar();
      this.updateCalendarHeader();
      this.loadCalendarData();
      
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
    
    switch(action) {
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
      case 'fastforward':
      case 'ff':
      case ',':
        this.cycleView('forward');
        break;
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
    
    switch(this.currentView) {
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
    
    console.log('📅 Navigated', direction, 'to', newDate.toDateString());
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
        console.log('📅 Scrolled to', hour + ':00');
      }
    }
  }

  scrollCalendar(direction) {
    if (this.currentView === 'week' || this.currentView === 'daily') {
      const scrollContainer = document.querySelector('.toastui-calendar-time-scroll-wrapper') 
                           || document.querySelector('.toastui-calendar-time');
      
      if (scrollContainer) {
        const scrollAmount = 60;
        
        if (direction === 'up') {
          scrollContainer.scrollTop -= scrollAmount;
        } else if (direction === 'down') {
          scrollContainer.scrollTop += scrollAmount;
        }
        
        console.log('📅 Scrolled calendar', direction, 'by', scrollAmount, 'pixels');
      }
    } else {
      console.log('📅 Scrolling only available in week/daily view');
    }
  }

  changeView(newView) {
    if (this.viewCycle.includes(newView)) {
      this.currentView = newView;
      this.calendar.changeView(newView);
      this.updateCalendarHeader();
      
      console.log('📅 Changed to', newView, 'view');
      
      if (newView === 'week' || newView === 'daily') {
        setTimeout(() => this.scrollToTime(8), 100);
      }
    }
  }

  cycleView(direction) {
    const currentIndex = this.viewCycle.indexOf(this.currentView);
    let newIndex;
    
    if (direction === 'forward') {
      newIndex = (currentIndex + 1) % this.viewCycle.length;
    } else {
      newIndex = (currentIndex - 1 + this.viewCycle.length) % this.viewCycle.length;
    }
    
    this.changeView(this.viewCycle[newIndex]);
  }

  async loadCalendarData() {
    console.log('📅 Loading calendar data...');
    
    for (const cal of this.calendars) {
      try {
        const sampleEvents = this.createSampleEvents(cal);
        this.calendar.createEvents(sampleEvents);
        console.log('📅 Loaded events for', cal.name);
      } catch (error) {
        console.error('📅 Failed to load calendar', cal.name, error);
      }
    }
  }

  createSampleEvents(cal) {
    const events = [];
    const today = new Date();
    
    for (let i = 0; i < 10; i++) {
      const eventDate = new Date(today);
      eventDate.setDate(today.getDate() + (i % 7));
      eventDate.setHours(8 + (i % 12), 0, 0, 0);
      
      const endDate = new Date(eventDate);
      endDate.setHours(eventDate.getHours() + 1);
      
      events.push({
        id: `${cal.id}-event-${i}`,
        calendarId: cal.id,
        title: `${cal.name.split(' ')[0]} Event ${i + 1}`,
        start: eventDate,
        end: endDate,
        category: 'time',
        // Use calendar-specific colors that won't be overridden
        backgroundColor: cal.backgroundColor,
        borderColor: cal.borderColor,
        color: cal.color,
        // Add custom styling to ensure colors persist
        customStyle: {
          backgroundColor: cal.backgroundColor,
          borderColor: cal.borderColor,
          color: cal.color
        }
      });
    }
    
    return events;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new CalendarWidget();
});
