// js/modules/Settings/settings.js
// Settings module public API - implements ModuleInterface

import { createLogger } from '../../utils/logger.js';
import { getSettingsStateManager } from './settings-state-manager.js';
import { SettingsModalRenderer } from './ui/settings-modal-renderer.js';
import { SettingsInputHandler } from './settings-input-handler.js';
import { SettingsOrchestrator } from './settings-orchestrator.js';
import { SettingsStore } from './settings-store.js';

const logger = createLogger('Settings');

/**
 * Settings Module
 * Manages application settings with modal interface
 * Implements standard ModuleInterface for integration with ActionRouter
 */
class Settings {
    constructor() {
        this.initialized = false;
        this.stateManager = null;
        this.renderer = null;
        this.inputHandler = null;
        this.orchestrator = null;
        this.store = null;
    }

    /**
     * Initialize the Settings module
     * Called once during app initialization
     */
    async initialize() {
        if (this.initialized) {
            logger.warn('Settings module already initialized');
            return;
        }

        logger.verbose('Initializing Settings module');

        try {
            // Initialize Settings Store first
            this.store = new SettingsStore();
            await this.store.initialize();

            // Make store globally accessible
            window.settingsStore = this.store;

            // Initialize components
            this.stateManager = getSettingsStateManager();
            this.stateManager.initialize();

            this.renderer = new SettingsModalRenderer(this.stateManager);
            await this.renderer.initialize();

            this.orchestrator = new SettingsOrchestrator(this.stateManager, this.renderer);
            await this.orchestrator.initialize();

            this.inputHandler = new SettingsInputHandler(
                this.stateManager,
                this.renderer,
                this.orchestrator
            );

            this.initialized = true;
            logger.verbose('Settings module initialized successfully');

        } catch (error) {
            logger.error('Failed to initialize Settings module', error);
            throw error;
        }
    }

    /**
     * Activate the Settings module
     * Called when Settings becomes the active module
     */
    activate() {
        logger.info('Activating Settings module');

        if (!this.initialized) {
            logger.error('Cannot activate - Settings module not initialized');
            return;
        }

        // Open settings modal
        this.orchestrator.open();
    }

    /**
     * Deactivate the Settings module
     * Called when Settings is no longer the active module
     */
    deactivate() {
        logger.info('Deactivating Settings module');

        if (!this.initialized) {
            return;
        }

        // Close settings modal
        this.orchestrator.close();
    }

    /**
     * Destroy the Settings module
     * Called when module is being removed (rarely used)
     */
    destroy() {
        logger.info('Destroying Settings module');

        if (this.renderer) {
            this.renderer.destroy();
        }

        this.initialized = false;
        this.stateManager = null;
        this.renderer = null;
        this.inputHandler = null;
        this.orchestrator = null;
    }

    /**
     * Get the input handler for ActionRouter registration
     * @returns {SettingsInputHandler}
     */
    getInputHandler() {
        return this.inputHandler;
    }

    /**
     * Show settings (convenience method)
     * Can be called from anywhere to open settings
     */
    async show() {
        if (!this.initialized) {
            await this.initialize();
        }

        await this.orchestrator.open();
    }

    /**
     * Hide settings (convenience method)
     */
    async hide() {
        if (!this.initialized) {
            return;
        }

        await this.orchestrator.close();
    }

    /**
     * Check if settings is visible
     * @returns {boolean}
     */
    isVisible() {
        return this.stateManager ? this.stateManager.getIsVisible() : false;
    }
}

// Export singleton instance
const settingsInstance = new Settings();
export default settingsInstance;

// Export named for convenience
export { settingsInstance as Settings };
