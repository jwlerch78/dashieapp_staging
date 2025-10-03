// js/supabase/simple-supabase-storage.js
// CHANGE SUMMARY: Fixed localStorage key to always use 'dashie-settings' without userId suffix; ensures settings with tokens are saved after database load

import { supabase } from './supabase-config.js';

export class SimpleSupabaseStorage {
  constructor(userId, userEmail = null) {
    this.userId = userId;
    this.userEmail = userEmail;
    this.localStorageKey = 'dashie-settings'; // FIXED: Always use same key, no userId suffix
    this.isOnline = navigator.onLine;
    
    // JWT configuration - determined once on first use
    this.jwtMode = null; // null = not determined yet, true = JWT mode, false = direct mode
    this.jwtService = null;
    
    console.log('📦 SimpleSupabaseStorage initialized for user:', userId);
    console.log('📦 Using localStorage key:', this.localStorageKey);
    
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
      } else {
        console.log('⚡ Direct database mode selected (RLS disabled)');
      }

      return this.jwtMode;

    } catch (error) {
      console.error('❌ Mode determination failed:', error);
      this.jwtMode = false;
      return false;
    }
  }

  /**
   * Check if JWT service is available (synchronous check)
   */
  checkJWTAvailabilitySync() {
    if (!window.jwtAuth) {
      console.log('❌ window.jwtAuth not found');
      return false;
    }

    if (typeof window.jwtAuth.isServiceReady !== 'function') {
      console.log('❌ window.jwtAuth.isServiceReady is not a function');
      return false;
    }

    const isReady = window.jwtAuth.isServiceReady();
    console.log('✅ JWT service is available and ready');
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
          console.log('🔒 RLS is ENABLED (INSERT blocked by RLS)');
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
        await this.broadcastChange();
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
        // CRITICAL: Save to localStorage immediately with correct key
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
    await this.broadcastChange();
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
      // FIXED: Save directly to the settings object without wrapper
      // This matches what SettingsController expects
      
      // DEBUG: Log what we're about to save
      console.log('💾 [DEBUG] Saving to localStorage:', {
        key: this.localStorageKey,
        hasTokenAccounts: !!settings?.tokenAccounts,
        tokenAccountKeys: settings?.tokenAccounts ? Object.keys(settings.tokenAccounts) : [],
        googlePersonalToken: settings?.tokenAccounts?.google?.personal?.access_token?.slice(-10) || 'none'
      });
      
      localStorage.setItem(this.localStorageKey, JSON.stringify(settings));
      
      // DEBUG: Verify what was actually saved
      const verification = localStorage.getItem(this.localStorageKey);
      const parsed = JSON.parse(verification);
      console.log('💾 [DEBUG] Verified saved data:', {
        hasTokenAccounts: !!parsed?.tokenAccounts,
        googlePersonalToken: parsed?.tokenAccounts?.google?.personal?.access_token?.slice(-10) || 'none'
      });
      
      console.log('💾 Settings saved to localStorage key:', this.localStorageKey);
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

      const settings = JSON.parse(stored);
      console.log('💾 Settings loaded from localStorage');
      return settings;
      
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
      jwtReady: this.jwtService ? this.jwtService.isServiceReady?.() : false,
      localStorageKey: this.localStorageKey
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

  console.log('🔄 Setting up broadcast subscription for user:', this.userId);

  const channelName = `user_settings_${this.userId}`;
  
  const subscription = window.supabase
    .channel(channelName)
    .on('broadcast', { event: 'settings-changed' }, (payload) => {
      console.log('🔄 Broadcast received:', payload);
      
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
    console.log('🔄 Broadcast subscription cleaned up');
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
  
  console.log('📡 Broadcast sent: settings-changed');
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