// js/modules/Welcome/welcome-wizard-controller.js
// Welcome Wizard Controller - Orchestrates the onboarding flow
// Ported from .legacy/js/welcome/welcome-wizard.js

import { createLogger } from '../../utils/logger.js';
import { getWelcomeScreens, setupScreenHandlers } from './welcome-screens.js';

const logger = createLogger('WelcomeWizard');

export default class WelcomeWizardController {
    constructor(user) {
        this.user = user;
        this.currentScreenIndex = 0;
        this.screens = getWelcomeScreens();
        this.state = this.loadState();
        this.overlay = null;
        this.skipConfirmationActive = false;
        this.keyHandler = null;
        this.skipModalKeyHandler = null;

        logger.info('Welcome wizard initialized', {
            userName: user?.name,
            totalScreens: this.screens.length
        });
    }

    /**
     * Load wizard state from localStorage
     */
    loadState() {
        try {
            const saved = localStorage.getItem('dashie-welcome-state');
            if (saved) {
                const state = JSON.parse(saved);
                logger.debug('Loaded wizard state from localStorage', state);
                return state;
            }
        } catch (error) {
            logger.warn('Failed to load wizard state', { error: error.message });
        }

        // Default state
        return {
            currentScreen: 'screen-1',
            familyName: this.extractFamilyName(),
            completedScreens: []
        };
    }

    /**
     * Save wizard state to localStorage
     */
    saveState() {
        try {
            localStorage.setItem('dashie-welcome-state', JSON.stringify(this.state));
            logger.debug('Saved wizard state to localStorage');
        } catch (error) {
            logger.warn('Failed to save wizard state', { error: error.message });
        }
    }

    /**
     * Extract family name from user data
     */
    extractFamilyName() {
        if (!this.user) return 'Dashie';

        // Try to get last name from email
        if (this.user.email) {
            const emailParts = this.user.email.split('@')[0].split('.');
            if (emailParts.length > 1) {
                const lastName = emailParts[emailParts.length - 1];
                return lastName.charAt(0).toUpperCase() + lastName.slice(1);
            }
        }

        // Try to get from full name
        if (this.user.name) {
            const nameParts = this.user.name.split(' ');
            if (nameParts.length > 1) {
                return nameParts[nameParts.length - 1];
            }
        }

        return 'Dashie';
    }

    /**
     * Show the welcome wizard
     */
    async show() {
        logger.info('Showing welcome wizard');

        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'welcome-wizard-overlay';
        this.overlay.innerHTML = this.buildWizardHTML();

        document.body.appendChild(this.overlay);

        // Setup event handlers
        setupScreenHandlers(this);

        // Setup ESC key handler for skip confirmation
        this.setupKeyHandler();

        // Show first screen
        await this.showScreen(this.currentScreenIndex);

        // Trigger animation
        requestAnimationFrame(() => {
            this.overlay.classList.add('active');
        });
    }

    /**
     * Build the wizard HTML structure
     */
    buildWizardHTML() {
        return `
            <div class="welcome-wizard-modal">
                <div class="welcome-wizard-content">
                    <div class="welcome-screens">
                        ${this.screens.map((screen, index) => `
                            <div class="welcome-screen ${index === 0 ? 'active' : ''}"
                                 data-screen="${screen.id}"
                                 data-index="${index}">
                                <!-- Screen content will be injected here -->
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- Skip Confirmation Modal -->
            <div id="welcome-skip-confirmation" class="welcome-skip-modal" style="display: none;">
                <div class="welcome-skip-content">
                    <h2>Skip Setup?</h2>
                    <p>Are you sure you want to skip the Dashie setup wizard? You can always access settings later.</p>
                    <div class="welcome-skip-actions">
                        <button id="welcome-skip-continue" class="welcome-btn welcome-btn-primary" tabindex="1">Continue Setup</button>
                        <button id="welcome-skip-confirm" class="welcome-btn welcome-btn-secondary" tabindex="2">Skip Setup</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup keyboard handler for ESC key
     */
    setupKeyHandler() {
        this.keyHandler = (e) => {
            if (e.key === 'Escape' || e.key === 'Backspace') {
                // Don't show skip confirmation on last screen
                const currentScreen = this.screens[this.currentScreenIndex];
                if (currentScreen.id === 'screen-5') {
                    this.completeWizard();
                    return;
                }

                // Show skip confirmation if not already showing
                if (!this.skipConfirmationActive) {
                    e.preventDefault();
                    this.showSkipConfirmation();
                }
            }
        };

        document.addEventListener('keydown', this.keyHandler);
    }

    /**
     * Show skip confirmation modal
     */
    showSkipConfirmation() {
        logger.debug('Showing skip confirmation');
        this.skipConfirmationActive = true;

        const modal = this.overlay.querySelector('#welcome-skip-confirmation');
        modal.style.display = 'flex';

        const continueBtn = this.overlay.querySelector('#welcome-skip-continue');
        const skipBtn = this.overlay.querySelector('#welcome-skip-confirm');

        // Add click handlers
        continueBtn.onclick = () => this.continueSetup();
        skipBtn.onclick = () => this.skipWizard();

        // Create keydown handler for Enter key
        this.skipModalKeyHandler = (e) => {
            if (e.key === 'Enter' || e.keyCode === 13) {
                if (e.target.id === 'welcome-skip-continue') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.continueSetup();
                } else if (e.target.id === 'welcome-skip-confirm') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.skipWizard();
                }
            }
        };

        // Add keydown listener to modal
        modal.addEventListener('keydown', this.skipModalKeyHandler, true);

        // Focus the "Continue Setup" button by default
        setTimeout(() => continueBtn?.focus(), 100);
    }

    /**
     * Hide skip confirmation modal
     */
    hideSkipConfirmation() {
        logger.debug('Hiding skip confirmation');
        this.skipConfirmationActive = false;

        const modal = this.overlay.querySelector('#welcome-skip-confirmation');

        // Remove keydown listener
        if (this.skipModalKeyHandler) {
            modal.removeEventListener('keydown', this.skipModalKeyHandler, true);
            this.skipModalKeyHandler = null;
        }

        modal.style.display = 'none';
    }

    /**
     * Handle skip confirmation - continue setup
     */
    continueSetup() {
        this.hideSkipConfirmation();
    }

    /**
     * Handle skip confirmation - skip wizard
     */
    skipWizard() {
        logger.info('User skipped welcome wizard');

        // Save skip status to settings
        if (window.settingsStore) {
            window.settingsStore.set('onboarding.skipped', true);
            window.settingsStore.set('onboarding.completed', true);
            window.settingsStore.set('onboarding.skippedAt', new Date().toISOString());
            logger.info('Skip status saved - wizard will not show again');
        }

        // Close wizard
        this.close();
    }

    /**
     * Show a specific screen
     */
    async showScreen(index) {
        const screen = this.screens[index];
        if (!screen) {
            logger.error('Screen not found', { index });
            return;
        }

        logger.debug('Showing screen', { screenId: screen.id, index });

        // Update current screen index
        this.currentScreenIndex = index;

        // Update state
        this.state.currentScreen = screen.id;
        this.saveState();

        // Get screen element
        const screenElement = this.overlay.querySelector(`[data-screen="${screen.id}"]`);
        if (!screenElement) return;

        // Inject screen content
        screenElement.innerHTML = screen.template(this.state, this.user);

        // Show screen with animation
        const allScreens = this.overlay.querySelectorAll('.welcome-screen');
        allScreens.forEach(s => s.classList.remove('active', 'sliding-out', 'sliding-in'));

        screenElement.classList.add('sliding-in', 'active');

        setTimeout(() => {
            screenElement.classList.remove('sliding-in');
        }, 300);

        // Call screen's onEnter handler if it exists
        if (screen.onEnter) {
            await screen.onEnter(this);
        }
    }

    /**
     * Navigate to next screen
     */
    async nextScreen() {
        if (this.currentScreenIndex < this.screens.length - 1) {
            // Mark current screen as completed
            const currentScreen = this.screens[this.currentScreenIndex];
            if (!this.state.completedScreens.includes(currentScreen.id)) {
                this.state.completedScreens.push(currentScreen.id);
                this.saveState();
            }

            await this.showScreen(this.currentScreenIndex + 1);
        } else {
            // Last screen - complete wizard
            await this.completeWizard();
        }
    }

    /**
     * Navigate to previous screen
     */
    async previousScreen() {
        if (this.currentScreenIndex > 0) {
            await this.showScreen(this.currentScreenIndex - 1);
        }
    }

    /**
     * Show loading spinner
     */
    showLoadingSpinner(message = 'Loading...') {
        const spinner = document.createElement('div');
        spinner.id = 'welcome-loading-spinner';
        spinner.className = 'welcome-loading-overlay';
        spinner.innerHTML = `
            <div class="welcome-loading-content">
                <div class="welcome-spinner"></div>
                <p>${message}</p>
            </div>
        `;
        this.overlay.appendChild(spinner);
        logger.debug('Loading spinner shown', { message });
    }

    /**
     * Hide loading spinner
     */
    hideLoadingSpinner() {
        const spinner = document.getElementById('welcome-loading-spinner');
        if (spinner) {
            spinner.remove();
            logger.debug('Loading spinner hidden');
        }
    }

    /**
     * Complete the wizard
     */
    async completeWizard() {
        logger.info('Welcome wizard completed', { state: this.state });

        // Save completion to settings
        if (window.settingsStore) {
            window.settingsStore.set('onboarding.completed', true);
            window.settingsStore.set('onboarding.completedAt', new Date().toISOString());
            window.settingsStore.set('family.familyName', this.state.familyName);

            logger.success('Onboarding completion saved', { familyName: this.state.familyName });
        }

        // Clear localStorage state
        localStorage.removeItem('dashie-welcome-state');

        // Close wizard
        this.close();

        // Reload page to show dashboard
        logger.info('Reloading page to show dashboard');
        window.location.reload();
    }

    /**
     * Close the wizard
     */
    close() {
        logger.info('Closing welcome wizard');

        // Remove event listener
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
        }

        // Animate out
        this.overlay?.classList.remove('active');

        setTimeout(() => {
            this.overlay?.remove();
            this.overlay = null;
        }, 300);
    }
}
