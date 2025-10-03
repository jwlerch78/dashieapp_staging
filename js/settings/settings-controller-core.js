// js/settings/settings-controller-core.js
// CHANGE SUMMARY: Replaced multi-source user detection with single source of truth from dashie_supabase_jwt localStorage. This fixes real-time sync by ensuring userId is properly set from JWT data.

export class SettingsControllerCore {
  constructor() {
    this.storage = null;
    this.currentSettings = {};
    this.isDirty = false;
    this.isInitialized = false;
    this.realtimeSubscription = null;
    
    // Define which settings should be stored locally only (device-specific)
    this.LOCAL_ONLY_SETTINGS = [
      'system.autoRedirect',
      'system.debugMode'
    ];
    
    // Navigation state for two-panel UI
    this.navigationState = {
      currentPanel: 'categories',
      selectedCategory: 'display',
      selectedSetting: 0,
      categories: [
        { id: 'accounts', label: '🔐 Accounts', icon: '🔐', enabled: true },
        { id: 'family', label: '👨‍👩‍👧‍👦 Family', icon: '👨‍👩‍👧‍👦', enabled: false },
        { id: 'widgets', label: '🖼️ Widgets', icon: '🖼️', enabled: true },
        { id: 'display', label: '🎨 Display', icon: '🎨', enabled: true },
        { id: 'system', label: '🔧 System', icon: '🔧', enabled: true },
        { id: 'about', label: 'ℹ️ About', icon: 'ℹ️', enabled: false }
      ]
    };
    
    // Bind methods to maintain context
    this.handleRealtimeUpdate = this.handleRealtimeUpdate.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
  }

  /**
   * Get user from dashie_supabase_jwt - SINGLE SOURCE OF TRUTH
   * @returns {Object|null} User object with {id, email} or null
   */
  getUserFromJWT() {
    try {
      const jwtData = localStorage.getItem('dashie_supabase_jwt');
      if (!jwtData) {
        console.log('⚙️ No JWT data found in localStorage');
        return null;
      }

      const parsed = JSON.parse(jwtData);
      
      // Check if JWT is expired
      if (parsed.expiry && Date.now() >= parsed.expiry) {
        console.warn('⚙️ JWT is expired');
        return null;
      }

      // Return user object with id and email from JWT
      if (parsed.userId && parsed.userEmail) {
        return {
          id: parsed.userId,
          email: parsed.userEmail
        };
      }

      console.warn('⚙️ JWT data missing userId or userEmail');
      return null;

    } catch (error) {
      console.error('⚙️ Error reading JWT data:', error);
      return null;
    }
  }

  /**
   * Wait for JWT to be available with timeout
   * @param {number} timeoutMs - Maximum time to wait in milliseconds
   * @returns {Promise<Object|null>} User object or null if timeout
   */
  async waitForJWT(timeoutMs = 5000) {
    const startTime = Date.now();
    
    console.log('⚙️ Waiting for JWT data...');
    
    while (Date.now() - startTime < timeoutMs) {
      const user = this.getUserFromJWT();
      if (user) {
        console.log('⚙️ ✅ JWT data found:', { userId: user.id, userEmail: user.email });
        return user;
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.warn('⚙️ ⏱️ Timeout waiting for JWT data');
    return null;
  }

  /**
   * Check if localStorage settings are stale
   * Settings are considered stale if they're older than 1 hour
   * @private
   * @returns {boolean} True if settings are stale or invalid
   */
  _isLocalStorageStale() {
    try {
      const saved = localStorage.getItem('dashie-settings');
      if (!saved) {
        console.log('⚙️ No localStorage settings found');
        return true;
      }
      
      const settings = JSON.parse(saved);
      
      // Check if settings have lastModified timestamp
      if (!settings.lastModified) {
        console.warn('⚙️ localStorage settings missing lastModified timestamp - treating as stale');
        return true;
      }
      
      // Check age (1 hour = 3600000ms)
      const age = Date.now() - settings.lastModified;
      const ONE_HOUR = 60 * 60 * 1000;
      const isStale = age > ONE_HOUR;
      
      if (isStale) {
        console.warn('⚙️ localStorage settings are stale', {
          ageMinutes: Math.round(age / 60000),
          lastModified: new Date(settings.lastModified).toISOString()
        });
      } else {
        console.log('⚙️ localStorage settings are fresh', {
          ageMinutes: Math.round(age / 60000)
        });
      }
      
      return isStale;
      
    } catch (error) {
      console.error('⚙️ Error checking localStorage staleness:', error);
      return true; // Treat as stale on error
    }
  }

  loadSettingsFromLocalStorage() {
    try {
      const saved = localStorage.getItem('dashie-settings');
      if (saved) {
        this.currentSettings = { ...this.getDefaultSettings(), ...JSON.parse(saved) };
        console.log('⚙️ 📱 Loaded settings from localStorage');
      } else {
        this.currentSettings = this.getDefaultSettings();
      }
    } catch (error) {
      console.error('⚙️ Failed to load from localStorage:', error);
      this.currentSettings = this.getDefaultSettings();
    }
  }

  saveToLocalStorage() {
    try {
      localStorage.setItem('dashie-settings', JSON.stringify(this.currentSettings));
      console.log('⚙️ 💾 Settings saved to localStorage');
    } catch (error) {
      console.error('⚙️ Failed to save to localStorage:', error);
    }
  }

  /**
   * Initialize with JWT-based user detection
   */
  async init() {
    try {
      console.log('⚙️ Initializing Settings Controller...');
      
      // Get user from JWT (single source of truth)
      const currentUser = await this.waitForJWT();
      
      if (!currentUser) {
        console.warn('⚙️ No JWT data available - using localStorage only');
        
        // Check if localStorage settings are stale before using them
        const isStale = this._isLocalStorageStale();
        
        if (isStale) {
          console.warn('⚙️ localStorage settings are stale - using defaults');
          this.currentSettings = this.getDefaultSettings();
        } else {
          // Settings are fresh - safe to use
          try {
            const savedSettings = localStorage.getItem('dashie-settings');
            if (savedSettings) {
              this.currentSettings = { ...this.getDefaultSettings(), ...JSON.parse(savedSettings) };
              console.log('⚙️ 📱 Loaded fresh settings from localStorage');
            } else {
              this.currentSettings = this.getDefaultSettings();
              console.log('⚙️ Using default settings (no localStorage found)');
            }
          } catch (error) {
            console.error('⚙️ Failed to load from localStorage:', error);
            this.currentSettings = this.getDefaultSettings();
          }
        }
        
        this.isInitialized = true;
        this.mergeLocalOnlySettings();
        await this.applyLoadedSettings();
        
        return true;
      }

      console.log('⚙️ Found authenticated user from JWT:', currentUser.email);

      // Initialize storage with current user from JWT
      const { SimpleSupabaseStorage } = await import('../supabase/simple-supabase-storage.js');
      this.storage = new SimpleSupabaseStorage(currentUser.id, currentUser.email);
      
      // Load settings from database/local storage
      const loadedSettings = await this.storage.loadSettings();
      this.currentSettings = loadedSettings || this.getDefaultSettings(currentUser.email);
      
      this.mergeLocalOnlySettings();
      await this.applyLoadedSettings();
      
      // Set up real-time sync
      this.setupRealtimeSync();
      
      // Set up auto-save on page unload
      window.addEventListener('beforeunload', this.handleBeforeUnload);
      
      this.isInitialized = true;
      console.log('⚙️ ✅ Settings Controller initialized successfully');
      
      return true;
      
    } catch (error) {
      console.error('⚙️ ❌ Settings Controller initialization failed:', error);
      
      this.currentSettings = this.getDefaultSettings();
      this.isInitialized = true;
      
      this.mergeLocalOnlySettings();
      await this.applyLoadedSettings();
      
      return false;
    }
  }

  // Default settings with proper user email and system settings
  getDefaultSettings(userEmail = 'unknown@example.com') {
    return {
      photos: {
        transitionTime: 5
      },
      display: {
        sleepTime: '22:00',
        wakeTime: '07:00', 
        reSleepDelay: 30,
        theme: 'dark'
      },
      accounts: {
        dashieAccount: userEmail,
        connectedServices: [],
        pinEnabled: false
      },
      family: {
        familyName: 'Dashie',
        members: []
      },
      system: {
        refreshInterval: 30,
        calendarRefreshInterval: 5
      },
      version: '2.0.0',
      lastModified: Date.now()
    };
  }

  // Get a specific setting value with dot notation
  getSetting(path) {
    const keys = path.split('.');
    let current = this.currentSettings;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  // Set setting with immediate application
  setSetting(path, value) {
    if (!this.isInitialized) {
      console.warn('⚙️ Settings not initialized, cannot set:', path);
      return false;
    }

    const keys = path.split('.');
    let current = this.currentSettings;
    
    // Navigate to the parent object, creating nested objects as needed
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
    
    // Set the final value
    const finalKey = keys[keys.length - 1];
    const oldValue = current[finalKey];
    current[finalKey] = value;
    
    // Mark as dirty if value changed
    if (oldValue !== value) {
      this.isDirty = true;
      this.currentSettings.lastModified = Date.now();
      
      // Apply immediate changes for specific settings
      if (path === 'display.theme') {
        this.applyThemeImmediate(value);
      }
      
      if (path === 'family.familyName') {
        this.applyFamilyNameImmediate(value);
      }
      
      if (path === 'system.activeSite') {
        this.handleSiteChange(value);
      }
      
      // Auto-save after a short delay (debounced)
      this.scheduleAutoSave();
      this.saveToLocalStorage();
      return true;
    } else {
      this.saveToLocalStorage();
      return true;
    }
  }

  // Get all settings for a category
  getCategorySettings(categoryId) {
    return this.currentSettings[categoryId] || {};
  }

  // Set multiple settings for a category
  setCategorySettings(categoryId, settings) {
    if (!this.isInitialized) {
      console.warn('⚙️ Settings not initialized, cannot set category:', categoryId);
      return false;
    }

    this.currentSettings[categoryId] = { ...this.currentSettings[categoryId], ...settings };

    this.isDirty = true;
    this.currentSettings.lastModified = Date.now();
    
    this.scheduleAutoSave();
    
    return true;
  }

  // Auto-save with debouncing
  scheduleAutoSave() {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    this.autoSaveTimeout = setTimeout(async () => {
      await this.saveSettings();
    }, 2000);
  }

  // Set up real-time synchronization
  setupRealtimeSync() {
    if (!this.storage) {
      console.warn('⚙️ Cannot set up real-time sync - no storage available');
      return;
    }

    try {
      this.realtimeSubscription = this.storage.subscribeToChanges(this.handleRealtimeUpdate);
      console.log('⚙️ ✅ Real-time sync enabled');
    } catch (error) {
      console.warn('⚙️ Real-time sync setup failed:', error);
    }
  }

  // Handle real-time updates from other devices
  handleRealtimeUpdate(newSettings) {
    const localTime = this.currentSettings.lastModified || 0;
    const remoteTime = newSettings.lastModified || 0;
    
    if (remoteTime > localTime) {
      console.log('⚙️ 🔄 Applying remote settings update');
      this.currentSettings = newSettings;
      this.isDirty = false;
      
      this.applyLoadedSettings();
      this.notifyUIUpdate();
    } else {
      console.log('⚙️ Ignoring remote update (local is newer or same)');
    }
  }

  // Navigation methods for two-panel UI
  getCurrentCategory() {
    return this.navigationState.categories.find(cat => 
      cat.id === this.navigationState.selectedCategory
    );
  }

  getEnabledCategories() {
    return this.navigationState.categories.filter(cat => cat.enabled);
  }

  selectCategory(categoryId) {
    const category = this.navigationState.categories.find(cat => cat.id === categoryId);
    if (category && category.enabled) {
      this.navigationState.selectedCategory = categoryId;
      this.navigationState.selectedSetting = 0;
      return true;
    }
    return false;
  }

  setPanel(panel) {
    if (['categories', 'settings'].includes(panel)) {
      this.navigationState.currentPanel = panel;
    }
  }

  getCurrentPanel() {
    return this.navigationState.currentPanel;
  }

  // Notify UI components of settings changes
  notifyUIUpdate() {
    window.dispatchEvent(new CustomEvent('settingsUpdated', {
      detail: { settings: this.currentSettings }
    }));
  }

  // Handle page unload
  handleBeforeUnload(event) {
    if (this.isDirty) {
      this.saveSettings();
    }
  }

  // Utility methods
  isReady() {
    return this.isInitialized;
  }

  getSettings() {
    return { ...this.currentSettings };
  }

  // Cleanup
  async cleanup() {
    console.log('⚙️ Cleaning up Settings Controller...');
    
    if (this.isDirty) {
      await this.saveSettings();
    }
    
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    if (this.realtimeSubscription) {
      this.storage?.unsubscribeAll();
    }
    
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    
    console.log('⚙️ Settings Controller cleaned up');
  }
}