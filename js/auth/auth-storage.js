// js/auth/auth-storage.js - User Data Persistence

export class AuthStorage {
  constructor() {
    this.storageKey = 'dashie-user';
    this.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  }

  saveUser(userData) {
    try {
      const dataToSave = {
        ...userData,
        savedAt: Date.now()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(dataToSave));
      console.log('💾 User data saved:', userData.name);
    } catch (error) {
      console.error('💾 Failed to save user data:', error);
    }
  }

  getSavedUser() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const userData = JSON.parse(saved);
        const now = Date.now();
        
        // Check if data is still valid (not expired)
        if (userData.savedAt && (now - userData.savedAt < this.maxAge)) {
          console.log('💾 Loaded saved user:', userData.name);
          return userData;
        } else {
          console.log('💾 Saved user data expired, removing...');
          this.clearSavedUser();
        }
      }
    } catch (error) {
      console.error('💾 Failed to load user data:', error);
    }
    return null;
  }

  clearSavedUser() {
    try {
      localStorage.removeItem(this.storageKey);
      console.log('💾 User data cleared');
    } catch (error) {
      console.error('💾 Failed to clear user data:', error);
    }
  }

  isUserValid(userData) {
    if (!userData) return false;
    
    const requiredFields = ['id', 'name', 'email'];
    return requiredFields.every(field => userData[field]);
  }
}
