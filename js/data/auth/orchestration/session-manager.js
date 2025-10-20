// js/data/auth/orchestration/session-manager.js
// Orchestrates the entire authentication system
// Refactored from index.html auth initialization code

import { createLogger } from '../../../utils/logger.js';
import { EdgeClient } from '../edge-client.js';
import { TokenStore } from '../token-store.js';
import DashieModal from '../../../utils/dashie-modal.js';

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

                // Check if this is a multi-account flow (adding secondary account)
                const pendingAccountType = sessionStorage.getItem('pendingAccountType');
                const isMultiAccountFlow = pendingAccountType && this.edgeClient.jwtToken;

                if (isMultiAccountFlow) {
                    // MULTI-ACCOUNT FLOW: User is already authenticated, adding a secondary account
                    // Do NOT bootstrap JWT, just store the tokens for the secondary account
                    logger.info('Multi-account OAuth callback detected', {
                        accountType: pendingAccountType,
                        newAccountEmail: oauthResult.user.email,
                        existingJwt: !!this.edgeClient.jwtToken
                    });

                    try {
                        // Check if this email is already added (prevent duplicates)
                        const existingAccounts = await this.tokenStore.getProviderAccounts('google');
                        const accountWithSameEmail = Object.entries(existingAccounts || {}).find(
                            ([accountType, tokenData]) => tokenData.email === oauthResult.user.email
                        );

                        if (accountWithSameEmail) {
                            const [existingAccountType, existingTokenData] = accountWithSameEmail;
                            logger.warn('Account with this email already exists', {
                                email: oauthResult.user.email,
                                existingAccountType
                            });

                            // Clean up pending account type
                            sessionStorage.removeItem('pendingAccountType');

                            // Show user a message
                            await DashieModal.warning(
                                'Account Already Connected',
                                `This Google account is already connected:\n\n${oauthResult.user.email}\n\nAccount Type: ${existingAccountType}`
                            );

                            // Redirect back to settings
                            window.location.hash = '#settings/calendar';
                            window.location.reload();

                            return {
                                authenticated: true,
                                user: this.user,
                                duplicateAccount: true
                            };
                        }

                        // Store tokens for secondary account
                        await this.tokenStore.storeAccountTokens('google', pendingAccountType, {
                            access_token: oauthResult.tokens.access_token,
                            refresh_token: oauthResult.tokens.refresh_token,
                            expires_at: new Date(Date.now() + (oauthResult.tokens.expires_in * 1000)).toISOString(),
                            scopes: oauthResult.tokens.scope?.split(' ') || [],
                            email: oauthResult.user.email,
                            display_name: oauthResult.user.name,
                            provider_info: {
                                type: 'web_oauth',
                                auth_method: oauthResult.user.authMethod,
                                client_id: this.authCoordinator.webOAuthProvider?.config?.client_id || 'unknown'
                            }
                        });

                        logger.success('Secondary account tokens stored', {
                            accountType: pendingAccountType,
                            email: oauthResult.user.email
                        });

                        // Auto-enable primary calendar from the new account
                        logger.info('Auto-enabling primary calendar from new account', {
                            accountType: pendingAccountType
                        });

                        try {
                            const calendarService = window.calendarService;
                            if (calendarService) {
                                // Fetch calendars from the new account
                                const calendars = await calendarService.getCalendars(pendingAccountType);

                                // Find the primary calendar
                                const primaryCalendar = calendars.find(cal => cal.primary === true);

                                if (primaryCalendar) {
                                    // Create prefixed ID for the primary calendar
                                    const primaryCalendarId = calendarService.createPrefixedId(pendingAccountType, primaryCalendar.id);

                                    // Add to active calendars
                                    if (!calendarService.activeCalendarIds.includes(primaryCalendarId)) {
                                        calendarService.activeCalendarIds.push(primaryCalendarId);
                                        await calendarService.saveActiveCalendars();

                                        logger.success('Primary calendar auto-enabled for new account', {
                                            accountType: pendingAccountType,
                                            calendarId: primaryCalendarId
                                        });
                                    }
                                }
                            }
                        } catch (calendarError) {
                            logger.warn('Failed to auto-enable primary calendar for new account', calendarError);
                            // Don't fail the whole flow if calendar enabling fails
                        }

                        // Clean up pending account type
                        sessionStorage.removeItem('pendingAccountType');

                        // Keep existing authentication state
                        this.isInitialized = true;

                        // Redirect back to settings calendar page
                        window.location.hash = '#settings/calendar';
                        window.location.reload();

                        return {
                            authenticated: true,
                            user: this.user,
                            multiAccountCallback: true
                        };

                    } catch (error) {
                        logger.error('Failed to store secondary account tokens', error);
                        sessionStorage.removeItem('pendingAccountType');
                        throw error;
                    }
                }

                // PRIMARY ACCOUNT FLOW: First-time authentication
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

                    // Refresh TokenStore to populate in-memory cache
                    await this.tokenStore.refresh();
                    logger.debug('TokenStore refreshed after OAuth token storage');

                    // Set authenticated user
                    // IMPORTANT: Use jwtResult.user (Supabase UUID), not oauthResult.user (Google ID)
                    this.isAuthenticated = true;
                    this.user = {
                        ...jwtResult.user,  // Supabase user with UUID
                        name: oauthResult.user.name,  // Keep display name from Google
                        picture: oauthResult.user.picture,  // Keep picture from Google
                        provider: 'google',
                        authMethod: oauthResult.user.authMethod,
                        jwtToken: jwtResult.jwtToken,
                        access: jwtResult.access,
                        signedInAt: Date.now()
                    };

                    // Persist user data (name, picture) to localStorage for session restoration
                    // JWT doesn't include these fields, so we need to store them separately
                    try {
                        const userDataForStorage = {
                            name: this.user.name,
                            picture: this.user.picture
                        };
                        localStorage.setItem('dashie-user-data', JSON.stringify(userDataForStorage));
                        logger.debug('Saved user data to localStorage', {
                            hasName: !!userDataForStorage.name,
                            hasPicture: !!userDataForStorage.picture
                        });
                    } catch (error) {
                        logger.warn('Failed to save user data to localStorage', error);
                    }

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

            // Refresh TokenStore to populate in-memory cache
            await this.tokenStore.refresh();
            logger.debug('TokenStore refreshed after session restoration');

            // Set user from JWT
            // Note: We don't have full user details (name, picture) from JWT
            // Restore from localStorage if available
            let savedUserData = null;
            try {
                const storedData = localStorage.getItem('dashie-user-data');
                if (storedData) {
                    savedUserData = JSON.parse(storedData);
                    logger.debug('Loaded user data from localStorage', {
                        hasName: !!savedUserData.name,
                        hasPicture: !!savedUserData.picture
                    });
                }
            } catch (error) {
                logger.warn('Failed to load user data from localStorage', error);
            }

            this.user = {
                id: this.edgeClient.jwtUserId,
                email: this.edgeClient.jwtUserEmail,
                name: savedUserData?.name || this.edgeClient.jwtUserEmail.split('@')[0], // Use saved name or email prefix as fallback
                picture: savedUserData?.picture || null, // Restore picture from localStorage
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

            // Clear user data from localStorage
            try {
                localStorage.removeItem('dashie-user-data');
                logger.debug('Cleared user data from localStorage');
            } catch (error) {
                logger.warn('Failed to clear user data from localStorage', error);
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
