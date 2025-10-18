// ============================================================================
// HeartbeatService - Dashboard Status Tracking
// ============================================================================
// Sends periodic heartbeats to track:
// - Dashboard online/offline status
// - Version checking for auto-updates
// - User activity tracking
//
// Frequency configured in config.js (easy to adjust without code changes)
// ============================================================================

import { createLogger } from '../../utils/logger.js';
import {
  APP_VERSION,
  HEARTBEAT_FREQUENCY_MS,
  HEARTBEAT_VERSION_CHECK_ENABLED,
  HEARTBEAT_AUTO_UPDATE_PROMPT
} from '../../../config.js';

const logger = createLogger('HeartbeatService');

class HeartbeatService {
  constructor() {
    this.heartbeatInterval = null;
    this.heartbeatFrequency = HEARTBEAT_FREQUENCY_MS; // From config.js
    this.currentVersion = APP_VERSION;
    this.deviceFingerprint = null;
    this.isRunning = false;
    this.edgeClient = null;

    // Track failures for error handling
    this.consecutiveFailures = 0;
    this.maxConsecutiveFailures = 3;
  }

  /**
   * Initialize heartbeat service
   * @param {EdgeClient} edgeClient - EdgeClient instance for making authenticated requests
   */
  async initialize(edgeClient) {
    logger.info(`Initializing heartbeat service (frequency: ${this.heartbeatFrequency / 1000}s)...`);

    // Store EdgeClient reference
    this.edgeClient = edgeClient;

    if (!this.edgeClient) {
      logger.error('EdgeClient not provided, heartbeat service cannot start');
      return;
    }

    // Generate device fingerprint
    this.deviceFingerprint = await this.generateDeviceFingerprint();

    // Start heartbeat loop
    this.startHeartbeat();

    logger.success(`Heartbeat service initialized (every ${this.heartbeatFrequency / 1000} seconds)`);
  }

  /**
   * Generate unique device fingerprint (hashed for privacy)
   */
  async generateDeviceFingerprint() {
    const data = [
      navigator.userAgent,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
      navigator.hardwareConcurrency || 'unknown'
    ].join('|');

    // Hash for privacy
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Start sending heartbeats
   */
  startHeartbeat() {
    if (this.isRunning) {
      logger.warn('Heartbeat already running');
      return;
    }

    this.isRunning = true;

    // Send first heartbeat immediately
    this.sendHeartbeat();

    // Then send periodically
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatFrequency);

    logger.info(`Heartbeat started (every ${this.heartbeatFrequency / 1000}s)`);
  }

  /**
   * Send heartbeat to server
   */
  async sendHeartbeat() {
    try {
      // Check if we have EdgeClient and JWT token
      if (!this.edgeClient || !this.edgeClient.jwtToken) {
        logger.warn('No JWT token available, skipping heartbeat');
        return;
      }

      // Build heartbeat URL - heartbeat is at root level, not under /jwt-auth
      // EdgeClient's edgeFunctionUrl is: https://[project].supabase.co/functions/v1/jwt-auth
      // We need: https://[project].supabase.co/functions/v1/heartbeat
      const baseUrl = this.edgeClient.edgeFunctionUrl.replace('/jwt-auth', '');
      const heartbeatUrl = `${baseUrl}/heartbeat`;

      // Send heartbeat
      const response = await fetch(heartbeatUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.edgeClient.jwtToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          version: this.currentVersion,
          device_type: this.getDeviceType(),
          device_fingerprint: this.deviceFingerprint,
          user_agent: navigator.userAgent,
          dashboard_name: this.getDashboardName()
        })
      });

      if (!response.ok) {
        throw new Error(`Heartbeat failed: ${response.status}`);
      }

      const data = await response.json();

      // Reset failure counter on success
      this.consecutiveFailures = 0;

      // Check for version updates
      if (HEARTBEAT_VERSION_CHECK_ENABLED && data.needs_update) {
        logger.warn(`Update available: ${this.currentVersion} → ${data.latest_version}`);

        if (HEARTBEAT_AUTO_UPDATE_PROMPT) {
          this.handleUpdateAvailable(data.latest_version);
        }
      }

      // Log first heartbeat
      if (data.is_first_heartbeat) {
        logger.info('First heartbeat of session sent');
      }

    } catch (error) {
      this.consecutiveFailures++;
      logger.error(`Heartbeat error (${this.consecutiveFailures}/${this.maxConsecutiveFailures}):`, error);

      // Stop trying after too many failures (don't spam server)
      if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
        logger.error('Too many consecutive heartbeat failures, stopping heartbeat');
        this.stopHeartbeat();
      }
    }
  }

  /**
   * Get device type from user agent
   */
  getDeviceType() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('aftm') || ua.includes('aftb') || ua.includes('aftt')) {
      return 'fire_tv';
    }
    if (ua.includes('android') && ua.includes('tv')) {
      return 'android_tv';
    }
    if (ua.includes('android')) {
      return 'native_android';
    }
    return 'browser';
  }

  /**
   * Get dashboard name (user can customize this later)
   */
  getDashboardName() {
    // TODO: Allow user to set custom dashboard name in settings
    const deviceType = this.getDeviceType();
    switch (deviceType) {
      case 'fire_tv':
        return 'Fire TV Dashboard';
      case 'android_tv':
        return 'Android TV Dashboard';
      case 'native_android':
        return 'Android Dashboard';
      default:
        return 'Browser Dashboard';
    }
  }

  /**
   * Handle update available notification
   */
  handleUpdateAvailable(latestVersion) {
    // Only prompt once per session
    if (this.updatePromptShown) {
      return;
    }

    this.updatePromptShown = true;

    const shouldUpdate = confirm(
      `🎉 New version ${latestVersion} available!\n\n` +
      `You're running v${this.currentVersion}.\n\n` +
      `Update now? (Recommended)`
    );

    if (shouldUpdate) {
      this.performUpdate(latestVersion);
    } else {
      logger.info('User declined update');

      // Ask again in 1 hour
      setTimeout(() => {
        this.updatePromptShown = false;
      }, 60 * 60 * 1000);
    }
  }

  /**
   * Perform app update (reload with cache clear)
   */
  performUpdate(latestVersion) {
    logger.info(`Updating to version ${latestVersion}...`);

    // Stop heartbeat
    this.stopHeartbeat();

    // Show loading indicator
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100vh;
          font-size: 24px;
          font-family: system-ui, -apple-system, sans-serif;
          background: var(--bg-primary, #222);
          color: var(--text-primary, #fff);
        ">
          <div style="font-size: 48px; margin-bottom: 20px;">🔄</div>
          <div>Updating Dashie to v${latestVersion}...</div>
          <div style="font-size: 16px; opacity: 0.7; margin-top: 10px;">
            This will only take a moment
          </div>
        </div>
      `;
    }

    // Reload with cache clear after brief delay
    setTimeout(() => {
      // Force reload bypassing cache
      window.location.reload(true);
    }, 1500);
  }

  /**
   * Stop sending heartbeats
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      this.isRunning = false;
      logger.info('Heartbeat stopped');
    }
  }

  /**
   * Update heartbeat frequency (can be called at runtime)
   * @param {number} frequencyMs - New frequency in milliseconds
   */
  updateFrequency(frequencyMs) {
    logger.info(`Updating heartbeat frequency: ${this.heartbeatFrequency / 1000}s → ${frequencyMs / 1000}s`);

    this.heartbeatFrequency = frequencyMs;

    // Restart with new frequency
    if (this.isRunning) {
      this.stopHeartbeat();
      this.startHeartbeat();
    }
  }

  /**
   * Cleanup on shutdown
   */
  shutdown() {
    logger.info('HeartbeatService shutting down...');
    this.stopHeartbeat();
  }
}

// Export singleton instance
export default new HeartbeatService();
