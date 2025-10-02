// js/apis/api-auth/auth-storage.js - Enhanced User Data Persistence with Simple Interface
// CHANGE SUMMARY: Removed supabaseAuthId from all storage operations - now only in dashie_supabase_jwt

import { createLogger } from '../../utils/logger.js';
import { events as eventSystem, EVENTS } from '../../utils/event-emitter.js';

const logger = createLogger('AuthStorage');

/**
 * Enhanced user authentication storage - uses original interface with improved functionality
 */
export class AuthStorage {
  constructor() {
    this.storageKey = 'dashie-user';  // Original storage key
    this.tokenKey = 'dashie-google-token';
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
      // Load user data
      const userData = localStorage.getItem(this.storageKey);
      if (userData) {
        const parsedUser = JSON.parse(userData);
        
        // Enhanced validation
        if (this.isValidUser(parsedUser)) {
          this.currentUser = parsedUser;
          logger.debug('User data loaded from storage:', this.currentUser?.email);
        } else {
          logger.warn('Stored user data is invalid, clearing');
          this.clearSavedUser();
        }
      }

      // Load Google token data
      const tokenData = localStorage.getItem(this.tokenKey);
      if (tokenData) {
        const parsedToken = JSON.parse(tokenData);
        
        // Enhanced token validation
        if (this.isValidToken(parsedToken)) {
          this.googleAccessToken = parsedToken.access_token;
          logger.debug('Google token loaded from storage');
        } else {
          logger.warn('Stored Google token is invalid, clearing');
          this.clearGoogleToken();
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
   * Validate token data
   */
  isValidToken(tokenData) {
    if (!tokenData || typeof tokenData !== 'object') return false;
    
    // Must have access token
    if (!tokenData.access_token) return false;
    
    // Check expiry if available
    if (tokenData.expires_at && tokenData.expires_at < Date.now()) {
      logger.debug('Token has expired');
      return false;
    }
    
    // Check if token is too old (1 day for safety)
    if (tokenData.issued_at && (Date.now() - tokenData.issued_at) > 24 * 60 * 60 * 1000) {
      logger.debug('Token is too old (>1 day)');
      return false;
    }

    return true;
  }

  /**
   * Save user data - original method name
   * UPDATED: No longer accepts or stores supabaseAuthId
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
        googleAccessToken: userData.googleAccessToken,
        savedAt: Date.now(),
        lastSeen: Date.now()
      };

      localStorage.setItem(this.storageKey, JSON.stringify(enhancedUserData));
      this.currentUser = enhancedUserData;

      logger.info('User data saved:', userData.email);
      
      eventSystem.emit(EVENTS.USER_STORED, { user: enhancedUserData });
      
      return true;
    } catch (error) {
      logger.error('Failed to save user data:', error);
      return false;
    }
  }

  /**
   * Store Google token with enhanced metadata
   */
  storeGoogleToken(token) {
    try {
      if (!token) {
        throw new Error('No token provided');
      }

      // Enhanced token data (no user_id reference)
      const tokenData = {
        access_token: token,
        issued_at: Date.now(),
        expires_at: Date.now() + (55 * 60 * 1000) // 55 minutes
      };

      localStorage.setItem(this.tokenKey, JSON.stringify(tokenData));
      this.googleAccessToken = token;

      logger.info('Google token stored');
      
      eventSystem.emit(EVENTS.TOKEN_STORED, { tokenData });
      
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
   */
  getGoogleToken() {
    if (!this.googleAccessToken) return null;

    // Re-validate token from storage
    try {
      const tokenData = localStorage.getItem(this.tokenKey);
      if (tokenData) {
        const parsedToken = JSON.parse(tokenData);
        if (this.isValidToken(parsedToken)) {
          return parsedToken.access_token;
        } else {
          logger.warn('Google token validation failed, clearing');
          this.clearGoogleToken();
          return null;
        }
      }
    } catch (error) {
      logger.error('Token validation error:', error);
      this.clearGoogleToken();
    }

    return null;
  }

  /**
   * Clear user data - original method name
   */
  clearSavedUser() {
    try {
      localStorage.removeItem(this.storageKey);
      this.currentUser = null;
      logger.info('User data cleared');
      
      eventSystem.emit(EVENTS.USER_CLEARED);
    } catch (error) {
      logger.error('Failed to clear user data:', error);
    }
  }

  /**
   * Clear Google token
   */
  clearGoogleToken() {
    try {
      localStorage.removeItem(this.tokenKey);
      this.googleAccessToken = null;
      logger.info('Google token cleared');
      
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
    this.clearGoogleToken();
    
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