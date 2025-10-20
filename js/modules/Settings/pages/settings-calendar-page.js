// js/modules/Settings/pages/settings-calendar-page.js
// Calendar settings page - Main menu and calendar selection
// Ported from legacy with proper menu hierarchy and instant UI feedback

import { createLogger } from '../../../utils/logger.js';
import { getCalendarService } from '../../../data/services/calendar-service.js';
import UIUpdateHelper from '../utils/ui-update-helper.js';
import { SettingsPageBase } from '../core/settings-page-base.js';
import DashieModal from '../../../utils/dashie-modal.js';

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
        this.accountsForRemoval = null; // Accounts available for removal
        this.isLoadingAccounts = false; // Loading state for account removal screen
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

                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable"
                         data-navigate="calendar-add"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Add Calendar Accounts</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>

                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable"
                         data-navigate="calendar-remove"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Remove Calendar Accounts</span>
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
     * Render the Add Account screen
     * Shows available calendar providers (Google enabled, others coming soon)
     * @returns {string} - HTML string
     */
    renderAddAccount() {
        return `
            <div class="settings-modal__page-content">
                <div class="settings-modal__section">
                    <div class="settings-modal__section-header">Add Calendar Provider</div>

                    <!-- Google - Available -->
                    <div class="settings-modal__menu-item settings-modal__menu-item--selectable add-account-provider"
                         data-provider="google"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Google Calendar</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>

                    <!-- Microsoft - Coming Soon (grayed out) -->
                    <div class="settings-modal__menu-item coming-soon"
                         style="opacity: 0.4; cursor: not-allowed;">
                        <span class="settings-modal__menu-label">Microsoft Outlook</span>
                        <span class="settings-modal__cell-status">Coming Soon</span>
                    </div>

                    <!-- Apple - Coming Soon (grayed out) -->
                    <div class="settings-modal__menu-item coming-soon"
                         style="opacity: 0.4; cursor: not-allowed;">
                        <span class="settings-modal__menu-label">Apple iCloud</span>
                        <span class="settings-modal__cell-status">Coming Soon</span>
                    </div>
                </div>

                <div class="settings-modal__section">
                    <div class="settings-modal__info-text" style="padding: 16px; color: #6B7280; font-size: 14px; line-height: 1.5;">
                        Adding a calendar account will allow you to view and manage events from multiple calendars in one place.
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render the Remove Account screen
     * Shows list of connected accounts (primary account is grayed out)
     * @returns {string} - HTML string
     */
    renderRemoveAccount() {
        if (this.isLoadingAccounts) {
            return `
                <div class="settings-modal__page-content">
                    <div class="settings-modal__empty">
                        <div class="settings-modal__spinner"></div>
                        <div class="settings-modal__empty-text">Loading accounts...</div>
                    </div>
                </div>
            `;
        }

        if (!this.accountsForRemoval || this.accountsForRemoval.length === 0) {
            return `
                <div class="settings-modal__page-content">
                    <div class="settings-modal__empty">
                        <div class="settings-modal__empty-icon">📅</div>
                        <div class="settings-modal__empty-text">No Additional Accounts</div>
                        <div class="settings-modal__empty-text" style="font-size: var(--font-size-base); margin-top: 10px;">
                            You only have your primary account connected
                        </div>
                    </div>
                </div>
            `;
        }

        const accountItems = this.accountsForRemoval.map(account => {
            const isPrimary = account.accountType === 'primary';
            const isDisabled = isPrimary;

            return `
                <div class="settings-modal__menu-item ${isDisabled ? 'coming-soon' : 'settings-modal__menu-item--selectable remove-account-item'}"
                     data-account-type="${account.accountType}"
                     data-account-email="${account.email}"
                     ${isDisabled ? '' : 'role="button" tabindex="0"'}
                     style="${isDisabled ? 'opacity: 0.4; cursor: not-allowed;' : ''}">
                    <div class="settings-modal__menu-content">
                        <span class="settings-modal__menu-label">${account.email}</span>
                        <span class="settings-modal__menu-sublabel" style="display: block; font-size: 12px; color: #6B7280; margin-top: 4px;">
                            ${this.formatAccountDisplayLabel(account.accountType)}${isPrimary ? ' (Primary Account)' : ''}
                        </span>
                    </div>
                    ${!isDisabled ? '<span class="settings-modal__cell-chevron">×</span>' : ''}
                </div>
            `;
        }).join('');

        return `
            <div class="settings-modal__page-content">
                <div class="settings-modal__section">
                    <div class="settings-modal__section-header">Connected Accounts</div>
                    ${accountItems}
                </div>

                <div class="settings-modal__section">
                    <div class="settings-modal__info-text" style="padding: 16px; color: #6B7280; font-size: 14px; line-height: 1.5;">
                        Your primary account cannot be removed. To remove it, you must sign out completely.
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Load accounts for removal screen
     * Fetches all Google accounts from TokenStore
     */
    async loadAccountsForRemoval() {
        logger.info('Loading accounts for removal screen');

        try {
            this.isLoadingAccounts = true;

            const sessionManager = window.sessionManager;
            if (!sessionManager) {
                logger.warn('No session manager found');
                this.accountsForRemoval = [];
                return;
            }

            const tokenStore = sessionManager.getTokenStore();
            if (!tokenStore) {
                logger.warn('No token store found');
                this.accountsForRemoval = [];
                return;
            }

            // Get all Google accounts
            const accountsObj = await tokenStore.getProviderAccounts('google');

            // Convert object to array with account type and email
            const accounts = Object.entries(accountsObj || {}).map(([accountType, tokenData]) => ({
                accountType,
                email: tokenData.email || 'Unknown',
                tokenData
            }));

            // Sort: primary first, then by account number
            const sortedAccounts = accounts.sort((a, b) => {
                if (a.accountType === 'primary') return -1;
                if (b.accountType === 'primary') return 1;
                return a.accountType.localeCompare(b.accountType);
            });

            this.accountsForRemoval = sortedAccounts;

            logger.success('Accounts loaded for removal', {
                count: sortedAccounts.length,
                accounts: sortedAccounts.map(a => ({ type: a.accountType, email: a.email }))
            });

        } catch (error) {
            logger.error('Failed to load accounts for removal', error);
            this.accountsForRemoval = [];
        } finally {
            this.isLoadingAccounts = false;
        }
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

            // Get all Google accounts from TokenStore
            const tokenStore = window.sessionManager?.getTokenStore();
            if (!tokenStore) {
                logger.warn('No TokenStore found');
                this.calendarData = {};
                return;
            }

            const googleAccounts = await tokenStore.getProviderAccounts('google');
            const accountTypes = Object.keys(googleAccounts || {});

            if (accountTypes.length === 0) {
                logger.warn('No Google accounts found');
                this.calendarData = {};
                return;
            }

            logger.info('Found Google accounts', {
                count: accountTypes.length,
                accounts: accountTypes
            });

            // Clear existing calendar data
            this.calendarData = {};

            // Load calendars from each account
            for (const accountType of accountTypes) {
                try {
                    const accountEmail = googleAccounts[accountType].email || 'Unknown';

                    logger.info(`Loading calendars from ${accountType}`, { email: accountEmail });

                    const calendars = await this.calendarService.getCalendars(accountType);

                    logger.debug(`Calendars loaded from ${accountType}`, {
                        count: calendars.length,
                        activeCount: calendars.filter(c => c.isActive).length
                    });

                    this.calendarData[accountType] = {
                        displayName: this.formatAccountDisplayLabel(accountType),
                        email: accountEmail,
                        calendars: calendars
                    };

                } catch (error) {
                    logger.warn(`Failed to load calendars from ${accountType}`, error);
                    // Continue loading other accounts even if one fails
                }
            }

            const totalCalendars = Object.values(this.calendarData).reduce(
                (sum, account) => sum + account.calendars.length,
                0
            );

            const totalActive = Object.values(this.calendarData).reduce(
                (sum, account) => sum + account.calendars.filter(c => c.isActive).length,
                0
            );

            logger.success('Calendars loaded from all accounts', {
                accounts: Object.keys(this.calendarData).length,
                totalCalendars,
                activeCount: totalActive
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
        // Add account provider items: custom behavior
        if (item.classList.contains('add-account-provider')) {
            return { type: 'custom' };
        }

        // Remove account items: custom behavior
        if (item.classList.contains('remove-account-item')) {
            return { type: 'custom' };
        }

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
     * Handle item click
     * Overrides base class to handle custom behaviors (e.g., add account provider)
     * @param {HTMLElement} item - The clicked item
     * @returns {Object} Navigation result
     */
    async handleItemClick(item) {
        // Handle add account provider clicks
        if (item.classList.contains('add-account-provider')) {
            const provider = item.dataset.provider;
            if (provider === 'google') {
                await this.handleAddGoogleAccount();
            }
            return { shouldNavigate: false };
        }

        // Handle remove account clicks
        if (item.classList.contains('remove-account-item')) {
            const accountType = item.dataset.accountType;
            const accountEmail = item.dataset.accountEmail;
            await this.handleRemoveAccount(accountType, accountEmail);
            return { shouldNavigate: false };
        }

        // Delegate to base class for standard behaviors
        return await super.handleItemClick(item);
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
     * Handle adding a Google calendar account
     * Triggers OAuth flow to authenticate a new Google account
     */
    async handleAddGoogleAccount() {
        logger.info('Starting Google account addition flow');

        try {
            // Get the session manager and token store
            const sessionManager = window.sessionManager;
            if (!sessionManager) {
                logger.error('Session manager not available');
                await DashieModal.error('Unable to Add Account', 'Session manager not found. Please try refreshing the page.');
                return;
            }

            const tokenStore = sessionManager.getTokenStore();
            if (!tokenStore) {
                logger.error('Token store not available');
                await DashieModal.error('Unable to Add Account', 'Token store not found. Please try refreshing the page.');
                return;
            }

            // Determine the next account type (account2, account3, etc.)
            const existingAccounts = await tokenStore.getProviderAccounts('google');
            // getProviderAccounts returns an object with account types as keys
            const existingAccountTypes = Object.keys(existingAccounts || {});

            let nextAccountNumber = 2; // Start with account2
            let nextAccountType = `account${nextAccountNumber}`;

            // Find the first available account number
            while (existingAccountTypes.includes(nextAccountType)) {
                nextAccountNumber++;
                nextAccountType = `account${nextAccountNumber}`;
            }

            logger.info('Next account type determined', {
                nextAccountType,
                existingAccounts: existingAccountTypes
            });

            // Store the account type in sessionStorage for the OAuth callback to use
            // The google-account-auth.js will check for this and use it instead of 'primary'
            sessionStorage.setItem('pendingAccountType', nextAccountType);

            logger.info('Triggering OAuth flow for new Google account', { accountType: nextAccountType });

            // Trigger the sign-in flow which will redirect to Google OAuth
            // After OAuth completes, the callback will store tokens with nextAccountType
            await sessionManager.signIn();

            logger.success('Google OAuth flow initiated for new account');

        } catch (error) {
            logger.error('Failed to add Google account', error);
            await DashieModal.error('Failed to Add Account', `Unable to add Google account:\n\n${error.message}`);
        }
    }

    /**
     * Handle removing a calendar account
     * Confirms with user and removes account tokens from database
     * @param {string} accountType - The account type to remove (e.g., 'account2')
     * @param {string} accountEmail - The account email for display
     */
    async handleRemoveAccount(accountType, accountEmail) {
        logger.info('Attempting to remove account', { accountType, accountEmail });

        // Prevent removal of primary account
        if (accountType === 'primary') {
            logger.warn('Cannot remove primary account');
            await DashieModal.warning('Cannot Remove Primary Account', 'Your primary account cannot be removed. To remove it, you must sign out completely.');
            return;
        }

        // Confirm with user
        const confirmed = await DashieModal.confirm(
            'Remove Calendar Account',
            `Are you sure you want to remove this account?\n\n${accountEmail}\n\nAll calendars from this account will be removed from your dashboard.`
        );

        logger.debug('Confirmation result', { confirmed, type: typeof confirmed });

        if (!confirmed) {
            logger.info('Account removal cancelled by user');
            return;
        }

        if (confirmed !== true) {
            logger.warn('Unexpected confirmation value', { confirmed });
            return;
        }

        try {
            logger.info('Removing account tokens from database', { accountType });

            // Get token store
            const sessionManager = window.sessionManager;
            if (!sessionManager) {
                throw new Error('Session manager not available');
            }

            const tokenStore = sessionManager.getTokenStore();
            if (!tokenStore) {
                throw new Error('Token store not available');
            }

            // Remove account tokens from database
            await tokenStore.removeAccountTokens('google', accountType);

            logger.success('Account removed successfully', { accountType });

            // Remove any calendars from this account from active calendars
            if (this.calendarService) {
                const activeCalendars = this.calendarService.activeCalendarIds || [];
                const prefix = `${accountType}-`;
                const filteredCalendars = activeCalendars.filter(id => !id.startsWith(prefix));

                if (filteredCalendars.length !== activeCalendars.length) {
                    logger.info('Removing calendars from removed account', {
                        before: activeCalendars.length,
                        after: filteredCalendars.length
                    });

                    this.calendarService.activeCalendarIds = filteredCalendars;
                    await this.calendarService.saveActiveCalendars();
                }
            }

            // Reload the accounts list for the remove screen
            await this.loadAccountsForRemoval();

            // Re-render the remove account screen
            const removeScreen = document.querySelector('[data-screen="calendar-remove"]');
            if (removeScreen) {
                removeScreen.innerHTML = this.renderRemoveAccount();

                // Update focus after short delay
                setTimeout(() => {
                    const stateManager = window.settingsStateManager;
                    if (stateManager && stateManager.renderer) {
                        stateManager.renderer.updateSelection();
                    }
                }, 100);
            }

            // Also reload calendars to remove the account's calendars from the select calendars screen
            await this.loadCalendarsFromAllAccounts();

            // Re-render the select calendars screen if it's been loaded
            const selectScreen = document.querySelector('[data-screen="calendar-select"]');
            if (selectScreen && Object.keys(this.calendarData).length > 0) {
                selectScreen.innerHTML = this.renderSelectCalendars();
                logger.info('Refreshed calendar list after account removal');
            }

            // Notify calendar widget to refresh its data
            if (window.widgetDataManager) {
                logger.info('Refreshing calendar widget data after account removal');
                await window.widgetDataManager.loadCalendarData();
            }

            await DashieModal.success('Account Removed', `Successfully removed:\n\n${accountEmail}`);

        } catch (error) {
            logger.error('Failed to remove account', { accountType, error });
            await DashieModal.error('Failed to Remove Account', `Unable to remove account:\n\n${error.message}`);
        }
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
     * NOTE: Calendar items are handled by the global click handler via handleItemClick()
     * No need for specific event listeners here
     */
    attachEventListeners() {
        // Calendar items are handled by the renderer's global click handler
        // which calls handleItemClick() -> handleToggleItem() -> toggleCalendar()
        // No specific listeners needed
    }

    /**
     * Detach event listeners
     */
    detachEventListeners() {
        // No specific listeners to detach
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
