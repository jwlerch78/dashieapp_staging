// js/widgets/Calendar/core/settings-manager.js
// Manages calendar settings, theme, and persistence

import { createLogger } from '/js/utils/logger.js';
import { detectCurrentTheme, applyThemeToWidget } from '/js/widgets/shared/widget-theme-detector.js';

const logger = createLogger('CalendarSettingsManager');

export class CalendarSettingsManager {
  constructor(widget) {
    this.widget = widget;
    this.currentTheme = null;
    this.lastUpdatedTimestamp = null;
    this.displayUpdateInterval = null;
  }

  /**
   * Load settings from localStorage
   * Checks both dashie-calendar-settings (widget-specific) and dashie-settings (global)
   */
  loadSettings() {
    try {
      const localStorage = window.parent?.localStorage || window.localStorage;

      // First try dashie-calendar-settings (widget-specific, takes precedence)
      const calendarSettings = localStorage.getItem('dashie-calendar-settings');
      if (calendarSettings) {
        const parsed = JSON.parse(calendarSettings);
        return {
          viewMode: parsed.dcalViewMode || 'week',
          startWeekOn: parsed.startWeekOn || 'sun',
          scrollTime: parsed.scrollTime || 8
        };
      }

      // Fallback to dashie-settings (global settings)
      const globalSettings = localStorage.getItem('dashie-settings');
      if (globalSettings) {
        const parsed = JSON.parse(globalSettings);
        return {
          viewMode: parsed.calendar?.dcalViewMode || 'week',
          startWeekOn: parsed.calendar?.startWeekOn || 'sun',
          scrollTime: parsed.calendar?.scrollTime || 8
        };
      }
    } catch (error) {
      logger.error('Failed to load calendar settings', error);
    }

    // Defaults
    return { viewMode: 'week', startWeekOn: 'sun', scrollTime: 8 };
  }

  /**
   * Save view mode setting to localStorage and database
   */
  async saveViewModeSetting(viewMode) {
    try {
      const localStorage = window.parent?.localStorage || window.localStorage;

      // Load existing calendar settings from dashie-calendar-settings (NOT dashie-settings)
      let calendarSettings = {};
      try {
        const existing = localStorage.getItem('dashie-calendar-settings');
        if (existing) {
          calendarSettings = JSON.parse(existing);
        }
      } catch (e) {
        logger.warn('Failed to parse existing calendar settings', e);
      }

      // Update view mode in calendar settings
      calendarSettings.dcalViewMode = viewMode;

      // Save to dashie-calendar-settings (NOT dashie-settings)
      localStorage.setItem('dashie-calendar-settings', JSON.stringify(calendarSettings));
      logger.debug('✓ Saved viewMode to dashie-calendar-settings', { viewMode });

      // Save to database
      const settingsInstance = window.parent?.settingsInstance || window.settingsInstance;
      if (settingsInstance && typeof settingsInstance.handleSettingChange === 'function') {
        await settingsInstance.handleSettingChange('calendar', calendarSettings);
        logger.debug('✓ Saved viewMode to database', { viewMode });
      }

    } catch (error) {
      logger.error('Failed to save view mode setting', error);
    }
  }

  /**
   * Detect and apply initial theme
   */
  detectAndApplyInitialTheme() {
    const initialTheme = detectCurrentTheme('light');
    this.applyTheme(initialTheme);
    logger.debug('Initial theme detected', { theme: initialTheme });
  }

  /**
   * Apply theme to widget
   */
  applyTheme(theme) {
    if (theme === this.currentTheme) {
      logger.debug('Theme already applied, skipping', { theme });
      return;
    }

    logger.debug('Applying theme to Calendar widget', {
      from: this.currentTheme,
      to: theme
    });

    this.currentTheme = theme;
    this.applyThemeToElements(theme);

    logger.debug('Theme applied successfully', { theme });
  }

  /**
   * Apply theme to HTML elements
   */
  applyThemeToElements(theme) {
    // Use utility to apply theme classes (removes all existing theme classes automatically)
    applyThemeToWidget(theme);
  }

  /**
   * Update connection status indicator
   */
  updateConnectionStatus(status) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = status === 'connected' ? '●' : '○';
      statusElement.style.color = status === 'connected' ? 'var(--accent-blue, #00aaff)' : 'var(--text-muted, #999)';
    }
  }

  /**
   * Update the "last updated" display with relative time
   */
  updateLastUpdatedDisplay() {
    const element = document.getElementById('lastUpdated');
    if (!element || !this.lastUpdatedTimestamp) {
      return;
    }

    const now = Date.now();
    const diffMs = now - this.lastUpdatedTimestamp;
    const diffMins = Math.floor(diffMs / 60000);

    let displayText;
    if (diffMins < 1) {
      displayText = 'Updated just now';
    } else if (diffMins === 1) {
      displayText = 'Updated 1 min ago';
    } else if (diffMins < 60) {
      displayText = `Updated ${diffMins} mins ago`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours === 1) {
        displayText = 'Updated 1 hour ago';
      } else {
        displayText = `Updated ${diffHours} hours ago`;
      }
    }

    element.textContent = displayText;
  }

  /**
   * Start interval for updating "last updated" display
   */
  startLastUpdatedInterval(timestamp) {
    this.lastUpdatedTimestamp = timestamp;
    this.updateLastUpdatedDisplay();

    // Clear any existing interval
    if (this.displayUpdateInterval) {
      clearInterval(this.displayUpdateInterval);
    }

    // Update every 60 seconds
    this.displayUpdateInterval = setInterval(() => {
      this.updateLastUpdatedDisplay();
    }, 60000);
  }

  /**
   * Clean up intervals
   */
  cleanup() {
    if (this.displayUpdateInterval) {
      clearInterval(this.displayUpdateInterval);
    }
  }
}
