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
        logger.verbose('Initializing SettingsModalRenderer');

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

            let html = `
                <div class="settings-modal__screen" data-screen="${pageId}" data-title="${menuItem.label}">
                    ${page.render()}
                </div>
            `;

            // Add sub-screens for Display page
            if (pageId === 'display') {
                html += this.buildDisplaySubScreens();
            }

            // Add sub-screens for Calendar page
            if (pageId === 'calendar') {
                html += this.buildCalendarSubScreens();
            }

            return html;
        }).join('');

        return pagesHTML;
    }

    /**
     * Build Display page sub-screens
     * @returns {string} - HTML string
     */
    buildDisplaySubScreens() {
        const displayPage = this.pages.display;

        return `
            <!-- Theme Selection -->
            <div class="settings-modal__screen" data-screen="display-theme" data-title="Theme" data-parent="display">
                ${displayPage.renderThemeScreen()}
            </div>

            <!-- Sleep Timer - Hour Selection -->
            <div class="settings-modal__screen" data-screen="display-sleep-time-hour" data-title="Sleep Timer" data-parent="display">
                ${displayPage.renderSleepTimeHourScreen()}
            </div>

            <!-- Sleep Timer - Minute Selection -->
            <div class="settings-modal__screen" data-screen="display-sleep-time-min" data-title="Sleep Timer" data-parent="display">
                ${displayPage.renderSleepTimeMinScreen()}
            </div>

            <!-- Sleep Timer - Period Selection -->
            <div class="settings-modal__screen" data-screen="display-sleep-time-period" data-title="Sleep Timer" data-parent="display">
                ${displayPage.renderSleepTimePeriodScreen()}
            </div>

            <!-- Wake Timer - Hour Selection -->
            <div class="settings-modal__screen" data-screen="display-wake-time-hour" data-title="Wake Timer" data-parent="display">
                ${displayPage.renderWakeTimeHourScreen()}
            </div>

            <!-- Wake Timer - Minute Selection -->
            <div class="settings-modal__screen" data-screen="display-wake-time-min" data-title="Wake Timer" data-parent="display">
                ${displayPage.renderWakeTimeMinScreen()}
            </div>

            <!-- Wake Timer - Period Selection -->
            <div class="settings-modal__screen" data-screen="display-wake-time-period" data-title="Wake Timer" data-parent="display">
                ${displayPage.renderWakeTimePeriodScreen()}
            </div>
        `;
    }

    /**
     * Build Calendar page sub-screens
     * @returns {string} - HTML string
     */
    buildCalendarSubScreens() {
        return `
            <!-- Select Calendars -->
            <div class="settings-modal__screen" data-screen="calendar-select" data-title="Select Calendars" data-parent="calendar">
                <!-- Initial loading state - will be replaced when data loads -->
                <div class="settings-modal__page-content">
                    <div class="settings-modal__empty">
                        <div class="settings-modal__spinner"></div>
                        <div class="settings-modal__empty-text">Loading calendars...</div>
                    </div>
                </div>
            </div>
        `;
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

        // Get current screen element to check if it has a parent
        const currentScreenElement = this.modalElement.querySelector(`[data-screen="${currentPage}"]`);
        const hasParent = currentScreenElement?.dataset.parent;

        // Update nav bar
        if (currentPage === 'main') {
            // Main menu: show Close button, hide Back button
            if (navBack) navBack.style.display = 'none';
            if (navClose) navClose.style.display = 'block';
            if (navTitle) navTitle.textContent = 'Settings';
        } else {
            // Sub-page or sub-screen: show Back button, hide Close button
            if (navBack) navBack.style.display = 'block';
            if (navClose) navClose.style.display = 'none';
            if (currentScreenElement && navTitle) {
                navTitle.textContent = currentScreenElement.dataset.title || 'Settings';
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

                // Activate page if it's not main and it's a regular page (not a sub-screen)
                if (screenId !== 'main' && this.pages[screenId]) {
                    this.pages[screenId].activate();

                    // Reset selection to first item when navigating to a sub-page from main
                    if (direction === 'forward' && previousPage === 'main') {
                        this.stateManager.setSelectedIndex(0);
                    }
                }

                // Reset selection when navigating to Display sub-screens
                if (screenId.startsWith('display-') && direction === 'forward') {
                    // Find the checked/current item and start selection there
                    const checkedItem = screen.querySelector('.settings-modal__menu-item--checked');
                    if (checkedItem) {
                        // Find the index of the checked item
                        const allItems = Array.from(screen.querySelectorAll('.settings-modal__menu-item'));
                        const checkedIndex = allItems.indexOf(checkedItem);
                        if (checkedIndex !== -1) {
                            this.stateManager.setSelectedIndex(checkedIndex);
                        } else {
                            this.stateManager.setSelectedIndex(0);
                        }
                    } else {
                        this.stateManager.setSelectedIndex(0);
                    }
                }

                // Handle Calendar sub-screens
                if (screenId.startsWith('calendar-') && direction === 'forward') {
                    // Load calendar data when entering calendar-select
                    if (screenId === 'calendar-select' && this.pages.calendar) {
                        logger.info('🔍 DEBUG: Starting calendar data load');
                        this.pages.calendar.loadCalendarsFromAllAccounts().then(() => {
                            logger.info('🔍 DEBUG: Calendar data loaded, re-rendering');

                            // Re-render the calendar list with loaded data
                            const calendarSelectScreen = this.modalElement.querySelector('[data-screen="calendar-select"]');
                            if (calendarSelectScreen) {
                                const renderedHTML = this.pages.calendar.renderSelectCalendars();
                                logger.info('🔍 DEBUG: Rendered HTML length:', renderedHTML.length);

                                calendarSelectScreen.innerHTML = renderedHTML;

                                // Attach event listeners
                                this.pages.calendar.attachEventListeners();

                                // Reset selection to first item and update UI
                                this.stateManager.setSelectedIndex(0);
                                this.updateSelection();

                                logger.info('🔍 DEBUG: Selection updated, checking focusable elements');
                                const focusable = this.getFocusableElements();
                                logger.info('🔍 DEBUG: Focusable elements:', focusable.length);
                            } else {
                                logger.error('🔍 DEBUG: Calendar select screen not found!');
                            }
                        }).catch(error => {
                            logger.error('🔍 DEBUG: Error loading calendars:', error);
                        });
                    } else {
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

        let selectedElement = null;

        // Apply selection to current context
        if (currentPage === 'main') {
            // Highlight menu item on main screen
            const menuItems = this.modalElement.querySelectorAll('[data-screen="main"] .settings-modal__menu-item');
            if (menuItems[selectedIndex]) {
                menuItems[selectedIndex].classList.add('settings-modal__menu-item--selected');
                selectedElement = menuItems[selectedIndex];
            }
        } else if (currentPage.startsWith('display-')) {
            // Display sub-screens: query the active screen directly
            const activeScreen = this.modalElement.querySelector(`[data-screen="${currentPage}"].settings-modal__screen--active`);
            if (activeScreen) {
                const menuItems = activeScreen.querySelectorAll('.settings-modal__menu-item');
                if (menuItems[selectedIndex]) {
                    menuItems[selectedIndex].classList.add('settings-modal__menu-item--selected');
                    selectedElement = menuItems[selectedIndex];
                }
            }
        } else {
            // Highlight item on sub-page (if page has getFocusableElements)
            const page = this.pages[currentPage];
            if (page && page.getFocusableElements) {
                const focusableElements = page.getFocusableElements();
                if (focusableElements[selectedIndex]) {
                    focusableElements[selectedIndex].classList.add('settings-modal__menu-item--selected');
                    selectedElement = focusableElements[selectedIndex];
                }
            }
        }

        // Auto-scroll to keep selected item in view
        if (selectedElement) {
            this.scrollToElement(selectedElement);
        }
    }

    /**
     * Scroll to keep element in view
     * @param {HTMLElement} element - Element to scroll to
     */
    scrollToElement(element) {
        if (!element) return;

        const scrollContainer = element.closest('.settings-modal__screen');
        if (!scrollContainer) return;

        const containerRect = scrollContainer.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();

        // Check if element is above visible area
        if (elementRect.top < containerRect.top) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // Check if element is below visible area
        else if (elementRect.bottom > containerRect.bottom) {
            element.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
        } else if (currentPage.startsWith('display-') || currentPage.startsWith('calendar-')) {
            // Sub-screens: query the active screen directly
            const activeScreen = this.modalElement.querySelector(`[data-screen="${currentPage}"].settings-modal__screen--active`);
            if (activeScreen) {
                return Array.from(activeScreen.querySelectorAll('.settings-modal__menu-item'));
            }
            return [];
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
        // Check if this is a toggle switch click
        const toggleItem = event.target.closest('.settings-modal__menu-item--toggle');
        if (toggleItem) {
            // Find the checkbox inside the toggle
            const checkbox = toggleItem.querySelector('input[type="checkbox"]');
            if (checkbox && event.target !== checkbox && !event.target.closest('.settings-modal__toggle-switch')) {
                // Toggle the checkbox programmatically
                checkbox.checked = !checkbox.checked;
                // Trigger change event
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                return;
            }
        }

        const target = event.target.closest('[data-action], [data-page], [data-navigate], [data-setting][data-value], [data-hour], [data-minute], [data-period]');

        if (!target) return;

        // Handle action buttons (close, back)
        if (target.dataset.action) {
            event.preventDefault();

            switch (target.dataset.action) {
                case 'close':
                    logger.info('Close button clicked');
                    if (window.Settings) {
                        await window.Settings.hide();
                    }
                    break;

                case 'back':
                    logger.info('Back button clicked');
                    const currentPage = this.stateManager.getCurrentPage();
                    if (currentPage !== 'main') {
                        // Check if current screen has a parent (like display-theme has parent="display")
                        const currentScreen = this.modalElement.querySelector(`[data-screen="${currentPage}"]`);
                        const parentId = currentScreen?.dataset.parent;

                        if (parentId) {
                            // Navigate directly to parent screen (not through history)
                            logger.info('Navigating to parent screen', { parent: parentId });
                            this.stateManager.navigateToPage(parentId);
                        } else {
                            // No parent defined, use navigation history
                            this.stateManager.navigateBack();
                        }

                        this.showCurrentPage('backward');
                        this.updateSelection();
                    }
                    break;
            }
            return;
        }

        // Handle main menu navigation (data-page)
        if (target.dataset.page && target.classList.contains('settings-modal__menu-item')) {
            event.preventDefault();
            const pageId = target.dataset.page;
            const index = parseInt(target.dataset.index, 10);

            logger.info('Menu item clicked', { pageId, index });

            this.stateManager.setSelectedIndex(index);
            this.updateSelection();

            this.stateManager.navigateToPage(pageId);
            this.showCurrentPage('forward');
            this.updateSelection();
            return;
        }

        // IMPORTANT: Check time selection BEFORE navigation
        // Time selection cells have both data-period AND data-navigate, so we need to handle them first
        if (target.dataset.setting || target.dataset.hour || target.dataset.minute || target.dataset.period) {
            event.preventDefault();

            const currentPage = this.stateManager.getCurrentPage();

            // Check if this is a time selection cell (has hour, minute, or period data)
            const isTimeSelection = !!(target.dataset.hour || target.dataset.minute || target.dataset.period);

            if (isTimeSelection) {
                const displayPage = this.pages.display;
                if (displayPage && displayPage.getTimeHandler) {
                    const timeHandler = displayPage.getTimeHandler();
                    const action = timeHandler.handleSelection(target);

                    if (action.type === 'navigate') {
                        // Update checkmark FIRST for instant visual feedback
                        const currentScreen = this.modalElement.querySelector(`[data-screen="${currentPage}"]`);
                        if (currentScreen) {
                            // Remove all checkmarks first
                            currentScreen.querySelectorAll('.settings-modal__menu-item--checked').forEach(item => {
                                item.classList.remove('settings-modal__menu-item--checked');
                                const checkmark = item.querySelector('.settings-modal__cell-checkmark');
                                if (checkmark) checkmark.textContent = '';
                            });

                            // Add checkmark to selected item
                            target.classList.add('settings-modal__menu-item--checked');
                            const checkmark = target.querySelector('.settings-modal__cell-checkmark');
                            if (checkmark) checkmark.textContent = '✓';
                        }

                        // THEN navigate to next time selection screen
                        logger.info('Time selection - navigating', { screen: action.screenId });
                        this.stateManager.navigateToPage(action.screenId);
                        this.showCurrentPage('forward');
                        this.updateSelection();
                        return;
                    } else if (action.type === 'complete') {
                        // Update checkmark FIRST for instant visual feedback
                        const currentScreen = this.modalElement.querySelector(`[data-screen="${currentPage}"]`);
                        if (currentScreen) {
                            // Remove all checkmarks first
                            currentScreen.querySelectorAll('.settings-modal__menu-item--checked').forEach(item => {
                                item.classList.remove('settings-modal__menu-item--checked');
                                const checkmark = item.querySelector('.settings-modal__cell-checkmark');
                                if (checkmark) checkmark.textContent = '';
                            });

                            // Add checkmark to selected item
                            target.classList.add('settings-modal__menu-item--checked');
                            const checkmark = target.querySelector('.settings-modal__cell-checkmark');
                            if (checkmark) checkmark.textContent = '✓';
                        }

                        // Time selection complete - save and navigate back
                        logger.info('Time selection complete', { setting: action.setting, value: action.value });

                        // Update the display on the main Display screen
                        displayPage.updateTimeDisplay(action.setting);

                        // Navigate back to Display screen using parent hierarchy (not stack)
                        // Pop back through the stack until we reach 'display'
                        let didNavigate = true;
                        while (didNavigate && this.stateManager.getCurrentPage() !== 'display') {
                            didNavigate = this.stateManager.navigateBack();
                        }

                        this.showCurrentPage('backward');
                        this.updateSelection();

                        // Save the time setting in the background (non-blocking for UI)
                        if (window.settingsStore) {
                            window.settingsStore.set(action.setting, action.value);
                            await window.settingsStore.save();
                        }

                        return;
                    }
                }
            }

            // Handle theme selection
            if (target.dataset.setting === 'interface.theme' && target.dataset.value) {
                const setting = target.dataset.setting;
                const value = target.dataset.value;

                logger.info('Setting selected', { setting, value });

                const displayPage = this.pages.display;
                if (displayPage) {
                    // Update the checkmarks FIRST for instant visual feedback
                    const currentScreen = this.modalElement.querySelector(`[data-screen="${currentPage}"]`);
                    if (currentScreen) {
                        // Remove all checkmarks first
                        currentScreen.querySelectorAll('.settings-modal__menu-item--checked').forEach(item => {
                            item.classList.remove('settings-modal__menu-item--checked');
                            const checkmark = item.querySelector('.settings-modal__cell-checkmark');
                            if (checkmark) checkmark.textContent = '';
                        });

                        // Add checkmark to selected item
                        target.classList.add('settings-modal__menu-item--checked');
                        const checkmark = target.querySelector('.settings-modal__cell-checkmark');
                        if (checkmark) checkmark.textContent = '✓';
                    }

                    // THEN apply the theme (visual changes happen after UI feedback)
                    await displayPage.setTheme(value);
                }
                return;
            }
        }

        // Delegate to page's handleItemClick if page extends SettingsPageBase
        const currentPage = this.stateManager.getCurrentPage();
        const page = this.pages[currentPage];

        if (page && typeof page.handleItemClick === 'function') {
            event.preventDefault();

            try {
                const action = await page.handleItemClick(target);

                // Handle navigation if requested
                if (action && action.shouldNavigate && action.navigateTo) {
                    logger.info('Page requested navigation', { to: action.navigateTo });
                    this.stateManager.navigateToPage(action.navigateTo);
                    this.showCurrentPage('forward');
                    this.updateSelection();
                }

                // If page handled the click, we're done
                return;
            } catch (error) {
                logger.error('Error in page handleItemClick', error);
            }
        }

        // Fallback: Handle sub-page navigation (data-navigate)
        // This comes AFTER time selection handling because time cells have both data-period AND data-navigate
        if (target.dataset.navigate) {
            event.preventDefault();
            const targetScreen = target.dataset.navigate;
            logger.info('Navigating to sub-screen', { screen: targetScreen });

            // Navigate to the target screen
            this.stateManager.navigateToPage(targetScreen);
            this.showCurrentPage('forward');
            this.updateSelection();
            return;
        }
    }
}
