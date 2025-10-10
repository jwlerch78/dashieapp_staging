// js/welcome/welcome-screens.js
// v1.5 - 10/9/25 10:45pm - Fixed navigation, added 4C-confirm, updated photos screens, fixed QR code
// v1.4 - 10/9/25 10:30pm - Added Screens 5, 5B, 6, 7 (Photos, QR Code, Tutorial, Completion)
// v1.3 - 10/9/25 10:20pm - Added Screens 4C & 4D (Manual Zip, Location Skipped)
// v1.2 - 10/9/25 9:50pm - Added Screens 4 & 4B (Location Request)
// v1.1 - 10/9/25 9:35pm - Added Screen 3 (Calendar Detection)
// v1.0 - 10/9/25 - Welcome wizard screen templates (Phase 2: Screens 1-2)

/**
 * Get all welcome screens
 * Each screen has: id, title, template function, onEnter callback
 */
export function getWelcomeScreens() {
  return [
    // Screen 1: Welcome
    {
      id: 'screen-1',
      title: 'Welcome to Dashie',
      canGoBack: false,
      canSkip: true,
      template: (state, user) => {
        const firstName = user?.name?.split(' ')[0] || 'there';
        
        return `
          <div class="welcome-screen-content">
            <div class="welcome-logo">
              <img src="/icons/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie Logo" />
            </div>
            <h1 class="welcome-title">Welcome to Dashie, ${firstName}!</h1>
            <p class="welcome-subtitle">Let's get you on the road to better family organization!</p>
            
            <div class="welcome-actions">
              <button id="welcome-screen-1-next" class="welcome-btn welcome-btn-primary">
                Get Started
              </button>
            </div>
            
            <p class="welcome-hint">Press ESC to skip setup</p>
          </div>
        `;
      },
      onEnter: async (wizard) => {
        // Focus the Get Started button
        setTimeout(() => {
          const nextBtn = wizard.overlay.querySelector('#welcome-screen-1-next');
          nextBtn?.focus();
        }, 100);
      }
    },
    
    // Screen 2: Family Name
    {
      id: 'screen-2',
      title: 'Family Name',
      canGoBack: true,
      canSkip: true,
      template: (state, user) => {
        const familyName = state.familyName || 'Dashie';
        const isEditing = state.editingFamilyName || false;
        
        return `
          <div class="welcome-screen-content">
            <div class="welcome-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            
            <h1 class="welcome-title">Family Name</h1>
            
            ${!isEditing ? `
              <p class="welcome-question">Are you setting this calendar up for the <strong>${familyName} Family</strong>?</p>
              
              <div class="welcome-actions">
                <button id="welcome-screen-2-confirm" class="welcome-btn welcome-btn-primary">
                  Yes, that's correct
                </button>
                <button id="welcome-screen-2-edit" class="welcome-btn welcome-btn-secondary">
                  Edit Family Name
                </button>
              </div>
            ` : `
              <p class="welcome-question">What is your family name?</p>
              
              <div class="welcome-input-group">
                <input 
                  type="text" 
                  id="welcome-family-name-input" 
                  class="welcome-input" 
                  value="${familyName}"
                  placeholder="Enter family name"
                  maxlength="50"
                />
                <label class="welcome-input-label">Family Name</label>
              </div>
              
              <p class="welcome-hint-text">
                Press Enter when done
              </p>
            `}
            
            <p class="welcome-hint">Press ESC to skip setup</p>
          </div>
        `;
      },
      onEnter: async (wizard) => {
        // Focus appropriate element based on editing state
        setTimeout(() => {
          if (wizard.state.editingFamilyName) {
            const input = wizard.overlay.querySelector('#welcome-family-name-input');
            input?.focus();
            input?.select();
            
            // Auto-save on input change
            input?.addEventListener('input', (e) => {
              const newName = e.target.value.trim();
              if (newName) {
                wizard.state.familyName = newName;
                wizard.saveState();
              }
            });
          } else {
            const confirmBtn = wizard.overlay.querySelector('#welcome-screen-2-confirm');
            confirmBtn?.focus();
          }
        }, 100);
      }
    },
    
    // Screen 3: Calendar Detection
    {
      id: 'screen-3',
      title: 'Calendar Setup',
      canGoBack: true,
      canSkip: true,
      template: (state, user) => {
        const calendarCount = state.calendarCount || 0;
        const primaryCalendarName = state.primaryCalendarName || 'Calendar';
        const hasCalendars = calendarCount > 0;
        
        return `
          <div class="welcome-screen-content">
            <div class="welcome-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            
            <h1 class="welcome-title">Calendar Setup</h1>
            
            ${hasCalendars ? `
              <p class="welcome-message">
                I see you have <strong>${calendarCount}</strong> calendar${calendarCount !== 1 ? 's' : ''} 
                associated with this account. I added your primary calendar, 
                <strong>${primaryCalendarName}</strong>, to the display to start.
              </p>
            ` : `
              <p class="welcome-message">
                It looks like there aren't any calendars we can access that are associated with your account.
              </p>
            `}
            
            <div class="welcome-actions">
              <button id="welcome-screen-3-continue" class="welcome-btn welcome-btn-primary">
                Continue
              </button>
            </div>
            
            ${hasCalendars ? `
              <p class="welcome-hint-text">
                You can add more calendars or calendars from other accounts in the settings menu.
              </p>
            ` : `
              <p class="welcome-hint-text">
                You can add calendars from other accounts in the settings menu in the Calendar section.
              </p>
            `}
            
            <p class="welcome-hint">Press ESC to skip setup</p>
          </div>
        `;
      },
      onEnter: async (wizard) => {
        // Detect calendars when entering this screen
        await wizard.detectCalendars();
        
        // Manually re-render the screen content with updated calendar data
        const screenElement = wizard.overlay.querySelector(`[data-screen="screen-3"]`);
        if (screenElement) {
          const screen = wizard.screens.find(s => s.id === 'screen-3');
          screenElement.innerHTML = screen.template(wizard.state, wizard.user);
        }
        
        // Focus continue button
        setTimeout(() => {
          const continueBtn = wizard.overlay.querySelector('#welcome-screen-3-continue');
          continueBtn?.focus();
        }, 100);
      }
    },
    
    // Screen 4: Location Request
    {
      id: 'screen-4',
      title: 'Weather Setup',
      canGoBack: true,
      canSkip: true,
      template: (state, user) => {
        return `
          <div class="welcome-screen-content">
            <div class="welcome-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v2"></path>
                <path d="M12 20v2"></path>
                <path d="m4.93 4.93 1.41 1.41"></path>
                <path d="m17.66 17.66 1.41 1.41"></path>
                <path d="M2 12h2"></path>
                <path d="M20 12h2"></path>
                <path d="m6.34 17.66-1.41 1.41"></path>
                <path d="m19.07 4.93-1.41 1.41"></path>
                <circle cx="12" cy="12" r="4"></circle>
              </svg>
            </div>
            
            <h1 class="welcome-title">Weather Setup</h1>
            
            <p class="welcome-message">
              We'd like to get your location set up for weather. Will you share your location with us?
            </p>
            
            <div class="welcome-actions welcome-actions-column">
              <button id="welcome-screen-4-share" class="welcome-btn welcome-btn-primary">
                Share My Location
              </button>
              <button id="welcome-screen-4-manual" class="welcome-btn welcome-btn-secondary">
                Enter Zip Code
              </button>
              <button id="welcome-screen-4-skip" class="welcome-btn welcome-btn-tertiary">
                Skip for Now
              </button>
            </div>
            
            <p class="welcome-hint-text">
              You can also enter your zip code in Settings in the Family section later.
            </p>
            
            <p class="welcome-hint">Press ESC to skip setup</p>
          </div>
        `;
      },
      onEnter: async (wizard) => {
        // Focus share location button
        setTimeout(() => {
          const shareBtn = wizard.overlay.querySelector('#welcome-screen-4-share');
          shareBtn?.focus();
        }, 100);
      }
    },
    
    // Screen 4B: Confirm Location
    {
      id: 'screen-4b',
      title: 'Confirm Location',
      canGoBack: true,
      canSkip: true,
      template: (state, user) => {
        const city = state.detectedCity || '';
        const stateAbbr = state.detectedState || '';
        const zipCode = state.detectedZipCode || '';
        const locationText = city && stateAbbr ? `${city}, ${stateAbbr} ${zipCode}` : zipCode;
        
        return `
          <div class="welcome-screen-content">
            <div class="welcome-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
            
            <h1 class="welcome-title">Confirm Location</h1>
            
            <p class="welcome-message">
              It looks like you're in <strong>${locationText}</strong>. Is that correct?
            </p>
            
            <div class="welcome-actions">
              <button id="welcome-screen-4b-confirm" class="welcome-btn welcome-btn-primary">
                Yes
              </button>
              <button id="welcome-screen-4b-manual" class="welcome-btn welcome-btn-secondary">
                No, Enter Zip Code
              </button>
            </div>
            
            <p class="welcome-hint">Press ESC to skip setup</p>
          </div>
        `;
      },
      onEnter: async (wizard) => {
        // Focus confirm button
        setTimeout(() => {
          const confirmBtn = wizard.overlay.querySelector('#welcome-screen-4b-confirm');
          confirmBtn?.focus();
        }, 100);
      }
    },
    
    // Screen 4C: Manual Zip Code Entry
    {
      id: 'screen-4c',
      title: 'Enter Zip Code',
      canGoBack: true,
      canSkip: true,
      template: (state, user) => {
        const zipCode = state.manualZipCode || '';
        
        return `
          <div class="welcome-screen-content">
            <div class="welcome-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
            
            <h1 class="welcome-title">Enter Zip Code</h1>
            
            <p class="welcome-message">
              Please enter your 5-digit zip code for weather information.
            </p>
            
            <div class="welcome-input-group">
              <input 
                type="text" 
                id="welcome-zip-code-input" 
                class="welcome-input" 
                value="${zipCode}"
                placeholder="Enter zip code"
                maxlength="5"
                pattern="[0-9]{5}"
                inputmode="numeric"
              />
              <label class="welcome-input-label">Zip Code</label>
            </div>
            
            <div class="welcome-actions">
              <button id="welcome-screen-4c-continue" class="welcome-btn welcome-btn-primary">
                Continue
              </button>
              <button id="welcome-screen-4c-back" class="welcome-btn welcome-btn-secondary">
                Go Back
              </button>
            </div>
            
            <p class="welcome-hint">Press ESC to skip setup</p>
          </div>
        `;
      },
      onEnter: async (wizard) => {
        // Focus and select input
        setTimeout(() => {
          const input = wizard.overlay.querySelector('#welcome-zip-code-input');
          input?.focus();
          input?.select();
          
          // Auto-save on input change
          input?.addEventListener('input', (e) => {
            const value = e.target.value.replace(/\D/g, '').slice(0, 5);
            e.target.value = value;
            wizard.state.manualZipCode = value;
            wizard.saveState();
          });
        }, 100);
      }
    },
    
    // Screen 4D: Location Skipped
    {
      id: 'screen-4d',
      title: 'Location Skipped',
      canGoBack: true,
      canSkip: false,
      template: (state, user) => {
        return `
          <div class="welcome-screen-content">
            <div class="welcome-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            
            <h1 class="welcome-title">Location Skipped</h1>
            
            <p class="welcome-message">
              No problem! You can always set your location later in Settings under the Family section.
            </p>
            
            <div class="welcome-actions">
              <button id="welcome-screen-4d-continue" class="welcome-btn welcome-btn-primary">
                Continue
              </button>
            </div>
          </div>
        `;
      },
      onEnter: async (wizard) => {
        // Focus continue button
        setTimeout(() => {
          const continueBtn = wizard.overlay.querySelector('#welcome-screen-4d-continue');
          continueBtn?.focus();
        }, 100);
      }
    },
    
    // Screen 5: Photos Setup
    {
      id: 'screen-5',
      title: 'Photos Setup',
      canGoBack: true,
      canSkip: true,
      template: (state, user) => {
        return `
          <div class="welcome-screen-content">
            <div class="welcome-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </div>
            
            <h1 class="welcome-title">Photos Setup</h1>
            
            <p class="welcome-message">
              Dashie makes it easy to share your favorite photos. You can easily upload them 
              from your computer or phone. Would you like to add photos now?
            </p>
            
            <div class="welcome-actions">
              <button id="welcome-screen-5-add" class="welcome-btn welcome-btn-primary">
                Yes, Add Photos
              </button>
              <button id="welcome-screen-5-skip" class="welcome-btn welcome-btn-secondary">
                Skip for Now
              </button>
            </div>
            
            <p class="welcome-hint">Press ESC to skip setup</p>
          </div>
        `;
      },
      onEnter: async (wizard) => {
        // Focus add photos button
        setTimeout(() => {
          const addBtn = wizard.overlay.querySelector('#welcome-screen-5-add');
          addBtn?.focus();
        }, 100);
      }
    },
    
    // Screen 5B: Photos Added Confirmation
    {
      id: 'screen-5b',
      title: 'Photos Added',
      canGoBack: false,
      canSkip: false,
      template: (state, user) => {
        const hasPhotos = state.photosAdded || false;
        const moreText = hasPhotos ? 'more ' : '';
        
        return `
          <div class="welcome-screen-content">
            <div class="welcome-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            
            <h1 class="welcome-title">Great!</h1>
            
            <p class="welcome-message">
              It's easy to add ${moreText}photos from the settings menu at any time.
            </p>
            
            <div class="welcome-actions">
              <button id="welcome-screen-5b-continue" class="welcome-btn welcome-btn-primary">
                Continue
              </button>
            </div>
          </div>
        `;
      },
      onEnter: async (wizard) => {
        // Focus continue button
        setTimeout(() => {
          const continueBtn = wizard.overlay.querySelector('#welcome-screen-5b-continue');
          continueBtn?.focus();
        }, 100);
      }
    },
    
    // Screen 6: QR Code for Mobile
    {
      id: 'screen-6',
      title: 'Mobile Access',
      canGoBack: false,
      canSkip: true,
      template: (state, user) => {
        // Determine URL based on environment
        const isDev = window.location.hostname.includes('dev.');
        const qrUrl = isDev ? 'https://dev.dashieapp.com' : 'https://dashieapp.com';
        
        return `
          <div class="welcome-screen-content">
            <div class="welcome-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
              </svg>
            </div>
            
            <h1 class="welcome-title">You're All Set!</h1>
            
            <p class="welcome-message">
              You can configure more options at any time from the settings menu. You can also 
              update settings, add new calendar accounts, add photos, and more on your phone.
            </p>
            
            <div class="welcome-qr-code" data-url="${qrUrl}">
              <!-- QR code will be generated here -->
            </div>
            
            <p class="welcome-hint-text">
              Scan this code with your phone to access Dashie on mobile
            </p>
            
            <div class="welcome-actions">
              <button id="welcome-screen-6-continue" class="welcome-btn welcome-btn-primary">
                Continue
              </button>
            </div>
            
            <p class="welcome-hint">Press ESC to skip setup</p>
          </div>
        `;
      },
      onEnter: async (wizard) => {
        // Generate QR code
        wizard.generateQRCode();
        
        // Focus continue button
        setTimeout(() => {
          const continueBtn = wizard.overlay.querySelector('#welcome-screen-6-continue');
          continueBtn?.focus();
        }, 100);
      }
    },
    
    // Screen 7: Remote Control Tutorial (Final Screen)
    {
      id: 'screen-7',
      title: 'Remote Control',
      canGoBack: false,
      canSkip: false,
      template: (state, user) => {
        return `
          <div class="welcome-screen-content">
            <div class="welcome-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="8" y="2" width="8" height="20" rx="2" ry="2"></rect>
                <circle cx="12" cy="6" r="1"></circle>
                <circle cx="12" cy="10" r="1"></circle>
                <circle cx="12" cy="14" r="1"></circle>
                <circle cx="12" cy="18" r="1"></circle>
              </svg>
            </div>
            
            <h1 class="welcome-title">One More Thing...</h1>
            
            <p class="welcome-message">
              You can also control the different Dashie widgets with your remote by selecting them, 
              which puts them into interactive mode. Try it out!
            </p>
            
            <div class="welcome-actions">
              <button id="welcome-screen-7-complete" class="welcome-btn welcome-btn-primary">
                Let's Go!
              </button>
            </div>
          </div>
        `;
      },
      onEnter: async (wizard)=> {
        // Focus complete button
        setTimeout(() => {
          const completeBtn = wizard.overlay.querySelector('#welcome-screen-7-complete');
          completeBtn?.focus();
        }, 100);
      }
    }
  ];
}
