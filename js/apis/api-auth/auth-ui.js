// js/apis/api-auth/auth-ui.js - Authentication UI Management (Environment Detection & Site Redirect)
// CHANGE SUMMARY: Added environment detection with subtle dev site indicator, production site link, simplified redirect modal (Yes/Cancel only), updated layout with privacy/platform info below buttons

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
    
    // Always use light theme for auth UI
    document.body.classList.add('temp-light-theme');
    
    // Detect if we're in Fire TV/native environment
    const isFireTV = this.platform.platform === 'fire_tv';
    const hasNativeAuth = this.platform.hasNativeCapabilities();
    
    const signInOverlay = document.createElement('div');
    signInOverlay.id = 'sign-in-overlay';
    signInOverlay.innerHTML = `
      <div class="sign-in-modal">
        <img src="/icons/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie" class="dashie-logo-signin">
        
        <div class="sign-in-header">
          <h2>Welcome to Dashie!</h2>
          <p>Helping active families manage the chaos</p>
        </div>
        
        <div class="sign-in-content">
          ${this.getSignInButtonHTML(hasNativeAuth, isFireTV)}
          
          ${onExit ? `
          <button id="exit-app-btn" class="signin-button secondary" tabindex="2" ${isFireTV ? 'autofocus' : ''}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
            Exit
          </button>
          ` : ''}
          
          <p class="privacy-notice">Your data stays private and secure</p>
          <p class="platform-notice">Running on ${this.getPlatformDisplayName()}</p>
        </div>
        
        <div class="sign-in-footer">
          ${this.getEnvironmentFooterHTML()}
        </div>
      </div>
    `;
    
    this.styleSignInOverlay(signInOverlay);
    document.body.appendChild(signInOverlay);
    
    this.setupSignInEventHandlers(onSignIn, onExit, hasNativeAuth, isFireTV);
    
    logger.info('Sign-in prompt displayed', {
      platform: this.platform.platform,
      hasExitOption: !!onExit,
      isDevelopmentSite: this.isDevelopmentSite
    });
  }

  /**
   * Get platform display name for footer
   * @returns {string}
   */
  getPlatformDisplayName() {
    return this.platform.getPlatformDescription();
  }

  /**
   * Get environment-specific footer HTML
   * @returns {string}
   */
  getEnvironmentFooterHTML() {
    if (this.isDevelopmentSite) {
      return `
        <p>Logging into Dev Site.</p>
        <p><a href="#" id="prod-site-link" class="prod-site-link" tabindex="3">Go to production site</a></p>
      `;
    }
    return '';
  }

  /**
   * Get sign-in button HTML based on platform
   * @param {boolean} hasNativeAuth
   * @param {boolean} isFireTV
   * @returns {string}
   */
  getSignInButtonHTML(hasNativeAuth, isFireTV) {
    if (hasNativeAuth) {
      // Native auth - white button with colored G logo
      return `
        <button id="native-signin-btn" class="signin-button secondary fire-tv-button" tabindex="1">
          <svg class="google-logo" width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span>Sign in with Google</span>
        </button>
      `;
    } else {
      // Web auth - white button with colored G logo, full width
      return `
        <div id="web-signin-container">
          <div id="google-signin-button" class="full-width-google-button"></div>
          <button id="custom-signin-btn" class="signin-button secondary" style="display: none;" tabindex="1">
            <svg class="google-logo" width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Sign in with Google</span>
          </button>
        </div>
      `;
    }
  }

  /**
   * Set up sign-in event handlers
   * @param {Function} onSignIn
   * @param {Function} onExit
   * @param {boolean} hasNativeAuth
   * @param {boolean} isFireTV
   */
  setupSignInEventHandlers(onSignIn, onExit, hasNativeAuth, isFireTV) {
    if (hasNativeAuth) {
      // Native auth button setup
      const signInBtn = document.getElementById('native-signin-btn');
      if (signInBtn) {
        // Click handler
        signInBtn.addEventListener('click', (e) => {
          e.preventDefault();
          onSignIn();
        });
        
        // Keyboard/D-pad handler
        signInBtn.addEventListener('keydown', (e) => {
          logger.debug('Sign-in button keydown', { keyCode: e.keyCode, key: e.key });
          if (e.keyCode === 13 || e.keyCode === 23 || e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            onSignIn();
          }
        });
        
        // Auto-focus for Fire TV
        if (isFireTV) {
          setTimeout(() => {
            signInBtn.focus();
            logger.debug('Auto-focused sign-in button');
          }, 200);
        }
      }
    } else {
      // Web auth setup - try Google button first
      this.setupWebAuth(onSignIn);
    }
    
    // Exit button setup
    if (onExit) {
      const exitBtn = document.getElementById('exit-app-btn');
      if (exitBtn) {
        exitBtn.addEventListener('click', (e) => {
          e.preventDefault();
          onExit();
        });
        
        exitBtn.addEventListener('keydown', (e) => {
          logger.debug('Exit button keydown', { keyCode: e.keyCode, key: e.key });
          if (e.keyCode === 13 || e.keyCode === 23 || e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            onExit();
          }
        });
      }
    }

    // Production site link setup (only for dev sites)
    if (this.isDevelopmentSite) {
      const prodLink = document.getElementById('prod-site-link');
      if (prodLink) {
        prodLink.addEventListener('click', (e) => {
          e.preventDefault();
          this.showRedirectModal();
        });
        
        prodLink.addEventListener('keydown', (e) => {
          logger.debug('Production link keydown', { keyCode: e.keyCode, key: e.key });
          if (e.keyCode === 13 || e.keyCode === 23 || e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            this.showRedirectModal();
          }
        });
      }
    }

    // Add global keydown handler for Fire TV navigation
    if (isFireTV) {
      this.setupFireTVNavigation();
    }
  }

  /**
   * Set up web authentication
   * @param {Function} onSignIn
   */
  setupWebAuth(onSignIn) {
    // Try to render Google's button immediately
    if (window.google && google.accounts && google.accounts.id) {
      this.renderGoogleButton(onSignIn);
    } else {
      // Show custom button immediately, try to load Google API
      this.showCustomButton(onSignIn);
      this.loadGoogleAPIAndTryRender(onSignIn);
    }
  }

  /**
   * Render Google's official button
   * @param {Function} onSignIn
   */
  renderGoogleButton(onSignIn) {
    try {
      const container = document.getElementById('google-signin-button');
      if (container) {
        google.accounts.id.renderButton(container, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          text: 'signin_with',
          shape: 'rectangular',
          width: '100%'
        });
        logger.debug('Rendered Google official button');
      }
    } catch (error) {
      logger.warn('Google button failed, using custom', { error: error.message });
      this.showCustomButton(onSignIn);
    }
  }

  /**
   * Show custom fallback button
   * @param {Function} onSignIn
   */
  showCustomButton(onSignIn) {
    const customBtn = document.getElementById('custom-signin-btn');
    const googleContainer = document.getElementById('google-signin-button');
    
    if (customBtn && googleContainer) {
      googleContainer.style.display = 'none';
      customBtn.style.display = 'flex';
      customBtn.addEventListener('click', onSignIn);
      logger.debug('Using custom sign-in button');
    }
  }

  /**
   * Load Google API in background and try to render
   * @param {Function} onSignIn
   */
  loadGoogleAPIAndTryRender(onSignIn) {
    // Try to load Google API in background
    setTimeout(() => {
      if (window.google && google.accounts && google.accounts.id) {
        const customBtn = document.getElementById('custom-signin-btn');
        const googleContainer = document.getElementById('google-signin-button');
        
        if (customBtn && googleContainer && customBtn.style.display !== 'none') {
          try {
            // Hide custom button and show Google button
            customBtn.style.display = 'none';
            googleContainer.style.display = 'block';
            this.renderGoogleButton(onSignIn);
            logger.debug('Switched to Google button');
          } catch (error) {
            // Keep custom button if Google fails
            customBtn.style.display = 'flex';
            googleContainer.style.display = 'none';
          }
        }
      }
    }, 1000);
  }

  /**
   * Set up Fire TV D-pad navigation
   */
  setupFireTVNavigation() {
    const handleFireTVKey = (e) => {
      logger.debug('Fire TV key event', { keyCode: e.keyCode, key: e.key });
      
      const signInBtn = document.getElementById('native-signin-btn');
      const exitBtn = document.getElementById('exit-app-btn');
      const prodLink = document.getElementById('prod-site-link');
      const focusedElement = document.activeElement;
      
      // Create array of focusable elements in order
      const focusableElements = [signInBtn, exitBtn, prodLink].filter(el => el && el.style.display !== 'none');
      const currentIndex = focusableElements.findIndex(el => el === focusedElement);
      
      switch (e.keyCode) {
        case 40: // D-pad down
          e.preventDefault();
          const nextIndex = (currentIndex + 1) % focusableElements.length;
          if (focusableElements[nextIndex]) {
            focusableElements[nextIndex].focus();
          }
          break;
          
        case 38: // D-pad up
          e.preventDefault();
          const prevIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
          if (focusableElements[prevIndex]) {
            focusableElements[prevIndex].focus();
          }
          break;
      }
    };
    
    // Add event listener to document for Fire TV navigation
    document.addEventListener('keydown', handleFireTVKey, true);
    
    // Store reference to remove later
    this.fireTVKeyHandler = handleFireTVKey;
  }

  /**
   * Show redirect confirmation modal
   */
  showRedirectModal() {
    logger.debug('Showing redirect modal');
    
    const modal = document.createElement('div');
    modal.className = 'redirect-modal-backdrop';
    modal.innerHTML = `
      <div class="redirect-modal">
        <h3>Switch to Production Site?</h3>
        <p>You are about to switch to the production site:</p>
        <p><strong>https://dashieapp.com</strong></p>
        <p>Do you want to continue?</p>
        
        <div class="redirect-modal-buttons">
          <button id="redirect-yes" class="redirect-modal-button primary" tabindex="1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
            </svg>
            Yes
          </button>
          
          <button id="redirect-cancel" class="redirect-modal-button cancel" tabindex="2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
            Cancel
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Set up event handlers
    this.setupRedirectModalHandlers(modal);
    
    // Auto-focus first button
    setTimeout(() => {
      document.getElementById('redirect-yes')?.focus();
    }, 100);
  }

  /**
   * Set up redirect modal event handlers
   * @param {HTMLElement} modal
   */
  setupRedirectModalHandlers(modal) {
    const yesBtn = document.getElementById('redirect-yes');
    const cancelBtn = document.getElementById('redirect-cancel');

    // Click handlers
    yesBtn?.addEventListener('click', () => {
      this.handleRedirectChoice('yes');
      modal.remove();
    });

    cancelBtn?.addEventListener('click', () => {
      modal.remove();
    });

    // Set up modal TV navigation
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
   * Set up TV navigation for redirect modal
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
    
    // Clean up when modal is removed
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
   * Handle redirect choice and execute
   * @param {string} choice - 'yes' or 'cancel'
   */
  async handleRedirectChoice(choice) {
    logger.info('Redirect choice made', { choice });

    if (choice === 'yes') {
      // Perform redirect immediately (no settings changes)
      window.location.href = 'https://dashieapp.com';
    }
    // For cancel, just close modal (already handled in setupRedirectModalHandlers)
  }

  /**
   * Show WebView authentication prompt
   * @param {Function} onContinue
   * @param {Function} onExit
   */
  showWebViewAuthPrompt(onContinue, onExit = null) {
    this.hideSignInPrompt();
    
    const app = document.getElementById('app');
    if (app) {
      app.style.display = 'none';
      app.classList.remove('authenticated');
    }
    
    document.body.classList.add('temp-light-theme');
    
    const signInOverlay = document.createElement('div');
    signInOverlay.id = 'sign-in-overlay';
    signInOverlay.innerHTML = `
      <div class="sign-in-modal">
        <img src="/icons/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie" class="dashie-logo-signin">
        
        <div class="sign-in-header">
          <h2>Welcome to Dashie!</h2>
          <p>Running in WebView mode</p>
        </div>
        
        <div class="sign-in-content">
          <p style="color: #616161; margin-bottom: 20px; font-size: 14px;">
            Google authentication is not available in this environment. 
            You can continue with limited functionality.
          </p>
          
          <button id="webview-continue-btn" class="signin-button primary" tabindex="1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Continue to Dashboard
          </button>
          
          ${onExit ? `
          <button id="exit-app-btn" class="signin-button secondary" tabindex="2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
            Exit
          </button>
          ` : ''}
          
          <p class="privacy-notice">Your data stays private and secure</p>
          <p class="platform-notice">Running on ${this.getPlatformDisplayName()}</p>
        </div>
        
        <div class="sign-in-footer">
        </div>
      </div>
    `;
    
    this.styleSignInOverlay(signInOverlay);
    document.body.appendChild(signInOverlay);
    
    // Add event listeners
    document.getElementById('webview-continue-btn').addEventListener('click', onContinue);
    
    if (onExit) {
      document.getElementById('exit-app-btn').addEventListener('click', onExit);
    }
  }

  /**
   * Show authentication error
   * @param {string} message
   * @param {boolean} allowContinue
   */
  showAuthError(message, allowContinue = false) {
    this.hideSignInPrompt();
    
    const app = document.getElementById('app');
    if (app) {
      app.style.display = 'none';
      app.classList.remove('authenticated');
    }
    
    document.body.classList.add('temp-light-theme');
    
    const errorOverlay = document.createElement('div');
    errorOverlay.id = 'sign-in-overlay';
    errorOverlay.innerHTML = `
      <div class="sign-in-modal">
        <img src="/icons/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie" class="dashie-logo-signin">
        
        <div class="sign-in-header">
          <h2>Authentication Error</h2>
          <p style="color: #d32f2f !important;">${message}</p>
        </div>
        
        <div class="sign-in-content">
          ${allowContinue ? `
          <button id="continue-anyway-btn" class="signin-button primary" tabindex="1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Continue Anyway
          </button>
          ` : ''}
          
          <button id="retry-auth-btn" class="signin-button ${allowContinue ? 'secondary' : 'primary'}" tabindex="${allowContinue ? '2' : '1'}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            Try Again
          </button>
          
          <p class="privacy-notice">Your data stays private and secure</p>
          <p class="platform-notice">Running on ${this.getPlatformDisplayName()}</p>
        </div>
        
        <div class="sign-in-footer">
        </div>
      </div>
    `;
    
    this.styleSignInOverlay(errorOverlay);
    document.body.appendChild(errorOverlay);
    
    // Add proper FireTV navigation and focus for error buttons
    this.setupErrorButtonNavigation(allowContinue);
    
    // Add event listeners
    const retryBtn = document.getElementById('retry-auth-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        window.location.reload();
      });
      
      // Auto-focus retry button
      setTimeout(() => {
        retryBtn.focus();
      }, 200);
    }
    
    if (allowContinue) {
      const continueBtn = document.getElementById('continue-anyway-btn');
      if (continueBtn) {
        continueBtn.addEventListener('click', () => {
          // Create a temporary user and continue
          if (window.dashieAuth && window.dashieAuth.authManager) {
            window.dashieAuth.authManager.createWebViewUser();
          }
        });
      }
    }
  }

  /**
   * Setup navigation for error buttons
   * @param {boolean} allowContinue
   */
  setupErrorButtonNavigation(allowContinue) {
    const handleErrorNavigation = (e) => {
      const continueBtn = document.getElementById('continue-anyway-btn');
      const retryBtn = document.getElementById('retry-auth-btn');
      const focusedElement = document.activeElement;
      
      switch (e.keyCode) {
        case 40: // D-pad down
        case 38: // D-pad up
          e.preventDefault();
          if (allowContinue) {
            if (focusedElement === continueBtn && retryBtn) {
              retryBtn.focus();
            } else if (focusedElement === retryBtn && continueBtn) {
              continueBtn.focus();
            } else if (continueBtn) {
              continueBtn.focus();
            }
          }
          break;
          
        case 13: // Enter
        case 23: // FireTV Select
          e.preventDefault();
          if (focusedElement === retryBtn) {
            retryBtn.click();
          } else if (focusedElement === continueBtn) {
            continueBtn.click();
          }
          break;
      }
    };
    
    document.addEventListener('keydown', handleErrorNavigation, true);
    
    // Store reference for cleanup
    this.errorNavHandler = handleErrorNavigation;
  }

  /**
   * Hide sign-in prompt and clean up
   */
  hideSignInPrompt() {
    // Remove Fire TV key handler if it exists
    if (this.fireTVKeyHandler) {
      document.removeEventListener('keydown', this.fireTVKeyHandler, true);
      this.fireTVKeyHandler = null;
    }
    
    // Remove error navigation handler if it exists
    if (this.errorNavHandler) {
      document.removeEventListener('keydown', this.errorNavHandler, true);
      this.errorNavHandler = null;
    }
    
    const overlay = document.getElementById('sign-in-overlay');
    if (overlay) {
      overlay.remove();
    }
    
    // Remove theme class
    document.body.classList.remove('temp-light-theme');
  }

  /**
   * Show signed-in state
   */
  showSignedInState() {
    this.hideSignInPrompt();
    this.showDashboard();
  }

  /**
   * Show dashboard
   */
  showDashboard() {
    const app = document.getElementById('app');
    if (app) {
      app.style.display = 'flex';
      app.classList.add('authenticated');
    }
  }

  /**
   * Style the sign-in overlay
   * @param {HTMLElement} overlay
   */
  styleSignInOverlay(overlay) {
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
  }
}