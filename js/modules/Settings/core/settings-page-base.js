// js/modules/Settings/core/settings-page-base.js
// Base class for all settings pages - provides standardized focus and behavior patterns

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('SettingsPageBase');

/**
 * Base class for Settings Pages
 * Provides:
 * - Standardized focus management
 * - Consistent selection behavior patterns
 * - Common lifecycle methods
 * - Default implementations that can be overridden
 */
export class SettingsPageBase {
    constructor(pageId) {
        this.pageId = pageId;
        this.initialized = false;
    }

    /**
     * Initialize the page
     * Override in child classes for custom initialization
     */
    async initialize() {
        if (this.initialized) return;

        logger.verbose(`Initializing ${this.pageId} page`);
        this.initialized = true;
    }

    /**
     * Render the page content
     * Must be implemented by child classes
     * @returns {string} - HTML string
     */
    render() {
        throw new Error(`render() must be implemented by ${this.constructor.name}`);
    }

    /**
     * Get focusable elements for this page
     * Default implementation: query all menu items
     * Override in child classes for custom behavior
     * @returns {Array<HTMLElement>}
     */
    getFocusableElements() {
        const screen = document.querySelector(`[data-screen="${this.pageId}"].settings-modal__screen--active`);
        if (!screen) return [];

        return Array.from(screen.querySelectorAll('.settings-modal__menu-item'));
    }

    /**
     * Get initial focus index when page is activated
     * Default: 0 (first item)
     * Override in child classes for custom behavior (e.g., focus on checked item)
     * @returns {number}
     */
    getInitialFocusIndex() {
        return 0;
    }

    /**
     * Get selection behavior for an item
     * This determines what happens when an item is clicked/selected
     *
     * Override in child classes to define custom behavior
     * Can return different behaviors based on the item
     *
     * @param {HTMLElement} item - The clicked/selected item
     * @returns {Object} Behavior configuration
     *
     * Behavior types:
     * - 'toggle': Toggle item state, stay on page (calendar, checkboxes)
     * - 'navigate': Navigate to another screen (theme selection, sub-menus)
     * - 'toggle-switch': Toggle switch control (dynamic greeting)
     * - 'none': No automatic behavior (custom handling)
     */
    getSelectionBehavior(item) {
        // Default: check if item has navigate attribute
        if (item.dataset.navigate) {
            return { type: 'navigate' };
        }

        // Check if it's a toggle switch
        if (item.classList.contains('settings-modal__menu-item--toggle')) {
            return { type: 'toggle-switch' };
        }

        // Default: no automatic behavior
        return { type: 'none' };
    }

    /**
     * Handle item click/selection
     * Default implementation uses getSelectionBehavior()
     * Override in child classes for completely custom behavior
     *
     * @param {HTMLElement} item - The clicked/selected item
     * @returns {Promise<Object>} Action to take { shouldNavigate, navigateTo, shouldReturn }
     */
    async handleItemClick(item) {
        const behavior = this.getSelectionBehavior(item);

        logger.debug(`Item clicked on ${this.pageId}`, {
            behavior: behavior.type,
            itemData: item.dataset
        });

        switch (behavior.type) {
            case 'navigate':
                // Navigation items: return navigation instruction
                return {
                    shouldNavigate: true,
                    navigateTo: item.dataset.navigate
                };

            case 'toggle-switch':
                // Toggle switch: handled by renderer, no action needed
                return {
                    shouldNavigate: false
                };

            case 'toggle':
                // Toggle items: handle in child class
                await this.handleToggleItem(item);
                return {
                    shouldNavigate: false
                };

            case 'none':
            default:
                // No automatic behavior
                return {
                    shouldNavigate: false
                };
        }
    }

    /**
     * Handle toggle item (for multi-select items like calendars)
     * Override in child classes that use toggle behavior
     *
     * @param {HTMLElement} item - The item to toggle
     */
    async handleToggleItem(item) {
        // Default implementation: log warning
        logger.warn(`handleToggleItem not implemented in ${this.constructor.name}`);
    }

    /**
     * Handle activation (page shown)
     * Override in child classes for custom activation logic
     */
    async activate() {
        logger.debug(`${this.pageId} page activated`);
    }

    /**
     * Handle deactivation (page hidden)
     * Override in child classes for custom deactivation logic
     */
    deactivate() {
        logger.debug(`${this.pageId} page deactivated`);
    }

    /**
     * Attach event listeners
     * Override in child classes for custom event handling
     */
    attachEventListeners() {
        // Default: no custom listeners
        // Child classes can override to attach custom listeners
    }

    /**
     * Detach event listeners
     * Override in child classes to clean up custom listeners
     */
    detachEventListeners() {
        // Default: no cleanup needed
        // Child classes can override to clean up custom listeners
    }

    /**
     * Update focusable elements (called when DOM changes)
     * Override in child classes if needed
     */
    updateFocusableElements() {
        // Default: no action needed
        // Some pages may need to refresh their focusable elements list
    }
}

/**
 * Helper: Check if element should auto-navigate
 * @param {HTMLElement} element
 * @returns {boolean}
 */
export function shouldAutoNavigate(element) {
    return !!(element.dataset.navigate || element.dataset.page);
}

/**
 * Helper: Get navigation target from element
 * @param {HTMLElement} element
 * @returns {string|null}
 */
export function getNavigationTarget(element) {
    return element.dataset.navigate || element.dataset.page || null;
}

export default SettingsPageBase;
