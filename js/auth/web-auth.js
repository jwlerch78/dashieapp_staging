// js/auth/web-auth.js - Updated for Authorization Code Flow with Refresh Tokens
// CHANGE SUMMARY: Switched from implicit flow to authorization code flow to support refresh tokens

export class WebAuth {
  constructor() {
    this.config = {
      client_id: '221142210647-58t8hr48rk7nlgl56j969himso1qjjoo.apps.googleusercontent.com',
      // ✅ UPDATED: Add Google Photos and Calendar scopes
      scope: 'profile email https://www.googleapis.com/auth/photoslibrary.readonly https://www.googleapis.com/auth/calendar.readonly',
      redirect_uri: window.location.origin + window.location.pathname
    };
    this.isInitialized = false;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  async init() {
    try {
      console.log('🔐 Initializing web auth with refresh token support...');
      
      // IMPORTANT: Check OAuth callback FIRST before doing anything else
      const callbackHandled = await this.handleOAuthCallback();
      
      if (callbackHandled) {
        console.log('🔐 OAuth callback handled, skipping further initialization');
      } else {
        console.log('🔐 No OAuth callback detected, ready for sign-in');
      }
      
      this.isInitialized = true;
      console.log('🔐 Web auth with refresh token support initialized');
      
    } catch (error) {
      console.error('🔐 Web auth initialization failed:', error);
      this.isInitialized = true; // Still mark as initialized to allow sign-in
    }
  }

  // UPDATED: Authorization Code Flow - gets code then exchanges for tokens
  async signIn() {
    if (!this.isInitialized) {
      throw new Error('Web auth not initialized');
    }

    try {
      console.log('🔐 ⚡ Starting Authorization Code Flow for refresh tokens...');
      
      // Go to OAuth authorization code flow
      this.startAuthorizationCodeFlow();
      
    } catch (error) {
      console.error('🔐 Authorization code sign-in failed:', error);
      throw error;
    }
  }

  // NEW: Authorization Code Flow - gets code for server-side token exchange
  startAuthorizationCodeFlow() {
    console.log('🔐 🚀 Redirecting to Google OAuth (authorization code flow)...');
    
    const params = new URLSearchParams({
      client_id: this.config.client_id,
      redirect_uri: this.config.redirect_uri,
      response_type: 'code', // NEW: Get authorization code instead of token
      scope: this.config.scope,
      state: 'dashie-auth-code',
      access_type: 'offline', // NEW: Required for refresh tokens
      prompt: 'consent', // NEW: Force consent to ensure refresh token
      include_granted_scopes: 'true'
    });

    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    console.log('🔐 📍 OAuth URL:', oauthUrl);
    
    // Direct redirect to get authorization code
    window.location.href = oauthUrl;
  }

  // UPDATED: Handle authorization code callback and exchange for tokens
  async handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    
    console.log('🔐 🔍 Checking for OAuth callback...');
    console.log('🔐 URL params state:', urlParams.get('state'));
    
    // Check for errors first
    if (urlParams.get('error')) {
      console.log('🔐 ❌ OAuth error detected');
      this.handleOAuthError(urlParams);
      return true;
    }
    
    // Check if this is our OAuth callback
    const authCode = urlParams.get('code');
    const state = urlParams.get('state');
    const isOurCallback = authCode && state === 'dashie-auth-code';
    
    if (isOurCallback) {
      console.log('🔐 ✅ Authorization code callback detected! Processing...');
      
      try {
        console.log('🔐 🔄 Exchanging authorization code for tokens...');
        
        // NEW: Exchange authorization code for access + refresh tokens
        const tokens = await this.exchangeCodeForTokens(authCode);
        
        // Store tokens with expiration info
        this.accessToken = tokens.access_token;
        this.refreshToken = tokens.refresh_token;
        this.tokenExpiry = Date.now() + (tokens.expires_in * 1000);
        
        console.log('🔐 🎫 Tokens received:', {
          hasAccessToken: !!tokens.access_token,
          hasRefreshToken: !!tokens.refresh_token,
          expiresIn: tokens.expires_in,
          expiresAt: new Date(this.tokenExpiry).toISOString()
        });
        
        // Get user info using the access token
        console.log('🔐 👤 Fetching user info from Google...');
        const userInfo = await this.fetchUserInfo(tokens.access_token);
        
        const completeUserData = {
          id: userInfo.id,
          name: userInfo.name,
          email: userInfo.email,
          picture: userInfo.picture,
          authMethod: 'web',
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token, // NEW: Store refresh token
          tokenExpiry: this.tokenExpiry // NEW: Store expiry time
        };
        
        console.log('🔐 🎉 Authorization Code Flow SUCCESS:', completeUserData.name);
        
        // Clean up the URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Notify the auth manager
        this.notifyAuthSuccess(completeUserData, tokens);
        
        return true; // Successfully handled callback
        
      } catch (error) {
        console.error('🔐 ❌ Token exchange failed:', error);
        this.notifyAuthFailure('Token exchange failed: ' + error.message);
        return true; // We handled the callback (even though it failed)
      }
    }
    
    console.log('🔐 ℹ️ Not an OAuth callback, continuing normal flow');
    return false; // Not our callback
  }

  // NEW: Exchange authorization code for tokens via Supabase Edge Function
  async exchangeCodeForTokens(authorizationCode) {
    try {
      console.log('🔐 📡 Calling token exchange endpoint...');
      
      // Call our Supabase Edge Function to exchange code for tokens
      const response = await fetch('/api/auth/token-exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: authorizationCode,
          redirect_uri: this.config.redirect_uri
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
      }
      
      const tokens = await response.json();
      
      if (!tokens.access_token) {
        throw new Error('No access token received from token exchange');
      }
      
      if (!tokens.refresh_token) {
        console.warn('🔐 ⚠️ No refresh token received - user may need to re-consent');
      }
      
      console.log('🔐 ✅ Token exchange successful');
      return tokens;
      
    } catch (error) {
      console.error('🔐 ❌ Token exchange failed:', error);
      throw new Error(`Failed to exchange authorization code: ${error.message}`);
    }
  }

  // EXISTING: Fetch user info from Google using access token
  async fetchUserInfo(accessToken) {
    try {
      console.log('🔐 📡 Calling Google userinfo API...');
      
      const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Google API error: ${response.status} ${response.statusText}`);
      }
      
      const userInfo = await response.json();
      console.log('🔐 👤 User info received:', {
        id: userInfo.id,
        name: userInfo.name,
        email: userInfo.email,
        hasPicture: !!userInfo.picture
      });
      
      return userInfo;
      
    } catch (error) {
      console.error('🔐 ❌ Failed to fetch user info:', error);
      throw new Error(`Failed to get user information: ${error.message}`);
    }
  }

  // UPDATED: Handle OAuth errors (now from query params)
  handleOAuthError(urlParams) {
    const errorInfo = {
      error: urlParams.get('error'),
      error_description: urlParams.get('error_description'),
      error_uri: urlParams.get('error_uri')
    };
    
    console.error('🔐 OAuth error details:', errorInfo);
    
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
    
    const errorMessage = `OAuth error: ${errorInfo.error}${errorInfo.error_description ? ' - ' + errorInfo.error_description : ''}`;
    this.notifyAuthFailure(errorMessage);
  }

  // UPDATED: Notify auth manager with token details
  notifyAuthSuccess(userData, tokens) {
    console.log('🔐 📢 Notifying auth manager of success');
    if (window.handleWebAuth) {
      window.handleWebAuth({
        success: true,
        user: userData,
        tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token, // NEW: Include refresh token
          expires_in: tokens.expires_in,
          token_type: tokens.token_type
        }
      });
    } else {
      console.warn('🔐 ⚠️ window.handleWebAuth not available');
    }
  }

  // EXISTING: Notify auth manager of authentication failure
  notifyAuthFailure(error) {
    console.error('🔐 📢 Notifying auth manager of failure:', error);
    if (window.handleWebAuth) {
      window.handleWebAuth({
        success: false,
        error: error
      });
    } else {
      console.warn('🔐 ⚠️ window.handleWebAuth not available');
    }
  }

  // NEW: Check if access token is expired or about to expire
  isTokenExpired(bufferMinutes = 5) {
    if (!this.tokenExpiry) return true;
    
    const bufferMs = bufferMinutes * 60 * 1000;
    return Date.now() >= (this.tokenExpiry - bufferMs);
  }

  // NEW: Get current access token (will be used by token manager for refresh)
  getAccessToken() {
    return this.accessToken;
  }

  // NEW: Get refresh token (will be used by token manager)
  getRefreshToken() {
    return this.refreshToken;
  }

  // NEW: Update stored tokens after refresh
  updateTokens(newTokens) {
    this.accessToken = newTokens.access_token;
    if (newTokens.refresh_token) {
      this.refreshToken = newTokens.refresh_token;
    }
    this.tokenExpiry = Date.now() + (newTokens.expires_in * 1000);
    
    console.log('🔐 🔄 Tokens updated:', {
      hasAccessToken: !!this.accessToken,
      hasRefreshToken: !!this.refreshToken,
      expiresAt: new Date(this.tokenExpiry).toISOString()
    });
  }

  // UPDATED: Sign out - clear all tokens
  signOut() {
    try {
      console.log('🔐 🚪 Web auth sign out');
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
      
    } catch (error) {
      console.error('🔐 ❌ Error during web sign-out:', error);
    }
  }
}
