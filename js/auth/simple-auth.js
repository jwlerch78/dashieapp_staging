// js/auth/simple-auth.js - Phase 1: Basic Google SSO Only (Simplified)

class SimpleAuth {
  constructor() {
    this.gapi = null;
    this.isSignedIn = false;
    this.currentUser = null;
    
    // Your actual Client ID - no more copy/pasting needed!
    this.config = {
      client_id: '221142210647-58t8hr48rk7nlgl56j969himso1qjjoo.apps.googleusercontent.com',
      scope: 'profile email'  // Just basic profile info for now
    };
    
    this.init();
  }

  async init() {
    try {
      console.log('🔐 Initializing Google Auth...');
      await this.loadGoogleAPI();
      await this.initializeGIS();
    } catch (error) {
      console.error('🔐 Auth initialization failed:', error);
      this.showError('Authentication setup failed');
    }
  }

  async loadGoogleAPI() {
    return new Promise((resolve, reject) => {
      if (window.google) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async initializeGIS() {
    // Initialize Google Identity Services
    google.accounts.id.initialize({
      client_id: this.config.client_id,
      callback: (response) => this.handleCredentialResponse(response)
    });

    // Set up OAuth for additional permissions
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.config.client_id,
      scope: this.config.scope,
      callback: (response) => this.handleTokenResponse(response)
    });

    console.log('🔐 Google Identity Services initialized');
    this.checkExistingAuth();
  }

  checkExistingAuth() {
    // Check if user is already signed in
    const savedUser = this.getSavedUser();
    if (savedUser) {
      this.currentUser = savedUser;
      this.isSignedIn = true;
      this.showSignedInState();
    } else {
      this.showSignInPrompt();
    }
  }

  handleCredentialResponse(response) {
    // Decode the JWT token to get user info
    const userInfo = this.parseJWT(response.credential);
    
    this.currentUser = {
      id: userInfo.sub,
      name: userInfo.name,
      email: userInfo.email,
      picture: userInfo.picture,
      signedInAt: Date.now()
    };
    
    this.isSignedIn = true;
    this.saveUser(this.currentUser);
    this.showSignedInState();
    
    console.log('🔐 User signed in:', this.currentUser.name);
  }

  handleTokenResponse(response) {
    if (response.access_token) {
      // Store access token for future API calls
      this.currentUser.accessToken = response.access_token;
      this.saveUser(this.currentUser);
      console.log('🔐 Access token received');
    }
  }

  parseJWT(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  }

  signIn() {
    console.log('🔐 Starting sign-in process...');
    
    // Use OAuth popup directly for more reliable sign-in
    this.tokenClient.requestAccessToken();
  }

  signOut() {
    if (this.currentUser && this.currentUser.accessToken) {
      google.accounts.oauth2.revoke(this.currentUser.accessToken);
    }
    
    this.currentUser = null;
    this.isSignedIn = false;
    this.clearSavedUser();
    
    // Show sign-in prompt
    this.showSignInPrompt();
    
    console.log('🔐 User signed out');
  }

  exitApp() {
    // Exit the application completely
    console.log('🚪 Exiting Dashie...');
    
    if (window.close) {
      window.close();
    } else {
      // Fallback - redirect to a blank page or show exit message
      window.location.href = 'about:blank';
    }
  }

  // UI Management
  showSignInPrompt() {
    this.hideSignInPrompt(); // Remove any existing prompt
    
    // Hide the main dashboard when showing sign-in
    const app = document.getElementById('app');
    if (app) {
      app.style.display = 'none';
      app.classList.remove('authenticated');
    }
    
    // Force light theme by temporarily adding light theme class to body
    document.body.classList.add('temp-light-theme');
    
    const signInOverlay = document.createElement('div');
    signInOverlay.id = 'sign-in-overlay';
    signInOverlay.className = 'light-theme-signin';
    signInOverlay.innerHTML = `
      <div class="sign-in-modal">
        <img src="icons/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie" class="dashie-logo-signin">
        
        <div class="sign-in-header">
          <h2>Welcome to Dashie!</h2>
          <p>Helping active families manage the chaos</p>
        </div>
        
        <div class="sign-in-content">
          <div id="google-signin-button"></div>
          
          <button id="exit-app-btn" class="signin-button secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
            Exit
          </button>
        </div>
        
        <div class="sign-in-footer">
          <p>Your data stays private and secure</p>
        </div>
      </div>
    `;
    
    // Add styles - ensure light theme override works
    signInOverlay.style.cssText = `
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
    
    document.body.appendChild(signInOverlay);
    
    // Render Google Sign-In button
    google.accounts.id.renderButton(
      document.getElementById('google-signin-button'),
      {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        text: 'signin_with',
        shape: 'rectangular'
      }
    );
    
    // Exit app button
    document.getElementById('exit-app-btn').addEventListener('click', () => {
      this.exitApp();
    });
  }

  hideSignInPrompt() {
    const overlay = document.getElementById('sign-in-overlay');
    if (overlay) {
      overlay.remove();
    }
    
    // Remove temporary light theme class
    document.body.classList.remove('temp-light-theme');
  }

  showSignedInState() {
    this.hideSignInPrompt();
    this.showDashboard();
    // Note: No need to override exit handler anymore - the enhanced modal in modals.js handles this
  }

  showDashboard() {
    // Show the main dashboard
    const app = document.getElementById('app');
    if (app) {
      app.style.display = 'flex';
      app.classList.add('authenticated');
    }
  }

  addSignInStyles() {
    // Add comprehensive styles - consistent button styling throughout
    const style = document.createElement('style');
    style.textContent = `
      /* Force light theme for sign-in - stronger override */
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
      
      .temp-light-theme .sign-in-header h2,
      .light-theme-signin .sign-in-header h2,
      .sign-in-header h2 {
        color: #424242 !important;
        margin: 0 0 10px 0;
        font-size: 28px;
        font-weight: bold;
      }
      
      .temp-light-theme .sign-in-header p,
      .light-theme-signin .sign-in-header p,
      .sign-in-header p {
        color: #616161 !important;
        margin: 0 0 30px 0;
        font-size: 16px;
        font-style: italic;
      }
      
      .sign-in-content {
        margin: 30px 0;
      }
      
      /* Consistent button styling */
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
      
      .signin-button.secondary {
        background: white;
        color: #333;
        border: 1px solid #dadce0;
      }
      
      .signin-button.secondary:hover {
        background: #f8f9fa;
      }
      
      .temp-light-theme .sign-in-footer p,
      .light-theme-signin .sign-in-footer p,
      .sign-in-footer p {
        color: #9e9e9e !important;
        font-size: 14px;
        margin: 0;
      }
    `;
    
    if (!document.querySelector('#auth-styles')) {
      style.id = 'auth-styles';
      document.head.appendChild(style);
    }
  }

  showError(message) {
    console.error('🔐 Auth Error:', message);
  }

  // Data persistence
  saveUser(userData) {
    try {
      localStorage.setItem('dashie-user', JSON.stringify(userData));
    } catch (error) {
      console.error('💾 Failed to save user data:', error);
    }
  }

  getSavedUser() {
    try {
      const saved = localStorage.getItem('dashie-user');
      if (saved) {
        const userData = JSON.parse(saved);
        // Check if sign-in is recent (less than 30 days)
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        if (Date.now() - userData.signedInAt < thirtyDays) {
          return userData;
        }
      }
    } catch (error) {
      console.error('💾 Failed to load user data:', error);
    }
    return null;
  }

  clearSavedUser() {
    try {
      localStorage.removeItem('dashie-user');
    } catch (error) {
      console.error('💾 Failed to clear user data:', error);
    }
  }

  // Public API
  getUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return this.isSignedIn && this.currentUser !== null;
  }
}

// Initialize and make globally available
let dashieAuth = null;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    dashieAuth = new SimpleAuth();
    dashieAuth.addSignInStyles();
  });
} else {
  dashieAuth = new SimpleAuth();
  dashieAuth.addSignInStyles();
}

// Make available globally
window.dashieAuth = dashieAuth;

export { SimpleAuth };
