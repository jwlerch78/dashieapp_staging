// js/services/widget-messenger.js - Clean Widget Communication System
// CHANGE SUMMARY: Removed widgets.size check from theme broadcast - broadcastCurrentState() already finds iframes dynamically, so the check was preventing theme updates when widgets Map is empty

import { createLogger } from '../utils/logger.js';
import { events as eventSystem, EVENTS } from '../utils/event-emitter.js';

const logger = createLogger('WidgetMessenger');

/**
 * Clean widget communication manager
 * Uses generic broadcasting pattern with deduplication
 */
export class WidgetMessenger {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.widgets = new Map(); // Track active widgets
    
    // Track last sent state to each widget for deduplication
    this.lastSentState = new Map(); // widgetWindow -> lastState
    
    // Current system state - sent to widgets in broadcasts
    this.currentState = {
      calendar: null,
      photos: null,
      auth: { ready: false, user: null },
      theme: 'dark'
    };
    
    this.checkExistingAuthState();
    this.setupEventListeners();
    this.setupMessageListener();
    
    logger.info('Widget messenger initialized');
  }

  // Check for existing auth state and theme
  checkExistingAuthState() {
    // Check if there's already an authenticated user
    if (window.dashieAuth && window.dashieAuth.isUserAuthenticated()) {
      const user = window.dashieAuth.getUser();
      this.currentState.auth = { ready: true, user };
    }

    // Also check for current theme
    try {
      const currentTheme = localStorage.getItem('dashie-theme') || 'dark';
      this.currentState.theme = currentTheme;
      logger.debug('Initial theme state set', { theme: currentTheme });
    } catch (error) {
      this.currentState.theme = 'dark';
    }
  }

  /**
   * Set up event listeners for data and auth changes
   */
  setupEventListeners() {
    // Listen for data loaded events from DataManager
    eventSystem.data.onLoaded((dataType, data) => {
      logger.info(`Data loaded event received: ${dataType}`);
      this.updateStateAndBroadcast(dataType, data);
    });

    // Listen for auth events
    eventSystem.auth.onSuccess((user) => {
      logger.info('Auth success event received');
      this.currentState.auth = { ready: true, user };
      this.broadcastCurrentState();
    });

    eventSystem.auth.onSignout(() => {
      logger.info('Auth signout event received');
      this.currentState.auth = { ready: false, user: null };
      this.currentState.calendar = null;
      this.currentState.photos = null;
      // Clear last sent state on signout
      this.lastSentState.clear();
      this.broadcastCurrentState();
    });

    // Listen for theme changes
    eventSystem.on(EVENTS.THEME_CHANGED, (themeData) => {
      const oldTheme = this.currentState.theme;
      this.currentState.theme = themeData.theme;
      
      // Only broadcast if theme actually changed
      // REMOVED: && this.widgets.size > 0 check
      // broadcastCurrentState() finds iframes dynamically, so no need to check widgets Map
      if (oldTheme !== themeData.theme) {
        logger.info('Theme changed, broadcasting to widgets', { 
          from: oldTheme, 
          to: themeData.theme 
        });
        this.broadcastCurrentState();
      } else {
        logger.debug('Theme unchanged, skipping broadcast', { theme: themeData.theme });
      }
    });

    logger.debug('Event listeners configured with deduplication');
  }

  /**
   * Set up message listener for widget communications
   */
  setupMessageListener() {
    window.addEventListener('message', (event) => {
      if (!event.data || !event.data.type) return;

      const messageData = event.data;

      switch (messageData.type) {
        case 'widget-ready':
          this.handleWidgetReady(event, messageData);
          break;
          
        case 'widget-error':
          this.handleWidgetError(event, messageData);
          break;

        default:
          logger.debug('Unhandled widget message type:', messageData.type);
      }
    });

    logger.debug('Message listener configured');
  }

  // ==================== STATE MANAGEMENT ====================

  /**
   * Update state and broadcast to all widgets
   * @param {string} dataType - Type of data updated
   * @param {Object} data - Updated data
   */
  updateStateAndBroadcast(dataType, data) {
    // Update current state
    this.currentState[dataType] = data;
  
    // Broadcast current state with deduplication
    this.broadcastCurrentState();
  }

  /**
   * Broadcast current state to all widgets with deduplication
   * NOTE: Finds iframes dynamically, doesn't rely on widgets Map
   */
  broadcastCurrentState() {
    const allIframes = document.querySelectorAll('iframe');
    let broadcastCount = 0;
    let skippedCount = 0;
    
    allIframes.forEach((iframe, index) => {
      if (iframe.contentWindow) {
        // Check if we need to send update to this widget
        if (this.shouldSendStateUpdate(iframe.contentWindow)) {
          const message = {
            type: 'widget-update',
            action: 'state-update',
            payload: {
              ...this.currentState,
              timestamp: Date.now()
            }
          };

          this.sendMessage(iframe.contentWindow, message);
          
          // Update last sent state for this widget
          this.updateLastSentState(iframe.contentWindow);
          broadcastCount++;
        } else {
          skippedCount++;
        }
      }
    });

    logger.debug('Broadcast complete', { 
      totalIframes: allIframes.length,
      broadcastCount, 
      skippedCount 
    });
  }

  /**
   * Check if we should send a state update to a widget (deduplication)
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

    // Check if calendar data has changed
    if (this.hasDataChanged('calendar', lastSent)) {
      return true;
    }

    // Check if photos data has changed
    if (this.hasDataChanged('photos', lastSent)) {
      return true;
    }

    // No changes detected
    return false;
  }

  /**
   * Check if data has changed for a given type
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
   * @param {Window} widgetWindow - Widget window
   */
  updateLastSentState(widgetWindow) {
    this.lastSentState.set(widgetWindow, {
      calendar: this.currentState.calendar ? { ...this.currentState.calendar } : null,
      photos: this.currentState.photos ? { ...this.currentState.photos } : null,
      auth: { ...this.currentState.auth },
      theme: this.currentState.theme
    });
  }

  // ==================== WIDGET LIFECYCLE HANDLING ====================

  /**
   * Handle widget ready notification
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
    
    logger.info('Widget registered', { 
      name: widgetInfo.name, 
      totalWidgets: this.widgets.size 
    });
    
    // Send current state to the new widget (always send to new widgets)
    this.sendCurrentStateToWidget(event.source, widgetInfo.name);
    
    eventSystem.widget.emitReady(widgetInfo);
  }

  /**
   * Handle widget error notification
   * @param {MessageEvent} event - Message event
   * @param {Object} messageData - Message data
   */
  handleWidgetError(event, messageData) {
    const widgetName = this.getWidgetName(event.source);
    
    logger.error(`Widget error from ${widgetName}`, {
      error: messageData.error,
      details: messageData.details
    });
  }

  /**
   * Send current state to a specific widget
   * @param {Window} targetWindow - Target widget window
   * @param {string} widgetName - Widget name for logging
   */
  sendCurrentStateToWidget(targetWindow, widgetName) {
    const message = {
      type: 'widget-update',
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

  // ==================== UTILITY METHODS ====================

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
   * Clean up widget messenger
   */
  cleanup() {
    logger.info('Cleaning up widget messenger');
    
    this.widgets.clear();
    this.lastSentState.clear();
    this.currentState = {
      calendar: null,
      photos: null,
      auth: { ready: false, user: null },
      theme: 'dark'
    };
  }

  /**
   * Get status for debugging
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      totalWidgets: this.widgets.size,
      widgets: Array.from(this.widgets.values()).map(w => ({
        name: w.name,
        readyAt: w.readyAt
      })),
      currentState: {
        hasCalendar: !!this.currentState.calendar,
        hasPhotos: !!this.currentState.photos,
        authReady: this.currentState.auth.ready,
        theme: this.currentState.theme
      },
      lastSentStates: this.lastSentState.size
    };
  }
}