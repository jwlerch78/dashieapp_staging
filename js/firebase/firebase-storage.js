// js/firebase/firebase-storage.js - Enhanced Cloud Settings Storage with Auth Bridge

import { db } from './firebase-config.js';
import { FirebaseAuthBridge } from './firebase-auth-bridge.js';
import { 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp,
  onSnapshot 
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

export class FirebaseSettingsStorage {
  constructor(userId) {
    this.userId = userId;
    this.localStorageKey = 'dashie-settings';
    this.listeners = new Map();
    this.isOnline = navigator.onLine;
    this.authBridge = new FirebaseAuthBridge();
    this.firebaseAuthReady = false;
    
    // Initialize Firebase auth
    this.initializeFirebaseAuth();
    
    // Listen for online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingChanges();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  async initializeFirebaseAuth() {
    try {
      // Get the Google ID token from your existing auth system
      const currentUser = window.dashieAuth?.getUser();
      if (currentUser && currentUser.id) {
        // For now, we'll work without Firebase Auth integration
        // This is a temporary solution until we can get the Google ID token
        this.firebaseAuthReady = true;
        console.log('🔥 Using user ID for Firestore access:', currentUser.id);
      }
    } catch (error) {
      console.warn('🔥 Firebase Auth initialization skipped:', error);
      this.firebaseAuthReady = true; // Continue without Firebase Auth for now
    }
  }

  // Save settings with hybrid approach (local + cloud)
  async saveSettings(settings) {
    console.log('💾 Saving settings for user:', this.userId);
    
    // Always save locally first (immediate)
    this.saveToLocalStorage(settings);
    
    // Try to save to cloud (background)
    if (this.isOnline) {
      try {
        await this.saveToFirestore(settings);
        console.log('☁️ Settings synced to cloud');
      } catch (error) {
        console.warn('☁️ Cloud sync failed, will retry when online:', error);
        
        // Check if it's a permission error
        if (error.code === 'permission-denied') {
          console.warn('🔒 Permission denied - check Firestore security rules');
          console.warn('💡 Tip: Make sure security rules allow access for authenticated users');
        }
        
        this.markForRetry(settings);
      }
    } else {
      console.log('📴 Offline - settings will sync when online');
      this.markForRetry(settings);
    }
  }

  // Load settings with fallback strategy
  async loadSettings() {
    console.log('📖 Loading settings for user:', this.userId);
    
    try {
      // Try cloud first if online
      if (this.isOnline && this.firebaseAuthReady) {
        const cloudSettings = await this.loadFromFirestore();
        if (cloudSettings) {
          // Update local cache with cloud data
          this.saveToLocalStorage(cloudSettings);
          console.log('☁️ Settings loaded from cloud');
          return cloudSettings;
        }
      }
    } catch (error) {
      console.warn('☁️ Cloud load failed, using local storage:', error);
      
      // Log helpful error messages
      if (error.code === 'permission-denied') {
        console.warn('🔒 Permission denied - check Firestore security rules');
        console.warn('💡 Current user ID:', this.userId);
        console.warn('💡 Make sure Firestore rules allow access for this user');
      }
    }

    // Fallback to local storage
    const localSettings = this.loadFromLocalStorage();
    if (localSettings) {
      console.log('💾 Settings loaded from local storage');
      return localSettings;
    }

    console.log('🆕 No saved settings found, using defaults');
    return null;
  }

  // Set up real-time sync for settings changes from other devices
  subscribeToSettingsChanges(callback) {
    if (!this.userId || !this.firebaseAuthReady) return null;

    try {
      const userDoc = doc(db, 'users', this.userId, 'settings', 'dashboard');
      
      const unsubscribe = onSnapshot(userDoc, (doc) => {
        if (doc.exists()) {
          const cloudSettings = doc.data();
          const localSettings = this.loadFromLocalStorage();
          
          // Only update if cloud version is newer
          if (!localSettings || cloudSettings.lastModified > (localSettings.lastModified || 0)) {
            console.log('🔄 Settings updated from another device');
            this.saveToLocalStorage(cloudSettings);
            callback(cloudSettings);
          }
        }
      }, (error) => {
        console.warn('Real-time sync error:', error);
        if (error.code === 'permission-denied') {
          console.warn('🔒 Real-time sync disabled due to permissions');
        }
      });

      this.listeners.set('settings', unsubscribe);
      return unsubscribe;
    } catch (error) {
      console.warn('Failed to set up real-time sync:', error);
      return null;
    }
  }

  // Ensure user document exists
  async ensureUserDocument() {
    if (!this.userId) return;

    try {
      const userRef = doc(db, 'users', this.userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        // Get current user info from auth system
        const currentUser = window.dashieAuth?.getUser();
        
        await setDoc(userRef, {
          id: this.userId,
          name: currentUser?.name || 'Dashie User',
          email: currentUser?.email || '',
          picture: currentUser?.picture || '',
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        });
        
        console.log('✨ Created new user document');
      } else {
        // Update last login
        await setDoc(userRef, {
          lastLogin: serverTimestamp()
        }, { merge: true });
      }
    } catch (error) {
      console.warn('Failed to ensure user document:', error);
      if (error.code === 'permission-denied') {
        console.warn('🔒 Cannot create user document - check Firestore security rules');
      }
    }
  }

  // Private methods
  saveToLocalStorage(settings) {
    try {
      const dataToSave = {
        ...settings,
        lastModified: Date.now()
      };
      localStorage.setItem(this.localStorageKey, JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Local storage save failed:', error);
    }
  }

  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem(this.localStorageKey);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('Local storage load failed:', error);
      return null;
    }
  }

  async saveToFirestore(settings) {
    if (!this.userId) throw new Error('No user ID');

    const settingsRef = doc(db, 'users', this.userId, 'settings', 'dashboard');
    const dataToSave = {
      ...settings,
      lastModified: Date.now(),
      updatedAt: serverTimestamp()
    };

    await setDoc(settingsRef, dataToSave, { merge: true });
  }

  async loadFromFirestore() {
    if (!this.userId) return null;

    const settingsRef = doc(db, 'users', this.userId, 'settings', 'dashboard');
    const settingsDoc = await getDoc(settingsRef);

    return settingsDoc.exists() ? settingsDoc.data() : null;
  }

  markForRetry(settings) {
    try {
      localStorage.setItem('dashie-settings-pending', JSON.stringify({
        settings,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to mark for retry:', error);
    }
  }

  async syncPendingChanges() {
    try {
      const pending = localStorage.getItem('dashie-settings-pending');
      if (pending) {
        const { settings } = JSON.parse(pending);
        await this.saveToFirestore(settings);
        localStorage.removeItem('dashie-settings-pending');
        console.log('✅ Synced pending settings changes');
      }
    } catch (error) {
      console.warn('Failed to sync pending changes:', error);
    }
  }

  // Cleanup
  unsubscribeAll() {
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners.clear();
  }
}
