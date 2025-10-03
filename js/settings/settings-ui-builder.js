// js/settings/settings-ui-builder.js - Auto-save implementation
// CHANGE SUMMARY: Added time selection screens and photo source selection screen to replace native inputs/dropdowns

export function buildSettingsUI(isMobile = false) {
  // Always use iOS-style screen navigation for both mobile and desktop/TV
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
              
              <!-- FIX 1: Replace time inputs with navigation cells -->
              <div class="settings-section">
                <div class="settings-cell" data-navigate="sleep-time">
                  <span class="cell-label">Sleep Time</span>
                  <span class="cell-value" id="mobile-sleep-time-value">10:00 PM</span>
                  <span class="cell-chevron">›</span>
                </div>
                <div class="settings-cell" data-navigate="wake-time">
                  <span class="cell-label">Wake Time</span>
                  <span class="cell-value" id="mobile-wake-time-value">7:00 AM</span>
                  <span class="cell-chevron">›</span>
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
                <div class="settings-cell selectable" data-setting="display.theme" data-value="dark">
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

          <!-- Sleep Time Selection Screen (Level 2) - FIX 1 -->
          <div class="settings-screen" data-level="2" data-screen="sleep-time" data-title="Sleep Time">
            <div class="settings-list">
              <div class="settings-section">
                <div class="settings-cell selectable" data-setting="display.sleepTime" data-value="19:00">
                  <span class="cell-label">7:00 PM</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="display.sleepTime" data-value="20:00">
                  <span class="cell-label">8:00 PM</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="display.sleepTime" data-value="21:00">
                  <span class="cell-label">9:00 PM</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="display.sleepTime" data-value="22:00">
                  <span class="cell-label">10:00 PM</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="display.sleepTime" data-value="23:00">
                  <span class="cell-label">11:00 PM</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="display.sleepTime" data-value="00:00">
                  <span class="cell-label">12:00 AM</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="display.sleepTime" data-value="01:00">
                  <span class="cell-label">1:00 AM</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="display.sleepTime" data-value="02:00">
                  <span class="cell-label">2:00 AM</span>
                  <span class="cell-checkmark">✓</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Wake Time Selection Screen (Level 2) - FIX 1 -->
          <div class="settings-screen" data-level="2" data-screen="wake-time" data-title="Wake Time">
            <div class="settings-list">
              <div class="settings-section">
                <div class="settings-cell selectable" data-setting="display.wakeTime" data-value="05:00">
                  <span class="cell-label">5:00 AM</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="display.wakeTime" data-value="06:00">
                  <span class="cell-label">6:00 AM</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="display.wakeTime" data-value="07:00">
                  <span class="cell-label">7:00 AM</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="display.wakeTime" data-value="08:00">
                  <span class="cell-label">8:00 AM</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="display.wakeTime" data-value="09:00">
                  <span class="cell-label">9:00 AM</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="display.wakeTime" data-value="10:00">
                  <span class="cell-label">10:00 AM</span>
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
              <!-- FIX 4: Replace dropdown with navigation cell -->
              <div class="settings-section">
                <div class="settings-cell" data-navigate="photo-source">
                  <span class="cell-label">Photo Source</span>
                  <span class="cell-value" id="mobile-photo-source-value">Recent Photos</span>
                  <span class="cell-chevron">›</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Photo Source Selection Screen (Level 2) - FIX 4 -->
          <div class="settings-screen" data-level="2" data-screen="photo-source" data-title="Photo Source">
            <div class="settings-list">
              <div class="settings-section">
                <div class="settings-cell selectable" data-setting="photos.source" data-value="recent">
                  <span class="cell-label">Recent Photos</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="photos.source" data-value="family">
                  <span class="cell-label">Family Album</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="photos.source" data-value="vacation">
                  <span class="cell-label">Vacation 2024</span>
                  <span class="cell-checkmark">✓</span>
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
                <div class="settings-cell selectable" data-setting="system.activeSite" data-value="prod">
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
 * Helper: Format time for display (24h to 12h)
 */
function formatTime(time24) {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Populate form fields with current settings values - FIX 5: Added checkmark population
 */
export function populateFormFields(overlay, settings) {
  console.log('⚙️ Populating form fields with settings:', settings);
  
  // Re-sleep delay
  const mobileResleepDelay = overlay.querySelector('#mobile-resleep-delay');
  if (mobileResleepDelay && settings.display?.reSleepDelay) {
    mobileResleepDelay.value = settings.display.reSleepDelay;
  }
  
  // Photo transition
  const mobilePhotoTransition = overlay.querySelector('#mobile-photo-transition');
  if (mobilePhotoTransition && settings.photos?.transitionTime) {
    mobilePhotoTransition.value = settings.photos.transitionTime;
  }
  
  // Family name
  const mobileFamilyName = overlay.querySelector('#mobile-family-name');
  if (mobileFamilyName) {
    const nameValue = settings.family?.familyName || 'Dashie';
    mobileFamilyName.value = nameValue;
  }
  
  // Theme value display
  const mobileThemeValue = overlay.querySelector('#mobile-theme-value');
  if (mobileThemeValue && settings.display?.theme) {
    mobileThemeValue.textContent = settings.display.theme === 'dark' ? 'Dark' : 'Light';
  }
  
  // FIX 5: Theme selection cells with checkmarks
  const themeSelectionCells = overlay.querySelectorAll('.settings-cell[data-setting="display.theme"]');
  themeSelectionCells.forEach(cell => {
    if (cell.dataset.value === settings.display?.theme) {
      cell.classList.add('selected');
    } else {
      cell.classList.remove('selected');
    }
  });
  
  // Sleep time value display
  const mobileSleepTimeValue = overlay.querySelector('#mobile-sleep-time-value');
  if (mobileSleepTimeValue && settings.display?.sleepTime) {
    mobileSleepTimeValue.textContent = formatTime(settings.display.sleepTime);
  }
  
  // FIX 5: Sleep time selection cells
  const sleepTimeSelectionCells = overlay.querySelectorAll('.settings-cell[data-setting="display.sleepTime"]');
  sleepTimeSelectionCells.forEach(cell => {
    if (cell.dataset.value === settings.display?.sleepTime) {
      cell.classList.add('selected');
    } else {
      cell.classList.remove('selected');
    }
  });
  
  // Wake time value display
  const mobileWakeTimeValue = overlay.querySelector('#mobile-wake-time-value');
  if (mobileWakeTimeValue && settings.display?.wakeTime) {
    mobileWakeTimeValue.textContent = formatTime(settings.display.wakeTime);
  }
  
  // FIX 5: Wake time selection cells
  const wakeTimeSelectionCells = overlay.querySelectorAll('.settings-cell[data-setting="display.wakeTime"]');
  wakeTimeSelectionCells.forEach(cell => {
    if (cell.dataset.value === settings.display?.wakeTime) {
      cell.classList.add('selected');
    } else {
      cell.classList.remove('selected');
    }
  });
  
  // Photo source value display
  const mobilePhotoSourceValue = overlay.querySelector('#mobile-photo-source-value');
  if (mobilePhotoSourceValue && settings.photos?.source) {
    const sourceLabels = {
      'recent': 'Recent Photos',
      'family': 'Family Album',
      'vacation': 'Vacation 2024'
    };
    mobilePhotoSourceValue.textContent = sourceLabels[settings.photos.source] || 'Recent Photos';
  }
  
  // FIX 5: Photo source selection cells
  const photoSourceSelectionCells = overlay.querySelectorAll('.settings-cell[data-setting="photos.source"]');
  photoSourceSelectionCells.forEach(cell => {
    if (cell.dataset.value === settings.photos?.source) {
      cell.classList.add('selected');
    } else {
      cell.classList.remove('selected');
    }
  });
  
  // Active site value display
  const mobileActiveSiteValue = overlay.querySelector('#mobile-active-site-value');
  if (mobileActiveSiteValue && settings.system?.activeSite) {
    mobileActiveSiteValue.textContent = settings.system.activeSite === 'prod' ? 'Production' : 'Development';
  }
  
  // FIX 5: Active site selection cells
  const activeSiteSelectionCells = overlay.querySelectorAll('.settings-cell[data-setting="system.activeSite"]');
  activeSiteSelectionCells.forEach(cell => {
    if (cell.dataset.value === settings.system?.activeSite) {
      cell.classList.add('selected');
    } else {
      cell.classList.remove('selected');
    }
  });
  
  // Auto redirect toggle
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