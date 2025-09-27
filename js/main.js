// js/main.js - App Initialization (Fixed for new auth system)
// CHANGE SUMMARY: Removed auth checking logic, simplified to work with new simple-auth.js system

import { initializeEvents } from './core/events.js';
import { updateFocus, initializeHighlightTimeout } from './core/navigation.js';
import { renderGrid, renderSidebar } from './ui/grid.js';
import { autoInitialize } from './settings/settings-main.js';
import { initializeThemeSystem } from './core/theme.js';
import './testing/jwt-phase1-loader.js';
import './testing/jwt-storage-integration.js';
import './testing/phase3-simple-loader.js';




// ---------------------
// APP INITIALIZATION
// ---------------------
export async function initializeApp() {
  console.log("🚀 Initializing Dashie Dashboard...");
  
  try {
    // Auto-initialize settings (will wait for auth internally)
    autoInitialize();
    
    // Initialize theme system
    initializeThemeSystem();
    
    // Set up event listeners
    initializeEvents();
    
    // Initialize navigation highlight timeout system
    initializeHighlightTimeout();
    
    // Always render UI immediately - auth system will show/hide as needed
    renderSidebar();
    renderGrid();
    
    console.log("✅ Dashie Dashboard UI initialized successfully!");
    
    // Set up auth state listener for when user signs in
    const checkAuthAndUpdate = () => {
      if (window.dashieAuth && window.dashieAuth.isUserAuthenticated()) {
        const app = document.getElementById('app');
        if (app) {
          app.classList.add('authenticated');
        }
        console.log('🔐 App marked as authenticated');
        return true;
      }
      return false;
    };
    
    // Check immediately
    if (!checkAuthAndUpdate()) {
      // If not authenticated yet, set up listeners
      document.addEventListener('dashie-auth-ready', checkAuthAndUpdate);
      
      // Also check periodically as fallback
      const authCheckInterval = setInterval(() => {
        if (checkAuthAndUpdate()) {
          clearInterval(authCheckInterval);
        }
      }, 1000);
      
      // Stop checking after 30 seconds
      setTimeout(() => clearInterval(authCheckInterval), 30000);
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize Dashie Dashboard:', error);
    throw error;
  }
}

// Export for compatibility
export default initializeApp;
