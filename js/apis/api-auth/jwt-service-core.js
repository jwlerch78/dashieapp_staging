// js/apis/api-auth/jwt-service-core.js
// CHANGE SUMMARY: Fixed JWT refresh to call _refreshJWT() directly when < 24hrs, bypassing _ensureValidJWT() expiry check

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
    this.refreshInterval = null; // Proactive refresh timer
    
    logger.info('Unified JWT Service created (Supabase Auth Integration)');
  }

  /**
   * Get Supabase auth user ID
   * This comes from the edge function response after JWT authentication
   * @returns {string|null} Supabase user ID (UUID format)
   */
  getSupabaseUserId() {
    return this.currentUser?.id || null;
  }

  /**
   * Handle JWT failure by triggering auto-logout
   * This ensures the user knows they need to log back in
   * @private
   */
  _handleJWTFailure() {
    logger.error('🚨 JWT refresh failed completely - triggering auto-logout');
    
    // Stop the refresh timer
    this._stopRefreshTimer();
    
    // Clear JWT data
    this.currentJWT = null;
    this.currentUser = null;
    this.jwtExpiry = null;
    localStorage.removeItem('dashie_supabase_jwt');
    
    // Trigger logout through auth system
    try {
      if (window.dashieAuth?.signOut) {
        logger.info('Signing out via dashieAuth');
        window.dashieAuth.signOut();
      } else if (window.authManager?.clearAllData) {
        logger.info('Clearing auth data via authManager');
        window.authManager.clearAllData();
        // Reload page to show login screen
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        // Fallback: just reload the page
        logger.warn('No auth system found, reloading page');
        window.location.reload();
      }
    } catch (error) {
      logger.error('Error during auto-logout', error);
      // Force reload as last resort
      window.location.reload();
    }
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

      if (!hasRequirements) {
        logger.warn('⚠️ JWT requirements not met - service will not be available');
        this.isReady = false;
        this.isEnabled = false;
        return false;
      }

      // Mark as ready
      this.isReady = true;
      this.isEnabled = true;

      logger.success('✅ JWT Service initialized successfully');
      return true;

    } catch (error) {
      logger.error('❌ JWT Service initialization failed', error);
      this.isReady = false;
      this.isEnabled = false;
      return false;
    }
  }

  /**
   * Wait for auth system to be ready
   * @private
   */
  async _waitForAuthSystem() {
    const MAX_WAIT = 30000; // 30 seconds
    const CHECK_INTERVAL = 100; // Check every 100ms
    const startTime = Date.now();

    logger.debug('Waiting for auth system...');

    while (Date.now() - startTime < MAX_WAIT) {
      const authSystem = window.dashieAuth || window.authManager;
      
      if (authSystem && authSystem.isAuthenticated && authSystem.isAuthenticated()) {
        logger.debug('✅ Auth system ready');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
    }

    throw new Error('Auth system not ready after timeout');
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
        this.edgeFunctionUrl = `${supabaseUrl}/functions/v1/jwt-auth`;
        logger.debug('Edge function URL configured', { url: this.edgeFunctionUrl });
      } else {
        logger.warn('No Supabase URL found in config');
      }
    } catch (error) {
      logger.error('Failed to configure edge function URL', error);
    }
  }

  /**
   * Get Supabase headers for API requests
   * @param {boolean} useJWT - If true, use JWT for auth; if false, use anon key
   * @private
   */
  _getSupabaseHeaders(useJWT = false) {
    const config = window.currentDbConfig || {};
    const supabaseAnonKey = config.supabaseKey;
    
    const headers = {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey
    };

    if (useJWT && this.currentJWT) {
      headers['Authorization'] = `Bearer ${this.currentJWT}`;
    } else {
      headers['Authorization'] = `Bearer ${supabaseAnonKey}`;
    }

    return headers;
  }

  /**
   * Check if service is ready for operations
   * @returns {boolean}
   */
  isServiceReady() {
    return this.isReady && this.isEnabled;
  }

  /**
   * Get service status for debugging
   * @returns {Object}
   */
  getStatus() {
    return {
      isReady: this.isReady,
      isEnabled: this.isEnabled,
      hasEdgeFunction: !!this.edgeFunctionUrl,
      hasJWT: !!this.currentJWT,
      hasUser: !!this.currentUser,
      jwtExpiry: this.jwtExpiry,
      jwtExpiresIn: this.jwtExpiry ? Math.round((this.jwtExpiry - Date.now()) / 1000 / 60) + ' minutes' : null,
      hasGoogleToken: !!this._getGoogleAccessToken(),
      lastOperation: this.lastOperationTime
    };
  }

  /**
   * Load JWT from localStorage
   * @private
   */
  _loadJWTFromStorage() {
    try {
      const stored = localStorage.getItem('dashie_supabase_jwt');
      if (!stored) return null;

      const data = JSON.parse(stored);
      
      // Check if expired
      if (Date.now() >= data.expiry) {
        logger.debug('Stored JWT is expired, removing');
        localStorage.removeItem('dashie_supabase_jwt');
        return null;
      }

      logger.debug('Valid JWT found in localStorage');
      return data;
    } catch (error) {
      logger.error('Error loading JWT from localStorage', error);
      localStorage.removeItem('dashie_supabase_jwt');
      return null;
    }
  }

  /**
   * Save JWT to localStorage
   * @private
   */
  _saveJWTToStorage() {
    try {
      if (!this.currentJWT || !this.jwtExpiry || !this.currentUser) {
        logger.warn('Cannot save JWT - missing required data');
        return;
      }

      const data = {
        jwt: this.currentJWT,
        expiry: this.jwtExpiry,
        userId: this.currentUser.id,
        userEmail: this.currentUser.email,
        savedAt: Date.now()
      };

      localStorage.setItem('dashie_supabase_jwt', JSON.stringify(data));
      logger.debug('JWT saved to localStorage');

      // Also update user storage with Supabase auth ID
      try {
        const authStorage = window.authManager || window.dashieAuth;
        if (authStorage && authStorage.currentUser) {
          authStorage.currentUser.supabaseAuthId = this.currentUser.id;
          authStorage.saveUser(authStorage.currentUser);
          logger.debug('Updated user storage with Supabase auth ID');
        }
      } catch (error) {
        logger.debug('Could not update user storage (non-critical)', error);
      }

    } catch (error) {
      logger.error('Error saving JWT to localStorage', error);
    }
  }

  /**
   * Check if all requirements are met for JWT operations
   * @private
   */
  async _checkRequirements() {
    logger.debug('Checking JWT requirements...');

    // Must have edge function URL
    if (!this.edgeFunctionUrl) {
      logger.debug('❌ Missing edge function URL');
      return false;
    }

    // Try loading cached JWT first
    const cachedJWT = this._loadJWTFromStorage();
    if (cachedJWT) {
      // Validate the cached JWT is for the current user
      const authSystem = window.dashieAuth || window.authManager;
      const currentUser = authSystem?.getUser?.();
      
      if (currentUser && currentUser.email === cachedJWT.userEmail) {
        logger.info('✅ Using cached JWT token', {
          expiresIn: Math.round((cachedJWT.expiry - Date.now()) / 1000 / 60) + ' minutes'
        });
        
        this.currentJWT = cachedJWT.jwt;
        this.jwtExpiry = cachedJWT.expiry;
        this.currentUser = {
          id: cachedJWT.userId,
          email: cachedJWT.userEmail
        };
        
        await this._startRefreshTimer();
        return true;
      } else {
        logger.debug('Cached JWT is for different user, obtaining new token');
      }
    }

    // Must have Google access token
    const googleAccessToken = this._getGoogleAccessToken();
    if (!googleAccessToken) {
      logger.debug('❌ No Google access token available');
      
      const authSystem = window.dashieAuth || window.authManager;
      if (authSystem) {
        logger.debug('Auth system state:', {
          isAuthenticated: authSystem.isAuthenticated?.(),
          hasUser: !!authSystem.getUser?.(),
          userEmail: authSystem.getUser?.()?.email,
          hasGoogleAccessToken: !!authSystem.getGoogleAccessToken?.()
        });
      }

      return false;
    }

    logger.debug('✅ Google access token available');

    // Test connection to edge function and get initial JWT
    const connectionTest = await this._testConnectionAndGetJWT();
    if (!connectionTest.success) {
      logger.debug('❌ Edge function connection test failed', connectionTest);

      // If connection failed with 401, might be recoverable with refresh
      if (connectionTest.error && connectionTest.error.includes('401')) {
        logger.info('⚠️ Initial connection failed with 401 (token expired), but refresh token system should recover automatically');
        return true;
      }

      return false;
    }

    // Store the JWT from the test
    if (connectionTest.jwtToken) {
      this.currentJWT = connectionTest.jwtToken;
      this.currentUser = connectionTest.user;
      this._parseJWTExpiry();
      this._saveJWTToStorage();
      await this._startRefreshTimer();
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

      if (typeof googleAccessToken !== 'string' || googleAccessToken.trim().length === 0) {
        logger.error('Google access token is invalid (empty or non-string)');
        return { success: false, error: 'Invalid Google access token format' };
      }

      const requestBody = {
        googleAccessToken,
        operation: 'get_jwt_from_google'
      };

      logger.debug('Sending connection test', {
        hasToken: !!googleAccessToken,
        tokenLength: googleAccessToken.length,
        operation: 'get_jwt_from_google'
      });

      const headers = this._getSupabaseHeaders();

      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const result = await response.json();
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
      const payload = JSON.parse(atob(this.currentJWT.split('.')[1]));
      this.jwtExpiry = payload.exp ? payload.exp * 1000 : null;

      if (this.jwtExpiry) {
        const expiresIn = this.jwtExpiry - Date.now();
        logger.debug(`JWT expires in ${Math.round(expiresIn / 1000 / 60)} minutes`);
      }
    } catch (error) {
      logger.warn('Failed to parse JWT expiry:', error);
    }
  }

  /**
   * Start proactive JWT refresh timer
   * Refreshes when JWT reaches 24 hours remaining (not a fixed interval)
   * If already less than 24 hours, refreshes immediately
   * NOTE: JWT has 72h expiry on server side
   * CRITICAL FIX: Now calls _refreshJWT() directly when < 24hrs, bypassing expiry check
   * @private
   */
  async _startRefreshTimer() {
    // Clear any existing timer
    if (this.refreshInterval) {
      clearTimeout(this.refreshInterval);
      this.refreshInterval = null;
    }

    if (!this.jwtExpiry) {
      logger.warn('Cannot start refresh timer: no JWT expiry time available');
      return;
    }

    const now = Date.now();
    const timeUntilExpiry = this.jwtExpiry - now;
    const REFRESH_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours

    const timeUntilRefresh = timeUntilExpiry - REFRESH_THRESHOLD;

    if (timeUntilRefresh <= 0) {
      // Less than 24 hours - refresh immediately
      logger.info('🔄 JWT has less than 24 hours remaining, refreshing now...');
      
      // CRITICAL FIX: Call _refreshJWT() directly, NOT _ensureValidJWT()
      // _ensureValidJWT() checks 60min buffer and would skip refresh
      try {
        const refreshResult = await this._refreshJWT();
        if (refreshResult.success) {
          this.currentJWT = refreshResult.jwtToken;
          this.currentUser = refreshResult.user;
          this._parseJWTExpiry();
          this._saveJWTToStorage();
          await this._startRefreshTimer();
          logger.success('✅ JWT refreshed successfully during initialization');
        } else {
          logger.error('❌ JWT refresh failed:', refreshResult.error);
          this.refreshInterval = setTimeout(async () => {
            logger.info('🔄 Retrying JWT refresh after failure');
            await this._startRefreshTimer();
          }, 5 * 60 * 1000);
        }
      } catch (error) {
        logger.error('Immediate JWT refresh failed', error);
        this.refreshInterval = setTimeout(async () => {
          await this._startRefreshTimer();
        }, 5 * 60 * 1000);
      }
      
      return;
    }

    // Schedule refresh at 24-hour threshold
    this.refreshInterval = setTimeout(async () => {
      logger.info('🔄 Proactive JWT refresh (reached 24-hour threshold)');
      try {
        const refreshResult = await this._refreshJWT();
        if (refreshResult.success) {
          this.currentJWT = refreshResult.jwtToken;
          this.currentUser = refreshResult.user;
          this._parseJWTExpiry();
          this._saveJWTToStorage();
          await this._startRefreshTimer();
          logger.success('✅ JWT refreshed successfully');
        }
      } catch (error) {
        logger.error('Background JWT refresh failed', error);
      }
    }, timeUntilRefresh);

    const refreshTime = new Date(now + timeUntilRefresh);
    logger.debug('JWT refresh timer started', {
      expiresIn: Math.round(timeUntilExpiry / 1000 / 60 / 60) + ' hours',
      refreshIn: Math.round(timeUntilRefresh / 1000 / 60 / 60) + ' hours',
      refreshAt: refreshTime.toLocaleString()
    });
  }

  /**
   * Force JWT refresh (bypasses expiry check)
   * Used when we want to refresh even if token isn't technically expired yet
   * @private
   */
  async _forceRefreshJWT() {
    logger.info('🔄 Force refreshing JWT...');

    const refreshResult = await this._testConnectionAndGetJWT();
    if (refreshResult.success) {
      this.currentJWT = refreshResult.jwtToken;
      this.currentUser = refreshResult.user;
      this._parseJWTExpiry();
      this._saveJWTToStorage();
      await this._startRefreshTimer();
      logger.success('✅ JWT force refresh successful');
      return true;
    } else {
      logger.error('❌ JWT force refresh failed:', refreshResult.error);
      this._handleJWTFailure();
      return false;
    }
  }

  /**
   * Stop the refresh timer (cleanup)
   * @private
   */
  _stopRefreshTimer() {
    if (this.refreshInterval) {
      clearTimeout(this.refreshInterval);
      this.refreshInterval = null;
      logger.debug('JWT refresh timer stopped');
    }
  } 

  /**
   * Check if current JWT is expired or will expire soon
   * @private
   */
  _isJWTExpired() {
    if (!this.jwtExpiry) return true;

    const now = Date.now();
    const bufferTime = 60 * 60 * 1000; // 60 minutes buffer

    return now >= (this.jwtExpiry - bufferTime);
  }

  /**
   * Refresh JWT token if needed
   * CRITICAL FIX: Now restarts the refresh timer after successful refresh
   * CRITICAL FIX: Triggers auto-logout on failure
   * @private
   */
  async _ensureValidJWT() {
    if (!this._isJWTExpired()) {
      return true;
    }

    logger.info('🔄 JWT expired or expiring soon, refreshing...');

    const refreshResult = await this._refreshJWT();
    if (refreshResult.success) {
      this.currentJWT = refreshResult.jwtToken;
      this.currentUser = refreshResult.user;
      this._parseJWTExpiry();
      this._saveJWTToStorage();
      
      // Restart the refresh timer with the new JWT expiry
      await this._startRefreshTimer();
      
      logger.success('✅ JWT refreshed successfully');
      return true;
    } else {
      logger.error('❌ JWT refresh failed:', refreshResult.error);
      this._handleJWTFailure();
      return false;
    }
  }

  /**
   * Refresh JWT using current JWT (no Google token required)
   * @private
   */
  async _refreshJWT() {
    logger.info('🔄 Refreshing JWT using current JWT...');
    
    if (!this.currentJWT) {
      logger.error('Cannot refresh JWT: no current JWT available');
      return { success: false, error: 'No current JWT' };
    }

    try {
      const requestBody = {
        operation: 'refresh_jwt'
      };

      // Use current JWT in Authorization header
      const headers = this._getSupabaseHeaders(true);

      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.jwtToken) {
          return {
            success: true,
            jwtToken: result.jwtToken,
            user: result.user
          };
        }
      }

      const errorText = await response.text();
      return { success: false, error: `${response.status}: ${errorText}` };

    } catch (error) {
      logger.error('JWT refresh failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get Google access token from auth system
   * @private
   */
  _getGoogleAccessToken() {
    let token = null;

    // Method 1: From global auth manager
    if (window.dashieAuth?.getGoogleAccessToken) {
      token = window.dashieAuth.getGoogleAccessToken();
    }

    // Method 2: From legacy auth manager
    if (!token && window.authManager?.getGoogleAccessToken) {
      token = window.authManager.getGoogleAccessToken();
    }

    return token;
  }

  /**
   * Get current Supabase JWT for operations
   * @returns {string|null} Current JWT token
   */
  getSupabaseJWT() {
    return this.currentJWT;
  }
}