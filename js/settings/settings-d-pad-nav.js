// js/settings/settings-d-pad-nav.js - Auto-save implementation  
// CHANGE SUMMARY: Fixed backspace in text inputs, dropdown activation with click event, and escape key handling
// D-pad navigation logic for settings interface

export class SimplifiedNavigation {
  constructor(overlay, callbacks) {
    this.overlay = overlay;
    this.callbacks = callbacks;
    this.focusIndex = 0;
    this.focusableElements = [];
    this.collapsedGroups = new Set(['theme', 'sleep', 'photos', 'widget-config', 'family-info', 'family-members']);
    this.currentTab = 'display';
    
    this.init();
  }

  init() {
    this.updateFocusableElements();
    this.setupEventListeners();
    this.updateFocus();
  }

  updateFocusableElements() {
    // Get all focusable elements in the correct order
    const tabs = Array.from(this.overlay.querySelectorAll('.tab-button:not(.disabled)'));
    const activePanel = this.overlay.querySelector('.tab-panel.active');
    const groupTitles = Array.from(activePanel.querySelectorAll('.group-title'));
    
    // Build proper navigation order - groups and their controls together
    const contentElements = [];
    groupTitles.forEach(title => {
      // Always add the group title
      contentElements.push(title);
      
      // Add form controls if this group is expanded
      const groupId = title.dataset.group;
      if (!this.collapsedGroups.has(groupId)) {
        const content = this.overlay.querySelector(`#${groupId}-content`);
        if (content) {
          const controls = Array.from(content.querySelectorAll('.form-control'));
          contentElements.push(...controls);
        }
      }
    });
    
    // No footer buttons anymore - removed from navigation
    // Create proper navigation hierarchy: tabs -> content (groups+controls)
    this.focusableElements = [...tabs, ...contentElements];
    
    console.log(`⚙️ Updated focusable elements: ${this.focusableElements.length} (${tabs.length} tabs, ${contentElements.length} content)`);
    
    // Adjust focus index if it's out of bounds
    if (this.focusIndex >= this.focusableElements.length) {
      this.focusIndex = Math.max(0, this.focusableElements.length - 1);
    }
  }

  setupEventListeners() {
    // Tab clicks
    this.overlay.querySelectorAll('.tab-button:not(.disabled)').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        this.switchTab(tab.dataset.tab);
      });
    });

    // Group title clicks
    this.overlay.querySelectorAll('.group-title').forEach(title => {
      title.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleGroup(title.dataset.group);
      });
    });

    // Form changes - auto-save on every change
    this.overlay.querySelectorAll('.form-control').forEach(control => {
      control.addEventListener('change', (e) => {
        if (control.id === 'theme-select') {
          this.callbacks.onThemeChange(e.target.value);
        } else if (control.dataset.setting) {
          const value = control.type === 'number' ? parseInt(control.value) : control.value;
          this.callbacks.onSettingChange(control.dataset.setting, value);
        }
      });
    });

    // Save/Cancel buttons removed - no event listeners needed
  }

  handleKeyPress(event) {
    const { key } = event;
    let handled = false;

    // FIX 1: Check if we're currently editing a text/number input
    // Look at the actual focused element in the DOM
    const activeElement = document.activeElement;
    const isTextInput = activeElement && 
      activeElement.classList.contains('form-control') &&
      (activeElement.type === 'text' || 
       activeElement.type === 'number' ||
       activeElement.type === 'time');

    if (isTextInput) {
      console.log(`⚙️ 📝 Text input is focused - key: ${key}`);
      
      // Allow all text editing keys through
      const textEditingKeys = [
        'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 
        'Tab', ' ', 'Enter'
      ];
      
      // Allow single characters (letters, numbers, symbols)
      const isSingleChar = key.length === 1;
      
      if (textEditingKeys.includes(key) || isSingleChar) {
        console.log(`⚙️ ✅ Allowing text editing key: "${key}"`);
        return false; // Don't handle, let browser process normally
      }
      
      // ONLY block D-pad navigation keys (up/down)
      if (['ArrowUp', 'ArrowDown'].includes(key)) {
        console.log(`⚙️ 🚫 Blocking D-pad navigation while editing: ${key}`);
        return true; // Block these keys
      }
      
      // Handle Escape to exit editing mode
      if (key === 'Escape') {
        console.log(`⚙️ 🏃 Escape - exiting text editing mode`);
        activeElement.blur();
        return true; // Handled - blur the input
      }
    }

    console.log(`⚙️ Navigation handling key: ${key}, current focus: ${this.focusIndex}/${this.focusableElements.length}`);

    switch (key) {
      case 'ArrowUp':
        this.moveFocus(-1);
        handled = true;
        break;
      case 'ArrowDown':
        // When on tabs, move to first content element instead of next tab
        if (this.isOnTabs()) {
          this.moveFromTabsToContent();
          handled = true;
        } else {
          this.moveFocus(1);
          handled = true;
        }
        break;
      case 'ArrowLeft':
        // Only handle left/right for tabs
        if (this.isOnTabs()) {
          this.moveTabFocus(-1);
          handled = true;
        }
        break;
      case 'ArrowRight':
        // Only handle left/right for tabs
        if (this.isOnTabs()) {
          this.moveTabFocus(1);
          handled = true;
        }
        break;
      case 'Enter':
        this.activateCurrentElement();
        handled = true;
        break;
      case 'Escape':
      case 'Backspace': // FIX 3: Handle Backspace as escape when NOT in text input
        // Just close settings - no confirmation needed with auto-save
        console.log(`⚙️ Escape/Back button pressed - closing settings`);
        this.callbacks.onCancel();
        handled = true;
        break;
    }

    return handled;
  }

  isOnTabs() {
    const current = this.focusableElements[this.focusIndex];
    return current && current.classList.contains('tab-button');
  }

  // New method to move from tabs down to content
  moveFromTabsToContent() {
    // Find first non-tab element (first content element)
    const firstContentIndex = this.focusableElements.findIndex(el => !el.classList.contains('tab-button'));
    if (firstContentIndex !== -1) {
      this.focusIndex = firstContentIndex;
      this.updateFocus();
      console.log(`⚙️ Moved from tabs to first content element at index ${firstContentIndex}`);
    } else {
      // Fallback to normal down movement if no content found
      this.moveFocus(1);
    }
  }

  moveTabFocus(direction) {
    const tabs = this.focusableElements.filter(el => el.classList.contains('tab-button'));
    const currentTab = this.focusableElements[this.focusIndex];
    const currentTabIndex = tabs.indexOf(currentTab);
    
    if (currentTabIndex !== -1) {
      const newTabIndex = Math.max(0, Math.min(tabs.length - 1, currentTabIndex + direction));
      const newTab = tabs[newTabIndex];
      this.focusIndex = this.focusableElements.indexOf(newTab);
      this.updateFocus();
    }
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
      // Scroll the settings content container to keep the focused element visible
      const contentContainer = this.overlay.querySelector('.settings-content');
      if (contentContainer) {
        current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }
    }
  }

  toggleGroup(groupId) {
    const title = this.overlay.querySelector(`[data-group="${groupId}"]`);
    const content = this.overlay.querySelector(`#${groupId}-content`);
    
    if (!title || !content) return;
    
    if (this.collapsedGroups.has(groupId)) {
      // Expanding
      this.collapsedGroups.delete(groupId);
      title.classList.add('expanded');
      content.classList.remove('collapsed');
      content.classList.add('expanded');
      console.log(`⚙️ Expanded group: ${groupId}`);
    } else {
      // Collapsing
      this.collapsedGroups.add(groupId);
      title.classList.remove('expanded');
      content.classList.remove('expanded');
      content.classList.add('collapsed');
      console.log(`⚙️ Collapsed group: ${groupId}`);
    }
    
    // Update focusable elements after toggle
    this.updateFocusableElements();
    this.updateFocus();
  }

  switchTab(tabId) {
    console.log(`⚙️ Switching to tab: ${tabId}`);
    
    this.overlay.querySelectorAll('.tab-button').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    this.overlay.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tabId}-panel`);
    });

    this.currentTab = tabId;
    
    // Update focusable elements for new tab
    this.updateFocusableElements();
    
    // Find first non-tab element to focus on
    const firstContentElement = this.focusableElements.find(el => !el.classList.contains('tab-button'));
    if (firstContentElement) {
      this.focusIndex = this.focusableElements.indexOf(firstContentElement);
    } else {
      this.focusIndex = 0;
    }
    
    this.updateFocus();
  }

  updateFocus() {
    // Clear all focus styles
    this.focusableElements.forEach(el => {
      el.classList.remove('focused', 'selected');
    });

    const current = this.focusableElements[this.focusIndex];
    if (current) {
      current.classList.add('focused');
      
      // Add 'selected' class for form controls and buttons
      if (!current.classList.contains('group-title') && !current.classList.contains('tab-button')) {
        current.classList.add('selected');
      }
      
      console.log(`⚙️ Focused on: ${this.getElementDescription(current)}`);
    }
  }

  getElementDescription(element) {
    if (element.classList.contains('tab-button')) {
      return `Tab: ${element.textContent}`;
    } else if (element.classList.contains('group-title')) {
      return `Group: ${element.dataset.group}`;
    } else if (element.classList.contains('form-control')) {
      return `Control: ${element.id || element.dataset.setting}`;
    } else if (element.classList.contains('btn')) {
      return `Button: ${element.textContent}`;
    }
    return element.tagName + (element.id ? '#' + element.id : '');
  }

  activateCurrentElement() {
    const current = this.focusableElements[this.focusIndex];
    if (!current) return;

    console.log(`⚙️ Activating: ${this.getElementDescription(current)}`);

    if (current.classList.contains('tab-button')) {
      // Switch tabs
      if (!current.classList.contains('disabled')) {
        this.switchTab(current.dataset.tab);
      }
    } else if (current.classList.contains('group-title')) {
      // Toggle group
      this.toggleGroup(current.dataset.group);
    } else if (current.classList.contains('form-control')) {
      // Activate form controls
      this.activateFormControl(current);
    }
  }

  // Form control activation
  activateFormControl(control) {
    console.log(`⚙️ Activating form control: ${control.id}, type: ${control.type}, tag: ${control.tagName}`);
    
    if (control.type === 'text' || control.type === 'number' || control.type === 'time') {
      // Text/number/time inputs - just focus
      control.focus();
      
      // Position cursor at end of text for text inputs
      if (control.type === 'text') {
        setTimeout(() => {
          control.setSelectionRange(control.value.length, control.value.length);
        }, 10);
      }
      
      console.log(`⚙️ ${control.type} input activated for editing`);
      
    } else if (control.tagName.toLowerCase() === 'select') {
      // FIX 3: Dropdown handling for Fire TV/Android
      console.log(`⚙️ Activating select dropdown: ${control.id}`);
      
      // Focus first
      control.focus();
      
      // For TV/Android devices, expand the dropdown by dispatching a click event
      setTimeout(() => {
        console.log(`⚙️ Expanding dropdown with click event`);
        
        // Dispatch a real click event to open the dropdown
        const clickEvent = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window,
          button: 0
        });
        control.dispatchEvent(clickEvent);
        
        // Also try setting size as backup
        const originalSize = control.size || 1;
        control.size = Math.min(control.options.length, 8); // Show max 8 options
        
        // Collapse when selection is made
        const collapseHandler = () => {
          control.size = originalSize;
          control.removeEventListener('change', collapseHandler);
          control.removeEventListener('blur', collapseHandler);
          console.log(`⚙️ Dropdown collapsed after selection`);
        };
        
        control.addEventListener('change', collapseHandler, { once: true });
        control.addEventListener('blur', collapseHandler, { once: true });
      }, 50);
      
    } else {
      // Other form controls - just focus
      control.focus();
      console.log(`⚙️ Focused ${control.type} input`);
    }
  }

  destroy() {
    // Cleanup if needed
    console.log(`⚙️ Navigation destroyed`);
  }
}