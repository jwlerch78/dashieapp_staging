// widgets/photos/photos-modal-overlays.js
// CHANGE SUMMARY: Extracted overlay creation functions from photos-settings-modal.js for better organization

/**
 * Show upload progress overlay with cancel functionality
 */
export function showUploadOverlay() {
  let overlay = document.getElementById('upload-blocking-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'upload-blocking-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 9998;
      pointer-events: all;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    document.body.appendChild(overlay);
    
    // Create the upload modal inside the overlay
    const uploadModal = document.createElement('div');
    uploadModal.id = 'upload-progress-modal';
    uploadModal.style.cssText = `
      background: #fff;
      border-radius: 12px;
      padding: 24px;
      width: 90%;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;
    
    // Add dark theme support
    if (document.body.classList.contains('theme-dark')) {
      uploadModal.style.background = '#1c1c1e';
      uploadModal.style.color = '#ffffff';
    }
    
    uploadModal.innerHTML = `
      <h3 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Uploading Photos</h3>
      <div id="modal-upload-info" style="font-size: 15px; color: #8e8e93; margin-bottom: 12px;">Preparing...</div>
      <div style="background: #e5e5ea; border-radius: 4px; height: 8px; overflow: hidden; margin-bottom: 8px;">
        <div id="modal-upload-fill" style="height: 100%; background: #EE9828; width: 0%; transition: width 0.3s ease;"></div>
      </div>
      <div id="modal-upload-detail" style="font-size: 13px; color: #8e8e93; margin-bottom: 16px;">0 / 0 files</div>
      <button id="cancel-upload-btn" style="
        width: 100%;
        padding: 12px;
        background: transparent;
        border: 1px solid #8e8e93;
        border-radius: 8px;
        color: #8e8e93;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.2s;
      ">Cancel Upload</button>
    `;
    
    overlay.appendChild(uploadModal);
    
    // Style the cancel button on hover
    const cancelBtn = uploadModal.querySelector('#cancel-upload-btn');
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.background = 'rgba(142, 142, 147, 0.1)';
    });
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.background = 'transparent';
    });
  }
  overlay.style.display = 'flex';
  return overlay;
}

/**
 * Hide upload progress overlay
 */
export function hideUploadOverlay() {
  const overlay = document.getElementById('upload-blocking-overlay');
  if (overlay) {
    overlay.style.display = 'none';
    overlay.remove();
  }
}

/**
 * Show confirmation modal for delete all photos
 * @param {string} photoCount - Number of photos to display in message
 * @param {Function} onConfirm - Callback when user confirms
 */
export function showConfirmationModal(photoCount, onConfirm) {
  // Create confirmation overlay
  const overlay = document.createElement('div');
  overlay.id = 'delete-confirmation-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
  `;
  
  // Create confirmation modal
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: ${document.body.classList.contains('theme-dark') ? '#1c1c1e' : '#ffffff'};
    border-radius: 14px;
    padding: 24px;
    max-width: 320px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  `;
  
  modal.innerHTML = `
    <h3 style="margin: 0 0 12px 0; font-size: 17px; font-weight: 600; color: ${document.body.classList.contains('theme-dark') ? '#ffffff' : '#000000'}; text-align: center;">
      Delete All Photos?
    </h3>
    <p style="margin: 0 0 24px 0; font-size: 14px; color: #8e8e93; text-align: center; line-height: 1.4;">
      This will permanently delete all ${photoCount} photos from your library and reset your storage quota. This action cannot be undone.
    </p>
    <div style="display: flex; gap: 12px;">
      <button id="confirm-delete-cancel" style="
        flex: 1;
        padding: 12px;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        background: ${document.body.classList.contains('theme-dark') ? '#2c2c2e' : '#f0f0f0'};
        color: ${document.body.classList.contains('theme-dark') ? '#ffffff' : '#000000'};
      ">Cancel</button>
      <button id="confirm-delete-yes" style="
        flex: 1;
        padding: 12px;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        background: #ff3b30;
        color: #ffffff;
      ">Delete All</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Add event listeners
  document.getElementById('confirm-delete-cancel').addEventListener('click', () => {
    overlay.remove();
  });
  
  document.getElementById('confirm-delete-yes').addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

/**
 * Show delete progress overlay with spinner
 */
export function showDeleteProgress() {
  let overlay = document.getElementById('delete-progress-overlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'delete-progress-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
    `;
    
    const progressModal = document.createElement('div');
    progressModal.style.cssText = `
      background: ${document.body.classList.contains('theme-dark') ? '#1c1c1e' : '#ffffff'};
      border-radius: 14px;
      padding: 32px 24px;
      min-width: 280px;
      max-width: 320px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;
    
    progressModal.innerHTML = `
      <div style="margin-bottom: 16px;">
        <div style="
          width: 48px;
          height: 48px;
          border: 3px solid #f0f0f0;
          border-top-color: #EE9828;
          border-radius: 50%;
          margin: 0 auto;
          animation: spin 1s linear infinite;
        "></div>
      </div>
      <div id="delete-progress-info" style="
        font-size: 16px;
        font-weight: 500;
        color: ${document.body.classList.contains('theme-dark') ? '#ffffff' : '#000000'};
        margin-bottom: 8px;
      ">Deleting photos...</div>
      <div style="font-size: 14px; color: #8e8e93;">Please wait</div>
    `;
    
    // Add spinner animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    overlay.appendChild(progressModal);
    document.body.appendChild(overlay);
  }
  
  overlay.style.display = 'flex';
}

/**
 * Hide delete progress overlay
 */
export function hideDeleteProgress() {
  const overlay = document.getElementById('delete-progress-overlay');
  if (overlay) {
    overlay.style.display = 'none';
    overlay.remove();
  }
}