// js/utils/modal-navigation-manager.js - Global Modal Navigation System
// CHANGE SUMMARY: Converted to use modal stack instead of single modal to support nested modals (settings → photos)

import { createLogger } from './logger.js';

const logger = createLogger('ModalNavigationManager');

/**
 * Global Modal Navigation Manager - Singleton that integrates with events.js
 * Handles navigation for any active modal and plugs into the priority system
 * Now supports stacked modals (e.g., photos modal on top of settings modal)
 */
class ModalNavigationManager {
  constructor() {
    this.modalStack = []; // Stack of {modal, config, focusableElements, currentIndex}
    
    logger.debug('Global modal navigation manager initialized');
  }

  /**
   * Check if there's an active modal (called by events.js)
   */
  hasActiveModal() {
    const hasModal = this.modalStack.length > 0 &&
           this.modalStack[this.modalStack.length - 1].modal.parentNode !== null;

    console.log('🔷 MODAL MANAGER: hasActiveModal()', {
      hasModal,
      stackDepth: this.modalStack.length,
      stack: this.modalStack.map((entry, i) => ({
        index: i,
        modalId: entry.modal?.id,
        modalClass: entry.modal?.className,
        hasParent: !!entry.modal?.parentNode
      }))
    });

    return hasModal;
  }

  /**
   * Get the current active modal (top of stack)
   */
  get activeModal() {
    return this.modalStack.length > 0 ? this.modalStack[this.modalStack.length - 1].modal : null;
  }

  /**
   * Get the current config (top of stack)
   */
  get config() {
    return this.modalStack.length > 0 ? this.modalStack[this.modalStack.length - 1].config : null;
  }

  /**
   * Get current focusable elements (top of stack)
   */
  get focusableElements() {
    return this.modalStack.length > 0 ? this.modalStack[this.modalStack.length - 1].focusableElements : [];
  }

  /**
   * Get current focus index (top of stack)
   */
  get currentIndex() {
    return this.modalStack.length > 0 ? this.modalStack[this.modalStack.length - 1].currentIndex : 0;
  }

  /**
   * Set current focus index (top of stack)
   */
  set currentIndex(value) {
    if (this.modalStack.length > 0) {
      this.modalStack[this.modalStack.length - 1].currentIndex = value;
    }
  }

  /**
   * Handle navigation action from events.js unified input system
   * @param {string} action - Normalized action from events.js ("up", "down", "enter", "escape")
   * @returns {boolean} True if action was handled, false if should continue to next priority
   */
  handleAction(action) {
    console.log('🔷 MODAL MANAGER: handleAction() called', {
      action,
      hasActiveModal: this.hasActiveModal(),
      stackDepth: this.modalStack.length
    });

    if (!this.hasActiveModal()) {
      logger.warn('handleAction called but no active modal');
      return false;
    }

    // If modal has a custom handler, delegate to it first
    if (this.config && this.config.customHandler) {
      console.log('🔷 MODAL MANAGER: Delegating to custom handler', { action });
      logger.debug('Delegating to custom handler', { action });
      const handled = this.config.customHandler(action);
      console.log('🔷 MODAL MANAGER: Custom handler result', { action, handled });
      if (handled !== undefined) {
        return handled; // Custom handler explicitly handled or didn't handle
      }
      // If custom handler returns undefined, fall through to default handling
    }

    logger.debug('Modal handling action', {
      action,
      currentIndex: this.currentIndex,
      totalElements: this.focusableElements.length,
      focusedElementId: this.focusableElements[this.currentIndex]?.id,
      stackDepth: this.modalStack.length
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

  /**
   * Register a modal with the navigation system
   * @param {HTMLElement} modal - The modal element
   * @param {Object} config - Modal configuration
   */
  registerModal(modal, config) {
    // Safety: Ensure buttons array exists
    if (!config.buttons) {
      config.buttons = [];
    }

    console.log('🔷 MODAL MANAGER: Registering modal', {
      modalId: modal.id,
      modalClass: modal.className,
      stackDepthBefore: this.modalStack.length,
      buttonsCount: config.buttons.length,
      buttonIds: config.buttons.map(b => b.id || b)
    });

    logger.debug('Registering modal', {
      modalClass: modal.className,
      stackDepth: this.modalStack.length,
      buttonsCount: config.buttons.length
    });

    // Create modal entry
    const modalEntry = {
      modal,
      config,
      focusableElements: [],
      currentIndex: config.initialFocus || 0
    };

    // Push to stack
    this.modalStack.push(modalEntry);

    console.log('🔷 MODAL MANAGER: Modal pushed to stack', {
      stackDepthAfter: this.modalStack.length,
      stack: this.modalStack.map((entry, i) => ({
        index: i,
        modalId: entry.modal?.id,
        modalClass: entry.modal?.className
      }))
    });

    // Update focusable elements for this modal
    this.updateFocusableElements();

    // Set initial focus
    if (modalEntry.focusableElements.length > 0) {
      this.updateFocus();
    }

    // Set up cleanup when modal is removed
    this.setupCleanupObserver(modal);

    logger.debug('Modal registered successfully', {
      stackDepth: this.modalStack.length,
      focusableCount: modalEntry.focusableElements.length
    });
  }

  /**
   * Manually unregister the current modal (pops from stack)
   */
  unregisterModal() {
    if (this.modalStack.length === 0) {
      console.log('🔷 MODAL MANAGER: Cannot unregister - stack is empty');
      logger.warn('Attempted to unregister but stack is empty');
      return;
    }

    console.log('🔷 MODAL MANAGER: Unregistering modal', {
      stackDepthBefore: this.modalStack.length,
      topModalId: this.activeModal?.id,
      topModalClass: this.activeModal?.className
    });

    const removed = this.modalStack.pop();

    console.log('🔷 MODAL MANAGER: Modal popped from stack', {
      removedModalId: removed.modal?.id,
      removedModalClass: removed.modal?.className,
      stackDepthAfter: this.modalStack.length,
      remainingStack: this.modalStack.map((entry, i) => ({
        index: i,
        modalId: entry.modal?.id,
        modalClass: entry.modal?.className
      }))
    });

    logger.debug('Unregistered modal', {
      modalClass: removed.modal.className,
      remainingStack: this.modalStack.length
    });

    // If there are still modals in the stack, restore focus to the new top modal
    if (this.modalStack.length > 0) {
      console.log('🔷 MODAL MANAGER: Restored previous modal to top', {
        newTopModalId: this.activeModal?.id,
        newTopModalClass: this.activeModal?.className
      });

      logger.debug('Restored previous modal', {
        modalClass: this.activeModal.className
      });
    }
  }

  updateFocusableElements() {
    if (this.modalStack.length === 0) return;

    const currentEntry = this.modalStack[this.modalStack.length - 1];
    if (!currentEntry.modal || !currentEntry.config) return;

    // Get all buttons defined in config
    currentEntry.focusableElements = currentEntry.config.buttons
      .map(buttonConfig => currentEntry.modal.querySelector(`#${buttonConfig.id}`))
      .filter(button => button !== null);

    logger.debug('Updated focusable elements', {
      count: currentEntry.focusableElements.length,
      ids: currentEntry.focusableElements.map(el => el.id)
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

  setupCleanupObserver(modal) {
    if (!modal) return;

    // Clean up when modal is removed
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (node === modal) {
            // Find and remove this modal from stack
            const index = this.modalStack.findIndex(entry => entry.modal === modal);
            if (index !== -1) {
              this.modalStack.splice(index, 1);
              logger.debug('Modal auto-unregistered after removal', {
                modalClass: modal.className,
                remainingStack: this.modalStack.length
              });
            }
            observer.disconnect();
          }
        });
      });
    });

    observer.observe(document.body, { childList: true });
  }

  /**
   * Debug helper to inspect modal stack state
   */
  getDebugInfo() {
    return {
      stackDepth: this.modalStack.length,
      hasActiveModal: this.hasActiveModal(),
      activeModalClass: this.activeModal?.className,
      activeModalId: this.activeModal?.id,
      activeModalInDOM: this.activeModal?.parentNode !== null,
      configExists: !!this.config,
      onEscape: this.config?.onEscape?.toString().substring(0, 50),
      focusableCount: this.focusableElements?.length || 0,
      stack: this.modalStack.map(entry => ({
        modalClass: entry.modal.className,
        modalId: entry.modal.id,
        focusableCount: entry.focusableElements.length
      }))
    };
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