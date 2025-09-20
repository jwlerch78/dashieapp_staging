// js/utils/event-emitter.js - Simple Event Coordination System
// CHANGE SUMMARY: New event system for coordinating between auth, data, and widget modules

import { createLogger } from './logger.js';

const logger = createLogger('EventEmitter');

/**
 * Simple event emitter for coordinating between modules
 * Provides a clean way to decouple auth, data, and widget communication
 */
export class EventEmitter {
  constructor() {
    this.events = new Map();
    this.maxListeners = 50; // Prevent memory leaks
  }

  /**
   * Add an event listener
   * @param {string} eventName - Name of the event
   * @param {Function} listener - Event handler function
   * @returns {Function} Unsubscribe function
   */
  on(eventName, listener) {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }

    const listeners = this.events.get(eventName);
    
    if (listeners.length >= this.maxListeners) {
      logger.warn(`Max listeners (${this.maxListeners}) reached for event: ${eventName}`);
    }

    listeners.push(listener);
    logger.debug(`Listener added for event: ${eventName}`, {
      listenerCount: listeners.length
    });

    // Return unsubscribe function
    return () => this.off(eventName, listener);
  }

  /**
   * Add a one-time event listener
   * @param {string} eventName - Name of the event
   * @param {Function} listener - Event handler function
   * @returns {Function} Unsubscribe function
   */
  once(eventName, listener) {
    const unsubscribe = this.on(eventName, (...args) => {
      unsubscribe();
      listener(...args);
    });
    return unsubscribe;
  }

  /**
   * Remove an event listener
   * @param {string} eventName - Name of the event
   * @param {Function} listener - Event handler function to remove
   */
  off(eventName, listener) {
    const listeners = this.events.get(eventName);
    if (!listeners) return;

    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
      logger.debug(`Listener removed for event: ${eventName}`, {
        listenerCount: listeners.length
      });

      // Clean up empty event arrays
      if (listeners.length === 0) {
        this.events.delete(eventName);
      }
    }
  }

  /**
   * Emit an event to all listeners
   * @param {string} eventName - Name of the event
   * @param {...any} args - Arguments to pass to listeners
   */
  emit(eventName, ...args) {
    const listeners = this.events.get(eventName);
    if (!listeners || listeners.length === 0) {
      logger.debug(`No listeners for event: ${eventName}`);
      return;
    }

    logger.debug(`Emitting event: ${eventName}`, {
      listenerCount: listeners.length,
      hasData: args.length > 0
    });

    // Call all listeners
    listeners.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        logger.error(`Error in event listener for ${eventName}`, error);
      }
    });
  }

  /**
   * Remove all listeners for an event (or all events)
   * @param {string} [eventName] - Specific event to clear, or all if not provided
   */
  removeAllListeners(eventName) {
    if (eventName) {
      this.events.delete(eventName);
      logger.debug(`All listeners removed for event: ${eventName}`);
    } else {
      const eventCount = this.events.size;
      this.events.clear();
      logger.debug(`All listeners removed for all events`, {
        clearedEvents: eventCount
      });
    }
  }

  /**
   * Get list of events with listener counts
   * @returns {Object} Event summary
   */
  getEventSummary() {
    const summary = {};
    for (const [eventName, listeners] of this.events) {
      summary[eventName] = listeners.length;
    }
    return summary;
  }
}

// Create a global event emitter instance for the app
const globalEvents = new EventEmitter();

/**
 * Predefined event names for consistency across the app
 */
export const EVENTS = {
  // Auth events
  AUTH_INITIALIZED: 'auth:initialized',
  AUTH_SUCCESS: 'auth:success',
  AUTH_FAILURE: 'auth:failure',
  AUTH_SIGNOUT: 'auth:signout',
  TOKEN_REFRESHED: 'auth:token_refreshed',

  // Data events
  DATA_LOADING: 'data:loading',
  DATA_LOADED: 'data:loaded',
  DATA_ERROR: 'data:error',
  DATA_CACHE_UPDATED: 'data:cache_updated',

  // Widget events
  WIDGET_READY: 'widget:ready',
  WIDGET_REQUEST: 'widget:request',
  WIDGET_RESPONSE: 'widget:response',

  // App events
  APP_INITIALIZED: 'app:initialized',
  THEME_CHANGED: 'app:theme_changed',
  SETTINGS_UPDATED: 'app:settings_updated'
};

/**
 * Convenience functions for common event patterns
 */
export const events = {
  // Global emitter access
  on: (eventName, listener) => globalEvents.on(eventName, listener),
  once: (eventName, listener) => globalEvents.once(eventName, listener),
  off: (eventName, listener) => globalEvents.off(eventName, listener),
  emit: (eventName, ...args) => globalEvents.emit(eventName, ...args),
  removeAllListeners: (eventName) => globalEvents.removeAllListeners(eventName),
  getSummary: () => globalEvents.getEventSummary(),

  // Typed event helpers
  auth: {
    onInitialized: (listener) => globalEvents.on(EVENTS.AUTH_INITIALIZED, listener),
    onSuccess: (listener) => globalEvents.on(EVENTS.AUTH_SUCCESS, listener),
    onFailure: (listener) => globalEvents.on(EVENTS.AUTH_FAILURE, listener),
    onSignout: (listener) => globalEvents.on(EVENTS.AUTH_SIGNOUT, listener),
    
    emitInitialized: (data) => globalEvents.emit(EVENTS.AUTH_INITIALIZED, data),
    emitSuccess: (user) => globalEvents.emit(EVENTS.AUTH_SUCCESS, user),
    emitFailure: (error) => globalEvents.emit(EVENTS.AUTH_FAILURE, error),
    emitSignout: () => globalEvents.emit(EVENTS.AUTH_SIGNOUT)
  },

  data: {
    onLoading: (listener) => globalEvents.on(EVENTS.DATA_LOADING, listener),
    onLoaded: (listener) => globalEvents.on(EVENTS.DATA_LOADED, listener),
    onError: (listener) => globalEvents.on(EVENTS.DATA_ERROR, listener),
    
    emitLoading: (dataType) => globalEvents.emit(EVENTS.DATA_LOADING, dataType),
    emitLoaded: (dataType, data) => globalEvents.emit(EVENTS.DATA_LOADED, dataType, data),
    emitError: (dataType, error) => globalEvents.emit(EVENTS.DATA_ERROR, dataType, error)
  },

  widget: {
    onReady: (listener) => globalEvents.on(EVENTS.WIDGET_READY, listener),
    onRequest: (listener) => globalEvents.on(EVENTS.WIDGET_REQUEST, listener),
    
    emitReady: (widgetInfo) => globalEvents.emit(EVENTS.WIDGET_READY, widgetInfo),
    emitRequest: (request) => globalEvents.emit(EVENTS.WIDGET_REQUEST, request)
  }
};

// Default export
export default {
  EventEmitter,
  events,
  EVENTS
};
