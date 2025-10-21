// js/modules/Settings/pages/settings-family-page.js
// Family settings page with family name and zip code inputs

import { createLogger } from '../../../utils/logger.js';
import { geocodeZipCodeCached } from '../../../utils/geocoding-helper.js';

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
                               pattern="[0-9]{5}(-[0-9]{4})?">
                        <div class="settings-modal__helper-text" style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
                            Used for weather location in clock widget
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
        if (this.zipCodeInput) elements.push(this.zipCodeInput);

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

        if (this.zipCodeInput) {
            const newZipCode = this.zipCodeInput.value.trim();
            const currentZipCode = this.getZipCode();

            if (newZipCode && newZipCode !== currentZipCode) {
                // Fire change event manually to ensure save
                const event = new Event('change', { bubbles: true });
                this.zipCodeInput.dispatchEvent(event);
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
        // Get fresh reference to input elements
        this.familyNameInput = document.getElementById('family-name-input');
        this.zipCodeInput = document.getElementById('zip-code-input');

        logger.debug('Setting up event listeners', {
            foundFamilyNameInput: !!this.familyNameInput,
            foundZipCodeInput: !!this.zipCodeInput
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

            logger.debug('Family name event listeners attached');
        } else {
            logger.error('Could not find family-name-input element!');
        }

        // Zip code input - auto-save on change AND blur
        if (this.zipCodeInput) {
            this.zipCodeInput.addEventListener('change', this.handleZipCodeChange.bind(this));
            this.zipCodeInput.addEventListener('blur', this.handleZipCodeChange.bind(this));

            // Also handle Enter key to trigger blur
            this.zipCodeInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault();
                    logger.debug('Enter key pressed on zip code input');
                    this.zipCodeInput.blur(); // Trigger blur which saves
                }
            });

            // Restrict to numeric input only
            this.zipCodeInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9-]/g, '');
            });

            logger.debug('Zip code event listeners attached');
        } else {
            logger.error('Could not find zip-code-input element!');
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
     * Handle zip code input change (auto-save and geocode)
     * @private
     */
    async handleZipCodeChange(e) {
        const newZipCode = e.target.value.trim();
        const currentZipCode = this.getZipCode();

        logger.debug('Zip code change event fired', {
            newZipCode,
            currentZipCode,
            willSave: newZipCode && newZipCode !== currentZipCode
        });

        if (newZipCode && newZipCode !== currentZipCode) {
            // Validate zip code format (5 or 9 digits)
            const cleanZip = newZipCode.replace(/[\s-]/g, '');
            if (!/^\d{5}(\d{4})?$/.test(cleanZip)) {
                logger.warn('Invalid zip code format', { zipCode: newZipCode });
                // You could show an error message here
                return;
            }

            await this.saveZipCode(newZipCode);
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

            // Format to "The [Name] Family" for display
            const formattedName = this.formatFamilyName(familyName);

            // Update setting in settingsStore (store base name)
            settingsStore.set('family.familyName', familyName);

            // Save to storage
            await settingsStore.save(true); // Show toast notification

            // ALSO save to legacy localStorage key for header widget compatibility
            try {
                localStorage.setItem('dashie-family-name', formattedName);
                logger.debug('Updated dashie-family-name in localStorage', { formattedName });
            } catch (error) {
                logger.warn('Failed to update dashie-family-name in localStorage', error);
            }

            // Apply immediately to header widgets via postMessage
            await this.applyFamilyNameToWidgets(formattedName);

            logger.success('Family name saved and applied', { familyName, formattedName });

        } catch (error) {
            logger.error('Failed to save family name', error);
        }
    }

    /**
     * Save zip code to settings and geocode to get coordinates
     * @private
     * @param {string} zipCode - New zip code
     */
    async saveZipCode(zipCode) {
        try {
            logger.info('Saving zip code', { zipCode });

            // Get settings store
            const settingsStore = window.settingsStore;
            if (!settingsStore) {
                logger.error('Settings store not available');
                return;
            }

            // Update zip code setting
            settingsStore.set('family.zipCode', zipCode);

            // Geocode the zip code to get coordinates (uses cached value if available)
            logger.debug('Geocoding zip code for coordinates', { zipCode });
            const coords = await geocodeZipCodeCached(zipCode);

            if (coords) {
                logger.debug('Geocoding successful', {
                    zipCode,
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    city: coords.city,
                    state: coords.state
                });

                // Save coordinates to settings (for weather widget)
                settingsStore.set('family.latitude', coords.latitude);
                settingsStore.set('family.longitude', coords.longitude);

                // Save city/state if available (for display purposes)
                if (coords.city) {
                    settingsStore.set('family.city', coords.city);
                }
                if (coords.state) {
                    settingsStore.set('family.state', coords.state);
                }

                logger.info('Zip code and coordinates saved', {
                    zipCode,
                    city: coords.city,
                    state: coords.state
                });
            } else {
                logger.warn('Geocoding failed - saving zip code only', { zipCode });
            }

            // Save to storage
            await settingsStore.save(true); // Show toast notification

            // Apply immediately to clock widget
            await this.applyZipCodeToClockWidget(zipCode);

            logger.success('Zip code saved and applied', { zipCode });

        } catch (error) {
            logger.error('Failed to save zip code', error);
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
     * Apply zip code to clock widget for weather location
     * @private
     * @param {string} zipCode - Zip code to apply
     */
    async applyZipCodeToClockWidget(zipCode) {
        try {
            logger.debug('Applying zip code to clock widget', { zipCode });

            // Use postMessage to send to all clock widgets
            const clockWidgets = document.querySelectorAll('iframe[src*="clock.html"]');

            clockWidgets.forEach((iframe, index) => {
                if (iframe.contentWindow) {
                    try {
                        iframe.contentWindow.postMessage({
                            type: 'location-update',
                            payload: { zipCode }
                        }, '*');
                        logger.debug('Sent zip code to clock widget ' + (index + 1), { zipCode });
                    } catch (error) {
                        logger.warn('Failed to send zip code to clock widget ' + (index + 1), error);
                    }
                }
            });

            logger.debug('Zip code applied to all clock widgets', { zipCode });

        } catch (error) {
            logger.warn('Failed to apply zip code to clock widget', error);
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
     * Format base name to "The [Name] Family"
     * @private
     * @param {string} baseName - Base family name (e.g., "Smith")
     * @returns {string} Formatted name (e.g., "The Smith Family")
     */
    formatFamilyName(baseName) {
        if (!baseName) return 'The Dashie Family';

        // If already formatted, return as-is
        if (baseName.startsWith('The ') && baseName.endsWith(' Family')) {
            return baseName;
        }

        // Remove any existing "The " or " Family" to get clean base name
        let cleanName = baseName.trim();
        if (cleanName.startsWith('The ')) {
            cleanName = cleanName.substring(4);
        }
        if (cleanName.endsWith(' Family')) {
            cleanName = cleanName.substring(0, cleanName.length - 7);
        }

        // Format to "The [Name] Family"
        return `The ${cleanName.trim()} Family`;
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
