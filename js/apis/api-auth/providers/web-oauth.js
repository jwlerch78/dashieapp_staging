// js/apis/api-auth/providers/web-oauth.js
// CHANGE SUMMARY: Added OAuth state clearing on errors and retry with account selection to fix cached session conflicts

import { createLogger } from '../../../utils/logger.js';
import { AUTH_CONFIG } from '../../../auth/auth-config.js';

const logger = createLogger('WebOAuth');

// Global storage for pending refresh tokens (to be processed during startup)
window.pendingRefreshTokens = window.pendingRefreshTokens || [];

/**
 * Web OAuth provider for browser environments
 * Handles Google OAuth flow with authorization code grant for refresh tokens
 * Now integrates with the robust startup sequence for reliable token storage
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
   * @param {boolean} forceAccountSelection - Force Google account selection (used after errors)
   * @returns {Promise<void>} Redirects to Google OAuth
   */
  async signIn(forceAccountSelection = false) {
    if (!this.isInitialized) {
      await this.init();
    }

    logger.auth('web', 'sign_in_start', 'pending', {
      forceAccountSelection
    });

    try {
      // Clear any stale OAuth state before starting
      this._clearOAuthState();
      
      const authUrl = this.buildAuthUrl(forceAccountSelection);
      
      logger.debug('Redirecting to Google OAuth', {
        url: authUrl.substring(0, 100) + '...',
        responseType: this.config.response_type,
        accessType: this.config.access_type,
        forceAccountSelection
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
   * @param {boolean} forceAccountSelection - Force account selection screen
   * @returns {string} Complete OAuth URL
   */
  buildAuthUrl(forceAccountSelection = false) {
    // Determine prompt parameter based on context
    const promptValue = forceAccountSelection ? 'select_account consent' : this.config.prompt;
    
    const params = new URLSearchParams({
      client_id: this.config.client_id,
      redirect_uri: this.config.redirect_uri,
      response_type: this.config.response_type,
      scope: this.config.scope,
      access_type: this.config.access_type,
      prompt: promptValue,
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
      
      // Clean up URL and OAuth state
      window.history.replaceState({}, document.title, window.location.pathname);
      this._clearOAuthState();
      
      // Check if this might be a cached session conflict
      const isCachedSessionError = error === 'access_denied' || 
                                    error === 'invalid_request' ||
                                    errorDescription?.toLowerCase().includes('session');
      
      if (isCachedSessionError) {
        logger.warn('Possible cached OAuth session conflict detected');
        
        // Show user-friendly error and offer to retry with account selection
        const retryMessage = 'Authentication failed. This may be due to a cached session. Click OK to retry with account selection.';
        
        if (confirm(retryMessage)) {
          logger.info('User confirmed retry with account selection');
          // Retry with forced account selection to bypass cached session
          await this.signIn(true);
          return null; // Will redirect, so return null
        } else {
          throw new Error('Authentication cancelled by user');
        }
      }
      
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
        
        // Store tokens in provider
        this.currentTokens = tokens;
        
        // Queue refresh tokens for deferred storage during startup
        this._queueRefreshTokensForStorage(userInfo, tokens);
        
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
          userEmail: userInfo.email,
          hasRefreshToken: !!tokens.refresh_token,
          refreshTokenQueued: !!tokens.refresh_token
        });
        
        // Clean up URL and OAuth state
        window.history.replaceState({}, document.title, window.location.pathname);
        this._clearOAuthState();
        
        return authResult;
        
      } catch (error) {
        logger.auth('web', 'callback_complete', 'error', error.message);
        
        // Clean up URL and OAuth state even on error
        window.history.replaceState({}, document.title, window.location.pathname);
        this._clearOAuthState();
        
        throw new Error(`OAuth callback processing failed: ${error.message}`);
      }
    }

    return null;
  }

  /**
   * Clear OAuth state from sessionStorage
   * This helps prevent conflicts when switching between different OAuth flows
   * @private
   */
  _clearOAuthState() {
    try {
      sessionStorage.removeItem('dashie_oauth_state');
      logger.debug('OAuth state cleared from sessionStorage');
    } catch (error) {
      logger.warn('Failed to clear OAuth state', error);
    }
  }

  /**
   * Queue refresh tokens for storage during the startup sequence
   * @private
   * @param {Object} userInfo - User information from Google
   * @param {Object} tokens - Token data from OAuth
   */
  _queueRefreshTokensForStorage(userInfo, tokens) {
    try {
      // Only proceed if we have a refresh token
      if (!tokens.refresh_token) {
        logger.warn('No refresh token received - user may need to reauthorize');
        return;
      }

      // Prepare token data for storage
      const tokenData = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in || 3600,
        scope: this.config.scope,
        display_name: `${userInfo.name} (Personal)`,
        email: userInfo.email,
        user_id: userInfo.id,
        issued_at: Date.now(),
        provider_info: {
          type: 'web_oauth',
          client_id: this.config.client_id
        }
      };

      // Determine account type (for now, assume 'personal' - can be enhanced later)
      const accountType = 'personal';

      // Queue for processing during startup sequence
      const queuedToken = {
        provider: 'google',
        accountType,
        tokenData,
        userInfo: {
          email: userInfo.email,
          name: userInfo.name,
          id: userInfo.id
        },
        timestamp: Date.now()
      };

      window.pendingRefreshTokens.push(queuedToken);

      logger.success('🔄 Refresh tokens queued for storage during startup', {
        provider: 'google',
        accountType,
        userEmail: userInfo.email,
        scopeCount: this.config.scope.split(' ').length,
        queueSize: window.pendingRefreshTokens.length
      });

    } catch (error) {
      logger.error('Failed to queue refresh tokens:', error);
      // Don't throw - auth should still succeed even if token queuing fails
    }
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
          client_secret: AUTH_CONFIG.client_secret_web_oauth,
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
   * Fetch user information from Google
   * @param {string} accessToken - Google access token
   * @returns {Promise<Object>} User info object
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
        throw new Error(`Failed to fetch user info: ${response.status}`);
      }

      const userInfo = await response.json();
      
      logger.success('User info fetched successfully', {
        userEmail: userInfo.email,
        duration
      });

      return userInfo;
      
    } catch (error) {
      timer();
      logger.error('Failed to fetch user info', error);
      throw error;
    }
  }

  /**
   * Refresh an access token using a refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New token data
   */
  async refreshAccessToken(refreshToken) {
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
          client_secret: AUTH_CONFIG.client_secret_web_oauth,
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
      
      logger.success('Access token refreshed successfully', {
        hasAccessToken: !!tokens.access_token,
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
      
      // Clear OAuth state
      this._clearOAuthState();
      
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

// ====== GLOBAL FUNCTION FOR STARTUP SEQUENCE INTEGRATION ======

/**
 * Process any pending refresh tokens during the startup sequence
 * This should be called from main.js after JWT service is confirmed ready
 * @returns {Promise<Array>} Results of token storage operations
 */
export async function processPendingRefreshTokens() {
  if (!window.pendingRefreshTokens || window.pendingRefreshTokens.length === 0) {
    logger.debug('No pending refresh tokens to process');
    return [];
  }

  if (!window.jwtAuth || !window.jwtAuth.isServiceReady()) {
    logger.error('JWT service not ready for processing pending refresh tokens');
    return [];
  }

  logger.info('🔄 Processing pending refresh tokens', {
    count: window.pendingRefreshTokens.length
  });

  const results = [];

  for (const queuedToken of window.pendingRefreshTokens) {
    try {
      logger.debug('Processing queued refresh token', {
        provider: queuedToken.provider,
        accountType: queuedToken.accountType,
        userEmail: queuedToken.userInfo.email
      });

      const stored = await window.jwtAuth.storeTokens(
        queuedToken.provider,
        queuedToken.accountType,
        queuedToken.tokenData
      );

      const result = {
        success: stored,
        provider: queuedToken.provider,
        accountType: queuedToken.accountType,
        userEmail: queuedToken.userInfo.email,
        error: stored ? null : 'Storage operation returned false'
      };

      results.push(result);

      if (stored) {
        logger.success('✅ Queued refresh token stored successfully', {
          provider: queuedToken.provider,
          accountType: queuedToken.accountType,
          userEmail: queuedToken.userInfo.email
        });
      } else {
        logger.error('❌ Failed to store queued refresh token', result);
      }

    } catch (error) {
      const result = {
        success: false,
        provider: queuedToken.provider,
        accountType: queuedToken.accountType,
        userEmail: queuedToken.userInfo.email,
        error: error.message
      };

      results.push(result);
      logger.error('❌ Error processing queued refresh token:', error);
    }
  }

  // Clear the queue after processing
  const processedCount = window.pendingRefreshTokens.length;
  window.pendingRefreshTokens = [];

  logger.success('🎯 Pending refresh token processing complete', {
    processed: processedCount,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  });

  return results;
}