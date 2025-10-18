// js/modules/Settings/ui/settings-modal-renderer.js
// Renders the settings modal UI

import { createLogger } from '../../../utils/logger.js';
import { SettingsFamilyPage } from '../pages/settings-family-page.js';
import { SettingsDisplayPage } from '../pages/settings-display-page.js';
import { SettingsCalendarPage } from '../pages/settings-calendar-page.js';
import { SettingsPhotosPage } from '../pages/settings-photos-page.js';
import { SettingsSystemPage } from '../pages/settings-system-page.js';
import { SettingsAccountPage } from '../pages/settings-account-page.js';
import { SettingsDeveloperPage } from '../pages/settings-developer-page.js';

const logger = createLogger('SettingsModalRenderer');

/**
 * Settings Modal Renderer
 * Handles rendering of the settings modal and all pages
 */
export class SettingsModalRenderer {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.modalElement = null;

        // Initialize page instances
        this.pages = {
            family: new SettingsFamilyPage(),
            display: new SettingsDisplayPage(),
            calendar: new SettingsCalendarPage(),
            photos: new SettingsPhotosPage(),
            system: new SettingsSystemPage(),
            account: new SettingsAccountPage(),
            developer: new SettingsDeveloperPage()
        };

        // Menu items configuration
        this.menuItems = [
            { id: 'family', icon: '👨‍👩‍👧‍👦', label: 'Family' },
            { id: 'display', icon: '🎨', label: 'Display' },
            { id: 'calendar', icon: '📅', label: 'Calendar' },
            { id: 'photos', icon: '📸', label: 'Photos' },
            { id: 'system', icon: '⚙️', label: 'System' },
            { id: 'account', icon: '👤', label: 'Account' },
            { id: 'developer', icon: '🔧', label: 'Developer' }
        ];
    }

    /**
     * Initialize renderer and pages
     */
    async initialize() {
        logger.info('Initializing SettingsModalRenderer');

        // Initialize all pages
        for (const [key, page] of Object.entries(this.pages)) {
            await page.initialize();
        }

        // Bind click handler
        this.handleClick = this.handleClick.bind(this);
    }

    /**
     * Render the settings modal
     */
    render() {
        logger.debug('Rendering settings modal');

        // Create modal element if it doesn't exist
        if (!this.modalElement) {
            this.modalElement = document.createElement('div');
            this.modalElement.className = 'settings-modal';
            this.modalElement.innerHTML = this.buildModalHTML();
            document.body.appendChild(this.modalElement);
        }

        // Show the current page
        this.showCurrentPage();

        // Update selection
        this.updateSelection();

        return this.modalElement;
    }

    /**
     * Build the complete modal HTML structure
     * @returns {string} - HTML string
     */
    buildModalHTML() {
        return `
            <div class="settings-modal__container">
                <div class="settings-modal__nav-bar">
                    <button class="settings-modal__nav-back" data-action="back" style="display: none;">
                        ‹ Back
                    </button>
                    <button class="settings-modal__nav-close" data-action="close" style="display: none;">
                        Close
                    </button>
                    <h1 class="settings-modal__nav-title">Settings</h1>
                </div>
                <div class="settings-modal__content">
                    <div class="settings-modal__screens">
                        ${this.buildMainMenuHTML()}
                        ${this.buildPagesHTML()}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Build main menu HTML
     * @returns {string} - HTML string
     */
    buildMainMenuHTML() {
        const menuItemsHTML = this.menuItems.map((item, index) => `
            <div
                class="settings-modal__menu-item"
                data-page="${item.id}"
                data-index="${index}"
                role="button"
                tabindex="0"
            >
                <span class="settings-modal__menu-label">${item.label}</span>
                <span class="settings-modal__menu-chevron">›</span>
            </div>
        `).join('');

        return `
            <div class="settings-modal__screen settings-modal__screen--active" data-screen="main" data-title="Settings">
                <div class="settings-modal__list">
                    <div class="settings-modal__section">
                        ${menuItemsHTML}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Build all pages HTML
     * @returns {string} - HTML string
     */
    buildPagesHTML() {
        const pagesHTML = Object.keys(this.pages).map(pageId => {
            const page = this.pages[pageId];
            const menuItem = this.menuItems.find(item => item.id === pageId);

            return `
                <div class="settings-modal__screen" data-screen="${pageId}" data-title="${menuItem.label}">
                    ${page.render()}
                </div>
            `;
        }).join('');

        return pagesHTML;
    }

    /**
     * Show the current page based on state
     */
    showCurrentPage(direction = 'forward') {
        if (!this.modalElement) return;

        const currentPage = this.stateManager.getCurrentPage();
        const previousPage = this.previousPage || 'main';
        const screens = this.modalElement.querySelectorAll('.settings-modal__screen');
        const navBack = this.modalElement.querySelector('.settings-modal__nav-back');
        const navClose = this.modalElement.querySelector('.settings-modal__nav-close');
        const navTitle = this.modalElement.querySelector('.settings-modal__nav-title');

        // Update nav bar
        if (currentPage === 'main') {
            // Main menu: show Close button, hide Back button
            if (navBack) navBack.style.display = 'none';
            if (navClose) navClose.style.display = 'block';
            if (navTitle) navTitle.textContent = 'Settings';
        } else {
            // Sub-page: show Back button, hide Close button
            if (navBack) navBack.style.display = 'block';
            if (navClose) navClose.style.display = 'none';
            const screenElement = this.modalElement.querySelector(`[data-screen="${currentPage}"]`);
            if (screenElement && navTitle) {
                navTitle.textContent = screenElement.dataset.title || 'Settings';
            }
        }

        // Get screen elements
        const currentScreen = this.modalElement.querySelector(`[data-screen="${currentPage}"]`);
        const prevScreen = this.modalElement.querySelector(`[data-screen="${previousPage}"]`);

        // Apply animations
        if (currentScreen && prevScreen && currentPage !== previousPage) {
            if (direction === 'forward') {
                // Forward navigation: new screen slides in from right, old slides out to left
                currentScreen.classList.add('settings-modal__screen--sliding-in-right');
                prevScreen.classList.add('settings-modal__screen--sliding-out-left');
            } else {
                // Back navigation: new screen slides in from left, old slides out to right
                currentScreen.classList.add('settings-modal__screen--sliding-in-left');
                prevScreen.classList.add('settings-modal__screen--sliding-out-right');
            }

            // Clean up animation classes after animation completes
            setTimeout(() => {
                currentScreen.classList.remove('settings-modal__screen--sliding-in-right', 'settings-modal__screen--sliding-in-left');
                prevScreen.classList.remove('settings-modal__screen--sliding-out-left', 'settings-modal__screen--sliding-out-right');
            }, 300);
        }

        // Show/hide screens
        screens.forEach(screen => {
            const screenId = screen.dataset.screen;
            if (screenId === currentPage) {
                screen.classList.add('settings-modal__screen--active');

                // Activate page if it's not main
                if (screenId !== 'main' && this.pages[screenId]) {
                    this.pages[screenId].activate();

                    // Reset selection to first item when navigating to a sub-page
                    if (direction === 'forward' && previousPage === 'main') {
                        this.stateManager.setSelectedIndex(0);
                    }
                }
            } else {
                screen.classList.remove('settings-modal__screen--active');
            }
        });

        // Store current page for next transition
        this.previousPage = currentPage;
    }

    /**
     * Update selection highlighting
     */
    updateSelection() {
        if (!this.modalElement) return;

        const currentPage = this.stateManager.getCurrentPage();
        const selectedIndex = this.stateManager.getSelectedIndex();

        // Remove all selection classes
        this.modalElement.querySelectorAll('.settings-modal__menu-item--selected').forEach(el => {
            el.classList.remove('settings-modal__menu-item--selected');
        });

        // Apply selection to current context
        if (currentPage === 'main') {
            // Highlight menu item on main screen
            const menuItems = this.modalElement.querySelectorAll('[data-screen="main"] .settings-modal__menu-item');
            if (menuItems[selectedIndex]) {
                menuItems[selectedIndex].classList.add('settings-modal__menu-item--selected');
            }
        } else {
            // Highlight item on sub-page (if page has getFocusableElements)
            const page = this.pages[currentPage];
            if (page && page.getFocusableElements) {
                const focusableElements = page.getFocusableElements();
                if (focusableElements[selectedIndex]) {
                    focusableElements[selectedIndex].classList.add('settings-modal__menu-item--selected');
                }
            }
        }
    }

    /**
     * Show the modal
     */
    show() {
        if (!this.modalElement) {
            this.render();
        }

        // Attach event listeners
        this.attachEventListeners();

        // Show modal with animation
        this.modalElement.style.display = 'flex';
        setTimeout(() => {
            this.modalElement.classList.add('settings-modal--visible');
        }, 10);
    }

    /**
     * Hide the modal
     */
    hide() {
        if (!this.modalElement) return;

        this.modalElement.classList.remove('settings-modal--visible');
        setTimeout(() => {
            if (this.modalElement) {
                this.modalElement.style.display = 'none';
            }
        }, 200); // Match transition duration
    }

    /**
     * Destroy the modal
     */
    destroy() {
        if (this.modalElement && this.modalElement.parentNode) {
            this.modalElement.parentNode.removeChild(this.modalElement);
            this.modalElement = null;
        }
    }

    /**
     * Get focusable elements for current view
     * @returns {Array<HTMLElement>}
     */
    getFocusableElements() {
        if (!this.modalElement) return [];

        const currentPage = this.stateManager.getCurrentPage();

        if (currentPage === 'main') {
            return Array.from(this.modalElement.querySelectorAll('[data-screen="main"] .settings-modal__menu-item'));
        } else {
            // Get focusable elements from the page if it implements the method
            const page = this.pages[currentPage];
            if (page && page.getFocusableElements) {
                return page.getFocusableElements();
            }
            return [];
        }
    }

    /**
     * Attach event listeners to modal
     */
    attachEventListeners() {
        if (!this.modalElement) return;

        // Remove existing listeners to avoid duplicates
        this.removeEventListeners();

        // Add click listener
        this.modalElement.addEventListener('click', this.handleClick);
    }

    /**
     * Remove event listeners from modal
     */
    removeEventListeners() {
        if (!this.modalElement) return;

        this.modalElement.removeEventListener('click', this.handleClick);
    }

    /**
     * Handle click events
     * @param {MouseEvent} event
     */
    async handleClick(event) {
        const target = event.target.closest('[data-action], [data-page]');

        if (!target) return;

        // Handle action buttons
        if (target.dataset.action) {
            event.preventDefault();

            switch (target.dataset.action) {
                case 'close':
                    logger.info('Close button clicked');
                    // Get orchestrator from window.Settings
                    if (window.Settings) {
                        await window.Settings.hide();
                    }
                    break;

                case 'back':
                    logger.info('Back button clicked');
                    const currentPage = this.stateManager.getCurrentPage();
                    if (currentPage !== 'main') {
                        this.stateManager.navigateBack();
                        this.showCurrentPage('backward');
                        this.updateSelection();
                    }
                    break;
            }
            return;
        }

        // Handle menu item clicks
        if (target.dataset.page && target.classList.contains('settings-modal__menu-item')) {
            event.preventDefault();
            const pageId = target.dataset.page;
            const index = parseInt(target.dataset.index, 10);

            logger.info('Menu item clicked', { pageId, index });

            // Update selection state
            this.stateManager.setSelectedIndex(index);
            this.updateSelection();

            // Navigate to page
            this.stateManager.navigateToPage(pageId);
            this.showCurrentPage('forward');
            this.updateSelection();
        }
    }
}
