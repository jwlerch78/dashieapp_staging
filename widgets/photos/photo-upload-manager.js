// widgets/photos/photo-upload-manager.js
// CHANGE SUMMARY: Created manager to handle photo upload modal iframe with proper userId passing via postMessage

import { createLogger } from '../../js/utils/logger.js';

const logger = createLogger('PhotoUploadManager');

/**
 * PhotoUploadManager - Manages the photo upload modal iframe
 * Handles loading the iframe, passing userId, and coordinating with modal navigation
 */
export class PhotoUploadManager {
  constructor(photoDataService) {
    this.photoDataService = photoDataService;
    this.modalIframe = null;
    this.modalContainer = null;
    this.isOpen = false;
    this.iframeReady = false;
    
    logger.info('PhotoUploadManager initialized');
    
    // Listen for messages from the upload modal iframe
    this.setupMessageListener();
  }

  setupMessageListener() {
    window.addEventListener('message', (event) => {
      const data = event.data;
      
      if (data?.type === 'upload-modal-ready') {
        logger.debug('Upload modal iframe signaled ready');
        this.iframeReady = true;
        this.sendInitializationData();
      } else if (data?.type === 'close-upload-modal') {
        logger.debug('Upload modal requested close');
        this.close();
      }
    });
  }

  /**
   * Open the photo upload modal
   */
  async open() {
    if (this.isOpen) {
      logger.warn('Upload modal already open');
      return;
    }

    logger.info('Opening photo upload modal');
    this.isOpen = true;
    this.iframeReady = false;

    // Create modal container and iframe
    this.createModal();

    // Register with modal navigation manager (without buttons initially)
    // The iframe will handle its own internal navigation
    try {
      if (window.dashieModalManager) {
        // Register the container so the modal manager knows a modal is active
        // We pass an empty buttons array since navigation is handled inside the iframe
        window.dashieModalManager.registerModal(this.modalContainer, {
          buttons: [],
          horizontalNavigation: false,
          onEscape: () => this.close()
        });
        logger.debug('Registered with modal navigation manager');
      } else {
        logger.warn('Modal navigation manager not found');
      }
    } catch (error) {
      logger.warn('Failed to register with modal navigation, continuing anyway', error);
    }
  }

  /**
   * Create the modal DOM structure with iframe
   */
  createModal() {
    // Remove existing modal if present
    const existing = document.getElementById('photoUploadModalContainer');
    if (existing) {
      existing.remove();
    }

    // Create modal container
    const container = document.createElement('div');
    container.id = 'photoUploadModalContainer';
    container.className = 'photo-upload-modal-container';
    
    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'photo-upload-backdrop';
    backdrop.addEventListener('click', () => this.close());
    
    // Create iframe wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'photo-upload-iframe-wrapper';
    
    // Create iframe with proper sandbox attributes
    const iframe = document.createElement('iframe');
    iframe.id = 'photoUploadIframe';
    iframe.src = 'widgets/photos/photo-upload.html';
    iframe.className = 'photo-upload-iframe';
    // Sandbox attributes: allow-same-origin for accessing parent, allow-scripts for functionality,
    // allow-modals for prompt/alert, allow-forms for file input
    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-modals allow-forms');
    iframe.setAttribute('title', 'Photo Upload Modal');
    
    wrapper.appendChild(iframe);
    container.appendChild(backdrop);
    container.appendChild(wrapper);
    
    // Add styles
    this.addModalStyles();
    
    // Add to document
    document.body.appendChild(container);
    
    this.modalContainer = container;
    this.modalIframe = iframe;
    
    logger.debug('Modal container and iframe created');
  }

  /**
   * Send initialization data to the iframe once it's ready
   */
  sendInitializationData() {
    if (!this.iframeReady || !this.modalIframe) {
      logger.warn('Cannot send initialization data - iframe not ready');
      return;
    }

    // Get the Supabase UUID from JWT auth
    const userId = window.jwtAuth?.currentUser?.id;
    
    if (!userId) {
      logger.error('Cannot send initialization data - no userId available');
      // Try to get from photoDataService as fallback
      if (this.photoDataService?.userId) {
        logger.info('Using userId from photoDataService', { userId: this.photoDataService.userId });
      } else {
        logger.error('No userId available from any source');
        return;
      }
    }

    // Get current theme
    const theme = document.body.classList.contains('theme-dark') ? 'dark' : 'light';

    // Send initialization message to iframe
    const initMessage = {
      type: 'init-upload-modal',
      userId: userId || this.photoDataService?.userId,
      theme: theme
    };

    logger.info('Sending initialization data to iframe', { userId: initMessage.userId, theme });
    
    this.modalIframe.contentWindow.postMessage(initMessage, '*');
  }

  /**
   * Add modal styles to document
   */
  addModalStyles() {
    // Check if styles already exist
    if (document.getElementById('photo-upload-modal-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'photo-upload-modal-styles';
    style.textContent = `
      .photo-upload-modal-container {
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

      .photo-upload-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
      }

      .photo-upload-iframe-wrapper {
        position: relative;
        z-index: 1;
        width: 90%;
        max-width: 500px;
        max-height: 90vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .photo-upload-iframe {
        width: 100%;
        height: auto;
        min-height: 400px;
        max-height: 90vh;
        border: none;
        border-radius: 12px;
        background: white;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }

      body.theme-dark .photo-upload-iframe {
        background: #1a1a1a;
      }
    `;

    document.head.appendChild(style);
    logger.debug('Modal styles added');
  }

  /**
   * Close the modal
   */
  close() {
    if (!this.isOpen) {
      return;
    }

    logger.info('Closing photo upload modal');
    this.isOpen = false;
    this.iframeReady = false;

    // Unregister from modal navigation
    if (window.dashieModalManager && window.dashieModalManager.hasActiveModal()) {
      window.dashieModalManager.unregisterModal();
    }

    // Remove modal from DOM
    if (this.modalContainer) {
      this.modalContainer.remove();
      this.modalContainer = null;
      this.modalIframe = null;
    }

    logger.debug('Photo upload modal closed');
  }
}