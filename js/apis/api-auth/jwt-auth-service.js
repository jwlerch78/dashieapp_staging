// js/apis/api-auth/jwt-auth-service.js
// CHANGE SUMMARY: Added Supabase authentication headers for edge function access - fixes 401 authorization errors

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('JWTAuthService');

/**
 * JWT Authentication Service for Supabase RLS
 * Handles communication with the jwt-verifier edge function
 */
export class JWTAuthService {
  constructor() {
    this.isEnabled = false; // Start disabled for Phase 1 testing
    this.edgeFunctionUrl = null;
    this.currentUser = null;
    this.lastOperationTime = null;
    
    this.initializeEdgeFunctionUrl();
    
    logger.info('JWT Auth Service initialized', {
      enabled: this.isEnabled,
      edgeFunctionUrl: this.edgeFunctionUrl ? 'configured' : 'missing'
    });
  }

  /**
   * Initialize edge function URL based on environment
   */
  initializeEdgeFunctionUrl() {
    try {
      // Get current environment config
      const config = window.currentDbConfig || {};
      const supabaseUrl = config.supabaseUrl;
      
      if (supabaseUrl) {
        this.edgeFunctionUrl = `${supabaseUrl}/functions/v1/jwt-verifier`;
        logger.debug('Edge function URL configured', {
          supabaseUrl: supabaseUrl.substring(0, 30) + '...',
          edgeFunctionUrl: this.edgeFunctionUrl
        });
      } else {
        logger.warn('No Supabase URL found in config, edge function unavailable');
      }
    } catch (error) {
      logger.error('Failed to initialize edge function URL', error);
    }
  }

  /**
   * Enable JWT mode (for testing)
   * @param {boolean} enabled - Whether to enable JWT mode
   */
  setEnabled(enabled) {
    const wasEnabled = this.isEnabled;
    this.isEnabled = enabled;
    
    logger.info('JWT mode toggled', {
      wasEnabled,
      nowEnabled: enabled,
      edgeFunctionAvailable: !!this.edgeFunctionUrl
    });
    
    if (enabled && !this.edgeFunctionUrl) {
      logger.error('JWT mode enabled but edge function URL not available');
      throw new Error('Cannot enable JWT mode: edge function URL not configured');
    }
  }

  /**
   * Check if JWT service is ready to use
   * @returns {boolean} True if JWT service can be used
   */
  isReady() {
    const ready = this.isEnabled && !!this.edgeFunctionUrl;
    
    logger.debug('JWT readiness check', {
      enabled: this.isEnabled,
      hasEdgeFunction: !!this.edgeFunctionUrl,
      ready
    });
    
    return ready;
  }

  /**
   * Get Google access token from current auth system
   * @returns {string|null} Google access token
   */
  getGoogleAccessToken() {
    logger.debug('Retrieving Google access token for JWT operation');
    
    // Try multiple sources for the token
    let token = null;
    let source = 'none';

    // Method 1: From global auth manager
    if (window.dashieAuth?.getGoogleAccessToken) {
      token = window.dashieAuth.getGoogleAccessToken();
      source = 'dashieAuth';
    }

    // Method 2: From legacy auth manager
    if (!token && window.authManager?.getGoogleAccessToken) {
      token = window.authManager.getGoogleAccessToken();
      source = 'authManager';
    }

    // Method 3: From current user object
    if (!token) {
      const user = window.dashieAuth?.getUser() || window.authManager?.getUser();
      if (user?.googleAccessToken) {
        token = user.googleAccessToken;
        source = 'userObject';
      }
    }

    logger.debug('Google access token retrieval result', {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      tokenPreview: token ? token.substring(0, 20) + '...' : null,
      source
    });

    if (!token) {
      logger.warn('No Google access token available for JWT operation');
    }

    return token;
  }

  /**
   * Get Supabase authentication headers
   * @returns {Object} Headers object with auth
   */
  getSupabaseHeaders() {
    const supabaseConfig = window.currentDbConfig || {};
    // Try different possible key names
    const supabaseAnonKey = supabaseConfig.supabaseAnonKey || 
                           supabaseConfig.supabaseKey || 
                           supabaseConfig.anonKey ||
                           supabaseConfig.publicKey;
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add Supabase auth header if available
    if (supabaseAnonKey) {
      headers['Authorization'] = `Bearer ${supabaseAnonKey}`;
      headers['apikey'] = supabaseAnonKey;
    }

    logger.debug('Supabase headers configured', {
      hasContentType: !!headers['Content-Type'],
      hasAuth: !!headers['Authorization'],
      hasApiKey: !!headers['apikey'],
      anonKeyLength: supabaseAnonKey ? supabaseAnonKey.length : 0,
      keySource: supabaseAnonKey ? (
        supabaseConfig.supabaseAnonKey ? 'supabaseAnonKey' :
        supabaseConfig.supabaseKey ? 'supabaseKey' :
        supabaseConfig.anonKey ? 'anonKey' : 'publicKey'
      ) : 'none'
    });

    return headers;
  }

  /**
   * Load user settings via JWT-verified edge function
   * @param {string} userEmail - User email for loading settings
   * @returns {Promise<Object|null>} User settings or null if not found
   */
  async loadSettings(userEmail) {
    if (!this.isReady()) {
      logger.warn('JWT service not ready for load operation', {
        enabled: this.isEnabled,
        hasEdgeFunction: !!this.edgeFunctionUrl
      });
      throw new Error('JWT service not ready');
    }

    const timer = logger.startTimer('JWT Load Settings');
    
    logger.info('Starting JWT settings load', {
      userEmail,
      edgeFunctionUrl: this.edgeFunctionUrl
    });

    try {
      const googleAccessToken = this.getGoogleAccessToken();
      
      if (!googleAccessToken) {
        throw new Error('No Google access token available for JWT verification');
      }

      const requestBody = {
        googleAccessToken,
        operation: 'load',
        userEmail
      };

      const headers = this.getSupabaseHeaders();

      logger.debug('Making JWT edge function request', {
        operation: 'load',
        userEmail,
        hasToken: !!googleAccessToken,
        tokenLength: googleAccessToken.length,
        headers: Object.keys(headers)
      });

      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      const duration = timer();

      logger.debug('JWT edge function response received', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        duration
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('JWT edge function request failed', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          duration
        });
        throw new Error(`JWT edge function error: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      logger.success('JWT settings load completed', {
        success: result.success,
        hasSettings: !!result.settings,
        userVerified: !!result.user,
        rlsEnabled: result.rlsEnabled,
        duration
      });

      this.lastOperationTime = Date.now();
      this.currentUser = result.user;

      // Log user verification details
      if (result.user) {
        logger.debug('JWT user verification details', {
          userId: result.user.id,
          userEmail: result.user.email,
          userName: result.user.name,
          hasPicture: !!result.user.picture
        });
      }

      return result.settings;

    } catch (error) {
      timer();
      logger.error('JWT settings load failed', {
        userEmail,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Save user settings via JWT-verified edge function
   * @param {string} userEmail - User email
   * @param {Object} settings - Settings data to save
   * @returns {Promise<boolean>} True if save was successful
   */
  async saveSettings(userEmail, settings) {
    if (!this.isReady()) {
      logger.warn('JWT service not ready for save operation', {
        enabled: this.isEnabled,
        hasEdgeFunction: !!this.edgeFunctionUrl
      });
      throw new Error('JWT service not ready');
    }

    const timer = logger.startTimer('JWT Save Settings');
    
    logger.info('Starting JWT settings save', {
      userEmail,
      settingsKeys: settings ? Object.keys(settings) : [],
      settingsSize: settings ? JSON.stringify(settings).length : 0
    });

    try {
      const googleAccessToken = this.getGoogleAccessToken();
      
      if (!googleAccessToken) {
        throw new Error('No Google access token available for JWT verification');
      }

      const requestBody = {
        googleAccessToken,
        operation: 'save',
        data: settings,
        userEmail
      };

      const headers = this.getSupabaseHeaders();

      logger.debug('Making JWT edge function request', {
        operation: 'save',
        userEmail,
        hasToken: !!googleAccessToken,
        tokenLength: googleAccessToken.length,
        dataKeys: settings ? Object.keys(settings) : [],
        headers: Object.keys(headers)
      });

      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      const duration = timer();

      logger.debug('JWT edge function response received', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        duration
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('JWT edge function request failed', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          duration
        });
        throw new Error(`JWT edge function error: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      logger.success('JWT settings save completed', {
        success: result.success,
        saved: result.saved,
        userVerified: !!result.user,
        rlsEnabled: result.rlsEnabled,
        duration
      });

      this.lastOperationTime = Date.now();
      this.currentUser = result.user;

      return result.saved === true;

    } catch (error) {
      timer();
      logger.error('JWT settings save failed', {
        userEmail,
        settingsKeys: settings ? Object.keys(settings) : [],
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Test JWT service connectivity and functionality
   * @returns {Promise<Object>} Test results
   */
  async testConnection() {
    logger.info('Starting JWT service connection test');
    
    if (!this.isReady()) {
      const result = {
        success: false,
        error: 'JWT service not ready',
        enabled: this.isEnabled,
        hasEdgeFunction: !!this.edgeFunctionUrl
      };
      
      logger.warn('JWT connection test failed - service not ready', result);
      return result;
    }

    try {
      const googleAccessToken = this.getGoogleAccessToken();
      
      if (!googleAccessToken) {
        const result = {
          success: false,
          error: 'No Google access token available',
          enabled: this.isEnabled,
          hasEdgeFunction: !!this.edgeFunctionUrl
        };
        
        logger.warn('JWT connection test failed - no token', result);
        return result;
      }

      // Test with a simple load operation
      const testEmail = 'test-connection@example.com';
      
      logger.debug('Testing JWT connection with load operation', {
        testEmail,
        edgeFunctionUrl: this.edgeFunctionUrl
      });

      const requestBody = {
        googleAccessToken,
        operation: 'load',
        userEmail: testEmail
      };

      const headers = this.getSupabaseHeaders();
      const timer = logger.startTimer('JWT Connection Test');
      
      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      const duration = timer();

      const result = {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        duration,
        enabled: this.isEnabled,
        hasEdgeFunction: !!this.edgeFunctionUrl
      };

      if (response.ok) {
        const data = await response.json();
        result.data = data;
        result.rlsEnabled = data.rlsEnabled;
        result.userVerified = !!data.user;
        
        logger.success('JWT connection test passed', result);
      } else {
        const errorText = await response.text();
        result.error = errorText;
        
        logger.error('JWT connection test failed', result);
      }

      return result;

    } catch (error) {
      const result = {
        success: false,
        error: error.message,
        enabled: this.isEnabled,
        hasEdgeFunction: !!this.edgeFunctionUrl
      };
      
      logger.error('JWT connection test exception', {
        ...result,
        stack: error.stack
      });
      
      return result;
    }
  }

  /**
   * Get service status information
   * @returns {Object} Status information
   */
  getStatus() {
    const status = {
      enabled: this.isEnabled,
      ready: this.isReady(),
      hasEdgeFunction: !!this.edgeFunctionUrl,
      edgeFunctionUrl: this.edgeFunctionUrl,
      currentUser: this.currentUser,
      lastOperationTime: this.lastOperationTime,
      hasGoogleToken: !!this.getGoogleAccessToken(),
      hasSupabaseAuth: !!(window.currentDbConfig?.supabaseKey || window.currentDbConfig?.supabaseAnonKey)
    };

    logger.debug('JWT service status', status);
    
    return status;
  }

  /**
   * Enable debug mode with enhanced logging
   */
  enableDebugMode() {
    logger.info('JWT debug mode enabled - enhanced logging active');
    
    // Could add additional debug features here
    this.debugMode = true;
  }

  /**
   * Disable debug mode
   */
  disableDebugMode() {
    logger.info('JWT debug mode disabled');
    this.debugMode = false;
  }
}