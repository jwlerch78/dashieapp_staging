// js/utils/calendar-sync-helper.js
// CHANGE SUMMARY: NEW FILE - Utility to sync calendar metadata for new accounts during startup

import { createLogger } from './logger.js';

const logger = createLogger('CalendarSync');

/**
 * Sync calendar metadata for all accounts
 * Fetches calendar lists from Google and initializes calendar settings
 * Always saves to localStorage and database at the end
 * @returns {Promise<boolean>} True if sync successful
 */
export async function syncCalendarMetadata() {
  logger.info('Starting calendar metadata sync for new accounts');
  
  try {
    // Get JWT service
    const jwtAuth = window.jwtAuth;
    if (!jwtAuth || !jwtAuth.isServiceReady()) {
      logger.warn('JWT service not ready, skipping calendar sync');
      return false;
    }

    // Get list of token accounts
    const accountsResult = await jwtAuth.listTokenAccounts();
    const accountObjects = accountsResult?.accounts || accountsResult || [];
    
    if (accountObjects.length === 0) {
      logger.debug('No accounts found, skipping calendar sync');
      return false;
    }

    // Extract account_type strings from account objects
    const accountNames = accountObjects.map(acc => {
      if (typeof acc === 'string') {
        return acc;
      } else if (acc && acc.account_type) {
        return acc.account_type;
      } else {
        logger.warn('Unknown account format, skipping', acc);
        return null;
      }
    }).filter(Boolean);

    logger.debug('Found accounts to sync', { 
      count: accountNames.length,
      accounts: accountNames 
    });

    // Load existing calendar settings
    const localStorage = window.parent?.localStorage || window.localStorage;
    let calendarSettings = null;
    
    try {
      const stored = localStorage.getItem('dashie-calendar-settings');
      if (stored) {
        calendarSettings = JSON.parse(stored);
      }
    } catch (error) {
      logger.warn('Failed to load existing calendar settings', error);
    }

    // Initialize empty structure if needed
    if (!calendarSettings) {
      calendarSettings = {
        accounts: {},
        activeCalendarIds: [],
        calendarAccountMap: {},
        lastSync: new Date().toISOString()
      };
    }

    // Get Google API client
    const googleAPI = window.parent?.dataManager?.calendarService?.googleAPI || 
                      window.dataManager?.calendarService?.googleAPI;
    
    if (!googleAPI) {
      logger.warn('Google API not available, skipping calendar sync');
      return false;
    }

    // Process each account
    let newAccountsAdded = 0;
    
    for (let i = 0; i < accountNames.length; i++) {
      const accountName = accountNames[i];
      const accountObj = accountObjects[i]; // Get corresponding account object
      
      // Skip if account already has calendar data
      if (calendarSettings.accounts[accountName]?.calendars) {
        logger.debug(`Account ${accountName} already has calendar data, skipping`);
        continue;
      }

      logger.info(`Syncing calendars for new account: ${accountName}`);

      try {
        // Fetch calendar list from Google
        const calendars = await googleAPI.getCalendarList(accountName);
        
        if (!calendars || calendars.length === 0) {
          logger.warn(`No calendars found for account ${accountName}`);
          continue;
        }

        // CRITICAL FIX: Get account email from the account object FIRST (most reliable)
        // Fall back to primary calendar or first calendar if not available
        const accountEmail = accountObj?.email || 
                            calendars.find(cal => cal.primary)?.id || 
                            calendars[0]?.id;
        
        // Get display name from account object
        const displayName = accountObj?.display_name || `Account (${accountName})`;
        
        logger.debug('Account details', { 
          accountName, 
          email: accountEmail, 
          displayName 
        });
        
        // Initialize account structure with data from account object
        if (!calendarSettings.accounts[accountName]) {
          calendarSettings.accounts[accountName] = {
            email: accountEmail,
            displayName: displayName,
            calendars: {},
            lastSync: new Date().toISOString()
          };
        } else {
          // Update email and displayName if account already exists
          calendarSettings.accounts[accountName].email = accountEmail;
          calendarSettings.accounts[accountName].displayName = displayName;
        }

        const account = calendarSettings.accounts[accountName];

        // Add all calendars (disabled by default)
        for (const googleCal of calendars) {
          const calId = googleCal.id;
          
          account.calendars[calId] = {
            id: calId,
            name: googleCal.summary,
            color: googleCal.backgroundColor || '#4285f4',
            enabled: false,
            lastSeen: new Date().toISOString()
          };
        }

        // AUTO-ENABLE PRIMARY CALENDAR for new account
        const primaryCalendar = account.calendars[accountEmail];
        
        if (primaryCalendar) {
          logger.info(`Auto-enabling primary calendar for ${accountName}: ${primaryCalendar.name}`);
          
          primaryCalendar.enabled = true;
          
          // Add to activeCalendarIds
          if (!calendarSettings.activeCalendarIds.includes(accountEmail)) {
            calendarSettings.activeCalendarIds.push(accountEmail);
          }
          
          // Update calendar account map
          if (!calendarSettings.calendarAccountMap) {
            calendarSettings.calendarAccountMap = {};
          }
          calendarSettings.calendarAccountMap[accountEmail] = accountName;
          
          logger.success(`Primary calendar enabled: ${primaryCalendar.name}`);
        } else {
          logger.warn(`Primary calendar not found for ${accountName}`);
        }

        newAccountsAdded++;
        logger.success(`Synced ${calendars.length} calendars for account ${accountName}`);

      } catch (error) {
        logger.error(`Failed to sync calendars for account ${accountName}`, error);
        // Continue with other accounts
      }
    }

    // Always save settings at the end (even if no new accounts were added)
    calendarSettings.lastSync = new Date().toISOString();
    
    // Ensure calendarAccountMap exists and is up to date
    if (!calendarSettings.calendarAccountMap) {
      calendarSettings.calendarAccountMap = {};
    }
    
    // Rebuild activeCalendarIds to ensure consistency
    calendarSettings.activeCalendarIds = [];
    for (const [accountType, account] of Object.entries(calendarSettings.accounts)) {
      for (const [calendarId, calendar] of Object.entries(account.calendars || {})) {
        if (calendar.enabled) {
          calendarSettings.activeCalendarIds.push(calendarId);
          calendarSettings.calendarAccountMap[calendarId] = accountType;
        }
      }
    }
    
    logger.debug('Updated calendar mappings', {
      activeCalendars: calendarSettings.activeCalendarIds.length,
      mappedCalendars: Object.keys(calendarSettings.calendarAccountMap).length
    });
    
    // Save to localStorage
    localStorage.setItem('dashie-calendar-settings', JSON.stringify(calendarSettings));
    logger.success(`Saved calendar settings to localStorage (${newAccountsAdded} new accounts)`);

    // Save to database via settings instance (if available)
    try {
      const settingsInstance = window.parent?.settingsInstance || window.settingsInstance;
      if (settingsInstance && typeof settingsInstance.handleSettingChange === 'function') {
        await settingsInstance.handleSettingChange('calendar', calendarSettings);
        logger.success('Saved calendar settings to database');
      } else {
        logger.debug('Settings instance not available during startup - database save will happen on next settings change');
      }
    } catch (error) {
      logger.debug('Settings instance not ready yet - database save will happen on next settings change', error);
      // This is expected during startup - localStorage save is sufficient
    }

    // Trigger calendar data refresh if new accounts were added
    if (newAccountsAdded > 0) {
      try {
        const dataManager = window.parent?.dataManager || window.dataManager;
        if (dataManager && typeof dataManager.refreshCalendarData === 'function') {
          await dataManager.refreshCalendarData(true);
          logger.success('Triggered calendar data refresh');
        }
      } catch (error) {
        logger.warn('Failed to trigger calendar data refresh', error);
      }
    }

    return true;

  } catch (error) {
    logger.error('Calendar metadata sync failed', error);
    return false;
  }
}
