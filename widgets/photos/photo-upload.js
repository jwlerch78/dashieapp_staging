// widgets/photos/photo-upload.js
// CHANGE SUMMARY: Integrated with modal-navigation-manager for d-pad/keyboard control using unified navigation system

import { PhotoStorageService } from '../../js/supabase/photo-storage-service.js';
import { createLogger } from '../../js/utils/logger.js';
import { createModalNavigation } from '../../js/utils/modal-navigation-manager.js';

const logger = createLogger('PhotoUpload');

/**
 * PhotoUploadModal - Minimal UI for uploading photos with folder selection
 * Leverages native OS file pickers (iOS photo library, PC file browser)
 * Integrated with unified modal navigation system for d-pad/keyboard control
 */
export class PhotoUploadModal {
  constructor(userId) {
    this.userId = userId;
    this.storage = new PhotoStorageService(userId);
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
    
    logger.info('Opening upload modal');
    this.isOpen = true;
    
    // Create modal if it doesn't exist
    if (!this.modal) {
      this.createModal();
    }
    
    // Load folders and storage info
    await this.loadFolders();
    await this.updateStorageDisplay();
    
    // Show modal
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    
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
    
    document.body.style.overflow = ''; // Restore scrolling
    
    // Notify parent (photos widget) to refresh
    window.parent.postMessage({
      type: 'photos-uploaded',
      source: 'photo-upload'
    }, '*');
  }

  /**
   * Set up unified modal navigation for d-pad/keyboard control
   */
  setupModalNavigation() {
    // Define focusable buttons in navigation order
    const buttons = [
      'folder-select',
      'new-folder-button',
      'upload-button',
      'close-button'
    ];
    
    logger.debug('Setting up modal navigation', { buttons });
    
    this.modalNavigation = createModalNavigation(this.modal, buttons, {
      initialFocus: 2, // Focus upload button by default
      onEscape: () => this.close()
    });
    
    logger.debug('Modal navigation setup complete');
  }

  /**
   * Create the modal DOM structure
   */
  createModal() {
    const modalHTML = `
      <div class="photo-upload-modal">
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
      </div>
    `;

    // Insert modal into document
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    this.modal = modalContainer.firstElementChild;
    document.body.appendChild(this.modal);

    // Add styles
    this.injectStyles();

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Inject modal styles
   */
  injectStyles() {
    const styles = `
      <style>
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

        .modal-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
        }

        .modal-content {
          position: relative;
          background: #fff;
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid #e0e0e0;
          background: #f8f9fa;
          border-radius: 12px 12px 0 0;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #1a1a1a;
          flex: 1;
          text-align: center;
        }

        .back-button,
        .close-button {
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
          transition: color 0.2s;
        }

        .back-button:hover,
        .close-button:hover,
        .back-button:focus,
        .close-button:focus {
          color: #000;
          outline: 2px solid #00aaff;
          outline-offset: 2px;
        }

        .modal-body {
          padding: 24px;
        }

        .upload-section {
          margin-bottom: 24px;
        }

        .upload-section label {
          display: block;
          font-weight: 500;
          color: #333;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .folder-selector {
          display: flex;
          gap: 8px;
        }

        .folder-dropdown {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 15px;
          background: #fff;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .folder-dropdown:focus {
          outline: none;
          border-color: #4285f4;
          box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.2);
        }

        .new-folder-button {
          padding: 10px 16px;
          background: #f0f0f0;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }

        .new-folder-button:hover,
        .new-folder-button:focus {
          background: #e0e0e0;
          outline: 2px solid #4285f4;
          outline-offset: 2px;
        }

        .upload-button {
          width: 100%;
          padding: 48px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: 2px dashed rgba(255, 255, 255, 0.3);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .upload-button:hover,
        .upload-button:focus {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
          outline: 3px solid #ffaa00;
          outline-offset: 3px;
        }

        .upload-icon {
          font-size: 48px;
        }

        .upload-text {
          color: #fff;
          font-size: 18px;
          font-weight: 600;
        }

        .upload-hint {
          margin-top: 8px;
          text-align: center;
          color: #666;
          font-size: 13px;
        }

        .progress-section {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 24px;
        }

        .progress-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .progress-text {
          font-weight: 500;
          color: #333;
        }

        .progress-percentage {
          font-weight: 600;
          color: #4285f4;
        }

        .progress-bar {
          height: 8px;
          background: #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #4285f4, #34a853);
          width: 0%;
          transition: width 0.3s ease;
        }

        .progress-detail {
          font-size: 13px;
          color: #666;
          margin: 0;
        }

        .storage-section {
          background: #f8f9fa;
          padding: 16px;
          border-radius: 8px;
        }

        .storage-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .storage-label {
          font-size: 13px;
          color: #666;
        }

        .storage-value {
          font-size: 13px;
          font-weight: 600;
          color: #333;
        }

        .storage-bar {
          height: 6px;
          background: #e0e0e0;
          border-radius: 3px;
          overflow: hidden;
        }

        .storage-fill {
          height: 100%;
          background: linear-gradient(90deg, #34a853, #fbbc04);
          width: 0%;
          transition: width 0.3s ease;
        }

        .storage-fill.warning {
          background: linear-gradient(90deg, #fbbc04, #ea4335);
        }

        /* Dark theme support */
        @media (prefers-color-scheme: dark) {
          .modal-content {
            background: #1e1e1e;
            color: #e0e0e0;
          }

          .modal-header {
            background: #2a2a2a;
            border-bottom-color: #3a3a3a;
          }

          .modal-header h2 {
            color: #e0e0e0;
          }

          .folder-dropdown,
          .new-folder-button {
            background: #2a2a2a;
            border-color: #3a3a3a;
            color: #e0e0e0;
          }

          .new-folder-button:hover,
          .new-folder-button:focus {
            background: #3a3a3a;
          }

          .progress-section,
          .storage-section {
            background: #2a2a2a;
          }

          .progress-bar,
          .storage-bar {
            background: #3a3a3a;
          }
        }
      </style>
    `;

    const styleElement = document.createElement('div');
    styleElement.innerHTML = styles;
    document.head.appendChild(styleElement.firstElementChild);
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Close buttons
    this.modal.querySelector('#close-button').addEventListener('click', () => this.close());
    this.modal.querySelector('#back-button').addEventListener('click', () => this.close());
    this.modal.querySelector('.modal-overlay').addEventListener('click', () => this.close());

    // Upload button
    this.modal.querySelector('#upload-button').addEventListener('click', () => this.openFilePicker());

    // New folder button
    this.modal.querySelector('#new-folder-button').addEventListener('click', () => this.createNewFolder());

    // Folder dropdown change
    this.modal.querySelector('#folder-select').addEventListener('change', () => {
      logger.debug('Folder selection changed', { 
        folder: this.modal.querySelector('#folder-select').value 
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
      // Upload with progress callback
      const results = await this.storage.uploadPhotos(files, folder, (percent, filename, current, total) => {
        progressFill.style.width = `${percent}%`;
        progressPercentage.textContent = `${percent}%`;
        progressDetail.textContent = `Photo ${current} of ${total}: ${filename}`;
      });

      // Check results
      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      if (failCount > 0) {
        alert(`Upload complete. ${successCount} succeeded, ${failCount} failed.`);
      } else {
        logger.success('All photos uploaded successfully', { count: successCount });
      }

      // Update storage display
      await this.updateStorageDisplay();

      // Close modal after short delay
      setTimeout(() => this.close(), 1000);

    } catch (error) {
      logger.error('Upload failed', error);
      alert(`Upload failed: ${error.message}`);
      progressSection.style.display = 'none';
    }
  }

  /**
   * Create new folder
   */
  async createNewFolder() {
    const folderName = prompt('Enter folder name:');
    
    if (!folderName) return;

    try {
      const sanitized = await this.storage.createFolder(folderName);
      logger.info('Folder created', { name: sanitized });
      
      // Reload folders
      await this.loadFolders();
      
      // Select the new folder
      this.modal.querySelector('#folder-select').value = sanitized;

    } catch (error) {
      logger.error('Failed to create folder', error);
      alert(`Failed to create folder: ${error.message}`);
    }
  }
}