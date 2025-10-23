// js/modules/Dashboard/navigation/page-manager.js
// Page switching and navigation for multi-page dashboard
// v1.0 - 10/23/25 - Initial implementation

import { createLogger } from '../../../utils/logger.js';
import {
  getPageConfig,
  getNextPage,
  getPreviousPage,
  getPageNumber,
  getTotalPages
} from '../config/page-config.js';
import { setCurrentPage as setWidgetConfigPage } from '../config/widget-config.js';
import DashboardStateManager from '../state/state-manager.js';
import AppComms from '../../../core/app-comms.js';

const logger = createLogger('PageManager');

/**
 * Page Manager
 *
 * Manages multi-page dashboard navigation:
 * - Switching between pages
 * - Saving/restoring per-page state
 * - Coordinating with state manager and UI renderer
 */
class PageManager {
  static isInitialized = false;
  static currentPageId = 'page1'; // Default starting page

  /**
   * Initialize page manager
   */
  static initialize() {
    logger.verbose('Initializing page manager...');

    // Set initial page in widget config
    setWidgetConfigPage(this.currentPageId);

    // Update state manager with initial page
    DashboardStateManager.setCurrentPage(this.currentPageId);

    this.isInitialized = true;
    logger.info('Page manager initialized', { currentPage: this.currentPageId });
  }

  /**
   * Get current page configuration
   * @returns {Object|null} Current page config
   */
  static getCurrentPage() {
    return getPageConfig(this.currentPageId);
  }

  /**
   * Get current page ID
   * @returns {string} Current page ID
   */
  static getCurrentPageId() {
    return this.currentPageId;
  }

  /**
   * Switch to a different page
   * @param {string} pageId - Target page ID
   * @returns {Promise<boolean>} Success status
   */
  static async switchPage(pageId) {
    try {
      logger.info('Switching page', { from: this.currentPageId, to: pageId });

      // Validate page exists
      const pageConfig = getPageConfig(pageId);
      if (!pageConfig) {
        logger.error('Invalid page ID', { pageId });
        return false;
      }

      // Save current page state before switching
      const currentState = DashboardStateManager.getState();
      DashboardStateManager.savePageState(this.currentPageId, {
        gridPosition: currentState.gridPosition,
        focusedWidget: currentState.focusedWidget,
        focusMenuState: currentState.focusMenuState
      });

      logger.debug('Saved current page state', {
        pageId: this.currentPageId,
        state: {
          gridPosition: currentState.gridPosition,
          focusedWidget: currentState.focusedWidget
        }
      });

      // Update current page ID
      const oldPageId = this.currentPageId;
      this.currentPageId = pageId;

      // Update widget config to use new page's widgets
      setWidgetConfigPage(pageId);

      // Update state manager with new page
      DashboardStateManager.setCurrentPage(pageId);

      // Publish page changed event (UI renderer will listen to this)
      AppComms.publish('PAGE_CHANGED', {
        pageId,
        oldPageId,
        pageNumber: getPageNumber(pageId),
        totalPages: getTotalPages()
      });

      logger.success('Page switched successfully', {
        pageId,
        pageNumber: getPageNumber(pageId),
        totalPages: getTotalPages()
      });

      return true;

    } catch (error) {
      logger.error('Failed to switch page', error);
      return false;
    }
  }

  /**
   * Switch to next page in sequence
   * @returns {Promise<boolean>} Success status
   */
  static async nextPage() {
    const nextPageId = getNextPage(this.currentPageId);

    if (!nextPageId) {
      logger.debug('Already at last page');
      return false;
    }

    return await this.switchPage(nextPageId);
  }

  /**
   * Switch to previous page in sequence
   * @returns {Promise<boolean>} Success status
   */
  static async previousPage() {
    const prevPageId = getPreviousPage(this.currentPageId);

    if (!prevPageId) {
      logger.debug('Already at first page');
      return false;
    }

    return await this.switchPage(prevPageId);
  }

  /**
   * Check if can navigate to next page
   * @returns {boolean} True if next page exists
   */
  static canGoNext() {
    return getNextPage(this.currentPageId) !== null;
  }

  /**
   * Check if can navigate to previous page
   * @returns {boolean} True if previous page exists
   */
  static canGoPrevious() {
    return getPreviousPage(this.currentPageId) !== null;
  }

  /**
   * Check if multi-page navigation is available
   * @returns {boolean} True if multiple pages exist
   */
  static isMultiPageEnabled() {
    return getTotalPages() > 1;
  }

  /**
   * Get page info for display
   * @returns {Object} Page info { current, total, label }
   */
  static getPageInfo() {
    const currentPage = this.getCurrentPage();
    return {
      current: getPageNumber(this.currentPageId),
      total: getTotalPages(),
      label: currentPage ? currentPage.label : 'Unknown',
      pageId: this.currentPageId
    };
  }
}

export default PageManager;

// =============================================================================
// EXPOSE GLOBALLY FOR DEBUGGING
// =============================================================================

if (typeof window !== 'undefined') {
  window.PageManager = PageManager;
}
