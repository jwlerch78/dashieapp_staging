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
                         data-setting="interface.theme"
                         data-value="dark"
                         data-index="0"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Dark Theme</span>
                        <span class="settings-modal__cell-checkmark">${currentTheme === 'dark' ? '✓' : ''}</span>
                    </div>
                    <div class="settings-modal__menu-item settings-modal__menu-item--selectable ${currentTheme === 'light' ? 'settings-modal__menu-item--checked' : ''}"
                         data-setting="interface.theme"
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
        // Get from Settings Store (stored under interface.theme in config)
        if (window.settingsStore) {
            return window.settingsStore.get('interface.theme') || 'light';
        }
        return 'light';
    }

    /**
     * Set theme and persist
     * @param {string} theme - 'dark' or 'light'
     */
    async setTheme(theme) {
        logger.info('Setting theme', { theme });

        // Update settings store (interface.theme)
        if (window.settingsStore) {
            window.settingsStore.set('interface.theme', theme);
            await window.settingsStore.save();
        }

        // Apply theme via ThemeApplier (handles DOM, widgets, and dashie-theme localStorage)
        if (window.themeApplier) {
            window.themeApplier.applyTheme(theme, true);
        }

        // Update checkmarks without full re-render (faster)
        this.updateCheckmarks(theme);
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
     * Update checkmarks to reflect current theme
     * @param {string} theme - 'dark' or 'light'
     */
    updateCheckmarks(theme) {
        const cells = document.querySelectorAll('[data-setting="interface.theme"]');

        cells.forEach(cell => {
            const cellTheme = cell.dataset.value;
            const checkmark = cell.querySelector('.settings-modal__cell-checkmark');

            if (cellTheme === theme) {
                cell.classList.add('settings-modal__menu-item--checked');
                if (checkmark) checkmark.textContent = '✓';
            } else {
                cell.classList.remove('settings-modal__menu-item--checked');
                if (checkmark) checkmark.textContent = '';
            }
        });
    }

    /**
     * Attach event listeners to theme cells
     */
    attachEventListeners() {
        const cells = document.querySelectorAll('[data-setting="interface.theme"]');

        cells.forEach(cell => {
            // Remove existing listener to prevent duplicates
            const oldListener = cell._themeClickListener;
            if (oldListener) {
                cell.removeEventListener('click', oldListener);
            }

            // Create new listener
            const listener = async (e) => {
                const theme = cell.dataset.value;
                await this.setTheme(theme);
            };

            // Store reference and attach
            cell._themeClickListener = listener;
            cell.addEventListener('click', listener);
        });
    }

    /**
     * Get focusable elements for this page
     * @returns {Array<HTMLElement>}
     */
    getFocusableElements() {
        // Return theme option cells
        return Array.from(document.querySelectorAll('[data-setting="interface.theme"]'));
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
