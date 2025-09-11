// UPDATED: createDeviceCodeOverlay method in device-flow-auth.js

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
      <div class="device-flow-header">
        <svg class="google-logo-header" width="24" height="24" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <h2>Sign in to your Google Account</h2>
      </div>
      
      <div class="device-flow-content">
        <div class="instruction-text">
          <p>On your phone or computer, go to:</p>
          <div class="verification-url">${verificationUrl}</div>
        </div>
        
        <div class="instruction-text">
          <p>Enter this code:</p>
          <div class="user-code">${deviceData.user_code}</div>
        </div>
        
        <div class="device-flow-status">
          <div class="loading-spinner"></div>
          <p>Waiting for sign-in...</p>
        </div>
      </div>
      
      <div class="device-flow-footer">
        <button id="cancel-device-flow" class="device-flow-button" tabindex="1">
          Cancel
        </button>
        <p class="expiry-text">Code expires in <span id="countdown">${Math.floor(deviceData.expires_in / 60)}</span> minutes</p>
      </div>
    </div>
  `;

  // Apply styles
  this.applyDeviceFlowStyles(overlay);
  
  return overlay;
}

// UPDATED: applyDeviceFlowStyles method in device-flow-auth.js

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
      border-radius: 12px;
      padding: 32px;
      max-width: 480px;
      width: 90%;
      text-align: center;
      color: #424242;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-height: 90vh;
      overflow-y: auto;
    }
    
    .device-flow-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e8eaed;
    }
    
    .google-logo-header {
      flex-shrink: 0;
    }
    
    .device-flow-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
      color: #424242;
    }
    
    .device-flow-content {
      margin: 20px 0;
    }
    
    .instruction-text {
      margin-bottom: 16px;
    }
    
    .instruction-text p {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: #424242;
      font-weight: 400;
    }
    
    .verification-url {
      background: #f8f9fa;
      padding: 10px 14px;
      border-radius: 6px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 16px;
      font-weight: 500;
      color: #424242;
      border: 1px solid #dadce0;
      margin-bottom: 4px;
    }
    
    .user-code {
      background: #f8f9fa;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 24px;
      font-weight: 600;
      color: #424242;
      border: 1px solid #dadce0;
      letter-spacing: 2px;
      margin-bottom: 4px;
    }
    
    .device-flow-status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 20px 0;
      padding: 12px;
      background: #f0f8ff;
      border-radius: 6px;
    }
    
    .device-flow-status p {
      margin: 0;
      font-size: 13px;
      color: #5f6368;
    }
    
    .loading-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #e3f2fd;
      border-top: 2px solid #1a73e8;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .device-flow-footer {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #e8eaed;
    }
    
    .device-flow-button {
      padding: 10px 24px;
      border: 1px solid #dadce0;
      border-radius: 6px;
      background: #f8f9fa;
      color: #5f6368;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      outline: none;
      margin-bottom: 12px;
    }
    
    .device-flow-button:hover,
    .device-flow-button:focus {
      background: #f1f3f4;
      outline: 3px solid #ffaa00;
      transform: scale(1.02);
    }
    
    .expiry-text {
      margin: 0;
      font-size: 12px;
      color: #9aa0a6;
    }
    
    #countdown {
      font-weight: 600;
      color: #ea4335;
    }
    
    /* Fire TV layout adjustments */
    @media (max-width: 1920px) and (max-height: 1080px) {
      .device-flow-modal {
        max-width: 520px;
        padding: 36px;
      }
      
      .device-flow-header h2 {
        font-size: 22px;
      }
      
      .verification-url {
        font-size: 18px;
        padding: 12px 16px;
      }
      
      .user-code {
        font-size: 28px;
        padding: 14px 18px;
      }
      
      .device-flow-button {
        font-size: 16px;
        padding: 12px 28px;
      }
    }
  `;
  
  document.head.appendChild(style);
}
