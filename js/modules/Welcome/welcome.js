// js/modules/Welcome/welcome.js
// Welcome Module - First-time user onboarding wizard
// Ported from .legacy/js/welcome/welcome-wizard.js

import { createLogger } from '../../utils/logger.js';
import WelcomeWizardController from './welcome-wizard-controller.js';

const logger = createLogger('WelcomeModule');

/**
 * Welcome Module - Onboarding wizard for first-time users
 *
 * Public API:
 * - initialize() - One-time setup
 * - activate() - Show welcome wizard
 * - deactivate() - Hide welcome wizard
 * - shouldShow() - Check if wizard should be shown
 */
class Welcome {
    constructor() {
        this.isInitialized = false;
    }

    /**
     * Initialize Welcome module
     */
    async initialize() {
        try {
            logger.verbose('Initializing Welcome module...');

            this.isInitialized = true;

            logger.verbose('Welcome module initialized');
            return true;
        } catch (error) {
            logger.error('Failed to initialize Welcome module', error);
            return false;
        }
    }

    /**
     * Check if welcome wizard should be shown
     * @returns {boolean} - True if wizard should show
     */
    shouldShow() {
        // Check if user has completed or skipped onboarding
        const completed = window.settingsStore?.get('onboarding.completed');
        const skipped = window.settingsStore?.get('onboarding.skipped');

        if (completed || skipped) {
            logger.debug('Welcome wizard already completed/skipped', { completed, skipped });
            return false;
        }

        logger.debug('Welcome wizard should be shown');
        return true;
    }

    /**
     * Activate Welcome wizard
     */
    async activate() {
        if (!this.isInitialized) {
            logger.error('Cannot activate Welcome - module not initialized');
            return;
        }

        logger.info('Activating Welcome wizard');

        // Get current user from session
        const user = window.sessionManager?.getUser();
        if (!user) {
            logger.error('Cannot show welcome wizard - no user logged in');
            return;
        }

        // Show wizard
        const controller = new WelcomeWizardController(user);
        await controller.show();
    }

    /**
     * Deactivate Welcome wizard
     */
    deactivate() {
        logger.info('Deactivating Welcome wizard');
        // Wizard controller handles its own cleanup
    }

    /**
     * Get input handler (required for ActionRouter integration)
     */
    getInputHandler() {
        // Welcome wizard handles its own input (d-pad nav, etc.)
        // Return null since we don't need ActionRouter to route to us
        return null;
    }
}

// Export singleton
const welcome = new Welcome();
export default welcome;

// Expose globally for debugging
if (typeof window !== 'undefined') {
    window.welcomeModule = welcome;
}
