// js/data/auth/providers/hybrid-device-auth.js
// Phase 5.5 - Hybrid Device Flow for Fire TV
// Custom device flow that links Fire TV to phone authentication

import { createLogger } from '../../../utils/logger.js';
import { SUPABASE_CONFIG } from '../auth-config.js';

const logger = createLogger('HybridDeviceAuth');

// Supabase config - anon key is SAFE in client code (public by design)
const EDGE_FUNCTION_URL = SUPABASE_CONFIG.edgeFunctionUrl;
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey;

/**
 * HybridDeviceAuth - Custom device flow for Fire TV
 *
 * Flow:
 * 1. Fire TV requests device code from backend
 * 2. Display QR code and user code on TV
 * 3. User scans QR with phone, signs in with Google
 * 4. Phone authorizes device code
 * 5. Fire TV polls backend, receives JWT
 * 6. Both devices authenticated with separate JWTs, same OAuth tokens
 */
export class HybridDeviceAuth {
  static isQRCodeScriptLoading = false;

  constructor() {
    this.isInitialized = false;
    this.pollingInterval = null;
    this.timerInterval = null;
    this.countdownInterval = null;
    this.deviceCode = null;
    this.currentReject = null;
    this.cancelHandler = null;

    logger.debug('Hybrid Device Auth initialized');
  }

  /**
   * Initialize the provider
   * @returns {Promise<Object|null>} Always returns null (no callback handling)
   */
  async init() {
    logger.info('Initializing Hybrid Device Auth provider');
    this.isInitialized = true;
    logger.success('Hybrid Device Auth provider initialized successfully');
    return null;
  }

  /**
   * Main sign-in flow
   * @returns {Promise<Object>} Auth result with user and jwtToken
   */
  async signIn() {
    if (!this.isInitialized) {
      await this.init();
    }

    logger.info('Starting Hybrid Device Auth sign-in');

    try {
      // Step 1: Create device code
      const deviceData = await this.createDeviceCode();
      this.deviceCode = deviceData.device_code;

      // Step 2: Show UI and start polling
      const result = await this.showUIAndPoll(deviceData);

      logger.success('Hybrid Device Auth sign-in complete', {
        userEmail: result.user?.email
      });

      return result;

    } catch (error) {
      logger.error('Hybrid Device Auth sign-in failed', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Request device code from backend
   * @returns {Promise<Object>} Device code data
   */
  async createDeviceCode() {
    logger.debug('Requesting device code from backend');

    try {
      // Get base URL for verification link (supports localhost and production)
      const baseUrl = window.location.origin;

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`  // Unauthenticated operation
        },
        body: JSON.stringify({
          operation: 'create_device_code',
          data: {
            device_type: 'firetv',
            base_url: baseUrl,  // Pass current origin for verification URL
            device_info: {
              model: this.getDeviceModel(),
              os_version: navigator.userAgent,
              app_version: '0.3.0'
            }
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Device code request failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create device code');
      }

      logger.success('Device code created', {
        userCode: data.user_code,
        verificationUrl: data.verification_url,
        expiresIn: data.expires_in
      });

      return {
        device_code: data.device_code,
        user_code: data.user_code,
        verification_url: data.verification_url,
        expires_in: data.expires_in,
        interval: data.interval || 5
      };

    } catch (error) {
      logger.error('Failed to create device code', error);
      throw error;
    }
  }

  /**
   * Display QR code and user code, start polling
   * @param {Object} deviceData - Device code data
   * @returns {Promise<Object>} Auth result
   */
  async showUIAndPoll(deviceData) {
    return new Promise((resolve, reject) => {
      // Create and show UI
      const overlay = this.createDeviceCodeOverlay(deviceData);
      document.body.appendChild(overlay);

      // Start polling for authorization
      this.startPolling(deviceData, resolve, reject, overlay);
    });
  }

  /**
   * Create the device code UI overlay
   * @param {Object} deviceData - Device code data
   * @returns {HTMLElement} UI overlay element
   */
  createDeviceCodeOverlay(deviceData) {
    // Remove any previous overlay
    const existingOverlay = document.getElementById('hybrid-device-flow-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'hybrid-device-flow-overlay';

    const verificationUrl = deviceData.verification_url;
    const userCode = deviceData.user_code;

    overlay.innerHTML = `
      <div class="device-flow-modal">
        <div class="logo-connection">
          <img src="https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png" alt="Google" class="google-logo">
          <div class="connection-arrow">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12h14M12 5l7 7-7 7" stroke="#EE9828" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <img src="./artwork/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie" class="dashie-logo-small">
        </div>

        <h2 class="sign-in-heading">Sign in to Dashie with Google</h2>

        <div class="qr-wrapper">
          <div id="qr-code-container">
            <div class="qr-inner-wrapper"></div>
          </div>
          <p class="qr-instruction">or go to <span class="device-url">dashieapp.com/auth</span></p>
        </div>

        <div class="code-entry">
          <p class="code-label">and enter this code:</p>
          <p class="user-code">${userCode.toUpperCase()}</p>
        </div>

        <div class="device-flow-status">
          <div class="status-text">Waiting for sign-in (Expires in <span id="countdown-timer">${Math.floor(deviceData.expires_in / 60)}</span> min)</div>
        </div>

        <button id="cancel-device-flow" class="cancel-btn" tabindex="1">Cancel</button>
      </div>
    `;

    this.addDeviceFlowStyles();

    // Generate QR code
    const qrContainer = overlay.querySelector('.qr-inner-wrapper');
    this.generateQRCode(qrContainer, verificationUrl);

    // Cancel button handling
    const cancelBtn = overlay.querySelector('#cancel-device-flow');
    this.cancelHandler = () => {
      logger.info('Device flow cancelled by user');
      this.cleanup(overlay);
      if (this.currentReject) {
        this.currentReject(new Error('Authentication cancelled by user'));
      }
    };
    cancelBtn.addEventListener('click', this.cancelHandler);

    // Add keyboard/D-pad handler for cancel button
    cancelBtn.addEventListener('keydown', (e) => {
      logger.debug('Cancel button keydown', { keyCode: e.keyCode, key: e.key });
      if (e.keyCode === 13 || e.keyCode === 23 || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        this.cancelHandler();
      }
    });

    // Focus cancel button with orange highlight
    setTimeout(() => {
      cancelBtn.focus();
      logger.debug('Auto-focused cancel button');
    }, 200);

    // Start countdown timer
    this.startCountdownTimer(deviceData.expires_in);

    return overlay;
  }

  /**
   * Generate QR code
   * @param {HTMLElement} container - QR container
   * @param {string} url - URL to encode
   */
  generateQRCode(container, url) {
    if (!container) {
      logger.warn('QR code container not found');
      return;
    }

    const createInstance = () => {
      try {
        new QRCode(container, {
          text: url,
          width: 120,
          height: 120,
          colorDark: '#EE9828',  // Dashie orange
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });

        // Remove any img fallback
        container.querySelectorAll('img').forEach(el => el.remove());

        logger.debug('QR code generated');
      } catch (error) {
        logger.error('Error generating QR code', error);
        container.innerHTML = '<p style="color: #999; font-size: 14px;">QR code unavailable</p>';
      }
    };

    // Load QRCode library if needed
    if (typeof QRCode === 'undefined') {
      if (HybridDeviceAuth.isQRCodeScriptLoading) {
        logger.debug('QRCode library already loading, waiting...');
        const checkInterval = setInterval(() => {
          if (typeof QRCode !== 'undefined') {
            clearInterval(checkInterval);
            createInstance();
          }
        }, 50);
        return;
      }

      HybridDeviceAuth.isQRCodeScriptLoading = true;

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.onload = () => {
        HybridDeviceAuth.isQRCodeScriptLoading = false;
        createInstance();
      };
      script.onerror = () => {
        HybridDeviceAuth.isQRCodeScriptLoading = false;
        logger.error('Failed to load QR code library');
        container.innerHTML = '<p style="color: #999; font-size: 14px;">QR code unavailable</p>';
      };
      document.head.appendChild(script);
    } else {
      createInstance();
    }
  }

  /**
   * Start polling backend for authorization
   * @param {Object} deviceData - Device code data
   * @param {Function} resolve - Promise resolve function
   * @param {Function} reject - Promise reject function
   * @param {HTMLElement} overlay - UI overlay element
   */
  startPolling(deviceData, resolve, reject, overlay) {
    const deviceCode = deviceData.device_code;
    let interval = deviceData.interval || 5; // seconds
    const maxAttempts = Math.floor(deviceData.expires_in / interval);
    let attempts = 0;

    this.currentReject = reject;

    const poll = async () => {
      attempts++;

      if (attempts > maxAttempts) {
        logger.error('Device flow polling timeout');
        this.cleanup(overlay);
        reject(new Error('Device flow timeout - please try again'));
        return;
      }

      try {
        logger.debug(`Polling attempt ${attempts}/${maxAttempts}`, {
          deviceCode: deviceCode.substring(0, 16) + '...',
          interval
        });

        // Poll device code status via edge function
        const response = await fetch(EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`  // Unauthenticated operation
          },
          body: JSON.stringify({
            operation: 'poll_device_code_status',
            data: { device_code: deviceCode }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.warn(`Poll response not OK: ${response.status}`, { errorText });
          // Continue polling - don't fail on HTTP errors
          this.pollingInterval = setTimeout(poll, interval * 1000);
          return;
        }

        const data = await response.json();
        logger.debug('Poll response', { status: data.status, success: data.success });

        // Check if authorized (success = true)
        if (data.success && data.status === 'authorized') {
          // Got JWT!
          logger.success('Device authorized - received JWT', {
            userEmail: data.user?.email
          });

          const result = {
            success: true,
            user: {
              id: data.user.id,
              email: data.user.email,
              name: data.user.name || data.user.email,
              picture: data.user.picture,
              authMethod: 'hybrid_device_flow',
              provider: 'google'
            },
            jwtToken: data.jwtToken
          };

          this.cleanup(overlay);
          resolve(result);
          return;
        }

        // Handle expired
        if (data.status === 'expired_token') {
          logger.error('Device code expired');
          this.cleanup(overlay);
          reject(new Error('Device code expired - please try again'));
          return;
        }

        // Still pending, continue polling
        if (data.status === 'authorization_pending') {
          logger.debug('Authorization still pending - continuing to poll');
        }

        // Schedule next poll
        this.pollingInterval = setTimeout(poll, interval * 1000);

      } catch (error) {
        logger.error(`Polling attempt ${attempts} failed`, error);
        // Continue polling on error (network blip)
        this.pollingInterval = setTimeout(poll, interval * 1000);
      }
    };

    // Start polling after a brief delay to ensure UI is rendered
    logger.info('Starting polling in 2 seconds...');
    this.pollingInterval = setTimeout(poll, 2000);
  }

  /**
   * Start countdown timer for code expiration
   * @param {number} expiresIn - Seconds until expiration
   */
  startCountdownTimer(expiresIn) {
    let remaining = expiresIn;

    this.countdownInterval = setInterval(() => {
      remaining -= 1;
      const minutes = Math.floor(remaining / 60);

      const timerElement = document.getElementById('countdown-timer');
      if (timerElement) {
        timerElement.textContent = minutes;
      }

      if (remaining <= 0) {
        clearInterval(this.countdownInterval);
        logger.info('Device code expired');
      }
    }, 1000);
  }

  /**
   * Add device flow CSS styles
   */
  addDeviceFlowStyles() {
    if (document.getElementById('hybrid-device-flow-styles')) return;

    const style = document.createElement('style');
    style.id = 'hybrid-device-flow-styles';
    style.textContent = `
      #hybrid-device-flow-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .device-flow-modal {
        background: #FCFCFF;
        border-radius: 12px;
        padding: 15px 25px;
        max-width: 380px;
        max-height: 90vh;
        overflow-y: auto;
        text-align: center;
        box-shadow: 0 25px 70px rgba(0, 0, 0, 0.5);
      }

      .logo-connection {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-bottom: 10px;
      }

      .google-logo {
        width: 32px;
        height: 32px;
      }

      .connection-arrow {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .connection-arrow svg {
        width: 24px;
        height: 24px;
        display: block;
      }

      .dashie-logo-small {
        height: 46px;
      }

      .sign-in-heading {
        margin: 0 0 10px 0;
        color: #1a1a1a;
        font-size: 18px;
        font-weight: 600;
      }

      .qr-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin: 0 auto 8px;
        text-align: center;
      }

      #qr-code-container {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px;
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        margin-bottom: 8px;
      }

      .qr-inner-wrapper {
        width: 120px;
        height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #qr-code-container img,
      #qr-code-container canvas {
        display: block !important;
        width: 120px !important;
        height: 120px !important;
      }

      .qr-instruction {
        color: #666;
        font-size: 12px;
        margin: 0;
      }

      .device-url {
        color: #EE9828;
        font-weight: 600;
      }

      .code-entry {
        background: #f5f5f5;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 12px 16px;
        margin: 12px 0;
      }

      .code-label {
        color: #666;
        font-size: 12px;
        margin: 0 0 6px 0;
      }

      .user-code {
        color: #EE9828;
        font-size: 28px;
        font-weight: 700;
        letter-spacing: 6px;
        margin: 0;
        font-family: 'Courier New', monospace;
      }

      .device-flow-status {
        margin: 12px 0;
      }

      .status-text {
        color: #666;
        font-size: 11px;
      }

      .cancel-btn {
        background: #f5f5f5;
        border: 1px solid #d0d0d0;
        color: #333;
        padding: 10px 28px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        margin-top: 8px;
      }

      .cancel-btn:hover {
        background: #e8e8e8;
        border-color: #b0b0b0;
      }

      .cancel-btn:focus {
        outline: 3px solid #ffaa00 !important;
        outline-offset: 2px;
        transform: scale(1.02) !important;
        box-shadow: 0 0 15px rgba(255, 170, 0, 0.5) !important;
      }

      .cancel-btn:active {
        transform: scale(0.98);
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Clean up UI and intervals
   * @param {HTMLElement} [overlay] - UI overlay to remove
   */
  cleanup(overlay) {
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.currentReject = null;
    this.cancelHandler = null;

    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }

    logger.debug('Hybrid device flow cleanup completed');
  }

  /**
   * Sign out and clear state
   */
  signOut() {
    logger.info('Signing out');
    try {
      this.cleanup();
      logger.success('Sign out complete');
    } catch (error) {
      logger.error('Error during sign out', error);
    }
  }

  /**
   * Get device model
   * @returns {string}
   */
  getDeviceModel() {
    const ua = navigator.userAgent;
    if (ua.includes('AFTMM')) return 'Fire TV Stick 4K';
    if (ua.includes('AFTT')) return 'Fire TV';
    if (ua.includes('AFTN')) return 'Fire TV Cube';
    return 'Unknown Fire TV';
  }

  /**
   * Get provider information
   * @returns {Object}
   */
  getProviderInfo() {
    return {
      name: 'hybrid_device_auth',
      type: 'custom_device_flow',
      supportsRefreshTokens: true,
      isInitialized: this.isInitialized,
      hasDeviceCode: !!this.deviceCode
    };
  }
}
