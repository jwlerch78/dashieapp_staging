// js/modules/Welcome/welcome-wizard-controller.js
// Welcome Wizard Controller - Orchestrates the onboarding flow
// Ported from .legacy/js/welcome/welcome-wizard.js

import { createLogger } from '../../utils/logger.js';
import { getWelcomeScreens, setupScreenHandlers } from './welcome-screens.js';

const logger = createLogger('WelcomeWizard');

export default class WelcomeWizardController {
    constructor(user) {
        this.user = user;
        this.currentScreenIndex = 0;
        this.screens = getWelcomeScreens();
        this.state = this.loadState();
        this.overlay = null;
        this.skipConfirmationActive = false;
        this.keyHandler = null;
        this.skipModalKeyHandler = null;

        logger.info('Welcome wizard initialized', {
            userName: user?.name,
            totalScreens: this.screens.length
        });
    }

    /**
     * Load wizard state from localStorage
     */
    loadState() {
        try {
            const saved = localStorage.getItem('dashie-welcome-state');
            if (saved) {
                const state = JSON.parse(saved);
                logger.debug('Loaded wizard state from localStorage', state);
                return state;
            }
        } catch (error) {
            logger.warn('Failed to load wizard state', { error: error.message });
        }

        // Default state
        return {
            currentScreen: 'screen-1',
            familyName: this.extractFamilyName(),
            completedScreens: []
        };
    }

    /**
     * Save wizard state to localStorage
     */
    saveState() {
        try {
            localStorage.setItem('dashie-welcome-state', JSON.stringify(this.state));
            logger.debug('Saved wizard state to localStorage');
        } catch (error) {
            logger.warn('Failed to save wizard state', { error: error.message });
        }
    }

    /**
     * Extract family name from user data
     */
    extractFamilyName() {
        if (!this.user) return 'Dashie';

        // Try to get last name from email
        if (this.user.email) {
            const emailParts = this.user.email.split('@')[0].split('.');
            if (emailParts.length > 1) {
                const lastName = emailParts[emailParts.length - 1];
                return lastName.charAt(0).toUpperCase() + lastName.slice(1);
            }
        }

        // Try to get from full name
        if (this.user.name) {
            const nameParts = this.user.name.split(' ');
            if (nameParts.length > 1) {
                return nameParts[nameParts.length - 1];
            }
        }

        return 'Dashie';
    }

    /**
     * Show the welcome wizard
     */
    async show() {
        logger.info('Showing welcome wizard');

        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'welcome-wizard-overlay';
        this.overlay.innerHTML = this.buildWizardHTML();

        document.body.appendChild(this.overlay);

        // Setup event handlers
        setupScreenHandlers(this);

        // Setup ESC key handler for skip confirmation
        this.setupKeyHandler();

        // Show first screen
        await this.showScreen(this.currentScreenIndex);

        // Trigger animation
        requestAnimationFrame(() => {
            this.overlay.classList.add('active');
        });
    }

    /**
     * Build the wizard HTML structure
     */
    buildWizardHTML() {
        return `
            <div class="welcome-wizard-modal">
                <div class="welcome-wizard-content">
                    <div class="welcome-screens">
                        ${this.screens.map((screen, index) => `
                            <div class="welcome-screen ${index === 0 ? 'active' : ''}"
                                 data-screen="${screen.id}"
                                 data-index="${index}">
                                <!-- Screen content will be injected here -->
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- Skip Confirmation Modal -->
            <div id="welcome-skip-confirmation" class="welcome-skip-modal" style="display: none;">
                <div class="welcome-skip-content">
                    <h2>Skip Setup?</h2>
                    <p>Are you sure you want to skip the Dashie setup wizard? You can always access settings later.</p>
                    <div class="welcome-skip-actions">
                        <button id="welcome-skip-continue" class="welcome-btn welcome-btn-primary" tabindex="1">Continue Setup</button>
                        <button id="welcome-skip-confirm" class="welcome-btn welcome-btn-secondary" tabindex="2">Skip Setup</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup keyboard handler for ESC key
     */
    setupKeyHandler() {
        this.keyHandler = (e) => {
            if (e.key === 'Escape' || e.key === 'Backspace') {
                // Don't show skip confirmation on last screen
                const currentScreen = this.screens[this.currentScreenIndex];
                if (currentScreen.id === 'screen-5') {
                    this.completeWizard();
                    return;
                }

                // Show skip confirmation if not already showing
                if (!this.skipConfirmationActive) {
                    e.preventDefault();
                    this.showSkipConfirmation();
                }
            }
        };

        document.addEventListener('keydown', this.keyHandler);
    }

    /**
     * Show skip confirmation modal
     */
    showSkipConfirmation() {
        logger.debug('Showing skip confirmation');
        this.skipConfirmationActive = true;

        const modal = this.overlay.querySelector('#welcome-skip-confirmation');
        modal.style.display = 'flex';

        const continueBtn = this.overlay.querySelector('#welcome-skip-continue');
        const skipBtn = this.overlay.querySelector('#welcome-skip-confirm');

        // Add click handlers
        continueBtn.onclick = () => this.continueSetup();
        skipBtn.onclick = async () => await this.skipWizard();

        // Create keydown handler for Enter key
        this.skipModalKeyHandler = (e) => {
            if (e.key === 'Enter' || e.keyCode === 13) {
                if (e.target.id === 'welcome-skip-continue') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.continueSetup();
                } else if (e.target.id === 'welcome-skip-confirm') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.skipWizard();
                }
            }
        };

        // Add keydown listener to modal
        modal.addEventListener('keydown', this.skipModalKeyHandler, true);

        // Focus the "Continue Setup" button by default
        setTimeout(() => continueBtn?.focus(), 100);
    }

    /**
     * Hide skip confirmation modal
     */
    hideSkipConfirmation() {
        logger.debug('Hiding skip confirmation');
        this.skipConfirmationActive = false;

        const modal = this.overlay.querySelector('#welcome-skip-confirmation');

        // Remove keydown listener
        if (this.skipModalKeyHandler) {
            modal.removeEventListener('keydown', this.skipModalKeyHandler, true);
            this.skipModalKeyHandler = null;
        }

        modal.style.display = 'none';
    }

    /**
     * Handle skip confirmation - continue setup
     */
    continueSetup() {
        this.hideSkipConfirmation();
    }

    /**
     * Handle skip confirmation - skip wizard
     */
    async skipWizard() {
        logger.info('User skipped welcome wizard');

        // Show loading spinner while saving
        this.showLoadingSpinner('Saving...');

        // Save skip status to settings
        if (window.settingsStore) {
            window.settingsStore.set('onboarding.skipped', true);
            window.settingsStore.set('onboarding.completed', true);
            window.settingsStore.set('onboarding.skippedAt', new Date().toISOString());

            // CRITICAL: Must save to database!
            try {
                await window.settingsStore.save(false); // false = no toast notification
                logger.success('Skip status saved to database - wizard will not show again');
            } catch (error) {
                logger.error('Failed to save skip status', error);
            }
        }

        this.hideLoadingSpinner();

        // Close wizard
        this.close();
    }

    /**
     * Show a specific screen
     */
    async showScreen(index) {
        const screen = this.screens[index];
        if (!screen) {
            logger.error('Screen not found', { index });
            return;
        }

        logger.debug('Showing screen', { screenId: screen.id, index });

        // Update current screen index
        this.currentScreenIndex = index;

        // Update state
        this.state.currentScreen = screen.id;
        this.saveState();

        // Get screen element
        const screenElement = this.overlay.querySelector(`[data-screen="${screen.id}"]`);
        if (!screenElement) return;

        // Inject screen content
        screenElement.innerHTML = screen.template(this.state, this.user);

        // Show screen with animation
        const allScreens = this.overlay.querySelectorAll('.welcome-screen');
        allScreens.forEach(s => s.classList.remove('active', 'sliding-out', 'sliding-in'));

        screenElement.classList.add('sliding-in', 'active');

        setTimeout(() => {
            screenElement.classList.remove('sliding-in');
        }, 300);

        // Call screen's onEnter handler if it exists
        if (screen.onEnter) {
            await screen.onEnter(this);
        }
    }

    /**
     * Re-render the current screen (e.g., after updating state)
     */
    renderCurrentScreen() {
        const screen = this.screens[this.currentScreenIndex];
        if (!screen) return;

        const screenElement = this.overlay.querySelector(`[data-screen="${screen.id}"]`);
        if (!screenElement) return;

        // Re-inject screen content with updated state
        screenElement.innerHTML = screen.template(this.state, this.user);

        logger.debug('Current screen re-rendered', { screenId: screen.id });
    }

    /**
     * Navigate to next screen
     */
    async nextScreen() {
        if (this.currentScreenIndex < this.screens.length - 1) {
            // Mark current screen as completed
            const currentScreen = this.screens[this.currentScreenIndex];
            if (!this.state.completedScreens.includes(currentScreen.id)) {
                this.state.completedScreens.push(currentScreen.id);
                this.saveState();
            }

            await this.showScreen(this.currentScreenIndex + 1);
        } else {
            // Last screen - complete wizard
            await this.completeWizard();
        }
    }

    /**
     * Navigate to previous screen
     */
    async previousScreen() {
        if (this.currentScreenIndex > 0) {
            await this.showScreen(this.currentScreenIndex - 1);
        }
    }

    /**
     * Show loading spinner
     */
    showLoadingSpinner(message = 'Loading...') {
        const spinner = document.createElement('div');
        spinner.id = 'welcome-loading-spinner';
        spinner.className = 'welcome-loading-overlay';
        spinner.innerHTML = `
            <div class="welcome-loading-content">
                <div class="welcome-spinner"></div>
                <p>${message}</p>
            </div>
        `;
        this.overlay.appendChild(spinner);
        logger.debug('Loading spinner shown', { message });
    }

    /**
     * Hide loading spinner
     */
    hideLoadingSpinner() {
        const spinner = document.getElementById('welcome-loading-spinner');
        if (spinner) {
            spinner.remove();
            logger.debug('Loading spinner hidden');
        }
    }

    /**
     * Request geolocation from browser
     */
    async requestGeolocation() {
        logger.info('Requesting geolocation');

        if (!navigator.geolocation) {
            logger.error('Geolocation not supported');
            alert('Geolocation is not supported by your browser');
            return;
        }

        // Show inline loading spinner (hide prompt, show loading)
        const promptEl = this.overlay.querySelector('#location-prompt');
        const loadingEl = this.overlay.querySelector('#location-loading');
        if (promptEl) promptEl.style.display = 'none';
        if (loadingEl) loadingEl.style.display = 'flex';

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    timeout: 10000,
                    maximumAge: 0
                });
            });

            const { latitude, longitude } = position.coords;
            logger.info('Geolocation acquired', { latitude, longitude });

            // Reverse geocode to get location details
            await this.reverseGeocode(latitude, longitude);

        } catch (error) {
            logger.error('Geolocation failed', error);

            // Restore prompt, hide loading
            if (promptEl) promptEl.style.display = 'block';
            if (loadingEl) loadingEl.style.display = 'none';

            // Handle geolocation errors
            const errorCode = error?.code;
            const errorMessage = error?.message || error?.error || 'Unknown error';

            if (errorCode === 1) {
                alert('Location access denied. You can enter your zip code manually instead.');
            } else if (errorCode === 2) {
                alert('Location unavailable. Please try entering your zip code manually.');
            } else if (errorCode === 3) {
                alert('Location request timed out. Please try entering your zip code manually.');
            } else {
                alert(`Failed to get location: ${errorMessage}. You can enter your zip code manually instead.`);
            }
        }
    }

    /**
     * Reverse geocode coordinates to city/state/zip
     */
    async reverseGeocode(latitude, longitude) {
        logger.info('Reverse geocoding', { latitude, longitude });

        try {
            // Use Nominatim (OpenStreetMap) reverse geocoding
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
                {
                    headers: {
                        'User-Agent': 'Dashie App'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Reverse geocoding failed');
            }

            const data = await response.json();
            logger.debug('Reverse geocode result', data);

            // Extract location details
            const address = data.address || {};
            this.state.detectedCity = address.city || address.town || address.village || '';
            this.state.detectedState = address.state || '';
            this.state.detectedZipCode = address.postcode || '';

            logger.info('Location detected', {
                city: this.state.detectedCity,
                state: this.state.detectedState,
                zip: this.state.detectedZipCode
            });

            this.saveState();

            // Navigate to confirmation screen (4B)
            // Note: No need to hide inline loading - screen will change
            const screen4BIndex = this.screens.findIndex(s => s.id === 'screen-4b');
            if (screen4BIndex >= 0) {
                await this.showScreen(screen4BIndex);
            }

        } catch (error) {
            logger.error('Reverse geocoding failed', { error: error.message });

            // Restore prompt on error
            const promptEl = this.overlay.querySelector('#location-prompt');
            const loadingEl = this.overlay.querySelector('#location-loading');
            if (promptEl) promptEl.style.display = 'block';
            if (loadingEl) loadingEl.style.display = 'none';

            alert('Failed to determine your location. Please enter your zip code manually.');
        }
    }

    /**
     * Save zip code to settings
     */
    async saveZipCode(zipCode) {
        logger.info('Saving zip code to settings', { zipCode });

        if (window.settingsStore) {
            try {
                window.settingsStore.set('family.zipCode', zipCode);
                await window.settingsStore.save(false);
                logger.success('Zip code saved', { zipCode });
            } catch (error) {
                logger.error('Failed to save zip code', { error: error.message });
            }
        } else {
            logger.warn('Settings store not available, zip code not saved');
        }
    }

    /**
     * Lookup city and state for a zip code
     */
    async lookupZipCodeLocation(zipCode) {
        logger.info('Looking up location for zip code', { zipCode });

        try {
            const url = `https://nominatim.openstreetmap.org/search?postalcode=${zipCode}&country=us&format=json&limit=1`;

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Dashie App'
                }
            });

            if (!response.ok) {
                throw new Error('Geocoding failed');
            }

            const data = await response.json();

            if (!data || data.length === 0) {
                logger.warn('No results for zip code', { zipCode });
                return null;
            }

            const { lat, lon } = data[0];

            // Now reverse geocode to get detailed address
            const reverseUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;

            const reverseResponse = await fetch(reverseUrl, {
                headers: {
                    'User-Agent': 'Dashie App'
                }
            });

            if (!reverseResponse.ok) {
                throw new Error('Reverse geocoding failed');
            }

            const reverseData = await reverseResponse.json();
            const address = reverseData.address || {};

            const city = address.city || address.town || address.village || '';
            const state = address.state || '';

            // Get state abbreviation
            const stateAbbr = this.getStateAbbreviation(state);

            logger.info('Location found for zip code', { zipCode, city, state: stateAbbr });

            return {
                city,
                state: stateAbbr
            };

        } catch (error) {
            logger.error('Failed to lookup location', { zipCode, error: error.message });
            return null;
        }
    }

    /**
     * Get state abbreviation from full state name
     */
    getStateAbbreviation(stateName) {
        const stateMap = {
            'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
            'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
            'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
            'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
            'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
            'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
            'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
            'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
            'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
            'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
        };

        return stateMap[stateName] || stateName;
    }

    /**
     * Clear location data (used when skipping location setup)
     */
    async clearLocationData() {
        logger.info('Clearing location data');

        // Clear from wizard state
        this.state.detectedCity = null;
        this.state.detectedState = null;
        this.state.detectedZipCode = null;
        this.state.manualZipCode = null;
        this.saveState();

        // Clear from settings
        if (window.settingsStore) {
            try {
                window.settingsStore.set('family.zipCode', '');
                await window.settingsStore.save(false);
                logger.success('Location data cleared from settings');
            } catch (error) {
                logger.error('Failed to clear location data', { error: error.message });
            }
        }
    }

    /**
     * Skip to next major screen (after all location sub-screens)
     */
    skipToNextMajorScreen() {
        // Find the last location screen (screen-4d)
        const lastLocationScreenIndex = this.screens.findIndex(s => s.id === 'screen-4d');

        if (lastLocationScreenIndex >= 0 && lastLocationScreenIndex < this.screens.length - 1) {
            // Move to the screen after the last location screen (screen-5)
            this.showScreen(lastLocationScreenIndex + 1);
        } else {
            // If we're at or past the last screen, complete the wizard
            this.completeWizard();
        }
    }

    /**
     * Detect calendars from Google Calendar API
     */
    async detectCalendars() {
        logger.info('Detecting calendars from Google Calendar');

        try {
            // Get calendar service instance
            const { getCalendarService } = await import('../../data/services/calendar-service.js');
            const calendarService = getCalendarService();

            // Fetch calendars for primary account
            const calendars = await calendarService.getCalendars('primary');

            if (calendars && calendars.length > 0) {
                this.state.calendarCount = calendars.length;
                this.state.primaryCalendarName = calendars.find(c => c.primary)?.summary || calendars[0].summary;
                this.saveState();

                logger.success('Calendars detected', {
                    count: calendars.length,
                    primaryName: this.state.primaryCalendarName
                });
            } else {
                this.state.calendarCount = 0;
                this.state.primaryCalendarName = null;
                this.saveState();

                logger.warn('No calendars found for user');
            }

        } catch (error) {
            logger.error('Failed to detect calendars', { error: error.message });
            this.state.calendarCount = 0;
            this.state.primaryCalendarName = null;
        }
    }

    /**
     * Complete the wizard
     */
    async completeWizard() {
        logger.info('Welcome wizard completed', { state: this.state });

        // Show loading spinner while saving
        this.showLoadingSpinner('Saving settings...');

        // Save completion to settings
        if (window.settingsStore) {
            window.settingsStore.set('onboarding.completed', true);
            window.settingsStore.set('onboarding.completedAt', new Date().toISOString());
            window.settingsStore.set('family.familyName', this.state.familyName);

            // CRITICAL: Must save to database before reload!
            try {
                await window.settingsStore.save(false); // false = no toast notification
                logger.success('Onboarding completion saved to database', { familyName: this.state.familyName });
            } catch (error) {
                logger.error('Failed to save onboarding settings', error);
                // Continue anyway - settings may be in localStorage
            }
        }

        // Clear localStorage state
        localStorage.removeItem('dashie-welcome-state');

        // Close wizard
        this.close();

        // Reload page to show dashboard
        logger.info('Reloading page to show dashboard');
        window.location.reload();
    }

    /**
     * Close the wizard
     */
    close() {
        logger.info('Closing welcome wizard');

        // Remove event listener
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
        }

        // Animate out
        this.overlay?.classList.remove('active');

        setTimeout(() => {
            this.overlay?.remove();
            this.overlay = null;
        }, 300);
    }
}
