// js/services/widget-messenger.js - Clean Widget Communication System
// CHANGE SUMMARY: Added deduplication to prevent sending the same theme repeatedly to widgets

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
    
    logger.info('Widget messenger initialized with deduplication');
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
      logger.debug('WidgetMessenger loaded current theme:', currentTheme);
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
      if (this.widgets.size > 0) {
        this.broadcastCurrentState();
      }
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
      logger.info('Theme change event received', themeData);
      const oldTheme = this.currentState.theme;
      this.currentState.theme = themeData.theme;
      
      // Only broadcast if theme actually changed
      if (oldTheme !== themeData.theme && this.widgets.size > 0) {
        logger.info('Broadcasting theme change to widgets', { 
          from: oldTheme, 
          to: themeData.theme,
          widgetCount: this.widgets.size 
        });
        this.broadcastCurrentState();
      } else if (oldTheme === themeData.theme) {
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
      logger.widget('receive', messageData.type, messageData.widget || 'unknown');

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
  
    logger.info(`State updated: ${dataType}`, {
      eventsCount: data.events?.length,
      albumsCount: data.albums?.length,
      lastUpdated: data.lastUpdated
    });

    // Broadcast current state with deduplication
    this.broadcastCurrentState();
  }

  /**
   * Broadcast current state to all widgets with deduplication
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

    logger.info('State broadcast completed', {
      sent: broadcastCount,
      skipped: skippedCount,
      hasCalendar: !!this.currentState.calendar,
      hasPhotos: !!this.currentState.photos,
      authReady: this.currentState.auth.ready,
      theme: this.currentState.theme
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
    if (this.hasDataChanged(lastSent.calendar, this.currentState.calendar)) {
      return true;
    }

    // Check if photos data has changed
    if (this.hasDataChanged(lastSent.photos, this.currentState.photos)) {
      return true;
    }

    // Check if auth state has changed
    if (this.hasAuthChanged(lastSent.auth, this.currentState.auth)) {
      return true;
    }

    // No changes detected
    return false;
  }

  /**
   * Check if data has changed between two data objects
   * @param {Object} oldData - Previous data
   * @param {Object} newData - New data
   * @returns {boolean} Whether data has changed
   */
  hasDataChanged(oldData, newData) {
    // If both are null/undefined, no change
    if (!oldData && !newData) return false;
    
    // If one is null/undefined and other isn't, changed
    if (!oldData || !newData) return true;
    
    // Compare lastUpdated timestamps
    if (oldData.lastUpdated !== newData.lastUpdated) return true;
    
    // Compare data array lengths
    if ((oldData.events?.length || 0) !== (newData.events?.length || 0)) return true;
    if ((oldData.albums?.length || 0) !== (newData.albums?.length || 0)) return true;
    
    return false;
  }

  /**
   * Check if auth state has changed
   * @param {Object} oldAuth - Previous auth state
   * @param {Object} newAuth - New auth state
   * @returns {boolean} Whether auth has changed
   */
  hasAuthChanged(oldAuth, newAuth) {
    if (oldAuth.ready !== newAuth.ready) return true;
    if (oldAuth.user?.email !== newAuth.user?.email) return true;
    return false;
  }

  /**
   * Update the last sent state for a widget
   * @param {Window} widgetWindow - Target widget window
   */
  updateLastSentState(widgetWindow) {
    // Deep copy current state to avoid reference issues
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
    
    logger.success(`Widget ready: ${widgetInfo.name}`, {
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
    
    logger.debug(`Sent current state to ${widgetName}`, {
      hasCalendar: !!this.currentState.calendar,
      hasPhotos: !!this.currentState.photos,
      authReady: this.currentState.auth.ready,
      theme: this.currentState.theme
    });
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
      
      logger.widget('send', message.type, this.getWidgetName(targetWindow), {
        action: message.action
      });
      
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