// js/settings/settings-input-handler.js - Unified Settings Input Handler
// CHANGE SUMMARY: Initial creation - consolidates keyboard/d-pad and mouse input handling for settings
// v2.0: code refactoring to use modular approach

import { createLogger } from '../utils/logger.js';
import { InputActions } from '../control/input-handler.js';

const logger = createLogger('SettingsInputHandler');

// ---------------------
// SETTINGS INPUT HANDLER
// ---------------------

/**
 * Unified input handler for settings interface
 * Receives normalized actions from dispatcher and routes to navigation methods
 */
export class SettingsInputHandler {
  constructor(settingsInstance) {
    this.settings = settingsInstance;
    this.navigation = null; // Will be set when settings opens
    this.overlay = null;
    
    logger.info('SettingsInputHandler created');
  }

  /**
   * Initialize with navigation instance
   * Called when settings overlay is created
   */
  initialize(navigation, overlay) {
    this.navigation = navigation;
    this.overlay = overlay;
    logger.info('SettingsInputHandler initialized');
  }

  /**
   * Main action handler - called by action dispatcher
   * @param {string} action - Normalized action string
   * @param {object} normalizedInput - Full normalized input data
   * @returns {boolean} True if handled
   */
  async handleAction(action, normalizedInput) {
    if (!this.navigation || !this.overlay) {
      logger.warn('Settings not initialized, cannot handle action:', action);
      return false;
    }

    const { source, metadata } = normalizedInput;

    // Handle mouse clicks separately
    if (source === 'mouse' && action === InputActions.CLICK) {
      return this.handleMouseClick(normalizedInput);
    }

    // Handle keyboard/d-pad actions
    return this.handleNavigationAction(action, normalizedInput);
  }

  /**
   * Handle keyboard/d-pad navigation actions
   * @private
   */
  handleNavigationAction(action, normalizedInput) {
    const { originalEvent } = normalizedInput;

    // Check if user is typing in a text field
    if (this.isTextInputActive(originalEvent)) {
      return this.handleTextInputAction(action, originalEvent);
    }

    // Route action to appropriate navigation method
    switch (action) {
      case InputActions.UP:
        this.navigation.moveFocus(-1);
        return true;

      case InputActions.DOWN:
        this.navigation.moveFocus(1);
        return true;

      case InputActions.LEFT:
      case InputActions.RIGHT:
        // Left/right not used in settings vertical navigation
        return false;

      case InputActions.ENTER:
        this.navigation.activateCurrentElement();
        return true;

      case InputActions.ESCAPE:
      case InputActions.BACK:
        return this.handleBack();

      case InputActions.MENU:
        // Menu key in settings - could close settings or be ignored
        return false;

      default:
        logger.debug('Unhandled navigation action in settings:', action);
        return false;
    }
  }

  /**
   * Handle back/escape action
   * @private
   */
  handleBack() {
    const isRootScreen = this.navigation.getCurrentScreenId() === 'root';

    if (isRootScreen) {
      logger.debug('Back on root screen - closing settings');
      this.settings.handleCancel();
      return true;
    } else {
      logger.debug('Back button - navigating to previous screen');
      this.navigation.navigateBack();
      return true;
    }
  }

  /**
   * Check if a text input is currently active
   * @private
   */
  isTextInputActive(originalEvent) {
    if (!originalEvent) return false;

    const activeElement = document.activeElement;
    return activeElement &&
           activeElement.classList.contains('form-control') &&
           (activeElement.type === 'text' || activeElement.type === 'number');
  }

  /**
   * Handle actions when text input is focused
   * @private
   */
  handleTextInputAction(action, originalEvent) {
    const activeElement = document.activeElement;

    // Allow up/down to navigate out of text fields
    if (action === InputActions.UP || action === InputActions.DOWN) {
      logger.debug('Arrow key while typing - allowing navigation');
      return true; // Let navigation handler process it
    }

    // Escape blurs the input
    if (action === InputActions.ESCAPE) {
      logger.debug('Escape while typing - blurring input');
      activeElement.blur();
      this.navigation.updateFocus();
      return true;
    }

    // All other keys - let browser handle text editing
    logger.debug('Text editing key - not handling');
    return false;
  }

  /**
   * Handle mouse click events
   * @private
   */
  handleMouseClick(normalizedInput) {
    const { metadata } = normalizedInput;
    const target = metadata.target;

    // Navigation cell clicks
    const navCell = target.closest('.settings-cell[data-navigate]');
    if (navCell && !navCell.classList.contains('action-cell')) {
      return this.handleNavigationCellClick(navCell);
    }

    // Back button clicks
    const backBtn = target.closest('.nav-back-button');
    if (backBtn) {
      return this.handleBackButtonClick();
    }

    // Selectable cell clicks (options, toggles, etc)
    const selectableCell = target.closest('.settings-cell.selectable');
    if (selectableCell) {
      return this.handleSelectableCellClick(selectableCell);
    }

    // Form control changes
    const formControl = target.closest('.form-control');
    if (formControl) {
      return this.handleFormControlClick(formControl);
    }

    // Photos button click
    const photosBtn = target.closest('#photos-menu-btn');
    if (photosBtn) {
      return this.handlePhotosButtonClick();
    }

    // Calendar item clicks (from dcal settings)
    const calendarItem = target.closest('.calendar-item');
    if (calendarItem) {
      calendarItem.click();
      return true;
    }

    // Account type option clicks
    const accountTypeOption = target.closest('.account-type-option');
    if (accountTypeOption) {
      accountTypeOption.click();
      return true;
    }

    logger.debug('Click not handled by settings:', target.tagName);
    return false;
  }

  /**
   * Handle navigation cell click (navigates to another screen)
   * @private
   */
  handleNavigationCellClick(cell) {
    const targetScreen = cell.dataset.navigate;
    logger.debug('Navigating to screen:', targetScreen);

    this.navigation.navigateToScreen(targetScreen);

    // Special handling for system-status screen
    if (targetScreen === 'system-status') {
      setTimeout(() => {
        const { populateSystemStatus } = require('./settings-ui-builder.js');
        populateSystemStatus(this.overlay);
      }, 350);
    }

    // Update selection highlights after navigation
    setTimeout(() => {
      this.navigation.selectionHandler.highlightCurrentSelections(
        this.overlay,
        this.navigation.getCurrentScreenId()
      );
    }, 350);

    return true;
  }

  /**
   * Handle back button click
   * @private
   */
  handleBackButtonClick() {
    const isRootScreen = this.navigation.navigationStack[
      this.navigation.navigationStack.length - 1
    ] === 'root';

    if (isRootScreen) {
      logger.debug('Back button on root - closing settings');
      this.settings.handleCancel();
    } else {
      logger.debug('Back button - navigating back');
      this.navigation.navigateBack();
    }

    return true;
  }

  /**
   * Handle selectable cell click (option selection)
   * @private
   */
  handleSelectableCellClick(cell) {
    // Handle Delete Account screen actions
    const action = cell.dataset.action;
    if (action === 'cancel') {
      logger.debug('Cancel delete account - navigating back');
      this.navigation.navigateBack();
      return true;
    } else if (action === 'confirm') {
      logger.debug('Confirm delete account - showing modal');
      this.settings.showDeleteAccountModal();
      return true;
    }

    // Handle time selection cells
    if (this.navigation.timeHandler.isTimeSelectionCell(cell)) {
      const action = this.navigation.timeHandler.handleSelection(cell);

      logger.debug('Time selection action:', action);

      switch (action.type) {
        case 'navigate':
          this.navigation.navigateToScreen(action.screenId);
          setTimeout(() => {
            this.navigation.selectionHandler.highlightCurrentSelections(
              this.overlay,
              this.navigation.getCurrentScreenId()
            );
          }, 350);
          break;

        case 'complete':
          logger.debug(action.message);

          const section = cell.closest('.settings-section');
          if (section) {
            section.querySelectorAll('.selectable').forEach(c => {
              c.classList.remove('selected');
            });
            cell.classList.add('selected');
          }

          this.settings.handleSettingChange(action.setting, action.value);
          this.navigation.selectionHandler.updateParentDisplayValue(
            action.setting,
            action.value,
            this.overlay
          );

          setTimeout(() => {
            this.navigation.navigateDirectToScreen('interface');
          }, 300);
          break;

        case 'not-time-selection':
          this.navigation.selectionHandler.handleRegularSelection(
            cell,
            this.overlay,
            (setting, value) => {
              this.settings.handleSettingChange(setting, value);
            }
          );
          break;

        case 'error':
          logger.error('Time selection error:', action.message);
          break;
      }

      return true;
    }

    // Regular selection handling
    this.navigation.selectionHandler.handleRegularSelection(
      cell,
      this.overlay,
      (setting, value) => {
        this.settings.handleSettingChange(setting, value);
      }
    );

    return true;
  }

  /**
   * Handle form control clicks/changes
   * @private
   */
  handleFormControlClick(control) {
    // Form controls handle their own change events
    // We just need to ensure they're properly wired
    logger.debug('Form control interaction:', control.dataset.setting);
    return true;
  }

  /**
   * Handle photos settings button click
   * @private
   */
  handlePhotosButtonClick() {
    logger.debug('Photos menu clicked - opening photos settings modal');

    if (window.photosSettingsManager) {
      window.photosSettingsManager.open();
    } else {
      logger.error('PhotosSettingsManager not available');
      alert('Photo settings not available yet. Please wait a moment and try again.');
    }

    return true;
  }

  /**
   * Clean up handler
   */
  destroy() {
    this.navigation = null;
    this.overlay = null;
    logger.info('SettingsInputHandler destroyed');
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      hasNavigation: !!this.navigation,
      hasOverlay: !!this.overlay,
      currentScreen: this.navigation?.getCurrentScreenId() || 'none',
      isInitialized: !!(this.navigation && this.overlay)
    };
  }
}