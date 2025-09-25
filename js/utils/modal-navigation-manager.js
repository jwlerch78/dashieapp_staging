// js/utils/modal-navigation-manager.js - Unified Modal Navigation System
// CHANGE SUMMARY: New modal navigation manager that integrates with existing events.js system for consistent d-pad/keyboard navigation

import { createLogger } from './logger.js';

const logger = createLogger('ModalNavigationManager');

/**
 * Unified Modal Navigation Manager
 * Integrates with existing events.js system for consistent navigation across all modals
 */
export class ModalNavigationManager {
  constructor(modal, config) {
    this.modal = modal;
    this.config = config;
    this.focusableElements = [];
    this.currentIndex = 0;
    this.isActive = false;
    
    // Bind methods to maintain context
    this.handleKeydown = this.handleKeydown.bind(this);
    this.cleanup = this.cleanup.bind(this);
    
    this.initialize();
  }

  initialize() {
    logger.debug('Initializing modal navigation', {
      modalClass: this.modal.className,
      config: this.config
    });

    // Find all focusable elements in the modal
    this.updateFocusableElements();
    
    // Set initial focus
    if (this.focusableElements.length > 0) {
      this.currentIndex = this.config.initialFocus || 0;
      this.updateFocus();
    }

    // Set up high-priority event capture (same pattern as settings)
    document.addEventListener('keydown', this.handleKeydown, true);
    
    // Set up cleanup when modal is removed
    this.setupCleanupObserver();
    
    this.isActive = true;
    logger.debug('Modal navigation initialized', {
      focusableCount: this.focusableElements.length,
      initialIndex: this.currentIndex
    });
  }

  updateFocusableElements() {
    // Get all buttons defined in config
    this.focusableElements = this.config.buttons
      .map(buttonConfig => this.modal.querySelector(`#${buttonConfig.id}`))
      .filter(button => button !== null);

    logger.debug('Updated focusable elements', {
      count: this.focusableElements.length,
      ids: this.focusableElements.map(el => el.id)
    });
  }

  handleKeydown(event) {
    // Only handle if this modal is active
    if (!this.isActive || !this.modal.parentNode) {
      return;
    }

    // Convert keyboard event to action (using same logic as events.js)
    const action = this.getActionFromKeyboardEvent(event);
    if (!action) return;

    logger.debug('Modal navigation key', {
      key: event.key,
      action: action,
      currentIndex: this.currentIndex,
      totalElements: this.focusableElements.length
    });

    // Handle the action
    if (this.handleNavigationAction(action)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }

  getActionFromKeyboardEvent(event) {
    // Same mapping as events.js for consistency
    const keyMap = {
      "ArrowUp": "up",
      "ArrowDown": "down",
      "ArrowLeft": "left", 
      "ArrowRight": "right",
      "Enter": "enter",
      "Escape": "escape",
      "Backspace": "escape"
    };
    
    // Also handle Fire TV specific keys
    const codeMap = {
      8: "escape",    // Backspace
      27: "escape",   // Escape
      461: "escape"   // Fire TV Back button
    };

    return keyMap[event.key] || codeMap[event.keyCode] || null;
  }

  handleNavigationAction(action) {
    switch (action) {
      case "up":
        this.moveFocus(-1);
        return true;
      case "down":
        this.moveFocus(1);
        return true;
      case "left":
        // For horizontal layouts, treat left/right as up/down
        if (this.config.horizontalNavigation) {
          this.moveFocus(-1);
          return true;
        }
        break;
      case "right":
        // For horizontal layouts, treat left/right as up/down  
        if (this.config.horizontalNavigation) {
          this.moveFocus(1);
          return true;
        }
        break;
      case "enter":
        this.activateCurrentElement();
        return true;
      case "escape":
        this.handleEscape();
        return true;
    }
    return false;
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
    
    if (this.config.onEscape) {
      this.config.onEscape();
    } else {
      // Default: close modal
      this.modal.remove();
    }
  }

  setupCleanupObserver() {
    // Clean up when modal is removed (same pattern as existing code)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (node === this.modal) {
            this.cleanup();
            observer.disconnect();
          }
        });
      });
    });
    
    observer.observe(document.body, { childList: true });
  }

  cleanup() {
    logger.debug('Cleaning up modal navigation');
    
    this.isActive = false;
    document.removeEventListener('keydown', this.handleKeydown, true);
    
    logger.debug('Modal navigation cleaned up');
  }

  // Public method to manually cleanup
  destroy() {
    this.cleanup();
  }
}

/**
 * Helper function to create modal navigation for redirect-style modals
 * @param {HTMLElement} modal - The modal element
 * @param {Array} buttons - Array of button configs [{id, action}]
 * @param {Object} options - Additional options
 */
export function createRedirectModalNavigation(modal, buttons, options = {}) {
  const config = {
    buttons: buttons,
    initialFocus: 0,
    horizontalNavigation: false,
    onEscape: options.onEscape || (() => modal.remove()),
    ...options
  };

  return new ModalNavigationManager(modal, config);
}