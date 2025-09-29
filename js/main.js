// js/main.js - App Initialization with Loading Overlay and Refresh Token Integration
// CHANGE SUMMARY: Added refresh token processing integration - processes queued tokens after JWT service is ready

import { initializeEvents } from './core/events.js';
import { updateFocus, initializeHighlightTimeout } from './core/navigation.js';
import { renderGrid, renderSidebar } from './ui/grid.js';
import { autoInitialize } from './settings/settings-main.js';
import { initializeJWTService } from './apis/api-auth/jwt-token-operations.js';
import { processPendingRefreshTokens } from './apis/api-auth/providers/web-oauth.js';
import { showLoadingOverlay, updateLoadingProgress, hideLoadingOverlay, isLoadingOverlayVisible } from './ui/loading-overlay.js';

// Initialization state tracker
const initState = {
  auth: 'pending',      // pending -> ready -> failed
  jwt: 'pending',       // pending -> ready -> failed -> skipped
  tokens: 'pending',    // pending -> ready -> failed -> skipped (NEW)
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

/**
 * Process any refresh tokens that were queued during OAuth callback
 * @returns {Promise<boolean>} True if processing was successful
 */
async function processQueuedRefreshTokens() {
  console.log('🔄 Processing queued refresh tokens...');
  initState.tokens = 'pending';
  
  try {
    // Check if there are any pending tokens
    const pendingCount = window.pendingRefreshTokens?.length || 0;
    
    if (pendingCount === 0) {
      console.log('📝 No pending refresh tokens to process');
      initState.tokens = 'skipped';
      return true;
    }
    
    console.log(`📝 Found ${pendingCount} pending refresh token(s) to process`);
    
    // Process the queued tokens
    const results = await processPendingRefreshTokens();
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    if (successful > 0) {
      console.log(`✅ Successfully stored ${successful} refresh token(s)`);
      initState.tokens = 'ready';
      return true;
    } else if (failed > 0) {
      console.warn(`⚠️ Failed to store ${failed} refresh token(s)`);
      initState.tokens = 'failed';
      return false;
    } else {
      console.log('📝 No tokens were processed');
      initState.tokens = 'skipped';
      return true;
    }
    
  } catch (error) {
    console.error('❌ Error processing queued refresh tokens:', error);
    initState.tokens = 'failed';
    return false;
  }
}

// ---------------------
// APP INITIALIZATION
// ---------------------
export async function initializeApp() {
  try {
    console.log("🚀 Initializing Dashie Dashboard...");
    
    // Set up event listeners
    initializeEvents();
    
    // Initialize navigation highlight timeout system
    initializeHighlightTimeout();
    
    // Always render UI immediately - auth system will show/hide as needed
    renderSidebar();
    renderGrid();
    
    console.log("✅ Dashie Dashboard UI initialized successfully!");
    
    // Wait for authentication to complete BEFORE showing loading overlay
    const isAuthenticated = await waitForAuthentication();
    
    // FIXED: Only show loading overlay AFTER authentication is complete
    if (isAuthenticated) {
      showLoadingOverlay();
      updateLoadingProgress(10, "Authentication complete");
      
      // Determine JWT status
      console.log("🔐 Initializing JWT service after authentication...");
      initState.jwt = 'pending';
      
      updateLoadingProgress(25, "Establishing secure connection...");
      
      const jwtReady = await initializeJWTService();
      
      if (jwtReady) {
        console.log("✅ JWT service ready - RLS mode available");
        initState.jwt = 'ready';
        updateLoadingProgress(40, "Secure connection established");
        
        // **NEW: Brief delay to ensure any final token queuing is complete**
        updateLoadingProgress(42, "Finalizing token queue...");
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // **NEW: Process queued refresh tokens after JWT is ready**
        updateLoadingProgress(45, "Processing refresh tokens...");
        
        const tokensProcessed = await processQueuedRefreshTokens();
        
        if (tokensProcessed && initState.tokens === 'ready') {
          updateLoadingProgress(55, "Refresh tokens stored successfully");
        } else if (initState.tokens === 'failed') {
          updateLoadingProgress(55, "Refresh token storage failed");
        } else {
          updateLoadingProgress(55, "No refresh tokens to process");
        }
        
      } else {
        console.log("⚡ JWT service failed - using direct mode");
        initState.jwt = 'failed';
        initState.tokens = 'skipped'; // Skip token processing if JWT failed
        updateLoadingProgress(55, "Using fallback connection");
      }
      
      // Pass JWT status to settings initialization
      console.log("⚙️ Initializing settings system with JWT status:", initState.jwt);
      initState.settings = 'pending';
      
      updateLoadingProgress(60, "Loading your settings...");
      
      const settingsReady = await autoInitialize(initState.jwt);
      
      if (settingsReady) {
        console.log("✅ Settings system ready");
        initState.settings = 'ready';
        updateLoadingProgress(75, "Settings loaded successfully");
      } else {
        console.log("⚠️ Settings system in degraded mode");
        initState.settings = 'degraded';
        updateLoadingProgress(75, "Settings loaded with fallback");
      }
      
      // Initialize theme system after settings are ready
      console.log("🎨 Initializing theme system...");
      updateLoadingProgress(80, "Applying your theme...");
      
      const { initializeThemeSystem } = await import('./core/theme.js');
      initializeThemeSystem();
      
      // Wait for widgets to register, then trigger data loading
      console.log("🎨 Waiting for widgets to register before triggering data...");
      updateLoadingProgress(85, "Preparing widgets...");
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second wait
      
      updateLoadingProgress(95, "Loading your data...");
      
      // Now manually trigger data loading
      if (window.dashieAuth) {
        console.log("📊 Triggering data loading after widget registration...");
        await window.dashieAuth.triggerDataLoading();
        console.log("📊 Data loading triggered successfully");
      }
      
      initState.widgets = 'ready';
      
      // Final completion with enhanced status message
      let completionMessage = "Welcome to Dashie!";
      if (initState.tokens === 'ready') {
        completionMessage = "Welcome to Dashie! (Long-term access enabled)";
      } else if (initState.tokens === 'failed') {
        completionMessage = "Welcome to Dashie! (Limited session access)";
      }
      
      updateLoadingProgress(100, completionMessage);
      console.log("🎯 Dashie initialization complete:", initState);
      
      // Hide loading overlay after a brief moment
      setTimeout(() => {
        hideLoadingOverlay();
      }, 800);
      
    } else {
      console.log("⚡ No authentication - proceeding without overlay");
      initState.jwt = 'skipped';
      initState.tokens = 'skipped';
      initState.settings = 'degraded';
      initState.widgets = 'ready';
    }
    
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
    if (isLoadingOverlayVisible()) {
      updateLoadingProgress(100, "Initialization failed");
      setTimeout(() => {
        hideLoadingOverlay();
      }, 2000);
    }
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

/**
 * Get refresh token storage status (for debugging)
 * @returns {Object} Refresh token status information
 */
export function getRefreshTokenStatus() {
  return {
    initState: initState.tokens,
    pendingCount: window.pendingRefreshTokens?.length || 0,
    jwtReady: window.jwtAuth?.isServiceReady?.() || false,
    hasStoreMethod: !!window.jwtAuth?.storeTokens
  };
}

// Export for compatibility
export default initializeApp;