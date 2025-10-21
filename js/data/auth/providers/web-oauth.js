// js/data/auth/providers/web-oauth.js
// Web OAuth provider for browser environments - Phase 3 refactored version
// Handles Google OAuth flow with authorization code grant

import { createLogger } from '../../../utils/logger.js';
import { SUPABASE_CONFIG } from '../auth-config.js';

const logger = createLogger('WebOAuth');

// Supabase config - anon key is SAFE in client code (public by design)
const EDGE_FUNCTION_URL = SUPABASE_CONFIG.edgeFunctionUrl;
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey;
const GOOGLE_CLIENT_ID = SUPABASE_CONFIG.googleWebClientId;

/**
 * Web OAuth provider for browser environments
 * Handles Google OAuth flow with authorization code grant for refresh tokens
 */
export class WebOAuthProvider {
  constructor() {
    this.config = {
      client_id: GOOGLE_CLIENT_ID,
      scope: 'profile email https://www.googleapis.com/auth/calendar.readonly',
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
    logger.verbose('Initializing Web OAuth provider');

    try {
      this.isInitialized = true;

      // Check if we're returning from OAuth callback
      const callbackResult = await this.handleOAuthCallback();

      if (callbackResult) {
        logger.success('OAuth callback handled during init', {
          userEmail: callbackResult.user?.email
        });
        return callbackResult;
      }

      logger.verbose('Web OAuth provider initialized successfully');
      return null;

    } catch (error) {
      logger.error('Web OAuth initialization failed', error);
      this.isInitialized = true; // Still mark as initialized even if callback failed
      throw error;
    }
  }

  /**
   * Start the OAuth sign-in flow
   * @param {boolean} forceAccountSelection - Force Google account selection
   * @returns {Promise<void>} Redirects to Google OAuth
   */
  async signIn(forceAccountSelection = false) {
    if (!this.isInitialized) {
      await this.init();
    }

    logger.info('Starting Google sign-in', {
      forceAccountSelection
    });

    try {
      // Clear any stale OAuth state
      this._clearOAuthState();

      const authUrl = this.buildAuthUrl(forceAccountSelection);

      logger.debug('Redirecting to Google OAuth', {
        url: authUrl.substring(0, 100) + '...',
        forceAccountSelection
      });

      // Store that we initiated OAuth
      sessionStorage.setItem('dashie-oauth-state', Date.now().toString());

      // Redirect to Google
      window.location.href = authUrl;

    } catch (error) {
      logger.error('OAuth sign-in failed', error);
      throw new Error(`OAuth sign-in failed: ${error.message}`);
    }
  }

  /**
   * Build the OAuth authorization URL
   * @param {boolean} forceAccountSelection - Force account selection screen
   * @returns {string} Complete OAuth URL
   */
  buildAuthUrl(forceAccountSelection = false) {
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

    // Check if this is an OAuth callback
    if (!authCode && !error) {
      logger.debug('Not an OAuth callback, continuing normal flow');
      return null;
    }

    logger.info('OAuth callback received', {
      hasCode: !!authCode,
      hasError: !!error
    });

    // Handle OAuth errors
    if (error) {
      const errorDescription = urlParams.get('error_description');
      logger.error('OAuth error received', {
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

        if (confirm('Authentication failed. This may be due to a cached session. Click OK to retry with account selection.')) {
          logger.info('User confirmed retry with account selection');
          await this.signIn(true);
          return null; // Will redirect
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
          tokens: tokens,
          refreshToken: tokens.refresh_token,
          expiresIn: tokens.expires_in
        };

        logger.success('OAuth callback complete', {
          userEmail: userInfo.email,
          hasRefreshToken: !!tokens.refresh_token
        });

        // Clean up URL and OAuth state
        window.history.replaceState({}, document.title, window.location.pathname);
        this._clearOAuthState();

        return authResult;

      } catch (error) {
        logger.error('OAuth callback processing failed', error);

        // Clean up URL even on error
        window.history.replaceState({}, document.title, window.location.pathname);
        this._clearOAuthState();

        throw new Error(`OAuth callback processing failed: ${error.message}`);
      }
    }

    return null;
  }

  /**
   * Clear OAuth state from sessionStorage
   * @private
   */
  _clearOAuthState() {
    try {
      sessionStorage.removeItem('dashie-oauth-state');
      logger.debug('OAuth state cleared');
    } catch (error) {
      logger.warn('Failed to clear OAuth state', error);
    }
  }

  /**
   * Exchange authorization code for access and refresh tokens via edge function
   * @param {string} authCode - Authorization code from Google
   * @returns {Promise<Object>} Token response object
   */
  async exchangeCodeForTokens(authCode) {
    logger.debug('Exchanging authorization code for tokens via edge function');

    // DEBUG: Log what we're sending
    console.log('🔍 DEBUG - Edge function request:', {
      url: EDGE_FUNCTION_URL,
      hasApiKey: !!SUPABASE_ANON_KEY,
      apiKeyLength: SUPABASE_ANON_KEY?.length,
      apiKeyPrefix: SUPABASE_ANON_KEY?.substring(0, 20)
    });

    try {
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          operation: 'exchange_code',
          data: {
            code: authCode,
            redirect_uri: this.config.redirect_uri,
            provider_type: 'web_oauth'
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Token exchange failed: ${response.status} ${errorData.error || errorData.details || ''}`);
      }

      const result = await response.json();

      if (!result.success || !result.tokens) {
        throw new Error('Token exchange failed: Invalid response from edge function');
      }

      logger.success('Token exchange successful', {
        hasAccessToken: !!result.tokens.access_token,
        hasRefreshToken: !!result.tokens.refresh_token,
        expiresIn: result.tokens.expires_in
      });

      return result.tokens;

    } catch (error) {
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

    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.status}`);
      }

      const userInfo = await response.json();

      logger.success('User info fetched successfully', {
        userEmail: userInfo.email
      });

      return userInfo;

    } catch (error) {
      logger.error('Failed to fetch user info', error);
      throw error;
    }
  }

  /**
   * Refresh an access token using a refresh token
   * NOTE: Token refresh now handled by edge function, not client-side
   * This method is here for compatibility but shouldn't be called
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New token data
   */
  async refreshAccessToken(refreshToken) {
    logger.warn('refreshAccessToken called - this should be handled by edge function via GoogleAPIClient');
    throw new Error('Token refresh should be handled via edge function, not client-side');
  }

  /**
   * Sign out and clear stored tokens
   */
  signOut() {
    logger.info('Signing out');

    try {
      this.currentTokens = null;
      this._clearOAuthState();
      logger.success('Sign out complete');

    } catch (error) {
      logger.error('Error during sign out', error);
    }
  }

  /**
   * Get current access token
   * @returns {string|null}
   */
  getAccessToken() {
    return this.currentTokens?.access_token || null;
  }

  /**
   * Get current refresh token
   * @returns {string|null}
   */
  getRefreshToken() {
    return this.currentTokens?.refresh_token || null;
  }

  /**
   * Check if tokens are valid
   * @returns {boolean}
   */
  hasValidTokens() {
    return !!this.currentTokens?.access_token;
  }

  /**
   * Get provider information
   * @returns {Object}
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
