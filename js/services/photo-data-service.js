// js/services/photo-data-service.js
// CHANGE SUMMARY: Added robust periodic refresh with client cache invalidation + enhanced logging + fallback to setTimeout

import { createLogger } from '../utils/logger.js';
import { PhotoStorageService } from '../supabase/photo-storage-service.js';
import { events as eventSystem } from '../utils/event-emitter.js';

const logger = createLogger('PhotoDataService');

/**
 * PhotoDataService - Parent-level photo data management
 * Handles all Supabase operations with JWT/RLS authentication
 * Follows same pattern as CalendarService for consistency
 */
export class PhotoDataService {
  constructor() {
    this.storage = null;
    this.currentPhotos = null;
    this.lastRefresh = null;
    this.userId = null;
    this.isInitialized = false;
    this.refreshInterval = null; // Timer for periodic URL refresh
    this.refreshTimeout = null; // Backup timer using setTimeout
  }

  /**
   * Initialize service with authenticated user and JWT
   * @param {string} userId - Supabase user ID
   * @param {Object} jwtService - JWT authentication service
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
      
      logger.info('Photo data service initialized', { userId });
      return true;
    } catch (error) {
      logger.error('Failed to initialize photo service', error);
      return false;
    }
  }

  /**
   * Load photos from storage
   * @param {string|null} folder - Folder to load from, or null for all
   * @param {boolean} shuffle - Whether to shuffle photo order
   * @returns {Promise<Object>} Photo data object
   */
  async loadPhotos(folder = null, shuffle = true) {
    if (!this.isInitialized) {
      throw new Error('Photo service not initialized');
    }

    try {
      logger.info('Loading photos', { folder, shuffle });

      // CRITICAL: Clear cached authenticated client to force fresh JWT
      if (this.storage.authenticatedClient) {
        logger.debug('Clearing cached authenticated client to get fresh JWT');
        this.storage.authenticatedClient = null;
      }

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

      return this.currentPhotos;

    } catch (error) {
      logger.error('Failed to load photos', error);
      throw error;
    }
  }

  /**
   * Start periodic refresh timer to regenerate signed URLs with fresh JWTs
   * Signed URLs expire after 1 hour, so we refresh at 50 minutes
   * Uses both setInterval AND setTimeout as fallback for reliability
   * @private
   */
  _startPeriodicRefresh() {
    // Clear any existing timers
    this._stopPeriodicRefresh();

    // Refresh every 50 minutes (3000 seconds) - before 1-hour JWT expiry
    const REFRESH_INTERVAL = 50 * 60 * 1000; // 50 minutes in milliseconds

    logger.info('🔄 Starting periodic photo refresh timer', {
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

    // Backup method: setTimeout (chains itself)
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
   * @private
   */
  async _performPeriodicRefresh() {
    try {
      logger.info('🔄 Periodic photo URL refresh triggered', {
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
      
      // Broadcast updated URLs to widgets
      eventSystem.data.emitLoaded('photos', this.currentPhotos);
      
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
   * Upload photos with progress tracking
   * @param {FileList|Array<File>} files - Files to upload
   * @param {string} folder - Destination folder
   * @param {Function} onProgress - Progress callback
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

      // Emit data loaded event so widget messenger can broadcast
      eventSystem.data.emitLoaded('photos', this.currentPhotos);

      return results;

    } catch (error) {
      logger.error('Failed to upload photos', error);
      throw error;
    }
  }

  /**
   * Get current storage usage
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

// js/services/photo-data-service.js
// CHANGE SUMMARY: Added deleteAllPhotos() method after existing deletePhoto() method

  /**
   * Delete a photo
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
      
      // Emit data loaded event
      eventSystem.data.emitLoaded('photos', this.currentPhotos);

      logger.success('Photo deleted', { photoId });
      return true;

    } catch (error) {
      logger.error('Failed to delete photo', error);
      throw error;
    }
  }

  /**
   * Delete all photos
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
      
      // Emit data loaded event
      eventSystem.data.emitLoaded('photos', this.currentPhotos);

      logger.success('All photos deleted', { 
        count: result.photo_count 
      });
      
      return result;

    } catch (error) {
      logger.error('Failed to delete all photos', error);
      throw error;
    }
  }

  /**
   * Get current photos data
   * @returns {Object|null} Current photo data
   */
  getCurrentPhotos() {
    return this.currentPhotos;
  }

  /**
   * Check if service is initialized
   * @returns {boolean}
   */
  isReady() {
    return this.isInitialized;
  }
}