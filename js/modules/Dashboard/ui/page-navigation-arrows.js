// js/modules/Dashboard/ui/page-navigation-arrows.js
// Touch-friendly page navigation arrows
// Floating circular buttons for switching between dashboard pages

import { createLogger } from '../../../utils/logger.js';
import PageManager from '../navigation/page-manager.js';

const logger = createLogger('PageNavigationArrows');

/**
 * Page Navigation Arrows
 *
 * Creates floating arrow buttons for touch navigation between pages.
 * Similar to calendar widget arrows, but larger and positioned bottom-right.
 *
 * Features:
 * - Only shown when multiple pages exist
 * - Previous page (↑) and Next page (↓) buttons
 * - Circular design matching calendar widget style
 * - Positioned bottom-right of dashboard
 */
class PageNavigationArrows {
  static container = null;
  static prevButton = null;
  static nextButton = null;

  /**
   * Initialize and render page navigation arrows
   * @param {HTMLElement} dashboardContainer - Dashboard container element (unused)
   * @param {HTMLElement} contentWrapper - Content wrapper element to insert arrows into
   */
  static initialize(dashboardContainer, contentWrapper) {
    logger.debug('Initializing page navigation arrows');

    // Store references
    this.dashboardContainer = dashboardContainer;
    this.contentWrapper = contentWrapper;

    // Create previous page button (chevron up)
    // Will be inserted at start of content wrapper (before sidebar)
    this.prevButton = this.createArrowButton('up', '˄', 'Previous Page');
    this.prevButton.addEventListener('click', () => this.handlePreviousPage());

    // Create next page button (chevron down)
    // Will be inserted at end of content wrapper (after grid)
    this.nextButton = this.createArrowButton('down', '˅', 'Next Page');
    this.nextButton.addEventListener('click', () => this.handleNextPage());

    // Insert arrows as absolutely positioned overlays on the dashboard
    // They will overlay the sidebar on the left side
    dashboardContainer.appendChild(this.prevButton);
    dashboardContainer.appendChild(this.nextButton);

    // Update visibility based on available pages
    this.updateVisibility();

    logger.debug('Page navigation arrows initialized');
  }

  /**
   * Create an arrow button
   * @private
   * @param {string} direction - 'up' or 'down'
   * @param {string} chevron - Chevron character
   * @param {string} title - Button title
   * @returns {HTMLElement} Button element
   */
  static createArrowButton(direction, chevron, title) {
    const button = document.createElement('button');
    button.className = `page-nav-arrow page-nav-arrow--${direction}`;
    button.setAttribute('data-chevron', chevron); // CSS ::before will display this
    button.title = title;
    button.setAttribute('aria-label', title);

    return button;
  }

  /**
   * Handle previous page navigation
   * @private
   */
  static async handlePreviousPage() {
    const previousPage = PageManager.getPreviousPage();

    if (previousPage) {
      logger.info('Navigating to previous page via touch', { previousPage });

      try {
        await PageManager.switchPage(previousPage);
        this.updateVisibility(); // Update button states after switch
      } catch (error) {
        logger.error('Failed to switch to previous page', error);
      }
    }
  }

  /**
   * Handle next page navigation
   * @private
   */
  static async handleNextPage() {
    const nextPage = PageManager.getNextPage();

    if (nextPage) {
      logger.info('Navigating to next page via touch', { nextPage });

      try {
        await PageManager.switchPage(nextPage);
        this.updateVisibility(); // Update button states after switch
      } catch (error) {
        logger.error('Failed to switch to next page', error);
      }
    }
  }

  /**
   * Update button visibility based on available pages
   * Shows only relevant arrows:
   * - First page: down arrow only (can go next)
   * - Last page: up arrow only (can go previous)
   * - Middle pages: both arrows
   */
  static updateVisibility() {
    const hasPrevious = !!PageManager.getPreviousPage();
    const hasNext = !!PageManager.getNextPage();

    // Show/hide individual buttons based on navigation availability
    this.prevButton.style.display = hasPrevious ? 'flex' : 'none';
    this.nextButton.style.display = hasNext ? 'flex' : 'none';

    logger.debug('Updated page navigation visibility', { hasPrevious, hasNext });
  }

  /**
   * Show page navigation arrows
   */
  static show() {
    if (this.container) {
      this.updateVisibility();
    }
  }

  /**
   * Hide page navigation arrows
   */
  static hide() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  /**
   * Destroy page navigation arrows
   */
  static destroy() {
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.prevButton = null;
      this.nextButton = null;
      logger.debug('Page navigation arrows destroyed');
    }
  }
}

export default PageNavigationArrows;
