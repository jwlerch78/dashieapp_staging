// js/widgets/Calendar/core/navigation-manager.js
// Manages calendar navigation, view switching, and scrolling

import { createLogger } from '/js/utils/logger.js';
import { CalendarMonthly } from '../renderers/calendar-monthly.js';

const logger = createLogger('CalendarNavigationManager');

export class CalendarNavigationManager {
  constructor(widget) {
    this.widget = widget;
    this.currentView = 'week';
    this.currentDate = new Date();
  }

  /**
   * Set up keyboard controls for standalone testing
   */
  setupKeyboardControls() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'ArrowLeft':
          e.preventDefault();
          this.navigatePrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.navigateNext();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.scrollCalendar('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.scrollCalendar('down');
          break;
      }
    });
  }

  /**
   * Navigate to previous period
   */
  navigatePrevious() {
    this.navigateCalendar('previous');
    this.widget.focusManager.updateHomeStatus();
  }

  /**
   * Navigate to next period
   */
  navigateNext() {
    this.navigateCalendar('next');
    this.widget.focusManager.updateHomeStatus();
  }

  /**
   * Navigate calendar forward or backward
   */
  navigateCalendar(direction) {
    const newDate = new Date(this.currentDate);

    if (this.currentView === 'monthly') {
      // Navigate by month
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      this.currentDate = newDate;
      this.widget.monthly.setDate(this.currentDate);

      // Re-render with existing events
      if (this.widget.dataManager.isDataLoaded) {
        this.widget.monthly.renderEvents(this.widget.dataManager.calendarData);
      }

      logger.debug('Navigated month', { direction, newMonth: this.widget.monthly.getMonthTitle() });
    } else {
      // Weekly/n-day navigation
      const increment = this.widget.weekly.dayCount || 7;
      newDate.setDate(newDate.getDate() + (direction === 'next' ? increment : -increment));

      this.currentDate = newDate;
      this.widget.weekly.setDate(this.currentDate);

      // Re-render with existing events
      if (this.widget.dataManager.isDataLoaded) {
        this.widget.weekly.renderEvents(this.widget.dataManager.calendarData);
      }

      logger.debug('Navigated calendar', { direction, increment, newWeek: this.widget.weekly.getWeekTitle() });
    }

    this.updateCalendarHeader();
  }

  /**
   * Scroll calendar up or down
   */
  scrollCalendar(direction) {
    // Monthly view has no scrolling
    if (this.currentView === 'monthly') {
      return;
    }
    this.widget.weekly.scroll(direction);
  }

  /**
   * Go to today
   */
  goToToday() {
    // Reset to today
    this.currentDate = new Date();
    this.widget.focusManager.homeDate = new Date();
    this.widget.focusManager.homeDate.setHours(0, 0, 0, 0);
    this.widget.focusManager.isAtHome = true;

    // Reset scroll tracking to enable auto-scroll
    this.widget.weekly.resetScrollTracking();

    // Update view
    if (this.currentView === 'monthly' && this.widget.monthly) {
      this.widget.monthly.setDate(this.currentDate);
    } else {
      this.widget.weekly.setDate(this.currentDate);
    }

    this.updateCalendarHeader();

    // Re-render with current data
    if (this.widget.dataManager.isDataLoaded) {
      if (this.currentView === 'monthly') {
        this.widget.monthly.renderEvents(this.widget.dataManager.calendarData);
      } else {
        this.widget.weekly.renderEvents(this.widget.dataManager.calendarData);
      }
    }

    logger.info('📅 Returned to today - scroll tracking reset');
  }

  /**
   * Update calendar header
   */
  updateCalendarHeader() {
    const titleEl = document.getElementById('calendarTitle');
    const modeEl = document.getElementById('calendarMode');

    if (!titleEl || !modeEl) return;

    if (this.currentView === 'monthly') {
      titleEl.textContent = this.widget.monthly.getMonthTitle();
      modeEl.textContent = 'Month';
    } else {
      titleEl.textContent = this.widget.weekly.getWeekTitle();

      const modeLabels = {
        '1': 'Day',
        '2': '2-Day',
        '3': '3-Day',
        '5': '5-Day',
        'week': 'Week'
      };
      modeEl.textContent = modeLabels[this.currentView] || 'Week';
    }
  }

  /**
   * Switch to a new view mode and save to settings
   */
  async switchViewMode(viewMode) {
    logger.debug('Switching view mode', { from: this.currentView, to: viewMode });

    // Save current scroll position if switching from a weekly/day view
    let savedScroll = null;
    if (this.currentView !== 'monthly') {
      const timeGrid = document.querySelector('.time-grid');
      if (timeGrid && timeGrid.scrollTop > 0) {
        savedScroll = timeGrid.scrollTop;
        logger.debug('Saved scroll position before view switch', { scrollTop: savedScroll });
      }
    }

    // Update current view
    this.currentView = viewMode;

    // Save to settings
    await this.widget.settingsManager.saveViewModeSetting(viewMode);

    if (viewMode === 'monthly') {
      // Initialize monthly view if needed
      if (!this.widget.monthly) {
        const settings = this.widget.settingsManager.loadSettings();
        this.widget.monthly = new CalendarMonthly(this.widget.calendars, settings);
        this.widget.monthly.initialize(this.currentDate);
      }

      // Hide weekly, show monthly
      document.querySelector('.allday-section')?.classList.add('hidden');
      document.querySelector('.time-grid')?.classList.add('hidden');
      document.querySelector('.month-grid')?.classList.remove('hidden');

      // Reset to today when switching to monthly
      this.goToToday();

      this.widget.monthly.setDate(this.currentDate);

      if (this.widget.dataManager.isDataLoaded) {
        this.widget.monthly.renderEvents(this.widget.dataManager.calendarData);
      }
    } else {
      // Weekly/n-day mode
      document.querySelector('.month-grid')?.classList.add('hidden');
      document.querySelector('.allday-section')?.classList.remove('hidden');
      document.querySelector('.time-grid')?.classList.remove('hidden');

      // Update weekly renderer with new settings
      const settings = this.widget.settingsManager.loadSettings();
      this.widget.weekly.updateSettings(settings);

      // Reset to today when changing views
      this.goToToday();

      this.widget.weekly.setDate(this.currentDate);

      if (this.widget.dataManager.isDataLoaded) {
        this.widget.weekly.renderEvents(this.widget.dataManager.calendarData);
      }

      // Restore scroll position if we saved one
      if (savedScroll !== null) {
        const timeGrid = document.querySelector('.time-grid');
        if (timeGrid) {
          let checkCount = 0;
          const maxChecks = 20;

          const scrollWhenReady = () => {
            checkCount++;

            if (timeGrid.scrollHeight > 0) {
              timeGrid.scrollTop = savedScroll;
              logger.debug('Restored scroll position after view switch', {
                scrollTop: savedScroll,
                checksNeeded: checkCount
              });
            } else if (checkCount < maxChecks) {
              setTimeout(scrollWhenReady, 250);
            }
          };

          setTimeout(scrollWhenReady, 50);
        }
      }
    }

    this.updateCalendarHeader();

    // Update menu to reflect new active view
    this.widget.focusManager.sendMenuConfig();

    logger.debug('✓ View mode switched', { viewMode });
  }
}
