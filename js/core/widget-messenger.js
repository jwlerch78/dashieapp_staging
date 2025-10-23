// js/core/widget-messenger.js
// Manages postMessage communication with widget iframes
// v1.0 - 10/15/25 - Initial implementation for refactored architecture
// Based on legacy widget-messenger.js

import { createLogger } from '../utils/logger.js';
import AppComms from './app-comms.js';
import AppStateManager from './app-state-manager.js';
import { WIDGET_MESSAGE_TYPES, WIDGET_COMMANDS, WIDGET_EVENT_TYPES } from '../../config.js';

const logger = createLogger('WidgetMessenger');

/**
 * WidgetMessenger - Widget Communication Manager
 *
 * Purpose:
 * - Manages postMessage communication with widget iframes
 * - Sends commands and data to widgets
 * - Receives events from widgets
 * - Maintains widget state and deduplicates broadcasts
 *
 * Message Protocol:
 *   To Widget: { type: 'command|data|config', action: string, payload: {} }
 *   From Widget: { type: 'event', eventType: string, data: {} }
 */
class WidgetMessenger {
  constructor() {
    this.isInitialized = false;
    this.widgets = new Map(); // widgetWindow → widgetInfo
    this.lastSentState = new Map(); // widgetWindow → lastState (for deduplication)

    // Current system state sent to widgets
    this.currentState = {
      calendar: null,
      photos: null,
      weather: null,
      auth: { ready: false, user: null },
      theme: 'light',
      settings: {}
    };

    logger.verbose('WidgetMessenger created');
  }

  /**
   * Initialize widget messenger
   * Sets up event listeners and subscriptions
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      logger.verbose('Initializing WidgetMessenger...');

      // Load current theme from localStorage
      try {
        const savedTheme = localStorage.getItem('dashie-theme');
        if (savedTheme) {
          this.currentState.theme = savedTheme;
          logger.debug('WidgetMessenger loaded theme from localStorage', { theme: savedTheme });
        }
      } catch (e) {
        logger.debug('Could not read theme from localStorage, using default');
      }

      // Load current settings from settingsStore if available
      // (Settings are loaded before WidgetMessenger, so SETTINGS_LOADED event was already published)
      try {
        if (window.settingsStore && window.settingsStore.initialized) {
          this.currentState.settings = window.settingsStore.getAll();
          logger.debug('WidgetMessenger loaded settings from settingsStore', {
            hasPhotosSettings: !!this.currentState.settings?.photos,
            transitionTime: this.currentState.settings?.photos?.transitionTime
          });
        }
      } catch (e) {
        logger.debug('Could not read settings from settingsStore, will wait for SETTINGS_LOADED event');
      }

      // Set up widget message listener
      this.setupMessageListener();

      // Subscribe to app events
      this.setupEventSubscriptions();

      this.isInitialized = true;

      logger.verbose('WidgetMessenger initialized', {
        initialTheme: this.currentState.theme,
        hasSettings: !!this.currentState.settings
      });
      return true;
    } catch (error) {
      logger.error('Failed to initialize WidgetMessenger', error);
      return false;
    }
  }

  /**
   * Set up message listener for widget communications
   * @private
   */
  setupMessageListener() {
    window.addEventListener('message', (event) => {
      if (!event.data || !event.data.type) {
        return;
      }

      const messageData = event.data;

      switch (messageData.type) {
        case 'widget-ready':
          this.handleWidgetReady(event, messageData);
          break;

        case 'widget-error':
          this.handleWidgetError(event, messageData);
          break;

        case 'return-to-menu':
          this.handleReturnToMenu(event, messageData);
          break;

        case 'settings-requested':
          this.handleSettingsRequested(event, messageData);
          break;

        case 'data-requested':
          this.handleDataRequested(event, messageData);
          break;

        case 'event':
          this.handleWidgetEvent(event, messageData);
          break;

        default:
          logger.debug('Unhandled widget message type', { type: messageData.type });
      }
    });

    logger.debug('Widget message listener configured');
  }

  /**
   * Set up subscriptions to app events
   * @private
   */
  setupEventSubscriptions() {
    // Listen for theme changes
    AppComms.subscribe(AppComms.events.THEME_CHANGED, (data) => {
      const oldTheme = this.currentState.theme;
      this.currentState.theme = data.theme;

      if (oldTheme !== data.theme) {
        logger.info('Theme changed, broadcasting to widgets', {
          from: oldTheme,
          to: data.theme
        });
        this.broadcastCurrentState();
      }
    });

    // Listen for auth changes
    AppComms.subscribe(AppComms.events.AUTH_USER_CHANGED, (data) => {
      this.currentState.auth = {
        ready: data.newUser?.isAuthenticated || false,
        user: data.newUser
      };

      logger.info('Auth state changed, broadcasting to widgets');
      this.broadcastCurrentState();
    });

    // Listen for data updates
    AppComms.subscribe(AppComms.events.CALENDAR_UPDATED, (data) => {
      this.currentState.calendar = data;
      logger.debug('Calendar data updated, broadcasting to widgets');
      this.broadcastCurrentState();
    });

    AppComms.subscribe(AppComms.events.PHOTOS_UPDATED, (data) => {
      this.currentState.photos = data;
      logger.debug('Photos data updated, broadcasting to widgets');
      this.broadcastCurrentState();
    });

    AppComms.subscribe(AppComms.events.WEATHER_UPDATED, (data) => {
      this.currentState.weather = data;
      logger.debug('Weather data updated, broadcasting to widgets');
      this.broadcastCurrentState();
    });

    // Listen for settings changes
    AppComms.subscribe(AppComms.events.SETTINGS_CHANGED, (data) => {
      this.currentState.settings = data;
      logger.info('Settings changed, broadcasting to widgets', {
        hasPhotosSettings: !!data?.photos,
        transitionTime: data?.photos?.transitionTime,
        allSettings: Object.keys(data || {})
      });
      this.broadcastCurrentState();
    });

    // Listen for settings loaded (initial load)
    AppComms.subscribe(AppComms.events.SETTINGS_LOADED, (data) => {
      this.currentState.settings = data;
      logger.debug('Settings loaded, broadcasting to widgets');
      this.broadcastCurrentState();
    });

    logger.debug('Event subscriptions configured');
  }

  // =============================================================================
  // WIDGET LIFECYCLE HANDLING
  // =============================================================================

  /**
   * Handle widget ready notification
   * @private
   * @param {MessageEvent} event - Message event
   * @param {Object} messageData - Message data
   */
  handleWidgetReady(event, messageData) {
    const widgetInfo = {
      name: messageData.widget || 'unknown',
      source: event.source,
      readyAt: Date.now()
    };

    this.widgets.set(event.source, widgetInfo);

    logger.debug('Widget registered', {
      name: widgetInfo.name,
      totalWidgets: this.widgets.size
    });

    // Send current state to the new widget
    this.sendCurrentStateToWidget(event.source, widgetInfo.name);

    // Broadcast widget ready event
    AppComms.publish(AppComms.events.WIDGET_READY, {
      widgetName: widgetInfo.name,
      widgetWindow: event.source
    });
  }

  /**
   * Handle widget error notification
   * @private
   * @param {MessageEvent} event - Message event
   * @param {Object} messageData - Message data
   */
  handleWidgetError(event, messageData) {
    const widgetName = this.getWidgetName(event.source);

    logger.error(`Widget error from ${widgetName}`, {
      error: messageData.error,
      details: messageData.details
    });

    AppComms.publish(AppComms.events.WIDGET_ERROR, {
      widgetName,
      error: messageData.error,
      details: messageData.details
    });
  }

  /**
   * Handle return-to-menu request from widget
   * @private
   * @param {MessageEvent} event - Message event
   * @param {Object} messageData - Message data
   */
  handleReturnToMenu(event, messageData) {
    const widgetName = this.getWidgetName(event.source);

    logger.info(`Widget ${widgetName} requested return to menu`);

    AppComms.publish(AppComms.events.WIDGET_MESSAGE, {
      type: 'return-to-menu',
      widgetName,
      data: messageData
    });
  }

  /**
   * Handle settings request from widget
   * @private
   * @param {MessageEvent} event - Message event
   * @param {Object} messageData - Message data
   */
  handleSettingsRequested(event, messageData) {
    const widgetName = this.getWidgetName(event.source);

    logger.debug(`Widget ${widgetName} requested settings`, {
      settingPath: messageData.path
    });

    // Send settings to widget
    this.sendMessage(event.source, {
      type: WIDGET_MESSAGE_TYPES.CONFIG,
      action: 'settings-response',
      payload: this.currentState.settings
    });
  }

  /**
   * Handle data request from widget
   * @private
   * @param {MessageEvent} event - Message event
   * @param {Object} messageData - Message data
   */
  handleDataRequested(event, messageData) {
    const widgetName = this.getWidgetName(event.source);
    const dataType = messageData.dataType;

    logger.debug(`Widget ${widgetName} requested data`, { dataType });

    const data = this.currentState[dataType];

    this.sendMessage(event.source, {
      type: WIDGET_MESSAGE_TYPES.DATA,
      action: 'data-response',
      payload: {
        dataType,
        data
      }
    });
  }

  /**
   * Handle event from widget
   * @private
   * @param {MessageEvent} event - Message event
   * @param {Object} messageData - Message data
   */
  handleWidgetEvent(event, messageData) {
    const widgetId = messageData.widgetId || 'unknown';
    const eventType = messageData.payload?.eventType;

    logger.debug(`Widget event from ${widgetId}`, { eventType, payload: messageData.payload });

    // Handle enter-focus event (widget requesting to be focused)
    if (eventType === 'enter-focus') {
      logger.info(`Widget ${widgetId} requested focus via touch`);

      // Publish event for Dashboard to handle
      AppComms.publish(AppComms.events.WIDGET_MESSAGE, {
        type: 'enter-focus-request',
        widgetId,
        data: messageData.payload
      });
    }
  }

  // =============================================================================
  // SENDING MESSAGES TO WIDGETS
  // =============================================================================

  /**
   * Send command to a specific widget
   * @param {Window} targetWindow - Target widget window
   * @param {string} command - Command to send (from WIDGET_COMMANDS)
   */
  sendCommand(targetWindow, command) {
    this.sendMessage(targetWindow, {
      type: WIDGET_MESSAGE_TYPES.COMMAND,
      action: command,
      payload: null
    });

    logger.widget('send', 'command', this.getWidgetName(targetWindow), { command });
  }

  /**
   * Send command to widget by ID (smart handling like legacy)
   * @param {string} widgetId - Widget ID (e.g., 'main', 'calendar')
   * @param {string|Object} command - Command to send
   *   - If string: wraps as {action: 'string'} (e.g., 'left' → {action: 'left'})
   *   - If object: sends as-is (e.g., {action: 'menu-item-selected', itemId: 'weekly'})
   */
  sendCommandToWidget(widgetId, command) {
    // Iframe IDs are prefixed with 'widget-'
    const iframeId = `widget-${widgetId}`;
    const iframe = document.getElementById(iframeId);

    if (iframe && iframe.contentWindow) {
      // Smart handling: if string, wrap it. If object, send as-is (legacy format)
      const message = (typeof command === 'string') ? { action: command } : command;

      iframe.contentWindow.postMessage(message, '*');
      logger.widget('send', 'command', widgetId, { message });
    } else {
      logger.warn('Widget iframe not found', { widgetId, iframeId });
    }
  }

  /**
   * Broadcast current state to all widgets with deduplication
   */
  broadcastCurrentState() {
    const allIframes = document.querySelectorAll('iframe');
    let broadcastCount = 0;
    let skippedCount = 0;

    allIframes.forEach((iframe) => {
      if (iframe.contentWindow) {
        // Check if we need to send update to this widget
        if (this.shouldSendStateUpdate(iframe.contentWindow)) {
          this.sendCurrentStateToWidget(iframe.contentWindow, iframe.id || 'unknown');
          broadcastCount++;
        } else {
          skippedCount++;
        }
      }
    });

    logger.info('Broadcast complete', {
      totalIframes: allIframes.length,
      broadcastCount,
      skippedCount,
      hasSettings: !!this.currentState.settings,
      transitionTime: this.currentState.settings?.photos?.transitionTime
    });
  }

  /**
   * Send current state to a specific widget
   * @param {Window} targetWindow - Target widget window
   * @param {string} widgetName - Widget name for logging
   */
  sendCurrentStateToWidget(targetWindow, widgetName) {
    const message = {
      type: WIDGET_MESSAGE_TYPES.DATA,
      action: 'state-update',
      payload: {
        ...this.currentState,
        timestamp: Date.now()
      }
    };

    this.sendMessage(targetWindow, message);

    // Update last sent state for this widget
    this.updateLastSentState(targetWindow);

    logger.debug('Sent current state to widget', { widgetName });
  }

  /**
   * Send message to specific widget
   * @param {Window} targetWindow - Target widget window
   * @param {Object} message - Message to send
   */
  sendMessage(targetWindow, message) {
    if (!targetWindow) {
      logger.warn('Cannot send message - no target window');
      return;
    }

    try {
      targetWindow.postMessage(message, '*');
    } catch (error) {
      logger.error('Failed to send message to widget', {
        error: error.message,
        messageType: message.type
      });
    }
  }

  // =============================================================================
  // DEDUPLICATION LOGIC
  // =============================================================================

  /**
   * Check if we should send a state update to a widget (deduplication)
   * @private
   * @param {Window} widgetWindow - Target widget window
   * @returns {boolean} Whether to send the update
   */
  shouldSendStateUpdate(widgetWindow) {
    const lastSent = this.lastSentState.get(widgetWindow);

    // Always send if we haven't sent anything to this widget yet
    if (!lastSent) {
      return true;
    }

    // Check if theme has changed
    if (lastSent.theme !== this.currentState.theme) {
      return true;
    }

    // Check if data has changed for any type
    const dataTypes = ['calendar', 'photos', 'weather'];
    for (const dataType of dataTypes) {
      if (this.hasDataChanged(dataType, lastSent)) {
        return true;
      }
    }

    // No changes detected
    return false;
  }

  /**
   * Check if data has changed for a given type
   * @private
   * @param {string} dataType - Type of data to check
   * @param {Object} lastSent - Last sent state
   * @returns {boolean} Whether data has changed
   */
  hasDataChanged(dataType, lastSent) {
    const currentData = this.currentState[dataType];
    const lastData = lastSent[dataType];

    // If both null/undefined, no change
    if (!currentData && !lastData) return false;

    // If one is null/undefined and other isn't, changed
    if (!currentData || !lastData) return true;

    // Compare timestamps for data change
    return currentData.lastUpdated !== lastData.lastUpdated;
  }

  /**
   * Update last sent state for a widget
   * @private
   * @param {Window} widgetWindow - Widget window
   */
  updateLastSentState(widgetWindow) {
    this.lastSentState.set(widgetWindow, {
      calendar: this.currentState.calendar ? { ...this.currentState.calendar } : null,
      photos: this.currentState.photos ? { ...this.currentState.photos } : null,
      weather: this.currentState.weather ? { ...this.currentState.weather } : null,
      auth: { ...this.currentState.auth },
      theme: this.currentState.theme
    });
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Get widget name from window source
   * @param {Window} windowSource - Widget window
   * @returns {string} Widget name
   */
  getWidgetName(windowSource) {
    const widgetInfo = this.widgets.get(windowSource);
    return widgetInfo?.name || 'unknown';
  }

  /**
   * Get all registered widgets
   * @returns {Array<Object>} Array of widget info objects
   */
  getRegisteredWidgets() {
    return Array.from(this.widgets.values());
  }

  /**
   * Update current state (for data services to call)
   * @param {string} dataType - Type of data
   * @param {any} data - Data to set
   */
  updateState(dataType, data) {
    this.currentState[dataType] = data;
    logger.debug(`State updated: ${dataType}`);
  }

  /**
   * Get status for debugging
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      totalWidgets: this.widgets.size,
      widgets: Array.from(this.widgets.values()).map(w => ({
        name: w.name,
        readyAt: w.readyAt
      })),
      currentState: {
        hasCalendar: !!this.currentState.calendar,
        hasPhotos: !!this.currentState.photos,
        hasWeather: !!this.currentState.weather,
        authReady: this.currentState.auth.ready,
        theme: this.currentState.theme
      },
      lastSentStates: this.lastSentState.size
    };
  }

  /**
   * Cleanup - clear all widgets and state
   */
  destroy() {
    logger.info('Destroying WidgetMessenger...');

    this.widgets.clear();
    this.lastSentState.clear();
    this.currentState = {
      calendar: null,
      photos: null,
      weather: null,
      auth: { ready: false, user: null },
      theme: 'light',
      settings: {}
    };

    this.isInitialized = false;

    logger.success('WidgetMessenger destroyed');
  }
}

// Create singleton instance
const widgetMessenger = new WidgetMessenger();

// =============================================================================
// EXPOSE GLOBALLY FOR DEBUGGING
// =============================================================================

if (typeof window !== 'undefined') {
  window.widgetMessenger = widgetMessenger;
}

// =============================================================================
// EXPORT
// =============================================================================

export default widgetMessenger;
