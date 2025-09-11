// js/firebase/firebase-config.js - Firebase Configuration

// Import Firebase SDKs
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

// Your Firebase config from Firebase Console
const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
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
