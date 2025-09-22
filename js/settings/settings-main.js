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

// LEGACY COMPATIBILITY: Keep existing API for backward compatibility


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
    sleepTime: getSetting('display.sleepTime', '22:00'),
    wakeTime: getSetting('display.wakeTime', '07:00'),
    reSleepDelay: getSetting('display.reSleepDelay', 30)
  };
}

export function getPhotosSettings() {
  return {
    transitionTime: getSetting('photos.transitionTime', 5)
  };
}


// Export aliases for compatibility
export {
  showSettings as show,
  hideSettings as hide,
  saveSettings as save
};
