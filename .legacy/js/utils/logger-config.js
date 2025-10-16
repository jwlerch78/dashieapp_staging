// js/utils/logger-config.js
// Global logger configuration and debug toggle
// v1.0 - 1/9/25 8:05pm - Initial implementation

/**
 * Global logger configuration
 * Controls debug log visibility across the entire application
 */
export const LoggerConfig = {
  // Debug mode - controlled via localStorage
  // Set to false for production, true for development
  get enableDebugLogs() {
    return localStorage.getItem('dashie-debug') === 'true';
  },
  
  /**
   * Enable debug logging
   * All logger.debug() calls will be visible after page reload
   */
  enableDebug() {
    localStorage.setItem('dashie-debug', 'true');
    console.log('🐛 Debug logging ENABLED - reload page to see all debug logs');
  },
  
  /**
   * Disable debug logging (production mode)
   * Only INFO, SUCCESS, WARN, and ERROR logs will be visible after reload
   */
  disableDebug() {
    localStorage.removeItem('dashie-debug');
    console.log('🐛 Debug logging DISABLED - reload page for clean logs');
  },
  
  /**
   * Check current debug status
   */
  getStatus() {
    const enabled = this.enableDebugLogs;
    console.log(`🐛 Debug mode: ${enabled ? 'ON ✅' : 'OFF ❌'}`);
    console.log(`   ${enabled ? 'All logs visible' : 'Only INFO/SUCCESS/WARN/ERROR visible'}`);
    return enabled;
  }
};

/**
 * Expose debug controls globally for easy console access
 * Usage:
 *   dashieDebug.enable()   - Turn on debug logs
 *   dashieDebug.disable()  - Turn off debug logs  
 *   dashieDebug.status()   - Check current status
 */
if (typeof window !== 'undefined') {
  window.dashieDebug = {
    enable: () => LoggerConfig.enableDebug(),
    disable: () => LoggerConfig.disableDebug(),
    status: () => LoggerConfig.getStatus(),
    help: () => {
      console.log(`
🐛 Dashie Debug Controls
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  dashieDebug.enable()   - Turn on debug logs (verbose)
  dashieDebug.disable()  - Turn off debug logs (clean)
  dashieDebug.status()   - Check current mode
  
After enabling/disabling, reload the page to see changes.
      `);
    }
  };
  
  // Show helpful message on load if in debug mode
  if (LoggerConfig.enableDebugLogs) {
    console.log('🐛 Debug mode is ENABLED - use dashieDebug.disable() to reduce log noise');
  }
}
