// js/apis/api-auth/auth-storage.js - Enhanced User Data Persistence with Simple Interface
// CHANGE SUMMARY: Removed dashie-google-token localStorage key - token now stored only in dashie-user.googleAccessToken (single source of truth)

import { createLogger } from '../../utils/logger.js';
import { events as eventSystem, EVENTS } from '../../utils/event-emitter.js';

const logger = createLogger('AuthStorage');

/**
 * Enhanced user authentication storage - uses original interface with improved functionality
 * Token storage consolidated to dashie-user object only (removed duplicate dashie-google-token)
 */
export class AuthStorage {
  constructor() {
    this.storageKey = 'dashie-user';  // Original storage key for user + token
    this.currentUser = null;
    this.googleAccessToken = null;
    
    // Load existing data on initialization
    this.loadStoredData();
  }

  /**
   * Load stored authentication data from localStorage
   */
  loadStoredData() {
    try {
      // Load user data (includes googleAccessToken)
      const userData = localStorage.getItem(this.storageKey);
      if (userData) {
        const parsedUser = JSON.parse(userData);
        
        // Enhanced validation
        if (this.isValidUser(parsedUser)) {
          this.currentUser = parsedUser;
          this.googleAccessToken = parsedUser.googleAccessToken || null;
          logger.debug('User data loaded from storage:', this.currentUser?.email);
          
          if (this.googleAccessToken) {
            logger.debug('Google token loaded from user object');
          }
        } else {
          logger.warn('Stored user data is invalid, clearing');
          this.clearSavedUser();
        }
      }

    } catch (error) {
      logger.error('Failed to load stored auth data:', error);
      this.clearAllData();
    }
  }

  /**
   * Validate user data
   */
  isValidUser(userData) {
    if (!userData || typeof userData !== 'object') return false;
    
    // Must have required fields - email is primary identifier
    if (!userData.email || !userData.name) return false;
    
    // Check if data is too old (7 days)
    if (userData.savedAt && (Date.now() - userData.savedAt) > 7 * 24 * 60 * 60 * 1000) {
      logger.debug('User data is too old (>7 days)');
      return false;
    }

    return true;
  }

  /**
   * Save user data - original method name
   * UPDATED: Token stored in user object, no separate storage
   */
  saveUser(userData) {
    try {
      if (!userData || !userData.email) {
        throw new Error('Invalid user data - email required');
      }

      // Enhanced user data with timestamp
      const enhancedUserData = {
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        authMethod: userData.authMethod,
        googleAccessToken: userData.googleAccessToken || this.googleAccessToken,
        savedAt: Date.now(),
        lastSeen: Date.now()
      };

      localStorage.setItem(this.storageKey, JSON.stringify(enhancedUserData));
      this.currentUser = enhancedUserData;
      this.googleAccessToken = enhancedUserData.googleAccessToken;

      logger.info('User data saved:', userData.email);
      
      eventSystem.emit(EVENTS.USER_STORED, { user: enhancedUserData });
      
      return true;
    } catch (error) {
      logger.error('Failed to save user data:', error);
      return false;
    }
  }

  /**
   * Store Google token
   * UPDATED: Stores in user object, not separate key
   */
  storeGoogleToken(token) {
    try {
      if (!token) {
        throw new Error('No token provided');
      }

      this.googleAccessToken = token;

      // Update the user object with new token
      if (this.currentUser) {
        this.currentUser.googleAccessToken = token;
        this.currentUser.lastSeen = Date.now();
        localStorage.setItem(this.storageKey, JSON.stringify(this.currentUser));
      }

      logger.info('Google token stored in user object');
      
      eventSystem.emit(EVENTS.TOKEN_STORED, { token });
      
      return true;
    } catch (error) {
      logger.error('Failed to store Google token:', error);
      return false;
    }
  }

  /**
   * Get saved user - original method name
   */
  getSavedUser() {
    if (!this.currentUser) return null;

    // Validate user data is still fresh
    if (this.currentUser.savedAt && (Date.now() - this.currentUser.savedAt) > 7 * 24 * 60 * 60 * 1000) {
      logger.warn('Stored user data is stale (>7 days), clearing');
      this.clearSavedUser();
      return null;
    }

    // Update last seen
    if (this.currentUser) {
      this.currentUser.lastSeen = Date.now();
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.currentUser));
      } catch (error) {
        logger.warn('Failed to update last seen:', error);
      }
    }

    return this.currentUser;
  }

  /**
   * Get Google access token
   * UPDATED: Returns from user object directly
   */
  getGoogleToken() {
    // Return token from current user object
    if (this.currentUser?.googleAccessToken) {
      // Validate token age (reject if > 1 day old)
      const tokenAge = Date.now() - (this.currentUser.savedAt || 0);
      if (tokenAge > 24 * 60 * 60 * 1000) {
        logger.warn('Google token is too old (>1 day), clearing');
        this.clearGoogleToken();
        return null;
      }
      
      return this.currentUser.googleAccessToken;
    }

    return this.googleAccessToken || null;
  }

  /**
   * Clear user data - original method name
   */
  clearSavedUser() {
    try {
      localStorage.removeItem(this.storageKey);
      this.currentUser = null;
      this.googleAccessToken = null;
      logger.info('User data cleared');
      
      eventSystem.emit(EVENTS.USER_CLEARED);
    } catch (error) {
      logger.error('Failed to clear user data:', error);
    }
  }

  /**
   * Clear Google token
   * UPDATED: Clears from user object
   */
  clearGoogleToken() {
    try {
      this.googleAccessToken = null;
      
      // Remove token from user object but keep user data
      if (this.currentUser) {
        this.currentUser.googleAccessToken = null;
        localStorage.setItem(this.storageKey, JSON.stringify(this.currentUser));
      }
      
      logger.info('Google token cleared from user object');
      
      eventSystem.emit(EVENTS.TOKEN_CLEARED);
    } catch (error) {
      logger.error('Failed to clear Google token:', error);
    }
  }

  /**
   * Clear all stored authentication data
   */
  clearAllData() {
    logger.info('Clearing all authentication data');
    
    this.clearSavedUser();
    
    eventSystem.emit(EVENTS.AUTH_CLEARED);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    const user = this.getSavedUser();
    const token = this.getGoogleToken();
    
    const isAuth = !!(user && user.email && token);
    
    if (isAuth) {
      logger.debug('User authentication validated');
    } else {
      logger.debug('User authentication validation failed');
    }
    
    return isAuth;
  }

  /**
   * Get authentication status for debugging
   */
  getAuthStatus() {
    return {
      hasUser: !!this.currentUser,
      hasToken: !!this.getGoogleToken(),
      isAuthenticated: this.isAuthenticated(),
      userEmail: this.currentUser?.email,
      lastSeen: this.currentUser?.lastSeen,
      userAge: this.currentUser?.savedAt ? Math.round((Date.now() - this.currentUser.savedAt) / (1000 * 60 * 60)) + ' hours' : 'unknown'
    };
  }
}