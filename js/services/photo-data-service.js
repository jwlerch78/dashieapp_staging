// js/services/photo-data-service.js
// CHANGE SUMMARY: New parent-level photo service - manages all photo data loading and uploads with JWT/RLS (matches calendar-service pattern)

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
    this.isInitialized = false;
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

      const urls = await this.storage.getPhotoUrls(folder, shuffle);
      
      this.currentPhotos = {
        urls: urls,
        folder: folder,
        count: urls.length,
        lastUpdated: Date.now()
      };

      logger.success('Photos loaded', { 
        count: urls.length, 
        folder: folder || 'all' 
      });

      return this.currentPhotos;

    } catch (error) {
      logger.error('Failed to load photos', error);
      throw error;
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