// js/core/initialization/core-initializer.js
// Core components initialization module
// Extracted from index.html inline JavaScript

import { createLogger } from '../../utils/logger.js';
import AppStateManager from '../../core/app-state-manager.js';
import InputHandler from '../../core/input-handler.js';
import ActionRouter from '../../core/action-router.js';
import WidgetMessenger from '../../core/widget-messenger.js';
import { getPlatformDetector } from '../../utils/platform-detector.js';
import Dashboard from '../../modules/Dashboard/dashboard.js';
import DashboardInputHandler from '../../modules/Dashboard/navigation/input-handler.js';
import Settings from '../../modules/Settings/settings.js';
import modals from '../../modules/Modals/modals.js';
import welcome from '../../modules/Welcome/welcome.js';
import themeApplier from '../../ui/theme-applier.js';
import { initializeWidgets } from './widget-initializer.js';
import '../../utils/modal-navigation-manager.js'; // Initialize global dashieModalManager

// NOTE: service-initializer is imported dynamically to avoid loading Supabase in bypass mode

const logger = createLogger('CoreInitializer');

/**
 * Update loading screen message
 * @param {string} message - Status message to display
 * @param {number} [mobileProgress] - Optional progress percentage for mobile (0-100)
 */
function updateLoadingMessage(message, mobileProgress = null) {
  try {
    const loadingTextEl = document.getElementById('loading-dashboard-text');
    if (loadingTextEl) {
      loadingTextEl.textContent = message;
      logger.debug('Loading message updated', { message });
    }

    // Update mobile progress if percentage provided
    if (mobileProgress !== null) {
      const progressFill = document.getElementById('mobile-progress-fill');
      const progressText = document.getElementById('mobile-progress-text');

      if (progressFill) {
        progressFill.style.width = `${mobileProgress}%`;
      }

      if (progressText) {
        progressText.textContent = message;
      }
    }
  } catch (error) {
    // Ignore errors if element doesn't exist
  }
}

/**
 * Wait for critical widgets to finish loading before hiding login screen
 * @param {string[]} widgetIds - Array of widget IDs to wait for
 * @param {number} timeout - Timeout in milliseconds (default 10000)
 * @returns {Promise<void>}
 */
async function waitForWidgetsToLoad(widgetIds, timeout = 10000) {
  return new Promise((resolve) => {
    const loadedWidgets = new Set();
    let handler = null;

    logger.debug('Waiting for widgets to load', { widgetIds, timeout });

    const checkAllLoaded = () => {
      if (loadedWidgets.size === widgetIds.length) {
        logger.success('All critical widgets loaded', {
          loadedWidgets: Array.from(loadedWidgets),
          timeElapsed: Date.now() - startTime
        });
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      if (handler) {
        window.removeEventListener('message', handler);
        handler = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };

    // Listen for widget-ready messages
    handler = (event) => {
      const data = event.data;

      // Check format: {type: 'widget-ready', widgetId: 'photos'}
      if (data?.type === 'widget-ready') {
        const widgetId = data.widgetId;
        if (widgetIds.includes(widgetId)) {
          logger.debug('Widget loaded', { widgetId });
          loadedWidgets.add(widgetId);
          checkAllLoaded();
        }
      }
    };

    window.addEventListener('message', handler);

    const startTime = Date.now();

    // Timeout after specified milliseconds
    const timeoutId = setTimeout(() => {
      logger.warn('Widget loading timeout - proceeding anyway', {
        loadedWidgets: Array.from(loadedWidgets),
        expectedWidgets: widgetIds,
        timeElapsed: Date.now() - startTime
      });
      cleanup();
      resolve();
    }, timeout);
  });
}

/**
 * Initialize core components and modules
 * @param {object} options - Initialization options
 * @param {boolean} options.bypassAuth - Skip auth-dependent features
 * @param {boolean} options.isMobile - Mobile device mode (skip widgets, simplified UI)
 * @returns {Promise<void>}
 */
export async function initializeCore(options = {}) {
  const { bypassAuth = false, isMobile = false } = options;

  try {
    logger.verbose('Starting core initialization...', { bypassAuth, isMobile });

    // Initialize AppStateManager
    await AppStateManager.initialize();
    window.themeApplier = themeApplier;

    if (!bypassAuth) {
      // STEP 1: Initialize data services (EdgeClient + SettingsService)
      // Dynamic import to avoid loading Supabase modules in bypass mode
      updateLoadingMessage('Connecting to services...', isMobile ? 65 : null);
      const { initializeServices } = await import('./service-initializer.js');
      await initializeServices();
      logger.verbose('Services initialized');

      // STEP 2: Initialize Settings (loads from database, applies theme to localStorage)
      updateLoadingMessage('Loading your settings...', isMobile ? 70 : null);
      await Settings.initialize();
      logger.verbose('Settings initialized (theme loaded from database and applied)');

      updateLoadingMessage('Applying your theme...', isMobile ? 75 : null);
    } else {
      // Bypass mode: Initialize Settings without database
      logger.warn('⚠️ BYPASS MODE: Skipping service initialization');
      logger.warn('⚠️ BYPASS MODE: Initializing Settings in read-only mode (no database)');

      // Clear any stale data from localStorage that requires auth
      try {
        localStorage.removeItem('dashie-active-calendars'); // Calendar IDs from previous sessions
        logger.debug('Cleared stale calendar data from localStorage');
      } catch (e) {
        // Ignore localStorage errors
      }

      // Initialize Settings in bypass mode (no database operations)
      await Settings.initialize({ bypassAuth: true });

      // Apply theme from localStorage (or default to light if not set)
      try {
        const savedTheme = localStorage.getItem('dashie-theme') || 'light';
        themeApplier.applyTheme(savedTheme, false); // Don't save to localStorage (already there)
        logger.info('Applied theme from localStorage (bypass mode)', { theme: savedTheme });
      } catch (e) {
        themeApplier.applyTheme('light', false);
        logger.info('Applied default light theme (bypass mode - localStorage unavailable)');
      }
    }

    // Initialize core components (skip on mobile - no widgets/d-pad needed)
    if (!isMobile) {
      await InputHandler.initialize();
      await ActionRouter.initialize();
      await WidgetMessenger.initialize();

      // Initialize VoiceService for voice commands and TTS
      updateLoadingMessage('Initializing voice service...');
      const VoiceService = (await import('../voice-service.js')).default;
      await VoiceService.initialize();
      window.voiceService = VoiceService; // Expose globally for debugging
      logger.verbose('VoiceService initialized');

      // Initialize VoiceCommandRouter for processing voice commands
      const VoiceCommandRouter = (await import('../voice-command-router.js')).default;
      await VoiceCommandRouter.initialize();
      window.voiceCommandRouter = VoiceCommandRouter; // Expose globally for debugging
      logger.verbose('VoiceCommandRouter initialized');
    }

    // Initialize cross-dashboard synchronization (works on all platforms)
    const { dashboardSync } = await import('../../services/dashboard-sync-service.js');
    dashboardSync.initialize();
    window.dashboardSync = dashboardSync; // Expose for other modules
    logger.verbose('Dashboard sync service initialized');

    // Setup cross-dashboard listeners for theme changes
    if (themeApplier && themeApplier.setupCrossDashboardListener) {
      themeApplier.setupCrossDashboardListener();
      logger.verbose('Cross-dashboard theme listener setup');
    }

    // Setup cross-dashboard listeners for photo and calendar updates (desktop only - mobile has no widgets)
    if (!isMobile) {
      dashboardSync.on('photos-updated', (details) => {
        logger.info('Photos updated in another dashboard', details);

        // Reload photos data for photos widget
        import('../widget-data-manager.js').then(({ getWidgetDataManager }) => {
          const widgetDataManager = getWidgetDataManager();
          widgetDataManager.loadPhotosData();
        });
      });

      dashboardSync.on('calendar-updated', (details) => {
        logger.info('Calendar updated in another dashboard', details);

        // Reload calendar data for calendar/agenda widgets
        import('../widget-data-manager.js').then(({ getWidgetDataManager }) => {
          const widgetDataManager = getWidgetDataManager();
          widgetDataManager.refreshCalendarData();
        });
      });
    }

    // Desktop/TV: Initialize Dashboard and widgets
    if (!isMobile) {
      // Initialize Dashboard module
      updateLoadingMessage('Setting up dashboard...');
      await Dashboard.initialize();
      ActionRouter.registerModule('dashboard', DashboardInputHandler);

      // Initialize Settings module
      ActionRouter.registerModule('settings', Settings.getInputHandler());
      window.Settings = Settings;

      // Initialize Modals module
      await modals.initialize();
      ActionRouter.registerModule('modals', modals);

      // Set Dashboard as active module and activate it (this creates the widget iframes!)
      AppStateManager.setCurrentModule('dashboard');
      Dashboard.activate();

      // STEP 3: NOW initialize widgets AFTER Dashboard.activate() has created the iframes
      updateLoadingMessage('Preparing widgets...');
      await initializeWidgets();

      // Re-apply theme overlay now that widgets are ready
      // (Some overlays inject into widget iframes, which didn't exist during initial theme application)
      if (themeApplier.getCurrentTheme()) {
        const { themeOverlay } = await import('../../ui/themes/theme-overlay-applier.js');
        if (themeOverlay) {
          // applyOverlay now handles clearing internally and prevents duplicates
          themeOverlay.applyOverlay(themeApplier.getCurrentTheme());
          logger.debug('Re-applied theme overlay after widgets initialized');
        }
      }

      // STEP 4: Wait for critical widgets to finish loading before hiding login screen
      if (!bypassAuth) {
        logger.info('Waiting for critical widgets to load data...');
        updateLoadingMessage('Loading calendar and photos...');
        const criticalWidgets = ['main', 'agenda', 'photos']; // 'main' is calendar widget's ID
        await waitForWidgetsToLoad(criticalWidgets, 10000);
        logger.verbose('Critical widgets loaded - ready to show dashboard');
        updateLoadingMessage('Almost ready...');
      }

      // STEP 5: Initialize Welcome module and check if onboarding is needed
      await welcome.initialize();
      logger.verbose('Welcome module initialized');
    } else {
      // Mobile: Initialize Settings and Modals (needed for Settings modal to work)
      updateLoadingMessage('Setting up...', 80);

      // Expose Settings globally for Settings button
      window.Settings = Settings;

      // Initialize Modals module (Settings modal depends on it)
      await modals.initialize();

      updateLoadingMessage('Preparing interface...', 85);

      logger.verbose('Mobile mode: Settings and Modals initialized, skipping widgets');
    }

    // STEP 6: Hide login screen after widgets are loaded
    // On desktop: widgets are already loaded (we waited above)
    // On mobile: hide immediately
    if (!bypassAuth) {
      const { hideLoginScreen } = await import('./auth-initializer.js');
      hideLoginScreen();
      logger.verbose('Login screen hidden - initialization complete');
    } else {
      // In bypass mode, just show dashboard immediately (no login screen)
      const loginScreen = document.getElementById('oauth-login-screen');
      const dashboardContainer = document.getElementById('dashboard-container');
      if (loginScreen) loginScreen.style.display = 'none';
      if (dashboardContainer && !isMobile) dashboardContainer.classList.add('visible');
      logger.verbose('Dashboard shown (bypass mode)');
    }

    // STEP 7: Check if welcome wizard should be shown for new users (desktop/TV only)
    if (!isMobile && !bypassAuth && welcome.shouldShow()) {
      logger.info('New user detected - showing welcome wizard');
      await welcome.activate();
    } else {
      if (isMobile) {
        logger.debug('Welcome wizard skipped (mobile mode)');
      } else {
        logger.debug('Welcome wizard skipped (bypass mode or already completed)');
      }
    }

    // Detect platform
    const platform = getPlatformDetector();
    logger.info('Platform detected', { platform: platform.getPlatformDescription() });

    logger.verbose('Core initialization complete');

  } catch (error) {
    logger.error('Core initialization failed', error);
    throw error;
  }
}
