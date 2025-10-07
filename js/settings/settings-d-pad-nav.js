// js/settings/settings-d-pad-nav.js - Screen-based navigation
// CHANGE SUMMARY: Updated to use shared screen helpers (handleScreenEnter/handleScreenExit) - removed inline screen-specific logic

import { TimeSelectionHandler } from './time-selection-handler.js';
import { SettingsSelectionHandler } from './settings-selection-handler.js';
import { handleScreenEnter, handleScreenExit } from './settings-screen-helpers.js';


export class SimplifiedNavigation {
  constructor(overlay, callbacks, timeHandler = null, selectionHandler = null) {
    this.overlay = overlay;
    this.callbacks = callbacks;
    this.focusIndex = 0;
    this.focusableElements = [];
    this.navigationStack = ['root'];
    this.screenFocusMemory = {};
    // Use shared handlers if provided, otherwise create new ones
    this.timeHandler = timeHandler || new TimeSelectionHandler();
    this.selectionHandler = selectionHandler || new SettingsSelectionHandler(this.timeHandler);
    
    this.init();
  }

  init() {
    this.updateFocusableElements();
    this.setupEventListeners();
    this.updateFocus();
    this.selectionHandler.updateNavBar(this.overlay, this.getCurrentScreenId(), this.navigationStack);
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
    
    this.selectionHandler.highlightCurrentSelections(this.overlay, this.getCurrentScreenId());
    
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

    console.log(`⚙️ Key pressed: ${key}, current screen: ${this.getCurrentScreenId()}`);

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
        
        console.log(`⚙️ Escape/Backspace - isRootScreen: ${isRootScreen}`);
        
        if (!isRootScreen) {
          console.log(`⚙️ Back button - navigating to previous screen`);
          this.navigateBack();
          handled = true;
        } else {
          console.log(`⚙️ Escape/Back on root - calling onCancel()`);
          this.callbacks.onCancel();
          handled = true;
        }
        break;
    }

    console.log(`⚙️ Key handled: ${handled}`);
    return handled;
  }

  moveFocus(direction) {
    if (this.focusableElements.length === 0) return;
    
    const oldIndex = this.focusIndex;
    this.focusIndex += direction;
    
    // Stop at boundaries instead of wrapping
    if (this.focusIndex < 0) {
      this.focusIndex = 0; // Stay at top
    } else if (this.focusIndex >= this.focusableElements.length) {
      this.focusIndex = this.focusableElements.length - 1; // Stay at bottom
    }
    
    this.updateFocus(); // Update focus classes first
    this.scrollToFocusedElement(); // Then scroll into view
    
    console.log(`⚙️ Focus moved from ${oldIndex} to ${this.focusIndex} (direction: ${direction})`);
  }

  scrollToFocusedElement() {
    const current = this.focusableElements[this.focusIndex];
    if (!current) return;
    
    // Find the scrollable container (.settings-screen.active)
    const scrollContainer = current.closest('.settings-screen.active');
    if (!scrollContainer) return;
    
    // Special case: if focusing first item, always scroll to top
    if (this.focusIndex === 0) {
      scrollContainer.scrollTop = 0;
      return;
    }
    
    // Get positions
    const containerRect = scrollContainer.getBoundingClientRect();
    const elementRect = current.getBoundingClientRect();
    
    // Calculate if element is out of view
    const elementTop = elementRect.top - containerRect.top;
    const elementBottom = elementRect.bottom - containerRect.top;
    const containerHeight = containerRect.height;
    
    // Scroll if element is not fully visible
    if (elementTop < 0) {
      // Element is above viewport - scroll up
      scrollContainer.scrollTop += elementTop - 20; // 20px padding
    } else if (elementBottom > containerHeight) {
      // Element is below viewport - scroll down
      scrollContainer.scrollTop += (elementBottom - containerHeight) + 20; // 20px padding
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
      
      // NEW: Check if this is a calendar item - trigger click directly
      if (current.classList.contains('calendar-item')) {
        console.log(`⚙️ Triggering calendar item toggle`);
        current.click();
        return;
      }
      
      // Check if this is a toggle cell
      if (current.classList.contains('toggle-cell')) {
        const toggle = current.querySelector('input[type="checkbox"]');
        if (toggle) {
          toggle.checked = !toggle.checked;
          toggle.dispatchEvent(new Event('change', { bubbles: true }));
          console.log(`⚙️ Toggled checkbox in cell to: ${toggle.checked}`);
          return;
        }
      }
      
      // Check if it's a time selection cell FIRST, before navigation
      if (this.timeHandler.isTimeSelectionCell(current)) {
        this.handleSelectionCell(current);
        return;
      }
      
      // Then check for navigation
      const navigateTarget = current.dataset.navigate;
      if (navigateTarget) {
        this.navigateToScreen(navigateTarget);
      } else if (current.classList.contains('selectable')) {
        this.handleSelectionCell(current);
      } else {
        // If no navigate attribute and not selectable, trigger click
        console.log(`⚙️ Cell has no navigate or selectable class - triggering click event`);
        current.click();
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
          this.selectionHandler.updateParentDisplayValue(action.setting, action.value, this.overlay);
          
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
          this.selectionHandler.handleRegularSelection(cell, this.overlay, this.callbacks.onSettingChange);
          break;
          
        case 'error':
          console.error('⚙️ Time selection error:', action.message);
          break;
      }
    } else {
      this.selectionHandler.handleRegularSelection(cell, this.overlay, this.callbacks.onSettingChange);
    }
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
    const currentScreenId = currentScreen?.dataset?.screen;
    
    // Save state when navigating away from special screens (SHARED HELPER)
    handleScreenExit(currentScreenId);

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
      this.selectionHandler.updateNavBar(this.overlay, this.getCurrentScreenId(), this.navigationStack);

      // Handle screen-specific initialization (SHARED HELPER)
      handleScreenEnter(screenId, this.overlay, this);
    }, 300);
  }

  navigateBack() {
    if (this.navigationStack.length <= 1) return;
    
    const currentScreen = this.overlay.querySelector('.settings-screen.active');
    const currentScreenId = currentScreen?.dataset?.screen;
  
    // Save state when navigating away from special screens (SHARED HELPER)
    handleScreenExit(currentScreenId);
    
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
      this.selectionHandler.updateNavBar(this.overlay, this.getCurrentScreenId(), this.navigationStack);
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
      this.selectionHandler.updateNavBar(this.overlay, this.getCurrentScreenId(), this.navigationStack);
    }, 300);
  }

  getCurrentScreenId() {
    return this.selectionHandler.getCurrentScreenId(this.navigationStack);
  }

  destroy() {
    console.log(`⚙️ Navigation destroyed`);
  }
}