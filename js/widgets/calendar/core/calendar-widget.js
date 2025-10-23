// js/widgets/Calendar/core/calendar-widget.js
// Calendar Widget Main Coordinator
// Refactored v2.0 - October 2025

import { createLogger } from '/js/utils/logger.js';
import { CalendarConfig } from '../renderers/calendar-config.js';
import { CalendarEvents } from '../renderers/calendar-events.js';
import { CalendarWeekly } from '../renderers/calendar-weekly.js';

// Import managers
import { CalendarSettingsManager } from './settings-manager.js';
import { CalendarFocusManager } from './focus-manager.js';
import { CalendarDataManager } from './data-manager.js';
import { CalendarNavigationManager } from './navigation-manager.js';
import { CalendarMessageHandler } from './message-handler.js';
import { CalendarActionHandler } from './action-handler.js';

const logger = createLogger('CalendarWidget');

export class CalendarWidget {
  constructor() {
    // ============== MANAGERS ==============
    // Initialize all subsystem managers
    this.settingsManager = new CalendarSettingsManager(this);
    this.focusManager = new CalendarFocusManager(this);
    this.dataManager = new CalendarDataManager(this);
    this.navigationManager = new CalendarNavigationManager(this);
    this.messageHandler = new CalendarMessageHandler(this);
    this.actionHandler = new CalendarActionHandler(this);

    // ============== RENDERERS ==============
    // Calendar list will be loaded from CalendarService
    this.calendars = [];

    // Load settings and set initial view mode
    const settings = this.settingsManager.loadSettings();
    this.navigationManager.currentView = settings.viewMode || 'week';
    this.navigationManager.currentDate = new Date();

    // Initialize helper modules with settings
    this.config = new CalendarConfig(this.calendars);
    this.events = new CalendarEvents(this.calendars);
    this.weekly = new CalendarWeekly(this.calendars, settings);
    this.monthly = null; // Monthly view renderer (lazy init)

    this.init();
  }

  async init() {
    this.settingsManager.detectAndApplyInitialTheme();
    this.messageHandler.setupListeners();
    this.navigationManager.setupKeyboardControls();
    this.setupUI();

    // Initialize weekly view
    this.weekly.initialize(this.navigationManager.currentDate);

    // Send focus menu configuration to parent
    this.focusManager.sendMenuConfig();

    // Calendar data will be loaded by widget-data-manager and sent via postMessage
    // No need to load data here - prevents duplicate loading

    // Prevent iframe from stealing focus on clicks
    this.setupFocusPrevention();

    logger.info('Calendar widget initialized');
  }

  setupUI() {
    // UI is already in HTML, just ensure calendar container exists
    const calendarContainer = document.getElementById('calendar');
    if (!calendarContainer) {
      logger.error('Calendar container not found');
    }
  }

  /**
   * Prevent iframe from stealing keyboard focus from parent
   * When user clicks inside iframe, blur it so parent keeps keyboard control
   */
  setupFocusPrevention() {
    // After any click inside the widget, blur the window to return focus to parent
    document.addEventListener('click', (e) => {
      // Only blur if we're in an iframe (not standalone)
      if (window.parent !== window) {
        // Blur after a short delay to allow click handlers to complete
        setTimeout(() => {
          window.blur();
          // Also tell parent to ensure it has focus
          window.parent.focus();
        }, 50);
      }
    }, true); // Use capture phase to catch all clicks

    logger.debug('Focus prevention setup complete');
  }

  /**
   * Clean up resources when widget is removed
   */
  cleanup() {
    this.dataManager.cleanup();
    this.settingsManager.cleanup();
    this.messageHandler.cleanup();
    logger.debug('Calendar widget cleanup complete');
  }
}
