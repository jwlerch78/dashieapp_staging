// js/apis/api-auth/auth-ui.js - Authentication UI Management (Moved to new location)
// CHANGE SUMMARY: Moved from js/auth/auth-ui.js, added structured logging, enhanced platform detection integration

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
    this.addSignInStyles();
    
    logger.debug('Auth UI initialized', {
      platform: this.platform.platform,
      deviceType: this.platform.deviceType,
      isTV: this.platform.isTV()
    });
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
    
    // Use light theme for auth UI
    document.body.classList.add('temp-light-theme');
    
    const signInOverlay = document.createElement('div');
    signInOverlay.id = 'sign-in-overlay';
    signInOverlay.innerHTML = this.buildSignInHTML(onExit);
    
    document.body.appendChild(signInOverlay);
    
    // Set up event listeners
    this.setupSignInEventListeners(onSignIn, onExit);
    
    logger.info('Sign-in prompt displayed', {
      platform: this.platform.platform,
      hasExitOption: !!onExit
    });
  }

  /**
   * Build sign-in HTML based on platform
   * @param {Function} onExit - Exit callback
   * @returns {string} Sign-in HTML
   */
  buildSignInHTML(onExit) {
    const hasNativeAuth = this.platform.hasNativeCapabilities();
    const isFireTV = this.platform.platform === 'fire_tv';
    const isTV = this.platform.isTV();
    
    return `
      <div class="sign-in-modal">
        <img src="icons/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie" class="dashie-logo-signin">
        
        <div class="sign-in-header">
          <h2>Welcome to Dashie!</h2>
          <p>Helping active families manage the chaos</p>
        </div>
        
        <div class="sign-in-content">
          ${this.getSignInButtonHTML(hasNativeAuth, isFireTV)}
          
          ${onExit ? `
          <button id="exit-app-btn" class="signin-button secondary" tabindex="2" ${isTV ? 'data-focus="true"' : ''}>
            Exit Dashie
          </button>
          ` : ''}
        </div>
        
        <div class="sign-in-footer">
          <p class="platform-info">Running on ${this.platform.getPlatformDescription()}</p>
        </div>
      </div>
    `;
  }

  /**
   * Get platform-appropriate sign-in button HTML
   * @param {boolean} hasNativeAuth - Has native auth capabilities
   * @param {boolean} isFireTV - Is Fire TV platform
   * @returns {string} Button HTML
   */
  getSignInButtonHTML(hasNativeAuth, isFireTV) {
    if (hasNativeAuth) {
      return `
        <button id="sign-in-btn" class="signin-button primary" tabindex="1" data-focus="true">
          <span class="button-icon">🔐</span>
          Sign in with Google
        </button>
        <p class="sign-in-hint">Uses your device's Google account</p>
      `;
    } else if (isFireTV) {
      return `
        <button id="sign-in-btn" class="signin-button primary" tabindex="1" data-focus="true">
          <span class="button-icon">📱</span>
          Sign in with your phone
        </button>
        <p class="sign-in-hint">We'll show you a code to enter on your phone</p>
      `;
    } else {
      return `
        <button id="sign-in-btn" class="signin-button primary" tabindex="1" data-focus="true">
          <span class="button-icon">🔐</span>
          Sign in with Google
        </button>
        <p class="sign-in-hint">Secure sign-in with your Google account</p>
      `;
    }
  }

  /**
   * Setup event listeners for sign-in UI
   * @param {Function} onSignIn - Sign-in callback
   * @param {Function} onExit - Exit callback
   */
  setupSignInEventListeners(onSignIn, onExit) {
    const signInBtn = document.getElementById('sign-in-btn');
    const exitBtn = document.getElementById('exit-app-btn');
    
    if (signInBtn) {
      signInBtn.addEventListener('click', () => {
        logger.info('Sign-in button clicked');
        onSignIn();
      });
    }
    
    if (exitBtn && onExit) {
      exitBtn.addEventListener('click', () => {
        logger.info('Exit button clicked');
        onExit();
      });
    }
    
    // Setup D-pad navigation for TV platforms
    if (this.platform.isTV()) {
      this.setupDPadNavigation();
    }
  }

  /**
   * Setup D-pad navigation for TV platforms
   */
  setupDPadNavigation() {
    const focusableElements = document.querySelectorAll('[data-focus="true"]');
    let currentFocus = 0;
    
    const updateFocus = (index) => {
      focusableElements.forEach(el => el.classList.remove('focused'));
      if (focusableElements[index]) {
        focusableElements[index].classList.add('focused');
        focusableElements[index].focus();
      }
    };
    
    // Set initial focus
    updateFocus(currentFocus);
    
    const handleKeydown = (event) => {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          currentFocus = Math.max(0, currentFocus - 1);
          updateFocus(currentFocus);
          break;
          
        case 'ArrowDown':
          event.preventDefault();
          currentFocus = Math.min(focusableElements.length - 1, currentFocus + 1);
          updateFocus(currentFocus);
          break;
          
        case 'Enter':
          event.preventDefault();
          if (focusableElements[currentFocus]) {
            focusableElements[currentFocus].click();
          }
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeydown);
    
    // Store reference to remove later
    this._dpadHandler = handleKeydown;
    
    logger.debug('D-pad navigation setup for auth UI', {
      focusableElements: focusableElements.length
    });
  }

  /**
   * Hide sign-in prompt
   */
  hideSignInPrompt() {
    const overlay = document.getElementById('sign-in-overlay');
    if (overlay) {
      overlay.remove();
      
      // Remove D-pad handler if it exists
      if (this._dpadHandler) {
        document.removeEventListener('keydown', this._dpadHandler);
        this._dpadHandler = null;
      }
      
      logger.debug('Sign-in prompt hidden');
    }
    
    // Remove temp theme
    document.body.classList.remove('temp-light-theme');
  }

  /**
   * Show WebView authentication prompt
   * @param {Function} onCreateMockUser - Create mock user callback
   * @param {Function} onExit - Exit callback
   */
  showWebViewAuthPrompt(onCreateMockUser, onExit) {
    this.hideSignInPrompt();
    
    const app = document.getElementById('app');
    if (app) {
      app.style.display = 'none';
      app.classList.remove('authenticated');
    }
    
    document.body.classList.add('temp-light-theme');
    
    const webViewOverlay = document.createElement('div');
    webViewOverlay.id = 'webview-auth-overlay';
    webViewOverlay.innerHTML = `
      <div class="sign-in-modal">
        <img src="icons/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie" class="dashie-logo-signin">
        
        <div class="sign-in-header">
          <h2>Welcome to Dashie!</h2>
          <p>WebView Environment Detected</p>
        </div>
        
        <div class="sign-in-content">
          <button id="create-mock-user-btn" class="signin-button primary" tabindex="1">
            <span class="button-icon">👤</span>
            Continue as Guest
          </button>
          <p class="sign-in-hint">Limited authentication for WebView environments</p>
          
          ${onExit ? `
          <button id="exit-webview-btn" class="signin-button secondary" tabindex="2">
            Exit Dashie
          </button>
          ` : ''}
        </div>
      </div>
    `;
    
    document.body.appendChild(webViewOverlay);
    
    // Setup event listeners
    const mockUserBtn = document.getElementById('create-mock-user-btn');
    const exitBtn = document.getElementById('exit-webview-btn');
    
    if (mockUserBtn) {
      mockUserBtn.addEventListener('click', () => {
        logger.info('Mock user creation requested');
        onCreateMockUser();
      });
    }
    
    if (exitBtn && onExit) {
      exitBtn.addEventListener('click', () => {
        logger.info('Exit from WebView requested');
        onExit();
      });
    }
    
    logger.info('WebView auth prompt displayed');
  }

  /**
   * Show signed-in state (hide auth UI, show app)
   */
  showSignedInState() {
    this.hideSignInPrompt();
    
    const webViewOverlay = document.getElementById('webview-auth-overlay');
    if (webViewOverlay) {
      webViewOverlay.remove();
    }
    
    const app = document.getElementById('app');
    if (app) {
      app.style.display = '';
      app.classList.add('authenticated');
    }
    
    document.body.classList.remove('temp-light-theme');
    
    logger.success('Signed-in state displayed');
  }

  /**
   * Show authentication error
   * @param {string} errorMessage - Error message to display
   */
  showAuthError(errorMessage) {
    logger.error('Displaying auth error', { error: errorMessage });
    
    // Remove any existing error messages
    const existingError = document.getElementById('auth-error-message');
    if (existingError) {
      existingError.remove();
    }
    
    // Create error message element
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
    
    // Add to current auth UI or create standalone
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
   * Add authentication UI styles
   */
  addSignInStyles() {
    if (document.getElementById('auth-ui-styles')) return;

    const style = document.createElement('style');
    style.id = 'auth-ui-styles';
    style.textContent = `
      /* Light theme override for auth */
      .temp-light-theme {
        background: #FCFCFF !important;
        color: #333 !important;
      }
      
      /* Sign-in overlay */
      #sign-in-overlay, #webview-auth-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #FCFCFF;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .sign-in-modal {
        background: white;
        border-radius: 16px;
        padding: 40px;
        max-width: 400px;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
        border: 1px solid #E5E5E5;
      }
      
      .dashie-logo-signin {
        height: 80px;
        margin-bottom: 30px;
      }
      
      .sign-in-header h2 {
        margin: 0 0 10px 0;
        color: #333;
        font-size: 28px;
        font-weight: 600;
      }
      
      .sign-in-header p {
        margin: 0 0 40px 0;
        color: #666;
        font-size: 16px;
      }
      
      .signin-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 16px 24px;
        margin: 12px 0;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        outline: none;
      }
      
      .signin-button.primary {
        background: #007AFF;
        color: white;
      }
      
      .signin-button.primary:hover {
        background: #0056CC;
        transform: translateY(-1px);
      }
      
      .signin-button.secondary {
        background: #F5F5F5;
        color: #666;
        border: 1px solid #E5E5E5;
      }
      
      .signin-button.secondary:hover {
        background: #E5E5E5;
      }
      
      .signin-button.focused {
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.3);
        transform: translateY(-1px);
      }
      
      .button-icon {
        margin-right: 8px;
        font-size: 18px;
      }
      
      .sign-in-hint {
        margin: 8px 0 24px 0;
        color: #888;
        font-size: 14px;
      }
      
      .sign-in-footer {
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #E5E5E5;
      }
      
      .platform-info {
        margin: 0;
        color: #999;
        font-size: 12px;
      }
      
      /* Error messages */
      .auth-error-message {
        margin: 20px 0;
        padding: 0;
      }
      
      .error-content {
        display: flex;
        align-items: center;
        background: #FFF2F2;
        border: 1px solid #FFCDD2;
        border-radius: 8px;
        padding: 12px 16px;
        color: #D32F2F;
        font-size: 14px;
      }
      
      .error-icon {
        margin-right: 8px;
        font-size: 16px;
      }
      
      .error-text {
        flex: 1;
        text-align: left;
      }
      
      .error-dismiss {
        background: none;
        border: none;
        color: #D32F2F;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        margin-left: 8px;
      }
      
      .error-dismiss:hover {
        background: rgba(211, 47, 47, 0.1);
        border-radius: 4px;
      }
    `;
    
    document.head.appendChild(style);
    
    logger.debug('Auth UI styles added');
  }
}
