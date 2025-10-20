// js/apis/api-auth/jwt-token-operations.js
// CHANGE SUMMARY: Added automatic settings reload after token refresh to ensure localStorage gets updated with new token

import { JWTServiceCore } from './jwt-service-core.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('UnifiedJWT');

/**
 * JWT Token Operations - Extends core service with all token management
 * Handles settings, multi-account tokens, refresh tokens, and all edge function operations
 */
export class JWTTokenOperations extends JWTServiceCore {
  
  constructor() {
    super();
    
    // Token request deduplication
    this.tokenCache = new Map();
    this.inFlightRequests = new Map();
    this.CACHE_BUFFER_MS = 10 * 60 * 1000; // 10 minute buffer
  }

  /**
   * NOTE: We do NOT authenticate the Supabase client with auth.setSession()
   * because that expects Supabase's own auth JWT format.
   * Instead, our custom JWT should be passed in headers for RLS verification.
   */

  // ====== CACHE HELPER METHODS ======

  _getTokenCacheKey(provider, accountType) {
    return `${provider}_${accountType}`;
  }

  _getCachedToken(provider, accountType) {
    const key = this._getTokenCacheKey(provider, accountType);
    const cached = this.tokenCache.get(key);
    
    if (!cached) return null;
    
    const now = Date.now();
    const expiresAt = new Date(cached.expires_at).getTime();
    
    if (now < expiresAt - this.CACHE_BUFFER_MS) {
      logger.debug('Using cached token', { provider, accountType });
      return cached;
    }
    
    this.tokenCache.delete(key);
    return null;
  }

  _cacheToken(provider, accountType, tokenData) {
    const key = this._getTokenCacheKey(provider, accountType);
    this.tokenCache.set(key, {
      access_token: tokenData.access_token,
      expires_at: tokenData.expires_at,
      scopes: tokenData.scopes,
      cached_at: Date.now()
    });
  }

  /**
   * NEW: Invalidate cached token for a specific provider/account
   * Called by GoogleAPIClient when it receives a 401 error
   * @param {string} provider - Provider name (e.g., 'google')
   * @param {string} accountType - Account type (e.g., 'primary')
   */
  async invalidateTokenCache(provider = 'google', accountType = 'primary') {
    const key = this._getTokenCacheKey(provider, accountType);
    const hadCache = this.tokenCache.has(key);
    
    if (hadCache) {
      this.tokenCache.delete(key);
      logger.info('🗑️ Token cache invalidated', { provider, accountType });
    } else {
      logger.debug('Token cache already empty', { provider, accountType });
    }
    
    return hadCache;
  }

  /**
   * NEW: Reload settings from database to update localStorage after token refresh
   * This ensures localStorage gets the latest tokens after a refresh
   * @private
   */
  async _reloadSettingsAfterTokenRefresh() {
    try {
      logger.info('🔄 Reloading settings after token refresh to update localStorage');
      
      // Load fresh settings from database
      const result = await this.loadSettings();
      
      if (result.success && result.settings) {
        // The loadSettings call will automatically save to localStorage via SimpleSupabaseStorage
        logger.success('✅ Settings reloaded and localStorage updated with refreshed token');
        return true;
      } else {
        logger.warn('⚠️ Settings reload returned no data after token refresh');
        return false;
      }
    } catch (error) {
      logger.error('❌ Failed to reload settings after token refresh', error);
      return false;
    }
  }

  // ====== MULTI-ACCOUNT TOKEN MANAGEMENT METHODS ======

  /**
   * Store OAuth tokens for multi-account support
   * FIXED: Now uses JWT authentication instead of Google token
   */
  async storeTokens(provider = 'google', accountType = 'primary', tokenData) {
    if (!this.isServiceReady()) {
      throw new Error('JWT service not ready for store tokens operation');
    }

    const timer = logger.startTimer('JWT Store Tokens');
    
    try {
      if (!tokenData?.access_token || !tokenData?.refresh_token) {
        throw new Error('Missing required token data: access_token and refresh_token are required');
      }

      await this._ensureValidJWT();

      if (!this.currentJWT) {
        throw new Error('No Supabase JWT available');
      }

      const requestBody = {
        operation: 'store_tokens',
        data: tokenData,
        provider,
        account_type: accountType
      };

      // Use Supabase JWT in Authorization header (not Google token)
      const headers = this._getSupabaseHeaders(true);

      console.log('🔍 DEBUG - Storing tokens with data:', {
        provider,
        account_type: accountType,
        has_provider_info: !!tokenData.provider_info,
        provider_info: tokenData.provider_info
      });
      

      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: headers,
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

      // Cache the newly stored token
      if (result.success && tokenData.access_token) {
        this._cacheToken(provider, accountType, {
          access_token: tokenData.access_token,
          expires_at: tokenData.expires_at || new Date(Date.now() + 3600 * 1000).toISOString(),
          scopes: tokenData.scopes || tokenData.scope?.split(' ') || []
        });
      }

      return result;

    } catch (error) {
      timer();
      logger.error('JWT store tokens failed', error);
      throw error;
    }
  }

  /**
   * Get valid OAuth token (refresh if needed)
   * UPDATED: Now triggers settings reload after token refresh to update localStorage
   * WITH DEDUPLICATION: Multiple simultaneous requests share the same fetch
   */
  async getValidToken(provider = 'google', accountType = 'personal') {
    if (!this.isServiceReady()) {
      throw new Error('JWT service not ready for get token operation');
    }

    // Check cache first
    const cached = this._getCachedToken(provider, accountType);
    if (cached) {
      return {
        success: true,
        access_token: cached.access_token,
        expires_at: cached.expires_at,
        scopes: cached.scopes,
        refreshed: false,
        cached: true
      };
    }

    // Check if there's already a request in flight for this token
    const key = this._getTokenCacheKey(provider, accountType);
    if (this.inFlightRequests.has(key)) {
      logger.debug('Token request already in flight, waiting...', { provider, accountType });
      return await this.inFlightRequests.get(key);
    }

    // Start new request and store promise
    const requestPromise = this._fetchValidToken(provider, accountType);
    this.inFlightRequests.set(key, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up in-flight request
      this.inFlightRequests.delete(key);
    }
  }

  /**
   * Internal method to fetch valid token (with refresh if needed)
   * @private
   */
  async _fetchValidToken(provider, accountType) {
    const timer = logger.startTimer('JWT Get Valid Token');
    
    try {
      await this._ensureValidJWT();

      if (!this.currentJWT) {
        throw new Error('No Supabase JWT available');
      }

      const requestBody = {
        operation: 'get_valid_token',
        provider,
        account_type: accountType
      };

      // Use Supabase JWT in Authorization header
      const headers = this._getSupabaseHeaders(true);

      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      const duration = timer();

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JWT get valid token failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      // Check if token was refreshed
      const wasRefreshed = result.refreshed === true;
      
      logger.success('JWT valid token retrieved', {
        provider,
        accountType,
        refreshed: wasRefreshed,
        duration
      });

      this.lastOperationTime = Date.now();

      // Cache the token
      if (result.access_token) {
        this._cacheToken(provider, accountType, {
          access_token: result.access_token,
          expires_at: result.expires_at,
          scopes: result.scopes
        });
      }

      // CRITICAL FIX: If token was refreshed, reload settings to update localStorage
      if (wasRefreshed) {
        logger.info('🔄 Token was refreshed - triggering settings reload to update localStorage');
        // Do this in background, don't block the token return
        this._reloadSettingsAfterTokenRefresh().catch(err => {
          logger.error('Background settings reload failed', err);
        });
      }

      return {
        success: true,
        access_token: result.access_token,
        expires_at: result.expires_at,
        scopes: result.scopes,
        refreshed: wasRefreshed
      };

    } catch (error) {
      timer();
      logger.error('JWT get valid token failed', error);
      throw error;
    }
  }

  /**
   * List all stored token accounts
   */
  /**
 * List all stored token accounts
 * FIXED: Now uses JWT authentication instead of expired Google session token
 */
async listTokenAccounts() {
  if (!this.isServiceReady()) {
    throw new Error('JWT service not ready for list accounts operation');
  }

  const timer = logger.startTimer('JWT List Accounts');
  
  try {
    await this._ensureValidJWT();

    const requestBody = {
      operation: 'list_accounts'
    };

    // Use Supabase JWT in Authorization header (not Google token)
    const headers = this._getSupabaseHeaders(true);

    const response = await fetch(this.edgeFunctionUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });

    const duration = timer();

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`JWT list accounts failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    
    logger.success('JWT accounts listed', {
      success: result.success,
      count: result.accounts?.length || 0,
      duration
    });

    this.lastOperationTime = Date.now();

    return result;

  } catch (error) {
    timer();
    logger.error('JWT list accounts failed', error);
    throw error;
  }
}

// js/apis/api-auth/jwt-token-operations.js
// CHANGE SUMMARY: Fixed removeTokenAccount to use Supabase JWT in Authorization header instead of Google access token

/**
 * Remove a token account
 * UPDATED: Now uses Supabase JWT authentication (like list_accounts) instead of Google token
 */
async removeTokenAccount(provider = 'google', accountType = 'primary') {
  if (!this.isServiceReady()) {
    throw new Error('JWT service not ready for remove account operation');
  }

  const timer = logger.startTimer('JWT Remove Account');
  
  try {
    await this._ensureValidJWT();

    const requestBody = {
      operation: 'remove_account',
      provider,
      account_type: accountType
    };

    // Use Supabase JWT in Authorization header (not Google token)
    // This matches the pattern used by list_accounts operation
    const headers = this._getSupabaseHeaders(true);

    const response = await fetch(this.edgeFunctionUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });

    const duration = timer();

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`JWT remove account failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    
    logger.success('JWT account removed', {
      success: result.removed,
      provider,
      accountType,
      duration
    });

    this.lastOperationTime = Date.now();

    // Clear cache for this account
    const key = this._getTokenCacheKey(provider, accountType);
    this.tokenCache.delete(key);

    return result;

  } catch (error) {
    timer();
    logger.error('JWT remove account failed', error);
    throw error;
  }
}

  /**
   * Get current Supabase JWT token (refreshes if needed)
   * Used by PhotoStorageService and other services that need JWT for edge function calls
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
   * Manually refresh a specific refresh token
   */
 
/**
 * Refresh an OAuth token using its refresh token
 * UPDATED: Now includes provider_info to support multi-client OAuth (device flow vs web OAuth)
 * @param {string} refreshToken - The refresh token to use
 * @returns {Promise<Object>} New access token and expiry
 */
async refreshToken(refreshToken) {
  if (!this.isServiceReady()) {
    throw new Error('JWT service not ready for refresh token operation');
  }

  const timer = logger.startTimer('JWT Refresh Token');
  
  try {
    // Load settings to find which account this refresh token belongs to
    let providerInfo = null;
    
    try {
      const settings = await this.loadSettings();
      const tokenAccounts = settings?.settings?.tokenAccounts || {};
      
      // Search through all providers and account types to find this refresh token
      for (const [provider, accounts] of Object.entries(tokenAccounts)) {
        for (const [accountType, accountData] of Object.entries(accounts)) {
          if (accountData.refresh_token === refreshToken) {
            providerInfo = accountData.provider_info || null;
            logger.debug('Found provider_info for refresh token', {
              provider,
              accountType,
              hasProviderInfo: !!providerInfo
            });
            break;
          }
        }
        if (providerInfo) break;
      }
    } catch (error) {
      logger.warn('Could not load provider_info for refresh token', error);
      // Continue without provider_info - edge function will use default credentials
    }

    const requestBody = {
      operation: 'refresh_token',
      data: { 
        refresh_token: refreshToken,
        provider_info: providerInfo  // Include provider_info for multi-client support
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
      hadProviderInfo: !!providerInfo,
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

  // ====== SETTINGS OPERATIONS ======

  /**
   * Load user settings via JWT-verified edge function
   * UPDATED: Now uses Supabase JWT for authentication instead of Google token
   * @returns {Promise<Object>} Settings object or null if none found
   */
  async loadSettings() {
    if (!this.isServiceReady()) {
      throw new Error('JWT service not ready for load operation');
    }

    const timer = logger.startTimer('JWT Load Settings');
    
    logger.info('Loading settings via JWT');

    try {
      // CRITICAL CHANGE: Use Supabase JWT for authentication, not Google token
      await this._ensureValidJWT();

      if (!this.currentJWT) {
        throw new Error('No Supabase JWT available');
      }

      const requestBody = {
        operation: 'load'
      };

      // Use Supabase JWT in Authorization header
      const headers = this._getSupabaseHeaders(true); // true = use JWT auth

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
   * UPDATED: Now uses Supabase JWT for authentication instead of Google token
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
      // CRITICAL CHANGE: Use Supabase JWT for authentication, not Google token
      await this._ensureValidJWT();

      if (!this.currentJWT) {
        throw new Error('No Supabase JWT available');
      }

      const requestBody = {
        operation: 'save',
        settings: settings
      };

      // Use Supabase JWT in Authorization header
      const headers = this._getSupabaseHeaders(true); // true = use JWT auth

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
