// js/settings/settings-ui-builder.js - Restructured settings
// CHANGE SUMMARY: Reorganized menus - Photos, Calendar sections, 3-step time picker (hour/minute/AM-PM), removed Widgets

export function buildSettingsUI(isMobile = false) {
  return buildMobileSettingsUI();
}

function buildMobileSettingsUI() {
  return `
    <div class="settings-modal mobile-mode">
      <!-- iOS-style Navigation Bar -->
      <div class="settings-nav-bar">
        <button class="nav-back-button" style="visibility: hidden;">
          ‹ Back
        </button>
        <h1 class="nav-title">Settings</h1>
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
                <div class="settings-cell" data-navigate="photos">
                  <span class="cell-label">Photos</span>
                  <span class="cell-chevron">›</span>
                </div>
                <div class="settings-cell" data-navigate="calendar">
                  <span class="cell-label">Calendar</span>
                  <span class="cell-chevron">›</span>
                </div>
                <div class="settings-cell" data-navigate="family">
                  <span class="cell-label">Family</span>
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

          <!-- Sleep Time - Step 1: Hour (Level 2) -->
          <div class="settings-screen" data-level="2" data-screen="sleep-time" data-title="Sleep Time">
            <div class="settings-list">
              <div class="settings-section-header">Choose Hour</div>
              <div class="settings-section">
                <div class="settings-cell selectable" data-navigate="sleep-time-min" data-hour="1">
                  <span class="cell-label">1</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="sleep-time-min" data-hour="2">
                  <span class="cell-label">2</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="sleep-time-min" data-hour="3">
                  <span class="cell-label">3</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="sleep-time-min" data-hour="4">
                  <span class="cell-label">4</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="sleep-time-min" data-hour="5">
                  <span class="cell-label">5</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="sleep-time-min" data-hour="6">
                  <span class="cell-label">6</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="sleep-time-min" data-hour="7">
                  <span class="cell-label">7</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="sleep-time-min" data-hour="8">
                  <span class="cell-label">8</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="sleep-time-min" data-hour="9">
                  <span class="cell-label">9</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="sleep-time-min" data-hour="10">
                  <span class="cell-label">10</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="sleep-time-min" data-hour="11">
                  <span class="cell-label">11</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="sleep-time-min" data-hour="12">
                  <span class="cell-label">12</span>
                  <span class="cell-checkmark">✓</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Sleep Time - Step 2: Minutes (Level 3) -->
          <div class="settings-screen" data-level="3" data-screen="sleep-time-min" data-title="Sleep Time">
            <div class="settings-list">
              <div class="settings-section-header">Choose Minute</div>
              <div class="settings-section">
                <div class="settings-cell selectable" data-navigate="sleep-time-period" data-minute="00">
                  <span class="cell-label">00</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="sleep-time-period" data-minute="15">
                  <span class="cell-label">15</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="sleep-time-period" data-minute="30">
                  <span class="cell-label">30</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="sleep-time-period" data-minute="45">
                  <span class="cell-label">45</span>
                  <span class="cell-checkmark">✓</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Sleep Time - Step 3: AM/PM (Level 4) -->
          <div class="settings-screen" data-level="4" data-screen="sleep-time-period" data-title="Sleep Time">
            <div class="settings-list">
              <div class="settings-section">
                <div class="settings-cell selectable" data-setting="display.sleepTime" data-period="AM">
                  <span class="cell-label">AM</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="display.sleepTime" data-period="PM">
                  <span class="cell-label">PM</span>
                  <span class="cell-checkmark">✓</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Wake Time - Step 1: Hour (Level 2) -->
          <div class="settings-screen" data-level="2" data-screen="wake-time" data-title="Wake Time">
            <div class="settings-list">
              <div class="settings-section-header">Choose Hour</div>
              <div class="settings-section">
                <div class="settings-cell selectable" data-navigate="wake-time-min" data-hour="1">
                  <span class="cell-label">1</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="wake-time-min" data-hour="2">
                  <span class="cell-label">2</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="wake-time-min" data-hour="3">
                  <span class="cell-label">3</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="wake-time-min" data-hour="4">
                  <span class="cell-label">4</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="wake-time-min" data-hour="5">
                  <span class="cell-label">5</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="wake-time-min" data-hour="6">
                  <span class="cell-label">6</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="wake-time-min" data-hour="7">
                  <span class="cell-label">7</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="wake-time-min" data-hour="8">
                  <span class="cell-label">8</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="wake-time-min" data-hour="9">
                  <span class="cell-label">9</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="wake-time-min" data-hour="10">
                  <span class="cell-label">10</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="wake-time-min" data-hour="11">
                  <span class="cell-label">11</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="wake-time-min" data-hour="12">
                  <span class="cell-label">12</span>
                  <span class="cell-checkmark">✓</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Wake Time - Step 2: Minutes (Level 3) -->
          <div class="settings-screen" data-level="3" data-screen="wake-time-min" data-title="Wake Time">
            <div class="settings-list">
              <div class="settings-section-header">Choose Minute</div>
              <div class="settings-section">
                <div class="settings-cell selectable" data-navigate="wake-time-period" data-minute="00">
                  <span class="cell-label">00</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="wake-time-period" data-minute="15">
                  <span class="cell-label">15</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="wake-time-period" data-minute="30">
                  <span class="cell-label">30</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-navigate="wake-time-period" data-minute="45">
                  <span class="cell-label">45</span>
                  <span class="cell-checkmark">✓</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Wake Time - Step 3: AM/PM (Level 4) -->
          <div class="settings-screen" data-level="4" data-screen="wake-time-period" data-title="Wake Time">
            <div class="settings-list">
              <div class="settings-section">
                <div class="settings-cell selectable" data-setting="display.wakeTime" data-period="AM">
                  <span class="cell-label">AM</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="display.wakeTime" data-period="PM">
                  <span class="cell-label">PM</span>
                  <span class="cell-checkmark">✓</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Photos Screen (Level 1) - NEW -->
          <div class="settings-screen" data-level="1" data-screen="photos" data-title="Photos">
            <div class="settings-list">
              <!-- Photo Stats Box -->
              <div class="settings-section">
                <div class="photo-stats-box">
                  <div class="photo-stat-row">
                    <span class="photo-stat-label">Photos</span>
                    <span class="photo-stat-value" id="photo-count">0</span>
                  </div>
                  <div class="photo-stat-row">
                    <span class="photo-stat-label">Albums</span>
                    <span class="photo-stat-value" id="album-count">3</span>
                  </div>
                  <div class="photo-stat-row storage-row">
                    <span class="photo-stat-label">Storage</span>
                    <span class="photo-stat-value" id="storage-used">0 MB / 500 MB</span>
                  </div>
                  <div class="storage-bar">
                    <div class="storage-bar-fill" id="storage-bar-fill" style="width: 0%"></div>
                  </div>
                </div>
              </div>
              
              <div class="settings-section">
                <div class="settings-cell" data-navigate="add-photos">
                  <span class="cell-label">Add Photos</span>
                  <span class="cell-chevron">›</span>
                </div>
                <div class="settings-cell" data-navigate="delete-photos">
                  <span class="cell-label">Delete Photos</span>
                  <span class="cell-chevron">›</span>
                </div>
                <div class="settings-cell" data-navigate="photo-album">
                  <span class="cell-label">Choose Display Album</span>
                  <span class="cell-value" id="mobile-photo-album-value">Recent Photos</span>
                  <span class="cell-chevron">›</span>
                </div>
                <div class="settings-cell" data-navigate="photo-transition">
                  <span class="cell-label">Photo Transition Time</span>
                  <span class="cell-value" id="mobile-photo-transition-value">5 sec</span>
                  <span class="cell-chevron">›</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Photo Transition Time Selection (Level 2) -->
          <div class="settings-screen" data-level="2" data-screen="photo-transition" data-title="Photo Transition">
            <div class="settings-list">
              <div class="settings-section">
                <div class="settings-cell selectable" data-setting="photos.transitionTime" data-value="5">
                  <span class="cell-label">5 seconds</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="photos.transitionTime" data-value="10">
                  <span class="cell-label">10 seconds</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="photos.transitionTime" data-value="15">
                  <span class="cell-label">15 seconds</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="photos.transitionTime" data-value="30">
                  <span class="cell-label">30 seconds</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="photos.transitionTime" data-value="60">
                  <span class="cell-label">1 minute</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="photos.transitionTime" data-value="900">
                  <span class="cell-label">15 minutes</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="photos.transitionTime" data-value="1800">
                  <span class="cell-label">30 minutes</span>
                  <span class="cell-checkmark">✓</span>
                </div>
                <div class="settings-cell selectable" data-setting="photos.transitionTime" data-value="3600">
                  <span class="cell-label">1 hour</span>
                  <span class="cell-checkmark">✓</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Photo Album Selection (Level 2) -->
          <div class="settings-screen" data-level="2" data-screen="photo-album" data-title="Choose Album">
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

          <!-- Manage Photos Placeholder (Level 2) -->
          <div class="settings-screen" data-level="2" data-screen="manage-photos" data-title="Manage Photos">
            <div class="settings-list">
              <div class="coming-soon">
                <h3>Manage Photos</h3>
                <p>Photo management interface coming soon.</p>
              </div>
            </div>
          </div>

          <!-- Upload Photos Placeholder (Level 2) -->
          <div class="settings-screen" data-level="2" data-screen="upload-photos" data-title="Upload Photos">
            <div class="settings-list">
              <div class="coming-soon">
                <h3>Upload Photos</h3>
                <p>Photo upload interface coming soon.</p>
              </div>
            </div>
          </div>

          <!-- Calendar Screen (Level 1) - NEW -->
          <div class="settings-screen" data-level="1" data-screen="calendar" data-title="Calendar">
            <div class="settings-list">
              <div class="settings-section">
                <div class="settings-cell" data-navigate="add-calendar">
                  <span class="cell-label">Add Calendar Account</span>
                  <span class="cell-chevron">›</span>
                </div>
                <div class="settings-cell" data-navigate="remove-calendar">
                  <span class="cell-label">Remove Calendar Account</span>
                  <span class="cell-chevron">›</span>
                </div>
                <div class="settings-cell" data-navigate="manage-calendars">
                  <span class="cell-label">Manage Calendars</span>
                  <span class="cell-chevron">›</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Calendar Placeholders (Level 2) -->
          <div class="settings-screen" data-level="2" data-screen="add-calendar" data-title="Add Calendar">
            <div class="settings-list">
              <div class="coming-soon">
                <h3>Add Calendar Account</h3>
                <p>Calendar account management coming soon.</p>
              </div>
            </div>
          </div>

          <div class="settings-screen" data-level="2" data-screen="remove-calendar" data-title="Remove Calendar">
            <div class="settings-list">
              <div class="coming-soon">
                <h3>Remove Calendar Account</h3>
                <p>Calendar removal interface coming soon.</p>
              </div>
            </div>
          </div>

          <div class="settings-screen" data-level="2" data-screen="manage-calendars" data-title="Manage Calendars">
            <div class="settings-list">
              <div class="coming-soon">
                <h3>Manage Calendars</h3>
                <p>Calendar management interface coming soon.</p>
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

          <!-- System Screen (Level 1) - REVISED -->
          <div class="settings-screen" data-level="1" data-screen="system" data-title="System">
            <div class="settings-list">
              <div class="settings-section">
                <div class="settings-cell" data-navigate="restore-defaults">
                  <span class="cell-label">Restore Default Settings</span>
                  <span class="cell-chevron">›</span>
                </div>
                <div class="settings-cell" data-navigate="reset-all">
                  <span class="cell-label">Reset All</span>
                  <span class="cell-chevron">›</span>
                </div>
                <div class="settings-cell" data-navigate="manage-subscription">
                  <span class="cell-label">Manage Subscription</span>
                  <span class="cell-chevron">›</span>
                </div>
                <div class="settings-cell" data-navigate="about">
                  <span class="cell-label">About</span>
                  <span class="cell-chevron">›</span>
                </div>
              </div>
            </div>
          </div>

          <!-- System Placeholders (Level 2) -->
          <div class="settings-screen" data-level="2" data-screen="restore-defaults" data-title="Restore Defaults">
            <div class="settings-list">
              <div class="coming-soon">
                <h3>Restore Default Settings</h3>
                <p>Reset all settings to default values.</p>
                <p style="margin-top: 20px; font-size: 14px;">This feature is coming soon.</p>
              </div>
            </div>
          </div>

          <div class="settings-screen" data-level="2" data-screen="reset-all" data-title="Reset All">
            <div class="settings-list">
              <div class="coming-soon">
                <h3>Reset All</h3>
                <p>Clear all data and settings.</p>
                <p style="margin-top: 20px; font-size: 14px;">This feature is coming soon.</p>
              </div>
            </div>
          </div>

          <div class="settings-screen" data-level="2" data-screen="manage-subscription" data-title="Subscription">
            <div class="settings-list">
              <div class="coming-soon">
                <h3>Manage Subscription</h3>
                <p>View and manage your Dashie subscription.</p>
                <p style="margin-top: 20px; font-size: 14px;">This feature is coming soon.</p>
              </div>
            </div>
          </div>

          <div class="settings-screen" data-level="2" data-screen="about" data-title="About">
            <div class="settings-list">
              <div class="coming-soon">
                <h3>About Dashie</h3>
                <p>Version information and support.</p>
                <p style="margin-top: 20px; font-size: 14px;">This feature is coming soon.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;
}

/**
 * Helper: Format transition time for display
 */
function formatTransitionTime(seconds) {
  if (seconds < 60) return `${seconds} sec`;
  if (seconds < 3600) return `${seconds / 60} min`;
  return `${seconds / 3600} hour`;
}

/**
 * Populate form fields with current settings values
 */
export function populateFormFields(overlay, settings) {
  console.log('⚙️ Populating form fields with settings:', settings);
  
  // Family name
  const mobileFamilyName = overlay.querySelector('#mobile-family-name');
  if (mobileFamilyName) {
    mobileFamilyName.value = settings.family?.familyName || 'Dashie';
  }
  
  // Theme value display
  const mobileThemeValue = overlay.querySelector('#mobile-theme-value');
  if (mobileThemeValue && settings.display?.theme) {
    mobileThemeValue.textContent = settings.display.theme === 'dark' ? 'Dark' : 'Light';
  }
  
  // Theme selection cells
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
  
  // Wake time value display
  const mobileWakeTimeValue = overlay.querySelector('#mobile-wake-time-value');
  if (mobileWakeTimeValue && settings.display?.wakeTime) {
    mobileWakeTimeValue.textContent = formatTime(settings.display.wakeTime);
  }
  
  // Photo transition value display
  const mobilePhotoTransitionValue = overlay.querySelector('#mobile-photo-transition-value');
  if (mobilePhotoTransitionValue && settings.photos?.transitionTime) {
    mobilePhotoTransitionValue.textContent = formatTransitionTime(settings.photos.transitionTime);
  }
  
  // Photo transition selection cells
  const photoTransitionCells = overlay.querySelectorAll('.settings-cell[data-setting="photos.transitionTime"]');
  photoTransitionCells.forEach(cell => {
    if (parseInt(cell.dataset.value) === settings.photos?.transitionTime) {
      cell.classList.add('selected');
    } else {
      cell.classList.remove('selected');
    }
  });
  
  // Photo album value display
  const mobilePhotoAlbumValue = overlay.querySelector('#mobile-photo-album-value');
  if (mobilePhotoAlbumValue && settings.photos?.source) {
    const albumLabels = {
      'recent': 'Recent Photos',
      'family': 'Family Album',
      'vacation': 'Vacation 2024'
    };
    mobilePhotoAlbumValue.textContent = albumLabels[settings.photos.source] || 'Recent Photos';
  }
  
  // Photo album selection cells
  const photoAlbumCells = overlay.querySelectorAll('.settings-cell[data-setting="photos.source"]');
  photoAlbumCells.forEach(cell => {
    if (cell.dataset.value === settings.photos?.source) {
      cell.classList.add('selected');
    } else {
      cell.classList.remove('selected');
    }
  });
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
 * Apply theme to settings overlay specifically
 */
export function applyTheme(overlay, theme) {
  if (overlay) {
    overlay.classList.remove('theme-dark', 'theme-light');
    overlay.classList.add(`theme-${theme}`);
  }
}