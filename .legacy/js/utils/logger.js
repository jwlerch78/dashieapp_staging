// js/utils/logger.js - Structured Logging System for Dashie
// v1.1 - 1/9/25 8:10pm - Added debug mode toggle via logger-config
// CHANGE SUMMARY: Added log buffer with localStorage persistence and file save capability

/**
 * Centralized logging system for Dashie Dashboard
 * Replaces scattered console.log statements with structured, configurable logging
 */

import { LoggerConfig } from './logger-config.js';

// LocalStorage key for persisting log configuration
const LOG_CONFIG_STORAGE_KEY = 'dashie-log-config';

// LocalStorage key for persisting log buffer
const LOG_BUFFER_STORAGE_KEY = 'dashie-log-buffer';

// Maximum number of log entries to keep in buffer
const MAX_LOG_BUFFER_SIZE = 200; // Reduced further to 200 to avoid quota issues

// In-memory log buffer
let logBuffer = [];

// Buffer save debouncing
let bufferSaveTimeout = null;
const BUFFER_SAVE_DELAY = 2000; // Save to localStorage every 2 seconds instead of immediately

// Log levels in order of severity
export const LOG_LEVELS = {
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
  enableWidgetLogging: true,
  enableBuffering: false  // DISABLED by default - enable manually if needed
};

/**
 * Save log configuration to localStorage
 * @private
 */
function saveLogConfig() {
  try {
    localStorage.setItem(LOG_CONFIG_STORAGE_KEY, JSON.stringify(GLOBAL_LOG_CONFIG));
  } catch (error) {
    console.warn('Failed to save log config to localStorage:', error);
  }
}

/**
 * Load log configuration from localStorage
 * @private
 */
/**
 * Add entry to log buffer and persist to localStorage
 * @private
 */
function addToLogBuffer(entry) {
  // Add to buffer
  logBuffer.push(entry);
  
  // Trim buffer if exceeds max size (circular buffer)
  if (logBuffer.length > MAX_LOG_BUFFER_SIZE) {
    logBuffer = logBuffer.slice(-MAX_LOG_BUFFER_SIZE);
  }
  
  // Debounce localStorage saves - only save every 2 seconds
  if (bufferSaveTimeout) {
    clearTimeout(bufferSaveTimeout);
  }
  bufferSaveTimeout = setTimeout(() => {
    saveLogBuffer();
    bufferSaveTimeout = null;
  }, BUFFER_SAVE_DELAY);
}

/**
 * Save log buffer to localStorage
 * @private
 */
function saveLogBuffer() {
  try {
    localStorage.setItem(LOG_BUFFER_STORAGE_KEY, JSON.stringify(logBuffer));
  } catch (error) {
    // If localStorage is full, try more aggressive trimming
    if (error.name === 'QuotaExceededError') {
      // First attempt: keep only last 100 entries
      logBuffer = logBuffer.slice(-100);
      try {
        localStorage.setItem(LOG_BUFFER_STORAGE_KEY, JSON.stringify(logBuffer));
        return; // Success
      } catch (e) {
        // Second attempt: keep only last 50 entries
        logBuffer = logBuffer.slice(-50);
        try {
          localStorage.setItem(LOG_BUFFER_STORAGE_KEY, JSON.stringify(logBuffer));
          return; // Success
        } catch (e2) {
          // Last resort: disable buffer persistence
          console.warn('Unable to save log buffer - localStorage quota exceeded. Buffer will only persist in memory.');
        }
      }
    }
  }
}

/**
 * Load log buffer from localStorage
 * @private
 */
function loadLogBuffer() {
  try {
    const saved = localStorage.getItem(LOG_BUFFER_STORAGE_KEY);
    if (saved) {
      logBuffer = JSON.parse(saved);
    }
  } catch (error) {
    console.warn('Failed to load log buffer from localStorage:', error);
    logBuffer = [];
  }
}

/**
 * Get current log buffer
 * @returns {Array} Array of log entries
 */
export function getLogBuffer() {
  return [...logBuffer];
}

/**
 * Clear log buffer
 */
export function clearLogBuffer() {
  logBuffer = [];
  try {
    localStorage.removeItem(LOG_BUFFER_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear log buffer from localStorage:', error);
  }
}

/**
 * Force immediate save of log buffer to localStorage
 * Useful before page unload or when you want to ensure logs are persisted
 */
export function flushLogBuffer() {
  if (bufferSaveTimeout) {
    clearTimeout(bufferSaveTimeout);
    bufferSaveTimeout = null;
  }
  saveLogBuffer();
}

/**
 * Save logs to file in the codebase
 * When running in browser, downloads file. When running via MCP-enabled tool, could save directly.
 * For now, always downloads - user can then move file to logs/ directory.
 * @returns {Promise<{success: boolean, filename?: string, error?: string}>}
 */
export async function saveLogsToFile() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `dashie-logs-${timestamp}.txt`;
    const content = formatLogsForFile();
    
    // Create blob and trigger download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return {
      success: true,
      filename,
      message: `Log file downloaded: ${filename}\n\nTo share with Claude via MCP:\n1. Move file to: dashieapp_staging/logs/\n2. Claude can then read it`
    };
  } catch (error) {
    console.error('Failed to save logs to file:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Format log buffer for file output
 * @private
 * @returns {string} Formatted log content
 */
function formatLogsForFile() {
  const header = `Dashie Application Logs
Generated: ${new Date().toISOString()}
Total Entries: ${logBuffer.length}
${'='.repeat(80)}

`;
  
  const logs = logBuffer.map(entry => {
    return `[${entry.timestamp}] [${entry.level}] [${entry.module}] ${entry.message}${entry.data ? '\n  Data: ' + JSON.stringify(entry.data) : ''}`;
  }).join('\n');
  
  return header + logs;
}

/**
 * Load log configuration from localStorage
 * @private
 */
function loadLogConfig() {
  try {
    const saved = localStorage.getItem(LOG_CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      GLOBAL_LOG_CONFIG = { ...GLOBAL_LOG_CONFIG, ...parsed };
    }
  } catch (error) {
    console.warn('Failed to load log config from localStorage:', error);
  }
}

/**
 * Configure global logging settings
 * @param {Object} config - Logging configuration object
 */
export function configureLogging(config) {
  GLOBAL_LOG_CONFIG = { ...GLOBAL_LOG_CONFIG, ...config };
  saveLogConfig();
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
    const timestamp = new Date().toISOString();
    if (GLOBAL_LOG_CONFIG.enableTimestamps) {
      const timeOnly = timestamp.split('T')[1].split('.')[0]; // HH:MM:SS format
      parts.push(`[${timeOnly}]`);
    }

    // Add module name if enabled
    if (GLOBAL_LOG_CONFIG.enableModuleNames) {
      parts.push(`[${this.moduleName}]`);
    }

    // Add the message
    parts.push(message);

    // Add to buffer (only if buffering is enabled)
    if (GLOBAL_LOG_CONFIG.enableBuffering) {
      const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'SILENT'];
      const levelName = levelNames[level] || 'UNKNOWN';
      
      // Only store data if it's small enough (< 50 chars when stringified)
      let dataToStore = undefined;
      if (data !== null && data !== undefined) {
        try {
          const dataStr = JSON.stringify(data);
          if (dataStr.length < 50) {  // Reduced from 100 to 50
            dataToStore = data;
          } else {
            dataToStore = `[Large object: ${dataStr.length} chars]`;
          }
        } catch (e) {
          dataToStore = '[Unstringifiable data]';
        }
      }
      
      addToLogBuffer({
        timestamp,
        level: levelName,
        module: this.moduleName,
        message: message,
        data: dataToStore
      });
    }

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
   * Only shows if debug mode is enabled via dashieDebug.enable()
   * @param {string} message - Log message
   * @param {any} data - Optional additional data
   */
  debug(message, data = null) {
    // Check if debug logs are enabled globally
    if (!LoggerConfig.enableDebugLogs) {
      return; // Silently skip debug logs in production mode
    }
    
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
  getLogBuffer,
  clearLogBuffer,
  flushLogBuffer,
  saveLogsToFile,
  log,
  LOG_LEVELS
};

// Auto-load configuration and buffer from localStorage on module initialization
loadLogConfig();
// Only load buffer if buffering is enabled
if (GLOBAL_LOG_CONFIG.enableBuffering) {
  loadLogBuffer();
}

// Save buffer before page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushLogBuffer();
  });
}
