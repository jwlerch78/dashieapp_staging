# Dashie iOS App Development Guide

**Last Updated:** October 23, 2025  
**Project:** Dashie Smart Home Dashboard  
**Goal:** Convert existing web app to native iOS app with location services and background photo sync

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Prerequisites & Requirements](#prerequisites--requirements)
3. [Environment Setup](#environment-setup)
4. [Capacitor Integration](#capacitor-integration)
5. [iOS-Specific Features](#ios-specific-features)
6. [Build & Deployment](#build--deployment)
7. [Ongoing Maintenance](#ongoing-maintenance)

---

## Project Overview

### Current State
- **Platform:** Web-based dashboard (HTML/CSS/JavaScript)
- **Architecture:** Modular, event-driven, iframe-based widgets
- **Codebase:** ~27,300 lines across 75 files
- **Backend:** Supabase (PostgreSQL + Storage)
- **Auth:** OAuth2 (Google), JWT
- **Target Devices:** Fire TV, Desktop browsers, Mobile devices

### iOS App Goals
1. Native iOS app wrapping existing web functionality
2. Real-time location sharing capabilities
3. Background photo synchronization
4. App Store distribution
5. Maintain single codebase for web + iOS

### Why Capacitor?
- **Free & Open Source** (MIT licensed)
- Minimal changes to existing web code (~95% reusable)
- Access to native iOS APIs via JavaScript
- Single codebase for web, iOS, and Android
- Large plugin ecosystem
- Easy to keep web and native versions in sync

---

## Prerequisites & Requirements

### Hardware Requirements
- **Mac Computer** (required for iOS development)
  - **Recommended:** MacBook Air M2/M3 or newer
  - **Minimum Specs:**
    - 16GB RAM (for Xcode + iOS Simulator + development tools)
    - 512GB storage (Xcode and iOS tools require significant space)
  - **Note:** MacBook Pro is overkill for this project; Air is sufficient

### Software Requirements
- **macOS:** Latest version (Sonoma 14.0+ or Sequoia 15.0+)
- **Xcode:** Version 15.0+ (download from Mac App Store - free, ~15GB)
- **Xcode Command Line Tools**
- **Node.js:** Version 18+ (for Capacitor CLI)
- **CocoaPods:** iOS dependency manager (auto-installed with Xcode)

### Account Requirements
- **Apple Developer Account:** $99/year (required for App Store distribution)
  - Individual or Organization account
  - Required for:
    - Installing apps on physical iOS devices
    - App Store submission
    - Push notifications
    - Background services
- **Google Account:** For accessing existing Dashie web app and testing

### Cost Summary
| Item | Cost | Frequency | Required |
|------|------|-----------|----------|
| Capacitor Core | $0 | One-time | ✅ Yes |
| MacBook Air | $1,099+ | One-time | ✅ Yes |
| Apple Developer Account | $99 | Annual | ✅ Yes |
| Google Play Developer (Android) | $25 | One-time | ⚠️ Optional |
| Appflow (CI/CD) | $25-99/mo | Monthly | ❌ Optional |
| **Total Required (Year 1)** | **~$1,200** | | |
| **Total Required (Year 2+)** | **$99** | | |

---

## Environment Setup

### Step 1: Install Xcode
```bash
# Download Xcode from Mac App Store (15GB+, takes 30-60 minutes)
# After installation, open Xcode and accept license agreements

# Install Xcode Command Line Tools
xcode-select --install

# Verify installation
xcode-select -p
# Should output: /Applications/Xcode.app/Contents/Developer
```

### Step 2: Install Node.js
```bash
# Option 1: Download from nodejs.org
# Option 2: Use Homebrew
brew install node

# Verify installation
node --version  # Should be 18.0.0 or higher
npm --version   # Should be 9.0.0 or higher
```

### Step 3: Install Capacitor CLI
```bash
# Install Capacitor globally
npm install -g @capacitor/cli

# Verify installation
npx cap --version
```

### Step 4: Verify CocoaPods
```bash
# Check if CocoaPods is installed (comes with Xcode)
pod --version

# If not installed, install via Homebrew
brew install cocoapods
```

### Step 5: Set Up Apple Developer Account
1. Visit [developer.apple.com](https://developer.apple.com)
2. Sign in with Apple ID (or create new account with accessible email)
3. Enroll in Apple Developer Program ($99/year)
4. Complete enrollment process (may take 24-48 hours for approval)
5. Once approved, add your Apple ID to Xcode:
   - Open Xcode → Preferences → Accounts
   - Click "+" → Sign in with Apple ID
   - Download developer certificates

---

## Capacitor Integration

### Step 1: Prepare Existing Dashie Web App
```bash
# Navigate to your Dashie project directory
cd /path/to/dashieapp_staging

# Ensure your web app has a build output directory
# Capacitor needs a folder with your compiled web assets
# Common folder names: dist/, build/, www/, public/

# If you don't have a build process, create one:
# Option 1: Simple copy script
mkdir -p dist
cp index.html dist/
cp -r js dist/
cp -r css dist/
cp -r artwork dist/
cp -r widgets dist/
cp config.js dist/

# Option 2: Add a build script to package.json
# "scripts": {
#   "build": "node build-script.js"
# }
```

### Step 2: Initialize Capacitor
```bash
# Initialize Capacitor in your project
npm install @capacitor/core @capacitor/cli

# Initialize Capacitor (this creates capacitor.config.ts)
npx cap init

# You'll be prompted for:
# - App name: "Dashie"
# - App ID: "com.dashie.app" (use your own domain if you have one)
# - Web asset directory: "dist" (or wherever your built files are)
```

### Step 3: Add iOS Platform
```bash
# Add iOS platform
npm install @capacitor/ios
npx cap add ios

# This creates an ios/ folder with native Xcode project
```

### Step 4: Configure Capacitor
Edit `capacitor.config.ts`:
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dashie.app',
  appName: 'Dashie',
  webDir: 'dist',
  server: {
    // Use this for development to load from your local web server
    // url: 'http://localhost:8080',
    // cleartext: true
  },
  ios: {
    contentInset: 'always',
    scrollEnabled: true,
    // Add any iOS-specific configuration
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffff",
      showSpinner: false
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
```

### Step 5: Build and Sync
```bash
# Build your web app
npm run build  # or your build command

# Copy web assets to native project
npx cap sync ios

# This copies your web files to ios/App/App/public/
```

### Step 6: Open in Xcode
```bash
# Open the iOS project in Xcode
npx cap open ios

# Xcode will launch with your project
```

---

## iOS-Specific Features

### Feature 1: Location Services (Real-time Location Sharing)

#### Install Geolocation Plugin
```bash
npm install @capacitor/geolocation
npx cap sync ios
```

#### Configure Permissions in Xcode
1. Open `ios/App/App/Info.plist` in Xcode
2. Add location permission keys:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Dashie needs your location to share it with family members on the dashboard.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Dashie needs background location access to keep your family updated even when the app is not in use.</string>

<key>NSLocationAlwaysUsageDescription</key>
<string>Dashie uses your location to provide real-time family location sharing on your dashboard.</string>

<key>UIBackgroundModes</key>
<array>
  <string>location</string>
</array>
```

#### Implementation Code
Create `js/services/location-service.js`:
```javascript
import { Geolocation } from '@capacitor/geolocation';

export class LocationService {
  constructor() {
    this.watchId = null;
    this.isTracking = false;
  }

  /**
   * Request location permissions
   */
  async requestPermissions() {
    try {
      const permission = await Geolocation.requestPermissions();
      return permission.location === 'granted';
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  /**
   * Check current permissions status
   */
  async checkPermissions() {
    try {
      const permission = await Geolocation.checkPermissions();
      return permission.location;
    } catch (error) {
      console.error('Error checking permissions:', error);
      return 'denied';
    }
  }

  /**
   * Get current location (one-time)
   */
  async getCurrentLocation() {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
      
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      };
    } catch (error) {
      console.error('Error getting location:', error);
      throw error;
    }
  }

  /**
   * Start continuous location tracking
   * @param {Function} callback - Called with location updates
   * @param {Object} options - Tracking options
   */
  async startTracking(callback, options = {}) {
    if (this.isTracking) {
      console.warn('Location tracking already active');
      return;
    }

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000 // Cache for 5 seconds
    };

    const trackingOptions = { ...defaultOptions, ...options };

    try {
      this.watchId = await Geolocation.watchPosition(
        trackingOptions,
        (position, err) => {
          if (err) {
            console.error('Location tracking error:', err);
            callback(null, err);
            return;
          }

          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            speed: position.coords.speed,
            heading: position.coords.heading,
            timestamp: position.timestamp
          };

          callback(locationData, null);
        }
      );

      this.isTracking = true;
      console.log('Location tracking started with watch ID:', this.watchId);
    } catch (error) {
      console.error('Error starting location tracking:', error);
      throw error;
    }
  }

  /**
   * Stop location tracking
   */
  async stopTracking() {
    if (!this.isTracking || !this.watchId) {
      console.warn('No active location tracking to stop');
      return;
    }

    try {
      await Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
      this.isTracking = false;
      console.log('Location tracking stopped');
    } catch (error) {
      console.error('Error stopping location tracking:', error);
      throw error;
    }
  }

  /**
   * Upload location to Traccar or custom backend
   */
  async uploadLocation(locationData, userId) {
    try {
      // Option 1: Send to Traccar
      const traccarUrl = 'YOUR_TRACCAR_SERVER_URL';
      const response = await fetch(`${traccarUrl}?id=${userId}&lat=${locationData.latitude}&lon=${locationData.longitude}&timestamp=${locationData.timestamp}&accuracy=${locationData.accuracy}`, {
        method: 'POST'
      });

      // Option 2: Send to Supabase/custom backend
      // const response = await fetch('YOUR_API_ENDPOINT', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     user_id: userId,
      //     latitude: locationData.latitude,
      //     longitude: locationData.longitude,
      //     accuracy: locationData.accuracy,
      //     timestamp: locationData.timestamp
      //   })
      // });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Error uploading location:', error);
      return false;
    }
  }
}

// Usage example:
// const locationService = new LocationService();
// await locationService.requestPermissions();
// await locationService.startTracking((location, error) => {
//   if (error) {
//     console.error('Location error:', error);
//     return;
//   }
//   console.log('New location:', location);
//   locationService.uploadLocation(location, 'user-123');
// });
```

#### Integration with Dashie
Add to `js/main.js` or initialization:
```javascript
import { LocationService } from './services/location-service.js';

// Initialize location service
const locationService = new LocationService();

// Request permissions on app start (after user is authenticated)
async function initializeLocationSharing() {
  const hasPermission = await locationService.requestPermissions();
  
  if (hasPermission) {
    // Start tracking and upload every location update
    await locationService.startTracking(async (location, error) => {
      if (error) {
        console.error('Location tracking error:', error);
        return;
      }
      
      // Get current user ID from your auth system
      const userId = getCurrentUserId(); // Your existing auth function
      
      // Upload to backend
      await locationService.uploadLocation(location, userId);
      
      // Optionally update UI
      updateLocationDisplay(location);
    }, {
      enableHighAccuracy: true,
      maximumAge: 30000 // Update every 30 seconds minimum
    });
  } else {
    console.warn('Location permissions not granted');
    // Show UI prompt to enable location
    showLocationPermissionPrompt();
  }
}

// Call during app initialization
document.addEventListener('DOMContentLoaded', () => {
  // ... existing initialization code
  
  // Initialize location after auth
  if (isAuthenticated()) {
    initializeLocationSharing();
  }
});
```

---

### Feature 2: Background Photo Sync

#### Install Required Plugins
```bash
npm install @capacitor/filesystem
npm install @capacitor/background-task
npm install @capacitor-community/background-upload
npx cap sync ios
```

#### Configure Background Modes in Xcode
1. Open Xcode project
2. Select your app target
3. Go to "Signing & Capabilities" tab
4. Click "+ Capability" and add "Background Modes"
5. Enable:
   - ✅ Background fetch
   - ✅ Background processing

#### Add to Info.plist
```xml
<key>UIBackgroundModes</key>
<array>
  <string>fetch</string>
  <string>processing</string>
  <string>location</string>
</array>

<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
  <string>com.dashie.app.photosync</string>
</array>
```

#### Implementation Code
Create `js/services/photo-sync-service.js`:
```javascript
import { Filesystem, Directory } from '@capacitor/filesystem';
import { BackgroundTask } from '@capacitor/background-task';

export class PhotoSyncService {
  constructor() {
    this.syncInProgress = false;
    this.lastSyncTime = null;
  }

  /**
   * Initialize background photo sync
   */
  async initialize() {
    // Register background task
    await this.registerBackgroundTask();
    
    // Start periodic sync (every hour)
    this.startPeriodicSync(60 * 60 * 1000); // 1 hour in ms
  }

  /**
   * Register background task for iOS
   */
  async registerBackgroundTask() {
    // Note: BackgroundTask plugin handles iOS background task registration
    // This allows the app to run tasks when backgrounded
    console.log('Background task capability enabled');
  }

  /**
   * Start periodic photo sync
   */
  startPeriodicSync(intervalMs) {
    setInterval(() => {
      this.syncPhotos();
    }, intervalMs);
  }

  /**
   * Main photo sync function
   */
  async syncPhotos() {
    if (this.syncInProgress) {
      console.log('Photo sync already in progress, skipping');
      return;
    }

    this.syncInProgress = true;
    console.log('Starting photo sync...');

    // Use Background Task to prevent suspension
    const taskId = await BackgroundTask.beforeExit(async () => {
      try {
        // Get new photos from Google Photos API
        const newPhotos = await this.fetchNewPhotos();
        
        // Download and cache photos locally
        await this.downloadPhotos(newPhotos);
        
        // Update local database/cache
        await this.updateLocalCache(newPhotos);
        
        this.lastSyncTime = Date.now();
        console.log('Photo sync completed successfully');
      } catch (error) {
        console.error('Error during photo sync:', error);
      } finally {
        this.syncInProgress = false;
        BackgroundTask.finish({ taskId });
      }
    });
  }

  /**
   * Fetch new photos from Google Photos API
   */
  async fetchNewPhotos() {
    try {
      // Get access token from your auth system
      const accessToken = await this.getAccessToken();
      
      // Fetch photos from Google Photos
      const response = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.mediaItems || [];
    } catch (error) {
      console.error('Error fetching photos:', error);
      return [];
    }
  }

  /**
   * Download photos and save to device
   */
  async downloadPhotos(photos) {
    const downloadPromises = photos.map(async (photo) => {
      try {
        // Check if already cached
        const isCached = await this.isPhotoCached(photo.id);
        if (isCached) {
          return;
        }

        // Download photo
        const response = await fetch(photo.baseUrl + '=w2048-h2048'); // Get high-res version
        const blob = await response.blob();
        
        // Convert to base64 for Filesystem plugin
        const base64Data = await this.blobToBase64(blob);
        
        // Save to device
        await Filesystem.writeFile({
          path: `photos/${photo.id}.jpg`,
          data: base64Data,
          directory: Directory.Data
        });

        console.log(`Downloaded photo: ${photo.id}`);
      } catch (error) {
        console.error(`Error downloading photo ${photo.id}:`, error);
      }
    });

    await Promise.all(downloadPromises);
  }

  /**
   * Check if photo is already cached
   */
  async isPhotoCached(photoId) {
    try {
      await Filesystem.stat({
        path: `photos/${photoId}.jpg`,
        directory: Directory.Data
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert blob to base64
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Update local cache database
   */
  async updateLocalCache(photos) {
    // Store photo metadata in localStorage or IndexedDB
    const cachedPhotos = JSON.parse(localStorage.getItem('cachedPhotos') || '[]');
    
    photos.forEach(photo => {
      if (!cachedPhotos.find(p => p.id === photo.id)) {
        cachedPhotos.push({
          id: photo.id,
          filename: photo.filename,
          mimeType: photo.mimeType,
          creationTime: photo.mediaMetadata.creationTime,
          localPath: `photos/${photo.id}.jpg`,
          syncedAt: Date.now()
        });
      }
    });

    localStorage.setItem('cachedPhotos', JSON.stringify(cachedPhotos));
  }

  /**
   * Get cached photos from device
   */
  async getCachedPhotos() {
    const cachedPhotos = JSON.parse(localStorage.getItem('cachedPhotos') || '[]');
    return cachedPhotos;
  }

  /**
   * Get photo from local cache
   */
  async getPhotoFromCache(photoId) {
    try {
      const result = await Filesystem.readFile({
        path: `photos/${photoId}.jpg`,
        directory: Directory.Data
      });
      
      // Return as data URL for display
      return `data:image/jpeg;base64,${result.data}`;
    } catch (error) {
      console.error(`Error reading cached photo ${photoId}:`, error);
      return null;
    }
  }

  /**
   * Clear old cached photos (keep last 30 days)
   */
  async clearOldCache() {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const cachedPhotos = JSON.parse(localStorage.getItem('cachedPhotos') || '[]');
    
    const photosToKeep = [];
    const photosToDelete = [];

    cachedPhotos.forEach(photo => {
      if (photo.syncedAt > thirtyDaysAgo) {
        photosToKeep.push(photo);
      } else {
        photosToDelete.push(photo);
      }
    });

    // Delete old photos from filesystem
    for (const photo of photosToDelete) {
      try {
        await Filesystem.deleteFile({
          path: photo.localPath,
          directory: Directory.Data
        });
      } catch (error) {
        console.error(`Error deleting photo ${photo.id}:`, error);
      }
    }

    localStorage.setItem('cachedPhotos', JSON.stringify(photosToKeep));
    console.log(`Cleared ${photosToDelete.length} old cached photos`);
  }

  /**
   * Get access token (integrate with your auth system)
   */
  async getAccessToken() {
    // This should integrate with your existing JWT/auth system
    // Return valid Google Photos API access token
    return window.JWTService?.getAccessToken() || '';
  }
}

// Usage example:
// const photoSync = new PhotoSyncService();
// await photoSync.initialize();
```

#### Integration with Photo Widget
Modify your photo widget to use cached photos:
```javascript
// In your photo widget code
import { PhotoSyncService } from '../services/photo-sync-service.js';

const photoSync = new PhotoSyncService();

async function loadPhotos() {
  // Try to get from cache first
  const cachedPhotos = await photoSync.getCachedPhotos();
  
  if (cachedPhotos.length > 0) {
    // Display cached photos
    for (const photo of cachedPhotos) {
      const imageData = await photoSync.getPhotoFromCache(photo.id);
      if (imageData) {
        displayPhoto(imageData);
      }
    }
  } else {
    // Fallback to online fetch if no cache
    await fetchPhotosOnline();
  }
}
```

---

### Feature 3: Local Notifications (Find My iPhone Style)

#### Install Plugin
```bash
npm install @capacitor/local-notifications
npx cap sync ios
```

#### Configure Permissions
Add to `Info.plist`:
```xml
<key>NSUserNotificationsUsageDescription</key>
<string>Dashie needs notification access to alert you about important events and device location requests.</string>
```

#### Implementation
Create `js/services/notification-service.js`:
```javascript
import { LocalNotifications } from '@capacitor/local-notifications';

export class NotificationService {
  async initialize() {
    // Request permissions
    const permission = await LocalNotifications.requestPermissions();
    return permission.display === 'granted';
  }

  async sendFindMyPhoneAlert() {
    await LocalNotifications.schedule({
      notifications: [
        {
          title: "📍 Location Request",
          body: "Someone is trying to locate your device via Dashie",
          id: 1,
          sound: 'default', // Use loudest available
          attachments: null,
          actionTypeId: "",
          extra: { type: 'find-device' }
        }
      ]
    });
  }

  async sendCriticalAlert(title, message) {
    // Note: iOS restricts bypassing silent mode
    // This will be as loud as iOS permits
    await LocalNotifications.schedule({
      notifications: [
        {
          title: title,
          body: message,
          id: Date.now(),
          sound: 'default',
          // iOS will respect user's notification settings
          // Cannot force override Do Not Disturb without special entitlements
        }
      ]
    });
  }
}
```

**Important Note:** iOS severely restricts silent mode bypass. Only system apps like Find My can truly override silent mode. Third-party apps require special "Critical Alerts" entitlement from Apple (very difficult to obtain). Your app will send notifications as loudly as iOS permits based on user settings.

---

## Build & Deployment

### Development Build (Test on Device)

#### Step 1: Connect iOS Device
1. Connect iPhone/iPad via USB
2. Unlock device and trust computer
3. In Xcode, select your device from the dropdown (top left)

#### Step 2: Configure Signing
1. In Xcode, select project root in navigator
2. Select "App" target
3. Go to "Signing & Capabilities" tab
4. Check "Automatically manage signing"
5. Select your Team (your Apple Developer account)
6. Xcode will generate provisioning profiles

#### Step 3: Build and Run
```bash
# Make sure web assets are built
npm run build

# Sync to iOS
npx cap sync ios

# Open in Xcode
npx cap open ios

# In Xcode: Click Play button (▶️) to build and install on device
```

#### Step 4: Trust Developer Certificate on Device
1. On your iOS device, go to Settings → General → VPN & Device Management
2. Find your developer certificate
3. Tap "Trust [Your Name]"
4. App will now launch

---

### Production Build (App Store Submission)

#### Step 1: Prepare App Store Assets
1. **App Icon:** 1024x1024px PNG (no transparency)
2. **Screenshots:** Required sizes for iPhone and iPad
3. **Privacy Policy URL:** Required for App Store
4. **App Description:** Marketing copy for App Store listing

#### Step 2: Configure App Information
In Xcode:
1. Select project → Target → General
2. Set Display Name: "Dashie"
3. Set Bundle Identifier: "com.dashie.app"
4. Set Version: "1.0"
5. Set Build: "1"
6. Set Deployment Target: iOS 15.0 or higher

#### Step 3: Create App Store Listing
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click "My Apps" → "+" → "New App"
3. Fill in app information:
   - Platform: iOS
   - Name: Dashie
   - Primary Language: English
   - Bundle ID: com.dashie.app
   - SKU: DASHIE001
4. Set pricing (Free or Paid)
5. Upload screenshots and app icon
6. Write app description
7. Add privacy policy URL

#### Step 4: Create Archive in Xcode
```bash
# Update version if needed
# Edit ios/App/App.xcodeproj

# Build for release
npm run build
npx cap sync ios
npx cap open ios
```

In Xcode:
1. Select "Any iOS Device" as target (not a simulator)
2. Product → Archive
3. Wait for archive to complete (~5-10 minutes)
4. Organizer window will open automatically

#### Step 5: Upload to App Store
In Xcode Organizer:
1. Select your archive
2. Click "Distribute App"
3. Select "App Store Connect"
4. Click "Upload"
5. Select "Automatically manage signing"
6. Click "Upload"
7. Wait for upload to complete (~10-30 minutes depending on size)

#### Step 6: Submit for Review
In App Store Connect:
1. Go to your app
2. Select the build you uploaded
3. Fill in "What's New in This Version"
4. Add test account credentials (if login required)
5. Click "Submit for Review"
6. Review typically takes 1-3 days

#### Step 7: App Store Review Notes
Common rejection reasons to avoid:
- Missing privacy policy
- Requesting unnecessary permissions
- Crashes on launch
- Not using background capabilities appropriately
- UI issues on different screen sizes

Include reviewer notes explaining:
- Background location usage (family location sharing)
- Background sync purpose (photo synchronization)
- Any test credentials needed

---

### Update Workflow (After Initial Release)

```bash
# 1. Make changes to web app
# Edit your HTML/CSS/JS files

# 2. Increment version numbers
# Edit ios/App/App/Info.plist
# Increment CFBundleShortVersionString (e.g., 1.0 → 1.1)
# Increment CFBundleVersion (e.g., 1 → 2)

# 3. Build web assets
npm run build

# 4. Sync to iOS
npx cap sync ios

# 5. Open in Xcode
npx cap open ios

# 6. Archive and upload (same as Step 4-6 above)

# 7. Submit update for review
```

**Hot Updates (Optional):**
- For JavaScript/CSS/HTML changes only (no native code changes)
- Consider using Capgo or Appflow for instant updates
- Bypasses App Store review for web content updates
- Costs $12-99/month but saves weeks of review time

---

## Ongoing Maintenance

### Testing Checklist
Before each release, test:
- [ ] App launches successfully
- [ ] Authentication works (Google sign-in)
- [ ] Dashboard loads and displays widgets
- [ ] Navigation works (d-pad/touch)
- [ ] Location permissions requested properly
- [ ] Location tracking works in foreground
- [ ] Location tracking works in background
- [ ] Photos load from cache
- [ ] Background photo sync works
- [ ] Notifications display correctly
- [ ] App works offline (cached data)
- [ ] App works on different screen sizes (iPhone SE, Pro Max, iPad)
- [ ] Dark mode support (if applicable)
- [ ] Settings persist across app restarts
- [ ] No memory leaks (test with Instruments)
- [ ] Battery usage is reasonable

### Performance Monitoring
```javascript
// Add performance monitoring to your app
// Option 1: Use native iOS analytics
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';

// Option 2: Use custom analytics
function trackEvent(category, action, label) {
  // Send to your analytics backend
  fetch('YOUR_ANALYTICS_ENDPOINT', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, action, label, timestamp: Date.now() })
  });
}

// Track key events
trackEvent('location', 'permission_granted', userId);
trackEvent('photo_sync', 'completed', photoCount);
```

### Crash Reporting
Consider adding:
- **Sentry:** For JavaScript error tracking
- **Firebase Crashlytics:** For native crash reporting

```bash
# Install Sentry
npm install @sentry/capacitor
npx cap sync ios
```

### App Store Optimization (ASO)
- Monitor app ratings and reviews
- Respond to user feedback
- Update screenshots with new features
- A/B test app icon and descriptions
- Track conversion rates

### Update Schedule
Recommended update cadence:
- **Bug fixes:** As needed (emergency updates)
- **Minor features:** Every 2-4 weeks
- **Major features:** Every 2-3 months
- **iOS compatibility:** Within 2 weeks of new iOS release

---

## Keeping Web and iOS in Sync

### Shared Codebase Strategy

Your current architecture is already well-suited for this:

```
dashieapp_staging/
├── js/                 # ✅ Shared across web and iOS
├── css/                # ✅ Shared across web and iOS
├── widgets/            # ✅ Shared across web and iOS
├── index.html          # ✅ Shared (with minor tweaks for iOS)
├── config.js           # ✅ Shared (environment detection)
└── ios/                # ⚠️ iOS-specific native code only
    └── App/
        └── App/
            ├── public/ # 👈 Web assets copied here automatically
            └── native/ # 👈 Only Swift/Obj-C code here
```

### Development Workflow

```bash
# 1. Make changes to your web app
# Edit files in js/, css/, widgets/

# 2. Test in browser first
# Open index.html in browser or run local server

# 3. When ready, sync to iOS
npm run build
npx cap sync ios

# 4. Test in iOS Simulator
npx cap open ios
# Then click Run in Xcode

# 5. Commit to version control
git add .
git commit -m "Add new calendar widget feature"
git push
```

### Platform Detection

Add to `config.js`:
```javascript
// Detect if running in native iOS app
export const IS_IOS_APP = window.Capacitor?.getPlatform() === 'ios';
export const IS_WEB = !window.Capacitor;

// Use this to enable/disable features
if (IS_IOS_APP) {
  // Enable native features
  initializeLocationSharing();
  initializePhotoSync();
} else {
  // Web-only fallbacks
  console.log('Running in web browser');
}
```

### Feature Flags

Create `js/utils/feature-flags.js`:
```javascript
export const FEATURES = {
  LOCATION_SHARING: window.Capacitor?.getPlatform() === 'ios',
  BACKGROUND_SYNC: window.Capacitor?.getPlatform() === 'ios',
  PUSH_NOTIFICATIONS: window.Capacitor?.getPlatform() === 'ios',
  // Web features
  KEYBOARD_SHORTCUTS: !window.Capacitor,
  BROWSER_NOTIFICATIONS: !window.Capacitor
};

// Usage:
if (FEATURES.LOCATION_SHARING) {
  showLocationSharingUI();
}
```

---

## Troubleshooting

### Common Issues

#### Issue: "No such module 'Capacitor'"
**Solution:**
```bash
cd ios/App
pod install
```

#### Issue: "Failed to register bundle identifier"
**Solution:**
- Bundle ID might already be taken
- Change in `capacitor.config.ts` and Xcode
- Use: `com.yourcompany.dashie` instead of `com.dashie.app`

#### Issue: Location not working in background
**Solution:**
- Verify Background Modes enabled in Xcode
- Check Info.plist has all location permission keys
- Make sure user granted "Always" permission (not just "While Using")

#### Issue: Photos not syncing
**Solution:**
- Check Google Photos API permissions
- Verify access token is valid
- Check iOS storage space available
- Review console logs for errors

#### Issue: App crashes on launch
**Solution:**
```bash
# Clean build
cd ios/App
rm -rf Pods/ Podfile.lock
pod install --repo-update

# Clean Xcode build
# In Xcode: Product → Clean Build Folder
```

#### Issue: Xcode build errors after updating
**Solution:**
```bash
# Update Capacitor and sync
npm update @capacitor/core @capacitor/cli @capacitor/ios
npx cap sync ios
```

---

## Resources

### Documentation
- [Capacitor Docs](https://capacitorjs.com/docs)
- [iOS Development Guide](https://developer.apple.com/ios/)
- [Capacitor iOS Guide](https://capacitorjs.com/docs/ios)
- [App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)

### Capacitor Plugins
- [Official Plugins](https://capacitorjs.com/docs/apis)
- [Community Plugins](https://github.com/capacitor-community)
- [Awesome Capacitor](https://github.com/riderx/awesome-capacitor)

### Tools
- [Xcode](https://apps.apple.com/us/app/xcode/id497799835)
- [App Store Connect](https://appstoreconnect.apple.com)
- [TestFlight](https://developer.apple.com/testflight/) - Beta testing
- [Capacitor CLI](https://capacitorjs.com/docs/cli)

### Community
- [Capacitor Forum](https://forum.ionicframework.com/c/capacitor)
- [Ionic Discord](https://ionic.link/discord)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/capacitor)

---

## Next Steps

### Immediate Tasks (Week 1)
1. ✅ Set up Mac environment (Xcode, Node.js)
2. ✅ Enroll in Apple Developer Program
3. ✅ Initialize Capacitor in Dashie project
4. ✅ Add iOS platform
5. ✅ Test basic web app in iOS Simulator

### Short-term (Weeks 2-3)
1. ✅ Implement location services
2. ✅ Add location permission UI
3. ✅ Test location tracking on real device
4. ✅ Implement background photo sync
5. ✅ Test background capabilities

### Medium-term (Week 4)
1. ✅ Build first production archive
2. ✅ Create App Store listing
3. ✅ Submit for TestFlight beta
4. ✅ Get feedback from beta testers
5. ✅ Fix bugs and iterate

### Long-term (Ongoing)
1. ✅ Submit to App Store
2. ✅ Monitor reviews and ratings
3. ✅ Implement user feedback
4. ✅ Add new features
5. ✅ Maintain compatibility with new iOS versions

---

## Cost-Benefit Analysis

### Costs
- Mac hardware: ~$1,099 (one-time)
- Apple Developer: $99/year
- Time investment: ~2-3 weeks initial setup
- Ongoing maintenance: ~5-10 hours/month

### Benefits
- Native iOS app presence
- Access to App Store distribution (millions of potential users)
- Native device capabilities (location, notifications, background sync)
- Better performance than web-only
- Offline functionality
- Professional appearance
- Push notifications (future)
- Single codebase maintained

### ROI
- Marginal cost per additional feature: Low (reuse web code)
- Market reach increase: High (App Store vs web only)
- User experience improvement: High (native features)
- Development velocity: High (single codebase)

---

## Summary

This guide provides everything needed to:
1. ✅ Set up iOS development environment on Mac
2. ✅ Convert Dashie web app to native iOS app using Capacitor
3. ✅ Implement location sharing with background tracking
4. ✅ Implement background photo synchronization
5. ✅ Build and deploy to App Store

**Key Advantages:**
- 95% code reuse from existing web app
- Free tools (except Apple Developer account)
- Single codebase for web + iOS
- Easy to maintain and update
- Full access to native iOS capabilities

**Timeline Estimate:**
- Environment setup: 1 day
- Capacitor integration: 1-2 days
- Location services: 2-3 days
- Photo sync: 3-5 days
- Testing and polish: 3-5 days
- App Store submission: 1 day
- Total: **2-3 weeks**

Good luck with your iOS development! 🚀