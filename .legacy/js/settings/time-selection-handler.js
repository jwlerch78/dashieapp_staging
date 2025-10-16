// js/settings/time-selection-handler.js
// CHANGE SUMMARY: Added debug logging to track pendingTimeSelection state persistence issue

export class TimeSelectionHandler {
  constructor() {
    this.pendingTimeSelection = null;
    console.log('⏰ TimeSelectionHandler constructed, pendingTimeSelection initialized to null');
  }

  /**
   * Handle a time selection cell click/activation
   * Returns an action object telling the caller what to do next
   */
  handleSelection(cell, currentSettings) {
    console.log('⏰ handleSelection called, current pendingTimeSelection:', JSON.stringify(this.pendingTimeSelection));
    
    const hour = cell.dataset.hour;
    const minute = cell.dataset.minute;
    const period = cell.dataset.period;
    const navigateTo = cell.dataset.navigate;
    const setting = cell.dataset.setting;

    console.log('⏰ Cell data:', { hour, minute, period, navigateTo, setting });

    // Not a time selection cell
    if (!hour && !minute && !period) {
      return { type: 'not-time-selection' };
    }

    // Initialize pending selection if needed
    if (!this.pendingTimeSelection) {
      console.log('⏰ Creating new pendingTimeSelection object');
      this.pendingTimeSelection = {};
    } else {
      console.log('⏰ Using existing pendingTimeSelection:', JSON.stringify(this.pendingTimeSelection));
    }

    // Step 1: Hour selection
    if (hour) {
      this.pendingTimeSelection.hour = parseInt(hour);
      console.log(`⏰ Hour selected: ${hour}, state is now:`, JSON.stringify(this.pendingTimeSelection));
      return {
        type: 'navigate',
        screenId: navigateTo,
        message: `Hour ${hour} selected, navigating to minutes`
      };
    }

    // Step 2: Minute selection
    if (minute) {
      this.pendingTimeSelection.minute = parseInt(minute);
      console.log(`⏰ Minute selected: ${minute}, state is now:`, JSON.stringify(this.pendingTimeSelection));
      return {
        type: 'navigate',
        screenId: navigateTo,
        message: `Minute ${minute} selected, navigating to AM/PM`
      };
    }

    // Step 3: AM/PM selection (final step)
    if (period && this.pendingTimeSelection.hour !== undefined && this.pendingTimeSelection.minute !== undefined) {
      this.pendingTimeSelection.period = period;
      
      const finalTime = this.buildTimeValue(
        this.pendingTimeSelection.hour,
        this.pendingTimeSelection.minute,
        this.pendingTimeSelection.period
      );

      console.log(`⏰ Period selected: ${period}, final time: ${finalTime}`);

      // Determine which time setting this is (sleep or wake)
      const timeSettingName = setting.includes('sleepTime') ? 'sleep-time' : 'wake-time';

      // Clear pending selection
      this.pendingTimeSelection = null;
      console.log('⏰ Cleared pendingTimeSelection after successful completion');

      return {
        type: 'complete',
        setting: setting,
        value: finalTime,
        timeSettingName: timeSettingName,
        message: `Time selection complete: ${setting} = ${finalTime}`
      };
    }

    // Incomplete selection - shouldn't happen
    console.warn('⏰ Incomplete time selection state', this.pendingTimeSelection);
    console.warn('⏰ Hour undefined?', this.pendingTimeSelection.hour === undefined);
    console.warn('⏰ Minute undefined?', this.pendingTimeSelection.minute === undefined);
    return { type: 'error', message: 'Incomplete time selection' };
  }

  /**
   * Build a 24-hour time string from 12-hour components
   */
  buildTimeValue(hour, minute, period) {
    let hour24 = hour;
    if (period === 'PM' && hour !== 12) {
      hour24 = hour + 12;
    } else if (period === 'AM' && hour === 12) {
      hour24 = 0;
    }
    
    return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  /**
   * Format a 24-hour time for display (e.g., "22:00" → "10:00 PM")
   */
  formatTime(time24) {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  /**
   * Parse a display time string into components
   */
  parseTimeDisplay(timeStr) {
    // Parse "10:00 PM" into {hour12: 10, minute: 0, period: "PM"}
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return { hour12: 12, minute: 0, period: 'PM' };
    
    return {
      hour12: parseInt(match[1]),
      minute: parseInt(match[2]),
      period: match[3].toUpperCase()
    };
  }

  /**
   * Highlight the current time selection on a screen
   */
  highlightCurrentTimeSelection(overlay, screenId) {
    const activeScreen = overlay.querySelector('.settings-screen.active');
    if (!activeScreen) return;
    
    // Determine which time setting we're looking at
    const isSleepTime = screenId.includes('sleep');
    const timeValueElement = overlay.querySelector(isSleepTime ? '#mobile-sleep-time-value' : '#mobile-wake-time-value');
    if (!timeValueElement) return;
    
    const timeStr = timeValueElement.textContent; // e.g., "10:00 PM"
    const parsedTime = this.parseTimeDisplay(timeStr);
    
    // Highlight based on what screen level we're on
    if (screenId.endsWith('-time')) {
      // Hour selection screen
      const hourCells = activeScreen.querySelectorAll('[data-hour]');
      hourCells.forEach(cell => {
        if (parseInt(cell.dataset.hour) === parsedTime.hour12) {
          cell.classList.add('selected');
        } else {
          cell.classList.remove('selected');
        }
      });
    } else if (screenId.endsWith('-min')) {
      // Minute selection screen
      const minuteCells = activeScreen.querySelectorAll('[data-minute]');
      minuteCells.forEach(cell => {
        if (parseInt(cell.dataset.minute) === parsedTime.minute) {
          cell.classList.add('selected');
        } else {
          cell.classList.remove('selected');
        }
      });
    } else if (screenId.endsWith('-period')) {
      // AM/PM selection screen
      const periodCells = activeScreen.querySelectorAll('[data-period]');
      periodCells.forEach(cell => {
        if (cell.dataset.period === parsedTime.period) {
          cell.classList.add('selected');
        } else {
          cell.classList.remove('selected');
        }
      });
    }
  }

  /**
   * Get the Display screen cell index for a time setting
   * Used to restore focus after completing time selection
   */
  getDisplayScreenCellIndex(overlay, timeSettingName) {
    const displayScreen = overlay.querySelector('[data-screen="display"]');
    if (!displayScreen) return -1;

    const allCells = Array.from(displayScreen.querySelectorAll('.settings-cell'));
    const timeCell = displayScreen.querySelector(`[data-navigate="${timeSettingName}"]`);
    
    if (!timeCell) return -1;
    
    return allCells.indexOf(timeCell);
  }

  /**
   * Reset the pending selection state
   */
  reset() {
    console.log('⏰ reset() called, clearing pendingTimeSelection');
    this.pendingTimeSelection = null;
  }

  /**
   * Check if a cell is part of time selection
   */
  isTimeSelectionCell(cell) {
    return !!(cell.dataset.hour || cell.dataset.minute || cell.dataset.period);
  }
}