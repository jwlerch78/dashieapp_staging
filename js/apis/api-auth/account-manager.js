// js/apis/api-auth/account-manager.js
// CHANGE SUMMARY: FIXED - Access providers via dashieAuth.authCoordinator.providers (not directly on dashieAuth)

import { createLogger } from '../../utils/logger.js';
import { getPlatformDetector } from '../../utils/platform-detector.js';

const logger = createLogger('AccountManager');

/**
 * Account Manager - Centralized multi-account OAuth management
 * Handles adding, removing, and managing multiple Google (and future provider) accounts
 * This is the single source of truth for account operations across all widgets
 */
export class AccountManager {
  constructor(dashieAuth, jwtAuth) {
    this.dashieAuth = dashieAuth;
    this.jwtAuth = jwtAuth;
    this.platform = getPlatformDetector();
    this.isInitialized = false;
    
    logger.info('Account Manager created', {
      platform: this.platform.platform,
      isTV: this.platform.isTV()
    });
  }

  /**
   * Initialize the account manager
   * Called from main.js after auth systems are ready
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('Account Manager already initialized');
      return true;
    }

    try {
      // Verify dependencies are ready
      if (!this.dashieAuth) {
        throw new Error('dashieAuth not available');
      }

      if (!this.jwtAuth || !this.jwtAuth.isServiceReady()) {
        throw new Error('jwtAuth not ready');
      }

      this.isInitialized = true;
      logger.success('Account Manager initialized successfully');
      return true;

    } catch (error) {
      logger.error('Account Manager initialization failed', error);
      throw error;
    }
  }

  /**
   * Check if service is ready for operations
   */
  isServiceReady() {
    return this.isInitialized && 
           this.jwtAuth?.isServiceReady() && 
           this.dashieAuth?.authenticated;
  }

  /**
   * Add a new Google account
   * This is the main entry point for adding accounts from UI
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.accountType - Account identifier (e.g., 'work', 'family', 'school')
   * @param {string} options.displayName - Human-readable name for the account
   * @param {Function} options.onProgress - Progress callback (optional)
   * @returns {Promise<Object>} Result with success status and account info
   */
  async addGoogleAccount(options = {}) {
    if (!this.isServiceReady()) {
      throw new Error('Account Manager not ready - ensure auth systems are initialized');
    }

    const timer = logger.startTimer('Add Google Account');

    const {
      accountType = this._generateAccountType(),
      displayName = null,
      onProgress = null
    } = options;

    logger.info('Starting Google account addition', {
      accountType,
      displayName,
      platform: this.platform.platform
    });

    try {
      // Step 1: Check if account type already exists
      if (onProgress) onProgress('Checking existing accounts...');
      
      const existingAccounts = await this.listAccounts();
      const accountExists = existingAccounts.some(
        acc => acc.provider === 'google' && acc.account_type === accountType
      );

      if (accountExists) {
        logger.warn('Account type already exists', { accountType });
        throw new Error(`Account type '${accountType}' already exists. Please choose a different name.`);
      }

      // CRITICAL: Store account info in sessionStorage BEFORE OAuth redirect
      // This preserves the account type across the redirect since OAuth loses context
      sessionStorage.setItem('dashie-pending-account', JSON.stringify({
        accountType,
        displayName,
        timestamp: Date.now()
      }));
      
      logger.debug('Stored pending account info in sessionStorage', { accountType, displayName });

      // Step 2: Trigger OAuth flow based on platform
      if (onProgress) onProgress('Opening authorization...');
      
      logger.debug('Triggering OAuth flow', {
        platform: this.platform.platform,
        recommendedFlow: this.platform.getRecommendedAuthFlow()
      });

      const authResult = await this._triggerOAuthFlow();

      if (!authResult || !authResult.success) {
        throw new Error('OAuth flow failed or was cancelled');
      }

      logger.success('OAuth flow completed', {
        userEmail: authResult.user?.email,
        hasRefreshToken: !!authResult.tokens?.refresh_token
      });

      // Step 3: Prepare token data for storage
      if (onProgress) onProgress('Storing account tokens...');

      const tokenData = {
        access_token: authResult.tokens.access_token,
        refresh_token: authResult.tokens.refresh_token,
        expires_at: authResult.tokens.expires_at || 
                    new Date(Date.now() + (authResult.tokens.expires_in || 3600) * 1000).toISOString(),
        expires_in: authResult.tokens.expires_in || 3600,
        scopes: authResult.tokens.scope?.split(' ') || ['calendar', 'photos'],
        display_name: displayName || `${authResult.user.name} (${accountType})`,
        email: authResult.user.email,
        user_id: authResult.user.id,
        issued_at: Date.now(),
        provider_info: {
          type: authResult.user.authMethod || 'web_oauth',
          client_id: this._getClientId()
        }
      };

      // Step 4: Store tokens via JWT service
      logger.debug('Storing tokens via JWT service', {
        provider: 'google',
        accountType,
        email: tokenData.email
      });

      const stored = await this.jwtAuth.storeTokens('google', accountType, tokenData);

      if (!stored || !stored.success) {
        throw new Error('Failed to store account tokens');
      }

      const duration = timer();

      // Step 5: Return success result
      const result = {
        success: true,
        provider: 'google',
        accountType,
        email: authResult.user.email,
        displayName: tokenData.display_name,
        duration
      };

      logger.success('Google account added successfully', result);

      if (onProgress) onProgress('Account added successfully!');

      return result;

    } catch (error) {
      timer();
      logger.error('Failed to add Google account', error);
      
      // Clean up pending account info on error
      sessionStorage.removeItem('dashie-pending-account');

      // Return structured error
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
        accountType
      };
    }
  }

  /**
   * Remove an account and all its tokens
   * 
   * @param {string} provider - Provider name (e.g., 'google')
   * @param {string} accountType - Account identifier
   * @returns {Promise<Object>} Result with success status
   */
  async removeAccount(provider, accountType) {
    if (!this.isServiceReady()) {
      throw new Error('Account Manager not ready');
    }

    const timer = logger.startTimer('Remove Account');

    try {
      logger.info('Removing account', { provider, accountType });

      // Remove tokens via JWT service
      const result = await this.jwtAuth.removeTokenAccount(provider, accountType);

      const duration = timer();

      if (result && result.success) {
        logger.success('Account removed successfully', {
          provider,
          accountType,
          duration
        });

        return {
          success: true,
          provider,
          accountType,
          duration
        };
      } else {
        throw new Error('Failed to remove account from storage');
      }

    } catch (error) {
      timer();
      logger.error('Failed to remove account', error);
      
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
        provider,
        accountType
      };
    }
  }

  /**
   * List all stored accounts across all providers
   * 
   * @returns {Promise<Array>} Array of account objects
   */
  async listAccounts() {
    if (!this.isServiceReady()) {
      throw new Error('Account Manager not ready');
    }

    try {
      const result = await this.jwtAuth.listTokenAccounts();

      if (!result || !result.success) {
        throw new Error('Failed to retrieve accounts');
      }

      const accounts = result.accounts || [];

      logger.debug('Retrieved accounts', {
        count: accounts.length,
        providers: [...new Set(accounts.map(a => a.provider))]
      });

      return accounts;

    } catch (error) {
      logger.error('Failed to list accounts', error);
      return [];
    }
  }

  /**
   * Reauthorize an existing account (force token refresh)
   * Useful when tokens expire or permissions change
   * 
   * @param {string} provider - Provider name
   * @param {string} accountType - Account identifier
   * @returns {Promise<Object>} Result with success status
   */
  async reauthorizeAccount(provider, accountType) {
    if (!this.isServiceReady()) {
      throw new Error('Account Manager not ready');
    }

    logger.info('Reauthorizing account', { provider, accountType });

    try {
      // For now, remove and re-add the account
      // In the future, this could be optimized to just refresh tokens
      
      const removeResult = await this.removeAccount(provider, accountType);
      if (!removeResult.success) {
        throw new Error('Failed to remove old account data');
      }

      // Trigger new OAuth flow
      const addResult = await this.addGoogleAccount({
        accountType,
        displayName: `${accountType} (reauthorized)`
      });

      return addResult;

    } catch (error) {
      logger.error('Failed to reauthorize account', error);
      
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
        provider,
        accountType
      };
    }
  }

  /**
   * Get status of the account manager
   * Useful for debugging and UI display
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      ready: this.isServiceReady(),
      platform: this.platform.platform,
      authFlow: this.platform.getRecommendedAuthFlow(),
      dependencies: {
        dashieAuth: !!this.dashieAuth,
        jwtAuth: this.jwtAuth?.isServiceReady() || false
      }
    };
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Get auth providers from the auth coordinator
   * @private
   */
  _getProviders() {
    // FIXED: Providers are on authCoordinator, not directly on dashieAuth
    return this.dashieAuth?.authCoordinator?.providers || {};
  }

  /**
   * Trigger OAuth flow based on platform
   * @private
   */
  async _triggerOAuthFlow() {
    const authFlow = this.platform.getRecommendedAuthFlow();

    logger.debug('Triggering OAuth flow', { authFlow });

    switch (authFlow) {
      case 'web_oauth':
        return await this._triggerWebOAuth();

      case 'device_flow':
        return await this._triggerDeviceFlow();

      case 'native':
        return await this._triggerNativeAuth();

      default:
        throw new Error(`Unsupported auth flow: ${authFlow}`);
    }
  }

  /**
   * Trigger web OAuth flow (browser)
   * @private
   */
  async _triggerWebOAuth() {
    logger.debug('Starting web OAuth flow');

    // FIXED: Get providers from authCoordinator
    const providers = this._getProviders();
    const provider = providers.web_oauth;
    
    if (!provider) {
      logger.error('Web OAuth provider not found', {
        availableProviders: Object.keys(providers)
      });
      throw new Error('Web OAuth provider not available');
    }

    // Force account selection to allow adding different accounts
    // This prevents Google from auto-selecting the cached account
    await provider.signIn(true); // forceAccountSelection = true

    // OAuth redirect happens here, app will reload and process callback
    // The tokens will be queued in window.pendingRefreshTokens
    // and processed during the next startup sequence

    // This promise will never resolve because we redirect
    return new Promise(() => {});
  }

  /**
   * Trigger device flow (Fire TV, etc.)
   * @private
   */
  async _triggerDeviceFlow() {
    logger.debug('Starting device flow');

    // FIXED: Get providers from authCoordinator
    const providers = this._getProviders();
    const provider = providers.device_flow;
    
    if (!provider) {
      logger.error('Device flow provider not found', {
        availableProviders: Object.keys(providers)
      });
      throw new Error('Device flow provider not available');
    }

    // Device flow shows code on screen and waits for authorization
    const result = await provider.signIn();
    
    return result;
  }

  /**
   * Trigger native authentication (Android native)
   * @private
   */
  async _triggerNativeAuth() {
    logger.debug('Starting native auth flow');

    // FIXED: Get providers from authCoordinator
    const providers = this._getProviders();
    const provider = providers.native_android;
    
    if (!provider) {
      logger.error('Native auth provider not found', {
        availableProviders: Object.keys(providers)
      });
      throw new Error('Native auth provider not available');
    }

    const result = await provider.signIn();
    
    return result;
  }

  /**
   * Generate a unique account type identifier
   * @private
   */
  _generateAccountType() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `account_${timestamp}_${random}`;
  }

  /**
   * Get appropriate OAuth client ID for current platform
   * @private
   */
  _getClientId() {
    // This could be made more sophisticated to return different
    // client IDs for different platforms once consolidation is complete
    return '221142210647-58t8hr48rk7nlgl56j969himso1qjjoo.apps.googleusercontent.com';
  }
}

// ============================================
// GLOBAL INITIALIZATION FUNCTION
// ============================================

/**
 * Initialize the global account manager
 * Should be called from main.js after auth systems are ready
 * 
 * @param {Object} dashieAuth - Main auth coordinator
 * @param {Object} jwtAuth - JWT service
 * @returns {Promise<AccountManager>} Initialized account manager
 */
export async function initializeAccountManager(dashieAuth, jwtAuth) {
  logger.info('Initializing global account manager');

  try {
    const accountManager = new AccountManager(dashieAuth, jwtAuth);
    await accountManager.initialize();

    // Expose globally
    window.accountManager = accountManager;

    logger.success('Global account manager initialized and exposed as window.accountManager');

    return accountManager;

  } catch (error) {
    logger.error('Failed to initialize global account manager', error);
    throw error;
  }
}

export default AccountManager;