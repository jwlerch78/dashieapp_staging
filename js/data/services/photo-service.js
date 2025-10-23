// js/data/services/photo-service.js
// Photo service for managing Supabase photo storage with automatic URL refresh
// Ported from .legacy/js/services/photo-data-service.js with refactoring

import { createLogger } from '../../utils/logger.js';
import { PhotoStorageService } from './photo-storage-service.js';

const logger = createLogger('PhotoService');

/**
 * PhotoService - Manages photo data with Supabase storage
 *
 * Features:
 * - Automatic signed URL refresh (50 minutes) to prevent expiration
 * - JWT client cache clearing to get fresh signed URLs
 * - Dual timer strategy (setInterval + setTimeout) for reliability
 * - Photo upload/delete operations
 * - Storage usage tracking
 * - Folder/album management
 *
 * Architecture:
 * - Uses PhotoStorageService for Supabase operations
 * - Broadcasts updates via CustomEvents for widget consumption
 * - Manages photo state and refresh timers
 */
export class PhotoService {
  constructor() {
    this.storage = null;
    this.currentPhotos = null;
    this.lastRefresh = null;
    this.userId = null;
    this.isInitialized = false;
    this.refreshInterval = null; // Primary timer (setInterval)
    this.refreshTimeout = null; // Backup timer (setTimeout)

    logger.verbose('PhotoService constructed');
  }

  // =========================================================================
  // INITIALIZATION
  // =========================================================================

  /**
   * Initialize service with authenticated user and JWT
   * @param {string} userId - Supabase user ID
   * @param {Object} jwtService - JWT authentication service
   * @returns {Promise<boolean>} Success status
   */
  async initialize(userId, jwtService) {
    if (!userId) {
      logger.warn('Cannot initialize photo service without userId');
      return false;
    }

    if (!jwtService || !jwtService.isReady) {
      logger.warn('Cannot initialize photo service without ready JWT service');
      return false;
    }

    try {
      this.userId = userId;
      this.storage = new PhotoStorageService(userId, jwtService);
      this.isInitialized = true;

      logger.success('Photo service initialized', { userId });
      return true;
    } catch (error) {
      logger.error('Failed to initialize photo service', error);
      return false;
    }
  }

  // =========================================================================
  // PHOTO LOADING
  // =========================================================================

  /**
   * Load photos from storage
   * CRITICAL: Clears JWT client cache to force fresh signed URLs
   *
   * @param {string|null} folder - Folder to load from, or null for all
   * @param {boolean} shuffle - Whether to shuffle photo order
   * @returns {Promise<Object>} Photo data object {urls, folder, count, lastUpdated}
   */
  async loadPhotos(folder = null, shuffle = true) {
    if (!this.isInitialized) {
      throw new Error('Photo service not initialized');
    }

    try {
      logger.debug('Loading photos', { folder, shuffle });

      // CRITICAL: Clear cached authenticated client to force fresh JWT
      // This ensures signed URLs are generated with a fresh JWT token
      // Without this, old signed URLs expire after ~1 hour
      if (this.storage.authenticatedClient) {
        logger.debug('🔄 Clearing cached authenticated client to get fresh JWT');
        this.storage.authenticatedClient = null;
      }

      // Fetch photos with fresh signed URLs
      const urls = await this.storage.getPhotoUrls(folder, shuffle);

      this.currentPhotos = {
        urls: urls,
        folder: folder,
        count: urls.length,
        lastUpdated: Date.now()
      };

      logger.success('Photos loaded', {
        count: urls.length,
        folder: folder || 'all',
        lastUpdated: new Date(this.currentPhotos.lastUpdated).toLocaleTimeString()
      });

      // Start periodic refresh timer to regenerate signed URLs before they expire
      this._startPeriodicRefresh();

      // Broadcast to listening components
      this._broadcastPhotoUpdate();

      return this.currentPhotos;

    } catch (error) {
      logger.error('Failed to load photos', error);
      throw error;
    }
  }

  /**
   * Get current photos data (without reloading)
   * @returns {Object|null} Current photo data
   */
  getCurrentPhotos() {
    return this.currentPhotos;
  }

  // =========================================================================
  // PERIODIC REFRESH (Auto-refresh signed URLs)
  // =========================================================================

  /**
   * Start periodic refresh timer to regenerate signed URLs with fresh JWTs
   * Signed URLs expire after 1 hour, so we refresh at 50 minutes
   * Uses both setInterval AND setTimeout as fallback for reliability
   * @private
   */
  _startPeriodicRefresh() {
    // Clear any existing timers
    this._stopPeriodicRefresh();

    // Refresh every 50 minutes (before 1-hour signed URL expiry)
    const REFRESH_INTERVAL = 50 * 60 * 1000; // 50 minutes in milliseconds

    logger.debug('🔄 Starting periodic photo refresh timer', {
      intervalMinutes: 50,
      nextRefreshAt: new Date(Date.now() + REFRESH_INTERVAL).toLocaleTimeString()
    });

    // Primary method: setInterval
    try {
      this.refreshInterval = setInterval(async () => {
        await this._performPeriodicRefresh();
      }, REFRESH_INTERVAL);

      logger.debug('✅ setInterval timer started');
    } catch (error) {
      logger.error('❌ Failed to start setInterval, will use setTimeout only', error);
    }

    // Backup method: setTimeout (chains itself for reliability)
    this._scheduleNextRefresh(REFRESH_INTERVAL);
  }

  /**
   * Schedule next refresh using setTimeout (self-chaining for reliability)
   * @private
   */
  _scheduleNextRefresh(delay) {
    this.refreshTimeout = setTimeout(async () => {
      await this._performPeriodicRefresh();
      // Chain to next timeout
      this._scheduleNextRefresh(delay);
    }, delay);

    logger.debug('✅ setTimeout backup scheduled');
  }

  /**
   * Perform the actual periodic refresh
   * Reloads photos with same folder to get fresh signed URLs
   * @private
   */
  async _performPeriodicRefresh() {
    try {
      logger.debug('🔄 Periodic photo URL refresh triggered', {
        lastUpdate: this.currentPhotos?.lastUpdated
          ? new Date(this.currentPhotos.lastUpdated).toLocaleTimeString()
          : 'never',
        minutesSinceLastUpdate: this.currentPhotos?.lastUpdated
          ? Math.round((Date.now() - this.currentPhotos.lastUpdated) / 1000 / 60)
          : 0
      });

      // Reload photos with same folder setting to get fresh signed URLs
      const folder = this.currentPhotos?.folder || null;
      await this.loadPhotos(folder, false); // Don't shuffle on refresh

      logger.success('✅ Photo URLs refreshed successfully', {
        photoCount: this.currentPhotos?.urls?.length || 0,
        newUpdateTime: new Date(this.currentPhotos.lastUpdated).toLocaleTimeString()
      });

    } catch (error) {
      logger.error('❌ Periodic photo refresh failed', error);
    }
  }

  /**
   * Stop the periodic refresh timer
   * @private
   */
  _stopPeriodicRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      logger.debug('setInterval timer stopped');
    }

    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
      logger.debug('setTimeout timer stopped');
    }
  }

  /**
   * Manually trigger a refresh (bypass timer)
   * @returns {Promise<Object>} Updated photo data
   */
  async triggerRefresh() {
    logger.info('Manual photo refresh triggered');
    const folder = this.currentPhotos?.folder || null;
    return await this.loadPhotos(folder, false);
  }

  // =========================================================================
  // PHOTO UPLOAD
  // =========================================================================

  /**
   * Upload photos with progress tracking
   *
   * @param {FileList|Array<File>} files - Files to upload
   * @param {string} folder - Destination folder
   * @param {Function} onProgress - Progress callback (optional)
   * @returns {Promise<Array>} Upload results
   */
  async uploadPhotos(files, folder = null, onProgress = null) {
    if (!this.isInitialized) {
      throw new Error('Photo service not initialized');
    }

    try {
      logger.info('Starting photo upload', {
        fileCount: files.length,
        folder
      });

      const results = await this.storage.uploadPhotos(files, folder, onProgress);

      const successCount = results.filter(r => r.success).length;
      logger.success('Upload complete', {
        total: results.length,
        successful: successCount,
        failed: results.length - successCount
      });

      // Refresh photo list after upload
      await this.loadPhotos(folder);

      return results;

    } catch (error) {
      logger.error('Failed to upload photos', error);
      throw error;
    }
  }

  // =========================================================================
  // PHOTO DELETION
  // =========================================================================

  /**
   * Delete a single photo
   *
   * @param {string} photoId - Photo ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deletePhoto(photoId) {
    if (!this.isInitialized) {
      throw new Error('Photo service not initialized');
    }

    try {
      logger.info('Deleting photo', { photoId });

      await this.storage.deletePhoto(photoId);

      // Refresh photo list after deletion
      await this.loadPhotos(this.currentPhotos?.folder);

      logger.success('Photo deleted', { photoId });
      return true;

    } catch (error) {
      logger.error('Failed to delete photo', error);
      throw error;
    }
  }

  /**
   * Delete all photos
   *
   * @returns {Promise<Object>} Deletion results with count
   */
  async deleteAllPhotos() {
    if (!this.isInitialized) {
      throw new Error('Photo service not initialized');
    }

    try {
      logger.info('Deleting all photos');

      const result = await this.storage.deleteAllPhotos();

      // Refresh photo list after deletion (will be empty)
      await this.loadPhotos(this.currentPhotos?.folder);

      logger.success('All photos deleted', {
        count: result.photo_count
      });

      return result;

    } catch (error) {
      logger.error('Failed to delete all photos', error);
      throw error;
    }
  }

  // =========================================================================
  // STORAGE MANAGEMENT
  // =========================================================================

  /**
   * Get current storage usage
   *
   * @returns {Promise<Object>} Storage usage details
   */
  async getStorageUsage() {
    if (!this.isInitialized) {
      throw new Error('Photo service not initialized');
    }

    try {
      return await this.storage.getStorageUsage();
    } catch (error) {
      logger.error('Failed to get storage usage', error);
      throw error;
    }
  }

  /**
   * List all folders/albums
   *
   * @returns {Promise<Array>} List of folders with photo counts
   */
  async listFolders() {
    if (!this.isInitialized) {
      throw new Error('Photo service not initialized');
    }

    try {
      return await this.storage.listFolders();
    } catch (error) {
      logger.error('Failed to list folders', error);
      throw error;
    }
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================

  /**
   * Check if service is initialized and ready
   *
   * @returns {boolean}
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Broadcast photo update to listening components
   * Uses CustomEvent for widget-data-manager to listen
   * @private
   */
  _broadcastPhotoUpdate() {
    const event = new CustomEvent('photo-data-updated', {
      detail: {
        photos: this.currentPhotos,
        timestamp: Date.now()
      }
    });

    window.dispatchEvent(event);

    logger.debug('Broadcast photo update event', {
      count: this.currentPhotos?.urls?.length || 0
    });
  }

  /**
   * Cleanup - stop timers and clear state
   */
  destroy() {
    this._stopPeriodicRefresh();
    this.currentPhotos = null;
    this.isInitialized = false;
    logger.info('PhotoService destroyed');
  }
}

// Export singleton instance
let photoServiceInstance = null;

/**
 * Initialize the photo service singleton
 *
 * @param {string} userId - Supabase user ID
 * @param {Object} jwtService - JWT authentication service
 * @returns {PhotoService}
 */
export function initializePhotoService(userId, jwtService) {
  if (!photoServiceInstance) {
    photoServiceInstance = new PhotoService();
    logger.verbose('PhotoService singleton created');
  }

  // Always re-initialize with current user/JWT
  photoServiceInstance.initialize(userId, jwtService);

  return photoServiceInstance;
}

/**
 * Get the photo service singleton
 *
 * @returns {PhotoService}
 * @throws {Error} If service not initialized
 */
export function getPhotoService() {
  if (!photoServiceInstance) {
    throw new Error('PhotoService not initialized. Call initializePhotoService() first.');
  }
  return photoServiceInstance;
}
