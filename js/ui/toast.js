// js/ui/toast.js
// Simple Toast Notification System
// Ported from legacy with improvements

import { createLogger } from '../utils/logger.js';

const logger = createLogger('Toast');

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast: 'info', 'success', 'warning', 'error'
 * @param {number} duration - Duration in milliseconds (default 2000)
 */
export function showToast(message, type = 'info', duration = 2000) {
  logger.debug('Showing toast', { message, type, duration });

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `dashie-toast dashie-toast-${type}`;

  // No icon for success or info, only for warnings and errors
  const icons = {
    warning: '⚠️',
    error: '❌'
  };

  const icon = icons[type];

  toast.innerHTML = `
    ${icon ? `<span class="toast-icon">${icon}</span>` : ''}
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

  logger.info('Toast displayed', { message, type });
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
      z-index: 10001; /* Above modals (settings modal is z-index 1000) */
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .dashie-toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    .dashie-toast-success {
      background: rgba(66, 66, 66, 0.95);
      color: #fff;
    }

    .dashie-toast-warning {
      background: rgba(255, 204, 0, 0.95);
      color: #000;
    }

    .dashie-toast-error {
      background: rgba(255, 59, 48, 0.95);
    }

    .dashie-toast-info {
      background: rgba(66, 66, 66, 0.95);
      color: #fff;
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
  logger.debug('Toast styles injected');
}

// Auto-inject styles when module is imported
injectToastStyles();
