// js/modules/Settings/pages/settings-display-page.js
// Display settings page

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('SettingsDisplayPage');

/**
 * Display Settings Page
 * Handles UI theme, sleep times, and display preferences
 */
export class SettingsDisplayPage {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize the page
     */
    async initialize() {
        if (this.initialized) return;

        logger.info('Initializing Display settings page');
        this.initialized = true;
    }

    /**
     * Render the page content
     * @returns {string} - HTML string
     */
    render() {
        // Get current theme from config or default to 'dark'
        const currentTheme = this.getCurrentTheme();

        return `
            <div class="settings-modal__list">
                <div class="settings-modal__section">
                    <div class="settings-modal__menu-item settings-modal__menu-item--selectable ${currentTheme === 'dark' ? 'settings-modal__menu-item--checked' : ''}"
                         data-setting="display.theme"
                         data-value="dark"
                         data-index="0"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Dark Theme</span>
                        <span class="settings-modal__cell-checkmark">${currentTheme === 'dark' ? '✓' : ''}</span>
                    </div>
                    <div class="settings-modal__menu-item settings-modal__menu-item--selectable ${currentTheme === 'light' ? 'settings-modal__menu-item--checked' : ''}"
                         data-setting="display.theme"
                         data-value="light"
                         data-index="1"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Light Theme</span>
                        <span class="settings-modal__cell-checkmark">${currentTheme === 'light' ? '✓' : ''}</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get current theme setting
     * @returns {string} - 'dark' or 'light'
     */
    getCurrentTheme() {
        // Get from Settings Store
        if (window.settingsStore) {
            return window.settingsStore.get('display.theme') || 'dark';
        }
        return 'dark';
    }

    /**
     * Set theme and persist
     * @param {string} theme - 'dark' or 'light'
     */
    async setTheme(theme) {
        logger.info('Setting theme', { theme });

        // Update store
        if (window.settingsStore) {
            window.settingsStore.set('display.theme', theme);
            await window.settingsStore.save();
        }

        // Apply theme to document
        this.applyTheme(theme);

        // Re-render to update checkmarks
        await this.refresh();
    }

    /**
     * Apply theme to document body
     * @param {string} theme - 'dark' or 'light'
     */
    applyTheme(theme) {
        logger.debug('Applying theme to document', { theme });

        // Remove existing theme classes
        document.body.classList.remove('theme-dark', 'theme-light');

        // Add new theme class
        document.body.classList.add(`theme-${theme}`);
    }

    /**
     * Refresh the page display
     */
    async refresh() {
        // Find the page element and update its innerHTML
        const pageElement = document.querySelector('[data-screen="display"]');
        if (pageElement) {
            pageElement.innerHTML = this.render();
            this.attachEventListeners();
        }
    }

    /**
     * Attach event listeners to theme cells
     */
    attachEventListeners() {
        const cells = document.querySelectorAll('[data-setting="display.theme"]');

        cells.forEach(cell => {
            cell.addEventListener('click', async (e) => {
                const theme = cell.dataset.value;
                await this.setTheme(theme);
            });
        });
    }

    /**
     * Get focusable elements for this page
     * @returns {Array<HTMLElement>}
     */
    getFocusableElements() {
        // No focusable elements in blank template
        return [];
    }

    /**
     * Handle activation (page shown)
     */
    activate() {
        logger.debug('Display page activated');

        // Attach event listeners when page becomes active
        this.attachEventListeners();
    }

    /**
     * Handle deactivation (page hidden)
     */
    deactivate() {
        logger.debug('Display page deactivated');
    }
}
