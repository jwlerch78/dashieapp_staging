// js/modules/Settings/settings-state-manager.js
// Manages Settings module navigation state

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('SettingsStateManager');

/**
 * Settings State Manager
 * Tracks current page, navigation stack, and modal visibility
 */
export class SettingsStateManager {
    constructor() {
        this.currentPage = 'main'; // 'main' | 'family' | 'interface' | 'calendar' | 'photos' | 'system' | 'account'
        this.navigationStack = []; // Stack for back navigation
        this.isVisible = false;
        this.selectedIndex = 0; // Currently selected menu item or control
    }

    /**
     * Initialize state manager
     */
    initialize() {
        logger.info('Initializing SettingsStateManager');
        this.reset();
    }

    /**
     * Reset to initial state
     */
    reset() {
        this.currentPage = 'main';
        this.navigationStack = [];
        this.isVisible = false;
        this.selectedIndex = 0;
    }

    /**
     * Show the settings modal
     */
    show() {
        logger.info('Showing settings modal');
        this.isVisible = true;
        this.currentPage = 'main';
        this.navigationStack = [];
        this.selectedIndex = 0;
    }

    /**
     * Hide the settings modal
     */
    hide() {
        logger.info('Hiding settings modal');
        this.isVisible = false;
        this.reset();
    }

    /**
     * Navigate to a page
     * @param {string} pageName - Page to navigate to
     */
    navigateToPage(pageName) {
        logger.debug('Navigating to page:', pageName);

        // Push current page to navigation stack
        this.navigationStack.push(this.currentPage);

        // Set new page
        this.currentPage = pageName;
        this.selectedIndex = 0; // Reset selection when changing pages
    }

    /**
     * Navigate back to previous page
     * @returns {boolean} - True if navigated back, false if at root
     */
    navigateBack() {
        if (this.navigationStack.length === 0) {
            logger.debug('At root page, cannot navigate back');
            return false;
        }

        const previousPage = this.navigationStack.pop();
        logger.debug('Navigating back to:', previousPage);

        this.currentPage = previousPage;
        this.selectedIndex = 0;

        return true;
    }

    /**
     * Get current page
     * @returns {string}
     */
    getCurrentPage() {
        return this.currentPage;
    }

    /**
     * Check if modal is visible
     * @returns {boolean}
     */
    getIsVisible() {
        return this.isVisible;
    }

    /**
     * Get selected index
     * @returns {number}
     */
    getSelectedIndex() {
        return this.selectedIndex;
    }

    /**
     * Set selected index
     * @param {number} index
     */
    setSelectedIndex(index) {
        this.selectedIndex = index;
    }

    /**
     * Move selection up
     * @param {number} maxIndex - Maximum index allowed
     * @returns {number} - New selected index
     */
    moveSelectionUp(maxIndex) {
        if (this.selectedIndex > 0) {
            this.selectedIndex--;
        } else {
            // Wrap to bottom
            this.selectedIndex = maxIndex;
        }
        return this.selectedIndex;
    }

    /**
     * Move selection down
     * @param {number} maxIndex - Maximum index allowed
     * @returns {number} - New selected index
     */
    moveSelectionDown(maxIndex) {
        if (this.selectedIndex < maxIndex) {
            this.selectedIndex++;
        } else {
            // Wrap to top
            this.selectedIndex = 0;
        }
        return this.selectedIndex;
    }

    /**
     * Check if on main menu
     * @returns {boolean}
     */
    isOnMainMenu() {
        return this.currentPage === 'main';
    }

    /**
     * Get navigation breadcrumb
     * @returns {Array<string>}
     */
    getBreadcrumb() {
        return [...this.navigationStack, this.currentPage];
    }
}

// Export singleton instance
let stateManagerInstance = null;

export function getSettingsStateManager() {
    if (!stateManagerInstance) {
        stateManagerInstance = new SettingsStateManager();
    }
    return stateManagerInstance;
}
