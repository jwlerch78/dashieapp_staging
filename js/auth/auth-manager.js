// js/auth/auth-manager.js - Updated with Token Manager Integration
// CHANGE SUMMARY: Added Token Manager integration for automatic refresh token handling

import { AuthStorage } from './auth-storage.js';
import { WebAuth } from './web-auth.js';
import { DeviceFlowAuth } from './device-flow-auth.js';
import { NativeAuth } from './native-auth.js';
import { GoogleAPIClient } from '../google-apis/google-api-client.js';
import { TokenManager } from './token-manager.js'; // NEW: Import Token Manager

export class AuthManager {
  constructor() {
    this.storage = new AuthStorage();
    this.user = null;
    this.isSignedIn = false;
    this.platform = null;
    this.authMethod = null;
    this.googleAccessToken = null;
    this.googleAPI = null;
    
    // NEW: Token Manager for automatic refresh
    this.tokenManager = new TokenManager(this);
    
    // Auth method instances
    this.webAuth = null;
    this.deviceFlowAuth = null;
    this.nativeAuth = null;
    
    // Widget communication
    this.pendingWidgetRequests = [];
    this.dataCache = {
      calendar: {
        data: null,
        events: [],
        calendars: [],
        lastFetch: null,
        lastUpdated: null,
        refreshInterval: 15 * 60 * 1000, // 15 minutes
        isLoading: false
      },
      photos: {
        data: null,
        albums: [],
        recentPhotos: [],
        lastFetch: null,
        lastUpdated: null,
        refreshInterval: 30 * 60 * 1000, // 30 minutes
        isLoading: false
      }
    };
    this.refreshTimers = {};
    
    console.log('🔧 Auth Manager initialized with Token Manager');
    
    // Set up widget request handler
    this.setupWidgetRequestHandler();
  }

  // UPDATED: Enhanced user setting with token manager integration
  async setUserFromAuth(userData, tokens = null) {
    try {
      console.log('🔧 Setting user from auth:', {
        userId: userData.id,
        authMethod: userData.authMethod,
        hasGoogleToken: !!userData.googleAccessToken,
        hasRefreshToken: !!userData.googleRefreshToken, // NEW: Check for refresh token
        hasTokenExpiry: !!userData.tokenExpiry // NEW: Check for expiry
      });

      // Enhanced user object with token details
      const enhancedUser = {
        ...userData,
        // Ensure we have the access token
        googleAccessToken: userData.googleAccessToken || tokens?.access_token,
        // NEW: Store refresh token if available
        googleRefreshToken: userData.googleRefreshToken || tokens?.refresh_token,
        // NEW: Calculate and store token expiry
        tokenExpiry: userData.tokenExpiry || (tokens?.expires_in ? Date.now() + (tokens.expires_in * 1000) : null)
      };

      this.user = enhancedUser;
      this.isSignedIn = true;
      this.googleAccessToken = enhancedUser.googleAccessToken;

      // Save user to storage
      await this.storage.saveUser(enhancedUser);

      // NEW: Start automatic token refresh if we have a refresh token
      if (enhancedUser.googleRefreshToken && enhancedUser.tokenExpiry) {
        console.log('🔄 Starting automatic token refresh...');
        this.tokenManager.startTokenRefresh(enhancedUser);
      } else {
        console.warn('🔄 ⚠️ No refresh token or expiry time - automatic refresh not available');
      }

      // Initialize Google APIs
      await this.initializeGoogleAPIs();

      // Notify app of successful sign-in
      this.notifySignInComplete(enhancedUser);

      console.log('🔧 ✅ User authentication complete with token management');

    } catch (error) {
      console.error('🔧 ❌ Failed to set user from auth:', error);
      throw error;
    }
  }

  // NEW: Update user tokens after refresh
  async updateUserTokens(updatedUser) {
    try {
      console.log('🔄 Updating user tokens');
      
      this.user = updatedUser;
      this.googleAccessToken = updatedUser.googleAccessToken;
      
      // Save updated user to storage
      await this.storage.saveUser(updatedUser);
      
      // Update Google API client with new token
      if (this.googleAPI) {
        console.log('🔄 📡 Google API client will use refreshed token');
      }
      
      console.log('🔄 ✅ User tokens updated successfully');
      
    } catch (error) {
      console.error('🔄 ❌ Failed to update user tokens:', error);
      throw error;
    }
  }

  // UPDATED: Enhanced existing auth check with token validation
  async checkExistingAuth() {
    try {
      console.log('🔧 Checking for existing authentication...');

      const savedUser = await this.storage.getUser();
      if (!savedUser) {
        console.log('🔧 No saved user found');
        return false;
      }

      console.log('🔧 Found saved user:', {
        userId: savedUser.id,
        authMethod: savedUser.authMethod,
        hasAccessToken: !!savedUser.googleAccessToken,
        hasRefreshToken: !!savedUser.googleRefreshToken, // NEW: Check refresh token
        tokenExpiry: savedUser.tokenExpiry ? new Date(savedUser.tokenExpiry).toISOString() : 'unknown'
      });

      // NEW: Check if access token is expired
      if (savedUser.tokenExpiry && Date.now() >= savedUser.tokenExpiry) {
        console.log('🔧 ⏰ Saved access token is expired');
        
        if (savedUser.googleRefreshToken) {
          console.log('🔧 🔄 Attempting to refresh expired token...');
          try {
            // Use token manager to refresh
            this.user = savedUser; // Set user temporarily for token manager
            const refreshResult = await this.tokenManager.refreshToken();
            
            if (refreshResult.success) {
              console.log('🔧 ✅ Token refreshed successfully during startup');
              savedUser.googleAccessToken = refreshResult.tokens.access_token;
              savedUser.tokenExpiry = Date.now() + (refreshResult.tokens.expires_in * 1000);
              
              if (refreshResult.tokens.refresh_token) {
                savedUser.googleRefreshToken = refreshResult.tokens.refresh_token;
              }
            }
          } catch (refreshError) {
            console.error('🔧 ❌ Failed to refresh token during startup:', refreshError);
            // Token refresh failed, user will need to re-authenticate
            await this.storage.clearUser();
            return false;
          }
        } else {
          console.log('🔧 🚪 No refresh token available, user must re-authenticate');
          await this.storage.clearUser();
          return false;
        }
      }

      // Set the user (this will start token manager)
      await this.setUserFromAuth(savedUser);
      
      console.log('🔧 ✅ Existing authentication restored');
      return true;

    } catch (error) {
      console.error('🔧 ❌ Error checking existing auth:', error);
      return false;
    }
  }

  // UPDATED: Get valid access token (with automatic refresh)
  async getGoogleAccessToken() {
    try {
      // Use token manager to get a valid token (refreshes if needed)
      return await this.tokenManager.getValidAccessToken();
    } catch (error) {
      console.error('🔧 ❌ Failed to get valid access token:', error);
      // Fallback to current token
      return this.googleAccessToken;
    }
  }

  // UPDATED: Enhanced sign out with token manager cleanup
  async signOut() {
    try {
      console.log('🔧 🚪 Signing out...');

      // NEW: Stop token refresh
      this.tokenManager.stopTokenRefresh();

      // Clear data refresh timers
      Object.values(this.refreshTimers).forEach(timer => clearTimeout(timer));
      this.refreshTimers = {};

      // Clear user data
      this.user = null;
      this.isSignedIn = false;
      this.googleAccessToken = null;
      this.googleAPI = null;

      // Clear cached data
      this.dataCache.calendar.data = null;
      this.dataCache.calendar.events = [];
      this.dataCache.calendar.calendars = [];
      this.dataCache.photos.data = null;
      this.dataCache.photos.albums = [];
      this.dataCache.photos.recentPhotos = [];

      // Clear storage
      await this.storage.clearUser();

      // Sign out from auth methods
      if (this.webAuth) {
        this.webAuth.signOut();
      }
      if (this.nativeAuth) {
        this.nativeAuth.signOut();
      }

      // Notify app
      this.notifySignOut();

      console.log('🔧 ✅ Sign out complete');

    } catch (error) {
      console.error('🔧 ❌ Error during sign out:', error);
    }
  }

  // NEW: Get token refresh status for debugging
  getTokenRefreshStatus() {
    return this.tokenManager.getRefreshStatus();
  }

  // NEW: Force token refresh for testing
  async forceTokenRefresh() {
    try {
      console.log('🔧 🔄 Forcing token refresh...');
      const result = await this.tokenManager.refreshToken();
      console.log('🔧 ✅ Forced token refresh completed:', result);
      return result;
    } catch (error) {
      console.error('🔧 ❌ Forced token refresh failed:', error);
      throw error;
    }
  }

  // Detect platform and initialize appropriate auth method
  async detectPlatformAndInitialize() {
    console.log('🔧 Detecting platform...');
    
    // Platform detection logic
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroidTV = userAgent.includes('android') && (userAgent.includes('tv') || userAgent.includes('gtv'));
    const isFireTV = userAgent.includes('silk') || userAgent.includes('kfapwi');
    const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    
    if (isFireTV) {
      this.platform = 'firetv';
      this.authMethod = 'device-flow';
      console.log('🔧 Platform: Fire TV - using device flow');
    } else if (isAndroidTV) {
      this.platform = 'androidtv';
      this.authMethod = 'native';
      console.log('🔧 Platform: Android TV - using native auth');
    } else {
      this.platform = 'web';
      this.authMethod = 'web';
      console.log('🔧 Platform: Web Browser - using web auth');
    }

    // Initialize the appropriate auth method
    await this.initializeAuthMethod();
  }

  // Initialize the detected auth method
  async initializeAuthMethod() {
    try {
      console.log(`🔧 Initializing ${this.authMethod} auth method...`);

      switch (this.authMethod) {
        case 'web':
          this.webAuth = new WebAuth();
          await this.webAuth.init();
          // Set up callback handler
          window.handleWebAuth = (result) => this.handleAuthResult(result);
          break;

        case 'device-flow':
          this.deviceFlowAuth = new DeviceFlowAuth();
          break;

        case 'native':
          this.nativeAuth = new NativeAuth();
          await this.nativeAuth.init();
          break;

        default:
          throw new Error(`Unknown auth method: ${this.authMethod}`);
      }

      console.log(`🔧 ✅ ${this.authMethod} auth method initialized`);

    } catch (error) {
      console.error(`🔧 ❌ Failed to initialize ${this.authMethod} auth:`, error);
      throw error;
    }
  }

  // Handle authentication result from any auth method
  async handleAuthResult(result) {
    try {
      if (result.success) {
        console.log('🔧 ✅ Authentication successful via', result.user.authMethod);
        await this.setUserFromAuth(result.user, result.tokens);
      } else {
        console.error('🔧 ❌ Authentication failed:', result.error);
        this.handleAuthError(result.error);
      }
    } catch (error) {
      console.error('🔧 ❌ Error handling auth result:', error);
      this.handleAuthError(error.message);
    }
  }

  // Start sign-in process
  async signIn() {
    try {
      console.log(`🔧 Starting ${this.authMethod} sign-in...`);

      switch (this.authMethod) {
        case 'web':
          await this.webAuth.signIn();
          break;

        case 'device-flow':
          const deviceResult = await this.deviceFlowAuth.startDeviceFlow();
          await this.handleAuthResult(deviceResult);
          break;

        case 'native':
          const nativeResult = await this.nativeAuth.signIn();
          await this.handleAuthResult(nativeResult);
          break;

        default:
          throw new Error(`No sign-in method available for ${this.authMethod}`);
      }

    } catch (error) {
      console.error('🔧 ❌ Sign-in failed:', error);
      this.handleAuthError(error.message);
    }
  }

  // Handle authentication errors
  handleAuthError(errorMessage) {
    console.error('🔧 🚨 Authentication error:', errorMessage);
    
    // Notify the app of auth failure
    if (window.dashieApp && window.dashieApp.handleAuthError) {
      window.dashieApp.handleAuthError(errorMessage);
    }
  }

  // Notify app of successful sign-in
  notifySignInComplete(user) {
    console.log('🔧 📢 Notifying app of sign-in completion');
    
    if (window.dashieApp && window.dashieApp.handleSignInComplete) {
      window.dashieApp.handleSignInComplete(user);
    }
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('dashie-auth-signin', {
      detail: { user: user }
    }));
  }

  // Notify app of sign-out
  notifySignOut() {
    console.log('🔧 📢 Notifying app of sign-out');
    
    if (window.dashieApp && window.dashieApp.handleSignOut) {
      window.dashieApp.handleSignOut();
    }
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('dashie-auth-signout'));
  }

  // Get current user
  getUser() {
    return this.user;
  }

  // Check if user is signed in
  isUserSignedIn() {
    return this.isSignedIn && this.user && this.googleAccessToken;
  }

  // Initialize Google APIs
  async initializeGoogleAPIs() {
    if (!this.googleAccessToken) {
      console.warn('🔧 ⚠️ No Google access token available for API initialization');
      return;
    }

    try {
      console.log('🔧 Initializing Google API client...');
      this.googleAPI = new GoogleAPIClient(this);
      console.log('🔧 ✅ Google API client initialized');
      
      // Test API access first
      setTimeout(async () => {
        try {
          console.log('🧪 Testing Google API access...');
          const testResults = await this.googleAPI.testAccess();
          console.log('🧪 ✅ Google API access test results:', testResults);
          
          // If calendar access is available, start fetching data
          if (testResults.calendar) {
            console.log('📅 🚀 Starting initial calendar data fetch...');
            await this.refreshCalendarData();
          }
          
          // If photos access is available, start fetching data
          if (testResults.photos) {
            console.log('📸 🚀 Starting initial photos data fetch...');
            await this.refreshPhotosData();
          }
          
          // Send capabilities to widgets (for backward compatibility)
          this.notifyAllWidgets(testResults);
          
        } catch (error) {
          console.warn('🧪 ❌ Google API access test failed:', error);
          this.notifyAllWidgets({ 
            calendar: false, 
            photos: false, 
            errors: [error.message],
            tokenStatus: 'error'
          });
        }
      }, 1000);
      
    } catch (error) {
      console.error('🔧 ❌ Failed to initialize Google APIs:', error);
    }
  }

  // Send postMessage to ALL widget iframes
  notifyAllWidgets(testResults) {
    const allWidgetIframes = document.querySelectorAll('.widget iframe, .widget-iframe');
    
    console.log(`📡 🖼️ Found ${allWidgetIframes.length} widget iframe(s) to notify`);
    
    if (allWidgetIframes.length === 0) {
      console.warn('📡 ⚠️ No widget iframes found - they may not be loaded yet');
      setTimeout(() => {
        const retryIframes = document.querySelectorAll('.widget iframe, .widget-iframe');
        if (retryIframes.length > 0) {
          console.log(`📡 🔄 Retry found ${retryIframes.length} widget iframe(s)`);
          this.notifyAllWidgets(testResults);
        }
      }, 2000);
      return;
    }

    const message = {
      type: 'google-apis-ready',
      apiCapabilities: {
        calendar: testResults.calendar,
        photos: testResults.photos,
        tokenStatus: testResults.tokenStatus
      },
      googleAccessToken: this.googleAccessToken,
      user: this.user,
      timestamp: Date.now()
    };

    allWidgetIframes.forEach((iframe, index) => {
      try {
        iframe.contentWindow.postMessage(message, '*');
        console.log(`📡 ✅ Message sent to widget iframe ${index + 1}`);
      } catch (error) {
        console.error(`📡 ❌ Failed to send message to widget iframe ${index + 1}:`, error);
      }
    });
  }

  // NEW: Widget request handler for centralized data
  setupWidgetRequestHandler() {
    window.addEventListener('message', (event) => {
      if (!event.data || !event.data.type) return;
      
      switch (event.data.type) {
        case 'request-calendar-data':
          console.log('📅 Widget requesting calendar data:', event.data.widget);
          this.handleCalendarDataRequest(event.source, event.data);
          break;
          
        case 'request-photos-data':
          console.log('📸 Widget requesting photos data:', event.data.widget);
          this.handlePhotosDataRequest(event.source, event.data);
          break;
          
        case 'refresh-calendar-data':
          console.log('📅 Widget requesting calendar refresh:', event.data.widget);
          this.refreshCalendarData(true);
          break;
          
        case 'refresh-photos-data':
          console.log('📸 Widget requesting photos refresh:', event.data.widget);
          this.refreshPhotosData(true);
          break;
      }
    });
  }

  // NEW: Handle calendar data requests
  async handleCalendarDataRequest(widgetWindow, requestData) {
    const cacheData = this.dataCache.calendar;
    
    // Check if we have fresh data
    const now = Date.now();
    const isDataFresh = cacheData.lastUpdated && 
                       (now - cacheData.lastUpdated) < cacheData.refreshInterval;
    
    if (isDataFresh && cacheData.events.length > 0) {
      console.log('📅 Sending cached calendar data to widget');
      this.sendCalendarDataToWidget(widgetWindow, cacheData);
      return;
    }
    
    // If data is stale or missing, queue the request and fetch fresh data
    this.pendingWidgetRequests.push({
      type: 'calendar',
      window: widgetWindow,
      requestData: requestData,
      timestamp: now
    });
    
    await this.refreshCalendarData();
  }

  // NEW: Handle photos data requests
  async handlePhotosDataRequest(widgetWindow, requestData) {
    const cacheData = this.dataCache.photos;
    
    // Check if we have fresh data
    const now = Date.now();
    const isDataFresh = cacheData.lastUpdated && 
                       (now - cacheData.lastUpdated) < cacheData.refreshInterval;
    
    if (isDataFresh && (cacheData.albums.length > 0 || cacheData.recentPhotos.length > 0)) {
      console.log('📸 Sending cached photos data to widget');
      this.sendPhotosDataToWidget(widgetWindow, cacheData);
      return;
    }
    
    // If data is stale or missing, queue the request and fetch fresh data
    this.pendingWidgetRequests.push({
      type: 'photos',
      window: widgetWindow,
      requestData: requestData,
      timestamp: now
    });
    
    await this.refreshPhotosData();
  }

  // NEW: Refresh calendar data
  async refreshCalendarData(forceRefresh = false) {
    if (!this.googleAPI) {
      console.warn('📅 ❌ No Google API client available for calendar refresh');
      return;
    }
    
    const cacheData = this.dataCache.calendar;
    
    // Prevent multiple simultaneous refreshes
    if (cacheData.isLoading && !forceRefresh) {
      console.log('📅 Calendar refresh already in progress');
      return;
    }
    
    cacheData.isLoading = true;
    console.log('📅 🔄 Refreshing calendar data...');
    
    try {
      const calendarData = await this.googleAPI.getAllCalendarEvents();
      
      // Update cache
      cacheData.events = calendarData || [];
      cacheData.calendars = []; // This would be populated if needed
      cacheData.lastUpdated = Date.now();
      cacheData.isLoading = false;
      
      console.log(`📅 ✅ Calendar data refreshed: ${cacheData.events.length} events`);
      
      // Send data to pending widgets
      this.processPendingRequests('calendar');
      
      // Set up auto-refresh
      this.scheduleDataRefresh('calendar');
      
    } catch (error) {
      console.error('📅 ❌ Calendar data refresh failed:', error);
      cacheData.isLoading = false;
      
      // Send error to pending widgets
      this.sendErrorToPendingWidgets('calendar', error.message);
    }
  }

  // NEW: Refresh photos data
  async refreshPhotosData(forceRefresh = false) {
    if (!this.googleAPI) {
      console.warn('📸 ❌ No Google API client available for photos refresh');
      return;
    }
    
    const cacheData = this.dataCache.photos;
    
    // Prevent multiple simultaneous refreshes
    if (cacheData.isLoading && !forceRefresh) {
      console.log('📸 Photos refresh already in progress');
      return;
    }
    
    cacheData.isLoading = true;
    console.log('📸 🔄 Refreshing photos data...');
    
    try {
      // Fetch both albums and recent photos
      const [albums, recentPhotos] = await Promise.all([
        this.googleAPI.getPhotoAlbums(),
        this.googleAPI.getRecentPhotos(50)
      ]);
      
      // Update cache
      cacheData.albums = albums || [];
      cacheData.recentPhotos = recentPhotos.photos || [];
      cacheData.lastUpdated = Date.now();
      cacheData.isLoading = false;
      
      console.log(`📸 ✅ Photos data refreshed: ${cacheData.albums.length} albums, ${cacheData.recentPhotos.length} recent photos`);
      
      // Send data to pending widgets
      this.processPendingRequests('photos');
      
      // Set up auto-refresh
      this.scheduleDataRefresh('photos');
      
    } catch (error) {
      console.error('📸 ❌ Photos data refresh failed:', error);
      cacheData.isLoading = false;
      
      // Send error to pending widgets
      this.sendErrorToPendingWidgets('photos', error.message);
    }
  }

  // NEW: Process pending widget requests
  processPendingRequests(dataType) {
    const pendingRequests = this.pendingWidgetRequests.filter(req => req.type === dataType);
    
    if (pendingRequests.length === 0) return;
    
    console.log(`📊 Processing ${pendingRequests.length} pending ${dataType} requests`);
    
    pendingRequests.forEach(request => {
      if (dataType === 'calendar') {
        this.sendCalendarDataToWidget(request.window, this.dataCache.calendar);
      } else if (dataType === 'photos') {
        this.sendPhotosDataToWidget(request.window, this.dataCache.photos);
      }
    });
    
    // Remove processed requests
    this.pendingWidgetRequests = this.pendingWidgetRequests.filter(req => req.type !== dataType);
  }

  // NEW: Send calendar data to widget
  sendCalendarDataToWidget(widgetWindow, cacheData) {
    if (!widgetWindow) return;
    
    try {
      widgetWindow.postMessage({
        type: 'calendar-data-ready',
        data: {
          events: cacheData.events,
          calendars: cacheData.calendars,
          lastUpdated: cacheData.lastUpdated,
          status: 'success'
        },
        timestamp: Date.now()
      }, '*');
      
      console.log('📅 📤 Calendar data sent to widget');
    } catch (error) {
      console.error('📅 ❌ Failed to send calendar data to widget:', error);
    }
  }

  // NEW: Send photos data to widget
  sendPhotosDataToWidget(widgetWindow, cacheData) {
    if (!widgetWindow) return;
    
    try {
      widgetWindow.postMessage({
        type: 'photos-data-ready',
        data: {
          albums: cacheData.albums,
          recentPhotos: cacheData.recentPhotos,
          lastUpdated: cacheData.lastUpdated,
          status: 'success'
        },
        timestamp: Date.now()
      }, '*');
      
      console.log('📸 📤 Photos data sent to widget');
    } catch (error) {
      console.error('📸 ❌ Failed to send photos data to widget:', error);
    }
  }

  // NEW: Send errors to pending widgets
  sendErrorToPendingWidgets(dataType, errorMessage) {
    const pendingRequests = this.pendingWidgetRequests.filter(req => req.type === dataType);
    
    pendingRequests.forEach(request => {
      try {
        request.window.postMessage({
          type: `${dataType}-data-ready`,
          data: {
            events: dataType === 'calendar' ? [] : undefined,
            calendars: dataType === 'calendar' ? [] : undefined,
            albums: dataType === 'photos' ? [] : undefined,
            recentPhotos: dataType === 'photos' ? [] : undefined,
            status: 'error',
            error: errorMessage
          },
          timestamp: Date.now()
        }, '*');
      } catch (error) {
        console.error(`Failed to send error to ${dataType} widget:`, error);
      }
    });
    
    // Remove error requests
    this.pendingWidgetRequests = this.pendingWidgetRequests.filter(req => req.type !== dataType);
  }

  // NEW: Schedule automatic data refresh
  scheduleDataRefresh(dataType) {
    // Clear existing timer
    if (this.refreshTimers[dataType]) {
      clearTimeout(this.refreshTimers[dataType]);
    }
    
    const refreshInterval = this.dataCache[dataType].refreshInterval;
    
    this.refreshTimers[dataType] = setTimeout(() => {
      console.log(`⏰ Auto-refreshing ${dataType} data`);
      if (dataType === 'calendar') {
        this.refreshCalendarData();
      } else if (dataType === 'photos') {
        this.refreshPhotosData();
      }
    }, refreshInterval);
    
    console.log(`⏰ Scheduled ${dataType} refresh in ${Math.round(refreshInterval / 1000 / 60)} minutes`);
  }

  // Public methods for manual data refresh
  async refreshData(dataType = 'all') {
    if (dataType === 'all' || dataType === 'calendar') {
      await this.refreshCalendarData(true);
    }
    if (dataType === 'all' || dataType === 'photos') {
      await this.refreshPhotosData(true);
    }
  }

  // Get cached data
  getCachedData(dataType) {
    if (dataType === 'calendar') {
      return {
        ...this.dataCache.calendar,
        isStale: this.isDataStale('calendar')
      };
    } else if (dataType === 'photos') {
      return {
        ...this.dataCache.photos,
        isStale: this.isDataStale('photos')
      };
    }
    return null;
  }

  // Check if data is stale
  isDataStale(dataType) {
    const cacheData = this.dataCache[dataType];
    if (!cacheData.lastUpdated) return true;
    
    const now = Date.now();
    return (now - cacheData.lastUpdated) > cacheData.refreshInterval;
  }
}
