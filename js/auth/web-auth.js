// js/auth/web-auth.js - Streamlined Single-Flow Web Auth

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
      
      // Check if we're returning from OAuth redirect FIRST
      const callbackHandled = await this.handleOAuthCallback();
      
      // Only initialize Google API if we didn't handle a callback
      if (!callbackHandled) {
        await this.loadGoogleAPI();
        await this.initializeGIS();
      }
      
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
    // SIMPLIFIED: Only initialize if Google API is available
    if (window.google && window.google.accounts && window.google.accounts.id) {
      google.accounts.id.initialize({
        client_id: this.config.client_id,
        callback: (response) => this.handleCredentialResponse(response),
        auto_select: false,
        cancel_on_tap_outside: true
      });
      console.log('🔐 Google Identity Services initialized');
    } else {
      console.log('🔐 Google API not available, using direct OAuth flow');
    }
  }

  // SIMPLIFIED: Handle credential response by immediately redirecting
  handleCredentialResponse(response) {
    try {
      const userInfo = this.parseJWT(response.credential);
      console.log('🔐 Web credential response received:', userInfo.name);
      
      // Immediately redirect to OAuth for access token
      console.log('🔐 Redirecting to OAuth for access token...');
      this.redirectToOAuth(userInfo);
      
    } catch (error) {
      console.error('🔐 Failed to handle credential response:', error);
      this.notifyAuthFailure('Failed to process authentication');
    }
  }

  // ENHANCED: Direct OAuth flow for single-step authentication
  async signIn() {
    if (!this.isInitialized) {
      throw new Error('Web auth not initialized');
    }

    try {
      console.log('🔐 Starting streamlined web sign-in...');
      
      // Check if Google API is available for the ID flow
      if (window.google && window.google.accounts && window.google.accounts.id) {
        // Use Google ID Services if available
        google.accounts.id.prompt();
      } else {
        // Fall back to direct OAuth flow
        console.log('🔐 Using direct OAuth flow');
        this.redirectToDirectOAuth();
      }
      
    } catch (error) {
      console.error('🔐 Web sign-in failed:', error);
      throw error;
    }
  }

  // NEW: Direct OAuth flow that gets both user info and access token in one step
  redirectToDirectOAuth() {
    console.log('🔐 Starting direct OAuth flow...');
    
    const params = new URLSearchParams({
      client_id: this.config.client_id,
      redirect_uri: this.config.redirect_uri,
      response_type: 'token', // Gets access token
      scope: this.config.scope,
      state: 'direct-oauth-flow'
    });

    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    console.log('🔐 Redirecting to direct OAuth...');
    window.location.href = oauthUrl;
  }

  // ENHANCED: OAuth redirect that includes login_hint for smoother UX
  redirectToOAuth(userInfo) {
    // Store user info for when we return from OAuth
    sessionStorage.setItem('pending-user-data', JSON.stringify(userInfo));
    
    const params = new URLSearchParams({
      client_id: this.config.client_id,
      redirect_uri: this.config.redirect_uri,
      response_type: 'token',
      scope: this.config.scope,
      state: 'oauth-flow',
      include_granted_scopes: 'true',
      login_hint: userInfo.email // This should reduce the need for user selection
    });

    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    console.log('🔐 Redirecting to OAuth with login hint...');
    window.location.href = oauthUrl;
  }

  // ENHANCED: Handle both direct OAuth and ID+OAuth flows
  async handleOAuthCallback() {
    const urlFragment = window.location.hash;
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check for errors first
    const errorInFragment = urlFragment.includes('error=');
    const errorInQuery = urlParams.get('error');
    
    if (errorInFragment || errorInQuery) {
      console.log('🔐 OAuth callback has error, handling...');
      this.handleOAuthError(urlFragment, urlParams);
      return true;
    }
    
    // Check if this is an OAuth callback (either flow)
    const isOAuthCallback = urlFragment.includes('access_token') || 
                           urlParams.get('state') === 'oauth-flow' ||
                           urlParams.get('state') === 'direct-oauth-flow';
    
    if (isOAuthCallback) {
      console.log('🔐 Handling OAuth callback...');
      
      try {
        const params = new URLSearchParams(urlFragment.substring(1));
        const accessToken = params.get('access_token');
        
        if (accessToken) {
          console.log('🔐 Access token received from OAuth redirect');
          this.accessToken = accessToken;
          
          let userData;
          
          // Check if we have stored user data from ID flow
          const storedUserData = sessionStorage.getItem('pending-user-data');
          if (storedUserData) {
            // ID + OAuth flow
            userData = JSON.parse(storedUserData);
            sessionStorage.removeItem('pending-user-data');
            console.log('🔐 Using stored user data from ID flow');
          } else {
            // Direct OAuth flow - need to get user info from Google
            console.log('🔐 Getting user info from Google API...');
            userData = await this.getUserInfoFromToken(accessToken);
          }
          
          const completeUserData = {
            id: userData.sub || userData.id,
            name: userData.name,
            email: userData.email,
            picture: userData.picture,
            authMethod: 'web',
            googleAccessToken: accessToken
          };
          
          console.log('🔐 Web auth successful with access token:', completeUserData.name);
          
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Notify auth manager
          this.notifyAuthSuccess(completeUserData, accessToken);
          
          return true; // Successfully handled callback
        }
        
        console.error('🔐 OAuth callback succeeded but no access token found');
        this.notifyAuthFailure('No access token received from OAuth');
        
      } catch (error) {
        console.error('🔐 Error handling OAuth callback:', error);
        this.notifyAuthFailure('OAuth callback error');
      }
      
      return true; // We handled a callback
    }
    
    return false; // Not an OAuth callback
  }

  // NEW: Get user info from access token for direct OAuth flow
  async getUserInfoFromToken(accessToken) {
    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }
      return await response.json();
    } catch (error) {
      console.error('🔐 Failed to get user info from token:', error);
      throw error;
    }
  }

  // ENHANCED: Error handling
  handleOAuthError(urlFragment, urlParams) {
    let errorDetails = {};
    if (urlFragment.includes('error=')) {
      const fragmentParams = new URLSearchParams(urlFragment.substring(1));
      errorDetails.error = fragmentParams.get('error');
      errorDetails.error_description = fragmentParams.get('error_description');
    } else {
      errorDetails.error = urlParams.get('error');
      errorDetails.error_description = urlParams.get('error_description');
    }
    
    console.error('🔐 OAuth error details:', errorDetails);
    
    // Clean up
    window.history.replaceState({}, document.title, window.location.pathname);
    sessionStorage.removeItem('pending-user-data');
    
    this.notifyAuthFailure(`OAuth failed: ${errorDetails.error} - ${errorDetails.error_description || 'Please try again'}`);
  }

  // HELPER: Notify auth manager of success
  notifyAuthSuccess(userData, accessToken) {
    if (window.handleWebAuth) {
      window.handleWebAuth({
        success: true,
        user: userData,
        tokens: { access_token: accessToken }
      });
    }
  }

  // HELPER: Notify auth manager of failure
  notifyAuthFailure(error) {
    if (window.handleWebAuth) {
      window.handleWebAuth({
        success: false,
        error: error
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

  getAccessToken() {
    return this.accessToken;
  }

  signOut() {
    try {
      console.log('🔐 Web sign-out');
      this.accessToken = null;
      sessionStorage.removeItem('pending-user-data');
      
      if (window.google && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
      }
    } catch (error) {
      console.error('🔐 Error during web sign-out:', error);
    }
  }
}
