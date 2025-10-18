// js/main.js
// Main application entry point
// Extracted from index.html inline JavaScript

import { createLogger } from './utils/logger.js';
import consoleCommands from './utils/console-commands.js';
import { sessionManager } from './data/auth/orchestration/session-manager.js';
import { initializeAuth } from './core/initialization/auth-initializer.js';
import { initializeCore } from './core/initialization/core-initializer.js';

const logger = createLogger('Main');

// Initialize console commands (for debugging)
consoleCommands.initialize();

// Expose sessionManager globally for console commands
window.sessionManager = sessionManager;

/**
 * Main initialization function
 * Called on DOMContentLoaded
 */
async function initialize() {
  try {
    logger.info('🚀 Starting Dashie Dashboard...');

    // Step 1: Initialize auth (may show login screen)
    const authenticated = await initializeAuth(async () => {
      // This callback is called after successful authentication
      logger.info('Auth complete - continuing initialization');
      await initializeCore();
    });

    // If not authenticated, the login screen is displayed
    // and initializeCore will be called after sign-in
    if (!authenticated) {
      logger.info('User not authenticated - login screen active');
    }

  } catch (error) {
    logger.error('Initialization failed', error);
  }
}

// Start initialization when DOM is ready
window.addEventListener('DOMContentLoaded', initialize);
