// js/main.js - App Initialization with Photo Upload Manager Integration
// CHANGE SUMMARY: Fixed initialization sequence - show overlay immediately, removed auth timeout for device flow, updated progress messages

import { initializeEvents } from './core/events.js';
import { updateFocus, initializeHighlightTimeout } from './core/navigation.js';
import { renderGrid, renderSidebar } from './ui/grid.js';
import { autoInitialize } from './settings/settings-main.js';
import { initializeJWTService } from './apis/api-auth/jwt-token-operations.js';
import { processPendingRefreshTokens } from './apis/api-auth/providers/web-oauth.js';
import { PhotoUploadManager } from '../widgets/photos/photo-upload-manager.js';
import { showLoadingOverlay, updateLoadingProgress, hideLoadingOverlay, isLoadingOverlayVisible } from './ui/loading-overlay.js';

// Initialization state tracker
const initState = {
  auth: 'pending',
  jwt: 'pending',
  tokens: 'pending',
  settings: 'pending',
  widgets: 'pending'
};

// Global photo upload manager instance
let photoUploadManager = null;

/**
 * Wait for authentication to complete before proceeding
 * FIXED: No timeout - device flow can take minutes to complete
 */
async function waitForAuthentication() {
  const checkInterval = 500; // Check every 500ms
  let elapsedSeconds = 0;
  
  console.log('🔐 Waiting for authentication to complete...');
  initState.auth = 'pending';

  while (true) {
    const authSystem = window.dashieAuth || window.authManager;
    
    if (authSystem && authSystem.isAuthenticated && authSystem.isAuthenticated()) {
      const hasGoogleToken = authSystem.getGoogleAccessToken && authSystem.getGoogleAccessToken();
      
      if (hasGoogleToken) {
        console.log('✅ Authentication complete with Google token');
        initState.auth = 'ready';
        return true;
      }
    }
    
    // Update progress message every 60 seconds while waiting
    if (elapsedSeconds % 60 === 0 && elapsedSeconds > 0) {
      const minutes = Math.floor(elapsedSeconds / 60);
      const timeStr = minutes > 1 ? `${minutes} minutes` : `${minutes} minute`;
      updateLoadingProgress(5, `Waiting for sign-in... (${timeStr})`);
      console.log(`🔐 Still waiting for authentication (${timeStr} elapsed)...`);
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    elapsedSeconds += checkInterval / 1000;
  }
}

/**
 * Process any refresh tokens that were queued during OAuth callback
 */
async function processQueuedRefreshTokens() {
  console.log('🔄 Processing queued refresh tokens...');
  initState.tokens = 'pending';
  
  try {
    const pendingCount = window.pendingRefreshTokens?.length || 0;
    
    if (pendingCount === 0) {
      console.log('📝 No pending refresh tokens to process');
      initState.tokens = 'skipped';
      return true;
    }
    
    console.log(`📝 Found ${pendingCount} pending refresh token(s) to process`);
    
    const results = await processPendingRefreshTokens();
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    if (successCount > 0) {
      console.log(`✅ Successfully stored ${successCount} refresh token(s)`);
      
      if (failCount > 0) {
        console.warn(`⚠️ ${failCount} refresh token(s) failed to store`);
      }
      initState.tokens = 'ready';
      return true;
    } else {
      console.error(`❌ Failed to store any refresh tokens (${failCount} failed)`);
      initState.tokens = 'failed';
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error processing refresh tokens:', error);
    initState.tokens = 'failed';
    return false;
  }
}

/**
 * Initialize Photo Upload Manager
 * Called after data manager and JWT are ready
 */
function initializePhotoUploadManager() {
  try {
    if (window.dataManager?.photoService?.isReady()) {
      photoUploadManager = new PhotoUploadManager(window.dataManager.photoService);
      window.photoUploadManager = photoUploadManager;
      console.log('📸 Photo upload manager initialized');
      return true;
    } else {
      console.warn('⚠️ Photo service not ready, upload manager not initialized');
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to initialize photo upload manager:', error);
    return false;
  }
}

/**
 * Main app initialization
 * FIXED: Show loading overlay immediately, no auth timeout
 */
async function initializeApp() {
  console.log('🚀 Initializing Dashie Dashboard...');
  
  // FIXED: Show loading overlay IMMEDIATELY before anything else
  showLoadingOverlay();
  updateLoadingProgress(0, 'Starting up...');
  
  // Initialize basic UI and navigation
  initializeEvents();
  initializeHighlightTimeout();
  renderGrid();
  renderSidebar();
  updateFocus(1, 1);
  
  console.log('✅ Dashie Dashboard UI initialized successfully!');
  updateLoadingProgress(5, 'Waiting for sign-in...');
  
  // FIXED: Wait for authentication without timeout (device flow needs time)
  const authSuccessful = await waitForAuthentication();
  
  if (!authSuccessful) {
    // This should never happen now since we removed the timeout
    console.error('❌ Authentication failed unexpectedly');
    updateLoadingProgress(100, 'Authentication failed - please reload');
    return;
  }
  
  // Update progress after auth completes
  updateLoadingProgress(10, 'Authentication complete');
  
  // Initialize JWT service
  console.log('🔐 Initializing JWT service after authentication...');
  updateLoadingProgress(25, 'Establishing secure connection...');
  
  try {
    const jwtReady = await initializeJWTService();
    
    if (jwtReady) {
      console.log('✅ JWT service ready - RLS mode available');
      initState.jwt = 'ready';
      updateLoadingProgress(40, 'Secure connection established');
      
      // Initialize SimpleAuth services now that JWT is ready
      if (window.dashieAuth && window.dashieAuth.authenticated) {
        console.log('🔧 Initializing services now that JWT is ready...');
        try {
          await window.dashieAuth.initializeServices();
          console.log('✅ Services initialized with valid JWT token');
        } catch (error) {
          console.error('❌ Failed to initialize services:', error);
          // Continue anyway - some functionality may be degraded
        }
      }
    } else {
      console.warn('⚠️ JWT service not ready - will use direct mode');
      initState.jwt = 'failed';
      updateLoadingProgress(40, 'Secure connection unavailable');
    }
  } catch (error) {
    console.error('❌ JWT service initialization failed:', error);
    initState.jwt = 'failed';
    updateLoadingProgress(40, 'Secure connection failed');
  }
  
  // Process refresh tokens if JWT is ready
  updateLoadingProgress(42, 'Finalizing token queue...');
  
  if (initState.jwt === 'ready') {
    updateLoadingProgress(45, 'Processing refresh tokens...');
    const tokensProcessed = await processQueuedRefreshTokens();
    
    if (tokensProcessed && initState.tokens === 'ready') {
      updateLoadingProgress(55, 'Refresh tokens stored successfully');
    } else if (initState.tokens === 'skipped') {
      updateLoadingProgress(55, 'No refresh tokens to process');
    } else {
      updateLoadingProgress(55, 'Refresh token processing failed');
    }
  } else {
    console.log('⏭️ Skipping refresh token processing (JWT not ready)');
    initState.tokens = 'skipped';
    updateLoadingProgress(55, 'Skipping token processing');
  }
  
  // Initialize settings system
  console.log(`⚙️ Initializing settings system with JWT status: ${initState.jwt}`);
  updateLoadingProgress(60, 'Loading your settings...');
  
  try {
    await autoInitialize(initState.jwt);
    console.log('✅ Settings system ready');
    initState.settings = 'ready';
    updateLoadingProgress(75, 'Settings loaded successfully');
  } catch (error) {
    console.error('❌ Settings system failed:', error);
    initState.settings = 'degraded';
    updateLoadingProgress(75, 'Settings degraded');
  }
  
  // Initialize theme system
  console.log('🎨 Initializing theme system...');
  updateLoadingProgress(80, 'Applying your theme...');
  
  // Wait for widgets to register before triggering data
  console.log('🎨 Waiting for widgets to register before triggering data...');
  updateLoadingProgress(85, 'Preparing widgets...');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Now trigger data loading
  updateLoadingProgress(95, 'Loading your data...');
  console.log('📊 Triggering data loading after widget registration...');
  await window.dashieAuth.triggerDataLoading();
  console.log('📊 Data loading triggered successfully');
  
  // Initialize Photo Upload Manager AFTER data manager is ready
  initializePhotoUploadManager();
  
  // Complete initialization
  const loadingMessage = initState.tokens === 'ready' 
    ? 'Welcome to Dashie! (Long-term access enabled)'
    : 'Welcome to Dashie!';
    
  updateLoadingProgress(100, loadingMessage);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  hideLoadingOverlay();
  
  initState.widgets = 'ready';
  
  console.log('🎯 Dashie initialization complete:', {
    auth: initState.auth,
    jwt: initState.jwt,
    tokens: initState.tokens,
    settings: initState.settings,
    widgets: initState.widgets
  });
  
  // Mark app as authenticated for CSS styling
  document.body.classList.add('authenticated');
  console.log('🔐 App marked as authenticated');
}

// Listen for upload modal requests from widgets
window.addEventListener('message', (event) => {
  if (event.data?.type === 'request-upload-modal') {
    console.log('📸 Upload modal requested by widget:', event.data.widget);
    
    if (photoUploadManager) {
      photoUploadManager.open();
    } else {
      console.error('❌ Photo upload manager not initialized');
    }
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}