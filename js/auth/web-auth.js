// js/auth/web-auth.js - Single OAuth-Only Web Auth

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
      const callbackHandled = await this.handleOAuthCallback();
      
      // Mark as initialized regardless of callback handling
      this.isInitialized = true;
      console.log('🔐 Web auth initialized successfully');
    } catch (error) {
      console.error('🔐 Web auth initialization failed:', error);
      throw error;
    }
  }

  // SIMPLIFIED: Direct OAuth flow only - no Google ID Services
  async signIn() {
    if (!this.isInitialized) {
      throw new Error('Web auth not initialized');
    }

    try {
      console.log('🔐 Starting single OAuth flow...');
      
      // Go directly to OAuth - no Google ID Services step
      this.redirectToOAuth();
      
    } catch (error) {
      console.error('🔐 Web sign-in failed:', error);
      throw error;
    }
  }

  // DIRECT OAuth flow - gets both user info and access token in one step
  redirectToOAuth() {
    console.log('🔐 Starting direct OAuth flow...');
    
    const params = new URLSearchParams({
      client_id: this.config.client_id,
      redirect_uri: this.config.redirect_uri,
      response_type: 'token', // Gets access token directly
      scope: this.config.scope,
      state: 'single-oauth-flow',
      include_granted_scopes: 'true'
      // NO login_hint since we don't have user info yet
    });

    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    console.log('🔐 Redirecting to single OAuth flow...');
    window.location.href = oauthUrl;
  }

  // Handle OAuth callback and get user info
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
    
    // Check if this is an OAuth callback
    const isOAuthCallback = urlFragment.includes('access_token') || 
                           urlParams.get('state') === 'single-oauth-flow';
    
    if (isOAuthCallback) {
      console.log('🔐 Handling single OAuth callback...');
      
      try {
        const params = new URLSearchParams(urlFragment.substring(1));
        const accessToken = params.get('access_token');
        
        if (accessToken) {
          console.log('🔐 Access token received from OAuth redirect');
          this.accessToken = accessToken;
          
          // Get user info from Google using the access token
          console.log('🔐 Getting user info from Google API...');
          const userData = await this.getUserInfoFromToken(accessToken);
          
          const completeUserData = {
            id: userData.id,
            name: userData.name,
            email: userData.email,
            picture: userData.picture,
            authMethod: 'web',
            googleAccessToken: accessToken
          };
          
          console.log('🔐 Single OAuth flow successful:', completeUserData.name);
          
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
        this.notifyAuthFailure('OAuth callback error: ' + error.message);
      }
      
      return true; // We handled a callback
    }
    
    return false; // Not an OAuth callback
  }

  // Get user info from access token
  async getUserInfoFromToken(accessToken) {
    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.status}`);
      }
      const userInfo = await response.json();
      console.log('🔐 Retrieved user info:', userInfo.name);
      return userInfo;
    } catch (error) {
      console.error('🔐 Failed to get user info from token:', error);
      throw error;
    }
  }

  // Handle OAuth errors
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
    
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
    
    this.notifyAuthFailure(`OAuth failed: ${errorDetails.error} - ${errorDetails.error_description || 'Please try again'}`);
  }

  // Notify auth manager of success
  notifyAuthSuccess(userData, accessToken) {
    if (window.handleWebAuth) {
      window.handleWebAuth({
        success: true,
        user: userData,
        tokens: { access_token: accessToken }
      });
    }
  }

  // Notify auth manager of failure  
  notifyAuthFailure(error) {
    if (window.handleWebAuth) {
      window.handleWebAuth({
        success: false,
        error: error
      });
    }
  }

  getAccessToken() {
    return this.accessToken;
  }

  signOut() {
    try {
      console.log('🔐 Web sign-out');
      this.accessToken = null;
      
      // Note: No Google ID Services to disable since we're not using it
      
    } catch (error) {
      console.error('🔐 Error during web sign-out:', error);
    }
  }
}
