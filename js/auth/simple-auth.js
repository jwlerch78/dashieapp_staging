// js/auth/simple-auth.js
// CHANGE SUMMARY: Replaced silent JWT token fallback with explicit dependency check and fail-fast error handling in initializeServices()

import { createLogger } from '../utils/logger.js';
import { initializeAPIs } from '../apis/api-index.js';
import { AuthCoordinator } from '../apis/api-auth/auth-coordinator.js';
import { AuthStorage } from '../apis/api-auth/auth-storage.js';
import { AuthUI } from '../apis/api-auth/auth-ui.js';
import { DataManager } from '../services/data-manager.js';
import { WidgetMessenger } from '../services/widget-messenger.js';
import { events as eventSystem, EVENTS } from '../utils/event-emitter.js';

const logger = createLogger('SimpleAuth');

/**
 * Simplified authentication system - single entry point
 * Clean interface for authentication, APIs, and data management
 */
export class SimpleAuth {
  constructor() {
    this.isInitialized = false;
    this.authenticated = false;
    this.apis = null;
    this.dataManager = null;
    this.widgetMessenger = null;
    
    logger.info('Initializing Dashie authentication system');
    
    try {
      // Initialize core auth components in correct order
      this.authStorage = new AuthStorage();
      this.authUI = new AuthUI();
      // FIXED: Pass storage and UI to AuthCoordinator constructor
      this.authCoordinator = new AuthCoordinator(this.authStorage, this.authUI);
      
      logger.debug('Auth components initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize auth components', error);
      // Set fallback objects to prevent crashes
      this.authCoordinator = null;
      this.authStorage = null;
      this.authUI = null;
    }
    
    // Auto-initialize
    setTimeout(() => this.init(), 0);
  }

  /**
 * Initialize authentication system
 * NOTE: This now only handles auth, NOT service initialization
 * Call initializeServices() separately after JWT is ready
 * @returns {Promise<void>}
 */
async init() {
  if (this.isInitialized) {
    logger.debug('Auth system already initialized');
    return;
  }

  try {
    // Initialize auth coordinator (handles providers and OAuth flows)
    const authResult = await this.authCoordinator.init();
    
    // Check for saved user in localStorage for immediate settings initialization
    const savedUser = this.authStorage ? this.authStorage.getSavedUser() : null;
    if (savedUser && !authResult.authenticated) {
      // Emit auth ready event even if not fully authenticated
      document.dispatchEvent(new CustomEvent('dashie-auth-ready', {
        detail: { 
          authenticated: false,
          user: savedUser,
          fromStorage: true
        }
      }));
    }

    if (authResult.authenticated) {
      this.authenticated = true;
      // REMOVED: await this.initializeServices();
      // Services will be initialized by main.js AFTER JWT is ready
      logger.info('✅ Authentication complete - services will be initialized after JWT is ready');
    }
    
    // Set up event listeners
    this.setupEventListeners();
    
    this.isInitialized = true;
    
    logger.success('Dashie authentication system initialized', {
      authenticated: this.authenticated,
      userId: this.authCoordinator.currentUser?.id,
      servicesInitialized: false // Will be initialized separately
    });
    
    // Emit auth ready event for main.js
    document.dispatchEvent(new CustomEvent('dashie-auth-ready', {
      detail: { 
        authenticated: this.authenticated,
        user: this.authCoordinator.currentUser 
      }
    }));
    
  } catch (error) {
    logger.error('Failed to initialize authentication system', error);
    this.isInitialized = true; // Mark as initialized even on error
    throw error;
  }
}

  /**
   * Wait for JWT service to be ready with timeout
   * @private
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<boolean>} True if JWT is ready
   * @throws {Error} If timeout reached or JWT never becomes ready
   */
  async _waitForJWTService(timeoutMs = 10000) {
    const startTime = Date.now();
    
    logger.debug('Waiting for JWT service to be ready...', { timeoutMs });
    
    while (Date.now() - startTime < timeoutMs) {
      if (window.jwtAuth && window.jwtAuth.isServiceReady()) {
        logger.success('JWT service is ready');
        return true;
      }
      
      // Check every 100ms
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`JWT service not ready after ${timeoutMs}ms timeout`);
  }

/**
 * Initialize services after successful authentication - FAIL FAST approach
 * No silent fallbacks - either services initialize with valid token or throw clear error
 * @returns {Promise<void>}
 * @throws {Error} If JWT token cannot be obtained or services fail to initialize
 */
async initializeServices() {
  logger.info('Initializing authenticated services');
  
  try {
    // CRITICAL: Wait for JWT service to be ready
    if (!window.jwtAuth || !window.jwtAuth.isServiceReady()) {
      logger.warn('JWT service not immediately available, waiting...');
      await this._waitForJWTService(10000);
    }

    // CRITICAL: Get valid token before initializing services
    logger.info('⏳ Retrieving valid token before service initialization...');
    
    let tokenResult;
    try {
      tokenResult = await window.jwtAuth.getValidToken('google', 'personal');
    } catch (error) {
      logger.error('JWT token retrieval failed', error);
      throw new Error(`Cannot initialize services: Failed to retrieve valid token - ${error.message}`);
    }
    
    // Validate token result
    if (!tokenResult) {
      throw new Error('Cannot initialize services: JWT service returned null/undefined token result');
    }
    
    if (!tokenResult.success) {
      throw new Error(`Cannot initialize services: JWT service reported failure - ${tokenResult.error || 'Unknown error'}`);
    }
    
    if (!tokenResult.access_token) {
      throw new Error('Cannot initialize services: JWT service returned success but no access_token provided');
    }
    
    // Token is valid - proceed with initialization
    logger.success('✅ JWT token ready - safe to initialize services', {
      tokenEnding: tokenResult.access_token.slice(-10),
      refreshed: tokenResult.refreshed
    });
    
    // Initialize APIs
    this.apis = initializeAPIs(this.authCoordinator);
    
    // Initialize data manager in MANUAL TRIGGER mode
    this.dataManager = new DataManager(this.apis.google);
    await this.dataManager.init(true); // true = manual trigger mode
    
    // Expose data manager globally for manual triggering
    window.dataManager = this.dataManager;
    
    // Initialize widget messenger
    this.widgetMessenger = new WidgetMessenger(this.dataManager);
         
    logger.success('All services initialized successfully');
    
  } catch (error) {
    logger.error('Failed to initialize services', error);
    throw error;
  }
} 

  /**
   * Manually trigger data loading (for use after widget registration)
   * @returns {Promise<void>}
   */
  async triggerDataLoading() {
    if (!this.dataManager) {
      logger.warn('Data manager not initialized, cannot trigger data loading');
      return;
    }

    if (!this.dataManager.isReadyForManualTrigger()) {
      logger.warn('Data manager not ready for manual trigger');
      return;
    }

    logger.info('Triggering manual data loading...');
    await this.dataManager.triggerDataLoading();
  }

  /**
   * Set up event listeners for auth and data events
   */
  setupEventListeners() {
    // Auth events
    eventSystem.auth.onSuccess(async (user) => {
      logger.info('Authentication successful, initializing services');
      this.authenticated = true;
      await this.initializeServices();
      
      // Emit auth ready event
      document.dispatchEvent(new CustomEvent('dashie-auth-ready', {
        detail: { authenticated: true, user }
      }));
    });

    eventSystem.auth.onFailure((error) => {
      logger.error('Authentication failed', error);
      this.authenticated = false;
    });

    eventSystem.auth.onSignout(() => {
      logger.info('User signed out, cleaning up services');
      this.authenticated = false;
      this.cleanupServices();
    });

    logger.debug('Event listeners configured');
  }

  /**
   * Clean up services on sign out
   */
  cleanupServices() {
    if (this.dataManager) {
      this.dataManager.clearCache();
      this.dataManager = null;
    }

    if (this.widgetMessenger) {
      this.widgetMessenger.cleanup();
      this.widgetMessenger = null;
    }

    this.apis = null;
    
    logger.debug('Services cleaned up');
  }

  // ==================== PUBLIC API ====================

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return this.authenticated && this.authCoordinator?.isAuthenticated;
  }

  /**
   * Check if user is authenticated (alternative method name)
   * @returns {boolean}
   */
  isUserAuthenticated() {
    return this.isAuthenticated();
  }

  /**
   * Get current user
   * @returns {Object|null}
   */
  getUser() {
    return this.authCoordinator?.currentUser || null;
  }

  /**
   * Get current user (alternative method name)
   * @returns {Object|null}
   */
  getCurrentUser() {
    return this.getUser();
  }

  /**
   * Get Google access token
   * @returns {string|null}
   */
  getGoogleAccessToken() {
    return this.authCoordinator?.getGoogleAccessToken() || null;
  }

  /**
   * Sign out user
   * @returns {Promise<void>}
   */
  async signOut() {
    if (this.authCoordinator) {
      await this.authCoordinator.signOut();
    }
  }

  /**
   * Exit application (for TV platforms)
   */
  exitApp() {
    if (this.authCoordinator) {
      this.authCoordinator.exitApp();
    }
  }
  /**
   * Get available APIs
   * @returns {Object}
   */
  getAPIs() {
    return {
      google: this.apis?.google || null,
      available: this.apis ? Object.keys(this.apis) : []
    };
  }
}

// ==================== GLOBAL INITIALIZATION ====================

let dashieAuthInstance = null;

/**
 * Initialize global auth instance
 * @returns {SimpleAuth} Auth instance
 */
function initializeAuth() {
  if (dashieAuthInstance) {
    logger.debug('Auth instance already exists, returning existing instance');
    return dashieAuthInstance;
  }

  logger.info('Creating new Dashie auth instance');
  
  dashieAuthInstance = new SimpleAuth();
  
  // Expose globally for backward compatibility
  window.dashieAuth = dashieAuthInstance;
  
  // Also expose auth manager for compatibility
  window.authManager = {
    getUser: () => dashieAuthInstance.getUser(),
    isAuthenticated: () => dashieAuthInstance.isAuthenticated(),
    getGoogleAccessToken: () => dashieAuthInstance.getGoogleAccessToken(),
    signOut: () => dashieAuthInstance.signOut(),
    exitApp: () => dashieAuthInstance.exitApp()
  };
  
  logger.success('Global auth instance created and exposed');
  
  return dashieAuthInstance;
}

// Initialize based on document ready state
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAuth);
} else {
  // DOM is already ready
  setTimeout(initializeAuth, 0);
}

// Also initialize immediately for module imports
const authInstance = initializeAuth();

// Export for module use
export { SimpleAuth as default, authInstance as dashieAuth };