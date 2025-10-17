// js/data/services/calendar-config-store.js
// Manages calendar configuration separately from user settings
// Part of Phase 3: Performance optimization to reduce settings table size

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('CalendarConfigStore');

/**
 * CalendarConfigStore - Storage for calendar configuration data
 *
 * Storage Strategy:
 * - Primary: Supabase user_calendar_config table
 * - Cache: localStorage (separate key from settings)
 * - Sync: Dual-write to both locations
 *
 * Config Structure:
 * {
 *   active_calendar_ids: ["primary-user@gmail.com", "account2-shared@gmail.com"],
 *   accounts: {
 *     "primary": { email: "user@gmail.com", display_name: "John", ... },
 *     "account2": { email: "shared@gmail.com", display_name: "Family", ... }
 *   },
 *   calendar_account_map: {
 *     "user@gmail.com": "primary",
 *     "shared@gmail.com": "account2"
 *   },
 *   calendar_settings: {
 *     default_view: "week",
 *     show_declined_events: false,
 *     ...
 *   }
 * }
 */
export class CalendarConfigStore {
    constructor() {
        this.STORAGE_KEY = 'dashie-calendar-config'; // Separate from settings
        this.config = null;
        this.isInitialized = false;
        this.edgeClient = null; // Will be set during initialization
    }

    /**
     * Initialize the calendar config store
     * Loads config from localStorage and validates against database
     */
    async initialize(edgeClient = null) {
        if (this.isInitialized) {
            logger.debug('CalendarConfigStore already initialized');
            return;
        }

        this.edgeClient = edgeClient;
        await this.loadConfig();
        this.isInitialized = true;

        logger.info('CalendarConfigStore initialized', {
            hasConfig: !!this.config,
            activeCalendars: this.config?.active_calendar_ids?.length || 0,
            accounts: this.config?.accounts ? Object.keys(this.config.accounts).length : 0
        });
    }

    /**
     * Load config from storage
     * Priority: localStorage (fast) → Supabase (authoritative)
     */
    async loadConfig() {
        try {
            // Try localStorage first (fast)
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                this.config = JSON.parse(stored);
                logger.debug('Loaded calendar config from localStorage', {
                    activeCalendars: this.config.active_calendar_ids?.length || 0
                });
            } else {
                this.config = this.getDefaultConfig();
            }

            // TODO: Validate against Supabase user_calendar_config table
            // For now, localStorage is source of truth
            // After edge function updates, sync with database

        } catch (error) {
            logger.error('Error loading calendar config', error);
            this.config = this.getDefaultConfig();
        }
    }

    /**
     * Get default config structure
     * @returns {object} Default config
     */
    getDefaultConfig() {
        return {
            active_calendar_ids: [],
            accounts: {},
            calendar_account_map: {},
            calendar_settings: {}
        };
    }

    /**
     * Get active calendar IDs
     * @returns {Array} Array of active calendar IDs with account prefixes
     */
    getActiveCalendarIds() {
        return [...(this.config?.active_calendar_ids || [])];
    }

    /**
     * Set active calendar IDs
     * @param {Array} calendarIds - Array of calendar IDs (with account prefixes)
     */
    async setActiveCalendarIds(calendarIds) {
        this.config.active_calendar_ids = [...calendarIds];
        await this.save();

        logger.info('Updated active calendar IDs', {
            count: calendarIds.length
        });
    }

    /**
     * Add a calendar to active list
     * @param {string} calendarId - Calendar ID (with account prefix)
     */
    async addActiveCalendar(calendarId) {
        if (!this.config.active_calendar_ids.includes(calendarId)) {
            this.config.active_calendar_ids.push(calendarId);
            await this.save();

            logger.info('Added calendar to active list', { calendarId });
        }
    }

    /**
     * Remove a calendar from active list
     * @param {string} calendarId - Calendar ID (with account prefix)
     */
    async removeActiveCalendar(calendarId) {
        const index = this.config.active_calendar_ids.indexOf(calendarId);
        if (index > -1) {
            this.config.active_calendar_ids.splice(index, 1);
            await this.save();

            logger.info('Removed calendar from active list', { calendarId });
        }
    }

    /**
     * Check if a calendar is active
     * @param {string} calendarId - Calendar ID (with account prefix)
     * @returns {boolean} True if calendar is active
     */
    isCalendarActive(calendarId) {
        return this.config.active_calendar_ids.includes(calendarId);
    }

    /**
     * Get all accounts
     * @returns {object} Object containing all account metadata
     */
    getAccounts() {
        return { ...this.config.accounts };
    }

    /**
     * Get account metadata
     * @param {string} accountType - Account identifier (e.g., 'primary', 'account2')
     * @returns {object|null} Account metadata or null
     */
    getAccount(accountType) {
        return this.config.accounts[accountType] || null;
    }

    /**
     * Add or update account metadata
     * @param {string} accountType - Account identifier
     * @param {object} accountData - Account metadata
     */
    async setAccount(accountType, accountData) {
        this.config.accounts[accountType] = {
            email: accountData.email,
            display_name: accountData.display_name || accountData.email,
            provider: accountData.provider || 'google',
            is_active: accountData.is_active !== undefined ? accountData.is_active : true,
            created_at: this.config.accounts[accountType]?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...accountData
        };

        await this.save();

        logger.info('Updated account metadata', {
            accountType,
            email: accountData.email
        });
    }

    /**
     * Remove account and all associated calendars
     * @param {string} accountType - Account identifier
     */
    async removeAccount(accountType) {
        // Remove account metadata
        delete this.config.accounts[accountType];

        // Remove all calendars from this account
        const prefix = `${accountType}-`;
        this.config.active_calendar_ids = this.config.active_calendar_ids.filter(
            id => !id.startsWith(prefix)
        );

        // Clean up calendar account map
        for (const [calId, accType] of Object.entries(this.config.calendar_account_map)) {
            if (accType === accountType) {
                delete this.config.calendar_account_map[calId];
            }
        }

        await this.save();

        logger.info('Removed account and associated calendars', {
            accountType
        });
    }

    /**
     * Get calendar account map
     * @returns {object} Map of calendar IDs to account types
     */
    getCalendarAccountMap() {
        return { ...this.config.calendar_account_map };
    }

    /**
     * Get account type for a calendar
     * @param {string} calendarId - Raw calendar ID (without prefix)
     * @returns {string|null} Account type or null
     */
    getCalendarAccount(calendarId) {
        return this.config.calendar_account_map[calendarId] || null;
    }

    /**
     * Set calendar-to-account mapping
     * @param {string} calendarId - Raw calendar ID
     * @param {string} accountType - Account identifier
     */
    async setCalendarAccount(calendarId, accountType) {
        this.config.calendar_account_map[calendarId] = accountType;
        await this.save();
    }

    /**
     * Get calendar settings
     * @returns {object} Calendar-specific settings
     */
    getCalendarSettings() {
        return { ...this.config.calendar_settings };
    }

    /**
     * Update calendar settings
     * @param {object} settings - Calendar settings to merge
     */
    async updateCalendarSettings(settings) {
        this.config.calendar_settings = {
            ...this.config.calendar_settings,
            ...settings
        };

        await this.save();

        logger.info('Updated calendar settings');
    }

    /**
     * Get all active calendars for a specific account
     * @param {string} accountType - Account identifier
     * @returns {Array} Array of calendar IDs for this account
     */
    getActiveCalendarsForAccount(accountType) {
        const prefix = `${accountType}-`;
        return this.config.active_calendar_ids.filter(id => id.startsWith(prefix));
    }

    /**
     * Create account-prefixed calendar ID
     * @param {string} accountType - Account identifier
     * @param {string} calendarId - Raw calendar ID
     * @returns {string} Prefixed calendar ID
     */
    createPrefixedId(accountType, calendarId) {
        return `${accountType}-${calendarId}`;
    }

    /**
     * Parse account-prefixed calendar ID
     * @param {string} prefixedId - Prefixed calendar ID
     * @returns {object} { accountType, calendarId }
     */
    parsePrefixedId(prefixedId) {
        const dashIndex = prefixedId.indexOf('-');
        if (dashIndex === -1) {
            // No prefix found, assume primary account
            return {
                accountType: 'primary',
                calendarId: prefixedId
            };
        }

        const accountType = prefixedId.substring(0, dashIndex);
        const calendarId = prefixedId.substring(dashIndex + 1);

        return { accountType, calendarId };
    }

    /**
     * Save config to storage
     * Writes to both localStorage and Supabase (dual-write for safety)
     */
    async save() {
        try {
            // Save to localStorage (fast)
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config));

            // TODO: Save to Supabase user_calendar_config table
            // After edge function updates, implement database sync
            // if (this.edgeClient) {
            //     await this.edgeClient.saveCalendarConfig(this.config);
            // }

            logger.debug('Saved calendar config to storage', {
                activeCalendars: this.config.active_calendar_ids.length
            });

        } catch (error) {
            logger.error('Error saving calendar config', error);
            throw error;
        }
    }

    /**
     * Migrate calendar config from old settings storage
     * @param {object} oldSettings - Old settings object containing calendar data
     * @returns {boolean} True if migration performed
     */
    async migrateFromSettings(oldSettings) {
        if (!oldSettings) {
            logger.debug('No settings to migrate from');
            return false;
        }

        logger.info('Migrating calendar config from settings storage');

        let migrated = false;

        // Migrate active calendar IDs
        if (oldSettings.activeCalendarIds && Array.isArray(oldSettings.activeCalendarIds)) {
            this.config.active_calendar_ids = [...oldSettings.activeCalendarIds];
            migrated = true;
        }

        // Migrate accounts
        if (oldSettings.accounts) {
            this.config.accounts = { ...oldSettings.accounts };
            migrated = true;
        }

        // Migrate calendar account map
        if (oldSettings.calendarAccountMap) {
            this.config.calendar_account_map = { ...oldSettings.calendarAccountMap };
            migrated = true;
        }

        // Migrate calendar settings
        if (oldSettings.calendar) {
            this.config.calendar_settings = { ...oldSettings.calendar };
            migrated = true;
        }

        if (migrated) {
            await this.save();

            logger.success('Successfully migrated calendar config from settings', {
                activeCalendars: this.config.active_calendar_ids.length,
                accounts: Object.keys(this.config.accounts).length
            });
        }

        return migrated;
    }

    /**
     * Get full config (for debugging or export)
     * @returns {object} Complete config object
     */
    getFullConfig() {
        return { ...this.config };
    }

    /**
     * Clear all calendar config (for testing or reset)
     */
    async clearConfig() {
        this.config = this.getDefaultConfig();
        await this.save();
        logger.info('Cleared calendar config');
    }
}

// Export singleton instance
export const calendarConfigStore = new CalendarConfigStore();
