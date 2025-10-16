// js/ui/mobile-helpers.js
// CHANGE SUMMARY: Extracted mobile UI functions from main.js for better organization

import { createLogger } from '../utils/logger.js';
import { showSettings } from '../settings/settings-main.js';

const logger = createLogger('MobileHelpers');

/**
 * Show mobile loading bar
 */
export function showMobileLoadingBar() {
  const loadingBar = document.getElementById('mobile-loading-bar');
  if (loadingBar) {
    loadingBar.classList.add('active');
  }
}

/**
 * Update mobile loading progress
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} message - Status message
 */
export function updateMobileLoadingProgress(progress, message) {
  const progressFill = document.getElementById('mobile-progress-fill');
  const progressText = document.getElementById('mobile-progress-text');
  
  if (progressFill) {
    progressFill.style.width = `${progress}%`;
  }
  
  if (progressText) {
    progressText.textContent = message;
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
  }
}

/**
 * Update mobile header family name
 * @param {string} familyName - The family name to display
 */
export function updateMobileFamilyName(familyName) {
  const familyNameEl = document.querySelector('.mobile-header .family-name');
  if (familyNameEl) {
    familyNameEl.textContent = familyName || 'Dashie';
    logger.debug('Updated mobile header family name:', familyName);
  }
}

/**
 * Populate mobile UI with user data
 */
export async function populateMobileUI() {
  logger.info('Populating mobile UI');
  
  // Wait for settings to be fully ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Get family name from settings
  let familyName = 'Dashie'; // Default
  
  try {
    // Try multiple sources for family name
    if (window.settingsInstance?.controller) {
      familyName = window.settingsInstance.controller.getSetting('family.familyName') || 'Dashie';
      logger.debug('Got family name from settings controller:', familyName);
    } else {
      // Fallback to localStorage
      const savedSettings = localStorage.getItem('dashie-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        familyName = settings?.family?.familyName || 'Dashie';
        logger.debug('Got family name from localStorage:', familyName);
      }
    }
  } catch (error) {
    logger.warn('Could not get family name from settings:', error);
  }
  
  // Set initial family name
  updateMobileFamilyName(familyName);
  
  // Listen for family name changes from settings
  window.addEventListener('dashie-mobile-family-name-changed', (event) => {
    const newFamilyName = event.detail?.familyName;
    if (newFamilyName) {
      updateMobileFamilyName(newFamilyName);
    }
  });
  logger.debug('Family name change listener registered');
  
  // Get user profile picture
  const user = window.dashieAuth?.getUser();
  if (user?.picture || user?.photoURL) {
    const profilePic = document.querySelector('.mobile-header .profile-pic');
    if (profilePic) {
      profilePic.src = user.picture || user.photoURL;
      profilePic.style.display = 'block';
      logger.debug('Set profile picture');
    }
  } else {
    logger.debug('No profile picture available');
  }
  
  // Wire up Settings button
  const settingsBtn = document.getElementById('mobile-settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      logger.info('Settings button clicked');
      showSettings();
    });
    logger.debug('Settings button wired up');
  }
}

/**
 * Show mobile landing page
 */
export function showMobileLandingPage() {
  logger.info('Showing mobile landing page');
  
  const mobileContainer = document.getElementById('mobile-container');
  const app = document.getElementById('app');
  
  if (mobileContainer && app) {
    // Add class to body for CSS targeting
    document.body.classList.add('mobile-mode-active');
    
    // Force hide desktop app
    app.style.display = 'none';
    app.style.visibility = 'hidden';
    
    // Show mobile container
    mobileContainer.style.display = 'flex';
    mobileContainer.style.visibility = 'visible';
    
    logger.debug('Mobile landing page visible, desktop hidden');
  }
}

/**
 * Show desktop/TV dashboard
 */
export function showDesktopDashboard() {
  logger.info('Showing desktop/TV dashboard');
  
  const mobileContainer = document.getElementById('mobile-container');
  const app = document.getElementById('app');
  
  if (mobileContainer && app) {
    mobileContainer.style.display = 'none';
    app.style.display = 'flex';
    
    logger.debug('Desktop/TV dashboard visible');
  }
}

/**
 * Force hide desktop UI elements (called after authentication on mobile)
 */
export function forceHideDesktopUI() {
  const app = document.getElementById('app');
  const sidebar = document.getElementById('sidebar');
  const sidebarWrapper = document.getElementById('sidebar-wrapper');
  const grid = document.getElementById('grid');
  
  if (app) {
    app.style.display = 'none';
    app.style.visibility = 'hidden';
  }
  if (sidebar) {
    sidebar.style.display = 'none';
    sidebar.style.visibility = 'hidden';
  }
  if (sidebarWrapper) {
    sidebarWrapper.style.display = 'none';
    sidebarWrapper.style.visibility = 'hidden';
  }
  if (grid) {
    grid.style.display = 'none';
    grid.style.visibility = 'hidden';
  }
  
  logger.debug('Desktop UI forcibly hidden');
}