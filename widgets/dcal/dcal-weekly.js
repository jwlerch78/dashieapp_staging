// widgets/dcal/dcal-weekly.js - Weekly View Rendering Module
// v1.7 - 10/12/25 9:20pm - FIXED: Added user scroll detection to prevent auto-scroll from overwriting manual scrolls
// v1.6 - 10/10/25 5:30pm - Added n-day view mode support with settings integration
// CHANGE SUMMARY: User scroll tracking prevents auto-scroll conflicts; reset on initialize/updateSettings/resetScrollTracking

import { createLogger } from '../../js/utils/logger.js';

const logger = createLogger('DCalWeekly');

export class DCalWeekly {
  constructor(calendars, settings = {}) {
    this.calendars = calendars;
    this.currentDate = new Date();
    this.weekDates = [];
    this.focusedDayIndex = -1;
    this.isFocused = false;
    this.selectedEventId = null;
    this.savedScrollPosition = null; // Track scroll position across week changes
    this.userHasScrolled = false; // Track if user manually scrolled
    
    // Settings for n-day view mode
    this.dayCount = settings.viewMode === 'week' ? 7 : parseInt(settings.viewMode) || 7;
    this.startWeekOn = settings.startWeekOn || 'sun'; // 'sun' or 'mon'
    this.scrollTime = settings.scrollTime || 8; // Default 8 AM
    
    this.hourHeight = 30; // pixels per hour
    this.startHour = 0;
    this.endHour = 24;
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
    this.userHasScrolled = false; // Reset - fresh load
    this.calculateWeekDates();
    this.render();
    this.setOptimalScrollPosition();
    this.updateNowIndicator();
  }

  setDate(date) {
    // Save current scroll position before changing weeks
    const timeGrid = document.querySelector('.time-grid');
    if (timeGrid && timeGrid.scrollTop > 0) {
      this.savedScrollPosition = timeGrid.scrollTop;
    }
    
    this.currentDate = date;
    this.calculateWeekDates();
    this.render();
    
    // Restore scroll position after render
    this.restoreScrollPosition();
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
    if (newIndex >= 0 && newIndex < this.dayCount) {
      this.focusedDayIndex = newIndex;
      this.updateDayFocus();
    }
  }

  scroll(direction) {
    const timeGrid = document.querySelector('.time-grid');
    if (timeGrid) {
      const scrollAmount = this.hourHeight * 2;
      timeGrid.scrollTop += (direction === 'up' ? -scrollAmount : scrollAmount);
    }
  }

  calculateWeekDates() {
    const startDate = new Date(this.currentDate);
    
    if (this.dayCount === 7) {
      // Weekly mode: calculate based on startWeekOn setting
      const dayOfWeek = startDate.getDay();
      const offset = this.startWeekOn === 'mon' 
        ? (dayOfWeek === 0 ? -6 : 1 - dayOfWeek) // Monday start
        : -dayOfWeek; // Sunday start
      startDate.setDate(startDate.getDate() + offset);
    }
    // N-day mode: always start from current date (no offset)
    
    this.weekDates = [];
    for (let i = 0; i < this.dayCount; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      this.weekDates.push(date);
    }
  }

  render() {
    const calendarContainer = document.getElementById('calendar');
    const today = new Date();
    const todayIndex = this.weekDates.findIndex(date => 
      date.toDateString() === today.toDateString()
    );
    
    // Add today-column class to all-day grid if today is in this week
    const alldayGridClass = todayIndex >= 0 ? `today-column-${todayIndex}` : '';
    
    // Dynamic grid columns based on dayCount
    const gridStyle = `style="grid-template-columns: 60px repeat(${this.dayCount}, 1fr);"`;
    
    calendarContainer.innerHTML = `
      <div class="allday-section">
        <div class="allday-header" ${gridStyle}>
          <div class="day-header-spacer"></div>
          ${this.renderDayHeaders()}
        </div>
        <div class="allday-events-container">
          <div class="allday-label">All day</div>
          <div class="allday-events-grid ${alldayGridClass}" id="alldayEventsGrid" style="grid-template-columns: repeat(${this.dayCount}, 1fr);">
            <!-- All-day events rendered with proper stacking -->
          </div>
        </div>
      </div>
      <div class="time-grid">
        <div class="time-column">
          ${this.renderTimeSlots()}
        </div>
        <div class="days-grid" style="grid-template-columns: repeat(${this.dayCount}, 1fr);">
          ${this.weekDates.map((_, i) => {
            const isTodayColumn = i === todayIndex;
            return `<div class="day-column ${isTodayColumn ? 'today-column' : ''}" id="dayColumn${i}">${this.renderHourLines()}</div>`;
          }).join('')}
        </div>
      </div>
    `;
    
    // Update today column shading width for all-day section
    this.updateTodayColumnShading(todayIndex);
  }

  renderDayHeaders() {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    
    return this.weekDates.map((date, index) => {
      const isToday = date.toDateString() === today.toDateString();
      const dayName = dayNames[date.getDay()]; // Use date's actual day of week
      return `
        <div class="day-header ${isToday ? 'today' : ''}" id="dayHeader${index}">
          <div class="day-number">${date.getDate()}</div>
          <div class="day-name">${dayName}</div>
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
    for (let i = 0; i < this.dayCount; i++) {
      const dayColumn = document.getElementById(`dayColumn${i}`);
      if (dayColumn) {
        dayColumn.querySelectorAll('.event').forEach(e => e.remove());
      }
    }
    
    const alldayGrid = document.getElementById('alldayEventsGrid');
    if (alldayGrid) {
      alldayGrid.innerHTML = '';
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

    // Render all-day events with stacking logic
    this.renderAllDayEvents(allDayEvents);

    // Render timed events
    timedEvents.forEach(event => {
      const eventStart = new Date(event.start.dateTime);
      const dayIndex = this.weekDates.findIndex(date => 
        date.toDateString() === eventStart.toDateString()
      );
      
      if (dayIndex !== -1) {
        this.renderTimedEvent(event, dayIndex, eventStart);
      }
    });

    logger.info('Events rendered in weekly view', { 
      eventCount: calendarData.events.length,
      allDayCount: allDayEvents.length,
      timedCount: timedEvents.length
    });
    
    // Update now indicator when events are rendered
    this.updateNowIndicator();
  }

  parseAllDayDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0);
  }

  renderAllDayEvents(allDayEvents) {
    const alldayGrid = document.getElementById('alldayEventsGrid');
    if (!alldayGrid) return;

    // Process events and determine their positions
    const eventRows = [];

    allDayEvents.forEach(event => {
      // Parse start and end dates - MATCHING TUI CALENDAR LOGIC
      const startDateString = event.start.date;
      const endDateString = event.end.date;
      
      logger.debug('Processing all-day event', {
        summary: event.summary,
        startDate: startDateString,
        endDate: endDateString
      });
      
      const [startYear, startMonth, startDay] = startDateString.split('-').map(Number);
      const [endYear, endMonth, endDay] = endDateString.split('-').map(Number);
      
      // Create dates at noon local time to avoid timezone issues
      let eventStart = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
      let eventEnd = new Date(endYear, endMonth - 1, endDay, 12, 0, 0);
     
      const startDayIndex = this.weekDates.findIndex(date => 
        date.toDateString() === eventStart.toDateString()
      );
      
      if (startDayIndex === -1) {
        logger.debug('Event not in this week', { summary: event.summary });
        return;
      }
      
      // Calculate span: count days from start to end (inclusive)
      let spanDays = 0;
      let current = new Date(eventStart);
      
      while (current <= eventEnd && startDayIndex + spanDays < this.dayCount) {
        spanDays++;
        current.setDate(current.getDate() + 1);
      }
      
      logger.debug('Calculated span', {
        summary: event.summary,
        startDayIndex,
        spanDays,
        endDayIndex: startDayIndex + spanDays - 1
      });

      const eventInfo = {
        event,
        startDayIndex,
        spanDays,
        endDayIndex: startDayIndex + spanDays - 1
      };

      // Find the first row where this event doesn't overlap with existing events
      let placed = false;
      for (let rowIndex = 0; rowIndex < eventRows.length; rowIndex++) {
        const row = eventRows[rowIndex];
        let hasOverlap = false;

        for (const existingEvent of row) {
          // Check if events overlap in day range
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

      // If no row found, create a new row
      if (!placed) {
        eventRows.push([eventInfo]);
      }
    });

    // Render events
    eventRows.forEach((row, rowIndex) => {
      row.forEach(eventInfo => {
        const { event, startDayIndex, spanDays } = eventInfo;
        
        // Get calendar color
        const calendar = this.calendars.find(cal => cal.id === event.calendarId);

        const backgroundColor = calendar?.backgroundColor || '#1976d2';
        
        const eventElement = document.createElement('div');
        eventElement.className = 'allday-event';
        eventElement.textContent = event.summary || 'Untitled Event';
        eventElement.title = event.summary || 'Untitled Event';
        eventElement.dataset.eventId = event.id;
        eventElement.dataset.calendarId = event.calendarId || '';
        
        // Apply dynamic colors
        eventElement.style.backgroundColor = backgroundColor;
        eventElement.style.border = `1px solid var(--bg-secondary, #333)`;
        
        // Grid columns: 1-7 for the days
        const gridColumnStart = startDayIndex + 1;
        const gridColumnEnd = gridColumnStart + spanDays;
        
        logger.debug('Rendering all-day event', {
          summary: event.summary,
          gridColumnStart,
          gridColumnEnd,
          gridRow: rowIndex + 1
        });
        
        eventElement.style.gridColumn = `${gridColumnStart} / ${gridColumnEnd}`;
        eventElement.style.gridRow = `${rowIndex + 1}`;
        
        eventElement.addEventListener('click', () => {
          this.selectEvent(event.id);
        });
        
        alldayGrid.appendChild(eventElement);
      });
    });
  }

  renderTimedEvent(event, dayIndex, eventStart) {
    const dayColumn = document.getElementById(`dayColumn${dayIndex}`);
    if (!dayColumn) return;

    const eventEnd = new Date(event.end.dateTime);
    
    const startMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
    const endMinutes = eventEnd.getHours() * 60 + eventEnd.getMinutes();
    const durationMinutes = endMinutes - startMinutes;
    
    const top = (startMinutes / 60) * this.hourHeight;
    const height = Math.max((durationMinutes / 60) * this.hourHeight, 15);
    
    // Get calendar color
    const calendar = this.calendars.find(cal => cal.id === event.calendarId);
    const backgroundColor = calendar?.backgroundColor || '#1976d2';
    
    const eventElement = document.createElement('div');
    eventElement.className = 'event';
    eventElement.style.top = `${top}px`;
    eventElement.style.height = `${height}px`;
    eventElement.title = `${event.summary || 'Untitled Event'} (${this.formatTime(eventStart)} - ${this.formatTime(eventEnd)})`;
    eventElement.dataset.eventId = event.id;
    eventElement.dataset.calendarId = event.calendarId || '';
    eventElement.dataset.startMinutes = startMinutes;
    eventElement.dataset.endMinutes = endMinutes;
    
    // Apply dynamic text wrapping based on duration
    if (durationMinutes >= 60) {
      // Long event: wrap text and show time
      eventElement.innerHTML = `
        <div class="event-title">${event.summary || 'Untitled Event'}</div>
        <div class="event-time">${this.formatTime(eventStart)} - ${this.formatTime(eventEnd)}</div>
      `;
      eventElement.style.whiteSpace = 'normal';
      eventElement.style.padding = '2px 4px';
    } else {
      // Short event: single line, reduced top padding
      eventElement.textContent = event.summary || 'Untitled Event';
      eventElement.style.whiteSpace = 'nowrap';
      eventElement.style.padding = '0px 4px 2px 4px';
    }
    
    // Apply dynamic colors
    eventElement.style.backgroundColor = backgroundColor;
    eventElement.style.border = `1px solid var(--bg-secondary, #333)`;
    
    eventElement.addEventListener('click', () => {
      this.selectEvent(event.id);
    });
    
    dayColumn.appendChild(eventElement);
    
    // After adding, detect and handle collisions
    this.handleEventCollisions(dayColumn);
  }

  handleEventCollisions(dayColumn) {
    const events = Array.from(dayColumn.querySelectorAll('.event'));
    if (events.length <= 1) return;
    
    // Build list of event data with overlap information
    const eventData = events.map(el => ({
      element: el,
      startMinutes: parseInt(el.dataset.startMinutes),
      endMinutes: parseInt(el.dataset.endMinutes),
      overlaps: []
    }));
    
    // Detect overlaps
    for (let i = 0; i < eventData.length; i++) {
      for (let j = i + 1; j < eventData.length; j++) {
        const eventA = eventData[i];
        const eventB = eventData[j];
        
        // Check if events overlap
        if (eventA.startMinutes < eventB.endMinutes && eventB.startMinutes < eventA.endMinutes) {
          eventA.overlaps.push(j);
          eventB.overlaps.push(i);
        }
      }
    }
    
    // Group overlapping events into collision groups
    const processed = new Set();
    const collisionGroups = [];
    
    for (let i = 0; i < eventData.length; i++) {
      if (processed.has(i)) continue;
      
      const group = new Set([i]);
      const queue = [i];
      
      while (queue.length > 0) {
        const current = queue.shift();
        eventData[current].overlaps.forEach(overlappingIndex => {
          if (!group.has(overlappingIndex)) {
            group.add(overlappingIndex);
            queue.push(overlappingIndex);
          }
        });
      }
      
      group.forEach(idx => processed.add(idx));
      collisionGroups.push(Array.from(group));
    }
    
    // Apply positioning to each collision group
    collisionGroups.forEach(group => {
      if (group.length === 1) {
        // No collision, reset to full width
        const el = eventData[group[0]].element;
        el.style.width = '';
        el.style.left = '2px';
        el.style.right = '2px';
        return;
      }
      
      // For 2 overlapping events: first event 75% width, second event 50% width at 50% position
      if (group.length === 2) {
        // Sort by start time (earlier event is "first"/behind)
        group.sort((a, b) => eventData[a].startMinutes - eventData[b].startMinutes);
        
        const firstEvent = eventData[group[0]].element;
        const secondEvent = eventData[group[1]].element;
        
        // First event: 75% width, starts at left
        firstEvent.style.left = '2px';
        firstEvent.style.width = 'calc(75% - 2px)';
        firstEvent.style.right = 'auto';
        firstEvent.style.zIndex = '20';
        
        // Second event: 50% width, starts at 50%
        secondEvent.style.left = '50%';
        secondEvent.style.width = 'calc(50% - 2px)';
        secondEvent.style.right = 'auto';
        secondEvent.style.zIndex = '21';
      }
      
      // For 3 overlapping events
      if (group.length === 3) {
        // Sort by start time (earliest is bottom, latest is top)
        group.sort((a, b) => eventData[a].startMinutes - eventData[b].startMinutes);
        
        const firstEvent = eventData[group[0]].element;   // Bottom
        const secondEvent = eventData[group[1]].element;  // Middle
        const thirdEvent = eventData[group[2]].element;   // Top
        
        // First event (bottom): 50% width, starts at left
        firstEvent.style.left = '2px';
        firstEvent.style.width = 'calc(50% - 2px)';
        firstEvent.style.right = 'auto';
        firstEvent.style.zIndex = '20';
        
        // Second event (middle): 50% width, starts at 33%
        secondEvent.style.left = '33.33%';
        secondEvent.style.width = 'calc(50% - 2px)';
        secondEvent.style.right = 'auto';
        secondEvent.style.zIndex = '21';
        
        // Third event (top): 33% width, starts at 66.67%
        thirdEvent.style.left = '66.67%';
        thirdEvent.style.width = 'calc(33.33% - 2px)';
        thirdEvent.style.right = 'auto';
        thirdEvent.style.zIndex = '22';
      }
    });
  }

  selectEvent(eventId) {
    document.querySelectorAll('.event.selected, .allday-event.selected').forEach(e => {
      e.classList.remove('selected');
    });
    
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
    if (this.weekDates.length === 0) return '';
    
    const startDate = this.weekDates[0];
    const endDate = this.weekDates[this.weekDates.length - 1];
    
    // For single day, just show the date
    if (this.dayCount === 1) {
      return startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    
    const startMonth = startDate.getMonth();
    const endMonth = endDate.getMonth();
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    
    if (startMonth === endMonth && startYear === endYear) {
      return startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (startYear === endYear) {
      return `${startDate.toLocaleDateString('en-US', { month: 'long' })} - ${endDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    } else {
      return `${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    }
  }

  setOptimalScrollPosition() {
    const timeGrid = document.querySelector('.time-grid');
    if (!timeGrid) {
      logger.warn('Time grid not found for scroll positioning');
      return;
    }

    // Don't auto-scroll if user has already scrolled manually
    if (this.userHasScrolled) {
      logger.debug('User has scrolled manually - skipping auto-scroll');
      return;
    }

    // Add scroll listener to detect user interaction
    const scrollListener = () => {
      this.userHasScrolled = true;
      timeGrid.removeEventListener('scroll', scrollListener);
      logger.debug('User scroll detected - disabling future auto-scroll');
    };
    timeGrid.addEventListener('scroll', scrollListener);

    // Poll with reasonable delay until content is rendered
    let checkCount = 0;
    const maxChecks = 20; // Max 5 seconds (20 * 250ms)
    
    const scrollWhenReady = () => {
      checkCount++;
      
      // Check if user scrolled during polling - cancel immediately
      if (this.userHasScrolled) {
        timeGrid.removeEventListener('scroll', scrollListener);
        logger.debug('Cancelling auto-scroll - user scrolled during poll');
        return;
      }
      
      // Check if content has been rendered (scrollHeight > 0 AND events exist)
      const hasEvents = timeGrid.querySelectorAll('.event').length > 0 || 
                        document.querySelectorAll('.allday-event').length > 0;
      const hasContent = timeGrid.scrollHeight > 0;
      
      if (hasContent && (hasEvents || checkCount > 8)) {
        // Use scrollTime setting (default 8 AM)
        // Allow scroll after 2 seconds (8 checks) even without events
        const targetHour = this.scrollTime;
        const targetScroll = targetHour * this.hourHeight;
        
        // Remove listener before programmatic scroll to avoid triggering flag
        timeGrid.removeEventListener('scroll', scrollListener);
        timeGrid.scrollTop = targetScroll;
        
        // Re-add listener after brief delay to catch subsequent user scrolls
        setTimeout(() => {
          if (!this.userHasScrolled) {
            timeGrid.addEventListener('scroll', scrollListener);
          }
        }, 100);
        
        logger.debug('Set optimal scroll position', { 
          targetHour, 
          targetScroll,
          hourHeight: this.hourHeight,
          actualScroll: timeGrid.scrollTop,
          scrollHeight: timeGrid.scrollHeight,
          checksNeeded: checkCount
        });
      } else if (checkCount < maxChecks) {
        // Content not ready yet, check again in 250ms
        setTimeout(scrollWhenReady, 250);
      } else {
        timeGrid.removeEventListener('scroll', scrollListener);
        logger.warn('Failed to scroll - content not rendered after 5 seconds');
      }
    };

    // Start checking after brief initial delay
    setTimeout(scrollWhenReady, 50);
  }

  restoreScrollPosition() {
    if (this.savedScrollPosition === null) return;
    
    const timeGrid = document.querySelector('.time-grid');
    if (!timeGrid) return;
    
    // Poll until content is ready, then restore scroll
    let checkCount = 0;
    const maxChecks = 20;
    
    const scrollWhenReady = () => {
      checkCount++;
      
      if (timeGrid.scrollHeight > 0) {
        timeGrid.scrollTop = this.savedScrollPosition;
        logger.debug('Restored scroll position', { 
          scrollTop: this.savedScrollPosition,
          checksNeeded: checkCount
        });
      } else if (checkCount < maxChecks) {
        setTimeout(scrollWhenReady, 250);
      }
    };
    
    setTimeout(scrollWhenReady, 50);
  }

  startNowIndicator() {
    this.updateNowIndicator();
    
    setInterval(() => {
      this.updateNowIndicator();
    }, 60000);
  }

  updateNowIndicator() {
    const now = new Date();
    const todayIndex = this.findTodayColumn();
    
    document.querySelectorAll('.now-indicator').forEach(el => el.remove());
    
    if (todayIndex === -1) {
      return;
    }
    
    const dayColumn = document.getElementById(`dayColumn${todayIndex}`);
    if (!dayColumn) return;
    
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    const topPosition = (totalMinutes / 60) * this.hourHeight;
    
    const indicator = document.createElement('div');
    indicator.className = 'now-indicator';
    indicator.style.top = `${topPosition}px`;
    
    dayColumn.appendChild(indicator);
  }

  updateDayFocus() {
    this.clearDayFocus();
    if (this.focusedDayIndex >= 0 && this.focusedDayIndex < this.dayCount) {
      const dayColumn = document.getElementById(`dayColumn${this.focusedDayIndex}`);
      if (dayColumn) {
        dayColumn.classList.add('focused');
      }
    }
  }

  clearDayFocus() {
    document.querySelectorAll('.day-column').forEach(col => {
      col.classList.remove('focused');
    });
  }

  findTodayColumn() {
    const today = new Date();
    return this.weekDates.findIndex(date => 
      date.toDateString() === today.toDateString()
    );
  }

  /**
   * Update settings and re-render if needed
   */
  updateSettings(settings) {
    const needsRerender = 
      this.dayCount !== (settings.viewMode === 'week' ? 7 : parseInt(settings.viewMode)) ||
      this.startWeekOn !== settings.startWeekOn ||
      this.scrollTime !== settings.scrollTime;
    
    this.dayCount = settings.viewMode === 'week' ? 7 : parseInt(settings.viewMode) || 7;
    this.startWeekOn = settings.startWeekOn || 'sun';
    this.scrollTime = settings.scrollTime || 8;
    
    if (needsRerender) {
      this.userHasScrolled = false; // Reset - settings changed
      
      logger.info('Settings changed, re-rendering view', {
        dayCount: this.dayCount,
        startWeekOn: this.startWeekOn,
        scrollTime: this.scrollTime
      });
      
      this.calculateWeekDates();
      this.render();
      this.setOptimalScrollPosition(); // Re-scroll with new settings
      this.updateNowIndicator();
    }
  }

  /**
   * Reset scroll flag to allow auto-scroll (used when returning to today)
   */
  resetScrollTracking() {
    this.userHasScrolled = false;
    logger.debug('Scroll tracking reset - auto-scroll enabled');
  }

  /**
   * Update today column shading width for all-day section
   */
  updateTodayColumnShading(todayIndex) {
    if (todayIndex < 0) return;
    
    const alldayGrid = document.getElementById('alldayEventsGrid');
    if (!alldayGrid) return;
    
    // Calculate the width percentage based on dayCount
    const columnWidth = `calc(100% / ${this.dayCount})`;
    const leftPosition = `calc(100% / ${this.dayCount} * ${todayIndex})`;
    
    // Use CSS custom properties to dynamically set the today column shading
    alldayGrid.style.setProperty('--today-column-width', columnWidth);
    alldayGrid.style.setProperty('--today-column-left', leftPosition);
  }

  /**
   * Darken a hex color by a percentage
   */
  darkenColor(hex, percent) {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Convert to RGB
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    
    // Darken
    r = Math.floor(r * (1 - percent / 100));
    g = Math.floor(g * (1 - percent / 100));
    b = Math.floor(b * (1 - percent / 100));
    
    // Convert back to hex
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }
}