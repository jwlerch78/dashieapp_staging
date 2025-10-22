// js/widgets/Calendar/core/focus-manager.js
// Manages focus state, menu interactions, and home position

import { createLogger } from '/js/utils/logger.js';

const logger = createLogger('CalendarFocusManager');

export class CalendarFocusManager {
  constructor(widget) {
    this.widget = widget;
    this.isFocused = false;
    this.menuActive = false;
    this.homeDate = null;
    this.isAtHome = true;
  }

  /**
   * Send focus menu configuration to parent
   */
  sendMenuConfig() {
    if (window.parent !== window) {
      const settings = this.widget.settingsManager.loadSettings();
      const currentViewMode = settings.viewMode || 'week';

      window.parent.postMessage({
        type: 'widget-config',
        widget: 'calendar',
        focusMenu: {
          enabled: false, // TODO: Re-enable when focus menu UI is implemented
          defaultIndex: this.getMenuIndexForView(currentViewMode),
          currentView: currentViewMode, // Highlight active view
          items: [
            // Action button
            {
              id: 'go-to-today',
              label: 'Go to Today',
              type: 'action'
            },
            // View options
            {
              id: 'monthly',
              label: 'Month',
              type: 'view'
            },
            {
              id: 'week',
              label: 'Week',
              type: 'view'
            },
            {
              id: '3',
              label: '3-Day',
              type: 'view'
            },
            {
              id: '1',
              label: 'Day',
              type: 'view'
            }
          ]
        }
      }, '*');

      logger.debug('✓ Sent enhanced focus menu config', { currentViewMode });
    }
  }

  /**
   * Get menu index for current view mode (for default selection)
   */
  getMenuIndexForView(viewMode) {
    const viewMap = {
      'go-to-today': 0,
      'monthly': 1,
      'week': 2,
      '3': 3,  // 3-Day now at index 3
      '1': 4   // Day now at index 4
    };
    return viewMap[viewMode] || 2; // Default to week
  }

  /**
   * Handle menu-related actions from parent
   */
  handleMenuAction(data) {
    logger.debug('🎯 handleMenuAction called', {
      action: data.action,
      itemId: data.itemId,
      beforeState: { isFocused: this.isFocused, menuActive: this.menuActive, isAtHome: this.isAtHome }
    });

    switch (data.action) {
      case 'menu-active':
        // Menu is now active, note the selected item
        this.menuActive = true;
        logger.debug('📋 Menu activated, selected:', data.selectedItem);
        break;

      case 'menu-selection-changed':
        // User is navigating menu (preview only, don't change view)
        logger.debug('📋 Menu selection preview:', data.selectedItem);
        break;

      case 'menu-item-selected':
        // User pressed ENTER on menu item
        if (data.itemId === 'go-to-today') {
          // Reset to today
          this.widget.navigationManager.goToToday();
        } else {
          // View mode change (1, 3, week, monthly)
          this.widget.navigationManager.switchViewMode(data.itemId);
        }
        break;

      case 'enter-focus':
        // Widget is now FOCUSED (centered, has attention)
        this.isFocused = false; // Will become true on enter-active
        this.menuActive = false;
        logger.debug('🎯 ENTER-FOCUS: Widget is now centered/focused');
        break;

      case 'enter-active':
        // Widget now ACTIVE (user pressed → from menu or auto-entry)
        this.menuActive = false;
        this.isFocused = true;

        // Set home position to today
        this.homeDate = new Date();
        this.homeDate.setHours(0, 0, 0, 0);
        this.isAtHome = true;

        logger.debug('✅ ENTER-ACTIVE: Widget is NOW ACTIVE and can receive d-pad commands!', {
          isFocused: this.isFocused,
          menuActive: this.menuActive,
          isAtHome: this.isAtHome
        });
        logger.debug('📍 Calendar home set to today');
        break;

      case 'exit-active':
        // Menu regained control (user pressed ← from widget)
        this.menuActive = true;
        this.isFocused = false;
        logger.debug('❌ EXIT-ACTIVE: Widget is NO LONGER ACTIVE (returned to menu)', {
          isFocused: this.isFocused,
          menuActive: this.menuActive
        });
        break;

      case 'exit-focus':
        // Leaving focused view entirely (back to grid)
        this.menuActive = true;
        this.isFocused = false;
        this.isAtHome = true;
        this.homeDate = null;
        logger.debug('❌ EXIT-FOCUS: Returned to grid view', {
          isFocused: this.isFocused,
          menuActive: this.menuActive
        });
        break;
    }

    logger.debug('🎯 State AFTER handleMenuAction', {
      action: data.action,
      afterState: { isFocused: this.isFocused, menuActive: this.menuActive, isAtHome: this.isAtHome }
    });
  }

  /**
   * Check if current date matches home date
   */
  updateHomeStatus() {
    if (!this.homeDate) {
      this.isAtHome = false;
      return;
    }

    const current = new Date(this.widget.navigationManager.currentDate);
    current.setHours(0, 0, 0, 0);

    const home = new Date(this.homeDate);
    home.setHours(0, 0, 0, 0);

    this.isAtHome = (current.getTime() === home.getTime());

    logger.debug('Home status updated', {
      isAtHome: this.isAtHome,
      currentDate: current.toDateString(),
      homeDate: home.toDateString()
    });
  }

  /**
   * Request return to menu
   */
  requestReturnToMenu() {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'return-to-menu'
      }, '*');
      logger.info('📍 Requested return to menu (at home position)');
    }
  }

  /**
   * Handle focus change
   */
  handleFocusChange(focused) {
    const wasFocused = this.isFocused;
    this.isFocused = focused;

    if (focused && !wasFocused) {
      this.widget.weekly.setFocused(true);
      logger.debug('Calendar widget gained focus');
    } else if (!focused && wasFocused) {
      this.widget.weekly.setFocused(false);
      logger.debug('Calendar widget lost focus');
    }
  }
}
