// js/apis/api-auth/auth-storage.js - User Data Persistence (Moved to new location)
// CHANGE SUMMARY: Moved from js/auth/auth-storage.js, added structured logging, enhanced validation

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('AuthStorage');

/**
 * Authentication storage manager
 * Handles user data persistence with localStorage and validation
 */
export class AuthStorage {
  constructor() {
    this.storageKey = 'dashie-user';
    this.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    logger.debug('Auth storage initialized', {
      storageKey: this.storageKey,
      maxAgeHours: this.maxAge / (1000 * 60 * 60)
    });
  }

  /**
   * Save user data to localStorage
   * @param {Object} userData - User data to save
   */
  saveUser(userData) {
    try {
      if (!this.isUserValid(userData)) {
        throw new Error('Invalid user data provided');
      }

      const dataToSave = {
        ...userData,
        savedAt: Date.now()
      };
      
      localStorage.setItem(this.storageKey, JSON.stringify(dataToSave));
      
      logger.success('User data saved', {
        userId: userData.id,
        userEmail: userData.email,
        authMethod: userData.authMethod,
        hasGoogleToken: !!userData.googleAccessToken
      });
      
    } catch (error) {
      logger.error('Failed to save user data', {
        error: error.message,
        userId: userData?.id
      });
      throw error;
    }
  }

  /**
   * Get saved user data from localStorage
   * @returns {Object|null} Saved user data or null
   */
  getSavedUser() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (!saved) {
        logger.debug('No saved user data found');
        return null;
      }

      const userData = JSON.parse(saved);
      const now = Date.now();
      
      // Check if data is still valid (not expired)
      if (userData.savedAt && (now - userData.savedAt < this.maxAge)) {
        logger.info('Loaded saved user data', {
          userId: userData.id,
          userEmail: userData.email,
          authMethod: userData.authMethod,
          savedAge: Math.round((now - userData.savedAt) / (1000 * 60 * 60)) + ' hours'
        });
        
        return userData;
      } else {
        logger.warn('Saved user data expired, removing', {
          savedAt: new Date(userData.savedAt).toISOString(),
          ageHours: Math.round((now - userData.savedAt) / (1000 * 60 * 60))
        });
        
        this.clearSavedUser();
        return null;
      }
      
    } catch (error) {
      logger.error('Failed to load user data', error);
      
      // Clear corrupted data
      this.clearSavedUser();
      return null;
    }
  }

  /**
   * Clear saved user data
   */
  clearSavedUser() {
    try {
      localStorage.removeItem(this.storageKey);
      logger.info('User data cleared from storage');
    } catch (error) {
      logger.error('Failed to clear user data', error);
    }
  }

  /**
   * Validate user data structure
   * @param {Object} userData - User data to validate
   * @returns {boolean} True if valid
   */
  isUserValid(userData) {
    if (!userData || typeof userData !== 'object') {
      logger.warn('User data validation failed: not an object');
      return false;
    }
    
    const requiredFields = ['id', 'name', 'email'];
    const missingFields = requiredFields.filter(field => !userData[field]);
    
    if (missingFields.length > 0) {
      logger.warn('User data validation failed: missing required fields', {
        missingFields
      });
      return false;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      logger.warn('User data validation failed: invalid email format', {
        email: userData.email
      });
      return false;
    }

    return true;
  }

  /**
   * Check if localStorage is available
   * @returns {boolean} True if localStorage is available
   */
  isStorageAvailable() {
    try {
      const testKey = 'dashie-storage-test';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      logger.warn('localStorage not available', error);
      return false;
    }
  }

  /**
   * Get storage information
   * @returns {Object} Storage status and info
   */
  getStorageInfo() {
    return {
      available: this.isStorageAvailable(),
      storageKey: this.storageKey,
      maxAgeHours: this.maxAge / (1000 * 60 * 60),
      hasSavedUser: !!localStorage.getItem(this.storageKey),
      currentUser: this.getSavedUser()
    };
  }
}
