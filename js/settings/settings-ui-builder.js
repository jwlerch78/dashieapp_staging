// js/settings/settings-ui-builder.js - Auto-save implementation
// CHANGE SUMMARY: All platforms now use iOS-style screen-based navigation - removed tab-based UI entirely

export function buildSettingsUI(isMobile = false) {
  // Always use iOS-style screen navigation for both mobile and desktop/TV
  // Only difference is mobile uses touch, desktop uses D-pad
  return buildMobileSettingsUI();
}

/**
 * Build iOS-style mobile settings interface
 */
function buildMobileSettingsUI() {
  return `
    <div class="settings-modal mobile-mode">
      <!-- iOS-style Navigation Bar -->
      <div class="settings-nav-bar">
        <button class="nav-back-button" style="visibility: hidden;">
          ‹ Back
        </button>
        <h1 class="nav-title">Settings</h1>
        <button class="nav-action-button" id="settings-done">
          Done
        </button>
      </div>

      <!-- Screen Stack Container -->
      <div class="settings-content">
        <div class="settings-screens">
          
          <!-- Root Screen (Level 0) -->
          <div class="settings-screen active" data-level="0" data-screen="root" data-title="Settings">
            <div class="settings-list">
              <div class="settings-section">
                <div class="settings-cell" data-navigate="display">
                  <span class="cell-label">Display</span>
                  <span class="cell-chevron">›</span>
                </div>
                <div class="settings-cell" data-navigate="family">
                  <span class="cell-label">Family</span>
                  <span class="cell-chevron">›</span>
                </div>
                <div class="settings-cell" data-navigate="widgets">
                  <span class="cell-label">Widgets</span>
                  <span class="cell-chevron">›</span>
                </div>
                <div class="settings-cell" data-navigate="system">
                  <span class="cell-label">System</span>
                  <span class="cell-chevron">›</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Display Screen (Level 1) -->
          <div class="settings-screen" data-level="1" data-screen="display" data-title="Display">
            <div class="settings-list">
              <div class="settings-section">
                <div class="settings-cell" data-navigate="theme">
                  <span class="cell-label">Theme</span>
                  <span class="cell-value" id="mobile-theme-value">Dark</span>
                  <span class="cell-chevron">›</span>
                </div>
              </div>
              
              <div class="settings-section">
                <div class="setting-row">
                  <label class="setting-label">Sleep Time</label>
                  <input type="time" class="form-control mobile-time-input" 
                         id="mobile-sleep-time" data-setting="display.sleepTime" value="22:00">
                </div>
                <div class="setting-row">
                  <label class="setting-label">Wake Time</label>
                  <input type="time" class="form-control mobile-time-input" 
                         id="mobile-wake-time" data-setting="display.wakeTime" value="07:00">
                </div>
                <div class="setting-row">
                  <label class="setting-label">Re-sleep Delay (min)</label>
                  <input type="number" class="form-control mobile-number-input" 
                         id="mobile-resleep-delay" data-setting="display.reSleepDelay" 
                         value="30" min="1" max="180">
                </div>
              </div>
              
              <div class="settings-section">
                <div class="setting-row">
                  <label class="setting-label">Photo Transition (sec)</label>
                  <input type="number" class="form-control mobile-number-input" 
                         id="mobile-photo-transition" data-setting="photos.transitionTime" 
                         value="5" min="1" max="60">
                </div>
              </div>
            </div>
          </div>

          <!-- Theme Selection Screen (Level 2) -->
          <div class="settings-screen" data-level="2" data-screen="theme" data-title="Theme">
            <div class="settings-list">
              <div class="settings-section">
                <div class="settings-cell selectable selected" data-setting="display.theme" data-value="dark">
                  <span class="cell-label">Dark Theme</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="display.theme" data-value="light">
                  <span class="cell-label">Light Theme</span>
                  <span class="cell-checkmark">✓</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Family Screen (Level 1) -->
          <div class="settings-screen" data-level="1" data-screen="family" data-title="Family">
            <div class="settings-list">
              <div class="settings-section">
                <div class="setting-row">
                  <label class="setting-label">Family Name</label>
                  <input type="text" class="form-control mobile-text-input" 
                         id="mobile-family-name" data-setting="family.familyName" 
                         placeholder="Enter family name">
                </div>
              </div>
            </div>
          </div>

          <!-- Widgets Screen (Level 1) -->
          <div class="settings-screen" data-level="1" data-screen="widgets" data-title="Widgets">
            <div class="settings-list">
              <div class="settings-section">
                <div class="setting-row">
                  <label class="setting-label">Photo Source</label>
                  <select class="form-control mobile-select" data-setting="photos.source">
                    <option value="recent">Recent Photos</option>
                    <option value="family">Family Album</option>
                    <option value="vacation">Vacation 2024</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- System Screen (Level 1) -->
          <div class="settings-screen" data-level="1" data-screen="system" data-title="System">
            <div class="settings-list">
              <div class="settings-section">
                <div class="settings-cell" data-navigate="active-site">
                  <span class="cell-label">Active Site</span>
                  <span class="cell-value" id="mobile-active-site-value">Production</span>
                  <span class="cell-chevron">›</span>
                </div>
              </div>
              
              <div class="settings-section">
                <div class="setting-row toggle-row">
                  <span class="setting-label">Auto Redirect</span>
                  <label class="toggle-switch">
                    <input type="checkbox" id="mobile-auto-redirect" 
                           data-setting="system.autoRedirect" checked>
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Active Site Selection Screen (Level 2) -->
          <div class="settings-screen" data-level="2" data-screen="active-site" data-title="Active Site">
            <div class="settings-list">
              <div class="settings-section">
                <div class="settings-cell selectable selected" data-setting="system.activeSite" data-value="prod">
                  <span class="cell-label">Production</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="system.activeSite" data-value="dev">
                  <span class="cell-label">Development</span>
                  <span class="cell-checkmark">✓</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;
}

/**
 * Populate form fields with current settings values
 */
export function populateFormFields(overlay, settings) {
  // Mobile sleep time
  const mobileSleepTime = overlay.querySelector('#mobile-sleep-time');
  if (mobileSleepTime && settings.display?.sleepTime) {
    mobileSleepTime.value = settings.display.sleepTime;
  }
  
  // Mobile wake time
  const mobileWakeTime = overlay.querySelector('#mobile-wake-time');
  if (mobileWakeTime && settings.display?.wakeTime) {
    mobileWakeTime.value = settings.display.wakeTime;
  }
  
  // Mobile resleep delay
  const mobileResleepDelay = overlay.querySelector('#mobile-resleep-delay');
  if (mobileResleepDelay && settings.display?.reSleepDelay) {
    mobileResleepDelay.value = settings.display.reSleepDelay;
  }
  
  // Mobile photo transition
  const mobilePhotoTransition = overlay.querySelector('#mobile-photo-transition');
  if (mobilePhotoTransition && settings.photos?.transitionTime) {
    mobilePhotoTransition.value = settings.photos.transitionTime;
  }
  
  // Mobile family name
  const mobileFamilyName = overlay.querySelector('#mobile-family-name');
  if (mobileFamilyName) {
    const nameValue = settings.family?.familyName || 'Dashie';
    mobileFamilyName.value = nameValue;
  }
  
  // Mobile theme value display
  const mobileThemeValue = overlay.querySelector('#mobile-theme-value');
  if (mobileThemeValue && settings.display?.theme) {
    mobileThemeValue.textContent = settings.display.theme === 'dark' ? 'Dark' : 'Light';
  }
  
  // Mobile theme selection cells
  const themeSelectionCells = overlay.querySelectorAll('.settings-cell[data-setting="display.theme"]');
  themeSelectionCells.forEach(cell => {
    if (cell.dataset.value === settings.display?.theme) {
      cell.classList.add('selected');
    } else {
      cell.classList.remove('selected');
    }
  });
  
  // Mobile active site value display
  const mobileActiveSiteValue = overlay.querySelector('#mobile-active-site-value');
  if (mobileActiveSiteValue && settings.system?.activeSite) {
    mobileActiveSiteValue.textContent = settings.system.activeSite === 'prod' ? 'Production' : 'Development';
  }
  
  // Mobile active site selection cells
  const activeSiteSelectionCells = overlay.querySelectorAll('.settings-cell[data-setting="system.activeSite"]');
  activeSiteSelectionCells.forEach(cell => {
    if (cell.dataset.value === settings.system?.activeSite) {
      cell.classList.add('selected');
    } else {
      cell.classList.remove('selected');
    }
  });
  
  // Mobile auto redirect toggle
  const mobileAutoRedirect = overlay.querySelector('#mobile-auto-redirect');
  if (mobileAutoRedirect && settings.system?.autoRedirect !== undefined) {
    mobileAutoRedirect.checked = settings.system.autoRedirect;
  }
}

/**
 * Apply theme to settings overlay specifically
 */
export function applyTheme(overlay, theme) {
  // Remove existing theme classes from overlay specifically
  if (overlay) {
    overlay.classList.remove('theme-dark', 'theme-light');
    overlay.classList.add(`theme-${theme}`);
  }
}