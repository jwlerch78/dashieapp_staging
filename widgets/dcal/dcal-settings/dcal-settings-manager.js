// widgets/dcal/dcal-settings/dcal-settings-manager.js
// CHANGE SUMMARY: Initial creation - Calendar settings manager that uses parent navigation (no separate nav instance needed)

export class CalendarSettingsManager {
  constructor(parentOverlay, parentNavigation) {
    this.parentOverlay = parentOverlay;
    this.parentNavigation = parentNavigation;
    
    // Mock calendar data for Phase 1
    this.mockCalendars = {
      personal: {
        displayName: 'Personal',
        email: 'user@gmail.com',
        calendars: {
          cal_personal_primary: {
            id: 'cal_personal_primary',
            name: 'My Calendar',
            color: '#4285f4',
            enabled: true
          },
          cal_personal_birthdays: {
            id: 'cal_personal_birthdays',
            name: 'Birthdays',
            color: '#0b8043',
            enabled: true
          },
          cal_personal_holidays: {
            id: 'cal_personal_holidays',
            name: 'US Holidays',
            color: '#f4511e',
            enabled: false
          }
        }
      },
      work: {
        displayName: 'Work',
        email: 'user@company.com',
        calendars: {
          cal_work_team: {
            id: 'cal_work_team',
            name: 'Team Calendar',
            color: '#7986cb',
            enabled: true
          },
          cal_work_company: {
            id: 'cal_work_company',
            name: 'Company Events',
            color: '#ad1457',
            enabled: false
          },
          cal_work_meetings: {
            id: 'cal_work_meetings',
            name: 'Meeting Room Calendar',
            color: '#e67c73',
            enabled: true
          }
        }
      }
    };
    
    console.log('📅 CalendarSettingsManager created with mock data');
  }

  /**
   * Initialize calendar settings - called when navigating to calendar screens
   */
  initialize() {
    console.log('📅 Initializing calendar settings');
    this.setupEventListeners();
    this.updateCalendarList();
    
    // CRITICAL: Tell parent navigation to refresh focusable elements after we create DOM
    if (this.parentNavigation && typeof this.parentNavigation.updateFocusableElements === 'function') {
      this.parentNavigation.updateFocusableElements();
      this.parentNavigation.updateFocus();
      console.log('📅 Refreshed parent navigation focus');
    }
  }

  /**
   * Setup event listeners for calendar items
   */
  setupEventListeners() {
    // Listen for clicks on calendar items to toggle enabled/disabled
    const calendarItems = this.parentOverlay.querySelectorAll('.calendar-item');
    
    calendarItems.forEach(item => {
      // Remove existing listeners to avoid duplicates
      item.replaceWith(item.cloneNode(true));
    });
    
    // Re-query after cloning
    const freshItems = this.parentOverlay.querySelectorAll('.calendar-item');
    
    freshItems.forEach(item => {
      item.addEventListener('click', (e) => {
        this.toggleCalendar(item);
      });
      
      // Also handle Enter key for d-pad/keyboard navigation
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.toggleCalendar(item);
        }
      });
    });
    
    console.log('📅 Event listeners attached to calendar items');
  }

  /**
   * Toggle calendar enabled/disabled state
   */
  toggleCalendar(calendarItem) {
    const calendarId = calendarItem.dataset.calendarId;
    const accountType = calendarItem.dataset.account;
    
    if (!calendarId || !accountType) {
      console.warn('📅 Calendar item missing data attributes');
      return;
    }
    
    const calendar = this.mockCalendars[accountType]?.calendars[calendarId];
    if (!calendar) {
      console.warn('📅 Calendar not found in mock data');
      return;
    }
    
    // Toggle enabled state
    calendar.enabled = !calendar.enabled;
    
    // Update UI - just toggle the class, CSS handles checkmark visibility
    if (calendar.enabled) {
      calendarItem.classList.add('enabled');
    } else {
      calendarItem.classList.remove('enabled');
    }
    
    console.log(`📅 Calendar ${calendar.name} ${calendar.enabled ? 'enabled' : 'disabled'}`);
    
    // In Phase 2, this will save to localStorage and database
    // For now, just log the change
    this.logCalendarState();
  }

  /**
   * Update the calendar list display
   */
  updateCalendarList() {
    const container = this.parentOverlay.querySelector('#calendar-accounts-container');
    if (!container) {
      console.warn('📅 Calendar accounts container not found');
      return;
    }
    
    // Clear existing content
    container.innerHTML = '';
    
    // Render each account section
    Object.keys(this.mockCalendars).forEach(accountType => {
      const account = this.mockCalendars[accountType];
      const section = this.createAccountSection(accountType, account);
      container.appendChild(section);
    });
    
    // Re-attach event listeners after updating DOM
    this.setupEventListeners();
    
    console.log('📅 Calendar list updated');
  }

  /**
   * Create an account section with calendars
   */
  createAccountSection(accountType, account) {
    const section = document.createElement('div');
    section.className = 'settings-section calendar-account-section';
    section.dataset.account = accountType;
    
    // Account header
    const header = document.createElement('div');
    header.className = 'settings-section-header calendar-account-header';
    header.textContent = `${account.displayName} (${account.email})`;
    section.appendChild(header);
    
    // Calendar items
    Object.values(account.calendars).forEach(calendar => {
      const item = this.createCalendarItem(accountType, calendar);
      section.appendChild(item);
    });
    
    return section;
  }

  /**
   * Create a calendar item element
   */
  createCalendarItem(accountType, calendar) {
    const item = document.createElement('div');
    item.className = `settings-cell selectable calendar-item ${calendar.enabled ? 'enabled' : ''}`;
    item.dataset.calendarId = calendar.id;
    item.dataset.account = accountType;
    item.setAttribute('tabindex', '0');
    
    // Color dot
    const colorDot = document.createElement('span');
    colorDot.className = 'calendar-color-dot';
    colorDot.style.backgroundColor = calendar.color;
    
    // Label
    const label = document.createElement('span');
    label.className = 'cell-label';
    label.textContent = calendar.name;
    
    // Checkmark (CSS will handle visibility based on .enabled class)
    const checkmark = document.createElement('span');
    checkmark.className = 'cell-checkmark';
    checkmark.textContent = '✓';
    
    item.appendChild(colorDot);
    item.appendChild(label);
    item.appendChild(checkmark);
    
    return item;
  }

  /**
   * Log current calendar state (for debugging Phase 1)
   */
  logCalendarState() {
    const enabledCalendars = [];
    
    Object.keys(this.mockCalendars).forEach(accountType => {
      Object.values(this.mockCalendars[accountType].calendars).forEach(calendar => {
        if (calendar.enabled) {
          enabledCalendars.push({
            account: accountType,
            name: calendar.name,
            id: calendar.id
          });
        }
      });
    });
    
    console.log('📅 Currently enabled calendars:', enabledCalendars);
  }

  /**
   * Cleanup when leaving calendar settings
   */
  destroy() {
    console.log('📅 CalendarSettingsManager destroyed');
  }
}