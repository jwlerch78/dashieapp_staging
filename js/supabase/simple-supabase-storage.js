// js/supabase/simple-supabase-storage.js
// CHANGE SUMMARY: Removed isSupabaseAuthenticated check - JWT service no longer authenticates Supabase client directly

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
   * Determine and configure authentication mode
   * NOTE: JWT service provides authentication via edge functions, not direct Supabase client auth
   * @returns {Promise<boolean>} true if JWT mode, false if direct mode
   */
  async determineAuthMode() {
    if (this.jwtMode !== null) {
      return this.jwtMode; // Already determined
    }

    console.log('🔍 Determining optimal storage mode...');

    try {
      // Check if JWT service is available
      const jwtAvailable = this.checkJWTAvailabilitySync();

      if (jwtAvailable) {
        // JWT is ready - use edge function mode
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
      const testUserId = crypto.randomUUID();
      const { data, error } = await supabase
        .from('user_settings')
        .insert({
          auth_user_id: testUserId,
          email: 'test@example.com',
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
            .eq('auth_user_id', testUserId);
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
      await this.determineAuthMode();

      if (this.jwtMode) {
        console.log('🔐 Using JWT mode for save');
        return await this.saveViaJWT(settings);
      } else {
        console.log('⚡ Using direct mode for save');
        return await this.saveDirect(settings);
      }

    } catch (error) {
      console.error('❌ Cloud save failed, falling back to localStorage:', error);
      return this.saveToLocalStorage(settings);
    }
  }

  /**
   * Load settings with automatic mode selection
   */
  async loadSettings() {
    console.log('📖 Loading settings for user:', this.userId);
    
    try {
      await this.determineAuthMode();

      if (this.jwtMode) {
        console.log('🔐 Using JWT mode for load');
        return await this.loadViaJWT();
      } else {
        console.log('⚡ Using direct mode for load');
        return await this.loadDirect();
      }

    } catch (error) {
      console.error('❌ Cloud load failed, falling back to localStorage:', error);
      return this.loadFromLocalStorage();
    }
  }

  // ====== JWT MODE METHODS (using edge functions) ======

  async saveViaJWT(settings) {
    console.log('🔐 Saving settings via JWT-verified edge function');
    
    try {
      const result = await this.jwtService.saveSettings(settings);
      
      if (result.success) {
        console.log('✅ JWT save successful');
        // Also save to localStorage as backup
        this.saveToLocalStorage(settings);
        return true;
      } else {
        throw new Error('JWT save returned success: false');
      }

    } catch (error) {
      console.error('❌ JWT save failed:', error);
      throw error;
    }
  }

  async loadViaJWT() {
    console.log('🔐 Loading settings via JWT-verified edge function');
    
    try {
      const result = await this.jwtService.loadSettings(this.userEmail);
      
      if (result.success && result.settings) {
        console.log('✅ JWT load successful');
        // Save to localStorage for offline access
        this.saveToLocalStorage(result.settings);
        return result.settings;
      } else {
        console.log('📝 No settings found in JWT mode, checking localStorage');
        return this.loadFromLocalStorage();
      }

    } catch (error) {
      console.error('❌ JWT load failed:', error);
      throw error;
    }
  }

  // ====== DIRECT MODE METHODS (direct database access) ======

  async saveDirect(settings) {
    console.log('⚡ Saving settings via direct database access');
    
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
      console.error('❌ Direct save failed:', error);
      throw error;
    }

    console.log('✅ Direct save successful');
    // Also save to localStorage as backup
    this.saveToLocalStorage(settings);
    return true;
  }

  async loadDirect() {
    console.log('⚡ Loading settings via direct database access');
    
    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('auth_user_id', this.userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('📝 No settings found in database, checking localStorage');
        return this.loadFromLocalStorage();
      }
      console.error('❌ Direct load failed:', error);
      throw error;
    }

    if (data && data.settings) {
      console.log('✅ Direct load successful');
      // Save to localStorage for offline access
      this.saveToLocalStorage(data.settings);
      return data.settings;
    }

    console.log('📝 No settings in database, checking localStorage');
    return this.loadFromLocalStorage();
  }

  // ====== LOCAL STORAGE METHODS ======

  saveToLocalStorage(settings) {
    try {
      const settingsData = {
        settings: settings,
        savedAt: Date.now(),
        auth_user_id: this.userId
      };
      localStorage.setItem(this.localStorageKey, JSON.stringify(settingsData));
      console.log('💾 Settings saved to localStorage');
      return true;
    } catch (error) {
      console.error('❌ localStorage save failed:', error);
      return false;
    }
  }

  loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem(this.localStorageKey);
      if (!stored) {
        console.log('📝 No settings in localStorage');
        return null;
      }

      const settingsData = JSON.parse(stored);
      
      // Verify it's for the current user
      if (settingsData.auth_user_id !== this.userId) {
        console.log('⚠️ localStorage settings are for different user, ignoring');
        return null;
      }

      console.log('💾 Settings loaded from localStorage');
      return settingsData.settings;
      
    } catch (error) {
      console.error('❌ localStorage load failed:', error);
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
      jwtReady: this.jwtService ? this.jwtService.isServiceReady?.() : false
    };
  }

  async testConfiguration() {
    console.log('🧪 Testing current storage configuration...');
    
    const status = this.getStatus();
    console.table(status);
    
    try {
      const mode = await this.determineAuthMode();
      console.log('✅ Mode determination successful:', mode ? 'JWT' : 'Direct');
      
      return {
        success: true,
        mode: mode ? 'JWT' : 'Direct',
        status
      };
    } catch (error) {
      console.error('❌ Configuration test failed:', error);
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

    console.log('🔄 Setting up real-time subscription for user:', this.userId);

    const subscription = supabase
      .channel(`user_settings_${this.userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_settings',
        filter: `auth_user_id=eq.${this.userId}`
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

  markForRetry(settings) {
    try {
      const pending = {
        settings: settings,
        timestamp: Date.now(),
        auth_user_id: this.userId
      };
      localStorage.setItem(this.localStorageKey + '-pending', JSON.stringify(pending));
    } catch (error) {
      console.warn('Failed to mark settings for retry:', error);
    }
  }

  async syncPendingChanges() {
    try {
      const pendingData = localStorage.getItem(this.localStorageKey + '-pending');
      if (!pendingData) return;

      const pending = JSON.parse(pendingData);
      
      if (pending.auth_user_id === this.userId) {
        console.log('🔄 Syncing pending changes from localStorage');
        await this.saveSettings(pending.settings);
        localStorage.removeItem(this.localStorageKey + '-pending');
      }
    } catch (error) {
      console.warn('Failed to sync pending changes:', error);
    }
  }
}