// js/modules/Dashboard/dashboard-state-manager.js
// Dashboard state management with localStorage persistence
// v1.0 - 10/16/25 - Initial implementation for Phase 2

import { createLogger } from '../../utils/logger.js';
import { STORAGE_KEYS } from '../../../config.js';

const logger = createLogger('DashboardState');

/**
 * Dashboard State Manager
 *
 * Manages Dashboard-specific state:
 * - Grid position (row, col)
 * - Focused widget
 * - Menu state (open/closed, selected item)
 * - Active status
 *
 * State is persisted to localStorage for continuity across sessions.
 * Uses singleton pattern (static methods only).
 */
class DashboardStateManager {
  static state = {
    gridPosition: { row: 1, col: 1 }, // Current position (always set): rows 1-3, cols 1-2
    focusedWidget: null,
    menuOpen: false,
    selectedMenuItem: 0,
    isActive: false,
    isIdle: true // true = no visual selection (widget-idle), false = show selection
  };

  static isInitialized = false;

  /**
   * Initialize state manager
   * Loads persisted state from localStorage if available
   * @returns {Promise<boolean>} Success status
   */
  static async initialize() {
    try {
      logger.verbose('Initializing Dashboard state manager...');

      // Load persisted state
      this.loadState();

      this.isInitialized = true;

      logger.verbose('Dashboard state initialized', { state: this.state });
      return true;
    } catch (error) {
      logger.error('Failed to initialize Dashboard state', error);
      return false;
    }
  }

  /**
   * Get current Dashboard state
   * @returns {Object} Copy of current state
   */
  static getState() {
    return { ...this.state };
  }

  /**
   * Update Dashboard state
   * @param {Object} partialState - Partial state to merge
   */
  static setState(partialState) {
    if (!partialState || typeof partialState !== 'object') {
      logger.warn('Invalid state update', { partialState });
      return;
    }

    const oldState = { ...this.state };
    this.state = { ...this.state, ...partialState };

    logger.debug('State updated', {
      changed: Object.keys(partialState),
      newState: this.state
    });

    // Persist to localStorage
    this.persist();

    return this.state;
  }

  /**
   * Update grid position
   * @param {number} row - Row index (1-3)
   * @param {number} col - Column index (1-2)
   */
  static setGridPosition(row, col) {
    // Validate bounds (1-indexed)
    if (row < 1 || row > 3 || col < 1 || col > 2) {
      logger.warn('Invalid grid position', { row, col });
      return;
    }

    this.setState({
      gridPosition: { row, col }
    });
  }

  /**
   * Update menu state
   * @param {boolean} isOpen - Menu open status
   * @param {number} selectedItem - Selected menu item index (0-6)
   */
  static setMenuState(isOpen, selectedItem = null) {
    const update = { menuOpen: isOpen };

    if (selectedItem !== null) {
      // Validate bounds (7 menu items: 0-6)
      if (selectedItem >= 0 && selectedItem <= 6) {
        update.selectedMenuItem = selectedItem;
      }
    }

    this.setState(update);
  }

  /**
   * Set focused widget
   * @param {string|null} widgetId - Widget ID or null to clear focus
   */
  static setFocusedWidget(widgetId) {
    this.setState({
      focusedWidget: widgetId
    });
  }

  /**
   * Reset state to defaults
   */
  static reset() {
    logger.info('Resetting Dashboard state to defaults');

    this.state = {
      gridPosition: { row: 1, col: 1 }, // 1-indexed
      focusedWidget: null,
      menuOpen: false,
      selectedMenuItem: 0,
      isActive: false
    };

    this.persist();
  }

  /**
   * Persist state to localStorage
   * @private
   */
  static persist() {
    try {
      const stateToSave = {
        selectedMenuItem: this.state.selectedMenuItem
        // Don't persist: gridPosition (always starts at 1,1), menuOpen, focusedWidget, isActive (runtime only)
      };

      localStorage.setItem(
        STORAGE_KEYS.DASHBOARD_STATE,
        JSON.stringify(stateToSave)
      );

      logger.debug('State persisted to localStorage');
    } catch (error) {
      logger.error('Failed to persist state', error);
    }
  }

  /**
   * Load state from localStorage
   * @private
   */
  static loadState() {
    try {
      const savedState = localStorage.getItem(STORAGE_KEYS.DASHBOARD_STATE);

      if (savedState) {
        const parsed = JSON.parse(savedState);

        // Only restore selectedMenuItem (gridPosition always starts at 1,1)
        this.state = {
          ...this.state,
          selectedMenuItem: parsed.selectedMenuItem || this.state.selectedMenuItem
        };

        logger.info('State loaded from localStorage', { state: this.state });
      } else {
        logger.info('No saved state found, using defaults');
      }
    } catch (error) {
      logger.error('Failed to load state from localStorage', error);
    }
  }

  /**
   * Get statistics
   * @returns {Object} State statistics
   */
  static getStats() {
    return {
      isInitialized: this.isInitialized,
      currentState: this.getState()
    };
  }
}

// =============================================================================
// EXPOSE GLOBALLY FOR DEBUGGING
// =============================================================================

if (typeof window !== 'undefined') {
  window.DashboardStateManager = DashboardStateManager;
}

// =============================================================================
// EXPORT
// =============================================================================

export default DashboardStateManager;
