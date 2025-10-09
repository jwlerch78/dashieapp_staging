// js/core/init-helpers.js
// CHANGE SUMMARY: Extracted initialization helper functions from main.js for better organization

import { createLogger } from '../utils/logger.js';
import { processPendingRefreshTokens } from '../apis/api-auth/providers/web-oauth.js';
import { PhotosSettingsManager } from '../../widgets/photos/photos-settings-manager.js';
import { updateLoadingProgress } from '../ui/loading-overlay.js';
import { syncCalendarMetadataForNewAccounts } from '../utils/calendar-sync-helper.js';

const logger = createLogger('InitHelpers');

/**
 * Wait for authentication to complete before proceeding
 * FIXED: No timeout - device flow can take minutes to complete
 * Does NOT show loading overlay - that happens after auth completes
 * @returns {Promise<boolean>} True if authentication successful
 */
export async function waitForAuthentication() {
  const checkInterval = 500; // Check every 500ms
  let elapsedSeconds = 0;
  
  logger.info('Waiting for authentication to complete...');

  while (true) {
    const authSystem = window.dashieAuth || window.authManager;
    
    if (authSystem && authSystem.isAuthenticated && authSystem.isAuthenticated()) {
      const hasGoogleToken = authSystem.getGoogleAccessToken && authSystem.getGoogleAccessToken();
      
      if (hasGoogleToken) {
        logger.success('Authentication complete with Google token');
        return true;
      }
    }
    
    // Log progress every 60 seconds (no UI update - device flow has its own UI)
    if (elapsedSeconds % 60 === 0 && elapsedSeconds > 0) {
      const minutes = Math.floor(elapsedSeconds / 60);
      const timeStr = minutes > 1 ? `${minutes} minutes` : `${minutes} minute`;
      logger.info(`Still waiting for authentication (${timeStr} elapsed)...`);
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    elapsedSeconds += checkInterval / 1000;
  }
}

/**
 * Comprehensive service readiness validation
 * Ensures all dependencies are ready before attempting data load
 * @returns {Promise<boolean>} True if all services ready, false otherwise
 */
export async function ensureServicesReady() {
  logger.info('Validating service readiness before data load...');
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
      logger.error('Auth system not authenticated');
      return false;
    }
    checks.auth = true;
    logger.debug('Auth system ready');
    
    // Check 2: JWT service ready (with wait)
    if (!window.jwtAuth || !window.jwtAuth.isServiceReady()) {
      logger.warn('JWT service not immediately ready, waiting up to 10 seconds...');
      
      const startTime = Date.now();
      const timeout = 10000; // 10 seconds
      
      while (Date.now() - startTime < timeout) {
        if (window.jwtAuth?.isServiceReady()) {
          logger.success('JWT service became ready');
          checks.jwt = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (!checks.jwt) {
        logger.error('JWT service failed to become ready after 10 seconds');
        return false;
      }
    } else {
      checks.jwt = true;
      logger.debug('JWT service ready');
    }
    
    // Check 3: Valid token available
    logger.debug('Validating token availability...');
    try {
      const tokenResult = await window.jwtAuth.getValidToken('google', 'primary');
      
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
      logger.success('Valid token confirmed', {
        tokenEnding: tokenResult.access_token.slice(-10),
        refreshed: tokenResult.refreshed
      });
      
    } catch (error) {
      logger.error('Token validation failed:', error.message);
      return false;
    }
    
    // Check 4: DataManager initialized
    if (!window.dataManager) {
      logger.error('DataManager not initialized');
      return false;
    }
    checks.dataManager = true;
    logger.debug('DataManager ready');
    
    // All checks passed
    logger.success('All service readiness checks passed:', checks);
    return true;
    
  } catch (error) {
    logger.error('Service readiness validation failed:', error);
    return false;
  }
}

/**
 * Process queued refresh tokens with proper error handling
 * @returns {Promise<{success: boolean, tokensProcessed: number, skipped?: boolean}>}
 */
export async function processQueuedRefreshTokens() {
  logger.info('Processing queued refresh tokens...');
  
  try {
    if (!window.pendingRefreshTokens || window.pendingRefreshTokens.length === 0) {
      logger.debug('No pending refresh tokens to process');
      return { success: false, tokensProcessed: 0, skipped: true };
    }
    
    const results = await processPendingRefreshTokens();
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    if (successful > 0) {
      logger.success(`Processed ${successful} refresh token(s) successfully`);
      return { success: true, tokensProcessed: successful };
    } else if (failed > 0) {
      logger.error(`Failed to process ${failed} refresh token(s)`);
      return { success: false, tokensProcessed: 0 };
    }
    
    return { success: false, tokensProcessed: 0, skipped: true };
    
  } catch (error) {
    logger.error('Refresh token processing error:', error);
    return { success: false, tokensProcessed: 0 };
  }
}

/**
 * Sync calendar metadata for newly added accounts
 * Should be called AFTER services are initialized (when GoogleAPI exists)
 * @returns {Promise<boolean>} True if sync was successful or not needed
 */
export async function syncCalendarMetadataIfNeeded() {
  logger.info('Checking if calendar metadata sync is needed...');
  
  try {
    // Check if there were any new tokens processed
    if (!window.pendingRefreshTokens || window.pendingRefreshTokens.length === 0) {
      logger.debug('No new tokens were processed, skipping calendar sync');
      return true;
    }
    
    // NEW: Sync calendar metadata for newly added accounts
    logger.info('New account detected, syncing calendar metadata...');
    await syncCalendarMetadataForNewAccounts();
    logger.success('Calendar metadata synced for new accounts');
    
    // Clear the pending tokens now that they've been processed
    window.pendingRefreshTokens = [];
    
    return true;
    
  } catch (error) {
    logger.error('Failed to sync calendar metadata', error);
    // Don't throw - app should continue even if calendar sync fails
    return false;
  }
}

/**
 * Initialize Photo Settings Manager with retry logic
 * Called after data manager is ready, with retry if photo service not yet initialized
 * ALWAYS creates window.photosSettingsManager instance to prevent "not available" errors
 * @returns {Promise<boolean>} True if initialized successfully
 */
export async function initializePhotosSettingsManager() {
  const maxRetries = 5;
  const retryDelay = 1000; // 1 second
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (window.dataManager?.photoService?.isReady()) {
        // Photo service is ready - initialize normally
        const photosSettingsManager = new PhotosSettingsManager(window.dataManager.photoService);
        window.photosSettingsManager = photosSettingsManager;
        logger.success('Photos settings manager initialized with ready service', {
          attempt
        });
        return true;
      } else {
        logger.debug(`Photo service not ready yet (attempt ${attempt}/${maxRetries}), waiting...`);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    } catch (error) {
      logger.error('Failed to initialize photos settings manager:', error);
      if (attempt === maxRetries) {
        break; // Exit loop to create fallback instance
      }
    }
  }
  
  // After all retries, create instance anyway so it exists even if service isn't ready
  // This prevents "PhotosSettingsManager not available" errors
  // The manager will handle "not ready" state internally when opened
  logger.warn('Photo service not ready after retries - creating PhotosSettingsManager anyway');
  
  try {
    const photosSettingsManager = new PhotosSettingsManager(window.dataManager?.photoService || null);
    window.photosSettingsManager = photosSettingsManager;
    logger.info('Photos settings manager created in fallback mode (service may initialize later)');
    return true; // Return true because manager exists, even if service isn't ready
  } catch (error) {
    logger.error('Failed to create fallback PhotosSettingsManager:', error);
    return false;
  }
}