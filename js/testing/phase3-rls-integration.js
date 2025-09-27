// js/testing/phase3-rls-integration.js
// CHANGE SUMMARY: Phase 3 - Enable RLS and integrate JWT storage into existing settings system

import { createLogger } from '../utils/logger.js';

const logger = createLogger('Phase3RLS');

/**
 * Phase 3 RLS Integration
 * Enables RLS and integrates JWT storage with existing settings system
 */
export class Phase3RLSIntegration {
  constructor() {
    this.isActive = false;
    this.originalStorage = null;
    this.jwtStorage = null;
    this.settingsController = null;
    
    logger.info('Phase 3 RLS Integration initialized');
  }

  /**
   * Enable Phase 3 - RLS + JWT Default Mode
   */
  async enablePhase3() {
    if (this.isActive) {
      logger.info('Phase 3 already active');
      return { success: true, message: 'Phase 3 already enabled' };
    }

    try {
      logger.info('🚀 Starting Phase 3: RLS + JWT Default Mode...');

      // Step 1: Create JWT-enabled storage instance
      await this.createJWTStorage();

      // Step 2: Find and backup existing settings system
      await this.backupExistingSettings();

      // Step 3: Replace storage in settings system
      await this.replaceSettingsStorage();

      // Step 4: Test the integration
      const testResult = await this.testIntegration();

      if (testResult.success) {
        this.isActive = true;
        logger.success('✅ Phase 3 enabled successfully!');
        
        return {
          success: true,
          message: 'Phase 3 active - JWT is now default for all settings',
          testResult
        };
      } else {
        await this.rollback();
        throw new Error(`Integration test failed: ${testResult.error}`);
      }

    } catch (error) {
      logger.error('❌ Phase 3 activation failed', error);
      await this.rollback();
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create JWT-enabled storage instance
   */
  async createJWTStorage() {
    logger.info('Creating JWT-enabled storage instance...');

    const user = window.dashieAuth?.getUser() || window.authManager?.getUser();
    if (!user) {
      throw new Error('No authenticated user found');
    }

    // Import enhanced storage
    const { SimpleSupabaseStorage } = await import('../supabase/simple-supabase-storage.js');
    
    // Create JWT-enabled instance
    this.jwtStorage = new SimpleSupabaseStorage(user.id, user.email);
    
    // Wait for JWT initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Enable JWT mode
    this.jwtStorage.setJWTMode(true);
    
    // Verify JWT is ready
    const status = this.jwtStorage.getJWTStatus();
    if (!status.useJWT) {
      throw new Error('JWT storage not ready');
    }

    logger.success('JWT storage instance created and enabled', status);
  }

  /**
   * Backup existing settings system
   */
  async backupExistingSettings() {
    logger.info('Backing up existing settings system...');

    // Find settings controller in various locations
    this.settingsController = this.findSettingsController();
    
    if (this.settingsController && this.settingsController.storage) {
      this.originalStorage = this.settingsController.storage;
      logger.success('Settings controller and storage backed up');
    } else {
      logger.warn('No existing settings controller found - will create integration point');
    }
  }

  /**
   * Find settings controller in the system
   */
  findSettingsController() {
    // Try various global locations
    if (window.settingsController) {
      logger.debug('Found settings controller at window.settingsController');
      return window.settingsController;
    }

    if (window.settingsInstance?.controller) {
      logger.debug('Found settings controller at window.settingsInstance.controller');
      return window.settingsInstance.controller;
    }

    // Look for controller in dashieAuth
    if (window.dashieAuth?.settingsController) {
      logger.debug('Found settings controller in dashieAuth');
      return window.dashieAuth.settingsController;
    }

    // Try to access through settings modules
    try {
      // This is a more complex search - look for any object with settings methods
      const potentialControllers = [];
      
      for (const [key, value] of Object.entries(window)) {
        if (value && typeof value === 'object' && 
            typeof value.loadSettings === 'function' && 
            typeof value.saveSettings === 'function' &&
            value.storage) {
          potentialControllers.push({ controller: value, source: key });
        }
      }

      if (potentialControllers.length > 0) {
        logger.debug(`Found ${potentialControllers.length} potential controllers`);
        return potentialControllers[0].controller;
      }

    } catch (error) {
      logger.debug('Error searching for controllers', error);
    }

    logger.warn('No settings controller found');
    return null;
  }

  /**
   * Replace storage in settings system
   */
  async replaceSettingsStorage() {
    logger.info('Replacing storage in settings system...');

    if (this.settingsController) {
      // Replace storage in existing controller
      this.settingsController.storage = this.jwtStorage;
      logger.success('Storage replaced in existing settings controller');
      
      // Expose globally for easy access
      window.settingsControllerPhase3 = this.settingsController;
      
    } else {
      logger.info('Creating new settings integration point...');
      
      // Create a basic settings integration
      window.settingsControllerPhase3 = {
        storage: this.jwtStorage,
        loadSettings: () => this.jwtStorage.loadSettings(),
        saveSettings: (settings) => this.jwtStorage.saveSettings(settings),
        getStatus: () => ({
          phase3Active: true,
          jwtEnabled: true,
          ...this.jwtStorage.getStatus()
        })
      };
    }

    // Also expose JWT storage globally
    window.jwtStoragePhase3 = this.jwtStorage;
    
    logger.success('JWT storage integration points created');
  }

  /**
   * Test the integration
   */
  async testIntegration() {
    logger.info('Testing Phase 3 integration...');

    try {
      const testData = {
        phase3Test: {
          timestamp: new Date().toISOString(),
          testId: Math.random().toString(36).substring(7),
          mode: 'phase3-rls-jwt'
        }
      };

      // Test save
      logger.debug('Testing save operation...');
      const saveResult = await this.jwtStorage.saveSettings(testData);
      
      if (!saveResult) {
        throw new Error('Save operation failed');
      }

      // Test load
      logger.debug('Testing load operation...');
      const loadResult = await this.jwtStorage.loadSettings();
      
      if (!loadResult || !loadResult.phase3Test) {
        throw new Error('Load operation failed or data not found');
      }

      // Test settings controller if available
      if (window.settingsControllerPhase3) {
        logger.debug('Testing settings controller integration...');
        
        const controllerSave = await window.settingsControllerPhase3.saveSettings(testData);
        const controllerLoad = await window.settingsControllerPhase3.loadSettings();
        
        if (!controllerSave || !controllerLoad?.phase3Test) {
          throw new Error('Settings controller integration failed');
        }
      }

      logger.success('Integration test passed');
      
      return {
        success: true,
        testData: loadResult.phase3Test,
        hasSettingsController: !!window.settingsControllerPhase3
      };

    } catch (error) {
      logger.error('Integration test failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Rollback Phase 3 changes
   */
  async rollback() {
    logger.info('Rolling back Phase 3 changes...');

    try {
      // Restore original storage if we had one
      if (this.settingsController && this.originalStorage) {
        this.settingsController.storage = this.originalStorage;
        logger.debug('Original storage restored');
      }

      // Clean up global variables
      delete window.settingsControllerPhase3;
      delete window.jwtStoragePhase3;

      this.isActive = false;
      
      logger.success('Phase 3 rollback completed');

    } catch (error) {
      logger.error('Rollback failed', error);
    }
  }

  /**
   * Disable Phase 3 and restore original system
   */
  async disablePhase3() {
    if (!this.isActive) {
      logger.info('Phase 3 already disabled');
      return { success: true, message: 'Phase 3 was not active' };
    }

    try {
      logger.info('🔄 Disabling Phase 3...');

      await this.rollback();

      logger.success('✅ Phase 3 disabled - reverted to original settings system');
      
      return {
        success: true,
        message: 'Phase 3 disabled - original settings system restored'
      };

    } catch (error) {
      logger.error('❌ Failed to disable Phase 3', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get Phase 3 status
   */
  getStatus() {
    return {
      phase3Active: this.isActive,
      hasJWTStorage: !!this.jwtStorage,
      hasOriginalStorage: !!this.originalStorage,
      hasSettingsController: !!this.settingsController,
      jwtStorageStatus: this.jwtStorage ? this.jwtStorage.getStatus() : null
    };
  }

  /**
   * Test current settings system (whether Phase 3 or original)
   */
  async testCurrentSystem() {
    logger.info('Testing current settings system...');

    const results = {
      phase3Active: this.isActive,
      tests: {}
    };

    // Test JWT storage if Phase 3 is active
    if (this.isActive && this.jwtStorage) {
      try {
        const jwtTest = await this.jwtStorage.testConnection();
        results.tests.jwtStorage = jwtTest;
      } catch (error) {
        results.tests.jwtStorage = { success: false, error: error.message };
      }
    }

    // Test settings controller
    if (window.settingsControllerPhase3) {
      try {
        const testData = { testCurrentSystem: Date.now() };
        const saved = await window.settingsControllerPhase3.saveSettings(testData);
        const loaded = await window.settingsControllerPhase3.loadSettings();
        
        results.tests.settingsController = {
          success: saved && !!loaded?.testCurrentSystem,
          saved,
          loaded: !!loaded?.testCurrentSystem
        };
      } catch (error) {
        results.tests.settingsController = { success: false, error: error.message };
      }
    }

    logger.info('Current system test completed', results);
    return results;
  }
}

// Create global instance and controls
let phase3Instance = null;

/**
 * Initialize Phase 3 integration
 */
export async function initializePhase3() {
  if (!phase3Instance) {
    phase3Instance = new Phase3RLSIntegration();
  }
  return phase3Instance;
}

/**
 * Global control functions
 */
if (typeof window !== 'undefined') {
  // Enable Phase 3
  window.enablePhase3 = async () => {
    console.log('🚀 Enabling Phase 3: RLS + JWT Default Mode...');
    
    if (!phase3Instance) {
      phase3Instance = new Phase3RLSIntegration();
    }
    
    const result = await phase3Instance.enablePhase3();
    
    if (result.success) {
      console.log('✅ Phase 3 enabled successfully!');
      console.log('💡 Your settings now use JWT verification by default');
      console.log('🔧 Use testPhase3(), disablePhase3(), phase3Status()');
    } else {
      console.error('❌ Phase 3 activation failed:', result.error);
    }
    
    return result;
  };

  // Disable Phase 3
  window.disablePhase3 = async () => {
    console.log('🔄 Disabling Phase 3...');
    
    if (!phase3Instance) {
      console.log('Phase 3 was not active');
      return { success: true, message: 'Phase 3 was not active' };
    }
    
    const result = await phase3Instance.disablePhase3();
    
    if (result.success) {
      console.log('✅ Phase 3 disabled - reverted to original system');
    } else {
      console.error('❌ Failed to disable Phase 3:', result.error);
    }
    
    return result;
  };

  // Test Phase 3
  window.testPhase3 = async () => {
    console.log('🧪 Testing Phase 3 system...');
    
    if (!phase3Instance) {
      console.log('Phase 3 not initialized');
      return { success: false, error: 'Phase 3 not initialized' };
    }
    
    const result = await phase3Instance.testCurrentSystem();
    console.table(result.tests);
    
    return result;
  };

  // Phase 3 status
  window.phase3Status = () => {
    if (!phase3Instance) {
      const status = { phase3Active: false, initialized: false };
      console.table(status);
      return status;
    }
    
    const status = phase3Instance.getStatus();
    console.table(status);
    return status;
  };
}

// Auto-initialize
export default initializePhase3;