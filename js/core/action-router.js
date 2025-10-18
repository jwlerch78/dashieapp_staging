// js/core/action-router.js
// Routes user input actions to the active module's input handler
// v1.0 - 10/15/25 - Initial implementation for refactored architecture

import { createLogger } from '../utils/logger.js';
import AppComms from './app-comms.js';
import AppStateManager from './app-state-manager.js';

const logger = createLogger('ActionRouter');

/**
 * ActionRouter - Routes Actions to Active Module
 *
 * Purpose:
 * - Receives normalized actions from InputHandler via AppComms
 * - Determines which module should handle the action based on AppState
 * - Calls the appropriate module's input handler
 *
 * Action Flow:
 *   InputHandler → AppComms('input:action') → ActionRouter → Active Module's Input Handler
 *
 * Routing Logic:
 *   1. Check if modal is active → route to Modals module
 *   2. Check if sleep mode → handle wake/sleep actions
 *   3. Route to currentModule's input handler
 */
class ActionRouter {
  constructor() {
    this.isInitialized = false;
    this.registeredModules = new Map();
    this.unsubscribeAction = null;

    logger.info('ActionRouter created');
  }

  /**
   * Initialize action router
   * Subscribes to input actions from AppComms
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      logger.info('Initializing ActionRouter...');

      // Subscribe to input actions
      this.unsubscribeAction = AppComms.subscribe('input:action', (data) => {
        this.routeAction(data.action, data.originalEvent);
      });

      this.isInitialized = true;

      logger.success('ActionRouter initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize ActionRouter', error);
      return false;
    }
  }

  /**
   * Register a module's input handler
   * @param {string} moduleName - Name of the module
   * @param {Object} inputHandler - Module's input handler with handleXxx methods
   */
  registerModule(moduleName, inputHandler) {
    if (!moduleName || !inputHandler) {
      logger.error('Invalid module registration', { moduleName, inputHandler });
      return;
    }

    this.registeredModules.set(moduleName, inputHandler);

    logger.debug(`Module registered: ${moduleName}`, {
      totalModules: this.registeredModules.size
    });
  }

  /**
   * Unregister a module's input handler
   * @param {string} moduleName - Name of the module
   */
  unregisterModule(moduleName) {
    if (this.registeredModules.has(moduleName)) {
      this.registeredModules.delete(moduleName);

      logger.debug(`Module unregistered: ${moduleName}`, {
        totalModules: this.registeredModules.size
      });
    }
  }

  /**
   * Route action to appropriate handler
   * @param {string} action - Normalized action string
   * @param {Event|null} originalEvent - Original DOM event (if available)
   * @returns {boolean} Whether action was handled
   */
  routeAction(action, originalEvent = null) {
    if (!action) {
      logger.warn('Invalid action received', { action });
      return false;
    }

    logger.debug('Routing action', { action });

    // Get current app state
    const state = AppStateManager.getState();

    // PRIORITY 1: Special actions that bypass normal routing
    if (action === 'play-pause') {
      return this.handleSleepToggle(state);
    }

    // PRIORITY 2: Sleep mode - any key wakes up
    if (state.isSleeping) {
      logger.info('App is sleeping, waking up...');
      AppComms.publish('system:wake-requested', {});
      if (originalEvent) {
        originalEvent.preventDefault();
      }
      return true;
    }

    // PRIORITY 3: Settings modal is active - route to Settings module
    if (window.Settings && window.Settings.isVisible()) {
      const handled = this.routeToModule('settings', action, originalEvent);
      if (handled && originalEvent) {
        originalEvent.preventDefault();
      }
      return handled;
    }

    // PRIORITY 4: Other modals active - route to Modals module
    if (this.hasActiveModal()) {
      const handled = this.routeToModule('modals', action, originalEvent);
      if (handled && originalEvent) {
        originalEvent.preventDefault();
      }
      return handled;
    }

    // PRIORITY 5: Route to current module
    const currentModule = state.currentModule;

    if (!currentModule) {
      logger.warn('No active module to route action to', { action });
      return false;
    }

    const handled = this.routeToModule(currentModule, action, originalEvent);

    // Prevent default if module handled the action
    if (handled && originalEvent) {
      originalEvent.preventDefault();
    }

    return handled;
  }

  /**
   * Route action to a specific module's input handler
   * @private
   * @param {string} moduleName - Module to route to
   * @param {string} action - Action to handle
   * @param {Event|null} originalEvent - Original event
   * @returns {boolean} Whether action was handled
   */
  routeToModule(moduleName, action, originalEvent) {
    const inputHandler = this.registeredModules.get(moduleName);

    if (!inputHandler) {
      logger.warn(`No input handler registered for module: ${moduleName}`, { action });
      return false;
    }

    // Map action to handler method
    const handlerMethod = this.getHandlerMethod(action);

    if (!handlerMethod) {
      logger.debug('No handler method for action', { action, moduleName });
      return false;
    }

    // Check if handler has this method
    if (typeof inputHandler[handlerMethod] !== 'function') {
      logger.debug(`Module ${moduleName} does not implement ${handlerMethod}`, { action });
      return false;
    }

    try {
      // Call the handler method
      const handled = inputHandler[handlerMethod](originalEvent);

      logger.debug(`Action ${action} → ${moduleName}.${handlerMethod}()`, {
        handled: handled ? 'yes' : 'no'
      });

      return handled !== false; // Return true if handler returned true or undefined
    } catch (error) {
      logger.error(`Error in ${moduleName}.${handlerMethod}()`, error);
      return false;
    }
  }

  /**
   * Map action string to input handler method name
   * @private
   * @param {string} action - Action string
   * @returns {string|null} Handler method name or null
   */
  getHandlerMethod(action) {
    const methodMap = {
      'up': 'handleUp',
      'down': 'handleDown',
      'left': 'handleLeft',
      'right': 'handleRight',
      'enter': 'handleEnter',
      'escape': 'handleEscape',
      'menu': 'handleMenu',
      'space': 'handleSpace',
      'prev': 'handlePrev',
      'next': 'handleNext'
    };

    return methodMap[action] || null;
  }

  /**
   * Check if there's an active modal (excluding Settings which is handled separately)
   * @private
   * @returns {boolean} True if modal is active
   */
  hasActiveModal() {
    // Check for modal in DOM (excluding settings modal)
    const modalElement = document.querySelector('.modal.active:not(.settings-modal), .modal.show:not(.settings-modal)');
    if (modalElement) {
      return true;
    }

    // Check for modal manager
    if (window.dashieModalManager && window.dashieModalManager.hasActiveModal()) {
      return true;
    }

    return false;
  }

  /**
   * Handle sleep toggle action
   * @private
   * @param {Object} state - Current app state
   * @returns {boolean} Always returns true (handled)
   */
  handleSleepToggle(state) {
    if (state.isSleeping) {
      logger.info('Sleep toggle → wake');
      AppComms.publish('system:wake-requested', {});
    } else {
      logger.info('Sleep toggle → sleep');
      AppComms.publish('system:sleep-requested', {});
    }

    return true;
  }

  /**
   * Get list of registered modules
   * @returns {Array<string>} Array of module names
   */
  getRegisteredModules() {
    return Array.from(this.registeredModules.keys());
  }

  /**
   * Check if a module is registered
   * @param {string} moduleName - Module name to check
   * @returns {boolean} True if registered
   */
  isModuleRegistered(moduleName) {
    return this.registeredModules.has(moduleName);
  }

  /**
   * Cleanup - unsubscribe from events
   */
  destroy() {
    logger.info('Destroying ActionRouter...');

    // Unsubscribe from input actions
    if (this.unsubscribeAction) {
      this.unsubscribeAction();
      this.unsubscribeAction = null;
    }

    // Clear registered modules
    this.registeredModules.clear();

    this.isInitialized = false;

    logger.success('ActionRouter destroyed');
  }

  /**
   * Get statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      registeredModules: this.getRegisteredModules(),
      totalModules: this.registeredModules.size
    };
  }
}

// Create singleton instance
const actionRouter = new ActionRouter();

// =============================================================================
// EXPOSE GLOBALLY FOR DEBUGGING
// =============================================================================

if (typeof window !== 'undefined') {
  window.ActionRouter = actionRouter;
}

// =============================================================================
// EXPORT
// =============================================================================

export default actionRouter;
