// js/data/auth/account-auth/google-account-auth.js
// Google implementation of Layer 1 authentication: How users log into Dashie with Google
// Part of Phase 3: Multi-provider auth architecture

import { BaseAccountAuth } from './base-account-auth.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('GoogleAccountAuth');

/**
 * GoogleAccountAuth - Google OAuth for account login
 *
 * This handles the user's primary authentication with Dashie using Google.
 * This is SEPARATE from Google Calendar access (handled by GoogleCalendarAuth).
 *
 * Use Cases:
 * - User logs into Dashie with their Google account
 * - Session management
 * - Primary user identity
 *
 * Note: This wraps the existing OAuth providers (WebOAuth, DeviceFlow)
 * to fit into the new two-layer architecture.
 */
export class GoogleAccountAuth extends BaseAccountAuth {
    constructor(webOAuthProvider, deviceFlowProvider = null) {
        super();
        this.providerName = 'google';
        this.webOAuthProvider = webOAuthProvider;
        this.deviceFlowProvider = deviceFlowProvider;
        this.activeProvider = null; // Currently active OAuth provider
    }

    /**
     * Initialize Google account authentication
     * Determines which OAuth method to use (web or device flow)
     */
    async initialize() {
        try {
            // Initialize web OAuth provider (always available)
            if (this.webOAuthProvider && this.webOAuthProvider.init) {
                const result = await this.webOAuthProvider.init();

                // Check if OAuth callback completed during init
                if (result && result.success && result.user) {
                    this.user = this.normalizeUser(result.user);
                    this.activeProvider = this.webOAuthProvider;

                    logger.success('User authenticated via OAuth callback during init', {
                        email: this.user.email
                    });
                }
            }

            this.isReady = true;
            logger.info('GoogleAccountAuth initialized', {
                hasDeviceFlow: !!this.deviceFlowProvider,
                isAuthenticated: this.isAuthenticated()
            });

        } catch (error) {
            logger.error('Failed to initialize GoogleAccountAuth', error);
            throw error;
        }
    }

    /**
     * Sign in with Google
     * Uses web OAuth by default, device flow for TV platforms
     * @param {object} options - { useDeviceFlow: boolean }
     * @returns {Promise<object>} User object
     */
    async signIn(options = {}) {
        try {
            const provider = this.selectProvider(options);

            logger.info('Starting Google sign-in', {
                provider: provider === this.deviceFlowProvider ? 'device_flow' : 'web_oauth'
            });

            const result = await provider.signIn();

            // Handle redirect case (web OAuth)
            if (result === undefined || result.redirected) {
                logger.debug('OAuth redirect initiated');
                return { redirected: true };
            }

            // Handle successful authentication
            if (result && result.success && result.user) {
                this.user = this.normalizeUser(result.user);
                this.activeProvider = provider;

                logger.success('Google sign-in successful', {
                    email: this.user.email,
                    authMethod: this.user.authMethod
                });

                return this.user;
            }

            throw new Error(result.error || 'Authentication failed');

        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Sign out from Google
     */
    async signOut() {
        try {
            if (this.activeProvider && this.activeProvider.signOut) {
                this.activeProvider.signOut();
            }

            this.user = null;
            this.activeProvider = null;

            logger.info('Google sign-out successful');

        } catch (error) {
            logger.error('Error during Google sign-out', error);
            // Clear local state anyway
            this.user = null;
            this.activeProvider = null;
            throw error;
        }
    }

    /**
     * Refresh Google authentication session
     * Google OAuth tokens are managed separately by calendar auth layer
     */
    async refresh() {
        // For account auth, we don't need to refresh tokens
        // The session is maintained by the JWT service
        // Calendar access tokens are managed by GoogleCalendarAuth

        if (!this.isAuthenticated()) {
            throw new Error('No active session to refresh');
        }

        logger.debug('Session refresh not needed for Google account auth');
        return this.user;
    }

    /**
     * Get provider capabilities
     */
    getCapabilities() {
        return {
            supportsRefresh: false, // Session managed by JWT, not OAuth refresh
            supportsAutoSignIn: false,
            requiresUserInteraction: true,
            platformSupport: ['desktop', 'mobile', 'tv']
        };
    }

    /**
     * Select appropriate OAuth provider based on options and platform
     * @param {object} options - Sign-in options
     * @returns {object} Selected OAuth provider
     */
    selectProvider(options) {
        if (options.useDeviceFlow && this.deviceFlowProvider) {
            return this.deviceFlowProvider;
        }

        return this.webOAuthProvider;
    }

    /**
     * Normalize user object from OAuth provider
     * @param {object} rawUser - Raw user object from OAuth provider
     * @returns {object} Normalized user object
     */
    normalizeUser(rawUser) {
        return {
            id: rawUser.email, // Use email as stable ID
            email: rawUser.email,
            name: rawUser.name || rawUser.email,
            picture: rawUser.picture || null,
            provider: 'google',
            authMethod: rawUser.authMethod || 'google_oauth',
            signedInAt: Date.now()
        };
    }

    /**
     * Get Google access token for the current user
     * @returns {string|null} Access token or null
     */
    getAccessToken() {
        if (this.activeProvider && this.activeProvider.getAccessToken) {
            return this.activeProvider.getAccessToken();
        }

        return null;
    }

    /**
     * Check if current OAuth provider supports token refresh
     * @returns {boolean}
     */
    canRefreshToken() {
        return !!(this.activeProvider && this.activeProvider.refreshToken);
    }
}
