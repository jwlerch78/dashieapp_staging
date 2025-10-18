// js/data/auth/orchestration/session-manager.js
// Orchestrates the entire authentication system
// Refactored from index.html auth initialization code

import { createLogger } from '../../../utils/logger.js';
import { EdgeClient } from '../edge-client.js';
import { TokenStore } from '../token-store.js';

const logger = createLogger('SessionManager');

/**
 * SessionManager - Orchestrates authentication flow
 *
 * Responsibilities:
 * - Initialize auth system (EdgeClient, TokenStore, providers)
 * - Check for existing sessions (JWT from localStorage)
 * - Manage sign-in/sign-out flows
 * - Handle OAuth callbacks
 * - Coordinate session restoration
 * - Update application state on auth changes
 *
 * Architecture:
 * - Uses EdgeClient for JWT management
 * - Uses TokenStore for Google token storage (Supabase only)
 * - Delegates to AuthCoordinator for provider selection
 */
export class SessionManager {
    constructor() {
        this.isInitialized = false;
        this.isAuthenticated = false;

        // Core components
        this.edgeClient = null;
        this.tokenStore = null;
        this.authCoordinator = null;

        // Current user
        this.user = null;

        logger.verbose('SessionManager created');
    }

    /**
     * Initialize the session manager and auth system
     * @param {object} options - { authCoordinator }
     * @returns {Promise<object>} { authenticated: boolean, user: object|null, oauthCallback: boolean }
     */
    async initialize(authCoordinator) {
        if (this.isInitialized) {
            logger.warn('SessionManager already initialized');
            return { authenticated: this.isAuthenticated, user: this.user };
        }

        try {
            logger.verbose('🔐 Initializing SessionManager...');

            this.authCoordinator = authCoordinator;

            // 1. Initialize EdgeClient (automatically loads JWT from localStorage)
            this.edgeClient = new EdgeClient();

            if (this.edgeClient.jwtToken) {
                logger.verbose('EdgeClient initialized - JWT loaded from localStorage');
            } else {
                logger.verbose('EdgeClient initialized - no JWT found');
            }

            // 2. Initialize TokenStore (for Google token metadata tracking)
            this.tokenStore = new TokenStore();
            await this.tokenStore.initialize(this.edgeClient);
            logger.verbose('TokenStore initialized');

            // 3. Initialize AuthCoordinator (sets up OAuth providers)
            const oauthResult = await this.authCoordinator.initialize({
                edgeClient: this.edgeClient,
                tokenStore: this.tokenStore
            });

            // 4. Check if OAuth callback returned a user
            if (oauthResult && oauthResult.success && oauthResult.user) {
                logger.success('OAuth callback detected during initialization');

                // OAuth callback happened, but we need to complete the sign-in flow:
                // 1. Bootstrap JWT from Google access token
                // 2. Store tokens to Supabase
                // This is handled by GoogleAccountAuth.signIn(), but OAuth already happened
                // So we need to manually trigger the JWT bootstrap and storage

                try {
                    logger.info('Completing OAuth callback flow (JWT bootstrap + token storage)');

                    // Bootstrap JWT from the OAuth access token
                    const jwtResult = await this.authCoordinator.googleAccountAuth.bootstrapJWT(
                        this.edgeClient,
                        oauthResult.tokens.access_token
                    );

                    logger.success('JWT bootstrap complete', {
                        userId: jwtResult.user?.id,
                        tier: jwtResult.access?.tier
                    });

                    // Update TokenStore with JWT-authenticated EdgeClient
                    this.tokenStore.edgeClient = this.edgeClient;

                    // Determine device-aware account type
                    const usedProvider = this.authCoordinator.googleAccountAuth.activeProvider;
                    const isDeviceFlow = usedProvider === this.authCoordinator.deviceFlowProvider;
                    const accountType = isDeviceFlow ? 'primary-tv' : 'primary';

                    logger.debug('Storing OAuth tokens', {
                        accountType,
                        isDeviceFlow,
                        provider: isDeviceFlow ? 'device_flow' : 'web_oauth'
                    });

                    // Store tokens to Supabase
                    await this.tokenStore.storeAccountTokens('google', accountType, {
                        access_token: oauthResult.tokens.access_token,
                        refresh_token: oauthResult.tokens.refresh_token,
                        expires_at: new Date(Date.now() + (oauthResult.tokens.expires_in * 1000)).toISOString(),
                        scopes: oauthResult.tokens.scope?.split(' ') || [],
                        email: oauthResult.user.email,
                        display_name: oauthResult.user.name,
                        provider_info: {
                            type: isDeviceFlow ? 'device_flow' : 'web_oauth',
                            auth_method: oauthResult.user.authMethod,
                            client_id: usedProvider?.config?.client_id || 'unknown'
                        }
                    });

                    logger.success('OAuth tokens stored to Supabase');

                    // Set authenticated user
                    this.isAuthenticated = true;
                    this.user = {
                        ...oauthResult.user,
                        jwtToken: jwtResult.jwtToken,
                        access: jwtResult.access
                    };

                    this.isInitialized = true;

                    return {
                        authenticated: true,
                        user: this.user,
                        oauthCallback: true
                    };

                } catch (error) {
                    logger.error('Failed to complete OAuth callback flow', error);
                    // Fall through to session restoration or login
                    this.isAuthenticated = false;
                    this.user = null;
                }
            }

            // 5. No OAuth callback - try to restore session from JWT
            const sessionRestored = await this.restoreSession();

            this.isInitialized = true;

            logger.verbose('SessionManager initialized', {
                authenticated: this.isAuthenticated,
                userId: this.user?.id,
                sessionRestored
            });

            return {
                authenticated: this.isAuthenticated,
                user: this.user,
                oauthCallback: false
            };

        } catch (error) {
            logger.error('Failed to initialize SessionManager', error);
            this.isInitialized = true; // Mark as initialized even on error
            throw error;
        }
    }

    /**
     * Try to restore session from stored JWT
     * @private
     * @returns {Promise<boolean>} True if session restored
     */
    async restoreSession() {
        logger.info('Checking for stored JWT...');

        if (!this.edgeClient.jwtToken) {
            logger.info('No JWT found - user must sign in');
            return false;
        }

        try {
            logger.info('Found JWT, checking if valid and refreshing if needed');

            // Check if JWT is expired or expiring soon (< 60 min remaining)
            if (this.edgeClient.isJWTExpired(60)) {
                logger.info('JWT expired or expiring soon, refreshing...');

                try {
                    await this.edgeClient.refreshJWT();
                    logger.success('JWT refreshed successfully');
                } catch (refreshError) {
                    logger.error('JWT refresh failed', refreshError);
                    // Clear invalid JWT
                    this.edgeClient.clearJWT();
                    logger.info('JWT cleared - user must re-authenticate');
                    return false;
                }
            }

            // JWT is valid! Restore session
            logger.success('Session restored from JWT', {
                userId: this.edgeClient.jwtUserId,
                email: this.edgeClient.jwtUserEmail
            });

            // Update TokenStore with authenticated EdgeClient
            this.tokenStore.edgeClient = this.edgeClient;

            // Set user from JWT
            // Note: We don't have full user details (name, picture) from JWT
            // Those will be loaded when needed
            this.user = {
                id: this.edgeClient.jwtUserId,
                email: this.edgeClient.jwtUserEmail,
                name: this.edgeClient.jwtUserEmail.split('@')[0], // Use email prefix as fallback
                picture: null,
                provider: 'google',
                authMethod: 'jwt_restoration',
                signedInAt: Date.now()
            };

            this.isAuthenticated = true;

            // Update AuthCoordinator with restored user
            if (this.authCoordinator.googleAccountAuth) {
                this.authCoordinator.googleAccountAuth.user = this.user;
            }

            return true;

        } catch (error) {
            logger.error('Session restoration failed', error);
            return false;
        }
    }

    /**
     * Sign in with specified provider and options
     * @param {object} options - { useDeviceFlow: boolean }
     * @returns {Promise<object>} User object
     */
    async signIn(options = {}) {
        logger.info('Starting sign-in flow', options);

        if (!this.isInitialized) {
            throw new Error('SessionManager not initialized');
        }

        try {
            // Delegate to AuthCoordinator
            const result = await this.authCoordinator.signIn(options);

            // Check for redirect (web OAuth)
            if (result && result.redirected) {
                logger.debug('OAuth redirect initiated');
                return result;
            }

            // Check for successful authentication
            // GoogleAccountAuth.signIn() returns user object directly (with email property)
            if (result && result.email) {
                this.isAuthenticated = true;
                this.user = result;

                logger.success('Sign-in successful', {
                    userId: this.user.id,
                    email: this.user.email
                });

                return result;
            }

            throw new Error('Sign-in failed - no user returned');

        } catch (error) {
            logger.error('Sign-in failed', error);
            throw error;
        }
    }

    /**
     * Sign out current user
     * Clears JWT and auth state (Google tokens stay in Supabase)
     */
    async signOut() {
        logger.info('Signing out...');

        try {
            // Clear JWT (Google tokens stay in Supabase for next login)
            if (this.edgeClient) {
                this.edgeClient.clearJWT();
            }

            // Clear user state
            this.user = null;
            this.isAuthenticated = false;

            // Clear AuthCoordinator user
            if (this.authCoordinator.googleAccountAuth) {
                this.authCoordinator.googleAccountAuth.user = null;
            }

            logger.success('Sign-out complete');

        } catch (error) {
            logger.error('Sign-out failed', error);
            throw error;
        }
    }

    /**
     * Check if user is authenticated
     * @returns {boolean}
     */
    isUserAuthenticated() {
        return this.isAuthenticated && this.user !== null;
    }

    /**
     * Get current user
     * @returns {object|null}
     */
    getUser() {
        return this.user;
    }

    /**
     * Get EdgeClient instance
     * @returns {EdgeClient}
     */
    getEdgeClient() {
        return this.edgeClient;
    }

    /**
     * Get TokenStore instance
     * @returns {TokenStore}
     */
    getTokenStore() {
        return this.tokenStore;
    }
}

// Export singleton instance
export const sessionManager = new SessionManager();
