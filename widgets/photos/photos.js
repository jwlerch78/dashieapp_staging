// widgets/photos/photos.js
// CHANGE SUMMARY: Updated to integrate with Supabase storage, upload modal, and support folder-based albums

import { PhotoStorageService } from '../../js/supabase/photo-storage-service.js';
import { PhotoUploadModal } from './photo-upload.js';
import { createLogger } from '../../js/utils/logger.js';

const logger = createLogger('PhotosWidget');

/**
 * PhotosWidget - Displays slideshow from Supabase storage
 * Opens upload modal on left/right/select
 */
class PhotosWidget {
  constructor() {
    this.currentPhotoIndex = 0;
    this.photoUrls = [];
    this.isTransitioning = false;
    this.autoAdvanceInterval = null;
    this.transitionTime = 10; // seconds
    this.isFocused = false;
    this.currentTheme = 'dark';
    this.userId = null;
    this.storage = null;
    this.uploadModal = null;
    this.currentFolder = null; // null = all photos

    // DOM elements
    this.loadingDiv = document.getElementById('loading');
    this.photoImg = document.getElementById('photo-display');

    logger.info('PhotosWidget initializing');
    this.initialize();
  }

  /**
   * Initialize widget - wait for authentication and load photos
   */
  async initialize() {
    // Set up event listeners (including ready signal)
    this.setupEventListeners();

    // Wait for user authentication
    await this.waitForAuth();

    // Apply initial theme
    this.applyTheme(this.currentTheme);

    // Load photos
    await this.loadPhotos();

    logger.info('PhotosWidget initialized');
  }

  /**
   * Set up event listeners for message handling
   */
  setupEventListeners() {
    // Listen for widget-messenger communications
    window.addEventListener('message', (event) => {
      // Handle navigation commands (single action strings)
      if (event.data && typeof event.data.action === 'string' && !event.data.type) {
        this.handleCommand(event.data.action);
      }
      // Handle message objects with type
      if (event.data && event.data.type) {
        this.handleDataServiceMessage(event.data);
      }
    });

    // Signal widget ready
    window.addEventListener('load', () => {
      if (window.parent !== window) {
        window.parent.postMessage({ 
          type: 'widget-ready', 
          widget: 'photos' 
        }, '*');
      }
    });
  }

  /**
   * Wait for authentication data
   */
  async waitForAuth() {
    return new Promise((resolve) => {
      const checkAuth = () => {
        // Check if we have user data from parent window (not iframe)
        const parentUser = window.parent?.dashieUser;
        if (parentUser && parentUser.id) {
          this.userId = parentUser.id;
          this.storage = new PhotoStorageService(this.userId);
          // Note: uploadModal will be created lazily when first needed
          logger.info('Auth received from parent', { userId: this.userId });
          resolve();
        } else {
          setTimeout(checkAuth, 100);
        }
      };
      checkAuth();
    });
  }

  /**
   * Handle messages from parent
   */
  handleMessage(event) {
    const data = event.data;

    // Handle navigation commands
    if (data && typeof data.action === 'string' && !data.type) {
      this.handleCommand(data.action);
    }

    // Handle data service messages
    if (data && data.type) {
      this.handleDataServiceMessage(data);
    }
  }

  /**
   * Handle navigation commands
   */
  handleCommand(action) {
    logger.debug('Photos widget received command', { action });

    // AUTO-FOCUS: Detect focus from receiving commands
    if (!this.isFocused) {
      this.handleFocusChange(true);
    }

    switch (action) {
      case 'left':
      case 'right':
      case 'select':
        // Open upload modal
        this.openUploadModal();
        break;
      case 'up':
        this.prevPhoto();
        break;
      case 'down':
        this.nextPhoto();
        break;
      case 'back':
        // Handle focus loss
        if (this.isFocused) {
          this.handleFocusChange(false);
        }
        break;
      default:
        logger.debug('Photos widget ignoring command', { action });
        break;
    }
  }

  /**
   * Handle data service messages
   */
  handleDataServiceMessage(data) {
    logger.debug('Photos widget received system message', { type: data.type });

    switch (data.type) {
      case 'widget-update':
        if (data.action === 'state-update' && data.payload) {
          // Handle theme updates
          if (data.payload.theme && data.payload.theme !== this.currentTheme) {
            this.applyTheme(data.payload.theme);
          }
        }
        break;

      case 'theme-change':
        this.applyTheme(data.theme);
        break;

      case 'update-settings':
        if (data.photoTransitionTime) {
          this.updateTransitionTime(data.photoTransitionTime);
        }
        break;

      case 'photos-uploaded':
        // Refresh photos after upload
        logger.info('Photos uploaded, refreshing display');
        this.loadPhotos();
        break;

      default:
        logger.debug('Unhandled system message type', { type: data.type });
        break;
    }
  }

  /**
   * Handle focus change
   */
  handleFocusChange(focused) {
    const wasFocused = this.isFocused;
    this.isFocused = focused;

    if (focused && !wasFocused) {
      // Widget gained focus
      document.body.classList.add('widget-focused');
      logger.debug('Photos widget gained focus');
    } else if (!focused && wasFocused) {
      // Widget lost focus
      document.body.classList.remove('widget-focused');
      logger.debug('Photos widget lost focus');
    }
  }

  /**
   * Apply theme
   */
  applyTheme(theme) {
    this.currentTheme = theme;
    document.body.className = `theme-${theme}`;
    logger.debug('Theme applied', { theme });
  }

  /**
   * Open upload modal
   */
  openUploadModal() {
    logger.info('Opening upload modal');
    
    // Lazy initialization - create modal only when first needed
    if (!this.uploadModal) {
      logger.info('Creating upload modal for first time');
      try {
        this.uploadModal = new PhotoUploadModal(this.userId);
      } catch (error) {
        logger.error('Failed to create upload modal', error);
        return;
      }
    }
    
    // Pause slideshow while modal is open
    this.stopAutoAdvance();
    this.uploadModal.open();
  }

  /**
   * Load photos from storage
   */
  async loadPhotos() {
    try {
      if (!this.storage) {
        logger.warn('Storage not initialized yet');
        return;
      }

      logger.info('Loading photos from storage', { folder: this.currentFolder });

      // Get photo URLs (shuffled)
      this.photoUrls = await this.storage.getPhotoUrls(this.currentFolder, true);

      if (this.photoUrls.length === 0) {
        logger.warn('No photos available');
        this.loadingDiv.innerHTML = '<div class="empty-message">No photos yet. Press Enter to upload.</div>';
        return;
      }

      logger.success('Photos loaded', { count: this.photoUrls.length });

      // Show first photo
      this.currentPhotoIndex = 0;
      this.showPhoto(0, false);

      // Start auto-advance
      setTimeout(() => {
        this.startAutoAdvance();
      }, 1000);

    } catch (error) {
      logger.error('Failed to load photos', error);
      this.loadingDiv.innerHTML = '<div class="error-message">Failed to load photos</div>';
    }
  }

  /**
   * Show photo at index
   */
  showPhoto(index, smooth = true) {
    if (this.photoUrls.length === 0) return;

    // Handle index wrapping
    if (index < 0) {
      this.currentPhotoIndex = this.photoUrls.length - 1;
    } else if (index >= this.photoUrls.length) {
      this.currentPhotoIndex = 0;
    } else {
      this.currentPhotoIndex = index;
    }

    // Prevent rapid transitions
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    const newSrc = this.photoUrls[this.currentPhotoIndex];

    if (smooth && this.photoImg.style.display !== 'none') {
      // Smooth transition
      this.photoImg.classList.add('transitioning');

      setTimeout(() => {
        this.photoImg.src = newSrc;
        this.photoImg.onload = () => {
          this.photoImg.classList.remove('transitioning');
          this.isTransitioning = false;
        };
        this.photoImg.onerror = () => {
          this.photoImg.classList.remove('transitioning');
          this.isTransitioning = false;
          this.handlePhotoError();
        };
      }, 150);
    } else {
      // Immediate load (first photo)
      this.photoImg.src = newSrc;
      this.photoImg.onload = () => {
        this.loadingDiv.style.display = 'none';
        this.photoImg.style.display = 'block';
        this.isTransitioning = false;
      };
      this.photoImg.onerror = () => {
        this.isTransitioning = false;
        this.handlePhotoError();
      };
    }

    logger.debug('Showing photo', {
      photoIndex: this.currentPhotoIndex + 1,
      totalPhotos: this.photoUrls.length
    });
  }

  /**
   * Handle photo load error
   */
  handlePhotoError() {
    logger.warn('Failed to load photo, skipping');
    if (this.photoUrls.length > 1) {
      // Remove failed photo and try next
      this.photoUrls.splice(this.currentPhotoIndex, 1);
      if (this.currentPhotoIndex >= this.photoUrls.length) {
        this.currentPhotoIndex = 0;
      }
      this.showPhoto(this.currentPhotoIndex, false);
    } else {
      // Show error message
      this.loadingDiv.innerHTML = '<div class="error-message">Failed to load photos</div>';
    }
  }

  /**
   * Navigate to next photo
   */
  nextPhoto() {
    this.showPhoto(this.currentPhotoIndex + 1);
  }

  /**
   * Navigate to previous photo
   */
  prevPhoto() {
    this.showPhoto(this.currentPhotoIndex - 1);
  }

  /**
   * Update transition time
   */
  updateTransitionTime(newTime) {
    if (newTime && newTime >= 5 && newTime <= 120) {
      this.transitionTime = newTime;
      logger.info('Updated transition time', { transitionTime: this.transitionTime });

      // Restart auto-advance with new timing
      if (this.autoAdvanceInterval) {
        clearInterval(this.autoAdvanceInterval);
        this.startAutoAdvance();
      }
    }
  }

  /**
   * Start auto-advance
   */
  startAutoAdvance() {
    if (this.autoAdvanceInterval) {
      clearInterval(this.autoAdvanceInterval);
    }
    this.autoAdvanceInterval = setInterval(() => {
      this.nextPhoto();
    }, this.transitionTime * 1000);
    logger.info('Auto-advance started', { intervalSeconds: this.transitionTime });
  }

  /**
   * Stop auto-advance
   */
  stopAutoAdvance() {
    if (this.autoAdvanceInterval) {
      clearInterval(this.autoAdvanceInterval);
      this.autoAdvanceInterval = null;
      logger.info('Auto-advance stopped');
    }
  }
}

// Auto-initialize widget when module loads
new PhotosWidget();

// Also export for potential external use
export { PhotosWidget };