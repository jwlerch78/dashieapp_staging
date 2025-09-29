// js/apis/api-auth/jwt-token-operations.js
// CHANGE SUMMARY: Split from unified-jwt-service.js - All token operations including refresh token management and settings

import { JWTServiceCore } from './jwt-service-core.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('UnifiedJWT');

/**
 * JWT Token Operations - Extends core service with all token management
 * Handles settings, multi-account tokens, refresh tokens, and all edge function operations
 */
export class JWTTokenOperations extends JWTServiceCore {
  
  // ====== NEW: MULTI-ACCOUNT TOKEN MANAGEMENT METHODS ======

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
      if (result.user) this.currentUser = result.user;
      if (result.jwtToken) {
        this.currentJWT = result.jwtToken;
        this._parseJWTExpiry();
      }

      return result;

    } catch (error) {
      timer();
      logger.error('JWT store tokens failed', error);
      throw error;
    }
  }

  /**
   * Get valid access token for account (auto-refreshes if expired)
   */
  async getValidToken(provider = 'google', accountType = 'personal') {
    if (!this.isServiceReady()) {
      throw new Error('JWT service not ready for get valid token operation');
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
        throw new Error(`JWT get valid token failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      logger.success('JWT valid token retrieved', {
        success: result.success,
        provider,
        accountType,
        refreshed: result.refreshed,
        duration
      });

      this.lastOperationTime = Date.now();
      if (result.user) this.currentUser = result.user;
      if (result.jwtToken) {
        this.currentJWT = result.jwtToken;
        this._parseJWTExpiry();
      }

      return result;

    } catch (error) {
      timer();
      logger.error('JWT get valid token failed', error);
      throw error;
    }
  }

  /**
   * List all stored token accounts
   */
  async listTokenAccounts() {
    if (!this.isServiceReady()) {
      throw new Error('JWT service not ready for list accounts operation');
    }

    const timer = logger.startTimer('JWT List Token Accounts');
    
    try {
      await this._ensureValidJWT();
      const googleAccessToken = this._getGoogleAccessToken();
      if (!googleAccessToken) {
        throw new Error('No Google access token available');
      }

      const requestBody = {
        googleAccessToken,
        operation: 'list_accounts'
      };

      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: this._getSupabaseHeaders(),
        body: JSON.stringify(requestBody)
      });

      const duration = timer();

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JWT list accounts failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      logger.success('JWT token accounts listed', {
        success: result.success,
        accountCount: result.accounts?.length || 0,
        duration
      });

      this.lastOperationTime = Date.now();
      if (result.user) this.currentUser = result.user;
      if (result.jwtToken) {
        this.currentJWT = result.jwtToken;
        this._parseJWTExpiry();
      }

      return result.accounts || [];

    } catch (error) {
      timer();
      logger.error('JWT list token accounts failed', error);
      throw error;
    }
  }

  /**
   * Remove a stored token account
   */
  async removeTokenAccount(provider = 'google', accountType = 'personal') {
    if (!this.isServiceReady()) {
      throw new Error('JWT service not ready for remove account operation');
    }

    const timer = logger.startTimer('JWT Remove Token Account');
    
    try {
      await this._ensureValidJWT();
      const googleAccessToken = this._getGoogleAccessToken();
      if (!googleAccessToken) {
        throw new Error('No Google access token available');
      }

      const requestBody = {
        googleAccessToken,
        operation: 'remove_account',
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
        throw new Error(`JWT remove account failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      logger.success('JWT token account removed', {
        success: result.success,
        removed: result.removed,
        duration
      });

      this.lastOperationTime = Date.now();
      if (result.user) this.currentUser = result.user;
      if (result.jwtToken) {
        this.currentJWT = result.jwtToken;
        this._parseJWTExpiry();
      }

      return result.removed === true;

    } catch (error) {
      timer();
      logger.error('JWT remove token account failed', error);
      throw error;
    }
  }

  /**
   * Manually refresh an OAuth token using refresh token
   */
  async refreshToken(refreshToken) {
    if (!this.isServiceReady()) {
      throw new Error('JWT service not ready for refresh token operation');
    }

    const timer = logger.startTimer('JWT Refresh Token');
    
    try {
      if (!refreshToken) {
        throw new Error('Refresh token is required');
      }

      const requestBody = {
        operation: 'refresh_token',
        data: {
          refresh_token: refreshToken
        }
      };

      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: this._getSupabaseHeaders(),
        body: JSON.stringify(requestBody)
      });

      const duration = timer();

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JWT refresh token failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      logger.success('JWT token refreshed', {
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
   * NEW METHOD - not in original
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
        // Note: Removed userEmail - edge function gets it from Google token
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
      
      // Update stored user and JWT
      if (result.user) this.currentUser = result.user;
      if (result.jwtToken) {
        this.currentJWT = result.jwtToken;
        this._parseJWTExpiry();
      }

      return result.settings;

    } catch (error) {
      timer();
      logger.error('JWT settings load failed', error);
      throw error;
    }
  }

  /**
   * Save user settings via JWT-verified edge function
   * @param {string} userEmail - User email (kept for compatibility)
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
      // Ensure we have a valid JWT
      await this._ensureValidJWT();

      const googleAccessToken = this._getGoogleAccessToken();
      if (!googleAccessToken) {
        throw new Error('No Google access token available');
      }

      const requestBody = {
        googleAccessToken,
        operation: 'save',
        data: settings
        // Note: Removed userEmail - edge function gets it from Google token
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
      
      // Update stored user and JWT
      if (result.user) this.currentUser = result.user;
      if (result.jwtToken) {
        this.currentJWT = result.jwtToken;
        this._parseJWTExpiry();
      }

      return result.saved === true;

    } catch (error) {
      timer();
      logger.error('JWT settings save failed', error);
      throw error;
    }
  }
}

// Create and export singleton instance
export const unifiedJWTService = new JWTTokenOperations();

// Initialize JWT service when module loads
export async function initializeJWTService() {
  logger.info('Initializing JWT service from module');
  return await unifiedJWTService.initialize();
}

export default unifiedJWTService;