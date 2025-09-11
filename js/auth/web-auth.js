// js/auth/web-auth.js - Redirect-Based Web Auth (No Popup) - FIXED VERSION

export class WebAuth {
  constructor() {
    this.config = {
      client_id: '221142210647-58t8hr48rk7nlgl56j969himso1qjjoo.apps.googleusercontent.com',
      scope: 'profile email',
      redirect_uri: window.location.origin + window.location.pathname
    };
    this.isInitialized = false;
    this.accessToken = null;
  }

  async init() {
    try {
      console.log('🔐 Initializing web browser auth...');
      
      // Check if we're returning from OAuth redirect
      await this.handleOAuthCallback();
      
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
    // Initialize Google Identity Services for ID token only
    google.accounts.id.initialize({
      client_id: this.config.client_id,
      callback: (response) => this.handleCredentialResponse(response),
      auto_select: false,
      cancel_on_tap_outside: true
    });

    console.log('🔐 Google Identity Services initialized');
  }

  handleCredentialResponse(response) {
    try {
      const userInfo = this.parseJWT(response.credential);
      console.log('🔐 Web credential response received:', userInfo.name);
      
      // For the credential flow, we'll redirect to get access token
      console.log('🔐 Redirecting to get access token...');
      this.redirectToOAuth(userInfo);
      
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

  redirectToOAuth(userInfo) {
    // Store user info for when we return from OAuth
    sessionStorage.setItem('pending-user-data', JSON.stringify(userInfo));
    
    // Build OAuth URL for access token
    const params = new URLSearchParams({
      client_id: this.config.client_id,
      redirect_uri: this.config.redirect_uri,
      response_type: 'token', // This gives us access_token in URL fragment
      scope: this.config.scope,
      state: 'oauth-flow', // To identify OAuth return
      // REMOVED: prompt: 'none' - this was causing multiple user selections
      include_granted_scopes: 'true', // Include previously granted scopes
      login_hint: userInfo.email // Pre-fill the email to reduce user selection
    });

    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    console.log('🔐 Redirecting to OAuth for access token...');
    window.location.href = oauthUrl;
  }

  async handleOAuthCallback() {
    // Check if we're returning from OAuth (access token in URL fragment)
    const urlFragment = window.location.hash;
    const urlParams = new URLSearchParams(window.location.search);
    
    // Also check for errors in the URL
    const errorInFragment = urlFragment.includes('error=');
    const errorInQuery = urlParams.get('error');
    
    if (errorInFragment || errorInQuery) {
      console.log('🔐 OAuth callback has error, handling...');
      
      // Extract error details
      let errorDetails = {};
      if (errorInFragment) {
        const fragmentParams = new URLSearchParams(urlFragment.substring(1));
        errorDetails.error = fragmentParams.get('error');
        errorDetails.error_description = fragmentParams.get('error_description');
        errorDetails.error_subtype = fragmentParams.get('error_subtype');
      } else {
        errorDetails.error = urlParams.get('error');
        errorDetails.error_description = urlParams.get('error_description');
      }
      
      console.error('🔐 OAuth error details:', errorDetails);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Clear any stored user data
      sessionStorage.removeItem('pending-user-data');
      
      // Notify auth manager of failure
      if (window.handleWebAuth) {
        window.handleWebAuth({
          success: false,
          error: `OAuth failed: ${errorDetails.error} - ${errorDetails.error_description || 'Please try again'}`
        });
      }
      
      return true; // We handled the error callback
    }
    
    if (urlFragment.includes('access_token') || urlParams.get('state') === 'oauth-flow') {
      console.log('🔐 Handling OAuth callback...');
      
      try {
        // Extract access token from URL fragment
        const params = new URLSearchParams(urlFragment.substring(1)); // Remove #
        const accessToken = params.get('access_token');
        
        if (accessToken) {
          console.log('🔐 Access token received from OAuth redirect');
          this.accessToken = accessToken;
          
          // Get stored user data
          const storedUserData = sessionStorage.getItem('pending-user-data');
          if (storedUserData) {
            const userData = JSON.parse(storedUserData);
            sessionStorage.removeItem('pending-user-data');
            
            // Combine user data with access token
            const completeUserData = {
              id: userData.sub,
              name: userData.name,
              email: userData.email,
              picture: userData.picture,
              authMethod: 'web',
              googleAccessToken: accessToken
            };
            
            console.log('🔐 Web auth successful with access token:', userData.name);
            
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Notify auth manager
            if (window.handleWebAuth) {
              window.handleWebAuth({
                success: true,
                user: completeUserData,
                tokens: { access_token: accessToken }
              });
            }
            
            return true; // Successfully handled callback
          }
        }
        
        // If we got here, OAuth succeeded but no access token
        console.error('🔐 OAuth callback succeeded but no access token found');
        if (window.handleWebAuth) {
          window.handleWebAuth({
            success: false,
            error: 'No access token received from OAuth'
          });
        }
        
      } catch (error) {
        console.error('🔐 Error handling OAuth callback:', error);
        if (window.handleWebAuth) {
          window.handleWebAuth({
            success: false,
            error: 'OAuth callback error'
          });
        }
      }
      
      return true; // We handled a callback (even if it failed)
    }
    
    return false; // Not an OAuth callback
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
      
      // Start with Google ID prompt (this will lead to redirect flow)
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
      
      // Clear stored token
      this.accessToken = null;
      
      // Clear any stored user data
      sessionStorage.removeItem('pending-user-data');
      
      // Disable auto-select for future sign-ins
      if (window.google && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
      }
      
    } catch (error) {
      console.error('🔐 Error during web sign-out:', error);
    }
  }
}
