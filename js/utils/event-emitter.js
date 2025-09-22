// js/utils/event-emitter.js - Enhanced Event System for Dashie
// CHANGE SUMMARY: Added new events for theme changes, auth events, settings changes, and token management

import { createLogger } from './logger.js';

const logger = createLogger('EventSystem');

/**
 * Enhanced event emitter for decoupled component communication
 */
class EventEmitter {
  constructor() {
    this.listeners = new Map();
    this.maxListeners = 50; // Prevent memory leaks
    this.debugMode = false;
  }

  /**
   * Add event listener with optional priority and once flag
   */
  on(event, callback, options = {}) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const listeners = this.listeners.get(event);
    
    // Check max listeners limit
    if (listeners.length >= this.maxListeners) {
      logger.warn(`Max listeners (${this.maxListeners}) reached for event: ${event}`);
      return false;
    }

    const listenerObj = {
      callback,
      once: options.once || false,
      priority: options.priority || 0,
      id: this.generateListenerId()
    };

    listeners.push(listenerObj);
    
    // Sort by priority (higher priority first)
    listeners.sort((a, b) => b.priority - a.priority);

    if (this.debugMode) {
      logger.debug(`Listener added for event: ${event} (ID: ${listenerObj.id})`);
    }

    return listenerObj.id;
  }

  /**
   * Add one-time event listener
   */
  once(event, callback, options = {}) {
    return this.on(event, callback, { ...options, once: true });
  }

  /**
   * Remove event listener by ID or callback
   */
  off(event, callbackOrId) {
    if (!this.listeners.has(event)) return false;

    const listeners = this.listeners.get(event);
    const initialLength = listeners.length;

    if (typeof callbackOrId === 'string') {
      // Remove by ID
      const index = listeners.findIndex(l => l.id === callbackOrId);
      if (index !== -1) {
        listeners.splice(index, 1);
        if (this.debugMode) {
          logger.debug(`Listener removed by ID: ${callbackOrId} for event: ${event}`);
        }
      }
    } else if (typeof callbackOrId === 'function') {
      // Remove by callback function
      for (let i = listeners.length - 1; i >= 0; i--) {
        if (listeners[i].callback === callbackOrId) {
          listeners.splice(i, 1);
          if (this.debugMode) {
            logger.debug(`Listener removed by callback for event: ${event}`);
          }
        }
      }
    }

    // Clean up empty listener arrays
    if (listeners.length === 0) {
      this.listeners.delete(event);
    }

    return listeners.length !== initialLength;
  }

  /**
   * Emit event with data and error handling
   */
  emit(event, data = {}) {
    if (!this.listeners.has(event)) {
      if (this.debugMode) {
        logger.debug(`No listeners for event: ${event}`);
      }
      return true;
    }

    const listeners = this.listeners.get(event);
    const listenersToRemove = [];
    let successCount = 0;
    let errorCount = 0;

    // Create event object
    const eventObj = {
      type: event,
      data,
      timestamp: Date.now(),
      preventDefault: false
    };

    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i];
      
      try {
        listener.callback(eventObj.data, eventObj);
        successCount++;
        
        // Mark one-time listeners for removal
        if (listener.once) {
          listenersToRemove.push(i);
        }

        // Check if event was prevented
        if (eventObj.preventDefault) {
          logger.debug(`Event ${event} was prevented by listener ${listener.id}`);
          break;
        }
      } catch (error) {
        errorCount++;
        logger.error(`Error in event listener for ${event}:`, error);
        // Continue executing other listeners even if one fails
      }
    }

    // Remove one-time listeners (in reverse order to maintain indices)
    for (let i = listenersToRemove.length - 1; i >= 0; i--) {
      listeners.splice(listenersToRemove[i], 1);
    }

    // Clean up empty listener arrays
    if (listeners.length === 0) {
      this.listeners.delete(event);
    }

    if (this.debugMode) {
      logger.debug(`Event ${event} emitted to ${successCount} listeners (${errorCount} errors)`);
    }

    return errorCount === 0;
  }

  /**
   * Remove all listeners for an event or all events
   */
  removeAllListeners(event = null) {
    if (event) {
      const removed = this.listeners.has(event);
      this.listeners.delete(event);
      if (this.debugMode && removed) {
        logger.debug(`All listeners removed for event: ${event}`);
      }
      return removed;
    } else {
      const eventCount = this.listeners.size;
      this.listeners.clear();
      if (this.debugMode) {
        logger.debug(`All listeners removed for ${eventCount} events`);
      }
      return eventCount > 0;
    }
  }

  /**
   * Get listener count for event or total
   */
  listenerCount(event = null) {
    if (event) {
      return this.listeners.has(event) ? this.listeners.get(event).length : 0;
    } else {
      let total = 0;
      for (const listeners of this.listeners.values()) {
        total += listeners.length;
      }
      return total;
    }
  }

  /**
   * Get list of events with listeners
   */
  eventNames() {
    return Array.from(this.listeners.keys());
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    logger.info(`Event system debug mode: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Generate unique listener ID
   */
  generateListenerId() {
    return 'listener_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Get system stats
   */
  getStats() {
    const events = this.eventNames();
    const stats = {
      totalEvents: events.length,
      totalListeners: this.listenerCount(),
      events: {}
    };

    events.forEach(event => {
      stats.events[event] = this.listenerCount(event);
    });

    return stats;
  }
}

/**
 * Enhanced event constants with new theme and auth events
 */
export const EVENTS = {
  // Authentication Events
  AUTH_READY: 'auth-ready',
  AUTH_FAILED: 'auth-failed',
  AUTH_CLEARED: 'auth-cleared',
  AUTH_REPAIRED: 'auth-repaired',
  USER_STORED: 'user-stored',
  USER_CLEARED: 'user-cleared',
  TOKEN_STORED: 'token-stored',
  TOKEN_CLEARED: 'token-cleared',
  TOKEN_REFRESH_NEEDED: 'token-refresh-needed',
  TOKEN_REFRESHED: 'token-refreshed',

  // Theme Events
  THEME_CHANGED: 'theme-changed',
  THEME_LOADED: 'theme-loaded',

  // Settings Events
  SETTINGS_CHANGED: 'settings-changed',
  SETTINGS_LOADED: 'settings-loaded',
  SETTINGS_SAVED: 'settings-saved',
  SETTINGS_READY: 'settings-ready',

  // Widget Events
  WIDGET_LOADED: 'widget-loaded',
  WIDGET_ERROR: 'widget-error',
  WIDGET_MESSAGE: 'widget-message',

  // Navigation Events
  FOCUS_CHANGED: 'focus-changed',
  NAVIGATION_INPUT: 'navigation-input',

  // Data Events
  DATA_LOADED: 'data-loaded',
  DATA_ERROR: 'data-error',
  DATA_REFRESHED: 'data-refreshed',

  // System Events
  APP_READY: 'app-ready',
  APP_ERROR: 'app-error',
  SLEEP_MODE: 'sleep-mode',
  WAKE_UP: 'wake-up'
};

// Create singleton instance
export const events = new EventEmitter();

// Set up global error handler for unhandled event errors
window.addEventListener('error', (event) => {
  events.emit(EVENTS.APP_ERROR, {
    type: 'unhandled-error',
    error: event.error,
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

// Set up global promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  events.emit(EVENTS.APP_ERROR, {
    type: 'unhandled-promise-rejection',
    reason: event.reason,
    promise: event.promise
  });
});

// Export for convenience
export default events;

/**
 * Typed event helpers for better developer experience
 * Maintains compatibility with existing code
 */
export const eventHelpers = {
  auth: {
    onInitialized: (listener) => events.on(EVENTS.AUTH_READY, listener),
    onSuccess: (listener) => events.on(EVENTS.AUTH_READY, listener),
    onFailure: (listener) => events.on(EVENTS.AUTH_FAILED, listener),
    onSignout: (listener) => events.on(EVENTS.AUTH_CLEARED, listener),
    
    emitInitialized: (data) => events.emit(EVENTS.AUTH_READY, data),
    emitSuccess: (user) => events.emit(EVENTS.AUTH_READY, user),
    emitFailure: (error) => events.emit(EVENTS.AUTH_FAILED, error),
    emitSignout: () => events.emit(EVENTS.AUTH_CLEARED)
  },

  data: {
    onLoading: (listener) => events.on(EVENTS.DATA_LOADED, listener),
    onLoaded: (listener) => events.on(EVENTS.DATA_LOADED, listener),
    onError: (listener) => events.on(EVENTS.DATA_ERROR, listener),
    
    emitLoading: (dataType) => events.emit(EVENTS.DATA_LOADED, dataType),
    emitLoaded: (dataType, data) => events.emit(EVENTS.DATA_LOADED, dataType, data),
    emitError: (dataType, error) => events.emit(EVENTS.DATA_ERROR, dataType, error)
  },

  widget: {
    onReady: (listener) => events.on(EVENTS.WIDGET_LOADED, listener),
    onRequest: (listener) => events.on(EVENTS.WIDGET_MESSAGE, listener),
    
    emitReady: (widgetInfo) => events.emit(EVENTS.WIDGET_LOADED, widgetInfo),
    emitRequest: (request) => events.emit(EVENTS.WIDGET_MESSAGE, request)
  }
};

// Add event helpers to the main events export for backward compatibility
events.auth = eventHelpers.auth;
events.data = eventHelpers.data;
events.widget = eventHelpers.widget;