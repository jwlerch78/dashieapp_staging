// js/data/auth/account-auth/base-account-auth.js
// Base class for Layer 1 authentication: How users log into Dashie
// Part of Phase 3: Multi-provider auth architecture

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('BaseAccountAuth');

/**
 * BaseAccountAuth - Layer 1: Account Authentication
 *
 * This layer handles how users log into Dashie itself.
 * Examples: Google OAuth, Amazon OAuth (Fire TV), Email/Password, Device Flow
 *
 * This is SEPARATE from calendar authentication (Layer 2).
 * A user can log in with Google but access iCloud calendars.
 *
 * Provider implementations should extend this class and implement all methods.
 */
export class BaseAccountAuth {
    constructor() {
        this.providerName = 'unknown';
        this.isReady = false;
        this.user = null;
    }

    /**
     * Get provider name (e.g., 'google', 'amazon', 'email')
     * @returns {string} Provider identifier
     */
    getProviderName() {
        return this.providerName;
    }

    /**
     * Initialize the auth provider
     * Called once during app startup
     * @returns {Promise<void>}
     */
    async initialize() {
        logger.warn(`initialize() not implemented for ${this.providerName}`);
        throw new Error('initialize() must be implemented by provider');
    }

    /**
     * Sign in user
     * Shows auth UI and completes authentication flow
     * @returns {Promise<object>} User object { id, email, name, provider }
     */
    async signIn() {
        logger.warn(`signIn() not implemented for ${this.providerName}`);
        throw new Error('signIn() must be implemented by provider');
    }

    /**
     * Sign out user
     * Clears session and tokens
     * @returns {Promise<void>}
     */
    async signOut() {
        logger.warn(`signOut() not implemented for ${this.providerName}`);
        throw new Error('signOut() must be implemented by provider');
    }

    /**
     * Check if user is authenticated
     * @returns {boolean} True if user is signed in
     */
    isAuthenticated() {
        return !!this.user;
    }

    /**
     * Get current user
     * @returns {object|null} User object or null
     */
    getUser() {
        return this.user;
    }

    /**
     * Refresh authentication session
     * Called to extend or validate existing session
     * @returns {Promise<object>} Updated user object
     */
    async refresh() {
        logger.warn(`refresh() not implemented for ${this.providerName}`);
        throw new Error('refresh() must be implemented by provider');
    }

    /**
     * Check if provider is ready to use
     * @returns {boolean} True if initialized and ready
     */
    isProviderReady() {
        return this.isReady;
    }

    /**
     * Get provider capabilities
     * @returns {object} Capabilities object
     */
    getCapabilities() {
        return {
            supportsRefresh: false,
            supportsAutoSignIn: false,
            requiresUserInteraction: true,
            platformSupport: ['desktop', 'mobile', 'tv']
        };
    }

    /**
     * Validate session
     * Checks if current session is still valid
     * @returns {Promise<boolean>} True if session is valid
     */
    async validateSession() {
        if (!this.isAuthenticated()) {
            return false;
        }

        // Base implementation just checks if user exists
        // Providers should override to validate with backend
        return true;
    }

    /**
     * Handle auth errors
     * @param {Error} error - Error object
     * @returns {object} Normalized error object
     */
    handleError(error) {
        logger.error(`${this.providerName} auth error`, error);

        return {
            provider: this.providerName,
            code: error.code || 'UNKNOWN_ERROR',
            message: error.message || 'Authentication failed',
            isRecoverable: true,
            originalError: error
        };
    }

    /**
     * Clean up resources
     * Called when provider is being destroyed
     */
    destroy() {
        this.user = null;
        this.isReady = false;
        logger.debug(`${this.providerName} provider destroyed`);
    }
}
