// js/utils/console-commands.js
// v1.2 - 10/15/25 - Updated for refactored architecture
// v1.1 - 10/11/25 11:45pm - Added telemetry upload and status commands
// v1.0 - 10/11/25 3:35pm - Console debugging helper commands
// CHANGE SUMMARY: Updated for new modular architecture

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

    window.LogStatus = this.logStatus.bind(this);
    window.logStatus = this.logStatus.bind(this);

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

    window.GetAppState = this.getAppState.bind(this);
    window.getAppState = this.getAppState.bind(this);

    // Calendar Testing Commands
    window.TestCalendars = this.testCalendars.bind(this);
    window.testCalendars = this.testCalendars.bind(this);

    // Theme Commands
    window.SetTheme = this.setTheme.bind(this);
    window.setTheme = this.setTheme.bind(this);
    window.ToggleTheme = this.toggleTheme.bind(this);
    window.toggleTheme = this.toggleTheme.bind(this);

    // Theme Overlay Commands
    window.InspectOverlay = this.inspectOverlay.bind(this);
    window.inspectOverlay = this.inspectOverlay.bind(this);

    // Input Handler Debug Commands
    window.GetListeners = this.getListeners.bind(this);
    window.getListeners = this.getListeners.bind(this);

    // Calendar Cache Commands
    window.GetCacheStatus = this.getCacheStatus.bind(this);
    window.getCacheStatus = this.getCacheStatus.bind(this);
    window.RefreshCalendar = this.refreshCalendar.bind(this);
    window.refreshCalendar = this.refreshCalendar.bind(this);
    window.ClearCache = this.clearCache.bind(this);
    window.clearCache = this.clearCache.bind(this);

    // Connection Testing Commands
    window.SimulateOffline = this.simulateOffline.bind(this);
    window.simulateOffline = this.simulateOffline.bind(this);
    window.SimulateOnline = this.simulateOnline.bind(this);
    window.simulateOnline = this.simulateOnline.bind(this);
    window.GetConnectionStatus = this.getConnectionStatus.bind(this);
    window.getConnectionStatus = this.getConnectionStatus.bind(this);

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

🔍 LOGGER CONTROLS:
  logStatus()               - Show detailed logging status ⭐ NEW!
  setLogLevel('level')      - Set log level (debug|verbose|info|warn|error)
  getLogLevel()             - Get current log level

💡 TIP: Use logStatus() for a clear overview of your logging setup!

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

📅 CALENDAR CACHE:
  getCacheStatus()          - View cache status & metadata
  refreshCalendar()         - Force refresh calendar data
  clearCache()              - Clear calendar cache

🧪 CONNECTION TESTING:
  simulateOffline()         - Simulate internet outage ⭐ NEW!
  simulateOnline()          - Restore normal connection ⭐ NEW!
  getConnectionStatus()     - View connection status ⭐ NEW!

🏗️  APPLICATION STATE:
  getAppState()             - Get current application state

📡 TELEMETRY COMMANDS (BETA):
  uploadLogs()              - Manually upload crash logs to Supabase
  getTelemetryStatus()      - Check telemetry service status

📅 CALENDAR TESTING:
  testCalendars()           - Test calendar fetch with token refresh

🎨 THEME COMMANDS:
  setTheme('light')         - Set theme to light mode
  setTheme('dark')          - Set theme to dark mode
  toggleTheme()             - Toggle between light and dark
  inspectOverlay()          - Inspect theme overlay status 🎃

🔧 INPUT HANDLER DEBUG:
  getListeners()            - Show active event listeners status

╔════════════════════════════════════════════════════════════════╗
║  TIP: All commands work in lowercase or UpperCase!           ║
╚════════════════════════════════════════════════════════════════╝
    `);
  }

  /**
   * Set logger level
   */
  setLogLevel(level) {
    const validLevels = ['debug', 'verbose', 'info', 'warn', 'error'];

    if (!validLevels.includes(level)) {
      console.error(`Invalid log level. Use one of: ${validLevels.join(', ')}`);
      return;
    }

    // Store in localStorage
    localStorage.setItem('dashie-log-level', level);

    // Apply immediately via logger configureLogging()
    if (window.Logger && window.Logger.configureLogging) {
      const LOG_LEVELS = {
        DEBUG: 0,
        VERBOSE: 0.5,
        INFO: 1,
        WARN: 2,
        ERROR: 3
      };
      const levelValue = LOG_LEVELS[level.toUpperCase()];
      if (levelValue !== undefined) {
        window.Logger.configureLogging({ level: levelValue });
      }
    }

    console.log(`✅ Log level set to: ${level} (effective immediately)`);

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
   * Show detailed logging status
   */
  logStatus() {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    LOGGING STATUS                              ║
╚════════════════════════════════════════════════════════════════╝
`);

    // Get current log level
    const logLevel = localStorage.getItem('dashie-log-level') || 'info';
    console.log(`📊 Log Level: ${logLevel.toUpperCase()}`);

    // Get debug and verbose status
    const debug = localStorage.getItem('dashie-debug') === 'true';
    const verbose = localStorage.getItem('dashie-verbose') === 'true';

    console.log(`🐛 Debug Mode: ${debug ? '✅ ON' : '❌ OFF'}`);
    console.log(`📋 Verbose Mode: ${verbose ? '✅ ON' : '❌ OFF'}`);

    console.log('\n📝 What you\'ll see:');
    if (debug) {
      console.log('   • All logs (DEBUG, VERBOSE, INFO, SUCCESS, WARN, ERROR)');
    } else if (verbose) {
      console.log('   • VERBOSE, INFO, SUCCESS, WARN, ERROR');
    } else {
      console.log('   • INFO, SUCCESS, WARN, ERROR (clean logs)');
    }

    console.log('\n💡 Quick commands:');
    console.log('   dashieDebug.verboseOn()  - Show initialization details');
    console.log('   dashieDebug.verboseOff() - Hide initialization details');
    console.log('   dashieDebug.enable()     - Show all debug logs');
    console.log('   dashieDebug.disable()    - Production mode');

    return {
      logLevel,
      debug,
      verbose
    };
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
   * Get current application state
   */
  getAppState() {
    if (!window.AppStateManager) {
      console.warn('AppStateManager not initialized');
      return null;
    }

    const state = window.AppStateManager.getState();
    console.log('Current Application State:');
    console.log(JSON.stringify(state, null, 2));
    return state;
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

  /**
   * Set theme
   * @param {string} theme - 'light' or 'dark'
   */
  setTheme(theme) {
    console.log(`🎨 Setting theme to: ${theme}\n`);

    if (!window.themeApplier) {
      console.error('❌ ThemeApplier not initialized');
      return { success: false, error: 'ThemeApplier not initialized' };
    }

    if (theme !== 'light' && theme !== 'dark') {
      console.error('❌ Invalid theme. Use "light" or "dark"');
      return { success: false, error: 'Invalid theme' };
    }

    window.themeApplier.applyTheme(theme);
    console.log(`✅ Theme set to: ${theme}`);

    return { success: true, theme };
  }

  /**
   * Toggle theme between light and dark
   */
  toggleTheme() {
    console.log('🎨 Toggling theme...\n');

    if (!window.themeApplier) {
      console.error('❌ ThemeApplier not initialized');
      return { success: false, error: 'ThemeApplier not initialized' };
    }

    const newTheme = window.themeApplier.toggleTheme();
    console.log(`✅ Theme toggled to: ${newTheme}`);

    return { success: true, theme: newTheme };
  }

  /**
   * Inspect theme overlay status
   */
  inspectOverlay() {
    console.log('🎃 Inspecting Theme Overlay...\n');

    // Get themeOverlay from themeApplier module
    import('../ui/theme-overlay-v2.js').then(module => {
      const overlay = module.themeOverlay;

      if (!overlay) {
        console.error('❌ ThemeOverlay not initialized');
        return;
      }

      console.log('📊 Overlay Status:');
      console.log(`  Enabled: ${overlay.enabled}`);
      console.log(`  Current Theme: ${overlay.currentTheme || 'none'}`);
      console.log(`  Active Elements: ${overlay.activeElements.size}`);

      if (overlay.activeElements.size > 0) {
        console.log('\n🎨 Active Elements:');
        overlay.activeElements.forEach((data, id) => {
          const config = data.config;
          console.log(`\n  ${id}:`);
          console.log(`    Container: ${config.container || 'dashboard'}`);
          console.log(`    Position: ${config.position.type}`);
          console.log(`    Movement: ${config.movement?.type || 'none'}`);
          console.log(`    Visibility: ${config.visibility?.type || 'always'}`);
          console.log(`    Visible: ${data.element.style.display !== 'none'}`);
        });
      }

      // Check widget iframe overlays
      console.log('\n🖼️ Widget Iframe Overlays:');
      const widgetIframes = document.querySelectorAll('.widget-iframe');
      widgetIframes.forEach(iframe => {
        try {
          const iframeDoc = iframe.contentDocument;
          if (iframeDoc) {
            const overlayContainer = iframeDoc.body.querySelector('.widget-theme-overlay');
            if (overlayContainer) {
              const elementCount = overlayContainer.children.length;
              console.log(`  ${iframe.id}: ${elementCount} element(s)`);
            } else {
              console.log(`  ${iframe.id}: no overlay`);
            }
          }
        } catch (error) {
          console.log(`  ${iframe.id}: cannot access (cross-origin?)`);
        }
      });

    }).catch(error => {
      console.error('❌ Failed to load theme overlay module:', error);
    });

    return { info: 'Inspecting overlay... (async, check console)' };
  }

  /**
   * Test calendar fetching with automatic token refresh
   */
  async testCalendars() {
    console.log('📅 Testing Calendar Service with Token Refresh...\n');

    // Check if sessionManager is available
    if (!window.sessionManager) {
      console.error('❌ SessionManager not available');
      console.log('💡 Make sure you are authenticated first');
      return { success: false, error: 'SessionManager not available' };
    }

    const sessionManager = window.sessionManager;

    // Check if authenticated
    if (!sessionManager.isUserAuthenticated()) {
      console.error('❌ Not authenticated');
      console.log('💡 Sign in first, then try again');
      return { success: false, error: 'Not authenticated' };
    }

    const edgeClient = sessionManager.getEdgeClient();

    if (!edgeClient || !edgeClient.jwtToken) {
      console.error('❌ EdgeClient not ready or no JWT');
      return { success: false, error: 'EdgeClient not ready' };
    }

    console.log('✅ SessionManager ready');
    console.log(`   User: ${sessionManager.getUser()?.email}`);
    console.log(`   JWT: ${edgeClient.jwtToken ? 'Present' : 'Missing'}\n`);

    try {
      // Dynamically import CalendarService
      const { CalendarService } = await import('../data/services/calendar-service.js');

      // Create calendar service instance
      const calendarService = new CalendarService(edgeClient);
      console.log('✅ CalendarService initialized\n');

      // Fetch calendars
      console.log('📡 Fetching calendars from Google API...');
      const startTime = performance.now();

      const calendars = await calendarService.getCalendars('primary');

      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(0);

      console.log(`\n✅ Success! Fetched ${calendars.length} calendars in ${duration}ms\n`);

      // Display calendar list
      console.log('📋 Your Calendars:');
      calendars.forEach((cal, index) => {
        console.log(`  ${index + 1}. ${cal.summary || cal.id}`);
        console.log(`     ID: ${cal.id}`);
        console.log(`     Primary: ${cal.primary ? 'Yes' : 'No'}`);
        console.log(`     Access: ${cal.accessRole || 'unknown'}`);
        console.log('');
      });

      // Show token info
      console.log('🔑 Token Info:');
      console.log('   Token was automatically fetched from edge function');
      console.log('   Edge function checked expiry and refreshed if needed');
      console.log('   All token refresh happens server-side!\n');

      return {
        success: true,
        calendars,
        count: calendars.length,
        duration: `${duration}ms`
      };

    } catch (error) {
      console.error('❌ Calendar fetch failed:', error.message);
      console.error(error);

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get active event listeners status
   */
  getListeners() {
    console.log('🔧 Checking InputHandler Listeners...\n');

    if (!window.InputHandler) {
      console.error('❌ InputHandler not available');
      console.log('💡 InputHandler should be available after initialization');
      return { success: false, error: 'InputHandler not available' };
    }

    return window.InputHandler.getListenerStatus();
  }

  /**
   * Get calendar cache status
   */
  async getCacheStatus() {
    console.log('📅 Checking Calendar Cache Status...\n');

    try {
      const widgetDataManager = window.widgetDataManager;
      if (!widgetDataManager) {
        console.error('❌ WidgetDataManager not available');
        return { success: false, error: 'WidgetDataManager not available' };
      }

      const metadata = await widgetDataManager.getCalendarCacheMetadata();

      if (!metadata) {
        console.log('ℹ️  No cached data found\n');
        console.log('💡 Calendar data will be fetched fresh on next load');
        return { success: true, cached: false };
      }

      const ageMinutes = Math.round(metadata.age / 60000);
      const ageSeconds = Math.round(metadata.age / 1000);
      const ttlMinutes = Math.round(metadata.ttl / 60000);
      const sizeKB = Math.round(metadata.sizeEstimate / 1024);

      console.log('✅ Cache Status:');
      console.log(`   Cached: ${metadata.eventsCount} events from ${metadata.calendarsCount} calendars`);
      console.log(`   Size: ~${sizeKB} KB`);
      console.log(`   Age: ${ageMinutes}m ${ageSeconds % 60}s`);
      console.log(`   TTL: ${ttlMinutes} minutes`);
      console.log(`   Valid: ${!metadata.isExpired ? '✅ Yes' : '❌ Expired'}\n`);

      if (metadata.isExpired) {
        console.log('⚠️  Cache has expired and will be refreshed on next load');
      } else {
        const remainingMs = metadata.ttl - metadata.age;
        const remainingMinutes = Math.round(remainingMs / 60000);
        console.log(`✨ Cache is fresh! Expires in ~${remainingMinutes} minutes`);
      }

      return {
        success: true,
        cached: true,
        metadata
      };
    } catch (error) {
      console.error('❌ Failed to check cache status:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Force refresh calendar data
   */
  async refreshCalendar() {
    console.log('🔄 Force refreshing calendar data...\n');

    try {
      const widgetDataManager = window.widgetDataManager;
      if (!widgetDataManager) {
        console.error('❌ WidgetDataManager not available');
        return { success: false, error: 'WidgetDataManager not available' };
      }

      const startTime = performance.now();
      await widgetDataManager.refreshCalendarData();
      const duration = Math.round(performance.now() - startTime);

      console.log(`✅ Calendar data refreshed successfully!`);
      console.log(`   Duration: ${duration}ms\n`);

      // Show updated cache status
      await this.getCacheStatus();

      return { success: true, duration };
    } catch (error) {
      console.error('❌ Failed to refresh calendar data:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear calendar cache
   */
  async clearCache() {
    console.log('🗑️  Clearing calendar cache...\n');

    try {
      const widgetDataManager = window.widgetDataManager;
      if (!widgetDataManager) {
        console.error('❌ WidgetDataManager not available');
        return { success: false, error: 'WidgetDataManager not available' };
      }

      await widgetDataManager.clearCalendarCache();

      console.log('✅ Calendar cache cleared successfully!\n');
      console.log('💡 Next calendar load will fetch fresh data from API\n');

      return { success: true };
    } catch (error) {
      console.error('❌ Failed to clear cache:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Simulate offline mode (for testing)
   */
  simulateOffline() {
    console.log('🧪 Simulating offline mode...\n');

    try {
      // Import and use connectionStatus
      import('../utils/connection-status.js').then(({ connectionStatus }) => {
        connectionStatus.enableTestMode('offline');

        console.log('⚠️  OFFLINE MODE SIMULATION ACTIVE\n');
        console.log('📡 All API calls will be blocked');
        console.log('💾 Dashboard will run on cached data only');
        console.log('🔄 Offline indicator should appear\n');
        console.log('💡 To restore: simulateOnline()\n');
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Failed to simulate offline:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Restore normal online mode
   */
  simulateOnline() {
    console.log('✅ Restoring online mode...\n');

    try {
      import('../utils/connection-status.js').then(({ connectionStatus }) => {
        connectionStatus.disableTestMode();

        console.log('✅ NORMAL MODE RESTORED\n');
        console.log('📡 API calls will work normally');
        console.log('🔄 Offline indicator should disappear\n');
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Failed to restore online mode:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get connection status
   */
  async getConnectionStatus() {
    console.log('📡 Checking connection status...\n');

    try {
      const { connectionStatus } = await import('../utils/connection-status.js');
      const status = connectionStatus.getStatus();

      console.log('✅ Connection Status:');
      console.log(`   Network: ${status.isOnline ? '✅ Online' : '❌ Offline'}`);
      console.log(`   Backend: ${status.isBackendAvailable ? '✅ Available' : '❌ Unavailable'}`);
      console.log(`   Mode: ${status.isDegraded ? '🟡 Degraded' : '✅ Normal'}`);

      if (status.isDegraded) {
        console.log(`   Reason: ${status.degradedReason}`);
      }

      const timeSince = Math.round(status.timeSinceLastConnection / 1000);
      console.log(`   Last Success: ${timeSince}s ago`);

      if (connectionStatus.isTestMode()) {
        console.log(`\n   ⚠️  TEST MODE ACTIVE: ${connectionStatus.testModeType}`);
      }

      console.log('');

      return {
        success: true,
        status
      };
    } catch (error) {
      console.error('❌ Failed to get connection status:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Initialize and export
const consoleCommands = new ConsoleCommands();
export default consoleCommands;
