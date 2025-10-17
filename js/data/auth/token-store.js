// js/data/auth/token-store.js
// Manages authentication tokens separately from user settings
// Part of Phase 3: High-priority security fix to prevent settings operations from wiping auth data

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('TokenStore');

/**
 * TokenStore - Secure storage for OAuth tokens and authentication credentials
 *
 * Storage Strategy:
 * - Primary: Supabase user_auth_tokens table
 * - Cache: localStorage (separate key from settings)
 * - Sync: Dual-write to both locations
 *
 * Token Structure:
 * {
 *   "google": {
 *     "primary": {
 *       access_token: string,
 *       refresh_token: string,
 *       expires_at: string (ISO 8601),
 *       scopes: string[],
 *       email: string,
 *       display_name: string,
 *       is_active: boolean,
 *       created_at: string,
 *       updated_at: string,
 *       provider_info: object (optional)
 *     },
 *     "account2": { ... }
 *   }
 * }
 */
export class TokenStore {
    constructor() {
        this.STORAGE_KEY = 'dashie-auth-tokens'; // Separate from settings
        this.tokens = null;
        this.isInitialized = false;
        this.edgeClient = null; // Will be set during initialization
    }

    /**
     * Initialize the token store
     * Loads tokens from localStorage (fast) and validates against database
     */
    async initialize(edgeClient = null) {
        if (this.isInitialized) {
            logger.debug('TokenStore already initialized');
            return;
        }

        this.edgeClient = edgeClient;
        await this.loadTokens();
        this.isInitialized = true;

        logger.info('TokenStore initialized', {
            hasTokens: this.tokens && Object.keys(this.tokens).length > 0,
            providers: this.tokens ? Object.keys(this.tokens) : []
        });
    }

    /**
     * Load tokens from storage
     * DUAL-READ PATTERN: Reads from Supabase (authoritative) with localStorage fallback
     * - Supabase: Authoritative source of truth (persists across devices)
     * - localStorage: Fast cache fallback if Supabase unavailable
     */
    async loadTokens() {
        try {
            let loadedFromSupabase = false;

            // STRATEGY 1: Try loading from Supabase (authoritative)
            if (this.edgeClient) {
                try {
                    const supabaseTokens = await this.loadFromSupabase();
                    if (supabaseTokens && Object.keys(supabaseTokens).length > 0) {
                        this.tokens = supabaseTokens;
                        loadedFromSupabase = true;
                        logger.info('Loaded tokens from Supabase', {
                            providers: Object.keys(this.tokens),
                            accountCount: this.countAccounts()
                        });

                        // Sync to localStorage for offline access
                        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.tokens));
                    }
                } catch (supabaseError) {
                    logger.warn('Failed to load from Supabase, falling back to localStorage', supabaseError);
                }
            }

            // STRATEGY 2: Fallback to localStorage if Supabase unavailable or empty
            if (!loadedFromSupabase) {
                const stored = localStorage.getItem(this.STORAGE_KEY);
                if (stored) {
                    this.tokens = JSON.parse(stored);
                    logger.info('Loaded tokens from localStorage (Supabase unavailable)', {
                        providers: Object.keys(this.tokens),
                        accountCount: this.countAccounts()
                    });
                } else {
                    this.tokens = {};
                    logger.debug('No tokens found in any storage location');
                }
            }

        } catch (error) {
            logger.error('Error loading tokens from all sources', error);
            this.tokens = {};
        }
    }

    /**
     * Load tokens from Supabase user_auth_tokens table
     * Called by loadTokens() as part of dual-read pattern
     * @private
     * @returns {object} Token structure from database
     */
    async loadFromSupabase() {
        if (!this.edgeClient) {
            throw new Error('Edge client not initialized');
        }

        // Call edge function to get tokens from user_auth_tokens table
        const response = await this.edgeClient.loadTokens();

        // Response should contain the full tokens object structure
        return response.tokens || {};
    }

    /**
     * Count total number of accounts across all providers
     * @private
     * @returns {number} Total account count
     */
    countAccounts() {
        return Object.values(this.tokens).reduce(
            (sum, provider) => sum + Object.keys(provider).length,
            0
        );
    }

    /**
     * Store tokens for a specific account
     * @param {string} provider - Provider name (e.g., 'google')
     * @param {string} accountType - Account identifier (e.g., 'primary', 'account2')
     * @param {object} tokenData - Token data object
     */
    async storeAccountTokens(provider, accountType, tokenData) {
        if (!this.tokens[provider]) {
            this.tokens[provider] = {};
        }

        this.tokens[provider][accountType] = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || this.tokens[provider][accountType]?.refresh_token,
            expires_at: tokenData.expires_at,
            scopes: tokenData.scopes || [],
            email: tokenData.email || '',
            display_name: tokenData.display_name || '',
            is_active: tokenData.is_active !== undefined ? tokenData.is_active : true,
            provider_info: tokenData.provider_info || {},
            updated_at: new Date().toISOString()
        };

        // Add created_at if new account
        if (!this.tokens[provider][accountType].created_at) {
            this.tokens[provider][accountType].created_at = new Date().toISOString();
        }

        await this.save();

        logger.info('Stored tokens for account', {
            provider,
            accountType,
            email: tokenData.email
        });
    }

    /**
     * Get tokens for a specific account
     * @param {string} provider - Provider name (e.g., 'google')
     * @param {string} accountType - Account identifier (e.g., 'primary', 'account2')
     * @returns {object|null} Token data or null if not found
     */
    async getAccountTokens(provider, accountType) {
        if (!this.tokens[provider] || !this.tokens[provider][accountType]) {
            logger.debug('No tokens found for account', { provider, accountType });
            return null;
        }

        const tokens = this.tokens[provider][accountType];

        // Check if tokens are expired
        if (this.isTokenExpired(tokens)) {
            logger.debug('Tokens expired for account', { provider, accountType });
            // Don't return null - let caller decide whether to refresh
            // Return tokens with expired flag
            return { ...tokens, isExpired: true };
        }

        return { ...tokens, isExpired: false };
    }

    /**
     * Check if token is expired
     * @param {object} tokenData - Token data with expires_at
     * @returns {boolean} True if expired
     */
    isTokenExpired(tokenData) {
        if (!tokenData.expires_at) return false;

        const expiresAt = new Date(tokenData.expires_at);
        const now = new Date();

        // Consider expired if less than 5 minutes remaining
        const bufferMs = 5 * 60 * 1000;
        return (expiresAt.getTime() - now.getTime()) < bufferMs;
    }

    /**
     * Remove tokens for a specific account
     * @param {string} provider - Provider name
     * @param {string} accountType - Account identifier
     */
    async removeAccountTokens(provider, accountType) {
        if (this.tokens[provider] && this.tokens[provider][accountType]) {
            delete this.tokens[provider][accountType];

            // Remove provider object if empty
            if (Object.keys(this.tokens[provider]).length === 0) {
                delete this.tokens[provider];
            }

            await this.save();

            logger.info('Removed tokens for account', { provider, accountType });
        }
    }

    /**
     * Get all accounts for a provider
     * @param {string} provider - Provider name
     * @returns {object} Object containing all accounts for provider
     */
    async getProviderAccounts(provider) {
        return this.tokens[provider] || {};
    }

    /**
     * Get all tokens (for migration or debugging)
     * @returns {object} All tokens
     */
    async getAllTokens() {
        return { ...this.tokens };
    }

    /**
     * Clear all tokens (sign out)
     */
    async clearAllTokens() {
        this.tokens = {};
        await this.save();
        logger.info('Cleared all tokens');
    }

    /**
     * Save tokens to storage
     * DUAL-WRITE PATTERN: Writes to both localStorage and Supabase
     * - localStorage: Fast local cache
     * - Supabase: Persistent, authoritative source of truth
     */
    async save() {
        try {
            // WRITE 1: Save to localStorage (fast, always succeeds)
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.tokens));
            logger.debug('Saved tokens to localStorage', {
                providers: Object.keys(this.tokens)
            });

            // WRITE 2: Save to Supabase (authoritative, may fail)
            if (this.edgeClient) {
                try {
                    // Store entire token structure to database
                    // Edge function will update user_auth_tokens table
                    await this.syncToSupabase();
                    logger.debug('Synced tokens to Supabase');
                } catch (supabaseError) {
                    // Don't fail the save if Supabase is down
                    // Tokens are in localStorage, will sync on next successful connection
                    logger.warn('Failed to sync tokens to Supabase (will retry later)', supabaseError);
                }
            } else {
                logger.debug('No edgeClient available, skipping Supabase sync');
            }

        } catch (error) {
            logger.error('Error saving tokens to localStorage', error);
            throw error;
        }
    }

    /**
     * Sync current token state to Supabase
     * Called by save() as part of dual-write pattern
     * @private
     */
    async syncToSupabase() {
        if (!this.edgeClient) {
            throw new Error('Edge client not initialized');
        }

        // For each provider/account, call edge function to store
        const promises = [];

        for (const [provider, providerAccounts] of Object.entries(this.tokens)) {
            for (const [accountType, tokenData] of Object.entries(providerAccounts)) {
                // Call edge function store_tokens operation
                const promise = this.edgeClient.storeTokens(provider, accountType, tokenData);
                promises.push(promise);
            }
        }

        // Wait for all stores to complete
        await Promise.all(promises);
    }

    /**
     * Migrate tokens from old settings storage
     * @param {object} oldSettings - Old settings object containing tokenAccounts
     * @returns {boolean} True if migration performed
     */
    async migrateFromSettings(oldSettings) {
        if (!oldSettings || !oldSettings.tokenAccounts) {
            logger.debug('No tokens to migrate from settings');
            return false;
        }

        logger.info('Migrating tokens from settings storage');

        // Copy token structure
        this.tokens = { ...oldSettings.tokenAccounts };

        // Save to new location
        await this.save();

        logger.success('Successfully migrated tokens from settings', {
            providers: Object.keys(this.tokens),
            accountCount: Object.values(this.tokens).reduce(
                (sum, provider) => sum + Object.keys(provider).length,
                0
            )
        });

        return true;
    }

    /**
     * Check if any tokens exist
     * @returns {boolean} True if tokens exist
     */
    hasTokens() {
        return this.tokens && Object.keys(this.tokens).length > 0;
    }

    /**
     * Check if specific account has tokens
     * @param {string} provider - Provider name
     * @param {string} accountType - Account identifier
     * @returns {boolean} True if account has tokens
     */
    hasAccountTokens(provider, accountType) {
        return !!(this.tokens[provider] && this.tokens[provider][accountType]);
    }

    /**
     * List all accounts across all providers
     * @returns {Array} Array of { provider, accountType, email, isActive }
     */
    listAllAccounts() {
        const accounts = [];

        for (const [provider, providerAccounts] of Object.entries(this.tokens)) {
            for (const [accountType, tokenData] of Object.entries(providerAccounts)) {
                accounts.push({
                    provider,
                    accountType,
                    email: tokenData.email,
                    display_name: tokenData.display_name,
                    is_active: tokenData.is_active,
                    created_at: tokenData.created_at
                });
            }
        }

        return accounts;
    }
}

// Export singleton instance
export const tokenStore = new TokenStore();
