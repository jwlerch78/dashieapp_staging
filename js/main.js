// js/main.js - App Initialization - REVERTED: Remove failed widget wait, keep JWT status tracking
// CHANGE SUMMARY: Reverted widget wait placement, kept JWT status tracking and settings improvements

import { initializeEvents } from './core/events.js';
import { updateFocus, initializeHighlightTimeout } from './core/navigation.js';
import { renderGrid, renderSidebar } from './ui/grid.js';
import { autoInitialize } from './settings/settings-main.js';
import { initializeJWTService } from './apis/api-auth/unified-jwt-service.js';

// Initialization state tracker
const initState = {
  auth: 'pending',      // pending -> ready -> failed
  jwt: 'pending',       // pending -> ready -> failed -> skipped
  settings: 'pending',  // pending -> ready -> degraded
  widgets: 'pending'    // pending -> ready
};

/**
 * Wait for authentication to complete before proceeding
 * @returns {Promise<boolean>} True if authenticated, false if timeout
 */
async function waitForAuthentication() {
  const maxWait = 30000; // 30 seconds max for OAuth flow
  const checkInterval = 200; // Check every 200ms
  const startTime = Date.now();

  console.log('🔐 Waiting for authentication to complete...');
  initState.auth = 'pending';

  while (Date.now() - startTime < maxWait) {
    const authSystem = window.dashieAuth || window.authManager;
    
    if (authSystem && authSystem.isAuthenticated && authSystem.isAuthenticated()) {
      // Also verify we have Google access token
      const hasGoogleToken = authSystem.getGoogleAccessToken && authSystem.getGoogleAccessToken();
      
      if (hasGoogleToken) {
        console.log('✅ Authentication complete with Google token');
        initState.auth = 'ready';
        return true;
      } else {
        console.log('🔐 Authenticated but waiting for Google token...');
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  console.warn('⚠️ Authentication timeout - proceeding without JWT');
  initState.auth = 'failed';
  return false;
}

// ---------------------
// APP INITIALIZATION
// ---------------------
export async function initializeApp() {
  console.log("🚀 Initializing Dashie Dashboard...");
  
  try {
    // Set up event listeners
    initializeEvents();
    
    // Initialize navigation highlight timeout system
    initializeHighlightTimeout();
    
    // Always render UI immediately - auth system will show/hide as needed
    renderSidebar();
    renderGrid();
    
    console.log("✅ Dashie Dashboard UI initialized successfully!");
    
    // Wait for authentication to complete
    const isAuthenticated = await waitForAuthentication();
    
    // Determine JWT status
    if (isAuthenticated) {
      console.log("🔐 Initializing JWT service after authentication...");
      initState.jwt = 'pending';
      
      const jwtReady = await initializeJWTService();
      
      if (jwtReady) {
        console.log("✅ JWT service ready - RLS mode available");
        initState.jwt = 'ready';
      } else {
        console.log("⚡ JWT service failed - using direct mode");
        initState.jwt = 'failed';
      }
    } else {
      console.log("⚡ No authentication - JWT service skipped");
      initState.jwt = 'skipped';
    }
    
    // Pass JWT status to settings initialization
    console.log("⚙️ Initializing settings system with JWT status:", initState.jwt);
    initState.settings = 'pending';
    
    const settingsReady = await autoInitialize(initState.jwt);
    
    if (settingsReady) {
      console.log("✅ Settings system ready");
      initState.settings = 'ready';
    } else {
      console.log("⚠️ Settings system in degraded mode");
      initState.settings = 'degraded';
    }
    
    // Initialize theme system after settings are ready
    console.log("🎨 Initializing theme system...");
    const { initializeThemeSystem } = await import('./core/theme.js');
    initializeThemeSystem();
    
    // FINAL STEP: Wait for widgets to register, then trigger data loading
    console.log("🎨 Waiting for widgets to register before triggering data...");
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second wait
    
    // Now manually trigger data loading
    if (isAuthenticated && window.dashieAuth) {
      console.log("📊 Triggering data loading after widget registration...");
      await window.dashieAuth.triggerDataLoading();
      console.log("📊 Data loading triggered successfully");
    }
    
    initState.widgets = 'ready';
    
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
    
    console.log("🎯 Dashie initialization complete:", initState);
    
  } catch (error) {
    console.error('❌ Failed to initialize Dashie Dashboard:', error);
    throw error;
  }
}

/**
 * Get current initialization state (for debugging)
 * @returns {Object} Current initialization state
 */
export function getInitializationState() {
  return { ...initState };
}

// Export for compatibility
export default initializeApp;