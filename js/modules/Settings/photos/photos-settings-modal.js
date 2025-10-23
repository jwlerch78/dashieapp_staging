// js/modules/Settings/photos/photos-settings-modal.js
// Migrated from .legacy/widgets/photos/photos-settings-modal.js
// v1.2 - Integrated with new Settings architecture (hybrid approach)
// v1.1 - 10/12/25 8:30pm - FIXED: Added message listener for navigation actions from modal manager (Fire TV back button)
//
// HYBRID INTEGRATION:
// This modal is launched from SettingsPhotosPage (Settings menu > Photos).
// The Settings page provides menu items, but clicking them opens this iframe modal.
// This allows file picker functionality (requires real user click) while maintaining
// Settings navigation consistency.
//
// Message types supported:
// - init-photos-modal: Initialize with userId, theme, settings
// - trigger-file-picker: Open file picker for upload
// - navigate-to: Navigate to specific screen (delete-photos-screen, transition-screen)
// - action: D-pad/keyboard navigation (up, down, enter, escape)

import { createLogger } from '../../../utils/logger.js';
import { PhotoStorageService } from '../../../data/services/photo-storage-service.js';
import {
  showUploadOverlay,
  hideUploadOverlay,
  showDeleteProgress,
  hideDeleteProgress,
  showQRCodeModal,
  hideQRCodeModal,
  showUploadResultsModal
} from './overlays/photos-modal-overlays.js';

const logger = createLogger('PhotosSettingsModal');

export class PhotosSettingsModal {
  constructor() {
    this.userId = null;
    this.storage = null;
    this.currentSettings = {};
    
    this.modalTitle = document.getElementById('modal-title');
    this.backBtn = document.getElementById('back-button');
    this.closeBtn = document.getElementById('close-button');
    this.errorContainer = document.getElementById('error-container');
    
    this.navigationStack = ['main-screen'];
    this.focusableElements = [];
    this.currentFocusIndex = 0;
    
    // Read platform config
    this.platformConfig = this.getPlatformConfig();
    
    this.attachEventListeners();
    
    // Signal ready immediately and highlight first item
    this.updateFocusableElements();
    
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'init-photos-modal') {
        this.initialize(
          event.data.userId,
          event.data.theme,
          event.data.settings
        );
      } else if (event.data?.type === 'trigger-file-picker') {
        // Triggered from empty photos widget click OR Settings menu - open file picker
        logger.info('Triggering file picker from parent request');
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
          fileInput.click();
        }
      } else if (event.data?.type === 'navigate-to') {
        // Navigate to specific screen from Settings menu
        const targetScreen = event.data.screen;
        logger.info('Navigating to screen from parent request', { targetScreen });

        // Map screen IDs to navigation
        if (targetScreen === 'delete-photos-screen') {
          this.navigateTo('delete-photos-screen', 'Delete Photos');
        } else if (targetScreen === 'transition-screen') {
          this.navigateTo('transition-screen', 'Photo Transition');
        }
      } else if (event.data?.action) {
        // Handle navigation actions from modal manager (Fire TV remote, etc.)
        const action = event.data.action;
        logger.debug('Received action from parent', { action });

        // Check if any modal is active in parent (handled by Modals module)
        if (window.parent?.modals?.isModalOpen()) {
          logger.debug('Modal active in parent, ignoring action');
          return; // Let Modals module handle it
        }

        switch (action) {
          case 'up':
            this.moveFocus(-1);
            break;
          case 'down':
            this.moveFocus(1);
            break;
          case 'enter':
            this.activateCurrentElement();
            break;
          case 'escape':
          case 'back':
            this.handleBack();
            break;
        }
      }
    });
    
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'photos-modal-ready' }, '*');
    }
    
    logger.info('PhotosSettingsModal created', { isTV: this.platformConfig.isTV });
  }

  /**
   * Get platform configuration from parent window or localStorage
   */
  getPlatformConfig() {
    // Try parent window first
    if (window.parent && window.parent.dashiePlatformConfig) {
      return window.parent.dashiePlatformConfig;
    }
    
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem('dashie-platform-config');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      logger.warn('Could not read platform config from localStorage', error);
    }
    
    // Default fallback
    return {
      isTV: false,
      platform: 'browser',
      uploadUrl: 'https://dashieapp.com#photos'
    };
  }

  attachEventListeners() {
    this.closeBtn.addEventListener('click', () => this.close());
    this.backBtn.addEventListener('click', () => this.handleBack());
    
    document.addEventListener('keydown', (e) => this.handleKeydown(e));

    // Add Photos - check platform before opening file picker
    const addPhotosBtn = document.getElementById('add-photos-menu');
    if (addPhotosBtn) {
      addPhotosBtn.addEventListener('click', () => {
        logger.info('Add Photos clicked', { isTV: this.platformConfig.isTV });
        
        if (this.platformConfig.isTV) {
          // TV device - show QR code modal
          showQRCodeModal(this.platformConfig.uploadUrl);
        } else {
          // Non-TV device - open file picker
          document.getElementById('file-input').click();
        }
      });
    }
    
    document.getElementById('delete-photos-menu')?.addEventListener('click', () => {
      // Check if button is disabled (no photos)
      const deletePhotosBtn = document.getElementById('delete-photos-menu');
      if (deletePhotosBtn && deletePhotosBtn.style.pointerEvents === 'none') {
        logger.debug('Delete photos clicked but disabled - no photos available');
        return;
      }
      this.navigateTo('delete-photos-screen', 'Delete Photos');
    });
    
    // Delete All Photos button
    document.getElementById('delete-all-photos-btn')?.addEventListener('click', () => {
      this.handleDeleteAllConfirmation();
    });
    
    document.getElementById('transition-menu')?.addEventListener('click', () => {
      this.navigateTo('transition-screen', 'Photo Transition');
    });

    document.getElementById('file-input').addEventListener('change', (e) => {
      this.handleFileSelection(e);
    });

    document.querySelectorAll('#transition-screen .selectable').forEach(cell => {
      cell.addEventListener('click', () => this.handleTransitionSelection(cell));
    });

    logger.debug('Event listeners attached');
  }

  handleKeydown(e) {
    const keyMap = {
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'Enter': 'enter',
      'Escape': 'escape',
      'Backspace': 'back'
    };

    const action = keyMap[e.key];
    if (!action) return;

    // Check if any modal is active in parent (handled by Modals module)
    if (window.parent?.modals?.isModalOpen()) {
      logger.debug('Modal active in parent, not handling keys');
      return; // Let Modals module handle it
    }

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    switch (action) {
      case 'up':
        this.moveFocus(-1);
        break;
      case 'down':
        this.moveFocus(1);
        break;
      case 'enter':
        this.activateCurrentElement();
        break;
      case 'escape':
      case 'back':
        this.handleBack();
        break;
    }
  }

  updateFocusableElements() {
    const currentScreen = document.querySelector('.screen.active');
    if (!currentScreen) return;

    this.focusableElements = Array.from(
      currentScreen.querySelectorAll('.settings-cell')
    );
    
    const currentScreenId = this.getCurrentScreen();
    if (currentScreenId === 'transition-screen') {
      const selectedIndex = this.focusableElements.findIndex(el => el.classList.contains('selected'));
      if (selectedIndex !== -1) {
        this.currentFocusIndex = selectedIndex;
      }
    } else {
      this.currentFocusIndex = 0;
    }

    this.updateFocus();
  }

  moveFocus(direction) {
    if (this.focusableElements.length === 0) return;

    if (this.focusableElements[this.currentFocusIndex]) {
      this.focusableElements[this.currentFocusIndex].classList.remove('focused');
    }

    this.currentFocusIndex += direction;

    if (this.currentFocusIndex < 0) {
      this.currentFocusIndex = this.focusableElements.length - 1;
    } else if (this.currentFocusIndex >= this.focusableElements.length) {
      this.currentFocusIndex = 0;
    }

    this.updateFocus();
  }

  updateFocus() {
    this.focusableElements.forEach(el => {
      el.blur();
      el.classList.remove('focused');
    });

    if (this.focusableElements[this.currentFocusIndex]) {
      this.focusableElements[this.currentFocusIndex].focus();
      this.focusableElements[this.currentFocusIndex].classList.add('focused');
    }
  }

  activateCurrentElement() {
    const current = this.focusableElements[this.currentFocusIndex];
    if (current) {
      logger.debug('Activating element via Enter', { 
        id: current.id,
        classList: Array.from(current.classList)
      });
      current.click();
    }
  }

  handleBack() {
    const isMainScreen = this.getCurrentScreen() === 'main-screen';
    
    if (isMainScreen) {
      this.close();
    } else {
      this.navigateBack();
    }
  }

  navigateTo(screenId, title) {
    const currentScreen = document.querySelector('.screen.active');
    const nextScreen = document.getElementById(screenId);
    
    if (!nextScreen) {
      logger.error('Screen not found', { screenId });
      return;
    }

    this.navigationStack.push(screenId);
    this.currentFocusIndex = 0;

    currentScreen.classList.remove('active');
    nextScreen.classList.add('active');

    this.modalTitle.textContent = title;
    this.updateBackButton();
    this.updateFocusableElements();

    logger.debug('Navigated to screen', { screenId, title });
  }

  navigateBack() {
    if (this.navigationStack.length <= 1) return;

    this.navigationStack.pop();
    const previousScreenId = this.navigationStack[this.navigationStack.length - 1];
    
    const currentScreen = document.querySelector('.screen.active');
    const previousScreen = document.getElementById(previousScreenId);

    if (!previousScreen) return;

    this.currentFocusIndex = 0;
    currentScreen.classList.remove('active');
    previousScreen.classList.add('active');

    const title = previousScreenId === 'main-screen' ? 'Photos' : this.modalTitle.textContent;
    this.modalTitle.textContent = title;
    this.updateBackButton();
    this.updateFocusableElements();

    logger.debug('Navigated back to', { screenId: previousScreenId });
  }

  getCurrentScreen() {
    return this.navigationStack[this.navigationStack.length - 1];
  }

  updateBackButton() {
    const isMainScreen = this.getCurrentScreen() === 'main-screen';
    
    if (isMainScreen) {
      this.backBtn.textContent = '‹ Settings';
    } else {
      this.backBtn.textContent = '‹ Photos';
    }
  }

  async handleTransitionSelection(cell) {
    const value = parseInt(cell.dataset.value);

    // Remove selection and focus from all cells
    document.querySelectorAll('#transition-screen .selectable').forEach(c => {
      c.classList.remove('selected', 'focused');
      const checkmark = c.querySelector('.cell-checkmark');
      if (checkmark) {
        checkmark.style.visibility = 'hidden';
      }
    });

    // Add selection to clicked cell
    cell.classList.add('selected');
    const checkmark = cell.querySelector('.cell-checkmark');
    if (checkmark) {
      checkmark.style.visibility = 'visible';
    }

    // Update focus to match selection
    const cells = Array.from(document.querySelectorAll('#transition-screen .selectable'));
    const clickedIndex = cells.indexOf(cell);
    if (clickedIndex !== -1) {
      this.currentFocusIndex = clickedIndex;
      this.updateFocusableElements();
    }

    document.getElementById('transition-value').textContent = `${value} seconds`;

    await this.saveSettingToParent('photos.transitionTime', value);

    logger.info('Transition time selected', { value });
  }

  async saveSettingToParent(path, value) {
  const keys = path.split('.');
  let obj = this.currentSettings;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!obj[keys[i]]) obj[keys[i]] = {};
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;

  logger.info('Saving setting', { path, value });

  // Try to save via new SettingsStore (preferred method)
  if (window.parent !== window && window.parent.settingsStore) {
    try {
      window.parent.settingsStore.set(path, value);
      await window.parent.settingsStore.save(true); // Save WITH toast to verify it's working
      logger.success('Setting saved via SettingsStore', { path, value });
      return;
    } catch (error) {
      logger.warn('SettingsStore save failed', error);
    }
  }

  // Fallback: Try legacy settingsInstance method
  if (window.parent !== window) {
    const settingsInstance = window.parent.settingsInstance;
    if (settingsInstance && typeof settingsInstance.handleSettingChange === 'function') {
      try {
        settingsInstance.handleSettingChange(path, value);
        logger.success('Setting saved via legacy settingsInstance.handleSettingChange');
        return;
      } catch (error) {
        logger.warn('settingsInstance.handleSettingChange failed', error);
      }
    }

    // Last resort: postMessage (probably won't work but try anyway)
    window.parent.postMessage({
      type: 'update-setting',
      path: path,
      value: value
    }, '*');
    logger.info('Setting sent via postMessage fallback');
  }
}

  async initialize(userId, theme, settings = {}) {
    this.userId = userId;
    this.currentSettings = settings;
    
    if (!this.userId) {
      this.showError('User ID not provided');
      return;
    }

    logger.info('Initializing', { userId: this.userId });

    const jwtService = window.parent?.jwtAuth;
    
    try {
      this.storage = new PhotoStorageService(this.userId, jwtService);
      
      if (theme) {
        this.applyTheme(theme);
      }

      // FIXED: Start with delete button disabled while loading
      const deletePhotosBtn = document.getElementById('delete-photos-menu');
      if (deletePhotosBtn) {
        deletePhotosBtn.style.opacity = '0.4';
        deletePhotosBtn.style.pointerEvents = 'none';
        deletePhotosBtn.style.cursor = 'not-allowed';
      }

      // Load stats asynchronously (will enable button if photos exist)
      this.loadPhotoStats();
      
      this.populateCurrentSettings();
      
      logger.success('Modal initialized successfully');
    } catch (error) {
      this.showError('Failed to initialize: ' + error.message);
      logger.error('Initialization failed', error);
    }
  }

  async loadPhotoStats() {
    try {
      const usage = await this.storage.getStorageUsage();
      const allPhotos = await this.storage.listPhotos(null, 1000);
      
      const photoCount = allPhotos.length;
      document.getElementById('photo-count').textContent = photoCount;
      
      // Enable/disable delete photos button based on photo count
      const deletePhotosBtn = document.getElementById('delete-photos-menu');
      if (deletePhotosBtn) {
        if (photoCount === 0) {
          deletePhotosBtn.style.opacity = '0.4';
          deletePhotosBtn.style.pointerEvents = 'none';
          deletePhotosBtn.style.cursor = 'not-allowed';
        } else {
          deletePhotosBtn.style.opacity = '1';
          deletePhotosBtn.style.pointerEvents = 'auto';
          deletePhotosBtn.style.cursor = 'pointer';
        }
      }
      
      // Format storage: Show GB if over 1000 MB, otherwise MB
      const usedDisplay = usage.usedMB >= 1000 
        ? `${(usage.usedMB / 1024).toFixed(1)} GB`
        : `${usage.usedMB} MB`;
      
      const quotaDisplay = usage.quotaMB >= 1000
        ? `${(usage.quotaMB / 1024).toFixed(1)} GB`
        : `${usage.quotaMB} MB`;
      
      // Update storage text (without percentage)
      document.getElementById('storage-used').textContent = `${usedDisplay} / ${quotaDisplay}`;
      
      // Update storage bar
      document.getElementById('storage-bar-fill').style.width = `${usage.percentUsed}%`;
      
      // Add/update percentage text below bar
      let percentText = document.getElementById('storage-percent-text');
      if (!percentText) {
        // Create the element if it doesn't exist
        percentText = document.createElement('div');
        percentText.id = 'storage-percent-text';
        percentText.style.cssText = `
          font-size: 13px;
          color: #8e8e93;
          text-align: center;
          margin-top: 4px;
        `;
        
        // Insert after storage bar
        const storageBar = document.querySelector('.storage-bar');
        if (storageBar && storageBar.parentNode) {
          storageBar.parentNode.insertBefore(percentText, storageBar.nextSibling);
        }
      }
      
      percentText.textContent = `${Math.round(usage.percentUsed)}% of storage used`;

      logger.debug('Photo stats loaded');
    } catch (error) {
      logger.error('Failed to load photo stats', error);
    }
  }

  populateCurrentSettings() {
    const transitionTime = this.currentSettings.photos?.transitionTime || 5;
    document.querySelectorAll('#transition-screen .selectable').forEach(cell => {
      const value = parseInt(cell.dataset.value);
      if (value === transitionTime) {
        cell.classList.add('selected');
        const checkmark = cell.querySelector('.cell-checkmark');
        if (checkmark) {
          checkmark.style.visibility = 'visible';
        }
      } else {
        cell.classList.remove('selected');
        const checkmark = cell.querySelector('.cell-checkmark');
        if (checkmark) {
          checkmark.style.visibility = 'hidden';
        }
      }
    });
    document.getElementById('transition-value').textContent = `${transitionTime} seconds`;
  }

  async handleFileSelection(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const targetFolder = 'all-photos';
    logger.info('Files selected for upload', { count: files.length, folder: targetFolder });

    // Show upload modal overlay
    const overlay = showUploadOverlay();
    this.cancelUpload = false;

    // Get modal progress elements
    const progressInfo = document.getElementById('modal-upload-info');
    const progressFill = document.getElementById('modal-upload-fill');
    const progressDetail = document.getElementById('modal-upload-detail');

    progressInfo.textContent = 'Preparing upload...';
    progressFill.style.width = '0%';
    progressDetail.textContent = `0 / ${files.length} files`;

    // Setup cancel functionality
    const cancelBtn = document.getElementById('cancel-upload-btn');
    cancelBtn.onclick = () => {
      this.cancelUpload = true;
      cancelBtn.disabled = true;
      cancelBtn.textContent = 'Cancelling...';
      cancelBtn.style.opacity = '0.5';
    };

    try {
      let uploadedCount = 0;
      const results = await this.storage.uploadPhotos(files, targetFolder, (percent, filename, current, total) => {
        // Check if upload was cancelled
        if (this.cancelUpload) {
          throw new Error('Upload cancelled by user');
        }
        
        logger.debug('Upload progress', { percent, current, total, filename });
        
        progressFill.style.width = `${percent}%`;
        progressDetail.textContent = `${current} / ${total} files`;
        progressInfo.textContent = `Uploading ${filename}...`;
        uploadedCount = current;
      });

      // Categorize results
      const successful = results.filter(r => r.success).length;
      const allFailed = results.filter(r => !r.success);
      const skipped = allFailed.filter(r => r.skipped).length;
      const failed = allFailed.filter(r => !r.skipped).length;

      logger.info('Upload complete', {
        successful,
        failed,
        skipped,
        total: files.length
      });

      // Update progress one final time
      progressInfo.textContent = 'Processing results...';
      progressFill.style.width = '100%';

      // Log failed files for debugging
      allFailed.forEach(f => {
        logger.warn(f.skipped ? 'Skipped file' : 'Failed to upload', {
          filename: f.filename,
          error: f.error
        });
      });

      await this.loadPhotoStats();

      // Notify photos widget to reload with new photos
      if (successful > 0 && window.parent !== window) {
        try {
          // Get updated photo URLs
          const photoUrls = await this.storage.getPhotoUrls(null, true);

          // Send to widget
          window.parent.postMessage({
            type: 'data',
            widgetId: 'photos',
            payload: {
              dataType: 'photos',
              payload: {
                urls: photoUrls
              }
            }
          }, '*');
          logger.debug('Sent updated photos data to widget', { count: photoUrls.length });
        } catch (error) {
          logger.warn('Failed to notify widget of new photos', error);
        }
      }

      // Hide progress overlay and show results modal
      hideUploadOverlay();

      // Show results modal with summary
      showUploadResultsModal({
        successful,
        failed,
        skipped,
        total: files.length
      });

      // Broadcast to other dashboards if photos were successfully uploaded
      if (successful > 0 && window.parent.dashboardSync) {
        window.parent.dashboardSync.broadcastPhotosUpdate({
          action: 'upload',
          count: successful
        });
        logger.debug('Broadcast photo upload to other dashboards', { count: successful });
      }

      event.target.value = '';

    } catch (error) {
      logger.error('Upload failed', error);
      
      if (error.message === 'Upload cancelled by user') {
        progressInfo.textContent = 'Upload cancelled';
        progressInfo.style.color = '#ff3b30';
      } else {
        progressInfo.textContent = 'Upload failed: ' + error.message;
        progressInfo.style.color = '#ff3b30';
        this.showError(error.message);
      }
      
      setTimeout(() => {
        hideUploadOverlay();
      }, 2000);
    }
  }

  /**
   * Show confirmation modal for delete all
   */
  handleDeleteAllConfirmation() {
    // Get current photo count for confirmation message
    const photoCountEl = document.getElementById('photo-count');
    const photoCount = photoCountEl ? photoCountEl.textContent : '0';

    // Use parent window's Modals module for confirmation
    const modals = window.parent?.modals;

    if (!modals) {
      logger.error('Modals module not available in parent window');
      // Fallback to direct deletion (not recommended)
      if (confirm(`Delete all ${photoCount} photos? This cannot be undone.`)) {
        this.handleDeleteAllPhotos();
      }
      return;
    }

    modals.showConfirmation({
      title: 'Delete All Photos?',
      message: `This will permanently delete all ${photoCount} photos from your library and reset your storage quota. This action cannot be undone.`,
      confirmLabel: 'Delete All',
      cancelLabel: 'Cancel',
      confirmStyle: 'primary',
      onConfirm: () => this.handleDeleteAllPhotos(),
      onCancel: () => {
        logger.info('Delete all photos cancelled');
      }
    });
  }

  /**
   * Handle delete all photos
   */
  async handleDeleteAllPhotos() {
    try {
      logger.info('Starting delete all photos');

      // Show progress overlay
      showDeleteProgress();

      // Check if storage service is available
      if (!this.storage) {
        throw new Error('Photo storage service not available');
      }

      // Perform deletion
      const result = await this.storage.deleteAllPhotos();
      
      logger.success('Delete all completed', { count: result.photo_count });
      
      // Update progress message
      const progressInfo = document.getElementById('delete-progress-info');
      if (progressInfo) {
        progressInfo.textContent = `Deleted ${result.photo_count} photo${result.photo_count !== 1 ? 's' : ''}`;
      }
      
      // Wait a moment to show success message
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Hide progress overlay
      hideDeleteProgress();
      
      // Reload stats to show 0 photos and 0 storage
      await this.loadPhotoStats();

      // Notify photos widget to clear cache and show empty state
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'data',
          widgetId: 'photos',
          payload: {
            dataType: 'photos',
            payload: {
              urls: []  // Empty array = no photos
            }
          }
        }, '*');
        logger.debug('Sent empty photos data to widget');
      }

      // Broadcast to other dashboards that photos were deleted
      if (window.parent.dashboardSync) {
        window.parent.dashboardSync.broadcastPhotosUpdate({
          action: 'delete-all',
          count: result.photo_count
        });
        logger.debug('Broadcast photo deletion to other dashboards', { count: result.photo_count });
      }

      // Navigate back to main screen
      this.navigateBack();

      logger.info('Delete all photos completed successfully');

    } catch (error) {
      logger.error('Failed to delete all photos', error);
      hideDeleteProgress();
      this.showError('Failed to delete photos: ' + error.message);
    }
  }

  applyTheme(theme) {
    // Remove all existing theme classes
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-halloween-dark', 'theme-halloween-light', 'theme-halloween-light-backup');

    // Add the new theme class
    if (theme) {
      document.body.classList.add(`theme-${theme}`);
      logger.debug('Applied theme class', { theme, className: `theme-${theme}` });
    }
  }

  showError(message) {
    this.errorContainer.innerHTML = `
      <div class="error-message">${message}</div>
    `;
    setTimeout(() => {
      this.errorContainer.innerHTML = '';
    }, 5000);
  }

  close() {
    logger.info('Closing modal');
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'close-photos-modal'
      }, '*');
    }
  }
}