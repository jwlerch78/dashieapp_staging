// js/utils/console-commands.js
// v1.1 - 10/11/25 11:45pm - Added telemetry upload and status commands
// v1.0 - 10/11/25 3:35pm - Console debugging helper commands
// CHANGE SUMMARY: Added uploadLogs() and getTelemetryStatus() commands

/**
 * Console Commands Helper
 * Exposes useful debugging commands globally for easy console access
 */

class ConsoleCommands {
  constructor() {
    this.commands = {};
  }

  /**
   * Register all console commands globally
   */
  initialize() {
    // Crash Logger Commands (with lowercase aliases)
    window.ListCommands = this.listCommands.bind(this);
    window.listCommands = this.listCommands.bind(this);
    window.Help = this.listCommands.bind(this);
    window.help = this.listCommands.bind(this);
    
    // Crash Logger Shortcuts
    window.GetSummary = () => window.DashieDebug?.getSummary();
    window.getSummary = () => window.DashieDebug?.getSummary();
    
    window.GetLogs = () => window.DashieDebug?.getLogs();
    window.getLogs = () => window.DashieDebug?.getLogs();
    
    window.GetErrors = () => window.DashieDebug?.getErrors();
    window.getErrors = () => window.DashieDebug?.getErrors();
    
    window.ExportLogs = () => window.DashieDebug?.exportLogs();
    window.exportLogs = () => window.DashieDebug?.exportLogs();
    
    window.ClearLogs = () => window.DashieDebug?.clearLogs();
    window.clearLogs = () => window.DashieDebug?.clearLogs();
    
    // Logger Level Controls
    window.SetLogLevel = this.setLogLevel.bind(this);
    window.setLogLevel = this.setLogLevel.bind(this);
    
    window.GetLogLevel = this.getLogLevel.bind(this);
    window.getLogLevel = this.getLogLevel.bind(this);
    
    // Settings Shortcuts
    window.GetSettings = () => window.settingsInstance?.controller?.getSettings();
    window.getSettings = () => window.settingsInstance?.controller?.getSettings();
    
    window.GetSetting = (path) => window.settingsInstance?.controller?.getSetting(path);
    window.getSetting = (path) => window.settingsInstance?.controller?.getSetting(path);
    
    // Auth & JWT Info
    window.GetAuthStatus = this.getAuthStatus.bind(this);
    window.getAuthStatus = this.getAuthStatus.bind(this);
    
    window.GetJWTStatus = this.getJWTStatus.bind(this);
    window.getJWTStatus = this.getJWTStatus.bind(this);
    
    // Performance & Memory
    window.CheckMemory = this.checkMemory.bind(this);
    window.checkMemory = this.checkMemory.bind(this);
    
    window.GetPerformance = this.getPerformance.bind(this);
    window.getPerformance = this.getPerformance.bind(this);
    
    // Widget Info
    window.ListWidgets = this.listWidgets.bind(this);
    window.listWidgets = this.listWidgets.bind(this);
    
    // Telemetry Commands
    window.UploadLogs = this.uploadLogs.bind(this);
    window.uploadLogs = this.uploadLogs.bind(this);
    
    window.GetTelemetryStatus = this.getTelemetryStatus.bind(this);
    window.getTelemetryStatus = this.getTelemetryStatus.bind(this);
    
    console.log('✅ Console commands loaded! Type help() or Help() to see available commands.');
  }

  /**
   * Display all available commands
   */
  listCommands() {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║              DASHIE CONSOLE DEBUGGING COMMANDS                 ║
╚════════════════════════════════════════════════════════════════╝

📊 CRASH LOGGER COMMANDS:
  help()                    - Show this help menu (or Help())
  listCommands()            - Show this help menu (or ListCommands())
  getSummary()              - Get crash logger summary
  getLogs()                 - Get all crash logs
  getErrors()               - Get error logs only
  exportLogs()              - Download logs as JSON file
  clearLogs()               - Clear all crash logs

🔍 LOGGER LEVEL CONTROLS:
  setLogLevel('debug')      - Set log level (debug|info|warn|error)
  setLogLevel('info')       - Default level
  getLogLevel()             - Get current log level

⚙️  SETTINGS COMMANDS:
  getSettings()             - Get all settings
  getSetting('path.name')   - Get specific setting
    Examples:
      getSetting('interface.theme')
      getSetting('family.familyName')

🔐 AUTH & JWT STATUS:
  getAuthStatus()           - Check authentication status
  getJWTStatus()            - Check JWT service status

📈 PERFORMANCE & MEMORY:
  checkMemory()             - Check current memory usage
  getPerformance()          - Get performance metrics

🎨 WIDGET MANAGEMENT:
  listWidgets()             - List all registered widgets

📡 TELEMETRY COMMANDS (BETA):
  uploadLogs()              - Manually upload crash logs to Supabase
  getTelemetryStatus()      - Check telemetry service status

╔════════════════════════════════════════════════════════════════╗
║  TIP: All commands work in lowercase or UpperCase!           ║
╚════════════════════════════════════════════════════════════════╝
    `);
  }

  /**
   * Set logger level
   */
  setLogLevel(level) {
    const validLevels = ['debug', 'info', 'warn', 'error'];
    
    if (!validLevels.includes(level)) {
      console.error(`Invalid log level. Use one of: ${validLevels.join(', ')}`);
      return;
    }

    // Store in localStorage
    localStorage.setItem('dashie-log-level', level);
    
    console.log(`✅ Log level set to: ${level}`);
    console.log('⚠️  Reload page for changes to take effect');
    
    return level;
  }

  /**
   * Get current logger level
   */
  getLogLevel() {
    const level = localStorage.getItem('dashie-log-level') || 'info';
    console.log(`Current log level: ${level}`);
    return level;
  }

  /**
   * Get authentication status
   */
  getAuthStatus() {
    const status = {
      authenticated: document.body.classList.contains('authenticated'),
      dashieAuth: !!window.dashieAuth,
      authReady: window.dashieAuth?.isAuthenticated || false,
      userEmail: window.dashieAuth?.currentUser?.email || 'Not available',
      authMethod: window.authMethod || 'Unknown'
    };
    
    console.table(status);
    return status;
  }

  /**
   * Get JWT service status
   */
  getJWTStatus() {
    if (!window.jwtAuth) {
      console.warn('JWT service not initialized');
      return null;
    }

    const status = {
      initialized: !!window.jwtAuth,
      ready: window.jwtAuth.isServiceReady?.() || false,
      hasUser: !!window.jwtAuth.currentUser,
      userEmail: window.jwtAuth.currentUser?.email || 'N/A',
      accountCount: window.jwtAuth.listAccounts?.()?.length || 0
    };
    
    console.table(status);
    return status;
  }

  /**
   * Check current memory usage
   */
  checkMemory() {
    if (!performance.memory) {
      console.warn('Memory API not available on this browser');
      return null;
    }

    const memory = performance.memory;
    const info = {
      usedMB: (memory.usedJSHeapSize / 1048576).toFixed(2),
      totalMB: (memory.totalJSHeapSize / 1048576).toFixed(2),
      limitMB: (memory.jsHeapSizeLimit / 1048576).toFixed(2),
      usedPercent: ((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(2) + '%'
    };
    
    console.table(info);
    
    // Warning if high
    if (parseFloat(info.usedPercent) > 80) {
      console.warn('⚠️  Memory usage is high! Consider reloading.');
    }
    
    return info;
  }

  /**
   * Get performance metrics
   */
  getPerformance() {
    const metrics = {
      // Crash logger metrics
      crashMonitor: window.DashieDebug?.getSummary()?.performance || {},
      
      // Page timing
      loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart + 'ms',
      domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart + 'ms',
      
      // Current uptime
      uptime: this.formatDuration(Date.now() - performance.timing.navigationStart)
    };
    
    console.log('Performance Metrics:');
    console.table(metrics.crashMonitor);
    console.log(`Page Load Time: ${metrics.loadTime}`);
    console.log(`DOM Ready: ${metrics.domReady}`);
    console.log(`Uptime: ${metrics.uptime}`);
    
    return metrics;
  }

  /**
   * List all registered widgets
   */
  listWidgets() {
    const widgets = [];
    
    // Check for widget coordinator
    if (window.widgetCoordinator) {
      const registered = window.widgetCoordinator.getRegisteredWidgets?.() || [];
      registered.forEach(widgetId => {
        widgets.push({
          id: widgetId,
          iframe: document.getElementById(widgetId) ? '✅' : '❌',
          status: 'Registered'
        });
      });
    }
    
    if (widgets.length === 0) {
      console.warn('No widgets found or widget coordinator not initialized');
      return [];
    }
    
    console.table(widgets);
    return widgets;
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

  /**
   * Manually upload logs to telemetry service
   */
  async uploadLogs() {
    if (!window.telemetryService) {
      console.error('❌ Telemetry service not available');
      console.log('💡 Telemetry service initializes after authentication');
      return { success: false, error: 'Service not available' };
    }

    console.log('📤 Uploading logs to Supabase...');
    
    try {
      const result = await window.telemetryService.uploadLogs(true); // Force upload
      
      if (result.success) {
        console.log(`✅ Successfully uploaded ${result.uploaded} log entries`);
        if (result.timestamp) {
          console.log(`⏰ Upload time: ${result.timestamp.toLocaleString()}`);
        }
      } else {
        console.error(`❌ Upload failed: ${result.error}`);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Upload error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get telemetry service status
   */
  getTelemetryStatus() {
    if (!window.telemetryService) {
      console.warn('⚠️  Telemetry service not available yet');
      return null;
    }

    const status = window.telemetryService.getStatus();
    
    console.log('📊 Telemetry Service Status:');
    console.log(`  Enabled: ${status.enabled ? '✅ Yes' : '❌ No (Enable in Settings → System → Privacy)'}`);
    console.log(`  Currently Uploading: ${status.uploading ? '⏳ Yes' : 'No'}`);
    console.log(`  Last Upload: ${status.lastUpload ? status.lastUpload.toLocaleString() : 'Never'}`);
    console.log(`  Upload Frequency: ${status.uploadFrequency}`);
    console.log(`  Platform: ${status.platform?.name || 'Unknown'}`);
    console.log(`  Edge Function: ${status.edgeFunctionUrl}`);
    
    return status;
  }
}

// Initialize and export
const consoleCommands = new ConsoleCommands();
export default consoleCommands;
