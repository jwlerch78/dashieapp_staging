// js/widgets/shared/widget-touch-controls.js
// Shared touch control utilities for widgets
// Provides TouchButton and LongPressDetector classes for consistent touch interactions

import { createLogger } from '/js/utils/logger.js';

const logger = createLogger('WidgetTouchControls');

/**
 * TouchButton class - Creates themeable circular touch buttons
 * Automatically adapts to current theme using CSS variables
 */
export class TouchButton {
  /**
   * @param {Object} config - Button configuration
   * @param {string} config.id - Unique button identifier
   * @param {string} config.position - Button position ('left', 'right', 'top-right', etc.)
   * @param {string} config.icon - Icon name ('chevron-left', 'chevron-right', 'magnify', etc.)
   * @param {Function} config.onClick - Click handler function
   * @param {string} config.ariaLabel - Accessibility label
   * @param {boolean} [config.enabled=true] - Whether button is enabled
   */
  constructor(config) {
    this.id = config.id;
    this.position = config.position;
    this.icon = config.icon;
    this.onClick = config.onClick;
    this.ariaLabel = config.ariaLabel;
    this.enabled = config.enabled !== false;

    this.element = this.create();
  }

  /**
   * Create button DOM element
   */
  create() {
    const button = document.createElement('button');
    button.id = `touch-btn-${this.id}`;
    button.className = 'widget-touch-button';
    button.setAttribute('data-position', this.position);
    button.setAttribute('aria-label', this.ariaLabel);
    button.disabled = !this.enabled;

    // Add icon SVG
    const iconSVG = this.getIconSVG(this.icon);
    button.innerHTML = iconSVG;

    // Bind click handler
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.enabled && this.onClick) {
        this.onClick(e);

        // Prevent button from stealing keyboard focus (important for ESCAPE key to work)
        button.blur();
      }
    });

    // Prevent touch event propagation to avoid triggering long press
    button.addEventListener('touchstart', (e) => {
      e.stopPropagation();
    });

    return button;
  }

  /**
   * Get SVG markup for standard icons
   * @param {string} icon - Icon name
   * @returns {string} SVG markup
   */
  getIconSVG(icon) {
    const icons = {
      'chevron-left': `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `,
      'chevron-right': `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `,
      'chevron-up': `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 15L12 9L6 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `,
      'chevron-down': `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `,
      'magnify': `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
          <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `,
      'cog': `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
          <path d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `,
      'refresh': `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 2V8H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3 12C3 7.03 7.03 3 12 3C15.39 3 18.31 4.94 19.62 7.76L21 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3 22V16H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 12C21 16.97 16.97 21 12 21C8.61 21 5.69 19.06 4.38 16.24L3 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `
    };

    return icons[icon] || icons['chevron-right'];
  }

  /**
   * Append button to container element
   * @param {HTMLElement} container - Parent container
   */
  appendTo(container) {
    container.appendChild(this.element);
    logger.debug('TouchButton appended', { id: this.id, position: this.position });
  }

  /**
   * Show button
   */
  show() {
    this.element.style.display = 'flex';
  }

  /**
   * Hide button
   */
  hide() {
    this.element.style.display = 'none';
  }

  /**
   * Enable button
   */
  enable() {
    this.enabled = true;
    this.element.disabled = false;
  }

  /**
   * Disable button
   */
  disable() {
    this.enabled = false;
    this.element.disabled = true;
  }

  /**
   * Remove button from DOM and clean up
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.onClick = null;
  }
}

/**
 * LongPressDetector class - Detects long press gestures
 * Used for entering focus mode via long press on widget
 */
export class LongPressDetector {
  /**
   * @param {HTMLElement} element - Element to detect long press on
   * @param {Function} onLongPress - Callback when long press detected
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.threshold=500] - Long press duration in ms
   * @param {number} [options.moveThreshold=10] - Max movement in pixels before canceling
   */
  constructor(element, onLongPress, options = {}) {
    this.element = element;
    this.onLongPress = onLongPress;
    this.threshold = options.threshold || 500; // ms
    this.moveThreshold = options.moveThreshold || 10; // pixels

    this.isPressed = false;
    this.timer = null;
    this.startX = 0;
    this.startY = 0;

    this.bindEvents();
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Touch events
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchCancel = this.handleTouchCancel.bind(this);

    this.element.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEnd);
    this.element.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.element.addEventListener('touchcancel', this.handleTouchCancel);

    // Mouse events (for desktop testing)
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);

    this.element.addEventListener('mousedown', this.handleMouseDown);
    this.element.addEventListener('mouseup', this.handleMouseUp);
    this.element.addEventListener('mousemove', this.handleMouseMove);
  }

  /**
   * Handle touch start
   */
  handleTouchStart(e) {
    // Ignore if touch started on a button
    if (e.target.closest('.widget-touch-button')) {
      return;
    }

    const touch = e.touches[0];
    this.startPress(touch.clientX, touch.clientY);
  }

  /**
   * Handle mouse down
   */
  handleMouseDown(e) {
    // Ignore if mouse down on a button
    if (e.target.closest('.widget-touch-button')) {
      return;
    }

    this.startPress(e.clientX, e.clientY);
  }

  /**
   * Start long press detection
   */
  startPress(x, y) {
    this.isPressed = true;
    this.startX = x;
    this.startY = y;

    // Start timer
    this.timer = setTimeout(() => {
      if (this.isPressed) {
        logger.debug('Long press detected');
        this.onLongPress();
        this.cancelPress();
      }
    }, this.threshold);
  }

  /**
   * Handle touch end
   */
  handleTouchEnd(e) {
    this.cancelPress();
  }

  /**
   * Handle mouse up
   */
  handleMouseUp(e) {
    this.cancelPress();
  }

  /**
   * Handle touch move
   */
  handleTouchMove(e) {
    if (!this.isPressed) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - this.startX);
    const deltaY = Math.abs(touch.clientY - this.startY);

    // Cancel if user moved beyond threshold (they're scrolling, not long pressing)
    if (deltaX > this.moveThreshold || deltaY > this.moveThreshold) {
      this.cancelPress();
    }
  }

  /**
   * Handle mouse move
   */
  handleMouseMove(e) {
    if (!this.isPressed) return;

    const deltaX = Math.abs(e.clientX - this.startX);
    const deltaY = Math.abs(e.clientY - this.startY);

    // Cancel if user moved beyond threshold
    if (deltaX > this.moveThreshold || deltaY > this.moveThreshold) {
      this.cancelPress();
    }
  }

  /**
   * Handle touch cancel
   */
  handleTouchCancel(e) {
    this.cancelPress();
  }

  /**
   * Cancel long press detection
   */
  cancelPress() {
    this.isPressed = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Clean up event listeners
   */
  destroy() {
    this.cancelPress();

    // Remove touch events
    this.element.removeEventListener('touchstart', this.handleTouchStart);
    this.element.removeEventListener('touchend', this.handleTouchEnd);
    this.element.removeEventListener('touchmove', this.handleTouchMove);
    this.element.removeEventListener('touchcancel', this.handleTouchCancel);

    // Remove mouse events
    this.element.removeEventListener('mousedown', this.handleMouseDown);
    this.element.removeEventListener('mouseup', this.handleMouseUp);
    this.element.removeEventListener('mousemove', this.handleMouseMove);

    this.element = null;
    this.onLongPress = null;
  }
}
