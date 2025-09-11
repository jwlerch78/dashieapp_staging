// js/supabase/simple-supabase-storage.js - Supabase as Database Only

import { supabase } from './supabase-config.js';

export class SimpleSupabaseStorage {
  constructor(userId, userEmail = null) {
    this.userId = userId;
    this.userEmail = userEmail;
    this.localStorageKey = 'dashie-settings';
    this.isOnline = navigator.onLine;
    
    // Listen for online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingChanges();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  // Save settings with hybrid approach (local + cloud)
  async saveSettings(settings) {
    console.log('💾 Saving settings for user:', this.userId);
    
    // Always save locally first (immediate)
    this.saveToLocalStorage(settings);
    
    // Try to save to cloud (background)
    if (this.isOnline) {
      try {
        await this.saveToSupabase(settings);
        console.log('☁️ Settings synced to Supabase');
      } catch (error) {
        console.warn('☁️ Supabase sync failed, will retry when online:', error);
        this.markForRetry(settings);
      }
    } else {
      console.log('📴 Offline - settings will sync when online');
      this.markForRetry(settings);
    }
  }

  // Load settings with fallback strategy
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

  // Save to Supabase using direct database access
  async saveToSupabase(settings) {
    if (!this.userId) throw new Error('No user ID');

    try {
      // Use upsert to insert or update
      const { data, error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: this.userId,
          user_email: this.userEmail,
          settings: settings,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select();

      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }
      
      console.log('📊 Settings saved to Supabase successfully');
      return data;
    } catch (error) {
      console.error('Supabase save failed:', error);
      throw error;
    }
  }

  // Load from Supabase
 async loadFromSupabase() {
  if (!this.userId) return null;

  try {
    console.log('🔍 Debug: Loading from Supabase for user:', this.userId);
    
    // Remove .single() - get array instead
    const { data, error } = await supabase
      .from('user_settings')
      .select('settings, updated_at')
      .eq('user_id', this.userId);

    console.log('🔍 Debug: Supabase response:', { data, error });

    if (error) {
      console.error('🔍 Debug: Supabase load error:', error);
      throw error;
    }

    // Check if we got any results
    if (data && data.length > 0) {
      const settings = data[0]; // Get first (and only) result
      console.log('📊 Settings loaded from Supabase');
      return {
        ...settings.settings,
        lastModified: new Date(settings.updated_at).getTime()
      };
    } else {
      console.log('📊 No settings found in Supabase (new user)');
      return null;
    }

  } catch (error) {
    console.error('🔍 Debug: Supabase load failed:', error);
    throw error;
  }
}
  // Subscribe to real-time changes
  subscribeToChanges(callback) {
    if (!this.userId) return null;

    console.log('🔄 Setting up real-time sync for user:', this.userId);

    const subscription = supabase
      .channel(`settings-${this.userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${this.userId}`
        },
        (payload) => {
          console.log('🔄 Settings updated from another device');
          const newSettings = {
            ...payload.new.settings,
            lastModified: new Date(payload.new.updated_at).getTime()
          };
          
          // Update local cache
          this.saveToLocalStorage(newSettings);
          
          // Notify the app
          callback(newSettings);
        }
      )
      .subscribe((status) => {
        console.log('🔄 Real-time subscription status:', status);
      });

    return subscription;
  }

  // Local storage methods
  saveToLocalStorage(settings) {
    try {
      const dataToSave = {
        ...settings,
        lastModified: Date.now()
      };
      localStorage.setItem(this.localStorageKey, JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Local storage save failed:', error);
    }
  }

  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem(this.localStorageKey);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('Local storage load failed:', error);
      return null;
    }
  }

  markForRetry(settings) {
    try {
      localStorage.setItem('dashie-settings-pending', JSON.stringify({
        settings,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to mark for retry:', error);
    }
  }

  async syncPendingChanges() {
    try {
      const pending = localStorage.getItem('dashie-settings-pending');
      if (pending) {
        const { settings } = JSON.parse(pending);
        await this.saveToSupabase(settings);
        localStorage.removeItem('dashie-settings-pending');
        console.log('✅ Synced pending settings changes');
      }
    } catch (error) {
      console.warn('Failed to sync pending changes:', error);
    }
  }

  // Cleanup
  unsubscribeAll() {
    console.log('🧹 Cleaning up Supabase subscriptions');
  }
}

// js/supabase/simple-supabase-storage.js - Simplified token access
// Just update this one method in your existing storage class:

// Get Google access token from your auth system
getGoogleAccessToken() {
  // Try to get token from auth manager
  if (window.dashieAuth?.getGoogleAccessToken) {
    const token = window.dashieAuth.getGoogleAccessToken();
    if (token) {
      console.log('🔐 Found Google access token from auth manager');
      return token;
    }
  }
  
  // Fallback: try to get from user object
  const user = window.dashieAuth?.getUser();
  if (user?.googleAccessToken) {
    console.log('🔐 Found Google access token from user data');
    return user.googleAccessToken;
  }
  
  console.warn('🔐 No Google access token found - RLS will not work');
  console.warn('🔐 Available auth methods will fall back to non-RLS mode');
  return null;
}
