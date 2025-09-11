// js/auth/web-auth.js - Fixed to capture access tokens

export class WebAuth {
  constructor() {
    this.gapi = null;
    this.tokenClient = null;
    this.config = {
      client_id: '221142210647-58t8hr48rk7nlgl56j969himso1qjjoo.apps.googleusercontent.com',
      scope: 'profile email'
    };
    this.isInitialized = false;
    this.accessToken = null; // Store access token
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

    // Set up OAuth for access tokens
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
      
      console.log('🔐 Web credential response received:', userInfo.name);
      
      // Store the user data temporarily
      this.pendingUserData = {
        id: userInfo.sub,
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture,
        authMethod: 'web'
      };
      
      // Now request access token
      console.log('🔐 Requesting access token...');
      this.tokenClient.requestAccessToken();
      
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
    try {
      console.log('🔐 Access token received:', !!response.access_token);
      
      if (response.access_token) {
        // Store the access token
        this.accessToken = response.access_token;
        
        // Combine with user data from credential response
        const userData = {
          ...this.pendingUserData,
          googleAccessToken: response.access_token // Include token in user data
        };
        
        console.log('🔐 Web auth successful with access token:', userData.name);
        
        // Notify the auth manager
        if (window.handleWebAuth) {
          window.handleWebAuth({
            success: true,
            user: userData,
            tokens: response // Pass the full token response
          });
        }
      } else {
        throw new Error('No access token received');
      }
      
    } catch (error) {
      console.error('🔐 Token response handling failed:', error);
      if (window.handleWebAuth) {
        window.handleWebAuth({
          success: false,
          error: 'Failed to get access token'
        });
      }
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
      
      // Start with Google ID prompt (this will trigger the credential flow)
      google.accounts.id.prompt();
      
    } catch (error) {
      console.error('🔐 Web sign-in failed:', error);
      throw error;
    }
  }

  // Get current access token
  getAccessToken() {
    return this.accessToken;
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
