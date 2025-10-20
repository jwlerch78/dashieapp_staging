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
import DashboardInputHandler from '../../modules/Dashboard/dashboard-input-handler.js';
import Settings from '../../modules/Settings/settings.js';
import modals from '../../modules/Modals/modals.js';
import welcome from '../../modules/Welcome/welcome.js';
import themeApplier from '../../ui/theme-applier.js';
import { initializeWidgets } from './widget-initializer.js';
import '../../utils/modal-navigation-manager.js'; // Initialize global dashieModalManager

// NOTE: service-initializer is imported dynamically to avoid loading Supabase in bypass mode

const logger = createLogger('CoreInitializer');

/**
 * Initialize core components and modules
 * @param {object} options - Initialization options
 * @param {boolean} options.bypassAuth - Skip auth-dependent features
 * @returns {Promise<void>}
 */
export async function initializeCore(options = {}) {
  const { bypassAuth = false } = options;

  try {
    logger.verbose('Starting core initialization...', { bypassAuth });

    // Initialize AppStateManager
    await AppStateManager.initialize();
    window.themeApplier = themeApplier;

    if (!bypassAuth) {
      // STEP 1: Initialize data services (EdgeClient + SettingsService)
      // Dynamic import to avoid loading Supabase modules in bypass mode
      const { initializeServices } = await import('./service-initializer.js');
      await initializeServices();

      // STEP 2: Initialize Settings (loads from database, applies theme to localStorage)
      await Settings.initialize();
      logger.verbose('Settings initialized (theme loaded from database and applied)');
    } else {
      // Bypass mode: Initialize Settings without database
      logger.warn('⚠️ BYPASS MODE: Skipping service initialization');
      logger.warn('⚠️ BYPASS MODE: Initializing Settings in read-only mode (no database)');

      // Initialize Settings in bypass mode (no database operations)
      await Settings.initialize({ bypassAuth: true });

      // Apply default theme without loading from database
      themeApplier.applyTheme('light', false); // Don't save to localStorage
      logger.info('Applied default light theme (bypass mode)');
    }

    // Initialize core components
    await InputHandler.initialize();
    await ActionRouter.initialize();
    await WidgetMessenger.initialize();

    // Initialize Dashboard module
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
    await initializeWidgets();

    // STEP 4: Initialize Welcome module and check if onboarding is needed
    await welcome.initialize();
    logger.verbose('Welcome module initialized');

    // STEP 5: Hide login screen after widgets have been initialized and received themes
    // Wait a brief moment for widgets to receive theme messages via postMessage
    setTimeout(async () => {
      if (!bypassAuth) {
        const { hideLoginScreen } = await import('./auth-initializer.js');
        hideLoginScreen();
        logger.verbose('Login screen hidden - dashboard fully initialized');
      } else {
        // In bypass mode, just show dashboard immediately (no login screen)
        const loginScreen = document.getElementById('oauth-login-screen');
        const dashboardContainer = document.getElementById('dashboard-container');
        if (loginScreen) loginScreen.style.display = 'none';
        if (dashboardContainer) dashboardContainer.classList.add('visible');
        logger.verbose('Dashboard shown (bypass mode)');
      }

      // STEP 6: Check if welcome wizard should be shown for new users
      if (!bypassAuth && welcome.shouldShow()) {
        logger.info('New user detected - showing welcome wizard');
        await welcome.activate();
      } else {
        logger.debug('Welcome wizard skipped (bypass mode or already completed)');
      }
    }, 300); // 300ms delay to ensure widgets receive theme

    // Detect platform
    const platform = getPlatformDetector();
    logger.info('Platform detected', { platform: platform.getPlatformDescription() });

    logger.verbose('Core initialization complete');

  } catch (error) {
    logger.error('Core initialization failed', error);
    throw error;
  }
}
