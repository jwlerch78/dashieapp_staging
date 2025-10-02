// widgets/dcal/dcal-weekly.js - Weekly View Rendering Module
// CHANGE SUMMARY: Custom Google Calendar-style weekly view implementation

import { createLogger } from '../../js/utils/logger.js';

const logger = createLogger('DCalWeekly');

export class DCalWeekly {
  constructor(calendars) {
    this.calendars = calendars;
    this.currentDate = new Date();
    this.weekDates = [];
    this.focusedDayIndex = -1;
    this.isFocused = false;
    this.selectedEventId = null;
    
    this.hourHeight = 60; // pixels per hour
    this.startHour = 0;
    this.endHour = 24;
  }

  initialize(date) {
    this.currentDate = date;
    this.calculateWeekDates();
    this.render();
    this.setOptimalScrollPosition();
    this.startNowIndicator();
  }

  setDate(date) {
    this.currentDate = date;
    this.calculateWeekDates();
    this.render();
  }

  setFocused(focused) {
    this.isFocused = focused;
    if (focused) {
      this.focusedDayIndex = this.findTodayColumn() || 3;
      this.updateDayFocus();
    } else {
      this.focusedDayIndex = -1;
      this.clearDayFocus();
    }
  }

  navigateDay(direction) {
    const newIndex = this.focusedDayIndex + direction;
    if (newIndex >= 0 && newIndex < 7) {
      this.focusedDayIndex = newIndex;
      this.updateDayFocus();
    }
  }

  scroll(direction) {
    const timeGrid = document.querySelector('.time-grid');
    if (timeGrid) {
      const scrollAmount = this.hourHeight * 2; // 2 hours at a time
      timeGrid.scrollTop += (direction === 'up' ? -scrollAmount : scrollAmount);
    }
  }

  calculateWeekDates() {
    const startOfWeek = new Date(this.currentDate);
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
    
    this.weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      this.weekDates.push(date);
    }
  }

  render() {
    const calendarContainer = document.getElementById('calendar');
    
    calendarContainer.innerHTML = `
      <div class="allday-section">
        <div class="allday-header">
          <div class="allday-label">All day</div>
          ${this.renderDayHeaders()}
        </div>
        <div class="allday-events">
          <div class="allday-events-column"></div>
          ${this.weekDates.map((_, i) => `<div class="allday-events-column" id="alldayColumn${i}"></div>`).join('')}
        </div>
      </div>
      <div class="time-grid">
        <div class="time-column">
          ${this.renderTimeSlots()}
        </div>
        <div class="days-grid">
          ${this.weekDates.map((_, i) => `<div class="day-column" id="dayColumn${i}">${this.renderHourLines()}</div>`).join('')}
        </div>
      </div>
    `;
  }

  renderDayHeaders() {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    
    return this.weekDates.map((date, index) => {
      const isToday = date.toDateString() === today.toDateString();
      return `
        <div class="day-header ${isToday ? 'today' : ''}" id="dayHeader${index}">
          <div class="day-name">${dayNames[index]}</div>
          <div class="day-number">${date.getDate()}</div>
        </div>
      `;
    }).join('');
  }

  renderTimeSlots() {
    let html = '';
    for (let hour = this.startHour; hour < this.endHour; hour++) {
      html += `<div class="time-slot">${this.formatTimeLabel(hour)}</div>`;
    }
    return html;
  }

  renderHourLines() {
    let html = '';
    for (let hour = this.startHour; hour < this.endHour; hour++) {
      html += `<div class="hour-line" data-hour="${hour}"></div>`;
    }
    return html;
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

  renderEvents(calendarData) {
    if (!calendarData || !calendarData.events) {
      logger.warn('No calendar data provided for rendering');
      return;
    }

    // Clear existing events
    for (let i = 0; i < 7; i++) {
      const dayColumn = document.getElementById(`dayColumn${i}`);
      const alldayColumn = document.getElementById(`alldayColumn${i}`);
      if (dayColumn) {
        dayColumn.querySelectorAll('.event').forEach(e => e.remove());
      }
      if (alldayColumn) {
        alldayColumn.innerHTML = '';
      }
    }

    // Render each event
    calendarData.events.forEach(event => {
      this.renderEvent(event);
    });

    logger.info('Events rendered in weekly view', { 
      eventCount: calendarData.events.length 
    });
  }

  renderEvent(event) {
    const isAllDay = !!(event.start?.date && !event.start?.dateTime);
    const eventStart = isAllDay 
      ? this.parseAllDayDate(event.start.date)
      : new Date(event.start.dateTime);
    
    const dayIndex = this.weekDates.findIndex(date => 
      date.toDateString() === eventStart.toDateString()
    );
    
    if (dayIndex === -1) return;
    
    if (isAllDay) {
      this.renderAllDayEvent(event, dayIndex);
    } else {
      this.renderTimedEvent(event, dayIndex, eventStart);
    }
  }

  parseAllDayDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0);
  }

  renderAllDayEvent(event, dayIndex) {
    const column = document.getElementById(`alldayColumn${dayIndex}`);
    if (!column) return;

    const eventElement = document.createElement('div');
    eventElement.className = 'allday-event';
    eventElement.textContent = event.summary || 'Untitled Event';
    eventElement.title = event.summary || 'Untitled Event';
    eventElement.dataset.eventId = event.id;
    eventElement.dataset.calendarId = event.calendarId || '';
    
    eventElement.addEventListener('click', () => {
      this.selectEvent(event.id);
    });
    
    column.appendChild(eventElement);
  }

  renderTimedEvent(event, dayIndex, eventStart) {
    const dayColumn = document.getElementById(`dayColumn${dayIndex}`);
    if (!dayColumn) return;

    const eventEnd = new Date(event.end.dateTime);
    
    // Calculate position and height
    const startMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
    const endMinutes = eventEnd.getHours() * 60 + eventEnd.getMinutes();
    const durationMinutes = endMinutes - startMinutes;
    
    const top = (startMinutes / 60) * this.hourHeight;
    const height = Math.max((durationMinutes / 60) * this.hourHeight, 20); // Minimum 20px height
    
    const eventElement = document.createElement('div');
    eventElement.className = 'event';
    eventElement.style.top = `${top}px`;
    eventElement.style.height = `${height}px`;
    eventElement.textContent = event.summary || 'Untitled Event';
    eventElement.title = `${event.summary || 'Untitled Event'} (${this.formatTime(eventStart)} - ${this.formatTime(eventEnd)})`;
    eventElement.dataset.eventId = event.id;
    eventElement.dataset.calendarId = event.calendarId || '';
    
    eventElement.addEventListener('click', () => {
      this.selectEvent(event.id);
    });
    
    dayColumn.appendChild(eventElement);
  }

  selectEvent(eventId) {
    // Clear previous selection
    document.querySelectorAll('.event.selected').forEach(e => {
      e.classList.remove('selected');
    });
    
    // Select new event
    const eventElement = document.querySelector(`[data-event-id="${eventId}"]`);
    if (eventElement) {
      eventElement.classList.add('selected');
      this.selectedEventId = eventId;
      logger.info('Event selected', { eventId });
    }
  }

  formatTime(date) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  getWeekTitle() {
    const startDate = this.weekDates[0];
    const endDate = this.weekDates[6];
    
    if (startDate.getMonth() === endDate.getMonth()) {
      return `${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} ${startDate.getDate()}-${endDate.getDate()}`;
    } else {
      return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
  }

  setOptimalScrollPosition() {
    const timeGrid = document.querySelector('.time-grid');
    if (!timeGrid) return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Scroll to 2 hours before current time, or 6 AM if it's early
    const scrollHour = Math.max(6, currentHour - 2);
    const scrollPosition = scrollHour * this.hourHeight + (currentMinute / 60) * this.hourHeight;
    
    setTimeout(() => {
      timeGrid.scrollTop = scrollPosition;
    }, 100);
  }

  startNowIndicator() {
    this.updateNowIndicator();
    
    // Update every minute
    setInterval(() => {
      this.updateNowIndicator();
    }, 60000);
  }

  updateNowIndicator() {
    // Remove existing indicator
    document.querySelectorAll('.now-indicator').forEach(el => el.remove());
    
    const now = new Date();
    const todayColumn = this.findTodayColumn();
    
    if (todayColumn === -1) return;
    
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const top = (currentMinutes / 60) * this.hourHeight;
    
    const indicator = document.createElement('div');
    indicator.className = 'now-indicator';
    indicator.style.top = `${top}px`;
    
    const dayColumn = document.getElementById(`dayColumn${todayColumn}`);
    if (dayColumn) {
      dayColumn.appendChild(indicator);
    }
  }

  findTodayColumn() {
    const today = new Date();
    return this.weekDates.findIndex(date => 
      date.toDateString() === today.toDateString()
    );
  }

  updateDayFocus() {
    this.clearDayFocus();
    if (this.focusedDayIndex >= 0) {
      const dayColumn = document.getElementById(`dayColumn${this.focusedDayIndex}`);
      if (dayColumn) {
        dayColumn.classList.add('focused');
      }
    }
  }

  clearDayFocus() {
    document.querySelectorAll('.day-column.focused').forEach(col => {
      col.classList.remove('focused');
    });
  }
}