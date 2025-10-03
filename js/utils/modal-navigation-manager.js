// js/utils/modal-navigation-manager.js - Global Modal Navigation System
// CHANGE SUMMARY: Redesigned to integrate with events.js priority system as global singleton

import { createLogger } from './logger.js';

const logger = createLogger('ModalNavigationManager');

/**
 * Global Modal Navigation Manager - Singleton that integrates with events.js
 * Handles navigation for any active modal and plugs into the priority system
 */
class ModalNavigationManager {
  constructor() {
    this.activeModal = null;
    this.config = null;
    this.focusableElements = [];
    this.currentIndex = 0;
    
    logger.debug('Global modal navigation manager initialized');
  }

  /**
   * Check if there's an active modal (called by events.js)
   */
  hasActiveModal() {
    return this.activeModal !== null && this.activeModal.parentNode !== null;
  }

  /**
   * Handle navigation action from events.js unified input system
   * @param {string} action - Normalized action from events.js ("up", "down", "enter", "escape")
   * @returns {boolean} True if action was handled, false if should continue to next priority
   */
// js/utils/modal-navigation-manager.js
// CHANGE SUMMARY: Added customHandler support for complex modals like settings that need special input handling

// UPDATE the handleAction method to check for customHandler:

handleAction(action) {
  if (!this.hasActiveModal()) {
    logger.warn('handleAction called but no active modal');
    return false;
  }

  // NEW: If modal has a custom handler, delegate to it first
  if (this.config && this.config.customHandler) {
    logger.debug('Delegating to custom handler', { action });
    const handled = this.config.customHandler(action);
    if (handled !== undefined) {
      return handled; // Custom handler explicitly handled or didn't handle
    }
    // If custom handler returns undefined, fall through to default handling
  }

  logger.debug('Modal handling action', {
    action,
    currentIndex: this.currentIndex,
    totalElements: this.focusableElements.length,
    focusedElementId: this.focusableElements[this.currentIndex]?.id
  });

  switch (action) {
    case "up":
      this.moveFocus(-1);
      return true;
    case "down":
      this.moveFocus(1);
      return true;
    case "left":
      // For horizontal layouts, treat left/right as up/down
      if (this.config && this.config.horizontalNavigation) {
        this.moveFocus(-1);
        return true;
      }
      return false; // Let other systems handle if not horizontal
    case "right":
      // For horizontal layouts, treat left/right as up/down  
      if (this.config && this.config.horizontalNavigation) {
        this.moveFocus(1);
        return true;
      }
      return false; // Let other systems handle if not horizontal
    case "enter":
      this.activateCurrentElement();
      return true;
    case "escape":
      this.handleEscape();
      return true;
    default:
      // Unknown action, let other systems handle
      return false;
  }
}

// The rest of the class remains unchanged...

  /**
   * Register a modal with the navigation system
   * @param {HTMLElement} modal - The modal element
   * @param {Object} config - Modal configuration
   */
  registerModal(modal, config) {
    logger.debug('Registering modal', {
      modalClass: modal.className,
      buttonsCount: config.buttons.length
    });

    // Store modal and config
    this.activeModal = modal;
    this.config = config;

    // Find all focusable elements
    this.updateFocusableElements();

    // Set initial focus
    if (this.focusableElements.length > 0) {
      this.currentIndex = this.config.initialFocus || 0;
      this.updateFocus();
    }

    // Set up cleanup when modal is removed
    this.setupCleanupObserver();

    logger.debug('Modal registered successfully', {
      focusableCount: this.focusableElements.length,
      initialIndex: this.currentIndex
    });
  }

  /**
   * Manually unregister the current modal
   */
  unregisterModal() {
    logger.debug('Unregistering modal');
    this.activeModal = null;
    this.config = null;
    this.focusableElements = [];
    this.currentIndex = 0;
  }

  updateFocusableElements() {
    if (!this.activeModal || !this.config) return;

    // Get all buttons defined in config
    this.focusableElements = this.config.buttons
      .map(buttonConfig => this.activeModal.querySelector(`#${buttonConfig.id}`))
      .filter(button => button !== null);

    logger.debug('Updated focusable elements', {
      count: this.focusableElements.length,
      ids: this.focusableElements.map(el => el.id)
    });
  }

  moveFocus(direction) {
    if (this.focusableElements.length === 0) return;

    const oldIndex = this.currentIndex;
    
    if (direction > 0) {
      // Move down/forward
      this.currentIndex = (this.currentIndex + 1) % this.focusableElements.length;
    } else {
      // Move up/backward
      this.currentIndex = this.currentIndex <= 0 ? 
        this.focusableElements.length - 1 : 
        this.currentIndex - 1;
    }

    logger.debug('Focus moved', {
      direction,
      oldIndex,
      newIndex: this.currentIndex,
      elementId: this.focusableElements[this.currentIndex]?.id
    });

    this.updateFocus();
  }

  updateFocus() {
    if (this.focusableElements.length === 0) return;

    // Remove focus from all elements
    this.focusableElements.forEach(el => el.blur());
    
    // Focus current element
    const currentElement = this.focusableElements[this.currentIndex];
    if (currentElement) {
      currentElement.focus();
      logger.debug('Focused element', { 
        id: currentElement.id,
        index: this.currentIndex 
      });
    }
  }

  activateCurrentElement() {
    const currentElement = this.focusableElements[this.currentIndex];
    if (currentElement) {
      logger.debug('Activating element', { 
        id: currentElement.id,
        index: this.currentIndex 
      });
      currentElement.click();
    }
  }

  handleEscape() {
    logger.debug('Escape pressed in modal');
    
    if (this.config && this.config.onEscape) {
      this.config.onEscape();
    } else {
      // Default: close modal
      if (this.activeModal) {
        this.activeModal.remove();
      }
    }
  }

  setupCleanupObserver() {
    if (!this.activeModal) return;

    // Clean up when modal is removed
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (node === this.activeModal) {
            this.unregisterModal();
            observer.disconnect();
            logger.debug('Modal auto-unregistered after removal');
          }
        });
      });
    });
    
    observer.observe(document.body, { childList: true });
  }
}

// Create global singleton instance
const globalModalManager = new ModalNavigationManager();

// Expose to window for events.js integration
window.dashieModalManager = globalModalManager;

/**
 * Helper function to create modal navigation for any simple modal
 * @param {HTMLElement} modal - The modal element
 * @param {Array} buttons - Array of button configs [{id}] or just button IDs as strings
 * @param {Object} options - Additional options
 */
export function createModalNavigation(modal, buttons, options = {}) {
  // Normalize buttons array - handle both [{id: 'btn1'}] and ['btn1', 'btn2'] formats
  const normalizedButtons = buttons.map(button => 
    typeof button === 'string' ? { id: button } : button
  );

  const config = {
    buttons: normalizedButtons,
    initialFocus: options.initialFocus || 0,
    horizontalNavigation: options.horizontalNavigation || false,
    onEscape: options.onEscape || (() => modal.remove()),
    ...options
  };

  // Register with global manager
  globalModalManager.registerModal(modal, config);

  // Return a cleanup function
  return {
    destroy: () => globalModalManager.unregisterModal()
  };
}

// Keep the old name for backward compatibility, but it just calls the new one
export function createRedirectModalNavigation(modal, buttons, options = {}) {
  return createModalNavigation(modal, buttons, options);
}

// Also export the global manager for direct access if needed
export { globalModalManager };