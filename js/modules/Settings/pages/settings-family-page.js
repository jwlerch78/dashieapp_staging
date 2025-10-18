// js/modules/Settings/pages/settings-family-page.js
// Family settings page with family name and zip code inputs

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('SettingsFamilyPage');

/**
 * Family Settings Page
 * Handles family name and location settings
 */
export class SettingsFamilyPage {
    constructor() {
        this.initialized = false;
        this.familyNameInput = null;
        this.zipCodeInput = null;
    }

    /**
     * Initialize the page
     */
    async initialize() {
        if (this.initialized) return;

        logger.verbose('Initializing Family settings page');
        this.initialized = true;
    }

    /**
     * Render the page content
     * @returns {string} - HTML string
     */
    render() {
        const familyName = this.getFamilyName();
        const zipCode = this.getZipCode();

        // Extract just the base name for editing (remove "The" and "Family")
        const baseName = this.extractBaseName(familyName);

        return `
            <div class="settings-modal__list">
                <div class="settings-modal__section">
                    <!-- Family Name Input -->
                    <div class="settings-modal__input-row">
                        <label class="settings-modal__input-label">Family Name</label>
                        <input type="text"
                               class="settings-modal__text-input"
                               id="family-name-input"
                               data-setting="family.familyName"
                               value="${this.escapeHtml(baseName || 'Dashie')}"
                               placeholder="Enter family name">
                        <div class="settings-modal__helper-text" style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
                            Will display as "The ${this.escapeHtml(baseName || 'Dashie')} Family"
                        </div>
                    </div>

                    <!-- Zip Code Input -->
                    <div class="settings-modal__input-row">
                        <label class="settings-modal__input-label">Zip Code</label>
                        <input type="text"
                               class="settings-modal__text-input"
                               id="zip-code-input"
                               data-setting="family.zipCode"
                               value="${this.escapeHtml(zipCode || '')}"
                               placeholder="Enter zip code"
                               maxlength="10"
                               pattern="[0-9]{5}(-[0-9]{4})?"
                               disabled>
                        <div class="settings-modal__helper-text" style="margin-top: 8px; font-size: 12px; color: var(--text-secondary); opacity: 0.7;">
                            Zip code integration coming soon
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get focusable elements for this page
     * @returns {Array<HTMLElement>}
     */
    getFocusableElements() {
        const elements = [];

        this.familyNameInput = document.getElementById('family-name-input');
        this.zipCodeInput = document.getElementById('zip-code-input');

        if (this.familyNameInput) elements.push(this.familyNameInput);
        // Don't add zipCodeInput since it's disabled

        return elements;
    }

    /**
     * Handle activation (page shown)
     */
    activate() {
        logger.debug('Family page activated');

        // Set up event listeners
        this.setupEventListeners();

        logger.debug('Event listeners setup complete', {
            hasInputElement: !!this.familyNameInput,
            inputValue: this.familyNameInput?.value
        });
    }

    /**
     * Handle deactivation (page hidden)
     */
    deactivate() {
        logger.debug('Family page deactivated');

        // Save any pending changes before leaving
        if (this.familyNameInput) {
            const newFamilyName = this.familyNameInput.value.trim();
            const currentFamilyName = this.getFamilyName();

            if (newFamilyName && newFamilyName !== currentFamilyName) {
                // Fire change event manually to ensure save
                const event = new Event('change', { bubbles: true });
                this.familyNameInput.dispatchEvent(event);
            }
        }

        // Clean up event listeners
        this.cleanupEventListeners();
    }

    /**
     * Setup event listeners for inputs
     * @private
     */
    setupEventListeners() {
        // Get fresh reference to input element
        this.familyNameInput = document.getElementById('family-name-input');

        logger.debug('Setting up event listeners', {
            foundInput: !!this.familyNameInput,
            inputId: this.familyNameInput?.id,
            inputValue: this.familyNameInput?.value
        });

        // Family name input - auto-save on change AND blur (like legacy implementation)
        if (this.familyNameInput) {
            this.familyNameInput.addEventListener('change', this.handleFamilyNameChange.bind(this));
            this.familyNameInput.addEventListener('blur', this.handleFamilyNameChange.bind(this));

            // Also handle Enter key to trigger blur
            this.familyNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault();
                    logger.debug('Enter key pressed on family name input');
                    this.familyNameInput.blur(); // Trigger blur which saves
                }
            });

            logger.debug('Event listeners attached successfully');
        } else {
            logger.error('Could not find family-name-input element!');
        }
    }

    /**
     * Cleanup event listeners
     * @private
     */
    cleanupEventListeners() {
        // Event listeners are automatically cleaned up when elements are removed from DOM
    }

    /**
     * Handle family name input change (auto-save)
     * Matches legacy behavior - saves immediately on change event
     * @private
     */
    async handleFamilyNameChange(e) {
        const newFamilyName = e.target.value.trim();
        const currentFamilyName = this.getFamilyName();

        logger.debug('Family name change event fired', {
            newFamilyName,
            currentFamilyName,
            willSave: newFamilyName && newFamilyName !== currentFamilyName
        });

        if (newFamilyName && newFamilyName !== currentFamilyName) {
            await this.saveFamilyName(newFamilyName);
        } else {
            logger.debug('Skipping save - no change or empty value');
        }
    }

    /**
     * Save family name to settings
     * @private
     * @param {string} familyName - New family name
     */
    async saveFamilyName(familyName) {
        try {
            logger.info('Saving family name', { familyName });

            // Get settings store
            const settingsStore = window.settingsStore;
            if (!settingsStore) {
                logger.error('Settings store not available');
                return;
            }

            // Update setting
            settingsStore.set('family.familyName', familyName);

            // Save to storage
            await settingsStore.save(true); // Show toast notification

            // Apply immediately to header widgets
            await this.applyFamilyNameToWidgets(familyName);

            logger.success('Family name saved and applied', { familyName });

        } catch (error) {
            logger.error('Failed to save family name', error);
        }
    }

    /**
     * Apply family name to header widgets immediately
     * @private
     * @param {string} familyName - Family name to apply
     */
    async applyFamilyNameToWidgets(familyName) {
        try {
            logger.debug('Applying family name to widgets', { familyName });

            // Use postMessage to send to all header widgets
            const headerWidgets = document.querySelectorAll('iframe[src*="header.html"]');

            headerWidgets.forEach((iframe, index) => {
                if (iframe.contentWindow) {
                    try {
                        iframe.contentWindow.postMessage({
                            type: 'family-name-update',
                            familyName: familyName
                        }, '*');
                        logger.debug('Sent family name to header widget ' + (index + 1), { familyName });
                    } catch (error) {
                        logger.warn('Failed to send family name to header widget ' + (index + 1), error);
                    }
                }
            });

            // Also dispatch global event for any other listeners
            window.dispatchEvent(new CustomEvent('dashie-family-name-loaded', {
                detail: { familyName }
            }));

            logger.debug('Family name applied to all widgets', { familyName });

        } catch (error) {
            logger.warn('Failed to apply family name to widgets', error);
        }
    }

    /**
     * Get current family name from settings
     * @private
     * @returns {string}
     */
    getFamilyName() {
        const settingsStore = window.settingsStore;
        if (!settingsStore) return 'The Dashie Family';

        return settingsStore.get('family.familyName') || 'The Dashie Family';
    }

    /**
     * Get current zip code from settings
     * @private
     * @returns {string}
     */
    getZipCode() {
        const settingsStore = window.settingsStore;
        if (!settingsStore) return '';

        return settingsStore.get('family.zipCode') || '';
    }

    /**
     * Extract base name from formatted family name
     * Removes "The " prefix and " Family" suffix
     * @private
     * @param {string} fullName - Full formatted name
     * @returns {string} Base name
     */
    extractBaseName(fullName) {
        if (!fullName) return 'Dashie';

        let baseName = fullName.trim();

        // Remove "The " prefix if present
        if (baseName.startsWith('The ')) {
            baseName = baseName.substring(4);
        }

        // Remove " Family" suffix if present
        if (baseName.endsWith(' Family')) {
            baseName = baseName.substring(0, baseName.length - 7);
        }

        return baseName.trim() || 'Dashie';
    }

    /**
     * Escape HTML for safe rendering
     * @private
     * @param {string} str - String to escape
     * @returns {string}
     */
    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
