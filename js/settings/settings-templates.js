// js/settings/settings-templates.js
// v1.5 - 10/11/25 11:35pm - Added Privacy section to System settings with crash reporting toggle
// v1.4 - 10/10/25 4:05pm - Moved Dynamic Greeting toggle to bottom of Display screen (after sleep settings)
// v1.3 - 10/9/25 - Added location display element below zip code input
// v1.2 - 10/9/25 - Added zip code input to Family settings & moved Family to top of menu
// Version: 1.1 | Last Updated: 2025-01-09 20:40 EST
// CHANGE SUMMARY: Added Privacy screen with telemetry opt-in toggle

import { getFeaturesMenuItem, getFeaturesScreen } from './settings-templates-features.js';

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
        <div class="settings-cell" data-navigate="family">
          <span class="cell-label">Family</span>
          <span class="cell-chevron">›</span>
        </div>
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
        <div class="settings-cell" data-navigate="system">
          <span class="cell-label">System</span>
          <span class="cell-chevron">›</span>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Delete Account Confirmation Modal -->
  <div id="delete-account-modal" class="modal-overlay" style="display: none;">
    <div class="modal-content">
      <h3 style="color: var(--danger-color, #ff4444);">⚠️ Confirm Account Deletion</h3>
      <p style="margin-top: 16px;">
        Are you absolutely sure you want to delete your account?
      </p>
      <p style="margin-top: 12px; font-weight: 600;">
        This will permanently delete:
      </p>
      <ul style="margin: 8px 0 12px 20px; text-align: left;">
        <li>All your photos and files</li>
        <li>Calendar connections</li>
        <li>All settings and preferences</li>
        <li>Your user profile</li>
      </ul>
      <p style="margin-top: 12px; font-size: 14px; color: var(--text-secondary);">
        <strong>This action cannot be undone.</strong> You will be signed out immediately.
      </p>
      <div class="modal-actions">
        <button id="cancel-delete-account" class="modal-btn modal-btn-secondary">Cancel</button>
        <button id="confirm-delete-account" class="modal-btn modal-btn-danger">Delete Account</button>
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
      
      <div class="settings-section">
        <div class="settings-cell toggle-cell" id="dynamic-greeting-toggle-cell">
          <span class="cell-label">Dynamic Greeting</span>
          <label class="toggle-switch">
            <input type="checkbox" id="dynamic-greeting-enabled" data-setting="display.dynamicGreeting">
            <span class="toggle-slider"></span>
          </label>
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

/**
 * Calendar Screens (Level 1-2)
 */
export const calendarScreens = `
  <!-- Calendar Main Screen (Level 1) -->
  <div class="settings-screen" data-level="1" data-screen="calendar" data-title="Calendar">
    <div class="settings-list">
      <!-- Calendars & Accounts Section -->
      <div class="settings-section">
        <div class="settings-section-header">Calendars & Accounts</div>
        
        <div class="settings-cell" data-navigate="manage-calendars" id="manage-calendars-btn">
          <span class="cell-label">Select Calendars</span>
          <span class="cell-chevron">›</span>
        </div>
        
        <div class="settings-cell" data-navigate="add-calendar" id="add-calendar-btn">
          <span class="cell-label">Add Calendar Accounts</span>
          <span class="cell-chevron">›</span>
        </div>
        
        <div class="settings-cell" data-navigate="remove-calendar" id="remove-calendar-btn">
          <span class="cell-label">Remove Calendar Accounts</span>
          <span class="cell-chevron">›</span>
        </div>
      </div>
      
      <!-- Display Options Section -->
      <div class="settings-section">
        <div class="settings-section-header">Display Options</div>
        
        <div class="settings-cell" data-navigate="start-week-on">
          <span class="cell-label">Start Week On</span>
          <span class="cell-value" id="start-week-value">Sun</span>
          <span class="cell-chevron">›</span>
        </div>
        
        <div class="settings-cell" data-navigate="scroll-time">
          <span class="cell-label">Start Time to Scroll To</span>
          <span class="cell-value" id="scroll-time-value">8 AM</span>
          <span class="cell-chevron">›</span>
        </div>
        
        <div class="settings-cell" data-navigate="calendar-zoom">
          <span class="cell-label">Calendar Zoom</span>
          <span class="cell-value" id="calendar-zoom-value">100%</span>
          <span class="cell-chevron">›</span>
        </div>
      </div>
      
    </div>
  </div>

  <!-- Select Calendars Screen (Level 2) - formerly Manage Calendars -->
  <div class="settings-screen" data-level="2" data-screen="manage-calendars" data-title="Select Calendars">
    <div class="settings-list" id="calendar-accounts-container">
      <!-- Calendar accounts will be dynamically populated by dcal-settings-manager.js -->
      <div style="padding: 20px; text-align: center; color: #999;">
        Loading calendars...
      </div>
    </div>
  </div>

  <!-- Add Calendar Accounts Screen (Level 2) -->
  <div class="settings-screen" data-level="2" data-screen="add-calendar" data-title="Add Calendar Accounts">
    <div class="settings-list">
      <div class="settings-section">
        <div class="settings-section-header">Select Account Type</div>
        
        <!-- Google Account (Active) -->
        <div class="settings-cell selectable account-type-option" data-account-type="google" id="add-google-account-btn">
          <span class="account-type-icon">G</span>
          <span class="cell-label">Google</span>
          <span class="cell-chevron">›</span>
        </div>
        
        <!-- Microsoft Exchange (Coming Soon) -->
        <div class="settings-cell account-type-option disabled" data-account-type="microsoft">
          <span class="account-type-icon">M</span>
          <span class="cell-label">Microsoft Exchange</span>
          <span class="cell-status">Coming Soon</span>
        </div>
        
        <!-- Apple iCloud (Coming Soon) -->
        <div class="settings-cell account-type-option disabled" data-account-type="apple">
          <span class="account-type-icon">A</span>
          <span class="cell-label">Apple iCloud</span>
          <span class="cell-status">Coming Soon</span>
        </div>
        
        <!-- Other (Coming Soon) -->
        <div class="settings-cell account-type-option disabled" data-account-type="other">
          <span class="account-type-icon">•••</span>
          <span class="cell-label">Other (CalDAV)</span>
          <span class="cell-status">Coming Soon</span>
        </div>
      </div>
      
      <div class="settings-section">
        <div class="settings-info-text">
          <p>Connect additional calendar accounts to view all your events in one place.</p>
          <p style="margin-top: 12px;">Each account can have multiple calendars that you can enable or disable individually.</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Remove Calendar Accounts Screen (Level 2) -->
  <div class="settings-screen" data-level="2" data-screen="remove-calendar" data-title="Remove Calendar Accounts">
    <div class="settings-list" id="remove-calendar-accounts-container">
      <!-- Calendar accounts will be dynamically populated by dcal-settings-manager.js -->
      <div style="padding: 20px; text-align: center; color: #999;">
        Loading accounts...
      </div>
    </div>
  </div>

  <!-- Remove Account Modal -->
  <div id="remove-account-modal" class="modal-overlay" style="display: none;">
    <div class="modal-content">
      <h3>Remove Calendar Account?</h3>
      <p id="remove-account-message">
        This will remove <strong id="remove-account-name"></strong> and all its calendars from Dashie.
      </p>
      <p style="margin-top: 12px; font-size: 14px; color: var(--text-secondary);">
        This will not delete your actual account or calendars.
      </p>
      <div class="modal-actions">
        <button id="cancel-remove-account" class="modal-btn modal-btn-secondary">Cancel</button>
        <button id="confirm-remove-account" class="modal-btn modal-btn-danger">Remove Account</button>
      </div>
    </div>
  </div>
  
  <!-- Start Week On Screen (Level 2) - Placeholder -->
  <div class="settings-screen" data-level="2" data-screen="start-week-on" data-title="Start Week On">
    <div class="settings-list">
      <div class="settings-section">
        <div class="settings-cell selectable" data-setting="calendar.startWeekOn" data-value="sun">
          <span class="cell-label">Sunday</span>
          <span class="cell-checkmark">✓</span>
        </div>
        <div class="settings-cell selectable" data-setting="calendar.startWeekOn" data-value="mon">
          <span class="cell-label">Monday</span>
          <span class="cell-checkmark">✓</span>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Scroll Time Screen (Level 2) - Placeholder -->
  <div class="settings-screen" data-level="2" data-screen="scroll-time" data-title="Start Time to Scroll To">
    <div class="settings-list">
      <div class="settings-section">
        <div class="settings-cell selectable" data-setting="calendar.scrollTime" data-value="4">
          <span class="cell-label">4 AM</span>
          <span class="cell-checkmark">✓</span>
        </div>
        <div class="settings-cell selectable" data-setting="calendar.scrollTime" data-value="5">
          <span class="cell-label">5 AM</span>
          <span class="cell-checkmark">✓</span>
        </div>
        <div class="settings-cell selectable" data-setting="calendar.scrollTime" data-value="6">
          <span class="cell-label">6 AM</span>
          <span class="cell-checkmark">✓</span>
        </div>
        <div class="settings-cell selectable" data-setting="calendar.scrollTime" data-value="7">
          <span class="cell-label">7 AM</span>
          <span class="cell-checkmark">✓</span>
        </div>
        <div class="settings-cell selectable" data-setting="calendar.scrollTime" data-value="8">
          <span class="cell-label">8 AM</span>
          <span class="cell-checkmark">✓</span>
        </div>
        <div class="settings-cell selectable" data-setting="calendar.scrollTime" data-value="9">
          <span class="cell-label">9 AM</span>
          <span class="cell-checkmark">✓</span>
        </div>
        <div class="settings-cell selectable" data-setting="calendar.scrollTime" data-value="10">
          <span class="cell-label">10 AM</span>
          <span class="cell-checkmark">✓</span>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Calendar Zoom Screen (Level 2) - Placeholder -->
  <div class="settings-screen" data-level="2" data-screen="calendar-zoom" data-title="Calendar Zoom">
    <div class="settings-list">
      <div class="settings-section">
        <div class="settings-cell selectable" data-setting="calendar.zoom" data-value="50">
          <span class="cell-label">50%</span>
          <span class="cell-checkmark">✓</span>
        </div>
        <div class="settings-cell selectable" data-setting="calendar.zoom" data-value="60">
          <span class="cell-label">60%</span>
          <span class="cell-checkmark">✓</span>
        </div>
        <div class="settings-cell selectable" data-setting="calendar.zoom" data-value="70">
          <span class="cell-label">70%</span>
          <span class="cell-checkmark">✓</span>
        </div>
        <div class="settings-cell selectable" data-setting="calendar.zoom" data-value="80">
          <span class="cell-label">80%</span>
          <span class="cell-checkmark">✓</span>
        </div>
        <div class="settings-cell selectable" data-setting="calendar.zoom" data-value="90">
          <span class="cell-label">90%</span>
          <span class="cell-checkmark">✓</span>
        </div>
        <div class="settings-cell selectable" data-setting="calendar.zoom" data-value="100">
          <span class="cell-label">100%</span>
          <span class="cell-checkmark">✓</span>
        </div>
        <div class="settings-cell selectable" data-setting="calendar.zoom" data-value="110">
          <span class="cell-label">110%</span>
          <span class="cell-checkmark">✓</span>
        </div>
        <div class="settings-cell selectable" data-setting="calendar.zoom" data-value="120">
          <span class="cell-label">120%</span>
          <span class="cell-checkmark">✓</span>
        </div>
        <div class="settings-cell selectable" data-setting="calendar.zoom" data-value="130">
          <span class="cell-label">130%</span>
          <span class="cell-checkmark">✓</span>
        </div>
        <div class="settings-cell selectable" data-setting="calendar.zoom" data-value="140">
          <span class="cell-label">140%</span>
          <span class="cell-checkmark">✓</span>
        </div>
        <div class="settings-cell selectable" data-setting="calendar.zoom" data-value="150">
          <span class="cell-label">150%</span>
          <span class="cell-checkmark">✓</span>
        </div>
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
        <div class="setting-row">
          <label class="setting-label">Zip Code</label>
          <input type="text" class="form-control mobile-text-input" 
                 id="mobile-family-zipcode" data-setting="family.zipCode" 
                 placeholder="Enter zip code" maxlength="10" 
                 pattern="[0-9]{5}(-[0-9]{4})?">
          <div class="setting-helper-text" id="zipcode-location-display" style="margin-top: 6px; font-size: 12px; color: var(--text-secondary, #999);">
            <!-- Location will be displayed here -->
          </div>
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
      
      <div class="settings-cell" data-navigate="privacy">
        <div class="cell-content">
          <span class="cell-label">Privacy</span>
        </div>
        <span class="cell-chevron">›</span>
      </div>

       ${getFeaturesMenuItem()}
      
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
      
      <div class="settings-cell" data-navigate="delete-account">
        <div class="cell-content">
          <span class="cell-label" style="color: var(--danger-color, #ff4444);">Delete Account</span>
        </div>
        <span class="cell-chevron">›</span>
      </div>
    </div>
  </div>

  <!-- System Placeholders (Level 2) -->

  ${getFeaturesScreen()}


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

  <!-- Delete Account Screen (Level 2) -->
  <div class="settings-screen" data-level="2" data-screen="delete-account" data-title="Delete Account">
    <div class="settings-list">
      <div class="settings-section">
        <div class="settings-info-text">
          <h3 style="margin-bottom: 16px; color: var(--danger-color, #ff4444);">⚠️ Delete Your Account</h3>
          <p style="margin-bottom: 12px;">
            This will <strong>permanently delete</strong> your Dashie account and all associated data:
          </p>
          <ul style="margin: 12px 0; padding-left: 20px;">
            <li>All photos and uploaded files</li>
            <li>Calendar connections and settings</li>
            <li>All preferences and configurations</li>
            <li>User profile and authentication data</li>
          </ul>
          <p style="margin-top: 12px;">
            <strong>This action cannot be undone.</strong>
          </p>
        </div>
      </div>
      
      <div class="settings-section">
        <div class="settings-cell selectable" data-action="cancel">
          <span class="cell-label">Cancel</span>
          <span class="cell-checkmark"></span>
        </div>
        
        <div class="settings-cell selectable danger-cell" id="delete-account-btn" data-action="confirm">
          <span class="cell-label">Delete My Account</span>
          <span class="cell-checkmark"></span>
        </div>
      </div>
    </div>
  </div>

  <!-- Privacy Screen (Level 2) -->
  <div class="settings-screen" data-level="2" data-screen="privacy" data-title="Privacy">
    <div class="settings-list">
      <div class="settings-section">
        <div class="settings-cell toggle-cell" id="telemetry-toggle-cell">
          <span class="cell-label">Enable Crash Reporting (Beta)</span>
          <label class="toggle-switch">
            <input type="checkbox" id="enable-crash-reporting" data-setting="system.telemetryEnabled">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="setting-helper-text" style="padding: 8px 16px; font-size: 13px; color: var(--text-secondary);">
          Help improve Dashie by automatically sending crash reports and error logs. Only errors are sent - no personal data.
        </div>
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