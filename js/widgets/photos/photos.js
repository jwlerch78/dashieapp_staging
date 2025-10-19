// js/widgets/photos/photos.js
// Photos Widget - Ported from .legacy/widgets/photos
// v2.0 - Phase 5.2 - Adapted to new dashboard architecture with 3-state model

import { createLogger } from '/js/utils/logger.js';

const logger = createLogger('PhotosWidget');

class PhotosWidget {
  constructor() {
    // Photo data
    this.photoUrls = [];
    this.currentPhotoIndex = 0;
    this.currentFolder = null;

    // Slideshow control
    this.autoAdvanceInterval = null;
    this.transitionTime = 5000; // 5 seconds default
    this.isTransitioning = false;

    // Widget state (3-state model)
    this.isFocused = false;   // Widget is centered/has attention
    this.isActive = false;    // Widget is receiving commands

    // DOM references
    this.photoContainer = document.getElementById('photo-container');
    this.loadingDiv = document.getElementById('loading');
    this.emptyStateDiv = document.getElementById('empty-state');
    this.photoImg = document.getElementById('photo-display');

    // Focus menu configuration (optional for photos widget)
    this.focusMenu = {
      enabled: false // No focus menu for photos widget
    };

    this.detectAndApplyInitialTheme();
    this.setupMessageListener();
    this.setupEmptyStateHandler();
    this.signalReady();

    logger.info('PhotosWidget initialized');
  }

  /**
   * Set up empty state click handler
   */
  setupEmptyStateHandler() {
    if (this.emptyStateDiv) {
      this.emptyStateDiv.addEventListener('click', () => {
        logger.info('Empty state clicked - requesting photos settings');

        // Send message to parent to open photos settings
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'open-photos-settings'
          }, '*');
        }
      });
    }
  }

  /**
   * Signal ready to parent
   */
  signalReady() {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'event',
        widgetId: 'photos',
        payload: {
          eventType: 'widget-ready',
          data: {
            hasMenu: this.focusMenu.enabled
          }
        }
      }, '*');
      logger.info('Ready signal sent to parent');
    }
  }

  /**
   * Set up message listener for parent communication
   */
  setupMessageListener() {
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data) return;

      logger.debug('Photos widget received message', {
        type: data.type,
        action: data.action,
        dataType: data.payload?.dataType,
        widgetId: data.widgetId
      });

      // Handle commands sent from dashboard (action at top level)
      if (data.type === 'command' && data.action) {
        this.handleCommand(data.action);
        return;
      }

      // Handle data updates (dataType inside payload)
      if (data.type === 'data' && data.payload?.dataType === 'photos') {
        logger.info('Photos data message received', { payload: data.payload.payload });
        this.loadPhotosFromData(data.payload.payload);
        return;
      }

      // Handle theme updates
      if (data.type === 'theme-change' && data.theme) {
        this.applyTheme(data.theme);
        return;
      }

      // Handle settings updates
      if (data.type === 'settings-update') {
        if (data.transitionTime) {
          this.updateTransitionTime(data.transitionTime);
        }
        return;
      }
    });

    logger.info('Message listener set up');
  }

  /**
   * Handle commands from dashboard
   */
  handleCommand(action) {
    logger.debug('Photos widget received command', {
      action,
      isFocused: this.isFocused,
      isActive: this.isActive
    });

    // Handle state transitions
    switch (action) {
      case 'enter-focus':
        this.handleEnterFocus();
        return;
      case 'enter-active':
        this.handleEnterActive();
        return;
      case 'exit-active':
        this.handleExitActive();
        return;
      case 'exit-focus':
        this.handleExitFocus();
        return;
    }

    // Handle navigation ONLY if active
    if (!this.isActive) {
      logger.debug('Navigation command ignored - widget not active', { action });
      return;
    }

    switch (action) {
      case 'left':
        this.previousPhoto();
        break;
      case 'right':
        this.nextPhoto();
        break;
      case 'enter':
        // If no photos, open settings; otherwise could pause/play
        if (this.photoUrls.length === 0) {
          this.emptyStateDiv.click();
        }
        break;
      default:
        logger.debug('Unhandled command', { action });
        break;
    }
  }

  /**
   * State transition handlers
   */
  handleEnterFocus() {
    logger.debug('Photos entered FOCUSED state');
    this.isFocused = true;
  }

  handleEnterActive() {
    logger.debug('Photos entered ACTIVE state');
    this.isActive = true;

    // If no photos, prompt to add them
    if (this.photoUrls.length === 0) {
      logger.info('Widget active with no photos - showing empty state');
    }
  }

  handleExitActive() {
    logger.debug('Photos exited ACTIVE state');
    this.isActive = false;
  }

  handleExitFocus() {
    logger.debug('Photos exited FOCUSED state');
    this.isFocused = false;
    this.isActive = false;
  }

  /**
   * Load photos from data payload
   */
  loadPhotosFromData(payload) {
    try {
      this.photoUrls = payload.urls || [];
      this.currentFolder = payload.folder || null;

      if (this.photoUrls.length === 0) {
        logger.warn('No photos available - showing empty state');
        this.showEmptyState();
        return;
      }

      logger.success('Photos loaded', { count: this.photoUrls.length });

      // Hide loading/empty, show photos
      this.loadingDiv.style.display = 'none';
      this.emptyStateDiv.style.display = 'none';

      // Show first photo
      this.currentPhotoIndex = 0;
      this.showPhoto(0, false);

      // Start auto-advance after a brief delay
      setTimeout(() => {
        this.startAutoAdvance();
      }, 1000);

    } catch (error) {
      logger.error('Failed to load photos', error);
      this.showError('Failed to load photos');
    }
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    this.loadingDiv.style.display = 'none';
    this.photoImg.style.display = 'none';
    this.emptyStateDiv.style.display = 'flex';
  }

  /**
   * Show error message
   */
  showError(message) {
    this.loadingDiv.innerHTML = `<div class="error-message">${message}</div>`;
    this.loadingDiv.style.display = 'block';
    this.emptyStateDiv.style.display = 'none';
    this.photoImg.style.display = 'none';
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
      this.emptyStateDiv.style.display = 'none';
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
      // Try next photo
      this.showPhoto(this.currentPhotoIndex + 1, false);
    };
  }

  /**
   * Start auto-advance timer
   */
  startAutoAdvance() {
    this.stopAutoAdvance();

    if (this.photoUrls.length <= 1) return;

    this.autoAdvanceInterval = setInterval(() => {
      this.showPhoto(this.currentPhotoIndex + 1, true);
    }, this.transitionTime);

    logger.debug('Auto-advance started', { interval: this.transitionTime });
  }

  /**
   * Stop auto-advance timer
   */
  stopAutoAdvance() {
    if (this.autoAdvanceInterval) {
      clearInterval(this.autoAdvanceInterval);
      this.autoAdvanceInterval = null;
      logger.debug('Auto-advance stopped');
    }
  }

  /**
   * Update transition time
   */
  updateTransitionTime(seconds) {
    this.transitionTime = seconds * 1000;
    logger.info('Transition time updated', { seconds });

    if (this.autoAdvanceInterval) {
      this.startAutoAdvance();
    }
  }

  /**
   * Detect and apply initial theme from parent or localStorage
   */
  detectAndApplyInitialTheme() {
    let detectedTheme = null;

    // Try to get theme from parent window first (since we're in an iframe)
    try {
      if (window.parent && window.parent !== window && window.parent.document) {
        const parentBody = window.parent.document.body;
        if (parentBody.classList.contains('theme-light')) {
          detectedTheme = 'light';
        } else if (parentBody.classList.contains('theme-dark')) {
          detectedTheme = 'dark';
        }
      }
    } catch (e) {
      // Cross-origin error - can't access parent
      logger.debug('Cannot access parent window for theme detection');
    }

    // Fallback: try localStorage
    if (!detectedTheme) {
      try {
        const savedTheme = localStorage.getItem('dashie-theme');
        if (savedTheme === 'light' || savedTheme === 'dark') {
          detectedTheme = savedTheme;
        }
      } catch (e) {
        logger.debug('Cannot read theme from localStorage');
      }
    }

    // Apply detected theme or default to light
    const theme = detectedTheme || 'light';
    this.applyTheme(theme);
    logger.debug('Initial theme applied', { theme });
  }

  /**
   * Apply theme to widget
   * @param {string} theme - Theme name ('light' or 'dark')
   */
  applyTheme(theme) {
    // Remove old theme classes
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    document.body.classList.remove('theme-light', 'theme-dark');

    // Add new theme class
    document.documentElement.classList.add(`theme-${theme}`);
    document.body.classList.add(`theme-${theme}`);

    logger.debug('Theme applied to photos widget', { theme });
  }
}

// Auto-initialize when module loads
new PhotosWidget();
