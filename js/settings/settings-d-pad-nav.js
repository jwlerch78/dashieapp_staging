// js/settings/settings-d-pad-nav.js - Screen-based navigation
// CHANGE SUMMARY: Complete rewrite to use iOS-style screen navigation instead of tabs - works with D-pad for TV/desktop

export class SimplifiedNavigation {
  constructor(overlay, callbacks) {
    this.overlay = overlay;
    this.callbacks = callbacks;
    this.focusIndex = 0;
    this.focusableElements = [];
    this.navigationStack = ['root']; // Track screen history
    
    this.init();
  }

  init() {
    this.updateFocusableElements();
    this.setupEventListeners();
    this.updateFocus();
    this.updateNavBar();
  }

  updateFocusableElements() {
    // Get the currently active screen
    const activeScreen = this.overlay.querySelector('.settings-screen.active');
    if (!activeScreen) {
      console.warn('⚙️ No active screen found');
      return;
    }

    // Get all focusable elements in the active screen
    const cells = Array.from(activeScreen.querySelectorAll('.settings-cell'));
    const formControls = Array.from(activeScreen.querySelectorAll('.form-control'));
    const toggles = Array.from(activeScreen.querySelectorAll('.toggle-switch input'));
    
    // Combine all focusable elements in order they appear
    this.focusableElements = [...cells, ...formControls, ...toggles];
    
    console.log(`⚙️ Updated focusable elements: ${this.focusableElements.length} on screen ${this.getCurrentScreenId()}`);
    
    // Adjust focus index if it's out of bounds
    if (this.focusIndex >= this.focusableElements.length) {
      this.focusIndex = Math.max(0, this.focusableElements.length - 1);
    }
  }

  setupEventListeners() {
    // Form changes - auto-save on every change
    this.overlay.querySelectorAll('.form-control').forEach(control => {
      control.addEventListener('change', (e) => {
        if (control.dataset.setting) {
          const value = control.type === 'number' ? parseInt(control.value) : control.value;
          this.callbacks.onSettingChange(control.dataset.setting, value);
        }
      });
    });

    // Toggle switches
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

    // Check if we're currently editing a text/number input
    const activeElement = document.activeElement;
    const isTextInput = activeElement && 
      activeElement.classList.contains('form-control') &&
      (activeElement.type === 'text' || 
       activeElement.type === 'number' ||
       activeElement.type === 'time');

    // Check if we're in an open dropdown
    const isInDropdown = activeElement && 
      activeElement.tagName.toLowerCase() === 'select' &&
      activeElement.size > 1;

    // Allow text editing keys when in text input
    if (isTextInput) {
      const textEditingKeys = [
        'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 
        'Tab', ' ', 'Enter'
      ];
      
      const isSingleChar = key.length === 1;
      
      if (textEditingKeys.includes(key) || isSingleChar) {
        return false; // Let browser handle
      }
      
      // Block D-pad navigation while editing
      if (['ArrowUp', 'ArrowDown'].includes(key)) {
        return true; // Block these keys
      }
      
      // Escape exits editing mode
      if (key === 'Escape') {
        activeElement.blur();
        this.updateFocus();
        return true;
      }
    }

    // Allow dropdown navigation
    if (isInDropdown) {
      if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(key)) {
        return false; // Let browser handle
      }
    }

    console.log(`⚙️ Navigation handling key: ${key}, focus: ${this.focusIndex}/${this.focusableElements.length}, screen: ${this.getCurrentScreenId()}`);

    switch (key) {
      case 'ArrowUp':
        this.moveFocus(-1);
        handled = true;
        break;
        
      case 'ArrowDown':
        this.moveFocus(1);
        handled = true;
        break;
        
      case 'ArrowLeft':
        // Left arrow goes back (like iOS swipe)
        if (this.navigationStack.length > 1) {
          this.navigateBack();
          handled = true;
        }
        break;
        
      case 'ArrowRight':
        // Right arrow activates cells with navigate attribute
        this.activateCurrentElement();
        handled = true;
        break;
        
      case 'Enter':
        this.activateCurrentElement();
        handled = true;
        break;
        
      case 'Escape':
      case 'Backspace':
        // Escape/Backspace: go back if not on root, otherwise close settings
        if (this.navigationStack.length > 1) {
          this.navigateBack();
        } else {
          this.callbacks.onCancel();
        }
        handled = true;
        break;
    }

    return handled;
  }

  moveFocus(direction) {
    const oldIndex = this.focusIndex;
    this.focusIndex = Math.max(0, Math.min(this.focusableElements.length - 1, this.focusIndex + direction));
    
    // Auto-scroll to keep focused element visible
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
    // Clear all focus styles
    this.focusableElements.forEach(el => {
      el.classList.remove('focused', 'selected');
    });

    const current = this.focusableElements[this.focusIndex];
    if (current) {
      current.classList.add('focused');
      
      // Add 'selected' class for visual indication
      if (!current.classList.contains('settings-cell')) {
        current.classList.add('selected');
      }
      
      console.log(`⚙️ Focused on: ${this.getElementDescription(current)}`);
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

    // Check if this is a navigation cell (has data-navigate)
    if (current.classList.contains('settings-cell')) {
      const navigateTarget = current.dataset.navigate;
      
      if (navigateTarget) {
        // Navigate to another screen
        this.navigateToScreen(navigateTarget);
      } else if (current.classList.contains('selectable')) {
        // This is a selection cell (radio button style)
        this.handleSelectionCell(current);
      }
    } else if (current.classList.contains('form-control')) {
      // Activate form control
      this.activateFormControl(current);
    } else if (current.type === 'checkbox') {
      // Toggle checkbox
      current.checked = !current.checked;
      current.dispatchEvent(new Event('change'));
    }
  }

  handleSelectionCell(cell) {
    const setting = cell.dataset.setting;
    const value = cell.dataset.value;
    
    if (!setting || !value) return;
    
    // Update UI - remove selected from all siblings, add to this one
    const section = cell.closest('.settings-section');
    if (section) {
      section.querySelectorAll('.selectable').forEach(c => {
        c.classList.remove('selected');
      });
      cell.classList.add('selected');
    }
    
    // Save the setting
    this.callbacks.onSettingChange(setting, value);
    
    console.log(`⚙️ Selection changed: ${setting} = ${value}`);
  }

  activateFormControl(control) {
    console.log(`⚙️ Activating form control: ${control.id}, type: ${control.type}`);
    
    if (control.type === 'text' || control.type === 'number' || control.type === 'time') {
      // Focus text/number/time inputs for editing
      control.focus();
      
      // Position cursor at end for text inputs
      if (control.type === 'text') {
        setTimeout(() => {
          control.setSelectionRange(control.value.length, control.value.length);
        }, 10);
      }
      
      console.log(`⚙️ ${control.type} input activated for editing`);
      
    } else if (control.tagName.toLowerCase() === 'select') {
      // Dropdown handling
      console.log(`⚙️ Activating select dropdown`);
      
      control.focus();
      
      // Expand dropdown
      setTimeout(() => {
        const originalSize = control.size || 1;
        control.size = Math.min(control.options.length, 8);
        
        // Collapse when selection made or focus lost
        const collapseHandler = () => {
          control.size = originalSize;
          control.removeEventListener('change', collapseHandler);
          control.removeEventListener('blur', collapseHandler);
        };
        
        control.addEventListener('change', collapseHandler, { once: true });
        control.addEventListener('blur', collapseHandler, { once: true });
      }, 50);
    } else {
      // Other controls - just focus
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
    
    // Add to navigation stack
    this.navigationStack.push(screenId);
    
    // Animate transition (forward)
    currentScreen.classList.remove('active');
    currentScreen.classList.add('sliding-out-left');
    
    nextScreen.classList.add('sliding-in-right', 'active');
    
    setTimeout(() => {
      currentScreen.classList.remove('sliding-out-left');
      nextScreen.classList.remove('sliding-in-right');
    }, 300);
    
    // Update focusable elements for new screen
    this.focusIndex = 0; // Reset to first element
    this.updateFocusableElements();
    this.updateFocus();
    this.updateNavBar();
  }

  navigateBack() {
    if (this.navigationStack.length <= 1) return;
    
    const currentScreen = this.overlay.querySelector('.settings-screen.active');
    this.navigationStack.pop();
    
    const previousScreenId = this.navigationStack[this.navigationStack.length - 1];
    const previousScreen = this.overlay.querySelector(`[data-screen="${previousScreenId}"]`);
    
    if (!previousScreen) return;
    
    console.log(`⚙️ Navigating back to screen: ${previousScreenId}`);
    
    // Animate transition (back)
    currentScreen.classList.remove('active');
    currentScreen.classList.add('sliding-out-right');
    
    previousScreen.classList.add('sliding-in-left', 'active');
    
    setTimeout(() => {
      currentScreen.classList.remove('sliding-out-right');
      previousScreen.classList.remove('sliding-in-left');
    }, 300);
    
    // Update focusable elements for previous screen
    this.focusIndex = 0; // Reset to first element
    this.updateFocusableElements();
    this.updateFocus();
    this.updateNavBar();
  }

  updateNavBar() {
    const currentScreenId = this.navigationStack[this.navigationStack.length - 1];
    const currentScreen = this.overlay.querySelector(`[data-screen="${currentScreenId}"]`);
    
    if (!currentScreen) return;
    
    // Update title
    const title = currentScreen.dataset.title || 'Settings';
    const navTitle = this.overlay.querySelector('.nav-title');
    if (navTitle) {
      navTitle.textContent = title;
    }
    
    // Show/hide back button
    const backBtn = this.overlay.querySelector('.nav-back-button');
    if (backBtn) {
      if (this.navigationStack.length > 1) {
        backBtn.style.visibility = 'visible';
        
        // Set back button text to previous screen name
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