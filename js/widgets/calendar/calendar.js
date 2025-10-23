// js/widgets/Calendar/calendar.js
// Calendar Widget Entry Point
// Merged from calendar.js + index.js

// Re-export widget classes for external use
export { CalendarWidget } from './core/calendar-widget.js';
export { CalendarConfig } from './renderers/calendar-config.js';
export { CalendarEvents } from './renderers/calendar-events.js';
export { CalendarWeekly } from './renderers/calendar-weekly.js';
export { CalendarMonthly } from './renderers/calendar-monthly.js';

// Import for internal initialization
import { CalendarWidget } from './core/calendar-widget.js';

// Initialize logger (same pattern as clock widget)
const logger = {
  debug: (...args) => console.debug('[CalendarWidget]', ...args),
  info: (...args) => console.info('[CalendarWidget]', ...args),
  warn: (...args) => console.warn('[CalendarWidget]', ...args),
  error: (...args) => console.error('[CalendarWidget]', ...args)
};

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function init() {
  logger.debug('Initializing calendar widget...');

  const container = document.getElementById('calendar-container');
  if (!container) {
    logger.error('Calendar container not found');
    return;
  }

  // Wait for CalendarService to be available
  await waitForCalendarService();

  // Create calendar widget (initializes automatically in constructor)
  const calendar = new CalendarWidget(container);

  // Listen for theme changes from parent
  window.addEventListener('message', (event) => {
    if (event.data.type === 'theme-change') {
      applyTheme(event.data.theme);
    }
  });

  // Apply initial theme
  const initialTheme = getInitialTheme();
  applyTheme(initialTheme);

  // Signal ready to parent (standard format)
  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'widget-ready',
      widget: 'main',
      widgetId: 'main',
      hasMenu: true // Calendar has focus menu
    }, '*');
    logger.debug('Ready signal sent to parent');
  }

  // Expose for debugging
  window.calendarWidget = calendar;
}

/**
 * Wait for CalendarService to be available in parent window
 */
async function waitForCalendarService() {
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds max wait

  while (attempts < maxAttempts) {
    // Check parent window first, then fallback to current window
    if ((window.parent && window.parent.calendarService) || window.calendarService) {
      logger.debug('CalendarService found');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  logger.warn('CalendarService not found after timeout - widget may not work correctly');
}

/**
 * Get initial theme from parent or localStorage
 */
function getInitialTheme() {
  // Try to get theme from parent window
  try {
    if (window.parent && window.parent.document && window.parent.document.body) {
      if (window.parent.document.body.classList.contains('theme-light')) {
        return 'light';
      } else if (window.parent.document.body.classList.contains('theme-dark')) {
        return 'dark';
      }
    }
  } catch (e) {
    // Cross-origin error - ignore
  }

  // Try localStorage
  try {
    const saved = localStorage.getItem('dashie-theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch (e) {
    // Ignore localStorage errors
  }

  // Default to light theme
  return 'light';
}

/**
 * Apply theme to widget
 */
function applyTheme(theme) {
  const body = document.body;

  // Remove existing theme classes
  body.classList.remove('theme-light', 'theme-dark');

  // Add new theme class
  body.classList.add(`theme-${theme}`);

  logger.debug('Theme applied:', theme);
}
