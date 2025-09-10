// js/auth/simple-auth.js - Complete Enhanced Version with Debugging

class SimpleAuth {
  constructor() {
    this.gapi = null;
    this.isSignedIn = false;
    this.currentUser = null;
    this.isWebView = this.detectWebView();
    this.retryCount = 0;
    this.maxRetries = 3;
    
    // Your actual Client ID
    this.config = {
      client_id: '221142210647-58t8hr48rk7nlgl56j969himso1qjjoo.apps.googleusercontent.com',
      scope: 'profile email'
    };
    
    this.init();
  }

  // Enhanced WebView detection
  detectWebView() {
    const userAgent = navigator.userAgent;
    const isAndroidWebView = /wv/.test(userAgent) || 
                           /Android.*AppleWebView(?!.*Chrome)/.test(userAgent) ||
                           userAgent.includes('DashieApp'); // Our custom user agent
    const isIOSWebView = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/.test(userAgent);
    
    console.log('🔐 Environment detection:', {
      userAgent: userAgent,
      isAndroidWebView: isAndroidWebView,
      isIOSWebView: isIOSWebView,
      isWebView: isAndroidWebView || isIOSWebView,
      hasWindow: typeof window !== 'undefined',
      hasDocument: typeof document !== 'undefined',
      supportsLocalStorage: this.testLocalStorage(),
      protocol: window.location.protocol,
      host: window.location.host
    });
    
    return isAndroidWebView || isIOSWebView;
  }

  testLocalStorage() {
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      return true;
    } catch (e) {
      return false;
    }
  }

  // Enhanced initialization with better error reporting
  async init() {
    console.log('🔐 Initializing Google Auth...');
    console.log('🔐 Environment info:', {
      isWebView: this.isWebView,
      userAgent: navigator.userAgent,
      onLine: navigator.onLine,
      cookieEnabled: navigator.cookieEnabled,
      localStorage: !!window.localStorage,
      documentReady: document.readyState,
      protocol: window.location.protocol,
      host: window.location.host,
      secure: window.location.protocol === 'https:',
      googleExists: !!window.google
    });
    
    try {
      await this.loadGoogleAPIWithRetry();
      await this.initializeGIS();
    } catch (error) {
      console.error('🔐 Complete auth initialization failed:', {
        error: error,
        message: error.message,
        stack: error.stack,
        retryCount: this.retryCount
      });
      this.handleAuthFailure(error);
    }
  }

  async loadGoogleAPIWithRetry() {
    while (this.retryCount < this.maxRetries) {
      try {
        console.log(`🔐 Attempting to load Google API (attempt ${this.retryCount + 1}/${this.maxRetries})`);
        
        // Add network connectivity check
        if (!navigator.onLine) {
          throw new Error('No internet connection detected');
        }
        
        await this.loadGoogleAPI();
        console.log('🔐 Google API loaded successfully');
        return;
      } catch (error) {
        this.retryCount++;
        console.error(`🔐 Google API load attempt ${this.retryCount} failed:`, {
          error: error,
          message: error.message,
          type: typeof error,
          isEvent: error instanceof Event,
          eventType: error instanceof Event ? error.type : 'N/A',
          navigator: {
            userAgent: navigator.userAgent,
            onLine: navigator.onLine,
            cookieEnabled: navigator.cookieEnabled
          }
        });
        
        if (this.retryCount < this.maxRetries) {
          const delay = this.retryCount * 2000;
          console.log(`🔐 Retrying in ${delay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw new Error(`Failed to load Google API after ${this.maxRetries} attempts: ${error.message}`);
        }
      }
    }
  }

  async loadGoogleAPI() {
    return new Promise((resolve, reject) => {
      console.log('🔐 Starting Google API load process...');
      
      // Check if already loaded
      if (window.google && window.google.accounts) {
        console.log('🔐 Google API already loaded');
        resolve();
        return;
      }
      
      // Clean up any existing script tags
      const existingScripts = document.querySelectorAll('script[src*="accounts.google.com"]');
      console.log(`🔐 Found ${existingScripts.length} existing Google scripts, removing...`);
      existingScripts.forEach(script => script.remove());
      
      const script = document.createElement('script');
      const scriptUrl = 'https://accounts.google.com/gsi/client';
      
      console.log('🔐 Creating script element:', {
        url: scriptUrl,
        isWebView: this.isWebView,
        documentReady: document.readyState,
        headExists: !!document.head,
        protocol: window.location.protocol
      });
      
      // WebView-specific configuration
      script.src = scriptUrl;
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      
      // Set up comprehensive event handlers
      const cleanup = () => {
        clearTimeout(timeout);
        script.onload = null;
        script.onerror = null;
        script.onabort = null;
      };
      
      const timeout = setTimeout(() => {
        cleanup();
        console.error('🔐 Google API load timeout (30s)');
        
        // Enhanced timeout debugging
        console.error('🔐 Timeout debug info:', {
          scriptInDocument: document.contains(script),
          scriptReadyState: script.readyState,
          documentReadyState: document.readyState,
          windowGoogle: !!window.google,
          headChildCount: document.head.children.length,
          allScripts: Array.from(document.querySelectorAll('script')).map(s => s.src)
        });
        
        script.remove();
        reject(new Error('Google API load timeout - script did not load within 30 seconds'));
      }, 30000);
      
      script.onload = () => {
        cleanup();
        console.log('🔐 Google API script onload fired');
        
        // Give extra time for API to initialize, especially in WebView
        const checkAvailability = (attempts = 0) => {
          const maxAttempts = 20; // 10 seconds total
          
          console.log(`🔐 Checking API availability (attempt ${attempts + 1}/${maxAttempts}):`, {
            windowGoogle: !!window.google,
            googleAccounts: !!(window.google && window.google.accounts),
            googleAccountsId: !!(window.google && window.google.accounts && window.google.accounts.id),
            googleAccountsOauth2: !!(window.google && window.google.accounts && window.google.accounts.oauth2)
          });
          
          if (window.google && window.google.accounts && 
              window.google.accounts.id && window.google.accounts.oauth2) {
            console.log('🔐 Google Identity Services fully available');
            resolve();
          } else if (attempts < maxAttempts) {
            setTimeout(() => checkAvailability(attempts + 1), 500);
          } else {
            console.error('🔐 Google API loaded but services not available after 10 seconds');
            reject(new Error('Google Identity Services not available after API load'));
          }
        };
        
        // Start checking immediately for browsers, with delay for WebView
        setTimeout(checkAvailability, this.isWebView ? 2000 : 100);
      };
      
      script.onerror = (error) => {
        cleanup();
        console.error('🔐 Google API script onerror fired:', {
          error: error,
          message: error.message || 'Script load error',
          type: error.type || 'unknown',
          target: error.target ? {
            src: error.target.src,
            readyState: error.target.readyState
          } : 'no target',
          networkState: navigator.onLine ? 'online' : 'offline'
        });
        script.remove();
        reject(new Error(`Google API script failed to load: ${error.message || 'Network or CORS error'}`));
      };
      
      script.onabort = (error) => {
        cleanup();
        console.error('🔐 Google API script onabort fired:', error);
        script.remove();
        reject(new Error('Google API script load aborted'));
      };
      
      // Verify document.head exists
      if (!document.head) {
        reject(new Error('document.head not available'));
        return;
      }
      
      console.log('🔐 Adding Google API script to document head...');
      try {
        document.head.appendChild(script);
        console.log('🔐 Script element successfully added to DOM');
      } catch (domError) {
        cleanup();
        console.error('🔐 Failed to add script to DOM:', domError);
        reject(new Error(`Failed to add script to DOM: ${domError.message}`));
      }
    });
  }

  async initializeGIS() {
    if (!window.google || !window.google.accounts) {
      throw new Error('Google Identity Services not available after loading');
    }

    console.log('🔐 Initializing Google Identity Services...');

    try {
      // Initialize Google Identity Services with WebView-friendly settings
      const initConfig = {
        client_id: this.config.client_id,
        callback: (response) => this.handleCredentialResponse(response),
        auto_select: false, // Disable auto-select in WebView
        cancel_on_tap_outside: false // Prevent accidental cancellation
      };

      console.log('🔐 GIS init config:', initConfig);
      google.accounts.id.initialize(initConfig);

      // Set up OAuth for additional permissions with WebView settings
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.config.client_id,
        scope: this.config.scope,
        callback: (response) => this.handleTokenResponse(response),
        error_callback: (error) => {
          console.error('🔐 OAuth error:', error);
          this.handleOAuthError(error);
        }
      });

      console.log('🔐 Google Identity Services initialized successfully');
      this.checkExistingAuth();
      
    } catch (error) {
      console.error('🔐 GIS initialization failed:', error);
      throw error;
    }
  }

  handleOAuthError(error) {
    console.error('🔐 OAuth Error Details:', error);
    
    if (error.type === 'popup_closed') {
      console.log('🔐 User closed the popup - this is normal');
      return;
    }
    
    // For other errors, show fallback
    this.showAuthError('Google authentication encountered an issue. Please try again.');
  }

  checkExistingAuth() {
    // Check if user is already signed in
    const savedUser = this.getSavedUser();
    if (savedUser) {
      console.log('🔐 Found saved user:', savedUser.name);
      this.currentUser = savedUser;
      this.isSignedIn = true;
      this.showSignedInState();
    } else {
      console.log('🔐 No saved user found, showing sign-in prompt');
      this.showSignInPrompt();
    }
  }

  handleCredentialResponse(response) {
    console.log('🔐 Credential response received');
    
    try {
      // Decode the JWT token to get user info
      const userInfo = this.parseJWT(response.credential);
      
      this.currentUser = {
        id: userInfo.sub,
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture,
        signedInAt: Date.now(),
        authMethod: 'google'
      };
      
      this.isSignedIn = true;
      this.saveUser(this.currentUser);
      this.showSignedInState();
      
      console.log('🔐 User signed in successfully:', this.currentUser.name);
    } catch (error) {
      console.error('🔐 Error processing credential response:', error);
      this.showAuthError('Failed to process Google sign-in. Please try again.');
    }
  }

  handleTokenResponse(response) {
    if (response.access_token) {
      console.log('🔐 Access token received');
      this.currentUser.accessToken = response.access_token;
      this.saveUser(this.currentUser);
    } else if (response.error) {
      console.error('🔐 Token response error:', response.error);
      this.handleOAuthError(response);
    }
  }

  parseJWT(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('🔐 JWT parsing error:', error);
      throw new Error('Invalid credential token');
    }
  }

  signIn() {
    console.log('🔐 Starting sign-in process...');
    
    if (!this.tokenClient) {
      console.error('🔐 Token client not initialized');
      this.showAuthError('Authentication not properly initialized. Please refresh the page.');
      return;
    }

    try {
      // Request access token (this will show the Google sign-in popup)
      console.log('🔐 Requesting access token...');
      this.tokenClient.requestAccessToken({
        prompt: 'consent' // Force consent screen for better WebView compatibility
      });
    } catch (error) {
      console.error('🔐 Sign-in error:', error);
      this.showAuthError('Sign-in failed. Please try again.');
    }
  }

  signOut() {
    console.log('🔐 Signing out...');
    
    if (this.currentUser && this.currentUser.accessToken) {
      try {
        google.accounts.oauth2.revoke(this.currentUser.accessToken, () => {
          console.log('🔐 Access token revoked');
        });
      } catch (error) {
        console.warn('🔐 Token revocation failed:', error);
      }
    }
    
    this.currentUser = null;
    this.isSignedIn = false;
    this.clearSavedUser();
    this.showSignInPrompt();
    
    console.log('🔐 User signed out successfully');
  }

  exitApp() {
    console.log('🚪 Exiting Dashie...');
    
    // Try Android-specific exit first
    if (window.AndroidApp && window.AndroidApp.exitApp) {
      window.AndroidApp.exitApp();
      return;
    }
    
    // Fallback methods
    if (window.close) {
      window.close();
    } else {
      window.location.href = 'about:blank';
    }
  }

  // Enhanced auth failure handling
  handleAuthFailure(error) {
    console.error('🔐 Auth initialization failed:', error);
    
    // More detailed error analysis
    let errorCategory = 'unknown';
    let userMessage = 'Authentication service is currently unavailable.';
    
    if (error.message.includes('timeout')) {
      errorCategory = 'timeout';
      userMessage = 'Google authentication timed out. Please check your internet connection.';
    } else if (error.message.includes('Network') || error.message.includes('CORS')) {
      errorCategory = 'network';
      userMessage = 'Unable to connect to Google authentication servers.';
    } else if (error.message.includes('not available')) {
      errorCategory = 'api_unavailable';
      userMessage = 'Google authentication services are not available in this environment.';
    }
    
    console.log(`🔐 Error category: ${errorCategory}`);
    
    // Check if user was previously authenticated
    const savedUser = this.getSavedUser();
    if (savedUser) {
      console.log('🔐 Using saved authentication as fallback');
      this.currentUser = savedUser;
      this.isSignedIn = true;
      this.showSignedInState();
    } else {
      // Show appropriate error message based on environment
      if (this.isWebView) {
        console.log('🔐 WebView environment detected - showing simplified auth');
        this.showWebViewAuthPrompt();
      } else {
        console.log('🔐 Browser environment - showing detailed error');
        this.showAuthError(userMessage, true);
      }
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
    signInOverlay.className = 'light-theme-signin';
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
            Retry Authentication
          </button>
          ` : ''}
          
          <button id="continue-anyway-btn" class="signin-button secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Continue Without Authentication
          </button>
          
          <button id="exit-app-btn" class="signin-button secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
            Exit
          </button>
        </div>
      </div>
    `;
    
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
    
    // Event listeners
    if (showRetry) {
      document.getElementById('retry-auth-btn').addEventListener('click', () => {
        this.hideSignInPrompt();
        this.retryCount = 0; // Reset retry count
        this.init(); // Retry initialization
      });
    }
    
    document.getElementById('continue-anyway-btn').addEventListener('click', () => {
      this.createMockUser();
    });
    
    document.getElementById('exit-app-btn').addEventListener('click', () => {
      this.exitApp();
    });
  }

  // Add this method to show WebView-specific auth prompt
  showWebViewAuthPrompt() {
    this.hideSignInPrompt();
    
    const app = document.getElementById('app');
    if (app) {
      app.style.display = 'none';
      app.classList.remove('authenticated');
    }
    
    document.body.classList.add('temp-light-theme');
    
    const signInOverlay = document.createElement('div');
    signInOverlay.id = 'sign-in-overlay';
    signInOverlay.className = 'light-theme-signin';
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
          
          <button id="exit-app-btn" class="signin-button secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
            Exit
          </button>
        </div>
      </div>
    `;
    
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
    
    // Event listeners
    document.getElementById('webview-continue-btn').addEventListener('click', () => {
      this.createMockUser();
    });
    
    document.getElementById('exit-app-btn').addEventListener('click', () => {
      this.exitApp();
    });
  }

  createMockUser() {
    this.currentUser = {
      id: 'webview-user-' + Date.now(),
      name: 'WebView User',
      email: 'webview@dashie.app',
      picture: 'icons/icon-profile-round.svg',
      signedInAt: Date.now(),
      authMethod: 'webview'
    };
    
    this.isSignedIn = true;
    this.saveUser(this.currentUser);
    this.showSignedInState();
    
    console.log('🔐 WebView user created:', this.currentUser.name);
  }

  // Regular browser auth prompt with enhanced error handling
  showSignInPrompt() {
    this.hideSignInPrompt();
    
    const app = document.getElementById('app');
    if (app) {
      app.style.display = 'none';
      app.classList.remove('authenticated');
    }
    
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
          <button id="google-signin-manual" class="signin-button primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
          
          <div id="google-signin-button" style="margin-top: 15px;"></div>
          
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
    
    // Manual sign-in button
    document.getElementById('google-signin-manual').addEventListener('click', () => {
      this.signIn();
    });
    
    // Try to render Google Sign-In button
    setTimeout(() => {
      try {
        if (window.google && window.google.accounts) {
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
        }
      } catch (error) {
        console.warn('🔐 Could not render Google sign-in button:', error);
      }
