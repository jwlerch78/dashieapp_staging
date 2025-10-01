// widgets/photos/photos.js
// CHANGE SUMMARY: Refactored to parent-managed pattern - widget displays photos from parent, requests upload modal via message instead of handling internally

import { createLogger } from '../../js/utils/logger.js';

const logger = createLogger('PhotosWidget');

/**
 * PhotosWidget - Displays slideshow from parent-provided photo data
 * Sends upload requests to parent instead of handling uploads internally
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
    this.currentFolder = null; // null = all photos

    // DOM elements
    this.loadingDiv = document.getElementById('loading');
    this.photoImg = document.getElementById('photo-display');

    logger.info('PhotosWidget initializing');
    this.initialize();
  }

  /**
   * Initialize widget - set up listeners and signal ready
   */
  async initialize() {
    // Set up event listeners
    this.setupEventListeners();

    // Apply initial theme
    this.applyTheme(this.currentTheme);

    // Signal ready to parent (will receive photo data via widget-update)
    if (window.parent !== window) {
      window.parent.postMessage({ 
        type: 'widget-ready', 
        widget: 'photos' 
      }, '*');
    }

    logger.info('PhotosWidget initialized - waiting for photo data from parent');
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
      case 'enter':
      case 'select':
        // Request upload modal from parent
        this.requestUploadModal();
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
   * Request upload modal from parent
   */
  requestUploadModal() {
    logger.info('Requesting upload modal from parent');
    
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'request-upload-modal',
        widget: 'photos'
      }, '*');
      
      // Pause slideshow while modal will be open
      this.stopAutoAdvance();
    } else {
      logger.error('Cannot request upload modal - no parent window');
    }
  }

  /**
   * Handle data service messages from parent
   */
  handleDataServiceMessage(data) {
    logger.debug('Photos widget received system message', { type: data.type });

    switch (data.type) {
      case 'widget-update':
        if (data.action === 'state-update' && data.payload) {
          // Handle photo data updates
          if (data.payload.photos) {
            logger.info('Received photo data from parent', {
              count: data.payload.photos.urls?.length || 0
            });
            this.loadPhotosFromParent(data.payload.photos);
          }
          
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
        // Photos were uploaded - parent will send updated data via widget-update
        logger.info('Photos uploaded notification received');
        // Restart slideshow if it was paused
        if (this.photoUrls.length > 0 && !this.autoAdvanceInterval) {
          this.startAutoAdvance();
        }
        break;

      default:
        logger.debug('Unhandled system message type', { type: data.type });
        break;
    }
  }

  /**
   * Load photos from parent-provided data
   */
  loadPhotosFromParent(photoData) {
    try {
      this.photoUrls = photoData.urls || [];
      this.currentFolder = photoData.folder || null;

      if (this.photoUrls.length === 0) {
        logger.warn('No photos available');
        this.loadingDiv.innerHTML = '<div class="empty-message">No photos yet. Press Enter to upload.</div>';
        this.loadingDiv.style.display = 'block';
        this.photoImg.style.display = 'none';
        return;
      }

      logger.success('Photos loaded from parent', { count: this.photoUrls.length });

      // Show first photo
      this.currentPhotoIndex = 0;
      this.showPhoto(0, false);

      // Start auto-advance
      setTimeout(() => {
        this.startAutoAdvance();
      }, 1000);

    } catch (error) {
      logger.error('Failed to load photos from parent', error);
      this.loadingDiv.innerHTML = '<div class="error-message">Failed to load photos</div>';
      this.loadingDiv.style.display = 'block';
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
      this.loadingDiv.style.display = 'block';
      this.photoImg.style.display = 'none';
    }
  }

  /**
   * Navigate to next photo
   */
  nextPhoto() {
    if (this.photoUrls.length === 0) return;
    this.showPhoto(this.currentPhotoIndex + 1);
  }

  /**
   * Navigate to previous photo
   */
  prevPhoto() {
    if (this.photoUrls.length === 0) return;
    this.showPhoto(this.currentPhotoIndex - 1);
  }

  /**
   * Start auto-advance timer
   */
  startAutoAdvance() {
    if (this.photoUrls.length === 0) return;
    
    if (this.autoAdvanceInterval) {
      clearInterval(this.autoAdvanceInterval);
    }
    
    this.autoAdvanceInterval = setInterval(() => {
      this.nextPhoto();
    }, this.transitionTime * 1000);
    
    logger.info('Auto-advance started', { intervalSeconds: this.transitionTime });
  }

  /**
   * Stop auto-advance timer
   */
  stopAutoAdvance() {
    if (this.autoAdvanceInterval) {
      clearInterval(this.autoAdvanceInterval);
      this.autoAdvanceInterval = null;
      logger.info('Auto-advance stopped');
    }
  }

  /**
   * Update transition time
   */
  updateTransitionTime(newTime) {
    if (newTime && newTime >= 5 && newTime <= 120) {
      this.transitionTime = newTime;
      logger.info('Updated transition time', { transitionTime: this.transitionTime });

      // Restart auto-advance with new timing
      if (this.autoAdvanceInterval && this.photoUrls.length > 0) {
        clearInterval(this.autoAdvanceInterval);
        this.startAutoAdvance();
      }
    }
  }
}

// Initialize widget
new PhotosWidget();

// Also export for potential external use
export { PhotosWidget };