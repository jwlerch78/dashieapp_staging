// js/main.js
// CHANGE SUMMARY: Added QR code upload support - platform config storage, hash detection, auto-trigger upload, direct QR modal on TV

// ============================================
// IMPORTS
// ============================================

// Core systems
import { initializeEvents } from './core/events.js';
import { updateFocus, initializeHighlightTimeout } from './core/navigation.js';
import { renderGrid, renderSidebar } from './ui/grid.js';
import { WidgetRegistrationCoordinator } from './core/widget-registration-coordinator.js';
import { getPlatformDetector } from './utils/platform-detector.js';

// Settings and authentication
import { autoInitialize, showSettings, initializeSleepTimer } from './settings/settings-main.js';
import { initializeJWTService } from './apis/api-auth/jwt-token-operations.js';

// UI helpers
import { showLoadingOverlay, updateLoadingProgress, hideLoadingOverlay } from './ui/loading-overlay.js';
import {
  showMobileLoadingBar,
  updateMobileLoadingProgress,
  hideMobileLoadingBar,
  populateMobileUI,
  showMobileLandingPage,
  showDesktopDashboard,
  forceHideDesktopUI
} from './ui/mobile-helpers.js';

// Initialization helpers
import {
  waitForAuthentication,
  ensureServicesReady,
  processQueuedRefreshTokens,
  initializePhotosSettingsManager
} from './core/init-helpers.js';

// Photos QR code modal
import { showQRCodeModal } from '../widgets/photos/photos-modal-overlays.js';

// ============================================
// GLOBAL STATE
// ============================================

// Initialization state tracker
const initState = {
  auth: 'pending',
  jwt: 'pending',
  tokens: 'pending',
  settings: 'pending',
  widgets: 'pending',
  servicesReady: 'pending'
};

// Global instances
let widgetCoordinator = null;
let platformDetector = null;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get current upload URL based on environment
 */
function getCurrentUploadUrl() {
  const hostname = window.location.hostname;
  const isDev = hostname.includes('dev') || hostname === 'localhost' || hostname.startsWith('localhost');
  const baseUrl = isDev ? 'https://dev.dashieapp.com' : 'https://dashieapp.com';
  return `${baseUrl}#photos`;
}

/**
 * Focus photos widget and trigger upload modal
 */
function focusPhotosWidgetAndOpenUpload() {
  console.log('📸 QR upload: Attempting to focus photos widget and open upload');
  
  // Find the photos widget iframe
  const photosWidget = document.querySelector('iframe[src*="photos.html"]');
  
  if (!photosWidget) {
    console.warn('📸 Photos widget iframe not found');
    return;
  }
  
  // Send select command to photos widget to trigger upload
  try {
    photosWidget.contentWindow.postMessage({ action: 'select' }, '*');
    console.log('📸 Sent select command to photos widget to trigger upload');
  } catch (error) {
    console.error('📸 Failed to send select command to photos widget', error);
  }
}

/**
 * Update progress for both mobile and desktop
 */
function updateProgress(isMobile, percent, mobileMsg, desktopMsg) {
  if (isMobile) {
    updateMobileLoadingProgress(percent, mobileMsg);
  } else {
    updateLoadingProgress(percent, desktopMsg);
  }
}

// ============================================
// MAIN INITIALIZATION
// ============================================

/**
 * Main initialization sequence
 */
async function initializeApp() {
  console.log('🚀 Starting Dashie initialization sequence...');
  window.dashieStartTime = Date.now();

  // STEP 1: Check for hash fragment VERY EARLY (before auth)
  if (window.location.hash === '#photos') {
    console.log('📸 Photos hash detected - storing pending upload flag');
    sessionStorage.setItem('pendingPhotoUpload', 'true');
    // Clean hash immediately so it doesn't show in address bar
    window.history.replaceState({}, '', window.location.pathname);
  }
  
  // Detect platform first
  platformDetector = getPlatformDetector();
  const isMobile = platformDetector.isMobile();
  
  console.log('📱 Platform detection:', {
    platform: platformDetector.platform,
    deviceType: platformDetector.deviceType,
    isMobile: isMobile
  });
  
  // STEP 2: Store platform config for use by modals
  window.dashiePlatformConfig = {
    isTV: platformDetector.isTV(),
    platform: platformDetector.platform,
    uploadUrl: getCurrentUploadUrl()
  };
  
  try {
    localStorage.setItem('dashie-platform-config', JSON.stringify(window.dashiePlatformConfig));
    console.log('📱 Stored platform config:', window.dashiePlatformConfig);
  } catch (error) {
    console.warn('⚠️ Could not store platform config to localStorage:', error);
  }
  
  // CRITICAL: Create widget coordinator FIRST so it listens to postMessages
  widgetCoordinator = new WidgetRegistrationCoordinator();
  
  // Initialize events and navigation
  initializeEvents();
  initializeHighlightTimeout();
  
  // Render UI based on platform
  if (isMobile) {
    console.log('📱 Mobile device detected - showing landing page');
    showMobileLandingPage();
  } else {
    console.log('🖥️ Desktop/TV detected - rendering dashboard');
    showDesktopDashboard();
    renderGrid();
    renderSidebar();
    updateFocus(0, 0);
  }
  
  console.log('✅ UI rendered, waiting for authentication...');
  
  // ============================================
  // AUTHENTICATION PHASE
  // ============================================
  
  const authSuccessful = await waitForAuthentication();
  
  if (!authSuccessful) {
    console.error('❌ Authentication failed unexpectedly');
    return;
  }
  
  initState.auth = 'ready';
  
  // Show loading AFTER authentication completes
  if (isMobile) {
    showMobileLoadingBar();
    updateMobileLoadingProgress(10, 'Authentication complete');
  } else {
    showLoadingOverlay();
    updateLoadingProgress(10, 'Authentication complete');
  }
  
  // ============================================
  // JWT & SERVICES INITIALIZATION
  // ============================================
  
  console.log('🔐 Initializing JWT service after authentication...');
  updateProgress(isMobile, 25, 'Connecting...', 'Establishing secure connection...');
  
  try {
    const jwtReady = await initializeJWTService();
    
    if (jwtReady) {
      console.log('✅ JWT service ready - RLS mode available');
      initState.jwt = 'ready';
      updateProgress(isMobile, 40, 'Connected', 'Secure connection established');
      
      // Initialize SimpleAuth services now that JWT is ready
      if (window.dashieAuth && window.dashieAuth.authenticated) {
        console.log('🔧 Initializing services now that JWT is ready...');
        updateProgress(isMobile, 45, 'Initializing...', 'Initializing services...');
        
        try {
          await window.dashieAuth.initializeServices();
          console.log('✅ Services initialized with valid JWT token');
          updateProgress(isMobile, 50, 'Ready', 'Services ready');
        } catch (error) {
          console.error('❌ Failed to initialize services:', error);
          initState.servicesReady = 'failed';
          updateProgress(isMobile, 50, 'Setup failed', 'Service initialization failed');
          
          updateProgress(isMobile, 100, 'Failed - please refresh', 'Initialization failed - please refresh');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          if (isMobile) {
            hideMobileLoadingBar();
          } else {
            hideLoadingOverlay();
          }
          return;
        }
      }
    } else {
      console.warn('⚠️ JWT service not ready - will use direct mode');
      initState.jwt = 'failed';
      updateProgress(isMobile, 40, 'Connection unavailable', 'Secure connection unavailable');
    }
  } catch (error) {
    console.error('❌ JWT service initialization failed:', error);
    initState.jwt = 'failed';
    updateProgress(isMobile, 40, 'Connection failed', 'Secure connection failed');
  }
  
  // ============================================
  // TOKEN PROCESSING
  // ============================================
  
  updateProgress(isMobile, 52, 'Processing...', 'Processing tokens...');
  
  if (initState.jwt === 'ready') {
    updateProgress(isMobile, 55, 'Processing tokens...', 'Processing refresh tokens...');
    const tokenResult = await processQueuedRefreshTokens();
    
    if (tokenResult.success) {
      initState.tokens = 'ready';
      updateProgress(isMobile, 60, 'Tokens stored', 'Refresh tokens stored successfully');
    } else if (tokenResult.skipped) {
      initState.tokens = 'skipped';
      updateProgress(isMobile, 60, 'No tokens', 'No refresh tokens to process');
    } else {
      initState.tokens = 'failed';
      updateProgress(isMobile, 60, 'Token processing failed', 'Refresh token processing failed');
    }
  } else {
    console.log('⏭️ Skipping refresh token processing (JWT not ready)');
    initState.tokens = 'skipped';
    updateProgress(isMobile, 60, 'Skipping tokens', 'Skipping token processing');
  }
  
  // ============================================
  // SETTINGS & THEME
  // ============================================
  
  console.log(`⚙️ Initializing settings system with JWT status: ${initState.jwt}`);
  updateProgress(isMobile, 65, 'Loading settings...', 'Loading your settings...');
  
  try {
    await autoInitialize(initState.jwt);
    console.log('✅ Settings system ready');
    initState.settings = 'ready';
    updateProgress(isMobile, 75, 'Settings loaded', 'Settings loaded successfully');
  } catch (error) {
    console.error('❌ Settings system failed:', error);
    initState.settings = 'degraded';
    updateProgress(isMobile, 75, 'Settings degraded', 'Settings degraded');
  }
  
  console.log('🎨 Initializing theme system...');
  updateProgress(isMobile, 80, 'Applying theme...', 'Applying your theme...');
  
  // ============================================
  // PLATFORM-SPECIFIC COMPLETION
  // ============================================
  
  if (isMobile) {
    await completeMobileInit();
  } else {
    await completeDesktopInit();
  }
  
  // ============================================
  // VERSION BADGE (DEV ONLY)
  // ============================================
  
  const isDev = window.location.hostname.includes('dev.') || window.location.hostname.includes('localhost');
  if (isDev && window.APP_VERSION) {
    const badge = document.createElement('div');
    badge.className = 'version-badge';
    badge.style.display = 'block';
    badge.textContent = `v${window.APP_VERSION.version}.${window.APP_VERSION.build}`;
    badge.title = window.APP_VERSION.description;
    document.body.appendChild(badge);
  }
  
  // ============================================
  // FINALIZATION
  // ============================================
  
  console.log('🎯 Dashie initialization complete:', {
    auth: initState.auth,
    jwt: initState.jwt,
    tokens: initState.tokens,
    settings: initState.settings,
    servicesReady: initState.servicesReady,
    widgets: initState.widgets,
    platform: isMobile ? 'mobile' : 'desktop/tv'
  });
}

// ============================================
// PLATFORM-SPECIFIC COMPLETION FUNCTIONS
// ============================================

/**
 * Complete mobile initialization
 */
async function completeMobileInit() {
  console.log('📱 Mobile: Populating mobile UI');
  
  populateMobileUI();
  updateMobileLoadingProgress(100, 'Ready!');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  hideMobileLoadingBar();
  initState.widgets = 'skipped';
  
  // Mark as authenticated
  document.body.classList.add('authenticated');
  
  // IMPORTANT: Force hide desktop UI again after authenticated class is added
  forceHideDesktopUI();
  
  console.log('📸 Mobile: Initializing photos settings manager...');
  const uploadManagerReady = await initializePhotosSettingsManager();
  
  console.log('📱 Mobile initialization complete');
}

/**
 * Complete desktop/TV initialization
 */
async function completeDesktopInit() {
  console.log('🖥️ Waiting for widgets to register...');
  updateLoadingProgress(85, 'Preparing widgets...');
  
  const widgetResults = await widgetCoordinator.waitForWidgets(null, {
    timeout: 10000,
    minWaitTime: 500
  });
  
  if (widgetResults.success) {
    console.log('✅ All required widgets registered', {
      widgets: widgetResults.registered,
      duration: widgetResults.duration
    });
  } else {
    console.warn('⚠️ Some widgets did not register in time', {
      registered: widgetResults.registered,
      timedOut: widgetResults.timedOut,
      duration: widgetResults.duration
    });
  }
  
  // Validate all services are ready before data loading
  updateLoadingProgress(90, 'Validating services...');
  console.log('🔍 Ensuring all services ready before data load...');
  
  const servicesReady = await ensureServicesReady();
  
  if (!servicesReady) {
    console.error('❌ Service readiness validation failed - cannot proceed with data loading');
    initState.servicesReady = 'failed';
    updateLoadingProgress(100, 'Initialization incomplete - some features may not work');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    hideLoadingOverlay();
    
    document.body.classList.add('authenticated');
    console.log('⚠️ App started in degraded mode');
    return;
  }
  
  initState.servicesReady = 'ready';
  
  // Services are ready - proceed with data loading
  updateLoadingProgress(92, 'Loading your data...');
  console.log('📊 All services validated - triggering data loading...');
  
  try {
    await window.dashieAuth.triggerDataLoading();
    console.log('✅ Data loading completed successfully');
  } catch (error) {
    console.error('❌ Data loading failed:', error);
  }
  
  // Initialize Photo Upload Manager
  const uploadManagerReady = await initializePhotosSettingsManager();
  
  if (!uploadManagerReady) {
    console.warn('⚠️ Photo upload functionality may not be available yet');
  }
  
// Initialize sleep timer (checks every minute for auto-sleep/wake)
  console.log('😴 Initializing sleep timer...');
  try {
    initializeSleepTimer();
    console.log('✅ Sleep timer initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize sleep timer:', error);
  }

  // Complete initialization
  const loadingMessage = initState.tokens === 'ready' 
    ? 'Welcome to Dashie! (Long-term access enabled)'
    : 'Welcome to Dashie!';
    
  updateLoadingProgress(100, loadingMessage);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  hideLoadingOverlay();
  
  initState.widgets = 'ready';
  
  // Mark app as authenticated for CSS styling
  document.body.classList.add('authenticated');
  console.log('🔐 App marked as authenticated');
  
  // STEP 3: Check for pending photo upload after everything is ready
  if (sessionStorage.getItem('pendingPhotoUpload') === 'true') {
    console.log('📸 QR upload: Pending upload detected, triggering photo upload...');
    sessionStorage.removeItem('pendingPhotoUpload');
    
    // Wait a bit for widgets to fully settle
    setTimeout(() => {
      focusPhotosWidgetAndOpenUpload();
    }, 1000);
  }
}

// ============================================
// GLOBAL EVENT LISTENERS
// ============================================

window.addEventListener('message', (event) => {
  if (event.data?.type === 'request-upload-modal') {
    console.log('📸 Photos settings modal requested by widget:', event.data.widget);
    
    if (window.photosSettingsManager) {
      window.photosSettingsManager.open();
    } else {
      console.error('❌ Photos settings manager not initialized');
    }
  }
  
  // Handle empty state click - check if TV and show QR directly, otherwise open settings
  if (event.data?.type === 'open-photos-settings-and-upload') {
    console.log('📸 Empty photos widget clicked');
    
    // Check if TV platform
    if (window.dashiePlatformConfig?.isTV) {
      // TV: Show QR modal directly, skip settings
      console.log('📸 Fire TV detected - showing QR modal directly');
      const uploadUrl = window.dashiePlatformConfig.uploadUrl || 'https://dashieapp.com#photos';
      showQRCodeModal(uploadUrl);
    } else {
      // Desktop/Mobile: Open settings and trigger file picker
      console.log('📸 Desktop/Mobile - opening settings and triggering upload');
      
      if (window.photosSettingsManager) {
        window.photosSettingsManager.open().then(() => {
          // Wait for modal to be ready, then trigger file picker
          setTimeout(() => {
            const iframe = window.photosSettingsManager.modalIframe;
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage({
                type: 'trigger-file-picker'
              }, '*');
              console.log('✓ Sent file picker trigger to photos modal');
            }
          }, 500);
        });
      } else {
        console.error('❌ Photos settings manager not initialized');
      }
    }
  }
});

// ============================================
// INITIALIZE WHEN DOM READY
// ============================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}