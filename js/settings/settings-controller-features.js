// js/settings/settings-controller-features.js - Feature methods for settings
// Local-only settings, site redirect, theme/family name application

export class SettingsControllerFeatures {
  // NEW: Merge local-only settings from localStorage
  mergeLocalOnlySettings() {
    try {
      console.log('💾 🔄 === STARTING mergeLocalOnlySettings() ===');
      console.log('💾 🔍 LOCAL_ONLY_SETTINGS array:', this.LOCAL_ONLY_SETTINGS);
      console.log('💾 🔍 currentSettings BEFORE merge:', JSON.stringify(this.currentSettings, null, 2));
      
      const localSettingsJson = localStorage.getItem('dashie-local-settings');
      console.log('💾 📄 Raw localStorage content:', localSettingsJson);
      
      if (!localSettingsJson) {
        console.log('💾 ⚠️ No local settings found in localStorage, using defaults');
        this.ensureLocalOnlyDefaults();
        console.log('💾 🔍 currentSettings AFTER defaults:', JSON.stringify(this.currentSettings, null, 2));
        return;
      }
      
      const localSettings = JSON.parse(localSettingsJson);
      console.log('💾 📄 Parsed local settings object:', JSON.stringify(localSettings, null, 2));
      
      // Merge each local-only setting
      this.LOCAL_ONLY_SETTINGS.forEach((settingPath, index) => {
        console.log(`💾 🔄 Processing setting ${index + 1}/${this.LOCAL_ONLY_SETTINGS.length}: "${settingPath}"`);
        
        const value = this.getNestedValue(localSettings, settingPath);
        console.log(`💾 🔍 getNestedValue("${settingPath}") returned:`, value, '(type:', typeof value, ')');
        
        if (value !== undefined) {
          console.log(`💾 ✅ About to merge: ${settingPath} = ${value}`);
          
          // Check current value before setting
          const beforeValue = this.getNestedValue(this.currentSettings, settingPath);
          console.log(`💾 🔍 Current value before merge:`, beforeValue);
          
          this.setNestedValue(this.currentSettings, settingPath, value);
          
          // Check current value after setting
          const afterValue = this.getNestedValue(this.currentSettings, settingPath);
          console.log(`💾 ✅ Current value after merge:`, afterValue);
          console.log(`💾 ✅ Merge successful for ${settingPath}:`, beforeValue, '→', afterValue);
        } else {
          console.log(`💾 ⚠️ Local setting not found in localStorage: ${settingPath}, will use default`);
        }
      });
      
      // Ensure any missing local-only settings have defaults
      console.log('💾 🔧 Ensuring defaults for missing settings...');
      this.ensureLocalOnlyDefaults();
      
      console.log('💾 🔍 currentSettings AFTER complete merge:', JSON.stringify(this.currentSettings, null, 2));
      console.log('💾 ✅ === COMPLETED mergeLocalOnlySettings() ===');
      
    } catch (error) {
      console.error('💾 ❌ Failed to load local-only settings:', error);
      console.error('💾 ❌ Error stack:', error.stack);
      this.ensureLocalOnlyDefaults();
    }
  }

  // NEW: Ensure local-only settings have default values
  ensureLocalOnlyDefaults() {
    console.log('💾 🔧 === STARTING ensureLocalOnlyDefaults() ===');
    
    const defaults = {
      'system.autoRedirect': true,
      'system.debugMode': false
    };
    
    console.log('💾 🔧 Default values defined:', defaults);
    
    this.LOCAL_ONLY_SETTINGS.forEach((settingPath, index) => {
      console.log(`💾 🔧 Checking default ${index + 1}/${this.LOCAL_ONLY_SETTINGS.length}: "${settingPath}"`);
      
      const currentValue = this.getNestedValue(this.currentSettings, settingPath);
      console.log(`💾 🔍 Current value for ${settingPath}:`, currentValue, '(type:', typeof currentValue, ')');
      
      if (currentValue === undefined) {
        const defaultValue = defaults[settingPath];
        console.log(`💾 🔧 Setting default for ${settingPath}: ${defaultValue}`);
        
        if (defaultValue !== undefined) {
          this.setNestedValue(this.currentSettings, settingPath, defaultValue);
          
          // Verify it was set
          const verifyValue = this.getNestedValue(this.currentSettings, settingPath);
          console.log(`💾 ✅ Default set verification for ${settingPath}:`, verifyValue);
        } else {
          console.log(`💾 ⚠️ No default defined for ${settingPath}`);
        }
      } else {
        console.log(`💾 ✅ ${settingPath} already has value:`, currentValue);
      }
    });
    
    console.log('💾 🔧 === COMPLETED ensureLocalOnlyDefaults() ===');
  }

  // NEW: Helper to get nested object values using dot notation
  getNestedValue(obj, path) {
    console.log(`💾 🔍 getNestedValue called with path: "${path}"`);
    console.log(`💾 🔍 Input object:`, obj);
    
    const keys = path.split('.');
    console.log(`💾 🔍 Path split into keys:`, keys);
    
    let current = obj;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      console.log(`💾 🔍 Step ${i + 1}: Looking for key "${key}" in:`, current);
      
      if (current && current[key] !== undefined) {
        current = current[key];
        console.log(`💾 ✅ Found "${key}":`, current);
      } else {
        console.log(`💾 ❌ Key "${key}" not found or undefined`);
        return undefined;
      }
    }
    
    console.log(`💾 ✅ Final result for "${path}":`, current);
    return current;
  }

  // NEW: Helper to set nested object values using dot notation
  setNestedValue(obj, path, value) {
    console.log(`💾 🔧 setNestedValue called with path: "${path}", value:`, value);
    console.log(`💾 🔧 Target object before:`, JSON.stringify(obj, null, 2));
    
    const keys = path.split('.');
    const lastKey = keys.pop();
    console.log(`💾 🔧 Path keys:`, keys, 'Last key:', lastKey);
    
    let target = obj;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      console.log(`💾 🔧 Processing key ${i + 1}/${keys.length}: "${key}"`);
      
      if (!target[key] || typeof target[key] !== 'object') {
        console.log(`💾 🔧 Creating object for key "${key}"`);
        target[key] = {};
      }
      target = target[key];
      console.log(`💾 🔧 Now at:`, target);
    }
    
    console.log(`💾 🔧 Setting "${lastKey}" to:`, value);
    target[lastKey] = value;
    
    console.log(`💾 ✅ setNestedValue completed. Final object:`, JSON.stringify(obj, null, 2));
  }

  // Save settings to database with local-only filtering
  async saveSettings() {
    console.log('⚙️ 💾 saveSettings called');
    console.log('⚙️ 💾 isDirty:', this.isDirty);
    console.log('⚙️ 💾 storage exists:', !!this.storage);

    if (!this.isDirty) {
      console.log('⚙️ 💾 No changes to save');
      return true;
    }

    // Save local-only settings to localStorage first
    await this.saveLocalOnlySettings();

    if (!this.storage) {
      console.warn('⚙️ 💾 No storage available, saving to localStorage only');
      try {
        localStorage.setItem('dashie-settings', JSON.stringify(this.currentSettings));
        this.isDirty = false;
        console.log('⚙️ ✅ Settings saved to localStorage');
        return true;
      } catch (error) {
        console.error('⚙️ ❌ Failed to save to localStorage:', error);
        return false;
      }
    }

    try {
      console.log('⚙️ 💾 Calling storage.saveSettings...');
      
      // Filter out local-only settings before saving to database
      const databaseSettings = this.filterOutLocalOnlySettings(this.currentSettings);
      console.log('⚙️ 💾 Database settings (filtered):', databaseSettings);
      
      await this.storage.saveSettings(databaseSettings);
      this.isDirty = false;
      console.log('⚙️ ✅ Settings saved successfully to storage');
      return true;
      
    } catch (error) {
      console.error('⚙️ ❌ Failed to save settings to storage:', error);
      return false;
    }
  }

  // NEW: Save local-only settings to localStorage
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
      
      console.log('💾 💾 Saving local-only settings:', localSettings);
      localStorage.setItem('dashie-local-settings', JSON.stringify(localSettings));
      console.log('💾 ✅ Local-only settings saved to localStorage');
      
    } catch (error) {
      console.error('💾 ❌ Failed to save local-only settings:', error);
    }
  }

  // NEW: Filter out local-only settings from an object
  filterOutLocalOnlySettings(settings) {
    const filtered = JSON.parse(JSON.stringify(settings)); // Deep clone
    
    this.LOCAL_ONLY_SETTINGS.forEach(settingPath => {
      this.deleteNestedValue(filtered, settingPath);
    });
    
    return filtered;
  }

  // NEW: Helper to delete nested values using dot notation
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
    console.log('⚙️ 🌐 applyLoadedSettings() called');
    
    if (!this.currentSettings) {
      console.log('⚙️ 🌐 No currentSettings, exiting applyLoadedSettings');
      return;
    }
    
    console.log('⚙️ 🌐 Current settings in applyLoadedSettings:', this.currentSettings);
    
    // FIRST: Check site redirect before applying anything else
    console.log('⚙️ 🌐 About to call checkSiteRedirectSync()');
    const redirected = await this.checkSiteRedirectSync();
    console.log('⚙️ 🌐 checkSiteRedirectSync() returned:', redirected);
    
    if (redirected) {
      console.log('🌐 🔄 Redirecting to different site, skipping other settings application');
      return;
    }
    
    console.log('⚙️ 🌐 No redirect, continuing with theme and family name...');
    
    // Apply theme if it exists (only if not redirecting)
    const theme = this.currentSettings.display?.theme;
    if (theme) {
      console.log('⚙️ 🎨 Applying loaded theme:', theme);
      try {
        const { switchTheme } = await import('../core/theme.js');
        switchTheme(theme);
        console.log('⚙️ ✅ Theme applied successfully');
      } catch (error) {
        console.warn('⚙️ ⚠️ Failed to apply theme:', error);
      }
    }
    
    // Apply family name to header widgets (only if not redirecting)
    const familyName = this.currentSettings.family?.familyName;
    if (familyName) {
      console.log('⚙️ 👨‍👩‍👧‍👦 Applying loaded family name:', familyName);
      try {
        await this.applyFamilyNameToWidgets(familyName);
        console.log('⚙️ ✅ Family name applied successfully');
      } catch (error) {
        console.warn('⚙️ ⚠️ Failed to apply family name:', error);
      }
    }
  }

  // Site redirect functionality
  async checkSiteRedirectSync() {
    console.log('🌐 🔍 checkSiteRedirectSync() called');
    
    try {
      const autoRedirect = this.currentSettings.system?.autoRedirect;
      const targetSite = this.currentSettings.system?.activeSite || 'prod';
      const currentSite = this.detectCurrentSite();
      
      console.log('🌐 📊 Site redirect check (startup) - detailed info:');
      console.log('🌐   - autoRedirect:', autoRedirect, '(type:', typeof autoRedirect, ')');
      console.log('🌐   - targetSite:', targetSite, '(type:', typeof targetSite, ')');
      console.log('🌐   - currentSite:', currentSite, '(type:', typeof currentSite, ')');
      console.log('🌐   - window.location.hostname:', window.location.hostname);
      console.log('🌐   - window.location.href:', window.location.href);
      console.log('🌐   - shouldRedirect calculation:', autoRedirect && targetSite !== currentSite);
      console.log('🌐   - system settings:', this.currentSettings.system);
      
      if (autoRedirect && targetSite !== currentSite) {
        console.log(`🌐 🔄 REDIRECT DECISION: Auto-redirecting from ${currentSite} to ${targetSite} (startup)`);
        console.log('🌐 🔄 About to call performSiteRedirect...');
        this.performSiteRedirect(targetSite, false);
        console.log('🌐 🔄 performSiteRedirect called, returning true');
        return true; // Redirect happening
      } else {
        console.log('🌐 ✅ NO REDIRECT: One of the conditions failed:');
        console.log('🌐   - autoRedirect is falsy:', !autoRedirect);
        console.log('🌐   - sites are the same:', targetSite === currentSite);
        return false; // No redirect
      }
    } catch (error) {
      console.error('🌐 ❌ Site redirect check failed with error:', error);
      console.error('🌐 ❌ Error stack:', error.stack);
      return false; // No redirect on error
    }
  }

  // Detect current site
  detectCurrentSite() {
    const hostname = window.location.hostname;
    
    console.log('🌐 🔍 detectCurrentSite() called:');
    console.log('🌐   - hostname:', hostname);
    
    let result;
    if (hostname === 'dashieapp.com' || hostname === 'www.dashieapp.com') {
      result = 'prod';
    } else if (hostname === 'dev.dashieapp.com') {
      result = 'dev';
    } else {
      result = 'other';
    }
    
    console.log('🌐   - detected site:', result);
    return result;
  }

  // Perform site redirect
  performSiteRedirect(targetSite, showConfirmation = true) {
    console.log('🌐 🔄 performSiteRedirect() called:');
    console.log('🌐   - targetSite:', targetSite);
    console.log('🌐   - showConfirmation:', showConfirmation);
    
    const urls = {
      prod: 'https://dashieapp.com',
      dev: 'https://dev.dashieapp.com'
    };
    
    const targetUrl = urls[targetSite];
    console.log('🌐   - targetUrl:', targetUrl);
    
    if (!targetUrl) {
      console.error('🌐 ❌ Invalid target site:', targetSite);
      return;
    }
    
    const currentSite = this.detectCurrentSite();
    console.log('🌐   - currentSite (double-check):', currentSite);
    
    if (currentSite === targetSite) {
      console.log('🌐 ✅ Already on target site, no redirect needed');
      return;
    }
    
    if (showConfirmation) {
      console.log('🌐 📋 Showing confirmation modal...');
      this.showSiteChangeConfirmation(targetSite, targetUrl);
    } else {
      console.log(`🌐 🔄 REDIRECTING NOW to ${targetUrl}`);
      console.log('🌐 🔄 Calling window.location.href =', targetUrl);
      window.location.href = targetUrl;
    }
  }

  // Handle site change
  handleSiteChange(newSite) {
    const currentSite = this.detectCurrentSite();
    
    console.log('🌐 Site setting changed:', {
      newSite,
      currentSite,
      needsRedirect: newSite !== currentSite
    });
    
    if (newSite !== currentSite) {
      this.performSiteRedirect(newSite, true); // true = show confirmation
    }
  }

  // Show site change confirmation modal
  showSiteChangeConfirmation(targetSite, targetUrl) {
    const siteName = targetSite === 'prod' ? 'Production' : 'Development';
    
    const modal = document.createElement('div');
    modal.className = 'site-change-modal-backdrop';
    modal.innerHTML = `
      <div class="site-change-modal">
        <div class="modal-header">
          <h3>Switch to ${siteName} Site?</h3>
        </div>
        <div class="modal-content">
          <p>You are about to switch to the ${siteName} site:</p>
          <div class="target-url">${targetUrl}</div>
          <p>This will redirect you to a different site. Continue?</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="site-change-cancel">Cancel</button>
          <button class="btn btn-primary" id="site-change-confirm">Switch Site</button>
        </div>
      </div>
    `;
    
    // Add modal styles
    const style = document.createElement('style');
    style.textContent = `
      .site-change-modal-backdrop {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .site-change-modal {
        background: #FCFCFF;
        border-radius: 12px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        color: #424242;
      }
      
      .site-change-modal .modal-header h3 {
        margin: 0 0 16px 0;
        font-size: 20px;
        color: #424242;
      }
      
      .site-change-modal .modal-content p {
        margin: 8px 0;
        font-size: 14px;
        line-height: 1.4;
      }
      
      .site-change-modal .target-url {
        background: #f8f9fa;
        padding: 8px 12px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 13px;
        margin: 12px 0;
        border: 1px solid #dadce0;
        color: #1a73e8;
      }
      
      .site-change-modal .modal-footer {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 20px;
      }
      
      .site-change-modal .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .site-change-modal .btn-secondary {
        background: #f8f9fa;
        color: #5f6368;
        border: 1px solid #dadce0;
      }
      
      .site-change-modal .btn-primary {
        background: #1a73e8;
        color: white;
      }
      
      .site-change-modal .btn:hover {
        transform: translateY(-1px);
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('#site-change-cancel').addEventListener('click', () => {
      modal.remove();
      style.remove();
      this.revertSiteSetting();
    });
    
    modal.querySelector('#site-change-confirm').addEventListener('click', () => {
      modal.remove();
      style.remove();
      console.log(`🌐 🔄 User confirmed redirect to ${targetUrl}`);
      window.location.href = targetUrl;
    });
    
    // Click backdrop to cancel
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.querySelector('#site-change-cancel').click();
      }
    });
  }

  // Revert site setting if user cancels
  revertSiteSetting() {
    const currentSite = this.detectCurrentSite();
    if (currentSite !== 'other') {
      console.log('🌐 🔄 Reverting site setting to current site:', currentSite);
      this.setSetting('system.activeSite', currentSite);
      
      // Update UI if settings modal is open
      const activeSiteSelect = document.querySelector('#active-site-select');
      if (activeSiteSelect) {
        activeSiteSelect.value = currentSite;
      }
    }
  }

  // Apply theme immediately when setting changes
  async applyThemeImmediate(theme) {
    try {
      const { switchTheme } = await import('../core/theme.js');
      switchTheme(theme);
      console.log(`⚙️ 🎨 Theme applied immediately: ${theme}`);
    } catch (error) {
      console.warn('⚙️ ⚠️ Failed to apply theme immediately:', error);
    }
  }

  // Apply family name immediately when setting changes
  async applyFamilyNameImmediate(familyName) {
    try {
      await this.applyFamilyNameToWidgets(familyName);
      console.log(`⚙️ 👨‍👩‍👧‍👦 Family name applied immediately: ${familyName}`);
    } catch (error) {
      console.warn('⚙️ ⚠️ Failed to apply family name immediately:', error);
    }
  }

  // Apply family name to widgets
  async applyFamilyNameToWidgets(familyName) {
    setTimeout(() => {
      const headerWidgets = document.querySelectorAll('iframe[src*="header.html"]');
      
      console.log(`👨‍👩‍👧‍👦 📤 Sending family name "${familyName}" to ${headerWidgets.length} header widgets`);
      
      headerWidgets.forEach((iframe, index) => {
        if (iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({
              type: 'family-name-update',
              familyName: familyName
            }, '*');
            
            console.log(`👨‍👩‍👧‍👦 ✅ Sent family name to header widget ${index + 1}`);
          } catch (error) {
            console.warn(`👨‍👩‍👧‍👦 ⚠️ Failed to send family name to header widget ${index + 1}:`, error);
          }
        } else {
          console.warn(`👨‍👩‍👧‍👦 ⚠️ Header widget ${index + 1} contentWindow not available`);
        }
      });
      
      // Also dispatch global event
      window.dispatchEvent(new CustomEvent('dashie-family-name-loaded', {
        detail: { familyName }
      }));
      
    }, 1000); // Wait 1 second for widgets to load
  }
}
