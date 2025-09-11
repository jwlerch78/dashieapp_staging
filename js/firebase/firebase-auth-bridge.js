// js/firebase/firebase-auth-bridge.js - Bridge between your auth and Firebase Auth

import { auth } from './firebase-config.js';
import { signInWithCredential, GoogleAuthProvider, signOut } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

export class FirebaseAuthBridge {
  constructor() {
    this.isFirebaseSignedIn = false;
  }

  // Sign into Firebase using your existing Google OAuth token
  async signIntoFirebase(googleIdToken) {
    try {
      console.log('🔥 Signing into Firebase with Google token...');
      
      // Create Firebase credential from your Google ID token
      const credential = GoogleAuthProvider.credential(googleIdToken);
      
      // Sign into Firebase
      const result = await signInWithCredential(auth, credential);
      
      this.isFirebaseSignedIn = true;
      console.log('🔥 ✅ Firebase Auth successful:', result.user.email);
      
      return result.user;
    } catch (error) {
      console.error('🔥 ❌ Firebase Auth failed:', error);
      throw error;
    }
  }

  // Sign out of Firebase
  async signOutOfFirebase() {
    try {
      await signOut(auth);
      this.isFirebaseSignedIn = false;
      console.log('🔥 Firebase sign-out successful');
    } catch (error) {
      console.error('🔥 Firebase sign-out failed:', error);
    }
  }

  // Get current Firebase user
  getCurrentFirebaseUser() {
    return auth.currentUser;
  }

  // Check if signed into Firebase
  isSignedIntoFirebase() {
    return this.isFirebaseSignedIn && auth.currentUser !== null;
  }
}
