// js/data/services/calendar-services/calendar-refresh-manager.js
// Manages automatic background refresh of calendar data
// Extracted for single responsibility

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('CalendarRefreshManager');

/**
 * CalendarRefreshManager - Automatic background refresh of calendar data
 *
 * Responsibilities:
 * - Start/stop automatic refresh timers
 * - Trigger calendar data reload at intervals
 * - Broadcast updates to listening components
 * - Manage refresh state
 *
 * Does NOT:
 * - Fetch data (that's CalendarFetcher's job)
 * - Cache data (that's handled by caller)
 * - Transform data (that's EventProcessor's job)
 */
export class CalendarRefreshManager {
  constructor(calendarService) {
    if (!calendarService) {
      throw new Error('CalendarService is required for CalendarRefreshManager');
    }

    this.calendarService = calendarService;
    this.refreshTimer = null;
    this.isRefreshing = false;
    this.refreshInterval = 30 * 60 * 1000; // 30 minutes default
    this.lastRefreshTime = null;

    logger.verbose('CalendarRefreshManager constructed', {
      refreshInterval: `${this.refreshInterval / 1000 / 60}min`
    });
  }

  /**
   * Start automatic background refresh
   *
   * @param {number} intervalMs - Refresh interval in milliseconds (default: 30 min)
   */
  startAutoRefresh(intervalMs = null) {
    // Use provided interval or default
    if (intervalMs) {
      this.refreshInterval = intervalMs;
    }

    // Stop existing timer if running
    this.stopAutoRefresh();

    logger.info('Starting automatic calendar refresh', {
      interval: `${this.refreshInterval / 1000 / 60}min`
    });

    // Start new timer
    this.refreshTimer = setInterval(async () => {
      await this.performRefresh();
    }, this.refreshInterval);

    // Perform initial refresh immediately
    this.performRefresh();
  }

  /**
   * Stop automatic background refresh
   */
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      logger.info('Stopped automatic calendar refresh');
    }
  }

  /**
   * Perform a single refresh cycle
   * @private
   */
  async performRefresh() {
    // Prevent concurrent refreshes
    if (this.isRefreshing) {
      logger.debug('Refresh already in progress, skipping');
      return;
    }

    try {
      this.isRefreshing = true;

      logger.info('⏱️ Auto-refresh triggered', {
        lastRefresh: this.lastRefreshTime
          ? `${Math.round((Date.now() - this.lastRefreshTime) / 1000 / 60)}min ago`
          : 'never'
      });

      // Trigger calendar service to reload data
      // The service will handle fetching, caching, and transformation
      const data = await this.calendarService.loadData({ forceRefresh: true });

      this.lastRefreshTime = Date.now();

      logger.success('✅ Auto-refresh completed', {
        events: data.events?.length || 0,
        calendars: data.calendars?.length || 0
      });

      // Broadcast update event
      this.broadcastUpdate(data);

    } catch (error) {
      logger.error('Auto-refresh failed', error);
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Manually trigger a refresh (bypass timer)
   *
   * @returns {Promise<object>} Calendar data
   */
  async triggerRefresh() {
    logger.info('Manual refresh triggered');
    await this.performRefresh();
  }

  /**
   * Broadcast calendar update to listening components
   *
   * @param {object} data - Calendar data {calendars, events}
   * @private
   */
  broadcastUpdate(data) {
    // Emit custom event that widget-data-manager can listen for
    const event = new CustomEvent('calendar-data-updated', {
      detail: {
        calendars: data.calendars || [],
        events: data.events || [],
        timestamp: Date.now()
      }
    });

    window.dispatchEvent(event);

    logger.debug('Broadcast calendar update event', {
      events: data.events?.length || 0,
      calendars: data.calendars?.length || 0
    });
  }

  /**
   * Get refresh status
   *
   * @returns {object} Status information
   */
  getStatus() {
    return {
      isActive: !!this.refreshTimer,
      isRefreshing: this.isRefreshing,
      refreshInterval: this.refreshInterval,
      lastRefreshTime: this.lastRefreshTime,
      nextRefreshIn: this.refreshTimer && this.lastRefreshTime
        ? this.refreshInterval - (Date.now() - this.lastRefreshTime)
        : null
    };
  }

  /**
   * Set refresh interval (and restart timer if active)
   *
   * @param {number} intervalMs - New interval in milliseconds
   */
  setRefreshInterval(intervalMs) {
    this.refreshInterval = intervalMs;

    logger.info('Refresh interval updated', {
      interval: `${intervalMs / 1000 / 60}min`
    });

    // Restart timer if currently active
    if (this.refreshTimer) {
      this.startAutoRefresh();
    }
  }

  /**
   * Cleanup - stop timers and clear state
   */
  destroy() {
    this.stopAutoRefresh();
    this.isRefreshing = false;
    this.lastRefreshTime = null;
    logger.info('CalendarRefreshManager destroyed');
  }
}
