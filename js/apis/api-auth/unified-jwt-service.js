// js/apis/api-auth/unified-jwt-service.js
// CHANGE SUMMARY: Unified JWT service replacing Phase 1/2/3 complexity - single service with smart initialization

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('UnifiedJWT');

/**
 * Unified JWT Authentication Service
 * Replaces all Phase 1/2/3 complexity with a single, robust service
 */
export class UnifiedJWTService {
  constructor() {
    this.isEnabled = false;
    this.isReady = false;
    this.edgeFunctionUrl = null;
    this.currentUser = null;
    this.lastOperationTime = null;
    this.initializationPromise = null;
    
    logger.info('Unified JWT Service created');
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
        
        // Make globally available BEFORE logging success
        window.jwtAuth = this;
        
        logger.success('✅ JWT Service ready and enabled');
        logger.debug('JWT Service exposed at window.jwtAuth');
        return true;
      } else {
        logger.info('⚡ JWT Service initialized but not enabled (requirements not met)');
        
        // Still expose for debugging, but mark as not ready
        window.jwtAuth = this;
        logger.debug('JWT Service exposed at window.jwtAuth (not ready)');
        return false;
      }

    } catch (error) {
      logger.error('❌ JWT Service initialization failed', error);
      return false;
    }
  }

  /**
   * Wait for auth system to be available AND authenticated
   * @private
   */
  async _waitForAuthSystem() {
    const maxWait = 15000; // 15 seconds max (increased for OAuth flow)
    const checkInterval = 200; // Check every 200ms
    const startTime = Date.now();

    logger.debug('Waiting for auth system and authentication...');

    while (Date.now() - startTime < maxWait) {
      if (this._isAuthSystemReady()) {
        logger.success('Auth system ready and authenticated');
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    logger.warn('Auth system not fully ready within timeout, proceeding anyway');
  }

  /**
   * Check if auth system is ready AND user is authenticated
   * @private
   */
  _isAuthSystemReady() {
    const authSystem = window.dashieAuth || window.authManager;
    
    if (!authSystem) return false;
    
    // CRITICAL: Must be both initialized AND authenticated
    if (authSystem.isAuthenticated && authSystem.isAuthenticated()) {
      // Also verify we can get a Google access token
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
        this.edgeFunctionUrl = `${supabaseUrl}/functions/v1/jwt-verifier`;
        logger.debug('Edge function URL configured');
      } else {
        logger.warn('No Supabase URL found in config');
      }
    } catch (error) {
      logger.error('Failed to configure edge function URL', error);
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

    // Must have Google access token
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

    // Test connection to edge function
    const connectionTest = await this._testConnection();
    if (!connectionTest.success) {
      logger.debug('❌ Edge function connection test failed', connectionTest);
      return false;
    }

    logger.success('✅ All JWT requirements met');
    return true;
  }

  /**
   * Test connection to edge function
   * @private
   */
  async _testConnection() {
    try {
      const googleAccessToken = this._getGoogleAccessToken();
      if (!googleAccessToken) {
        return { success: false, error: 'No Google access token' };
      }

      // Get the actual user email for testing instead of a fake one
      const authSystem = window.dashieAuth || window.authManager;
      const user = authSystem?.getUser?.();
      const testEmail = user?.email || 'connection-test@example.com';

      const requestBody = {
        googleAccessToken,
        operation: 'load',
        userEmail: testEmail
      };

      const headers = this._getSupabaseHeaders();
      
      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const result = await response.json();
        // Connection is successful if we get a proper response structure
        // even if no settings are found (that's normal for new users)
        if (result.success !== undefined) {
          return { 
            success: true, 
            status: response.status,
            data: result
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
   * @private
   */
  _getSupabaseHeaders() {
    const supabaseConfig = window.currentDbConfig || {};
    const supabaseAnonKey = supabaseConfig.supabaseAnonKey || 
                           supabaseConfig.supabaseKey || 
                           supabaseConfig.anonKey ||
                           supabaseConfig.publicKey;
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (supabaseAnonKey) {
      headers['Authorization'] = `Bearer ${supabaseAnonKey}`;
      headers['apikey'] = supabaseAnonKey;
    }

    return headers;
  }

  // ====== PUBLIC API METHODS ======

  /**
   * Check if JWT service is ready for operations
   * @returns {boolean}
   */
  isServiceReady() {
    return this.isReady && this.isEnabled && !!this.edgeFunctionUrl;
  }

  /**
   * Load user settings via JWT-verified edge function
   * @param {string} userEmail - User email for loading settings
   * @returns {Promise<Object|null>} User settings or null if not found
   */
  async loadSettings(userEmail) {
    if (!this.isServiceReady()) {
      throw new Error('JWT service not ready for load operation');
    }

    const timer = logger.startTimer('JWT Load Settings');
    
    logger.info('Loading settings via JWT', { userEmail });

    try {
      const googleAccessToken = this._getGoogleAccessToken();
      if (!googleAccessToken) {
        throw new Error('No Google access token available');
      }

      const requestBody = {
        googleAccessToken,
        operation: 'load',
        userEmail
      };

      const headers = this._getSupabaseHeaders();

      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      const duration = timer();

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JWT load failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      logger.success('JWT settings loaded', {
        success: result.success,
        hasSettings: !!result.settings,
        duration
      });

      this.lastOperationTime = Date.now();
      this.currentUser = result.user;

      return result.settings;

    } catch (error) {
      timer();
      logger.error('JWT settings load failed', error);
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
    if (!this.isServiceReady()) {
      throw new Error('JWT service not ready for save operation');
    }

    const timer = logger.startTimer('JWT Save Settings');
    
    logger.info('Saving settings via JWT', {
      userEmail,
      settingsKeys: settings ? Object.keys(settings) : []
    });

    try {
      const googleAccessToken = this._getGoogleAccessToken();
      if (!googleAccessToken) {
        throw new Error('No Google access token available');
      }

      const requestBody = {
        googleAccessToken,
        operation: 'save',
        data: settings,
        userEmail
      };

      const headers = this._getSupabaseHeaders();

      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      const duration = timer();

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JWT save failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      logger.success('JWT settings saved', {
        success: result.success,
        saved: result.saved,
        duration
      });

      this.lastOperationTime = Date.now();
      this.currentUser = result.user;

      return result.saved === true;

    } catch (error) {
      timer();
      logger.error('JWT settings save failed', error);
      throw error;
    }
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
      lastOperationTime: this.lastOperationTime,
      currentUser: this.currentUser ? {
        id: this.currentUser.id,
        email: this.currentUser.email,
        name: this.currentUser.name
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

    return await this._testConnection();
  }
}

// Create and export singleton instance
export const unifiedJWTService = new UnifiedJWTService();

// Initialize JWT service when module loads
export async function initializeJWTService() {
  logger.info('Initializing JWT service from module');
  return await unifiedJWTService.initialize();
}

export default unifiedJWTService;