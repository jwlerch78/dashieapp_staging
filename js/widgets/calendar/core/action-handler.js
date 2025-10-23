// js/widgets/Calendar/core/action-handler.js
// Handles all user actions (D-pad, keyboard, touch)

import { createLogger } from '/js/utils/logger.js';
import { TouchButton, LongPressDetector } from '/js/widgets/shared/widget-touch-controls.js';

const logger = createLogger('CalendarActionHandler');

export class CalendarActionHandler {
  constructor(widget) {
    this.widget = widget;
    this.touchButtons = [];
    this.longPressDetector = null;

    // Set up touch controls
    this.setupTouchControls();
  }

  /**
   * Handle action command
   */
  handleAction(action) {
    logger.debug('📥 Calendar widget received command', {
      action,
      isFocused: this.widget.focusManager.isFocused,
      menuActive: this.widget.focusManager.menuActive,
      isAtHome: this.widget.focusManager.isAtHome
    });

    // Check if widget is active (able to receive commands)
    if (!this.widget.focusManager.isFocused) {
      logger.warn('⚠️ Command ignored - widget not focused/active', { action });
      return;
    }

    switch (action) {
      case 'left':
        this.handleLeft();
        break;

      case 'right':
        this.handleRight();
        break;

      case 'up':
        this.handleUp();
        break;

      case 'down':
        this.handleDown();
        break;

      case 'select':
      case 'enter':
        this.handleEnter();
        break;

      case 'back':
      case 'escape':
        this.handleEscape();
        break;

      default:
        logger.debug('Calendar widget ignoring command', { action });
        break;
    }
  }

  /**
   * Handle LEFT action
   */
  handleLeft() {
    logger.info('⬅️ LEFT pressed', {
      isAtHome: this.widget.focusManager.isAtHome,
      menuActive: this.widget.focusManager.menuActive,
      shouldReturnToMenu: this.widget.focusManager.isAtHome && !this.widget.focusManager.menuActive
    });

    // If at home position, don't navigate - return to menu instead
    if (this.widget.focusManager.isAtHome && !this.widget.focusManager.menuActive) {
      logger.info('📍 At home position - returning to menu instead of navigating');
      this.widget.focusManager.requestReturnToMenu();
      return;
    }

    // Navigate backward
    logger.info('⬅️ Navigating to previous period');
    this.widget.navigationManager.navigatePrevious();
  }

  /**
   * Handle RIGHT action
   */
  handleRight() {
    // Navigate forward
    this.widget.navigationManager.navigateNext();
  }

  /**
   * Handle UP action
   */
  handleUp() {
    this.widget.navigationManager.scrollCalendar('up');
  }

  /**
   * Handle DOWN action
   */
  handleDown() {
    this.widget.navigationManager.scrollCalendar('down');
  }

  /**
   * Handle ENTER/SELECT action
   */
  handleEnter() {
    logger.debug('Select pressed on calendar view');
    // Future: Could open event details or other interactions
  }

  /**
   * Handle ESCAPE/BACK action
   */
  handleEscape() {
    const timeGrid = document.querySelector('.time-grid');
    if (timeGrid) {
      this.widget.weekly.setOptimalScrollPosition();
    }
  }

  /**
   * Handle touch navigation (bypasses focus check for direct interaction)
   * @param {string} direction - 'previous' or 'next'
   */
  handleTouchNavigation(direction) {
    logger.debug('Touch navigation', { direction });

    if (direction === 'previous') {
      this.widget.navigationManager.navigatePrevious();
    } else if (direction === 'next') {
      this.widget.navigationManager.navigateNext();
    }
  }

  /**
   * Set up touch controls (buttons + long press)
   */
  setupTouchControls() {
    const container = document.body;

    // Previous period button (navigates directly - no focus required)
    const prevButton = new TouchButton({
      id: 'prev',
      position: 'left',
      icon: 'chevron-left',
      ariaLabel: `Previous ${this.widget.navigationManager.currentView}`,
      onClick: () => this.handleTouchNavigation('previous')
    });
    prevButton.appendTo(container);
    this.touchButtons.push(prevButton);

    // Next period button (navigates directly - no focus required)
    const nextButton = new TouchButton({
      id: 'next',
      position: 'right',
      icon: 'chevron-right',
      ariaLabel: `Next ${this.widget.navigationManager.currentView}`,
      onClick: () => this.handleTouchNavigation('next')
    });
    nextButton.appendTo(container);
    this.touchButtons.push(nextButton);

    // Focus mode button (bottom-right)
    const focusButton = new TouchButton({
      id: 'focus',
      position: 'bottom-right',
      icon: 'magnify',
      ariaLabel: 'Expand calendar',
      onClick: () => this.enterFocusMode()
    });
    focusButton.appendTo(container);
    this.touchButtons.push(focusButton);

    // Long press detector (500ms threshold)
    this.longPressDetector = new LongPressDetector(
      container,
      () => this.enterFocusMode(),
      { threshold: 500 }
    );

    logger.debug('Touch controls initialized', { buttonCount: this.touchButtons.length });
  }

  /**
   * Enter focus mode (tell parent to focus this widget)
   */
  enterFocusMode() {
    window.parent.postMessage({
      type: 'event',
      widgetId: 'main',
      payload: {
        eventType: 'enter-focus',
        data: {}
      }
    }, '*');
    logger.debug('Focus mode requested via touch');
  }

  /**
   * Clean up touch controls
   */
  cleanup() {
    // Clean up touch controls
    this.touchButtons.forEach(btn => btn.destroy());
    this.touchButtons = [];
    this.longPressDetector?.destroy();
    this.longPressDetector = null;
  }
}
