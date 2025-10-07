// js/settings/settings-screen-helpers.js
// CHANGE SUMMARY: NEW FILE - Shared screen-specific logic used by both navigation systems

import { populateSystemStatus } from './settings-ui-builder.js';
import { CalendarSettingsManager } from '../../widgets/dcal/dcal-settings/dcal-settings-manager.js';

/**
 * Handle screen-specific initialization/setup when navigating TO a screen
 * Called by both mobile and d-pad navigation systems
 * 
 * @param {string} screenId - The screen being navigated to
 * @param {HTMLElement} overlay - The settings overlay element
 * @param {Object} navigation - The navigation instance (for callbacks)
 */
export function handleScreenEnter(screenId, overlay, navigation) {
  console.log(`⚙️ Handling screen enter: ${screenId}`);
  
  // System Status screen - populate with current data
  if (screenId === 'system-status') {
    populateSystemStatus(overlay);
  }
  
  // Calendar screens - initialize calendar settings manager
  if (screenId === 'manage-calendars' || screenId === 'calendar') {
    if (!window.calendarSettingsManager) {
      console.log('📅 Creating new CalendarSettingsManager');
      window.calendarSettingsManager = new CalendarSettingsManager(overlay, navigation);
    } else {
      // Update references to new overlay/navigation instances
      console.log('📅 Updating CalendarSettingsManager references');
      window.calendarSettingsManager.parentOverlay = overlay;
      window.calendarSettingsManager.parentNavigation = navigation;
    }
    window.calendarSettingsManager.initialize();
  }
}

/**
 * Handle screen-specific cleanup/saving when navigating AWAY from a screen
 * Called by both mobile and d-pad navigation systems
 * 
 * @param {string} screenId - The screen being navigated away from
 * @returns {Promise<void>}
 */
export async function handleScreenExit(screenId) {
  console.log(`⚙️ Handling screen exit: ${screenId}`);
  
  // Calendar screens - save any pending changes
  if (screenId === 'manage-calendars' && window.calendarSettingsManager) {
    console.log('📅 Saving calendar settings before exit');
    await window.calendarSettingsManager.saveCalendarSettings();
  }
}

/**
 * Handle cleanup when settings overlay is being destroyed
 * Called when settings modal is closed
 */
export async function handleSettingsCleanup() {
  console.log('⚙️ Cleaning up settings resources');
  
  // Cleanup calendar settings manager
  if (window.calendarSettingsManager) {
    console.log('📅 Destroying CalendarSettingsManager');
    await window.calendarSettingsManager.destroy();
    window.calendarSettingsManager = null;
  }
  
  // Add other cleanup tasks here as needed
}

/**
 * Screen registry - defines all screens and their behaviors
 * Useful for understanding what screens exist and their special requirements
 */
export const SCREEN_BEHAVIORS = {
  'system-status': {
    requiresInit: true,
    requiresSave: false,
    description: 'Populates system information on entry'
  },
  'manage-calendars': {
    requiresInit: true,
    requiresSave: true,
    description: 'Calendar selection and management'
  },
  'calendar': {
    requiresInit: true,
    requiresSave: false,
    description: 'Calendar main menu'
  }
  // Add other screens here as documentation
};