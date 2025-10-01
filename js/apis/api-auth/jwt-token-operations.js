// js/apis/api-auth/jwt-token-operations.js
// CHANGE SUMMARY: Removed automatic Supabase authentication - Supabase client should use RLS with our JWT in headers, not auth.setSession()

import { JWTServiceCore } from './jwt-service-core.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('UnifiedJWT');

/**
 * JWT Token Operations - Extends core service with all token management
 * Handles settings, multi-account tokens, refresh tokens, and all edge function operations
 */
export class JWTTokenOperations extends JWTServiceCore {
  
  /**
   * NOTE: We do NOT authenticate the Supabase client with auth.setSession()
   * because that expects Supabase's own auth JWT format.
   * Instead, our custom JWT should be passed in headers for RLS verification.
   */

  // ====== MULTI-ACCOUNT TOKEN MANAGEMENT METHODS ======

  /**
   * Store OAuth tokens for multi-account support
   */
  async storeTokens(provider = 'google', accountType = 'personal', tokenData) {
    if (!this.isServiceReady()) {
      throw new Error('JWT service not ready for store tokens operation');
    }

    const timer = logger.startTimer('JWT Store Tokens');
    
    try {
      if (!tokenData?.access_token || !tokenData?.refresh_token) {
        throw new Error('Missing required token data: access_token and refresh_token are required');
      }

      await this._ensureValidJWT();
      const googleAccessToken = this._getGoogleAccessToken();
      if (!googleAccessToken) {
        throw new Error('No Google access token available');
      }

      const requestBody = {
        googleAccessToken,
        operation: 'store_tokens',
        data: tokenData,
        provider,
        account_type: accountType
      };

      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: this._getSupabaseHeaders(),
        body: JSON.stringify(requestBody)
      });

      const duration = timer();

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JWT store tokens failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      logger.success('JWT tokens stored', {
        success: result.success,
        provider,
        accountType,
        duration
      });

      this.lastOperationTime = Date.now();

      return result;

    } catch (error) {
      timer();
      logger.error('JWT store tokens failed', error);
      throw error;
    }
  }

  /**
   * Get valid OAuth token (refresh if needed)
   */
  async getValidToken(provider = 'google', accountType = 'personal') {
    if (!this.isServiceReady()) {
      throw new Error('JWT service not ready for get token operation');
    }

    const timer = logger.startTimer('JWT Get Valid Token');
    
    try {
      await this._ensureValidJWT();
      const googleAccessToken = this._getGoogleAccessToken();
      if (!googleAccessToken) {
        throw new Error('No Google access token available');
      }

      const requestBody = {
        googleAccessToken,
        operation: 'get_valid_token',
        provider,
        account_type: accountType
      };

      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: this._getSupabaseHeaders(),
        body: JSON.stringify(requestBody)
      });

      const duration = timer();

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JWT get token failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      logger.success('JWT token retrieved/refreshed', {
        success: result.success,
        refreshed: result.refreshed,
        provider,
        accountType,
        duration
      });

      this.lastOperationTime = Date.now();

      return result;

    } catch (error) {
      timer();
      logger.error('JWT get token failed', error);
      throw error;
    }
  }

  /**
   * Delete refresh token from secure storage
   */
  async deleteRefreshToken(provider = 'google', accountType = 'personal') {
    if (!this.isServiceReady()) {
      throw new Error('JWT service not ready for delete token operation');
    }

    const timer = logger.startTimer('JWT Delete Refresh Token');
    
    try {
      await this._ensureValidJWT();
      const googleAccessToken = this._getGoogleAccessToken();
      if (!googleAccessToken) {
        throw new Error('No Google access token available');
      }

      const requestBody = {
        googleAccessToken,
        operation: 'delete_refresh_token',
        provider,
        account_type: accountType
      };

      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: this._getSupabaseHeaders(),
        body: JSON.stringify(requestBody)
      });

      const duration = timer();

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JWT delete token failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      logger.success('JWT refresh token deleted', {
        success: result.success,
        duration
      });

      this.lastOperationTime = Date.now();

      return result;

    } catch (error) {
      timer();
      logger.error('JWT refresh token failed', error);
      throw error;
    }
  }

  /**
   * Get current Supabase JWT token (refreshes if needed)
   */
  async getSupabaseJWT() {
    if (!this.isServiceReady()) {
      throw new Error('JWT service not ready');
    }

    const isValid = await this._ensureValidJWT();
    if (!isValid) {
      throw new Error('Unable to obtain valid JWT token');
    }

    return this.currentJWT;
  }

  /**
   * Load user settings via JWT-verified edge function
   * @param {string} userEmail - User email for loading settings (kept for compatibility)
   * @returns {Promise<Object|null>} User settings or null if not found
   */
  async loadSettings(userEmail) {
    if (!this.isServiceReady()) {
      throw new Error('JWT service not ready for load operation');
    }

    const timer = logger.startTimer('JWT Load Settings');
    
    logger.info('Loading settings via JWT', { userEmail });

    try {
      // Ensure we have a valid JWT
      await this._ensureValidJWT();

      const googleAccessToken = this._getGoogleAccessToken();
      if (!googleAccessToken) {
        throw new Error('No Google access token available');
      }

      const requestBody = {
        googleAccessToken,
        operation: 'load'
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

      return result;

    } catch (error) {
      timer();
      logger.error('JWT load failed', error);
      throw error;
    }
  }

  /**
   * Save user settings via JWT-verified edge function
   * @param {Object} settings - Settings object to save
   * @returns {Promise<Object>} Result with success status
   */
  async saveSettings(settings) {
    if (!this.isServiceReady()) {
      throw new Error('JWT service not ready for save operation');
    }

    const timer = logger.startTimer('JWT Save Settings');
    
    logger.info('Saving settings via JWT');

    try {
      // Ensure we have a valid JWT
      await this._ensureValidJWT();

      const googleAccessToken = this._getGoogleAccessToken();
      if (!googleAccessToken) {
        throw new Error('No Google access token available');
      }

      const requestBody = {
        googleAccessToken,
        operation: 'save',
        settings: settings
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
        duration
      });

      this.lastOperationTime = Date.now();

      return result;

    } catch (error) {
      timer();
      logger.error('JWT save failed', error);
      throw error;
    }
  }
}

/**
 * Initialize JWT Service - Main entry point called from main.js
 * @returns {Promise<boolean>} True if JWT service is ready
 */
export async function initializeJWTService() {
  try {
    logger.info('Starting JWT Service initialization');
    
    // Create service instance if it doesn't exist
    if (!window.jwtAuth) {
      window.jwtAuth = new JWTTokenOperations();
    }
    
    // Initialize the service
    const isReady = await window.jwtAuth.initialize();
    
    if (isReady) {
      logger.success('JWT Service initialized successfully');
    } else {
      logger.warn('JWT Service initialization completed but not ready (auth may not be available)');
    }
    
    return isReady;
    
  } catch (error) {
    logger.error('JWT Service initialization failed', error);
    return false;
  }
}