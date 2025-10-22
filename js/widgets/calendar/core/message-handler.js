// js/widgets/Calendar/core/message-handler.js
// Handles all postMessage communication with parent window

import { createLogger } from '/js/utils/logger.js';

const logger = createLogger('CalendarMessageHandler');

export class CalendarMessageHandler {
  constructor(widget) {
    this.widget = widget;
  }

  /**
   * Set up event listeners
   */
  setupListeners() {
    window.addEventListener('message', (event) => this.handleMessage(event));
    window.addEventListener('load', () => this.sendWidgetReady());
  }

  /**
   * Handle incoming message from parent
   */
  handleMessage(event) {
    if (!event.data) return;

    logger.debug('Calendar widget received message', { type: event.data.type, payload: event.data.payload });

    // Handle calendar data from widget-data-manager
    if (event.data.type === 'data' && event.data.payload?.dataType === 'calendar') {
      logger.debug('Received calendar data from parent', {
        events: event.data.payload.events?.length,
        calendars: event.data.payload.calendars?.length
      });

      this.widget.dataManager.handleCalendarData({
        events: event.data.payload.events || [],
        calendars: event.data.payload.calendars || [],
        lastUpdated: new Date().toISOString()
      });
      return;
    }

    // Handle command messages
    if (event.data.type === 'command') {
      const action = event.data.payload?.action || event.data.action;

      if (!action) {
        logger.warn('Command message missing action', event.data);
        return;
      }

      // Check if it's a state change action
      const stateActions = ['enter-focus', 'exit-focus', 'enter-active', 'exit-active'];
      const menuActions = ['menu-active', 'menu-selection-changed', 'menu-item-selected'];

      if (stateActions.includes(action) || menuActions.includes(action)) {
        this.widget.focusManager.handleMenuAction({ ...event.data, action });
      } else {
        // Regular navigation command
        this.widget.actionHandler.handleAction(action);
      }
      return;
    }

    // Handle data/theme updates
    if (event.data.type === 'widget-update' || event.data.type === 'theme-change') {
      this.handleDataServiceMessage(event.data);
      return;
    }

    // Handle other widget messages
    if (event.data.type) {
      this.handleDataServiceMessage(event.data);
    }
  }

  /**
   * Handle data service messages
   */
  handleDataServiceMessage(data) {
    logger.debug('Calendar widget received message', { type: data.type, hasPayload: !!data.payload });

    switch (data.type) {
      case 'widget-update':
        if (data.action === 'state-update' && data.payload?.calendar) {
          this.widget.dataManager.handleCalendarData({
            events: data.payload.calendar.events || [],
            calendars: data.payload.calendar.calendars || [],
            lastUpdated: data.payload.calendar.lastUpdated
          });
        }

        if (data.payload?.theme && data.payload.theme !== this.widget.settingsManager.currentTheme) {
          this.widget.settingsManager.applyTheme(data.payload.theme);
        }
        break;

      case 'theme-change':
        this.widget.settingsManager.applyTheme(data.theme);
        break;
    }
  }

  /**
   * Send widget-ready message to parent
   */
  sendWidgetReady() {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'event',
        widgetId: 'main', // Must match ID in dashboard-widget-config.js
        payload: {
          eventType: 'widget-ready',
          data: { hasMenu: false }
        }
      }, '*');
      logger.debug('📤 Sent widget-ready message to parent');
    }
  }

  /**
   * Send message to parent
   */
  sendToParent(message) {
    if (window.parent !== window) {
      window.parent.postMessage(message, '*');
    }
  }

  /**
   * Clean up listeners
   */
  cleanup() {
    // Note: We don't remove message listeners as they're needed for the lifetime of the widget
  }
}
