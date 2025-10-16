// js/supabase/simple-supabase-storage.js
// v1.2 - 10/9/25 8:45pm - Converted all console.log/error/warn to logger methods for cleaner logging
// CHANGE SUMMARY: Fixed localStorage key to always use 'dashie-settings' without userId suffix; ensures settings with tokens are saved after database load

import { supabase } from './supabase-config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('SimpleSupabaseStorage');

export class SimpleSupabaseStorage {
  constructor(userId, userEmail = null) {
    this.userId = userId;
    this.userEmail = userEmail;
    this.localStorageKey = 'dashie-settings'; // FIXED: Always use same key, no userId suffix
    this.isOnline = navigator.onLine;
    
    // JWT configuration - determined once on first use
    this.jwtMode = null; // null = not determined yet, true = JWT mode, false = direct mode
    this.jwtService = null;
    
    logger.debug('Storage initialized', { userId, localStorageKey: this.localStorageKey });
    
    // Listen for online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingChanges();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  /**
   * Determine and configure authentication mode
   * NOTE: JWT service provides authentication via edge functions, not direct Supabase client auth
   * @returns {Promise<boolean>} true if JWT mode, false if direct mode
   */
  async determineAuthMode() {
    if (this.jwtMode !== null) {
      return this.jwtMode; // Already determined
    }

    logger.debug('Determining optimal storage mode');

    try {
      // Check if JWT service is available
      const jwtAvailable = this.checkJWTAvailabilitySync();

      if (jwtAvailable) {
        // JWT is ready - use edge function mode
        this.jwtMode = true;
        this.jwtService = window.jwtAuth;
        logger.info('JWT mode selected');
        
        return this.jwtMode;
      }

      // JWT not available - check if RLS is enabled
      logger.debug('JWT service not available, checking RLS status');
      const rlsEnabled = await this.checkRLSStatus();

      logger.debug('Mode determination results', {
        rlsEnabled,
        jwtAvailable: false,
        userId: this.userId
      });

      this.jwtMode = false;

      if (rlsEnabled) {
        logger.warn('RLS enabled but JWT service unavailable - database access may fail');
      } else {
        logger.debug('Direct database mode selected (RLS disabled)');
      }

      return this.jwtMode;

    } catch (error) {
      logger.error('Mode determination failed', error);
      this.jwtMode = false;
      return false;
    }
  }

  /**
   * Check if JWT service is available (synchronous check)
   */
  checkJWTAvailabilitySync() {
    if (!window.jwtAuth) {
      logger.debug('window.jwtAuth not found');
      return false;
    }

    if (typeof window.jwtAuth.isServiceReady !== 'function') {
      logger.debug('window.jwtAuth.isServiceReady is not a function');
      return false;
    }

    const isReady = window.jwtAuth.isServiceReady();
    logger.debug('JWT service availability checked', { isReady });
    return isReady;
  }

  /**
   * Check if RLS (Row Level Security) is enabled
   */
  async checkRLSStatus() {
    try {
      const testUserId = 'test-rls-check-' + Date.now();
      
      const { data, error } = await supabase
        .from('user_settings')
        .insert({
          auth_user_id: testUserId,
          email: 'test@example.com',
          settings: { test: true }
        })
        .select();

      if (error) {
        if (error.code === '42501' || error.message?.includes('row-level security')) {
          logger.debug('RLS is enabled (INSERT blocked by RLS)');
          return true;
        } else {
          logger.debug('INSERT failed for other reason', { message: error.message });
          return false;
        }
      } else {
        // INSERT succeeded - clean up test record
        if (data && data[0]) {
          await supabase
            .from('user_settings')
            .delete()
            .eq('auth_user_id', testUserId);
        }
        logger.debug('RLS is disabled (INSERT succeeded)');
        return false;
      }

    } catch (error) {
      logger.warn('RLS check failed, defaulting to enabled for safety', { message: error.message });
      // Default to enabled for safety
      return true;
    }
  }

  // ====== MAIN SAVE/LOAD METHODS ======

  /**
   * Save settings with automatic mode selection
   */
  async saveSettings(settings) {
    logger.debug('Saving settings', { userId: this.userId });
    
    if (!this.isOnline) {
      logger.debug('Offline - saving to local storage only');
      return this.saveToLocalStorage(settings);
    }

    try {
      await this.determineAuthMode();

      if (this.jwtMode) {
        logger.debug('Using JWT mode for save');
        return await this.saveViaJWT(settings);
      } else {
        logger.debug('Using direct mode for save');
        return await this.saveDirect(settings);
      }

    } catch (error) {
      logger.error('Cloud save failed, falling back to localStorage', error);
      return this.saveToLocalStorage(settings);
    }
  }

  /**
   * Load settings with automatic mode selection
   */
  async loadSettings() {
    logger.debug('Loading settings', { userId: this.userId });
    
    try {
      await this.determineAuthMode();

      if (this.jwtMode) {
        logger.debug('Using JWT mode for load');
        return await this.loadViaJWT();
      } else {
        logger.debug('Using direct mode for load');
        return await this.loadDirect();
      }

    } catch (error) {
      logger.error('Cloud load failed, falling back to localStorage', error);
      return this.loadFromLocalStorage();
    }
  }

  // ====== JWT MODE METHODS (using edge functions) ======

  async saveViaJWT(settings) {
    logger.debug('Saving settings via JWT-verified edge function');
    
    try {
      const result = await this.jwtService.saveSettings(settings);
      
      if (result.success) {
        logger.info('JWT save successful');
        // Also save to localStorage as backup
        this.saveToLocalStorage(settings);
        await this.broadcastChange();
        return true;
      } else {
        throw new Error('JWT save returned success: false');
      }

    } catch (error) {
      logger.error('JWT save failed', error);
      throw error;
    }
  }

  async loadViaJWT() {
    logger.debug('Loading settings via JWT-verified edge function');
    
    try {
      const result = await this.jwtService.loadSettings(this.userEmail);
      
      if (result.success && result.settings) {
        logger.info('JWT load successful');
        // CRITICAL: Save to localStorage immediately with correct key
        this.saveToLocalStorage(result.settings);
        return result.settings;
      } else {
        logger.debug('No settings found in JWT mode, checking localStorage');
        return this.loadFromLocalStorage();
      }

    } catch (error) {
      logger.error('JWT load failed', error);
      throw error;
    }
  }

  // ====== DIRECT MODE METHODS (direct database access) ======

  async saveDirect(settings) {
    logger.debug('Saving settings via direct database access');
    
    const settingsData = {
      auth_user_id: this.userId,
      email: this.userEmail,
      settings: settings,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('user_settings')
      .upsert(settingsData, {
        onConflict: 'auth_user_id'
      });

    if (error) {
      logger.error('Direct save failed', error);
      throw error;
    }

    logger.info('Direct save successful');
    // Also save to localStorage as backup
    this.saveToLocalStorage(settings);
    await this.broadcastChange();
    return true;
  }

  async loadDirect() {
    logger.debug('Loading settings via direct database access');
    
    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('auth_user_id', this.userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        logger.debug('No settings found in database, checking localStorage');
        return this.loadFromLocalStorage();
      }
      logger.error('Direct load failed', error);
      throw error;
    }

    if (data && data.settings) {
      logger.info('Direct load successful');
      // Save to localStorage for offline access
      this.saveToLocalStorage(data.settings);
      return data.settings;
    }

    logger.debug('No settings in database, checking localStorage');
    return this.loadFromLocalStorage();
  }

  // ====== LOCAL STORAGE METHODS ======

  saveToLocalStorage(settings) {
    try {
      // FIXED: Save directly to the settings object without wrapper
      // This matches what SettingsController expects
      
      logger.debug('Saving to localStorage', {
        key: this.localStorageKey,
        hasTokenAccounts: !!settings?.tokenAccounts,
        tokenAccountKeys: settings?.tokenAccounts ? Object.keys(settings.tokenAccounts) : []
      });
      
      localStorage.setItem(this.localStorageKey, JSON.stringify(settings));
      
      // Verify what was actually saved
      const verification = localStorage.getItem(this.localStorageKey);
      const parsed = JSON.parse(verification);
      logger.debug('Verified saved data', {
        hasTokenAccounts: !!parsed?.tokenAccounts
      });
      
      logger.debug('Settings saved to localStorage', { key: this.localStorageKey });
      return true;
    } catch (error) {
      logger.error('localStorage save failed', error);
      return false;
    }
  }

  loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem(this.localStorageKey);
      if (!stored) {
        logger.debug('No settings in localStorage');
        return null;
      }

      const settings = JSON.parse(stored);
      logger.debug('Settings loaded from localStorage');
      return settings;
      
    } catch (error) {
      logger.error('localStorage load failed', error);
      return null;
    }
  }

  // ====== STATUS & TESTING METHODS ======

  getStatus() {
    return {
      userId: this.userId,
      userEmail: this.userEmail,
      isOnline: this.isOnline,
      jwtMode: this.jwtMode,
      hasJwtService: !!this.jwtService,
      jwtReady: this.jwtService ? this.jwtService.isServiceReady?.() : false,
      localStorageKey: this.localStorageKey
    };
  }

  async testConfiguration() {
    logger.debug('Testing current storage configuration');
    
    const status = this.getStatus();
    console.table(status);
    
    try {
      const mode = await this.determineAuthMode();
      logger.info('Mode determination successful', { mode: mode ? 'JWT' : 'Direct' });
      
      return {
        success: true,
        mode: mode ? 'JWT' : 'Direct',
        status
      };
    } catch (error) {
      logger.error('Configuration test failed', error);
      return {
        success: false,
        error: error.message,
        status
      };
    }
  }

  // ====== REAL-TIME SYNC METHODS ======

  subscribeToChanges(callback) {
    if (!this.userId) return null;

    logger.debug('Setting up broadcast subscription', { userId: this.userId });

    const channelName = `user_settings_${this.userId}`;
    
    const subscription = window.supabase
      .channel(channelName)
      .on('broadcast', { event: 'settings-changed' }, (payload) => {
        logger.debug('Broadcast received', payload);
        
        // Reload settings from database when broadcast received
        this.loadSettings().then(settings => {
          if (settings) {
            this.saveToLocalStorage(settings);
            callback(settings);
          }
        });
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      logger.debug('Broadcast subscription cleaned up');
    };
  }

  async broadcastChange() {
    if (!this.userId) return;

    const channelName = `user_settings_${this.userId}`;
    const channel = window.supabase.channel(channelName);
    
    await channel.send({
      type: 'broadcast',
      event: 'settings-changed',
      payload: { 
        userId: this.userId,
        timestamp: Date.now()
      }
    });
    
    logger.debug('Broadcast sent: settings-changed');
  }

  markForRetry(settings) {
    try {
      const pending = {
        settings: settings,
        timestamp: Date.now(),
        auth_user_id: this.userId
      };
      localStorage.setItem(this.localStorageKey + '-pending', JSON.stringify(pending));
    } catch (error) {
      logger.warn('Failed to mark settings for retry', error);
    }
  }

  async syncPendingChanges() {
    try {
      const pendingData = localStorage.getItem(this.localStorageKey + '-pending');
      if (!pendingData) return;

      const pending = JSON.parse(pendingData);
      
      if (pending.auth_user_id === this.userId) {
        logger.debug('Syncing pending changes from localStorage');
        await this.saveSettings(pending.settings);
        localStorage.removeItem(this.localStorageKey + '-pending');
      }
    } catch (error) {
      logger.warn('Failed to sync pending changes', error);
    }
  }
}
