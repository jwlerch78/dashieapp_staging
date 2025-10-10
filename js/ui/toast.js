// js/ui/toast.js - Simple Toast Notification System
// v1.0 - 10/10/25 - Initial implementation for quick user feedback

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast: 'info', 'success', 'warning', 'error'
 * @param {number} duration - Duration in milliseconds (default 2000)
 */
export function showToast(message, type = 'info', duration = 2000) {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `dashie-toast dashie-toast-${type}`;
  
  // Add icon based on type
  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
  `;
  
  // Add to DOM
  document.body.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  // Remove after duration
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300); // Wait for fade out animation
  }, duration);
}

/**
 * Add toast CSS to document if not already present
 */
export function injectToastStyles() {
  if (document.getElementById('dashie-toast-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'dashie-toast-styles';
  style.textContent = `
    .dashie-toast {
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: rgba(66, 66, 66, 0.95);
      color: #fff;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
      z-index: 10001; /* CRITICAL: Above modals (999) and other UI elements */
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      pointer-events: none;
    }
    
    .dashie-toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    
    .dashie-toast-success {
      background: rgba(52, 199, 89, 0.95);
    }
    
    .dashie-toast-warning {
      background: rgba(255, 204, 0, 0.95);
      color: #000;
    }
    
    .dashie-toast-error {
      background: rgba(255, 59, 48, 0.95);
    }
    
    .toast-icon {
      font-size: 18px;
      line-height: 1;
    }
    
    .toast-message {
      line-height: 1.4;
    }
  `;
  
  document.head.appendChild(style);
}

// Auto-inject styles when module is imported
injectToastStyles();
