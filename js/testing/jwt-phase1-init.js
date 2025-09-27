// js/testing/jwt-phase1-init.js
// CHANGE SUMMARY: Phase 1 initialization for JWT testing - safe integration with existing system

import { createLogger } from '../utils/logger.js';
import { initializeJWTIntegration } from '../settings/jwt-settings-integration.js';

const logger = createLogger('JWTPhase1Init');

/**
 * Phase 1 JWT Integration Initializer
 * Safely adds JWT testing capabilities without affecting existing functionality
 */
class JWTPhase1Initializer {
  constructor() {
    this.isInitialized = false;
    this.integrationInstance = null;
    
    logger.info('JWT Phase 1 Initializer created');
  }

  /**
   * Initialize JWT Phase 1 testing
   */
  async initialize() {
    if (this.isInitialized) {
      logger.debug('JWT Phase 1 already initialized');
      return;
    }

    try {
      logger.info('🚀 Starting JWT Phase 1 initialization...');
      
      // Wait for auth system to be ready
      await this.waitForAuthSystem();
      
      // Initialize JWT testing integration
      this.integrationInstance = await initializeJWTIntegration();
      
      // Set up global access for debugging
      this.setupGlobalAccess();
      
      // Add console commands for easy testing
      this.setupConsoleCommands();
      
      this.isInitialized = true;
      
      logger.success('✅ JWT Phase 1 initialization complete!');
      logger.info('🔧 JWT testing controls are now available in Settings');
      logger.info('💡 Use console commands: testJWT(), enableJWT(), disableJWT()');
      
    } catch (error) {
      logger.error('❌ JWT Phase 1 initialization failed', error);
      // Don't throw - let app continue normally
    }
  }

  /**
   * Wait for auth system to be ready
   * @returns {Promise<void>}
   */
  async waitForAuthSystem() {
    const maxWait = 30000; // 30 seconds max
    const checkInterval = 500; // Check every 500ms
    const startTime = Date.now();

    logger.debug('Waiting for auth system to be ready...');

    while (Date.now() - startTime < maxWait) {
      // Check for auth system
      if (window.dashieAuth || window.authManager) {
        const authSystem = window.dashieAuth || window.authManager;
        
        // Check if user is authenticated
        if (authSystem.isAuthenticated && authSystem.isAuthenticated()) {
          logger.success('Auth system ready and user authenticated');
          return;
        }
        
        // Check if auth system is at least initialized
        if (authSystem.getUser || authSystem.isInitialized) {
          logger.info('Auth system available (user may not be authenticated yet)');
          return;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    logger.warn('Auth system not detected within timeout, proceeding anyway');
  }

  /**
   * Set up global access for debugging
   */
  setupGlobalAccess() {
    // Add to window for easy debugging
    window.jwtPhase1 = {
      initializer: this,
      integration: this.integrationInstance,
      jwtService: this.integrationInstance?.getJWTService(),
      
      // Convenience methods
      getStatus: () => this.getStatus(),
      runTests: () => this.runAllTests(),
      enable: () => this.enableJWT(),
      disable: () => this.disableJWT()
    };

    logger.debug('Global JWT Phase 1 access configured (window.jwtPhase1)');
  }

  /**
   * Set up console commands for easy testing
   */
  setupConsoleCommands() {
    // Global convenience functions
    window.testJWT = async () => {
      console.log('🧪 Running JWT tests...');
      return await this.runAllTests();
    };

    window.enableJWT = () => {
      console.log('🔐 Enabling JWT mode...');
      return this.enableJWT();
    };

    window.disableJWT = () => {
      console.log('🔓 Disabling JWT mode...');
      return this.disableJWT();
    };

    window.jwtStatus = () => {
      console.log('📊 JWT Status:');
      const status = this.getStatus();
      console.table(status);
      return status;
    };

    logger.debug('Console commands configured: testJWT(), enableJWT(), disableJWT(), jwtStatus()');
  }

  /**
   * Enable JWT mode
   */
  enableJWT() {
    try {
      const jwtService = this.integrationInstance?.getJWTService();
      if (jwtService) {
        jwtService.setEnabled(true);
        logger.success('JWT mode enabled');
        return true;
      } else {
        logger.error('JWT service not available');
        return false;
      }
    } catch (error) {
      logger.error('Failed to enable JWT mode', error);
      return false;
    }
  }

  /**
   * Disable JWT mode
   */
  disableJWT() {
    try {
      const jwtService = this.integrationInstance?.getJWTService();
      if (jwtService) {
        jwtService.setEnabled(false);
        logger.success('JWT mode disabled');
        return true;
      } else {
        logger.error('JWT service not available');
        return false;
      }
    } catch (error) {
      logger.error('Failed to disable JWT mode', error);
      return false;
    }
  }

  /**
   * Get current status
   * @returns {Object} Status information
   */
  getStatus() {
    const jwtService = this.integrationInstance?.getJWTService();
    
    const status = {
      phase1Initialized: this.isInitialized,
      integrationAvailable: !!this.integrationInstance,
      jwtServiceAvailable: !!jwtService,
      authSystemAvailable: !!(window.dashieAuth || window.authManager),
      ...( jwtService ? jwtService.getStatus() : {} )
    };

    return status;
  }

  /**
   * Run all JWT tests
   * @returns {Promise<Object>} Test results
   */
  async runAllTests() {
    const jwtTesting = this.integrationInstance?.jwtTesting;
    
    if (!jwtTesting) {
      logger.error('JWT testing interface not available');
      return { success: false, error: 'JWT testing not available' };
    }

    const results = {
      connection: null,
      load: null,
      save: null
    };

    try {
      logger.info('Running JWT connection test...');
      results.connection = await jwtTesting.jwtService.testConnection();
      
      if (results.connection.success) {
        logger.info('Running JWT load test...');
        const user = window.dashieAuth?.getUser() || window.authManager?.getUser();
        if (user?.email) {
          try {
            const settings = await jwtTesting.jwtService.loadSettings(user.email);
            results.load = { success: true, hasSettings: !!settings };
          } catch (error) {
            results.load = { success: false, error: error.message };
          }
        } else {
          results.load = { success: false, error: 'No user email available' };
        }

        logger.info('Running JWT save test...');
        if (user?.email) {
          try {
            const testData = { jwtTest: { timestamp: new Date().toISOString() } };
            const saved = await jwtTesting.jwtService.saveSettings(user.email, testData);
            results.save = { success: saved };
          } catch (error) {
            results.save = { success: false, error: error.message };
          }
        } else {
          results.save = { success: false, error: 'No user email available' };
        }
      }

      logger.success('JWT tests completed', results);
      return results;

    } catch (error) {
      logger.error('JWT tests failed', error);
      return { success: false, error: error.message, results };
    }
  }
}

// Create global instance
let jwtPhase1Instance = null;

/**
 * Initialize JWT Phase 1
 * @returns {Promise<JWTPhase1Initializer>} Initializer instance
 */
export async function initializeJWTPhase1() {
  if (jwtPhase1Instance) {
    logger.debug('JWT Phase 1 already initialized');
    return jwtPhase1Instance;
  }

  jwtPhase1Instance = new JWTPhase1Initializer();
  await jwtPhase1Instance.initialize();
  
  return jwtPhase1Instance;
}

/**
 * Get JWT Phase 1 instance
 * @returns {JWTPhase1Initializer|null} Initializer instance
 */
export function getJWTPhase1() {
  return jwtPhase1Instance;
}

// Auto-initialize with delay to ensure other systems are ready
const initDelay = 2000; // 2 seconds

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => initializeJWTPhase1(), initDelay);
  });
} else {
  // DOM is already ready
  setTimeout(() => initializeJWTPhase1(), initDelay);
}

// Export for manual initialization
export { JWTPhase1Initializer, initializeJWTPhase1 as default };