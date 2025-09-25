// widgets/agenda/agenda_event.js - Event Modal and Selection Management
// CHANGE SUMMARY: Initial implementation - handles event selection, modal display, and keyboard navigation

import { createLogger } from '../../js/utils/logger.js';

const logger = createLogger('AgendaEventModal');

export class AgendaEventModal {
  constructor() {
    this.isVisible = false;
    this.currentEvent = null;
    this.calendarColors = new Map();
    
    //this.setupKeyboardHandlers();
    logger.info('Agenda event modal initialized');
  }

  setupKeyboardHandlers() {
    document.addEventListener('keydown', (e) => {
      if (!this.isVisible) return;

      // Handle modal keyboard navigation
      switch (e.code) {
        case 'Escape':
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          this.hideModal();
          break;
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          // Block navigation when modal is open
          e.preventDefault();
          e.stopPropagation();
          break;
      }
    });
  }

  updateCalendarColors(calendarColors) {
    this.calendarColors = calendarColors;
  }

  showModal(event) {
    this.currentEvent = event;
    this.isVisible = true;

    // Create modal if it doesn't exist
    this.createModal();
    this.populateModal();
    
    logger.info('Event modal shown', { 
      eventTitle: event.summary,
      eventId: event.id 
    });

    // Focus the modal for accessibility
    const modal = document.getElementById('eventModal');
    if (modal) {
      modal.focus();
    }
  }

  hideModal() {
    this.isVisible = false;
    
    const modal = document.getElementById('eventModal');
    if (modal) {
      modal.remove();
    }

    logger.info('Event modal hidden');
    
    // Emit event for parent widget to handle focus return
    window.dispatchEvent(new CustomEvent('modal-closed'));
  }

  createModal() {
    // Remove existing modal if present
    const existingModal = document.getElementById('eventModal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'eventModal';
    modal.className = 'event-modal';
    modal.tabIndex = -1; // Make focusable

    // Modal backdrop and styling
    modal.innerHTML = `
      <div class="modal-backdrop" id="modalBackdrop">
        <div class="modal-content" id="modalContent">
          <div class="modal-header">
            <h3 class="modal-title" id="modalTitle"></h3>
            <button class="modal-close" id="modalClose">×</button>
          </div>
          <div class="modal-body" id="modalBody">
            <!-- Event details will be populated here -->
          </div>
          <div class="modal-footer">
            <div class="modal-controls">Press Escape or Enter to close</div>
          </div>
        </div>
      </div>
    `;

    // Add modal styles
    this.addModalStyles(modal);

    // Event handlers
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'modalBackdrop') {
        this.hideModal();
      }
    });

    modal.querySelector('#modalClose').addEventListener('click', () => {
      this.hideModal();
    });

    document.body.appendChild(modal);
  }

  addModalStyles(modal) {
    const style = document.createElement('style');
    style.textContent = `
      .event-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      }

      .modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
      }

      .modal-content {
        background: var(--bg-secondary, #333);
        border: 1px solid var(--text-muted, #666);
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        max-width: 500px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
        color: var(--text-primary, #fff);
      }

      .modal-header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--text-muted, #666);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .modal-title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        flex: 1;
        margin-right: 12px;
      }

      .modal-close {
        background: none;
        border: none;
        color: var(--text-secondary, #ccc);
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.2s;
      }

      .modal-close:hover {
        background: var(--text-muted, #666);
        color: var(--text-primary, #fff);
      }

      .modal-body {
        padding: 20px;
      }

      .modal-footer {
        padding: 12px 20px;
        border-top: 1px solid var(--text-muted, #666);
        text-align: center;
      }

      .modal-controls {
        font-size: 11px;
        color: var(--text-muted, #999);
      }

      .event-detail-row {
        margin-bottom: 16px;
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      .event-detail-row:last-child {
        margin-bottom: 0;
      }

      .event-detail-label {
        font-weight: 600;
        color: var(--text-secondary, #ccc);
        min-width: 70px;
        font-size: 13px;
        flex-shrink: 0;
      }

      .event-detail-value {
        flex: 1;
        font-size: 13px;
        line-height: 1.4;
        word-wrap: break-word;
      }

      .event-calendar-info {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .event-calendar-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .event-time-range {
        font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        background: var(--bg-primary, #222);
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
      }

      /* Light theme overrides */
      body.theme-light .modal-content {
        background: var(--bg-secondary, #fcfcff);
        color: var(--text-primary, #424242);
      }

      body.theme-light .event-time-range {
        background: var(--bg-primary, #fcfcff);
      }
    `;
    
    modal.appendChild(style);
  }

  populateModal() {
    if (!this.currentEvent) return;

    const event = this.currentEvent;
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');

    titleEl.textContent = event.summary || 'Untitled Event';

    // Get calendar info
    const calendarColors = this.calendarColors.get(event.calendarId) || 
      { backgroundColor: '#1976d2', textColor: '#ffffff' };

    // Format event details
    const isAllDay = !!event.start.date;
    const timeDisplay = this.formatEventTimeForModal(event, isAllDay);
    const dateDisplay = this.formatEventDate(event);

    let detailsHtml = `
      <div class="event-detail-row">
        <div class="event-detail-label">When:</div>
        <div class="event-detail-value">
          <div>${dateDisplay}</div>
          <div class="event-time-range">${timeDisplay}</div>
        </div>
      </div>
    `;

    // Calendar info
    detailsHtml += `
      <div class="event-detail-row">
        <div class="event-detail-label">Calendar:</div>
        <div class="event-detail-value">
          <div class="event-calendar-info">
            <div class="event-calendar-dot" style="background-color: ${calendarColors.backgroundColor}"></div>
            <span>${this.getCalendarDisplayName(event.calendarId)}</span>
          </div>
        </div>
      </div>
    `;

    // Location (if present)
    if (event.location && event.location.trim()) {
      detailsHtml += `
        <div class="event-detail-row">
          <div class="event-detail-label">Location:</div>
          <div class="event-detail-value">${this.escapeHtml(event.location)}</div>
        </div>
      `;
    }

    // Description (if present)
    if (event.description && event.description.trim()) {
      detailsHtml += `
        <div class="event-detail-row">
          <div class="event-detail-label">Details:</div>
          <div class="event-detail-value">${this.escapeHtml(event.description)}</div>
        </div>
      `;
    }

    // Attendees (if present)
    if (event.attendees && event.attendees.length > 0) {
      const attendeesList = event.attendees
        .filter(attendee => attendee.email)
        .map(attendee => attendee.displayName || attendee.email)
        .join(', ');
      
      if (attendeesList) {
        detailsHtml += `
          <div class="event-detail-row">
            <div class="event-detail-label">Attendees:</div>
            <div class="event-detail-value">${this.escapeHtml(attendeesList)}</div>
          </div>
        `;
      }
    }

    bodyEl.innerHTML = detailsHtml;
  }

  formatEventTimeForModal(event, isAllDay) {
    if (isAllDay) {
      return 'All day';
    }

    const startTime = new Date(event.start.dateTime);
    const endTime = new Date(event.end.dateTime);

    // Use the same smart formatting as the agenda list
    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();
    const endHour = endTime.getHours();
    const endMinute = endTime.getMinutes();

    const formatTime = (hour, minute, showPeriod = true) => {
      const period = hour >= 12 ? 'pm' : 'am';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const timeString = minute === 0 ? displayHour.toString() : `${displayHour}:${minute.toString().padStart(2, '0')}`;
      
      if (showPeriod) {
        return `${timeString}${period}`;
      } else {
        return timeString;
      }
    };

    const startPeriod = startHour >= 12 ? 'pm' : 'am';
    const endPeriod = endHour >= 12 ? 'pm' : 'am';
    const samePeriod = startPeriod === endPeriod;

    if (samePeriod) {
      return `${formatTime(startHour, startMinute, false)} - ${formatTime(endHour, endMinute, true)}`;
    } else {
      return `${formatTime(startHour, startMinute, true)} - ${formatTime(endHour, endMinute, true)}`;
    }
  }

  formatEventDate(event) {
    const eventDate = new Date(event.start.dateTime || event.start.date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (eventDate.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (eventDate.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return eventDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  }

  getCalendarDisplayName(calendarId) {
    // Simple display name extraction - can be enhanced later
    if (calendarId.includes('@gmail.com')) {
      return calendarId.split('@')[0];
    } else if (calendarId.includes('@group.calendar.google.com')) {
      // For group calendars, we'd ideally get the name from calendar metadata
      return 'Work Calendar'; // Placeholder - should come from calendar data
    }
    return calendarId;
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}