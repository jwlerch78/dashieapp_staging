// js/modules/Settings/pages/settings-calendar-page.js
// Calendar settings page - Manage active calendars with account-prefixed IDs

import { createLogger } from '../../../utils/logger.js';
import { getCalendarService } from '../../../data/services/calendar-service.js';

const logger = createLogger('SettingsCalendarPage');

/**
 * Calendar Settings Page
 * Handles calendar account management with prefixed IDs
 */
export class SettingsCalendarPage {
    constructor() {
        this.initialized = false;
        this.calendarService = null;
        this.calendars = [];
    }

    /**
     * Initialize the page
     */
    async initialize() {
        if (this.initialized) return;

        logger.verbose('Initializing Calendar settings page');

        try {
            this.calendarService = getCalendarService();
            await this.loadCalendars();
            this.initialized = true;
        } catch (error) {
            logger.error('Failed to initialize calendar page', error);
        }
    }

    /**
     * Load calendars from Google (primary account)
     */
    async loadCalendars() {
        try {
            logger.info('Loading calendars for primary account');
            this.calendars = await this.calendarService.getCalendars('primary');
            logger.success('Calendars loaded', { count: this.calendars.length });
        } catch (error) {
            logger.error('Failed to load calendars', error);
            this.calendars = [];
        }
    }

    /**
     * Render the page content
     * @returns {string} - HTML string
     */
    render() {
        if (this.calendars.length === 0) {
            return this.renderEmpty();
        }

        return this.renderCalendarList();
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
     * Render calendar list
     */
    renderCalendarList() {
        const activeCount = this.calendars.filter(c => c.isActive).length;

        return `
            <div class="settings-modal__list">
                <div class="settings-modal__section">
                    <div class="settings-modal__section-header">
                        Primary Account Calendars (${activeCount} active)
                    </div>
                    ${this.calendars.map(cal => this.renderCalendarItem(cal)).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render a single calendar item
     */
    renderCalendarItem(calendar) {
        return `
            <div class="settings-modal__menu-item settings-modal__menu-item--selectable ${calendar.isActive ? 'settings-modal__menu-item--checked' : ''}"
                 data-calendar-id="${calendar.rawId}"
                 data-account-type="${calendar.accountType}"
                 data-prefixed-id="${calendar.prefixedId}"
                 role="button"
                 tabindex="0">
                <div class="settings-modal__menu-content">
                    <span class="settings-modal__menu-label">${calendar.summary || 'Unnamed Calendar'}</span>
                    ${calendar.description ? `<span class="settings-modal__menu-sublabel">${calendar.description}</span>` : ''}
                </div>
                <span class="settings-modal__cell-checkmark">${calendar.isActive ? '✓' : ''}</span>
            </div>
        `;
    }

    /**
     * Get focusable elements for this page
     * @returns {Array<HTMLElement>}
     */
    getFocusableElements() {
        return Array.from(document.querySelectorAll('[data-calendar-id]'));
    }

    /**
     * Handle activation (page shown)
     */
    async activate() {
        logger.debug('Calendar page activated');

        // Attach event listeners
        this.attachEventListeners();

        // Reload calendars to get fresh data
        await this.loadCalendars();
    }

    /**
     * Handle deactivation (page hidden)
     */
    deactivate() {
        logger.debug('Calendar page deactivated');
        this.detachEventListeners();
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        const calendarItems = document.querySelectorAll('[data-calendar-id]');

        calendarItems.forEach(item => {
            item.addEventListener('click', this.handleCalendarClick.bind(this));
        });
    }

    /**
     * Detach event listeners
     */
    detachEventListeners() {
        const calendarItems = document.querySelectorAll('[data-calendar-id]');

        calendarItems.forEach(item => {
            item.removeEventListener('click', this.handleCalendarClick.bind(this));
        });
    }

    /**
     * Handle calendar item click (toggle active)
     */
    async handleCalendarClick(event) {
        const item = event.currentTarget;
        const accountType = item.dataset.accountType;
        const calendarId = item.dataset.calendarId;
        const prefixedId = item.dataset.prefixedId;

        const isCurrentlyActive = item.classList.contains('settings-modal__menu-item--checked');

        logger.info('Calendar clicked', { prefixedId, isCurrentlyActive });

        try {
            // Toggle active state
            if (isCurrentlyActive) {
                await this.calendarService.disableCalendar(accountType, calendarId);
            } else {
                await this.calendarService.enableCalendar(accountType, calendarId);
            }

            // Update UI immediately
            item.classList.toggle('settings-modal__menu-item--checked');
            const checkmark = item.querySelector('.settings-modal__cell-checkmark');
            if (checkmark) {
                checkmark.textContent = isCurrentlyActive ? '' : '✓';
            }

            // Reload calendar list to update active count
            await this.loadCalendars();

            logger.success(`Calendar ${isCurrentlyActive ? 'disabled' : 'enabled'}`, { prefixedId });

        } catch (error) {
            logger.error('Failed to toggle calendar', { prefixedId, error });
        }
    }
}
