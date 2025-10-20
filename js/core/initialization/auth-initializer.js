// js/core/initialization/auth-initializer.js
// Authentication initialization module
// Extracted from index.html inline JavaScript

import { createLogger } from '../../utils/logger.js';
import { sessionManager } from '../../data/auth/orchestration/session-manager.js';
import { AuthCoordinator } from '../../data/auth/orchestration/auth-coordinator.js';
import { getPlatformDetector } from '../../utils/platform-detector.js';

const logger = createLogger('AuthInitializer');

// Global reference for auth coordinator
let authCoordinator = null;
let isAuthenticated = false;

/**
 * UI Helper: Update login status message
 */
function updateLoginStatus(message) {
  document.getElementById('login-status').textContent = message;
}

/**
 * UI Helper: Update login button text and state
 */
function updateLoginButton(text, enabled = true, showSpinner = false) {
  const button = document.getElementById('login-button');
  button.disabled = !enabled;

  const googleLogo = `
    <svg class="google-logo" width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  `;

  if (showSpinner) {
    button.innerHTML = `<span class="spinner"></span><span>${text}</span>`;
  } else if (text.includes('Sign in') || text.includes('Retry')) {
    button.innerHTML = `${googleLogo}<span>${text}</span>`;
  } else {
    button.innerHTML = `<span>${text}</span>`;
  }
}

/**
 * UI Helper: Show login error message
 */
function showLoginError(message) {
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

/**
 * UI Helper: Hide login screen and show dashboard
 */
export function hideLoginScreen() {
  document.getElementById('oauth-login-screen').classList.add('hidden');
  document.getElementById('dashboard-container').classList.add('visible');

  // Clean up login screen input handler
  if (window._loginInputHandler) {
    document.removeEventListener('keydown', window._loginInputHandler, true);
    delete window._loginInputHandler;
    logger.debug('Login screen input handler removed');
  }

  // Unregister login screen from modal manager
  if (window.dashieModalManager) {
    window.dashieModalManager.unregisterModal();
    logger.debug('Login screen unregistered from modal manager');
  }
}

/**
 * Populate site info (dev vs prod link)
 */
function populateSiteInfo() {
  const hostname = window.location.hostname;
  const isDev = hostname.includes('dev') || hostname === 'localhost' || hostname.startsWith('localhost');
  const platform = getPlatformDetector();
  const platformDesc = platform.getPlatformDescription();

  const siteInfoDiv = document.getElementById('site-info-external');
  if (!siteInfoDiv) return;

  if (isDev) {
    siteInfoDiv.innerHTML = `
      <p>Running in <strong>Development Mode</strong> on ${platformDesc}</p>
      <p>
        <a href="https://dashie.family" class="prod-site-link" target="_blank">
          Visit Production Site →
        </a>
      </p>
    `;
  } else {
    siteInfoDiv.innerHTML = `
      <p>Running on ${platformDesc}</p>
    `;
  }
}

/**
 * Setup D-pad navigation for login screen
 */
function setupLoginNavigation() {
  const loginButton = document.getElementById('login-button');
  const exitButton = document.getElementById('exit-app-btn');
  const prodLink = document.querySelector('.prod-site-link');

  let focusableElements = [loginButton, exitButton];
  if (prodLink) {
    focusableElements.push(prodLink);
  }

  let currentFocus = 0;

  // Set initial focus
  focusableElements[currentFocus].focus();

  // Create navigation handler
  const navigationHandler = (e) => {
    // Only handle if login screen is visible
    if (document.getElementById('oauth-login-screen').classList.contains('hidden')) {
      return;
    }

    const key = e.key || e.keyCode;

    // DOWN: Move to next element
    if (key === 'ArrowDown' || key === 40 || key === 'Down') {
      e.preventDefault();
      e.stopPropagation();
      currentFocus = (currentFocus + 1) % focusableElements.length;
      focusableElements[currentFocus].focus();
    }

    // UP: Move to previous element
    if (key === 'ArrowUp' || key === 38 || key === 'Up') {
      e.preventDefault();
      e.stopPropagation();
      currentFocus = (currentFocus - 1 + focusableElements.length) % focusableElements.length;
      focusableElements[currentFocus].focus();
    }
  };

  // Register handler at capture phase with high priority
  document.addEventListener('keydown', navigationHandler, true);
  window._loginInputHandler = navigationHandler;

  logger.verbose('Login navigation setup complete');
}

/**
 * Initialize authentication system
 * @param {Function} onAuthComplete - Callback when auth completes successfully
 * @returns {Promise<boolean>} True if authenticated, false if showing login screen
 */
export async function initializeAuth(onAuthComplete) {
  try {
    logger.info('🔐 Initializing authentication...');

    // Check if we're in an OAuth callback flow (redirect from Google)
    const urlParams = new URLSearchParams(window.location.search);
    const isOAuthCallback = urlParams.has('code') && urlParams.has('state');

    // If OAuth callback detected, immediately show loading dashboard state
    if (isOAuthCallback) {
      logger.debug('OAuth callback detected, showing loading dashboard state');
      document.getElementById('sign-in-state').style.display = 'none';
      document.getElementById('loading-dashboard-state').style.display = 'flex';
    } else {
      updateLoginStatus('Setting up authentication system...');
    }

    // Create auth coordinator
    authCoordinator = new AuthCoordinator();

    // Populate site info (only if not OAuth callback)
    if (!isOAuthCallback) {
      populateSiteInfo();
    }

    // Initialize SessionManager (handles entire auth flow)
    const result = await sessionManager.initialize(authCoordinator);

    // Check authentication result
    if (result.authenticated) {
      const user = sessionManager.getUser();

      // Show loading dashboard state if not already shown
      if (!isOAuthCallback) {
        document.getElementById('sign-in-state').style.display = 'none';
        document.getElementById('loading-dashboard-state').style.display = 'flex';
      }

      // Update welcome message with user's name
      const welcomeEl = document.getElementById('loading-dashboard-welcome');
      if (welcomeEl && user) {
        const userName = user.name ? user.name.split(' ')[0] : user.email.split('@')[0];
        welcomeEl.textContent = `Welcome, ${userName}`;
      }

      isAuthenticated = true;

      // Proceed to dashboard initialization
      // Note: hideLoginScreen() will be called from main.js after widgets are initialized
      if (onAuthComplete) {
        onAuthComplete();
      }

      return true;
    }

    // Not authenticated - show sign in button
    logger.info('No user authenticated');
    document.getElementById('login-status').style.display = 'none'; // Hide status box
    updateLoginButton('Sign in with Google', true, false);

    // Setup D-pad navigation
    setupLoginNavigation();

    // Attach sign-in handler
    const isFireTV = authCoordinator.isFireTVPlatform();
    const loginButton = document.getElementById('login-button');
    const exitButton = document.getElementById('exit-app-btn');

    const handleSignIn = async () => {
      try {
        const buttonText = isFireTV ? 'Starting Device Flow...' : 'Redirecting to Google...';
        updateLoginButton(buttonText, false, true);
        updateLoginStatus(isFireTV ? 'Follow instructions on screen...' : 'Redirecting...');

        const signInResult = await sessionManager.signIn({ useDeviceFlow: isFireTV });

        // Check for redirect (web OAuth)
        if (signInResult && signInResult.redirected) {
          logger.debug('OAuth redirect initiated');
          return;
        }

        // Sign-in successful
        if (signInResult && signInResult.email) {
          // Hide sign-in state and show loading dashboard state
          document.getElementById('sign-in-state').style.display = 'none';
          document.getElementById('loading-dashboard-state').style.display = 'flex';

          // Update welcome message with user's name
          const welcomeEl = document.getElementById('loading-dashboard-welcome');
          if (welcomeEl && signInResult) {
            const userName = signInResult.name ? signInResult.name.split(' ')[0] : signInResult.email.split('@')[0];
            welcomeEl.textContent = `Welcome, ${userName}`;
          }

          isAuthenticated = true;

          // Proceed to dashboard initialization
          // Note: hideLoginScreen() will be called from main.js after widgets are initialized
          if (onAuthComplete) {
            onAuthComplete();
          }
        }

      } catch (error) {
        logger.error('Sign-in failed', error);
        showLoginError(`Sign-in failed: ${error.message}`);
        updateLoginButton('Sign in with Google', true, false);
      }
    };

    loginButton.onclick = handleSignIn;

    // Add keyboard/D-pad handler
    loginButton.addEventListener('keydown', (e) => {
      if (e.keyCode === 13 || e.keyCode === 23 || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (!loginButton.disabled) {
          handleSignIn();
        }
      }
    });

    // Auto-focus button when enabled (for D-pad navigation)
    const observer = new MutationObserver(() => {
      if (!loginButton.disabled) {
        setTimeout(() => {
          loginButton.focus();
          logger.debug('Auto-focused login button');
        }, 100);
        observer.disconnect();
      }
    });
    observer.observe(loginButton, { attributes: true, attributeFilter: ['disabled'] });

    // Setup Exit button handler
    exitButton.addEventListener('click', (e) => {
      e.preventDefault();
      logger.info('Exit button clicked');
      window.close(); // Try to close window (works in some environments)
    });

    exitButton.addEventListener('keydown', (e) => {
      if (e.keyCode === 13 || e.keyCode === 23 || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        logger.info('Exit button selected');
        window.close();
      }
    });

    return false;

  } catch (error) {
    logger.error('Auth initialization failed', error);
    showLoginError(`Authentication error: ${error.message}`);
    updateLoginButton('Retry', true, false);

    document.getElementById('login-button').onclick = () => {
      window.location.reload();
    };

    return false;
  }
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isUserAuthenticated() {
  return isAuthenticated;
}
