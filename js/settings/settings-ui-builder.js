// js/settings/settings-ui-builder.js
// v1.2 - 10/11/25 11:58pm - Added telemetry toggle initialization from settings
// v1.1 - 10/9/25 - Added zip code population and location display functionality
// CHANGE SUMMARY: Added telemetry toggle state sync from system.telemetryEnabled setting

import { getPlatformDetector } from '../utils/platform-detector.js';
import * as templates from './settings-templates.js';

/**
 * Build the complete settings UI
 */
export function buildSettingsUI(isMobile = false) {
  return buildMobileSettingsUI();
}

/**
 * Assemble the mobile settings UI from template modules
 */
function buildMobileSettingsUI() {
  return `
    <div class="settings-modal mobile-mode">
      ${templates.navBar}
      
      <div class="settings-content">
        <div class="settings-screens">
          ${templates.rootScreen}
          ${templates.displayScreens}
          ${templates.calendarScreens}
          ${templates.familyScreen}
          ${templates.systemScreens}
        </div>
      </div>
    </div>
  `;
}

/**
 * Helper: Format time for display (24h to 12h)
 */
function formatTime(time24) {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Populate form fields with current settings values
 */
export function populateFormFields(overlay, settings) {
  console.log('⚙️ Populating form fields with settings:', settings);
  
  // Family name
  const mobileFamilyName = overlay.querySelector('#mobile-family-name');
  if (mobileFamilyName) {
    mobileFamilyName.value = settings.family?.familyName || 'Dashie';
  }
  
  // Family zip code
  const mobileFamilyZipcode = overlay.querySelector('#mobile-family-zipcode');
  if (mobileFamilyZipcode) {
    const zipCode = settings.family?.zipCode || '';
    mobileFamilyZipcode.value = zipCode;
    
    // Always update location display (will show nothing if empty)
    // This ensures it shows even if zip was auto-detected before modal opened
    updateZipCodeLocationDisplay(overlay, zipCode);
  }
  
  // Theme value display
  const mobileThemeValue = overlay.querySelector('#mobile-theme-value');
  if (mobileThemeValue && settings.display?.theme) {
    mobileThemeValue.textContent = settings.display.theme === 'dark' ? 'Dark' : 'Light';
  }
  
  // Theme selection cells
  const themeSelectionCells = overlay.querySelectorAll('.settings-cell[data-setting="display.theme"]');
  themeSelectionCells.forEach(cell => {
    if (cell.dataset.value === settings.display?.theme) {
      cell.classList.add('selected');
    } else {
      cell.classList.remove('selected');
    }
  });

 // Sleep timer enabled toggle
  const sleepTimerToggle = overlay.querySelector('#sleep-timer-enabled');
  if (sleepTimerToggle) {
    const enabled = settings.display?.sleepTimerEnabled !== false; // Default to true
    sleepTimerToggle.checked = enabled;
    updateSleepTimerStates(overlay, enabled);
  }

  // Dynamic greeting enabled toggle
  const dynamicGreetingToggle = overlay.querySelector('#dynamic-greeting-enabled');
  if (dynamicGreetingToggle) {
    const enabled = settings.display?.dynamicGreeting === true; // Default to false
    dynamicGreetingToggle.checked = enabled;
  }

  // Telemetry (crash reporting) enabled toggle
  const telemetryToggle = overlay.querySelector('#enable-crash-reporting');
  if (telemetryToggle) {
    // Check both settings and localStorage to ensure consistency
    const settingsValue = settings.system?.telemetryEnabled;
    const localStorageValue = localStorage.getItem('dashie_telemetry_enabled');
    
    // Determine enabled state (default to true for beta testing)
    let enabled = true; // Default
    
    if (settingsValue !== undefined) {
      enabled = settingsValue;
    } else if (localStorageValue !== null) {
      enabled = localStorageValue === 'true';
    }
    
    telemetryToggle.checked = enabled;
    console.log('⚙️ 📊 Telemetry toggle initialized:', { enabled, settingsValue, localStorageValue });
  }

  
  // Sleep time value display
  const mobileSleepTimeValue = overlay.querySelector('#mobile-sleep-time-value');
  if (mobileSleepTimeValue && settings.display?.sleepTime) {
    mobileSleepTimeValue.textContent = formatTime(settings.display.sleepTime);
  }
  
  // Wake time value display
  const mobileWakeTimeValue = overlay.querySelector('#mobile-wake-time-value');
  if (mobileWakeTimeValue && settings.display?.wakeTime) {
    mobileWakeTimeValue.textContent = formatTime(settings.display.wakeTime);
  }
}


/**
 * Update sleep timer enabled/disabled states
 */
export function updateSleepTimerStates(overlay, enabled) {
  const sleepTimeCell = overlay.querySelector('.sleep-time-cell');
  const wakeTimeCell = overlay.querySelector('.wake-time-cell');
  
  if (enabled) {
    sleepTimeCell?.classList.remove('disabled');
    wakeTimeCell?.classList.remove('disabled');
  } else {
    sleepTimeCell?.classList.add('disabled');
    wakeTimeCell?.classList.add('disabled');
  }
  
  console.log('⚙️ Sleep timer states updated:', enabled ? 'enabled' : 'disabled');
}


/**
 * Populate system status information
 */
export function populateSystemStatus(overlay) {
  const platformDetector = getPlatformDetector();
  
  // Platform Information
  const platformEl = overlay.querySelector('#system-platform-value');
  if (platformEl) {
    platformEl.textContent = platformDetector.mobile ? 
                             'Mobile' : 
                             platformDetector.fireTV ? 'Fire TV' : 'Desktop';
  }
  
  const deviceEl = overlay.querySelector('#system-device-value');
  if (deviceEl) {
    deviceEl.textContent = navigator.userAgent.includes('Firefox') ? 'Firefox' :
                          navigator.userAgent.includes('Chrome') ? 'Chrome' :
                          navigator.userAgent.includes('Safari') ? 'Safari' : 'Unknown';
  }
  
  // Real-Time Sync Status
  const syncDot = overlay.querySelector('#sync-status-dot');
  const syncText = overlay.querySelector('#sync-status-text');
  
  if (syncDot && syncText) {
    // Check if settings real-time subscription is active
    const hasRealTimeSync = window.settingsInstance?.controller?.realtimeSubscription;
    
    // Clear existing classes
    syncDot.className = 'status-dot';
    
    if (hasRealTimeSync) {
      syncDot.classList.add('green');
      syncText.textContent = 'Active';
    } else {
      // Default gray (no class needed, already styled)
      syncText.textContent = 'Not active';
    }
  }
  
  // JWT Token Status - FIXED to use dashie-supabase-jwt
  const jwtDot = overlay.querySelector('#jwt-status-dot');
  const jwtText = overlay.querySelector('#jwt-status-text');
  
  if (jwtDot && jwtText) {
    // Clear existing classes
    jwtDot.className = 'status-dot';
    
    try {
      // Read JWT data from localStorage
      const jwtData = localStorage.getItem('dashie-supabase-jwt');
      
      if (jwtData) {
        const parsed = JSON.parse(jwtData);
        
        if (parsed.expiry) {
          const expiresAt = parsed.expiry; // This is already in milliseconds
          const now = Date.now();
          const timeLeft = expiresAt - now;
          const hoursLeft = timeLeft / (1000 * 60 * 60);
          
          if (hoursLeft > 0) {
            jwtDot.classList.add('green');
            
            // Show in days if > 24 hours
            if (hoursLeft > 24) {
              const daysLeft = hoursLeft / 24;
              jwtText.textContent = `Active (${daysLeft.toFixed(1)} days left)`;
            } else {
              jwtText.textContent = `Active (${hoursLeft.toFixed(1)} hrs left)`;
            }
          } else {
            jwtDot.classList.add('red');
            jwtText.textContent = 'Expired';
          }
        } else {
          jwtDot.classList.add('yellow');
          jwtText.textContent = 'No expiration data';
        }
      } else {
        // No JWT data found
        jwtText.textContent = 'Not available';
      }
    } catch (err) {
      console.error('Error reading JWT expiry:', err);
      jwtDot.classList.add('yellow');
      jwtText.textContent = 'Error';
    }
  }
  
  // Calendar Data - from window.dataManager
  if (window.dataManager) {
    const calendarData = window.dataManager.getCalendarData();
    
    if (calendarData) {
      // Last Refresh Time
      const lastRefreshEl = overlay.querySelector('#calendar-last-refresh');
      if (lastRefreshEl && calendarData.lastUpdated) {
        const lastUpdate = new Date(calendarData.lastUpdated);
        const now = new Date();
        const diffMs = now - lastUpdate;
        const diffMins = Math.floor(diffMs / 60000);
        
        let displayText;
        if (diffMins < 1) {
          displayText = 'Just now';
        } else if (diffMins === 1) {
          displayText = '1 minute ago';
        } else if (diffMins < 60) {
          displayText = `${diffMins} minutes ago`;
        } else {
          const diffHours = Math.floor(diffMins / 60);
          if (diffHours === 1) {
            displayText = '1 hour ago';
          } else {
            displayText = `${diffHours} hours ago`;
          }
        }
        lastRefreshEl.textContent = displayText;
      }
      
      // Calendars Count
      const calendarCountEl = overlay.querySelector('#calendar-count');
      if (calendarCountEl) {
        const count = calendarData.calendars?.length || 0;
        calendarCountEl.textContent = count.toString();
      }
      
      // Events Count
      const eventsCountEl = overlay.querySelector('#events-count');
      if (eventsCountEl) {
        const count = calendarData.events?.length || 0;
        eventsCountEl.textContent = count.toString();
      }
    }
  }
  
  // Dashboard Stats - Uptime
  const uptimeEl = overlay.querySelector('#uptime-value');
  if (uptimeEl) {
    if (window.dashieStartTime) {
      const now = Date.now();
      const uptimeMs = now - window.dashieStartTime;
      const uptimeMins = Math.floor(uptimeMs / 60000);
      
      let displayText;
      if (uptimeMins < 1) {
        displayText = 'Less than 1 minute';
      } else if (uptimeMins === 1) {
        displayText = '1 minute';
      } else if (uptimeMins < 60) {
        displayText = `${uptimeMins} minutes`;
      } else {
        const uptimeHours = Math.floor(uptimeMins / 60);
        const remainingMins = uptimeMins % 60;
        if (uptimeHours === 1) {
          displayText = remainingMins > 0 ? `1 hour, ${remainingMins} mins` : '1 hour';
        } else {
          displayText = remainingMins > 0 ? `${uptimeHours} hours, ${remainingMins} mins` : `${uptimeHours} hours`;
        }
      }
      uptimeEl.textContent = displayText;
    } else {
      uptimeEl.textContent = 'Not tracking';
    }
  }
}

/**
 * Update the location display below zip code input
 * @param {HTMLElement} overlay - Settings overlay element
 * @param {string} zipCode - Zip code to look up
 */
export async function updateZipCodeLocationDisplay(overlay, zipCode) {
  const locationDisplay = overlay.querySelector('#zipcode-location-display');
  
  if (!locationDisplay) {
    return;
  }
  
  if (!zipCode || zipCode.trim() === '') {
    locationDisplay.textContent = '';
    return;
  }
  
  // Show loading state
  locationDisplay.textContent = 'Looking up location...';
  locationDisplay.style.color = 'var(--text-secondary, #999)';
  
  try {
    // Import getLocationName from geocoding helper
    const { getLocationName } = await import('../utils/geocoding-helper.js');
    
    const locationName = await getLocationName(zipCode);
    
    if (locationName) {
      locationDisplay.textContent = locationName;
      locationDisplay.style.color = 'var(--text-secondary, #999)';
    } else {
      locationDisplay.textContent = 'Location not found';
      locationDisplay.style.color = 'var(--danger-color, #ff4444)';
    }
  } catch (error) {
    console.error('⚙️ Failed to update location display:', error);
    locationDisplay.textContent = 'Error looking up location';
    locationDisplay.style.color = 'var(--danger-color, #ff4444)';
  }
}