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
import { initializeServices } from './service-initializer.js';
import { initializeWidgets } from './widget-initializer.js';
import '../../utils/modal-navigation-manager.js'; // Initialize global dashieModalManager

const logger = createLogger('CoreInitializer');

/**
 * Initialize core components and modules
 * @returns {Promise<void>}
 */
export async function initializeCore() {
  try {
    logger.verbose('Starting core initialization...');

    // Initialize AppStateManager
    await AppStateManager.initialize();
    window.themeApplier = themeApplier;

    // STEP 1: Initialize data services (EdgeClient + SettingsService)
    await initializeServices();

    // STEP 2: Initialize Settings (loads from database, applies theme to localStorage)
    await Settings.initialize();
    logger.verbose('Settings initialized (theme loaded from database and applied)');

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
      const { hideLoginScreen } = await import('./auth-initializer.js');
      hideLoginScreen();
      logger.verbose('Login screen hidden - dashboard fully initialized');

      // STEP 6: Check if welcome wizard should be shown for new users
      if (welcome.shouldShow()) {
        logger.info('New user detected - showing welcome wizard');
        await welcome.activate();
      } else {
        logger.debug('Welcome wizard not needed - user has completed onboarding');
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
