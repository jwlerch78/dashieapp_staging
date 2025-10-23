// widgets/photos/photos-modal-overlays.js
// CHANGE SUMMARY: Extracted overlay creation functions from photos-settings-modal.js for better organization

/**
 * Helper function to detect if any dark theme variant is active
 * @returns {boolean} True if any dark theme is active
 */
function isDarkTheme() {
  const classList = document.body.classList;
  return classList.contains('theme-dark') ||
         classList.contains('theme-halloween-dark');
}

/**
 * Helper function to get theme-appropriate colors
 * @returns {object} Color palette for current theme
 */
function getThemeColors() {
  const isDark = isDarkTheme();
  return {
    modalBg: isDark ? '#2a2a2a' : '#ffffff',
    modalText: isDark ? '#ffffff' : '#000000',
    secondaryBg: isDark ? '#333' : '#f5f5f5',
    secondaryText: '#8e8e93',
    borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(60, 60, 67, 0.29)'
  };
}

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
    const colors = getThemeColors();
    const uploadModal = document.createElement('div');
    uploadModal.id = 'upload-progress-modal';
    uploadModal.style.cssText = `
      background: ${colors.modalBg};
      color: ${colors.modalText};
      border-radius: 12px;
      padding: 24px;
      width: 90%;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;
    
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
  // CRITICAL: Create modal in PARENT document, not iframe
  const parentDoc = window.parent.document;
  const colors = getThemeColors();
  
  // Create confirmation overlay in parent
  const overlay = parentDoc.createElement('div');
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
  const modal = parentDoc.createElement('div');
  modal.style.cssText = `
    background: ${colors.modalBg};
    border-radius: 14px;
    padding: 24px;
    max-width: 320px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  `;

  modal.innerHTML = `
    <h3 style="margin: 0 0 12px 0; font-size: 17px; font-weight: 600; color: ${colors.modalText}; text-align: center;">
      Delete All Photos?
    </h3>
    <p style="margin: 0 0 24px 0; font-size: 14px; color: ${colors.secondaryText}; text-align: center; line-height: 1.4;">
      This will permanently delete all ${photoCount} photos from your library and reset your storage quota. This action cannot be undone.
    </p>
    <div style="display: flex; gap: 12px;">
      <button id="confirm-delete-cancel" tabindex="0" style="
        flex: 1;
        padding: 12px;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        background: ${colors.secondaryBg};
        color: ${colors.modalText};
        transition: all 0.2s;
      ">Cancel</button>
      <button id="confirm-delete-yes" tabindex="1" style="
        flex: 1;
        padding: 12px;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        background: ${colors.secondaryBg};
        color: ${colors.modalText};
        transition: all 0.2s;
      ">Delete All</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  parentDoc.body.appendChild(overlay);
  
  // Add focus styles to parent document
  if (!parentDoc.getElementById('photo-delete-modal-focus-styles')) {
    const style = parentDoc.createElement('style');
    style.id = 'photo-delete-modal-focus-styles';
    style.textContent = `
      #confirm-delete-cancel:focus,
      #confirm-delete-yes:focus {
        outline: 3px solid #ffaa00 !important;
        outline-offset: 2px !important;
        transform: scale(1.05) !important;
        box-shadow: 0 0 15px rgba(255, 170, 0, 0.5) !important;
        background: rgba(255, 170, 0, 0.2) !important;
      }
    `;
    parentDoc.head.appendChild(style);
  }
  
  // Store navigation instance
  let modalNavigation = null;
  
  // Cleanup function
  const cleanup = () => {
    if (modalNavigation) {
      modalNavigation.destroy();
      modalNavigation = null;
    }
    overlay.remove();
  };
  
  // Add event listeners using parent document
  parentDoc.getElementById('confirm-delete-cancel').addEventListener('click', cleanup);
  
  parentDoc.getElementById('confirm-delete-yes').addEventListener('click', () => {
    cleanup();
    onConfirm();
  });
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      cleanup();
    }
  });
  
  // FIXED: Register with PARENT's modal manager
  const parentModalManager = window.parent.dashieModalManager;
  
  if (parentModalManager) {
    const buttons = ['confirm-delete-cancel', 'confirm-delete-yes'];
    const modalConfig = {
      buttons: buttons.map(id => ({ id })),
      horizontalNavigation: true,
      initialFocus: 0,
      onEscape: cleanup
    };
    
    // DEBUG: Log before registration
    console.log('🔴 Photos delete modal - before registration:', {
      modal,
      modalHTML: modal.innerHTML.substring(0, 200),
      buttons,
      cancelExists: !!modal.querySelector('#confirm-delete-cancel'),
      yesExists: !!modal.querySelector('#confirm-delete-yes')
    });
    
    parentModalManager.registerModal(modal, modalConfig);
    
    // DEBUG: Log after registration
    console.log('🔴 Photos delete modal - after registration:', {
      stackDepth: parentModalManager.modalStack.length,
      focusableCount: parentModalManager.focusableElements?.length,
      debug: parentModalManager.getDebugInfo(),
      topModal: parentModalManager.activeModal?.id,
      topModalButtons: parentModalManager.focusableElements?.map(el => el?.id),
      allStackModals: parentModalManager.modalStack.map((entry, idx) => ({
        index: idx,
        modalId: entry.modal?.id,
        focusableCount: entry.focusableElements?.length,
        focusableIds: entry.focusableElements?.map(el => el?.id)
      }))
    });
    
    modalNavigation = {
      destroy: () => {
        if (parentModalManager.hasActiveModal()) {
          parentModalManager.unregisterModal();
        }
      }
    };
    
    // Auto-focus cancel button after a delay
    setTimeout(() => {
      const cancelBtn = parentDoc.getElementById('confirm-delete-cancel');
      console.log('🔴 Attempting to focus cancel button:', {
        exists: !!cancelBtn,
        canFocus: typeof cancelBtn?.focus === 'function'
      });
      cancelBtn?.focus();
    }, 100);
  }
}

/**
 * Show delete progress overlay with spinner
 */
export function showDeleteProgress() {
  let overlay = document.getElementById('delete-progress-overlay');

  if (!overlay) {
    const colors = getThemeColors();
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
      background: ${colors.modalBg};
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
          border: 3px solid ${colors.secondaryBg};
          border-top-color: #EE9828;
          border-radius: 50%;
          margin: 0 auto;
          animation: spin 1s linear infinite;
        "></div>
      </div>
      <div id="delete-progress-info" style="
        font-size: 16px;
        font-weight: 500;
        color: ${colors.modalText};
        margin-bottom: 8px;
      ">Deleting photos...</div>
      <div style="font-size: 14px; color: ${colors.secondaryText};">Please wait</div>
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

// Add these functions to photos-modal-overlays.js

/**
 * Show QR code modal for TV devices
 * @param {string} uploadUrl - The URL to encode in the QR code
 * @param {Function} onClose - Optional callback when modal closes
 */
export function showQRCodeModal(uploadUrl, onClose = null) {
  const logger = window.createLogger ? window.createLogger('QRModal') : console;
  logger.info?.('Showing QR code modal for TV upload');
  
  // Create blocking overlay
  let overlay = document.getElementById('qr-code-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'qr-code-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    document.body.appendChild(overlay);
    
    // Create QR modal
    const colors = getThemeColors();
    const qrModal = document.createElement('div');
    qrModal.id = 'qr-code-modal';
    qrModal.style.cssText = `
      background: ${colors.modalBg};
      color: ${colors.modalText};
      border-radius: 12px;
      padding: 40px;
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      text-align: center;
    `;
    
    qrModal.innerHTML = `
      <p style="margin: 0 0 20px 0; font-size: 12px; color: #666; text-align: center;">To upload photos to Dashie:</p>
      <div id="qr-code-container" style="margin: 0 auto 20px auto; padding: 12px; background: white; border-radius: 8px; display: inline-block;">
        <!-- QR code will be generated here -->
      </div>
      <p style="font-size: 12px; color: #8e8e93; margin: 0 0 6px 0;">Scan with your phone or visit:</p>
      <p style="font-size: 13px; font-weight: 600; margin: 6px 0 24px 0; color: #EE9828;">${uploadUrl.replace('#photos', '')}</p>
      <button id="qr-close-btn" style="
        width: 50%;
        padding: 8px;
        background: #EE9828;
        border: none;
        border-radius: 8px;
        color: white;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
        margin: 0 auto;
        display: block;
      ">Close</button>
    `;
    
    overlay.appendChild(qrModal);
    
    // Generate QR code
    generateQRCode('qr-code-container', uploadUrl);
    
    // Close button handler
    const closeBtn = qrModal.querySelector('#qr-close-btn');
    closeBtn.addEventListener('click', () => {
      hideQRCodeModal();
      if (onClose) onClose();
    });
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.opacity = '0.8';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.opacity = '1';
    });
    
    // Auto-focus the close button so "select" on remote closes it
    setTimeout(() => {
      closeBtn.focus();
    }, 100);
    
    // Also allow overlay click to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        hideQRCodeModal();
        if (onClose) onClose();
      }
    });
  }
  
  overlay.style.display = 'flex';
}

/**
 * Hide QR code modal
 */
export function hideQRCodeModal() {
  const overlay = document.getElementById('qr-code-overlay');
  if (overlay) {
    overlay.remove();
  }
}

/**
 * Generate QR code using qrcode library from CDN
 * @param {string} containerId - ID of the container element
 * @param {string} url - URL to encode
 */
function generateQRCode(containerId, url) {
  const logger = window.createLogger ? window.createLogger('QRModal') : console;
  const container = document.getElementById(containerId);
  
  if (!container) {
    logger.error?.('QR code container not found');
    return;
  }
  
  // Check if qrcode library is loaded
  if (typeof QRCode === 'undefined') {
    // Load QRCode library from CDN
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    script.onload = () => {
      createQRCode(container, url);
    };
    script.onerror = () => {
      logger.error?.('Failed to load QR code library');
      container.innerHTML = '<p style="color: #ff3b30;">Failed to generate QR code</p>';
    };
    document.head.appendChild(script);
  } else {
    createQRCode(container, url);
  }
}

/**
 * Create QR code instance
 * @param {HTMLElement} container - Container element
 * @param {string} url - URL to encode
 */
function createQRCode(container, url) {
  const logger = window.createLogger ? window.createLogger('QRModal') : console;

  // Clear container
  container.innerHTML = '';

  // ✅ Wait for next frame so layout is ready
  requestAnimationFrame(() => {
    try {
      new QRCode(container, {
        text: url,
        width: 120,
        height: 120,
        colorDark: '#EE9828',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
      logger.info?.('QR code generated', { url });
    } catch (error) {
      logger.error?.('Failed to create QR code', error);
      container.innerHTML = '<p style="color: #ff3b30;">Failed to generate QR code</p>';
    }
  });
}

/**
 * Show upload results modal
 * @param {Object} results - Upload results object
 * @param {number} results.successful - Number of successful uploads
 * @param {number} results.failed - Number of failed conversions
 * @param {number} results.skipped - Number of duplicate files skipped
 * @param {number} results.total - Total files attempted
 */
export function showUploadResultsModal(results) {
  const colors = getThemeColors();

  let overlay = document.getElementById('upload-results-overlay');
  if (overlay) {
    overlay.remove();
  }

  overlay = document.createElement('div');
  overlay.id = 'upload-results-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 9999;
    pointer-events: all;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: ${colors.modalBg};
    border-radius: 14px;
    padding: 24px;
    max-width: 380px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  `;

  const icon = results.successful === results.total
    ? '✓'
    : results.successful > 0
    ? '⚠'
    : '✗';

  const iconColor = results.successful === results.total
    ? '#34C759'
    : results.successful > 0
    ? '#FF9500'
    : '#FF3B30';

  const title = results.successful === results.total
    ? 'Upload Complete!'
    : results.successful > 0
    ? 'Upload Partially Complete'
    : 'Upload Failed';

  modal.innerHTML = `
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: ${iconColor}20;
        color: ${iconColor};
        font-size: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px auto;
        font-weight: bold;
      ">${icon}</div>
      <h3 style="margin: 0; font-size: 20px; font-weight: 600; color: ${colors.modalText};">
        ${title}
      </h3>
    </div>

    <div style="margin-bottom: 24px;">
      ${results.successful > 0 ? `
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          background: ${colors.secondaryBg};
          border-radius: 8px;
          margin-bottom: 8px;
        ">
          <span style="color: ${colors.modalText}; font-size: 15px;">
            ✓ Uploaded successfully
          </span>
          <span style="color: #34C759; font-weight: 600; font-size: 15px;">
            ${results.successful}
          </span>
        </div>
      ` : ''}

      ${results.failed > 0 ? `
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          background: ${colors.secondaryBg};
          border-radius: 8px;
          margin-bottom: 8px;
        ">
          <span style="color: ${colors.modalText}; font-size: 15px;">
            ✗ Failed (conversion)
          </span>
          <span style="color: #FF3B30; font-weight: 600; font-size: 15px;">
            ${results.failed}
          </span>
        </div>
      ` : ''}

      ${results.skipped > 0 ? `
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          background: ${colors.secondaryBg};
          border-radius: 8px;
        ">
          <span style="color: ${colors.modalText}; font-size: 15px;">
            ⊘ Skipped (duplicate)
          </span>
          <span style="color: #FF9500; font-weight: 600; font-size: 15px;">
            ${results.skipped}
          </span>
        </div>
      ` : ''}
    </div>

    <button id="upload-results-close-btn" tabindex="0" style="
      width: 100%;
      padding: 12px;
      background: #EE9828;
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    ">OK</button>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Close button handler
  const closeBtn = modal.querySelector('#upload-results-close-btn');
  const close = () => {
    overlay.remove();
  };

  closeBtn.addEventListener('click', close);
  closeBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      close();
    }
  });

  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.opacity = '0.8';
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.opacity = '1';
  });

  // Auto-focus close button
  setTimeout(() => {
    closeBtn.focus();
  }, 100);

  // Also allow overlay click to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      close();
    }
  });
}

/**
 * Hide upload results modal
 */
export function hideUploadResultsModal() {
  const overlay = document.getElementById('upload-results-overlay');
  if (overlay) {
    overlay.remove();
  }
}
