// js/core/app-comms.js
// Central pub/sub event bus for cross-module communication
// v1.0 - 10/15/25 - Initial implementation for refactored architecture

import { createLogger } from '../utils/logger.js';

const logger = createLogger('AppComms');

/**
 * AppComms - Central Publish/Subscribe Event Bus
 *
 * Purpose:
 * - Enables decoupled communication between modules
 * - Core does not depend on specific modules
 * - Modules can listen to events without tight coupling
 *
 * Usage:
 *   // Subscribe to an event
 *   const unsubscribe = AppComms.subscribe('module:changed', (data) => {
 *     logger.info('Module changed to:', data.module);
 *   });
 *
 *   // Publish an event
 *   AppComms.publish('module:changed', { module: 'dashboard' });
 *
 *   // Unsubscribe when done
 *   unsubscribe();
 */
class AppComms {
  constructor() {
    // Map of event names to arrays of callback functions
    this.subscribers = new Map();

    // Statistics for debugging
    this.stats = {
      subscribes: 0,
      unsubscribes: 0,
      publishes: 0
    };

    logger.verbose('AppComms initialized');
  }

  /**
   * Subscribe to an event
   * @param {string} eventName - Name of the event to listen for
   * @param {Function} callback - Function to call when event is published
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventName, callback) {
    if (!eventName || typeof eventName !== 'string') {
      logger.error('Invalid event name', eventName);
      return () => {};
    }

    if (typeof callback !== 'function') {
      logger.error('Callback must be a function', { eventName });
      return () => {};
    }

    // Create subscriber array if it doesn't exist
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, []);
    }

    // Add callback to subscribers
    this.subscribers.get(eventName).push(callback);
    this.stats.subscribes++;

    logger.debug(`Subscribed to event: ${eventName}`, {
      totalSubscribers: this.subscribers.get(eventName).length
    });

    // Return unsubscribe function
    return () => this.unsubscribe(eventName, callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventName - Name of the event
   * @param {Function} callback - The callback function to remove
   */
  unsubscribe(eventName, callback) {
    if (!this.subscribers.has(eventName)) {
      logger.warn(`Attempted to unsubscribe from non-existent event: ${eventName}`);
      return;
    }

    const callbacks = this.subscribers.get(eventName);
    const index = callbacks.indexOf(callback);

    if (index > -1) {
      callbacks.splice(index, 1);
      this.stats.unsubscribes++;

      logger.debug(`Unsubscribed from event: ${eventName}`, {
        remainingSubscribers: callbacks.length
      });

      // Clean up empty subscriber arrays
      if (callbacks.length === 0) {
        this.subscribers.delete(eventName);
      }
    } else {
      logger.warn(`Callback not found for event: ${eventName}`);
    }
  }

  /**
   * Publish an event to all subscribers
   * @param {string} eventName - Name of the event to publish
   * @param {any} data - Data to pass to subscribers
   */
  publish(eventName, data = null) {
    if (!eventName || typeof eventName !== 'string') {
      logger.error('Invalid event name', eventName);
      return;
    }

    if (!this.subscribers.has(eventName)) {
      logger.debug(`No subscribers for event: ${eventName}`);
      return;
    }

    const callbacks = this.subscribers.get(eventName);
    this.stats.publishes++;

    logger.debug(`Publishing event: ${eventName}`, {
      subscriberCount: callbacks.length,
      dataPreview: this._getDataPreview(data)
    });

    // Call each subscriber's callback
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        logger.error(`Error in event subscriber for ${eventName}`, error);
      }
    });
  }

  /**
   * Unsubscribe all callbacks for a specific event
   * @param {string} eventName - Name of the event to clear
   */
  unsubscribeAll(eventName) {
    if (this.subscribers.has(eventName)) {
      const count = this.subscribers.get(eventName).length;
      this.subscribers.delete(eventName);
      this.stats.unsubscribes += count;

      logger.info(`Unsubscribed all ${count} callbacks from event: ${eventName}`);
    }
  }

  /**
   * Clear all subscriptions
   * Used during cleanup or reset
   */
  clear() {
    const totalSubscribers = Array.from(this.subscribers.values())
      .reduce((sum, arr) => sum + arr.length, 0);

    this.subscribers.clear();
    this.stats.unsubscribes += totalSubscribers;

    logger.info(`Cleared all subscriptions`, {
      totalSubscribers
    });
  }

  /**
   * Get current statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    const eventCounts = {};
    this.subscribers.forEach((callbacks, eventName) => {
      eventCounts[eventName] = callbacks.length;
    });

    return {
      ...this.stats,
      activeEvents: this.subscribers.size,
      eventCounts
    };
  }

  /**
   * Get list of all registered events
   * @returns {Array<string>} Array of event names
   */
  getRegisteredEvents() {
    return Array.from(this.subscribers.keys());
  }

  /**
   * Check if an event has any subscribers
   * @param {string} eventName - Name of the event
   * @returns {boolean} True if event has subscribers
   */
  hasSubscribers(eventName) {
    return this.subscribers.has(eventName) && this.subscribers.get(eventName).length > 0;
  }

  /**
   * Get preview of data for logging (truncate if too large)
   * @private
   * @param {any} data - Data to preview
   * @returns {string} Preview string
   */
  _getDataPreview(data) {
    if (data === null || data === undefined) {
      return 'null';
    }

    try {
      const str = JSON.stringify(data);
      return str.length > 100 ? str.substring(0, 100) + '...' : str;
    } catch {
      return '[Unstringifiable data]';
    }
  }
}

// Create singleton instance
const appComms = new AppComms();

// =============================================================================
// STANDARD EVENT NAMES
// Define all standard events used throughout the application
// This serves as documentation and helps prevent typos
// =============================================================================

appComms.events = {
  // Module lifecycle
  MODULE_CHANGED: 'module:changed',           // When active module changes
  MODULE_INITIALIZED: 'module:initialized',   // When a module finishes initialization
  MODULE_ACTIVATED: 'module:activated',       // When a module is activated
  MODULE_DEACTIVATED: 'module:deactivated',   // When a module is deactivated

  // State changes
  STATE_UPDATED: 'state:updated',             // When global state changes
  FOCUS_CHANGED: 'focus:changed',             // When focus context changes

  // Authentication
  AUTH_STATUS_CHANGED: 'auth:status_changed', // When auth status changes
  AUTH_USER_CHANGED: 'auth:user_changed',     // When user changes (login/logout)
  JWT_REFRESHED: 'jwt:refreshed',             // When JWT token is refreshed
  SESSION_EXPIRED: 'session:expired',         // When session expires

  // Widget events
  WIDGET_MESSAGE: 'widget:message',           // When widget sends a message
  WIDGET_READY: 'widget:ready',               // When widget finishes loading
  WIDGET_ERROR: 'widget:error',               // When widget encounters an error
  WIDGET_DATA_UPDATED: 'widget:data_updated', // When widget data is updated

  // UI events
  THEME_CHANGED: 'theme:changed',             // When theme changes
  TOAST_SHOW: 'toast:show',                   // Request to show toast notification
  MODAL_OPEN: 'modal:open',                   // When modal opens
  MODAL_CLOSE: 'modal:close',                 // When modal closes

  // Data events
  DATA_UPDATED: 'data:updated',               // When any data is updated
  DATA_ERROR: 'data:error',                   // When data fetch fails
  CALENDAR_UPDATED: 'calendar:updated',       // When calendar data updates
  PHOTOS_UPDATED: 'photos:updated',           // When photo data updates
  WEATHER_UPDATED: 'weather:updated',         // When weather data updates

  // Settings events
  SETTINGS_CHANGED: 'settings:changed',       // When settings are modified
  SETTINGS_SAVED: 'settings:saved',           // When settings are saved
  SETTINGS_LOADED: 'settings:loaded',         // When settings are loaded

  // System events
  ERROR_OCCURRED: 'error:occurred',           // When an error occurs
  SLEEP_MODE_CHANGED: 'sleep:mode_changed',   // When sleep mode changes
  NETWORK_STATUS_CHANGED: 'network:status_changed', // When network status changes
  PLATFORM_DETECTED: 'platform:detected'      // When platform is detected
};

// =============================================================================
// EXPOSE GLOBALLY FOR DEBUGGING
// =============================================================================

if (typeof window !== 'undefined') {
  window.AppComms = appComms;
}

// =============================================================================
// EXPORT
// =============================================================================

export default appComms;
