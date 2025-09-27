// js/testing/jwt-storage-integration.js
// CHANGE SUMMARY: Phase 2 integration script to enable JWT mode in existing storage system

import { createLogger } from '../utils/logger.js';

const logger = createLogger('JWTStorageIntegration');

/**
 * Phase 2 JWT Storage Integration
 * Enables JWT mode in existing storage instances
 */
export class JWTStorageIntegration {
  constructor() {
    this.isIntegrated = false;
    this.storageInstances = [];
    
    logger.info('JWT Storage Integration initialized');
  }

  /**
   * Integrate JWT with existing storage system
   */
  async integrate() {
    if (this.isIntegrated) {
      logger.debug('JWT storage integration already completed');
      return;
    }

    try {
      logger.info('🚀 Starting JWT storage integration...');

      // Wait for settings system to be ready
      await this.waitForSettingsSystem();

      // Find and update storage instances
      await this.updateStorageInstances();

      // Set up global controls
      this.setupGlobalControls();

      this.isIntegrated = true;
      
      logger.success('✅ JWT storage integration complete!');
      logger.info('💡 Use enableJWTStorage(), disableJWTStorage(), testJWTStorage()');

    } catch (error) {
      logger.error('❌ JWT storage integration failed', error);
    }
  }

  /**
   * Wait for settings system to be ready
   */
  async waitForSettingsSystem() {
    const maxWait = 10000; // 10 seconds
    const checkInterval = 500;
    const startTime = Date.now();

    logger.debug('Waiting for settings system...');

    while (Date.now() - startTime < maxWait) {
      // Check for settings system
      if (window.settingsController || window.settingsInstance) {
        logger.success('Settings system detected');
        return;
      }

      // Check for global settings functions
      if (typeof window.showSettings === 'function') {
        logger.success('Settings functions detected');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    logger.warn('Settings system not detected within timeout');
  }

  /**
   * Find and update existing storage instances
   */
  async updateStorageInstances() {
    logger.debug('Looking for storage instances to update...');

    // Check settings controller
    if (window.settingsController?.storage) {
      await this.updateStorageInstance(window.settingsController.storage, 'settingsController');
    }

    // Check settings instance
    if (window.settingsInstance?.controller?.storage) {
      await this.updateStorageInstance(window.settingsInstance.controller.storage, 'settingsInstance');
    }

    // Check for direct storage instances
    if (window.supabaseStorage) {
      await this.updateStorageInstance(window.supabaseStorage, 'global');
    }

    logger.info(`Updated ${this.storageInstances.length} storage instances`);
  }

  /**
   * Update a specific storage instance
   * @param {Object} storage - Storage instance to update
   * @param {string} source - Source identifier
   */
  async updateStorageInstance(storage, source) {
    try {
      // Check if this is a SimpleSupabaseStorage instance
      if (storage && typeof storage.setJWTMode === 'function') {
        logger.info(`Updating storage instance from ${source}`);
        
        // Initialize JWT service if needed
        if (typeof storage.initializeJWTService === 'function') {
          await storage.initializeJWTService();
        }

        // Enable JWT mode if JWT service is ready
        const jwtStatus = storage.getJWTStatus();
        if (jwtStatus.jwtReady) {
          storage.setJWTMode(true);
          logger.success(`JWT enabled for ${source} storage`);
        } else {
          logger.warn(`JWT not ready for ${source} storage`, jwtStatus);
        }

        this.storageInstances.push({
          storage,
          source,
          jwtEnabled: jwtStatus.jwtReady
        });

      } else {
        logger.debug(`Storage instance from ${source} does not support JWT`);
      }

    } catch (error) {
      logger.error(`Failed to update storage instance from ${source}`, error);
    }
  }

  /**
   * Set up global control functions
   */
  setupGlobalControls() {
    // Global JWT storage enable/disable
    window.enableJWTStorage = () => {
      logger.info('🔐 Enabling JWT storage globally...');
      let enabledCount = 0;

      this.storageInstances.forEach(({ storage, source }) => {
        try {
          storage.setJWTMode(true);
          enabledCount++;
          logger.debug(`JWT enabled for ${source}`);
        } catch (error) {
          logger.error(`Failed to enable JWT for ${source}`, error);
        }
      });

      logger.success(`JWT storage enabled for ${enabledCount} instances`);
      return enabledCount;
    };

    window.disableJWTStorage = () => {
      logger.info('🔓 Disabling JWT storage globally...');
      let disabledCount = 0;

      this.storageInstances.forEach(({ storage, source }) => {
        try {
          storage.setJWTMode(false);
          disabledCount++;
          logger.debug(`JWT disabled for ${source}`);
        } catch (error) {
          logger.error(`Failed to disable JWT for ${source}`, error);
        }
      });

      logger.success(`JWT storage disabled for ${disabledCount} instances`);
      return disabledCount;
    };

    window.testJWTStorage = async () => {
      logger.info('🧪 Testing JWT storage...');
      
      const results = [];
      
      for (const { storage, source } of this.storageInstances) {
        try {
          const testResult = await storage.testConnection();
          results.push({
            source,
            ...testResult
          });
          
          logger.info(`${source} test: ${testResult.success ? '✅' : '❌'}`, testResult);
        } catch (error) {
          results.push({
            source,
            success: false,
            error: error.message
          });
          
          logger.error(`${source} test failed`, error);
        }
      }

      console.table(results);
      return results;
    };

    window.jwtStorageStatus = () => {
      logger.info('📊 JWT Storage Status:');
      
      const status = this.storageInstances.map(({ storage, source }) => {
        const storageStatus = storage.getStatus();
        return {
          source,
          ...storageStatus
        };
      });

      console.table(status);
      return status;
    };

    logger.debug('Global JWT storage controls configured');
  }

  /**
   * Get integration status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isIntegrated: this.isIntegrated,
      storageInstanceCount: this.storageInstances.length,
      storageInstances: this.storageInstances.map(({ source, jwtEnabled }) => ({
        source,
        jwtEnabled
      }))
    };
  }
}

// Auto-initialize
let jwtStorageIntegration = null;

/**
 * Initialize JWT storage integration
 */
export async function initializeJWTStorageIntegration() {
  if (jwtStorageIntegration) {
    return jwtStorageIntegration;
  }

  jwtStorageIntegration = new JWTStorageIntegration();
  await jwtStorageIntegration.integrate();
  
  return jwtStorageIntegration;
}

// Auto-initialize with delay
setTimeout(async () => {
  try {
    await initializeJWTStorageIntegration();
  } catch (error) {
    console.warn('JWT storage integration failed (non-critical):', error.message);
  }
}, 5000); // 5 second delay to ensure settings system is ready