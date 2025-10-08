// widgets/dcal/dcal-settings/dcal-settings-manager.js
// CHANGE SUMMARY: Added calendar count to account headers, sort calendars with enabled first, dynamic count updates - preserving all existing functionality

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
    // Check if we're on the add-calendar screen - add account type listeners
    const addGoogleBtn = this.parentOverlay.querySelector('#add-google-account-btn');
    if (addGoogleBtn) {
      // D-pad nav will trigger click() on Enter, so just add a simple click listener
      addGoogleBtn.addEventListener('click', () => {
        this.handleAddGoogleAccount();
      });
      
      console.log('📅 Add Google Account button listener attached');
    }

    // Setup remove account modal listeners (can be done early)
    const cancelRemoveBtn = this.parentOverlay.querySelector('#cancel-remove-account');
    const confirmRemoveBtn = this.parentOverlay.querySelector('#confirm-remove-account');

    if (cancelRemoveBtn) {
      cancelRemoveBtn.addEventListener('click', () => this.hideRemoveAccountModal());
    }

    if (confirmRemoveBtn) {
      confirmRemoveBtn.addEventListener('click', () => this.handleRemoveAccountConfirm());
    }
          
    // Load settings (from localStorage first, then database)
    await this.loadCalendarSettings();
    
    // Load real calendar data from Google API
    await this.loadRealCalendarData();
    
    // Update the UI
    this.updateCalendarList();
    this.setupEventListeners();
    
    // NOW populate remove accounts list (AFTER data is loaded)
    if (this.parentOverlay.querySelector('#remove-calendar-accounts-container')) {
      this.updateRemoveAccountsList();
    }
    
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

 // CHANGE SUMMARY: Fixed calendar loading to pass accountName to GoogleAPIClient for multi-account support

/**
 * Load calendars for a specific account
 * FIXED: Now passes accountName to getCalendarList() to fetch calendars from correct account
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
    
    // FIXED: Pass accountName to getCalendarList() so it uses the correct account's token
    const googleCalendars = await googleAPI.getCalendarList(accountName);
    console.log(`📅 Retrieved ${googleCalendars.length} calendars from Google for ${accountName} (${email})`);
    
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

 // CHANGE SUMMARY: Complete saveCalendarSettings with calendarAccountMap generation and calendar data refresh

/**
 * Save calendar settings to both localStorage and database
 * COMPLETE VERSION: Builds calendarAccountMap, saves settings, and triggers calendar refresh
 */
async saveCalendarSettings() {
  console.log('📅 Saving calendar settings to localStorage and database');
  
  try {
    this.calendarSettings.lastSync = new Date().toISOString();
    
    // STEP 1: Build calendar-to-account mapping for event loading
    // This tells GoogleAPIClient which account token to use for each calendar
    const calendarAccountMap = {};
    
    for (const [accountType, account] of Object.entries(this.calendarSettings.accounts)) {
      for (const [calendarId, calendar] of Object.entries(account.calendars || {})) {
        if (calendar.enabled) {
          calendarAccountMap[calendarId] = accountType;
        }
      }
    }
    
    // Store the mapping in settings
    this.calendarSettings.calendarAccountMap = calendarAccountMap;
    
    console.log('📅 Built calendar-to-account mapping:', calendarAccountMap);
    
    // STEP 2: Save to localStorage (immediate)
    const localStorage = window.parent?.localStorage || window.localStorage;
    localStorage.setItem('dashie_calendar_settings', JSON.stringify(this.calendarSettings));
    console.log('📅 ✅ Saved to localStorage');
    
    // STEP 3: Save to database (persistent, cross-device)
    const settingsInstance = window.parent?.settingsInstance;
    if (settingsInstance && typeof settingsInstance.handleSettingChange === 'function') {
      await settingsInstance.handleSettingChange('calendar', this.calendarSettings);
      console.log('📅 ✅ Saved to database');
    } else {
      console.warn('📅 Settings instance not available, only saved to localStorage');
    }
    
    // STEP 4: Trigger calendar data refresh to load events with new selection
    console.log('📅 🔄 Triggering calendar data refresh with new selection...');
    const dataManager = window.parent?.dataManager || window.dataManager;

    if (dataManager && typeof dataManager.refreshCalendarData === 'function') {
      try {
        // CRITICAL FIX: Use dataManager.refreshCalendarData(true) to force bypass cache
        await dataManager.refreshCalendarData(true);
        console.log('📅 ✅ Calendar data refreshed - widgets will update automatically');
      } catch (error) {
        console.error('📅 ❌ Failed to refresh calendar data:', error);
      }
    } else {
      console.warn('📅 DataManager not available - calendar widgets may not update until next refresh');
    }
    
    // Reset unsaved changes flag
    this.hasUnsavedChanges = false;
    
  } catch (error) {
    console.error('📅 Error saving calendar settings', error);
    throw error;
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
    
    // Update the calendar count in the header
    this.updateAccountHeaderCount(accountType);
    
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
    
    // Reverse the order so primary account appears first
    const reversedAccountNames = [...accountNames].reverse();

    reversedAccountNames.forEach(accountType => {
      const account = this.calendarSettings.accounts[accountType];
      const section = this.createAccountSection(accountType, account);
      container.appendChild(section);
    });
    
    console.log('📅 Calendar list updated');
  }

  /**
   * Create an account section with calendars
   * UPDATED: Added calendar count and sorting (enabled calendars first)
   */
  createAccountSection(accountType, account) {
    const section = document.createElement('div');
    section.className = 'settings-section calendar-account-section';
    section.dataset.account = accountType;
    
    // Get all calendars and sort them (enabled first)
    const calendars = Object.values(account.calendars || {});
    const enabledCount = calendars.filter(cal => cal.enabled).length;
    const totalCount = calendars.length;
    const hiddenCount = totalCount - enabledCount;
    

   // Sort: enabled first, then primary within each group, then by name
    calendars.sort((a, b) => {
      // First by enabled status
      if (a.enabled && !b.enabled) return -1;
      if (!a.enabled && b.enabled) return 1;
      
      // Within same enabled status, primary calendars first
      const aIsPrimary = a.id === account.email;
      const bIsPrimary = b.id === account.email;
      
      if (aIsPrimary && !bIsPrimary) return -1;
      if (!aIsPrimary && bIsPrimary) return 1;
      
      // Finally by name
      return a.name.localeCompare(b.name);
    });
    
    // Create header with calendar count
    const header = document.createElement('div');
    header.className = 'settings-section-header calendar-account-header';
    
    const accountNameSpan = document.createElement('span');
    accountNameSpan.textContent = `${account.displayName}: ${account.email}`;
    
    const countSpan = document.createElement('span');
    countSpan.className = 'calendar-count';

    // Set display text based on counts
    if (enabledCount === 0) {
      countSpan.textContent = `- ${totalCount} calendar${totalCount !== 1 ? 's' : ''} hidden`;
    } else if (hiddenCount === 0) {
      countSpan.textContent = `- ${enabledCount} active calendar${enabledCount !== 1 ? 's' : ''}`;
    } else {
      countSpan.textContent = `- ${enabledCount} active, ${hiddenCount} hidden`;
    }

    header.appendChild(accountNameSpan);
    header.appendChild(countSpan);
    section.appendChild(header);
    
    // Add sorted calendar items
    calendars.forEach(calendar => {
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
   * Update the calendar count in an account header
   * NEW: Updates count dynamically when calendars are toggled
   */
  updateAccountHeaderCount(accountType) {
    const section = this.parentOverlay.querySelector(`[data-account="${accountType}"]`);
    if (!section) return;
    
    const header = section.querySelector('.calendar-account-header');
    const countSpan = header?.querySelector('.calendar-count');
    if (!countSpan) return;
    
    const account = this.calendarSettings.accounts[accountType];
    const calendars = Object.values(account.calendars || {});
    const enabledCount = calendars.filter(cal => cal.enabled).length;
    const totalCount = calendars.length;
    const hiddenCount = totalCount - enabledCount;

    // Set display text based on counts
    if (enabledCount === 0) {
      countSpan.textContent = `- ${totalCount} calendar${totalCount !== 1 ? 's' : ''} hidden`;
    } else if (hiddenCount === 0) {
      countSpan.textContent = `- ${enabledCount} active calendar${enabledCount !== 1 ? 's' : ''}`;
    } else {
      countSpan.textContent = `- ${enabledCount} active, ${hiddenCount} hidden`;
    }
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
 * Handle adding a Google account
 * Auto-generates account names like 'account2', 'account3', etc.
 */
async handleAddGoogleAccount() {
  console.log('📅 Starting Google account addition flow');
  
  try {
    // Check if account manager is available
    if (!window.accountManager || !window.accountManager.isServiceReady()) {
      console.error('📅 Account manager not available');
      alert('Account manager not ready. Please try again in a moment.');
      return;
    }
    
    // Auto-generate account name
    const accountName = await this.generateAccountName();
    
    if (!accountName) {
      console.log('📅 Account addition cancelled - could not generate name');
      return;
    }
    
    console.log(`📅 Generated account name: ${accountName}`);
    this.showAddAccountProgress('Connecting to Google...');
    
    // Trigger OAuth flow via account manager
    const result = await window.accountManager.addAccount('google', accountName);
    
    this.hideAddAccountProgress();
    
    if (result.success) {
      console.log('📅 ✅ Account added successfully', result);
      alert(`✅ Account added successfully!\n\nAccount: ${result.displayName || accountName}\nEmail: ${result.email || 'Unknown'}`);
      
      // Reload calendar data to include new account
      await this.loadRealCalendarData();
      this.updateCalendarList();
      
      // Navigate back to main calendar screen
      if (this.parentNavigation && typeof this.parentNavigation.navigateBack === 'function') {
        this.parentNavigation.navigateBack();
      }
    } else {
      console.error('📅 ❌ Account addition failed', result);
      alert(`Failed to add account: ${result.error || 'Unknown error'}`);
    }
    
  } catch (error) {
    this.hideAddAccountProgress();
    console.error('📅 ❌ Error during account addition', error);
    alert(`Error adding account: ${error.message}`);
  }
}

/**
 * Generate a unique account name automatically
 * Returns names like: personal, account2, account3, etc.
 */
async generateAccountName() {
  const existingAccounts = await window.accountManager.listAccounts();
  const googleAccounts = existingAccounts.filter(acc => acc.provider === 'google');
  
  // If no accounts, use 'personal'
  if (googleAccounts.length === 0) {
    return 'personal';
  }
  
  // Find next available number
  let counter = 2;
  while (counter < 100) { // Safety limit
    const candidateName = `account${counter}`;
    const exists = googleAccounts.some(acc => acc.account_type === candidateName);
    
    if (!exists) {
      return candidateName;
    }
    
    counter++;
  }
  
  // Fallback to timestamp-based name
  return `account_${Date.now()}`;
}
  
/**
 * Update the remove accounts list
 * Creates a simple list of accounts with click handlers
 */
updateRemoveAccountsList() {
  const container = this.parentOverlay.querySelector('#remove-calendar-accounts-container');
  if (!container) {
    console.warn('📅 Remove accounts container not found');
    return;
  }
  
  container.innerHTML = '';
  
  const accountNames = Object.keys(this.calendarSettings.accounts);
  
  if (accountNames.length === 0) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">No calendar accounts found.<br/>Please authenticate with Google.</div>';
    return;
  }
  
  // Reverse order so primary account appears first
  const reversedAccountNames = [...accountNames].reverse();
  
  reversedAccountNames.forEach(accountType => {
    const account = this.calendarSettings.accounts[accountType];
    const accountItem = this.createRemovableAccountItem(accountType, account);
    container.appendChild(accountItem);
  });
  
  console.log('📅 Remove accounts list updated');
}

/**
 * Create a clickable account item for removal
 * Primary account (first account) is disabled and grayed out
 */
createRemovableAccountItem(accountType, account) {
  const item = document.createElement('div');
  
  // Check if this is the primary account (first one added)
  const accountNames = Object.keys(this.calendarSettings.accounts);
  const isPrimary = accountNames.length > 0 && accountNames[0] === accountType;
  
  if (isPrimary) {
    // Primary account - disabled
    item.className = 'settings-cell';
    item.style.opacity = '0.4';
    item.style.cursor = 'not-allowed';
  } else {
    // Secondary account - selectable
    item.className = 'settings-cell selectable';
    item.setAttribute('tabindex', '0');
  }
  
  const label = document.createElement('span');
  label.className = 'cell-label';
  label.textContent = `${account.displayName} (${account.email})`;
  
  if (isPrimary) {
    label.textContent += ' — Primary Account';
  }
  
  const chevron = document.createElement('span');
  chevron.className = 'cell-chevron';
  chevron.textContent = isPrimary ? '' : '›';
  
  item.appendChild(label);
  item.appendChild(chevron);
  
  // Only add click handlers for non-primary accounts
  if (!isPrimary) {
    item.addEventListener('click', () => {
      this.showRemoveAccountModal(accountType, account);
    });
    
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.showRemoveAccountModal(accountType, account);
      }
    });
  }
  
  return item;
}


/**
 * Show remove account confirmation modal
 */
showRemoveAccountModal(accountType, account) {
  const modal = document.getElementById('remove-account-modal');
  const accountNameEl = document.getElementById('remove-account-name');
  
  if (!modal || !accountNameEl) {
    console.error('📅 Remove account modal elements not found');
    return;
  }
  
  accountNameEl.textContent = `${account.displayName} (${account.email})`;
  modal.style.display = 'flex';
  
  // Store for confirmation handler
  this.pendingRemoveAccount = { accountType, account };
  
  console.log('📅 Showing remove account modal', { accountType });
}

/**
 * Hide remove account modal
 */
hideRemoveAccountModal() {
  const modal = document.getElementById('remove-account-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  this.pendingRemoveAccount = null;
  
  console.log('📅 Remove account modal closed');
}

/**
 * Handle account removal confirmation
 */
async handleRemoveAccountConfirm() {
  if (!this.pendingRemoveAccount) {
    console.warn('📅 No pending account removal');
    return;
  }
  
  const { accountType, account } = this.pendingRemoveAccount;
  
  try {
    console.log(`📅 Removing account: ${accountType}`);
    
    // 1. Remove tokens via JWT service
    const jwtAuth = window.parent?.jwtAuth || window.jwtAuth;
    if (jwtAuth && jwtAuth.isServiceReady()) {
      try {
        await jwtAuth.removeTokenAccount('google', accountType);
        console.log(`📅 ✅ Removed tokens for account: ${accountType}`);
      } catch (error) {
        console.error(`📅 ❌ Failed to remove tokens for ${accountType}:`, error);
        // Continue with removal even if token deletion fails
      }
    } else {
      console.warn('📅 JWT Auth not available, skipping token removal');
    }
    
    // 2. Remove from calendar settings
    const calendarsToRemove = Object.keys(account.calendars || {});
    delete this.calendarSettings.accounts[accountType];
    
    // 3. Remove any active calendars from this account
    this.calendarSettings.activeCalendarIds = this.calendarSettings.activeCalendarIds.filter(
      id => !calendarsToRemove.includes(id)
    );
    
    // 4. Update calendar account map
    if (this.calendarSettings.calendarAccountMap) {
      for (const calId of calendarsToRemove) {
        delete this.calendarSettings.calendarAccountMap[calId];
      }
    }
    
    // 5. Save settings
    await this.saveCalendarSettings();
    
    // 6. Refresh UI on remove-calendar screen
    this.updateRemoveAccountsList();
    
    // 7. Refresh navigation after list update
    if (this.parentNavigation && typeof this.parentNavigation.updateFocusableElements === 'function') {
      this.parentNavigation.updateFocusableElements();
      this.parentNavigation.updateFocus();
    }
    
    console.log(`📅 ✅ Account removed successfully: ${accountType}`);
    
  } catch (error) {
    console.error(`📅 ❌ Failed to remove account: ${accountType}`, error);
    alert(`Failed to remove account: ${error.message}`);
  } finally {
    this.hideRemoveAccountModal();
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