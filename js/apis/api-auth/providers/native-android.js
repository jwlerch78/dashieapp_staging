// js/apis/api-auth/providers/native-android.js - Clean Native Android Implementation
// CHANGE SUMMARY: Extracted from native-auth.js, added structured logging, simplified interface

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('NativeAndroid');

/**
 * Native Android authentication provider
 * Interfaces with the Android WebView bridge for Google Sign-In
 */
export class NativeAndroidProvider {
  constructor() {
    this.available = this.checkAvailability();
    this.currentUser = null;
    
    logger.debug('Native Android provider initialized', {
      available: this.available,
      hasNativeInterface: !!window.DashieNative
    });
  }

  /**
   * Check if native Android capabilities are available
   * @returns {boolean} True if native auth is available
   */
  checkAvailability() {
    return window.DashieNative && 
           typeof window.DashieNative.signIn === 'function' &&
           typeof window.DashieNative.isSignedIn === 'function';
  }

  /**
   * Initialize the native provider
   * @returns {Promise<void>}
   */
  async init() {
    if (!this.available) {
      throw new Error('Native Android auth not available');
    }
    
    logger.info('Native Android provider initialized');
    
    // Check for existing user
    this.currentUser = this.getCurrentUser();
    if (this.currentUser) {
      logger.success('Found existing native user', {
        userId: this.currentUser.id,
        userEmail: this.currentUser.email
      });
    }
  }

  /**
   * Get current signed-in user from native interface
   * @returns {Object|null} Current user data or null
   */
  getCurrentUser() {
    if (!this.available) return null;
    
    try {
      if (window.DashieNative.isSignedIn()) {
        const userJson = window.DashieNative.getCurrentUser();
        if (userJson) {
          const userData = JSON.parse(userJson);
          
          logger.debug('Retrieved current native user', {
            userId: userData.id,
            userEmail: userData.email,
            hasGoogleToken: !!userData.googleAccessToken
          });
          
          return userData;
        }
      }
    } catch (error) {
      logger.warn('Failed to get current native user', error);
    }
    
    return null;
  }

  /**
   * Start native sign-in flow
   * @returns {Promise<Object>} Auth result - resolved by native callback
   */
  async signIn() {
    if (!this.available) {
      throw new Error('Native Android auth not available');
    }
    
    logger.auth('native', 'sign_in_start', 'pending');
    
    return new Promise((resolve, reject) => {
      // Set up callback handler
      const originalHandler = window.handleNativeAuth;
      
      window.handleNativeAuth = (result) => {
        // Restore original handler
        window.handleNativeAuth = originalHandler;
        
        if (result.success && result.user) {
          this.currentUser = result.user;
          
          logger.auth('native', 'sign_in_complete', 'success', {
            userId: result.user.id,
            userEmail: result.user.email,
            hasTokens: !!result.tokens
          });
          
          resolve({
            success: true,
            user: {
              ...result.user,
              authMethod: 'native_android'
            },
            tokens: result.tokens
          });
        } else {
          const error = result.error || 'Native authentication failed';
          
          logger.auth('native', 'sign_in_complete', 'error', error);
          
          if (error !== 'Sign-in was cancelled') {
            reject(new Error(error));
          } else {
            reject(new Error('CANCELLED')); // Special error type for cancellation
          }
        }
      };
      
      // Trigger native sign-in
      try {
        logger.debug('Triggering native Android sign-in');
        window.DashieNative.signIn();
      } catch (error) {
        // Restore handler on error
        window.handleNativeAuth = originalHandler;
        
        logger.auth('native', 'sign_in_trigger', 'error', error.message);
        reject(new Error(`Native sign-in trigger failed: ${error.message}`));
      }
    });
  }

  /**
   * Sign out from native interface
   */
  signOut() {
    if (!this.available) return;
    
    logger.auth('native', 'sign_out', 'pending');
    
    try {
      window.DashieNative.signOut();
      this.currentUser = null;
      
      logger.auth('native', 'sign_out', 'success');
      
    } catch (error) {
      logger.auth('native', 'sign_out', 'error', error.message);
      
      // Clear local state even if native sign-out fails
      this.currentUser = null;
    }
  }

  /**
   * Check if user is currently signed in
   * @returns {boolean} True if signed in
   */
  isSignedIn() {
    if (!this.available) return false;
    
    try {
      const nativeSignedIn = window.DashieNative.isSignedIn();
      const hasCurrentUser = !!this.currentUser;
      
      logger.debug('Checking native sign-in status', {
        nativeSignedIn,
        hasCurrentUser,
        consistent: nativeSignedIn === hasCurrentUser
      });
      
      return nativeSignedIn;
      
    } catch (error) {
      logger.warn('Failed to check native sign-in status', error);
      return false;
    }
  }

  /**
   * Get current access token
   * @returns {string|null} Current Google access token
   */
  getAccessToken() {
    return this.currentUser?.googleAccessToken || null;
  }

  /**
   * Get current refresh token (if available)
   * @returns {string|null} Current Google refresh token
   */
  getRefreshToken() {
    return this.currentUser?.googleRefreshToken || null;
  }

  /**
   * Check if provider has valid tokens
   * @returns {boolean} True if tokens are available
   */
  hasValidTokens() {
    return !!this.getAccessToken();
  }

  /**
   * Refresh tokens through native interface
   * @returns {Promise<Object>} New token data
   */
  async refreshTokens() {
    if (!this.available) {
      throw new Error('Native interface not available');
    }

    logger.debug('Requesting token refresh from native interface');

    return new Promise((resolve, reject) => {
      // Check if native interface supports token refresh
      if (typeof window.DashieNative.refreshTokens !== 'function') {
        reject(new Error('Token refresh not supported by native interface'));
        return;
      }

      // Set up callback for refresh result
      const originalRefreshHandler = window.handleNativeTokenRefresh;
      
      window.handleNativeTokenRefresh = (result) => {
        // Restore original handler
        window.handleNativeTokenRefresh = originalRefreshHandler;
        
        if (result.success) {
          // Update current user with new tokens
          if (this.currentUser) {
            this.currentUser.googleAccessToken = result.accessToken;
            if (result.refreshToken) {
              this.currentUser.googleRefreshToken = result.refreshToken;
            }
          }
          
          logger.success('Native token refresh successful');
          resolve(result);
        } else {
          logger.error('Native token refresh failed', result.error);
          reject(new Error(result.error || 'Token refresh failed'));
        }
      };

      try {
        window.DashieNative.refreshTokens();
      } catch (error) {
        // Restore handler on error
        window.handleNativeTokenRefresh = originalRefreshHandler;
        
        logger.error('Failed to trigger token refresh', error);
        reject(error);
      }
    });
  }

  /**
   * Get provider capabilities and information
   * @returns {Object} Provider info
   */
  getProviderInfo() {
    return {
      name: 'native_android',
      type: 'native',
      available: this.available,
      supportsRefreshTokens: this.available && typeof window.DashieNative.refreshTokens === 'function',
      isSignedIn: this.isSignedIn(),
      hasTokens: this.hasValidTokens(),
      nativeInterface: {
        hasSignIn: typeof window.DashieNative?.signIn === 'function',
        hasSignOut: typeof window.DashieNative?.signOut === 'function',
        hasIsSignedIn: typeof window.DashieNative?.isSignedIn === 'function',
        hasGetCurrentUser: typeof window.DashieNative?.getCurrentUser === 'function',
        hasRefreshTokens: typeof window.DashieNative?.refreshTokens === 'function'
      }
    };
  }

  /**
   * Test native interface connectivity
   * @returns {Promise<Object>} Test results
   */
  async testInterface() {
    logger.debug('Testing native Android interface');
    
    const results = {
      available: this.available,
      methods: {},
      signInStatus: null,
      currentUser: null,
      error: null
    };

    if (!this.available) {
      results.error = 'Native interface not available';
      return results;
    }

    try {
      // Test each method availability
      results.methods = {
        signIn: typeof window.DashieNative.signIn === 'function',
        signOut: typeof window.DashieNative.signOut === 'function',
        isSignedIn: typeof window.DashieNative.isSignedIn === 'function',
        getCurrentUser: typeof window.DashieNative.getCurrentUser === 'function',
        refreshTokens: typeof window.DashieNative.refreshTokens === 'function'
      };

      // Test sign-in status
      if (results.methods.isSignedIn) {
        results.signInStatus = window.DashieNative.isSignedIn();
      }

      // Test current user retrieval
      if (results.methods.getCurrentUser && results.signInStatus) {
        try {
          const userJson = window.DashieNative.getCurrentUser();
          if (userJson) {
            results.currentUser = JSON.parse(userJson);
          }
        } catch (error) {
          results.error = `Current user retrieval failed: ${error.message}`;
        }
      }

      logger.success('Native interface test completed', results);
      
    } catch (error) {
      results.error = error.message;
      logger.error('Native interface test failed', error);
    }

    return results;
  }

  /**
   * Handle native auth callback (called by Android WebView)
   * @param {Object} result - Auth result from native interface
   * @returns {Promise<Object>} Processed auth result
   */
  async handleNativeCallback(result) {
    logger.debug('Handling native auth callback', {
      success: result.success,
      hasUser: !!result.user,
      hasTokens: !!result.tokens,
      error: result.error
    });

    if (result.success && result.user) {
      // Store user data
      this.currentUser = {
        ...result.user,
        authMethod: 'native_android',
        signedInAt: Date.now()
      };

      logger.auth('native', 'callback_success', 'success', {
        userId: this.currentUser.id,
        userEmail: this.currentUser.email,
        hasGoogleToken: !!this.currentUser.googleAccessToken
      });

      return {
        success: true,
        user: this.currentUser,
        tokens: result.tokens
      };
    } else {
      const error = result.error || 'Native authentication failed';
      
      logger.auth('native', 'callback_failure', 'error', error);
      
      return {
        success: false,
        error: error
      };
    }
  }

  /**
   * Initialize native provider
   * @returns {Promise<void>}
   */
  async init() {
    if (!this.available) {
      throw new Error('Native Android auth not available');
    }
    
    logger.info('Native Android provider initialized');
    
    // Check for existing user
    this.currentUser = this.getCurrentUser();
    if (this.currentUser) {
      logger.success('Found existing native user', {
        userId: this.currentUser.id,
        userEmail: this.currentUser.email
      });
    }
  }
}
