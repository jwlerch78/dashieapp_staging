// js/settings/settings-main.js - UPDATED to use modular system
// Main entry point for settings system

import SimplifiedSettings from './settings-simple-manager.js';

// Global settings instance
let settingsInstance = null;

// Initialize the settings system
export async function initializeSettings() {
  if (!settingsInstance) {
    settingsInstance = new SimplifiedSettings();
    console.log('⚙️ ✅ Modular settings system initialized');
  }
  return true;
}

// Auto-initialize settings system (called from main.js during bootup)
export async function autoInitialize() {
  console.log('⚙️ 🚀 Auto-initializing settings system...');
  
  try {
    // Initialize the settings system immediately
    await initializeSettings();
    
    // The SimplifiedSettings constructor will handle waiting for auth and loading settings
    console.log('⚙️ ✅ Settings system auto-initialization complete');
    return true;
  } catch (error) {
    console.error('⚙️ ❌ Failed to auto-initialize settings system:', error);
    // Don't throw - let the app continue without settings
    return false;
  }
}


// Show settings (main entry point - called from navigation.js)
export async function showSettings() {
  if (!settingsInstance) {
    await initializeSettings();
  }
  
  await settingsInstance.show();
}

// Hide settings
export function hideSettings() {
  if (settingsInstance) {
    settingsInstance.hide();
  }
}

// Check if settings are ready
export function isSettingsReady() {
  return !!settingsInstance;
}

// Handle keyboard events from main navigation (for compatibility)
export function handleSettingsKeyPress(event) {
  // The modular system handles its own keyboard events
  // This is just for compatibility with existing navigation code
  return false;
}


export function getSettingValue(path, defaultValue) {
  if (!settingsInstance?.controller) {
    return defaultValue;
  }
  return settingsInstance.controller.getSetting(path) ?? defaultValue;
}

export function setSettingValue(path, value) {
  if (!settingsInstance?.controller) {
    return false;
  }
  return settingsInstance.controller.setSetting(path, value);
}


export async function saveSettings() {
  if (!settingsInstance?.controller) {
    return false;
  }
  return await settingsInstance.controller.saveSettings();
}

export function getAllSettings() {
  if (!settingsInstance?.controller) {
    return {};
  }
  return settingsInstance.controller.getSettings();
}


export function getSleepTimes() {
  return {
    sleepTime: getSettingValue('display.sleepTime', '22:00'),
    wakeTime: getSettingValue('display.wakeTime', '07:00'),
    reSleepDelay: getSettingValue('display.reSleepDelay', 30)
  };
}

export function getPhotosSettings() {
  return {
    transitionTime: getSettingValue('photos.transitionTime', 5)
  };
}


// Export aliases for compatibility
export {
  showSettings as show,
  hideSettings as hide,
  saveSettings as save
};
