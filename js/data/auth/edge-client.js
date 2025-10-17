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
        this.edgeFunctionUrl = SUPABASE_CONFIG.edgeFunctionUrl;
        this.anonKey = SUPABASE_CONFIG.anonKey;
    }

    /**
     * Set JWT token for authenticated requests
     * @param {string} token - Supabase JWT token
     */
    setJWT(token) {
        this.jwtToken = token;
        logger.debug('JWT token updated');
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
}
