// auth.js
// Phone authentication handler for Hybrid Device Flow
// Handles QR scan → Google OAuth → Device authorization

import { createLogger } from './js/utils/logger.js';
import { SUPABASE_CONFIG } from './js/data/auth/auth-config.js';

const logger = createLogger('PhoneAuth');

// Supabase config
const EDGE_FUNCTION_URL = SUPABASE_CONFIG.edgeFunctionUrl;
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey;
const GOOGLE_CLIENT_ID = SUPABASE_CONFIG.googleWebClientId;

class PhoneAuthHandler {
  constructor() {
    this.userCode = null;
    this.deviceCode = null;
    this.deviceType = null;
    this.googleCredential = null;
    this.googleUser = null;
  }

  /**
   * Initialize the phone auth handler
   */
  async init() {
    try {
      logger.info('Initializing phone auth handler');

      // Parse URL parameters
      const params = new URLSearchParams(window.location.search);
      const status = params.get('status');
      const message = params.get('message');
      this.userCode = params.get('code');
      this.deviceType = params.get('type') || 'firetv';

      logger.debug('URL parameters', {
        status,
        userCode: this.userCode,
        deviceType: this.deviceType
      });

      // Check if redirected back from OAuth callback with status
      if (status === 'success') {
        logger.success('OAuth callback successful - showing success state');
        this.displayDeviceInfo();
        this.showSuccess();

        // Auto-redirect to dashboard after showing success
        setTimeout(() => {
          logger.info('Redirecting to dashboard...');
          window.location.href = '/';
        }, 1500);
        return;
      }

      if (status === 'error') {
        logger.error('OAuth callback failed', { message });
        this.displayDeviceInfo();
        this.showError('Authorization Failed', message || 'Unknown error occurred');
        return;
      }

      // Validate user code
      if (!this.userCode) {
        this.showError('Invalid Link', 'No device code found. Please scan the QR code again or enter the code manually.');
        return;
      }

      // Display device info
      this.displayDeviceInfo();

      // Initialize Google Sign-In
      this.initializeGoogleSignIn();

    } catch (error) {
      logger.error('Initialization failed', error);
      this.showError('Initialization Error', error.message);
    }
  }

  /**
   * Display device information
   */
  displayDeviceInfo() {
    const deviceNameEl = document.getElementById('device-name');
    const deviceCodeEl = document.getElementById('device-code');

    const deviceNames = {
      'firetv': 'Fire TV',
      'androidtv': 'Android TV',
      'appletv': 'Apple TV',
      'tv': 'TV Device'
    };

    deviceNameEl.textContent = deviceNames[this.deviceType] || 'TV Device';
    deviceCodeEl.textContent = this.userCode;

    logger.debug('Device info displayed', {
      deviceName: deviceNames[this.deviceType],
      userCode: this.userCode
    });
  }

  /**
   * Initialize Google Sign-In button
   */
  initializeGoogleSignIn() {
    try {
      logger.debug('Initializing Google Sign-In button');

      // Wait for Google library to load
      const waitForGoogle = () => {
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
          logger.debug('Google library loaded, initializing...');

          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: this.handleGoogleCallback.bind(this),
            auto_select: false,
            cancel_on_tap_outside: true
          });

          // Attach custom button click handler
          const customButton = document.getElementById('custom-google-signin');
          if (customButton) {
            customButton.addEventListener('click', () => {
              logger.debug('Custom Google button clicked');
              // Trigger Google One Tap
              google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                  logger.warn('One Tap not shown, falling back to popup');
                  // If One Tap doesn't work, show the popup
                  this.initiateOAuthFlow();
                }
              });
            });
          }

          logger.success('Google Sign-In initialized with custom button');
        } else {
          logger.debug('Waiting for Google library to load...');
          setTimeout(waitForGoogle, 100);
        }
      };

      waitForGoogle();

    } catch (error) {
      logger.error('Failed to initialize Google Sign-In', error);
      this.showError('Setup Error', 'Failed to initialize Google Sign-In. Please refresh the page.');
    }
  }

  /**
   * Handle Google Sign-In callback
   * @param {Object} response - Google credential response
   */
  async handleGoogleCallback(response) {
    try {
      logger.info('Google Sign-In callback received');

      // Store the credential
      this.googleCredential = response.credential;

      // Decode the JWT to get user info (for display only)
      this.googleUser = this.parseJWT(this.googleCredential);

      logger.debug('Google user info', {
        email: this.googleUser.email,
        name: this.googleUser.name
      });

      // Hide sign-in section, show loading
      this.showSection('loading-section');
      this.updateStatus('Completing authentication with Google...');

      // Now we need to exchange the Google ID token for OAuth tokens
      // We'll use the Web OAuth flow to get access_token and refresh_token
      await this.initiateOAuthFlow();

    } catch (error) {
      logger.error('Google callback error', error);
      this.showError('Sign-In Failed', error.message);
    }
  }

  /**
   * Initiate OAuth flow to get access and refresh tokens
   */
  async initiateOAuthFlow() {
    try {
      logger.info('Initiating OAuth flow to get tokens');

      // Store device code in session storage for callback
      sessionStorage.setItem('hybrid_device_user_code', this.userCode);
      sessionStorage.setItem('hybrid_device_type', this.deviceType);

      // Build OAuth URL
      const redirectUri = window.location.origin + '/oauth-callback.html';
      const scope = 'openid email profile https://www.googleapis.com/auth/calendar.readonly';

      const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scope,
        access_type: 'offline',
        prompt: 'consent',
        state: 'hybrid_device_flow',
        login_hint: this.googleUser.email  // Use the email from Google Sign-In
      });

      logger.debug('Redirecting to OAuth', {
        redirectUri,
        userEmail: this.googleUser.email
      });

      // Redirect to Google OAuth
      window.location.href = authUrl;

    } catch (error) {
      logger.error('OAuth flow initiation failed', error);
      this.showError('OAuth Error', error.message);
    }
  }

  /**
   * Authorize device code (called after OAuth callback returns tokens)
   * @param {Object} tokens - OAuth tokens from callback
   */
  async authorizeDeviceCode(tokens) {
    try {
      logger.info('Authorizing device code with backend');

      this.updateStatus('Linking your TV device...');

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`  // Unauthenticated operation
        },
        body: JSON.stringify({
          operation: 'authorize_device_code',
          googleAccessToken: tokens.access_token,
          data: {
            device_code: this.userCode,  // Using user_code as identifier
            google_tokens: {
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              expires_in: tokens.expires_in || 3600,
              scope: tokens.scope
            }
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!data.success) {
        throw new Error(data.error || data.message || 'Device authorization failed');
      }

      logger.success('Device authorized successfully', {
        userEmail: data.user?.email
      });

      // Store the phone JWT and redirect to dashboard
      if (data.jwtToken) {
        // Parse JWT to get expiry and user info
        const payload = this.parseJWT(data.jwtToken);

        // Store JWT with metadata (same format as EdgeClient expects)
        const jwtData = {
          jwt: data.jwtToken,
          expiry: payload.exp ? payload.exp * 1000 : Date.now() + (72 * 60 * 60 * 1000),
          userId: payload.sub,
          userEmail: payload.email,
          savedAt: Date.now()
        };

        localStorage.setItem('dashie-supabase-jwt', JSON.stringify(jwtData));

        // Also store user display data
        if (data.user) {
          const userData = {
            name: data.user.name || data.user.email,
            picture: data.user.picture || null
          };
          localStorage.setItem('dashie-user-data', JSON.stringify(userData));
        }

        logger.success('Phone authenticated - JWT stored');
        // Phone gets JWT - no need to show success screen since we're authorizing the TV
        // The success will be shown when redirected back from oauth-callback
      } else {
        // No JWT returned - shouldn't happen
        logger.warn('No JWT returned from device authorization');
      }

    } catch (error) {
      logger.error('Device authorization failed', error);
      this.showError('Authorization Failed', error.message);
    }
  }

  /**
   * Parse JWT token (client-side only for display)
   * @param {string} token - JWT token
   * @returns {Object} Decoded payload
   */
  parseJWT(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      logger.error('Failed to parse JWT', error);
      return {};
    }
  }

  /**
   * Show a specific section, hide others
   * @param {string} sectionId - ID of section to show
   */
  showSection(sectionId) {
    const sections = ['sign-in-section', 'loading-section', 'success-section', 'error-section'];
    sections.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        if (id === sectionId) {
          element.classList.remove('hidden');
        } else {
          element.classList.add('hidden');
        }
      }
    });
  }

  /**
   * Update status message
   * @param {string} message - Status message
   */
  updateStatus(message) {
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

  /**
   * Show success state
   */
  showSuccess() {
    // Hide device info on success
    document.body.classList.add('auth-complete');
    this.showSection('success-section');
    logger.success('Authentication complete - showing success state');
  }

  /**
   * Show error state
   * @param {string} title - Error title
   * @param {string} message - Error message
   */
  showError(title, message) {
    // Hide device info on error
    document.body.classList.add('auth-complete');

    const titleEl = document.getElementById('error-title');
    const messageEl = document.getElementById('error-message');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;

    this.showSection('error-section');
    logger.error('Showing error state', { title, message });
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  const handler = new PhoneAuthHandler();
  window.phoneAuthHandler = handler;  // Make available globally for OAuth callback
  handler.init();
});
