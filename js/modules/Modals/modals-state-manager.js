// js/modules/Modals/modals-state-manager.js
// Manages modal state (which modal is open, selected option, etc.)

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('ModalsStateManager');

class ModalsStateManager {
  constructor() {
    this.state = {
      currentModal: null,        // 'sleep', 'exit', null
      isAuthenticated: false,
      selectedOption: null,       // Current highlighted option
      optionsList: [],            // Available options for current modal
      user: null                  // User data for authenticated exit modal
    };

    this.initialized = false;
  }

  initialize() {
    if (this.initialized) {
      logger.warn('ModalsStateManager already initialized');
      return;
    }

    this.initialized = true;
    logger.info('ModalsStateManager initialized');
  }

  /**
   * Open sleep modal
   */
  openSleep() {
    this.state.currentModal = 'sleep';
    this.state.selectedOption = null;
    this.state.optionsList = [];
    logger.info('Sleep modal state set');
  }

  /**
   * Open exit modal
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @param {object} user - User data (if authenticated)
   */
  openExit(isAuthenticated = false, user = null) {
    this.state.currentModal = 'exit';
    this.state.isAuthenticated = isAuthenticated;
    this.state.user = user;

    if (isAuthenticated) {
      this.state.optionsList = ['logout', 'exit', 'cancel'];
      this.state.selectedOption = 'cancel'; // Default to safe option
    } else {
      this.state.optionsList = ['yes', 'no'];
      this.state.selectedOption = 'no'; // Default to safe option
    }

    logger.info('Exit modal state set', { isAuthenticated, optionsCount: this.state.optionsList.length });
  }

  /**
   * Close current modal
   */
  close() {
    const wasOpen = this.state.currentModal;
    this.state = {
      currentModal: null,
      isAuthenticated: false,
      selectedOption: null,
      optionsList: [],
      user: null
    };

    if (wasOpen) {
      logger.info('Modal state cleared', { previousModal: wasOpen });
    }
  }

  /**
   * Move selection up/left
   */
  movePrevious() {
    if (!this.state.currentModal || this.state.optionsList.length === 0) {
      return false;
    }

    const currentIndex = this.state.optionsList.indexOf(this.state.selectedOption);
    if (currentIndex > 0) {
      this.state.selectedOption = this.state.optionsList[currentIndex - 1];
      logger.debug('Moved to previous option', { option: this.state.selectedOption });
      return true;
    }

    return false;
  }

  /**
   * Move selection down/right
   */
  moveNext() {
    if (!this.state.currentModal || this.state.optionsList.length === 0) {
      return false;
    }

    const currentIndex = this.state.optionsList.indexOf(this.state.selectedOption);
    if (currentIndex < this.state.optionsList.length - 1) {
      this.state.selectedOption = this.state.optionsList[currentIndex + 1];
      logger.debug('Moved to next option', { option: this.state.selectedOption });
      return true;
    }

    return false;
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Check if a modal is open
   */
  isModalOpen() {
    return this.state.currentModal !== null;
  }

  /**
   * Get current modal type
   */
  getCurrentModal() {
    return this.state.currentModal;
  }

  /**
   * Get selected option
   */
  getSelectedOption() {
    return this.state.selectedOption;
  }
}

// Export singleton
const modalsStateManager = new ModalsStateManager();
export default modalsStateManager;
