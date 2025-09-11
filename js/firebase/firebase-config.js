// js/firebase/firebase-config.js - Firebase Configuration

// Import Firebase SDKs
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBSDQEVWmeiV7SzIT-XVhPRTO8E4RRvEXM",
  authDomain: "be-dashie.firebaseapp.com",
  projectId: "be-dashie",
  storageBucket: "be-dashie.firebasestorage.app",
  messagingSenderId: "157124384932",
  appId: "1:157124384932:web:73ffb70a482b98892a2e31",
  measurementId: "G-J1Z2YDYYYE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);

// Development mode - connect to emulators if running locally
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  console.log('🔥 Using Firebase emulators for development');
  
  // Connect to Firestore emulator
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
  } catch (e) {
    console.log('Firestore emulator already connected or not available');
  }
  
  // Connect to Auth emulator  
  try {
    connectAuthEmulator(auth, 'http://localhost:9099');
  } catch (e) {
    console.log('Auth emulator already connected or not available');
  }
}

console.log('🔥 Firebase initialized successfully');
