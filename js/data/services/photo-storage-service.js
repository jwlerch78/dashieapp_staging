// js/data/services/photo-storage-service.js
// Migrated from .legacy/js/supabase/photo-storage-service.js
// CHANGE SUMMARY: Integrated PhotoFileProcessor for HEIC conversion, compression, and thumbnail generation; updated upload flow to handle both full-size and thumbnail uploads

import { supabase } from './supabase/supabase-config.js';
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2';
import { createLogger } from '../../utils/logger.js';
import { PhotoFileProcessor } from '../../modules/Settings/photos/utils/photo-file-processor.js';

const logger = createLogger('PhotoStorage');

/**
 * PhotoStorageService - Handles photo uploads, folder management, and storage operations
 * Uses database-operations edge function for all database queries (RLS-protected)
 * Direct storage bucket operations for file uploads/downloads
 */
export class PhotoStorageService {
  constructor(userId, jwtService = null) {
    this.userId = userId;
    // Check for JWT service: parameter > parent window (iframe) > current window (legacy)
    this.jwtService = jwtService || window.parent?.jwtAuth || window.parent?.edgeClient || window.jwtAuth || window.edgeClient;
    this.bucketName = 'photos';
    this.defaultFolder = 'all-photos';
    this.edgeFunctionUrl = null;
    this.authenticatedClient = null; // Cached authenticated client
    this.fileProcessor = new PhotoFileProcessor(); // File processor for HEIC, compression, and thumbnails

    // Configure edge function URL
    this._configureEdgeFunction();

    logger.debug('PhotoStorageService initialized', {
      userId,
      hasJwtService: !!this.jwtService,
      edgeFunctionUrl: this.edgeFunctionUrl
    });
  }

  /**
   * Get or create an authenticated Supabase client for storage operations
   * @private
   */
  async _getAuthenticatedClient() {
    try {
      // Return cached client if available
      if (this.authenticatedClient) {
        return this.authenticatedClient;
      }

      // Get fresh JWT token
      const jwtToken = await this.jwtService.getSupabaseJWT();
      if (!jwtToken) {
        throw new Error('Failed to get JWT token');
      }

      // Get config
      const config = window.parent?.currentDbConfig || window.currentDbConfig || {};
      const supabaseUrl = config.supabaseUrl;
      const supabaseAnonKey = config.supabaseKey || config.supabaseAnonKey;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase config not available');
      }

      // Create authenticated client with JWT in headers
      this.authenticatedClient = createClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          global: {
            headers: {
              Authorization: `Bearer ${jwtToken}`
            }
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );

      logger.debug('Created authenticated Supabase client for storage');
      return this.authenticatedClient;

    } catch (error) {
      logger.error('Failed to create authenticated client', error);
      throw error;
    }
  }

  /**
   * Configure database-operations edge function URL
   * @private
   */
  _configureEdgeFunction() {
    try {
      // Try parent window first (for iframes), then current window
      const config = window.parent?.currentDbConfig || window.currentDbConfig || {};
      const supabaseUrl = config.supabaseUrl;
      
      if (supabaseUrl) {
        this.edgeFunctionUrl = `${supabaseUrl}/functions/v1/database-operations`;
        logger.debug('Edge function URL configured', { url: this.edgeFunctionUrl });
      } else {
        logger.warn('No Supabase URL found in config');
      }
    } catch (error) {
      logger.error('Failed to configure edge function URL', error);
    }
  }

  /**
   * Call database-operations edge function
   * @private
   */
  async _callEdgeFunction(operation, data = null) {
    if (!this.edgeFunctionUrl) {
      throw new Error('Edge function URL not configured');
    }

    if (!this.jwtService || !this.jwtService.isServiceReady()) {
      throw new Error('JWT service not ready');
    }

    try {
      // Get current JWT token
      const jwtToken = await this.jwtService.getSupabaseJWT();

      logger.debug('🔍 DEBUG: JWT token retrieved', {
        hasToken: !!jwtToken,
        tokenLength: jwtToken?.length,
        tokenPrefix: jwtToken?.substring(0, 30)
      });

      if (!jwtToken) {
        throw new Error('Failed to get valid JWT token');
      }

      const requestBody = {
        operation,
        data,
        jwtToken  // Include JWT in payload for edge function
      };

      // Get Supabase anon key for apikey header
      const config = window.parent?.currentDbConfig || window.currentDbConfig || {};
      const supabaseAnonKey = config.supabaseKey || config.supabaseAnonKey;

      logger.debug('🔍 DEBUG: Config and anon key', {
        hasConfig: !!config,
        hasAnonKey: !!supabaseAnonKey,
        anonKeyPrefix: supabaseAnonKey?.substring(0, 30)
      });

      // Set headers with JWT in Authorization (NOT anon key)
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`  // JWT goes here, not anon key
      };

      // Add anon key as apikey header
      if (supabaseAnonKey) {
        headers['apikey'] = supabaseAnonKey;
      }

      logger.debug('🔍 DEBUG: Making edge function call', {
        url: this.edgeFunctionUrl,
        operation,
        headers: Object.keys(headers)
      });

      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Edge function ${operation} failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || `Operation ${operation} failed`);
      }

      return result;

    } catch (error) {
      logger.error(`Edge function ${operation} failed`, error);
      throw error;
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
   * Build thumbnail storage path: {userId}/{folder}/thumbs/{filename}
   */
  buildThumbnailPath(folder, filename) {
    const sanitizedFolder = this.sanitizeFolderName(folder || this.defaultFolder);
    const sanitizedFilename = this.sanitizeFilename(filename);
    return `${this.getUserPrefix()}/${sanitizedFolder}/thumbs/${sanitizedFilename}`;
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
    const ext = parts.pop()?.toLowerCase() || '';
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
    try {
      logger.debug('Listing folders for user', { userId: this.userId });

      const result = await this._callEdgeFunction('list_folders');

      logger.success('Folders listed', { count: result.folders.length });
      return result.folders;

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

    // Upload files one at a time
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const result = await this.uploadSinglePhoto(file, targetFolder);
      results.push(result);

      // Update progress
      if (onProgress) {
        const percent = Math.round(((i + 1) / fileArray.length) * 100);
        onProgress(percent, file.name, i + 1, fileArray.length);
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.success('Bulk upload complete', { 
      total: fileArray.length, 
      successful: successCount 
    });

    return results;
  }

  /**
   * Upload a single photo
   * @param {File} file - File to upload
   * @param {string} folder - Destination folder
   * @returns {Promise<{success: boolean, filename: string, path?: string, error?: string, skipped?: boolean}>}
   */
  async uploadSinglePhoto(file, folder) {
    try {
      logger.debug('Uploading photo', { filename: file.name, size: file.size, folder });

      // Process file (HEIC conversion + compression + thumbnail generation)
      const processed = await this.fileProcessor.processFile(file);

      // Check for duplicates (same filename in same folder)
      const existingPhotos = await this.listPhotos(folder, 1000);
      const sanitizedName = this.sanitizeFilename(processed.original.name);
      const isDuplicate = existingPhotos.some(photo => {
        const existingName = photo.storage_path.split('/').pop();
        return existingName === sanitizedName;
      });

      if (isDuplicate) {
        logger.warn('Duplicate photo detected, skipping', { filename: sanitizedName });
        return {
          success: false,
          filename: file.name,
          skipped: true,
          error: 'Duplicate file (already uploaded)'
        };
      }

      // Generate storage paths
      const storagePath = this.buildStoragePath(folder, processed.original.name);
      const thumbnailPath = processed.thumbnail 
        ? this.buildThumbnailPath(folder, processed.original.name)
        : null;

      // Get authenticated client for storage operation
      const authClient = await this._getAuthenticatedClient();

      // Upload full-size photo to storage bucket
      const { data: uploadData, error: uploadError } = await authClient.storage
        .from(this.bucketName)
        .upload(storagePath, processed.original, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      logger.debug('Full-size photo uploaded to storage', { path: storagePath });

      // Upload thumbnail if generated
      if (processed.thumbnail && thumbnailPath) {
        const { error: thumbError } = await authClient.storage
          .from(this.bucketName)
          .upload(thumbnailPath, processed.thumbnail, {
            cacheControl: '3600',
            upsert: false
          });

        if (thumbError) {
          logger.warn('Thumbnail upload failed, continuing without thumbnail', thumbError);
        } else {
          logger.debug('Thumbnail uploaded to storage', { path: thumbnailPath });
        }
      }

      // Record in database via edge function
      await this._callEdgeFunction('create_photo_record', {
        storage_path: storagePath,
        thumbnail_path: thumbnailPath,
        filename: processed.original.name,
        folder_name: folder,
        file_size: processed.original.size,
        mime_type: processed.original.type
      });

      // Update storage quota via edge function (include thumbnail size if exists)
      const totalSize = processed.original.size + (processed.thumbnail?.size || 0);
      await this._callEdgeFunction('update_storage_quota', {
        bytes_to_add: totalSize
      });

      logger.success('Photo uploaded successfully', { 
        filename: processed.original.name,
        hasThumbnail: !!processed.thumbnail
      });

      return {
        success: true,
        filename: processed.original.name,
        path: storagePath,
        thumbnailPath: thumbnailPath
      };

    } catch (error) {
      logger.error('Photo upload failed', { filename: file.name, error });
      return {
        success: false,
        filename: file.name,
        error: error.message
      };
    }
  }

  // ==================== QUOTA OPERATIONS ====================

  /**
   * Check if upload size fits within quota
   * @param {number} bytesToAdd - Size of files to upload
   * @returns {Promise<boolean>}
   */
  async checkQuota(bytesToAdd) {
    try {
      const usage = await this.getStorageUsage();
      const availableBytes = usage.quota - usage.used;
      
      if (bytesToAdd > availableBytes) {
        logger.warn('Upload exceeds quota', {
          requested: bytesToAdd,
          available: availableBytes,
          usedPercent: usage.percentUsed
        });
        return false;
      }
      
      return true;

    } catch (error) {
      logger.error('Quota check failed', error);
      // Allow upload on error (fail open)
      return true;
    }
  }

  /**
   * Get storage usage for user
   * @returns {Promise<{used: number, quota: number, usedMB: number, quotaMB: number, percentUsed: number}>}
   */
  async getStorageUsage() {
    try {
      logger.debug('Getting storage usage', { userId: this.userId });

      const result = await this._callEdgeFunction('get_storage_quota');

      if (!result.quota_found) {
        // Initialize quota if not found
        logger.info('Quota not found, initializing');
        const initResult = await this._callEdgeFunction('init_storage_quota');
        
        return {
          used: initResult.bytes_used,
          quota: initResult.quota_bytes,
          tier: initResult.storage_tier,
          percentUsed: 0,
          usedMB: 0,
          quotaMB: Math.round(initResult.quota_bytes / (1024 * 1024)),
          quotaGB: Math.round(initResult.quota_bytes / (1024 * 1024 * 1024))
        };
      }

      const used = result.bytes_used || 0;
      const quota = result.quota_bytes || 1073741824; // 1GB default
      const percentUsed = Math.round((used / quota) * 100);

      logger.debug('Storage usage retrieved', { used, quota, percentUsed });

      return {
        used,
        quota,
        tier: result.storage_tier || 'free',
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

  // ==================== LIST OPERATIONS ====================

  /**
   * List photos from storage
   * @param {string|null} folder - Folder to list from, or null for all
   * @param {number} limit - Maximum number of photos to return
   * @returns {Promise<Array>}
   */
  async listPhotos(folder = null, limit = 100) {
    try {
      logger.debug('Listing photos', { folder, limit });

      const result = await this._callEdgeFunction('list_photos', {
        folder,
        limit
      });

      logger.success('Photos listed', { count: result.photos.length });
      return result.photos;

    } catch (error) {
      logger.error('Failed to list photos', error);
      throw error;
    }
  }

  /**
   * Get photo URLs for display
   * @param {string|null} folder - Folder to load from
   * @param {boolean} shuffle - Whether to shuffle results
   * @returns {Promise<Array<string>>}
   */
  async getPhotoUrls(folder = null, shuffle = true) {
    try {
      logger.debug('Getting photo URLs', { folder, shuffle });

      // Get photo metadata from database
      const photos = await this.listPhotos(folder, 100);

      // Get authenticated client for signed URL generation
      const authClient = await this._getAuthenticatedClient();

      // Generate signed URLs for all photos in parallel
      const urlPromises = photos.map(async (photo) => {
        try {
          const { data, error } = await authClient.storage
            .from(this.bucketName)
            .createSignedUrl(photo.storage_path, 3600); // 1 hour expiry

          if (!error && data?.signedUrl) {
            return data.signedUrl;
          } else {
            logger.warn('Failed to create signed URL', {
              path: photo.storage_path,
              error
            });
            return null;
          }
        } catch (urlError) {
          logger.warn('Error creating signed URL', {
            path: photo.storage_path,
            error: urlError
          });
          return null;
        }
      });

      // Wait for all URLs to be generated and filter out nulls
      const allUrls = await Promise.all(urlPromises);
      const urls = allUrls.filter(url => url !== null);

      // Shuffle if requested
      if (shuffle) {
        for (let i = urls.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [urls[i], urls[j]] = [urls[j], urls[i]];
        }
      }

      logger.success('Photo URLs generated', { count: urls.length });
      return urls;

    } catch (error) {
      logger.error('Failed to get photo URLs', error);
      throw error;
    }
  }

  // ==================== DELETE OPERATIONS ====================

  /**
   * Delete a photo
   * @param {string} photoId - Photo ID to delete
   */
  async deletePhoto(photoId) {
    try {
      logger.debug('Deleting photo', { photoId });

      // Delete from database via edge function (gets storage_paths array back)
      const result = await this._callEdgeFunction('delete_photo', { 
        photo_id: photoId 
      });

      // FIXED: Edge function now returns storage_paths array (photo + thumbnail)
      if (result.storage_paths && result.storage_paths.length > 0) {
        const authClient = await this._getAuthenticatedClient();
        const { error: storageError } = await authClient.storage
          .from(this.bucketName)
          .remove(result.storage_paths);  // Already an array

        if (storageError) {
          logger.warn('Storage deletion warning', storageError);
        } else {
          logger.debug(`Deleted ${result.storage_paths.length} files from storage (photo + thumbnail)`);
        }
      }

      logger.success('Photo deleted', { photoId });

    } catch (error) {
      logger.error('Failed to delete photo', error);
      throw error;
    }
  }

  /**
   * Delete all photos for the user
   * @returns {Promise<Object>} Deletion results with count
   */
  async deleteAllPhotos() {
    try {
      logger.info('Deleting all photos');

      // Delete from database via edge function (gets storage_paths back)
      const result = await this._callEdgeFunction('delete_all_photos');

      if (!result.deleted) {
        throw new Error('Failed to delete photo records');
      }

      logger.debug('Database records deleted', { 
        count: result.photo_count 
      });

      // Delete from storage bucket if we have paths
      if (result.storage_paths && result.storage_paths.length > 0) {
        const authClient = await this._getAuthenticatedClient();
        const { error: storageError } = await authClient.storage
          .from(this.bucketName)
          .remove(result.storage_paths);

        if (storageError) {
          logger.warn('Storage deletion warning', storageError);
          // Continue even if storage deletion has issues
        }

        logger.debug('Storage files deleted', { 
          count: result.storage_paths.length 
        });
      }

      logger.success('All photos deleted', { 
        count: result.photo_count 
      });

      return {
        success: true,
        photo_count: result.photo_count
      };

    } catch (error) {
      logger.error('Failed to delete all photos', error);
      throw error;
    }
  }
}