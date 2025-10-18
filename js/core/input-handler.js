// js/core/input-handler.js
// Normalizes raw input from keyboard, D-pad, touch, and remote controls
// v1.0 - 10/15/25 - Initial implementation for refactored architecture
// Based on legacy events.js input normalization logic

import { createLogger } from '../utils/logger.js';
import AppComms from './app-comms.js';

const logger = createLogger('InputHandler');

/**
 * InputHandler - Raw Input Normalization
 *
 * Purpose:
 * - Listens to keyboard, D-pad, touch, and remote input
 * - Normalizes all input sources to unified action strings
 * - Forwards normalized actions to ActionRouter via AppComms
 *
 * Input Flow:
 *   Keyboard/D-pad/Touch → InputHandler → Normalized Action → ActionRouter → Module
 *
 * Supported Actions:
 *   - Navigation: 'up', 'down', 'left', 'right'
 *   - Selection: 'enter', 'escape'
 *   - Special: 'menu', 'space', 'play-pause'
 *   - View cycling: 'prev', 'next'
 */
class InputHandler {
  constructor() {
    this.isInitialized = false;
    this.activeListeners = [];

    // Track repeat key prevention
    this.lastKeyTime = {};
    this.KEY_REPEAT_DELAY = 150; // milliseconds

    // Store handler references to allow proper cleanup
    this.handlers = {
      keydown: null,
      click: null,
      message: null
    };

    logger.verbose('InputHandler created');
  }

  /**
   * Initialize input handler
   * Sets up event listeners for all input sources
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      logger.verbose('Initializing InputHandler...');

      // Set up keyboard events
      this.initializeKeyboardEvents();

      // Set up mouse/touch events
      this.initializeMouseEvents();

      // Set up widget message events
      this.initializeWidgetMessages();

      // Set up Android remote input (if running in Android WebView)
      this.initializeAndroidInput();

      this.isInitialized = true;

      logger.verbose('InputHandler initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize InputHandler', error);
      return false;
    }
  }

  /**
   * Initialize keyboard event listeners
   * @private
   */
  initializeKeyboardEvents() {
    // Remove old listener if exists
    if (this.handlers.keydown) {
      document.removeEventListener('keydown', this.handlers.keydown);
      logger.debug('Removed existing keydown listener');
    }

    // Create handler
    const handleKeyDown = (event) => {
      // Prevent repeated key events (only on initial press)
      if (event.repeat) {
        return;
      }

      // Check for repeat protection
      const now = Date.now();
      const lastTime = this.lastKeyTime[event.key] || 0;
      if (now - lastTime < this.KEY_REPEAT_DELAY) {
        logger.debug('Key repeat blocked', { key: event.key });
        return;
      }
      this.lastKeyTime[event.key] = now;

      // Normalize keyboard input
      const action = this.getActionFromKeyboardEvent(event);

      if (action) {
        logger.debug('Keyboard input', { key: event.key, action });

        // Publish normalized action
        this.publishAction(action, event);
      }
    };

    // Store handler reference
    this.handlers.keydown = handleKeyDown;

    // Add new listener
    document.addEventListener('keydown', handleKeyDown);

    this.activeListeners.push({
      type: 'keyboard',
      element: document,
      event: 'keydown',
      handler: handleKeyDown
    });

    logger.debug('Keyboard events initialized');
  }

  /**
   * Initialize mouse/touch event listeners
   * @private
   */
  initializeMouseEvents() {
    // Remove old listener if exists
    if (this.handlers.click) {
      document.removeEventListener('click', this.handlers.click);
      logger.debug('Removed existing click listener');
    }

    // Click handler for sidebar closing
    const handleDocumentClick = (event) => {
      // Publish click event for modules to handle
      AppComms.publish('input:click', {
        target: event.target,
        x: event.clientX,
        y: event.clientY
      });
    };

    // Store handler reference
    this.handlers.click = handleDocumentClick;

    document.addEventListener('click', handleDocumentClick);

    this.activeListeners.push({
      type: 'mouse',
      element: document,
      event: 'click',
      handler: handleDocumentClick
    });

    logger.debug('Mouse events initialized');
  }

  /**
   * Initialize widget message listeners
   * @private
   */
  initializeWidgetMessages() {
    // Remove old listener if exists
    if (this.handlers.message) {
      window.removeEventListener('message', this.handlers.message);
      logger.debug('Removed existing message listener');
    }

    const handleWidgetMessage = (event) => {
      if (!event.data || typeof event.data !== 'object') {
        return;
      }

      // Widget ready messages
      if (event.data.type === 'widget-ready') {
        logger.debug('Widget ready message', { widget: event.data.widget });

        AppComms.publish(AppComms.events.WIDGET_READY, {
          widgetId: event.data.widget
        });
      }

      // Widget return-to-menu messages
      if (event.data.type === 'return-to-menu') {
        logger.debug('Widget return-to-menu message');

        AppComms.publish(AppComms.events.WIDGET_MESSAGE, {
          type: 'return-to-menu'
        });
      }

      // Other widget messages
      if (event.data.type) {
        AppComms.publish(AppComms.events.WIDGET_MESSAGE, event.data);
      }
    };

    // Store handler reference
    this.handlers.message = handleWidgetMessage;

    window.addEventListener('message', handleWidgetMessage);

    this.activeListeners.push({
      type: 'widget-message',
      element: window,
      event: 'message',
      handler: handleWidgetMessage
    });

    logger.debug('Widget message events initialized');
  }

  /**
   * Initialize Android remote input
   * Exposes window.handleRemoteInput for Android WebView
   * @private
   */
  initializeAndroidInput() {
    // Android WebView remote input handler
    window.handleRemoteInput = (keyCode) => {
      logger.debug('Android remote input', { keyCode });

      const action = this.getActionFromAndroidKeycode(keyCode);

      if (action) {
        this.publishAction(action, null);
      } else {
        logger.debug('Unmapped Android keycode', { keyCode });
      }
    };

    logger.debug('Android remote input initialized');
  }

  /**
   * Map keyboard event to action string
   * @private
   * @param {KeyboardEvent} event - Keyboard event
   * @returns {string|null} Action string or null if not mapped
   */
  getActionFromKeyboardEvent(event) {
    const keyMap = {
      // Arrow keys
      'ArrowLeft': 'left',
      'ArrowRight': 'right',
      'ArrowUp': 'up',
      'ArrowDown': 'down',

      // Enter/Escape
      'Enter': 'enter',
      'Escape': 'escape',

      // Menu
      'm': 'menu',
      'M': 'menu',

      // Space
      ' ': 'space',

      // View cycling
      ',': 'prev',
      '.': 'next'
    };

    return keyMap[event.key] || null;
  }

  /**
   * Map Android keycode to action string
   * @private
   * @param {number} keyCode - Android keycode
   * @returns {string|null} Action string or null if not mapped
   */
  getActionFromAndroidKeycode(keyCode) {
    const keyMap = {
      // D-pad navigation
      38: 'up',           // KEYCODE_DPAD_UP
      40: 'down',         // KEYCODE_DPAD_DOWN
      37: 'left',         // KEYCODE_DPAD_LEFT
      39: 'right',        // KEYCODE_DPAD_RIGHT
      13: 'enter',        // KEYCODE_DPAD_CENTER / KEYCODE_ENTER

      // System keys
      4: 'escape',        // KEYCODE_BACK (Android back button)
      82: 'menu',         // KEYCODE_MENU
      77: 'menu',         // M key for menu

      // Media keys for view cycling
      227: 'prev',   // KEYCODE_MEDIA_REWIND
      228: 'next',   // KEYCODE_MEDIA_FAST_FORWARD
      188: 'prev',   // Alternative comma key
      190: 'next',   // Alternative period key
      87: 'next',    // KEYCODE_MEDIA_NEXT
      88: 'prev',    // KEYCODE_MEDIA_PREVIOUS

      // Sleep toggle
      179: 'play-pause', // KEYCODE_MEDIA_PLAY_PAUSE
      85: 'play-pause'   // Alternative play/pause
    };

    return keyMap[keyCode] || null;
  }

  /**
   * Publish normalized action via AppComms
   * @private
   * @param {string} action - Normalized action string
   * @param {Event|null} originalEvent - Original DOM event (or null for Android)
   */
  publishAction(action, originalEvent = null) {
    logger.debug('Publishing action', { action });

    // Publish to AppComms for ActionRouter to pick up
    AppComms.publish('input:action', {
      action,
      originalEvent,
      timestamp: Date.now()
    });
  }

  /**
   * Get information about active listeners (for debugging)
   * @returns {Object} Listener status information
   */
  getListenerStatus() {
    const status = {
      initialized: this.isInitialized,
      activeListenerCount: this.activeListeners.length,
      handlers: {
        keydown: !!this.handlers.keydown,
        click: !!this.handlers.click,
        message: !!this.handlers.message
      },
      listeners: this.activeListeners.map(l => ({
        type: l.type,
        event: l.event,
        hasHandler: !!l.handler
      }))
    };

    console.log('InputHandler Listener Status:');
    console.log(`  Initialized: ${status.initialized}`);
    console.log(`  Active Listeners: ${status.activeListenerCount}`);
    console.log(`  Stored Handlers:`, status.handlers);
    console.log(`  Listener Details:`, status.listeners);

    return status;
  }

  /**
   * Cleanup - remove all event listeners
   */
  destroy() {
    logger.info('Destroying InputHandler...');

    // Remove all active listeners
    this.activeListeners.forEach(listener => {
      listener.element.removeEventListener(listener.event, listener.handler);
    });

    this.activeListeners = [];

    // Remove Android input handler
    if (window.handleRemoteInput) {
      delete window.handleRemoteInput;
    }

    this.isInitialized = false;

    logger.success('InputHandler destroyed');
  }

  /**
   * Get list of supported actions
   * @returns {Array<string>} Array of action strings
   */
  getSupportedActions() {
    return [
      'up', 'down', 'left', 'right',
      'enter', 'escape',
      'menu', 'space',
      'prev', 'next',
      'play-pause'
    ];
  }
}

// Create singleton instance
const inputHandler = new InputHandler();

// =============================================================================
// EXPOSE GLOBALLY FOR DEBUGGING
// =============================================================================

if (typeof window !== 'undefined') {
  window.InputHandler = inputHandler;
}

// =============================================================================
// EXPORT
// =============================================================================

export default inputHandler;
