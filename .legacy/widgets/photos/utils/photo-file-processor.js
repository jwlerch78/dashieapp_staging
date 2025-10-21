// widgets/photos/utils/photo-file-processor.js
// CHANGE SUMMARY: NEW FILE - Handles HEIC conversion and thumbnail generation for photo uploads

import { createLogger } from '../../../js/utils/logger.js';

const logger = createLogger('PhotoFileProcessor');

/**
 * PhotoFileProcessor - Handles file processing before upload
 * - HEIC/HEIF to JPEG conversion
 * - Thumbnail generation
 * - File metadata extraction
 */
export class PhotoFileProcessor {
  constructor(options = {}) {
    this.thumbnailMaxWidth = options.thumbnailMaxWidth || 300;
    this.thumbnailMaxHeight = options.thumbnailMaxHeight || 300;
    this.thumbnailQuality = options.thumbnailQuality || 0.85;
    this.conversionQuality = options.conversionQuality || 0.9;
    
    // Photo compression settings (default: 1920px max, 85% quality)
    this.maxDimension = options.maxDimension || 1920;
    this.compressionQuality = options.compressionQuality || 0.85;
  }

  /**
   * Process a file for upload
   * @param {File} file - Original file
   * @returns {Promise<{original: File, thumbnail: Blob|null, metadata: Object}>}
   */
  async processFile(file) {
    try {
      logger.debug('Processing file', { 
        filename: file.name, 
        size: file.size,
        type: file.type 
      });

      // Step 1: Convert HEIC/HEIF to JPEG if needed
      const convertedFile = await this.convertToJPEGIfNeeded(file);

      // Step 2: Compress and resize for optimal storage
      const compressedFile = await this.compressAndResize(convertedFile);

      // Step 3: Generate thumbnail
      const thumbnail = await this.generateThumbnail(compressedFile);

      // Step 4: Extract metadata
      const metadata = this.extractMetadata(compressedFile, file);

      logger.success('File processed successfully', {
        originalName: file.name,
        convertedName: compressedFile.name,
        hasThumbnail: !!thumbnail,
        originalSize: file.size,
        compressedSize: compressedFile.size,
        compressionRatio: (file.size / compressedFile.size).toFixed(2) + 'x',
        thumbnailSize: thumbnail?.size || 0
      });

      return {
        original: compressedFile,
        thumbnail,
        metadata
      };

    } catch (error) {
      logger.error('File processing failed', { filename: file.name, error });
      throw error;
    }
  }

  /**
   * Convert HEIC/HEIF to JPEG if needed
   * @param {File} file - Original file
   * @returns {Promise<File>} - Converted file or original if no conversion needed
   */
  async convertToJPEGIfNeeded(file) {
    // Check if file is HEIC/HEIF format
    const isHEIC = this.isHEICFormat(file);
    
    if (!isHEIC) {
      logger.debug('No conversion needed', { filename: file.name, type: file.type });
      return file;
    }

    logger.debug('Converting HEIC/HEIF to JPEG', { filename: file.name });

    try {
      // Check if heic2any library is available
      if (!window.heic2any) {
        const errorMsg = 'HEIC conversion library not available - cannot upload HEIC files';
        logger.error(errorMsg, { filename: file.name });
        throw new Error(errorMsg);
      }

      // Convert HEIC to JPEG
      const convertedBlob = await window.heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: this.conversionQuality
      });

      // Handle both single blob and array of blobs
      const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

      // Create new File object with .jpg extension
      const newFilename = this.replaceExtension(file.name, '.jpg');
      const convertedFile = new File([blob], newFilename, { type: 'image/jpeg' });

      logger.success('HEIC converted to JPEG', {
        originalName: file.name,
        newName: newFilename,
        originalSize: file.size,
        newSize: convertedFile.size
      });

      return convertedFile;

    } catch (error) {
      logger.error('HEIC conversion failed - skipping file', { filename: file.name, error: error.message });
      throw new Error(`Failed to convert HEIC file "${file.name}" to JPEG: ${error.message}`);
    }
  }

  /**
   * Generate thumbnail from image file
   * @param {File} file - Image file
   * @returns {Promise<Blob|null>} - Thumbnail blob or null if generation failed
   */
  async generateThumbnail(file) {
    try {
      logger.debug('Generating thumbnail', { filename: file.name });

      // Create image element
      const img = await this.loadImage(file);

      // Calculate thumbnail dimensions
      const dimensions = this.calculateThumbnailDimensions(
        img.width,
        img.height,
        this.thumbnailMaxWidth,
        this.thumbnailMaxHeight
      );

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);

      // Convert canvas to blob
      const thumbnail = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create thumbnail blob'));
            }
          },
          'image/jpeg',
          this.thumbnailQuality
        );
      });

      logger.success('Thumbnail generated', {
        filename: file.name,
        originalSize: `${img.width}x${img.height}`,
        thumbnailSize: `${dimensions.width}x${dimensions.height}`,
        fileSize: thumbnail.size
      });

      return thumbnail;

    } catch (error) {
      logger.error('Thumbnail generation failed', { filename: file.name, error });
      return null; // Return null instead of throwing - thumbnails are optional
    }
  }

  /**
   * Load image from file
   * @private
   * @param {File} file - Image file
   * @returns {Promise<HTMLImageElement>}
   */
  loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  /**
   * Calculate thumbnail dimensions maintaining aspect ratio
   * @private
   * @param {number} width - Original width
   * @param {number} height - Original height
   * @param {number} maxWidth - Maximum width
   * @param {number} maxHeight - Maximum height
   * @returns {{width: number, height: number}}
   */
  calculateThumbnailDimensions(width, height, maxWidth, maxHeight) {
    let newWidth = width;
    let newHeight = height;

    // Calculate scale factor
    const widthRatio = maxWidth / width;
    const heightRatio = maxHeight / height;
    const scaleFactor = Math.min(widthRatio, heightRatio, 1); // Don't scale up

    newWidth = Math.round(width * scaleFactor);
    newHeight = Math.round(height * scaleFactor);

    return { width: newWidth, height: newHeight };
  }

  /**
   * Check if file is HEIC/HEIF format
   * @private
   * @param {File} file - File to check
   * @returns {boolean}
   */
  isHEICFormat(file) {
    // Check file extension
    const hasHEICExtension = /\.(heic|heif)$/i.test(file.name);
    
    // Check MIME type
    const hasHEICMimeType = /image\/(heic|heif)/i.test(file.type);

    return hasHEICExtension || hasHEICMimeType;
  }

  /**
   * Replace file extension
   * @private
   * @param {string} filename - Original filename
   * @param {string} newExtension - New extension (with dot)
   * @returns {string}
   */
  replaceExtension(filename, newExtension) {
    return filename.replace(/\.(heic|heif)$/i, newExtension);
  }

  /**
   * Compress and resize image for optimal storage
   * @param {File} file - Image file to compress
   * @returns {Promise<File>} - Compressed file
   */
  async compressAndResize(file) {
    try {
      logger.debug('Compressing and resizing image', { 
        filename: file.name,
        originalSize: file.size 
      });

      // Load image
      const img = await this.loadImage(file);

      // Check if resize is needed
      const needsResize = img.width > this.maxDimension || img.height > this.maxDimension;

      if (!needsResize) {
        logger.debug('Image within size limits, applying compression only', {
          dimensions: `${img.width}x${img.height}`,
          maxDimension: this.maxDimension
        });
      }

      // Calculate new dimensions if resize needed
      let newWidth = img.width;
      let newHeight = img.height;

      if (needsResize) {
        const scale = this.maxDimension / Math.max(img.width, img.height);
        newWidth = Math.round(img.width * scale);
        newHeight = Math.round(img.height * scale);
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      // Convert to blob with compression
      const compressedBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          this.compressionQuality
        );
      });

      // Create new File object
      const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });

      logger.success('Image compressed', {
        filename: file.name,
        originalDimensions: `${img.width}x${img.height}`,
        newDimensions: `${newWidth}x${newHeight}`,
        originalSize: file.size,
        compressedSize: compressedFile.size,
        savedBytes: file.size - compressedFile.size,
        compressionRatio: (file.size / compressedFile.size).toFixed(2) + 'x'
      });

      return compressedFile;

    } catch (error) {
      logger.error('Compression failed, using original', { filename: file.name, error });
      return file; // Return original on error
    }
  }

  /**
   * Extract metadata from file
   * @private
   * @param {File} processedFile - Processed file
   * @param {File} originalFile - Original file (before conversion)
   * @returns {Object}
   */
  extractMetadata(processedFile, originalFile) {
    return {
      originalFilename: originalFile.name,
      processedFilename: processedFile.name,
      originalSize: originalFile.size,
      processedSize: processedFile.size,
      mimeType: processedFile.type,
      wasConverted: originalFile.name !== processedFile.name,
      uploadedAt: new Date().toISOString()
    };
  }
}