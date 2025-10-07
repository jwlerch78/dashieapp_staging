// js/settings/settings-templates.js
// CHANGE SUMMARY: Created - All HTML templates extracted from settings-ui-builder.js for better organization

/**
 * Navigation Bar Template
 */
export const navBar = `
  <div class="settings-nav-bar">
    <button class="nav-back-button" style="visibility: hidden;">
      ‹ Back
    </button>
    <h1 class="nav-title">Settings</h1>
  </div>
`;

/**
 * Root Screen (Level 0)
 */
export const rootScreen = `
  <div class="settings-screen active" data-level="0" data-screen="root" data-title="Settings">
    <div class="settings-list">
      <div class="settings-section">
        <div class="settings-cell" data-navigate="display">
          <span class="cell-label">Display</span>
          <span class="cell-chevron">›</span>
        </div>
        <div class="settings-cell action-cell" id="photos-menu-btn">
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
`;

/**
 * Display Screens (Level 1-4)
 */
export const displayScreens = `
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
        <div class="settings-cell toggle-cell" id="sleep-timer-toggle-cell">
          <span class="cell-label">Sleep/Wake Timer</span>
          <label class="toggle-switch">
            <input type="checkbox" id="sleep-timer-enabled" data-setting="display.sleepTimerEnabled" checked>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="settings-cell sleep-time-cell" data-navigate="sleep-time">
          <span class="cell-label">Sleep Time</span>
          <span class="cell-value" id="mobile-sleep-time-value">10:00 PM</span>
          <span class="cell-chevron">›</span>
        </div>
        <div class="settings-cell wake-time-cell" data-navigate="wake-time">
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
`;

// Photos screens moved to widgets/photos/settings-photos.js

/**
 * Calendar Screens (Level 1-2)
 */
// CHANGE SUMMARY: Updated calendarScreens export to use new functional calendar settings screens with mock data

// CALENDAR SETTINGS FIX: Remove mock data from manage-calendars screen
// This is the section that needs to replace the calendar templates in settings-templates.js

/**
 * Calendar Screens (Level 1-2)
 */
export const calendarScreens = `
  <!-- Calendar Main Screen (Level 1) -->
  <div class="settings-screen" data-level="1" data-screen="calendar" data-title="Calendar">
    <div class="settings-list">
      <div class="settings-section">
        <div class="settings-cell" data-navigate="manage-calendars" id="manage-calendars-btn">
          <span class="cell-label">Manage Calendars</span>
          <span class="cell-chevron">›</span>
        </div>
        <div class="settings-cell" data-navigate="add-calendar" id="add-calendar-btn">
          <span class="cell-label">Add Account</span>
          <span class="cell-chevron">›</span>
        </div>
      </div>
      
      <div class="settings-section">
        <div class="settings-cell" id="clear-calendar-data-btn">
          <span class="cell-label" style="color: #ff3b30;">Clear Calendar Data</span>
          <span class="cell-chevron">›</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Manage Calendars Screen (Level 2) - FIXED: Removed all mock data -->
  <div class="settings-screen" data-level="2" data-screen="manage-calendars" data-title="Manage Calendars">
    <div class="settings-list" id="calendar-accounts-container">
      <!-- Calendar accounts will be dynamically populated by dcal-settings-manager.js -->
      <div style="padding: 20px; text-align: center; color: #999;">
        Loading calendars...
      </div>
    </div>
  </div>

  <!-- Add Account Screen (Level 2) - Placeholder for Phase 3 -->
  <div class="settings-screen" data-level="2" data-screen="add-calendar" data-title="Add Account">
    <div class="settings-list">
      <div class="coming-soon">
        <h3>Add Calendar Account</h3>
        <p>Connect a new Google account to access additional calendars.</p>
        <p style="margin-top: 20px; font-size: 14px; opacity: 0.7;">Coming in Phase 3</p>
      </div>
    </div>
  </div>
`;

/**
 * Family Screen (Level 1)
 */
export const familyScreen = `
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
`;

/**
 * System Screens (Level 1-2)
 */
export const systemScreens = `
  <!-- System Screen (Level 1) -->
  <div class="settings-screen" data-screen="system" data-title="System">
    <div class="settings-section">
      <div class="settings-cell" data-navigate="about">
        <div class="cell-content">
          <span class="cell-label">About</span>
        </div>
        <span class="cell-chevron">›</span>
      </div>
      
      <div class="settings-cell" data-navigate="manage-subscription">
        <div class="cell-content">
          <span class="cell-label">Manage Subscription</span>
        </div>
        <span class="cell-chevron">›</span>
      </div>
      
      <div class="settings-cell" data-navigate="system-status">
        <div class="cell-content">
          <span class="cell-label">System Status</span>
        </div>
        <span class="cell-chevron">›</span>
      </div>
      
      <div class="settings-cell" data-navigate="restore-defaults">
        <div class="cell-content">
          <span class="cell-label">Restore Default Settings</span>
        </div>
        <span class="cell-chevron">›</span>
      </div>
      
      <div class="settings-cell" data-navigate="reset-all">
        <div class="cell-content">
          <span class="cell-label">Reset All</span>
        </div>
        <span class="cell-chevron">›</span>
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
        <p>Subscription management coming soon.</p>
      </div>
    </div>
  </div>

  <div class="settings-screen" data-level="2" data-screen="about" data-title="About">
    <div class="settings-list">
      <div class="coming-soon">
        <h3>About Dashie</h3>
        <p>Version information and credits coming soon.</p>
      </div>
    </div>
  </div>

 <div class="settings-screen" data-level="2" data-screen="system-status" data-title="System Status">
    <div class="settings-list">
      <div class="settings-section">
        <div class="section-header">Platform</div>
        
        <div class="settings-cell info-row">
          <div class="cell-content">
            <span class="cell-label">Device Type</span>
          </div>
          <span class="cell-value" id="system-platform-value">Desktop</span>
        </div>
        
        <div class="settings-cell info-row">
          <div class="cell-content">
            <span class="cell-label">Browser</span>
          </div>
          <span class="cell-value" id="system-device-value">Chrome</span>
        </div>
      </div>

      <div class="settings-section">
        <div class="section-header">Data Sync</div>
        
        <div class="settings-cell info-row">
          <div class="cell-content">
            <span class="cell-label">Real-Time Sync</span>
          </div>
          <div class="cell-value">
            <span class="status-dot" id="sync-status-dot"></span>
            <span id="sync-status-text">Not available yet</span>
          </div>
        </div>
        
        <div class="settings-cell info-row">
          <div class="cell-content">
            <span class="cell-label">JWT Token Status</span>
          </div>
          <div class="cell-value">
            <span class="status-dot" id="jwt-status-dot"></span>
            <span id="jwt-status-text">Not available yet</span>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="section-header">Calendar</div>
        
        <div class="settings-cell info-row">
          <div class="cell-content">
            <span class="cell-label">Last Refresh Time</span>
          </div>
          <span class="cell-value" id="calendar-last-refresh">Not available yet</span>
        </div>
        
        <div class="settings-cell info-row">
          <div class="cell-content">
            <span class="cell-label">Calendars Imported</span>
          </div>
          <span class="cell-value" id="calendar-count">Not available yet</span>
        </div>
        
        <div class="settings-cell info-row">
          <div class="cell-content">
            <span class="cell-label">Events Imported</span>
          </div>
          <span class="cell-value" id="events-count">Not available yet</span>
        </div>
      </div>

      <div class="settings-section">
        <div class="section-header">Dashboard Stats</div>
        
        <div class="settings-cell info-row">
          <div class="cell-content">
            <span class="cell-label">Time Running</span>
          </div>
          <span class="cell-value" id="uptime-value">Not available yet</span>
        </div>
      </div>
    </div>
  </div>
`;