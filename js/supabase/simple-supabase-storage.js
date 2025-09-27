// js/supabase/simple-supabase-storage.js - Enhanced Storage with Smart JWT Auto-Enablement
// CHANGE SUMMARY: Implemented smart JWT auto-enablement that automatically detects RLS status and JWT service availability, enabling transparent JWT mode when needed while maintaining fallback to direct access

import { supabase } from './supabase-config.js';

export class SimpleSupabaseStorage {
  constructor(userId, userEmail = null) {
    this.userId = userId;
    this.userEmail = userEmail;
    this.localStorageKey = 'dashie-settings';
    this.isOnline = navigator.onLine;
    
    // Smart JWT configuration - will be auto-determined
    this.jwtMode = null; // null = not determined yet, true = JWT mode, false = direct mode
    this.jwtService = null;
    this.supabaseAuthToken = null;
    this.isRLSEnabled = null; // null = not checked yet
    this.jwtServiceAvailable = null; // null = not checked yet
    
    // Performance tracking
    this.lastRLSCheck = null;
    this.lastJWTCheck = null;
    this.checkCacheMs = 30000; // Cache checks for 30 seconds
    
    // Retry mechanism
    this.jwtRetryTimer = null;
    
    console.log('🔧 SimpleSupabaseStorage initialized for user:', userId);
    
    // Listen for online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingChanges();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Clean up timer on page unload
    window.addEventListener('beforeunload', () => {
      if (this.jwtRetryTimer) {
        clearTimeout(this.jwtRetryTimer);
      }
    });
  }

  /**
   * Smart auto-enablement: Check if JWT mode should be used
   * @returns {Promise<boolean>} true if JWT mode enabled, false if direct mode
   */
  async determineMode() {
    if (this.jwtMode !== null) {
      return this.jwtMode; // Already determined
    }

    console.log('🔧 🔍 Determining optimal storage mode...');

    try {
      // Check both conditions in parallel for better performance
      const [rlsEnabled, jwtAvailable] = await Promise.all([
        this.checkRLSStatus(),
        this.checkJWTServiceAvailability()
      ]);

      console.log('🔧 📊 Mode determination results:', {
        rlsEnabled,
        jwtAvailable,
        userId: this.userId
      });

      // Enable JWT mode only if BOTH conditions are met
      if (rlsEnabled && jwtAvailable) {
        this.jwtMode = true;
        console.log('🔧 ✅ JWT mode auto-enabled (RLS active + JWT service available)');
        await this.initializeJWTService();
      } else if (rlsEnabled && !jwtAvailable) {
        // RLS is enabled but JWT not available - this will cause issues
        console.log('🔧 ⚠️ RLS enabled but JWT service unavailable - will retry later');
        this.jwtMode = false; // Temporarily use direct mode
        this.scheduleJWTRetry(); // Schedule retry when JWT becomes available
      } else {
        this.jwtMode = false;
        console.log('🔧 ⚡ Direct mode selected', {
          reason: !rlsEnabled ? 'RLS disabled' : 'JWT service unavailable'
        });
      }

      return this.jwtMode;

    } catch (error) {
      console.warn('🔧 ⚠️ Mode determination failed, defaulting to direct mode:', error.message);
      this.jwtMode = false;
      return false;
    }
  }

  /**
   * Schedule retry to enable JWT mode when service becomes available
   */
  scheduleJWTRetry() {
    if (this.jwtRetryTimer) {
      clearTimeout(this.jwtRetryTimer);
    }

    console.log('🔧 🔄 Scheduling JWT availability retry...');
    
    this.jwtRetryTimer = setTimeout(async () => {
      try {
        console.log('🔧 🔄 Retrying JWT detection...');
        
        // Reset JWT availability cache
        this.jwtServiceAvailable = null;
        this.lastJWTCheck = null;
        
        const jwtAvailable = await this.checkJWTServiceAvailability();
        if (jwtAvailable) {
          console.log('🔧 ✅ JWT service now available! Switching to JWT mode...');
          this.jwtMode = true;
          await this.initializeJWTService();
          
          // Notify about the mode switch
          console.log('🔧 🎉 Successfully switched to JWT mode after retry');
        } else {
          // Schedule another retry
          console.log('🔧 🔄 JWT still not available, scheduling another retry...');
          this.scheduleJWTRetry();
        }
      } catch (error) {
        console.warn('🔧 ⚠️ JWT retry failed:', error.message);
        this.scheduleJWTRetry(); // Try again
      }
    }, 5000); // Retry every 5 seconds
  }

  /**
   * Check if RLS is enabled on the user_settings table
   * @returns {Promise<boolean>}
   */
  async checkRLSStatus() {
    // Use cache if recent
    if (this.isRLSEnabled !== null && this.lastRLSCheck && 
        (Date.now() - this.lastRLSCheck) < this.checkCacheMs) {
      console.log('🔧 📋 Using cached RLS status:', this.isRLSEnabled);
      return this.isRLSEnabled;
    }

    console.log('🔧 🔍 Checking RLS status...');

    try {
      // CORRECTED: Try to INSERT without auth - this will reveal RLS status more reliably
      // First, try a read operation to see baseline behavior
      const { data: readData, error: readError } = await supabase
        .from('user_settings')
        .select('user_id')
        .limit(1);

      // Then try a write operation which is more likely to trigger RLS errors
      const testUserId = 'rls-test-' + Date.now();
      const { data: writeData, error: writeError } = await supabase
        .from('user_settings')
        .insert({
          user_id: testUserId,
          user_email: 'test@example.com',
          settings: { test: true },
          updated_at: new Date().toISOString()
        })
        .select();

      console.log('🔧 📊 RLS detection results:', {
        readError: readError?.message,
        readDataCount: readData?.length || 0,
        writeError: writeError?.message,
        writeData: writeData
      });

      // Check for explicit RLS policy violations
      if (writeError) {
        const rlsError = writeError.message.includes('row-level security') || 
                        writeError.message.includes('policy') ||
                        writeError.message.includes('insufficient privilege') ||
                        writeError.code === 'PGRST116' || // PostgREST RLS violation
                        writeError.code === '42501'; // PostgreSQL insufficient privilege

        if (rlsError) {
          console.log('🔧 🔒 RLS is ENABLED (detected via policy violation on INSERT)');
          this.isRLSEnabled = true;
        } else {
          console.log('🔧 ❓ INSERT failed for other reason:', writeError.message);
          // Fall back to read-based detection
          this.isRLSEnabled = this.detectRLSFromReadBehavior(readData, readError);
        }
      } else {
        // INSERT succeeded - check if we need to clean up test record
        if (writeData && writeData.length > 0) {
          console.log('🔧 🧹 Cleaning up test record...');
          await supabase
            .from('user_settings')
            .delete()
            .eq('user_id', testUserId);
        }
        
        console.log('🔧 🔓 RLS is DISABLED (INSERT succeeded without auth)');
        this.isRLSEnabled = false;
      }

      this.lastRLSCheck = Date.now();
      return this.isRLSEnabled;

    } catch (error) {
      console.warn('🔧 ⚠️ RLS check failed, assuming enabled for safety:', error.message);
      // Default to enabled for safety if we can't determine
      this.isRLSEnabled = true;
      this.lastRLSCheck = Date.now();
      return true;
    }
  }

  /**
   * Detect RLS from read behavior when write test is inconclusive
   * @param {Array} readData 
   * @param {Object} readError 
   * @returns {boolean}
   */
  detectRLSFromReadBehavior(readData, readError) {
    if (readError) {
      // Read error might indicate RLS
      const rlsError = readError.message.includes('row-level security') || 
                      readError.message.includes('policy') ||
                      readError.code === 'PGRST116';
      if (rlsError) {
        console.log('🔧 🔒 RLS detected via read policy violation');
        return true;
      }
    }
    
    // If read succeeds but returns empty data, and we know there should be data,
    // this could indicate RLS filtering. However, this is inconclusive since
    // the table might actually be empty.
    console.log('🔧 ❓ RLS status inconclusive from read test, defaulting to enabled for safety');
    return true; // Default to enabled for safety
  }

  /**
   * Check if JWT service is available and functional
   * @returns {Promise<boolean>}
   */
  async checkJWTServiceAvailability() {
    // Use cache if recent
    if (this.jwtServiceAvailable !== null && this.lastJWTCheck && 
        (Date.now() - this.lastJWTCheck) < this.checkCacheMs) {
      console.log('🔧 📋 Using cached JWT availability:', this.jwtServiceAvailable);
      return this.jwtServiceAvailable;
    }

    console.log('🔧 🔍 Checking JWT service availability...');

    try {
      // Check for JWT service in various locations
      let jwtService = null;
      
      if (window.jwtAuth) {
        jwtService = window.jwtAuth;
        console.log('🔧 🔍 Found JWT service at window.jwtAuth');
      } else if (window.jwtPhase1?.jwtService) {
        jwtService = window.jwtPhase1.jwtService;
        console.log('🔧 🔍 Found JWT service at window.jwtPhase1.jwtService');
      } else if (window.jwtPhase1) {
        jwtService = window.jwtPhase1;
        console.log('🔧 🔍 Found JWT Phase1 object at window.jwtPhase1');
      } else {
        console.log('🔧 ❌ No JWT service found in any expected location');
        this.jwtServiceAvailable = false;
        this.lastJWTCheck = Date.now();
        return false;
      }

      // Check if we can get a Google token
      const googleToken = this.getGoogleAccessToken();
      if (!googleToken) {
        console.log('🔧 ❌ No Google access token available');
        this.jwtServiceAvailable = false;
        this.lastJWTCheck = Date.now();
        return false;
      }

      // Auto-enable JWT service if it's disabled or not enabled
      const actualJWTService = jwtService.jwtService || jwtService; // Handle both cases
      if (actualJWTService.enabled !== true && typeof enableJWT === 'function') {
        console.log('🔧 🔄 JWT service not enabled, auto-enabling...');
        enableJWT();
        // Give it a moment to enable
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Test JWT service connection
      let testResult = null;
      
      // Try the direct service first
      if (actualJWTService && typeof actualJWTService.testConnection === 'function') {
        console.log('🔧 🔍 Testing via actualJWTService.testConnection');
        testResult = await actualJWTService.testConnection();
      }
      // Try the parent object's runTests method
      else if (jwtService && typeof jwtService.runTests === 'function') {
        console.log('🔧 🔍 Testing via jwtService.runTests');
        const runResult = await jwtService.runTests();
        testResult = runResult?.connection; // Extract connection test result
      }
      // Try global test function as fallback
      else if (typeof testJWT === 'function') {
        console.log('🔧 🔍 Testing via global testJWT function');
        testResult = await testJWT();
      }

      console.log('🔧 📊 JWT test result:', testResult);

      if (testResult && (testResult.success || testResult.connected)) {
        console.log('🔧 ✅ JWT service is available and functional');
        this.jwtServiceAvailable = true;
        // Store reference to the working JWT service
        this.jwtService = actualJWTService;
      } else {
        console.log('🔧 ❌ JWT service test failed:', testResult);
        this.jwtServiceAvailable = false;
      }

      this.lastJWTCheck = Date.now();
      return this.jwtServiceAvailable;

    } catch (error) {
      console.warn('🔧 ⚠️ JWT availability check failed:', error.message);
      this.jwtServiceAvailable = false;
      this.lastJWTCheck = Date.now();
      return false;
    }
  }

  /**
   * Initialize JWT service for authenticated requests
   * @returns {Promise<void>}
   */
  async initializeJWTService() {
    // Use the JWT service that was found during availability check
    if (!this.jwtService) {
      // Fallback: try to find JWT service again
      if (window.jwtAuth) {
        this.jwtService = window.jwtAuth;
      } else if (window.jwtPhase1?.jwtService) {
        this.jwtService = window.jwtPhase1.jwtService;
      } else if (window.jwtPhase1) {
        this.jwtService = window.jwtPhase1;
      } else {
        throw new Error('JWT service not available');
      }
    }

    console.log('🔧 🔑 Initializing JWT service...');
    
    try {
      // Get Google access token
      const googleToken = this.getGoogleAccessToken();
      if (!googleToken) {
        throw new Error('No Google access token available');
      }

      console.log('🔧 ✅ JWT service initialized successfully');
      
    } catch (error) {
      console.error('🔧 ❌ JWT service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Ensure proper authentication mode is configured
   * @returns {Promise<boolean>} true if JWT mode, false if direct mode
   */
  async ensureSupabaseAuth() {
    const jwtMode = await this.determineMode();
    
    if (jwtMode && !this.supabaseAuthToken) {
      // Get JWT token for authenticated requests
      const googleToken = this.getGoogleAccessToken();
      if (!googleToken) {
        console.warn('🔧 ⚠️ JWT mode enabled but no Google token - falling back to direct mode');
        this.jwtMode = false;
        return false;
      }

      try {
        // The JWT service doesn't have a direct authenticate method
        // Instead, we'll get the token by doing a dummy load operation
        console.log('🔧 🔑 Getting JWT token via dummy load operation...');
        
        const dummyResult = await this.jwtService.loadSettings('auth-test@example.com');
        
        // Check if we got a valid response that indicates JWT is working
        if (dummyResult && (dummyResult.success !== false)) {
          // For JWT mode, we don't actually need to store a token
          // The JWT service handles authentication internally for each request
          this.supabaseAuthToken = 'jwt-managed'; // Flag that JWT is handling auth
          console.log('🔧 🔑 JWT authentication verified - service is handling auth internally');
        } else {
          throw new Error('JWT load test failed: ' + (dummyResult?.error || 'Unknown error'));
        }

      } catch (error) {
        console.warn('🔧 ⚠️ JWT authentication error - falling back to direct mode:', error.message);
        this.jwtMode = false;
        return false;
      }
    }

    return this.jwtMode;
  }

  /**
   * Enhanced Google access token retrieval
   * @returns {string|null}
   */
  getGoogleAccessToken() {
    // Method 1: Try to get token from auth manager first
    if (window.dashieAuth?.getGoogleAccessToken) {
      const token = window.dashieAuth.getGoogleAccessToken();
      if (token) {
        return token;
      }
    }
    
    // Method 2: Fallback - try to get from user object
    const user = window.dashieAuth?.getUser();
    if (user?.googleAccessToken) {
      return user.googleAccessToken;
    }
    
    // Method 3: Check direct storage
    try {
      const tokenData = localStorage.getItem('dashie-google-token');
      if (tokenData) {
        const parsed = JSON.parse(tokenData);
        if (parsed.access_token && parsed.expires_at > Date.now()) {
          return parsed.access_token;
        }
      }
    } catch (error) {
      // Ignore token parsing errors
    }
    
    return null;
  }

  /**
   * Save settings with automatic mode selection
   * @param {Object} settings 
   */
  async saveSettings(settings) {
    console.log('💾 Saving settings for user:', this.userId);
    console.log('💾 Online status:', this.isOnline);
    
    // Always save locally first (immediate)
    this.saveToLocalStorage(settings);
    console.log('💾 ✅ Saved to local storage');
    
    // Try to save to cloud (background) only if online
    if (this.isOnline) {
      try {
        await this.saveToSupabase(settings);
        console.log('☁️ ✅ Settings synced to Supabase');
      } catch (error) {
        console.warn('☁️ ❌ Supabase sync failed:', error.message);
        this.markForRetry(settings);
      }
    } else {
      console.log('📴 Offline - settings saved locally only');
      this.markForRetry(settings);
    }
  }

  /**
   * Save to Supabase with automatic JWT/direct mode selection
   * @param {Object} settings 
   */
  async saveToSupabase(settings) {
    if (!this.userId) throw new Error('No user ID');

    console.log('📊 💾 Starting Supabase save...');
    
    try {
      // Determine and configure authentication mode
      const jwtMode = await this.ensureSupabaseAuth();
      
      if (jwtMode && this.jwtService) {
        // Use JWT service directly
        console.log('📊 💾 Using JWT service for save');
        
        const jwtResult = await this.jwtService.saveSettings(this.userEmail, settings);
        
        console.log('📊 🔍 JWT save result:', jwtResult);
        
        // The JWT service returns different response formats, check multiple success indicators
        if (jwtResult && (jwtResult.success === true || jwtResult.saved === true)) {
          console.log('📊 ✅ JWT save successful');
          return jwtResult.data || jwtResult;
        } else if (jwtResult && !jwtResult.error) {
          // Sometimes success is implied by lack of error
          console.log('📊 ✅ JWT save successful (no error)');
          return jwtResult;
        } else {
          throw new Error(`JWT save failed: ${jwtResult?.error || JSON.stringify(jwtResult)}`);
        }
        
      } else {
        // Use direct Supabase access
        console.log('📊 💾 Using direct access mode');
        
        const saveData = {
          user_id: this.userId,
          user_email: this.userEmail,
          settings: settings,
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('user_settings')
          .upsert(saveData, {
            onConflict: 'user_id',
            ignoreDuplicates: false
          })
          .select();

        if (error) {
          // Handle RLS policy violations gracefully
          if (error.message.includes('row-level security') || error.message.includes('policy')) {
            console.log('📊 🔄 RLS policy violation detected, reconfiguring...');
            // Force mode recalculation on next call
            this.jwtMode = null;
            this.isRLSEnabled = null;
            throw new Error('RLS policy violation - mode will be reconfigured');
          }
          
          throw new Error(`Supabase error: ${error.message}`);
        }

        console.log('📊 ✅ Direct save successful');
        return data;
      }

    } catch (error) {
      console.error('📊 ❌ Supabase save failed:', error.message);
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

    console.log('📊 📖 Loading from Supabase...');

    try {
      // Determine and configure authentication mode
      const jwtMode = await this.ensureSupabaseAuth();
      
      if (jwtMode && this.jwtService) {
        // Use JWT service directly
        console.log('📊 📖 Using JWT service for load');
        
        const jwtResult = await this.jwtService.loadSettings(this.userEmail);
        
        console.log('📊 🔍 JWT load result:', jwtResult);
        
        // Handle different response formats from JWT service
        if (jwtResult && (jwtResult.success === true || jwtResult.loaded === true)) {
          console.log('📊 ✅ JWT load successful');
          return jwtResult.settings || jwtResult.data || null;
        } else if (jwtResult && jwtResult.error && jwtResult.error.includes('not found')) {
          console.log('📊 🔍 No settings found for user (JWT)');
          return null;
        } else if (jwtResult && !jwtResult.error) {
          // Sometimes success is implied by lack of error, and settings might be in the root
          console.log('📊 ✅ JWT load successful (no error)');
          return jwtResult.settings || jwtResult;
        } else {
          throw new Error(`JWT load failed: ${jwtResult?.error || JSON.stringify(jwtResult)}`);
        }
        
      } else {
        // Use direct Supabase access
        console.log('📊 📖 Using direct access mode');
        
        const { data, error } = await supabase
          .from('user_settings')
          .select('settings')
          .eq('user_id', this.userId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            console.log('📊 🔍 No settings found for user');
            return null;
          }
          
          // Handle RLS policy violations
          if (error.message.includes('row-level security') || error.message.includes('policy')) {
            console.log('📊 🔄 RLS policy violation detected, reconfiguring...');
            // Force mode recalculation on next call
            this.jwtMode = null;
            this.isRLSEnabled = null;
            throw new Error('RLS policy violation - mode will be reconfigured');
          }
          
          throw new Error(`Supabase error: ${error.message}`);
        }

        console.log('📊 ✅ Direct load successful');
        return data?.settings || null;
      }

    } catch (error) {
      console.error('📊 ❌ Supabase load failed:', error.message);
      throw error;
    }
  }

  // ====== LOCAL STORAGE METHODS (Unchanged) ======

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
      
      // Validate the data belongs to current user
      if (parsed.user_id !== this.userId) {
        console.log('💾 🔄 Local storage data is for different user, ignoring');
        return null;
      }
      
      return parsed.settings;
    } catch (error) {
      console.error('💾 ❌ Local storage load failed:', error);
      return null;
    }
  }

  markForRetry(settings) {
    // Store pending changes for retry when online
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

  async syncPendingChanges() {
    // Sync any pending changes when coming back online
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

  // ====== REAL-TIME SYNC METHODS (Unchanged) ======

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
   * Get current configuration status for debugging
   */
  getStatus() {
    return {
      userId: this.userId,
      userEmail: this.userEmail,
      jwtMode: this.jwtMode,
      isRLSEnabled: this.isRLSEnabled,
      jwtServiceAvailable: this.jwtServiceAvailable,
      hasJWTService: !!this.jwtService,
      hasSupabaseToken: !!this.supabaseAuthToken,
      hasGoogleToken: !!this.getGoogleAccessToken(),
      isOnline: this.isOnline,
      lastRLSCheck: this.lastRLSCheck ? new Date(this.lastRLSCheck).toISOString() : null,
      lastJWTCheck: this.lastJWTCheck ? new Date(this.lastJWTCheck).toISOString() : null,
      hasRetryTimer: !!this.jwtRetryTimer
    };
  }

  /**
   * Manually trigger JWT mode activation (for debugging/testing)
   */
  async activateJWTMode() {
    console.log('🔧 🔄 Manually activating JWT mode...');
    
    try {
      // Reset caches to force fresh checks
      this.jwtMode = null;
      this.jwtServiceAvailable = null;
      this.lastJWTCheck = null;
      
      // Clear any existing retry timer
      if (this.jwtRetryTimer) {
        clearTimeout(this.jwtRetryTimer);
        this.jwtRetryTimer = null;
      }
      
      // Force mode determination
      const result = await this.determineMode();
      
      console.log('🔧 📊 Manual activation result:', {
        jwtMode: result,
        status: this.getStatus()
      });
      
      return result;
      
    } catch (error) {
      console.error('🔧 ❌ Manual JWT activation failed:', error);
      throw error;
    }
  }
}