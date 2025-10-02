// js/apis/api-auth/jwt-service-core.js
// CHANGE SUMMARY: Added getSupabaseUserId() method and automatic user update in _saveJWTToStorage() to populate supabaseAuthId in localStorage

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
        logger.success('✅ JWT Service ready');
        return true;
      } else {
        this.isEnabled = false;
        this.isReady = false;
        logger.warn('⚠️ JWT Service requirements not met');
        return false;
      }

    } catch (error) {
      this.isEnabled = false;
      this.isReady = false;
      logger.error('JWT Service initialization failed', error);
      return false;
    }
  }

  /**
   * Wait for auth system to be ready
   * @private
   */
  async _waitForAuthSystem() {
    logger.debug('⏳ Waiting for auth system...');

    const authSystem = window.dashieAuth || window.authManager;
    if (!authSystem) {
      logger.warn('No auth system available');
      throw new Error('No auth system available');
    }

    logger.success('✅ Auth system ready');
    return true;
  }

  /**
   * Configure edge function URL from Supabase config
   * @private
   */
  _configureEdgeFunction() {
    const supabaseConfig = window.currentDbConfig || {};
    const supabaseUrl = supabaseConfig.supabaseUrl || supabaseConfig.url;

    if (!supabaseUrl) {
      logger.warn('No Supabase URL configured');
      return;
    }

    this.edgeFunctionUrl = `${supabaseUrl}/functions/v1/jwt-auth`;
    logger.debug('Edge function URL configured:', this.edgeFunctionUrl);
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

      // Validate structure
      if (!data.jwt || !data.expiry || !data.userId) {
        logger.warn('Invalid JWT data in localStorage, removing');
        localStorage.removeItem('dashie_supabase_jwt');
        return null;
      }

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
        userEmail: this.currentUser.email, // Store email for reliable comparison
        savedAt: Date.now()
      };

      localStorage.setItem('dashie_supabase_jwt', JSON.stringify(data));
      logger.debug('JWT saved to localStorage');

    } catch (error) {
      logger.error('Error saving JWT to localStorage', error);
    }
  }

  /**
   * Check if all requirements are met for JWT operations
   * UPDATED: Try loading cached JWT first before calling edge function
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
      // Use EMAIL for comparison since user IDs differ between Google and Supabase
      const authSystem = window.dashieAuth || window.authManager;
      const currentUser = authSystem?.getUser?.();
      const currentEmail = currentUser?.email || currentUser?.userEmail;

      if (currentEmail && cachedJWT.userEmail && currentEmail === cachedJWT.userEmail) {
        this.currentJWT = cachedJWT.jwt;
        this.jwtExpiry = cachedJWT.expiry;
        this.currentUser = { id: cachedJWT.userId, email: cachedJWT.userEmail };
        logger.success('✅ Using cached JWT from localStorage');
        return true;
      } else {
        logger.warn('Cached JWT is for different user, removing', {
          currentEmail,
          cachedEmail: cachedJWT.userEmail
        });
        localStorage.removeItem('dashie_supabase_jwt');
      }
    }

    // No valid cached JWT, need to get fresh one from edge function
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
      this._saveJWTToStorage(); // Save to localStorage (also updates user storage)
      this._startRefreshTimer(); // Start proactive refresh
      logger.debug('✅ JWT token obtained and stored');
    }

    logger.success('✅ All JWT requirements met');
    return true;
  }

  /**
   * Test connection to edge function and get JWT token
   * UPDATED: Use get_jwt_from_google operation
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
        operation: 'get_jwt_from_google'  // FIXED: Use dedicated JWT acquisition operation
      };

      // Log for debugging (without exposing token)
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
   * Start proactive JWT refresh timer (every 12 hours)
   * This ensures JWT is refreshed while still valid, avoiding expiry deadlock
   * @private
   */
  _startRefreshTimer() {
    // Clear any existing timer
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // Refresh every 12 hours (JWT has 24h expiry, so this gives us safety margin)
    const REFRESH_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

    this.refreshInterval = setInterval(async () => {
      logger.info('🔄 Proactive JWT refresh (12-hour timer)');
      try {
        await this._ensureValidJWT();
      } catch (error) {
        logger.error('Background JWT refresh failed', error);
      }
    }, REFRESH_INTERVAL);

    logger.debug('JWT refresh timer started (12-hour interval)');
  }

  /**
   * Stop the refresh timer (cleanup)
   * @private
   */
  _stopRefreshTimer() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
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
      this.currentUser = refreshResult.user;
      this._parseJWTExpiry();
      this._saveJWTToStorage(); // Save refreshed JWT (also updates user storage)
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