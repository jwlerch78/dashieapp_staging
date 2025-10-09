// js/settings/settings-controller-features.js
// v1.1 - 10/9/25 - Added zip code broadcasting to clock widget for weather location
// Local-only settings, site redirect, theme/family name application

export class SettingsControllerFeatures {
  // Merge local-only settings from localStorage
  mergeLocalOnlySettings() {
    try {
      const localSettingsJson = localStorage.getItem('dashie-local-settings');
      
      if (!localSettingsJson) {
        this.ensureLocalOnlyDefaults();
        return;
      }
      
      const localSettings = JSON.parse(localSettingsJson);
      
      // Merge each local-only setting
      this.LOCAL_ONLY_SETTINGS.forEach(settingPath => {
        const value = this.getNestedValue(localSettings, settingPath);
        if (value !== undefined) {
          this.setNestedValue(this.currentSettings, settingPath, value);
        }
      });
      
      // Ensure any missing local-only settings have defaults
      this.ensureLocalOnlyDefaults();
      
    } catch (error) {
      console.error('Failed to load local-only settings:', error);
      this.ensureLocalOnlyDefaults();
    }
  }

  // Ensure local-only settings have default values
  ensureLocalOnlyDefaults() {
    const defaults = {
      'system.autoRedirect': false,
      'system.debugMode': false
    };
    
    this.LOCAL_ONLY_SETTINGS.forEach(settingPath => {
      const currentValue = this.getNestedValue(this.currentSettings, settingPath);
      if (currentValue === undefined) {
        const defaultValue = defaults[settingPath];
        if (defaultValue !== undefined) {
          this.setNestedValue(this.currentSettings, settingPath, defaultValue);
        }
      }
    });
  }

  // Helper to get nested object values using dot notation
  getNestedValue(obj, path) {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && current[key] !== undefined) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  // Helper to set nested object values using dot notation
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    let target = obj;
    for (const key of keys) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }
    
    target[lastKey] = value;
  }

  // DEBUG PATCH: Add this to settings-controller-features.js saveSettings() method
// Find the saveSettings() method and replace with this version:

async saveSettings() {
  if (!this.isDirty) {
    return true;
  }

  // Save local-only settings to localStorage first
  await this.saveLocalOnlySettings();

  // ALWAYS save to localStorage first (primary storage)
  try {
    // DEBUG: Log what SettingsController is about to save
    console.log('⚙️ [DEBUG] SettingsController saving to localStorage:', {
      hasTokenAccounts: !!this.currentSettings?.tokenAccounts,
      googlePersonalToken: this.currentSettings?.tokenAccounts?.google?.personal?.access_token?.slice(-10) || 'none',
      settingsKeys: Object.keys(this.currentSettings)
    });
    
    localStorage.setItem('dashie-settings', JSON.stringify(this.currentSettings));
    console.log('⚙️ 💾 Settings saved to localStorage');
    
    // DEBUG: Verify what was actually saved
    const verification = localStorage.getItem('dashie-settings');
    const parsed = JSON.parse(verification);
    console.log('⚙️ [DEBUG] Verified SettingsController saved data:', {
      hasTokenAccounts: !!parsed?.tokenAccounts,
      googlePersonalToken: parsed?.tokenAccounts?.google?.personal?.access_token?.slice(-10) || 'none'
    });
    
    this.isDirty = false;
  } catch (error) {
    console.error('⚙️ ❌ Failed to save to localStorage:', error);
    return false;
  }

  // BONUS: Try to save to Supabase if available (secondary storage)
  if (this.storage) {
    try {
      // Filter out local-only settings before saving to database
      const databaseSettings = this.filterOutLocalOnlySettings(this.currentSettings);
      
      // DEBUG: Check if tokens are being filtered out
      console.log('⚙️ [DEBUG] Saving to Supabase:', {
        hasTokenAccountsInFiltered: !!databaseSettings?.tokenAccounts,
        filteredKeys: Object.keys(databaseSettings)
      });
      
      await this.storage.saveSettings(databaseSettings);
      console.log('⚙️ ☁️ Settings also saved to Supabase');
      
    } catch (error) {
      console.warn('⚙️ ⚠️ Supabase save failed, but localStorage succeeded:', error.message);
      // Don't return false - localStorage already succeeded
    }
  } else {
    console.log('⚙️ ℹ️ No Supabase storage available, using localStorage only');
  }

  return true;
}

  // Save local-only settings to localStorage
  async saveLocalOnlySettings() {
    try {
      const localSettings = {};
      
      // Extract local-only settings
      this.LOCAL_ONLY_SETTINGS.forEach(settingPath => {
        const value = this.getNestedValue(this.currentSettings, settingPath);
        if (value !== undefined) {
          this.setNestedValue(localSettings, settingPath, value);
        }
      });
      
      localStorage.setItem('dashie-local-settings', JSON.stringify(localSettings));
      
    } catch (error) {
      console.error('Failed to save local-only settings:', error);
    }
  }

  // Filter out local-only settings from an object
  filterOutLocalOnlySettings(settings) {
    const filtered = JSON.parse(JSON.stringify(settings)); // Deep clone
    
    this.LOCAL_ONLY_SETTINGS.forEach(settingPath => {
      this.deleteNestedValue(filtered, settingPath);
    });
    
    return filtered;
  }

  // Helper to delete nested values using dot notation
  deleteNestedValue(obj, path) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      return current && current[key] ? current[key] : null;
    }, obj);
    
    if (target && lastKey in target) {
      delete target[lastKey];
    }
  }

  // Apply loaded settings with site redirect check FIRST
  async applyLoadedSettings() {
    if (!this.currentSettings) {
      return;
    }
    
    // Apply theme if it exists (only if not redirecting)
    const theme = this.currentSettings.display?.theme;
    if (theme) {
      try {
        const { switchTheme } = await import('../core/theme.js');
        switchTheme(theme);
      } catch (error) {
        console.warn('Failed to apply theme:', error);
      }
    }
    
    // Apply family name to header widgets (only if not redirecting)
    const familyName = this.currentSettings.family?.familyName;
    if (familyName) {
      try {
        await this.applyFamilyNameToWidgets(familyName);
      } catch (error) {
        console.warn('Failed to apply family name:', error);
      }
    }
    
    // Apply zip code to clock widget for weather location
    const zipCode = this.currentSettings.family?.zipCode;
    if (zipCode) {
      try {
        await this.applyZipCodeToClockWidget(zipCode);
      } catch (error) {
        console.warn('Failed to apply zip code:', error);
      }
    }
  }



  // Apply theme immediately when setting changes
  async applyThemeImmediate(theme) {
    try {
      const { switchTheme } = await import('../core/theme.js');
      switchTheme(theme);
    } catch (error) {
      console.warn('Failed to apply theme immediately:', error);
    }
  }

  // Apply family name immediately when setting changes
  async applyFamilyNameImmediate(familyName) {
    try {
      await this.applyFamilyNameToWidgets(familyName);
    } catch (error) {
      console.warn('Failed to apply family name immediately:', error);
    }
  }
  
  // Apply zip code immediately when setting changes
  async applyZipCodeImmediate(zipCode) {
    try {
      await this.applyZipCodeToClockWidget(zipCode);
    } catch (error) {
      console.warn('Failed to apply zip code immediately:', error);
    }
  }

  // Apply family name to widgets
  async applyFamilyNameToWidgets(familyName) {
    setTimeout(() => {
      const headerWidgets = document.querySelectorAll('iframe[src*="header.html"]');
      
      headerWidgets.forEach((iframe, index) => {
        if (iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({
              type: 'family-name-update',
              familyName: familyName
            }, '*');
          } catch (error) {
            console.warn(`Failed to send family name to header widget ${index + 1}:`, error);
          }
        }
      });
      
      // Also dispatch global event
      window.dispatchEvent(new CustomEvent('dashie-family-name-loaded', {
        detail: { familyName }
      }));
      
    }, 1000); // Wait 1 second for widgets to load
  }
  
  // Apply zip code to clock widget for weather location
  async applyZipCodeToClockWidget(zipCode) {
    if (!zipCode || zipCode.trim() === '') {
      console.log('⚙️ No zip code to apply');
      return;
    }
    
    console.log('⚙️ 📍 Broadcasting zip code to clock widget:', zipCode);
    
    setTimeout(() => {
      const clockWidgets = document.querySelectorAll('iframe[src*="clock.html"]');
      
      if (clockWidgets.length === 0) {
        console.warn('⚙️ No clock widgets found to update with zip code');
        return;
      }
      
      clockWidgets.forEach((iframe, index) => {
        if (iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({
              type: 'location-update',
              payload: { zipCode: zipCode }
            }, '*');
            console.log(`⚙️ ✅ Sent zip code to clock widget ${index + 1}`);
          } catch (error) {
            console.warn(`⚙️ Failed to send zip code to clock widget ${index + 1}:`, error);
          }
        }
      });
      
    }, 1000); // Wait 1 second for widgets to load
  }
}
