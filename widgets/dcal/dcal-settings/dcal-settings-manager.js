// widgets/dcal/dcal-settings/dcal-settings-manager.js
// CHANGE SUMMARY: CRITICAL FIX - Added missing filterUniqueAccounts method, removed auto-save on toggle to stop database egress spike, mark as needing save

export class CalendarSettingsManager {
  constructor(parentOverlay, parentNavigation) {
    this.parentOverlay = parentOverlay;
    this.parentNavigation = parentNavigation;
    this.calendarSettings = null;
    this.isLoading = false;
    this.hasUnsavedChanges = false;
    
    console.log('📅 CalendarSettingsManager created');
  }

  /**
   * Initialize calendar settings - called when navigating to calendar screens
   */
  async initialize() {
    console.log('📅 Initializing calendar settings');
    
    if (this.isLoading) {
      console.log('📅 Already loading, skipping...');
      return;
    }
    
    this.isLoading = true;
    
    try {
      // Check if we're on the main calendar screen - add clear button listener
      const clearBtn = this.parentOverlay.querySelector('#clear-calendar-data-btn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => this.handleClearCalendarData());
      }
      
      // Load settings (from localStorage first, then database)
      await this.loadCalendarSettings();
      
      // Load real calendar data from Google API
      await this.loadRealCalendarData();
      
      // Update the UI
      this.updateCalendarList();
      this.setupEventListeners();
      
      // Refresh parent navigation focus
      if (this.parentNavigation && typeof this.parentNavigation.updateFocusableElements === 'function') {
        this.parentNavigation.updateFocusableElements();
        this.parentNavigation.updateFocus();
        console.log('📅 Refreshed parent navigation focus');
      }
      
    } catch (error) {
      console.error('📅 Failed to initialize calendar settings', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Load calendar settings from storage (localStorage first, then database)
   */
  async loadCalendarSettings() {
    console.log('📅 Loading calendar settings from storage');
    
    try {
      // 1. Try localStorage first (fast)
      const localStorage = window.parent?.localStorage || window.localStorage;
      const cached = localStorage.getItem('dashie_calendar_settings');
      
      if (cached) {
        this.calendarSettings = JSON.parse(cached);
        console.log('📅 Loaded from localStorage', {
          accounts: Object.keys(this.calendarSettings.accounts || {}).length,
          activeCalendars: (this.calendarSettings.activeCalendarIds || []).length
        });
      }
      
      // 2. Load from database (may be newer if settings changed on another device)
      const settingsInstance = window.parent?.settingsInstance;
      if (settingsInstance && settingsInstance.controller) {
        const dbSettings = settingsInstance.controller.getSetting('calendar');
        
        if (dbSettings && JSON.stringify(dbSettings) !== cached) {
          console.log('📅 Database has newer settings, syncing to localStorage');
          this.calendarSettings = dbSettings;
          localStorage.setItem('dashie_calendar_settings', JSON.stringify(dbSettings));
        }
      }
      
      // 3. Initialize empty structure if no settings exist
      if (!this.calendarSettings) {
        console.log('📅 No existing settings, initializing empty structure');
        this.calendarSettings = {
          accounts: {},
          activeCalendarIds: [],
          lastSync: new Date().toISOString()
        };
      }
      
    } catch (error) {
      console.error('📅 Error loading calendar settings', error);
      // Fallback to empty structure
      this.calendarSettings = {
        accounts: {},
        activeCalendarIds: [],
        lastSync: new Date().toISOString()
      };
    }
  }

  /**
   * Load real calendar data from Google API
   */
  async loadRealCalendarData() {
    console.log('📅 Loading real calendar data from Google API');
    
    try {
      // Get token accounts
      const jwtAuth = window.parent?.jwtAuth || window.jwtAuth;
      if (!jwtAuth || !jwtAuth.isServiceReady()) {
        console.warn('📅 JWT Auth not ready, cannot load calendar accounts');
        return;
      }
      
      const accountsResult = await jwtAuth.listTokenAccounts();
      console.log('📅 Token accounts result:', accountsResult);
      
      // Extract array from result object
      const accountNames = accountsResult?.accounts || accountsResult;
      
      if (!accountNames || !Array.isArray(accountNames) || accountNames.length === 0) {
        console.warn('📅 No token accounts found');
        return;
      }
      
      // Handle both string array and object array formats
      const accounts = accountNames.map(acc => {
        if (typeof acc === 'string') {
          return acc;
        } else if (acc && acc.account_type) {
          return acc.account_type;
        } else if (acc && acc.accountType) {
          return acc.accountType;
        } else {
          console.warn('📅 Unknown account format:', acc);
          return null;
        }
      }).filter(Boolean);
      
      // Remove duplicate accounts by email - CRITICAL FIX
      const uniqueAccounts = await this.filterUniqueAccounts(accounts, jwtAuth);
      
      console.log('📅 Unique accounts after filtering:', uniqueAccounts);
      
      // Get Google API client
      const googleAPI = window.parent?.dataManager?.calendarService?.googleAPI || 
                        window.dataManager?.calendarService?.googleAPI;
      
      if (!googleAPI) {
        console.error('📅 Google API client not available');
        return;
      }
      
      // Fetch calendars from Google for each account
      for (const accountName of uniqueAccounts) {
        await this.loadCalendarsForAccount(accountName, googleAPI, jwtAuth);
      }
      
      console.log('📅 Finished loading calendar data', {
        accounts: Object.keys(this.calendarSettings.accounts).length,
        totalCalendars: Object.values(this.calendarSettings.accounts).reduce(
          (sum, acc) => sum + Object.keys(acc.calendars || {}).length, 0
        )
      });
      
    } catch (error) {
      console.error('📅 Error loading real calendar data', error);
    }
  }

  /**
   * Filter out duplicate accounts by email address
   * FIXED: Get email from listTokenAccounts result, not getValidToken
   */
  async filterUniqueAccounts(accounts, jwtAuth) {
    const seenEmails = new Set();
    const uniqueAccounts = [];
    
    // Get full account list with emails
    const accountsResult = await jwtAuth.listTokenAccounts();
    const fullAccountList = accountsResult?.accounts || [];
    
    // Create a map of account_type -> email
    const accountEmailMap = {};
    for (const acc of fullAccountList) {
      if (acc.account_type && acc.email) {
        accountEmailMap[acc.account_type] = acc.email;
      }
    }
    
    for (const accountName of accounts) {
      try {
        const email = accountEmailMap[accountName];
        
        if (email && !seenEmails.has(email)) {
          seenEmails.add(email);
          uniqueAccounts.push(accountName);
          console.log(`📅 Keeping account: ${accountName} (${email})`);
        } else if (email) {
          console.log(`📅 Skipping duplicate account: ${accountName} (${email} already seen)`);
        } else {
          console.warn(`📅 Skipping account with no email: ${accountName}`);
        }
      } catch (error) {
        console.error(`📅 Error checking account ${accountName}:`, error);
      }
    }
    
    return uniqueAccounts;
  }

  /**
   * Load calendars for a specific account
   */
  async loadCalendarsForAccount(accountName, googleAPI, jwtAuth) {
    try {
      console.log(`📅 Loading calendars for account: ${accountName}`);
      
      // Get account email from listTokenAccounts (getValidToken doesn't include email)
      const accountsResult = await jwtAuth.listTokenAccounts();
      const accountData = accountsResult?.accounts?.find(acc => acc.account_type === accountName);
      
      const email = accountData?.email || `${accountName}@gmail.com`;
      const displayName = accountData?.display_name || this.formatAccountName(accountName);
      
      console.log(`📅 Account info:`, { accountName, email, displayName });
      
      // Fetch calendar list from Google
      const googleCalendars = await googleAPI.getCalendarList();
      console.log(`📅 Retrieved ${googleCalendars.length} calendars from Google for ${accountName}`);
      
      // Initialize account structure if it doesn't exist
      if (!this.calendarSettings.accounts[accountName]) {
        this.calendarSettings.accounts[accountName] = {
          displayName: displayName,
          email: email,
          calendars: {}
        };
      }
      
      const account = this.calendarSettings.accounts[accountName];
      
      // Process each calendar from Google
      for (const googleCal of googleCalendars) {
        const calId = googleCal.id;
        
        // If calendar already exists in settings, update metadata but preserve enabled state
        if (account.calendars[calId]) {
          account.calendars[calId].name = googleCal.summary;
          account.calendars[calId].color = googleCal.backgroundColor || '#4285f4';
          account.calendars[calId].lastSeen = new Date().toISOString();
        } else {
          // New calendar - add it as disabled by default
          account.calendars[calId] = {
            id: calId,
            name: googleCal.summary,
            color: googleCal.backgroundColor || '#4285f4',
            enabled: false,  // New calendars start disabled
            lastSeen: new Date().toISOString()
          };
          console.log(`📅 Added new calendar: ${googleCal.summary} (disabled by default)`);
        }
      }
      
    } catch (error) {
      console.error(`📅 Error loading calendars for account ${accountName}`, error);
    }
  }

  /**
   * Format account name for display
   */
  formatAccountName(accountName) {
    return accountName.charAt(0).toUpperCase() + accountName.slice(1);
  }

  /**
   * Save calendar settings to both localStorage and database
   */
  async saveCalendarSettings() {
    console.log('📅 Saving calendar settings to localStorage and database');
    
    try {
      this.calendarSettings.lastSync = new Date().toISOString();
      
      // 1. Save to localStorage (immediate)
      const localStorage = window.parent?.localStorage || window.localStorage;
      localStorage.setItem('dashie_calendar_settings', JSON.stringify(this.calendarSettings));
      console.log('📅 ✅ Saved to localStorage');
      
      // 2. Save to database (persistent, cross-device)
      const settingsInstance = window.parent?.settingsInstance;
      if (settingsInstance && typeof settingsInstance.handleSettingChange === 'function') {
        await settingsInstance.handleSettingChange('calendar', this.calendarSettings);
        console.log('📅 ✅ Saved to database');
      } else {
        console.warn('📅 Settings instance not available, only saved to localStorage');
      }
      
      this.hasUnsavedChanges = false;
      
    } catch (error) {
      console.error('📅 Error saving calendar settings', error);
    }
  }

  /**
   * Setup event listeners for calendar items
   */
  setupEventListeners() {
    const calendarItems = this.parentOverlay.querySelectorAll('.calendar-item');
    
    calendarItems.forEach(item => {
      item.replaceWith(item.cloneNode(true));
    });
    
    const freshItems = this.parentOverlay.querySelectorAll('.calendar-item');
    
    freshItems.forEach(item => {
      item.addEventListener('click', (e) => {
        this.toggleCalendar(item);
      });
      
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
   * CRITICAL FIX: Removed auto-save to prevent database egress spike!
   */
  toggleCalendar(calendarItem) {
    const calendarId = calendarItem.dataset.calendarId;
    const accountType = calendarItem.dataset.account;
    
    if (!calendarId || !accountType) {
      console.warn('📅 Calendar item missing data attributes');
      return;
    }
    
    const calendar = this.calendarSettings.accounts[accountType]?.calendars[calendarId];
    if (!calendar) {
      console.warn('📅 Calendar not found in settings');
      return;
    }
    
    // Toggle enabled state
    calendar.enabled = !calendar.enabled;
    
    // Update UI
    if (calendar.enabled) {
      calendarItem.classList.add('enabled');
    } else {
      calendarItem.classList.remove('enabled');
    }
    
    // Update activeCalendarIds array
    if (calendar.enabled) {
      if (!this.calendarSettings.activeCalendarIds.includes(calendarId)) {
        this.calendarSettings.activeCalendarIds.push(calendarId);
      }
    } else {
      const index = this.calendarSettings.activeCalendarIds.indexOf(calendarId);
      if (index > -1) {
        this.calendarSettings.activeCalendarIds.splice(index, 1);
      }
    }
    
    console.log(`📅 Calendar ${calendar.name} ${calendar.enabled ? 'enabled' : 'disabled'}`);
    
    // CRITICAL FIX: Only save to localStorage (fast), mark as needing save
    // Database save will happen when user navigates away or explicitly saves
    const localStorage = window.parent?.localStorage || window.localStorage;
    localStorage.setItem('dashie_calendar_settings', JSON.stringify(this.calendarSettings));
    this.hasUnsavedChanges = true;
    
    // Log current state
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
    
    container.innerHTML = '';
    
    const accountNames = Object.keys(this.calendarSettings.accounts);
    
    if (accountNames.length === 0) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">No calendar accounts found. Please authenticate with Google.</div>';
      return;
    }
    
    accountNames.forEach(accountType => {
      const account = this.calendarSettings.accounts[accountType];
      const section = this.createAccountSection(accountType, account);
      container.appendChild(section);
    });
    
    console.log('📅 Calendar list updated');
  }

  /**
   * Create an account section with calendars
   */
  createAccountSection(accountType, account) {
    const section = document.createElement('div');
    section.className = 'settings-section calendar-account-section';
    section.dataset.account = accountType;
    
    const header = document.createElement('div');
    header.className = 'settings-section-header calendar-account-header';
    header.textContent = `${account.displayName}: ${account.email}`;
    section.appendChild(header);
    
    const calendarIds = Object.keys(account.calendars || {});
    calendarIds.forEach(calId => {
      const calendar = account.calendars[calId];
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
    
    const colorDot = document.createElement('span');
    colorDot.className = 'calendar-color-dot';
    colorDot.style.backgroundColor = calendar.color;
    
    const label = document.createElement('span');
    label.className = 'cell-label';
    label.textContent = calendar.name;
    
    const checkmark = document.createElement('span');
    checkmark.className = 'cell-checkmark';
    checkmark.textContent = '✓';
    
    item.appendChild(colorDot);
    item.appendChild(label);
    item.appendChild(checkmark);
    
    return item;
  }

  /**
   * Log current calendar state (for debugging)
   */
  logCalendarState() {
    const enabledCalendars = [];
    
    Object.keys(this.calendarSettings.accounts).forEach(accountType => {
      Object.values(this.calendarSettings.accounts[accountType].calendars || {}).forEach(calendar => {
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
    console.log('📅 Active calendar IDs:', this.calendarSettings.activeCalendarIds);
  }

  /**
   * Handle clearing all calendar data
   */
  async handleClearCalendarData() {
    const confirmed = confirm('⚠️ This will clear ALL calendar settings and require you to reconfigure your calendars.\n\nAre you sure?');
    
    if (!confirmed) {
      console.log('📅 Clear cancelled by user');
      return;
    }
    
    console.log('📅 Clearing all calendar data...');
    
    try {
      // Clear localStorage
      const localStorage = window.parent?.localStorage || window.localStorage;
      localStorage.removeItem('dashie_calendar_settings');
      console.log('📅 ✅ Cleared localStorage');
      
      // Clear database
      const emptySettings = {
        accounts: {},
        activeCalendarIds: [],
        lastSync: new Date().toISOString()
      };
      
      const settingsInstance = window.parent?.settingsInstance;
      if (settingsInstance && typeof settingsInstance.handleSettingChange === 'function') {
        await settingsInstance.handleSettingChange('calendar', emptySettings);
        console.log('📅 ✅ Cleared database');
      }
      
      // Reset local state
      this.calendarSettings = emptySettings;
      this.hasUnsavedChanges = false;
      
      // Refresh UI
      this.updateCalendarList();
      
      console.log('📅 ✅ Calendar data cleared successfully');
      alert('✅ Calendar data cleared! Reload the page to fetch fresh calendars.');
      
    } catch (error) {
      console.error('📅 Error clearing calendar data', error);
      alert('❌ Error clearing calendar data. Check console for details.');
    }
  }

  /**
   * Cleanup when leaving calendar settings - save any pending changes
   */
  async destroy() {
    console.log('📅 CalendarSettingsManager destroyed');
    
    // Save any pending changes to database when leaving settings
    if (this.hasUnsavedChanges) {
      console.log('📅 Saving pending changes before destroy...');
      await this.saveCalendarSettings();
    }
  }
}