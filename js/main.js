// js/main.js - App Initialization & Orchestration (Fixed to eliminate duplicate auth)
import { initializeEvents } from './core/events.js';
import { updateFocus, initializeHighlightTimeout } from './core/navigation.js';
import { renderGrid, renderSidebar } from './ui/grid.js';
import { initializeSettings } from './settings/settings-main.js';
import { initializeThemeSystem } from './core/theme.js';

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
// AUTH CHECK (No duplicate creation)
// ---------------------
// Check if auth is already initialized by simple-auth.js
function checkAuthReady() {
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (window.dashieAuth) {
        clearInterval(checkInterval);
        console.log('🔐 Auth system found and ready');
        resolve(true);
      }
    }, 100);
    
    // Timeout after 5 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      console.warn('🔐 Auth system not found within timeout');
      resolve(false);
    }, 5000);
  });
}

// ---------------------
// APP INITIALIZATION
// ---------------------
async function initializeApp() {
  console.log("Initializing Dashie Dashboard...");
  
  // Wait for auth system to be ready (created by simple-auth.js)
  await checkAuthReady();
  
  // Initialize settings early so they can load and apply theme
  await initializeSettings();
  
  // Initialize theme system (after settings so theme can be applied)
  initializeThemeSystem();
  
  // Set up event listeners
  initializeEvents();
  
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
