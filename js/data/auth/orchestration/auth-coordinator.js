// js/data/auth/orchestration/auth-coordinator.js
// Routes authentication requests to the correct provider
// Handles platform detection and provider selection

import { createLogger } from '../../../utils/logger.js';
import { getPlatformDetector } from '../../../utils/platform-detector.js';
import { GoogleAccountAuth } from '../account-auth/google-account-auth.js';
import { WebOAuthProvider } from '../providers/web-oauth.js';
import { DeviceFlowProvider } from '../providers/device-flow.js';
import { HybridDeviceAuth } from '../providers/hybrid-device-auth.js';

const logger = createLogger('AuthCoordinator');

// Feature flag: Enable Hybrid Device Flow (Phase 5.5)
// Set to true to use new hybrid flow, false to use legacy Google Device Flow
const USE_HYBRID_DEVICE_FLOW = true;

/**
 * AuthCoordinator - Routes to correct authentication provider
 *
 * Responsibilities:
 * - Detect platform (Fire TV vs Web/Mobile)
 * - Initialize appropriate OAuth providers
 * - Route sign-in requests to correct provider
 * - Handle OAuth callbacks
 * - Coordinate JWT bootstrap after OAuth
 *
 * Provider Selection:
 * - Fire TV → Hybrid Device Flow (custom QR code) OR Device Flow (Google QR code)
 * - Web/Mobile → Web OAuth (redirect)
 */
export class AuthCoordinator {
    constructor() {
        this.googleAccountAuth = null;
        this.webOAuthProvider = null;
        this.deviceFlowProvider = null;
        this.hybridDeviceAuth = null;
        this.isFireTV = false;
        this.isInitialized = false;

        logger.verbose('AuthCoordinator created');
    }

    /**
     * Initialize AuthCoordinator and OAuth providers
     * @param {object} options - { edgeClient, tokenStore }
     * @returns {Promise<object|null>} OAuth result if callback detected, null otherwise
     */
    async initialize({ edgeClient, tokenStore }) {
        if (this.isInitialized) {
            logger.warn('AuthCoordinator already initialized');
            return null;
        }

        try {
            logger.verbose('Initializing AuthCoordinator...');

            // 1. Detect platform
            const platform = getPlatformDetector();
            this.isFireTV = platform.getPlatformDescription().includes('Fire TV');

            logger.info('Platform detected', {
                description: platform.getPlatformDescription(),
                isFireTV: this.isFireTV
            });

            // 2. Initialize appropriate OAuth provider(s)
            if (this.isFireTV) {
                if (USE_HYBRID_DEVICE_FLOW) {
                    logger.verbose('Fire TV detected - creating Hybrid Device Auth provider (Phase 5.5)');
                    this.hybridDeviceAuth = new HybridDeviceAuth();
                    this.deviceFlowProvider = this.hybridDeviceAuth; // Use as device flow provider
                    logger.verbose('HybridDeviceAuth created');
                } else {
                    logger.verbose('Fire TV detected - creating legacy Device Flow provider');
                    this.deviceFlowProvider = new DeviceFlowProvider();
                    logger.verbose('DeviceFlowProvider created');
                }
            } else {
                logger.verbose('Desktop/Mobile detected - creating Web OAuth provider');
                this.webOAuthProvider = new WebOAuthProvider();
                logger.verbose('WebOAuthProvider created');
            }

            // 3. Initialize GoogleAccountAuth with providers
            this.googleAccountAuth = new GoogleAccountAuth(
                this.webOAuthProvider,
                this.deviceFlowProvider,
                edgeClient,
                tokenStore
            );

            // This will also check for OAuth callbacks and return the result
            const oauthResult = await this.googleAccountAuth.initialize();

            this.isInitialized = true;

            logger.verbose('AuthCoordinator initialized', {
                hasDeviceFlow: !!this.deviceFlowProvider,
                hasHybridDeviceAuth: !!this.hybridDeviceAuth,
                hasWebOAuth: !!this.webOAuthProvider,
                usingHybridFlow: USE_HYBRID_DEVICE_FLOW && this.isFireTV,
                hadOAuthCallback: !!oauthResult
            });

            return oauthResult; // Return OAuth result if callback was detected

        } catch (error) {
            logger.error('Failed to initialize AuthCoordinator', error);
            throw error;
        }
    }

    /**
     * Sign in with appropriate provider based on options
     * @param {object} options - { useDeviceFlow: boolean }
     * @returns {Promise<object>} { user, jwtToken, access }
     */
    async signIn(options = {}) {
        if (!this.isInitialized) {
            throw new Error('AuthCoordinator not initialized');
        }

        try {
            // If no explicit provider specified, use platform default
            const useDeviceFlow = options.useDeviceFlow !== undefined
                ? options.useDeviceFlow
                : this.isFireTV;

            const providerName = useDeviceFlow
                ? (USE_HYBRID_DEVICE_FLOW ? 'hybrid_device_auth' : 'device_flow')
                : 'web_oauth';

            logger.info('Starting sign-in', {
                provider: providerName,
                platform: this.isFireTV ? 'Fire TV' : 'Web/Mobile',
                usingHybridFlow: USE_HYBRID_DEVICE_FLOW && useDeviceFlow
            });

            // Delegate to GoogleAccountAuth
            const result = await this.googleAccountAuth.signIn({ useDeviceFlow });

            // Check for redirect (web OAuth)
            if (result && result.redirected) {
                logger.debug('OAuth redirect initiated');
                return result;
            }

            // Check for successful authentication
            if (result && result.email) {
                logger.success('Sign-in successful', {
                    email: result.email,
                    provider: result.provider
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
     * Get the active OAuth provider
     * @returns {WebOAuthProvider|DeviceFlowProvider|null}
     */
    getActiveProvider() {
        return this.googleAccountAuth?.activeProvider || null;
    }

    /**
     * Check if platform is Fire TV
     * @returns {boolean}
     */
    isFireTVPlatform() {
        return this.isFireTV;
    }

    /**
     * Get current user from GoogleAccountAuth
     * @returns {object|null}
     */
    getUser() {
        return this.googleAccountAuth?.getUser() || null;
    }
}
