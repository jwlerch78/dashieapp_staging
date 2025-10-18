// js/modules/Settings/core/settings-screen-base.js
// Base class for all settings screens with built-in navigation, selection, and persistence

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('SettingsScreenBase');

/**
 * Base Settings Screen
 * Provides common functionality for all settings screens:
 * - Automatic selection management (starts on checked item)
 * - Navigation flow handling
 * - Data persistence
 * - Rendering helpers
 */
export class SettingsScreenBase {
    /**
     * @param {Object} config - Screen configuration
     * @param {string} config.id - Unique screen ID (e.g., 'display-theme')
     * @param {string} config.title - Screen title for nav bar
     * @param {string} [config.parentId] - Parent screen ID (for back navigation)
     * @param {string} [config.settingPath] - Settings path (e.g., 'interface.theme')
     * @param {Function} config.getItems - Function that returns array of items to display
     * @param {Function} [config.onSelect] - Callback when item is selected
     * @param {Function} [config.formatValue] - Function to format display value
     */
    constructor(config) {
        this.id = config.id;
        this.title = config.title;
        this.parentId = config.parentId;
        this.settingPath = config.settingPath;
        this.getItems = config.getItems;
        this.onSelect = config.onSelect;
        this.formatValue = config.formatValue;
        this.sectionTitle = config.sectionTitle; // Optional section header
    }

    /**
     * Render the screen HTML
     * @param {*} currentValue - Current value of the setting
     * @returns {string} - HTML string
     */
    render(currentValue) {
        const items = this.getItems(currentValue);

        const itemsHTML = items.map(item => {
            const isChecked = this.isItemChecked(item, currentValue);
            const classes = ['settings-modal__menu-item', 'settings-modal__menu-item--selectable'];
            if (isChecked) {
                classes.push('settings-modal__menu-item--checked');
            }

            // Build data attributes
            const dataAttrs = [];
            if (item.navigate) {
                dataAttrs.push(`data-navigate="${item.navigate}"`);
            }
            if (item.setting) {
                dataAttrs.push(`data-setting="${item.setting}"`);
            }
            if (item.value !== undefined) {
                dataAttrs.push(`data-value="${item.value}"`);
            }
            // Add custom data attributes for multi-step flows (hour, minute, period)
            if (item.hour !== undefined) {
                dataAttrs.push(`data-hour="${item.hour}"`);
            }
            if (item.minute !== undefined) {
                dataAttrs.push(`data-minute="${item.minute}"`);
            }
            if (item.period !== undefined) {
                dataAttrs.push(`data-period="${item.period}"`);
            }

            return `
                <div class="${classes.join(' ')}" ${dataAttrs.join(' ')}>
                    <span class="settings-modal__menu-label">${item.label}</span>
                    ${isChecked ? '<span class="settings-modal__cell-checkmark">✓</span>' : ''}
                </div>
            `;
        }).join('');

        return `
            <div class="settings-modal__list">
                ${this.sectionTitle ? `<div class="settings-modal__section-title">${this.sectionTitle}</div>` : ''}
                <div class="settings-modal__section">
                    ${itemsHTML}
                </div>
            </div>
        `;
    }

    /**
     * Check if item is the currently selected value
     * @param {Object} item - Item configuration
     * @param {*} currentValue - Current setting value
     * @returns {boolean}
     */
    isItemChecked(item, currentValue) {
        if (item.value !== undefined) {
            return item.value === currentValue;
        }
        if (item.hour !== undefined && currentValue) {
            // For time screens, compare against parsed time
            // This will be handled by subclass
            return false;
        }
        return false;
    }

    /**
     * Find the index of the checked item
     * @param {*} currentValue - Current setting value
     * @returns {number} - Index of checked item, or 0 if not found
     */
    getInitialSelectionIndex(currentValue) {
        const items = this.getItems(currentValue);
        const checkedIndex = items.findIndex(item => this.isItemChecked(item, currentValue));
        return checkedIndex !== -1 ? checkedIndex : 0;
    }

    /**
     * Handle item selection
     * @param {HTMLElement} element - Selected element
     * @param {Object} settingsStore - Settings store instance
     * @returns {Promise<Object>} - Action object { type, ...props }
     */
    async handleSelection(element, settingsStore) {
        // If custom onSelect handler is provided, use it
        if (this.onSelect) {
            return await this.onSelect(element, settingsStore);
        }

        // Default behavior: save setting and navigate back
        if (this.settingPath && element.dataset.value) {
            await settingsStore.set(this.settingPath, element.dataset.value);
            await settingsStore.save();

            return {
                type: 'complete',
                navigateBack: true
            };
        }

        // Navigation action
        if (element.dataset.navigate) {
            return {
                type: 'navigate',
                screenId: element.dataset.navigate
            };
        }

        return { type: 'none' };
    }
}
