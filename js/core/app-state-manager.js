// js/core/app-state-manager.js
// Global application state manager with localStorage persistence
// v1.0 - 10/15/25 - Initial implementation for refactored architecture

import { createLogger } from '../utils/logger.js';
import AppComms from './app-comms.js';
import { MODULES, FOCUS_CONTEXTS, PLATFORMS, THEMES, STORAGE_KEYS } from '../../config.js';

const logger = createLogger('AppStateManager');

/**
 * AppStateManager - Global Application State
 *
 * Purpose:
 * - Maintains global application state
 * - Persists state to localStorage
 * - Notifies subscribers of state changes via AppComms
 *
 * State Structure:
 * {
 *   currentModule: 'dashboard' | 'settings' | 'login' | 'modals' | 'welcome',
 *   previousModule: string,
 *   focusContext: 'grid' | 'menu' | 'widget' | 'modal',
 *   activeWidget: string | null,
 *   user: {
 *     isAuthenticated: boolean,
 *     userId: string | null,
 *     email: string | null
 *   },
 *   theme: 'light' | 'dark',
 *   platform: 'tv' | 'desktop' | 'mobile',
 *   isSleeping: boolean,
 *   isInitialized: boolean
 * }
 */
class AppStateManager {
  constructor() {
    // Initial state
    this.state = {
      currentModule: null,
      previousModule: null,
      focusContext: FOCUS_CONTEXTS.GRID,
      activeWidget: null,
      user: {
        isAuthenticated: false,
        userId: null,
        email: null
      },
      theme: THEMES.LIGHT,
      platform: PLATFORMS.DESKTOP,
      isSleeping: false,
      isInitialized: false,
      lastUpdated: null
    };

    // Subscribers for direct state change notifications
    // (In addition to AppComms broadcasts)
    this.stateSubscribers = [];

    logger.info('AppStateManager created');
  }

  /**
   * Initialize state manager
   * Runtime-only state, no persistence needed
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      logger.info('Initializing AppStateManager...');

      // Mark as initialized
      this.state.isInitialized = true;
      this.state.lastUpdated = Date.now();

      // Broadcast initialization
      AppComms.publish(AppComms.events.STATE_UPDATED, {
        type: 'initialized',
        state: this.getState()
      });

      logger.success('AppStateManager initialized (runtime-only, no persistence)');
      return true;
    } catch (error) {
      logger.error('Failed to initialize AppStateManager', error);
      return false;
    }
  }

  /**
   * Get current state (immutable copy)
   * @returns {Object} Current state object
   */
  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Set partial state
   * Merges provided state with existing state
   * @param {Object} partialState - State changes to apply
   */
  setState(partialState) {
    if (!partialState || typeof partialState !== 'object') {
      logger.error('Invalid state update', partialState);
      return;
    }

    // Merge partial state
    const oldState = this.getState();
    this.state = {
      ...this.state,
      ...partialState,
      lastUpdated: Date.now()
    };

    logger.debug('State updated', {
      changes: Object.keys(partialState)
    });

    // Notify subscribers
    this.notifyStateChange(oldState, this.state);

    // Broadcast via AppComms
    AppComms.publish(AppComms.events.STATE_UPDATED, {
      type: 'updated',
      oldState,
      newState: this.getState(),
      changes: partialState
    });
  }

  /**
   * Set current module
   * @param {string} moduleName - Name of module to activate
   */
  setCurrentModule(moduleName) {
    if (!Object.values(MODULES).includes(moduleName)) {
      logger.error('Invalid module name', moduleName);
      return;
    }

    const previousModule = this.state.currentModule;

    logger.info(`Changing module: ${previousModule} → ${moduleName}`);

    this.setState({
      previousModule,
      currentModule: moduleName
    });

    // Broadcast module change
    AppComms.publish(AppComms.events.MODULE_CHANGED, {
      previousModule,
      currentModule: moduleName
    });
  }

  /**
   * Set focus context
   * @param {string} context - Focus context ('grid', 'menu', 'widget', 'modal')
   */
  setFocusContext(context) {
    if (!Object.values(FOCUS_CONTEXTS).includes(context)) {
      logger.error('Invalid focus context', context);
      return;
    }

    const oldContext = this.state.focusContext;

    this.setState({
      focusContext: context
    });

    logger.debug(`Focus context changed: ${oldContext} → ${context}`);

    AppComms.publish(AppComms.events.FOCUS_CHANGED, {
      oldContext,
      newContext: context
    });
  }

  /**
   * Set active widget
   * @param {string|null} widgetId - Widget ID or null to clear
   */
  setActiveWidget(widgetId) {
    const oldWidget = this.state.activeWidget;

    this.setState({
      activeWidget: widgetId
    });

    logger.debug(`Active widget changed: ${oldWidget} → ${widgetId}`);
  }

  /**
   * Set user authentication state
   * @param {Object} user - User object { isAuthenticated, userId, email }
   */
  setUser(user) {
    if (!user || typeof user !== 'object') {
      logger.error('Invalid user object', user);
      return;
    }

    const oldUser = this.state.user;

    this.setState({
      user: {
        isAuthenticated: user.isAuthenticated || false,
        userId: user.userId || null,
        email: user.email || null
      }
    });

    logger.info('User state updated', {
      isAuthenticated: user.isAuthenticated,
      email: user.email
    });

    AppComms.publish(AppComms.events.AUTH_USER_CHANGED, {
      oldUser,
      newUser: user
    });
  }

  /**
   * Set theme
   * @param {string} theme - Theme name ('light' or 'dark')
   */
  setTheme(theme) {
    if (!Object.values(THEMES).includes(theme)) {
      logger.error('Invalid theme', theme);
      return;
    }

    const oldTheme = this.state.theme;

    this.setState({
      theme
    });

    logger.info(`Theme changed: ${oldTheme} → ${theme}`);

    AppComms.publish(AppComms.events.THEME_CHANGED, {
      oldTheme,
      newTheme: theme
    });
  }

  /**
   * Set platform
   * @param {string} platform - Platform ('tv', 'desktop', 'mobile')
   */
  setPlatform(platform) {
    if (!Object.values(PLATFORMS).includes(platform)) {
      logger.error('Invalid platform', platform);
      return;
    }

    this.setState({
      platform
    });

    logger.info(`Platform detected: ${platform}`);

    AppComms.publish(AppComms.events.PLATFORM_DETECTED, {
      platform
    });
  }

  /**
   * Set sleep mode
   * @param {boolean} isSleeping - Whether app is in sleep mode
   */
  setSleepMode(isSleeping) {
    const oldSleepState = this.state.isSleeping;

    this.setState({
      isSleeping
    });

    logger.info(`Sleep mode: ${isSleeping ? 'ON' : 'OFF'}`);

    AppComms.publish(AppComms.events.SLEEP_MODE_CHANGED, {
      oldState: oldSleepState,
      newState: isSleeping
    });
  }

  /**
   * Subscribe to state changes
   * @param {Function} callback - Function to call on state change
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    if (typeof callback !== 'function') {
      logger.error('Callback must be a function');
      return () => {};
    }

    this.stateSubscribers.push(callback);

    logger.debug('State subscriber added', {
      totalSubscribers: this.stateSubscribers.length
    });

    // Return unsubscribe function
    return () => {
      const index = this.stateSubscribers.indexOf(callback);
      if (index > -1) {
        this.stateSubscribers.splice(index, 1);
        logger.debug('State subscriber removed', {
          totalSubscribers: this.stateSubscribers.length
        });
      }
    };
  }

  /**
   * Notify all subscribers of state change
   * @private
   * @param {Object} oldState - Previous state
   * @param {Object} newState - New state
   */
  notifyStateChange(oldState, newState) {
    this.stateSubscribers.forEach(callback => {
      try {
        callback(newState, oldState);
      } catch (error) {
        logger.error('Error in state subscriber', error);
      }
    });
  }


  /**
   * Reset state to initial values
   */
  reset() {
    logger.info('Resetting application state');

    const platform = this.state.platform; // Preserve platform

    this.state = {
      currentModule: null,
      previousModule: null,
      focusContext: FOCUS_CONTEXTS.GRID,
      activeWidget: null,
      user: {
        isAuthenticated: false,
        userId: null,
        email: null
      },
      theme: THEMES.LIGHT,
      platform,
      isSleeping: false,
      isInitialized: true,
      lastUpdated: Date.now()
    };

    AppComms.publish(AppComms.events.STATE_UPDATED, {
      type: 'reset',
      state: this.getState()
    });
  }

  /**
   * Get initialization status
   * @returns {boolean} Whether manager is initialized
   */
  isInitialized() {
    return this.state.isInitialized;
  }

  /**
   * Get current module
   * @returns {string|null} Current module name
   */
  getCurrentModule() {
    return this.state.currentModule;
  }

  /**
   * Get user
   * @returns {Object} User object
   */
  getUser() {
    return { ...this.state.user };
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} Authentication status
   */
  isAuthenticated() {
    return this.state.user.isAuthenticated;
  }

  /**
   * Get theme
   * @returns {string} Current theme
   */
  getTheme() {
    return this.state.theme;
  }

  /**
   * Get platform
   * @returns {string} Current platform
   */
  getPlatform() {
    return this.state.platform;
  }

  /**
   * Check if in sleep mode
   * @returns {boolean} Sleep mode status
   */
  isSleeping() {
    return this.state.isSleeping;
  }
}

// Create singleton instance
const appStateManager = new AppStateManager();

// =============================================================================
// EXPOSE GLOBALLY FOR DEBUGGING
// =============================================================================

if (typeof window !== 'undefined') {
  window.AppStateManager = appStateManager;
}

// =============================================================================
// EXPORT
// =============================================================================

export default appStateManager;
