// js/auth/auth-ui.js - Authentication UI Management

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
          <button id="signin-btn" class="signin-button primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
          
          ${onExit ? `
          <button id="exit-app-btn" class="signin-button secondary">
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
    document.getElementById('signin-btn').addEventListener('click', onSignIn);
    
    if (onExit) {
      document.getElementById('exit-app-btn').addEventListener('click', onExit);
    }
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
          
          <button id="webview-continue-btn" class="signin-button primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Continue to Dashboard
          </button>
          
          ${onExit ? `
          <button id="exit-app-btn" class="signin-button secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
            Exit
          </button>
          ` : ''}
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

  showAuthError(message, showRetry = false) {
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
          <h2>Authentication Error</h2>
          <p>${message}</p>
        </div>
        
        <div class="sign-in-content">
          ${showRetry ? `
          <button id="retry-auth-btn" class="signin-button primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            Retry
          </button>
          ` : ''}
          
          <button id="exit-app-btn" class="signin-button secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
            Exit
          </button>
        </div>
      </div>
    `;
    
    this.styleSignInOverlay(signInOverlay);
    document.body.appendChild(signInOverlay);
  }

  hideSignInPrompt() {
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
    if (document.querySelector('#auth-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'auth-styles';
    style.textContent = `
      .temp-light-theme .sign-in-modal,
      .light-theme-signin .sign-in-modal,
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
      }
      
      .signin-button:hover {
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        background: #f8f9fa;
      }
      
      .signin-button.primary {
        background: #4285f4;
        color: white;
        border: 1px solid #4285f4;
      }
      
      .signin-button.primary:hover {
        background: #3367d6;
        border: 1px solid #3367d6;
      }
      
      .sign-in-footer p {
        color: #9e9e9e !important;
        font-size: 14px;
        margin: 0;
      }
    `;
    
    document.head.appendChild(style);
  }
}
