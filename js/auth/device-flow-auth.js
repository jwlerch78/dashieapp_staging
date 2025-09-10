// js/auth/device-flow-auth.js - OAuth Device Flow for Fire TV (Enhanced Debug Version)

import { AUTH_CONFIG } from './config.js';

export class DeviceFlowAuth {
  constructor() {
    this.config = {
      // Use Fire TV client ID for Device Flow
      client_id: '221142210647-m9vf7t0qgm6nlc6gggfsqefmjrak1mo9.apps.googleusercontent.com',
      client_secret: AUTH_CONFIG.client_secret,
      device_code_endpoint: 'https://oauth2.googleapis.com/device/code',
      token_endpoint: 'https://oauth2.googleapis.com/token',
      scope: 'openid email profile'
    };
    this.pollInterval = null;
    this.countdownInterval = null;
  }

  // Start the device flow authentication
  async startDeviceFlow() {
    try {
      console.log('🔥 Starting OAuth Device Flow...');
      
      // Step 1: Get device code and user code
      const deviceData = await this.getDeviceCode();
      
      // Step 2: Show UI and start polling SIMULTANEOUSLY
      const result = await this.showUIAndPoll(deviceData);
      
      return result;
      
    } catch (error) {
      console.error('🔥 Device flow failed:', error);
      this.cleanup();
      throw error;
    }
  }

  // Step 1: Get device code from Google
  async getDeviceCode() {
    console.log('🔥 Requesting device code from Google...');
    
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

    console.log('🔥 Device code response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔥 Device code request failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Failed to get device code: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('🔥 Device code received successfully:', {
      user_code: data.user_code,
      verification_uri: data.verification_uri,
      verification_url: data.verification_url,
      expires_in: data.expires_in,
      interval: data.interval
    });

    return data;
  }

  // Step 2: Show UI and start polling concurrently
  async showUIAndPoll(deviceData) {
    return new Promise((resolve, reject) => {
      // Create and show the UI
      const overlay = this.createDeviceCodeOverlay(deviceData);
      document.body.appendChild(overlay);

      // Set up cancel handling
      this.setupDeviceCodeNavigation(overlay, () => {
        console.log('🔥 User cancelled - cleaning up');
        this.cleanup(overlay);
        resolve({ success: false, cancelled: true });
      });

      // Start countdown
      this.startCountdown(overlay, deviceData.expires_in);

      // START POLLING IMMEDIATELY - Don't wait for anything
      console.log('🔥 🚀 STARTING CONCURRENT POLLING');
      this.startPolling(deviceData.device_code, deviceData.interval, overlay, resolve, reject);
    });
  }

  // Step 3: Start polling immediately (runs concurrently with UI)
  startPolling(deviceCode, interval, overlay, resolve, reject) {
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max
    
    console.log('🔥 🚀 STARTING TOKEN POLLING');
    console.log('🔥 Device code:', deviceCode);
    console.log('🔥 Interval:', interval);
    console.log('🔥 Max attempts:', maxAttempts);
    
    const poll = async () => {
      try {
        attempts++;
        console.log(`🔥 📡 POLLING ATTEMPT ${attempts}/${maxAttempts}`);
        
        if (attempts > maxAttempts) {
          console.log('🔥 ❌ Polling timeout reached');
          this.cleanup(overlay);
          reject(new Error('Polling timeout - please try again'));
          return;
        }
        
        console.log('🔥 📤 Making token request...');
        
        const requestBody = new URLSearchParams({
          client_id: this.config.client_id,
          client_secret: this.config.client_secret,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          client_secret: '' // Try empty client_secret to see what Google expects
        });
        
        console.log('🔥 📤 Request body:', requestBody.toString());
        console.log('🔥 📤 Client ID being used:', this.config.client_id);
        console.log('🔥 📤 Device code length:', deviceCode.length);
        console.log('🔥 📤 Grant type:', 'urn:ietf:params:oauth:grant-type:device_code');
        
        const response = await fetch(this.config.token_endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: requestBody
        });
        
        console.log('🔥 📥 Token response status:', response.status);
        console.log('🔥 📥 Token response ok:', response.ok);
        console.log('🔥 📥 Token response headers:', Object.fromEntries(response.headers.entries()));
        
        const data = await response.json();
        console.log('🔥 📥 Token response data:', {
          hasAccessToken: !!data.access_token,
          error: data.error,
          errorDescription: data.error_description,
          fullResponse: data
        });
        
        if (response.ok && data.access_token) {
          // Success!
          console.log('🔥 ✅ ACCESS TOKEN RECEIVED! Authentication successful!');
          
          try {
            console.log('🔥 👤 Getting user info...');
            const userInfo = await this.getUserInfo(data.access_token);
            this.cleanup(overlay);
            resolve({
              success: true,
              user: userInfo,
              tokens: data
            });
            return;
          } catch (userError) {
            console.error('🔥 ❌ Failed to get user info:', userError);
            this.cleanup(overlay);
            reject(new Error('Failed to get user information'));
            return;
          }
          
        } else if (data.error === 'authorization_pending') {
          // Still waiting for user to authorize
          console.log('🔥 ⏳ Still waiting for authorization... scheduling next poll in', interval, 'seconds');
          this.pollInterval = setTimeout(poll, interval * 1000);
          
        } else if (data.error === 'slow_down') {
          // Increase polling interval
          const newInterval = interval + 5;
          console.log('🔥 🐌 Slowing down polling to', newInterval, 'seconds...');
          this.pollInterval = setTimeout(poll, newInterval * 1000);
          
        } else if (data.error === 'invalid_request' && data.error_description?.includes('client_secret')) {
          // Client secret error - try without it
          console.log('🔥 🔧 Retrying without client_secret parameter...');
          
          const retryBody = new URLSearchParams({
            client_id: this.config.client_id,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
          });
          
          console.log('🔥 📤 Retry request body (no client_secret):', retryBody.toString());
          
          const retryResponse = await fetch(this.config.token_endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: retryBody
          });
          
          const retryData = await retryResponse.json();
          console.log('🔥 📥 Retry response:', retryData);
          
          if (retryResponse.ok && retryData.access_token) {
            console.log('🔥 ✅ ACCESS TOKEN RECEIVED on retry!');
            try {
              const userInfo = await this.getUserInfo(retryData.access_token);
              this.cleanup(overlay);
              resolve({
                success: true,
                user: userInfo,
                tokens: retryData
              });
              return;
            } catch (userError) {
              console.error('🔥 ❌ Failed to get user info on retry:', userError);
              this.cleanup(overlay);
              reject(new Error('Failed to get user information'));
              return;
            }
          } else if (retryData.error === 'authorization_pending') {
            console.log('🔥 ⏳ Still pending on retry... continuing polling');
            this.pollInterval = setTimeout(poll, interval * 1000);
          } else {
            console.log('🔥 ❌ Retry also failed:', retryData);
            this.cleanup(overlay);
            reject(new Error(retryData.error_description || retryData.error || 'Authentication failed'));
          }
          
        } else {
          // Other error
          console.log('🔥 ❌ Authentication error:', data.error, data.error_description);
          this.cleanup(overlay);
          reject(new Error(data.error_description || data.error || 'Authentication failed'));
        }
        
      } catch (error) {
        console.error('🔥 ❌ Polling fetch error:', error);
        console.log('🔥 🔄 Retrying polling in', interval, 'seconds...');
        this.pollInterval = setTimeout(poll, interval * 1000);
      }
    };
    
    // Start polling immediately
    console.log('🔥 🎬 Starting first poll NOW...');
    poll();
  }

  createDeviceCodeOverlay(deviceData) {
    const overlay = document.createElement('div');
    overlay.id = 'device-flow-overlay';
    
    // Extract the correct URL field from Google's response
    const verificationUrl = deviceData.verification_uri || deviceData.verification_url || 'https://www.google.com/device';
    
    console.log('🔥 Device Flow Data received:', {
      verification_uri: deviceData.verification_uri,
      verification_url: deviceData.verification_url,
      user_code: deviceData.user_code,
      device_code: deviceData.device_code,
      expires_in: deviceData.expires_in,
      interval: deviceData.interval,
      finalUrl: verificationUrl
    });
    
    overlay.innerHTML = `
      <div class="device-flow-modal">
        <img src="icons/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie" class="dashie-logo">
        
        <div class="device-flow-header">
          <h2>Sign in with Google</h2>
          <p>Use your phone or computer to complete sign-in</p>
        </div>
        
        <div class="device-flow-content">
          <div class="step-instructions">
            <div class="step">
              <span class="step-number">1</span>
              <div>
                <p>On your phone or computer, go to:</p>
                <div class="verification-url">${verificationUrl}</div>
              </div>
            </div>
            
            <div class="step">
              <span class="step-number">2</span>
              <div>
                <p>Enter this code:</p>
                <div class="user-code">${deviceData.user_code}</div>
              </div>
            </div>
            
            <div class="step">
              <span class="step-number">3</span>
              <div>
                <p>Complete the sign-in process</p>
                <p style="font-size: 14px; color: #666; margin-top: 8px;">This window will automatically close when you finish signing in.</p>
              </div>
            </div>
          </div>
          
          <div class="device-flow-status">
            <div class="loading-spinner"></div>
            <p>Waiting for sign-in... (polling every ${deviceData.interval || 5} seconds)</p>
          </div>
          
          <div class="device-flow-buttons">
            <button id="cancel-device-flow" class="device-flow-button secondary" tabindex="1">
              Cancel
            </button>
          </div>
        </div>
        
        <div class="device-flow-footer">
          <p>Code expires in <span id="countdown">${Math.floor(deviceData.expires_in / 60)}</span> minutes</p>
        </div>
      </div>
    `;

    // Apply styles
    this.applyDeviceFlowStyles(overlay);
    
    return overlay;
  }

  applyDeviceFlowStyles(overlay) {
    overlay.style.cssText = `
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
    `;

    const style = document.createElement('style');
    style.textContent = `
      .device-flow-modal {
        background: #FCFCFF;
        border-radius: 16px;
        padding: 40px;
        max-width: 600px;
        width: 90%;
        text-align: center;
        color: #424242;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }
      
      .dashie-logo {
        width: 120px;
        height: auto;
        margin-bottom: 24px;
      }
      
      .device-flow-header h2 {
        margin: 0 0 8px 0;
        font-size: 28px;
        font-weight: bold;
        color: #424242;
      }
      
      .device-flow-header p {
        margin: 0 0 32px 0;
        font-size: 16px;
        color: #616161;
      }
      
      .step-instructions {
        margin-bottom: 32px;
      }
      
      .step {
        display: flex;
        align-items: flex-start;
        margin-bottom: 24px;
        text-align: left;
      }
      
      .step-number {
        background: #1a73e8;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        margin-right: 16px;
        flex-shrink: 0;
        margin-top: 4px;
      }
      
      .step p {
        margin: 0 0 8px 0;
        font-size: 16px;
        color: #424242;
      }
      
      .verification-url {
        background: #f8f9fa;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 18px;
        font-weight: bold;
        color: #1a73e8;
        border: 2px solid #e8f0fe;
        margin-top: 8px;
      }
      
      .user-code {
        background: #fff3e0;
        padding: 16px 24px;
        border-radius: 8px;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 32px;
        font-weight: bold;
        color: #ff8f00;
        border: 2px solid #ffcc02;
        letter-spacing: 4px;
        margin-top: 8px;
      }
      
      .device-flow-status {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin: 24px 0;
        padding: 16px;
        background: #f0f8ff;
        border-radius: 8px;
      }
      
      .loading-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #e3f2fd;
        border-top: 2px solid #1a73e8;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .device-flow-button {
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        outline: none;
      }
      
      .device-flow-button.secondary {
        background: #f8f9fa;
        color: #5f6368;
        border: 1px solid #dadce0;
      }
      
      .device-flow-button.secondary:hover,
      .device-flow-button.secondary:focus {
        background: #f1f3f4;
        outline: 3px solid #ffaa00;
        transform: scale(1.02);
      }
      
      .device-flow-footer {
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid #e8eaed;
      }
      
      .device-flow-footer p {
        margin: 0;
        font-size: 14px;
        color: #9aa0a6;
      }
      
      #countdown {
        font-weight: bold;
        color: #ea4335;
      }
    `;
    
    document.head.appendChild(style);
  }

  setupDeviceCodeNavigation(overlay, onCancel) {
    const cancelBtn = overlay.querySelector('#cancel-device-flow');
    
    // Auto-focus cancel button
    setTimeout(() => cancelBtn.focus(), 200);
    
    // Cancel button handler
    cancelBtn.addEventListener('click', onCancel);
    
    // Keyboard navigation
    overlay.addEventListener('keydown', (e) => {
      if (e.keyCode === 4 || e.key === 'Escape') { // Back button
        e.preventDefault();
        onCancel();
      } else if (e.keyCode === 13 || e.keyCode === 23) { // Enter
        if (document.activeElement === cancelBtn) {
          onCancel();
        }
      }
    });
  }

  startCountdown(overlay, expiresIn) {
    const countdownEl = overlay.querySelector('#countdown');
    let remaining = expiresIn;
    
    const updateCountdown = () => {
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      countdownEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      if (remaining <= 0) {
        console.log('🔥 ⏰ Device code expired');
        this.cleanup(overlay);
        return;
      }
      
      remaining--;
    };
    
    // Update immediately and then every second
    updateCountdown();
    this.countdownInterval = setInterval(updateCountdown, 1000);
  }

  // Step 4: Get user information
  async getUserInfo(accessToken) {
    console.log('🔥 👤 Fetching user info...');
    
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔥 Failed to get user info:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error('Failed to get user information');
    }
    
    const userInfo = await response.json();
    console.log('🔥 👤 User info received:', {
      id: userInfo.id,
      name: userInfo.name,
      email: userInfo.email
    });
    
    return {
      id: userInfo.id,
      name: userInfo.name,
      email: userInfo.email,
      picture: userInfo.picture,
      authMethod: 'device_flow'
    };
  }

  cleanup(overlay) {
    console.log('🔥 🧹 Cleaning up device flow...');
    
    // Clear intervals
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }
    
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    
    // Remove overlay
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }
}
