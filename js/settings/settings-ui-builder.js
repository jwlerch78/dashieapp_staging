// js/settings/settings-ui-builder.js
// CHANGE SUMMARY: Refactored - extracted all HTML templates to settings-templates.js and widget-specific files, keeping only logic here

import { getPlatformDetector } from '../utils/platform-detector.js';
import * as templates from './settings-templates.js';
import { buildPhotosSettingsScreens, populatePhotoFields } from '../../widgets/photos/settings-photos.js';

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
          ${buildPhotosSettingsScreens()}
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
  
  // Delegate photo fields to photo settings module
  populatePhotoFields(overlay, settings);
}

/**
 * Populate system status information
 */
export function populateSystemStatus(overlay) {
  const platformDetector = getPlatformDetector();
  
  // Platform Information
  const platformEl = overlay.querySelector('#system-platform-value');
  if (platformEl) {
    platformEl.textContent = platformDetector.mobile ? 'Mobile' : 
                             platformDetector.fireTV ? 'Fire TV' : 'Desktop';
  }
  
  const deviceEl = overlay.querySelector('#system-device-value');
  if (deviceEl) {
    deviceEl.textContent = navigator.userAgent.includes('Firefox') ? 'Firefox' :
                          navigator.userAgent.includes('Chrome') ? 'Chrome' :
                          navigator.userAgent.includes('Safari') ? 'Safari' : 'Unknown';
  }
}