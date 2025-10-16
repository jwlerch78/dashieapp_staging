// js/ui/loading-overlay.js - Loading overlay manager
// CHANGE SUMMARY: New loading overlay system with progress tracking and smooth transitions

// js/ui/loading-overlay.js - Loading overlay manager
// CHANGE SUMMARY: Updated to use simple TAGLINE variable from config.js instead of import

/**
 * Loading overlay manager for Dashie initialization
 * Provides visual feedback during the 5-7 second startup sequence
 */
class LoadingOverlay {
  constructor() {
    this.overlay = null;
    this.progressFill = null;
    this.progressText = null;
    this.currentProgress = 0;
    this.isVisible = false;
  }

  /**
   * Create and show the loading overlay
   */
  show() {
    if (this.isVisible) return;

    // Create overlay HTML
    this.overlay = document.createElement('div');
    this.overlay.className = 'loading-overlay';
    this.overlay.innerHTML = this.getOverlayHTML();

    // Add to page
    document.body.appendChild(this.overlay);

    // Get references to dynamic elements
    this.progressFill = this.overlay.querySelector('.progress-fill');
    this.progressText = this.overlay.querySelector('.progress-text');

    this.isVisible = true;
    console.log('🔄 Loading overlay shown');
  }

  /**
   * Update progress and status message
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} message - Status message to display
   */
  updateProgress(progress, message) {
    if (!this.isVisible || !this.progressFill || !this.progressText) return;

    // Ensure progress only increases
    if (progress > this.currentProgress) {
      this.currentProgress = progress;
      
      // Update progress bar
      this.progressFill.style.width = `${progress}%`;
      
      // Update status text
      this.progressText.textContent = message;
      
      console.log(`🔄 Loading progress: ${progress}% - ${message}`);
    }
  }

  /**
   * Hide the loading overlay with fade transition
   */
  hide() {
    if (!this.isVisible || !this.overlay) return;

    console.log('🔄 Hiding loading overlay');

    // Add hidden class for fade transition
    this.overlay.classList.add('hidden');

    // Remove from DOM after transition completes
    setTimeout(() => {
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      this.overlay = null;
      this.progressFill = null;
      this.progressText = null;
      this.isVisible = false;
      console.log('✅ Loading overlay removed');
    }, 500); // Match CSS transition duration
  }

  /**
   * Generate the overlay HTML structure
   * @returns {string} HTML content
   */
  getOverlayHTML() {
    // Get tagline from global config (fallback if not available)
    const tagline = window.TAGLINE || "Helping active families manage the chaos";
    
    return `
      <div class="loading-content">
        <img src="icons/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie" class="loading-logo">
        
        <p class="loading-tagline">${tagline}</p>
        
        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <div class="progress-text">Starting up...</div>
        </div>
      </div>
    `;
  }

  /**
   * Check if overlay is currently visible
   * @returns {boolean} True if overlay is visible
   */
  isShown() {
    return this.isVisible;
  }
}

// Create global instance
let loadingOverlayInstance = null;

/**
 * Show the loading overlay
 */
export function showLoadingOverlay() {
  if (!loadingOverlayInstance) {
    loadingOverlayInstance = new LoadingOverlay();
  }
  loadingOverlayInstance.show();
}

/**
 * Update loading progress
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} message - Status message
 */
export function updateLoadingProgress(progress, message) {
  if (loadingOverlayInstance) {
    loadingOverlayInstance.updateProgress(progress, message);
  }
}

/**
 * Hide the loading overlay
 */
export function hideLoadingOverlay() {
  if (loadingOverlayInstance) {
    loadingOverlayInstance.hide();
    loadingOverlayInstance = null;
  }
}

/**
 * Check if loading overlay is visible
 * @returns {boolean} True if visible
 */
export function isLoadingOverlayVisible() {
  return loadingOverlayInstance ? loadingOverlayInstance.isShown() : false;
}

// Export for debugging
export { LoadingOverlay };