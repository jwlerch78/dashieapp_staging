// js/supabase/simple-supabase-storage.js - Complete Storage with RLS Support

import { supabase } from './supabase-config.js';

export class SimpleSupabaseStorage {
  constructor(userId, userEmail = null) {
    this.userId = userId;
    this.userEmail = userEmail;
    this.localStorageKey = 'dashie-settings';
    this.isOnline = navigator.onLine;
    this.supabaseAuthToken = null;
    this.isRLSEnabled = false;
    
    // Listen for online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingChanges();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  // Get Google access token from your auth system
  getGoogleAccessToken() {
    // Try to get token from auth manager first
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
    
    console.warn('🔐 No Google access token found - will use non-RLS mode');
    return null;
  }

  // Get Supabase auth token from Google OAuth via Edge Function
  async ensureSupabaseAuth() {
    if (this.supabaseAuthToken) {
      return this.supabaseAuthToken; // Already authenticated
    }

    try {
      console.log('🔐 Getting Supabase auth via Edge Function...');
      
      const currentUser = window.dashieAuth?.getUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      // Get Google access token
      const googleToken = this.getGoogleAccessToken();
      if (!googleToken) {
        throw new Error('No Google access token available');
      }

      console.log('🔐 Calling Edge Function with user:', currentUser.email);

      // Call your Edge Function - REPLACE WITH YOUR ACTUAL PROJECT URL
      const response = await fetch(`https://cseaywxcvnxcsypaqaid.supabase.co/functions/v1/hyper-responder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          googleToken: googleToken,
          userData: {
            id: currentUser.id,
            email: currentUser.email,
            name: currentUser.name,
            picture: currentUser.picture,
            authMethod: currentUser.authMethod
          }
        })
      });

      console.log('🔐 Edge Function response status:', response.status);

      const result = await response.json();
      console.log('🔐 Edge Function result:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to authenticate with Supabase');
      }

      this.supabaseAuthToken = result.supabaseToken;
      
      // Set the session in Supabase client
      const { error } = await supabase.auth.setSession({
        access_token: result.supabaseToken,
        refresh_token: null
      });

      if (error) {
        console.warn('Session set warning:', error);
      }

      this.isRLSEnabled = true;
      console.log('🔐 ✅ Supabase RLS authentication established');
      return this.supabaseAuthToken;

    } catch (error) {
      console.error('🔐 ❌ Supabase auth failed:', error);
      console.log('🔐 ⚠️ Falling back to non-RLS mode');
      this.isRLSEnabled = false;
      return null;
    }
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

  // Save to Supabase with RLS support
  async saveToSupabase(settings) {
    if (!this.userId) throw new Error('No user ID');

    try {
      // Try to establish Supabase auth (won't break if it fails)
      await this.ensureSupabaseAuth();
      
      // Save with current auth status
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
      
      const mode = this.isRLSEnabled ? '(with RLS auth)' : '(without RLS)';
      console.log(`📊 Settings saved to Supabase successfully ${mode}`);
      return data;
      
    } catch (error) {
      console.error('Supabase save failed:', error);
      throw error;
    }
  }

  // Load from Supabase with RLS support
  async loadFromSupabase() {
    if (!this.userId) return null;

    try {
      // Try to establish auth (optional)
      await this.ensureSupabaseAuth();
      
      console.log('🔍 Loading from Supabase for user:', this.userId);
      
      const { data, error } = await supabase
        .from('user_settings')
        .select('settings, updated_at')
        .eq('user_id', this.userId);

      if (error) {
        console.error('🔍 Supabase load error:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const record = data[0];
        const mode = this.isRLSEnabled ? '(with RLS auth)' : '(without RLS)';
        console.log(`📊 Settings loaded from Supabase ${mode}`);
        return {
          ...record.settings,
          lastModified: new Date(record.updated_at).getTime()
        };
      } else {
        console.log('📊 No settings found in Supabase (new user)');
        return null;
      }

    } catch (error) {
      console.error('🔍 Supabase load failed:', error);
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
