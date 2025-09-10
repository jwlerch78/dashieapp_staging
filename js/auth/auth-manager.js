// js/auth/auth-manager.js - Main Authentication Controller

import { NativeAuth } from './native-auth.js';
import { WebAuth } from './web-auth.js';
import { AuthUI } from './auth-ui.js';
import { AuthStorage } from './auth-storage.js';

export class AuthManager {
  constructor() {
    this.currentUser = null;
    this.isSignedIn = false;
    this.isWebView = this.detectWebView();
    this.hasNativeAuth = this.detectNativeAuth();
    
    // Initialize auth modules
    this.storage = new AuthStorage();
    this.ui = new AuthUI();
    this.nativeAuth = this.hasNativeAuth ? new NativeAuth() : null;
    this.webAuth = new WebAuth();
    
    this.init();
  }

  detectWebView() {
    const userAgent = navigator.userAgent;
    const isAndroidWebView = /wv/.test(userAgent) || 
                           /Android.*AppleWebKit(?!.*Chrome)/.test(userAgent) ||
                           userAgent.includes('DashieApp');
    const isIOSWebView = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/.test(userAgent);
    
    console.log('🔐 Environment detection:', {
      userAgent: userAgent,
      isAndroidWebView: isAndroidWebView,
      isIOSWebView: isIOSWebView,
      isWebView: isAndroidWebView || isIOSWebView
    });
    
    return isAndroidWebView || isIOSWebView;
  }

detectNativeAuth() {
  const hasNative = window.DashieNative && 
                   typeof window.DashieNative.signIn === 'function';
  console.log('🔐 Native auth available:', hasNative); // This should be true/false, not undefined
  return !!hasNative; // Force boolean conversion
}

  async init() {
    console.log('🔐 Initializing AuthManager...');
    console.log('🔐 Environment:', {
      isWebView: this.isWebView,
      hasNativeAuth: this.hasNativeAuth
    });

    // Set up native auth handler
    window.handleNativeAuth = (result) => this.handleNativeAuthResult(result);
    
    // Check for existing authentication first
    this.checkExistingAuth();
    
    // Initialize appropriate auth method
    if (this.hasNativeAuth) {
      console.log('🔐 Using native Android authentication');
      await this.nativeAuth.init();
      this.checkNativeUser();
    } else if (this.isWebView) {
      console.log('🔐 WebView without native auth - showing WebView prompt');
      this.ui.showWebViewAuthPrompt(() => this.createWebViewUser());
} else {
  console.log('🔐 Browser environment - initializing web auth');
  try {
    await this.webAuth.init();
    // Don't call checkExistingAuth() again - we already did it above
    // Instead, show sign-in prompt since web auth is a stub
    this.ui.showSignInPrompt(() => this.signIn(), () => this.exitApp());
  } catch (error) {
    console.error('🔐 Web auth initialization failed:', error);
    this.handleAuthFailure(error);
  }
}
  }

  checkExistingAuth() {
    const savedUser = this.storage.getSavedUser();
    if (savedUser) {
      console.log('🔐 Found saved user:', savedUser.name);
      this.currentUser = savedUser;
      this.isSignedIn = true;
      this.ui.showSignedInState();
    }
  }

  checkNativeUser() {
    if (this.nativeAuth) {
      const userData = this.nativeAuth.getCurrentUser();
      if (userData) {
        this.setUserFromAuth(userData, 'native');
        this.ui.showSignedInState();
        console.log('🔐 Found native user:', this.currentUser.name);
        return;
      }
    }
    
    // No native user found, show sign-in prompt
    this.ui.showSignInPrompt(() => this.signIn());
  }

  handleNativeAuthResult(result) {
    console.log('🔐 Native auth result received:', result);
    
    if (result.success && result.user) {
      this.setUserFromAuth(result.user, 'native');
      this.isSignedIn = true;
      this.storage.saveUser(this.currentUser);
      this.ui.showSignedInState();
      console.log('🔐 ✅ Native auth successful:', this.currentUser.name);
    } else {
      console.error('🔐 ❌ Native auth failed:', result.error);
      if (result.error && result.error !== 'Sign-in was cancelled') {
        this.ui.showAuthError(result.error || 'Native authentication failed');
      }
    }
  }

  setUserFromAuth(userData, authMethod) {
    this.currentUser = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      picture: userData.picture,
      signedInAt: Date.now(),
      authMethod: authMethod
    };
  }

  createWebViewUser() {
    console.log('🔐 Creating WebView user');
    
    this.currentUser = {
      id: 'webview-user-' + Date.now(),
      name: 'Dashie User',
      email: 'user@dashie.app',
      picture: 'icons/icon-profile-round.svg',
      signedInAt: Date.now(),
      authMethod: 'webview'
    };
    
    this.isSignedIn = true;
    this.storage.saveUser(this.currentUser);
    this.ui.showSignedInState();
    
    console.log('🔐 WebView user created:', this.currentUser.name);
  }

  async signIn() {
    console.log('🔐 Starting sign-in process...');
    
    if (this.hasNativeAuth && this.nativeAuth) {
      this.nativeAuth.signIn();
    } else if (this.webAuth) {
      try {
        await this.webAuth.signIn();
      } catch (error) {
        console.error('🔐 Web sign-in failed:', error);
        this.ui.showAuthError('Sign-in failed. Please try again.');
      }
    } else {
      this.ui.showAuthError('No authentication method available.');
    }
  }

  signOut() {
    console.log('🔐 Signing out...');
    
    if (this.hasNativeAuth && this.nativeAuth) {
      this.nativeAuth.signOut();
    }
    
    if (this.webAuth) {
      this.webAuth.signOut();
    }
    
    this.currentUser = null;
    this.isSignedIn = false;
    this.storage.clearSavedUser();
    this.ui.showSignInPrompt(() => this.signIn());
  }

  exitApp() {
    console.log('🚪 Exiting Dashie...');
    
    if (this.hasNativeAuth && window.DashieNative?.exitApp) {
      window.DashieNative.exitApp();
    } else if (window.close) {
      window.close();
    } else {
      window.location.href = 'about:blank';
    }
  }

  handleAuthFailure(error) {
    console.error('🔐 Auth initialization failed:', error);
    
    const savedUser = this.storage.getSavedUser();
    if (savedUser) {
      console.log('🔐 Using saved authentication as fallback');
      this.currentUser = savedUser;
      this.isSignedIn = true;
      this.ui.showSignedInState();
    } else {
      if (this.isWebView) {
        this.ui.showWebViewAuthPrompt(() => this.createWebViewUser());
      } else {
        this.ui.showAuthError('Authentication service is currently unavailable.', true);
      }
    }
  }

  // Public API
  getUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return this.isSignedIn && this.currentUser !== null;
  }
}
