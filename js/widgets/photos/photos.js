// js/widgets/photos/photos.js
// Photos Widget - Ported from .legacy/widgets/photos
// v2.1 - 10/20/25 - Improved theme detection robustness

import { createLogger } from '/js/utils/logger.js';
import { detectCurrentTheme, applyThemeToWidget } from '/js/widgets/shared/widget-theme-detector.js';

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

    // Failure tracking (circuit breaker)
    this.consecutiveFailures = 0;
    this.maxConsecutiveFailures = 10; // Stop after 10 consecutive failures
    this.retryTimeout = null; // Timeout for retrying after circuit breaker

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

    logger.debug('PhotosWidget initialized');
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
        type: 'widget-ready',
        widget: 'photos',
        widgetId: 'photos',
        hasMenu: this.focusMenu.enabled
      }, '*');
      logger.debug('Ready signal sent to parent');
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
        logger.debug('Photos data message received', { payload: data.payload.payload });
        this.loadPhotosFromData(data.payload.payload);
        return;
      }

      // Handle theme updates
      if (data.type === 'theme-change' && data.theme) {
        this.applyTheme(data.theme);
        return;
      }

      // Handle state updates (includes settings, theme, etc.)
      if (data.type === 'data' && data.action === 'state-update' && data.payload) {
        logger.info('📥 State update received', {
          hasSettings: !!data.payload.settings,
          hasPhotosSettings: !!data.payload.settings?.photos,
          transitionTime: data.payload.settings?.photos?.transitionTime,
          currentTransitionTime: this.transitionTime
        });

        // Handle settings updates
        if (data.payload.settings?.photos?.transitionTime) {
          this.updateTransitionTime(data.payload.settings.photos.transitionTime);
        } else {
          logger.warn('⚠️ No photos.transitionTime in settings', {
            settingsKeys: data.payload.settings ? Object.keys(data.payload.settings) : null
          });
        }
        return;
      }

      // Legacy: Handle direct settings updates (backwards compatibility)
      if (data.type === 'settings-update') {
        if (data.transitionTime) {
          this.updateTransitionTime(data.transitionTime);
        }
        return;
      }
    });

    logger.debug('Message listener set up');
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

      // Reset failure counter when loading new photos
      this.consecutiveFailures = 0;
      this.clearRetryTimeout();

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
      // Reset failure counter on successful load
      this.consecutiveFailures = 0;
      this.clearRetryTimeout();

      this.loadingDiv.style.display = 'none';
      this.emptyStateDiv.style.display = 'none';
      this.photoImg.style.display = 'block';

      if (this.isTransitioning) {
        // Wait a frame for the image to render, then fade in
        requestAnimationFrame(() => {
          this.photoImg.classList.remove('transitioning');
          this.isTransitioning = false;
        });
      }

      logger.debug('Photo displayed', {
        index: this.currentPhotoIndex,
        total: this.photoUrls.length
      });
    };

    this.photoImg.onerror = () => {
      this.consecutiveFailures++;
      logger.error('Failed to load photo', {
        url: photoUrl,
        consecutiveFailures: this.consecutiveFailures,
        maxFailures: this.maxConsecutiveFailures
      });

      // Circuit breaker: Stop if we've failed too many times
      if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
        logger.error('Too many consecutive photo load failures - stopping slideshow');
        this.stopAutoAdvance();
        this.showError('Unable to load photos. Please check your internet connection or photo storage.');

        // Schedule a retry in 30 seconds
        this.scheduleRetry();
        return;
      }

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
    logger.debug('Transition time updated', { seconds });

    if (this.autoAdvanceInterval) {
      this.startAutoAdvance();
    }
  }

  /**
   * Schedule a retry after circuit breaker triggers
   */
  scheduleRetry() {
    this.clearRetryTimeout();

    logger.info('Scheduling photo retry in 30 seconds...');
    this.retryTimeout = setTimeout(() => {
      logger.info('Retrying photo load after circuit breaker cooldown');
      this.consecutiveFailures = 0;

      // Try to show photos again if we have URLs
      if (this.photoUrls.length > 0) {
        this.currentPhotoIndex = 0;
        this.showPhoto(0, false);
        this.startAutoAdvance();
      }
    }, 30000); // 30 seconds
  }

  /**
   * Clear retry timeout if it exists
   */
  clearRetryTimeout() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
      logger.debug('Retry timeout cleared');
    }
  }

  /**
   * Detect and apply initial theme from parent or localStorage
   */
  detectAndApplyInitialTheme() {
    const theme = detectCurrentTheme('light');
    this.applyTheme(theme);
    logger.debug('Initial theme detected and applied', { theme });
  }

  /**
   * Apply theme to widget
   * @param {string} theme - Theme name (e.g., 'light', 'dark', 'halloween-dark')
   */
  applyTheme(theme) {
    // Use utility to apply theme classes (removes all existing theme classes automatically)
    applyThemeToWidget(theme);

    logger.debug('Theme applied to photos widget', { theme });
  }
}

// Auto-initialize when module loads
new PhotosWidget();
