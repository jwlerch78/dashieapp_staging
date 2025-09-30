// widgets/photos/photo-upload.js
// CHANGE SUMMARY: Fixed modal to open in parent window instead of iframe, integrated with parent's dashieModalManager for proper d-pad/keyboard control

import { PhotoStorageService } from '../../js/supabase/photo-storage-service.js';
import { createLogger } from '../../js/utils/logger.js';

const logger = createLogger('PhotoUpload');

/**
 * PhotoUploadModal - Minimal UI for uploading photos with folder selection
 * Leverages native OS file pickers (iOS photo library, PC file browser)
 * Integrated with unified modal navigation system for d-pad/keyboard control
 */
export class PhotoUploadModal {
  constructor(userId) {
    this.userId = userId;
    
    logger.info('PhotoUploadModal constructor called', { userId });
    
    // Verify userId before creating storage service
    if (!userId) {
      logger.error('PhotoUploadModal created with null userId!');
    }
    
    // Pass JWT service to storage service for authentication
    // Try parent window first, then current window
    const jwtService = window.parent?.jwtAuth || window.jwtAuth;
    logger.debug('JWT service lookup', { 
      hasParentJwt: !!window.parent?.jwtAuth,
      hasWindowJwt: !!window.jwtAuth,
      usingJwt: !!jwtService
    });
    
    this.storage = new PhotoStorageService(userId, jwtService);
    this.modal = null;
    this.isOpen = false;
    this.currentUpload = null;
    this.modalNavigation = null; // Unified navigation manager
    
    logger.info('PhotoUploadModal initialized', { userId });
  }

  /**
   * Open the upload modal
   */
  async open() {
    if (this.isOpen) return;
    
    logger.info('Opening upload modal', { userId: this.userId });
    this.isOpen = true;
    
    // Verify we have a userId
    if (!this.userId) {
      logger.error('Cannot open upload modal: userId is null');
      alert('Error: User authentication not available. Please refresh the page.');
      return;
    }
    
    // Create modal if it doesn't exist
    if (!this.modal) {
      this.createModal();
    }
    
    // Load folders and storage info
    await this.loadFolders();
    await this.updateStorageDisplay();
    
    // Show modal
    this.modal.classList.add('active');
    
    // Prevent background scrolling on parent document
    const parentDoc = window.parent.document;
    parentDoc.body.style.overflow = 'hidden';
    
    // Set up unified modal navigation
    this.setupModalNavigation();
  }

  /**
   * Close the upload modal
   */
  close() {
    if (!this.isOpen) return;
    
    logger.info('Closing upload modal');
    this.isOpen = false;
    
    // Clean up modal navigation
    if (this.modalNavigation) {
      this.modalNavigation.destroy();
      this.modalNavigation = null;
    }
    
    if (this.modal) {
      this.modal.classList.remove('active');
    }
    
    // Restore scrolling on parent document
    const parentDoc = window.parent.document;
    parentDoc.body.style.overflow = '';
    
    // Notify photos widget iframe to refresh
    // Find the photos iframe and send message directly to it
    const photosIframe = window.parent.document.querySelector('iframe[src*="photos"]');
    if (photosIframe && photosIframe.contentWindow) {
      photosIframe.contentWindow.postMessage({
        type: 'photos-uploaded',
        source: 'photo-upload'
      }, '*');
      logger.debug('Sent refresh message to photos iframe');
    } else {
      logger.warn('Could not find photos iframe to send refresh message');
    }
  }

  /**
   * Set up unified modal navigation for d-pad/keyboard control
   */
  setupModalNavigation() {
    // Define focusable buttons in navigation order
    const buttons = ['folder-select', 'new-folder-button', 'upload-button', 'close-button'];
    
    logger.debug('Setting up modal navigation', { buttons });
    
    // CRITICAL: Access the parent window's modal manager, not the iframe's
    const parentWindow = window.parent;
    const parentModalManager = parentWindow.dashieModalManager;
    
    if (!parentModalManager) {
      logger.error('Parent window modal manager not found');
      return;
    }
    
    // Create modal navigation config in parent context
    const modalConfig = {
      buttons: buttons.map(id => ({ id })),
      horizontalNavigation: false,
      initialFocus: 2, // Focus upload button by default
      onEscape: () => this.close()
    };
    
    // Register directly with parent's modal manager
    parentModalManager.registerModal(this.modal, modalConfig);
    
    // Store reference for cleanup - but we need to clean up via parent manager
    this.modalNavigation = {
      destroy: () => {
        if (parentModalManager.hasActiveModal()) {
          parentModalManager.unregisterModal();
        }
      }
    };
    
    logger.debug('Modal navigation setup complete with unified system');
  }

  /**
   * Create the modal DOM structure in parent window
   */
  createModal() {
    // Remove existing modal if present (check parent document)
    const parentDoc = window.parent.document;
    const existingModal = parentDoc.getElementById('photoUploadModal');
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal in parent window (outside iframe)
    const modal = parentDoc.createElement('div');
    modal.id = 'photoUploadModal';
    modal.className = 'photo-upload-modal';

    const modalHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <button class="back-button" id="back-button" aria-label="Back">←</button>
          <h2>Upload Photos</h2>
          <button class="close-button" id="close-button" aria-label="Close">×</button>
        </div>
        
        <div class="modal-body">
          <!-- Folder Selection -->
          <div class="upload-section">
            <label for="folder-select">Upload to:</label>
            <div class="folder-selector">
              <select id="folder-select" class="folder-dropdown">
                <option value="all-photos">All Photos</option>
              </select>
              <button id="new-folder-button" class="new-folder-button" title="Create new folder">+ New Folder</button>
            </div>
          </div>

          <!-- Upload Button -->
          <div class="upload-section">
            <button id="upload-button" class="upload-button">
              <span class="upload-icon">📁</span>
              <span class="upload-text">Choose Photos to Upload</span>
            </button>
            <p class="upload-hint">Select multiple photos from your device</p>
          </div>

          <!-- Progress Display -->
          <div class="progress-section" style="display: none;">
            <div class="progress-info">
              <span class="progress-text">Uploading...</span>
              <span class="progress-percentage">0%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
            <p class="progress-detail">Photo 0 of 0</p>
          </div>

          <!-- Storage Info -->
          <div class="storage-section">
            <div class="storage-info">
              <span class="storage-label">Storage Used:</span>
              <span class="storage-value">0 MB / 1 GB</span>
            </div>
            <div class="storage-bar">
              <div class="storage-fill"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    modal.innerHTML = modalHTML;

    // Add modal styles to parent document
    this.addModalStyles(parentDoc);

    // Attach event listeners
    this.attachEventListeners(modal);

    // Add to parent document body
    parentDoc.body.appendChild(modal);
    this.modal = modal;

    logger.debug('Modal created in parent document');
  }

  /**
   * Add modal styles to parent document
   */
  addModalStyles(parentDoc) {
    // Check if styles already exist in parent document
    const existingStyle = parentDoc.getElementById('photo-upload-modal-styles');
    if (existingStyle) {
      return; // Styles already added
    }

    const style = parentDoc.createElement('style');
    style.id = 'photo-upload-modal-styles';
    style.textContent = `
      .photo-upload-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        display: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .photo-upload-modal.active {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .photo-upload-modal .modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
      }

      .photo-upload-modal .modal-content {
        position: relative;
        background: #fff;
        border-radius: 12px;
        width: 90%;
        max-width: 500px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        z-index: 1;
      }

      .photo-upload-modal .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid #e0e0e0;
        background: #f8f9fa;
        border-radius: 12px 12px 0 0;
      }

      .photo-upload-modal .modal-header h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #1a1a1a;
        flex: 1;
        text-align: center;
      }

      .photo-upload-modal .back-button,
      .photo-upload-modal .close-button {
        background: none;
        border: none;
        font-size: 28px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background 0.2s;
      }

      .photo-upload-modal .back-button:hover,
      .photo-upload-modal .back-button:focus,
      .photo-upload-modal .close-button:hover,
      .photo-upload-modal .close-button:focus {
        background: rgba(0, 0, 0, 0.05);
        outline: 2px solid #ff6b35;
        outline-offset: 2px;
      }

      .photo-upload-modal .modal-body {
        padding: 24px;
      }

      .photo-upload-modal .upload-section {
        margin-bottom: 24px;
      }

      .photo-upload-modal .upload-section label {
        display: block;
        font-weight: 600;
        margin-bottom: 8px;
        color: #333;
      }

      .photo-upload-modal .folder-selector {
        display: flex;
        gap: 8px;
      }

      .photo-upload-modal .folder-dropdown {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        background: white;
        cursor: pointer;
        transition: all 0.2s;
      }

      .photo-upload-modal .folder-dropdown:hover,
      .photo-upload-modal .folder-dropdown:focus {
        border-color: #ff6b35;
        outline: none;
        box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
      }

      .photo-upload-modal .new-folder-button {
        padding: 10px 16px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      }

      .photo-upload-modal .new-folder-button:hover,
      .photo-upload-modal .new-folder-button:focus {
        background: #f8f9fa;
        border-color: #ff6b35;
        outline: none;
        box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
      }

      .photo-upload-modal .upload-button {
        width: 100%;
        padding: 20px;
        background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
        border: none;
        border-radius: 8px;
        color: white;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
      }

      .photo-upload-modal .upload-button:hover,
      .photo-upload-modal .upload-button:focus {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(255, 107, 53, 0.4);
        outline: 2px solid #ff6b35;
        outline-offset: 2px;
      }

      .photo-upload-modal .upload-icon {
        font-size: 24px;
      }

      .photo-upload-modal .upload-hint {
        margin: 8px 0 0;
        font-size: 13px;
        color: #666;
        text-align: center;
      }

      .photo-upload-modal .progress-section {
        background: #f8f9fa;
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 16px;
      }

      .photo-upload-modal .progress-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 14px;
        font-weight: 600;
        color: #333;
      }

      .photo-upload-modal .progress-bar {
        height: 8px;
        background: #e0e0e0;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 8px;
      }

      .photo-upload-modal .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #ff6b35 0%, #f7931e 100%);
        transition: width 0.3s ease;
        border-radius: 4px;
      }

      .photo-upload-modal .progress-detail {
        font-size: 12px;
        color: #666;
        margin: 0;
      }

      .photo-upload-modal .storage-section {
        background: #f8f9fa;
        padding: 16px;
        border-radius: 8px;
      }

      .photo-upload-modal .storage-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 13px;
      }

      .photo-upload-modal .storage-label {
        font-weight: 600;
        color: #666;
      }

      .photo-upload-modal .storage-value {
        color: #333;
      }

      .photo-upload-modal .storage-bar {
        height: 6px;
        background: #e0e0e0;
        border-radius: 3px;
        overflow: hidden;
      }

      .photo-upload-modal .storage-fill {
        height: 100%;
        background: linear-gradient(90deg, #4caf50 0%, #8bc34a 100%);
        transition: width 0.3s ease;
        border-radius: 3px;
      }

      .photo-upload-modal .storage-fill.warning {
        background: linear-gradient(90deg, #ff9800 0%, #ff5722 100%);
      }

      /* Dark theme support */
      body.theme-dark .photo-upload-modal .modal-content {
        background: #1a1a1a;
      }

      body.theme-dark .photo-upload-modal .modal-header {
        background: #2a2a2a;
        border-bottom-color: #3a3a3a;
      }

      body.theme-dark .photo-upload-modal .modal-header h2 {
        color: #e0e0e0;
      }

      body.theme-dark .photo-upload-modal .folder-dropdown,
      body.theme-dark .photo-upload-modal .new-folder-button {
        background: #2a2a2a;
        border-color: #3a3a3a;
        color: #e0e0e0;
      }

      body.theme-dark .photo-upload-modal .new-folder-button:hover,
      body.theme-dark .photo-upload-modal .new-folder-button:focus {
        background: #3a3a3a;
      }

      body.theme-dark .photo-upload-modal .progress-section,
      body.theme-dark .photo-upload-modal .storage-section {
        background: #2a2a2a;
      }

      body.theme-dark .photo-upload-modal .progress-bar,
      body.theme-dark .photo-upload-modal .storage-bar {
        background: #3a3a3a;
      }

      body.theme-dark .photo-upload-modal .upload-section label,
      body.theme-dark .photo-upload-modal .storage-label,
      body.theme-dark .photo-upload-modal .storage-value {
        color: #e0e0e0;
      }

      body.theme-dark .photo-upload-modal .upload-hint,
      body.theme-dark .photo-upload-modal .progress-detail {
        color: #999;
      }
    `;

    parentDoc.head.appendChild(style);
    logger.debug('Modal styles added to parent document');
  }

  /**
   * Attach event listeners
   */
  attachEventListeners(modal) {
    // Close buttons
    modal.querySelector('#close-button').addEventListener('click', () => this.close());
    modal.querySelector('#back-button').addEventListener('click', () => this.close());
    modal.querySelector('.modal-overlay').addEventListener('click', () => this.close());

    // Upload button
    modal.querySelector('#upload-button').addEventListener('click', () => this.openFilePicker());

    // New folder button
    modal.querySelector('#new-folder-button').addEventListener('click', () => this.createNewFolder());

    // Folder dropdown change
    modal.querySelector('#folder-select').addEventListener('change', () => {
      logger.debug('Folder selection changed', { 
        folder: modal.querySelector('#folder-select').value 
      });
    });
  }

  /**
   * Load folders into dropdown
   */
  async loadFolders() {
    try {
      const folders = await this.storage.listFolders();
      const dropdown = this.modal.querySelector('#folder-select');
      
      // Clear existing options except "All Photos"
      dropdown.innerHTML = '<option value="all-photos">All Photos (default)</option>';
      
      // Add folders
      folders.forEach(folder => {
        if (folder.name !== 'all-photos') {
          const option = document.createElement('option');
          option.value = folder.name;
          option.textContent = `${folder.name} (${folder.photoCount} photos)`;
          dropdown.appendChild(option);
        }
      });

      logger.debug('Folders loaded', { count: folders.length });

    } catch (error) {
      logger.error('Failed to load folders', error);
    }
  }

  /**
   * Update storage display
   */
  async updateStorageDisplay() {
    try {
      const usage = await this.storage.getStorageUsage();
      const storageValue = this.modal.querySelector('.storage-value');
      const storageFill = this.modal.querySelector('.storage-fill');

      storageValue.textContent = `${usage.usedMB} MB / ${usage.quotaGB} GB`;
      storageFill.style.width = `${usage.percentUsed}%`;

      // Add warning color if over 80%
      if (usage.percentUsed > 80) {
        storageFill.classList.add('warning');
      } else {
        storageFill.classList.remove('warning');
      }

      logger.debug('Storage display updated', usage);

    } catch (error) {
      logger.error('Failed to update storage display', error);
    }
  }

  /**
   * Open native file picker
   */
  openFilePicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;

    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        await this.handleUpload(files);
      }
    };

    input.click();
  }

  /**
   * Handle file upload
   */
  async handleUpload(files) {
    const folder = this.modal.querySelector('#folder-select').value;
    
    logger.info('Starting upload', { fileCount: files.length, folder });

    // Show progress section
    const progressSection = this.modal.querySelector('.progress-section');
    const progressFill = this.modal.querySelector('.progress-fill');
    const progressPercentage = this.modal.querySelector('.progress-percentage');
    const progressDetail = this.modal.querySelector('.progress-detail');
    
    progressSection.style.display = 'block';

    try {
      // Verify storage service is initialized
      if (!this.storage) {
        throw new Error('Storage service not initialized');
      }

      logger.debug('Upload starting with storage service', { 
        userId: this.userId,
        hasJwtService: !!this.storage.jwtService,
        folder 
      });

      // Upload with progress callback
      const results = await this.storage.uploadPhotos(files, folder, (percent, filename, current, total) => {
        progressFill.style.width = `${percent}%`;
        progressPercentage.textContent = `${percent}%`;
        progressDetail.textContent = `Photo ${current} of ${total}: ${filename}`;
        logger.debug('Upload progress', { percent, filename, current, total });
      });

      // Check results
      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      logger.info('Upload results', { 
        total: results.length, 
        successful: successCount, 
        failed: failCount 
      });

      // Log any failures
      if (failCount > 0) {
        const failures = results.filter(r => !r.success);
        logger.error('Some uploads failed', { failures });
        alert(`Upload complete. ${successCount} succeeded, ${failCount} failed.\n\nCheck console for details.`);
      } else {
        logger.success('All photos uploaded successfully', { count: successCount });
        alert(`Successfully uploaded ${successCount} photo${successCount !== 1 ? 's' : ''}!`);
      }

      // Update storage display
      await this.updateStorageDisplay();

      // Hide progress after a moment
      setTimeout(() => {
        progressSection.style.display = 'none';
        progressFill.style.width = '0%';
      }, 2000);

    } catch (error) {
      logger.error('Upload failed', { error: error.message, stack: error.stack });
      alert(`Upload failed: ${error.message}\n\nCheck console for details.`);
      progressSection.style.display = 'none';
    }
  }

  /**
   * Create a new folder
   */
  async createNewFolder() {
    const folderName = prompt('Enter folder name:');
    
    if (!folderName || folderName.trim() === '') {
      return;
    }

    try {
      await this.storage.createFolder(folderName.trim());
      await this.loadFolders();
      
      // Select the newly created folder
      const dropdown = this.modal.querySelector('#folder-select');
      dropdown.value = folderName.trim();
      
      logger.info('New folder created', { folderName: folderName.trim() });
      
    } catch (error) {
      logger.error('Failed to create folder', error);
      alert('Failed to create folder. Please try again.');
    }
  }
}