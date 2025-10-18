# Phase 5: Welcome & Photos

**Estimated Time:** 2-3 weeks
**Status:** Ready to start after Phase 4 completion
**Prerequisites:**
- Phase 4 (Calendar, Agenda, Login, Settings & Modals) ✅ COMPLETE

---

## Overview

Phase 5 focuses on:
1. **Welcome Wizard** - First-time user onboarding experience
2. **Photos Widget** - Photo slideshow with Google Photos integration
3. **Photo Service** - Photo fetching, caching, and management
4. **Photos Settings** - Photo configuration and management UI
5. **Remaining Settings Pages** - Complete all settings functionality
6. **Phase 3.5/4 Completion** - Address any remaining items

---

## Table of Contents

- [5.1: Port Welcome Screen](#51-port-welcome-screen)
- [5.2: Port Photos Widget](#52-port-photos-widget)
- [5.3: Photos Settings Page](#53-photos-settings-page)
- [5.4: Build Remaining Settings Pages](#54-build-remaining-settings-pages)
- [5.5+: Complete Remaining Tasks](#55-complete-remaining-tasks)

---

## 5.1: Port Welcome Screen

**Goal:** Migrate the Welcome wizard from `.legacy/welcome/` to `js/modules/Welcome/`.

**Current State:**
- Welcome wizard exists in `.legacy/welcome/` or `.legacy/js/welcome-wizard.js` (~801 lines)
- First-time user onboarding flow
- Multiple screens: Introduction, Location Setup, Calendar Setup, Theme Selection, etc.
- D-pad navigation bug with Enter key (noted in architecture)

### Step 1: Review Legacy Welcome Wizard (1 day)

**Locate and review legacy implementation:**

```bash
# Find welcome wizard files
find .legacy/ -name "*welcome*" -o -name "*wizard*"
```

**Study the wizard:**
1. **Understand the flow**
   - What screens are shown?
   - What order are they in?
   - What data is collected?
   - How is data saved?

2. **Study screen implementations**
   - How are screens rendered?
   - How does navigation work?
   - What validation is performed?
   - How are settings applied?

3. **Note any bugs**
   - D-pad Enter key bug (can't review detected location with d-pad)
   - Any other issues found

**Testing:**
- [ ] Legacy welcome wizard reviewed
- [ ] Screen flow documented
- [ ] Screen implementations understood
- [ ] Bugs identified and noted

---

### Step 2: Create Welcome Module Structure (1 day)

**Create module files:**

```
js/modules/Welcome/
├── welcome.js                      # Module interface
├── welcome-wizard-controller.js    # Wizard orchestration
├── welcome-state-manager.js        # Wizard state
├── welcome-input-handler.js        # D-pad navigation
├── welcome-ui-renderer.js          # Screen rendering
│
└── screens/                        # Individual wizard screens
    ├── welcome-screen-intro.js
    ├── welcome-screen-location.js
    ├── welcome-screen-calendar.js
    ├── welcome-screen-theme.js
    └── welcome-screen-complete.js
```

**Implementation:**

1. **Create welcome.js** - Module interface
   ```javascript
   // js/modules/Welcome/welcome.js

   import WelcomeWizardController from './welcome-wizard-controller.js';
   import WelcomeStateManager from './welcome-state-manager.js';
   import WelcomeInputHandler from './welcome-input-handler.js';
   import { createLogger } from '../../utils/logger.js';

   const logger = createLogger('WelcomeModule');

   export default {
       async initialize() {
           logger.info('Initializing Welcome module');
           WelcomeStateManager.initialize();
       },

       activate() {
           logger.info('Activating Welcome wizard');
           WelcomeWizardController.start();
       },

       deactivate() {
           logger.info('Deactivating Welcome wizard');
           WelcomeWizardController.stop();
       },

       getState() {
           return WelcomeStateManager.getState();
       },

       getInputHandler() {
           return WelcomeInputHandler;
       }
   };
   ```

2. **Create welcome-wizard-controller.js** - Main wizard logic
   ```javascript
   // js/modules/Welcome/welcome-wizard-controller.js

   import { createLogger } from '../../utils/logger.js';
   import WelcomeStateManager from './welcome-state-manager.js';
   import WelcomeUIRenderer from './welcome-ui-renderer.js';

   // Import screens
   import IntroScreen from './screens/welcome-screen-intro.js';
   import LocationScreen from './screens/welcome-screen-location.js';
   import CalendarScreen from './screens/welcome-screen-calendar.js';
   import ThemeScreen from './screens/welcome-screen-theme.js';
   import CompleteScreen from './screens/welcome-screen-complete.js';

   const logger = createLogger('WelcomeWizard');

   class WelcomeWizardController {
       constructor() {
           this.screens = [
               new IntroScreen(),
               new LocationScreen(),
               new CalendarScreen(),
               new ThemeScreen(),
               new CompleteScreen()
           ];

           this.currentScreenIndex = 0;
       }

       start() {
           logger.info('Starting welcome wizard');

           // Reset state
           WelcomeStateManager.reset();

           // Show first screen
           this.showCurrentScreen();
       }

       stop() {
           logger.info('Stopping welcome wizard');
           WelcomeUIRenderer.hide();
       }

       async showCurrentScreen() {
           const screen = this.screens[this.currentScreenIndex];
           logger.info('Showing screen', {
               screenIndex: this.currentScreenIndex,
               screenName: screen.constructor.name
           });

           // Initialize screen
           await screen.initialize();

           // Render screen
           const html = await screen.render();
           WelcomeUIRenderer.render(html);

           // Attach screen event handlers
           await screen.attach();

           // Update state
           WelcomeStateManager.setCurrentScreen(this.currentScreenIndex);
       }

       async nextScreen() {
           const currentScreen = this.screens[this.currentScreenIndex];

           // Validate current screen
           const isValid = await currentScreen.validate();
           if (!isValid) {
               logger.warn('Screen validation failed');
               return;
           }

           // Save screen data
           const data = await currentScreen.getData();
           WelcomeStateManager.updateScreenData(this.currentScreenIndex, data);

           // Move to next screen
           this.currentScreenIndex++;

           if (this.currentScreenIndex >= this.screens.length) {
               // Wizard complete
               await this.complete();
           } else {
               // Show next screen
               await this.showCurrentScreen();
           }
       }

       async previousScreen() {
           if (this.currentScreenIndex === 0) {
               logger.warn('Already at first screen');
               return;
           }

           this.currentScreenIndex--;
           await this.showCurrentScreen();
       }

       async complete() {
           logger.info('Welcome wizard complete');

           // Collect all data
           const allData = WelcomeStateManager.getAllData();

           // Apply settings
           await this.applySettings(allData);

           // Mark wizard as complete
           localStorage.setItem('dashie-wizard-complete', 'true');

           // Navigate to dashboard
           import('../../core/app-state-manager.js').then(({ default: AppStateManager }) => {
               AppStateManager.setCurrentModule('dashboard');
           });
       }

       async applySettings(data) {
           logger.info('Applying welcome wizard settings', data);

           // Import settings service
           const settingsService = (await import('../../../data/services/settings-service.js')).default;

           // Apply location
           if (data.location) {
               await settingsService.set('locationLat', data.location.lat);
               await settingsService.set('locationLon', data.location.lon);
               await settingsService.set('locationName', data.location.name);
           }

           // Apply theme
           if (data.theme) {
               await settingsService.set('theme', data.theme);
           }

           // Save settings
           await settingsService.save();

           logger.success('Settings applied');
       }
   }

   export default new WelcomeWizardController();
   ```

**Testing:**
- [ ] Module structure created
- [ ] Module interface implemented
- [ ] Wizard controller logic implemented
- [ ] No syntax errors
- [ ] Module can be imported

---

### Step 3: Implement Welcome Screens (3-4 days)

**Create each screen following this pattern:**

```javascript
// js/modules/Welcome/screens/welcome-screen-intro.js

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('WelcomeIntroScreen');

export default class WelcomeIntroScreen {
    constructor() {
        this.name = 'intro';
    }

    async initialize() {
        logger.info('Initializing intro screen');
    }

    async render() {
        // PRESERVE LEGACY HTML STRUCTURE
        return `
            <div class="welcome-screen welcome-screen--intro">
                <div class="welcome-logo">
                    <img src="./artwork/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie">
                </div>

                <h1>Welcome to Dashie!</h1>
                <p class="welcome-tagline">Helping active families manage the chaos</p>

                <div class="welcome-intro-content">
                    <p>Dashie brings together your calendar, photos, and important information in one beautiful dashboard.</p>

                    <ul class="welcome-features">
                        <li>📅 View your family's schedule at a glance</li>
                        <li>📷 Display your favorite photos</li>
                        <li>🌤️ See weather and time</li>
                        <li>📱 Works on TV, desktop, and mobile</li>
                    </ul>

                    <p>Let's get you set up in just a few steps!</p>
                </div>

                <div class="welcome-actions">
                    <button class="welcome-button welcome-button--primary" id="btn-next" tabindex="1">
                        Get Started
                    </button>
                </div>

                <div class="welcome-progress">
                    <span class="welcome-progress__text">Step 1 of 5</span>
                    <div class="welcome-progress__bar">
                        <div class="welcome-progress__fill" style="width: 20%"></div>
                    </div>
                </div>
            </div>
        `;
    }

    async attach() {
        // Attach event handlers
        const nextBtn = document.getElementById('btn-next');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.handleNext());
            nextBtn.addEventListener('keydown', (e) => {
                if (e.keyCode === 13 || e.key === 'Enter') {
                    this.handleNext();
                }
            });

            // Auto-focus for D-pad
            setTimeout(() => nextBtn.focus(), 100);
        }
    }

    async validate() {
        // Intro screen always valid
        return true;
    }

    async getData() {
        // No data to collect from intro
        return {};
    }

    handleNext() {
        import('../welcome-wizard-controller.js').then(({ default: controller }) => {
            controller.nextScreen();
        });
    }
}
```

**Implement remaining screens:**

1. **Location Screen** - Port from legacy
   - Detect location or manual entry
   - Geocoding integration
   - **FIX D-pad Enter key bug** - Ensure Enter works to confirm detected location

2. **Calendar Screen** - Port from legacy
   - Connect Google Calendar accounts
   - Select calendars to show
   - Uses calendar service from Phase 4

3. **Theme Screen** - Port from legacy
   - Choose light or dark theme
   - Preview theme

4. **Complete Screen** - Port from legacy
   - Summary of selections
   - Finish button → go to dashboard

**Testing:**
- [ ] All screens implemented
- [ ] Screen rendering works
- [ ] Next/Previous navigation works
- [ ] Data collection works
- [ ] Validation works
- [ ] D-pad navigation works (including Enter key!)
- [ ] Progress bar updates
- [ ] No console errors

---

### Step 4: Fix D-pad Enter Key Bug (1 day)

**Bug:** Fire TV users can't review detected location with D-pad Enter key.

**Root cause:** Enter key not properly handled on location review button.

**Fix in Location Screen:**

```javascript
// js/modules/Welcome/screens/welcome-screen-location.js

async render() {
    // ... location detection UI ...

    // When location detected, show review button
    return `
        <div class="location-detected">
            <p>📍 Location detected:</p>
            <p class="location-name">${detectedLocation.name}</p>

            <button
                class="welcome-button"
                id="btn-review-location"
                tabindex="1"
            >
                Review Location
            </button>
        </div>
    `;
}

async attach() {
    const reviewBtn = document.getElementById('btn-review-location');
    if (reviewBtn) {
        // Click handler
        reviewBtn.addEventListener('click', () => {
            this.handleReviewLocation();
        });

        // FIX: Proper D-pad Enter handling
        reviewBtn.addEventListener('keydown', (e) => {
            // Support both Enter key codes
            if (e.keyCode === 13 || e.keyCode === 23 || e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                this.handleReviewLocation();
            }
        });

        // Auto-focus
        setTimeout(() => reviewBtn.focus(), 100);
    }
}

handleReviewLocation() {
    logger.info('Reviewing location');
    // Show detailed location info or edit form
}
```

**Testing:**
- [ ] D-pad Enter key works on review button
- [ ] Keyboard Enter key works
- [ ] Mouse click works
- [ ] Touch tap works
- [ ] Button focus state visible
- [ ] No console errors

---

### Step 5: Test Welcome Wizard Flow (1-2 days)

**Test complete wizard:**

1. **Trigger wizard on first load**
   ```javascript
   // In main.js or auth-initializer.js

   async function checkFirstTimeUser() {
       const wizardComplete = localStorage.getItem('dashie-wizard-complete');

       if (!wizardComplete) {
           // Show Welcome wizard
           import('./modules/Welcome/welcome.js').then(({ default: Welcome }) => {
               AppStateManager.setCurrentModule('welcome');
               Welcome.activate();
           });
           return true;
       }

       return false;
   }
   ```

2. **Test full flow**
   - Clear localStorage
   - Reload page
   - Sign in
   - Welcome wizard should appear
   - Complete all screens
   - Verify settings applied
   - Verify dashboard loads

3. **Test navigation**
   - Next button works on all screens
   - Back button works (if implemented)
   - Can't skip required fields
   - Validation prevents progression

4. **Test data persistence**
   - Location saved to settings
   - Theme saved and applied
   - Calendar accounts connected
   - Dashboard shows correct data

**Testing:**
- [ ] Wizard triggers on first load
- [ ] All screens render correctly
- [ ] Navigation works (next/previous)
- [ ] Validation works
- [ ] D-pad navigation works on all screens
- [ ] Enter key works everywhere
- [ ] Data collection works
- [ ] Settings applied correctly
- [ ] Dashboard loads after completion
- [ ] Wizard doesn't show again
- [ ] No console errors

---

### 5.1 Success Criteria

- [ ] Welcome module created and working
- [ ] All screens implemented
- [ ] Screen flow matches legacy
- [ ] D-pad Enter key bug fixed
- [ ] Navigation works (next/previous)
- [ ] Data collection and validation working
- [ ] Settings applied after completion
- [ ] First-time user experience smooth
- [ ] No regressions
- [ ] Fire TV compatibility maintained
- [ ] All legacy functionality preserved

**Estimated Time:** 6-8 days

---

## 5.2: Port Photos Widget

**Goal:** Migrate the Photos widget from `.legacy/widgets/dphotos/` to `js/widgets/photos/`.

### Step 1: Review Legacy Photos Widget (1 day)

**Locate and study legacy implementation:**

```bash
# Find photos widget
find .legacy/ -path "*/dphotos/*"
```

**Study the implementation:**
1. **Photo sources**
   - Google Photos integration
   - Local photo storage
   - Photo metadata handling

2. **Slideshow logic**
   - Photo rotation timing
   - Transitions/animations
   - Random vs sequential

3. **Photo rendering**
   - Image loading and caching
   - Aspect ratio handling
   - Fire TV image compatibility

4. **Widget interaction**
   - Focus menu items
   - Navigation within widget
   - Settings integration

**Testing:**
- [ ] Legacy photos widget reviewed
- [ ] Photo sources identified
- [ ] Slideshow logic understood
- [ ] Rendering approach documented
- [ ] Notes taken on complex logic

---

### Step 2: Create Photos Widget Structure (1 day)

**Create widget files:**

```
js/widgets/photos/
├── photos.html          # Widget HTML
├── photos.js            # Widget logic
├── photos.css           # Widget styles
└── photo-loader.js      # Photo loading utility
```

**Implementation:**

```javascript
// js/widgets/photos/photos.js

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('PhotosWidget');

class PhotosWidget {
    constructor() {
        // 3-state model
        this.hasFocus = false;
        this.isActive = false;

        // Photo data
        this.photos = [];
        this.currentPhotoIndex = 0;
        this.slideshowInterval = 30000; // 30 seconds default

        // Slideshow control
        this.slideshowTimer = null;
        this.isPlaying = true;

        // Focus menu
        this.focusMenuConfig = {
            hasFocusMenu: true,
            menuItems: [
                { id: 'action-pause', label: 'Pause', icon: '⏸️', type: 'action', active: false },
                { id: 'action-play', label: 'Play', icon: '▶️', type: 'action', active: true },
                { id: 'action-next', label: 'Next Photo', icon: '⏭️', type: 'action' },
                { id: 'action-previous', label: 'Previous Photo', icon: '⏮️', type: 'action' }
            ]
        };

        // DOM references
        this.photoContainer = null;
        this.currentPhotoEl = null;
        this.nextPhotoEl = null;
    }

    async initialize() {
        logger.info('Initializing photos widget');

        // Get DOM references
        this.photoContainer = document.getElementById('photo-container');
        this.currentPhotoEl = document.getElementById('current-photo');
        this.nextPhotoEl = document.getElementById('next-photo');

        // Set up message listener
        window.addEventListener('message', (event) => {
            this.handleMessage(event.data);
        });

        // Send ready signal
        this.sendEvent('widget-ready', {
            hasMenu: true,
            menuConfig: this.focusMenuConfig
        });

        logger.success('Photos widget ready');
    }

    handleMessage(data) {
        if (!data || !data.action) return;

        // Handle menu actions
        if (data.action === 'menu-item-selected') {
            this.handleMenuAction(data);
            return;
        }

        // Handle state transitions
        if (data.action === 'enter-focus') {
            this.handleEnterFocus();
            return;
        }

        if (data.action === 'enter-active') {
            this.handleEnterActive();
            return;
        }

        if (data.action === 'exit-active') {
            this.handleExitActive();
            return;
        }

        if (data.action === 'exit-focus') {
            this.handleExitFocus();
            return;
        }

        // Handle data messages
        if (data.type === 'data' && data.dataType === 'photos') {
            this.photos = data.data;
            this.startSlideshow();
            return;
        }

        if (data.type === 'config' && data.configType === 'slideshow-interval') {
            this.slideshowInterval = data.interval;
            this.restartSlideshow();
            return;
        }

        // Handle navigation (only when active)
        if (!this.isActive) return;

        switch (data.action) {
            case 'left':
                this.showPreviousPhoto();
                break;
            case 'right':
                this.showNextPhoto();
                break;
            case 'enter':
                this.togglePlayPause();
                break;
            case 'escape':
                this.sendEvent('return-to-menu');
                break;
        }
    }

    // STATE TRANSITIONS

    handleEnterFocus() {
        logger.info('Widget entering FOCUSED state');
        this.hasFocus = true;
    }

    handleEnterActive() {
        logger.info('Widget entering ACTIVE state');
        this.isActive = true;
        // Pause slideshow when active (user navigating manually)
        this.pauseSlideshow();
    }

    handleExitActive() {
        logger.info('Widget exiting ACTIVE state');
        this.isActive = false;
        // Resume slideshow
        if (this.isPlaying) {
            this.startSlideshow();
        }
    }

    handleExitFocus() {
        logger.info('Widget exiting FOCUSED state');
        this.hasFocus = false;
    }

    // SLIDESHOW CONTROL

    startSlideshow() {
        if (this.photos.length === 0) {
            logger.warn('No photos to show');
            return;
        }

        logger.info('Starting slideshow', {
            photoCount: this.photos.length,
            interval: this.slideshowInterval
        });

        // Show first photo
        this.showPhoto(0);

        // Start timer
        this.slideshowTimer = setInterval(() => {
            this.showNextPhoto();
        }, this.slideshowInterval);
    }

    pauseSlideshow() {
        logger.info('Pausing slideshow');
        if (this.slideshowTimer) {
            clearInterval(this.slideshowTimer);
            this.slideshowTimer = null;
        }
        this.isPlaying = false;
        this.updateMenuPlayPauseState();
    }

    resumeSlideshow() {
        logger.info('Resuming slideshow');
        this.isPlaying = true;
        this.startSlideshow();
        this.updateMenuPlayPauseState();
    }

    restartSlideshow() {
        this.pauseSlideshow();
        if (this.isPlaying) {
            this.startSlideshow();
        }
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.pauseSlideshow();
        } else {
            this.resumeSlideshow();
        }
    }

    // PHOTO DISPLAY

    showPhoto(index) {
        if (index < 0 || index >= this.photos.length) return;

        this.currentPhotoIndex = index;
        const photo = this.photos[index];

        logger.debug('Showing photo', {
            index,
            photoId: photo.id,
            url: photo.url
        });

        // Crossfade transition
        this.nextPhotoEl.src = photo.url;
        this.nextPhotoEl.alt = photo.description || 'Photo';

        // Wait for image to load
        this.nextPhotoEl.onload = () => {
            // Fade out current, fade in next
            this.currentPhotoEl.style.opacity = '0';
            this.nextPhotoEl.style.opacity = '1';

            // After transition, swap elements
            setTimeout(() => {
                const temp = this.currentPhotoEl.src;
                this.currentPhotoEl.src = this.nextPhotoEl.src;
                this.currentPhotoEl.style.opacity = '1';
                this.nextPhotoEl.style.opacity = '0';
            }, 1000); // Match CSS transition duration
        };
    }

    showNextPhoto() {
        const nextIndex = (this.currentPhotoIndex + 1) % this.photos.length;
        this.showPhoto(nextIndex);
    }

    showPreviousPhoto() {
        const prevIndex = (this.currentPhotoIndex - 1 + this.photos.length) % this.photos.length;
        this.showPhoto(prevIndex);
    }

    // MENU ACTIONS

    handleMenuAction(data) {
        const itemId = data.itemId;

        logger.info('Menu action', { itemId });

        switch (itemId) {
            case 'action-play':
                this.resumeSlideshow();
                break;
            case 'action-pause':
                this.pauseSlideshow();
                break;
            case 'action-next':
                this.showNextPhoto();
                break;
            case 'action-previous':
                this.showPreviousPhoto();
                break;
        }
    }

    updateMenuPlayPauseState() {
        this.focusMenuConfig.menuItems.forEach(item => {
            if (item.id === 'action-play') {
                item.active = !this.isPlaying;
            }
            if (item.id === 'action-pause') {
                item.active = this.isPlaying;
            }
        });

        // Send updated config
        this.sendEvent('widget-config-update', {
            menuConfig: this.focusMenuConfig
        });
    }

    // UTILITIES

    sendEvent(eventType, data = {}) {
        window.parent.postMessage({
            type: 'event',
            widgetId: 'photos',
            payload: { eventType, data }
        }, '*');
    }
}

// Initialize widget
const widget = new PhotosWidget();
widget.initialize();
```

**Create photo-loader.js:**

```javascript
// js/widgets/photos/photo-loader.js

export async function loadPhoto(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

export function preloadPhotos(urls, maxConcurrent = 3) {
    // Preload photos in batches to avoid overwhelming browser
    const batches = [];
    for (let i = 0; i < urls.length; i += maxConcurrent) {
        batches.push(urls.slice(i, i + maxConcurrent));
    }

    return batches.reduce((promise, batch) => {
        return promise.then(() => {
            return Promise.all(batch.map(url => loadPhoto(url)));
        });
    }, Promise.resolve());
}
```

**Testing:**
- [ ] Photos widget files created
- [ ] Widget structure implemented
- [ ] 3-state model implemented
- [ ] Slideshow control implemented
- [ ] Focus menu configured
- [ ] No syntax errors

---

### Step 3: Build Photo Service (2-3 days)

**Create photo-service.js:**

```javascript
// js/data/services/photo-service.js

import { createLogger } from '../../utils/logger.js';
import GoogleAPIClient from './google/google-api-client.js';

const logger = createLogger('PhotoService');

class PhotoService {
    constructor(edgeClient) {
        this.edgeClient = edgeClient;
        this.googleClient = null;
        this.photos = [];
        this.albumId = null;
    }

    async initialize() {
        logger.info('Initializing PhotoService');

        // Initialize Google API client
        this.googleClient = new GoogleAPIClient(this.edgeClient);

        // Load photo settings
        const settings = await this.edgeClient.loadSettings();
        this.albumId = settings.photoAlbumId || null;

        logger.success('PhotoService initialized');
    }

    /**
     * Get photos from Google Photos album
     * @param {string} albumId - Google Photos album ID
     * @returns {Promise<Array>} Photos
     */
    async getPhotosFromAlbum(albumId = this.albumId) {
        if (!albumId) {
            logger.warn('No album ID configured');
            return [];
        }

        logger.info('Fetching photos from album', { albumId });

        try {
            // Use Google Photos API
            const response = await this.googleClient.request(
                'GET',
                `https://photoslibrary.googleapis.com/v1/mediaItems:search`,
                {
                    albumId: albumId,
                    pageSize: 100 // Max photos
                }
            );

            const photos = response.mediaItems || [];

            // Transform to standard format
            return photos.map(photo => ({
                id: photo.id,
                url: photo.baseUrl + '=w1920-h1080', // Request full HD
                thumbnailUrl: photo.baseUrl + '=w300-h200',
                description: photo.description || '',
                createdTime: photo.mediaMetadata.creationTime,
                width: photo.mediaMetadata.width,
                height: photo.mediaMetadata.height
            }));

        } catch (error) {
            logger.error('Failed to fetch photos', error);
            return [];
        }
    }

    /**
     * Get all albums from Google Photos
     * @returns {Promise<Array>} Albums
     */
    async getAlbums() {
        logger.info('Fetching albums');

        try {
            const response = await this.googleClient.request(
                'GET',
                'https://photoslibrary.googleapis.com/v1/albums',
                { pageSize: 50 }
            );

            const albums = response.albums || [];

            return albums.map(album => ({
                id: album.id,
                title: album.title,
                coverPhotoUrl: album.coverPhotoBaseUrl + '=w300-h200',
                mediaItemsCount: album.mediaItemsCount
            }));

        } catch (error) {
            logger.error('Failed to fetch albums', error);
            return [];
        }
    }

    /**
     * Set active album
     * @param {string} albumId - Album ID
     */
    async setActiveAlbum(albumId) {
        logger.info('Setting active album', { albumId });
        this.albumId = albumId;

        // Save to settings
        const settings = await this.edgeClient.loadSettings();
        settings.photoAlbumId = albumId;
        await this.edgeClient.saveSettings(settings);
    }

    /**
     * Clear all photos
     */
    async clearPhotos() {
        logger.info('Clearing all photos');
        this.albumId = null;

        // Clear from settings
        const settings = await this.edgeClient.loadSettings();
        settings.photoAlbumId = null;
        await this.edgeClient.saveSettings(settings);
    }

    /**
     * Get current photos
     * @returns {Array} Current photos
     */
    getCurrentPhotos() {
        return [...this.photos];
    }

    /**
     * Refresh photos from active album
     */
    async refreshPhotos() {
        logger.info('Refreshing photos');
        this.photos = await this.getPhotosFromAlbum();
        return this.photos;
    }
}

// Export singleton factory
let photoServiceInstance = null;

export function initializePhotoService(edgeClient) {
    if (!photoServiceInstance) {
        photoServiceInstance = new PhotoService(edgeClient);
    }
    return photoServiceInstance;
}

export function getPhotoService() {
    if (!photoServiceInstance) {
        throw new Error('PhotoService not initialized');
    }
    return photoServiceInstance;
}

export default {
    initialize: initializePhotoService,
    get: getPhotoService
};
```

**Add Google Photos API scope:**

```javascript
// js/data/auth/calendar-auth/google-calendar-auth.js
// OR create new google-photos-auth.js

// Add scope:
const GOOGLE_PHOTOS_SCOPE = 'https://www.googleapis.com/auth/photoslibrary.readonly';
```

**Testing:**
- [ ] Photo service created
- [ ] Google Photos API integration working
- [ ] Albums can be fetched
- [ ] Photos can be fetched from album
- [ ] Album selection saves to settings
- [ ] Photo URLs generated correctly
- [ ] No console errors

---

### Step 4: Integrate Photos Widget with Dashboard (1 day)

**Register widget in Dashboard:**

```javascript
// js/modules/Dashboard/dashboard-widget-config.js

export const widgetConfigurations = {
    // ... existing widgets ...

    photos: {
        id: 'photos',
        name: 'Photos',
        iframeId: 'widget-photos',
        iframeSrc: './js/widgets/photos/photos.html',
        row: 1, // Adjust position
        col: 1,
        span: { rows: 1, cols: 1 },
        focusScale: 1.05,
        canCenter: true
    }
};
```

**Send photos to widget:**

```javascript
// js/core/widget-data-manager.js

async updatePhotosWidget() {
    const photoService = (await import('../data/services/photo-service.js')).default.get();
    const photos = await photoService.refreshPhotos();

    this.sendToWidget('photos', 'data', {
        dataType: 'photos',
        data: photos
    });
}

// Call on startup and periodically
async initialize() {
    // ... existing initialization ...

    // Update photos widget
    await this.updatePhotosWidget();

    // Refresh photos every hour
    setInterval(() => this.updatePhotosWidget(), 3600000);
}
```

**Testing:**
- [ ] Photos widget appears in dashboard grid
- [ ] Widget receives photo data
- [ ] Slideshow starts automatically
- [ ] Photos rotate at configured interval
- [ ] Transitions smooth
- [ ] No console errors

---

### Step 5: Test Photos Widget Functionality (1 day)

**Test slideshow:**

1. **Automatic rotation**
   - Photos change automatically
   - Correct interval (default 30s)
   - Smooth transitions

2. **Manual navigation**
   - Focus widget → becomes active
   - Left arrow → previous photo
   - Right arrow → next photo
   - Enter → pause/play

3. **Focus menu**
   - Pause button works
   - Play button works
   - Next/Previous buttons work
   - Menu state updates correctly

4. **Performance**
   - Images load smoothly
   - No stuttering
   - Memory usage stable
   - Works on Fire TV

**Testing:**
- [ ] Slideshow rotates automatically
- [ ] Manual navigation works
- [ ] Focus menu functional
- [ ] Pause/play works
- [ ] Image loading smooth
- [ ] Fire TV compatible
- [ ] No memory leaks
- [ ] No console errors

---

### 5.2 Success Criteria

- [ ] Photos widget migrated and working
- [ ] Photo service implemented
- [ ] Google Photos integration working
- [ ] Slideshow functional
- [ ] Manual navigation working
- [ ] Focus menu implemented
- [ ] 3-state model implemented
- [ ] Widget registered in dashboard
- [ ] Data flow working (service → widget)
- [ ] All legacy functionality preserved
- [ ] Fire TV compatibility maintained

**Estimated Time:** 6-7 days

---

## 5.3: Photos Settings Page

**Goal:** Build Photos settings page with album selection and photo management.

### Step 1: Create Photos Settings Page (2 days)

**Create settings page:**

```javascript
// js/modules/Settings/pages/settings-photos-page.js

import { createLogger } from '../../../utils/logger.js';
import { getPhotoService } from '../../../data/services/photo-service.js';
import SettingsScreenBase from '../core/settings-screen-base.js';

const logger = createLogger('PhotosSettingsPage');

export default class PhotosSettingsPage extends SettingsScreenBase {
    constructor() {
        super('photos', 'Photos Settings');
        this.photoService = null;
        this.albums = [];
        this.currentAlbumId = null;
    }

    async onInit() {
        logger.info('Initializing photos settings page');
        this.photoService = getPhotoService();

        // Get current album
        const settings = await this.photoService.edgeClient.loadSettings();
        this.currentAlbumId = settings.photoAlbumId || null;

        // Fetch albums
        this.albums = await this.photoService.getAlbums();

        logger.info('Albums loaded', { count: this.albums.length });
    }

    async render() {
        let html = '<div class="settings-page settings-photos-page">';
        html += '<h2>Photos Settings</h2>';

        // Slideshow interval
        html += '<div class="settings-field">';
        html += '<label for="slideshow-interval">Slideshow Interval (seconds):</label>';
        html += '<input type="number" id="slideshow-interval" min="10" max="300" value="30">';
        html += '</div>';

        // Album selection
        html += '<div class="settings-field">';
        html += '<label for="album-select">Google Photos Album:</label>';

        if (this.albums.length === 0) {
            html += '<p class="settings-info">No albums found. Please connect Google Photos.</p>';
            html += '<button class="settings-button" id="add-photos-btn">Add Photos</button>';
        } else {
            html += '<select id="album-select">';
            html += '<option value="">-- Select Album --</option>';

            this.albums.forEach(album => {
                const selected = album.id === this.currentAlbumId ? 'selected' : '';
                html += `<option value="${album.id}" ${selected}>`;
                html += `${album.title} (${album.mediaItemsCount} photos)`;
                html += `</option>`;
            });

            html += '</select>';
        }

        html += '</div>';

        // Delete all photos
        if (this.currentAlbumId) {
            html += '<div class="settings-danger-zone">';
            html += '<h3>Remove Photos</h3>';
            html += '<p class="settings-warning">⚠️ This will remove the selected album from your dashboard.</p>';
            html += '<button class="settings-button settings-button--danger" id="delete-photos-btn">Remove Album</button>';
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    async onAttach() {
        // Album selection
        const albumSelect = document.getElementById('album-select');
        if (albumSelect) {
            albumSelect.addEventListener('change', async (e) => {
                const albumId = e.target.value;
                await this.handleAlbumChange(albumId);
            });
        }

        // Add photos button
        const addBtn = document.getElementById('add-photos-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.handleAddPhotos());
        }

        // Delete photos button
        const deleteBtn = document.getElementById('delete-photos-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.handleDeletePhotos());
        }
    }

    async handleAlbumChange(albumId) {
        logger.info('Album changed', { albumId });

        try {
            await this.photoService.setActiveAlbum(albumId);
            this.currentAlbumId = albumId;

            // Refresh photos widget
            this.broadcastPhotoChange();

            logger.success('Album updated');

        } catch (error) {
            logger.error('Failed to update album', error);
            alert('Failed to update album. Please try again.');
        }
    }

    async handleAddPhotos() {
        logger.info('Add photos clicked');

        // Import modals
        const modals = (await import('../../Modals/modals.js')).default;

        await modals.showInfo({
            title: 'Add Google Photos',
            message: 'To add photos:\n\n1. Create an album in Google Photos\n2. Add your favorite photos to it\n3. Return here and select the album\n\nNote: You may need to reconnect your Google account with Photos permission.',
            icon: '📷'
        });
    }

    async handleDeletePhotos() {
        logger.warn('Delete photos clicked');

        // Import modals
        const modals = (await import('../../Modals/modals.js')).default;

        const confirmed = await modals.showConfirmation({
            title: 'Remove Album?',
            message: 'This will remove the selected album from your dashboard.\n\nThe photos will NOT be deleted from Google Photos.',
            icon: '⚠️',
            confirmText: 'Remove Album',
            cancelText: 'Cancel',
            confirmDanger: true
        });

        if (!confirmed) return;

        try {
            await this.photoService.clearPhotos();
            this.currentAlbumId = null;

            // Refresh photos widget
            this.broadcastPhotoChange();

            // Re-render page
            const container = document.querySelector('.settings-page');
            container.innerHTML = await this.render();
            await this.onAttach();

            logger.success('Album removed');

        } catch (error) {
            logger.error('Failed to remove album', error);
            alert('Failed to remove album. Please try again.');
        }
    }

    broadcastPhotoChange() {
        import('../../../core/app-comms.js').then(({ default: AppComms }) => {
            AppComms.publish(AppComms.events.PHOTOS_UPDATED, {
                albumId: this.currentAlbumId
            });
        });
    }

    async onSave() {
        logger.info('Photos settings saved');
        return true;
    }
}
```

**Testing:**
- [ ] Photos settings page renders
- [ ] Album dropdown shows Google Photos albums
- [ ] Album selection works
- [ ] Selected album saved to settings
- [ ] Photos widget updates when album changed
- [ ] "Add Photos" button shows instructions
- [ ] "Remove Album" button works
- [ ] Page re-renders after removal
- [ ] No console errors

---

### Step 2: Register Photos Settings Page (1 day)

**Register in Settings module:**

```javascript
// js/modules/Settings/settings.js

import PhotosSettingsPage from './pages/settings-photos-page.js';

// Register page
this.pages.set('photos', new PhotosSettingsPage());
```

**Already in menu (from Phase 4):**
```javascript
{ id: 'photos', label: 'Photos Settings', icon: '📷' }
```

**Testing:**
- [ ] Photos settings appears in Settings menu
- [ ] Clicking menu item navigates to Photos page
- [ ] Page renders correctly
- [ ] Navigation works
- [ ] No console errors

---

### 5.3 Success Criteria

- [ ] Photos settings page built and working
- [ ] Album selection functional
- [ ] Album changes update widget
- [ ] Add photos instructions clear
- [ ] Remove album works
- [ ] Page registered in Settings module
- [ ] Accessible from Settings menu
- [ ] All UI polished
- [ ] No console errors

**Estimated Time:** 3 days

---

## 5.4: Build Remaining Settings Pages

**Goal:** Complete all remaining settings pages to achieve feature parity with legacy.

### Step 1: Inventory Remaining Pages (1 day)

**Review legacy settings:**

```bash
# Find legacy settings pages
find .legacy/ -path "*/settings/pages/*"
```

**Identify missing pages:**

Based on architecture.md, these pages should exist:

- ✅ **Family Settings** - Already exists
- ✅ **Display Settings** - Already exists (interface page)
- ✅ **Calendar Settings** - Built in Phase 4
- ✅ **Photos Settings** - Built in Phase 5.3
- ❌ **System Settings** - NEEDS BUILD
- ✅ **Account Settings** - Built in Phase 4

**System Settings should include:**
- Device name
- Language/locale
- Timezone
- Sleep mode settings (already in Display/Interface)
- Auto-update preferences
- Diagnostic settings

**Testing:**
- [ ] All legacy settings pages inventoried
- [ ] Missing pages identified
- [ ] Settings to migrate documented
- [ ] Priority order determined

---

### Step 2: Build System Settings Page (2 days)

**Create system settings page:**

```javascript
// js/modules/Settings/pages/settings-system-page.js

import { createLogger } from '../../../utils/logger.js';
import SettingsScreenBase from '../core/settings-screen-base.js';

const logger = createLogger('SystemSettingsPage');

export default class SystemSettingsPage extends SettingsScreenBase {
    constructor() {
        super('system', 'System Settings');
    }

    async onInit() {
        logger.info('Initializing system settings page');
    }

    async render() {
        let html = '<div class="settings-page settings-system-page">';
        html += '<h2>System Settings</h2>';

        // Device name
        html += '<div class="settings-field">';
        html += '<label for="device-name">Device Name:</label>';
        html += '<input type="text" id="device-name" placeholder="My Dashie Dashboard">';
        html += '</div>';

        // Language
        html += '<div class="settings-field">';
        html += '<label for="language">Language:</label>';
        html += '<select id="language">';
        html += '<option value="en">English</option>';
        html += '<option value="es">Español</option>';
        html += '<option value="fr">Français</option>';
        html += '</select>';
        html += '</div>';

        // Timezone
        html += '<div class="settings-field">';
        html += '<label for="timezone">Timezone:</label>';
        html += '<select id="timezone">';
        html += '<option value="America/New_York">Eastern Time</option>';
        html += '<option value="America/Chicago">Central Time</option>';
        html += '<option value="America/Denver">Mountain Time</option>';
        html += '<option value="America/Los_Angeles">Pacific Time</option>';
        html += '</select>';
        html += '</div>';

        // Auto-update
        html += '<div class="settings-field">';
        html += '<label>';
        html += '<input type="checkbox" id="auto-update" checked>';
        html += ' Enable automatic updates';
        html += '</label>';
        html += '</div>';

        // Diagnostic mode
        html += '<div class="settings-field">';
        html += '<label>';
        html += '<input type="checkbox" id="diagnostic-mode">';
        html += ' Enable diagnostic mode (verbose logging)';
        html += '</label>';
        html += '</div>';

        html += '</div>';
        return html;
    }

    async onAttach() {
        // Event handlers for fields
    }

    async onSave() {
        // Save system settings
        logger.info('System settings saved');
        return true;
    }
}
```

**Register page:**

```javascript
// js/modules/Settings/settings.js

import SystemSettingsPage from './pages/settings-system-page.js';

this.pages.set('system', new SystemSettingsPage());
```

**Testing:**
- [ ] System settings page renders
- [ ] All fields present
- [ ] Fields save correctly
- [ ] Page registered in Settings
- [ ] Accessible from menu
- [ ] No console errors

---

### Step 3: Review and Polish All Settings Pages (2 days)

**Review checklist for each page:**

1. **Family Settings**
   - [ ] All fields working
   - [ ] Save functionality working
   - [ ] UI polished

2. **Display Settings**
   - [ ] Theme selection working
   - [ ] Time format working
   - [ ] Sleep/wake times working
   - [ ] UI polished

3. **Calendar Settings**
   - [ ] Multi-account support working
   - [ ] Calendar enable/disable working
   - [ ] Account removal working
   - [ ] UI polished

4. **Photos Settings**
   - [ ] Album selection working
   - [ ] Slideshow interval working
   - [ ] Remove album working
   - [ ] UI polished

5. **System Settings**
   - [ ] All fields working
   - [ ] Save functionality working
   - [ ] UI polished

6. **Account Settings**
   - [ ] User info displayed
   - [ ] Delete account working
   - [ ] UI polished

**Polish tasks:**
- Consistent styling across all pages
- D-pad navigation smooth on all pages
- Field validation working
- Error messages clear
- Help text where needed
- Icons consistent

**Testing:**
- [ ] All pages reviewed
- [ ] Consistent styling
- [ ] All functionality working
- [ ] D-pad navigation smooth
- [ ] No console errors

---

### 5.4 Success Criteria

- [ ] All settings pages identified
- [ ] System settings page built
- [ ] All pages reviewed and polished
- [ ] Consistent UI across all pages
- [ ] D-pad navigation working everywhere
- [ ] All save functionality working
- [ ] Feature parity with legacy achieved
- [ ] Documentation updated

**Estimated Time:** 5 days

---

## 5.5+: Complete Remaining Tasks

**Goal:** Address any remaining items from Phases 3.5 and 4, plus any deferred tasks.

### Deferred Items from Earlier Assessment

These items were deferred to Phase 5.5+:

1. **Weather Widget** (Gap 1)
   - Migrate weather widget from `.legacy/widgets/weather/`
   - Build weather-service.js
   - Integrate with weather API
   - Add weather settings page

2. **Header Widget Completion** (Gap 2)
   - Test header widget lifecycle
   - Verify greeting functionality
   - Integrate weather data (depends on weather widget)
   - Polish and optimize

3. **Additional Widgets** (if any exist in legacy)
   - Location widget
   - Map widget
   - Camera widget
   - Any other widgets found in `.legacy/widgets/`

### Additional Tasks

4. **Performance Optimization**
   - Profile widget loading times
   - Optimize image loading
   - Reduce bundle size
   - Optimize Fire TV performance

5. **Testing & QA**
   - Comprehensive testing on all platforms
   - Fire TV testing (real device)
   - Mobile testing
   - Desktop testing (Chrome, Firefox, Safari)
   - Edge case testing

6. **Documentation**
   - Update architecture.md
   - Update API_INTERFACES.md
   - Write developer guide
   - Write user guide
   - Document known issues

7. **Polish & UX**
   - Smooth all animations
   - Consistent styling
   - Loading states
   - Error handling
   - Empty states

### Success Criteria for Phase 5.5+

- [ ] All deferred widgets built
- [ ] All legacy features migrated
- [ ] Performance optimized
- [ ] Comprehensive testing complete
- [ ] Documentation complete
- [ ] UX polished
- [ ] Ready for production

**Estimated Time:** 2-3 weeks (variable based on scope)

---

## Phase 5 Complete! 🎉

### Overall Success Criteria

- [ ] Welcome wizard migrated and working
- [ ] D-pad Enter key bug fixed
- [ ] Photos widget migrated and functional
- [ ] Photo service implemented
- [ ] Google Photos integration working
- [ ] Photos settings page built
- [ ] All remaining settings pages complete
- [ ] System settings working
- [ ] All legacy features migrated
- [ ] Feature parity achieved
- [ ] Fire TV compatibility maintained
- [ ] All tests passing
- [ ] Documentation complete

**Total Estimated Time:** 2-3 weeks

---

## Next Steps

After completing Phase 5:
- **Production Deployment** - Deploy to production
- **User Testing** - Gather feedback
- **Phase 6** - Additional features, optimizations, and enhancements

---

**End of Phase 5 Build Plan**
