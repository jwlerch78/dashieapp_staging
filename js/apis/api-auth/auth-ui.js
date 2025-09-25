// js/apis/api-auth/auth-ui.js - Authentication UI Management
// CHANGE SUMMARY: Added dev environment detection, orange background, production site link, d-pad navigation, redirect modal, settings integration

import { createLogger } from '../../utils/logger.js';
import { getPlatformDetector } from '../../utils/platform-detector.js';

const logger = createLogger('AuthUI');

/**
 * Authentication UI manager
 * Handles all auth-related UI displays and interactions
 */
export class AuthUI {
  constructor() {
    this.platform = getPlatformDetector();
    this.loadAuthUIStyles();
    
    // Environment detection
    this.isDevelopmentSite = this.detectDevelopmentEnvironment();
    
    logger.debug('Auth UI initialized', {
      platform: this.platform.platform,
      deviceType: this.platform.deviceType,
      isTV: this.platform.isTV(),
      isDevelopmentSite: this.isDevelopmentSite
    });
  }

  /**
   * Detect if we're on development environment
   * @returns {boolean} True if on dev/localhost
   */
  detectDevelopmentEnvironment() {
    const hostname = window.location.hostname;
    return hostname.includes('dev') || 
           hostname === 'localhost' || 
           hostname.startsWith('localhost');
  }

  /**
   * CSS is now loaded via index.html - no dynamic loading needed
   */
  loadAuthUIStyles() {
    // CSS file is included in index.html, no dynamic loading needed
    logger.debug('Auth UI CSS loaded via index.html');
  }

  /**
   * Show sign-in prompt with platform-appropriate UI
   * @param {Function} onSignIn - Sign-in callback
   * @param {Function} onExit - Exit callback
   */
  showSignInPrompt(onSignIn, onExit = null) {
    this.hideSignInPrompt();
    
    const app = document.getElementById('app');
    if (app) {
      app.style.display = 'none';
      app.classList.remove('authenticated');
    }
    
    // Use appropriate theme based on environment
    if (this.isDevelopmentSite) {
      document.body.classList.add('temp-dev-theme');
    } else {
      document.body.classList.add('temp-light-theme');
    }
    
    const signInOverlay = document.createElement('div');
    signInOverlay.id = 'sign-in-overlay';
    signInOverlay.innerHTML = this.buildSignInHTML(onExit);
    
    document.body.appendChild(signInOverlay);
    
    // Set up event listeners
    this.setupSignInEventListeners(onSignIn, onExit);
    
    logger.info('Sign-in prompt displayed', {
      platform: this.platform.platform,
      hasExitOption: !!onExit,
      isDevelopmentSite: this.isDevelopmentSite
    });
  }

  /**
   * Build sign-in HTML based on platform and environment
   * @param {Function} onExit - Exit callback
   * @returns {string} Sign-in HTML
   */
  buildSignInHTML(onExit) {
    const hasNativeAuth = this.platform.hasNativeCapabilities();
    const isFireTV = this.platform.platform === 'fire_tv';
    const isTV = this.platform.isTV();
    
    return `
      <div class="sign-in-modal">
        <img src="/icons/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie" class="dashie-logo-signin">
        
        <div class="sign-in-header">
          <h2>Welcome to Dashie!</h2>
          <p>Helping active families manage the chaos</p>
        </div>
        
        <div class="sign-in-content">
          ${this.getSignInButtonHTML(hasNativeAuth, isFireTV)}
          
          ${onExit ? `
          <button id="exit-app-btn" class="signin-button secondary" tabindex="2" ${isTV ? 'data-tv-focusable="true"' : ''}>
            <span class="button-icon">🚪</span>
            Exit App
          </button>
          ` : ''}
        </div>
        
        <div class="sign-in-footer">
          <p class="platform-info">Running on ${this.platform.deviceType}</p>
          ${this.isDevelopmentSite ? this.buildDevelopmentSiteInfo() : ''}
        </div>
      </div>
    `;
  }

  /**
   * Build development site information section
   * @returns {string} Development site info HTML
   */
  buildDevelopmentSiteInfo() {
    return `
      <div class="dev-site-info">
        Logging into Development Site. 
        <span id="production-site-link" 
              class="production-site-link" 
              tabindex="0"
              data-tv-focusable="true"
              role="button"
              aria-label="Go to production site">Go to production site</span>.
      </div>
    `;
  }

  /**
   * Get sign-in button HTML based on capabilities
   * @param {boolean} hasNativeAuth - Native auth availability
   * @param {boolean} isFireTV - Fire TV platform
   * @returns {string} Button HTML
   */
  getSignInButtonHTML(hasNativeAuth, isFireTV) {
    if (hasNativeAuth && !isFireTV) {
      return `
        <button id="native-signin-btn" class="signin-button primary" tabindex="1" data-tv-focusable="true">
          <span class="button-icon">📱</span>
          Sign in with Native Google
        </button>
      `;
    } else if (isFireTV) {
      return `
        <button id="device-flow-btn" class="signin-button primary" tabindex="1" data-tv-focusable="true">
          <span class="button-icon">📺</span>
          Sign in with Fire TV
        </button>
        <div class="sign-in-hint">Use your phone or computer to complete sign-in</div>
      `;
    } else {
      return `
        <button id="web-oauth-btn" class="signin-button primary" tabindex="1" data-tv-focusable="true">
          <span class="button-icon">🌐</span>
          Sign in with Google
        </button>
      `;
    }
  }

  /**
   * Set up event listeners for sign-in interface
   * @param {Function} onSignIn - Sign-in callback
   * @param {Function} onExit - Exit callback
   */
  setupSignInEventListeners(onSignIn, onExit) {
    // Auth buttons
    const nativeSignInBtn = document.getElementById('native-signin-btn');
    const webOAuthBtn = document.getElementById('web-oauth-btn');
    const deviceFlowBtn = document.getElementById('device-flow-btn');
    const exitBtn = document.getElementById('exit-app-btn');
    const productionLink = document.getElementById('production-site-link');

    // Sign-in button handlers
    if (nativeSignInBtn) {
      nativeSignInBtn.addEventListener('click', () => onSignIn('native'));
    }
    if (webOAuthBtn) {
      webOAuthBtn.addEventListener('click', () => onSignIn('web_oauth'));
    }
    if (deviceFlowBtn) {
      deviceFlowBtn.addEventListener('click', () => onSignIn('device_flow'));
    }
    if (exitBtn && onExit) {
      exitBtn.addEventListener('click', onExit);
    }

    // Production site link handler
    if (productionLink) {
      productionLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showSiteRedirectModal();
      });
      
      productionLink.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.showSiteRedirectModal();
        }
      });
    }

    // Set up TV navigation
    if (this.platform.isTV()) {
      this.setupTVNavigation();
    }
  }

  /**
   * Show site redirect confirmation modal
   */
  showSiteRedirectModal() {
    const modal = document.createElement('div');
    modal.className = 'site-redirect-modal-backdrop';
    modal.innerHTML = `
      <div class="site-redirect-modal">
        <div class="modal-header">
          <h3>Switch to Production Site?</h3>
        </div>
        <div class="modal-content">
          <p>You are about to switch to the production site:</p>
          <div class="target-url">https://dashieapp.com</div>
          <p>Choose how you want to proceed:</p>
        </div>
        <div class="modal-buttons">
          <button id="redirect-once" class="modal-button primary" data-tv-focusable="true">
            Yes - Just this once
          </button>
          <button id="redirect-always" class="modal-button secondary" data-tv-focusable="true">
            Yes - Always redirect
          </button>
          <button id="redirect-cancel" class="modal-button tertiary" data-tv-focusable="true">
            Cancel
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Set up modal event handlers
    this.setupRedirectModalHandlers(modal);
    
    // Focus first button
    const firstButton = modal.querySelector('#redirect-once');
    if (firstButton) {
      firstButton.focus();
      firstButton.classList.add('focused');
    }

    logger.info('Site redirect modal displayed');
  }

  /**
   * Set up redirect modal event handlers
   * @param {HTMLElement} modal - Modal element
   */
  setupRedirectModalHandlers(modal) {
    const onceBtn = modal.querySelector('#redirect-once');
    const alwaysBtn = modal.querySelector('#redirect-always');
    const cancelBtn = modal.querySelector('#redirect-cancel');

    // Click handlers
    onceBtn.addEventListener('click', () => {
      this.handleRedirectChoice('once');
      modal.remove();
    });

    alwaysBtn.addEventListener('click', () => {
      this.handleRedirectChoice('always');
      modal.remove();
    });

    cancelBtn.addEventListener('click', () => {
      modal.remove();
    });

    // Set up modal navigation
    if (this.platform.isTV()) {
      this.setupModalTVNavigation(modal);
    }

    // Escape key to close
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  /**
   * Handle redirect choice and execute
   * @param {string} choice - 'once' or 'always'
   */
  async handleRedirectChoice(choice) {
    logger.info('Redirect choice made', { choice });

    if (choice === 'always') {
      // Update local settings to enable auto-redirect
      try {
        const localSettings = JSON.parse(localStorage.getItem('dashie-local-settings') || '{}');
        localSettings.system = localSettings.system || {};
        localSettings.system.autoRedirect = true;
        localSettings.system.activeSite = 'prod';
        
        localStorage.setItem('dashie-local-settings', JSON.stringify(localSettings));
        logger.info('Auto-redirect enabled in local settings');
      } catch (error) {
        logger.error('Failed to save auto-redirect setting', error);
      }
    }

    // Perform redirect
    window.location.href = 'https://dashieapp.com';
  }

  /**
   * Set up TV/D-pad navigation for main auth UI
   */
  setupTVNavigation() {
    const focusableElements = document.querySelectorAll('[data-tv-focusable="true"]');
    let currentFocus = 0;

    const updateFocus = () => {
      focusableElements.forEach((el, index) => {
        el.classList.remove('focused');
        if (index === currentFocus) {
          el.classList.add('focused');
          el.focus();
        }
      });
    };

    const handleNavigation = (e) => {
      switch (e.keyCode) {
        case 38: // Up
        case 37: // Left
          e.preventDefault();
          currentFocus = Math.max(0, currentFocus - 1);
          updateFocus();
          break;
        case 40: // Down
        case 39: // Right
          e.preventDefault();
          currentFocus = Math.min(focusableElements.length - 1, currentFocus + 1);
          updateFocus();
          break;
        case 13: // Enter
        case 23: // Fire TV Select
          e.preventDefault();
          const focused = focusableElements[currentFocus];
          if (focused) {
            focused.click();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleNavigation, true);
    this.authNavHandler = handleNavigation;

    // Set initial focus
    if (focusableElements.length > 0) {
      updateFocus();
    }
  }

  /**
   * Set up TV/D-pad navigation for redirect modal
   * @param {HTMLElement} modal - Modal element
   */
  setupModalTVNavigation(modal) {
    const buttons = modal.querySelectorAll('.modal-button');
    let currentFocus = 0;

    const updateFocus = () => {
      buttons.forEach((btn, index) => {
        btn.classList.remove('focused');
        if (index === currentFocus) {
          btn.classList.add('focused');
          btn.focus();
        }
      });
    };

    const handleModalNav = (e) => {
      switch (e.keyCode) {
        case 38: // Up
          e.preventDefault();
          currentFocus = Math.max(0, currentFocus - 1);
          updateFocus();
          break;
        case 40: // Down
          e.preventDefault();
          currentFocus = Math.min(buttons.length - 1, currentFocus + 1);
          updateFocus();
          break;
        case 13: // Enter
        case 23: // Fire TV Select
          e.preventDefault();
          buttons[currentFocus].click();
          break;
      }
    };

    document.addEventListener('keydown', handleModalNav, true);

    // Clean up when modal is removed
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (node === modal) {
            document.removeEventListener('keydown', handleModalNav, true);
            observer.disconnect();
          }
        });
      });
    });
    observer.observe(document.body, { childList: true });

    updateFocus();
  }

  /**
   * Show authentication error message
   * @param {string} errorMessage - Error text to display
   */
  showAuthError(errorMessage) {
    logger.error('Auth error displayed', { error: errorMessage });

    const existingError = document.getElementById('auth-error-message');
    if (existingError) {
      existingError.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.id = 'auth-error-message';
    errorDiv.className = 'auth-error-message';
    errorDiv.innerHTML = `
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <span class="error-text">${errorMessage}</span>
        <button class="error-dismiss" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    const authOverlay = document.getElementById('sign-in-overlay') || 
                       document.getElementById('webview-auth-overlay');
    
    if (authOverlay) {
      const modal = authOverlay.querySelector('.sign-in-modal');
      if (modal) {
        modal.appendChild(errorDiv);
      }
    } else {
      document.body.appendChild(errorDiv);
    }
    
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.remove();
      }
    }, 10000);
  }

  /**
   * Hide sign-in prompt
   */
  hideSignInPrompt() {
    // Remove navigation handlers
    if (this.authNavHandler) {
      document.removeEventListener('keydown', this.authNavHandler, true);
      this.authNavHandler = null;
    }
    
    const overlay = document.getElementById('sign-in-overlay');
    if (overlay) {
      overlay.remove();
    }
    
    document.body.classList.remove('temp-light-theme', 'temp-dev-theme');
  }

  /**
   * Show signed-in state
   */
  showSignedInState() {
    this.hideSignInPrompt();
    this.showDashboard();
  }

  /**
   * Show main dashboard
   */
  showDashboard() {
    const app = document.getElementById('app');
    if (app) {
      app.style.display = 'flex';
      app.classList.add('authenticated');
    }
  }
}