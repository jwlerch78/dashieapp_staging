// widgets/photos/photos-settings-modal.js
// CHANGE SUMMARY: Fixed: upload overlay, transition selection highlight, early focus, storage display

import { createLogger } from '../../js/utils/logger.js';
import { PhotoStorageService } from '../../js/supabase/photo-storage-service.js';

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
      }
    });
    
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'photos-modal-ready' }, '*');
    }
    
    logger.info('PhotosSettingsModal created');
  }

  attachEventListeners() {
    this.closeBtn.addEventListener('click', () => this.close());
    this.backBtn.addEventListener('click', () => this.handleBack());
    
    document.addEventListener('keydown', (e) => this.handleKeydown(e));

    // Add Photos opens file picker directly
    const addPhotosBtn = document.getElementById('add-photos-menu');
    if (addPhotosBtn) {
      addPhotosBtn.addEventListener('click', () => {
        logger.info('Add Photos clicked - opening file picker');
        document.getElementById('file-input').click();
      });
    }
    
    document.getElementById('delete-photos-menu')?.addEventListener('click', () => {
      this.navigateTo('delete-photos-screen', 'Delete Photos');
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

  handleTransitionSelection(cell) {
    const value = parseInt(cell.dataset.value);
    
    // Remove selection from all cells
    document.querySelectorAll('#transition-screen .selectable').forEach(c => {
      c.classList.remove('selected');
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

    document.getElementById('transition-value').textContent = `${value} seconds`;

    this.saveSettingToParent('photos.transitionTime', value);

    logger.info('Transition time selected', { value });
  }

  saveSettingToParent(path, value) {
    const keys = path.split('.');
    let obj = this.currentSettings;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;

    logger.info('Saving setting to parent', { path, value });

    if (window.parent !== window) {
      const settingsInstance = window.parent.settingsInstance;
      if (settingsInstance && settingsInstance.controller) {
        try {
          const controller = settingsInstance.controller;
          if (typeof controller.setSetting === 'function') {
            controller.setSetting(path, value);
            controller.saveSettings();
            logger.success('Setting saved via settingsInstance.controller.setSetting');
            return;
          }
        } catch (error) {
          logger.warn('settingsInstance.controller.setSetting failed', error);
        }
      }
      
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

      // Load stats asynchronously (don't wait for it)
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
      
      document.getElementById('photo-count').textContent = allPhotos.length;
      
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
      
      // Apply dark theme styling if needed
      if (document.body.classList.contains('theme-dark')) {
        percentText.style.color = '#8e8e93';
      }
      
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
    this.showUploadOverlay();
    this.cancelUpload = false;

    // Get modal progress elements
    const progressInfo = document.getElementById('modal-upload-info');
    const progressFill = document.getElementById('modal-upload-fill');
    const progressDetail = document.getElementById('modal-upload-detail');

    progressInfo.textContent = 'Preparing upload...';
    progressFill.style.width = '0%';
    progressDetail.textContent = `0 / ${files.length} files`;

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

      const successful = results.filter(r => r.success).length;
      
      logger.info('Upload complete', { successful, total: files.length });
      
      if (successful === files.length) {
        progressInfo.textContent = 'Upload complete!';
        progressFill.style.width = '100%';
        
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'photos-uploaded'
          }, '*');
        }
      } else {
        progressInfo.textContent = `${successful} of ${files.length} photos uploaded`;
      }

      await this.loadPhotoStats();

      setTimeout(() => {
        this.hideUploadOverlay();
      }, 2000);

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
        this.hideUploadOverlay();
      }, 2000);
    }
  }

  showUploadOverlay() {
    let overlay = document.getElementById('upload-blocking-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'upload-blocking-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 9998;
        pointer-events: all;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      document.body.appendChild(overlay);
      
      // Create the upload modal inside the overlay
      const uploadModal = document.createElement('div');
      uploadModal.id = 'upload-progress-modal';
      uploadModal.style.cssText = `
        background: #fff;
        border-radius: 12px;
        padding: 24px;
        width: 90%;
        max-width: 400px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      `;
      
      // Add dark theme support
      if (document.body.classList.contains('theme-dark')) {
        uploadModal.style.background = '#1c1c1e';
        uploadModal.style.color = '#ffffff';
      }
      
      uploadModal.innerHTML = `
        <h3 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Uploading Photos</h3>
        <div id="modal-upload-info" style="font-size: 15px; color: #8e8e93; margin-bottom: 12px;">Preparing...</div>
        <div style="background: #e5e5ea; border-radius: 4px; height: 8px; overflow: hidden; margin-bottom: 8px;">
          <div id="modal-upload-fill" style="height: 100%; background: #EE9828; width: 0%; transition: width 0.3s ease;"></div>
        </div>
        <div id="modal-upload-detail" style="font-size: 13px; color: #8e8e93; margin-bottom: 16px;">0 / 0 files</div>
        <button id="cancel-upload-btn" style="
          width: 100%;
          padding: 12px;
          background: transparent;
          border: 1px solid #8e8e93;
          border-radius: 8px;
          color: #8e8e93;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
        ">Cancel Upload</button>
      `;
      
      overlay.appendChild(uploadModal);
      
      // Style the cancel button on hover
      const cancelBtn = uploadModal.querySelector('#cancel-upload-btn');
      cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn.style.background = 'rgba(142, 142, 147, 0.1)';
      });
      cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn.style.background = 'transparent';
      });
      
      // Add cancel functionality (will be implemented in handleFileSelection)
      cancelBtn.addEventListener('click', () => {
        this.cancelUpload = true;
        cancelBtn.disabled = true;
        cancelBtn.textContent = 'Cancelling...';
        cancelBtn.style.opacity = '0.5';
      });
    }
    overlay.style.display = 'flex';
  }

  hideUploadOverlay() {
    const overlay = document.getElementById('upload-blocking-overlay');
    if (overlay) {
      overlay.style.display = 'none';
      overlay.remove();
    }
  }

  applyTheme(theme) {
    if (theme === 'dark') {
      document.body.classList.add('theme-dark');
    } else {
      document.body.classList.remove('theme-dark');
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