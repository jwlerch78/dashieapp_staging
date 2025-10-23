// js/main.js
// Main application entry point
// Extracted from index.html inline JavaScript

import { createLogger } from './utils/logger.js';
import consoleCommands from './utils/console-commands.js';
import { initializeCore } from './core/initialization/core-initializer.js';
import { getPlatformDetector } from './utils/platform-detector.js';
import {
  showMobileLandingPage,
  showMobileLoadingBar,
  updateMobileProgress,
  hideMobileLoadingBar,
  initializeMobileUI
} from './ui/mobile-ui.js';

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
 * Check if user has a stored session (JWT token)
 * @returns {boolean} True if stored session exists
 */
function checkForStoredSession() {
  try {
    const jwtData = localStorage.getItem('dashie-supabase-jwt');
    if (!jwtData) return false;

    const parsed = JSON.parse(jwtData);
    if (!parsed.jwt || !parsed.expiry) return false;

    // Check if JWT is not expired
    const now = Date.now();
    const isValid = parsed.expiry > now;

    logger.debug('Stored session check', {
      hasJWT: !!parsed.jwt,
      expiresAt: new Date(parsed.expiry).toISOString(),
      isValid
    });

    return isValid;
  } catch (error) {
    logger.debug('No valid stored session', error);
    return false;
  }
}

/**
 * Main initialization function
 * Called on DOMContentLoaded
 */
async function initialize() {
  try {
    logger.info('🚀 Starting Dashie Dashboard...');

    // Detect platform FIRST
    const platformDetector = getPlatformDetector();
    const isMobile = platformDetector.isMobile();

    logger.info('Platform detected', {
      platform: platformDetector.platform,
      deviceType: platformDetector.deviceType,
      isMobile
    });

    // Check for auth bypass FIRST (before importing auth modules)
    const bypassAuth = isAuthBypassEnabled();

    if (bypassAuth) {
      logger.warn('⚠️ AUTH BYPASS ACTIVE - Developer Mode');
      logger.warn('Dashboard will load without authentication or data');
      logger.warn('To disable: Remove ?bypass-auth from URL');

      // Skip auth entirely - go straight to dashboard with bypass flag
      await initializeCore({ bypassAuth: true, isMobile });
      return;
    }

    // Show appropriate UI based on platform
    if (isMobile) {
      logger.info('📱 Mobile device detected - showing mobile landing page');

      // Check if user has stored session before hiding login screen
      const hasStoredSession = checkForStoredSession();

      if (hasStoredSession) {
        // Hide oauth-login-screen on mobile when authenticated (it has high z-index and covers mobile UI)
        const loginScreen = document.getElementById('oauth-login-screen');
        if (loginScreen) {
          loginScreen.style.display = 'none';
          logger.debug('Login screen hidden on mobile (authenticated user)');
        }

        showMobileLandingPage();
        showMobileLoadingBar();
        updateMobileProgress(10, 'Starting up...');
      } else {
        // Not authenticated - keep oauth-login-screen visible for mobile login
        logger.info('Mobile user not authenticated - showing login screen');
        // Don't show mobile landing page yet - wait for authentication
      }
    } else {
      logger.info('🖥️ Desktop/TV detected - loading dashboard');
    }

    // Normal auth flow - dynamically import to avoid loading Supabase if bypassed
    const { sessionManager } = await import('./data/auth/orchestration/session-manager.js');
    const { initializeAuth } = await import('./core/initialization/auth-initializer.js');

    // Expose sessionManager globally for console commands
    window.sessionManager = sessionManager;

    // Update progress
    if (isMobile) {
      updateMobileProgress(30, 'Authenticating...');
    }

    // Step 1: Initialize auth (may show login screen)
    const authenticated = await initializeAuth(async () => {
      // This callback is called after successful authentication
      logger.info('Auth complete - continuing initialization');

      if (isMobile) {
        // If mobile UI wasn't shown yet (user just authenticated), show it now
        const mobileContainer = document.getElementById('mobile-container');
        if (mobileContainer && mobileContainer.style.display === 'none') {
          logger.info('Mobile user authenticated - showing mobile UI now');

          // Hide login screen
          const loginScreen = document.getElementById('oauth-login-screen');
          if (loginScreen) {
            loginScreen.style.display = 'none';
          }

          // Show mobile UI
          showMobileLandingPage();
          showMobileLoadingBar();
          updateMobileProgress(50, 'Authenticated!');
        }

        updateMobileProgress(60, 'Initializing...');
      }

      // Initialize core with mobile flag (this will update mobile progress from 65% onwards)
      await initializeCore({ isMobile });

      // Mobile-specific initialization
      if (isMobile) {
        updateMobileProgress(90, 'Setting up...');
        await initializeMobileUI();
        updateMobileProgress(100, 'Ready!');

        // Hide loading bar after short delay
        setTimeout(() => {
          hideMobileLoadingBar();
        }, 500);
      }
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
