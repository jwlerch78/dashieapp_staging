// js/utils/platform-detector.js - Platform Detection Utilities
// CHANGE SUMMARY: Extracted platform detection logic from auth-manager into reusable utility

import { createLogger } from './logger.js';

const logger = createLogger('PlatformDetector');

/**
 * Platform detection and capability analysis for Dashie Dashboard
 * Centralizes all platform-specific logic and feature detection
 */

/**
 * Platform types enum
 */
export const PLATFORMS = {
  BROWSER: 'browser',
  ANDROID_WEBVIEW: 'android_webview',
  ANDROID_NATIVE: 'android_native',
  IOS_WEBVIEW: 'ios_webview',
  FIRE_TV: 'fire_tv',
  CHROME_TV: 'chrome_tv',
  SAMSUNG_TV: 'samsung_tv',
  LG_TV: 'lg_tv',
  UNKNOWN: 'unknown'
};

/**
 * Device type categories
 */
export const DEVICE_TYPES = {
  DESKTOP: 'desktop',
  MOBILE: 'mobile',
  TABLET: 'tablet',
  TV: 'tv',
  UNKNOWN: 'unknown'
};

/**
 * Input method capabilities
 */
export const INPUT_METHODS = {
  MOUSE: 'mouse',
  TOUCH: 'touch',
  KEYBOARD: 'keyboard',
  DPAD: 'dpad',
  REMOTE: 'remote'
};

/**
 * Main platform detection class
 */
export class PlatformDetector {
  constructor() {
    this.userAgent = navigator.userAgent;
    this.platform = this.detectPlatform();
    this.deviceType = this.detectDeviceType();
    this.capabilities = this.detectCapabilities();
    
    logger.debug('Platform detection complete', {
      platform: this.platform,
      deviceType: this.deviceType,
      userAgent: this.userAgent,
      capabilities: this.capabilities
    });
  }

  /**
   * Detect the specific platform/runtime environment
   * @returns {string} Platform identifier
   */
  detectPlatform() {
    const ua = this.userAgent;
    
    // Fire TV detection (Amazon devices)
    if (ua.includes('AFTS') || ua.includes('FireTV') || 
        ua.includes('AFT') || ua.includes('AFTMM') ||
        ua.includes('AFTRS') || ua.includes('AFTSS')) {
      return PLATFORMS.FIRE_TV;
    }

    // Android TV / Google TV detection
    if (ua.includes('Android') && (ua.includes('TV') || ua.includes('GoogleTV'))) {
      return PLATFORMS.CHROME_TV;
    }

    // Samsung TV detection
    if (ua.includes('Samsung') && (ua.includes('SmartTV') || ua.includes('Tizen'))) {
      return PLATFORMS.SAMSUNG_TV;
    }

    // LG TV detection
    if (ua.includes('LG') && (ua.includes('webOS') || ua.includes('NetCast'))) {
      return PLATFORMS.LG_TV;
    }

    // Android WebView detection
    if (this.isAndroidWebView()) {
      // Check if we have native Dashie capabilities
      if (this.hasNativeCapabilities()) {
        return PLATFORMS.ANDROID_NATIVE;
      } else {
        return PLATFORMS.ANDROID_WEBVIEW;
      }
    }

    // iOS WebView detection
    if (this.isIOSWebView()) {
      return PLATFORMS.IOS_WEBVIEW;
    }

    // Default to browser
    return PLATFORMS.BROWSER;
  }

  /**
   * Detect Android WebView environment
   * @returns {boolean} True if Android WebView
   */
  isAndroidWebView() {
    const ua = this.userAgent;
    return /wv/.test(ua) || 
           /Android.*AppleWebKit(?!.*Chrome)/.test(ua) ||
           ua.includes('DashieApp');
  }

  /**
   * Detect iOS WebView environment
   * @returns {boolean} True if iOS WebView
   */
  isIOSWebView() {
    const ua = this.userAgent;
    return /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/.test(ua);
  }

  /**
   * Check for native Dashie app capabilities
   * @returns {boolean} True if native capabilities are available
   */
  hasNativeCapabilities() {
    return window.DashieNative && 
           typeof window.DashieNative.signIn === 'function';
  }

  /**
   * Detect general device type
   * @returns {string} Device type identifier
   */
  detectDeviceType() {
    const ua = this.userAgent;

    // TV devices
    if (ua.includes('TV') || ua.includes('FireTV') || 
        ua.includes('GoogleTV') || ua.includes('SmartTV') ||
        ua.includes('webOS') || ua.includes('Tizen') ||
        ua.includes('AFT')) {
      return DEVICE_TYPES.TV;
    }

    // Mobile devices
    if (/Mobile|Android|iPhone|iPod/.test(ua)) {
      return DEVICE_TYPES.MOBILE;
    }

    // Tablet devices
    if (/iPad|Tablet/.test(ua)) {
      return DEVICE_TYPES.TABLET;
    }

    // Default to desktop
    return DEVICE_TYPES.DESKTOP;
  }

  /**
   * Detect platform capabilities and limitations
   * @returns {Object} Capabilities object
   */
  detectCapabilities() {
    const capabilities = {
      inputMethods: this.detectInputMethods(),
      authMethods: this.detectAuthMethods(),
      features: this.detectFeatures(),
      limitations: this.detectLimitations()
    };

    return capabilities;
  }

  /**
   * Detect available input methods
   * @returns {Array} Array of available input methods
   */
  detectInputMethods() {
    const methods = [];

    // Mouse support (desktop browsers)
    if (this.deviceType === DEVICE_TYPES.DESKTOP) {
      methods.push(INPUT_METHODS.MOUSE);
    }

    // Touch support
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      methods.push(INPUT_METHODS.TOUCH);
    }

    // Keyboard support (most platforms)
    methods.push(INPUT_METHODS.KEYBOARD);

    // D-pad/Remote support for TV devices
    if (this.deviceType === DEVICE_TYPES.TV) {
      methods.push(INPUT_METHODS.DPAD);
      methods.push(INPUT_METHODS.REMOTE);
    }

    return methods;
  }

  /**
   * Detect available authentication methods
   * @returns {Array} Array of available auth methods
   */
  detectAuthMethods() {
    const methods = [];

    // Native auth (Android app)
    if (this.hasNativeCapabilities() && this.platform !== PLATFORMS.FIRE_TV) {
      methods.push('native');
    }

    // Web OAuth (browsers and most WebViews)
    if (this.platform === PLATFORMS.BROWSER || 
        this.platform === PLATFORMS.ANDROID_WEBVIEW ||
        this.platform === PLATFORMS.IOS_WEBVIEW) {
      methods.push('web_oauth');
    }

    // Device flow (TV devices and limited input environments)
    if (this.deviceType === DEVICE_TYPES.TV || 
        this.platform === PLATFORMS.FIRE_TV) {
      methods.push('device_flow');
    }

    return methods;
  }

  /**
   * Detect platform-specific features
   * @returns {Object} Features object
   */
  detectFeatures() {
    return {
      localStorage: this.hasLocalStorage(),
      sessionStorage: this.hasSessionStorage(),
      webGL: this.hasWebGL(),
      geolocation: this.hasGeolocation(),
      notifications: this.hasNotifications(),
      serviceWorker: this.hasServiceWorker(),
      fullscreen: this.hasFullscreen(),
      pictureInPicture: this.hasPictureInPicture()
    };
  }

  /**
   * Detect platform limitations
   * @returns {Object} Limitations object
   */
  detectLimitations() {
    return {
      limitedInput: this.deviceType === DEVICE_TYPES.TV,
      restrictedAuth: this.platform === PLATFORMS.IOS_WEBVIEW,
      noPopups: this.isWebView(),
      limitedStorage: this.isIncognito(),
      noFileAccess: this.isWebView() && this.platform === PLATFORMS.IOS_WEBVIEW
    };
  }

  /**
   * Check if running in any WebView environment
   * @returns {boolean} True if WebView
   */
  isWebView() {
    return this.platform === PLATFORMS.ANDROID_WEBVIEW ||
           this.platform === PLATFORMS.IOS_WEBVIEW ||
           this.platform === PLATFORMS.ANDROID_NATIVE;
  }

  /**
   * Check if running on a TV platform
   * @returns {boolean} True if TV platform
   */
  isTV() {
    return this.deviceType === DEVICE_TYPES.TV;
  }

  /**
   * Check if running on a mobile device
   * @returns {boolean} True if mobile
   */
  isMobile() {
    return this.deviceType === DEVICE_TYPES.MOBILE;
  }

  /**
   * Feature detection methods
   */
  hasLocalStorage() {
    try {
      return typeof Storage !== 'undefined' && window.localStorage;
    } catch (e) {
      return false;
    }
  }

  hasSessionStorage() {
    try {
      return typeof Storage !== 'undefined' && window.sessionStorage;
    } catch (e) {
      return false;
    }
  }

  hasWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && canvas.getContext('webgl'));
    } catch (e) {
      return false;
    }
  }

  hasGeolocation() {
    return 'geolocation' in navigator;
  }

  hasNotifications() {
    return 'Notification' in window;
  }

  hasServiceWorker() {
    return 'serviceWorker' in navigator;
  }

  hasFullscreen() {
    return document.fullscreenEnabled || 
           document.webkitFullscreenEnabled || 
           document.mozFullScreenEnabled;
  }

  hasPictureInPicture() {
    return 'pictureInPictureEnabled' in document;
  }

  isIncognito() {
    // Simple incognito detection (not 100% reliable)
    try {
      window.localStorage.setItem('test', 'test');
      window.localStorage.removeItem('test');
      return false;
    } catch (e) {
      return true;
    }
  }

  /**
   * Get recommended auth flow for this platform
   * @returns {string} Recommended auth method
   */
  getRecommendedAuthFlow() {

    if (this.hasNativeCapabilities() && this.platform !== PLATFORMS.FIRE_TV) {
      return 'native';
    }
        
    if (this.isTV() || this.platform === PLATFORMS.FIRE_TV) {
      return 'device_flow';
    }

    if (this.platform === PLATFORMS.BROWSER ||
        this.platform === PLATFORMS.ANDROID_WEBVIEW) {
      return 'web_oauth';
    }
    
    // Fallback for limited environments
    return 'mock_user';
  }

  /**
   * Get platform-specific configuration
   * @returns {Object} Configuration object
   */
  getPlatformConfig() {
    return {
      platform: this.platform,
      deviceType: this.deviceType,
      capabilities: this.capabilities,
      recommendedAuthFlow: this.getRecommendedAuthFlow(),
      navigation: {
        supportsDPad: this.capabilities.inputMethods.includes(INPUT_METHODS.DPAD),
        supportsTouch: this.capabilities.inputMethods.includes(INPUT_METHODS.TOUCH),
        supportsMouse: this.capabilities.inputMethods.includes(INPUT_METHODS.MOUSE)
      },
      ui: {
        isTV: this.isTV(),
        isMobile: this.isMobile(),
        isWebView: this.isWebView(),
        needsSimplifiedUI: this.isTV() || this.capabilities.limitations.limitedInput
      }
    };
  }

  /**
   * Get a human-readable platform description
   * @returns {string} Platform description
   */
  getPlatformDescription() {
    const descriptions = {
      [PLATFORMS.BROWSER]: 'Desktop Browser',
      [PLATFORMS.ANDROID_WEBVIEW]: 'Android WebView',
      [PLATFORMS.ANDROID_NATIVE]: 'Android Native App',
      [PLATFORMS.IOS_WEBVIEW]: 'iOS WebView',
      [PLATFORMS.FIRE_TV]: 'Amazon Fire TV',
      [PLATFORMS.CHROME_TV]: 'Android/Google TV',
      [PLATFORMS.SAMSUNG_TV]: 'Samsung Smart TV',
      [PLATFORMS.LG_TV]: 'LG Smart TV',
      [PLATFORMS.UNKNOWN]: 'Unknown Platform'
    };

    return descriptions[this.platform] || 'Unknown Platform';
  }
}

// Create singleton instance
let detectorInstance = null;

/**
 * Get the platform detector instance (singleton)
 * @returns {PlatformDetector} Platform detector instance
 */
export function getPlatformDetector() {
  if (!detectorInstance) {
    detectorInstance = new PlatformDetector();
  }
  return detectorInstance;
}

/**
 * Quick access functions for common platform checks
 */
export const platform = {
  get current() { return getPlatformDetector().platform; },
  get deviceType() { return getPlatformDetector().deviceType; },
  get capabilities() { return getPlatformDetector().capabilities; },
  get config() { return getPlatformDetector().getPlatformConfig(); },
  get description() { return getPlatformDetector().getPlatformDescription(); },
  
  is: {
    browser: () => getPlatformDetector().platform === PLATFORMS.BROWSER,
    webView: () => getPlatformDetector().isWebView(),
    tv: () => getPlatformDetector().isTV(),
    mobile: () => getPlatformDetector().isMobile(),
    fireTV: () => getPlatformDetector().platform === PLATFORMS.FIRE_TV,
    android: () => getPlatformDetector().platform.includes('android'),
    ios: () => getPlatformDetector().platform.includes('ios')
  },
  
  has: {
    nativeAuth: () => getPlatformDetector().hasNativeCapabilities(),
    touch: () => getPlatformDetector().capabilities.inputMethods.includes(INPUT_METHODS.TOUCH),
    dpad: () => getPlatformDetector().capabilities.inputMethods.includes(INPUT_METHODS.DPAD),
    localStorage: () => getPlatformDetector().capabilities.features.localStorage
  }
};

// Default export
export default {
  PlatformDetector,
  getPlatformDetector,
  platform,
  PLATFORMS,
  DEVICE_TYPES,
  INPUT_METHODS
};
