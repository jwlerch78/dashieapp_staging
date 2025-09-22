// js/apis/api-auth/providers/web-oauth.js - Clean Web OAuth Implementation
// CHANGE SUMMARY: Extracted from auth-manager.js, added structured logging, cleaned up for code flow with refresh tokens

import { createLogger } from '../../../utils/logger.js';
import { AUTH_CONFIG } from '../../../auth/auth-config.js';

const logger = createLogger('WebOAuth');

/**
 * Web OAuth provider for browser environments
 * Handles Google OAuth flow with authorization code grant for refresh tokens
 */
export class WebOAuthProvider {
  constructor() {
    this.config = {
      client_id: '221142210647-58t8hr48rk7nlgl56j969himso1qjjoo.apps.googleusercontent.com',
      scope: 'profile email https://www.googleapis.com/auth/photoslibrary.readonly https://www.googleapis.com/auth/calendar.readonly',
      redirect_uri: window.location.origin + window.location.pathname,
      response_type: 'code', // Using code flow for refresh tokens
      access_type: 'offline', // Required for refresh tokens
      prompt: 'consent' // Force consent screen to get refresh tokens
    };
    
    this.isInitialized = false;
    this.currentTokens = null;
    
    logger.debug('Web OAuth provider initialized', {
      clientId: this.config.client_id,
      scopes: this.config.scope,
      redirectUri: this.config.redirect_uri
    });
  }

  /**
   * Initialize the provider and check for OAuth callback
   * @returns {Promise<Object|null>} Auth result if callback was handled, null otherwise
   */
  async init() {
    logger.info('Initializing Web OAuth provider');
    
    try {
      this.isInitialized = true;
      
      // Check if we're returning from OAuth callback
      const callbackResult = await this.handleOAuthCallback();
      
      if (callbackResult) {
        logger.auth('web', 'callback_handled', 'success', callbackResult);
        return callbackResult;
      }
      
      logger.success('Web OAuth provider initialized successfully');
      return null;
      
    } catch (error) {
      logger.error('Web OAuth initialization failed', error);
      this.isInitialized = true; // Still mark as initialized even if callback failed
      throw error;
    }
  }

  /**
   * Start the OAuth sign-in flow
   * @returns {Promise<void>} Redirects to Google OAuth
   */
  async signIn() {
    if (!this.isInitialized) {
      await this.init();
    }

    logger.auth('web', 'sign_in_start', 'pending');

    try {
      const authUrl = this.buildAuthUrl();
      
      logger.debug('Redirecting to Google OAuth', {
        url: authUrl.substring(0, 100) + '...',
        responseType: this.config.response_type,
        accessType: this.config.access_type
      });

      // Store that we initiated OAuth for security
      sessionStorage.setItem('dashie_oauth_state', Date.now().toString());
      
      // Redirect to Google
      window.location.href = authUrl;
      
    } catch (error) {
      logger.auth('web', 'sign_in_start', 'error', error.message);
      throw new Error(`OAuth sign-in failed: ${error.message}`);
    }
  }

  /**
   * Build the OAuth authorization URL
   * @returns {string} Complete OAuth URL
   */
  buildAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.config.client_id,
      redirect_uri: this.config.redirect_uri,
      response_type: this.config.response_type,
      scope: this.config.scope,
      access_type: this.config.access_type,
      prompt: this.config.prompt,
      state: Date.now().toString() // Simple state for CSRF protection
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  /**
   * Handle OAuth callback from Google
   * @returns {Promise<Object|null>} Auth result if callback, null if not a callback
   */
  async handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');
    const error = urlParams.get('error');
    const state = urlParams.get('state');

    // Check if this is an OAuth callback
    if (!authCode && !error) {
      logger.debug('Not an OAuth callback, continuing normal flow');
      return null;
    }

    logger.auth('web', 'callback_received', 'pending', {
      hasCode: !!authCode,
      hasError: !!error,
      hasState: !!state
    });

    // Handle OAuth errors
    if (error) {
      const errorDescription = urlParams.get('error_description');
      logger.auth('web', 'callback_received', 'error', {
        error,
        description: errorDescription
      });
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      throw new Error(`OAuth error: ${error}${errorDescription ? ' - ' + errorDescription : ''}`);
    }

    // Handle successful callback
    if (authCode) {
      try {
        logger.debug('Processing authorization code');
        
        // Exchange code for tokens
        const tokens = await this.exchangeCodeForTokens(authCode);
        
        // Get user info
        const userInfo = await this.fetchUserInfo(tokens.access_token);
        
        // Store tokens
        this.currentTokens = tokens;
        
        const authResult = {
          success: true,
          user: {
            id: userInfo.id,
            name: userInfo.name,
            email: userInfo.email,
            picture: userInfo.picture,
            authMethod: 'web_oauth',
            googleAccessToken: tokens.access_token
          },
          tokens: tokens
        };
        
        logger.auth('web', 'callback_complete', 'success', {
          userId: userInfo.id,
          userEmail: userInfo.email,
          hasRefreshToken: !!tokens.refresh_token
        });
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        return authResult;
        
      } catch (error) {
        logger.auth('web', 'callback_complete', 'error', error.message);
        
        // Clean up URL even on error
        window.history.replaceState({}, document.title, window.location.pathname);
        
        throw new Error(`OAuth callback processing failed: ${error.message}`);
      }
    }

    return null;
  }

  /**
   * Exchange authorization code for access and refresh tokens
   * @param {string} authCode - Authorization code from Google
   * @returns {Promise<Object>} Token response object
   */
  async exchangeCodeForTokens(authCode) {
    logger.debug('Exchanging authorization code for tokens');
    
    const timer = logger.startTimer('Token Exchange');
    
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.client_id,
          client_secret: AUTH_CONFIG.client_secret,
          code: authCode,
          grant_type: 'authorization_code',
          redirect_uri: this.config.redirect_uri,
        }),
      });

      const duration = timer();

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
      }

      const tokens = await response.json();
      
      logger.success('Token exchange successful', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiresIn: tokens.expires_in,
        duration
      });

      return tokens;
      
    } catch (error) {
      timer();
      logger.error('Token exchange failed', error);
      throw error;
    }
  }

  /**
   * Fetch user information from Google using access token
   * @param {string} accessToken - Google access token
   * @returns {Promise<Object>} User information object
   */
  async fetchUserInfo(accessToken) {
    logger.debug('Fetching user info from Google');
    
    const timer = logger.startTimer('User Info Fetch');
    
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const duration = timer();

      if (!response.ok) {
        throw new Error(`Google API error: ${response.status} ${response.statusText}`);
      }

      const userInfo = await response.json();
      
      logger.success('User info retrieved', {
        userId: userInfo.id,
        userName: userInfo.name,
        userEmail: userInfo.email,
        hasPicture: !!userInfo.picture,
        duration
      });

      return userInfo;
      
    } catch (error) {
      timer();
      logger.error('Failed to fetch user info', error);
      throw new Error(`Failed to get user information: ${error.message}`);
    }
  }

  /**
   * Refresh access token using stored refresh token
   * @param {string} refreshToken - Google refresh token
   * @returns {Promise<Object>} New token response
   */
  async refreshToken(refreshToken) {
    logger.debug('Refreshing access token');
    
    const timer = logger.startTimer('Token Refresh');
    
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.client_id,
          client_secret: AUTH_CONFIG.client_secret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const duration = timer();

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
      }

      const tokens = await response.json();
      
      // Update stored tokens
      this.currentTokens = { ...this.currentTokens, ...tokens };
      
      logger.success('Token refresh successful', {
        hasNewAccessToken: !!tokens.access_token,
        expiresIn: tokens.expires_in,
        duration
      });

      return tokens;
      
    } catch (error) {
      timer();
      logger.error('Token refresh failed', error);
      throw error;
    }
  }

  /**
   * Sign out and clear stored tokens
   */
  signOut() {
    logger.auth('web', 'sign_out', 'pending');
    
    try {
      this.currentTokens = null;
      
      // Clear any stored OAuth state
      sessionStorage.removeItem('dashie_oauth_state');
      
      logger.auth('web', 'sign_out', 'success');
      
    } catch (error) {
      logger.auth('web', 'sign_out', 'error', error.message);
    }
  }

  /**
   * Get current access token
   * @returns {string|null} Current access token
   */
  getAccessToken() {
    return this.currentTokens?.access_token || null;
  }

  /**
   * Get current refresh token
   * @returns {string|null} Current refresh token
   */
  getRefreshToken() {
    return this.currentTokens?.refresh_token || null;
  }

  /**
   * Check if tokens are valid and not expired
   * @returns {boolean} True if tokens are valid
   */
  hasValidTokens() {
    if (!this.currentTokens?.access_token) {
      return false;
    }

    // TODO: Add proper token expiration checking
    // For now, assume tokens are valid if they exist
    return true;
  }

  /**
   * Get provider information
   * @returns {Object} Provider info
   */
  getProviderInfo() {
    return {
      name: 'web_oauth',
      type: 'oauth2',
      supportsRefreshTokens: true,
      isInitialized: this.isInitialized,
      hasTokens: !!this.currentTokens
    };
  }
}
