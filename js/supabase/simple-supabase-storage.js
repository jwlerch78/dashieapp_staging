// js/supabase/simple-supabase-storage.js
// CHANGE SUMMARY: Simplified to use Cognito JWT tokens directly for RLS, removed Edge Function complexity

import { supabase } from './supabase-config.js';

export class SimpleSupabaseStorage {
  constructor(userId, userEmail) {
    this.supabase = supabase;
    this.userId = userId;
    this.userEmail = userEmail;
    this.isRLSMode = false;
    this.currentUser = null;
    this.pendingChanges = [];
    this.isOnline = navigator.onLine;
    this.retryTimeout = null;
    this.maxRetries = 3;
    this.syncInProgress = false;
    this.realtimeSubscription = null;
    
    this.setupNetworkMonitoring();
    this.initializeAuth();
  }

  // NEW: Initialize authentication with Cognito JWT tokens
  async initializeAuth() {
    const cognitoToken = this.getCognitoAuthToken();
    const currentUser = this.getCurrentUser();
    
    if (cognitoToken && currentUser) {
      try {
        // Set the JWT token directly in Supabase client headers
        this.supabase.auth.setAuth(cognitoToken);
        this.isRLSMode = true;
        this.currentUser = currentUser;
        
        console.log('📊 ✅ Supabase RLS mode enabled with Cognito JWT');
        
        // Test RLS access
        await this.testRLSAccess();
        
        // Setup realtime subscription with auth
        this.setupRealtimeSubscription();
        
      } catch (error) {
        console.warn('📊 ⚠️ RLS setup failed, falling back to non-RLS mode:', error);
        this.isRLSMode = false;
      }
    } else {
      console.log('📊 No Cognito auth available, using non-RLS mode');
      this.isRLSMode = false;
    }
  }

  // Get Cognito JWT token for RLS authentication
  getCognitoAuthToken() {
    // Try multiple sources for Cognito tokens
    if (window.authManager?.cognitoAuth?.getCognitoTokens) {
      const tokens = window.authManager.cognitoAuth.getCognitoTokens();
      return tokens?.idToken; // Use ID token for Supabase RLS
    }
    
    if (window.dashieAuth?.authManager?.cognitoAuth?.getCognitoTokens) {
      const tokens = window.dashieAuth.authManager.cognitoAuth.getCognitoTokens();
      return tokens?.idToken;
    }
    
    // Fallback: try to get from saved user data
    try {
      const savedUser = localStorage.getItem('dashie-cognito-user');
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        return userData.cognitoTokens?.idToken;
      }
    } catch (error) {
      console.warn('⚠️ Failed to get Cognito token from localStorage:', error);
    }
    
    return null;
  }

  getCurrentUser() {
    // Try multiple sources for current user
    if (window.authManager?.currentUser) {
      return window.authManager.currentUser;
    }
    
    if (window.dashieAuth?.authManager?.currentUser) {
      return window.dashieAuth.authManager.currentUser;
    }
    
    // Fallback: try to get from saved user data
    try {
      const savedUser = localStorage.getItem('dashie-cognito-user');
      if (savedUser) {
        return JSON.parse(savedUser);
      }
    } catch (error) {
      console.warn('⚠️ Failed to get user from localStorage:', error);
    }
    
    return null;
  }

  // Test RLS access to verify authentication works
  async testRLSAccess() {
    try {
      const { data, error } = await this.supabase
        .from('user_settings')
        .select('count')
        .limit(1);
      
      if (error) {
        console.warn('📊 RLS test failed:', error);
        throw error;
      }
      
      console.log('📊 ✅ RLS access test successful');
      return true;
    } catch (error) {
      console.error('📊 ❌ RLS access test failed:', error);
      throw error;
    }
  }

  // Load settings from Supabase or localStorage fallback
  async loadSettings() {
    const user = this.getCurrentUser();
    if (!user?.email) {
      console.warn('📊 No user email available, using localStorage only');
      return this.loadFromLocalStorage('anonymous');
    }

    // Always try localStorage first for faster loading
    const localSettings = this.loadFromLocalStorage(user.email);
    
    if (!this.isOnline) {
      console.log('📊 Offline mode, using localStorage');
      return localSettings;
    }

    try {
      // Try to load from Supabase with current auth mode
      const supabaseSettings = this.isRLSMode 
        ? await this.loadSettingsWithRLS(user)
        : await this.loadSettingsWithoutRLS(user);

      if (supabaseSettings) {
        console.log('📊 ✅ Settings loaded from Supabase');
        // Save to localStorage as backup
        this.saveToLocalStorage(user.email, supabaseSettings);
        return supabaseSettings;
      }

    } catch (error) {
      console.error('📊 ❌ Failed to load settings from Supabase:', error);
      
      // If RLS failed, try fallback to non-RLS
      if (this.isRLSMode) {
        console.log('📊 Trying non-RLS fallback...');
        try {
          const fallbackSettings = await this.loadSettingsWithoutRLS(user);
          if (fallbackSettings) {
            this.isRLSMode = false; // Switch to non-RLS mode
            return fallbackSettings;
          }
        } catch (fallbackError) {
          console.error('📊 ❌ Non-RLS fallback also failed:', fallbackError);
        }
      }
    }

    // Return localStorage data as final fallback
    console.log('📊 Using localStorage fallback');
    return localSettings;
  }

  async loadSettingsWithRLS(user) {
    try {
      // Refresh auth token if needed
      await this.refreshAuthIfNeeded();
      
      const { data, error } = await this.supabase
        .from('user_settings')
        .select('settings, updated_at')
        .eq('user_email', user.email)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No data found - this is OK for new users
          console.log('📊 No settings found for user (new user)');
          return null;
        }
        throw error;
      }

      return data?.settings || null;

    } catch (error) {
      console.error('📊 ❌ RLS settings load failed:', error);
      throw error;
    }
  }

  async loadSettingsWithoutRLS(user) {
    try {
      const { data, error } = await this.supabase
        .from('user_settings')
        .select('settings, updated_at')
        .eq('user_email', user.email)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('📊 No settings found for user (new user)');
          return null;
        }
        throw error;
      }

      return data?.settings || null;

    } catch (error) {
      console.error('📊 ❌ Non-RLS settings load failed:', error);
      throw error;
    }
  }

  // Save settings to Supabase and localStorage
  async saveSettings(settings) {
    const user = this.getCurrentUser();
    if (!user?.email) {
      console.warn('📊 No user email, saving to localStorage only');
      this.saveToLocalStorage('anonymous', settings);
      return true;
    }

    // Always save to localStorage first
    this.saveToLocalStorage(user.email, settings);

    if (!this.isOnline) {
      console.log('📊 Offline mode, queuing for later sync');
      this.queuePendingChange('save', settings);
      return true;
    }

    try {
      // Save to Supabase with current auth mode
      const success = this.isRLSMode 
        ? await this.saveSettingsWithRLS(user, settings)
        : await this.saveSettingsWithoutRLS(user, settings);

      if (success) {
        console.log('📊 ✅ Settings saved to Supabase');
        this.removePendingChange('save');
        return true;
      }

    } catch (error) {
      console.error('📊 ❌ Failed to save settings to Supabase:', error);
      
      // If RLS failed, try fallback to non-RLS
      if (this.isRLSMode) {
        console.log('📊 Trying non-RLS save fallback...');
        try {
          const fallbackSuccess = await this.saveSettingsWithoutRLS(user, settings);
          if (fallbackSuccess) {
            this.isRLSMode = false; // Switch to non-RLS mode
            return true;
          }
        } catch (fallbackError) {
          console.error('📊 ❌ Non-RLS save fallback also failed:', fallbackError);
        }
      }
      
      this.queuePendingChange('save', settings);
    }

    return false;
  }

  async saveSettingsWithRLS(user, settings) {
    try {
      // Refresh auth token if needed
      await this.refreshAuthIfNeeded();
      
      const { data, error } = await this.supabase
        .from('user_settings')
        .upsert({
          user_email: user.email,
          user_id: user.id || user.sub,
          settings: settings,
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'user_email'
        });

      if (error) throw error;
      return true;

    } catch (error) {
      console.error('📊 ❌ RLS settings save failed:', error);
      throw error;
    }
  }

  async saveSettingsWithoutRLS(user, settings) {
    try {
      const { data, error } = await this.supabase
        .from('user_settings')
        .upsert({
          user_email: user.email,
          user_id: user.id || user.sub,
          settings: settings,
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'user_email'
        });

      if (error) throw error;
      return true;

    } catch (error) {
      console.error('📊 ❌ Non-RLS settings save failed:', error);
      throw error;
    }
  }

  // Refresh Cognito auth token if needed
  async refreshAuthIfNeeded() {
    try {
      // Check if we have a refresh method available
      if (window.authManager?.refreshGoogleAccessToken) {
        // This should also refresh Cognito tokens
        await window.authManager.refreshGoogleAccessToken();
        
        // Update our auth token
        const newToken = this.getCognitoAuthToken();
        if (newToken) {
          this.supabase.auth.setAuth(newToken);
          console.log('📊 ✅ Auth token refreshed');
        }
      }
    } catch (error) {
      console.warn('📊 ⚠️ Auth token refresh failed:', error);
      // Continue anyway - the request might still work
    }
  }

  // Local storage methods (unchanged)
  saveToLocalStorage(userEmail, settings) {
    try {
      const storageKey = `dashie-settings-${userEmail}`;
      const storageData = {
        settings,
        lastSync: Date.now(),
        userEmail
      };
      localStorage.setItem(storageKey, JSON.stringify(storageData));
    } catch (error) {
      console.error('📊 ❌ Failed to save to localStorage:', error);
    }
  }

  loadFromLocalStorage(userEmail) {
    try {
      const storageKey = `dashie-settings-${userEmail}`;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const { settings, lastSync } = JSON.parse(stored);
        
        // Check if data is not too old (7 days)
        if (lastSync && (Date.now() - lastSync < 7 * 24 * 60 * 60 * 1000)) {
          return settings;
        }
      }
    } catch (error) {
      console.error('📊 ❌ Failed to load from localStorage:', error);
    }
    
    return null;
  }

  // Network monitoring and offline sync
  setupNetworkMonitoring() {
    window.addEventListener('online', () => {
      console.log('🌐 Back online, syncing pending changes...');
      this.isOnline = true;
      this.syncPendingChanges();
    });

    window.addEventListener('offline', () => {
      console.log('📱 Gone offline, will queue changes');
      this.isOnline = false;
    });
  }

  queuePendingChange(operation, data) {
    const change = {
      operation,
      data,
      timestamp: Date.now(),
      retries: 0
    };
    
    this.pendingChanges.push(change);
    
    try {
      localStorage.setItem('dashie-pending-changes', JSON.stringify(this.pendingChanges));
    } catch (error) {
      console.error('Failed to save pending changes:', error);
    }
  }

  removePendingChange(operation) {
    this.pendingChanges = this.pendingChanges.filter(change => change.operation !== operation);
    
    try {
      localStorage.setItem('dashie-pending-changes', JSON.stringify(this.pendingChanges));
    } catch (error) {
      console.error('Failed to update pending changes:', error);
    }
  }

  async syncPendingChanges() {
    if (this.syncInProgress || !this.isOnline || this.pendingChanges.length === 0) {
      return;
    }

    this.syncInProgress = true;
    console.log(`📊 🔄 Syncing ${this.pendingChanges.length} pending changes...`);

    const changesToSync = [...this.pendingChanges];

    for (const change of changesToSync) {
      try {
        if (change.operation === 'save') {
          const success = await this.saveSettings(change.data);
          if (success) {
            this.removePendingChange(change.operation);
          } else {
            change.retries++;
            if (change.retries >= this.maxRetries) {
              console.error('📊 ❌ Max retries exceeded for pending change:', change);
              this.removePendingChange(change.operation);
            }
          }
        }
      } catch (error) {
        console.error('📊 ❌ Failed to sync pending change:', error);
        change.retries++;
      }
    }

    this.syncInProgress = false;
    console.log('📊 ✅ Pending changes sync completed');
  }

  // Realtime subscriptions with RLS support
  setupRealtimeSubscription() {
    if (!this.isRLSMode || !this.currentUser?.email) {
      console.log('📊 Skipping realtime subscription (no RLS or user)');
      return;
    }

    try {
      // Unsubscribe from any existing subscription
      if (this.realtimeSubscription) {
        this.realtimeSubscription.unsubscribe();
      }

      // Subscribe to changes for this user's settings
      this.realtimeSubscription = this.supabase
        .channel('user_settings_changes')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'user_settings',
            filter: `user_email=eq.${this.currentUser.email}`
          }, 
          (payload) => {
            console.log('📊 🔄 Realtime settings change detected:', payload);
            this.handleRealtimeChange(payload);
          }
        )
        .subscribe();

      console.log('📊 ✅ Realtime subscription active');

    } catch (error) {
      console.error('📊 ❌ Failed to setup realtime subscription:', error);
    }
  }

  handleRealtimeChange(payload) {
    // Notify any listeners about settings changes
    const event = new CustomEvent('dashie-settings-changed', {
      detail: {
        eventType: payload.eventType,
        new: payload.new,
        old: payload.old
      }
    });
    
    window.dispatchEvent(event);
  }

  // Compatibility methods for existing settings system
  subscribeToChanges(callback) {
    const handler = (event) => {
      if (event.detail && callback) {
        callback(event.detail);
      }
    };
    
    window.addEventListener('dashie-settings-changed', handler);
    
    // Return unsubscribe function
    return () => {
      window.removeEventListener('dashie-settings-changed', handler);
    };
  }

  unsubscribeAll() {
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
      this.realtimeSubscription = null;
    }
    console.log('📊 🔄 Unsubscribed from all changes');
  }

  // Cleanup method
  destroy() {
    this.unsubscribeAll();
    
    // Clear any pending sync timers
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
    
    console.log('📊 SimpleSupabaseStorage destroyed');
  }
}
