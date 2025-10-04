// js/settings/settings-d-pad-nav.js - Screen-based navigation
// CHANGE SUMMARY: Updated to use TimeSelectionHandler for consolidated time selection logic (D-pad navigation)

import { TimeSelectionHandler } from './time-selection-handler.js';

export class SimplifiedNavigation {
  constructor(overlay, callbacks, timeHandler = null) {
    this.overlay = overlay;
    this.callbacks = callbacks;
    this.focusIndex = 0;
    this.focusableElements = [];
    this.navigationStack = ['root'];
    this.screenFocusMemory = {};
    // Use shared handler if provided, otherwise create new one
    this.timeHandler = timeHandler || new TimeSelectionHandler();
    
    this.init();
  }

  init() {
    this.updateFocusableElements();
    this.setupEventListeners();
    this.updateFocus();
    this.updateNavBar();
  }

  updateFocusableElements() {
    const activeScreen = this.overlay.querySelector('.settings-screen.active');
    if (!activeScreen) {
      console.warn('⚙️ No active screen found');
      return;
    }

    const cells = Array.from(activeScreen.querySelectorAll('.settings-cell'));
    const formControls = Array.from(activeScreen.querySelectorAll('.form-control'));
    const toggles = Array.from(activeScreen.querySelectorAll('.toggle-switch input'));
    
    this.focusableElements = [...cells, ...formControls, ...toggles];
    
    console.log(`⚙️ Updated focusable elements: ${this.focusableElements.length} on screen ${this.getCurrentScreenId()}`);
    
    this.highlightCurrentSelections();
    
    const screenId = this.getCurrentScreenId();
    if (this.screenFocusMemory[screenId] !== undefined) {
      this.focusIndex = Math.min(this.screenFocusMemory[screenId], this.focusableElements.length - 1);
      console.log(`⚙️ Restored focus to index ${this.focusIndex} for screen ${screenId}`);
    } else {
      const selectedIndex = this.focusableElements.findIndex(el => el.classList.contains('selected'));
      if (selectedIndex !== -1) {
        this.focusIndex = selectedIndex;
        console.log(`⚙️ Focusing on selected item at index ${this.focusIndex}`);
      } else if (this.focusIndex >= this.focusableElements.length) {
        this.focusIndex = Math.max(0, this.focusableElements.length - 1);
      }
    }
    
    this.scrollToFocusedElement();
  }

  setupEventListeners() {
    this.overlay.querySelectorAll('.form-control').forEach(control => {
      control.addEventListener('change', (e) => {
        if (control.dataset.setting) {
          const value = control.type === 'number' ? parseInt(control.value) : control.value;
          this.callbacks.onSettingChange(control.dataset.setting, value);
        }
      });
    });

    this.overlay.querySelectorAll('.toggle-switch input').forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        if (toggle.dataset.setting) {
          this.callbacks.onSettingChange(toggle.dataset.setting, toggle.checked);
        }
      });
    });
  }

  handleKeyPress(event) {
    const { key } = event;
    let handled = false;

    const activeElement = document.activeElement;
    const isTextInput = activeElement && 
      activeElement.classList.contains('form-control') &&
      (activeElement.type === 'text' || activeElement.type === 'number');

    if (isTextInput) {
      const textEditingKeys = [
        'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 
        'Tab', ' ', 'Enter'
      ];
      
      const isSingleChar = key.length === 1;
      
      if (textEditingKeys.includes(key) || isSingleChar) {
        return false;
      }
      
      if (['ArrowUp', 'ArrowDown'].includes(key)) {
        return true;
      }
      
      if (key === 'Escape') {
        console.log(`⚙️ Escape - blurring text input (staying in modal)`);
        activeElement.blur();
        this.updateFocus();
        return true;
      }
    }

    switch (key) {
      case 'ArrowUp':
        this.moveFocus(-1);
        handled = true;
        break;
        
      case 'ArrowDown':
        this.moveFocus(1);
        handled = true;
        break;
        
      case 'Enter':
        this.activateCurrentElement();
        handled = true;
        break;
        
      case 'Escape':
      case 'Backspace':
        const isRootScreen = this.getCurrentScreenId() === 'root';
        
        if (!isRootScreen) {
          console.log(`⚙️ Back button - navigating to previous screen`);
          this.navigateBack();
          handled = true;
        } else {
          console.log(`⚙️ Escape/Back - closing settings`);
          this.callbacks.onCancel();
          handled = true;
        }
        break;
    }

    return handled;
  }

  moveFocus(direction) {
    if (this.focusableElements.length === 0) return;
    
    const oldIndex = this.focusIndex;
    this.focusIndex += direction;
    
    if (this.focusIndex < 0) {
      this.focusIndex = this.focusableElements.length - 1;
    } else if (this.focusIndex >= this.focusableElements.length) {
      this.focusIndex = 0;
    }
    
    this.scrollToFocusedElement();
    this.updateFocus();
    
    console.log(`⚙️ Focus moved from ${oldIndex} to ${this.focusIndex} (direction: ${direction})`);
  }

  scrollToFocusedElement() {
    const current = this.focusableElements[this.focusIndex];
    if (current) {
      current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }

  updateFocus() {
    this.focusableElements.forEach(el => {
      el.classList.remove('focused');
    });

    const current = this.focusableElements[this.focusIndex];
    if (current) {
      current.classList.add('focused');
      console.log(`⚙️ Focused on: ${this.getElementDescription(current)}`);
      
      const screenId = this.getCurrentScreenId();
      this.screenFocusMemory[screenId] = this.focusIndex;
    }
  }

  getElementDescription(element) {
    if (element.classList.contains('settings-cell')) {
      const label = element.querySelector('.cell-label')?.textContent;
      return `Cell: ${label}`;
    } else if (element.classList.contains('form-control')) {
      return `Control: ${element.id || element.dataset.setting}`;
    } else if (element.type === 'checkbox') {
      return `Toggle: ${element.dataset.setting}`;
    }
    return element.tagName + (element.id ? '#' + element.id : '');
  }

  activateCurrentElement() {
    const current = this.focusableElements[this.focusIndex];
    if (!current) return;

    console.log(`⚙️ Activating: ${this.getElementDescription(current)}`);

    if (current.classList.contains('settings-cell')) {
      const navigateTarget = current.dataset.navigate;
      
      if (navigateTarget) {
        this.navigateToScreen(navigateTarget);
      } else if (current.classList.contains('selectable')) {
        this.handleSelectionCell(current);
      }
    } else if (current.classList.contains('form-control')) {
      this.activateFormControl(current);
    } else if (current.type === 'checkbox') {
      current.checked = !current.checked;
      current.dispatchEvent(new Event('change'));
    }
  }

  handleSelectionCell(cell) {
    // Check if this is a time selection cell
    if (this.timeHandler.isTimeSelectionCell(cell)) {
      const action = this.timeHandler.handleSelection(cell);
      
      console.log('⚙️ Time selection action:', action);
      
      switch (action.type) {
        case 'navigate':
          this.navigateToScreen(action.screenId);
          break;
          
        case 'complete':
          console.log(`⚙️ ${action.message}`);
          
          this.callbacks.onSettingChange(action.setting, action.value);
          this.updateParentDisplayValue(action.setting, action.value);
          
          // Store focus memory for Display screen
          const cellIndex = this.timeHandler.getDisplayScreenCellIndex(this.overlay, action.timeSettingName);
          if (cellIndex !== -1) {
            this.screenFocusMemory['display'] = cellIndex;
            console.log(`⚙️ Set focus memory for display screen to index ${cellIndex} (${action.timeSettingName})`);
          }
          
          // Navigate directly back to Display screen
          setTimeout(() => {
            this.navigateDirectToScreen('display');
          }, 300);
          break;
          
        case 'not-time-selection':
          this.handleRegularSelection(cell);
          break;
          
        case 'error':
          console.error('⚙️ Time selection error:', action.message);
          break;
      }
    } else {
      this.handleRegularSelection(cell);
    }
  }

  handleRegularSelection(cell) {
    const setting = cell.dataset.setting;
    const value = cell.dataset.value;
    
    if (!setting || !value) return;
    
    const section = cell.closest('.settings-section');
    if (section) {
      section.querySelectorAll('.selectable').forEach(c => {
        c.classList.remove('selected');
      });
      cell.classList.add('selected');
    }
    
    this.callbacks.onSettingChange(setting, value);
    this.updateParentDisplayValue(setting, value);
    
    console.log(`⚙️ Selection changed: ${setting} = ${value}`);
    
    setTimeout(() => {
      this.navigateBack();
    }, 300);
  }

  updateParentDisplayValue(setting, value) {
    const displayMap = {
      'display.theme': { id: 'mobile-theme-value', format: (v) => v === 'dark' ? 'Dark' : 'Light' },
      'display.sleepTime': { id: 'mobile-sleep-time-value', format: (v) => this.timeHandler.formatTime(v) },
      'display.wakeTime': { id: 'mobile-wake-time-value', format: (v) => this.timeHandler.formatTime(v) },
      'photos.source': { 
        id: 'mobile-photo-album-value', 
        format: (v) => ({ recent: 'Recent Photos', family: 'Family Album', vacation: 'Vacation 2024' }[v] || v)
      },
      'photos.transitionTime': {
        id: 'mobile-photo-transition-value',
        format: (v) => this.formatTransitionTime(parseInt(v))
      }
    };

    const display = displayMap[setting];
    if (display) {
      const element = this.overlay.querySelector(`#${display.id}`);
      if (element) {
        element.textContent = display.format(value);
      }
    }
  }

  formatTransitionTime(seconds) {
    if (seconds < 60) return `${seconds} sec`;
    if (seconds < 3600) return `${seconds / 60} min`;
    return `${seconds / 3600} hour`;
  }

  highlightCurrentSelections() {
    const activeScreen = this.overlay.querySelector('.settings-screen.active');
    if (!activeScreen) return;
    
    const screenId = this.getCurrentScreenId();
    
    if (screenId.includes('sleep-time') || screenId.includes('wake-time')) {
      this.timeHandler.highlightCurrentTimeSelection(this.overlay, screenId);
      return;
    }
    
    const selectableCells = activeScreen.querySelectorAll('.settings-cell.selectable[data-setting]');
    
    selectableCells.forEach(cell => {
      const setting = cell.dataset.setting;
      const value = cell.dataset.value;
      
      let isCurrentValue = false;
      
      if (setting === 'display.theme') {
        const themeValue = this.overlay.querySelector('#mobile-theme-value')?.textContent.toLowerCase();
        isCurrentValue = (value === 'dark' && themeValue === 'dark') || 
                        (value === 'light' && themeValue === 'light');
      } else if (setting === 'photos.transitionTime') {
        const transitionValue = this.overlay.querySelector('#mobile-photo-transition-value')?.textContent;
        const currentSeconds = this.parseTransitionTime(transitionValue);
        isCurrentValue = parseInt(value) === currentSeconds;
      } else if (setting === 'photos.source') {
        const albumValue = this.overlay.querySelector('#mobile-photo-album-value')?.textContent;
        const albumMap = {
          'Recent Photos': 'recent',
          'Family Album': 'family',
          'Vacation 2024': 'vacation'
        };
        isCurrentValue = value === albumMap[albumValue];
      }
      
      if (isCurrentValue) {
        cell.classList.add('selected');
      } else {
        cell.classList.remove('selected');
      }
    });
  }

  parseTransitionTime(timeStr) {
    if (!timeStr) return 5;
    if (timeStr.includes('sec')) return parseInt(timeStr);
    if (timeStr.includes('min')) return parseInt(timeStr) * 60;
    if (timeStr.includes('hour')) return parseInt(timeStr) * 3600;
    return 5;
  }

  activateFormControl(control) {
    console.log(`⚙️ Activating form control: ${control.id}, type: ${control.type}`);
    
    if (control.type === 'text' || control.type === 'number') {
      control.focus();
      
      if (control.type === 'text') {
        setTimeout(() => {
          control.setSelectionRange(control.value.length, control.value.length);
        }, 10);
      }
    } else if (control.tagName.toLowerCase() === 'select') {
      control.focus();
      setTimeout(() => {
        const originalSize = control.size || 1;
        control.size = Math.min(control.options.length, 8);
        
        const collapseHandler = () => {
          control.size = originalSize;
          control.removeEventListener('change', collapseHandler);
          control.removeEventListener('blur', collapseHandler);
        };
        
        control.addEventListener('change', collapseHandler, { once: true });
        control.addEventListener('blur', collapseHandler, { once: true });
      }, 50);
    } else {
      control.focus();
    }
  }

  navigateToScreen(screenId) {
    const currentScreen = this.overlay.querySelector('.settings-screen.active');
    const nextScreen = this.overlay.querySelector(`[data-screen="${screenId}"]`);
    
    if (!nextScreen) {
      console.error(`⚙️ Screen not found: ${screenId}`);
      return;
    }
    
    console.log(`⚙️ Navigating to screen: ${screenId}`);
    
    this.navigationStack.push(screenId);
    
    currentScreen.classList.remove('active');
    currentScreen.classList.add('sliding-out-left');
    
    nextScreen.classList.add('sliding-in-right', 'active');
    
    setTimeout(() => {
      currentScreen.classList.remove('sliding-out-left');
      nextScreen.classList.remove('sliding-in-right');
      
      this.focusIndex = 0;
      this.updateFocusableElements();
      this.updateFocus();
      this.updateNavBar();
    }, 300);
  }

  navigateBack() {
    if (this.navigationStack.length <= 1) return;
    
    const currentScreen = this.overlay.querySelector('.settings-screen.active');
    this.navigationStack.pop();
    
    const previousScreenId = this.navigationStack[this.navigationStack.length - 1];
    const previousScreen = this.overlay.querySelector(`[data-screen="${previousScreenId}"]`);
    
    if (!previousScreen) return;
    
    console.log(`⚙️ Navigating back to screen: ${previousScreenId}`);
    
    currentScreen.classList.remove('active');
    currentScreen.classList.add('sliding-out-right');
    
    previousScreen.classList.add('sliding-in-left', 'active');
    
    setTimeout(() => {
      currentScreen.classList.remove('sliding-out-right');
      previousScreen.classList.remove('sliding-in-left');
      
      this.focusIndex = 0;
      this.updateFocusableElements();
      this.updateFocus();
      this.updateNavBar();
    }, 300);
  }

  navigateDirectToScreen(targetScreenId) {
    const currentScreen = this.overlay.querySelector('.settings-screen.active');
    const targetScreen = this.overlay.querySelector(`[data-screen="${targetScreenId}"]`);
    
    if (!targetScreen) {
      console.error(`⚙️ Target screen not found: ${targetScreenId}`);
      return;
    }
    
    console.log(`⚙️ Navigating directly to: ${targetScreenId}`);
    
    this.navigationStack = ['root', targetScreenId];
    
    currentScreen.classList.remove('active');
    currentScreen.classList.add('sliding-out-right');
    
    targetScreen.classList.add('sliding-in-left', 'active');
    
    setTimeout(() => {
      currentScreen.classList.remove('sliding-out-right');
      targetScreen.classList.remove('sliding-in-left');
      
      this.focusIndex = 0;
      this.updateFocusableElements();
      this.updateFocus();
      this.updateNavBar();
    }, 300);
  }

  updateNavBar() {
    const currentScreenId = this.getCurrentScreenId();
    const currentScreen = this.overlay.querySelector(`[data-screen="${currentScreenId}"]`);
    
    if (!currentScreen) return;
    
    const title = currentScreen.dataset.title || 'Settings';
    const navTitle = this.overlay.querySelector('.nav-title');
    if (navTitle) {
      navTitle.textContent = title;
    }
    
    const backBtn = this.overlay.querySelector('.nav-back-button');
    if (backBtn) {
      if (this.navigationStack.length > 1) {
        backBtn.style.visibility = 'visible';
        
        const previousScreenId = this.navigationStack[this.navigationStack.length - 2];
        const previousScreen = this.overlay.querySelector(`[data-screen="${previousScreenId}"]`);
        if (previousScreen) {
          const previousTitle = previousScreen.dataset.title || 'Back';
          backBtn.textContent = `‹ ${previousTitle}`;
        }
      } else {
        backBtn.style.visibility = 'hidden';
      }
    }
  }

  getCurrentScreenId() {
    return this.navigationStack[this.navigationStack.length - 1];
  }

  destroy() {
    console.log(`⚙️ Navigation destroyed`);
  }
}