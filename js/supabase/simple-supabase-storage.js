// js/supabase/simple-supabase-storage.js - Streamlined Storage with Smart JWT Detection
// CHANGE SUMMARY: Removed retry mechanisms and timing complexity - JWT service is now guaranteed to be available from main.js initialization

import { supabase } from './supabase-config.js';

export class SimpleSupabaseStorage {
  constructor(userId, userEmail = null) {
    this.userId = userId;
    this.userEmail = userEmail;
    this.localStorageKey = 'dashie-settings';
    this.isOnline = navigator.onLine;
    
    // JWT configuration - determined once on first use
    this.jwtMode = null; // null = not determined yet, true = JWT mode, false = direct mode
    this.jwtService = null;
    
    console.log('📦 SimpleSupabaseStorage initialized for user:', userId);
    
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
   * Determine and configure authentication mode - OPTIMIZED VERSION
   * @returns {Promise<boolean>} true if JWT mode, false if direct mode
   */
  async determineAuthMode() {
    if (this.jwtMode !== null) {
      return this.jwtMode; // Already determined
    }

    console.log('🔍 Determining optimal storage mode...');

    try {
      // OPTIMIZATION: Check JWT first - if available, use it regardless of RLS status
      const jwtAvailable = this.checkJWTAvailabilitySync();

      if (jwtAvailable) {
        // JWT is ready - use it without testing RLS
        this.jwtMode = true;
        this.jwtService = window.jwtAuth;
        console.log('✅ JWT mode selected (JWT service ready)');
        
        return this.jwtMode;
      }

      // JWT not available - check if RLS is enabled
      console.log('⚡ JWT service not available, checking RLS status...');
      const rlsEnabled = await this.checkRLSStatus();

      console.log('📊 Mode determination results:', {
        rlsEnabled,
        jwtAvailable: false,
        userId: this.userId
      });

      this.jwtMode = false;

      if (rlsEnabled) {
        console.warn('⚠️ RLS is enabled but JWT service unavailable!');
        console.warn('⚠️ This will likely cause database access errors.');
        console.warn('💡 Consider disabling RLS or ensuring JWT service is properly configured.');
        console.log('⚠️ Fallback to direct mode (will likely fail with RLS enabled)');
      } else {
        console.log('⚡ Direct mode selected (RLS disabled)');
      }

      return this.jwtMode;

    } catch (error) {
      console.warn('⚠️ Mode determination failed, defaulting to direct mode:', error.message);
      this.jwtMode = false;
      return false;
    }
  }

  /**
   * Check if JWT service is available (synchronous check)
   * @returns {boolean}
   */
  checkJWTAvailabilitySync() {
    // Quick synchronous check - no async connection testing needed
    // The JWT service already tested its connection during initialization
    if (!window.jwtAuth) {
      console.log('❌ JWT service not found at window.jwtAuth');
      return false;
    }

    if (!window.jwtAuth.isServiceReady || !window.jwtAuth.isServiceReady()) {
      console.log('❌ JWT service not ready');
      return false;
    }

    console.log('✅ JWT service is available and ready');
    return true;
  }

  /**
   * Check if RLS is enabled on the user_settings table
   * @returns {Promise<boolean>}
   */
  async checkRLSStatus() {
    console.log('🔍 Checking RLS status...');

    try {
      // Try to INSERT a test record - this reliably detects RLS
      const testUserId = 'rls-test-' + Date.now();
      const { data, error } = await supabase
        .from('user_settings')
        .insert({
          user_id: testUserId,
          user_email: 'test@example.com',
          settings: { test: true },
          updated_at: new Date().toISOString()
        })
        .select();

      console.log('📊 RLS detection results:', {
        error: error?.message,
        data: data
      });

      // Check for explicit RLS policy violations
      if (error) {
        const rlsError = error.message.includes('row-level security') || 
                        error.message.includes('policy') ||
                        error.message.includes('insufficient privilege') ||
                        error.code === 'PGRST116' || // PostgREST RLS violation
                        error.code === '42501'; // PostgreSQL insufficient privilege

        if (rlsError) {
          console.log('🔒 RLS is ENABLED (detected via policy violation)');
          return true;
        } else {
          console.log('❌ INSERT failed for other reason:', error.message);
          return false;
        }
      } else {
        // INSERT succeeded - clean up test record
        if (data && data[0]) {
          await supabase
            .from('user_settings')
            .delete()
            .eq('user_id', testUserId);
        }
        console.log('🔓 RLS is DISABLED (INSERT succeeded)');
        return false;
      }

    } catch (error) {
      console.warn('⚠️ RLS check failed:', error.message);
      // Default to enabled for safety
      return true;
    }
  }

  /**
   * Manually test JWT connection (for debugging/testing only)
   */
  async testJWTConnection() {
    console.log('🧪 Manual JWT connection test...');

    if (!this.checkJWTAvailabilitySync()) {
      return { success: false, error: 'JWT service not available' };
    }

    try {
      const testResult = await window.jwtAuth.testConnection();
      
      if (testResult && testResult.success) {
        console.log('✅ JWT connection test passed');
        return { success: true, result: testResult };
      } else {
        console.log('❌ JWT connection test failed:', testResult);
        return { success: false, error: testResult?.error || 'Connection test failed' };
      }

    } catch (error) {
      console.warn('⚠️ JWT connection test failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // ====== MAIN SAVE/LOAD METHODS ======

  /**
   * Save settings with automatic mode selection
   */
  async saveSettings(settings) {
    console.log('💾 Saving settings for user:', this.userId);
    
    if (!this.isOnline) {
      console.log('📱 Offline - saving to local storage only');
      return this.saveToLocalStorage(settings);
    }

    try {
      // Save to cloud first
      await this.saveToSupabase(settings);
      
      // Update local cache on success
      this.saveToLocalStorage(settings);
      
      console.log('☁️ Settings saved to Supabase and local storage');
      return true;
      
    } catch (error) {
      console.warn('☁️ Supabase save failed, using local storage:', error);
      
      // Fallback to local storage
      return this.saveToLocalStorage(settings);
    }
  }

  /**
   * Save to Supabase with automatic mode selection
   */
  async saveToSupabase(settings) {
    if (!this.userId) {
      throw new Error('Cannot save settings: No user ID');
    }

    console.log('📊 Saving to Supabase...');

    // Determine authentication mode
    const useJWT = await this.determineAuthMode();
    
    const data = {
      user_id: this.userId,
      user_email: this.userEmail,
      settings: settings,
      updated_at: new Date().toISOString()
    };

    try {
      if (useJWT && this.jwtService) {
        // Use JWT service
        console.log('📊 Using JWT service for save');
        
        const result = await this.jwtService.saveSettings(this.userEmail, settings);
        
        if (result) {
          console.log('✅ JWT save successful');
          return true;
        } else {
          throw new Error('JWT save returned false');
        }
        
      } else {
        // Use direct Supabase access
        console.log('📊 Using direct access mode');
        
        // NOTE: Edge function uses user_email as primary key, direct access uses user_id
        // This is intentional - RLS policies may be set up differently
        const { data: result, error } = await supabase
          .from('user_settings')
          .upsert(data, {
            onConflict: 'user_id',
            ignoreDuplicates: false
          })
          .select();

        if (error) {
          throw new Error(`Supabase error: ${error.message}`);
        }

        console.log('✅ Direct save successful');
        return true;
      }

    } catch (error) {
      console.error('❌ Supabase save failed:', error.message);
      throw error;
    }
  }

  /**
   * Load settings with automatic mode selection
   */
  async loadSettings() {
    console.log('📖 Loading settings for user:', this.userId);
    
    try {
      // Try cloud first if online
      if (this.isOnline) {
        const cloudSettings = await this.loadFromSupabase();
        if (cloudSettings) {
          // Update local cache with cloud data
          this.saveToLocalStorage(cloudSettings);
          console.log('☁️ Settings loaded from Supabase');
          return cloudSettings;
        }
      }
    } catch (error) {
      console.warn('☁️ Supabase load failed, using local storage:', error);
    }

    // Fallback to local storage
    const localSettings = this.loadFromLocalStorage();
    if (localSettings) {
      console.log('💾 Settings loaded from local storage');
      return localSettings;
    }

    console.log('🆕 No saved settings found, using defaults');
    return null;
  }

  /**
   * Load from Supabase with automatic mode selection
   */
  async loadFromSupabase() {
    if (!this.userId) return null;

    console.log('📊 Loading from Supabase...');

    // Determine authentication mode
    const useJWT = await this.determineAuthMode();

    try {
      if (useJWT && this.jwtService) {
        // Use JWT service
        console.log('📊 Using JWT service for load');
        
        const result = await this.jwtService.loadSettings(this.userEmail);
        
        console.log('✅ JWT load completed');
        return result;
        
      } else {
        // Use direct Supabase access
        console.log('📊 Using direct access mode');
        
        // NOTE: Edge function uses user_email as primary key, direct access uses user_id
        // This is intentional - RLS policies may be set up differently
        const { data, error } = await supabase
          .from('user_settings')
          .select('settings')
          .eq('user_id', this.userId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            console.log('🔍 No settings found for user');
            return null;
          }
          
          throw new Error(`Supabase error: ${error.message}`);
        }

        console.log('✅ Direct load successful');
        return data?.settings || null;
      }

    } catch (error) {
      console.error('❌ Supabase load failed:', error.message);
      throw error;
    }
  }

  // ====== LOCAL STORAGE METHODS ======

  saveToLocalStorage(settings) {
    try {
      const data = {
        settings: settings,
        user_id: this.userId,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(this.localStorageKey, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('💾 ❌ Local storage save failed:', error);
      return false;
    }
  }

  loadFromLocalStorage() {
    try {
      const data = localStorage.getItem(this.localStorageKey);
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      return parsed.settings;
    } catch (error) {
      console.error('💾 ❌ Local storage load failed:', error);
      return null;
    }
  }

  syncPendingChanges() {
    // Future: implement pending changes sync when coming back online
    console.log('🔄 Online - sync pending changes (not implemented yet)');
  }

  // ====== STATUS AND DEBUGGING ======

  /**
   * Get current storage status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      userId: this.userId,
      userEmail: this.userEmail,
      jwtMode: this.jwtMode,
      hasJWTService: !!this.jwtService,
      isOnline: this.isOnline,
      jwtServiceReady: this.jwtService ? this.jwtService.isServiceReady?.() : false
    };
  }

  /**
   * Manually test the current configuration
   */
  async testConfiguration() {
    console.log('🧪 Testing current storage configuration...');
    
    const status = this.getStatus();
    console.table(status);
    
    // Test mode determination
    try {
      const mode = await this.determineAuthMode();
      console.log('✅ Mode determination successful:', mode ? 'JWT' : 'Direct');
      
      const result = {
        success: true,
        mode: mode ? 'JWT' : 'Direct',
        status,
        optimized: true // Flag to show this is the optimized version
      };

      // If JWT mode, optionally test connection (for debugging)
      if (mode && this.jwtService) {
        console.log('🔧 Testing JWT connection (optional)...');
        const jwtTest = await this.testJWTConnection();
        result.jwtConnectionTest = jwtTest;
      }
      
      return result;
    } catch (error) {
      console.error('❌ Configuration test failed:', error);
      return {
        success: false,
        error: error.message,
        status,
        optimized: true
      };
    }
  }

  // ====== REAL-TIME SYNC METHODS ======

  /**
   * Subscribe to real-time changes from Supabase
   * @param {Function} callback - Called when settings change
   * @returns {Function} Unsubscribe function
   */
  subscribeToChanges(callback) {
    if (!this.userId) return null;

    console.log('🔄 Setting up real-time subscription for user:', this.userId);

    const subscription = supabase
      .channel(`user_settings_${this.userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_settings',
        filter: `user_id=eq.${this.userId}`
      }, (payload) => {
        console.log('🔄 Real-time update received:', payload);
        if (payload.new && payload.new.settings) {
          callback(payload.new.settings);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      console.log('🔄 Real-time subscription cleaned up');
    };
  }

  /**
   * Mark settings for retry when offline
   * @param {Object} settings - Settings to retry
   */
  markForRetry(settings) {
    try {
      const pending = {
        settings: settings,
        timestamp: Date.now(),
        user_id: this.userId
      };
      localStorage.setItem(this.localStorageKey + '-pending', JSON.stringify(pending));
    } catch (error) {
      console.warn('Failed to mark settings for retry:', error);
    }
  }

  /**
   * Sync pending changes when coming back online
   */
  async syncPendingChanges() {
    try {
      const pendingData = localStorage.getItem(this.localStorageKey + '-pending');
      if (pendingData) {
        const pending = JSON.parse(pendingData);
        if (pending.user_id === this.userId) {
          await this.saveToSupabase(pending.settings);
          localStorage.removeItem(this.localStorageKey + '-pending');
          console.log('🔄 ✅ Pending settings synced successfully');
        }
      }
    } catch (error) {
      console.warn('🔄 ❌ Failed to sync pending settings:', error);
    }
  }

  /**
   * Force JWT mode activation (for debugging/testing)
   */
  async activateJWTMode() {
    console.log('🔄 Manually activating JWT mode...');
    
    try {
      // Reset mode determination
      this.jwtMode = null;
      
      // Force mode determination
      const result = await this.determineAuthMode();
      
      console.log('📊 Manual activation result:', {
        jwtMode: result,
        status: this.getStatus()
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Manual JWT activation failed:', error);
      throw error;
    }
  }
}