// js/apis/api-auth/auth-coordinator.js - Central Authentication Orchestrator
// CHANGE SUMMARY: Removed supabaseAuthId from all operations - now only accessed via window.jwtAuth.getSupabaseUserId()

import { createLogger } from '../../utils/logger.js';
import { getPlatformDetector } from '../../utils/platform-detector.js';
import { events, EVENTS } from '../../utils/event-emitter.js';

import { WebOAuthProvider } from './providers/web-oauth.js';
import { DeviceFlowProvider } from './providers/device-flow.js';
import { NativeAndroidProvider } from './providers/native-android.js';
import { RedirectManager } from '../../utils/redirect-manager.js';


const logger = createLogger('AuthCoordinator');

/**
 * Central authentication coordinator
 * Manages auth providers, platform detection, and auth flow selection
 */
export class AuthCoordinator {
  constructor(authStorage, authUI) {
    this.storage = authStorage;
    this.ui = authUI;
    this.platform = getPlatformDetector();
    this.redirectManager = new RedirectManager();

    
    // Auth state
    this.currentUser = null;
    this.isAuthenticated = false;
    this.currentProvider = null;
    
    // Auth providers
    this.providers = {};
    this.initializeProviders();
    
    logger.info('Auth coordinator initialized', {
      platform: this.platform.platform,
      deviceType: this.platform.deviceType,
      recommendedFlow: this.platform.getRecommendedAuthFlow(),
      availableProviders: Object.keys(this.providers)
    });
  }

  /**
   * Initialize all available auth providers
   */
  initializeProviders() {
    logger.debug('Initializing auth providers');
    
    // Always initialize web OAuth (works in most environments)
    try {
      this.providers.web_oauth = new WebOAuthProvider();
      logger.debug('Web OAuth provider initialized');
    } catch (error) {
      logger.warn('Failed to initialize Web OAuth provider', error);
    }

    // Initialize device flow for TV platforms
    if (this.platform.isTV() || this.platform.platform.includes('fire')) {
      try {
        this.providers.device_flow = new DeviceFlowProvider();
        logger.debug('Device Flow provider initialized');
      } catch (error) {
        logger.warn('Failed to initialize Device Flow provider', error);
      }
    }

    // Initialize native Android if available
    if (this.platform.hasNativeCapabilities()) {
      try {
        this.providers.native_android = new NativeAndroidProvider();
        logger.debug('Native Android provider initialized');
      } catch (error) {
        logger.warn('Failed to initialize Native Android provider', error);
      }
    }

    logger.info('Provider initialization complete', {
      totalProviders: Object.keys(this.providers).length,
      providers: Object.keys(this.providers)
    });
  }

  /**
   * Initialize the auth system
   * @returns {Promise<Object>} Initialization result
   */
  async init() {
    logger.info('Initializing authentication system');
    
    try {

      const redirectHappened = this.redirectManager.checkRedirectSync();
      if (redirectHappened) {
        logger.info('Redirect initiated, stopping auth initialization');
        return { success: true, redirected: true, message: 'Redirecting to target site...' };
      }

      // Check for existing authentication first
      await this.checkExistingAuth();
      
      if (this.isAuthenticated) {
        logger.success('Found existing authentication', {
          userEmail: this.currentUser?.email,
          authMethod: this.currentUser?.authMethod
        });
        
        events.auth.emitInitialized({ 
          authenticated: true, 
          user: this.currentUser 
        });
        
        return { success: true, authenticated: true, user: this.currentUser };
      }

      // Initialize the recommended provider
      const recommendedProvider = this.getRecommendedProvider();
      if (recommendedProvider) {
        await this.initializeProvider(recommendedProvider);
      }

      // Check if provider initialization resulted in authentication (e.g., OAuth callback)
      if (this.isAuthenticated) {
        logger.success('Authentication completed during provider initialization');
        events.auth.emitInitialized({ 
          authenticated: true, 
          user: this.currentUser 
        });
        
        return { success: true, authenticated: true, user: this.currentUser };
      }

      // Show appropriate auth UI
      this.showAuthUI();
      
      events.auth.emitInitialized({ 
        authenticated: false, 
        readyForAuth: true 
      });
      
      return { success: true, authenticated: false, readyForAuth: true };
      
    } catch (error) {
      logger.error('Auth system initialization failed', error);
      
      events.auth.emitFailure(error);
      
      // Try to recover with saved auth
      const savedUser = this.storage.getSavedUser();
      if (savedUser) {
        logger.info('Attempting recovery with saved authentication');
        this.setAuthenticatedUser(savedUser, null);
        return { success: true, authenticated: true, user: savedUser, recovered: true };
      }
      
      throw error;
    }
  }

  /**
   * Check for existing authentication
   * @returns {Promise<void>}
   */
  async checkExistingAuth() {
    logger.debug('Checking for existing authentication');
    
    // Check saved user data
    const savedUser = this.storage.getSavedUser();
    if (savedUser) {
      logger.info('Found saved user data', {
        userEmail: savedUser.email,
        authMethod: savedUser.authMethod,
        hasGoogleToken: !!savedUser.googleAccessToken
      });
      
      this.setAuthenticatedUser(savedUser, null);
      return;
    }

    // Check for native user if available
    if (this.providers.native_android) {
      const nativeUser = this.providers.native_android.getCurrentUser();
      if (nativeUser) {
        logger.info('Found existing native user', {
          userEmail: nativeUser.email
        });
        
        this.setAuthenticatedUser(nativeUser, this.providers.native_android);
        return;
      }
    }

    logger.debug('No existing authentication found');
  }

  /**
   * Initialize a specific auth provider
   * @param {string} providerName - Name of provider to initialize
   * @returns {Promise<void>}
   */
  async initializeProvider(providerName) {
    const provider = this.providers[providerName];
    if (!provider) {
      throw new Error(`Provider ${providerName} not available`);
    }

    logger.debug(`Initializing provider: ${providerName}`);
    
    try {
      if (provider.init) {
        const result = await provider.init();
        
        // Check if initialization completed authentication (e.g., OAuth callback)
        if (result && result.success && result.user) {
          logger.success(`Provider ${providerName} completed authentication during init`);
          
          this.setAuthenticatedUser(result.user, provider);
          
          // Save the user data when auth completes during init
          this.storage.saveUser(this.currentUser);
        }
      }
    } catch (error) {
      logger.warn(`Provider ${providerName} initialization failed`, error);
      throw error;
    }
  }

  /**
   * Get the recommended auth provider for current platform
   * @returns {string|null} Provider name
   */
  getRecommendedProvider() {
    const recommendedFlow = this.platform.getRecommendedAuthFlow();
    
    const providerMap = {
      'native': 'native_android',
      'device_flow': 'device_flow', 
      'web_oauth': 'web_oauth'
    };

    const providerName = providerMap[recommendedFlow];
    
    if (providerName && this.providers[providerName]) {
      logger.debug(`Recommended provider: ${providerName} (flow: ${recommendedFlow})`);
      return providerName;
    }

    // Fallback to first available provider
    const availableProviders = Object.keys(this.providers);
    if (availableProviders.length > 0) {
      logger.debug(`Using fallback provider: ${availableProviders[0]}`);
      return availableProviders[0];
    }

    logger.warn('No auth providers available');
    return null;
  }

  /**
   * Start authentication flow
   * @param {string} [providerName] - Specific provider to use, or auto-select
   * @returns {Promise<Object>} Auth result
   */
  async signIn(providerName = null) {
    const selectedProvider = providerName || this.getRecommendedProvider();
    
    if (!selectedProvider) {
      throw new Error('No authentication provider available');
    }

    const provider = this.providers[selectedProvider];
    if (!provider) {
      throw new Error(`Provider ${selectedProvider} not available`);
    }

    logger.auth('coordinator', 'sign_in_start', 'pending', {
      provider: selectedProvider,
      platform: this.platform.platform
    });

    try {
      this.ui.hideSignInPrompt();
      
      // Handle native Android provider (callback-based, like old code)
      if (selectedProvider === 'native_android') {
        logger.debug('Using callback-based native Android auth');
        
        return new Promise((resolve, reject) => {
          // Set up one-time callback handler
          const originalHandler = window.handleNativeAuth;
          
          const authTimeout = setTimeout(() => {
            // Restore original handler on timeout
            window.handleNativeAuth = originalHandler;
            reject(new Error('Native authentication timeout'));
          }, 30000); // 30 second timeout
          
          window.handleNativeAuth = (result) => {
            // Clear timeout and restore handler
            clearTimeout(authTimeout);
            window.handleNativeAuth = originalHandler;
            
            if (result.success && result.user) {
              this.setAuthenticatedUser(result.user, provider);
              this.storage.saveUser(this.currentUser);
              events.auth.emitSuccess(this.currentUser);
              
              logger.auth('coordinator', 'sign_in_complete', 'success', {
                provider: selectedProvider,
                userEmail: result.user.email
              });

              resolve({ success: true, user: this.currentUser });
            } else {
              const error = result.error || 'Native authentication failed';
              
              logger.auth('coordinator', 'sign_in_complete', 'error', {
                provider: selectedProvider,
                error: error
              });
              
              if (error !== 'Sign-in was cancelled') {
                reject(new Error(error));
              } else {
                reject(new Error('CANCELLED'));
              }
            }
          };
          
          // Trigger the native sign-in (no Promise returned)
          try {
            provider.signIn(); // Simple synchronous call like old code
          } catch (error) {
            // Restore handler on error
            clearTimeout(authTimeout);
            window.handleNativeAuth = originalHandler;
            reject(new Error(`Native sign-in trigger failed: ${error.message}`));
          }
        });
      }
      
      // Handle Promise-based providers (web_oauth, device_flow)
      const result = await provider.signIn();
      
      // Handle WebOAuth redirect case
      if (selectedProvider === 'web_oauth' && result === undefined) {
        logger.debug('WebOAuth redirect initiated, authentication will complete on callback');
        return { success: true, redirected: true, message: 'Redirecting to Google OAuth...' };
      }
      
      // Handle normal Promise-based auth results
      if (result && result.success && result.user) {
        this.setAuthenticatedUser(result.user, provider);
        this.storage.saveUser(this.currentUser);
        
        events.auth.emitSuccess(this.currentUser);
        
        logger.auth('coordinator', 'sign_in_complete', 'success', {
          provider: selectedProvider,
          userEmail: result.user.email
        });

        return { success: true, user: this.currentUser };
      } else if (result && result.error) {
        throw new Error(result.error);
      } else {
        logger.warn('Unexpected auth result format', { result, provider: selectedProvider });
        throw new Error('Authentication failed - unexpected result format');
      }
      
    } catch (error) {
      logger.auth('coordinator', 'sign_in_complete', 'error', {
        provider: selectedProvider,
        error: error.message
      });

      // Handle cancellation gracefully
      if (error.message === 'CANCELLED') {
        this.showAuthUI(); // Show UI again
        return { success: false, cancelled: true };
      }

      // Handle Fire TV fallback
      if (this.platform.platform === 'fire_tv' && selectedProvider === 'native_android') {
        logger.info('Native auth failed on Fire TV, trying device flow');
        return await this.signIn('device_flow');
      }

      events.auth.emitFailure(error);
      this.ui.showAuthError(error.message);
      
      throw error;
    }
  }

  /**
   * Sign out current user
   * @returns {Promise<void>}
   */
  async signOut() {
    logger.auth('coordinator', 'sign_out', 'pending', {
      userEmail: this.currentUser?.email,
      provider: this.currentProvider?.getProviderInfo?.()?.name
    });

    try {
      // Sign out from current provider
      if (this.currentProvider && this.currentProvider.signOut) {
        this.currentProvider.signOut();
      }

      // Clear local state
      this.currentUser = null;
      this.isAuthenticated = false;
      this.currentProvider = null;
      
      // Clear storage
      this.storage.clearSavedUser();
      
      events.auth.emitSignout();
      
      logger.auth('coordinator', 'sign_out', 'success');
      
      // Show auth UI again
      this.showAuthUI();
      
    } catch (error) {
      logger.auth('coordinator', 'sign_out', 'error', error.message);
      
      // Clear local state even if provider sign-out fails
      this.currentUser = null;
      this.isAuthenticated = false;
      this.currentProvider = null;
      this.storage.clearSavedUser();
      
      throw error;
    }
  }

  /**
   * Set authenticated user and update state
   * UPDATED: No longer accepts or stores supabaseAuthId
   * @param {Object} userData - User data object
   * @param {Object} provider - Auth provider instance
   */
  setAuthenticatedUser(userData, provider) {
    // Build user object with explicit fields
    this.currentUser = {
      email: userData.email,
      name: userData.name,
      picture: userData.picture,
      authMethod: userData.authMethod,
      googleAccessToken: userData.googleAccessToken,
      signedInAt: Date.now()
    };
    
    this.isAuthenticated = true;
    this.currentProvider = provider;
    
    if (this.ui) {
      this.ui.showSignedInState();
    }
    
    logger.success('User authentication state updated', {
      userEmail: userData.email,
      authMethod: userData.authMethod,
      hasGoogleToken: !!userData.googleAccessToken
    });
  }

  /**
   * Show appropriate authentication UI
   */
  showAuthUI() {
    if (!this.ui) return;

    const recommendedProvider = this.getRecommendedProvider();
    
    if (this.platform.isWebView() && !this.platform.hasNativeCapabilities()) {
      // WebView without native auth - show WebView prompt
      logger.debug('Showing WebView auth prompt');
      this.ui.showWebViewAuthPrompt(
        () => this.createWebViewUser(),
        () => this.exitApp()
      );
    } else {
      // Normal sign-in prompt
      logger.debug('Showing sign-in prompt', { recommendedProvider });
      this.ui.showSignInPrompt(
        () => this.signIn(),
        () => this.exitApp()
      );
    }
  }

  /**
   * Create mock user for WebView environments
   */
  createWebViewUser() {
    logger.info('Creating WebView mock user');
    
    const mockUser = {
      name: 'Dashie User',
      email: 'user@dashie.app',
      picture: 'icons/icon-profile-round.svg',
      authMethod: 'webview_mock'
    };
    
    this.setAuthenticatedUser(mockUser, null);
    this.storage.saveUser(this.currentUser);
    
    events.auth.emitSuccess(this.currentUser);
  }

  /**
   * Exit the application
   */
  exitApp() {
    logger.info('Exiting application');
    
    if (this.platform.hasNativeCapabilities() && window.DashieNative?.exitApp) {
      window.DashieNative.exitApp();
    } else if (window.close) {
      window.close();
    } else {
      window.location.href = 'about:blank';
    }
  }

  /**
   * Get current Google access token
   * @returns {string|null} Current access token
   */
  getGoogleAccessToken() {
    // First try from current user data
    if (this.currentUser?.googleAccessToken) {
      return this.currentUser.googleAccessToken;
    }
    
    // Then try from current provider
    if (this.currentProvider?.getAccessToken) {
      return this.currentProvider.getAccessToken();
    }
    
    return null;
  }

  /**
   * Refresh Google access token if possible
   * @returns {Promise<string>} Refreshed access token
   */
  async refreshGoogleToken() {
    if (!this.currentProvider) {
      throw new Error('No auth provider available for token refresh');
    }

    if (this.currentProvider.refreshToken) {
      const refreshToken = this.currentProvider.getRefreshToken();
      if (refreshToken) {
        logger.info('Refreshing Google access token');
        const newTokens = await this.currentProvider.refreshToken(refreshToken);
        
        // Update current user with new token
        if (this.currentUser && newTokens.access_token) {
          this.currentUser.googleAccessToken = newTokens.access_token;
          
          // Save updated user data
          this.storage.saveUser(this.currentUser);
        }
        
        return newTokens.access_token;
      }
    }

    throw new Error('Token refresh not supported or no refresh token available');
  }

  /**
   * Get current user
   * @returns {Object|null} Current user data
   */
  getUser() {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} True if authenticated
   */
  isUserAuthenticated() {
    return this.isAuthenticated && !!this.currentUser;
  }

  /**
   * Get auth system status and diagnostics
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isAuthenticated: this.isAuthenticated,
      currentUser: this.currentUser ? {
        email: this.currentUser.email,
        authMethod: this.currentUser.authMethod
      } : null,
      platform: {
        current: this.platform.platform,
        deviceType: this.platform.deviceType,
        recommendedFlow: this.platform.getRecommendedAuthFlow()
      },
      providers: Object.keys(this.providers).map(name => ({
        name,
        available: !!this.providers[name],
        info: this.providers[name]?.getProviderInfo?.() || {}
      })),
      currentProvider: this.currentProvider?.getProviderInfo?.() || null
    };
  }
}