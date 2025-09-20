// js/services/widget-messenger.js - Widget Communication System
// CHANGE SUMMARY: Extracted widget communication logic from auth-manager.js, added structured logging, improved message handling

import { createLogger } from '../utils/logger.js';
import { events, EVENTS } from '../utils/event-emitter.js';

const logger = createLogger('WidgetMessenger');

/**
 * Widget communication manager
 * Handles all postMessage communication between main app and widget iframes
 */
export class WidgetMessenger {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.widgets = new Map(); // Track active widgets
    this.messageHandlers = new Map(); // Message type handlers
    
    // Setup message handlers
    this.setupMessageHandlers();
    
    // Listen for widget messages
    this.setupMessageListener();
    
    logger.info('Widget messenger initialized');
  }

  /**
   * Setup message handlers for different message types
   */
  setupMessageHandlers() {
    // Data request handlers
    this.messageHandlers.set('request-calendar-data', this.handleCalendarDataRequest.bind(this));
    this.messageHandlers.set('request-photos-data', this.handlePhotosDataRequest.bind(this));
    this.messageHandlers.set('refresh-calendar-data', this.handleCalendarRefreshRequest.bind(this));
    this.messageHandlers.set('refresh-photos-data', this.handlePhotosRefreshRequest.bind(this));
    this.messageHandlers.set('widget-data-request', this.handleGenericDataRequest.bind(this));
    
    // Widget lifecycle handlers
    this.messageHandlers.set('widget-ready', this.handleWidgetReady.bind(this));
    this.messageHandlers.set('widget-error', this.handleWidgetError.bind(this));
    
    logger.debug('Message handlers configured', {
      handlerCount: this.messageHandlers.size,
      handlers: Array.from(this.messageHandlers.keys())
    });
  }

  /**
   * Setup global message listener
   */
  setupMessageListener() {
    window.addEventListener('message', (event) => {
      this.handleMessage(event);
    });
    
    logger.debug('Global message listener setup complete');
  }

  /**
   * Handle incoming messages from widgets
   * @param {MessageEvent} event - Message event
   */
  async handleMessage(event) {
    // Validate message
    if (!event.data || !event.data.type) {
      return; // Ignore invalid messages
    }

    const { type, ...messageData } = event.data;
    const handler = this.messageHandlers.get(type);

    if (!handler) {
      logger.debug(`No handler for message type: ${type}`);
      return;
    }

    try {
      logger.widget('receive', type, this.getWidgetName(event.source), messageData);
      
      await handler(event, messageData);
      
    } catch (error) {
      logger.error(`Error handling message type ${type}`, {
        error: error.message,
        messageData
      });
      
      // Send error response if this was a request
      if (messageData.requestId) {
        this.sendErrorResponse(event.source, messageData.requestId, error.message);
      }
    }
  }

  // ==================== MESSAGE HANDLERS ====================

  /**
   * Handle calendar data request
   * @param {MessageEvent} event - Message event
   * @param {Object} messageData - Message data
   */
  async handleCalendarDataRequest(event, messageData) {
    const calendarData = await this.dataManager.getCalendarData();
    
    const response = {
      type: 'calendar-data-response',
      widget: messageData.widget,
      events: calendarData.events || [],
      calendars: calendarData.calendars || [],
      lastUpdated: calendarData.lastUpdated,
      isLoading: calendarData.isLoading,
      timestamp: Date.now()
    };
    
    this.sendMessage(event.source, response);
  }

  /**
   * Handle photos data request
   * @param {MessageEvent} event - Message event
   * @param {Object} messageData - Message data
   */
  async handlePhotosDataRequest(event, messageData) {
    const photosData = await this.dataManager.getPhotosData();
    
    const response = {
      type: 'photos-data-response',
      widget: messageData.widget,
      albums: photosData.albums || [],
      recentPhotos: photosData.recentPhotos || [],
      lastUpdated: photosData.lastUpdated,
      isLoading: photosData.isLoading,
      timestamp: Date.now()
    };
    
    this.sendMessage(event.source, response);
  }

  /**
   * Handle calendar refresh request
   * @param {MessageEvent} event - Message event
   * @param {Object} messageData - Message data
   */
  async handleCalendarRefreshRequest(event, messageData) {
    try {
      await this.dataManager.refreshCalendarData(true);
      
      // Send updated data
      await this.handleCalendarDataRequest(event, messageData);
      
    } catch (error) {
      logger.error('Calendar refresh failed', error);
      this.sendErrorMessage(event.source, 'calendar-refresh-error', error.message);
    }
  }

  /**
   * Handle photos refresh request
   * @param {MessageEvent} event - Message event
   * @param {Object} messageData - Message data
   */
  async handlePhotosRefreshRequest(event, messageData) {
    try {
      await this.dataManager.refreshPhotosData(true);
      
      // Send updated data
      await this.handlePhotosDataRequest(event, messageData);
      
    } catch (error) {
      logger.error('Photos refresh failed', error);
      this.sendErrorMessage(event.source, 'photos-refresh-error', error.message);
    }
  }

  /**
   * Handle generic widget data request
   * @param {MessageEvent} event - Message event
   * @param {Object} messageData - Message data
   */
  async handleGenericDataRequest(event, messageData) {
    try {
      let responseData = {};
      
      if (messageData.dataType === 'calendar') {
        responseData = await this.dataManager.handleCalendarRequest(messageData.requestType, messageData.params);
      } else if (messageData.dataType === 'photos') {
        responseData = await this.dataManager.handlePhotosRequest(messageData.requestType, messageData.params);
      } else {
        throw new Error(`Unknown data type: ${messageData.dataType}`);
      }
      
      // For backward compatibility, send the data directly (not nested)
      const response = {
        type: 'widget-data-response',
        requestId: messageData.requestId,
        success: true,
        // Flatten the response for calendar widget compatibility
        ...(messageData.dataType === 'calendar' && messageData.requestType === 'events' ? responseData : { data: responseData }),
        timestamp: Date.now()
      };
      
      event.source.postMessage(response, '*');
      
      logger.widget('send', 'data_response', this.getWidgetName(event.source), {
        requestId: messageData.requestId,
        dataType: messageData.dataType,
        success: true
      });
      
    } catch (error) {
      logger.error('Widget data request failed', {
        requestId: messageData.requestId,
        dataType: messageData.dataType,
        error: error.message
      });
      
      const errorResponse = {
        type: 'widget-data-response',
        requestId: messageData.requestId,
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
      
      event.source.postMessage(errorResponse, '*');
    }
  }

  /**
   * Handle widget ready notification
   * @param {MessageEvent} event - Message event
   * @param {Object} messageData - Message data
   */
  handleWidgetReady(event, messageData) {
    const widgetInfo = {
      name: messageData.widget || 'unknown',
      source: event.source,
      readyAt: Date.now(),
      ...messageData
    };

    this.widgets.set(event.source, widgetInfo);
    
    logger.success(`Widget ready: ${widgetInfo.name}`, {
      totalWidgets: this.widgets.size
    });
    
    events.widget.emitReady(widgetInfo);
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

  // ==================== BROADCASTING METHODS ====================

  /**
   * Broadcast Google APIs ready message to all widgets
   * @param {Object} apiCapabilities - API test results
   * @param {string} googleAccessToken - Google access token
   */
  broadcastGoogleAPIsReady(apiCapabilities, googleAccessToken) {
    const allWidgetIframes = document.querySelectorAll('iframe');
    
    if (allWidgetIframes.length === 0) {
      logger.debug('No widget iframes found for API broadcast');
      return;
    }

    logger.info(`Broadcasting Google APIs ready to ${allWidgetIframes.length} widgets`);
    
    const message = {
      type: 'google-apis-ready',
      apiCapabilities: apiCapabilities,
      googleAccessToken: googleAccessToken,
      timestamp: Date.now()
    };

    this.broadcastToWidgets(message, allWidgetIframes);
    
    // Retry for widgets that might not be ready yet
    setTimeout(() => {
      const retryIframes = document.querySelectorAll('iframe');
      if (retryIframes.length > 0) {
        logger.debug(`Retrying API broadcast to ${retryIframes.length} widgets`);
        this.broadcastToWidgets(message, retryIframes);
      }
    }, 2000);
  }

  /**
   * Broadcast theme change to all widgets
   * @param {string} theme - New theme name
   */
  broadcastThemeChange(theme) {
    const message = {
      type: 'theme-change',
      theme: theme,
      timestamp: Date.now()
    };

    logger.info(`Broadcasting theme change to widgets: ${theme}`);
    this.broadcastToAllWidgets(message);
  }

  /**
   * Broadcast settings update to all widgets
   * @param {Object} settings - Updated settings
   */
  broadcastSettingsUpdate(settings) {
    const message = {
      type: 'settings-update',
      settings: settings,
      timestamp: Date.now()
    };

    logger.info('Broadcasting settings update to widgets');
    this.broadcastToAllWidgets(message);
  }

  /**
   * Broadcast data update to relevant widgets
   * @param {string} dataType - Type of data updated (calendar, photos)
   * @param {Object} data - Updated data
   */
  broadcastDataUpdate(dataType, data) {
    const message = {
      type: `${dataType}-data-updated`,
      dataType: dataType,
      data: data,
      timestamp: Date.now()
    };

    logger.info(`Broadcasting ${dataType} data update to widgets`);
    this.broadcastToAllWidgets(message);
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Broadcast message to specific widget iframes
   * @param {Object} message - Message to send
   * @param {NodeList} iframes - Target iframes
   */
  broadcastToWidgets(message, iframes) {
    iframes.forEach((iframe, index) => {
      if (iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage(message, '*');
          
          logger.widget('send', message.type, this.getWidgetName(iframe.contentWindow), {
            widgetIndex: index + 1,
            widgetSrc: iframe.src
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
   * Broadcast message to all widgets
   * @param {Object} message - Message to send
   */
  broadcastToAllWidgets(message) {
    const allIframes = document.querySelectorAll('iframe');
    this.broadcastToWidgets(message, allIframes);
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
        hasRequestId: !!message.requestId
      });
      
    } catch (error) {
      logger.error('Failed to send message to widget', {
        error: error.message,
        messageType: message.type
      });
    }
  }

  /**
   * Send error response to widget
   * @param {Window} targetWindow - Target widget window
   * @param {string} requestId - Request ID
   * @param {string} errorMessage - Error message
   */
  sendErrorResponse(targetWindow, requestId, errorMessage) {
    const errorResponse = {
      type: 'widget-data-response',
      requestId: requestId,
      success: false,
      error: errorMessage,
      timestamp: Date.now()
    };

    this.sendMessage(targetWindow, errorResponse);
  }

  /**
   * Send error message to widget
   * @param {Window} targetWindow - Target widget window
   * @param {string} errorType - Error type
   * @param {string} errorMessage - Error message
   */
  sendErrorMessage(targetWindow, errorType, errorMessage) {
    const errorMessage = {
      type: errorType,
      error: errorMessage,
      timestamp: Date.now()
    };

    this.sendMessage(targetWindow, errorMessage);
  }

  /**
   * Get widget name from window source
   * @param {Window} windowSource - Widget window source
   * @returns {string} Widget name or 'unknown'
   */
  getWidgetName(windowSource) {
    // Try to get widget info from our registry
    const widgetInfo = this.widgets.get(windowSource);
    if (widgetInfo) {
      return widgetInfo.name;
    }

    // Try to get from iframe src
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (iframe.contentWindow === windowSource) {
        const src = iframe.src;
        const match = src.match(/\/widgets\/([^.]+)\.html/);
        if (match) {
          return match[1];
        }
        return 'iframe-widget';
      }
    }

    return 'unknown';
  }

  /**
   * Register widget manually
   * @param {Window} windowSource - Widget window source
   * @param {Object} widgetInfo - Widget information
   */
  registerWidget(windowSource, widgetInfo) {
    this.widgets.set(windowSource, {
      ...widgetInfo,
      registeredAt: Date.now()
    });

    logger.debug(`Widget registered: ${widgetInfo.name}`, {
      totalWidgets: this.widgets.size
    });
  }

  /**
   * Unregister widget
   * @param {Window} windowSource - Widget window source
   */
  unregisterWidget(windowSource) {
    const widgetInfo = this.widgets.get(windowSource);
    if (widgetInfo) {
      this.widgets.delete(windowSource);
      
      logger.debug(`Widget unregistered: ${widgetInfo.name}`, {
        totalWidgets: this.widgets.size
      });
    }
  }

  /**
   * Get all registered widgets
   * @returns {Array} Array of widget information
   */
  getRegisteredWidgets() {
    return Array.from(this.widgets.values());
  }

  /**
   * Get widget messenger status
   * @returns {Object} Status information
   */
  getStatus() {
    const iframesOnPage = document.querySelectorAll('iframe').length;
    const registeredWidgets = this.widgets.size;
    
    return {
      registeredWidgets: registeredWidgets,
      iframesOnPage: iframesOnPage,
      messageHandlers: this.messageHandlers.size,
      widgets: this.getRegisteredWidgets().map(widget => ({
        name: widget.name,
        readyAt: widget.readyAt,
        registeredAt: widget.registeredAt
      }))
    };
  }

  /**
   * Cleanup widget messenger
   */
  cleanup() {
    logger.info('Cleaning up widget messenger');
    
    // Clear widget registry
    this.widgets.clear();
    
    // Clear message handlers
    this.messageHandlers.clear();
    
    // Note: We don't remove the global message listener as it might be used by other parts
    
    logger.success('Widget messenger cleanup complete');
  }
}
