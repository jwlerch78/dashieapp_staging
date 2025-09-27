// js/testing/phase3-simple.js
// CHANGE SUMMARY: Simplified Phase 3 implementation to avoid export issues

import { createLogger } from '../utils/logger.js';

const logger = createLogger('Phase3Simple');

/**
 * Simplified Phase 3 Implementation
 */
class Phase3Simple {
  constructor() {
    this.isActive = false;
    this.jwtStorage = null;
    
    logger.info('Phase 3 Simple initialized');
  }

  async enable() {
    if (this.isActive) {
      return { success: true, message: 'Phase 3 already active' };
    }

    try {
      logger.info('Enabling Phase 3...');

      // Get user
      const user = window.dashieAuth?.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Create JWT storage
      const { SimpleSupabaseStorage } = await import('../supabase/simple-supabase-storage.js');
      this.jwtStorage = new SimpleSupabaseStorage(user.id, user.email);
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Enable JWT mode
      this.jwtStorage.setJWTMode(true);
      
      // Test it works
      const testResult = await this.jwtStorage.testConnection();
      
      if (!testResult.success) {
        throw new Error(`Test failed: ${testResult.error}`);
      }

      this.isActive = true;
      
      // Expose globally
      window.jwtStoragePhase3 = this.jwtStorage;
      
      logger.success('Phase 3 enabled successfully');
      
      return {
        success: true,
        message: 'Phase 3 active - JWT storage available at window.jwtStoragePhase3',
        testResult
      };

    } catch (error) {
      logger.error('Phase 3 enable failed', error);
      return { success: false, error: error.message };
    }
  }

  async disable() {
    if (!this.isActive) {
      return { success: true, message: 'Phase 3 was not active' };
    }

    try {
      this.isActive = false;
      this.jwtStorage = null;
      delete window.jwtStoragePhase3;
      
      logger.success('Phase 3 disabled');
      
      return { success: true, message: 'Phase 3 disabled' };

    } catch (error) {
      logger.error('Phase 3 disable failed', error);
      return { success: false, error: error.message };
    }
  }

  async test() {
    if (!this.isActive || !this.jwtStorage) {
      return { success: false, error: 'Phase 3 not active' };
    }

    try {
      const testData = {
        phase3Test: {
          timestamp: new Date().toISOString(),
          testId: Math.random().toString(36).substring(7)
        }
      };

      // Test save and load
      await this.jwtStorage.saveSettings(testData);
      const loaded = await this.jwtStorage.loadSettings();
      
      const success = loaded && loaded.phase3Test && loaded.phase3Test.testId === testData.phase3Test.testId;
      
      return {
        success,
        message: success ? 'Phase 3 test passed' : 'Phase 3 test failed',
        testData: loaded?.phase3Test
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getStatus() {
    return {
      phase3Active: this.isActive,
      hasJWTStorage: !!this.jwtStorage,
      jwtStorageStatus: this.jwtStorage ? this.jwtStorage.getStatus() : null
    };
  }
}

// Create instance and global functions
const phase3 = new Phase3Simple();

// Global functions
window.enablePhase3 = async () => {
  console.log('Enabling Phase 3...');
  const result = await phase3.enable();
  
  if (result.success) {
    console.log('✅ Phase 3 enabled!');
    console.log('💡 Use testPhase3(), disablePhase3(), phase3Status()');
  } else {
    console.error('❌ Phase 3 failed:', result.error);
  }
  
  return result;
};

window.disablePhase3 = async () => {
  console.log('Disabling Phase 3...');
  const result = await phase3.disable();
  console.log(result.success ? '✅ Phase 3 disabled' : '❌ Disable failed:', result);
  return result;
};

window.testPhase3 = async () => {
  console.log('Testing Phase 3...');
  const result = await phase3.test();
  console.log(result.success ? '✅ Test passed' : '❌ Test failed:', result);
  return result;
};

window.phase3Status = () => {
  const status = phase3.getStatus();
  console.table(status);
  return status;
};

logger.success('Phase 3 Simple loaded - use enablePhase3() to activate');

// Export for import
export default phase3;