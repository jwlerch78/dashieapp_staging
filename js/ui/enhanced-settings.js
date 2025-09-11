// js/ui/enhanced-settings.js - Enhanced Settings with Firebase Integration

import { state, setConfirmDialog } from '../core/state.js';
import { getCurrentTheme, getAvailableThemes, switchTheme } from '../core/theme.js';
import { FirebaseSettingsStorage } from '../firebase/firebase-storage.js';

// ---------------------
// SETTINGS STATE
// ---------------------

// Default settings structure
export const defaultSettings = {
  sleepTime: { hour: 21, minute: 30 }, // 9:30 PM
  wakeTime: { hour: 6, minute: 30 },   // 6:30 AM
  resleepDelay: 15, // minutes
  photoTransitionTime: 15, // seconds
  redirectUrl: 'https://jwlerch78.github.io/dashie/', // default URL
  theme: 'dark' // default theme
};

export let settings = { ...defaultSettings };

let settingsModal = null;
let settingsFocus = { type: 'close', index: 0 };
let sleepTimer = null;
let resleepTimer = null;
let checkInterval = null;
let expandedSections = new Set();

// Firebase storage instance
let firebaseStorage = null;
let realTimeUnsubscribe = null;

// ---------------------
// FIREBASE INTEGRATION
// ---------------------

export function initializeFirebaseSettings() {
  // Initialize when user is authenticated
  const user = window.dashieAuth?.getUser();
  if (user && user.id) {
    console.log('🔥 Initializing Firebase settings for user:', user.name);
    
    firebaseStorage = new FirebaseSettingsStorage(user.id);
    
    // Ensure user document exists
    firebaseStorage.ensureUserDocument();
    
    // Load settings from cloud/local
    loadSettings();
    
    // Set up real-time sync
    setupRealTimeSync();
  } else {
    console.log('📱 No authenticated user, using local storage only');
    loadSettingsLocal();
  }
}

function setupRealTimeSync() {
  if (firebaseStorage && !realTimeUnsubscribe) {
    realTimeUnsubscribe = firebaseStorage.subscribeToSettingsChanges((newSettings) => {
      console.log('🔄 Settings updated from another device');
      
      // Update local settings object
      Object.assign(settings, newSettings);
      
      // Apply theme if it changed
      if (newSettings.theme && newSettings.theme !== getCurrentTheme()) {
        switchTheme(newSettings.theme);
      }
      
      // Update any open settings modal
      if (settingsModal) {
        updateSettingsModalValues();
      }
      
      // Trigger any other updates (photo widget, etc.)
      updatePhotoWidget();
    });
  }
}

// ---------------------
// SETTINGS PERSISTENCE
// ---------------------

async function loadSettings() {
  try {
    if (firebaseStorage) {
      const savedSettings = await firebaseStorage.loadSettings();
      if (savedSettings) {
        Object.assign(settings, savedSettings);
        
        // Apply loaded theme
        if (savedSettings.theme && savedSettings.theme !== getCurrentTheme()) {
          switchTheme(savedSettings.theme);
        }
        
        console.log('📖 Settings loaded successfully');
        return;
      }
    }
  } catch (error) {
    console.warn('Firebase settings load failed, using local fallback:', error);
  }
  
  // Fallback to local storage
  loadSettingsLocal();
}

function loadSettingsLocal() {
  try {
    const saved = localStorage.getItem('dashie-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(settings, parsed);
      
      // Sync theme setting with current theme
      settings.theme = getCurrentTheme();
    }
  } catch (e) {
    console.warn('Failed to load local settings:', e);
    Object.assign(settings, defaultSettings);
  }
}

async function saveSettings() {
  try {
    // Sync current theme to settings
    settings.theme = getCurrentTheme();
    
    if (firebaseStorage) {
      // Save to Firebase (includes local backup)
      await firebaseStorage.saveSettings(settings);
      console.log('💾 Settings saved to cloud');
    } else {
      // Fallback to local storage only
      localStorage.setItem('dashie-settings', JSON.stringify(settings));
      console.log('💾 Settings saved locally');
    }
  } catch (e) {
    console.warn('Failed to save settings:', e);
    // Emergency fallback to local storage
    try {
      localStorage.setItem('dashie-settings', JSON.stringify(settings));
    } catch (localError) {
      console.error('Critical: All storage methods failed!', localError);
    }
  }
}

// ---------------------
// SETTINGS MODAL UPDATES
// ---------------------

function updateSettingsModalValues() {
  if (!settingsModal) return;
  
  // Update theme selector
  const themeSelect = settingsModal.querySelector('#theme-select');
  if (themeSelect) {
    themeSelect.value = settings.theme;
  }
  
  // Update sleep time
  const sleepHour = settingsModal.querySelector('#sleep-hour');
  const sleepMinute = settingsModal.querySelector('#sleep-minute');
  if (sleepHour && sleepMinute) {
    const displayHour = settings.sleepTime.hour > 12 ? settings.sleepTime.hour - 12 : 
                      settings.sleepTime.hour === 0 ? 12 : settings.sleepTime.hour;
    sleepHour.value = displayHour;
    sleepMinute.value = settings.sleepTime.minute;
  }
  
  // Update wake time
  const wakeHour = settingsModal.querySelector('#wake-hour');
  const wakeMinute = settingsModal.querySelector('#wake-minute');
  if (wakeHour && wakeMinute) {
    const displayHour = settings.wakeTime.hour > 12 ? settings.wakeTime.hour - 12 : 
                      settings.wakeTime.hour === 0 ? 12 : settings.wakeTime.hour;
    wakeHour.value = displayHour;
    wakeMinute.value = settings.wakeTime.minute;
  }
  
  // Update other fields
  const resleepDelay = settingsModal.querySelector('#resleep-delay');
  if (resleepDelay) resleepDelay.value = settings.resleepDelay;
  
  const redirectUrl = settingsModal.querySelector('#redirect-url');
  if (redirectUrl) redirectUrl.value = settings.redirectUrl;
  
  const photoTransition = settingsModal.querySelector('#photo-transition');
  if (photoTransition) photoTransition.value = settings.photoTransitionTime;
}

// ---------------------
// EXISTING FUNCTIONS (Enhanced)
// ---------------------

function saveSettingsAndClose() {
  const modal = settingsModal;
  
  // Validate all inputs (existing validation logic)
  const inputs = modal.querySelectorAll('.time-input, .number-input');
  let isValid = true;
  
  inputs.forEach(input => {
    const value = parseInt(input.value);
    const min = parseInt(input.min);
    const max = parseInt(input.max);
    if (isNaN(value) || value < min || value > max) {
      isValid = false;
      input.style.borderColor = '#ff6b6b';
    }
  });
  
  if (!isValid) {
    alert('Please fix the invalid values before saving.');
    return;
  }
  
  // Save sleep time
  let sleepHour = parseInt(modal.querySelector('#sleep-hour').value);
  const sleepPeriod = modal.querySelector('#sleep-period').textContent;
  if (sleepPeriod === 'PM' && sleepHour !== 12) sleepHour += 12;
  if (sleepPeriod === 'AM' && sleepHour === 12) sleepHour = 0;
  
  settings.sleepTime = {
    hour: sleepHour,
    minute: parseInt(modal.querySelector('#sleep-minute').value)
  };
  
  // Save wake time
  let wakeHour = parseInt(modal.querySelector('#wake-hour').value);
  const wakePeriod = modal.querySelector('#wake-period').textContent;
  if (wakePeriod === 'PM' && wakeHour !== 12) wakeHour += 12;
  if (wakePeriod === 'AM' && wakeHour === 12) wakeHour = 0;
  
  settings.wakeTime = {
    hour: wakeHour,
    minute: parseInt(modal.querySelector('#wake-minute').value)
  };
  
  // Save other settings
  settings.resleepDelay = parseInt(modal.querySelector('#resleep-delay').value);
  settings.redirectUrl = modal.querySelector('#redirect-url').value;
  settings.photoTransitionTime = parseInt(modal.querySelector('#photo-transition').value);
  settings.theme = getCurrentTheme();
  
  // Update photo widget
  updatePhotoWidget();
  
  // Save to cloud/local
  saveSettings();
  closeSettings();
}

// Update photo widget function (from original)
function updatePhotoWidget() {
  const photoWidgets = document.querySelectorAll('iframe[src*="photos.html"]');
  photoWidgets.forEach(iframe => {
    if (iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage({
          type: 'updateTransitionTime',
          transitionTime: settings.photoTransitionTime
        }, '*');
      } catch (error) {
        console.warn('Failed to update photo widget:', error);
      }
    }
  });
}

// ---------------------
// EXPORTED FUNCTIONS
// ---------------------

export function getSettings() {
  return { ...settings };
}

export function updateSetting(key, value) {
  settings[key] = value;
  saveSettings();
}

// Initialize Firebase settings when auth is ready
export function initializeSettings() {
  // Wait for auth to be ready
  if (window.dashieAuth && window.dashieAuth.isAuthenticated()) {
    initializeFirebaseSettings();
  } else {
    // Listen for auth state changes
    document.addEventListener('dashie-auth-ready', () => {
      initializeFirebaseSettings();
    });
    
    // Fallback to local settings for now
    loadSettingsLocal();
  }
}

// Cleanup function
export function cleanupSettings() {
  if (realTimeUnsubscribe) {
    realTimeUnsubscribe();
    realTimeUnsubscribe = null;
  }
  
  if (firebaseStorage) {
    firebaseStorage.unsubscribeAll();
    firebaseStorage = null;
  }
}

// Re-export essential functions from original settings.js
export { 
  saveSettingsAndClose,
  // ... other exports that your existing code uses
};
