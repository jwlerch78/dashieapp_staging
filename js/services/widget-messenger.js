// js/services/widget-messenger.js - Clean Widget Communication System
// CHANGE SUMMARY: Refactored to use generic broadcasting pattern, removed legacy request-response handlers, event-driven updates

import { createLogger } from '../utils/logger.js';
import { events as eventSystem, EVENTS } from '../utils/event-emitter.js';

const logger = createLogger('WidgetMessenger');

/**
 * Clean widget communication manager
 * Uses generic broadcasting pattern - no request-response, everything is push-based
 */
export class WidgetMessenger {
  constructor(dataManager) {
    
 console.log('DEBUG: Setting up auth event debugging...');
  
  const originalEmit = eventSystem.emit.bind(eventSystem);
  
    this.dataManager = dataManager;
    this.widgets = new Map(); // Track active widgets
    
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
    
    logger.info('Clean widget messenger initialized - generic broadcasting only');
  }


  // NEW: Method to check for existing auth state
checkExistingAuthState() {
  // Check if there's already an authenticated user
  if (window.dashieAuth && window.dashieAuth.isUserAuthenticated()) {
    const user = window.dashieAuth.getUser();
    this.currentState.auth = { ready: true, user };
  }
}


  /**
   * Set up event listeners for data and auth changes
   * CLEANED UP: Only broadcast to registered widgets, rely on individual sends for new widgets
   */
  setupEventListeners() {
    // Listen for data loaded events from DataManager
    eventSystem.data.onLoaded((dataType, data) => {
      logger.info(`Data loaded event received: ${dataType}`);
      this.updateStateAndBroadcast(dataType, data);
    });

    // Listen for auth events - update state only, widgets get state when they register
    eventSystem.auth.onSuccess((user) => {
      logger.info('Auth success event received');
      this.currentState.auth = { ready: true, user };
      // Only broadcast if we have registered widgets, otherwise they'll get state on registration
      if (this.widgets.size > 0) {
        this.broadcastCurrentState();
      }
    });

    eventSystem.auth.onSignout(() => {
      logger.info('Auth signout event received');
      this.currentState.auth = { ready: false, user: null };
      this.currentState.calendar = null;
      this.currentState.photos = null;
      // Always broadcast signout to clear widget state
      this.broadcastCurrentState();
    });

    // Listen for theme changes - update state only, widgets get theme when they register
    eventSystem.on(EVENTS.THEME_CHANGED, (themeData) => {
      logger.info('Theme change event received', themeData);
      this.currentState.theme = themeData.theme;
      // Only broadcast if we have registered widgets
      if (this.widgets.size > 0) {
        this.broadcastCurrentState();
      }
    });

    logger.debug('Event listeners configured - broadcasts only to registered widgets');
  }

  /**
   * Set up message listener for widget communications
   */
  setupMessageListener() {
    window.addEventListener('message', (event) => {
      if (!event.data || !event.data.type) return;

      const messageData = event.data;
      
      logger.widget('receive', messageData.type, messageData.widget || 'unknown');

      // Handle only essential widget lifecycle messages
      switch (messageData.type) {
        case 'widget-ready':
          this.handleWidgetReady(event, messageData);
          break;
          
        case 'widget-error':
          this.handleWidgetError(event, messageData);
          break;

        default:
          // Log unhandled message types for debugging
          logger.debug('Unhandled widget message type:', messageData.type);
      }
    });

    logger.debug('Message listener configured for widget lifecycle only');
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

    // Broadcast complete current state to all widgets
    this.broadcastCurrentState();
  }

  /**
   * Broadcast complete current state to all widgets
   */
  broadcastCurrentState() {
    const message = {
      type: 'widget-update',
      action: 'state-update',
      payload: {
        ...this.currentState,
        timestamp: Date.now()
      }
    };

    logger.info('Broadcasting current state to all widgets', {
      widgetCount: this.widgets.size,
      hasCalendar: !!this.currentState.calendar,
      hasPhotos: !!this.currentState.photos,
      authReady: this.currentState.auth.ready
    });

    this.broadcastToAllWidgets(message);
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

    // Immediately send current state to the new widget
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
    
    logger.debug(`Sent current state to ${widgetName}`, {
      hasCalendar: !!this.currentState.calendar,
      hasPhotos: !!this.currentState.photos,
      authReady: this.currentState.auth.ready
    });
  }

  // ==================== BROADCASTING METHODS ====================

  /**
   * Broadcast message to all widgets
   * @param {Object} message - Message to send
   */
  broadcastToAllWidgets(message) {
    const allIframes = document.querySelectorAll('iframe');
    
    allIframes.forEach((iframe, index) => {
      if (iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage(message, '*');
          
          logger.widget('send', message.type, this.getWidgetName(iframe.contentWindow), {
            action: message.action,
            widgetIndex: index + 1
          });
          
        } catch (error) {
          logger.error(`Failed to send message to widget ${index + 1}`, {
            error: error.message,
            widgetSrc: iframe.src
          });
        }
      }
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
      }
    };
  }
}