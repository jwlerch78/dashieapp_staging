// js/utils/redirect-manager.js - Extracted Redirect Logic from auth-ui.js
// CHANGE SUMMARY: Simple extraction of existing redirect methods from auth-ui.js - no changes to logic, just moved to separate module

import { createLogger } from './logger.js';
import { getPlatformDetector } from './platform-detector.js';

const logger = createLogger('RedirectManager');

/**
 * Manages site redirections - extracted from existing auth-ui.js
 * Contains exact same logic as original, just in separate module
 */
export class RedirectManager {
  constructor() {
    this.platform = getPlatformDetector();
    this.isDevelopmentSite = this.detectDevelopmentEnvironment();
    
    logger.debug('Redirect manager initialized', {
      isDevelopmentSite: this.isDevelopmentSite,
      platform: this.platform.platform
    });
  }

  /**
   * Detect if we're on development environment (from original auth-ui.js)
   * @returns {boolean} True if on dev/localhost
   */
  detectDevelopmentEnvironment() {
    const hostname = window.location.hostname;
    return hostname.includes('dev') || 
           hostname === 'localhost' || 
           hostname.startsWith('localhost');
  }

  /**
   * Show redirect confirmation modal (extracted from original auth-ui.js)
   */
  showRedirectModal() {
    logger.debug('Showing redirect modal');
    
    // Determine target site and messaging (original logic)
    const targetSite = this.isDevelopmentSite ? 'production' : 'development';
    const targetUrl = this.isDevelopmentSite ? 'https://dashieapp.com' : 'https://dev.dashieapp.com';
    
    const modal = document.createElement('div');
    modal.className = 'redirect-modal-backdrop';
    modal.innerHTML = `
      <div class="redirect-modal">
        <h3>Switch to ${targetSite.charAt(0).toUpperCase() + targetSite.slice(1)} Site?</h3>
        <p>You are about to switch to the ${targetSite} site:</p>
        <p><strong>${targetUrl}</strong></p>
        <p>Do you want to continue?</p>
        
        <div class="redirect-modal-buttons">
          <button id="redirect-yes" class="redirect-modal-button primary" tabindex="1">
            Yes
          </button>
          
          <button id="redirect-cancel" class="redirect-modal-button cancel" tabindex="2">
            Cancel
          </button>
        </div>
        
        <div class="redirect-modal-divider"></div>
        
        <div class="redirect-modal-always-section">
          <button id="redirect-always" class="redirect-modal-button secondary" tabindex="3">
            Always Redirect
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Set up event handlers (original logic)
    this.setupRedirectModalHandlers(modal);
    
    // Auto-focus first button
    setTimeout(() => {
      document.getElementById('redirect-yes')?.focus();
    }, 100);
  }

  /**
   * Set up redirect modal event handlers (extracted from original auth-ui.js)
   * @param {HTMLElement} modal
   */
  setupRedirectModalHandlers(modal) {
    const yesBtn = document.getElementById('redirect-yes');
    const cancelBtn = document.getElementById('redirect-cancel');
    const alwaysBtn = document.getElementById('redirect-always');

    // Click handlers (original logic)
    yesBtn?.addEventListener('click', () => {
      this.handleRedirectChoice('yes');
      modal.remove();
    });

    cancelBtn?.addEventListener('click', () => {
      modal.remove();
    });

    alwaysBtn?.addEventListener('click', () => {
      this.handleRedirectChoice('always');
      modal.remove();
    });

    // Set up modal TV navigation (original logic)
    if (this.platform.isTV()) {
      this.setupModalTVNavigation(modal);
    }

    // Escape key to close (original logic)
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  /**
   * Set up TV navigation for redirect modal (extracted from original auth-ui.js)
   * @param {HTMLElement} modal
   */
  setupModalTVNavigation(modal) {
    const handleModalNavigation = (e) => {
      const buttons = modal.querySelectorAll('.redirect-modal-button');
      const focusedElement = document.activeElement;
      const currentIndex = Array.from(buttons).findIndex(btn => btn === focusedElement);
      
      switch (e.keyCode) {
        case 40: // D-pad down
          e.preventDefault();
          const nextIndex = (currentIndex + 1) % buttons.length;
          buttons[nextIndex]?.focus();
          break;
          
        case 38: // D-pad up
          e.preventDefault();
          const prevIndex = currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1;
          buttons[prevIndex]?.focus();
          break;
          
        case 13: // Enter
        case 23: // Fire TV Select
          e.preventDefault();
          focusedElement?.click();
          break;
      }
    };
    
    document.addEventListener('keydown', handleModalNavigation, true);
    
    // Clean up when modal is removed (original logic)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (node === modal) {
            document.removeEventListener('keydown', handleModalNavigation, true);
            observer.disconnect();
          }
        });
      });
    });
    
    observer.observe(document.body, { childList: true });
  }

  /**
   * Handle redirect choice and execute (extracted from original auth-ui.js)
   * @param {string} choice - 'yes', 'always', or 'cancel'
   */
  async handleRedirectChoice(choice) {
    logger.info('Redirect choice made', { choice });

    if (choice === 'yes') {
      // Determine target URL based on current environment (original logic)
      const targetUrl = this.isDevelopmentSite 
        ? 'https://dashieapp.com?noredirect=true'
        : 'https://dev.dashieapp.com?noredirect=true';
      
      // Perform redirect with noredirect parameter to prevent infinite loops
      window.location.href = targetUrl;
    } else if (choice === 'always') {
      // Update local settings to enable auto-redirect (original logic)
      try {
        // Get existing local settings or create empty object
        const localSettings = JSON.parse(localStorage.getItem('dashie-local-settings') || '{}');
        
        // Ensure system object exists
        if (!localSettings.system) {
          localSettings.system = {};
        }
        
        // Set auto-redirect preferences
        localSettings.system.autoRedirect = true;
        localSettings.system.activeSite = this.isDevelopmentSite ? 'prod' : 'dev';
        
        // Save to localStorage with the correct key that matches your settings system
        localStorage.setItem('dashie-local-settings', JSON.stringify(localSettings));
        
        logger.info('Auto-redirect enabled in dashie-local-settings', { 
          targetSite: localSettings.system.activeSite,
          autoRedirect: localSettings.system.autoRedirect,
          fullSettings: localSettings
        });
        
        // Also update the main settings if they exist (for compatibility)
        try {
          const mainSettings = JSON.parse(localStorage.getItem('dashie-settings') || '{}');
          if (!mainSettings.system) mainSettings.system = {};
          mainSettings.system.autoRedirect = true;
          mainSettings.system.activeSite = this.isDevelopmentSite ? 'prod' : 'dev';
          localStorage.setItem('dashie-settings', JSON.stringify(mainSettings));
        } catch (error) {
          logger.warn('Could not update main settings, continuing with local-only', error);
        }
        
        // Perform the redirect immediately after saving settings
        const targetUrl = this.isDevelopmentSite 
          ? 'https://dashieapp.com?noredirect=true'
          : 'https://dev.dashieapp.com?noredirect=true';
        
        window.location.href = targetUrl;
      } catch (error) {
        logger.error('Failed to save auto-redirect setting', error);
        
        // Fall back to just redirecting once
        const targetUrl = this.isDevelopmentSite 
          ? 'https://dashieapp.com?noredirect=true'
          : 'https://dev.dashieapp.com?noredirect=true';
        
        window.location.href = targetUrl;
      }
    }
    // For cancel, just close modal (already handled in setupRedirectModalHandlers)
  }

  /**
   * Get platform display name for footer (from original auth-ui.js)
   * @returns {string}
   */
  getPlatformDisplayName() {
    return this.platform.getPlatformDescription();
  }

  /**
   * Get environment-specific footer HTML (from original auth-ui.js)
   * @returns {string}
   */
  getEnvironmentFooterHTML() {
    if (this.isDevelopmentSite) {
      return `
        <p>Logging into Dev Site &nbsp;&nbsp;|&nbsp;&nbsp; ${this.getPlatformDisplayName()}</p>
        <p><a href="#" id="site-switch-link" class="prod-site-link" tabindex="3">Go to production site</a></p>
      `;
    } else {
      // Production site - show dev link
      return `
        <p>Logging into Production Site &nbsp;&nbsp;|&nbsp;&nbsp; ${this.getPlatformDisplayName()}</p>
        <p><a href="#" id="site-switch-link" class="prod-site-link" tabindex="3">Go to development site</a></p>
      `;
    }
  }

  /**
   * Set up site switch link event handlers (from original auth-ui.js)
   */
  setupSiteSwitchLink() {
    const siteLink = document.getElementById('site-switch-link');
    if (siteLink) {
      siteLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showRedirectModal();
      });
      
      siteLink.addEventListener('keydown', (e) => {
        logger.debug('Site switch link keydown', { keyCode: e.keyCode, key: e.key });
        if (e.keyCode === 13 || e.keyCode === 23 || e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          this.showRedirectModal();
        }
      });
    }
  }
  /**
 * Check for immediate redirect using localStorage (from settings system)
 * @returns {boolean} True if redirect happened, false otherwise
 */
checkRedirectSync() {
  try {
    logger.debug('Checking for immediate redirect');
    
    // Check for noredirect parameter first
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('noredirect') === 'true') {
      logger.info('Redirect bypassed due to ?noredirect=true parameter');
      return false;
    }

    // Get settings from localStorage (same logic as settings system)
    let settings = null;
    
    // Try dashie-local-settings first
    try {
      const localSettings = localStorage.getItem('dashie-local-settings');
      if (localSettings) {
        settings = JSON.parse(localSettings);
        logger.debug('Loaded dashie-local-settings for redirect check');
      }
    } catch (e) {
      logger.warn('Failed to parse dashie-local-settings', e);
    }

    // Fallback to dashie-settings
    if (!settings) {
      try {
        const mainSettings = localStorage.getItem('dashie-settings');
        if (mainSettings) {
          settings = JSON.parse(mainSettings);
          logger.debug('Loaded dashie-settings for redirect check');
        }
      } catch (e) {
        logger.warn('Failed to parse dashie-settings', e);
      }
    }

    // If no settings, no redirect needed
    if (!settings || !settings.system) {
      logger.debug('No settings found, no redirect needed');
      return false;
    }

    // Check redirect settings
    const autoRedirect = settings.system.autoRedirect;
    const targetSite = settings.system.activeSite || 'prod';
    
    if (!autoRedirect) {
      logger.debug('Auto-redirect not enabled');
      return false;
    }

    // Determine current site (using existing method)
    const currentSite = this.getCurrentSite();
    
    // If we're already on the target site, no redirect needed
    if (currentSite === targetSite) {
      logger.debug(`Already on target site: ${currentSite}`);
      return false;
    }

    // Perform the redirect (using existing methods)
    const targetUrl = this.getTargetUrl(targetSite);
    const redirectUrl = `${targetUrl}?noredirect=true`;
    
    logger.info(`Performing immediate redirect from ${currentSite} to ${targetSite}`, {
      currentSite,
      targetSite,
      redirectUrl
    });

    window.location.href = redirectUrl;
    return true; // Redirect happening
    
  } catch (error) {
    logger.error('Error checking for immediate redirect', error);
    return false; // Don't block normal flow on error
  }
}

/**
 * Get the current site identifier  
 * @returns {string} 'prod', 'dev', or 'other'
 */
getCurrentSite() {
  const hostname = window.location.hostname;
  
  if (hostname === 'dashieapp.com' || hostname === 'www.dashieapp.com') {
    return 'prod';
  } else if (hostname === 'dev.dashieapp.com') {
    return 'dev';
  } else {
    return 'other';
  }
}

/**
 * Get the target URL for a given site
 * @param {string} targetSite - 'prod' or 'dev'
 * @returns {string} Target URL
 */
getTargetUrl(targetSite) {
  const urls = {
    prod: 'https://dashieapp.com',
    dev: 'https://dev.dashieapp.com'
  };
  return urls[targetSite];
}


}