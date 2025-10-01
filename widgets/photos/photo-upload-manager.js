// js/modals/photo-upload-manager.js
// CHANGE SUMMARY: New parent-level upload manager - handles photo upload modal and coordinates with PhotoDataService

import { createLogger } from '../../js/utils/logger.js';

const logger = createLogger('PhotoUploadManager');

/**
 * PhotoUploadManager - Manages photo upload modal in parent window
 * Creates iframe for upload UI, handles file uploads via PhotoDataService
 * Follows same pattern as other parent-managed modals
 */
export class PhotoUploadManager {
  constructor(photoDataService) {
    this.photoDataService = photoDataService;
    this.modal = null;
    this.modalIframe = null;
    this.isOpen = false;
    this.messageListener = null;
    
    logger.info('PhotoUploadManager initialized');
  }

  /**
   * Open upload modal (creates iframe)
   */
  async open() {
    if (this.isOpen) {
      logger.warn('Upload modal already open');
      return;
    }

    logger.info('Opening photo upload modal');
    this.isOpen = true;

    // Create modal container
    this.modal = document.createElement('div');
    this.modal.className = 'dashie-modal photo-upload-modal';
    this.modal.innerHTML = `
      <div class="dashie-modal-content">
        <iframe 
          id="photo-upload-iframe"
          src="widgets/photos/photo-upload.html" 
          sandbox="allow-scripts allow-same-origin"
          style="width: 100%; height: 100%; border: none;">
        </iframe>
      </div>
    `;

    document.body.appendChild(this.modal);
    
    // Get iframe reference
    this.modalIframe = this.modal.querySelector('iframe');

    // Set up message listener for iframe communication
    this.setupMessageListener();

    // Integrate with modal navigation system
    // Note: Skip if dashieModalManager.registerModal expects specific parameters
    if (window.dashieModalManager && typeof window.dashieModalManager.registerModal === 'function') {
      try {
        // Pass modal element and close callback
        // If registerModal needs focusable elements array, provide empty array for now
        window.dashieModalManager.registerModal(this.modal, () => this.close(), []);
        logger.debug('Registered with modal navigation system');
      } catch (error) {
        logger.warn('Failed to register with modal navigation, continuing anyway', error);
      }
    }
  }

  /**
   * Set up message listener for iframe communication
   */
  setupMessageListener() {
    // Remove old listener if exists
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
    }

    this.messageListener = async (event) => {
      // Only handle messages from our iframe
      if (event.source !== this.modalIframe?.contentWindow) {
        return;
      }

      const { type, data } = event.data;
      
      logger.debug('Received message from upload iframe', { type });

      switch (type) {
        case 'upload-files':
          await this.handleUpload(data.files, data.folder);
          break;
          
        case 'close-upload-modal':
          this.close();
          break;
          
        case 'get-storage-usage':
          await this.handleStorageUsageRequest(event.source);
          break;
          
        case 'get-folders':
          await this.handleFoldersRequest(event.source);
          break;
          
        default:
          logger.debug('Unhandled message type', { type });
      }
    };

    window.addEventListener('message', this.messageListener);
    logger.debug('Message listener set up');
  }

  /**
   * Handle storage usage request from iframe
   */
  async handleStorageUsageRequest(source) {
    try {
      const usage = await this.photoDataService.getStorageUsage();
      
      source.postMessage({
        type: 'storage-usage-response',
        usage
      }, '*');
      
      logger.debug('Sent storage usage to iframe', usage);
      
    } catch (error) {
      logger.error('Failed to get storage usage', error);
      
      source.postMessage({
        type: 'storage-usage-error',
        error: error.message
      }, '*');
    }
  }

  /**
   * Handle folders list request from iframe
   */
  async handleFoldersRequest(source) {
    try {
      const folders = await this.photoDataService.listFolders();
      
      source.postMessage({
        type: 'folders-response',
        folders
      }, '*');
      
      logger.debug('Sent folders to iframe', { count: folders.length });
      
    } catch (error) {
      logger.error('Failed to get folders', error);
      
      source.postMessage({
        type: 'folders-error',
        error: error.message
      }, '*');
    }
  }

  /**
   * Handle file upload from iframe
   */
  async handleUpload(filesData, folder) {
    logger.info('Handling upload request', { 
      fileCount: filesData.length, 
      folder 
    });

    try {
      // Convert base64 file data back to File objects
      const files = filesData.map(fd => {
        const blob = this.base64ToBlob(fd.data, fd.type);
        return new File([blob], fd.name, { type: fd.type });
      });

      // Upload via photo data service (has JWT/RLS authentication)
      const results = await this.photoDataService.uploadPhotos(
        files, 
        folder,
        (percent, filename, current, total) => {
          // Send progress updates back to iframe
          if (this.modalIframe?.contentWindow) {
            this.modalIframe.contentWindow.postMessage({
              type: 'upload-progress',
              percent,
              filename,
              current,
              total
            }, '*');
          }
        }
      );

      // Send completion notification to iframe
      if (this.modalIframe?.contentWindow) {
        this.modalIframe.contentWindow.postMessage({
          type: 'upload-complete',
          results
        }, '*');
      }

      const successCount = results.filter(r => r.success).length;
      logger.success('Upload complete', { 
        total: results.length,
        successful: successCount,
        failed: results.length - successCount
      });

    } catch (error) {
      logger.error('Upload failed', error);
      
      // Send error notification to iframe
      if (this.modalIframe?.contentWindow) {
        this.modalIframe.contentWindow.postMessage({
          type: 'upload-error',
          error: error.message
        }, '*');
      }
    }
  }

  /**
   * Convert base64 string to Blob
   */
  base64ToBlob(base64, mimeType) {
    const byteString = atob(base64.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([ab], { type: mimeType });
  }

  /**
   * Close modal
   */
  close() {
    if (!this.isOpen) return;

    logger.info('Closing photo upload modal');
    
    // Remove message listener
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }

    // Remove modal from DOM
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
      this.modalIframe = null;
    }

    this.isOpen = false;

    // Unregister from modal navigation
    if (window.dashieModalManager) {
      window.dashieModalManager.unregisterModal();
    }
  }

  /**
   * Check if modal is open
   */
  isModalOpen() {
    return this.isOpen;
  }
}