// js/modules/Settings/settings-orchestrator.js
// Orchestrates Settings module page transitions and state changes

import { createLogger } from '../../utils/logger.js';
import AppStateManager from '../../core/app-state-manager.js';

const logger = createLogger('SettingsOrchestrator');

/**
 * Settings Orchestrator
 * Manages page transitions, state synchronization, and module lifecycle
 */
export class SettingsOrchestrator {
    constructor(stateManager, renderer) {
        this.stateManager = stateManager;
        this.renderer = renderer;
    }

    /**
     * Initialize orchestrator
     */
    async initialize() {
        logger.verbose('Initializing SettingsOrchestrator');
    }

    /**
     * Open settings modal
     */
    async open() {
        logger.info('Opening settings modal');

        // Update state
        this.stateManager.show();

        // Render and show modal
        this.renderer.render();
        this.renderer.show();

        // Update app state
        AppStateManager.setFocusContext('modal');

        logger.info('Settings modal opened');
    }

    /**
     * Close settings modal
     */
    async close() {
        logger.info('Closing settings modal');

        // Hide modal
        this.renderer.hide();

        // Update state
        this.stateManager.hide();

        // Restore app state
        AppStateManager.setFocusContext('grid'); // Return to default context

        // Notify Dashboard to restore focus
        const currentModule = AppStateManager.getCurrentModule();
        if (currentModule === 'dashboard') {
            // Dashboard will handle restoring its focus
            logger.debug('Returning to Dashboard');
        }

        logger.info('Settings modal closed');
    }

    /**
     * Navigate to a settings page
     * @param {string} pageName - Page to navigate to
     */
    async navigateToPage(pageName) {
        logger.info('Navigating to page:', pageName);

        // Update state
        this.stateManager.navigateToPage(pageName);

        // Update UI
        this.renderer.showCurrentPage();
        this.renderer.updateSelection();

        logger.debug('Page navigation complete:', pageName);
    }

    /**
     * Navigate back to previous page
     * @returns {boolean} - True if navigated back, false if closed
     */
    async navigateBack() {
        const didNavigate = this.stateManager.navigateBack();

        if (didNavigate) {
            logger.info('Navigated back to:', this.stateManager.getCurrentPage());

            // Update UI
            this.renderer.showCurrentPage();
            this.renderer.updateSelection();

            return true;
        } else {
            // At root, close settings
            logger.info('At root, closing settings');
            await this.close();
            return false;
        }
    }

    /**
     * Handle page activation
     * @param {string} pageName - Page being activated
     */
    onPageActivate(pageName) {
        logger.debug('Page activated:', pageName);
        // Future: Load page data, subscribe to events, etc.
    }

    /**
     * Handle page deactivation
     * @param {string} pageName - Page being deactivated
     */
    onPageDeactivate(pageName) {
        logger.debug('Page deactivated:', pageName);
        // Future: Save page data, unsubscribe from events, etc.
    }
}
