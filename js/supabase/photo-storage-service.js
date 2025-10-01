// js/supabase/photo-storage-service.js
// CHANGE SUMMARY: Fixed JWT check to use isReady property instead of isServiceReady() method - matches SimpleSupabaseStorage pattern

import { supabase } from './supabase-config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('PhotoStorage');

/**
 * PhotoStorageService - Handles photo uploads, folder management, and storage operations
 * Integrates with existing RLS/JWT architecture (matches settings pattern)
 */
export class PhotoStorageService {
  constructor(userId, jwtService = null) {
    this.userId = userId;
    this.jwtService = jwtService || window.jwtAuth;
    this.bucketName = 'photos';
    this.defaultFolder = 'all-photos';
    
    logger.info('PhotoStorageService initialized', { userId });
  }

  // ==================== JWT AUTHENTICATION ====================

  /**
   * Initialize JWT authentication before database operations
   * Follows exact pattern from SimpleSupabaseStorage (settings)
   */
  async initializeAuth() {
    try {
      // Get JWT service from parent if in iframe, otherwise use window
      const jwtService = this.jwtService || window.parent?.jwtAuth || window.jwtAuth;
      
      if (!jwtService) {
        logger.warn('No JWT service available for authentication');
        return false;
      }

      // Check if JWT service is ready - use isReady property not isServiceReady()
      if (!jwtService.isReady) {
        logger.warn('JWT service not ready');
        return false;
      }

      // Get Supabase JWT token (use the jwtService we just found, not this.jwtService)
      const jwt = await jwtService.getSupabaseJWT();
      
      if (!jwt) {
        logger.error('Failed to get JWT token');
        return false;
      }

      // Set session on Supabase client
      await supabase.auth.setSession({
        access_token: jwt,
        refresh_token: null
      });

      logger.debug('JWT authentication initialized for photo operations');
      return true;

    } catch (error) {
      logger.error('Failed to initialize JWT auth for photos', error);
      return false;
    }
  }

  /**
   * Get the storage path prefix for this user
   */
  getUserPrefix() {
    return `${this.userId}`;
  }

  /**
   * Build full storage path: {userId}/{folder}/{filename}
   */
  buildStoragePath(folder, filename) {
    const sanitizedFolder = this.sanitizeFolderName(folder || this.defaultFolder);
    const sanitizedFilename = this.sanitizeFilename(filename);
    return `${this.getUserPrefix()}/${sanitizedFolder}/${sanitizedFilename}`;
  }

  /**
   * Sanitize folder name (remove special chars, spaces to dashes)
   */
  sanitizeFolderName(name) {
    return name
      .trim()
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }

  /**
   * Sanitize filename (preserve extension, clean name)
   */
  sanitizeFilename(filename) {
    const parts = filename.split('.');
    const ext = parts.pop();
    const name = parts.join('.')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase();
    return `${name}.${ext}`;
  }

  // ==================== FOLDER OPERATIONS ====================

  /**
   * List all folders (albums) for current user
   * @returns {Promise<Array<{name: string, photoCount: number}>>}
   */
  async listFolders() {
    await this.initializeAuth(); // JWT auth before DB operation
    
    try {
      logger.debug('Listing folders for user', { userId: this.userId });

      const { data, error } = await supabase
        .from('user_photos')
        .select('folder_name')
        .eq('auth_user_id', this.userId);

      if (error) throw error;

      // Group by folder and count photos
      const folderMap = {};
      data.forEach(photo => {
        const folder = photo.folder_name || this.defaultFolder;
        folderMap[folder] = (folderMap[folder] || 0) + 1;
      });

      const folders = Object.entries(folderMap).map(([name, count]) => ({
        name,
        photoCount: count
      }));

      logger.success('Folders listed', { count: folders.length });
      return folders;

    } catch (error) {
      logger.error('Failed to list folders', error);
      throw error;
    }
  }

  /**
   * Create a new folder (just validates name, folder created on first upload)
   * @param {string} folderName 
   * @returns {Promise<string>} Sanitized folder name
   */
  async createFolder(folderName) {
    try {
      const sanitized = this.sanitizeFolderName(folderName);
      
      if (!sanitized || sanitized.length === 0) {
        throw new Error('Invalid folder name');
      }

      logger.info('Folder validated', { original: folderName, sanitized });
      return sanitized;

    } catch (error) {
      logger.error('Failed to create folder', error);
      throw error;
    }
  }

  // ==================== UPLOAD OPERATIONS ====================

  /**
   * Upload multiple photos with progress tracking
   * @param {FileList|Array<File>} files - Files to upload
   * @param {string} folder - Destination folder name
   * @param {Function} onProgress - Progress callback (percent, currentFile, total)
   * @returns {Promise<Array<{success: boolean, filename: string, path?: string, error?: string}>>}
   */
  async uploadPhotos(files, folder = null, onProgress = null) {
    await this.initializeAuth(); // JWT auth before operations
    
    const targetFolder = folder || this.defaultFolder;
    const fileArray = Array.from(files);
    const results = [];

    logger.info('Starting bulk upload', { 
      fileCount: fileArray.length, 
      folder: targetFolder 
    });

    // Check quota before uploading
    const totalSize = fileArray.reduce((sum, file) => sum + file.size, 0);
    const canUpload = await this.checkQuota(totalSize);
    
    if (!canUpload) {
      throw new Error('Storage quota exceeded. Cannot upload photos.');
    }

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      
      try {
        // Report progress
        if (onProgress) {
          const percent = Math.round(((i + 1) / fileArray.length) * 100);
          onProgress(percent, file.name, i + 1, fileArray.length);
        }

        // Convert HEIC if needed (client-side conversion placeholder)
        const processedFile = await this.processImageFile(file);

        // Upload to storage
        const result = await this.uploadSinglePhoto(processedFile, targetFolder);
        results.push(result);

      } catch (error) {
        logger.error('Failed to upload file', { filename: file.name, error });
        results.push({
          success: false,
          filename: file.name,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.success('Bulk upload complete', { 
      total: fileArray.length,
      successful: successCount,
      failed: fileArray.length - successCount
    });

    return results;
  }

  /**
   * Upload a single photo
   * @param {File} file 
   * @param {string} folder 
   * @returns {Promise<{success: boolean, filename: string, path: string}>}
   */
  async uploadSinglePhoto(file, folder) {
    // Note: Auth already initialized in uploadPhotos() caller
    
    try {
      // Generate unique filename to avoid collisions
      const timestamp = Date.now();
      const uniqueFilename = `${timestamp}-${file.name}`;
      const storagePath = this.buildStoragePath(folder, uniqueFilename);

      logger.debug('Uploading photo', { 
        filename: file.name, 
        path: storagePath,
        size: file.size 
      });

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Save metadata to database
      await this.savePhotoMetadata({
        storage_path: storagePath,
        folder_name: folder,
        filename: uniqueFilename,
        mime_type: file.type,
        file_size: file.size
      });

      logger.success('Photo uploaded', { filename: file.name, path: storagePath });

      return {
        success: true,
        filename: file.name,
        path: storagePath
      };

    } catch (error) {
      logger.error('Upload failed', { filename: file.name, error });
      throw error;
    }
  }

  /**
   * Save photo metadata to database
   */
  async savePhotoMetadata(metadata) {
    // Note: Auth already initialized in uploadPhotos() caller
    
    const { error } = await supabase
      .from('user_photos')
      .insert({
        auth_user_id: this.userId,
        ...metadata
      });

    if (error) throw error;
  }

  /**
   * Process image file (HEIC conversion placeholder)
   * @param {File} file 
   * @returns {Promise<File>}
   */
  async processImageFile(file) {
    // Check if HEIC/HEIF
    const isHEIC = /\.(heic|heif)$/i.test(file.name);
    
    if (isHEIC) {
      logger.info('HEIC file detected', { filename: file.name });
      // TODO: Implement client-side HEIC to JPEG conversion
      // For MVP, just upload as-is and handle on display
      logger.warn('HEIC conversion not yet implemented, uploading as-is');
    }

    return file;
  }

  // ==================== PHOTO RETRIEVAL ====================

  /**
   * List photos in a folder (or all folders)
   * @param {string|null} folder - Folder name, or null for all photos
   * @param {number} limit - Max photos to return
   * @returns {Promise<Array<{id: string, path: string, filename: string, uploadedAt: Date}>>}
   */
  async listPhotos(folder = null, limit = 100) {
    await this.initializeAuth(); // JWT auth before DB operation
    
    try {
      logger.debug('Listing photos', { folder, limit });

      let query = supabase
        .from('user_photos')
        .select('id, storage_path, filename, folder_name, uploaded_at')
        .eq('auth_user_id', this.userId)
        .order('uploaded_at', { ascending: false })
        .limit(limit);

      if (folder) {
        query = query.eq('folder_name', folder);
      }

      const { data, error } = await query;
      if (error) throw error;

      logger.success('Photos listed', { count: data.length, folder });
      return data.map(photo => ({
        id: photo.id,
        path: photo.storage_path,
        filename: photo.filename,
        folder: photo.folder_name,
        uploadedAt: new Date(photo.uploaded_at)
      }));

    } catch (error) {
      logger.error('Failed to list photos', error);
      throw error;
    }
  }

  /**
   * Get signed URLs for photo display
   * @param {string|null} folder - Folder to get photos from, or null for all
   * @param {boolean} shuffle - Whether to shuffle the order
   * @returns {Promise<Array<string>>} Array of signed URLs
   */
  async getPhotoUrls(folder = null, shuffle = false) {
    await this.initializeAuth(); // JWT auth before operations
    
    try {
      const photos = await this.listPhotos(folder);
      
      if (photos.length === 0) {
        logger.warn('No photos found', { folder });
        return [];
      }

      // Get signed URLs for all photos
      const urlPromises = photos.map(async (photo) => {
        const { data, error } = await supabase.storage
          .from(this.bucketName)
          .createSignedUrl(photo.path, 3600); // 1 hour expiry

        if (error) {
          logger.error('Failed to create signed URL', { path: photo.path, error });
          return null;
        }

        return data.signedUrl;
      });

      let urls = await Promise.all(urlPromises);
      urls = urls.filter(url => url !== null);

      // Shuffle if requested
      if (shuffle) {
        urls = this.shuffleArray(urls);
      }

      logger.success('Photo URLs generated', { count: urls.length, shuffle });
      return urls;

    } catch (error) {
      logger.error('Failed to get photo URLs', error);
      throw error;
    }
  }

  /**
   * Shuffle array (Fisher-Yates algorithm)
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // ==================== STORAGE QUOTA ====================

  /**
   * Get current storage usage for user
   * @returns {Promise<{used: number, quota: number, tier: string, percentUsed: number}>}
   */
  async getStorageUsage() {
    await this.initializeAuth(); // JWT auth before DB operation
    
    try {
      const { data, error } = await supabase
        .from('user_storage_quota')
        .select('bytes_used, quota_bytes, storage_tier')
        .eq('auth_user_id', this.userId)
        .single();

      if (error) {
        // User doesn't have quota record yet, create one
        if (error.code === 'PGRST116') {
          await this.initializeQuota();
          return this.getStorageUsage(); // Retry
        }
        throw error;
      }

      const used = data.bytes_used || 0;
      const quota = data.quota_bytes || 1073741824; // 1GB default
      const percentUsed = Math.round((used / quota) * 100);

      logger.debug('Storage usage retrieved', { used, quota, percentUsed });

      return {
        used,
        quota,
        tier: data.storage_tier || 'free',
        percentUsed,
        usedMB: Math.round(used / (1024 * 1024)),
        quotaMB: Math.round(quota / (1024 * 1024)),
        quotaGB: Math.round(quota / (1024 * 1024 * 1024))
      };

    } catch (error) {
      logger.error('Failed to get storage usage', error);
      throw error;
    }
  }

  /**
   * Initialize quota record for user
   */
  async initializeQuota() {
    // Note: Auth already initialized in getStorageUsage() caller
    
    const { error } = await supabase
      .from('user_storage_quota')
      .insert({
        auth_user_id: this.userId,
        bytes_used: 0,
        quota_bytes: 1073741824, // 1GB
        storage_tier: 'free'
      });

    if (error) throw error;
    logger.info('Storage quota initialized', { userId: this.userId });
  }

  /**
   * Check if upload would exceed quota
   * @param {number} additionalBytes 
   * @returns {Promise<boolean>}
   */
  async checkQuota(additionalBytes) {
    // Note: Auth already initialized in uploadPhotos() caller
    
    try {
      const usage = await this.getStorageUsage();
      const wouldExceed = (usage.used + additionalBytes) > usage.quota;

      if (wouldExceed) {
        logger.warn('Upload would exceed quota', {
          current: usage.used,
          additional: additionalBytes,
          quota: usage.quota
        });
      }

      return !wouldExceed;

    } catch (error) {
      logger.error('Quota check failed', error);
      return false;
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Format bytes to human readable string
   * @param {number} bytes 
   * @returns {string}
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}