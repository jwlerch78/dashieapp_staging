// js/utils/calendar-sync-helper.js
// CHANGE SUMMARY: NEW FILE - Utility to sync calendar metadata for new accounts during startup

import { createLogger } from './logger.js';

const logger = createLogger('CalendarSync');

/**
 * Sync calendar metadata for newly added accounts
 * This function is called during startup after new OAuth tokens are processed
 * It fetches calendar lists from Google and initializes calendar settings
 * @returns {Promise<boolean>} True if sync successful
 */
export async function syncCalendarMetadataForNewAccounts() {
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
    const accountNames = accountsResult?.accounts || accountsResult || [];
    
    if (accountNames.length === 0) {
      logger.debug('No accounts found, skipping calendar sync');
      return false;
    }

    logger.debug('Found accounts to sync', { count: accountNames.length });

    // Load existing calendar settings
    const localStorage = window.parent?.localStorage || window.localStorage;
    let calendarSettings = null;
    
    try {
      const stored = localStorage.getItem('dashie_calendar_settings');
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
    
    for (const accountName of accountNames) {
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

        // Get account email (from first calendar or token info)
        const accountEmail = calendars.find(cal => cal.primary)?.id || calendars[0]?.id;
        
        // Initialize account structure
        if (!calendarSettings.accounts[accountName]) {
          calendarSettings.accounts[accountName] = {
            email: accountEmail,
            displayName: `Account (${accountName})`, // Will be updated with real name later
            calendars: {},
            lastSync: new Date().toISOString()
          };
        }

        const account = calendarSettings.accounts[accountName];
        account.email = accountEmail;

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

    // Save updated settings if we added any new accounts
    if (newAccountsAdded > 0) {
      calendarSettings.lastSync = new Date().toISOString();
      
      // Save to localStorage
      localStorage.setItem('dashie_calendar_settings', JSON.stringify(calendarSettings));
      logger.success(`Saved calendar settings to localStorage (${newAccountsAdded} new accounts)`);

      // Save to database via settings controller (if available)
      try {
        const settingsController = window.parent?.settingsController || window.settingsController;
        if (settingsController && typeof settingsController.handleSettingChange === 'function') {
          await settingsController.handleSettingChange('calendar', calendarSettings);
          logger.success('Saved calendar settings to database');
        } else {
          logger.debug('Settings controller not available during startup - database save will happen on next settings change');
        }
      } catch (error) {
        logger.debug('Settings controller not ready yet - database save will happen on next settings change', error);
        // This is expected during startup - localStorage save is sufficient
      }

      // Trigger calendar data refresh
      try {
        const dataManager = window.parent?.dataManager || window.dataManager;
        if (dataManager && typeof dataManager.refreshCalendarData === 'function') {
          await dataManager.refreshCalendarData(true);
          logger.success('Triggered calendar data refresh');
        }
      } catch (error) {
        logger.warn('Failed to trigger calendar data refresh', error);
      }

      return true;
    } else {
      logger.debug('No new accounts needed syncing');
      return false;
    }

  } catch (error) {
    logger.error('Calendar metadata sync failed', error);
    return false;
  }
}
