// js/main.js
// Main application entry point
// Extracted from index.html inline JavaScript

import { createLogger } from './utils/logger.js';
import consoleCommands from './utils/console-commands.js';
import { initializeCore } from './core/initialization/core-initializer.js';

const logger = createLogger('Main');

// Initialize console commands (for debugging)
consoleCommands.initialize();

/**
 * Check if auth bypass is enabled
 * @returns {boolean}
 */
function isAuthBypassEnabled() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.has('bypass-auth');
}

/**
 * Main initialization function
 * Called on DOMContentLoaded
 */
async function initialize() {
  try {
    logger.info('🚀 Starting Dashie Dashboard...');

    // Check for auth bypass FIRST (before importing auth modules)
    const bypassAuth = isAuthBypassEnabled();

    if (bypassAuth) {
      logger.warn('⚠️ AUTH BYPASS ACTIVE - Developer Mode');
      logger.warn('Dashboard will load without authentication or data');
      logger.warn('To disable: Remove ?bypass-auth from URL');

      // Skip auth entirely - go straight to dashboard with bypass flag
      await initializeCore({ bypassAuth: true });
      return;
    }

    // Normal auth flow - dynamically import to avoid loading Supabase if bypassed
    const { sessionManager } = await import('./data/auth/orchestration/session-manager.js');
    const { initializeAuth } = await import('./core/initialization/auth-initializer.js');

    // Expose sessionManager globally for console commands
    window.sessionManager = sessionManager;

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

    // If error is Supabase-related, offer helpful message
    if (error.message && (error.message.includes('tslib') || error.message.includes('supabase'))) {
      logger.error('⚠️ Supabase dependency error detected');
      logger.error('This may indicate a service outage or CDN issue');
      logger.error('💡 To bypass for UI work: Add ?bypass-auth to URL');
    }
  }
}

// Start initialization when DOM is ready
window.addEventListener('DOMContentLoaded', initialize);
