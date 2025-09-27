// js/main.js - App Initialization with Optimized JWT Loading
// CHANGE SUMMARY: Removed old phase system imports and added proper authentication completion waiting - streamlined initialization sequence

import { initializeEvents } from './core/events.js';
import { updateFocus, initializeHighlightTimeout } from './core/navigation.js';
import { renderGrid, renderSidebar } from './ui/grid.js';
import { autoInitialize } from './settings/settings-main.js';
import { initializeThemeSystem } from './core/theme.js';
import { initializeJWTService } from './apis/api-auth/unified-jwt-service.js';

/**
 * Wait for authentication to complete before proceeding
 * @returns {Promise<boolean>} True if authenticated, false if timeout
 */
async function waitForAuthentication() {
  const maxWait = 30000; // 30 seconds max for OAuth flow
  const checkInterval = 200; // Check every 200ms
  const startTime = Date.now();

  console.log('🔐 Waiting for authentication to complete...');

  while (Date.now() - startTime < maxWait) {
    const authSystem = window.dashieAuth || window.authManager;
    
    if (authSystem && authSystem.isAuthenticated && authSystem.isAuthenticated()) {
      // Also verify we have Google access token
      const hasGoogleToken = authSystem.getGoogleAccessToken && authSystem.getGoogleAccessToken();
      
      if (hasGoogleToken) {
        console.log('✅ Authentication complete with Google token');
        return true;
      } else {
        console.log('🔐 Authenticated but waiting for Google token...');
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  console.warn('⚠️ Authentication timeout - proceeding without JWT');
  return false;
}

// ---------------------
// APP INITIALIZATION
// ---------------------
export async function initializeApp() {
  console.log("🚀 Initializing Dashie Dashboard...");
  
  try {
    // Initialize theme system early
    initializeThemeSystem();
    
    // Set up event listeners
    initializeEvents();
    
    // Initialize navigation highlight timeout system
    initializeHighlightTimeout();
    
    // Always render UI immediately - auth system will show/hide as needed
    renderSidebar();
    renderGrid();
    
    console.log("✅ Dashie Dashboard UI initialized successfully!");
    
    // OPTIMIZED: Wait for authentication to complete BEFORE initializing JWT
    const isAuthenticated = await waitForAuthentication();
    
    if (isAuthenticated) {
      console.log("🔐 Initializing JWT service after authentication...");
      const jwtReady = await initializeJWTService();
      
      if (jwtReady) {
        console.log("✅ JWT service ready - RLS mode available");
      } else {
        console.log("⚡ JWT service not available - using direct mode");
      }
    } else {
      console.log("⚡ No authentication - JWT service skipped");
    }
    
    // Now initialize settings (after JWT is ready or skipped)
    console.log("⚙️ Initializing settings system...");
    autoInitialize();
    
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