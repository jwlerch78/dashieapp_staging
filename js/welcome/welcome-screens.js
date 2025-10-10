// js/welcome/welcome-screens.js
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
              <img src="/images/dashie-logo.png" alt="Dashie Logo" />
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
              
              <div class="welcome-actions">
                <button id="welcome-screen-2-save" class="welcome-btn welcome-btn-primary">
                  Save Family Name
                </button>
                <button id="welcome-screen-2-cancel" class="welcome-btn welcome-btn-secondary">
                  Cancel
                </button>
              </div>
            `}
            
            <p class="welcome-hint">Press ESC to skip setup</p>
          </div>
        `;
      },
      onEnter: async (wizard) => {
        // Focus appropriate button based on editing state
        setTimeout(() => {
          if (wizard.state.editingFamilyName) {
            const input = wizard.overlay.querySelector('#welcome-family-name-input');
            input?.focus();
            input?.select();
          } else {
            const confirmBtn = wizard.overlay.querySelector('#welcome-screen-2-confirm');
            confirmBtn?.focus();
          }
        }, 100);
      }
    }
  ];
}
