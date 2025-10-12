// js/apis/api-auth/providers/device-flow.js - Clean Device Flow Implementation
// v1.9 - 10/11/25 6:25pm - Compressed spacing, orange code, single-line status
// v1.8 - 10/11/25 6:15pm - QR code points to google.com/device only, restructured layout, larger code
// v1.7 - 10/11/25 6:00pm - Registered with modal manager, UI tweaks (larger logo, black text, normal font)
// v1.6 - 10/11/25 5:30pm - Added Fire TV back button support (keyCode 4) for cancel/escape
// v1.5 - 10/11/25 5:15pm - UI polish: larger logo, black arrow, 2-line QR instructions, uppercase code
// v1.4 - 10/11/25 4:40pm - Final polish: icon logo, orange URL/code, fixed cancel error message
// v1.3 - 10/11/25 4:30pm - Compact design, simplified code styling, fixed cancel to return to login
// v1.2 - 10/11/25 4:15pm - Fixed sizing, QR code rendering, correct orange color (#EE9828)
// v1.1 - 10/11/25 4:00pm - Redesigned UI with QR code, d-pad navigation, and new layout
// CHANGE SUMMARY: Added token queuing for Supabase storage (_queueRefreshTokensForStorage method and call in startPolling)

import { createLogger } from '../../../utils/logger.js';
import { AUTH_CONFIG } from '../../../auth/auth-config.js';
import { createModalNavigation } from '../../../utils/modal-navigation-manager.js';

const logger = createLogger('DeviceFlowAuth');

/**
 * Device Flow OAuth provider for TV and limited input devices
 * Implements Google OAuth Device Flow for Fire TV, Android TV, etc.
 */
export class DeviceFlowProvider {
  constructor() {
    this.config = {
      client_id: '221142210647-m9vf7t0qgm6nlc6gggfsqefmjrak1mo9.apps.googleusercontent.com',
      client_secret: AUTH_CONFIG.client_secret_device_flow,
      device_code_endpoint: 'https://oauth2.googleapis.com/device/code',
      token_endpoint: 'https://oauth2.googleapis.com/token',
      scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly'
    };
    
    this.isQRCodeScriptLoading = false; 
    this.pollInterval = null;
    this.countdownInterval = null;
    this.currentTokens = null;
    this.modalNavigation = null; // Store modal navigation reference for cleanup
    
    logger.debug('Device Flow provider initialized', {
      clientId: this.config.client_id,
      scopes: this.config.scope
    });
  }

  /**
   * Start the device flow authentication process
   * @returns {Promise<Object>} Auth result object
   */
  async signIn() {
    logger.auth('device', 'sign_in_start', 'pending');
    
    try {
      // Step 1: Get device code and user code
      const deviceData = await this.getDeviceCode();
      
      // Step 2: Show UI and start polling simultaneously
      const result = await this.showUIAndPoll(deviceData);
      
      logger.auth('device', 'sign_in_complete', 'success', {
        userId: result.user?.id,
        userEmail: result.user?.email
      });
      
      return result;
      
    } catch (error) {
      logger.auth('device', 'sign_in_complete', 'error', error.message);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Get device code and user code from Google
   * @returns {Promise<Object>} Device code response
   */
  async getDeviceCode() {
    logger.debug('Requesting device code from Google');
    
    const timer = logger.startTimer('Device Code Request');
    
    try {
      const response = await fetch(this.config.device_code_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.client_id,
          scope: this.config.scope
        })
      });

      const duration = timer();

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Device code request failed: ${response.status} ${errorText}`);
      }

      const deviceData = await response.json();
      
      logger.success('Device code received', {
        userCode: deviceData.user_code,
        verificationUri: deviceData.verification_uri,
        expiresIn: deviceData.expires_in,
        interval: deviceData.interval,
        duration
      });

      return deviceData;
      
    } catch (error) {
      timer();
      logger.error('Failed to get device code', error);
      throw error;
    }
  }

  /**
   * Show device flow UI and start polling for tokens
   * @param {Object} deviceData - Device code response data
   * @returns {Promise<Object>} Auth result
   */
  async showUIAndPoll(deviceData) {
    return new Promise((resolve, reject) => {
      // Create and show UI
      const overlay = this.createDeviceCodeOverlay(deviceData);
      document.body.appendChild(overlay);
      
      // Start polling for tokens
      this.startPolling(deviceData, resolve, reject, overlay);
    });
  }

  /**
 * Create the device flow UI overlay
 * @param {Object} deviceData - Device code response data
 * @returns {HTMLElement} UI overlay element
 */
createDeviceCodeOverlay(deviceData) {
  // Remove any previous overlay first
  const existingOverlay = document.getElementById('device-flow-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Create new overlay
  const overlay = document.createElement('div');
  overlay.id = 'device-flow-overlay';

  const verificationUrl = deviceData.verification_uri || 'https://www.google.com/device';
  const userCode = deviceData.user_code;
  const qrCodeUrl = verificationUrl; // QR code just points to google.com/device

  overlay.innerHTML = `
    <div class="device-flow-modal">
      <div class="logo-connection">
        <!-- logos and arrow here -->
      </div>
      <h2 class="sign-in-heading">Sign in to Dashie with Google</h2>
      <div class="qr-wrapper">
        <div id="qr-code-container">
          <div class="qr-inner-wrapper"></div>
        </div>
        <p class="qr-instruction">or go to <span class="device-url">google.com/device</span></p>
      </div>
      <div class="code-entry">
        <p class="code-label">and enter this code:</p>
        <p class="user-code">${userCode.toUpperCase()}</p>
      </div>
      <div class="device-flow-status">
        <div class="status-text">Waiting for sign-in (Expires in <span id="countdown-timer">${Math.floor(deviceData.expires_in / 60)}</span> min)</div>
      </div>
      <button id="cancel-device-flow" class="cancel-btn" tabindex="0">Cancel</button>
    </div>
  `;

  this.addDeviceFlowStyles();

  // QR code generation scoped to this overlay
  const qrContainer = overlay.querySelector('.qr-inner-wrapper');
  this.generateQRCode(qrContainer, qrCodeUrl);

  // Cancel button handling
  const cancelBtn = overlay.querySelector('#cancel-device-flow');
  this.cancelHandler = () => {
    logger.info('🚫 Device flow cancelled by user');
    this.cleanup(overlay);
    setTimeout(() => window.location.reload(), 100);
  };
  cancelBtn.addEventListener('click', this.cancelHandler);
  cancelBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) this.cancelHandler();
  });

  // Modal navigation registration
  this.modalNavigation = createModalNavigation(overlay, ['cancel-device-flow'], {
    initialFocus: 0,
    onEscape: this.cancelHandler
  });

  setTimeout(() => cancelBtn.focus(), 200);

  // Start countdown
  this.startCountdownTimer(deviceData.expires_in);

  return overlay;
}

/**
* Generate QR code on a specific container
* @param {HTMLElement} container - QR container inside the overlay
* @param {string} url - URL to encode in QR code
*/
generateQRCode(container, url) {
  if (!container) {
   logger.warn('QR code container not found');
    return;
  }

  if (container.querySelector('canvas')) return; // Already generated

  // Clear container
  container.innerHTML = '';

  const createInstance = () => {
    
    // Reset the STATIC flag once creation starts (either success or failure)
    if (DeviceFlowProvider.isQRCodeScriptLoading) {
        DeviceFlowProvider.isQRCodeScriptLoading = false; 
    }
    
    try {
        // 👇 RESTORED: Your original QR code creation logic
      new QRCode(container, {
        text: url,
        width: 120,
        height: 120,
        colorDark: '#EE9828',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
      logger.debug('QR code generated', { url });
    } catch (error) {
      logger.error('Error generating QR code', error);
      container.innerHTML = '<p style="color: #999; font-size: 14px;">Failed to generate QR code</p>';
    }
  };

  // Load QRCode library if not present
  if (typeof QRCode === 'undefined') {

    // Check the STATIC flag to prevent multiple script tags
    if (DeviceFlowProvider.isQRCodeScriptLoading) {
        return; 
    }

    // Set the STATIC flag
    DeviceFlowProvider.isQRCodeScriptLoading = true; 

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    script.onload = createInstance;
    
    script.onerror = () => {
        // Reset the STATIC flag on error
        DeviceFlowProvider.isQRCodeScriptLoading = false;
      logger.error('Failed to load QR code library');
      container.innerHTML = '<p style="color: #999; font-size: 14px;">QR code unavailable</p>';
    };
    document.head.appendChild(script);
  } else {
    createInstance();
  }
}


  /**
   * Create QR code instance
   * @param {HTMLElement} container - Container element
   * @param {string} url - URL to encode
   */
  createQRCodeInstance(container, url) {
    try {
      new QRCode(container, {
        text: url,
        width: 120,
        height: 120,
        colorDark: '#EE9828',  // Dashie orange
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
      logger.debug('QR code generated', { url });
    } catch (error) {
      logger.error('Error generating QR code', error);
      container.innerHTML = '<p style="color: #999; font-size: 14px;">Failed to generate QR code</p>';
    }
  }

  /**
   * Start polling Google for tokens
   * @param {Object} deviceData - Device code response data
   * @param {Function} resolve - Promise resolve function
   * @param {Function} reject - Promise reject function
   * @param {HTMLElement} overlay - UI overlay element
   */
  startPolling(deviceData, resolve, reject, overlay) {
    const deviceCode = deviceData.device_code;
    let interval = deviceData.interval || 5; // seconds
    const maxAttempts = Math.floor(deviceData.expires_in / interval);
    let attempts = 0;
    
    // Store reject function for cancel handling
    this.currentReject = reject;

    const poll = async () => {
      attempts++;

      if (attempts > maxAttempts) {
        logger.auth('device', 'polling_timeout', 'error');
        this.cleanup(overlay);
        reject(new Error('Device flow timeout - please try again'));
        return;
      }

      try {
        logger.debug(`Polling attempt ${attempts}/${maxAttempts}`);
        
        // Request tokens
        let tokenResponse = await this.requestTokens(deviceCode, true); // first try with client_secret
        
        // If Google complains about client_secret, retry without it
        if (tokenResponse.error === 'invalid_request' && tokenResponse.error_description?.includes('client_secret')) {
          logger.debug('Retrying token request without client_secret...');
          tokenResponse = await this.requestTokens(deviceCode, false); // retry without client_secret
        }

        if (tokenResponse.success) {
          // Got access token
          const tokens = tokenResponse.tokens;
          this.currentTokens = tokens;

          // Get user info
          const userInfo = await this.fetchUserInfo(tokens.access_token);

          // **NEW: Queue refresh tokens for deferred storage during startup**
          this._queueRefreshTokensForStorage(userInfo, tokens);

          const result = {
            success: true,
            user: {
              id: userInfo.id,
              name: userInfo.name,
              email: userInfo.email,
              picture: userInfo.picture,
              authMethod: 'device_flow',
              googleAccessToken: tokens.access_token
            },
            tokens
          };

          this.cleanup(overlay);
          resolve(result);
          return;
        }

        // Handle pending or slow_down
        if (tokenResponse.pending) {
          logger.debug('Authorization still pending, will retry...');
        } else if (tokenResponse.slowDown) {
          interval += 5;
          logger.debug(`Server requested slow down, next poll in ${interval}s`);
        }

        // Schedule next poll
        this.pollInterval = setTimeout(poll, interval * 1000);

      } catch (error) {
        logger.error(`Polling attempt ${attempts} failed`, error);
        this.pollInterval = setTimeout(poll, interval * 1000);
      }
    };

    poll();
  }

  /**
   * Queue refresh tokens for storage during the startup sequence
   * @private
   * @param {Object} userInfo - User information from Google
   * @param {Object} tokens - Token data from OAuth
   */
  _queueRefreshTokensForStorage(userInfo, tokens) {
    try {
      // Only proceed if we have a refresh token
      if (!tokens.refresh_token) {
        logger.warn('No refresh token received - user may need to reauthorize');
        return;
      }

      // Initialize the queue if it doesn't exist
      if (!window.pendingRefreshTokens) {
        window.pendingRefreshTokens = [];
      }

      // Prepare token data for storage
      const tokenData = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_in 
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : new Date(Date.now() + 3600 * 1000).toISOString(),
        expires_in: tokens.expires_in || 3600,
        scope: this.config.scope,
        display_name: `${userInfo.name} (Personal)`,
        email: userInfo.email,
        user_id: userInfo.id,
        issued_at: Date.now(),
        provider_info: {
          type: 'device_flow',
          client_id: this.config.client_id
        }
      };

      // v1.10 - 10/12/25 11:50pm - CRITICAL FIX: Use 'primary' not 'personal' for account type
      const accountType = 'primary';

      // Queue for processing during startup sequence
      const queuedToken = {
        provider: 'google',
        accountType,
        tokenData,
        userInfo: {
          email: userInfo.email,
          name: userInfo.name,
          id: userInfo.id
        },
        timestamp: Date.now()
      };

      window.pendingRefreshTokens.push(queuedToken);

      logger.success('🔄 Refresh tokens queued for storage during startup', {
        provider: 'google',
        accountType,
        userEmail: userInfo.email,
        scopeCount: this.config.scope.split(' ').length,
        queueSize: window.pendingRefreshTokens.length
      });

    } catch (error) {
      logger.error('Failed to queue refresh tokens:', error);
      // Don't throw - auth should still succeed even if token queuing fails
    }
  }

  /**
   * Request tokens from Google using device code
   * @param {string} deviceCode - Device code from initial request
   * @param {boolean} useClientSecret - Whether to include client_secret
   * @returns {Promise<Object>} Token request result
   */
  async requestTokens(deviceCode, useClientSecret = true) {
    try {
      const bodyParams = {
        client_id: this.config.client_id,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      };
      if (useClientSecret && this.config.client_secret) {
        bodyParams.client_secret = this.config.client_secret;
      }

      const response = await fetch(this.config.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(bodyParams)
      });

      const data = await response.json();

      if (response.ok && data.access_token) {
        return { success: true, tokens: data };
      }

      // Handle pending / slow_down
      if (data.error === 'authorization_pending') return { success: false, pending: true };
      if (data.error === 'slow_down') return { success: false, slowDown: true };

      return { success: false, error: data.error, error_description: data.error_description };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch user info from Google
   * @param {string} accessToken - Google access token
   * @returns {Promise<Object>} User information
   */
  async fetchUserInfo(accessToken) {
    logger.debug('Fetching user info from Google');
    
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Google API error: ${response.status} ${response.statusText}`);
      }

      const userInfo = await response.json();
      
      logger.success('User info retrieved', {
        userId: userInfo.id,
        userName: userInfo.name,
        userEmail: userInfo.email
      });

      return userInfo;
      
    } catch (error) {
      logger.error('Failed to fetch user info', error);
      throw error;
    }
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
        logger.auth('device', 'code_expired', 'error');
      }
    }, 1000);
  }

  /**
   * Add device flow CSS styles
   */
  addDeviceFlowStyles() {
    if (document.getElementById('device-flow-styles')) return;

    const style = document.createElement('style');
    style.id = 'device-flow-styles';
    style.textContent = `
      #device-flow-overlay {
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
      
      /* Logo Connection Row */
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
      
      /* Heading */
      .sign-in-heading {
        margin: 0 0 10px 0;
        color: #1a1a1a;
        font-size: 18px;
        font-weight: 600;
      }
      
     /* QR Code */
    .qr-wrapper {
      display: flex;
      flex-direction: column;     /* Stack the QR and text vertically */
      align-items: center;        /* Center horizontally */
      justify-content: center;
      margin: 0 auto 8px;
      text-align: center;
    }

    #qr-code-container {
      display: flex;              /* keep flex */
      align-items: center;
      justify-content: center;
      padding: 8px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      margin-bottom: 6px;
      box-sizing: border-box;
      flex-direction: column;     /* ensure vertical stacking if anything else added */
    }


    #qr-code-container img,
    #qr-code-container canvas {
      display: block !important;
      width: 120px !important;
      height: 120px !important;
    }

    .qr-inner-wrapper {
      width: 120px;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

      
      .qr-instruction {
        margin: 6px 0 0 0;
        color: #555;
        font-size: 13px;
        line-height: 1.4;
      }
      
      /* Code Entry Section */
      .code-entry {
        margin: 10px 0;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 8px;
      }
      
      .code-label {
        margin: 0 0 6px 0;
        color: #555;
        font-size: 13px;
        line-height: 1.4;
      }
      
      .device-url {
        color: #1a1a1a;
        font-size: 15px;
        font-weight: 700;
      }
      
      .user-code {
        margin: 0;
        font-weight: 700;
        color: #EE9828;
        font-size: 25px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      
      /* Status */
      .device-flow-status {
        margin: 10px 0 8px 0;
      }
      
      .status-text {
        font-size: 12px;
        color: #666;
      }
      
      /* Cancel Button */
      .cancel-btn {
        padding: 8px 28px;
        border: 2px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        background: #fff;
        color: #666;
        outline: none;
        margin-top: 6px;
      }
      
      .cancel-btn:hover {
        background: #f5f5f5;
        border-color: #ccc;
      }
      
      .cancel-btn:focus {
        border-color: #EE9828;
        box-shadow: 0 0 0 3px rgba(238, 152, 40, 0.2);
        background: #fff;
        color: #333;
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
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }
    
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    
    // Unregister from modal navigation manager
    if (this.modalNavigation) {
      logger.debug('Unregistering device flow from modal manager');
      this.modalNavigation.destroy();
      this.modalNavigation = null;
    }
    
    // Clear reject handler
    this.currentReject = null;
    this.cancelHandler = null;
    
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    
    logger.debug('Device flow cleanup completed');
  }

  /**
   * Sign out and clear tokens
   */
  signOut() {
    logger.auth('device', 'sign_out', 'pending');
    
    try {
      this.currentTokens = null;
      this.cleanup();
      
      logger.auth('device', 'sign_out', 'success');
      
    } catch (error) {
      logger.auth('device', 'sign_out', 'error', error.message);
    }
  }

  /**
   * Get current access token
   * @returns {string|null} Current access token
   */
  getAccessToken() {
    return this.currentTokens?.access_token || null;
  }

  /**
   * Get current refresh token
   * @returns {string|null} Current refresh token
   */
  getRefreshToken() {
    return this.currentTokens?.refresh_token || null;
  }

  /**
   * Check if provider has valid tokens
   * @returns {boolean} True if tokens are valid
   */
  hasValidTokens() {
    return !!this.currentTokens?.access_token;
  }

  /**
   * Get provider information
   * @returns {Object} Provider info
   */
  getProviderInfo() {
    return {
      name: 'device_flow',
      type: 'oauth2_device',
      supportsRefreshTokens: true,
      hasTokens: !!this.currentTokens
    };
  }
}