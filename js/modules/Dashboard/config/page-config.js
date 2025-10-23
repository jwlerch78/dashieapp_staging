// js/modules/Dashboard/config/page-config.js
// Multi-page dashboard configuration
// Defines available pages and their widget layouts

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('PageConfig');

/**
 * Page Configurations
 *
 * Each page defines:
 * - id: Unique page identifier
 * - label: Display name
 * - gridRows: Number of rows in grid
 * - gridCols: Number of columns in grid
 * - widgets: Array of widget configurations
 * - showPageNav: Whether to show page navigation button
 * - devOnly: If true, only show when developer mode enabled
 */
export const pageConfigs = {
  'page1': {
    id: 'page1',
    label: 'Page 1',
    gridRows: 3,
    gridCols: 2,
    layout: {
      columns: '70% 30%',      // Calendar takes 70%, right column 30%
      rows: '10% 45% 45%'      // Header smaller, calendar/agenda larger
    },
    widgets: [
      {
        id: 'header',
        row: 1,
        col: 1,
        rowSpan: 1,
        colSpan: 1,
        label: 'Header',
        path: 'js/widgets/header/header.html',
        noCenter: true,
        focusScale: 1.05,
        selectable: true
      },
      {
        id: 'clock',
        row: 1,
        col: 2,
        rowSpan: 1,
        colSpan: 1,
        label: 'Clock',
        path: 'js/widgets/clock/clock.html',
        noCenter: false,
        focusScale: 1.05,
        selectable: true
      },
      {
        id: 'main',
        row: 2,
        col: 1,
        rowSpan: 2, // SPANS 2 ROWS!
        colSpan: 1,
        label: 'Calendar',
        path: 'js/widgets/calendar/calendar.html',
        noCenter: false,
        focusScale: 1.05,
        selectable: true
      },
      {
        id: 'agenda',
        row: 2,
        col: 2,
        rowSpan: 1,
        colSpan: 1,
        label: 'Agenda',
        path: 'js/widgets/agenda/agenda.html',
        noCenter: false,
        focusScale: 1.4,
        selectable: true
      },
      {
        id: 'photos',
        row: 3,
        col: 2,
        rowSpan: 1,
        colSpan: 1,
        label: 'Photos',
        path: 'js/widgets/photos/photos.html',
        noCenter: false,
        focusScale: 1.4,
        selectable: true
      }
    ],
    showPageNav: true,
    devOnly: false
  },

  'page2': {
    id: 'page2',
    label: 'Page 2',
    gridRows: 3,
    gridCols: 2,
    widgets: [
      {
        id: 'clock-1',
        row: 1,
        col: 1,
        rowSpan: 1,
        colSpan: 1,
        label: 'Clock 1',
        path: 'js/widgets/clock/clock.html',
        noCenter: false,
        focusScale: 1.05,
        selectable: true
      },
      {
        id: 'clock-2',
        row: 1,
        col: 2,
        rowSpan: 1,
        colSpan: 1,
        label: 'Clock 2',
        path: 'js/widgets/clock/clock.html',
        noCenter: false,
        focusScale: 1.05,
        selectable: true
      },
      {
        id: 'clock-3',
        row: 2,
        col: 1,
        rowSpan: 1,
        colSpan: 1,
        label: 'Clock 3',
        path: 'js/widgets/clock/clock.html',
        noCenter: false,
        focusScale: 1.4,
        selectable: true
      },
      {
        id: 'clock-4',
        row: 2,
        col: 2,
        rowSpan: 1,
        colSpan: 1,
        label: 'Clock 4',
        path: 'js/widgets/clock/clock.html',
        noCenter: false,
        focusScale: 1.4,
        selectable: true
      },
      {
        id: 'clock-5',
        row: 3,
        col: 1,
        rowSpan: 1,
        colSpan: 1,
        label: 'Clock 5',
        path: 'js/widgets/clock/clock.html',
        noCenter: false,
        focusScale: 1.4,
        selectable: true
      },
      {
        id: 'clock-6',
        row: 3,
        col: 2,
        rowSpan: 1,
        colSpan: 1,
        label: 'Clock 6',
        path: 'js/widgets/clock/clock.html',
        noCenter: false,
        focusScale: 1.4,
        selectable: true
      }
    ],
    showPageNav: true,
    devOnly: false
  }
};

/**
 * Page order for sequential navigation
 */
export const pageOrder = ['page1', 'page2'];

/**
 * Get a page configuration by ID
 * @param {string} pageId - Page identifier
 * @returns {Object|null} Page config or null if not found
 */
export function getPageConfig(pageId) {
  if (!pageId) {
    logger.warn('getPageConfig called with no pageId');
    return null;
  }

  const config = pageConfigs[pageId];
  if (!config) {
    logger.warn('Page config not found', { pageId });
    return null;
  }

  return config;
}

/**
 * Get all available pages
 * Filters by developer mode if needed
 * @param {boolean} isDeveloperMode - Whether developer mode is enabled
 * @returns {Array<Object>} Array of page configs
 */
export function getAvailablePages(isDeveloperMode = false) {
  return Object.values(pageConfigs).filter(page => {
    if (page.devOnly && !isDeveloperMode) {
      return false;
    }
    return true;
  });
}

/**
 * Get the next page in sequence
 * @param {string} currentPageId - Current page ID
 * @returns {string|null} Next page ID or null if at end
 */
export function getNextPage(currentPageId) {
  const currentIndex = pageOrder.indexOf(currentPageId);

  if (currentIndex === -1) {
    logger.warn('Current page not in order', { currentPageId });
    return null;
  }

  const nextIndex = currentIndex + 1;

  if (nextIndex >= pageOrder.length) {
    // At end - could wrap around to first, or return null
    return null; // No wrap for now
  }

  return pageOrder[nextIndex];
}

/**
 * Get the previous page in sequence
 * @param {string} currentPageId - Current page ID
 * @returns {string|null} Previous page ID or null if at start
 */
export function getPreviousPage(currentPageId) {
  const currentIndex = pageOrder.indexOf(currentPageId);

  if (currentIndex === -1) {
    logger.warn('Current page not in order', { currentPageId });
    return null;
  }

  const prevIndex = currentIndex - 1;

  if (prevIndex < 0) {
    // At start - return null
    return null;
  }

  return pageOrder[prevIndex];
}

/**
 * Get current page index (1-indexed for display)
 * @param {string} pageId - Page identifier
 * @returns {number} Page number (1-based)
 */
export function getPageNumber(pageId) {
  const index = pageOrder.indexOf(pageId);
  return index === -1 ? 1 : index + 1;
}

/**
 * Get total number of pages
 * @returns {number} Total page count
 */
export function getTotalPages() {
  return pageOrder.length;
}

// =============================================================================
// EXPOSE GLOBALLY FOR DEBUGGING
// =============================================================================

if (typeof window !== 'undefined') {
  window.DashboardPageConfig = {
    pageConfigs,
    pageOrder,
    getPageConfig,
    getAvailablePages,
    getNextPage,
    getPreviousPage,
    getPageNumber,
    getTotalPages
  };
}
