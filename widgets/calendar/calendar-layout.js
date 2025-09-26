// widgets/calendar/calendar-layout.js - Layout Management and All-day Height Calculation
// CHANGE SUMMARY: Fixed timezone issues in countAllDayEventsByDay to properly detect and count all-day events

import { createLogger } from '../../js/utils/logger.js';

const logger = createLogger('CalendarLayout');

export class CalendarLayout {
  constructor() {
    this.dashieBaselineHeights = null;
  }

  updateAllDayHeight(calendar, currentView, calendarData, currentDate) {
    // Only apply all-day height management to week and daily views
    if (!calendar || (currentView !== 'week' && currentView !== 'daily')) return;

    const allDayContainer = document.querySelector('.toastui-calendar-allday');
    const timePanelContainer = document.querySelector('.toastui-calendar-panel.toastui-calendar-time');
    const calendarContainer = document.querySelector('.toastui-calendar');
    
    if (!allDayContainer || !timePanelContainer) {
      return;
    }

    // Determine visible date range for current view
    const dateRange = this.getVisibleDateRange(currentView, currentDate);
    
   
    // Count all-day events per day in the visible range
    const dayCounts = this.countAllDayEventsByDay(calendarData.events, dateRange);
    
    // Calculate required height based on maximum events per day
    const maxEvents = Math.max(0, ...Object.values(dayCounts));
    const rowHeight = 24;  // Height per event row
    const padding = 1;     // Additional padding

      // Store TUI's baseline heights on first run
    if (!this.dashieBaselineHeights) {
      this.captureBaselineHeights(allDayContainer, timePanelContainer, calendarContainer, maxEvents, rowHeight, padding);
      return;
    }
    
    // Apply height adjustment using captured baseline
    this.applyHeightAdjustment(allDayContainer, timePanelContainer, calendarContainer, maxEvents, rowHeight, padding);
  }

  getVisibleDateRange(currentView, currentDate) {
    let startDate = new Date(currentDate);
    let endDate = new Date(currentDate);

    if (currentView === 'week') {
      startDate = this.getStartOfWeek(currentDate);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
    }
    // For daily view, start and end are the same day

    return { startDate, endDate };
  }

  getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  // FIXED: Timezone-safe all-day event counting
  countAllDayEventsByDay(events, dateRange) {
    const dayCounts = {};

    events.forEach((ev, i) => {
      const isAllDay = !!ev.start.date;
      
      
      if (isAllDay) {
        // FIXED: Parse all-day events safely without timezone conversion
        const startDateString = ev.start.date; // e.g., "2025-09-23"
        const endDateString = ev.end.date; // e.g., "2025-09-23"
        
        // Parse as local dates to avoid timezone issues
        const [startYear, startMonth, startDay] = startDateString.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDateString.split('-').map(Number);
        
        let start = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
        let end = new Date(endYear, endMonth - 1, endDay, 12, 0, 0);
        
        // FIXED: Only subtract 1 day from end date if it's actually AFTER the start date
        // For single-day events, start and end are the same, so don't subtract
        if (startDateString !== endDateString) {
          // Multi-day event: Google's end date is exclusive, so subtract 1 day
          end = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        }
        // For single-day events: end = start (no adjustment needed)

        // Check if this event is in the visible range
        const inVisibleRange = start <= dateRange.endDate && end >= dateRange.startDate;

        // Special debugging for Generator Repair

        // Count event for each day it spans within the visible range
        let current = new Date(start);
        while (current <= end) {
          if (current >= dateRange.startDate && current <= dateRange.endDate) {
            const dayKey = current.toDateString();
            dayCounts[dayKey] = (dayCounts[dayKey] || 0) + 1;
            
          }
          current.setDate(current.getDate() + 1);
        }
      } else {
        // FIXED: Also check timed events that might be effectively all-day
        const start = new Date(ev.start.dateTime);
        const end = new Date(ev.end.dateTime);
        
        // Check if this is a timed event that spans multiple days and might be effectively all-day
        if (start.getHours() === end.getHours() && start.toDateString() !== end.toDateString()) {
          
          // Treat as all-day for layout purposes
          let current = new Date(start);
          const endDate = new Date(end.getTime() - 24 * 60 * 60 * 1000); // Subtract 1 day like Google all-day events
          
          while (current <= endDate) {
            if (current >= dateRange.startDate && current <= dateRange.endDate) {
              const dayKey = current.toDateString();
              dayCounts[dayKey] = (dayCounts[dayKey] || 0) + 1;
            }
            current.setDate(current.getDate() + 1);
          }
        }
      }
    });

    return dayCounts;
  }

  captureBaselineHeights(allDayContainer, timePanelContainer, calendarContainer, maxEvents, rowHeight, padding) {
    // Capture TUI's natural heights before we modify them
    setTimeout(() => {
      const timePanelStyle = window.getComputedStyle(timePanelContainer);
      const calendarStyle = window.getComputedStyle(calendarContainer || document.body);
      const allDayStyle = window.getComputedStyle(allDayContainer);
      
      this.dashieBaselineHeights = {
        timePanel: parseInt(timePanelStyle.height, 10),
        calendar: parseInt(calendarStyle.height, 10),
        currentAllDayHeight: parseInt(allDayStyle.height, 10) || 0
      };
      
           
      // Apply adjustment now that we have baseline
      this.applyHeightAdjustment(allDayContainer, timePanelContainer, calendarContainer, maxEvents, rowHeight, padding);
    }, 100);
  }

  applyHeightAdjustment(allDayContainer, timePanelContainer, calendarContainer, maxEvents, rowHeight, padding) {
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
    
    // Redistribute space: timePanel + allDayHeight = constant total
    const totalAvailableSpace = this.dashieBaselineHeights.timePanel + this.dashieBaselineHeights.currentAllDayHeight;
    const adjustedTimePanelHeight = totalAvailableSpace - allDayHeight;
    
    timePanelContainer.style.height = `${adjustedTimePanelHeight}px`;

  }

  // Future: Simplified height management approach
  applySimpleHeightManagement(allDayContainer, maxEvents) {
    // Potential simplified approach - just set all-day height and let TUI handle the rest
    const height = maxEvents > 0 ? Math.max(30, maxEvents * 25) : 0;
    allDayContainer.style.height = `${height}px`;
    allDayContainer.style.display = maxEvents > 0 ? 'block' : 'none';
  }

  // Utility method for resetting layout to TUI defaults
  resetToDefaults() {
    this.dashieBaselineHeights = null;
    
    // Remove any custom height styles
    const allDayContainer = document.querySelector('.toastui-calendar-allday');
    const timePanelContainer = document.querySelector('.toastui-calendar-panel.toastui-calendar-time');
    const calendarContainer = document.querySelector('.toastui-calendar');
    
    [allDayContainer, timePanelContainer, calendarContainer].forEach(container => {
      if (container) {
        container.style.height = '';
        container.style.display = '';
      }
    });

  }
}