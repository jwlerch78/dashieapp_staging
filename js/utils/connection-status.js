// js/utils/connection-status.js
// Connection status monitoring and offline mode detection
// Detects when Supabase/backend services are unavailable

import { createLogger } from './logger.js';

const logger = createLogger('ConnectionStatus');

/**
 * ConnectionStatus - Monitor backend availability and network connectivity
 *
 * Features:
 * - Detect Supabase/backend outages
 * - Track online/offline state
 * - Notify listeners of status changes
 * - Periodic health checks with exponential backoff
 */
export class ConnectionStatus {
    constructor() {
        this.isOnline = navigator.onLine;
        this.isBackendAvailable = true;
        this.lastSuccessfulConnection = Date.now();
        this.listeners = new Set();

        // Health check configuration
        this.healthCheckInterval = null;
        this.healthCheckDelay = 30000; // Start with 30 seconds
        this.maxHealthCheckDelay = 5 * 60 * 1000; // Max 5 minutes
        this.healthCheckBackoffMultiplier = 1.5;

        // Degraded mode tracking
        this.isDegraded = false;
        this.degradedReason = null;

        // Test mode (for simulating offline)
        this.testMode = false;
        this.testModeType = null; // 'offline', 'slow', etc.

        logger.verbose('ConnectionStatus initialized');
    }

    /**
     * Initialize connection monitoring
     */
    initialize() {
        // Listen for browser online/offline events
        window.addEventListener('online', () => this.handleOnlineStatusChange(true));
        window.addEventListener('offline', () => this.handleOnlineStatusChange(false));

        logger.info('Connection status monitoring started', {
            online: this.isOnline
        });
    }

    /**
     * Handle browser online/offline events
     * @private
     */
    handleOnlineStatusChange(isOnline) {
        const wasOnline = this.isOnline;
        this.isOnline = isOnline;

        logger.info('Network status changed', {
            from: wasOnline ? 'online' : 'offline',
            to: isOnline ? 'online' : 'offline'
        });

        if (isOnline && !wasOnline) {
            // Just came back online - check backend immediately
            this.checkBackendHealth();
        } else if (!isOnline) {
            // Went offline - enter degraded mode
            this.setDegraded(true, 'Network connection lost');
        }

        this.notifyListeners();
    }

    /**
     * Mark backend as available or unavailable
     * @param {boolean} available - Whether backend is available
     * @param {string} reason - Reason for unavailability (optional)
     */
    setBackendAvailable(available, reason = null) {
        const wasAvailable = this.isBackendAvailable;
        this.isBackendAvailable = available;

        if (available && !wasAvailable) {
            logger.success('Backend connection restored');
            this.lastSuccessfulConnection = Date.now();
            this.setDegraded(false);
            this.resetHealthCheckInterval();
        } else if (!available && wasAvailable) {
            logger.warn('Backend connection lost', { reason });
            this.setDegraded(true, reason || 'Backend unavailable');
            this.startHealthCheckInterval();
        }

        if (available) {
            this.lastSuccessfulConnection = Date.now();
        }

        this.notifyListeners();
    }

    /**
     * Set degraded mode state
     * @param {boolean} degraded - Whether in degraded mode
     * @param {string} reason - Reason for degraded mode
     */
    setDegraded(degraded, reason = null) {
        const wasDegraded = this.isDegraded;
        this.isDegraded = degraded;
        this.degradedReason = reason;

        if (degraded && !wasDegraded) {
            logger.warn('Entering degraded mode', { reason });
        } else if (!degraded && wasDegraded) {
            logger.success('Exiting degraded mode');
        }

        this.notifyListeners();
    }

    /**
     * Check if backend is healthy
     * @returns {Promise<boolean>}
     */
    async checkBackendHealth() {
        if (!this.isOnline) {
            logger.debug('Skipping backend health check - no network');
            return false;
        }

        try {
            logger.debug('Checking backend health...');

            // Try to ping edge function with minimal request
            const edgeClient = window.sessionManager?.getEdgeClient();
            if (!edgeClient) {
                logger.warn('EdgeClient not available for health check');
                return false;
            }

            // Simple JWT validation attempt (lightweight check)
            const isHealthy = edgeClient.jwtToken && !edgeClient.isJWTExpired(1);

            if (isHealthy) {
                this.setBackendAvailable(true);
                return true;
            } else {
                logger.debug('Backend health check: no valid JWT');
                return false;
            }
        } catch (error) {
            logger.warn('Backend health check failed', error);
            this.setBackendAvailable(false, error.message);
            return false;
        }
    }

    /**
     * Start periodic health checks with exponential backoff
     * @private
     */
    startHealthCheckInterval() {
        if (this.healthCheckInterval) {
            return; // Already running
        }

        logger.info('Starting health check interval', {
            initialDelay: `${this.healthCheckDelay / 1000}s`
        });

        const scheduleNextCheck = () => {
            this.healthCheckInterval = setTimeout(async () => {
                const isHealthy = await this.checkBackendHealth();

                if (!isHealthy) {
                    // Increase delay with exponential backoff
                    this.healthCheckDelay = Math.min(
                        this.healthCheckDelay * this.healthCheckBackoffMultiplier,
                        this.maxHealthCheckDelay
                    );
                    logger.debug('Next health check in', {
                        delay: `${Math.round(this.healthCheckDelay / 1000)}s`
                    });
                    scheduleNextCheck();
                } else {
                    // Backend is back - stop checking
                    this.stopHealthCheckInterval();
                }
            }, this.healthCheckDelay);
        };

        scheduleNextCheck();
    }

    /**
     * Stop health check interval
     * @private
     */
    stopHealthCheckInterval() {
        if (this.healthCheckInterval) {
            clearTimeout(this.healthCheckInterval);
            this.healthCheckInterval = null;
            logger.debug('Health check interval stopped');
        }
    }

    /**
     * Reset health check interval to initial delay
     * @private
     */
    resetHealthCheckInterval() {
        this.stopHealthCheckInterval();
        this.healthCheckDelay = 30000; // Reset to 30 seconds
    }

    /**
     * Register a listener for status changes
     * @param {Function} callback - Called when status changes
     * @returns {Function} Unsubscribe function
     */
    addListener(callback) {
        this.listeners.add(callback);

        // Call immediately with current status
        callback(this.getStatus());

        return () => {
            this.listeners.delete(callback);
        };
    }

    /**
     * Notify all listeners of status change
     * @private
     */
    notifyListeners() {
        const status = this.getStatus();
        this.listeners.forEach(callback => {
            try {
                callback(status);
            } catch (error) {
                logger.error('Error in status listener', error);
            }
        });
    }

    /**
     * Get current connection status
     * @returns {object} Status object
     */
    getStatus() {
        return {
            isOnline: this.isOnline,
            isBackendAvailable: this.isBackendAvailable,
            isDegraded: this.isDegraded,
            degradedReason: this.degradedReason,
            lastSuccessfulConnection: this.lastSuccessfulConnection,
            timeSinceLastConnection: Date.now() - this.lastSuccessfulConnection
        };
    }

    /**
     * Check if system is fully operational
     * @returns {boolean}
     */
    isFullyOperational() {
        return this.isOnline && this.isBackendAvailable && !this.isDegraded;
    }

    /**
     * Check if offline mode should be active
     * @returns {boolean}
     */
    isOfflineMode() {
        return !this.isOnline || !this.isBackendAvailable || this.isDegraded;
    }

    /**
     * Enable test mode to simulate offline/degraded conditions
     * @param {string} type - Type of simulation ('offline', 'slow', 'degraded')
     */
    enableTestMode(type = 'offline') {
        this.testMode = true;
        this.testModeType = type;

        logger.warn('⚠️ TEST MODE ENABLED', { type });

        if (type === 'offline') {
            // Simulate complete internet outage
            this.isOnline = false;
            this.isBackendAvailable = false;
            this.setDegraded(true, 'TEST MODE: Simulating offline');
        } else if (type === 'slow') {
            // Simulate slow connection
            this.isOnline = true;
            this.isBackendAvailable = true;
            this.setDegraded(true, 'TEST MODE: Simulating slow connection');
        } else if (type === 'degraded') {
            // Simulate degraded backend
            this.isOnline = true;
            this.isBackendAvailable = false;
            this.setDegraded(true, 'TEST MODE: Simulating backend unavailable');
        }

        this.notifyListeners();
    }

    /**
     * Disable test mode and restore normal operation
     */
    disableTestMode() {
        if (!this.testMode) {
            logger.debug('Test mode not active');
            return;
        }

        this.testMode = false;
        this.testModeType = null;

        logger.success('✅ TEST MODE DISABLED - Restored normal operation');

        // Restore actual connection state
        this.isOnline = navigator.onLine;
        this.isBackendAvailable = true;
        this.setDegraded(false);

        this.notifyListeners();
    }

    /**
     * Check if currently in test mode
     * @returns {boolean}
     */
    isTestMode() {
        return this.testMode;
    }

    /**
     * Intercept API calls when in test mode
     * Call this before making API requests to simulate failures
     * @returns {boolean} True if API call should proceed, false if blocked
     */
    shouldAllowAPICall() {
        if (!this.testMode) {
            return true; // Normal operation
        }

        if (this.testModeType === 'offline') {
            logger.debug('🚫 API call blocked by test mode (offline simulation)');
            return false;
        }

        if (this.testModeType === 'slow') {
            // Allow call but log it
            logger.debug('🐌 API call allowed but simulating slow connection');
            return true;
        }

        if (this.testModeType === 'degraded') {
            logger.debug('🚫 API call blocked by test mode (degraded backend simulation)');
            return false;
        }

        return true;
    }
}

// Export singleton instance
export const connectionStatus = new ConnectionStatus();
