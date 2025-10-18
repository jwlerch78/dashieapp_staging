// js/modules/Settings/settings-input-handler.js
// Handles D-pad navigation for Settings module

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('SettingsInputHandler');

/**
 * Settings Input Handler
 * Handles all keyboard/D-pad input for the Settings module
 */
export class SettingsInputHandler {
    constructor(stateManager, renderer, orchestrator) {
        this.stateManager = stateManager;
        this.renderer = renderer;
        this.orchestrator = orchestrator;
    }

    /**
     * Handle up arrow/D-pad up
     * @returns {boolean} - True if handled
     */
    handleUp() {
        if (!this.stateManager.getIsVisible()) return false;

        const focusableElements = this.renderer.getFocusableElements();
        if (focusableElements.length === 0) return true;

        const maxIndex = focusableElements.length - 1;
        this.stateManager.moveSelectionUp(maxIndex);
        this.renderer.updateSelection();

        logger.debug('Up navigation', { selectedIndex: this.stateManager.getSelectedIndex() });
        return true;
    }

    /**
     * Handle down arrow/D-pad down
     * @returns {boolean} - True if handled
     */
    handleDown() {
        if (!this.stateManager.getIsVisible()) return false;

        const focusableElements = this.renderer.getFocusableElements();
        if (focusableElements.length === 0) return true;

        const maxIndex = focusableElements.length - 1;
        this.stateManager.moveSelectionDown(maxIndex);
        this.renderer.updateSelection();

        logger.debug('Down navigation', { selectedIndex: this.stateManager.getSelectedIndex() });
        return true;
    }

    /**
     * Handle enter/select
     * @returns {boolean} - True if handled
     */
    async handleEnter() {
        if (!this.stateManager.getIsVisible()) return false;

        const currentPage = this.stateManager.getCurrentPage();
        const selectedIndex = this.stateManager.getSelectedIndex();

        if (currentPage === 'main') {
            // Navigate to selected page
            const menuItem = this.renderer.menuItems[selectedIndex];
            if (menuItem) {
                logger.info('Navigating to page:', menuItem.id);
                await this.orchestrator.navigateToPage(menuItem.id);
            }
        } else {
            // On a sub-page - trigger click on selected element
            const focusableElements = this.renderer.getFocusableElements();
            const selectedElement = focusableElements[selectedIndex];

            if (selectedElement) {
                logger.info('Triggering click on selected element');
                selectedElement.click();
            }
        }

        return true;
    }

    /**
     * Handle back/escape
     * @returns {boolean} - True if handled
     */
    async handleBack() {
        if (!this.stateManager.getIsVisible()) return false;

        const currentPage = this.stateManager.getCurrentPage();

        if (currentPage === 'main') {
            // Close settings
            logger.info('Closing settings from main menu');
            await this.orchestrator.close();
        } else {
            // Check if current screen has a parent (hierarchical navigation)
            const modalElement = this.renderer.modalElement;
            if (modalElement) {
                const currentScreen = modalElement.querySelector(`[data-screen="${currentPage}"]`);
                const parentId = currentScreen?.dataset.parent;

                if (parentId) {
                    // Navigate directly to parent screen (hierarchical)
                    logger.info('Navigating to parent screen', { parent: parentId });
                    this.stateManager.navigateToPage(parentId);
                    this.renderer.showCurrentPage('backward');
                    this.renderer.updateSelection();
                } else {
                    // No parent defined, use navigation history (stack-based)
                    logger.info('Navigating back from sub-page');
                    await this.orchestrator.navigateBack();
                }
            } else {
                // Fallback to orchestrator
                await this.orchestrator.navigateBack();
            }
        }

        return true;
    }

    /**
     * Handle escape (alias for handleBack)
     * @returns {boolean} - True if handled
     */
    async handleEscape() {
        return await this.handleBack();
    }

    /**
     * Handle left arrow (not used in Settings currently)
     * @returns {boolean} - True if handled
     */
    handleLeft() {
        if (!this.stateManager.getIsVisible()) return false;
        // Reserved for future use (e.g., form controls)
        return true;
    }

    /**
     * Handle right arrow (not used in Settings currently)
     * @returns {boolean} - True if handled
     */
    handleRight() {
        if (!this.stateManager.getIsVisible()) return false;
        // Reserved for future use (e.g., form controls)
        return true;
    }

    /**
     * Main handler for ActionRouter
     * @param {string} action - Action name (up, down, enter, back, left, right)
     * @returns {boolean} - True if handled
     */
    async handleAction(action) {
        logger.debug('Handling action:', action);

        switch (action) {
            case 'up':
                return this.handleUp();
            case 'down':
                return this.handleDown();
            case 'enter':
                return await this.handleEnter();
            case 'back':
                return await this.handleBack();
            case 'left':
                return this.handleLeft();
            case 'right':
                return this.handleRight();
            default:
                logger.warn('Unknown action:', action);
                return false;
        }
    }
}
