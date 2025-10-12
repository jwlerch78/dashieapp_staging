// widgets/photos/photos.js
// v2.0 - 10/11/25 - Updated to 3-state messaging protocol
// CHANGE SUMMARY: Added proper state transition handling (enter-focus/enter-active/exit-active/exit-focus)

import { createLogger } from '../../js/utils/logger.js';
import { DEFAULT_THEME } from '../../js/core/theme.js';


const logger = createLogger('PhotosWidget');

export class PhotosWidget {
  constructor() {
    this.photoUrls = [];
    this.currentPhotoIndex = 0;
    this.autoAdvanceInterval = null;
    this.transitionTime = 5000;
    this.currentFolder = null;
    this.isTransitioning = false;
    this.currentTheme = null;
    
    // NEW: Two-part state model
    this.hasFocus = false;  // FOCUSED state (widget centered, has attention)
    this.isActive = false;  // ACTIVE state (receiving commands)
    
    this.photoContainer = document.getElementById('photo-container');
    this.loadingDiv = document.getElementById('loading');
    this.emptyStateDiv = document.getElementById('empty-state');
    this.photoImg = document.getElementById('photo-display');
    
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
        this.handleEmptyStateClick();
      });
      logger.debug('Empty state click handler attached');
    }
  }

  /**
   * Handle empty state click - open photos settings and trigger upload
   */
  handleEmptyStateClick() {
    logger.info('Empty state clicked - opening photos settings');
    
    // Send message to parent to open photos settings modal
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'open-photos-settings-and-upload'
      }, '*');
    }
  }

  /**
   * Signal ready to parent
   */
  signalReady() {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'widget-ready',
        widget: 'photos'
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

      // Handle navigation commands (action without type)
      if (data.action && typeof data.action === 'string' && !data.type) {
        this.handleCommand(data.action);
        return;
      }

      // Handle system messages with type
      if (data.type) {
        this.handleSystemMessage(data);
      }
    });

    logger.debug('Message listener set up');
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

   // Load initial transition time setting from parent
          if (window.parent && window.parent.settingsInstance) {
            try {
              const transitionTime = window.parent.settingsInstance.getSetting('photos.transitionTime', 5);
              if (transitionTime && transitionTime !== 5) {
                this.updateTransitionTime(transitionTime);
                logger.info('Applied initial transition time from settings', { 
                  transitionTime 
                });
              }
            } catch (error) {
              logger.warn('Failed to get initial photos settings', error);
            }
          }
        }
        break;

      case 'theme-change':
        this.applyTheme(data.theme);
        break;

        case 'update-settings':
          console.log('📸 Widget received update-settings message:', data);
          if (data.photoTransitionTime) {
            console.log('📸 Calling updateTransitionTime with:', data.photoTransitionTime);
            this.updateTransitionTime(data.photoTransitionTime);
          } else {
            console.warn('📸 No photoTransitionTime in message');
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
        logger.warn('No photos available - showing empty state');
        this.loadingDiv.style.display = 'none';
        this.photoImg.style.display = 'none';
        this.emptyStateDiv.style.display = 'flex';
        return;
      }

      logger.success('Photos loaded from parent', { count: this.photoUrls.length });

      // Hide empty state, show photos
      this.emptyStateDiv.style.display = 'none';
      this.loadingDiv.style.display = 'none';

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
      this.emptyStateDiv.style.display = 'none';
    }
  }

  /**
   * Handle navigation commands
   */
  handleCommand(action) {
    logger.debug('Photos widget received command', { 
      action,
      hasFocus: this.hasFocus,
      isActive: this.isActive 
    });

    // STEP 1: Handle state transition messages
    switch (action) {
      case 'enter-focus':
        // Widget is now FOCUSED (centered, has attention)
        this.handleEnterFocus();
        return;

      case 'enter-active':
        // Widget is now ACTIVE (can receive navigation)
        this.handleEnterActive();
        return;

      case 'exit-active':
        // Widget no longer active (shouldn't happen for widgets without menus)
        this.handleExitActive();
        return;

      case 'exit-focus':
        // Leave centered view entirely
        this.handleExitFocus();
        return;
    }

    // STEP 2: Handle navigation ONLY if ACTIVE
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
      case 'select':
      case 'enter':
        // If no photos, open settings; otherwise request upload modal
        if (this.photoUrls.length === 0) {
          this.handleEmptyStateClick();
        } else if (window.parent !== window) {
          window.parent.postMessage({
            type: 'request-upload-modal',
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
   * State transition handlers
   */
  handleEnterFocus() {
    logger.info('Photos entered FOCUSED state');
    this.hasFocus = true;
    this.isActive = false;
    document.body.classList.add('widget-focused');
  }

  handleEnterActive() {
    logger.info('Photos entered ACTIVE state');
    this.isActive = true;
    
    // If focused and no photos, open settings immediately
    if (this.photoUrls.length === 0) {
      logger.info('Widget active with no photos - opening settings');
      this.handleEmptyStateClick();
    }
  }

  handleExitActive() {
    logger.info('Photos exited ACTIVE state');
    this.isActive = false;
  }

  handleExitFocus() {
    logger.info('Photos exited FOCUSED state');
    this.hasFocus = false;
    this.isActive = false;
    document.body.classList.remove('widget-focused');
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
      this.showPhoto(this.currentPhotoIndex + 1);
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
}

// Auto-initialize when module loads
new PhotosWidget();