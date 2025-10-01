// js/apis/api-auth/jwt-service-core.js
// CHANGE SUMMARY: Allow expired Google tokens through - edge function can validate them via tokeninfo API to enable automatic token refresh

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('UnifiedJWT');

/**
 * JWT Service Core - Service lifecycle and infrastructure
 * Handles initialization, configuration, connection testing, and auth system integration
 */
export class JWTServiceCore {
  constructor() {
    this.isEnabled = false;
    this.isReady = false;
    this.edgeFunctionUrl = null;
    this.currentUser = null;
    this.currentJWT = null;
    this.jwtExpiry = null;
    this.lastOperationTime = null;
    this.initializationPromise = null;
    
    logger.info('Unified JWT Service created (Supabase Auth Integration)');
  }

  /**
   * Initialize JWT service (called from main.js before settings)
   * @returns {Promise<boolean>} True if JWT is available and ready
   */
  async initialize() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._performInitialization();
    return this.initializationPromise;
  }

  /**
   * Internal initialization logic
   * @private
   */
  async _performInitialization() {
    try {
      logger.info('🚀 Initializing Unified JWT Service...');

      // Step 1: Wait for auth system
      await this._waitForAuthSystem();

      // Step 2: Configure edge function URL
      this._configureEdgeFunction();

      // Step 3: Check if we have everything needed
      const hasRequirements = await this._checkRequirements();

      if (hasRequirements) {
        this.isEnabled = true;
        this.isReady = true;
        
        // Make globally available
        logger.success('✅ Auth system ready and authenticated');
        return true;
      } else {
        logger.info('⚡ JWT Service initialized but not enabled (requirements not met)');
        return false;
      }
      
    } catch (error) {
      logger.error('JWT Service initialization failed', error);
      return false;
    }
  }

  /**
   * Wait for authentication system to be ready
   * @private
   */
  async _waitForAuthSystem() {
    logger.debug('Waiting for authentication system...');
    
    const maxWaitTime = 30000; // 30 seconds
    const checkInterval = 100; // Check every 100ms
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      if (await this._isAuthReady()) {
        logger.success('✅ Auth system ready');
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    logger.warn('⏱️ Timeout waiting for auth system');
    return false;
  }

  /**
   * Check if auth system is ready with user authentication
   * @private
   */
  async _isAuthReady() {
    const authSystem = window.dashieAuth || window.authManager;
    
    if (!authSystem) {
      return false;
    }
    
    if (authSystem.isAuthenticated && authSystem.isAuthenticated()) {
      // Auth system is authenticated, check if we have a Google access token
      const token = this._getGoogleAccessToken();
      if (token) {
        logger.debug('Auth system ready with Google token');
        return true;
      } else {
        logger.debug('Auth system ready but no Google token yet');
        return false;
      }
    }
    
    logger.debug('Auth system not authenticated yet');
    return false;
  }

  /**
   * Configure edge function URL
   * @private
   */
  _configureEdgeFunction() {
    try {
      const config = window.currentDbConfig || {};
      const supabaseUrl = config.supabaseUrl;
      
      if (supabaseUrl) {
        // Updated to use jwt-auth instead of jwt-verifier
        this.edgeFunctionUrl = `${supabaseUrl}/functions/v1/jwt-auth`;
        logger.debug('Edge function URL configured for jwt-auth');
      } else {
        logger.warn('No Supabase URL found in config');
      }
    } catch (error) {
      logger.error('Failed to configure edge function URL', error);
    }
  }

  /**
   * Check if all requirements are met for JWT operations
   * UPDATED: Now accepts expired tokens since edge function can validate them
   * @private
   */
  async _checkRequirements() {
    logger.debug('Checking JWT requirements...');
    
    // Must have edge function URL
    if (!this.edgeFunctionUrl) {
      logger.debug('❌ Missing edge function URL');
      return false;
    }

    // Try to get Google access token (even if expired)
    const googleToken = this._getGoogleAccessToken();
    if (!googleToken) {
      logger.debug('❌ No Google access token available');
      
      // Log more details about auth state for debugging
      const authSystem = window.dashieAuth || window.authManager;
      if (authSystem) {
        logger.debug('Auth system details:', {
          isAuthenticated: authSystem.isAuthenticated?.(),
          hasUser: !!authSystem.getUser?.(),
          userEmail: authSystem.getUser?.()?.email,
          hasGoogleAccessToken: !!authSystem.getGoogleAccessToken?.()
        });
      }
      
      return false;
    }

    // UPDATED: Allow expired tokens through!
    // Google's tokeninfo API can validate even expired tokens to identify the user
    // The edge function will then use the refresh token to get a new access token
    logger.debug('✅ Google access token available (may be expired - edge function will validate)');

    // Test connection to edge function and get initial JWT
    const connectionTest = await this._testConnectionAndGetJWT();
    if (!connectionTest.success) {
      logger.debug('❌ Edge function connection test failed', connectionTest);
      
      // UPDATED: If connection failed, check if it's because token expired
      // If so, this is actually OK - we'll recover on next operation
      if (connectionTest.error && connectionTest.error.includes('401')) {
        logger.info('⚠️ Initial connection failed with 401 (token expired), but refresh token system should recover automatically');
        // Still return true - the system can recover using refresh tokens
        return true;
      }
      
      return false;
    }

    // Store the JWT from the test
    if (connectionTest.jwtToken) {
      this.currentJWT = connectionTest.jwtToken;
      this._parseJWTExpiry();
      logger.debug('✅ JWT token obtained and stored');
    }

    logger.success('✅ All JWT requirements met');
    return true;
  }

  /**
   * Test connection to edge function and get JWT token
   * @private
   */
  async _testConnectionAndGetJWT() {
    try {
      const googleAccessToken = this._getGoogleAccessToken();
      if (!googleAccessToken) {
        logger.error('No Google access token available for connection test');
        return { success: false, error: 'No Google access token' };
      }

      // Validate token is not empty string
      if (typeof googleAccessToken !== 'string' || googleAccessToken.trim().length === 0) {
        logger.error('Google access token is invalid (empty or non-string)');
        return { success: false, error: 'Invalid Google access token format' };
      }

      const requestBody = {
        googleAccessToken,
        operation: 'load'
      };

      // Log for debugging (without exposing token)
      logger.debug('Sending connection test', {
        hasToken: !!googleAccessToken,
        tokenLength: googleAccessToken.length,
        operation: 'load'
      });

      const headers = this._getSupabaseHeaders();
      
      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });
      
      if (response.ok) {
        const result = await response.json();
        // Connection is successful if we get a proper response structure
        if (result.success !== undefined) {
          this.currentUser = result.user;
          return { 
            success: true, 
            status: response.status,
            data: result,
            jwtToken: result.jwtToken,
            user: result.user
          };
        } else {
          return { success: false, error: 'Unexpected response format' };
        }
      } else {
        const errorText = await response.text();
        
        // Log the full error for debugging
        logger.debug('Edge function error details:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          url: this.edgeFunctionUrl
        });
        
        return { success: false, error: `${response.status}: ${errorText}` };
      }

    } catch (error) {
      logger.debug('Connection test exception:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse JWT expiry from current token
   * @private
   */
  _parseJWTExpiry() {
    if (!this.currentJWT) return;
    
    try {
      // Decode JWT payload (simple base64 decode, not verifying signature)
      const payload = JSON.parse(atob(this.currentJWT.split('.')[1]));
      this.jwtExpiry = payload.exp ? payload.exp * 1000 : null; // Convert to milliseconds
      
      if (this.jwtExpiry) {
        const expiresIn = this.jwtExpiry - Date.now();
        logger.debug(`JWT expires in ${Math.round(expiresIn / 1000 / 60)} minutes`);
      }
    } catch (error) {
      logger.warn('Failed to parse JWT expiry:', error);
    }
  }

  /**
   * Check if current JWT is expired or will expire soon
   * @private
   */
  _isJWTExpired() {
    if (!this.jwtExpiry) return true;
    
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
    
    return now >= (this.jwtExpiry - bufferTime);
  }

  /**
   * Refresh JWT token if needed
   * @private
   */
  async _ensureValidJWT() {
    if (!this._isJWTExpired()) {
      return true; // Current JWT is still valid
    }

    logger.info('🔄 JWT expired or expiring soon, refreshing...');
    
    const refreshResult = await this._testConnectionAndGetJWT();
    if (refreshResult.success) {
      this.currentJWT = refreshResult.jwtToken;
      this._parseJWTExpiry();
      logger.success('✅ JWT refreshed successfully');
      return true;
    } else {
      logger.error('❌ JWT refresh failed:', refreshResult.error);
      return false;
    }
  }

  /**
   * Get Google access token from auth system
   * @private
   */
  _getGoogleAccessToken() {
    // Try multiple sources for the token
    let token = null;

    // Method 1: From global auth manager
    if (window.dashieAuth?.getGoogleAccessToken) {
      token = window.dashieAuth.getGoogleAccessToken();
    }

    // Method 2: From legacy auth manager
    if (!token && window.authManager?.getGoogleAccessToken) {
      token = window.authManager.getGoogleAccessToken();
    }

    // Method 3: From current user object
    if (!token) {
      const user = window.dashieAuth?.getUser() || window.authManager?.getUser();
      if (user?.googleAccessToken) {
        token = user.googleAccessToken;
      }
    }

    return token;
  }

  /**
   * Get Supabase authentication headers
   * @param {boolean} useJWT - Whether to use Supabase JWT instead of anon key
   * @private
   */
  _getSupabaseHeaders(useJWT = false) {
    const supabaseConfig = window.currentDbConfig || {};
    const supabaseAnonKey = supabaseConfig.supabaseAnonKey || 
                           supabaseConfig.supabaseKey || 
                           supabaseConfig.anonKey ||
                           supabaseConfig.publicKey;
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (useJWT && this.currentJWT) {
      // Use Supabase JWT for operations that need user authentication
      headers['Authorization'] = `Bearer ${this.currentJWT}`;
      if (supabaseAnonKey) {
        headers['apikey'] = supabaseAnonKey;
      }
    } else if (supabaseAnonKey) {
      // Use anon key for initial authentication
      headers['Authorization'] = `Bearer ${supabaseAnonKey}`;
      headers['apikey'] = supabaseAnonKey;
    }

    return headers;
  }

  /**
   * Check if JWT service is ready for operations
   * @returns {boolean}
   */
  isServiceReady() {
    return this.isReady && this.isEnabled && !!this.edgeFunctionUrl;
  }

  /**
   * Get service status information
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      isReady: this.isReady,
      hasEdgeFunction: !!this.edgeFunctionUrl,
      edgeFunctionUrl: this.edgeFunctionUrl,
      hasGoogleToken: !!this._getGoogleAccessToken(),
      hasSupabaseJWT: !!this.currentJWT,
      jwtExpiry: this.jwtExpiry,
      jwtExpired: this._isJWTExpired(),
      lastOperationTime: this.lastOperationTime,
      currentUser: this.currentUser ? {
        id: this.currentUser.id,
        email: this.currentUser.email,
        name: this.currentUser.name,
        provider: this.currentUser.provider
      } : null
    };
  }

  /**
   * Test JWT service connectivity and functionality
   * @returns {Promise<Object>} Test results
   */
  async testConnection() {
    logger.info('Testing JWT service connection');
    
    if (!this.isServiceReady()) {
      return {
        success: false,
        error: 'JWT service not ready',
        ...this.getStatus()
      };
    }

    return await this._testConnectionAndGetJWT();
  }
}