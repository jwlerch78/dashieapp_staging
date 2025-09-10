// js/auth/web-auth.js - Browser Google Authentication Handler

export class WebAuth {
  constructor() {
    this.gapi = null;
    this.tokenClient = null;
    this.config = {
      client_id: '221142210647-58t8hr48rk7nlgl56j969himso1qjjoo.apps.googleusercontent.com',
      scope: 'profile email'
    };
    this.isInitialized = false;
  }

  async init() {
    try {
      console.log('🔐 Initializing web browser auth...');
      await this.loadGoogleAPI();
      await this.initializeGIS();
      this.isInitialized = true;
      console.log('🔐 Web auth initialized successfully');
    } catch (error) {
      console.error('🔐 Web auth initialization failed:', error);
      throw error;
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
      script.onerror = () => reject(new Error('Failed to load Google API'));
      document.head.appendChild(script);
    });
  }

  async initializeGIS() {
    // Initialize Google Identity Services
    google.accounts.id.initialize({
      client_id: this.config.client_id,
      callback: (response) => this.handleCredentialResponse(response),
      auto_select: false,
      cancel_on_tap_outside: true
    });

    // Set up OAuth for additional permissions
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.config.client_id,
      scope: this.config.scope,
      callback: (response) => this.handleTokenResponse(response),
      error_callback: (error) => this.handleTokenError(error)
    });

    console.log('🔐 Google Identity Services initialized');
  }

  handleCredentialResponse(response) {
    try {
      const userInfo = this.parseJWT(response.credential);
      
      const userData = {
        id: userInfo.sub,
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture,
        authMethod: 'web'
      };
      
      console.log('🔐 Web credential response received:', userData.name);
      
      // Notify the auth manager of successful authentication
      if (window.handleWebAuth) {
        window.handleWebAuth({
          success: true,
          user: userData
        });
      }
      
    } catch (error) {
      console.error('🔐 Failed to handle credential response:', error);
      if (window.handleWebAuth) {
        window.handleWebAuth({
          success: false,
          error: 'Failed to process authentication'
        });
      }
    }
  }

  handleTokenResponse(response) {
    if (response.access_token) {
      console.log('🔐 Access token received');
      // Store access token for future API calls if needed
      this.accessToken = response.access_token;
    }
  }

  handleTokenError(error) {
    console.error('🔐 Token error:', error);
    if (window.handleWebAuth) {
      window.handleWebAuth({
        success: false,
        error: error.type || 'Authentication failed'
      });
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
      console.error('🔐 Failed to parse JWT:', error);
      throw new Error('Invalid authentication token');
    }
  }

  async signIn() {
    if (!this.isInitialized) {
      throw new Error('Web auth not initialized');
    }

    try {
      console.log('🔐 Starting web sign-in process...');
      
      // Use OAuth popup for more reliable sign-in
      this.tokenClient.requestAccessToken();
      
    } catch (error) {
      console.error('🔐 Web sign-in failed:', error);
      throw error;
    }
  }

  // Alternative method for Google Sign-In button rendering
  renderSignInButton(containerId, options = {}) {
    if (!this.isInitialized || !window.google) {
      console.error('🔐 Cannot render button - Google API not loaded');
      return;
    }

    const defaultOptions = {
      theme: 'outline',
      size: 'large',
      type: 'standard',
      text: 'signin_with',
      shape: 'rectangular',
      ...options
    };

    try {
      google.accounts.id.renderButton(
        document.getElementById(containerId),
        defaultOptions
      );
    } catch (error) {
      console.error('🔐 Failed to render Google Sign-In button:', error);
    }
  }

  signOut() {
    try {
      console.log('🔐 Web sign-out');
      
      // Revoke access token if we have one
      if (this.accessToken) {
        google.accounts.oauth2.revoke(this.accessToken);
        this.accessToken = null;
      }
      
      // Disable auto-select for future sign-ins
      if (window.google && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
      }
      
    } catch (error) {
      console.error('🔐 Error during web sign-out:', error);
    }
  }
}
