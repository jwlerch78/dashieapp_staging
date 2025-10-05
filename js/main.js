// js/main.js
// CHANGE SUMMARY: Added mobile inline loading bar functions and family name change listener for live updates

import { initializeEvents } from './core/events.js';
import { updateFocus, initializeHighlightTimeout } from './core/navigation.js';
import { renderGrid, renderSidebar } from './ui/grid.js';
import { autoInitialize } from './settings/settings-main.js';
import { initializeJWTService } from './apis/api-auth/jwt-token-operations.js';
import { processPendingRefreshTokens } from './apis/api-auth/providers/web-oauth.js';
import { PhotosSettingsManager } from '../widgets/photos/photos-settings-manager.js';
import { showLoadingOverlay, updateLoadingProgress, hideLoadingOverlay, isLoadingOverlayVisible } from './ui/loading-overlay.js';
import { WidgetRegistrationCoordinator } from './core/widget-registration-coordinator.js';
import { getPlatformDetector } from './utils/platform-detector.js';
import { showSettings } from './settings/settings-main.js';

// Initialization state tracker
const initState = {
  auth: 'pending',
  jwt: 'pending',
  tokens: 'pending',
  settings: 'pending',
  widgets: 'pending',
  servicesReady: 'pending'
};

// Global photo settings manager instance
let photosSettingsManager = null;

// Widget registration coordinator - created at start so it listens to direct postMessages
let widgetCoordinator = null;

// Platform detector instance
let platformDetector = null;

/**
 * NEW: Show mobile loading bar
 */
function showMobileLoadingBar() {
  const loadingBar = document.getElementById('mobile-loading-bar');
  if (loadingBar) {
    loadingBar.classList.add('active');
  }
}

/**
 * NEW: Update mobile loading progress
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} message - Status message
 */
function updateMobileLoadingProgress(progress, message) {
  const progressFill = document.getElementById('mobile-progress-fill');
  const progressText = document.getElementById('mobile-progress-text');
  
  if (progressFill) {
    progressFill.style.width = `${progress}%`;
  }
  
  if (progressText) {
    progressText.textContent = message;
  }
}

/**
 * NEW: Hide mobile loading bar and enable Settings button
 */
function hideMobileLoadingBar() {
  const loadingBar = document.getElementById('mobile-loading-bar');
  const settingsBtn = document.getElementById('mobile-settings-btn');
  
  if (loadingBar) {
    loadingBar.classList.remove('active');
  }
  
  if (settingsBtn) {
    settingsBtn.disabled = false;
  }
}

/**
 * Wait for authentication to complete before proceeding
 * FIXED: No timeout - device flow can take minutes to complete
 * Does NOT show loading overlay - that happens after auth completes
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
    
    // Log progress every 60 seconds (no UI update - device flow has its own UI)
    if (elapsedSeconds % 60 === 0 && elapsedSeconds > 0) {
      const minutes = Math.floor(elapsedSeconds / 60);
      const timeStr = minutes > 1 ? `${minutes} minutes` : `${minutes} minute`;
      console.log(`⏳ Still waiting for authentication (${timeStr} elapsed)...`);
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    elapsedSeconds += checkInterval / 1000;
  }
}

/**
 * NEW: Comprehensive service readiness validation
 * Ensures all dependencies are ready before attempting data load
 * @returns {Promise<boolean>} True if all services ready, false otherwise
 */
async function ensureServicesReady() {
  console.log('🔍 Validating service readiness before data load...');
  updateLoadingProgress(90, 'Validating services...');
  
  const checks = {
    auth: false,
    jwt: false,
    token: false,
    dataManager: false
  };
  
  try {
    // Check 1: Auth system ready
    const authSystem = window.dashieAuth || window.authManager;
    if (!authSystem || !authSystem.isAuthenticated()) {
      console.error('❌ Auth system not authenticated');
      return false;
    }
    checks.auth = true;
    console.log('✅ Auth system ready');
    
    // Check 2: JWT service ready (with wait)
    if (!window.jwtAuth || !window.jwtAuth.isServiceReady()) {
      console.warn('⚠️ JWT service not immediately ready, waiting up to 10 seconds...');
      
      const startTime = Date.now();
      const timeout = 10000; // 10 seconds
      
      while (Date.now() - startTime < timeout) {
        if (window.jwtAuth?.isServiceReady()) {
          console.log('✅ JWT service became ready');
          checks.jwt = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (!checks.jwt) {
        console.error('❌ JWT service failed to become ready after 10 seconds');
        initState.servicesReady = 'failed';
        return false;
      }
    } else {
      checks.jwt = true;
      console.log('✅ JWT service ready');
    }
    
    // Check 3: Valid token available
    console.log('🔑 Validating token availability...');
    try {
      const tokenResult = await window.jwtAuth.getValidToken('google', 'personal');
      
      if (!tokenResult) {
        throw new Error('JWT service returned null/undefined');
      }
      
      if (!tokenResult.success) {
        throw new Error(`JWT service reported failure: ${tokenResult.error || 'Unknown error'}`);
      }
      
      if (!tokenResult.access_token) {
        throw new Error('No access_token in successful response');
      }
      
      checks.token = true;
      console.log('✅ Valid token confirmed', {
        tokenEnding: tokenResult.access_token.slice(-10),
        refreshed: tokenResult.refreshed
      });
      
    } catch (error) {
      console.error('❌ Token validation failed:', error.message);
      initState.servicesReady = 'failed';
      return false;
    }
    
    // Check 4: DataManager initialized
    if (!window.dataManager) {
      console.error('❌ DataManager not initialized');
      initState.servicesReady = 'failed';
      return false;
    }
    checks.dataManager = true;
    console.log('✅ DataManager ready');
    
    // All checks passed
    console.log('🎯 All service readiness checks passed:', checks);
    initState.servicesReady = 'ready';
    return true;
    
  } catch (error) {
    console.error('❌ Service readiness validation failed:', error);
    initState.servicesReady = 'failed';
    return false;
  }
}

/**
 * Process queued refresh tokens with proper error handling
 */
async function processQueuedRefreshTokens() {
  console.log('🔄 Processing queued refresh tokens...');
  
  try {
    if (!window.pendingRefreshTokens || window.pendingRefreshTokens.length === 0) {
      console.log('⏭️ No pending refresh tokens to process');
      initState.tokens = 'skipped';
      return false;
    }
    
    const results = await processPendingRefreshTokens();
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    if (successful > 0) {
      console.log(`✅ Processed ${successful} refresh token(s) successfully`);
      initState.tokens = 'ready';
      return true;
    } else if (failed > 0) {
      console.error(`❌ Failed to process ${failed} refresh token(s)`);
      initState.tokens = 'failed';
      return false;
    }
    
    initState.tokens = 'skipped';
    return false;
    
  } catch (error) {
    console.error('❌ Refresh token processing error:', error);
    initState.tokens = 'failed';
    return false;
  }
}

// CHANGE SUMMARY: Fixed initializePhotosSettingsManager to always create window.photosSettingsManager even when photoService isn't ready yet

/**
 * Initialize Photo Settings Manager with retry logic
 * Called after data manager is ready, with retry if photo service not yet initialized
 * ALWAYS creates window.photosSettingsManager instance to prevent "not available" errors
 */
async function initializePhotosSettingsManager() {
  const maxRetries = 5;
  const retryDelay = 1000; // 1 second
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (window.dataManager?.photoService?.isReady()) {
        // Photo service is ready - initialize normally
        photosSettingsManager = new PhotosSettingsManager(window.dataManager.photoService);
        window.photosSettingsManager = photosSettingsManager;
        console.log('📸 Photos settings manager initialized with ready service', {
          attempt
        });
        return true;
      } else {
        console.log(`⏳ Photo service not ready yet (attempt ${attempt}/${maxRetries}), waiting...`);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    } catch (error) {
      console.error('❌ Failed to initialize photos settings manager:', error);
      if (attempt === maxRetries) {
        break; // Exit loop to create fallback instance
      }
    }
  }
  
  // After all retries, create instance anyway so it exists even if service isn't ready
  // This prevents "PhotosSettingsManager not available" errors
  // The manager will handle "not ready" state internally when opened
  console.warn('⚠️ Photo service not ready after retries - creating PhotosSettingsManager anyway');
  
  try {
    photosSettingsManager = new PhotosSettingsManager(window.dataManager?.photoService || null);
    window.photosSettingsManager = photosSettingsManager;
    console.log('📸 Photos settings manager created in fallback mode (service may initialize later)');
    return true; // Return true because manager exists, even if service isn't ready
  } catch (error) {
    console.error('❌ Failed to create fallback PhotosSettingsManager:', error);
    return false;
  }
}

/**
 * Show mobile landing page
 */
function showMobileLandingPage() {
  console.log('📱 Showing mobile landing page');
  
  const mobileContainer = document.getElementById('mobile-container');
  const app = document.getElementById('app');
  
  if (mobileContainer && app) {
    // Add class to body for CSS targeting
    document.body.classList.add('mobile-mode-active');
    
    // Force hide desktop app
    app.style.display = 'none';
    app.style.visibility = 'hidden';
    
    // Show mobile container
    mobileContainer.style.display = 'flex';
    mobileContainer.style.visibility = 'visible';
    
    console.log('📱 Mobile landing page visible, desktop hidden');
  }
}

/**
 * Show desktop/TV dashboard
 */
function showDesktopDashboard() {
  console.log('🖥️ Showing desktop/TV dashboard');
  
  const mobileContainer = document.getElementById('mobile-container');
  const app = document.getElementById('app');
  
  if (mobileContainer && app) {
    mobileContainer.style.display = 'none';
    app.style.display = 'flex';
    
    console.log('🖥️ Desktop/TV dashboard visible');
  }
}

/**
 * NEW: Update mobile header family name
 * @param {string} familyName - The family name to display
 */
function updateMobileFamilyName(familyName) {
  const familyNameEl = document.querySelector('.mobile-header .family-name');
  if (familyNameEl) {
    familyNameEl.textContent = familyName || 'Dashie';
    console.log('📱 Updated mobile header family name:', familyName);
  }
}

/**
 * Populate mobile UI with user data
 * UPDATED: Now also sets up family name change listener
 */
async function populateMobileUI() {
  console.log('📱 Populating mobile UI');
  
  // Wait longer for settings to be fully ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Get family name from settings
  let familyName = 'Dashie'; // Default
  
  try {
    // Try multiple sources for family name
    if (window.settingsInstance?.controller) {
      familyName = window.settingsInstance.controller.getSetting('family.familyName') || 'Dashie';
      console.log('📱 Got family name from settings controller:', familyName);
    } else {
      // Fallback to localStorage
      const savedSettings = localStorage.getItem('dashie-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        familyName = settings?.family?.familyName || 'Dashie';
        console.log('📱 Got family name from localStorage:', familyName);
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not get family name from settings:', error);
  }
  
  // Set initial family name
  updateMobileFamilyName(familyName);
  
  // NEW: Listen for family name changes from settings
  window.addEventListener('dashie-mobile-family-name-changed', (event) => {
    const newFamilyName = event.detail?.familyName;
    if (newFamilyName) {
      updateMobileFamilyName(newFamilyName);
    }
  });
  console.log('📱 Family name change listener registered');
  
  // Get user profile picture
  const user = window.dashieAuth?.getUser();
  if (user?.picture || user?.photoURL) {
    const profilePic = document.querySelector('.mobile-header .profile-pic');
    if (profilePic) {
      profilePic.src = user.picture || user.photoURL;
      profilePic.style.display = 'block';
      console.log('📱 Set profile picture');
    }
  } else {
    console.log('📱 No profile picture available');
  }
  
  // Wire up Settings button
  const settingsBtn = document.getElementById('mobile-settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      console.log('📱 Settings button clicked');
      showSettings();
    });
    console.log('📱 Settings button wired up');
  }
}

/**
 * Main initialization sequence
 */
async function initializeApp() {
  console.log('🚀 Starting Dashie initialization sequence...');
  
  // Detect platform first
  platformDetector = getPlatformDetector();
  const isMobile = platformDetector.isMobile();
  
  console.log('📱 Platform detection:', {
    platform: platformDetector.platform,
    deviceType: platformDetector.deviceType,
    isMobile: isMobile
  });
  
  // CRITICAL: Create widget coordinator FIRST so it listens to postMessages
  widgetCoordinator = new WidgetRegistrationCoordinator();
  
  // Initialize events and navigation
  initializeEvents();
  initializeHighlightTimeout();
  
  if (isMobile) {
    // Mobile: Show landing page only
    console.log('📱 Mobile device detected - showing landing page');
    showMobileLandingPage();
  } else {
    // Desktop/TV: Render full dashboard (existing behavior)
    console.log('🖥️ Desktop/TV detected - rendering dashboard');
    showDesktopDashboard();
    renderGrid();
    renderSidebar();
    updateFocus(0, 0);
  }
  
  console.log('✅ UI rendered, waiting for authentication...');
  
  // Wait for authentication without timeout (device flow needs time)
  const authSuccessful = await waitForAuthentication();
  
  if (!authSuccessful) {
    console.error('❌ Authentication failed unexpectedly');
    return;
  }
  
  // Show loading AFTER authentication completes
  if (isMobile) {
    // Mobile: Show inline loading bar
    showMobileLoadingBar();
    updateMobileLoadingProgress(10, 'Authentication complete');
  } else {
    // Desktop/TV: Show overlay
    showLoadingOverlay();
    updateLoadingProgress(10, 'Authentication complete');
  }
  
  // Initialize JWT service
  console.log('🔐 Initializing JWT service after authentication...');
  if (isMobile) {
    updateMobileLoadingProgress(25, 'Connecting...');
  } else {
    updateLoadingProgress(25, 'Establishing secure connection...');
  }
  
  try {
    const jwtReady = await initializeJWTService();
    
    if (jwtReady) {
      console.log('✅ JWT service ready - RLS mode available');
      initState.jwt = 'ready';
      if (isMobile) {
        updateMobileLoadingProgress(40, 'Connected');
      } else {
        updateLoadingProgress(40, 'Secure connection established');
      }
      
      // Initialize SimpleAuth services now that JWT is ready
      if (window.dashieAuth && window.dashieAuth.authenticated) {
        console.log('🔧 Initializing services now that JWT is ready...');
        if (isMobile) {
          updateMobileLoadingProgress(45, 'Initializing...');
        } else {
          updateLoadingProgress(45, 'Initializing services...');
        }
        
        try {
          await window.dashieAuth.initializeServices();
          console.log('✅ Services initialized with valid JWT token');
          if (isMobile) {
            updateMobileLoadingProgress(50, 'Ready');
          } else {
            updateLoadingProgress(50, 'Services ready');
          }
        } catch (error) {
          console.error('❌ Failed to initialize services:', error);
          if (isMobile) {
            updateMobileLoadingProgress(50, 'Setup failed');
          } else {
            updateLoadingProgress(50, 'Service initialization failed');
          }
          initState.servicesReady = 'failed';
          
          if (isMobile) {
            updateMobileLoadingProgress(100, 'Failed - please refresh');
            await new Promise(resolve => setTimeout(resolve, 3000));
            hideMobileLoadingBar();
          } else {
            updateLoadingProgress(100, 'Initialization failed - please refresh');
            await new Promise(resolve => setTimeout(resolve, 3000));
            hideLoadingOverlay();
          }
          return;
        }
      }
    } else {
      console.warn('⚠️ JWT service not ready - will use direct mode');
      initState.jwt = 'failed';
      if (isMobile) {
        updateMobileLoadingProgress(40, 'Connection unavailable');
      } else {
        updateLoadingProgress(40, 'Secure connection unavailable');
      }
    }
  } catch (error) {
    console.error('❌ JWT service initialization failed:', error);
    initState.jwt = 'failed';
    if (isMobile) {
      updateMobileLoadingProgress(40, 'Connection failed');
    } else {
      updateLoadingProgress(40, 'Secure connection failed');
    }
  }
  
  // Process refresh tokens if JWT is ready
  if (isMobile) {
    updateMobileLoadingProgress(52, 'Processing...');
  } else {
    updateLoadingProgress(52, 'Processing tokens...');
  }
  
  if (initState.jwt === 'ready') {
    if (isMobile) {
      updateMobileLoadingProgress(55, 'Processing tokens...');
    } else {
      updateLoadingProgress(55, 'Processing refresh tokens...');
    }
    const tokensProcessed = await processQueuedRefreshTokens();
    
    if (tokensProcessed && initState.tokens === 'ready') {
      if (isMobile) {
        updateMobileLoadingProgress(60, 'Tokens stored');
      } else {
        updateLoadingProgress(60, 'Refresh tokens stored successfully');
      }
    } else if (initState.tokens === 'skipped') {
      if (isMobile) {
        updateMobileLoadingProgress(60, 'No tokens');
      } else {
        updateLoadingProgress(60, 'No refresh tokens to process');
      }
    } else {
      if (isMobile) {
        updateMobileLoadingProgress(60, 'Token processing failed');
      } else {
        updateLoadingProgress(60, 'Refresh token processing failed');
      }
    }
  } else {
    console.log('⏭️ Skipping refresh token processing (JWT not ready)');
    initState.tokens = 'skipped';
    if (isMobile) {
      updateMobileLoadingProgress(60, 'Skipping tokens');
    } else {
      updateLoadingProgress(60, 'Skipping token processing');
    }
  }
  
  // Initialize settings system
  console.log(`⚙️ Initializing settings system with JWT status: ${initState.jwt}`);
  if (isMobile) {
    updateMobileLoadingProgress(65, 'Loading settings...');
  } else {
    updateLoadingProgress(65, 'Loading your settings...');
  }
  
  try {
    await autoInitialize(initState.jwt);
    console.log('✅ Settings system ready');
    initState.settings = 'ready';
    if (isMobile) {
      updateMobileLoadingProgress(75, 'Settings loaded');
    } else {
      updateLoadingProgress(75, 'Settings loaded successfully');
    }
  } catch (error) {
    console.error('❌ Settings system failed:', error);
    initState.settings = 'degraded';
    if (isMobile) {
      updateMobileLoadingProgress(75, 'Settings degraded');
    } else {
      updateLoadingProgress(75, 'Settings degraded');
    }
  }
  
  // Initialize theme system
  console.log('🎨 Initializing theme system...');
  if (isMobile) {
    updateMobileLoadingProgress(80, 'Applying theme...');
  } else {
    updateLoadingProgress(80, 'Applying your theme...');
  }
  
  if (isMobile) {
    // Mobile: Populate mobile UI and skip widget/data initialization
    console.log('📱 Mobile: Populating mobile UI');
    populateMobileUI();
    updateMobileLoadingProgress(100, 'Ready!');
    await new Promise(resolve => setTimeout(resolve, 500));
    hideMobileLoadingBar();
    initState.widgets = 'skipped';
    
    // Mark as authenticated
    document.body.classList.add('authenticated');
    
    // IMPORTANT: Force hide desktop UI again after authenticated class is added
    const app = document.getElementById('app');
    const sidebar = document.getElementById('sidebar');
    const sidebarWrapper = document.getElementById('sidebar-wrapper');
    const grid = document.getElementById('grid');
    
    if (app) {
      app.style.display = 'none';
      app.style.visibility = 'hidden';
    }
    if (sidebar) {
      sidebar.style.display = 'none';
      sidebar.style.visibility = 'hidden';
    }
    if (sidebarWrapper) {
      sidebarWrapper.style.display = 'none';
      sidebarWrapper.style.visibility = 'hidden';
    }
    if (grid) {
      grid.style.display = 'none';
      grid.style.visibility = 'hidden';
    }

    console.log('📸 Mobile: Initializing photos settings manager...');
    const uploadManagerReady = await initializePhotosSettingsManager();

    
    console.log('📱 Mobile initialization complete');
  } else {
    // Desktop/TV: Full widget initialization
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
      updateLoadingProgress(100, 'Initialization incomplete - some features may not work');
      await new Promise(resolve => setTimeout(resolve, 3000));
      hideLoadingOverlay();
      
      document.body.classList.add('authenticated');
      console.log('⚠️ App started in degraded mode');
      return;
    }
    
    // Services are ready - proceed with data loading
    updateLoadingProgress(92, 'Loading your data...');
    console.log('📊 All services validated - triggering data loading...');
    
    try {
      await window.dashieAuth.triggerDataLoading();
      console.log('✅ Data loading completed successfully');
    } catch (error) {
      console.error('❌ Data loading failed:', error);
    }
    
    // Initialize Photo Upload Manager with retry logic
    const uploadManagerReady = await initializePhotosSettingsManager();
    
    if (!uploadManagerReady) {
      console.warn('⚠️ Photo upload functionality may not be available yet');
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
  }

const isDev = window.location.hostname.includes('dev.') || window.location.hostname.includes('localhost');
if (isDev && window.APP_VERSION) {
  const badge = document.createElement('div');
  badge.className = 'version-badge';
  badge.style.display = 'block';
  badge.textContent = `v${window.APP_VERSION.version}.${window.APP_VERSION.build}`;
  badge.title = window.APP_VERSION.description;
  document.body.appendChild(badge);
}

  
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

// Listen for upload modal requests from widgets
window.addEventListener('message', (event) => {
  if (event.data?.type === 'request-upload-modal') {
    console.log('📸 Photos settings modal requested by widget:', event.data.widget);
    
    if (photosSettingsManager) {
      photosSettingsManager.open();
    } else {
      console.error('❌ Photos settings manager not initialized');
    }
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}