// js/auth/auth-manager.js
// CHANGE SUMMARY: Fixed widget postMessage error by removing non-cloneable objects from message

import { NativeAuth } from './native-auth.js';
import { WebAuth } from './web-auth.js';
import { AuthUI } from './auth-ui.js';
import { AuthStorage } from './auth-storage.js';
import { DeviceFlowAuth } from './device-flow-auth.js';
import { GoogleAPIClient } from '../google-apis/google-api-client.js';

export class AuthManager {
  constructor() {
    this.currentUser = null;
    this.isSignedIn = false;
    this.googleAccessToken = null;
    this.googleAPI = null;
    this.isWebView = this.detectWebView();
    this.hasNativeAuth = this.detectNativeAuth();
    this.isFireTV = this.detectFireTV();
    
    // Initialize auth modules - much simpler now!
    this.nativeAuth = this.hasNativeAuth ? new NativeAuth() : null;
    this.webAuth = new WebAuth();
    this.deviceFlowAuth = new DeviceFlowAuth();
    
    this.nativeAuthFailed = false;
    this.ui = new AuthUI();
    this.storage = new AuthStorage(); // Keep for compatibility
    
    // Centralized data cache (unchanged)
    this.dataCache = {
      calendar: {
        events: [],
        calendars: [],
        lastUpdated: null,
        refreshInterval: 5 * 60 * 1000, // 5 minutes
        isLoading: false
      },
      photos: {
        albums: [],
        recentPhotos: [],
        lastUpdated: null,
        refreshInterval: 30 * 60 * 1000, // 30 minutes
        isLoading: false
      }
    };
    
    this.refreshTimers = {};
    this.pendingWidgetRequests = [];
    
    this.init();
  }

  async init() {
  console.log('🔐 Initializing Enhanced AuthManager with Google OAuth...');
  
  // Set up widget request handler (keep this - it's enhanced)
  this.setupWidgetRequestHandler();
  
  try {
    // Platform detection and Google OAuth initialization
    const platform = this.detectPlatform();
    console.log('🔐 📱 Platform detected:', platform);
    
    // Check for existing authentication first
    const existingAuth = await this.checkExistingAuth();
    if (existingAuth) {
      console.log('🔐 ✅ Found existing authentication');
      this.setUserFromAuth(existingAuth.user, existingAuth.tokens);
      this.isSignedIn = true;
      this.ui.showSignedInState();
      await this.initializeGoogleAPIs();
      return;
    }
    
    // Check for OAuth callback
    const callbackResult = await this.handleOAuthCallbacks();
    if (callbackResult.handled) {
      if (callbackResult.success) {
        console.log('🔐 ✅ OAuth callback processed successfully');
        this.setUserFromAuth(callbackResult.user, callbackResult.tokens);
        this.isSignedIn = true;
        this.ui.showSignedInState();
        await this.initializeGoogleAPIs();
        return;
      } else {
        console.error('🔐 ❌ OAuth callback failed:', callbackResult.error);
        this.ui.showAuthError(callbackResult.error);
        return;
      }
    }
    
    // No existing auth found - show sign-in prompt
    console.log('🔐 No existing authentication, showing sign-in prompt');
    this.ui.showSignInPrompt(() => this.signIn(), () => this.exitApp());
    
  } catch (error) {
    console.error('🔐 ❌ Auth initialization failed:', error);
    this.handleAuthFailure(error);
  }
}

 async signIn() {
  try {
    console.log('🔐 Starting Google OAuth sign-in...');
    this.ui.hideSignInPrompt();
    
    // Detect platform and use appropriate auth method
    const platform = this.detectPlatform();
    
    if (platform === 'android') {
      console.log('🔐 📱 Using Android native auth');
      const result = await this.nativeAuth.signIn();
      if (result.success) {
        this.setUserFromAuth(result.user, result.tokens);
        this.isSignedIn = true;
        this.ui.showSignedInState();
        await this.initializeGoogleAPIs();
      } else {
        throw new Error(result.error || 'Native auth failed');
      }
    } else if (platform === 'firetv') {
      console.log('🔐 📺 Using FireTV device flow');
      const result = await this.deviceFlow.signIn();
      if (result.success) {
        this.setUserFromAuth(result.user, result.tokens);
        this.isSignedIn = true;
        this.ui.showSignedInState();
        await this.initializeGoogleAPIs();
      } else {
        throw new Error(result.error || 'Device flow failed');
      }
    } else {
      console.log('🔐 🌐 Using web OAuth');
      // Web auth will redirect, so we don't wait for result here
      await this.webAuth.signIn();
    }
    
  } catch (error) {
    console.error('🔐 ❌ Sign-in failed:', error);
    this.ui.showAuthError('Sign-in failed. Please try again.');
  }
}

  async signOut() {
  console.log('🔐 Signing out...');
  
  try {
    // KEEP: Clear refresh timers (enhanced functionality)
    Object.values(this.refreshTimers).forEach(timer => clearTimeout(timer));
    this.refreshTimers = {};
    
    // KEEP: Clear data cache (enhanced functionality)
    this.dataCache = {
      calendar: { events: [], calendars: [], lastUpdated: null, refreshInterval: 5 * 60 * 1000, isLoading: false },
      photos: { albums: [], recentPhotos: [], lastUpdated: null, refreshInterval: 30 * 60 * 1000, isLoading: false }
    };
    
    // REPLACED: Google OAuth sign-out instead of Cognito
    const platform = this.detectPlatform();
    
    if (platform === 'android' && this.nativeAuth) {
      await this.nativeAuth.signOut();
    } else if (platform === 'firetv' && this.deviceFlow) {
      await this.deviceFlow.signOut();
    } else if (this.webAuth) {
      await this.webAuth.signOut();
    }
    
    // KEEP: Clear local state (enhanced)
    this.currentUser = null;
    this.isSignedIn = false;
    this.googleAccessToken = null;
    this.googleAPI = null;
    
    // KEEP: Clear legacy storage (enhanced)
    this.storage.clearSavedUser();
    
    // KEEP: Show sign-in prompt
    this.ui.showSignInPrompt(() => this.signIn(), () => this.exitApp());
    
  } catch (error) {
    console.error('🔐 ❌ Sign-out failed:', error);
    // KEEP: Still clear local state even if remote sign-out fails
    this.currentUser = null;
    this.isSignedIn = false;
    this.googleAccessToken = null;
    this.googleAPI = null;
    this.ui.showSignInPrompt(() => this.signIn(), () => this.exitApp());
  }
}

detectPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (userAgent.includes('android')) {
    return 'android';
  } else if (userAgent.includes('fire tv') || userAgent.includes('afts')) {
    return 'firetv';
  } else {
    return 'web';
  }
}

async checkExistingAuth() {
  const savedUser = this.storage.getSavedUser();
  if (savedUser && savedUser.googleAccessToken) {
    return {
      user: savedUser,
      tokens: { access_token: savedUser.googleAccessToken }
    };
  }
  return null;
}

async handleOAuthCallbacks() {
  // Check web auth callback
  if (this.webAuth && await this.webAuth.handleOAuthCallback()) {
    const result = await this.webAuth.getAuthResult();
    return { handled: true, success: result.success, user: result.user, tokens: result.tokens, error: result.error };
  }
  
  return { handled: false };
}

setUserFromAuth(userData, tokens) {
  this.currentUser = userData;
  this.googleAccessToken = tokens?.access_token;
  
  // Ensure googleAccessToken is in user object for storage
  if (this.googleAccessToken) {
    this.currentUser.googleAccessToken = this.googleAccessToken;
  }
  
  console.log('🔐 ✅ User set from Google OAuth:', {
    name: userData.name,
    email: userData.email,
    picture: userData.picture,
    hasGoogleToken: !!this.googleAccessToken
  });
  
  // Save to storage for persistence
  this.storage.saveUser(this.currentUser);
}

   
  exitApp() {
    console.log('🚪 Exiting Dashie...');
    
    // Try platform-specific exit methods (legacy compatibility)
    if (window.DashieNative?.exitApp) {
      window.DashieNative.exitApp();
    } else if (window.close) {
      window.close();
    } else {
      window.location.href = 'about:blank';
    }
  }

handleAuthFailure(error) {
  console.error('🔐 Auth initialization failed:', error);
  
  // REPLACED: Try to get saved user from Google OAuth storage instead of Cognito
  const savedUser = this.storage.getSavedUser();
  if (savedUser) {
    console.log('🔐 Using saved user data as fallback');
    this.setUserFromAuth(savedUser, { access_token: savedUser.googleAccessToken });
    this.isSignedIn = true;
    this.ui.showSignedInState();
  } else {
    this.ui.showAuthError('Authentication service is currently unavailable. Please try again.');
  }
}
  // API compatibility methods (unchanged from original)
  getUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return this.isSignedIn && !!this.currentUser;
  }

  getGoogleAccessToken() {
    return this.googleAccessToken;
  }

  // NEW: Method for token refresh (uses Cognito's built-in refresh)
  async refreshGoogleAccessToken() {
    try {
      console.log('🔄 Refreshing Google access token via Cognito...');
      const success = await this.cognitoAuth.refreshSession();
      
      if (success && this.cognitoAuth.getGoogleAccessToken()) {
        this.googleAccessToken = this.cognitoAuth.getGoogleAccessToken();
        
        // Update current user object
        if (this.currentUser) {
          this.currentUser.googleAccessToken = this.googleAccessToken;
          this.storage.saveUser(this.currentUser);
        }
        
        console.log('🔄 ✅ Google access token refreshed successfully');
        return this.googleAccessToken;
      } else {
        throw new Error('Cognito session refresh failed');
      }
    } catch (error) {
      console.error('🔄 ❌ Google access token refresh failed:', error);
      throw error;
    }
  }

  // Google APIs initialization (updated for Cognito)
  async initializeGoogleAPIs() {
    if (!this.googleAccessToken) {
      console.warn('🔐 ⚠️ No Google access token available for API initialization');
      return;
    }

    try {
      // Pass 'this' as the auth manager so GoogleAPIClient can call refreshGoogleAccessToken
      this.googleAPI = new GoogleAPIClient(this);
      const testResults = await this.googleAPI.testAccess();
      console.log('🌐 ✅ Google APIs initialized:', testResults);
      
      // Notify widgets (unchanged)
      this.notifyWidgetsOfAPIReadiness(testResults);
      
    } catch (error) {
      console.error('🌐 ❌ Google APIs initialization failed:', error);
      this.notifyWidgetsOfAPIReadiness({ calendar: false, photos: false });
    }
  }

  // Widget communication methods (unchanged from original)
  setupWidgetRequestHandler() {
    
    window.addEventListener('message', (event) => {
        console.log('🔗 📨 PostMessages received:', {
            type: event.data?.type,
            origin: event.origin,
            data: event.data
          });
      
      if (event.data.type === 'widget-data-request') {
        this.handleWidgetDataRequest(event.data, event.source);
      }
    });
  }

  notifyWidgetsOfAPIReadiness(testResults) {
    setTimeout(() => {
      const allWidgetIframes = document.querySelectorAll('.widget-iframe, .widget iframe, .widget-iframe');
      
      if (allWidgetIframes.length === 0) {
        console.log('📡 🔄 No widget iframes found initially, retrying...');
        setTimeout(() => {
          const retryIframes = document.querySelectorAll('.widget-iframe, .widget iframe, .widget-iframe');
          if (retryIframes.length > 0) {
            console.log(`📡 🔄 Retry found ${retryIframes.length} widget iframe(s)`);
            this.sendGoogleAPIReadyMessage(retryIframes, testResults);
          }
        }, 2000);
      } else {
        this.sendGoogleAPIReadyMessage(allWidgetIframes, testResults);
      }
    }, 1000);
  }

  sendGoogleAPIReadyMessage(iframes, testResults) {
    iframes.forEach((iframe, index) => {
      if (iframe.contentWindow) {
        try {
          // FIXED: Only send cloneable data - no Promise objects or functions
          const message = {
            type: 'google-apis-ready',
            apiCapabilities: testResults,
            timestamp: Date.now(),
            googleAccessToken: this.googleAccessToken,
            debugInfo: {
              sentAt: new Date().toISOString(),
              widgetSrc: iframe.src,
              widgetIndex: index + 1
            }
          };
          
          iframe.contentWindow.postMessage(message, '*');
          console.log(`📡 ✅ Message sent to widget ${index + 1} (${iframe.src})`);
          
        } catch (error) {
          console.error(`📡 ❌ Failed to send message to widget ${index + 1}:`, error);
        }
      }
    });
  }

  async handleWidgetDataRequest(requestData, sourceWindow) {
    console.log('📡 📨 Received widget data request:', requestData);
    
    try {
      let response = { 
        type: 'widget-data-response',
        requestId: requestData.requestId,
        success: false,
        timestamp: Date.now()
      };
      
      const { dataType, requestType, params } = requestData;
      
      if (dataType === 'calendar') {
        response = await this.handleCalendarRequest(requestType, params, response);
      } else if (dataType === 'photos') {
        response = await this.handlePhotosRequest(requestType, params, response);
      } else {
        response.error = 'Unknown data type requested';
      }
      
      sourceWindow.postMessage(response, '*');
      console.log('📡 ✅ Widget data response sent');
      
    } catch (error) {
      console.error('📡 ❌ Widget data request failed:', error);
      sourceWindow.postMessage({
        type: 'widget-data-response',
        requestId: requestData.requestId,
        success: false,
        error: error.message,
        timestamp: Date.now()
      }, '*');
    }
  }

  // js/auth/auth-manager.js - UPDATED: Fixed calendar color handling
// CHANGE SUMMARY: Updated handleCalendarRequest to fetch and return both events and calendar metadata for proper color application

 // js/auth/auth-manager.js - UPDATED: Fixed calendar color handling
// CHANGE SUMMARY: Updated handleCalendarRequest to fetch and return both events and calendar metadata for proper color application

  async handleCalendarRequest(requestType, params, response) {
    if (!this.googleAPI) {
      throw new Error('Google APIs not initialized');
    }
    
    switch (requestType) {
      case 'events':
        // Fetch both events and calendar metadata for color information
        const [events, calendarList] = await Promise.all([
          this.googleAPI.getAllCalendarEvents(params?.timeRange),
          this.googleAPI.getCalendarList()
        ]);
        
        response.success = true;
        response.data = events;
        response.calendars = calendarList; // Include calendar metadata with colors
        break;
        
      case 'calendars':
        const calendars = await this.googleAPI.getCalendarList();
        response.success = true;
        response.data = calendars;
        break;
        
      default:
        throw new Error(`Unknown calendar request type: ${requestType}`);
    }
    
    return response;
  }
  
  async handlePhotosRequest(requestType, params, response) {
    if (!this.googleAPI) {
      throw new Error('Google APIs not initialized');
    }
    
    switch (requestType) {
      case 'albums':
        const albums = await this.googleAPI.getPhotoAlbums();
        response.success = true;
        response.data = albums;
        break;
        
      case 'recent':
        const photos = await this.googleAPI.getRecentPhotos(params?.count || 10);
        response.success = true;
        response.data = photos;
        break;
        
      default:
        throw new Error(`Unknown photos request type: ${requestType}`);
    }
    
    return response;
  }
}
