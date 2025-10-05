// widgets/photos/settings-photos.js
// CHANGE SUMMARY: Complete file with working album selection and modal opening

/**
 * Build all photo-related settings screens
 * @returns {string} HTML template string for photo settings screens
 */
export function buildPhotosSettingsScreens() {
  return `
    <!-- Photos Screen (Level 1) -->
    <div class="settings-screen" data-level="1" data-screen="photos" data-title="Photos">
      <div class="settings-list">
        <!-- Photo Stats Box -->
        <div class="settings-section">
          <div class="photo-stats-box">
            <div class="photo-stat-row">
              <span class="photo-stat-label">Photos</span>
              <span class="photo-stat-value" id="photo-count">Loading...</span>
            </div>
            <div class="photo-stat-row">
              <span class="photo-stat-label">Albums</span>
              <span class="photo-stat-value" id="album-count">Loading...</span>
            </div>
            <div class="photo-stat-row storage-row">
              <span class="photo-stat-label">Storage</span>
              <span class="photo-stat-value" id="storage-used">Loading...</span>
            </div>
            <div class="storage-bar">
              <div class="storage-bar-fill" id="storage-bar-fill" style="width: 0%"></div>
            </div>
          </div>
        </div>
        
        <div class="settings-section">
          <div class="settings-cell action-cell" id="add-photos-btn">
            <span class="cell-label">Add Photos</span>
          </div>
          <div class="settings-cell" data-navigate="delete-photos">
            <span class="cell-label">Delete Photos</span>
            <span class="cell-chevron">›</span>
          </div>
          <div class="settings-cell" data-navigate="photo-album">
            <span class="cell-label">Choose Display Album</span>
            <span class="cell-value" id="mobile-photo-album-value">Recent Photos</span>
            <span class="cell-chevron">›</span>
          </div>
          <div class="settings-cell" data-navigate="photo-transition">
            <span class="cell-label">Photo Transition Time</span>
            <span class="cell-value" id="mobile-photo-transition-value">5 sec</span>
            <span class="cell-chevron">›</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Photo Transition Time Selection (Level 2) -->
    <div class="settings-screen" data-level="2" data-screen="photo-transition" data-title="Photo Transition">
      <div class="settings-list">
        <div class="settings-section">
          <div class="settings-cell selectable" data-setting="photos.transitionTime" data-value="5">
            <span class="cell-label">5 seconds</span>
            <span class="cell-checkmark">✓</span>
          </div>
          <div class="settings-cell selectable" data-setting="photos.transitionTime" data-value="10">
            <span class="cell-label">10 seconds</span>
            <span class="cell-checkmark">✓</span>
          </div>
          <div class="settings-cell selectable" data-setting="photos.transitionTime" data-value="15">
            <span class="cell-label">15 seconds</span>
            <span class="cell-checkmark">✓</span>
          </div>
          <div class="settings-cell selectable" data-setting="photos.transitionTime" data-value="30">
            <span class="cell-label">30 seconds</span>
            <span class="cell-checkmark">✓</span>
          </div>
          <div class="settings-cell selectable" data-setting="photos.transitionTime" data-value="60">
            <span class="cell-label">1 minute</span>
            <span class="cell-checkmark">✓</span>
          </div>
          <div class="settings-cell selectable" data-setting="photos.transitionTime" data-value="900">
            <span class="cell-label">15 minutes</span>
            <span class="cell-checkmark">✓</span>
          </div>
          <div class="settings-cell selectable" data-setting="photos.transitionTime" data-value="1800">
            <span class="cell-label">30 minutes</span>
            <span class="cell-checkmark">✓</span>
          </div>
          <div class="settings-cell selectable" data-setting="photos.transitionTime" data-value="3600">
            <span class="cell-label">1 hour</span>
            <span class="cell-checkmark">✓</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Photo Album Selection (Level 2) -->
    <div class="settings-screen" data-level="2" data-screen="photo-album" data-title="Choose Album">
      <div class="settings-list">
        <div class="settings-section">
          <div class="settings-cell selectable" data-setting="photos.source" data-value="recent">
            <span class="cell-label">Recent Photos</span>
            <span class="cell-checkmark">✓</span>
          </div>
          <div class="settings-cell selectable" data-setting="photos.source" data-value="family">
            <span class="cell-label">Family Album</span>
            <span class="cell-checkmark">✓</span>
          </div>
          <div class="settings-cell selectable" data-setting="photos.source" data-value="vacation">
            <span class="cell-label">Vacation 2024</span>
            <span class="cell-checkmark">✓</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Photos Screen (Level 2) - Full Upload Interface -->
    <div class="settings-screen" data-level="2" data-screen="add-photos" data-title="Add Photos">
      <div class="settings-list">
        <!-- Photo Stats Box (same as main photos screen) -->
        <div class="settings-section">
          <div class="photo-stats-box">
            <div class="photo-stat-row">
              <span class="photo-stat-label">Photos</span>
              <span class="photo-stat-value" id="upload-photo-count">Loading...</span>
            </div>
            <div class="photo-stat-row">
              <span class="photo-stat-label">Albums</span>
              <span class="photo-stat-value" id="upload-album-count">Loading...</span>
            </div>
            <div class="photo-stat-row storage-row">
              <span class="photo-stat-label">Storage</span>
              <span class="photo-stat-value" id="upload-storage-used">Loading...</span>
            </div>
            <div class="storage-bar">
              <div class="storage-bar-fill" id="upload-storage-bar-fill" style="width: 0%"></div>
            </div>
          </div>
        </div>

        <!-- Album Selection -->
        <div class="settings-section">
          <div class="settings-cell" data-navigate="select-upload-album">
            <span class="cell-label">Album</span>
            <span class="cell-value" id="upload-album-display">All Photos</span>
            <span class="cell-chevron">›</span>
          </div>
        </div>

        <!-- Progress Section (hidden by default) -->
        <div class="settings-section" id="upload-progress-section" style="display: none;">
          <div class="photo-stats-box">
            <div class="photo-stat-row">
              <span class="photo-stat-label">Uploading...</span>
              <span class="photo-stat-value" id="upload-progress-percent">0%</span>
            </div>
            <div class="storage-bar">
              <div class="storage-bar-fill upload-bar" id="upload-progress-fill" style="width: 0%"></div>
            </div>
            <p style="text-align: center; color: #8E8E93; font-size: 13px; margin: 8px 0 0 0;" id="upload-progress-detail">
              Photo 0 of 0
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Select Upload Album Screen (Level 3) -->
    <div class="settings-screen" data-level="3" data-screen="select-upload-album" data-title="Choose Album">
      <div class="settings-list">
        <div class="settings-section">
          <div class="settings-cell action-cell" id="create-new-album-btn">
            <span class="cell-label">➕ Create New Album</span>
          </div>
        </div>
        
        <div class="settings-section" id="upload-album-list">
          <!-- Albums populated dynamically -->
          <div class="settings-cell selectable" data-album="all-photos">
            <span class="cell-label">All Photos</span>
            <span class="cell-checkmark">✓</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Photos Placeholder (Level 2) -->
    <div class="settings-screen" data-level="2" data-screen="delete-photos" data-title="Delete Photos">
      <div class="settings-list">
        <div class="coming-soon">
          <h3>Delete Photos</h3>
          <p>Photo deletion interface coming soon.</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Format transition time in seconds to human-readable format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string (e.g., "5 sec", "2 min", "1 hour")
 */
export function formatTransitionTime(seconds) {
  if (seconds < 60) return `${seconds} sec`;
  if (seconds < 3600) return `${seconds / 60} min`;
  return `${seconds / 3600} hour`;
}

/**
 * Populate photo-specific form fields with current settings
 * @param {HTMLElement} overlay - The settings overlay element
 * @param {Object} settings - The current settings object
 */
export function populatePhotoFields(overlay, settings) {
  // Photo transition value display
  const mobilePhotoTransitionValue = overlay.querySelector('#mobile-photo-transition-value');
  if (mobilePhotoTransitionValue && settings.photos?.transitionTime) {
    mobilePhotoTransitionValue.textContent = formatTransitionTime(settings.photos.transitionTime);
  }
  
  // Photo transition selection cells
  const photoTransitionCells = overlay.querySelectorAll('.settings-cell[data-setting="photos.transitionTime"]');
  photoTransitionCells.forEach(cell => {
    if (parseInt(cell.dataset.value) === settings.photos?.transitionTime) {
      cell.classList.add('selected');
    } else {
      cell.classList.remove('selected');
    }
  });
  
  // Photo album value display
  const mobilePhotoAlbumValue = overlay.querySelector('#mobile-photo-album-value');
  if (mobilePhotoAlbumValue && settings.photos?.source) {
    const albumLabels = {
      'recent': 'Recent Photos',
      'family': 'Family Album',
      'vacation': 'Vacation 2024'
    };
    mobilePhotoAlbumValue.textContent = albumLabels[settings.photos.source] || 'Recent Photos';
  }
  
  // Photo album selection cells
  const photoAlbumCells = overlay.querySelectorAll('.settings-cell[data-setting="photos.source"]');
  photoAlbumCells.forEach(cell => {
    if (cell.dataset.value === settings.photos?.source) {
      cell.classList.add('selected');
    } else {
      cell.classList.remove('selected');
    }
  });
  
  // Populate photo stats
  populatePhotoStats(overlay);
}

/**
 * Populate live photo statistics (count, albums, storage)
 * @param {HTMLElement} overlay - The settings overlay element
 */
export async function populatePhotoStats(overlay) {
  try {
    // Get photo data service from window
    const photoService = window.dataManager?.photoService;
    
    if (!photoService || !photoService.isReady()) {
      console.warn('📸 Photo service not ready for stats');
      return;
    }

    // Get storage usage
    const usage = await photoService.getStorageUsage();
    
    // Get folders
    const folders = await photoService.listFolders();
    
    // Get total photo count (all folders)
    const allPhotos = await photoService.storage.listPhotos(null, 1000);
    
    // Update photo count (main photos screen)
    const photoCountEl = overlay.querySelector('#photo-count');
    if (photoCountEl) {
      photoCountEl.textContent = allPhotos.length;
    }
    
    // Update photo count (upload screen)
    const uploadPhotoCountEl = overlay.querySelector('#upload-photo-count');
    if (uploadPhotoCountEl) {
      uploadPhotoCountEl.textContent = allPhotos.length;
    }
    
    // Update album count (main photos screen)
    const albumCountEl = overlay.querySelector('#album-count');
    if (albumCountEl) {
      albumCountEl.textContent = folders.length;
    }
    
    // Update album count (upload screen)
    const uploadAlbumCountEl = overlay.querySelector('#upload-album-count');
    if (uploadAlbumCountEl) {
      uploadAlbumCountEl.textContent = folders.length;
    }
    
    // Update storage display (main photos screen)
    const storageUsedEl = overlay.querySelector('#storage-used');
    if (storageUsedEl) {
      storageUsedEl.textContent = `${usage.usedMB} MB / ${usage.quotaMB} MB`;
    }
    
    // Update storage display (upload screen)
    const uploadStorageUsedEl = overlay.querySelector('#upload-storage-used');
    if (uploadStorageUsedEl) {
      uploadStorageUsedEl.textContent = `${usage.usedMB} MB / ${usage.quotaMB} MB`;
    }
    
    // Update storage bar (main photos screen)
    const storageFillEl = overlay.querySelector('#storage-bar-fill');
    if (storageFillEl) {
      storageFillEl.style.width = `${usage.percentUsed}%`;
    }
    
    // Update storage bar (upload screen)
    const uploadStorageFillEl = overlay.querySelector('#upload-storage-bar-fill');
    if (uploadStorageFillEl) {
      uploadStorageFillEl.style.width = `${usage.percentUsed}%`;
    }
    
    console.log('📸 Photo stats updated', { 
      photos: allPhotos.length, 
      albums: folders.length, 
      storage: `${usage.usedMB}/${usage.quotaMB} MB` 
    });
    
  } catch (error) {
    console.error('📸 Failed to populate photo stats', error);
  }
}


/**
 * Initialize upload functionality on the photos screen
 * @param {HTMLElement} overlay - The settings overlay element
 */
export function initializeUploadHandlers(overlay) {
  const addPhotosBtn = overlay.querySelector('#add-photos-btn');
  
  if (addPhotosBtn) {
    // Remove existing listener if any
    const newBtn = addPhotosBtn.cloneNode(true);
    addPhotosBtn.parentNode.replaceChild(newBtn, addPhotosBtn);
    
    // Add click handler to open photos settings modal
    newBtn.addEventListener('click', () => {
      console.log('📸 Add Photos clicked - opening photos settings modal');
      
      // CHANGED FROM: window.photoUploadManager
      // CHANGED TO: window.photosSettingsManager
      if (window.photosSettingsManager) {
        window.photosSettingsManager.open();
      } else {
        console.error('📸 PhotosSettingsManager not available');
        alert('Photo settings not available yet. Please wait a moment and try again.');
      }
    });
  }
  
  console.log('📸 Upload handlers initialized');
}

/**
 * Populate album list for selection
 * @param {HTMLElement} overlay - The settings overlay element
 */
async function populateAlbumList(overlay) {
  try {
    const photoService = window.dataManager?.photoService;
    
    if (!photoService || !photoService.isReady()) {
      console.warn('📸 Photo service not ready for album list');
      return;
    }
    
    const folders = await photoService.listFolders();
    const albumList = overlay.querySelector('#upload-album-list');
    
    if (!albumList) return;
    
    // Keep "All Photos" at top, clear rest
    albumList.innerHTML = `
      <div class="settings-cell selectable selected" data-album="all-photos">
        <span class="cell-label">All Photos</span>
        <span class="cell-checkmark">✓</span>
      </div>
    `;
    
    // Add other folders
    folders.forEach(folder => {
      if (folder.name !== 'all-photos') {
        const cell = document.createElement('div');
        cell.className = 'settings-cell selectable';
        cell.dataset.album = folder.name;
        cell.innerHTML = `
          <span class="cell-label">${folder.name} (${folder.photoCount} photos)</span>
          <span class="cell-checkmark">✓</span>
        `;
        
        // Add click handler for album selection
        cell.addEventListener('click', () => {
          selectAlbum(overlay, folder.name);
        });
        
        albumList.appendChild(cell);
      }
    });
    
    // Add click handler for "All Photos"
    const allPhotosCell = albumList.querySelector('[data-album="all-photos"]');
    if (allPhotosCell) {
      allPhotosCell.addEventListener('click', () => {
        selectAlbum(overlay, 'all-photos');
      });
    }
    
    console.log('📸 Album list populated', { count: folders.length });
    
  } catch (error) {
    console.error('📸 Failed to populate album list', error);
  }
}

/**
 * Select an album for upload
 * @param {HTMLElement} overlay - The settings overlay element
 * @param {string} albumName - Album name to select
 */
async function selectAlbum(overlay, albumName) {
  // Update selected state in album list
  const albumCells = overlay.querySelectorAll('#upload-album-list .settings-cell');
  albumCells.forEach(cell => {
    if (cell.dataset.album === albumName) {
      cell.classList.add('selected');
    } else {
      cell.classList.remove('selected');
    }
  });
  
  // Update the display value on the add-photos screen
  const displayEl = overlay.querySelector('#upload-album-display');
  if (displayEl) {
    displayEl.textContent = albumName === 'all-photos' ? 'All Photos' : albumName;
  }
  
  // Store selection in global state
  if (!window.photoUploadState) {
    window.photoUploadState = {};
  }
  window.photoUploadState.selectedAlbum = albumName;
  
  console.log('📸 Album selected', { album: albumName });
  
  // Open upload modal with selected album
  console.log('📸 Checking for PhotoUploadManager...', { 
    exists: !!window.photoUploadManager,
    dataManager: !!window.dataManager,
    photoService: !!window.dataManager?.photoService 
  });
  
  if (window.photoUploadManager) {
    console.log('📸 Opening upload modal for album:', albumName);
    window.photoUploadManager.open(albumName);
    
    // Navigate back to add-photos screen
    setTimeout(() => {
      const backBtn = overlay.querySelector('.nav-back-button');
      if (backBtn) {
        backBtn.click();
      }
    }, 100);
  } else {
    console.error('📸 PhotoUploadManager not available - attempting to initialize');
    
    // Try to initialize it now
    if (window.dataManager?.photoService?.isReady()) {
      const { PhotoUploadManager } = await import('./photo-upload-manager.js');
      window.photoUploadManager = new PhotoUploadManager(window.dataManager.photoService);
      console.log('📸 PhotoUploadManager initialized on-demand');
      window.photoUploadManager.open(albumName);
      
      setTimeout(() => {
        const backBtn = overlay.querySelector('.nav-back-button');
        if (backBtn) {
          backBtn.click();
        }
      }, 100);
    } else {
      alert('Photo upload not available yet. Please wait a moment and try again.');
    }
  }
}

/**
 * Handle creating a new album
 * @param {HTMLElement} overlay - The settings overlay element
 */
function handleCreateAlbum(overlay) {
  const albumName = prompt('Enter new album name:');
  
  if (!albumName || albumName.trim() === '') {
    return;
  }
  
  const sanitized = albumName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  
  if (sanitized === 'all-photos') {
    alert('Album name "all-photos" is reserved. Please choose another name.');
    return;
  }
  
  // Store the new album name
  if (!window.photoUploadState) {
    window.photoUploadState = {};
  }
  window.photoUploadState.selectedAlbum = sanitized;
  
  // Update display
  const displayEl = overlay.querySelector('#upload-album-display');
  if (displayEl) {
    displayEl.textContent = sanitized;
  }
  
  // Refresh album list (album will be created on first upload)
  populateAlbumList(overlay);
  
  // Navigate back
  const backBtn = overlay.querySelector('.nav-back-button');
  if (backBtn) {
    backBtn.click();
  }
  
  console.log('📸 New album created', { name: sanitized });
}