// js/ui/mobile-ui.js
// Mobile UI helper functions for phone/tablet responsive interface

import { createLogger } from '../utils/logger.js';

const logger = createLogger('MobileUI');

/**
 * Show mobile landing page
 * Hides desktop dashboard and displays mobile-only UI
 */
export function showMobileLandingPage() {
  logger.info('Showing mobile landing page');

  const mobileContainer = document.getElementById('mobile-container');
  const dashboardContainer = document.getElementById('dashboard-container');
  const loginScreen = document.getElementById('oauth-login-screen');

  if (mobileContainer) {
    // Add class to body for CSS targeting
    document.body.classList.add('mobile-mode-active');

    // Show mobile container
    mobileContainer.style.display = 'flex';
    mobileContainer.style.visibility = 'visible';

    // Force hide desktop elements
    if (dashboardContainer) {
      dashboardContainer.style.display = 'none';
      dashboardContainer.style.visibility = 'hidden';
    }

    // Keep login screen visible during auth
    // It will be hidden by hideLoginScreen() after auth completes

    logger.debug('Mobile landing page visible, desktop hidden');
  } else {
    logger.error('Mobile container element not found');
  }
}

/**
 * Hide mobile landing page and show desktop dashboard
 * Used if user switches to desktop mode or for testing
 */
export function hideMobileLandingPage() {
  logger.info('Hiding mobile landing page');

  const mobileContainer = document.getElementById('mobile-container');
  const dashboardContainer = document.getElementById('dashboard-container');

  if (mobileContainer) {
    document.body.classList.remove('mobile-mode-active');
    mobileContainer.style.display = 'none';
  }

  if (dashboardContainer) {
    dashboardContainer.style.display = '';
    dashboardContainer.style.visibility = '';
  }

  logger.debug('Mobile landing page hidden, desktop visible');
}

/**
 * Show mobile loading bar
 */
export function showMobileLoadingBar() {
  const loadingBar = document.getElementById('mobile-loading-bar');
  if (loadingBar) {
    loadingBar.classList.add('active');
    logger.debug('Mobile loading bar shown');
  }
}

/**
 * Hide mobile loading bar and enable Settings button
 */
export function hideMobileLoadingBar() {
  const loadingBar = document.getElementById('mobile-loading-bar');
  const settingsBtn = document.getElementById('mobile-settings-btn');

  if (loadingBar) {
    loadingBar.classList.remove('active');
  }

  if (settingsBtn) {
    settingsBtn.disabled = false;
    logger.debug('Settings button enabled');
  }

  logger.debug('Mobile loading bar hidden');
}

/**
 * Update mobile loading progress
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} message - Status message
 */
export function updateMobileProgress(progress, message) {
  const progressFill = document.getElementById('mobile-progress-fill');
  const progressText = document.getElementById('mobile-progress-text');

  if (progressFill) {
    progressFill.style.width = `${progress}%`;
  }

  if (progressText && message) {
    progressText.textContent = message;
  }

  logger.verbose('Mobile progress updated', { progress, message });
}

/**
 * Update mobile header family name
 * @param {string} familyName - The family name to display (e.g., "Smith")
 */
export function updateMobileFamilyName(familyName) {
  const familyNameEl = document.querySelector('.mobile-header .family-name');
  if (familyNameEl) {
    // Format as "The [Name] Family"
    const formattedName = formatFamilyName(familyName);
    familyNameEl.textContent = formattedName;
    logger.debug('Updated mobile header family name', { familyName, formattedName });
  }
}

/**
 * Update mobile profile picture
 * @param {string} photoURL - URL to profile picture
 */
export function updateMobileProfilePicture(photoURL) {
  const profilePic = document.querySelector('.mobile-header .profile-pic');
  if (profilePic && photoURL) {
    profilePic.src = photoURL;
    profilePic.style.display = 'block';
    logger.debug('Updated mobile profile picture');
  }
}

/**
 * Setup mobile Settings button
 * Wires the button to open the Settings module
 */
export function setupMobileSettings() {
  const settingsBtn = document.getElementById('mobile-settings-btn');

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      logger.info('Mobile Settings button clicked');

      // Open Settings module
      if (window.Settings) {
        try {
          logger.debug('Attempting to activate Settings module', {
            initialized: window.Settings.initialized,
            hasActivate: typeof window.Settings.activate === 'function'
          });

          window.Settings.activate();
          logger.success('Settings activated successfully');
        } catch (error) {
          logger.error('Failed to activate Settings', error);
        }
      } else {
        logger.error('Settings module not available on window object');
      }
    });

    logger.debug('Mobile Settings button wired up');
  } else {
    logger.warn('Mobile Settings button not found');
  }
}

/**
 * Initialize mobile UI after authentication
 * Loads user data and wires up interactivity
 */
export async function initializeMobileUI() {
  logger.info('Initializing mobile UI');

  // Get family name from settings
  let familyName = 'Dashie'; // Default

  try {
    // Try to get from settingsStore
    if (window.settingsStore) {
      familyName = window.settingsStore.get('family.familyName') || 'Dashie';
      logger.debug('Got family name from settingsStore', { familyName });
    } else {
      // Fallback to localStorage
      const savedSettings = localStorage.getItem('dashie-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        familyName = settings?.family?.familyName || 'Dashie';
        logger.debug('Got family name from localStorage', { familyName });
      }
    }
  } catch (error) {
    logger.warn('Could not get family name from settings', error);
  }

  // Update UI
  updateMobileFamilyName(familyName);

  // Get user profile picture from session
  try {
    if (window.sessionManager) {
      const user = window.sessionManager.getUser();

      if (user?.picture) {
        const photoURL = user.picture;
        updateMobileProfilePicture(photoURL);
        logger.debug('Profile picture set from user object', { photoURL });
      } else {
        logger.debug('No profile picture in user object', { user });
      }
    }
  } catch (error) {
    logger.warn('Could not get profile picture', error);
  }

  // Wire up Settings button
  setupMobileSettings();

  logger.success('Mobile UI initialized');
}

/**
 * Format base family name to "The [Name] Family"
 * @private
 * @param {string} baseName - Base family name (e.g., "Smith")
 * @returns {string} Formatted name (e.g., "The Smith Family")
 */
function formatFamilyName(baseName) {
  if (!baseName || baseName === 'Dashie') {
    return 'The Dashie Family';
  }

  // If already formatted, return as-is
  if (baseName.startsWith('The ') && baseName.endsWith(' Family')) {
    return baseName;
  }

  // Remove any existing "The " or " Family" to get clean base name
  let cleanName = baseName.trim();
  if (cleanName.startsWith('The ')) {
    cleanName = cleanName.substring(4);
  }
  if (cleanName.endsWith(' Family')) {
    cleanName = cleanName.substring(0, cleanName.length - 7);
  }

  // Format to "The [Name] Family"
  return `The ${cleanName.trim()} Family`;
}
