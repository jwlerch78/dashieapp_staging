// js/main.js - App Initialization & Orchestration with Firebase Settings

import { initializeEvents } from './core/events.js';
import { updateFocus, initializeHighlightTimeout } from './core/navigation.js';
import { renderGrid, renderSidebar } from './ui/grid.js';
import { initializeSleepTimer } from './ui/settings.js';
import { initializeThemeSystem } from './core/theme.js';
import { initializeSettings } from './ui/settings.js';

// ---------------------
// EARLY THEME APPLICATION
// ---------------------

// Import and apply theme as early as possible to prevent flash
async function preApplyTheme() {
  try {
    const { applyThemeBeforeLoad } = await import('./core/theme.js');
    applyThemeBeforeLoad();
  } catch (error) {
    console.warn('Early theme application failed:', error);
  }
}

// ---------------------
// APP INITIALIZATION
// ---------------------

function initializeApp() {
  console.log("Initializing Dashie Dashboard...");

  // Initialize Firebase settings early (handles auth state internally)
  initializeSettings();
  
  // Initialize theme system first (before any UI rendering)
  // Note: Early theme application already happened above
  initializeThemeSystem();
  
  // Set up event listeners
  initializeEvents();
  
  // Initialize sleep timer system (this loads settings, but Firebase will override)
  initializeSleepTimer();
  
  // Initialize navigation highlight timeout system
  initializeHighlightTimeout();
  
  // Render initial UI
  renderSidebar();
  renderGrid();
  
  // Handle authenticated state when ready
  setTimeout(() => {
    if (window.dashieAuth && window.dashieAuth.isAuthenticated()) {
      document.getElementById('app').classList.add('authenticated');
      console.log('🔐 App marked as authenticated');
    }
  }, 1000); 
  
  // DON'T call updateFocus() here - let it start clean with no highlights
  // updateFocus();
  
  console.log("Dashie Dashboard initialized successfully!");
}

// Pre-apply theme immediately when script loads
preApplyTheme();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
