// js/modules/Modals/modals-input-handler.js
// Handles input for modals (navigation between options, confirmation)

import { createLogger } from '../../utils/logger.js';
import modalsStateManager from './modals-state-manager.js';
import modalsUIRenderer from './modals-ui-renderer.js';

const logger = createLogger('ModalsInputHandler');

class ModalsInputHandler {
  constructor() {
    this.enabled = false;
    this.onConfirmCallback = null;
    this.onCancelCallback = null;
  }

  /**
   * Enable input handling
   * @param {function} onConfirm - Callback when option is confirmed
   * @param {function} onCancel - Callback when modal is cancelled
   */
  enable(onConfirm, onCancel) {
    this.enabled = true;
    this.onConfirmCallback = onConfirm;
    this.onCancelCallback = onCancel;
    logger.debug('Input handler enabled');
  }

  /**
   * Disable input handling
   */
  disable() {
    this.enabled = false;
    this.onConfirmCallback = null;
    this.onCancelCallback = null;
    logger.debug('Input handler disabled');
  }

  /**
   * Handle input action
   * @param {string} action - Action name (up, down, left, right, enter, escape)
   * @returns {boolean} - True if action was handled
   */
  handleAction(action) {
    logger.debug('MODALS INPUT HANDLER: handleAction called', {
      action,
      enabled: this.enabled,
      isModalOpen: modalsStateManager.isModalOpen(),
      currentModal: modalsStateManager.getCurrentModal()
    });

    if (!this.enabled || !modalsStateManager.isModalOpen()) {
      logger.debug('MODALS INPUT HANDLER: Not handling - disabled or no modal open');
      return false;
    }

    const modalType = modalsStateManager.getCurrentModal();
    logger.debug('MODALS INPUT HANDLER: Processing action for modal type:', modalType);

    switch (action) {
      case 'up':
        if (modalType === 'exit' || modalType === 'confirmation') {
          return this.handleUp();
        }
        return false;

      case 'down':
        if (modalType === 'exit' || modalType === 'confirmation') {
          return this.handleDown();
        }
        return false;

      case 'left':
        if (modalType === 'exit' || modalType === 'confirmation') {
          return this.handleLeft();
        }
        return false;

      case 'right':
        if (modalType === 'exit' || modalType === 'confirmation') {
          return this.handleRight();
        }
        return false;

      case 'enter':
        return this.handleEnter();

      case 'escape':
        return this.handleEscape();

      default:
        return false;
    }
  }

  /**
   * Handle up arrow (move to previous option)
   */
  handleUp() {
    if (modalsStateManager.movePrevious()) {
      const modalType = modalsStateManager.getCurrentModal();
      const selectedOption = modalsStateManager.getSelectedOption();

      if (modalType === 'exit') {
        modalsUIRenderer.updateExitHighlight(selectedOption);
      } else if (modalType === 'confirmation') {
        modalsUIRenderer.updateConfirmationHighlight(selectedOption);
      }
      return true;
    }
    return false;
  }

  /**
   * Handle down arrow (move to next option)
   */
  handleDown() {
    if (modalsStateManager.moveNext()) {
      const modalType = modalsStateManager.getCurrentModal();
      const selectedOption = modalsStateManager.getSelectedOption();

      if (modalType === 'exit') {
        modalsUIRenderer.updateExitHighlight(selectedOption);
      } else if (modalType === 'confirmation') {
        modalsUIRenderer.updateConfirmationHighlight(selectedOption);
      }
      return true;
    }
    return false;
  }

  /**
   * Handle left arrow (same as up for exit modal)
   */
  handleLeft() {
    return this.handleUp();
  }

  /**
   * Handle right arrow (same as down for exit modal)
   */
  handleRight() {
    return this.handleDown();
  }

  /**
   * Handle Enter key (confirm selection)
   */
  handleEnter() {
    const modalType = modalsStateManager.getCurrentModal();

    if (modalType === 'sleep') {
      // Wake up from sleep
      if (this.onConfirmCallback) {
        this.onConfirmCallback('wake');
      }
      return true;
    }

    if (modalType === 'exit') {
      const selectedOption = modalsStateManager.getSelectedOption();
      if (this.onConfirmCallback) {
        this.onConfirmCallback(selectedOption);
      }
      return true;
    }

    if (modalType === 'confirmation') {
      const selectedOption = modalsStateManager.getSelectedOption();
      if (this.onConfirmCallback) {
        this.onConfirmCallback(selectedOption);
      }
      return true;
    }

    return false;
  }

  /**
   * Handle Escape key (cancel modal)
   */
  handleEscape() {
    if (this.onCancelCallback) {
      this.onCancelCallback();
    }
    return true;
  }

  /**
   * Check if input handler is enabled
   */
  isEnabled() {
    return this.enabled;
  }
}

// Export singleton
const modalsInputHandler = new ModalsInputHandler();
export default modalsInputHandler;
