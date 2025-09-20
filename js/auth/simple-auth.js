// js/auth/simple-auth.js - Refactored Auth Entry Point
// CHANGE SUMMARY: Complete rewrite using new modular architecture with auth coordinator, data manager, and widget messenger

import { createLogger, configureLogging } from '../utils/logger.js';
import { LOGGING_CONFIG } from './auth-config.js';
import { events, EVENTS } from '../utils/event-emitter.js';

import { AuthCoordinator } from '../apis/api-auth/auth-coordinator.js';
import { AuthStorage } from '../apis/api-auth/auth-storage.js';
import { AuthUI } from '../apis/api-auth/auth-ui.js';

import { initializeAPIs } from '../apis/api-index.js';
import { DataManager } from '../services/data-manager.js';
import { WidgetMessenger } from '../services/widget-messenger.js';

// Configure logging system
configureLogging(LOGGING_CONFIG);

const logger = createLogger('SimpleAuth');

/**
 * Simplified authentication wrapper using new modular architecture
 * Provides backward-compatible API while using refactored components
 */
export class SimpleAuth {
  constructor() {
    this.isInitialized = false;
    this.isAuthenticated = false;
    
    // Core components
    this.authStorage = null;
    this.authUI = null;
    this.authCoordinator = null;
    this.apis = null;
    this.dataManager = null;
    this.widgetMessenger = null;
    
    // Initialize immediately
    this.init();
  }

  /**
   * Initialize the authentication system
   * @returns {Promise<void>}
   */
  async init() {
    logger.info('Initializing Dashie authentication system');
    
    try {
      // Initialize core auth components
      this.authStorage = new AuthStorage();
      this.authUI = new AuthUI();
      this.authCoordinator = new AuthCoordinator(this.authStorage, this.authUI);
      
      // Initialize the auth system
      const authResult = await this.authCoordinator.init();
      
      if (authResult.authenticated) {
        this.isAuthenticated = true;
        await this.initializeServices();
      }
      
      // Set up event listeners
      this.setupEventListeners();
      
      this.isInitialized = true;
      
      logger.success('Dashie authentication system initialized', {
        authenticated: this.isAuthenticated,
        userId: this.authCoordinator.currentUser?.id
      });
      
      // Emit auth ready event for main.js
      document.dispatchEvent(new CustomEvent('dashie-auth-ready', {
        detail: { 
          authenticated: this.isAuthenticated,
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
   * Initialize services after successful authentication
   * @returns {Promise<void>}
   */
  async initializeServices() {
    logger.info('Initializing authenticated services');
    
    try {
      // Initialize APIs
      this.apis = initializeAPIs(this.authCoordinator);
      
      // Initialize data manager
      this.dataManager = new DataManager(this.apis.google);
      await this.dataManager.init();
      
      // Initialize widget messenger
      this.widgetMessenger = new WidgetMessenger(this.dataManager);
      
      // Test APIs and broadcast to widgets
      const apiStatus = await this.apis.google.testAccess();
      this.widgetMessenger.broadcastGoogleAPIsReady(
        apiStatus, 
        this.authCoordinator.getGoogleAccessToken()
      );
      
      logger.success('All services initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize services', error);
      throw error;
    }
  }

  /**
   * Set up event listeners for auth and data events
   */
  setupEventListeners() {
    // Auth events
    events.auth.onSuccess(async (user) => {
      logger.info('Authentication successful, initializing services');
      this.isAuthenticated = true;
      await this.initializeServices();
      
      // Emit auth ready event
      document.dispatchEvent(new CustomEvent('dashie-auth-ready', {
        detail: { authenticated: true, user }
      }));
    });

    events.auth.onFailure((error) => {
      logger.error('Authentication failed', error);
      this.isAuthenticated = false;
    });

    events.auth.onSignout(() => {
      logger.info('User signed out, cleaning up services');
      this.isAuthenticated = false;
      this.cleanupServices();
    });

    // Data events
    events.data.onLoaded((dataType, data) => {
      if (this.widgetMessenger) {
        this.widgetMessenger.broadcastDataUpdate(dataType, data);
      }
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

  // ==================== PUBLIC API (BACKWARD COMPATIBILITY) ====================

  /**
   * Get current user
   * @returns {Object|null} Current user data
   */
  getUser() {
    return this.authCoordinator?.getUser() || null;
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} True if authenticated
   */
  isUserAuthenticated() {
    return this.isAuthenticated && this.authCoordinator?.isUserAuthenticated();
  }

  /**
   * Get Google access token
   * @returns {string|null} Current Google access token
   */
  getGoogleAccessToken() {
    return this.authCoordinator?.getGoogleAccessToken() || null;
  }

  /**
   * Sign out current user
   * @returns {Promise<void>}
   */
  async signOut() {
    if (this.authCoordinator) {
      await this.authCoordinator.signOut();
    }
  }

  /**
   * Exit the application
   */
  exitApp() {
    if (this.authCoordinator) {
      this.authCoordinator.exitApp();
    }
  }

  /**
   * Force refresh all data
   * @returns {Promise<void>}
   */
  async refreshData() {
    if (this.dataManager) {
      await this.dataManager.refreshAllData();
    }
  }

  /**
   * Get system status for debugging
   * @returns {Object} Complete system status
   */
  getSystemStatus() {
    return {
      isInitialized: this.isInitialized,
      isAuthenticated: this.isAuthenticated,
      auth: this.authCoordinator?.getStatus() || null,
      data: this.dataManager?.getStatus() || null,
      widgets: this.widgetMessenger?.getStatus() || null,
      apis: this.apis ? Object.keys(this.apis) : []
    };
  }

  // ==================== DEPRECATED METHODS (FOR COMPATIBILITY) ====================

  /**
   * @deprecated Use isUserAuthenticated() instead
   */
  isAuthenticated() {
    logger.warn('isAuthenticated() is deprecated, use isUserAuthenticated()');
    return this.isUserAuthenticated();
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
    isAuthenticated: () => dashieAuthInstance.isUserAuthenticated(),
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
