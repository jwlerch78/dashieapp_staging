// js/data/auth/edge-client.js
// Client for calling Supabase edge functions for token and settings operations
// Part of the dual-write abstraction pattern

import { createLogger } from '../../utils/logger.js';
import { SUPABASE_CONFIG } from './auth-config.js';

const logger = createLogger('EdgeClient');

/**
 * EdgeClient - Wrapper for Supabase edge function calls
 * Handles authentication, error handling, and retry logic
 */
export class EdgeClient {
    constructor(jwtToken = null) {
        this.jwtToken = jwtToken;
        this.jwtExpiry = null;
        this.jwtUserId = null;
        this.jwtUserEmail = null;
        this.edgeFunctionUrl = SUPABASE_CONFIG.edgeFunctionUrl;
        this.databaseOpsUrl = SUPABASE_CONFIG.edgeFunctionUrl.replace('/jwt-auth', '/database-operations');
        this.anonKey = SUPABASE_CONFIG.anonKey;

        // Try to load JWT from localStorage
        if (!jwtToken) {
            this._loadJWTFromStorage();
        }
    }

    /**
     * Load JWT from localStorage
     * @private
     */
    _loadJWTFromStorage() {
        try {
            const stored = localStorage.getItem('dashie-supabase-jwt');
            if (!stored) {
                logger.debug('No JWT found in localStorage');
                return;
            }

            const data = JSON.parse(stored);

            // Check if expired
            if (Date.now() >= data.expiry) {
                logger.debug('Stored JWT expired, removing');
                localStorage.removeItem('dashie-supabase-jwt');
                return;
            }

            this.jwtToken = data.jwt;
            this.jwtExpiry = data.expiry;
            this.jwtUserId = data.userId;
            this.jwtUserEmail = data.userEmail;

            const minutesRemaining = Math.round((data.expiry - Date.now()) / 1000 / 60);
            logger.info('JWT loaded from localStorage', {
                expiresIn: `${minutesRemaining} minutes`,
                userId: data.userId,
                userEmail: data.userEmail
            });

        } catch (error) {
            logger.error('Failed to load JWT from localStorage', error);
            localStorage.removeItem('dashie-supabase-jwt');
        }
    }

    /**
     * Save JWT to localStorage
     * @private
     */
    _saveJWTToStorage() {
        try {
            if (!this.jwtToken || !this.jwtExpiry) {
                logger.warn('Cannot save JWT - missing token or expiry');
                return;
            }

            const data = {
                jwt: this.jwtToken,
                expiry: this.jwtExpiry,
                userId: this.jwtUserId,
                userEmail: this.jwtUserEmail,
                savedAt: Date.now()
            };

            localStorage.setItem('dashie-supabase-jwt', JSON.stringify(data));
            logger.debug('JWT saved to localStorage', {
                expiresIn: `${Math.round((this.jwtExpiry - Date.now()) / 1000 / 60)} minutes`
            });

        } catch (error) {
            logger.error('Failed to save JWT to localStorage', error);
        }
    }

    /**
     * Set JWT token for authenticated requests
     * @param {string} token - Supabase JWT token
     */
    setJWT(token) {
        this.jwtToken = token;

        // Parse JWT to extract expiry and user info
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            this.jwtExpiry = payload.exp ? payload.exp * 1000 : null;
            this.jwtUserId = payload.sub;
            this.jwtUserEmail = payload.email;

            logger.debug('JWT token updated', {
                userId: this.jwtUserId,
                userEmail: this.jwtUserEmail,
                expiresAt: this.jwtExpiry ? new Date(this.jwtExpiry).toISOString() : 'unknown'
            });

            // Save to localStorage
            this._saveJWTToStorage();

        } catch (error) {
            logger.error('Failed to parse JWT', error);
        }
    }

    /**
     * Bootstrap Supabase JWT from a provider's access token
     * Provider-agnostic method that works with ANY OAuth provider (Google, Amazon, Apple, etc.)
     *
     * @param {string} provider - Provider name ('google', 'amazon', 'apple', 'microsoft', etc.)
     * @param {string} providerAccessToken - Provider's access token
     * @returns {Promise<object>} { jwtToken, user, access }
     */
    async bootstrapJWT(provider, providerAccessToken) {
        logger.info('Bootstrapping JWT from provider', { provider });

        try {
            const response = await fetch(this.edgeFunctionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.anonKey}`  // Use anon key for bootstrap
                },
                body: JSON.stringify({
                    operation: 'bootstrap_jwt',
                    googleAccessToken: providerAccessToken,  // Note: Will be renamed to providerAccessToken in future edge function update
                    provider: provider
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));

                // Check for access denied
                if (response.status === 403 && errorData.error === 'access_denied') {
                    throw new Error(`Access denied: ${errorData.message || errorData.reason}`);
                }

                throw new Error(`JWT bootstrap failed: ${response.status} - ${errorData.error || errorData.details || 'Unknown error'}`);
            }

            const data = await response.json();

            if (!data.success || !data.jwtToken) {
                throw new Error(`JWT bootstrap failed: ${data.error || 'No JWT token returned'}`);
            }

            // Store JWT for future authenticated requests
            this.setJWT(data.jwtToken);

            logger.success('JWT bootstrapped successfully', {
                provider,
                userId: data.user?.id,
                userEmail: data.user?.email,
                tier: data.access?.tier
            });

            return {
                jwtToken: data.jwtToken,
                user: data.user,
                access: data.access
            };

        } catch (error) {
            logger.error('JWT bootstrap failed', error);
            throw error;
        }
    }

    /**
     * Check if JWT is expired or expiring soon
     * @param {number} bufferMinutes - Minutes of buffer before expiry (default: 60)
     * @returns {boolean} True if expired or expiring soon
     */
    isJWTExpired(bufferMinutes = 60) {
        if (!this.jwtToken || !this.jwtExpiry) {
            return true;
        }

        const bufferMs = bufferMinutes * 60 * 1000;
        const isExpired = Date.now() >= (this.jwtExpiry - bufferMs);

        if (isExpired) {
            const minutesRemaining = Math.round((this.jwtExpiry - Date.now()) / 1000 / 60);
            logger.debug('JWT expired or expiring soon', {
                minutesRemaining,
                bufferMinutes
            });
        }

        return isExpired;
    }

    /**
     * Refresh Supabase JWT using current JWT
     * @returns {Promise<string>} New JWT token
     */
    async refreshJWT() {
        if (!this.jwtToken) {
            throw new Error('No JWT to refresh - must authenticate first');
        }

        logger.info('Refreshing Supabase JWT');

        try {
            const response = await this.request({
                operation: 'refresh_jwt'
            });

            if (!response.jwtToken) {
                throw new Error('No JWT returned from refresh operation');
            }

            // Update JWT (this also saves to localStorage)
            this.setJWT(response.jwtToken);

            logger.success('JWT refreshed successfully', {
                userId: this.jwtUserId,
                expiresIn: `${Math.round((this.jwtExpiry - Date.now()) / 1000 / 60)} minutes`
            });

            return response.jwtToken;

        } catch (error) {
            logger.error('JWT refresh failed', error);
            throw error;
        }
    }

    /**
     * Clear JWT from memory and localStorage
     */
    clearJWT() {
        this.jwtToken = null;
        this.jwtExpiry = null;
        this.jwtUserId = null;
        this.jwtUserEmail = null;

        try {
            localStorage.removeItem('dashie-supabase-jwt');
            logger.info('JWT cleared from localStorage');
        } catch (error) {
            logger.error('Failed to clear JWT from localStorage', error);
        }
    }

    /**
     * Make authenticated request to edge function
     * @private
     * @param {object} payload - Request payload
     * @returns {Promise<object>} Response data
     */
    async request(payload) {
        if (!this.jwtToken) {
            throw new Error('JWT token required for edge function calls');
        }

        const response = await fetch(this.edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.jwtToken}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Edge function error: ${response.status} - ${errorData.error || errorData.details || 'Unknown error'}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(`Edge function returned error: ${data.error || 'Unknown error'}`);
        }

        return data;
    }

    /**
     * Make authenticated request to database-operations edge function
     * @private
     * @param {object} payload - Request payload
     * @returns {Promise<object>} Response data
     */
    async databaseRequest(payload) {
        if (!this.jwtToken) {
            throw new Error('JWT token required for database operations');
        }

        logger.debug('🔍 DEBUG: Making database-operations request', {
            url: this.databaseOpsUrl,
            operation: payload.operation,
            hasJwtToken: !!this.jwtToken,
            jwtTokenLength: this.jwtToken?.length,
            jwtTokenPrefix: this.jwtToken?.substring(0, 20)
        });

        const response = await fetch(this.databaseOpsUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.jwtToken}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            logger.error('🔍 DEBUG: Database operation failed', {
                status: response.status,
                error: errorData
            });
            throw new Error(`Database operation error: ${response.status} - ${errorData.error || errorData.details || 'Unknown error'}`);
        }

        const data = await response.json();
        if (!data.success) {
            logger.error('🔍 DEBUG: Database operation returned error', {
                error: data.error
            });
            throw new Error(`Database operation returned error: ${data.error || 'Unknown error'}`);
        }

        logger.debug('🔍 DEBUG: Database operation successful', data);
        return data;
    }

    /**
     * Store tokens for a specific account in Supabase
     * Calls edge function 'store_tokens' operation
     * @param {string} provider - Provider name (e.g., 'google')
     * @param {string} accountType - Account type (e.g., 'primary', 'account2')
     * @param {object} tokenData - Token data to store
     * @returns {Promise<object>} Store result
     */
    async storeTokens(provider, accountType, tokenData) {
        logger.debug('Storing tokens to Supabase', { provider, accountType });

        const response = await this.request({
            operation: 'store_tokens',
            provider,
            account_type: accountType,
            data: tokenData
        });

        logger.info('Successfully stored tokens to Supabase', {
            provider,
            accountType,
            email: response.account?.email
        });

        return response;
    }

    /**
     * Load all tokens from Supabase user_auth_tokens table
     * Calls edge function 'load' operation (loads settings, but we'll adapt it)
     * @returns {Promise<object>} Full tokens object structure
     */
    async loadTokens() {
        logger.debug('Loading tokens from Supabase');

        // NOTE: The edge function 'load' operation currently returns settings
        // We need to call list_accounts and reconstruct the token structure
        // For now, we'll use list_accounts to get the account info

        const response = await this.request({
            operation: 'list_accounts'
        });

        if (!response.accounts || response.accounts.length === 0) {
            logger.debug('No accounts found in Supabase');
            return { tokens: {} };
        }

        // Reconstruct token structure from account list
        // Note: This gives us metadata but not the actual tokens
        // We'll need to enhance the edge function to return full token data
        const tokens = {};

        for (const account of response.accounts) {
            if (!tokens[account.provider]) {
                tokens[account.provider] = {};
            }

            // Store account metadata
            // Actual tokens will need to come from a different operation
            tokens[account.provider][account.account_type] = {
                email: account.email,
                display_name: account.display_name,
                expires_at: account.expires_at,
                scopes: account.scopes,
                is_active: account.is_active,
                // Note: access_token and refresh_token not returned for security
                // This is metadata only - actual tokens fetched on-demand via get_valid_token
            };
        }

        logger.info('Loaded token metadata from Supabase', {
            accountCount: response.accounts.length
        });

        return { tokens };
    }

    /**
     * Get a valid (and potentially refreshed) access token for an account
     * Calls edge function 'get_valid_token' operation
     * @param {string} provider - Provider name
     * @param {string} accountType - Account type
     * @returns {Promise<object>} Token data with access_token
     */
    async getValidToken(provider, accountType) {
        logger.debug('Getting valid token from Supabase', { provider, accountType });

        const response = await this.request({
            operation: 'get_valid_token',
            provider,
            account_type: accountType
        });

        if (response.error) {
            throw new Error(`Failed to get valid token: ${response.error}`);
        }

        logger.debug('Got valid token from Supabase', {
            provider,
            accountType,
            refreshed: response.refreshed,
            expiresAt: response.expires_at
        });

        return {
            access_token: response.access_token,
            expires_at: response.expires_at,
            scopes: response.scopes,
            refreshed: response.refreshed
        };
    }

    /**
     * Remove account tokens from Supabase
     * Calls edge function 'remove_account' operation
     * @param {string} provider - Provider name
     * @param {string} accountType - Account type
     * @returns {Promise<object>} Removal result
     */
    async removeAccount(provider, accountType) {
        logger.debug('Removing account from Supabase', { provider, accountType });

        const response = await this.request({
            operation: 'remove_account',
            provider,
            account_type: accountType
        });

        logger.info('Successfully removed account from Supabase', {
            provider,
            accountType,
            removed: response.removed
        });

        return response;
    }

    /**
     * Save settings to Supabase
     * Calls edge function 'save' operation
     * @param {object} settings - Settings object to save
     * @returns {Promise<object>} Save result
     */
    async saveSettings(settings) {
        logger.debug('Saving settings to Supabase');

        const response = await this.request({
            operation: 'save',
            settings
        });

        logger.info('Successfully saved settings to Supabase');
        return response;
    }

    /**
     * Load settings from Supabase
     * Calls edge function 'load' operation
     * @returns {Promise<object>} Settings object
     */
    async loadSettings() {
        logger.debug('Loading settings from Supabase');

        const response = await this.request({
            operation: 'load'
        });

        logger.info('Successfully loaded settings from Supabase');
        return response.settings || {};
    }

    /**
     * Save calendar configuration to user_calendar_config table
     * @param {Array<string>} activeCalendarIds - Array of active calendar IDs (account-prefixed)
     * @returns {Promise<object>} Save result
     */
    async saveCalendarConfig(activeCalendarIds) {
        logger.info('🔍 DEBUG: Saving calendar config to user_calendar_config table', {
            count: activeCalendarIds.length,
            ids: activeCalendarIds
        });

        const response = await this.databaseRequest({
            operation: 'save_calendar_config',
            active_calendar_ids: activeCalendarIds
        });

        logger.info('🔍 DEBUG: Successfully saved calendar config, response:', response);
        return response;
    }

    /**
     * Load calendar configuration from user_calendar_config table
     * @returns {Promise<Array<string>>} Array of active calendar IDs
     */
    async loadCalendarConfig() {
        logger.info('🔍 DEBUG: Loading calendar config from user_calendar_config table');

        const response = await this.databaseRequest({
            operation: 'load_calendar_config'
        });

        logger.info('🔍 DEBUG: Successfully loaded calendar config, response:', {
            response,
            activeCalendarIds: response.active_calendar_ids || []
        });

        return response.active_calendar_ids || [];
    }
}
