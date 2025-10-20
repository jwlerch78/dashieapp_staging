// widgets/photos/photos-settings-manager.js
// v1.2 - 10/12/25 9:35pm - FIXED: Changed handleAction to customHandler for proper modal manager integration
// v1.1 - 10/12/25 8:30pm - FIXED: Register with modal manager to forward Fire TV back button (keycode 4) to iframe
// CHANGE SUMMARY: Fixed property name from handleAction to customHandler to match modal manager API

import { createLogger } from '../../js/utils/logger.js';

const logger = createLogger('PhotosSettingsManager');

/**
 * PhotosSettingsManager - Manages the photos settings modal iframe
 * Handles loading the iframe, passing userId, and coordinating navigation
 */
export class PhotosSettingsManager {
  constructor(photoDataService) {
    this.photoDataService = photoDataService;
    this.modalIframe = null;
    this.modalContainer = null;
    this.isOpen = false;
    this.iframeReady = false;
    
    logger.info('PhotosSettingsManager initialized');
    
    // Listen for messages from the modal iframe
    this.setupMessageListener();
  }

  setupMessageListener() {
    window.addEventListener('message', (event) => {
      const data = event.data;
      
      if (data?.type === 'photos-modal-ready') {
        logger.debug('Photos modal iframe signaled ready');
        this.iframeReady = true;
        this.sendInitializationData();
      } else if (data?.type === 'close-photos-modal') {
        logger.debug('Photos modal requested close');
        this.close();
      } else if (data?.type === 'photos-uploaded') {
        logger.info('Photos uploaded - triggering data refresh');

        // Use new WidgetDataManager to refresh photos
        if (window.widgetDataManager) {
          window.widgetDataManager.loadPhotosData().catch(err => {
            logger.error('Failed to refresh photos after upload', err);
          });
        } else if (window.dataManager) {
          // Fallback to legacy DataManager for backwards compatibility
          window.dataManager.refreshPhotosData(true).catch(err => {
            logger.error('Failed to refresh photos after upload (legacy)', err);
          });
        } else {
          logger.warn('No data manager available for photo refresh');
        }
      }
    });
  }

  /**
   * Open the photos settings modal
   */
  async open() {
    if (this.isOpen) {
      logger.warn('Photos modal already open');
      return;
    }

    // Check if photo service is ready
    if (!this.photoDataService || !this.photoDataService.isReady()) {
      logger.warn('Photo service not ready - showing user message');
      alert('Photo settings are not ready yet. The photo service is still initializing. Please wait a moment and try again.');
      return;
    }

    logger.info('Opening photos settings modal');
    this.isOpen = true;
    this.iframeReady = false;

    // Create modal container and iframe
    this.createModal();

    // Register with modal manager AFTER next paint to ensure DOM is ready (critical for slow devices)
    requestAnimationFrame(() => {
      if (window.dashieModalManager) {
        window.dashieModalManager.registerModal(this.modalContainer, {
          buttons: [], // No buttons in container, iframe handles its own navigation
          customHandler: (action) => {
            // Check if a confirmation modal is open - if so, don't handle input here
            // Let it propagate to the Modals module instead
            const hasModalsModule = !!window.modals;
            const isModalOpen = window.modals ? window.modals.isModalOpen() : false;

            console.log('🔵 PHOTOS MODAL customHandler:', {
              action,
              hasModalsModule,
              isModalOpen,
              willHandle: !isModalOpen
            });

            if (window.modals && window.modals.isModalOpen()) {
              console.log('🔵 PHOTOS MODAL: Confirmation modal open - not handling action', { action });
              logger.debug('Confirmation modal open - not handling action', { action });
              return false; // Let Modals module handle it
            }

            console.log('🔵 PHOTOS MODAL: Forwarding action to iframe', { action });
            logger.debug('Modal manager forwarding action to iframe', { action });

            // Forward action to iframe via postMessage
            if (this.modalIframe && this.modalIframe.contentWindow) {
              this.modalIframe.contentWindow.postMessage({ action }, '*');
              return true; // Action handled
            }

            return false; // Action not handled
          },
          onEscape: () => {
            // Check if confirmation modal is open - if so, don't close photos modal
            if (window.modals && window.modals.isModalOpen()) {
              logger.debug('Confirmation modal open - not closing photos modal on escape');
              return;
            }

            logger.debug('Modal manager escape - closing modal');
            this.close();
          }
        });

        logger.debug('Registered photos modal with modal manager');
      }
    });
  }

  /**
   * Create the modal DOM structure with iframe
   */
  createModal() {
    // Remove existing modal if present
    const existing = document.getElementById('photosSettingsModalContainer');
    if (existing) {
      existing.remove();
    }

    // Create modal container
    const container = document.createElement('div');
    container.id = 'photosSettingsModalContainer';
    container.className = 'photos-settings-modal-container';
    
    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'photos-settings-backdrop';
    backdrop.addEventListener('click', () => this.close());
    
    // Create iframe wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'photos-settings-iframe-wrapper';
    
    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.className = 'photos-settings-iframe';
    iframe.src = '.legacy/widgets/photos/photos-settings.html';
    iframe.setAttribute('title', 'Photos Settings');
    
    // Store reference
    this.modalIframe = iframe;
    
    // Add styles
    this.addModalStyles();
    
    // Assemble
    wrapper.appendChild(iframe);
    container.appendChild(backdrop);
    container.appendChild(wrapper);
    document.body.appendChild(container);
    
    this.modalContainer = container;
    
    logger.debug('Modal DOM created');
  }

  /**
   * Send initialization data to the iframe once it signals ready
   */
  sendInitializationData() {
    if (!this.iframeReady || !this.modalIframe) {
      logger.warn('Cannot send initialization - iframe not ready');
      return;
    }

    // Get userId from photoDataService OR fallback to jwtAuth
    let userId = this.photoDataService?.userId;
    
    if (!userId) {
      // Fallback: try to get userId from jwtAuth
      userId = window.jwtAuth?.currentUser?.id;
      
      if (!userId) {
        logger.error('No userId available from photoDataService or jwtAuth');
        alert('Cannot initialize photo settings - user ID not available. Please try again.');
        this.close();
        return;
      }
      
      logger.warn('Using fallback userId from jwtAuth', { userId });
    }

    // Get theme from body class
    const theme = document.body.classList.contains('theme-dark') ? 'dark' : 'light';

    // Get current settings from parent
    const settings = window.parent?.settingsInstance?.controller?.getSettings() || {};

    // Send initialization message to iframe
    const initMessage = {
      type: 'init-photos-modal',
      userId: userId,
      theme: theme,
      settings: settings
    };

    logger.info('Sending initialization data to iframe', { 
      userId: initMessage.userId, 
      theme,
      hasSettings: !!settings.photos
    });
    
    this.modalIframe.contentWindow.postMessage(initMessage, '*');
  }

  /**
   * Add modal styles to document
   */
  addModalStyles() {
    // Check if styles already exist
    if (document.getElementById('photos-settings-modal-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'photos-settings-modal-styles';
    style.textContent = `
      /* Photos Modal Container - Full screen on mobile, centered on desktop */
      .photos-settings-modal-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .photos-settings-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        backdrop-filter: blur(4px);
      }

      .photos-settings-iframe-wrapper {
        position: relative;
        z-index: 1;
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .photos-settings-iframe {
        width: 100%;
        height: 100%;
        border: none;
        border-radius: 0;
        background: #F2F2F7;
        box-shadow: none;
      }

      /* Desktop/larger screens - centered modal */
      @media (min-width: 900px) {
        .photos-settings-iframe-wrapper {
          width: 90%;
          max-width: 500px;
          height: auto;
          max-height: 90vh;
        }

        .photos-settings-iframe {
          width: 100%;
          height: auto;
          min-height: 400px;
          max-height: 90vh;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
      }

      /* Dark theme support */
      body.theme-dark .photos-settings-iframe {
        background: #1a1a1a;
      }
    `;

    document.head.appendChild(style);
    logger.debug('Modal styles added - full screen on mobile');
  }

  /**
   * Close the modal
   */
  close() {
    if (!this.isOpen) {
      return;
    }

    logger.info('Closing photos settings modal');
    this.isOpen = false;
    this.iframeReady = false;

    // Unregister from modal navigation - ALWAYS unregister, don't check hasActiveModal()
    if (window.dashieModalManager) {
      window.dashieModalManager.unregisterModal();
      logger.debug('Unregistered from modal navigation manager');
    }

    // Remove modal from DOM
    if (this.modalContainer) {
      this.modalContainer.remove();
      this.modalContainer = null;
      this.modalIframe = null;
    }

    logger.debug('Photos settings modal closed and cleaned up');
  }
}