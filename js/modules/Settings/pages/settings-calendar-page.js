// js/modules/Settings/pages/settings-calendar-page.js
// Calendar settings page - Main menu and calendar selection
// Ported from legacy with proper menu hierarchy and instant UI feedback

import { createLogger } from '../../../utils/logger.js';
import { getCalendarService } from '../../../data/services/calendar-service.js';
import UIUpdateHelper from '../utils/ui-update-helper.js';
import { SettingsPageBase } from '../core/settings-page-base.js';

const logger = createLogger('SettingsCalendarPage');

/**
 * Calendar Settings Page
 * Features:
 * - Main menu with sub-options
 * - Select Calendars sub-screen
 * - Calendar colors, sorting, dynamic counts
 * - Instant UI feedback using UIUpdateHelper
 * - Extends SettingsPageBase for standardized focus management
 */
export class SettingsCalendarPage extends SettingsPageBase {
    constructor() {
        super('calendar');
        this.calendarService = null;
        this.calendarData = {}; // Account-based calendar storage
        this.isLoading = false;
        this.currentSubScreen = null; // Track which sub-screen we're on
    }

    /**
     * Initialize the page
     */
    async initialize() {
        if (this.initialized) return;

        logger.verbose('Initializing Calendar settings page');

        try {
            this.calendarService = getCalendarService();
            this.initialized = true;
        } catch (error) {
            logger.error('Failed to initialize calendar page', error);
        }
    }

    /**
     * Render the main calendar menu page
     * @returns {string} - HTML string
     */
    render() {
        // Main calendar menu with options
        return `
            <div class="settings-modal__list">
                <!-- Calendars & Accounts Section -->
                <div class="settings-modal__section">
                    <div class="settings-modal__section-header">Calendars & Accounts</div>

                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable"
                         data-navigate="calendar-select"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Select Calendars</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>

                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable coming-soon"
                         data-navigate="calendar-add"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Add Calendar Accounts</span>
                        <span class="settings-modal__cell-status">Coming Soon</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>

                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable coming-soon"
                         data-navigate="calendar-remove"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Remove Calendar Accounts</span>
                        <span class="settings-modal__cell-status">Coming Soon</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>
                </div>

                <!-- Display Options Section -->
                <div class="settings-modal__section">
                    <div class="settings-modal__section-header">Display Options</div>

                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable coming-soon"
                         data-navigate="calendar-start-week"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Start Week On</span>
                        <span class="settings-modal__cell-value">Sun</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>

                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable coming-soon"
                         data-navigate="calendar-scroll-time"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Start Time to Scroll To</span>
                        <span class="settings-modal__cell-value">8 AM</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>

                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable coming-soon"
                         data-navigate="calendar-zoom"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Calendar Zoom</span>
                        <span class="settings-modal__cell-value">100%</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render the Select Calendars sub-screen
     * @returns {string} - HTML string
     */
    renderSelectCalendars() {
        if (this.isLoading) {
            return this.renderLoading();
        }

        if (Object.keys(this.calendarData).length === 0) {
            return this.renderEmpty();
        }

        return this.renderCalendarList();
    }

    /**
     * Render loading state
     */
    renderLoading() {
        return `
            <div class="settings-modal__page-content">
                <div class="settings-modal__empty">
                    <div class="settings-modal__spinner"></div>
                    <div class="settings-modal__empty-text">Loading calendars...</div>
                </div>
            </div>
        `;
    }

    /**
     * Render empty state
     */
    renderEmpty() {
        return `
            <div class="settings-modal__page-content">
                <div class="settings-modal__empty">
                    <div class="settings-modal__empty-icon">📅</div>
                    <div class="settings-modal__empty-text">No Calendars Found</div>
                    <div class="settings-modal__empty-text" style="font-size: var(--font-size-base); margin-top: 10px;">
                        Make sure you're logged in with a Google account
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render calendar list with account sections
     */
    renderCalendarList() {
        const accountSections = Object.entries(this.calendarData)
            .map(([accountType, account]) => this.renderAccountSection(accountType, account))
            .join('');

        return `
            <div class="settings-modal__list calendar-list-container">
                ${accountSections}
            </div>
        `;
    }

    /**
     * Render an account section with calendars
     * Includes: account header with counts, sorted calendar items
     */
    renderAccountSection(accountType, account) {
        const calendars = account.calendars || [];

        // Sort calendars: enabled first, then primary, then alphabetically
        const sortedCalendars = [...calendars].sort((a, b) => {
            // First by enabled status
            if (a.isActive && !b.isActive) return -1;
            if (!a.isActive && b.isActive) return 1;

            // Within same enabled status, primary first
            const aIsPrimary = a.id === 'primary' || a.id === account.email;
            const bIsPrimary = b.id === 'primary' || b.id === account.email;

            if (aIsPrimary && !bIsPrimary) return -1;
            if (!aIsPrimary && bIsPrimary) return 1;

            // Finally by name
            return (a.summary || '').localeCompare(b.summary || '');
        });

        const enabledCount = calendars.filter(c => c.isActive).length;
        const totalCount = calendars.length;
        const hiddenCount = totalCount - enabledCount;

        // Format count text
        let countText;
        if (enabledCount === 0) {
            countText = `${totalCount} calendar${totalCount !== 1 ? 's' : ''} hidden`;
        } else if (hiddenCount === 0) {
            countText = `${enabledCount} active calendar${enabledCount !== 1 ? 's' : ''}`;
        } else {
            countText = `${enabledCount} active, ${hiddenCount} hidden`;
        }

        return `
            <div class="settings-modal__section calendar-account-section" data-account="${accountType}">
                <div class="settings-modal__section-header calendar-account-header">
                    <span>${this.formatAccountDisplayLabel(accountType)}: ${account.email}</span>
                    <span class="calendar-count">- ${countText}</span>
                </div>
                ${sortedCalendars.map(cal => this.renderCalendarItem(accountType, cal)).join('')}
            </div>
        `;
    }

    /**
     * Render a single calendar item
     * Includes: color dot, calendar name, checkmark
     */
    renderCalendarItem(accountType, calendar) {
        const isEnabled = calendar.isActive;
        const color = calendar.backgroundColor || '#4285f4'; // Default Google blue

        return `
            <div class="settings-modal__menu-item settings-modal__menu-item--selectable calendar-item ${isEnabled ? 'enabled' : ''}"
                 data-calendar-id="${calendar.rawId}"
                 data-account-type="${accountType}"
                 data-prefixed-id="${calendar.prefixedId}"
                 role="button"
                 tabindex="0"
                 style="opacity: ${isEnabled ? '1' : '0.4'}">
                <span class="calendar-color-dot" style="background-color: ${color}; opacity: ${isEnabled ? '1' : '0.3'};"></span>
                <div class="settings-modal__menu-content">
                    <span class="settings-modal__menu-label">${calendar.summary || 'Unnamed Calendar'}</span>
                </div>
                <span class="settings-modal__cell-checkmark">${isEnabled ? '✓' : ''}</span>
            </div>
        `;
    }

    /**
     * Format account type for display
     */
    formatAccountDisplayLabel(accountType) {
        if (accountType === 'primary') {
            return 'Primary';
        }

        // Handle numbered accounts (account2, account3, etc.)
        const match = accountType.match(/^account(\d+)$/);
        if (match) {
            return `Account ${match[1]}`;
        }

        // Fallback - capitalize first letter
        return accountType.charAt(0).toUpperCase() + accountType.slice(1);
    }

    /**
     * Load calendars from all authenticated Google accounts
     */
    async loadCalendarsFromAllAccounts() {
        logger.info('Loading calendars from all accounts');

        try {
            this.isLoading = true;

            // Get all token accounts
            const edgeClient = this.calendarService.edgeClient;
            if (!edgeClient || !edgeClient.jwtToken) {
                logger.warn('No authenticated accounts found');
                this.calendarData = {};
                return;
            }

            // For now, load primary account
            // TODO: Multi-account support - iterate through all accounts
            const accountType = 'primary';

            const calendars = await this.calendarService.getCalendars(accountType);

            logger.info('🔍 DEBUG: Raw calendars from service:', {
                count: calendars.length,
                firstCalendar: calendars[0],
                allCalendars: calendars.map(c => ({
                    id: c.id,
                    summary: c.summary,
                    isActive: c.isActive,
                    prefixedId: c.prefixedId
                }))
            });

            // Get account email from TokenStore (the logged-in user's email)
            let primaryEmail = 'primary@gmail.com'; // fallback
            try {
                const tokenStore = window.sessionManager?.getTokenStore();
                if (tokenStore) {
                    const tokenData = await tokenStore.getAccountTokens('google', accountType);
                    if (tokenData && tokenData.email) {
                        primaryEmail = tokenData.email;
                        logger.debug('Got account email from TokenStore', { email: primaryEmail });
                    }
                }
            } catch (error) {
                logger.warn('Failed to get account email from TokenStore, using fallback', error);
            }

            this.calendarData[accountType] = {
                displayName: 'Primary',
                email: primaryEmail,
                calendars: calendars
            };

            logger.success('Calendars loaded', {
                accounts: Object.keys(this.calendarData).length,
                totalCalendars: calendars.length,
                activeCount: calendars.filter(c => c.isActive).length,
                accountEmail: primaryEmail
            });

        } catch (error) {
            logger.error('Failed to load calendars', error);
            this.calendarData = {};
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Get focusable elements for this page
     * Overrides base class to handle sub-screens
     * @returns {Array<HTMLElement>}
     */
    getFocusableElements() {
        // If on calendar-select sub-screen, return calendar items
        if (this.currentSubScreen === 'calendar-select') {
            const screen = document.querySelector('[data-screen="calendar-select"].settings-modal__screen--active');
            if (screen) {
                return Array.from(screen.querySelectorAll('.calendar-item'));
            }
        }

        // Main calendar page - return menu items
        const screen = document.querySelector('[data-screen="calendar"].settings-modal__screen--active');
        if (screen) {
            return Array.from(screen.querySelectorAll('.settings-modal__menu-item'));
        }

        return [];
    }

    /**
     * Get selection behavior for an item
     * Overrides base class to define calendar-specific behavior
     * @param {HTMLElement} item - The clicked item
     * @returns {Object} Behavior configuration
     */
    getSelectionBehavior(item) {
        // Calendar items: toggle behavior (multi-select)
        if (item.classList.contains('calendar-item')) {
            return { type: 'toggle' };
        }

        // "Coming Soon" items: no behavior
        if (item.classList.contains('coming-soon')) {
            return { type: 'none' };
        }

        // Menu items with navigate attribute: navigate
        if (item.dataset.navigate) {
            return { type: 'navigate' };
        }

        return { type: 'none' };
    }

    /**
     * Handle toggle item (calendar selection)
     * Overrides base class to implement calendar toggle
     * @param {HTMLElement} item - The calendar item to toggle
     */
    async handleToggleItem(item) {
        await this.toggleCalendar(item);
    }

    /**
     * Handle activation (page shown)
     */
    async activate() {
        logger.debug('Calendar page activated');

        // Check if we're entering a sub-screen
        const urlParams = new URLSearchParams(window.location.hash.substring(1));
        this.currentSubScreen = urlParams.get('subscreen');

        // Attach event listeners
        this.attachEventListeners();

        // Set initial focus to first menu item if on main calendar page
        // The state manager will handle this after a short delay
        if (!this.currentSubScreen) {
            setTimeout(() => {
                const firstMenuItem = document.querySelector('.settings-modal__screen--active .settings-modal__menu-item');
                if (firstMenuItem) {
                    logger.debug('Setting initial focus to first calendar menu item');
                }
            }, 50);
        }
    }

    /**
     * Handle deactivation (page hidden)
     */
    deactivate() {
        logger.debug('Calendar page deactivated');
        this.detachEventListeners();
        this.currentSubScreen = null;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        const calendarItems = document.querySelectorAll('.calendar-item');

        calendarItems.forEach(item => {
            // Remove old listeners by cloning
            const newItem = item.cloneNode(true);
            item.parentNode?.replaceChild(newItem, item);
        });

        // Attach fresh listeners
        const freshItems = document.querySelectorAll('.calendar-item');
        freshItems.forEach(item => {
            item.addEventListener('click', this.handleCalendarClick.bind(this));
            item.addEventListener('keydown', this.handleCalendarKeydown.bind(this));
        });

        if (freshItems.length > 0) {
            logger.debug('Event listeners attached to calendar items');
        }
    }

    /**
     * Detach event listeners
     */
    detachEventListeners() {
        const calendarItems = document.querySelectorAll('.calendar-item');

        calendarItems.forEach(item => {
            item.removeEventListener('click', this.handleCalendarClick.bind(this));
            item.removeEventListener('keydown', this.handleCalendarKeydown.bind(this));
        });
    }

    /**
     * Handle calendar item click (toggle active)
     */
    async handleCalendarClick(event) {
        const item = event.currentTarget;
        await this.toggleCalendar(item);
    }

    /**
     * Handle calendar item keydown (Enter to toggle)
     */
    async handleCalendarKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const item = event.currentTarget;
            await this.toggleCalendar(item);
        }
    }

    /**
     * Toggle calendar enabled/disabled state
     * Uses UIUpdateHelper for instant feedback
     */
    async toggleCalendar(item) {
        const accountType = item.dataset.accountType;
        const calendarId = item.dataset.calendarId;
        const prefixedId = item.dataset.prefixedId;

        const isCurrentlyActive = item.classList.contains('enabled');
        const newActiveState = !isCurrentlyActive;

        logger.info('🔍 DEBUG: Calendar toggled', {
            accountType,
            calendarId,
            prefixedId,
            isCurrentlyActive,
            newState: newActiveState
        });

        try {
            // Use UIUpdateHelper for instant UI feedback
            await UIUpdateHelper.updateThenSave(
                // 1. Instant UI update
                () => {
                    logger.info('🔍 DEBUG: Updating UI instantly');
                    UIUpdateHelper.toggleCalendarItem(item, newActiveState);
                },
                // 2. Async save operation
                async () => {
                    logger.info('🔍 DEBUG: Starting async save operation');

                    if (newActiveState) {
                        logger.info('🔍 DEBUG: Calling enableCalendar');
                        await this.calendarService.enableCalendar(accountType, calendarId);
                    } else {
                        logger.info('🔍 DEBUG: Calling disableCalendar');
                        await this.calendarService.disableCalendar(accountType, calendarId);
                    }

                    logger.info('🔍 DEBUG: Save completed, updating local data');

                    // Update local calendar data to reflect the change
                    // This avoids refetching and prevents race conditions
                    const account = this.calendarData[accountType];
                    if (account) {
                        const calendar = account.calendars.find(c => c.rawId === calendarId);
                        if (calendar) {
                            calendar.isActive = newActiveState;
                            logger.info('🔍 DEBUG: Local calendar data updated');
                        } else {
                            logger.warn('🔍 DEBUG: Calendar not found in local data!', { calendarId });
                        }
                    }

                    // Update account header count with local data
                    this.updateAccountHeaderCountFromDOM(accountType);
                },
                // 3. Rollback on error
                () => {
                    logger.error('🔍 DEBUG: Rolling back UI due to error');
                    UIUpdateHelper.toggleCalendarItem(item, isCurrentlyActive);
                }
            );

            logger.success(`🔍 DEBUG: Calendar ${newActiveState ? 'enabled' : 'disabled'}`, { prefixedId });

        } catch (error) {
            logger.error('Failed to toggle calendar', { prefixedId, error });
        }
    }

    /**
     * Update the calendar count in an account header (from data)
     */
    updateAccountHeaderCount(accountType) {
        const section = document.querySelector(`[data-account="${accountType}"]`);
        if (!section) return;

        const header = section.querySelector('.calendar-account-header');
        const countSpan = header?.querySelector('.calendar-count');
        if (!countSpan) return;

        const account = this.calendarData[accountType];
        if (!account) return;

        const calendars = account.calendars || [];
        const enabledCount = calendars.filter(cal => cal.isActive).length;
        const totalCount = calendars.length;
        const hiddenCount = totalCount - enabledCount;

        // Format count text
        let countText;
        if (enabledCount === 0) {
            countText = `${totalCount} calendar${totalCount !== 1 ? 's' : ''} hidden`;
        } else if (hiddenCount === 0) {
            countText = `${enabledCount} active calendar${enabledCount !== 1 ? 's' : ''}`;
        } else {
            countText = `${enabledCount} active, ${hiddenCount} hidden`;
        }

        UIUpdateHelper.updateCounter(countSpan, `- ${countText}`);
    }

    /**
     * Update the calendar count in an account header (from DOM)
     * This version counts enabled calendars directly from the DOM to avoid race conditions
     */
    updateAccountHeaderCountFromDOM(accountType) {
        const section = document.querySelector(`[data-account="${accountType}"]`);
        if (!section) return;

        const header = section.querySelector('.calendar-account-header');
        const countSpan = header?.querySelector('.calendar-count');
        if (!countSpan) return;

        // Count from DOM instead of data to avoid race conditions
        const allCalendarItems = section.querySelectorAll('.calendar-item');
        const enabledCalendarItems = section.querySelectorAll('.calendar-item.enabled');

        const totalCount = allCalendarItems.length;
        const enabledCount = enabledCalendarItems.length;
        const hiddenCount = totalCount - enabledCount;

        // Format count text
        let countText;
        if (enabledCount === 0) {
            countText = `${totalCount} calendar${totalCount !== 1 ? 's' : ''} hidden`;
        } else if (hiddenCount === 0) {
            countText = `${enabledCount} active calendar${enabledCount !== 1 ? 's' : ''}`;
        } else {
            countText = `${enabledCount} active, ${hiddenCount} hidden`;
        }

        UIUpdateHelper.updateCounter(countSpan, `- ${countText}`);
    }
}
