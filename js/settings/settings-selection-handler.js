// js/settings/settings-selection-handler.js
// CHANGE SUMMARY: Updated highlightCurrentSelections to use sync highlightPhotoSettings for photos screen instead of async populatePhotoStats

import { TimeSelectionHandler } from './time-selection-handler.js';

export class SettingsSelectionHandler {
  constructor(timeHandler = null) {
    // Use shared time handler if provided, otherwise create new one
    this.timeHandler = timeHandler || new TimeSelectionHandler();
  }

  /**
   * Handle selection of a regular (non-time) setting cell
   * @param {HTMLElement} cell - The cell that was selected
   * @param {HTMLElement} overlay - The settings overlay element
   * @param {Function} onSettingChange - Callback when setting changes
   */
  handleRegularSelection(cell, overlay, onSettingChange) {
    const setting = cell.dataset.setting;
    const value = cell.dataset.value;
    
    if (!setting || !value) return;
    
    const section = cell.closest('.settings-section');
    if (section) {
      section.querySelectorAll('.selectable').forEach(c => {
        c.classList.remove('selected');
      });
      cell.classList.add('selected');
    }
    
    onSettingChange(setting, value);
    this.updateParentDisplayValue(setting, value, overlay);
    
    console.log(`⚙️ Selection changed: ${setting} = ${value}`);
  }

  /**
   * Update the parent display value when a setting changes
   * @param {string} setting - Setting path (e.g., 'display.theme')
   * @param {string} value - New value
   * @param {HTMLElement} overlay - The settings overlay element
   */
  updateParentDisplayValue(setting, value, overlay) {
    const displayMap = {
      'display.theme': { id: 'mobile-theme-value', format: (v) => v === 'dark' ? 'Dark' : 'Light' },
      'display.sleepTime': { id: 'mobile-sleep-time-value', format: (v) => this.timeHandler.formatTime(v) },
      'display.wakeTime': { id: 'mobile-wake-time-value', format: (v) => this.timeHandler.formatTime(v) },
      'photos.source': { 
        id: 'mobile-photo-album-value', 
        format: (v) => ({ recent: 'Recent Photos', family: 'Family Album', vacation: 'Vacation 2024' }[v] || v)
      },
      'photos.transitionTime': {
        id: 'mobile-photo-transition-value',
        format: (v) => this.formatTransitionTime(parseInt(v))
      }
    };

    const display = displayMap[setting];
    if (display) {
      const element = overlay.querySelector(`#${display.id}`);
      if (element) {
        const formattedValue = display.format(value);
        element.textContent = formattedValue;
        console.log(`⚙️ Updated display: ${display.id} = "${formattedValue}"`);
      } else {
        console.warn(`⚙️ Display element not found: #${display.id}`);
      }
    } else {
      console.log(`⚙️ No display update needed for setting: ${setting}`);
    }
  }

  /**
   * Format transition time in seconds to human-readable format
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted time string
   */
  formatTransitionTime(seconds) {
    if (seconds < 60) return `${seconds} sec`;
    if (seconds < 3600) return `${seconds / 60} min`;
    return `${seconds / 3600} hour`;
  }

  /**
   * Parse transition time string back to seconds
   * @param {string} timeStr - Formatted time string (e.g., "5 sec", "2 min")
   * @returns {number} Time in seconds
   */
  parseTransitionTime(timeStr) {
    if (!timeStr) return 5;
    if (timeStr.includes('sec')) return parseInt(timeStr);
    if (timeStr.includes('min')) return parseInt(timeStr) * 60;
    if (timeStr.includes('hour')) return parseInt(timeStr) * 3600;
    return 5;
  }

  /**
   * Highlight current selections on active screen
   * @param {HTMLElement} overlay - The settings overlay element
   * @param {string} currentScreenId - Current screen ID from navigation stack
   */
  highlightCurrentSelections(overlay, currentScreenId) {
    const activeScreen = overlay.querySelector('.settings-screen.active');
    if (!activeScreen) return;
    
    // Delegate to time handler for time selection screens
    if (currentScreenId.includes('sleep-time') || currentScreenId.includes('wake-time')) {
      this.timeHandler.highlightCurrentTimeSelection(overlay, currentScreenId);
      return;
    }
    
    // CHANGED: For photos screen, use synchronous highlighting first
    if (currentScreenId === 'photos') {
      // Get current settings for highlighting
      const settings = window.settingsInstance?.controller?.getSettings() || {};
      
      // Import and call highlightPhotoSettings (synchronous) for immediate UI response
      import('../../widgets/photos/settings-photos.js').then(({ highlightPhotoSettings, populatePhotoStats }) => {
        // Synchronous highlighting happens first
        highlightPhotoSettings(overlay, settings);
        
        // Then trigger async data loading (doesn't block UI)
        populatePhotoStats(overlay);
      });
      
      return; // Exit early - photos handled separately
    }
    
    const selectableCells = activeScreen.querySelectorAll('.settings-cell.selectable[data-setting]');
    
    selectableCells.forEach(cell => {
      const setting = cell.dataset.setting;
      const value = cell.dataset.value;
      
      let isCurrentValue = false;
      
      if (setting === 'display.theme') {
        const themeValue = overlay.querySelector('#mobile-theme-value')?.textContent.toLowerCase();
        isCurrentValue = (value === 'dark' && themeValue === 'dark') || 
                        (value === 'light' && themeValue === 'light');
      } else if (setting === 'photos.transitionTime') {
        const transitionValue = overlay.querySelector('#mobile-photo-transition-value')?.textContent;
        const currentSeconds = this.parseTransitionTime(transitionValue);
        isCurrentValue = parseInt(value) === currentSeconds;
      } else if (setting === 'photos.source') {
        const albumValue = overlay.querySelector('#mobile-photo-album-value')?.textContent;
        const albumMap = {
          'Recent Photos': 'recent',
          'Family Album': 'family',
          'Vacation 2024': 'vacation'
        };
        isCurrentValue = value === albumMap[albumValue];
      }
      
      if (isCurrentValue) {
        cell.classList.add('selected');
      } else {
        cell.classList.remove('selected');
      }
    });
  }

  /**
   * Update navigation bar with current screen info
   * @param {HTMLElement} overlay - The settings overlay element
   * @param {string} currentScreenId - Current screen ID
   * @param {Array<string>} navigationStack - Navigation stack array
   */
  updateNavBar(overlay, currentScreenId, navigationStack) {
    const currentScreen = overlay.querySelector(`[data-screen="${currentScreenId}"]`);
    
    if (!currentScreen) return;
    
    const title = currentScreen.dataset.title || 'Settings';
    const navTitle = overlay.querySelector('.nav-title');
    if (navTitle) {
      navTitle.textContent = title;
    }
    
    const backBtn = overlay.querySelector('.nav-back-button');
    if (backBtn) {
      const isRootScreen = currentScreenId === 'root';
      
      // Always show back button
      backBtn.style.visibility = 'visible';
      
      if (isRootScreen) {
        // On root screen, back closes settings
        backBtn.textContent = '‹ Back';
      } else {
        // On other screens, show previous screen name
        const previousScreenId = navigationStack[navigationStack.length - 2];
        const previousScreen = overlay.querySelector(`[data-screen="${previousScreenId}"]`);
        if (previousScreen) {
          const previousTitle = previousScreen.dataset.title || 'Back';
          backBtn.textContent = `‹ ${previousTitle}`;
        }
      }
    }
  }

  /**
   * Get current screen ID from navigation stack
   * @param {Array<string>} navigationStack - Navigation stack array
   * @returns {string} Current screen ID
   */
  getCurrentScreenId(navigationStack) {
    return navigationStack[navigationStack.length - 1];
  }
}