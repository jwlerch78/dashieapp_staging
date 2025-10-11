// js/utils/crash-monitor.js
// CHANGE SUMMARY: New crash monitoring and persistent logging system for FireTV debugging

import { createLogger } from './logger.js';

const logger = createLogger('CrashMonitor');

/**
 * Crash Monitor - Persistent error logging for FireTV debugging
 * Stores errors in localStorage and provides remote access via window API
 */
class CrashMonitor {
  constructor() {
    this.LOG_KEY = 'dashie-crash-logs';
    this.MAX_LOGS = 200; // Keep last 200 errors
    this.MAX_LOG_AGE_HOURS = 48; // Keep logs for 48 hours
    this.sessionStartTime = Date.now();
    this.sessionId = this.generateSessionId();
    this.errorCount = 0;
    this.memoryWarnings = 0;
    
    // Performance tracking
    this.performanceMetrics = {
      apiCalls: 0,
      apiErrors: 0,
      refreshCycles: 0,
      widgetLoads: 0,
      widgetErrors: 0
    };
    
    logger.info('Crash Monitor initialized', {
      sessionId: this.sessionId,
      startTime: new Date(this.sessionStartTime).toISOString()
    });
    
    this.init();
  }

  /**
   * Initialize crash monitoring
   */
  init() {
    // Log session start
    this.logSessionStart();
    
    // Set up global error handlers
    this.setupGlobalErrorHandlers();
    
    // Monitor memory usage
    this.startMemoryMonitoring();
    
    // Monitor intervals/timers
    this.monitorTimers();
    
    // Clean old logs on startup
    this.cleanOldLogs();
    
    // Expose debugging API
    this.exposeDebugAPI();
    
    logger.success('Crash monitoring active');
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Log session start
   */
  logSessionStart() {
    this.addLog({
      type: 'session_start',
      severity: 'info',
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      platform: this.detectPlatform(),
      memory: this.getMemoryInfo(),
      timestamp: Date.now()
    });
  }

  /**
   * Set up global error handlers
   */
  setupGlobalErrorHandlers() {
    // Catch uncaught errors
    window.addEventListener('error', (event) => {
      this.errorCount++;
      this.addLog({
        type: 'uncaught_error',
        severity: 'error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        sessionId: this.sessionId,
        errorNumber: this.errorCount,
        timestamp: Date.now()
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.errorCount++;
      this.addLog({
        type: 'unhandled_rejection',
        severity: 'error',
        reason: event.reason?.toString(),
        stack: event.reason?.stack,
        sessionId: this.sessionId,
        errorNumber: this.errorCount,
        timestamp: Date.now()
      });
    });

    // Monitor console errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      this.errorCount++;
      this.addLog({
        type: 'console_error',
        severity: 'error',
        message: args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '),
        sessionId: this.sessionId,
        errorNumber: this.errorCount,
        timestamp: Date.now()
      });
      originalConsoleError.apply(console, args);
    };

    // Monitor console warnings
    const originalConsoleWarn = console.warn;
    console.warn = (...args) => {
      this.addLog({
        type: 'console_warn',
        severity: 'warn',
        message: args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '),
        sessionId: this.sessionId,
        timestamp: Date.now()
      });
      originalConsoleWarn.apply(console, args);
    };
  }

  /**
   * Start monitoring memory usage
   */
  startMemoryMonitoring() {
    // Check if performance.memory is available (Chromium-based browsers)
    if (!performance.memory) {
      logger.debug('Memory monitoring not available on this platform');
      return;
    }

    // Check memory every 30 seconds
    setInterval(() => {
      const memory = this.getMemoryInfo();
      
      // Warn if using over 80% of heap
      if (memory.usedPercent > 80) {
        this.memoryWarnings++;
        this.addLog({
          type: 'memory_warning',
          severity: 'warn',
          message: `High memory usage: ${memory.usedPercent.toFixed(1)}%`,
          memory,
          warningCount: this.memoryWarnings,
          sessionId: this.sessionId,
          timestamp: Date.now()
        });
      }

      // Log critical memory usage
      if (memory.usedPercent > 90) {
        this.addLog({
          type: 'memory_critical',
          severity: 'error',
          message: `CRITICAL memory usage: ${memory.usedPercent.toFixed(1)}%`,
          memory,
          sessionId: this.sessionId,
          timestamp: Date.now()
        });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Monitor active timers and intervals
   */
  monitorTimers() {
    // Track setInterval calls
    const originalSetInterval = window.setInterval;
    const activeIntervals = new Set();
    
    window.setInterval = function(...args) {
      const id = originalSetInterval.apply(window, args);
      activeIntervals.add(id);
      
      // Log if too many intervals
      if (activeIntervals.size > 20) {
        logger.warn(`High interval count: ${activeIntervals.size} active intervals`);
      }
      
      return id;
    };

    const originalClearInterval = window.clearInterval;
    window.clearInterval = function(id) {
      activeIntervals.delete(id);
      return originalClearInterval.call(window, id);
    };

    // Expose interval count
    window.getActiveIntervalCount = () => activeIntervals.size;
  }

  /**
   * Get memory information
   */
  getMemoryInfo() {
    if (!performance.memory) {
      return { available: false };
    }

    const memory = performance.memory;
    return {
      available: true,
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usedMB: (memory.usedJSHeapSize / 1048576).toFixed(2),
      totalMB: (memory.totalJSHeapSize / 1048576).toFixed(2),
      limitMB: (memory.jsHeapSizeLimit / 1048576).toFixed(2),
      usedPercent: ((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(2)
    };
  }

  /**
   * Detect platform
   */
  detectPlatform() {
    const ua = navigator.userAgent;
    if (ua.includes('AFTS') || ua.includes('AFT')) return 'FireTV';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return 'Web';
  }

  /**
   * Add log entry
   */
  addLog(logEntry) {
    try {
      // Get existing logs
      let logs = this.getLogs();
      
      // Add new log
      logs.push({
        ...logEntry,
        sessionDuration: Date.now() - this.sessionStartTime,
        url: window.location.href
      });
      
      // Keep only recent logs
      if (logs.length > this.MAX_LOGS) {
        logs = logs.slice(-this.MAX_LOGS);
      }
      
      // Save to localStorage
      localStorage.setItem(this.LOG_KEY, JSON.stringify(logs));
      
      // Also log to console for immediate visibility
      if (logEntry.severity === 'error') {
        logger.error(`[CrashMonitor] ${logEntry.type}:`, logEntry.message || logEntry);
      } else if (logEntry.severity === 'warn') {
        logger.warn(`[CrashMonitor] ${logEntry.type}:`, logEntry.message || logEntry);
      }
    } catch (error) {
      console.error('Failed to add log entry:', error);
    }
  }

  /**
   * Get all logs
   */
  getLogs() {
    try {
      const logsJson = localStorage.getItem(this.LOG_KEY);
      return logsJson ? JSON.parse(logsJson) : [];
    } catch (error) {
      console.error('Failed to retrieve logs:', error);
      return [];
    }
  }

  /**
   * Clean old logs
   */
  cleanOldLogs() {
    try {
      const logs = this.getLogs();
      const cutoffTime = Date.now() - (this.MAX_LOG_AGE_HOURS * 60 * 60 * 1000);
      
      const recentLogs = logs.filter(log => log.timestamp > cutoffTime);
      
      if (recentLogs.length < logs.length) {
        localStorage.setItem(this.LOG_KEY, JSON.stringify(recentLogs));
        logger.debug(`Cleaned ${logs.length - recentLogs.length} old log entries`);
      }
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }

  /**
   * Log custom event
   */
  logEvent(type, data = {}) {
    this.addLog({
      type,
      severity: 'info',
      ...data,
      sessionId: this.sessionId,
      timestamp: Date.now()
    });
  }

  /**
   * Log API call
   */
  logAPICall(method, endpoint, status, duration, error = null) {
    this.performanceMetrics.apiCalls++;
    if (error) this.performanceMetrics.apiErrors++;
    
    this.addLog({
      type: 'api_call',
      severity: error ? 'error' : 'info',
      method,
      endpoint,
      status,
      duration,
      error: error?.message,
      sessionId: this.sessionId,
      timestamp: Date.now()
    });
  }

  /**
   * Log widget event
   */
  logWidget(widgetName, eventType, data = {}) {
    if (eventType === 'load') this.performanceMetrics.widgetLoads++;
    if (eventType === 'error') this.performanceMetrics.widgetErrors++;
    
    this.addLog({
      type: 'widget_event',
      severity: eventType === 'error' ? 'error' : 'info',
      widgetName,
      eventType,
      ...data,
      sessionId: this.sessionId,
      timestamp: Date.now()
    });
  }

  /**
   * Expose debugging API
   */
  exposeDebugAPI() {
    window.DashieDebug = {
      // Get all logs
      getLogs: () => this.getLogs(),
      
      // Get logs by type
      getLogsByType: (type) => this.getLogs().filter(log => log.type === type),
      
      // Get errors only
      getErrors: () => this.getLogs().filter(log => log.severity === 'error'),
      
      // Get recent logs (last N)
      getRecentLogs: (count = 50) => this.getLogs().slice(-count),
      
      // Get logs for current session
      getSessionLogs: () => this.getLogs().filter(log => log.sessionId === this.sessionId),
      
      // Export logs as JSON
      exportLogs: () => {
        const logs = this.getLogs();
        const dataStr = JSON.stringify(logs, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashie-logs-${Date.now()}.json`;
        a.click();
      },
      
      // Clear all logs
      clearLogs: () => {
        localStorage.removeItem(this.LOG_KEY);
        logger.info('All logs cleared');
      },
      
      // Get summary
      getSummary: () => {
        const logs = this.getLogs();
        const errors = logs.filter(l => l.severity === 'error');
        const warnings = logs.filter(l => l.severity === 'warn');
        
        return {
          sessionId: this.sessionId,
          sessionDuration: this.formatDuration(Date.now() - this.sessionStartTime),
          totalLogs: logs.length,
          totalErrors: errors.length,
          totalWarnings: warnings.length,
          errorCount: this.errorCount,
          memoryWarnings: this.memoryWarnings,
          memory: this.getMemoryInfo(),
          performance: this.performanceMetrics,
          activeIntervals: window.getActiveIntervalCount ? window.getActiveIntervalCount() : 'N/A',
          recentErrors: errors.slice(-5).map(e => ({
            type: e.type,
            message: e.message,
            time: new Date(e.timestamp).toLocaleTimeString()
          }))
        };
      },
      
      // Print summary to console
      printSummary: () => {
        const summary = window.DashieDebug.getSummary();
        console.log('=== DASHIE DEBUG SUMMARY ===');
        console.log(JSON.stringify(summary, null, 2));
      },
      
      // Help message
      help: () => {
        console.log(`
=== DASHIE DEBUG API ===
Available commands:
  
  DashieDebug.getLogs()          - Get all logs
  DashieDebug.getErrors()        - Get error logs only
  DashieDebug.getRecentLogs(50)  - Get last 50 logs
  DashieDebug.getSessionLogs()   - Get logs for current session
  DashieDebug.getSummary()       - Get debug summary
  DashieDebug.printSummary()     - Print summary to console
  DashieDebug.exportLogs()       - Download logs as JSON
  DashieDebug.clearLogs()        - Clear all logs
  DashieDebug.help()             - Show this help
        `);
      }
    };
    
    logger.success('Debug API exposed at window.DashieDebug');
  }

  /**
   * Format duration in human-readable format
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// Create singleton instance
const crashMonitor = new CrashMonitor();

// Export for module use
export default crashMonitor;
export { CrashMonitor };