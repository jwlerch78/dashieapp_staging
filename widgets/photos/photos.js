// widgets/photos/photos.js
// CHANGE SUMMARY: Fixed theme change detection in applyTheme() to prevent redundant applications, simplified logging to reduce noise - only logs relevant updates

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
    this.currentTheme = null;
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

    // Apply initial theme detection
    this.detectAndApplyInitialTheme();

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
   * Detect initial theme from DOM or localStorage
   */
  detectAndApplyInitialTheme() {
    let initialTheme = 'dark'; // fallback

    // Try to detect theme from body class (applied by early theme loading)
    if (document.body.classList.contains('theme-light')) {
      initialTheme = 'light';
    } else if (document.body.classList.contains('theme-dark')) {
      initialTheme = 'dark';
    } else {
      // Fallback: try localStorage
      try {
        const savedTheme = localStorage.getItem('dashie-theme');
        if (savedTheme && (savedTheme === 'dark' || savedTheme === 'light')) {
          initialTheme = savedTheme;
        }
      } catch (error) {
        logger.debug('Could not read theme from localStorage, using default');
      }
    }

    // Apply the detected theme immediately
    this.applyTheme(initialTheme);
    
    logger.info('Initial theme detected and applied', { theme: initialTheme });
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
        this.handleSystemMessage(event.data);
      }
    });

    // Signal widget ready on load
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
   * Handle navigation commands
   */
  handleCommand(action) {
    logger.debug('Photos widget received command', { action });

    switch (action) {
      case 'left':
        this.previousPhoto();
        break;
      case 'right':
        this.nextPhoto();
        break;
      case 'select':
        // Request upload modal from parent
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'open-upload-modal',
            widget: 'photos'
          }, '*');
          logger.info('Requesting photo upload modal from parent');
        }
        break;
      case 'up':
      case 'down':
      case 'back':
        // No action for these in photos widget
        break;
      default:
        logger.debug('Unhandled command', { action });
        break;
    }
  }

  /**
   * Handle system messages from parent
   */
  handleSystemMessage(data) {
    switch (data.type) {
      case 'widget-update':
        if (data.action === 'state-update' && data.payload) {
          // Check if this update contains anything relevant to photos widget
          const hasPhotos = data.payload.photos;
          const hasTheme = data.payload.theme;
          
          // Only log if update is relevant
          if (hasPhotos || hasTheme) {
            logger.debug('Processing relevant state update', { hasPhotos, hasTheme });
          }
          
          // Handle photo data updates
          if (hasPhotos) {
            this.loadPhotosFromParent(data.payload.photos);
          }
          
          // Handle theme updates
          if (hasTheme) {
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
   * Apply theme - FIXED: Only apply if theme actually changed
   */
  applyTheme(theme) {
    // Skip if theme hasn't changed - prevents redundant applications
    if (this.currentTheme === theme) {
      return;
    }
    
    const previousTheme = this.currentTheme;
    this.currentTheme = theme;
    
    // Remove any existing theme classes
    document.body.classList.remove('theme-dark', 'theme-light');
    
    // Apply new theme class
    document.body.classList.add(`theme-${theme}`);
    
    logger.info('Theme applied successfully', { 
      theme, 
      previousTheme,
      bodyClasses: document.body.className 
    });
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

    const photoUrl = this.photoUrls[this.currentPhotoIndex];

    // Handle transitions
    if (smooth && this.photoImg.style.display !== 'none') {
      this.isTransitioning = true;
      this.photoImg.classList.add('transitioning');

      setTimeout(() => {
        this.updatePhotoSrc(photoUrl);
      }, 300);
    } else {
      this.updatePhotoSrc(photoUrl);
    }
  }

  /**
   * Update photo source and handle display
   */
  updatePhotoSrc(photoUrl) {
    this.photoImg.src = photoUrl;
    this.photoImg.onload = () => {
      this.loadingDiv.style.display = 'none';
      this.photoImg.style.display = 'block';
      
      if (this.isTransitioning) {
        setTimeout(() => {
          this.photoImg.classList.remove('transitioning');
          this.isTransitioning = false;
        }, 50);
      }

      logger.debug('Photo displayed', { 
        index: this.currentPhotoIndex, 
        total: this.photoUrls.length 
      });
    };

    this.photoImg.onerror = () => {
      logger.error('Failed to load photo', { url: photoUrl });
      this.loadingDiv.innerHTML = '<div class="error-message">Failed to load photo</div>';
      this.loadingDiv.style.display = 'block';
    };
  }

  /**
   * Navigate to next photo
   */
  nextPhoto() {
    this.stopAutoAdvance();
    this.showPhoto(this.currentPhotoIndex + 1, true);
    this.startAutoAdvance();
    logger.debug('Manual navigation to next photo');
  }

  /**
   * Navigate to previous photo
   */
  previousPhoto() {
    this.stopAutoAdvance();
    this.showPhoto(this.currentPhotoIndex - 1, true);
    this.startAutoAdvance();
    logger.debug('Manual navigation to previous photo');
  }

  /**
   * Start auto-advance timer
   */
  startAutoAdvance() {
    this.stopAutoAdvance();
    this.autoAdvanceInterval = setInterval(() => {
      this.showPhoto(this.currentPhotoIndex + 1, true);
    }, this.transitionTime * 1000);
    logger.debug('Auto-advance started', { intervalSeconds: this.transitionTime });
  }

  /**
   * Stop auto-advance timer
   */
  stopAutoAdvance() {
    if (this.autoAdvanceInterval) {
      clearInterval(this.autoAdvanceInterval);
      this.autoAdvanceInterval = null;
    }
  }

  /**
   * Update transition time
   */
  updateTransitionTime(seconds) {
    this.transitionTime = seconds;
    if (this.autoAdvanceInterval) {
      this.startAutoAdvance();
    }
    logger.info('Transition time updated', { seconds });
  }
}

// Initialize the widget
export { PhotosWidget };
new PhotosWidget();