// js/utils/logger.js - Structured Logging System for Dashie
// CHANGE SUMMARY: New centralized logging system to replace console debugging throughout codebase

/**
 * Centralized logging system for Dashie Dashboard
 * Replaces scattered console.log statements with structured, configurable logging
 */

// Log levels in order of severity
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4
};

// Global logging configuration
let GLOBAL_LOG_CONFIG = {
  level: LOG_LEVELS.INFO,
  enableTimestamps: true,
  enableModuleNames: true,
  enableColors: true,
  enableApiLogging: false,
  enableAuthLogging: true,
  enableDataLogging: true,
  enableWidgetLogging: true
};

/**
 * Configure global logging settings
 * @param {Object} config - Logging configuration object
 */
export function configureLogging(config) {
  GLOBAL_LOG_CONFIG = { ...GLOBAL_LOG_CONFIG, ...config };
}

/**
 * Get current logging configuration
 * @returns {Object} Current logging config
 */
export function getLoggingConfig() {
  return { ...GLOBAL_LOG_CONFIG };
}

/**
 * Logger class for module-specific logging
 */
export class Logger {
  constructor(moduleName, moduleConfig = {}) {
    this.moduleName = moduleName;
    this.moduleConfig = moduleConfig;
    
    // Module-specific overrides
    this.isApiModule = moduleName.toLowerCase().includes('api');
    this.isAuthModule = moduleName.toLowerCase().includes('auth');
    this.isDataModule = moduleName.toLowerCase().includes('data') || moduleName.toLowerCase().includes('cache');
    this.isWidgetModule = moduleName.toLowerCase().includes('widget');
  }

  /**
   * Check if a log level should be output based on global and module settings
   * @param {number} level - Log level to check
   * @returns {boolean} Whether to log this level
   */
  shouldLog(level) {
    // Check global level first
    if (level < GLOBAL_LOG_CONFIG.level) {
      return false;
    }

    // Check module-specific settings
    if (this.isApiModule && !GLOBAL_LOG_CONFIG.enableApiLogging) {
      return false;
    }
    if (this.isAuthModule && !GLOBAL_LOG_CONFIG.enableAuthLogging) {
      return false;
    }
    if (this.isDataModule && !GLOBAL_LOG_CONFIG.enableDataLogging) {
      return false;
    }
    if (this.isWidgetModule && !GLOBAL_LOG_CONFIG.enableWidgetLogging) {
      return false;
    }

    return true;
  }

  /**
   * Format log message with timestamps and module information
   * @param {number} level - Log level
   * @param {string} message - Log message
   * @param {any} data - Additional data to log
   * @returns {Array} Formatted arguments for console methods
   */
  formatMessage(level, message, data = null) {
    const parts = [];
    
    // Add timestamp if enabled
    if (GLOBAL_LOG_CONFIG.enableTimestamps) {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS format
      parts.push(`[${timestamp}]`);
    }

    // Add module name if enabled
    if (GLOBAL_LOG_CONFIG.enableModuleNames) {
      parts.push(`[${this.moduleName}]`);
    }

    // Add the message
    parts.push(message);

    // Return formatted parts
    const formattedMessage = parts.join(' ');
    
    if (data !== null && data !== undefined) {
      return [formattedMessage, data];
    } else {
      return [formattedMessage];
    }
  }

  /**
   * Debug level logging - for detailed development information
   * @param {string} message - Log message
   * @param {any} data - Optional additional data
   */
  debug(message, data = null) {
    if (!this.shouldLog(LOG_LEVELS.DEBUG)) return;
    
    const args = this.formatMessage(LOG_LEVELS.DEBUG, `🔍 ${message}`, data);
    console.log(...args);
  }

  /**
   * Info level logging - for general application flow
   * @param {string} message - Log message
   * @param {any} data - Optional additional data
   */
  info(message, data = null) {
    if (!this.shouldLog(LOG_LEVELS.INFO)) return;
    
    const args = this.formatMessage(LOG_LEVELS.INFO, `ℹ️ ${message}`, data);
    console.log(...args);
  }

  /**
   * Warning level logging - for potential issues
   * @param {string} message - Log message
   * @param {any} data - Optional additional data
   */
  warn(message, data = null) {
    if (!this.shouldLog(LOG_LEVELS.WARN)) return;
    
    const args = this.formatMessage(LOG_LEVELS.WARN, `⚠️ ${message}`, data);
    console.warn(...args);
  }

  /**
   * Error level logging - for errors and exceptions
   * @param {string} message - Log message
   * @param {Error|any} error - Error object or additional data
   */
  error(message, error = null) {
    if (!this.shouldLog(LOG_LEVELS.ERROR)) return;
    
    const args = this.formatMessage(LOG_LEVELS.ERROR, `❌ ${message}`, error);
    console.error(...args);
  }

  /**
   * Success logging - for positive outcomes
   * @param {string} message - Log message
   * @param {any} data - Optional additional data
   */
  success(message, data = null) {
    if (!this.shouldLog(LOG_LEVELS.INFO)) return;
    
    const args = this.formatMessage(LOG_LEVELS.INFO, `✅ ${message}`, data);
    console.log(...args);
  }

  /**
   * API-specific logging with request/response details
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {number} status - Response status
   * @param {number} duration - Request duration in ms
   */
  apiCall(method, endpoint, status, duration) {
    if (!this.shouldLog(LOG_LEVELS.INFO) || !GLOBAL_LOG_CONFIG.enableApiLogging) return;
    
    const statusIcon = status >= 200 && status < 300 ? '✅' : '❌';
    const message = `${statusIcon} API ${method} ${endpoint} - ${status} (${duration}ms)`;
    const args = this.formatMessage(LOG_LEVELS.INFO, message);
    console.log(...args);
  }

  /**
   * Authentication flow logging
   * @param {string} flow - Auth flow name (web, native, device, etc.)
   * @param {string} stage - Stage of authentication
   * @param {string} status - Status (success, error, pending)
   * @param {any} details - Additional details
   */
  auth(flow, stage, status, details = null) {
    if (!this.shouldLog(LOG_LEVELS.INFO) || !GLOBAL_LOG_CONFIG.enableAuthLogging) return;
    
    const statusIcon = status === 'success' ? '✅' : 
                      status === 'error' ? '❌' : 
                      status === 'pending' ? '⏳' : 'ℹ️';
    
    const message = `${statusIcon} Auth [${flow}] ${stage}: ${status}`;
    const args = this.formatMessage(LOG_LEVELS.INFO, message, details);
    console.log(...args);
  }

  /**
   * Data operation logging
   * @param {string} operation - Operation type (fetch, cache, refresh)
   * @param {string} dataType - Type of data (calendar, photos, etc.)
   * @param {string} status - Operation status
   * @param {any} details - Additional details (count, duration, etc.)
   */
  data(operation, dataType, status, details = null) {
    if (!this.shouldLog(LOG_LEVELS.INFO) || !GLOBAL_LOG_CONFIG.enableDataLogging) return;
    
    const statusIcon = status === 'success' ? '✅' : 
                      status === 'error' ? '❌' : 
                      status === 'cached' ? '💾' : 'ℹ️';
    
    const message = `${statusIcon} Data [${dataType}] ${operation}: ${status}`;
    const args = this.formatMessage(LOG_LEVELS.INFO, message, details);
    console.log(...args);
  }

  /**
   * Widget communication logging
   * @param {string} direction - 'send' or 'receive'
   * @param {string} messageType - Type of message
   * @param {string} widgetName - Name or source of widget
   * @param {any} details - Message details
   */
  widget(direction, messageType, widgetName, details = null) {
    if (!this.shouldLog(LOG_LEVELS.INFO) || !GLOBAL_LOG_CONFIG.enableWidgetLogging) return;
    
    const directionIcon = direction === 'send' ? '📤' : '📥';
    const message = `${directionIcon} Widget [${widgetName}] ${messageType}`;
    const args = this.formatMessage(LOG_LEVELS.INFO, message, details);
    console.log(...args);
  }

  /**
   * Performance timing logging
   * @param {string} operation - Operation being timed
   * @param {number} duration - Duration in milliseconds
   * @param {any} metadata - Additional metadata about the operation
   */
  perf(operation, duration, metadata = null) {
    if (!this.shouldLog(LOG_LEVELS.DEBUG)) return;
    
    const message = `⏱️ Performance [${operation}]: ${duration}ms`;
    const args = this.formatMessage(LOG_LEVELS.DEBUG, message, metadata);
    console.log(...args);
  }

  /**
   * Create a performance timer
   * @param {string} operation - Operation name
   * @returns {Function} Function to call when operation completes
   */
  startTimer(operation) {
    const startTime = performance.now();
    
    return (metadata = null) => {
      const duration = Math.round(performance.now() - startTime);
      this.perf(operation, duration, metadata);
      return duration;
    };
  }
}

/**
 * Create a logger for a specific module
 * @param {string} moduleName - Name of the module
 * @param {Object} moduleConfig - Module-specific configuration
 * @returns {Logger} Logger instance
 */
export function createLogger(moduleName, moduleConfig = {}) {
  return new Logger(moduleName, moduleConfig);
}

/**
 * Quick logging functions for simple use cases
 */
export const log = {
  debug: (message, data) => createLogger('Global').debug(message, data),
  info: (message, data) => createLogger('Global').info(message, data),
  warn: (message, data) => createLogger('Global').warn(message, data),
  error: (message, error) => createLogger('Global').error(message, error),
  success: (message, data) => createLogger('Global').success(message, data)
};

/**
 * Set logging level from string
 * @param {string} levelString - Log level as string (debug, info, warn, error, silent)
 */
export function setLogLevel(levelString) {
  const level = LOG_LEVELS[levelString.toUpperCase()];
  if (level !== undefined) {
    GLOBAL_LOG_CONFIG.level = level;
  } else {
    console.warn('Invalid log level:', levelString);
  }
}

/**
 * Enable/disable specific logging categories
 * @param {Object} categories - Object with boolean values for each category
 */
export function setLogCategories(categories) {
  Object.assign(GLOBAL_LOG_CONFIG, categories);
}

// Default export for convenience
export default {
  Logger,
  createLogger,
  configureLogging,
  getLoggingConfig,
  setLogLevel,
  setLogCategories,
  log,
  LOG_LEVELS
};
