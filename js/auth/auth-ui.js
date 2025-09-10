// js/auth/auth-ui.js - Authentication UI Management (Fixed)

export class AuthUI {
  constructor() {
    this.addSignInStyles();
  }

  showSignInPrompt(onSignIn, onExit = null) {
    this.hideSignInPrompt();
    
    const app = document.getElementById('app');
    if (app) {
      app.style.display = 'none';
      app.classList.remove('authenticated');
    }
    
    document.body.classList.add('temp-light-theme');
    
    // Detect if we're in Fire TV/native environment
    const isFireTV = this.detectFireTV();
    const hasNativeAuth = window.DashieNative && typeof window.DashieNative.signIn === 'function';
    
    const signInOverlay = document.createElement('div');
    signInOverlay.id = 'sign-in-overlay';
    signInOverlay.innerHTML = `
      <div class="sign-in-modal">
        <img src="icons/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie" class="dashie-logo-signin">
        
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
        </div>
        
        <div class="sign-in-footer">
          <p>Your data stays private and secure</p>
        </div>
      </div>
    `;
    
    this.styleSignInOverlay(signInOverlay);
    document.body.appendChild(signInOverlay);
    
    this.setupSignInEventHandlers(onSignIn, onExit, hasNativeAuth, isFireTV);
  }

  getSignInButtonHTML(hasNativeAuth, isFireTV) {
    if (hasNativeAuth) {
      // Native auth - custom button that works with D-pad
      return `
        <button id="native-signin-btn" class="signin-button primary fire-tv-button" tabindex="1">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
      `;
    } else {
      // Web auth - try Google button first, fallback to custom
      return `
        <div id="web-signin-container">
          <div id="google-signin-button"></div>
          <button id="custom-signin-btn" class="signin-button primary" style="display: none;" tabindex="1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      `;
    }
  }

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
          console.log('🔐 Sign-in button keydown:', e.keyCode, e.key);
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
            console.log('🔐 Auto-focused sign-in button');
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
          console.log('🔐 Exit button keydown:', e.keyCode, e.key);
          if (e.keyCode === 13 || e.keyCode === 23 || e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            onExit();
          }
        });
      }
    }

    // Add global keydown handler for Fire TV navigation
    if (isFireTV) {
      this.setupFireTVNavigation();
    }
  }

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
        console.log('🔐 Rendered Google official button');
      }
    } catch (error) {
      console.log('🔐 Google button failed, using custom:', error);
      this.showCustomButton(onSignIn);
    }
  }

  showCustomButton(onSignIn) {
    const customBtn = document.getElementById('custom-signin-btn');
    const googleContainer = document.getElementById('google-signin-button');
    
    if (customBtn && googleContainer) {
      googleContainer.style.display = 'none';
      customBtn.style.display = 'flex';
      customBtn.addEventListener('click', onSignIn);
      console.log('🔐 Using custom sign-in button');
    }
  }

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
            console.log('🔐 Switched to Google button');
          } catch (error) {
            // Keep custom button if Google fails
            customBtn.style.display = 'flex';
            googleContainer.style.display = 'none';
          }
        }
      }
    }, 1000);
  }

  setupFireTVNavigation() {
    const handleFireTVKey = (e) => {
      console.log('🔐 Fire TV key event:', e.keyCode, e.key);
      
      const signInBtn = document.getElementById('native-signin-btn');
      const exitBtn = document.getElementById('exit-app-btn');
      const focusedElement = document.activeElement;
      
      switch (e.keyCode) {
        case 40: // D-pad down
          e.preventDefault();
          if (focusedElement === signInBtn && exitBtn) {
            exitBtn.focus();
          } else if (signInBtn) {
            signInBtn.focus();
          }
          break;
          
        case 38: // D-pad up
          e.preventDefault();
          if (focusedElement === exitBtn && signInBtn) {
            signInBtn.focus();
          } else if (exitBtn) {
            exitBtn.focus();
          }
          break;
      }
    };
    
    // Add event listener to document for Fire TV navigation
    document.addEventListener('keydown', handleFireTVKey, true);
    
    // Store reference to remove later
    this.fireTVKeyHandler = handleFireTVKey;
  }

  detectFireTV() {
    const userAgent = navigator.userAgent;
    return userAgent.includes('AFTS') || userAgent.includes('FireTV') || 
           userAgent.includes('AFT') || userAgent.includes('AFTMM') ||
           userAgent.includes('AFTRS') || userAgent.includes('AFTSS') ||
           window.DashieNative !== undefined;
  }

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
        <img src="icons/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie" class="dashie-logo-signin">
        
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
        </div>
        
        <div class="sign-in-footer">
          <p>Your data stays private and secure</p>
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
        <img src="icons/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie" class="dashie-logo-signin">
        
        <div class="sign-in-header">
          <h2>Authentication Error</h2>
          <p style="color: #d32f2f !important;">${message}</p>
        </div>
        
        <div class="sign-in-content">
          ${allowContinue ? `
          <button id="continue-anyway-btn" class="signin-button primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Continue Anyway
          </button>
          ` : ''}
          
          <button id="retry-auth-btn" class="signin-button ${allowContinue ? 'secondary' : 'primary'}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            Try Again
          </button>
        </div>
      </div>
    `;
    
    this.styleSignInOverlay(errorOverlay);
    document.body.appendChild(errorOverlay);
    
    // Add event listeners
    const retryBtn = document.getElementById('retry-auth-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        window.location.reload();
      });
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

  hideSignInPrompt() {
    // Remove Fire TV key handler if it exists
    if (this.fireTVKeyHandler) {
      document.removeEventListener('keydown', this.fireTVKeyHandler, true);
      this.fireTVKeyHandler = null;
    }
    
    const overlay = document.getElementById('sign-in-overlay');
    if (overlay) {
      overlay.remove();
    }
    document.body.classList.remove('temp-light-theme');
  }

  showSignedInState() {
    this.hideSignInPrompt();
    this.showDashboard();
  }

  showDashboard() {
    const app = document.getElementById('app');
    if (app) {
      app.style.display = 'flex';
      app.classList.add('authenticated');
    }
  }

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

  addSignInStyles() {
    if (document.querySelector('#auth-ui-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'auth-ui-styles';
    style.textContent = `
      /* Force light theme for sign-in modals */
      .temp-light-theme .sign-in-modal,
      .sign-in-modal {
        background: #FCFCFF !important;
        border-radius: 12px;
        padding: 40px;
        max-width: 400px;
        width: 90%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        color: #424242 !important;
      }
      
      .dashie-logo-signin {
        width: 150px !important;
        height: auto;
        margin: 0 auto 20px auto;
        display: block;
      }
      
      .sign-in-header h2 {
        color: #424242 !important;
        margin: 0 0 10px 0;
        font-size: 28px;
        font-weight: bold;
      }
      
      .sign-in-header p {
        color: #616161 !important;
        margin: 0 0 30px 0;
        font-size: 16px;
        font-style: italic;
      }
      
      .sign-in-content {
        margin: 30px 0;
      }
      
      /* Enhanced button styling */
      .signin-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        width: 100%;
        padding: 12px 20px;
        background: white;
        color: #333;
        border: 1px solid #dadce0;
        border-radius: 6px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-top: 15px;
        outline: none;
      }
      
      .signin-button:hover,
      .signin-button:focus {
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        background: #f8f9fa;
        transform: translateY(-1px);
      }
      
      .signin-button.primary {
        background: #1a73e8;
        color: white;
        border: 1px solid #1a73e8;
      }
      
      .signin-button.primary:hover,
      .signin-button.primary:focus {
        background: #1557b0;
        border: 1px solid #1557b0;
        box-shadow: 0 2px 8px rgba(26, 115, 232, 0.3);
      }
      
      .signin-button.secondary {
        background: white;
        color: #333;
        border: 1px solid #dadce0;
      }
      
      .signin-button.secondary:hover,
      .signin-button.secondary:focus {
        background: #f8f9fa;
        border: 1px solid #bdc1c6;
      }
      
      /* Fire TV specific styling */
      .fire-tv-button {
        position: relative;
      }
      
      .fire-tv-button:focus {
        outline: 3px solid #ffaa00 !important;
        outline-offset: 2px;
        transform: scale(1.02) !important;
        box-shadow: 0 0 15px rgba(255, 170, 0, 0.5) !important;
      }
      
      /* Google Sign-In button container styling */
      #google-signin-button {
        display: flex;
        justify-content: center;
        align-items: center;
        margin-top: 15px;
      }
      
      #google-signin-button > div {
        margin: 0 !important;
        width: 100% !important;
      }
      
      #web-signin-container {
        width: 100%;
      }
      
      /* Fire TV layout adjustments */
      @media (max-width: 1920px) and (max-height: 1080px) {
        .sign-in-modal {
          max-width: 500px;
          padding: 50px;
        }
        
        .sign-in-header h2 {
          font-size: 32px;
        }
        
        .signin-button {
          font-size: 18px;
          padding: 16px 24px;
        }
      }
      
      .sign-in-footer p {
        color: #9e9e9e !important;
        font-size: 14px;
        margin: 0;
      }
      
      /* Error state styling */
      .sign-in-header p[style*="color: #d32f2f"] {
        background: #ffebee;
        padding: 10px;
        border-radius: 4px;
        border-left: 4px solid #d32f2f;
      }
    `;
    
    document.head.appendChild(style);
  }
}
