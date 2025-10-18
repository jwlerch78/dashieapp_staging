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

  // Verbose mode - show granular initialization details
  get enableVerboseLogs() {
    return localStorage.getItem('dashie-verbose') === 'true';
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
   * Enable verbose logging
   * Shows granular initialization details (logger.verbose() calls)
   */
  enableVerbose() {
    localStorage.setItem('dashie-verbose', 'true');
    console.log('📋 Verbose logging ENABLED - reload to see granular init details');
  },

  /**
   * Disable verbose logging
   * Hides granular initialization details for cleaner logs
   */
  disableVerbose() {
    localStorage.removeItem('dashie-verbose');
    console.log('📋 Verbose logging DISABLED - reload for clean logs');
  },

  /**
   * Check current debug and verbose status
   */
  getStatus() {
    const debug = this.enableDebugLogs;
    const verbose = this.enableVerboseLogs;
    console.log(`🐛 Debug mode: ${debug ? 'ON ✅' : 'OFF ❌'}`);
    console.log(`📋 Verbose mode: ${verbose ? 'ON ✅' : 'OFF ❌'}`);
    if (!debug && !verbose) {
      console.log(`   Only INFO/SUCCESS/WARN/ERROR visible`);
    }
    return { debug, verbose };
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
    verboseOn: () => LoggerConfig.enableVerbose(),
    verboseOff: () => LoggerConfig.disableVerbose(),
    status: () => LoggerConfig.getStatus(),
    help: () => {
      console.log(`
🐛 Dashie Debug Controls
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  dashieDebug.enable()     - Turn on debug logs (all logs)
  dashieDebug.disable()    - Turn off debug logs
  dashieDebug.verboseOn()  - Turn on verbose logs (init details)
  dashieDebug.verboseOff() - Turn off verbose logs (clean init)
  dashieDebug.status()     - Check current mode

After enabling/disabling, reload the page to see changes.

💡 Recommended: Keep verbose OFF for clean logs showing only major milestones.
      `);
    }
  };

  // Show helpful message on load if in debug mode
  if (LoggerConfig.enableDebugLogs) {
    console.log('🐛 Debug mode is ENABLED - use dashieDebug.disable() to reduce log noise');
  }
  if (LoggerConfig.enableVerboseLogs) {
    console.log('📋 Verbose mode is ENABLED - use dashieDebug.verboseOff() for cleaner init logs');
  }
}
