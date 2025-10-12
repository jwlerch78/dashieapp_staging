// js/core/navigation.js - Navigation Logic & Focus Management with Timeout System
// v2.1 - 10/12/25 8:15pm - WIDGET-FIRST WITH VISIBLE MENU: Widget is active and large, menu visible but dimmed, press LEFT/ESC to focus menu
// v2.0 - 10/11/25 - Updated messaging protocol to 3-state model
// CHANGE SUMMARY: Widget starts active (large, scale 1.08) with dimmed menu visible. LEFT/ESC focuses menu (un-dims it), RIGHT returns to active widget

import { state, elements, findWidget, setFocus, setFocusedWidget, setCurrentMain } from './state.js';
import { isFeatureEnabled } from './feature-flags.js';
import { 
  registerWidgetMenu, 
  hasWidgetMenu, 
  getWidgetMenuConfig,
  moveMenuSelection 
} from './focus-menu-state.js';
import { 
  showFocusMenu, 
  hideFocusMenu, 
  updateMenuSelection,
  dimFocusMenu,
  undimFocusMenu,
  updateControlsGuide 
} from '../ui/focus-menu.js';
import { 
  setFocusMenuActive, 
  clearFocusMenuState,
  setWidgetActive 
} from './state.js';

// Initialize body class based on feature flag
const initialMode = isFeatureEnabled('ENHANCED_FOCUS_MODE');
if (!initialMode) {
  document.body.classList.add('legacy-focus');
  console.log('📊 Initialized with LEGACY focus mode');
} else {
  console.log('🚀 Initialized with ENHANCED focus mode');
}

// ---------------------
// TIMEOUT MANAGEMENT
// ---------------------

let highlightTimer = null;
let isHighlightVisible = true;

const TIMEOUT_SELECTION = 20000; // 20 seconds for selection mode
const TIMEOUT_FOCUS = 60000;     // 60 seconds for focus mode

function startHighlightTimer() {
  clearHighlightTimer();
  
  const timeout = state.focusedWidget ? TIMEOUT_FOCUS : TIMEOUT_SELECTION;
  
  highlightTimer = setTimeout(() => {
    hideHighlights();
  }, timeout);
}

function clearHighlightTimer() {
  if (highlightTimer) {
    clearTimeout(highlightTimer);
    highlightTimer = null;
  }
}

function hideHighlights() {
  isHighlightVisible = false;
  document.body.classList.add('highlights-hidden');
  
  // If a widget was focused and timed out, send escape command first then clear the selection
  if (state.focusedWidget) {
    // IMPORTANT: Save widget reference before it's cleared
    const widgetToCleanup = state.focusedWidget;
    
    // Send escape to widget before defocusing so it can clean up (same as handleBack)
    const iframe = widgetToCleanup.querySelector("iframe");
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage({ action: "escape" }, "*");
        console.log("✓ Sent 'escape' to widget due to timeout before defocusing");
      } catch (error) {
        console.warn("Failed to send escape to widget on timeout:", error);
      }
    }
    
    // Clean up centering BEFORE clearing selectedCell
    removeCenteringTransform(widgetToCleanup);
    
    // Small delay to let widget process the escape, then defocus (same pattern as handleBack)
    setTimeout(() => {
      setFocusedWidget(null);
      hideFocusOverlay();  // NEW: Hide overlay when timeout clears selection
      console.log(`Focused widget timed out - cleared selection after escape command`);
    }, 10);
  }
  
  // If sidebar is highlighted, close it entirely
  if (state.focus.type === "menu") {
    elements.sidebar.classList.remove("expanded");
    console.log(`Navigation highlights hidden and sidebar closed after timeout`);
  } else {
    console.log(`Navigation highlights hidden after timeout`);
  }
}

function showHighlights() {
  isHighlightVisible = true;
  document.body.classList.remove('highlights-hidden');
  startHighlightTimer();
  console.log(`Navigation highlights shown, timer started`);
}

function resetHighlightTimer() {
  if (!isHighlightVisible) {
    showHighlights();
  } else {
    startHighlightTimer();
  }
}

// ---------------------
// FOCUS OVERLAY MANAGEMENT
// ---------------------

function showFocusOverlay() {
  // Check current state dynamically (in case it was toggled in settings)
  const hasLegacyClass = document.body.classList.contains('legacy-focus');
  const isEnhancedMode = !hasLegacyClass;
  
  console.log(`🔍 Overlay check: hasLegacyClass=${hasLegacyClass}, isEnhancedMode=${isEnhancedMode}`);
  
  if (!isEnhancedMode) {
    console.log('⏭️ Skipping overlay show - legacy mode active');
    return;
  }
  
  const overlay = document.getElementById('focus-overlay');
  if (overlay) {
    overlay.classList.add('visible');
    console.log('✓ Focus overlay shown (enhanced mode)');
  } else {
    console.error('❌ Focus overlay element not found!');
  }
  
  // Center the focused widget
  if (state.focusedWidget) {
    // Small delay to ensure overlay is visible before centering
    setTimeout(() => {
      // NEW: Check if widget has focus menu BEFORE centering
      const widgetId = getWidgetIdFromElement(state.focusedWidget);
      const hasFocusMenu = hasWidgetMenu(widgetId);
      
      if (hasFocusMenu) {
        const menuConfig = getWidgetMenuConfig(widgetId);
        
        // WIDGET-FIRST WITH VISIBLE MENU: Show menu immediately but widget is active
        // Widget starts in ACTIVE mode (larger, ready for input) with menu visible
        // User can navigate widget or use LEFT to focus menu
        setFocusMenuActive(widgetId, menuConfig);
        
        // Start in WIDGET mode (not menu mode) - widget receives input
        setWidgetActive(true);
        
        // Show menu immediately (visible but not focused)
        showFocusMenu(state.focusedWidget, menuConfig);
        
        // Center the widget (menu will move with it)
        centerFocusedWidget(state.focusedWidget);
        
        // Add widget-active class for larger scale
        state.focusedWidget.classList.add('widget-active');
        
        // Apply larger scale (1.08) for active state
        const currentTransform = state.focusedWidget.style.transform;
        if (currentTransform && currentTransform.includes('translate')) {
          const translateMatch = currentTransform.match(/translate\(([^)]+)\)/);
          if (translateMatch) {
            const newTransform = `${translateMatch[0]} scale(1.08)`;
            state.focusedWidget.style.transform = newTransform;
          }
        }
        
        // Dim menu to show it's not focused (widget is focused)
        dimFocusMenu();
        
        // Send ACTIVE message to widget (widget is ready for input)
        setTimeout(() => {
          sendToWidget({ action: 'enter-focus' });
          sendToWidget({ action: 'enter-active' });
          console.log('📋 Widget entered ACTIVE mode with menu visible (dimmed)');
        }, 450);
        
        console.log('✓ Widget-first with visible menu - widget is ACTIVE, menu is visible but dimmed');
      } else {
        // No menu - center and send BOTH messages
        centerFocusedWidget(state.focusedWidget);
        
        // First: Widget enters FOCUSED state (centered, has attention)
        sendToWidget({ action: 'enter-focus' });
        
        // Then immediately: Widget enters ACTIVE state (can receive commands)
        // No delay needed - widgets without menus auto-activate
        sendToWidget({ action: 'enter-active' });
        
        console.log('✓ Widget auto-entered ACTIVE (no menu)');
      }
    }, 50);
  }
}

function hideFocusOverlay() {
  // IMPORTANT: Save widget reference BEFORE it might be cleared
  const widgetToCleanup = state.focusedWidget;
  
  const overlay = document.getElementById('focus-overlay');
  if (overlay) {
    overlay.classList.remove('visible');
    console.log('✓ Focus overlay hidden');
  }
  
  // Remove widget centering transform (using saved reference)
  if (widgetToCleanup) {
    removeCenteringTransform(widgetToCleanup);
  }
  
  // NEW: Clean up focus menu
  if (state.focusMenuState.active) {
    hideFocusMenu();
    clearFocusMenuState();
    console.log('✓ Focus menu cleaned up');
  }
}

// ---------------------
// WIDGET CENTERING
// ---------------------

/**
 * Center a focused widget on screen with smooth transform
 * Calculates viewport center and applies translate transform
 * If widget has a focus menu, shifts widget right to balance the menu on the left
 * Also applies the same transform to the menu so they move together
 */
function centerFocusedWidget(widgetElement) {
  if (!widgetElement) {
    console.error('🔴 centerFocusedWidget: No widget element provided');
    return;
  }
  
  // Check if widget has no-center flag - if so, skip centering
  if (widgetElement.dataset.noCenter === "true") {
    console.log('⏭️ Widget has no-center flag, skipping centering');
    return;
  }
  
  console.log('🎯 === CENTER WIDGET DEBUG START ===');
  console.log('Widget element:', widgetElement);
  console.log('Widget classes:', widgetElement.className);
  console.log('Widget data-row:', widgetElement.dataset.row);
  console.log('Widget data-col:', widgetElement.dataset.col);
  
  // Get widget's current position and size
  const widgetRect = widgetElement.getBoundingClientRect();
  console.log('Widget rect:', {
    top: widgetRect.top,
    left: widgetRect.left,
    right: widgetRect.right,
    bottom: widgetRect.bottom,
    width: widgetRect.width,
    height: widgetRect.height
  });
  
  // Get current transform before we change it
  const currentTransform = window.getComputedStyle(widgetElement).transform;
  console.log('Current transform:', currentTransform);
  
  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  console.log('Viewport:', { width: viewportWidth, height: viewportHeight });
  
  // Check if widget has focus menu
  const widgetId = getWidgetIdFromElement(widgetElement);
  const hasFocusMenu = hasWidgetMenu(widgetId);
  
  // If widget has focus menu, offset the center point to account for menu width
  const menuWidth = 200; // Match focus-menu.css
  const menuGap = 20;    // Match focus-menu.js
  const menuOffset = hasFocusMenu ? (menuWidth + menuGap) / 2 : 0;
  
  // Calculate center of viewport (with menu offset)
  const viewportCenterX = (viewportWidth / 2) + menuOffset;
  const viewportCenterY = viewportHeight / 2;
  console.log('Viewport center:', { 
    x: viewportCenterX, 
    y: viewportCenterY,
    menuOffset,
    hasFocusMenu 
  });
  
  // Calculate widget's current center
  const widgetCenterX = widgetRect.left + (widgetRect.width / 2);
  const widgetCenterY = widgetRect.top + (widgetRect.height / 2);
  console.log('Widget center:', { x: widgetCenterX, y: widgetCenterY });
  
  // Calculate how much to move widget to center it
  const translateX = viewportCenterX - widgetCenterX;
  const translateY = viewportCenterY - widgetCenterY;
  console.log('Translation needed:', { x: translateX, y: translateY });
  
  // Apply centering transform to widget
  widgetElement.classList.add('centered');
  const newTransform = `translate(${translateX}px, ${translateY}px) scale(1.05)`;
  widgetElement.style.transform = newTransform;
  console.log('Applied transform:', newTransform);
  
  // NEW: If menu exists, apply the same transform to it (without scale)
  if (hasFocusMenu) {
    const menu = document.getElementById('widget-focus-menu');
    if (menu) {
      // Menu moves with the widget but doesn't scale
      menu.style.transform = `translate(${translateX}px, ${translateY}px)`;
      console.log('✓ Applied same transform to menu (no scale)');
    }
  }
  
  // Verify it was applied
  setTimeout(() => {
    const verifyTransform = window.getComputedStyle(widgetElement).transform;
    console.log('Verified transform:', verifyTransform);
    console.log('Widget position after:', widgetElement.getBoundingClientRect());
  }, 100);
  
  console.log('✓ Widget centered at viewport center (with menu offset)');
  console.log('🎯 === CENTER WIDGET DEBUG END ===');
}

/**
 * Remove centering transform from widget
 * Returns widget to its grid position
 */
function removeCenteringTransform(widgetElement) {
  if (!widgetElement) {
    console.error('🔴 removeCenteringTransform: No widget element provided');
    return;
  }
  
  console.log('🔙 === REMOVE CENTERING DEBUG START ===');
  console.log('Called from:', new Error().stack);
  console.log('Widget element:', widgetElement);
  console.log('Widget classes before:', widgetElement.className);
  console.log('Current transform:', window.getComputedStyle(widgetElement).transform);
  console.log('Widget position before:', widgetElement.getBoundingClientRect());
  
  // Remove both centering and widget-active classes
  widgetElement.classList.remove('centered');
  widgetElement.classList.remove('widget-active');
  widgetElement.style.transform = ''; // Remove inline style, let CSS take over
  
  console.log('Widget classes after:', widgetElement.className);
  console.log('Inline transform removed, CSS will apply scale(1.05) from .focused class');
  
  // Verify it was applied
  setTimeout(() => {
    console.log('Verified transform:', window.getComputedStyle(widgetElement).transform);
    console.log('Widget position after:', widgetElement.getBoundingClientRect());
  }, 100);
  
  console.log('✓ Widget centering removed, returned to grid position');
  console.log('🔙 === REMOVE CENTERING DEBUG END ===');
}

// ---------------------
// FOCUS MANAGEMENT
// ---------------------

export function updateFocus() {
  if (state.confirmDialog || state.isAsleep) return; // Don't update focus when modal is open or asleep
  
  // NEW: Clean up any centered widgets that are losing focus
  document.querySelectorAll(".widget.centered").forEach(widget => {
    // If this widget is NOT the currently focused widget, clean it up
    if (widget !== state.focusedWidget) {
      console.log('🧼 Cleaning up stray centered widget:', widget.dataset.row, widget.dataset.col);
      widget.classList.remove('centered');
      widget.style.transform = ''; // Remove inline transform
    }
  });
  
  // clear all highlights
  document.querySelectorAll(".widget, .menu-item")
  .forEach(el => el.classList.remove("widget-selected", "widget-focused"));


  // grid focus
  if (state.focus.type === "grid") {
    const cell = document.querySelector(
      `.widget[data-row="${state.focus.row}"][data-col="${state.focus.col}"]`
    );
    if (cell) cell.classList.add("widget-selected");
  }

  // sidebar focus
  if (state.focus.type === "menu") {
    const items = elements.sidebar.querySelectorAll(".menu-item");
    if (items[state.focus.index]) items[state.focus.index].classList.add("widget-selected");
    
    // expand sidebar when menu is focused
    elements.sidebar.classList.add("expanded");
  } else {
    elements.sidebar.classList.remove("expanded");
  }
  
  // focused widget - check if focusedWidget exists before trying to use it
  if (state.focusedWidget && state.focusedWidget.classList) {
    state.focusedWidget.classList.add("widget-focused");
    showFocusOverlay();  // NEW: Show overlay when widget is focused
  } else {
    hideFocusOverlay();  // NEW: Hide overlay when no widget is focused
  }

  // Reset highlight timer when focus changes
  resetHighlightTimer();
}

// ---------------------
// WIDGET COMMUNICATION
// ---------------------

// Send D-pad action to focused widget
export function sendToWidget(action) {
  if (!state.focusedWidget) {
    console.log("No widget focused for command:", action);
    return;
  }
  
  // Add safety checks for focusedWidget
  if (typeof state.focusedWidget.querySelector !== 'function') {
    console.error("focusedWidget is not a DOM element:", state.focusedWidget);
    // Clear the invalid focusedWidget
    setFocusedWidget(null);
    hideFocusOverlay();  // NEW: Hide overlay when clearing invalid selection
    return;
  }
  
  const iframe = state.focusedWidget.querySelector("iframe");
  if (iframe && iframe.contentWindow) {
    try {
      // FIXED: Check if action is already an object with properties
      // If it's an object (like {action: 'menu-item-selected', itemId: 'weekly'}), send it directly
      // If it's a string (like 'left', 'right'), wrap it in {action: ...}
      const message = (typeof action === 'string') ? { action } : action;
      
      iframe.contentWindow.postMessage(message, "*");
      console.log(`✓ Sent command`, message, `to widget iframe`);
    } catch (error) {
      console.warn("Failed to send message to widget:", error);
    }
  } else {
    console.log(`No iframe found in selected cell for action:`, action);
  }
  
  // Reset timer when sending commands to widgets
  resetHighlightTimer();
}

// ---------------------
// NAVIGATION LOGIC
// ---------------------

export function moveFocus(dir) {
  if (state.isAsleep || state.confirmDialog) return; // Don't move focus when asleep or in modal
  
  // Reset timer on any navigation input - this should wake up highlights
  resetHighlightTimer();
  
  // DEBUG: Log focus menu state
  console.log('🎯 moveFocus:', dir, {
    focusedWidget: !!state.focusedWidget,
    menuActive: state.focusMenuState.active,
    inMenu: state.focusMenuState.inMenu,
    widgetId: state.focusMenuState.widgetId
  });
  
  // NEW: Handle focus menu navigation
  if (state.focusedWidget && state.focusMenuState.active) {
    console.log('📋 Focus menu is active, checking navigation...');
    
    // If in menu, handle menu navigation
    if (state.focusMenuState.inMenu) {
      console.log('📋 User is IN MENU, handling menu navigation');
      
      if (dir === 'up' || dir === 'down') {
        // Move selection in menu
        const newItem = moveMenuSelection(dir);
        if (newItem) {
          updateMenuSelection(state.focusMenuState.selectedIndex);
          
          // Notify widget of selection change (preview)
          sendToWidget({
            action: 'menu-selection-changed',
            selectedItem: newItem.id
          });
        }
        console.log('📋 Menu navigation handled, NOT sending to widget');
        return;
      }
      
      if (dir === 'right') {
        // Move from menu to widget content
        setWidgetActive(true);
        dimFocusMenu();
        
        // Add visual indicator that widget is now active AND update transform scale
        if (state.focusedWidget) {
          console.log('🔵 BEFORE adding widget-active:', state.focusedWidget.className);
          state.focusedWidget.classList.add('widget-active');
          
          // Update the transform to include larger scale while keeping translate
          const currentTransform = state.focusedWidget.style.transform;
          if (currentTransform && currentTransform.includes('translate')) {
            // Extract translate values and apply new scale
            const translateMatch = currentTransform.match(/translate\(([^)]+)\)/);
            if (translateMatch) {
              const newTransform = `${translateMatch[0]} scale(1.08)`;
              state.focusedWidget.style.transform = newTransform;
              console.log('🔵 Updated transform to:', newTransform);
            }
          }
          
          console.log('🔵 AFTER adding widget-active:', state.focusedWidget.className);
        }
        
        // Update controls guide to widget mode
        updateControlsGuide(false, {
          upDownLabel: 'Scroll Time',
          rightLabel: 'Next Week',
          leftLabel: 'Prev Week',
          selectLabel: ''
        });
        
        sendToWidget({ action: 'enter-active' });
        console.log('→ Moved from menu to widget content');
        return;
      }
      
      // Left while in menu does nothing (already at boundary)
      console.log('📋 Left pressed in menu, ignoring');
      return;
    } 
    // If in widget content and LEFT is pressed, focus the menu
    else {
      if (dir === 'left') {
        // FOCUS MENU when user presses LEFT from widget (menu already visible, just dimmed)
        setWidgetActive(false);
        
        // Un-dim the menu to show it's now focused
        undimFocusMenu();
        
        // Remove widget-active class and restore smaller scale
        if (state.focusedWidget) {
          console.log('🔵 BEFORE removing widget-active:', state.focusedWidget.className);
          state.focusedWidget.classList.remove('widget-active');
          
          // Restore scale back to 1.05 (focused state)
          const currentTransform = state.focusedWidget.style.transform;
          if (currentTransform && currentTransform.includes('translate')) {
            const translateMatch = currentTransform.match(/translate\(([^)]+)\)/);
            if (translateMatch) {
              const restoredTransform = `${translateMatch[0]} scale(1.05)`;
              state.focusedWidget.style.transform = restoredTransform;
              console.log('🔵 Restored transform to:', restoredTransform);
            }
          }
          
          console.log('🔵 AFTER removing widget-active:', state.focusedWidget.className);
        }
        
        // Update controls guide to menu mode
        updateControlsGuide(true);
        
        // Notify widget it exited active mode
        sendToWidget({ action: 'exit-active' });
        
        // Send menu-active to notify widget which item is selected
        const widgetId = getWidgetIdFromElement(state.focusedWidget);
        const menuConfig = getWidgetMenuConfig(widgetId);
        sendToWidget({
          action: 'menu-active',
          selectedItem: menuConfig.items[menuConfig.defaultIndex || 0].id
        });
        
        console.log('← Focused menu (un-dimmed) - moved from widget to menu');
        return;
      }
      
      // Other directions: send to widget
      console.log('📋 User is IN WIDGET, sending command to widget');
      sendToWidget(dir);
      return;
    }
  }
  
  // EXISTING: Regular widget focus without menu
  if (state.focusedWidget) {
    console.log('📋 No focus menu, sending command to widget');
    // Widget is focused — send input there
    sendToWidget(dir);
    return;
  }

  if (state.focus.type === "grid") {
    let { row, col } = state.focus;
    let newRow = row;
    let newCol = col;

    console.log(`BEFORE: ${dir} navigation from (${row},${col})`);

    if (dir === "left") {
      if (col === 1) {
        // Leaving grid → go to sidebar
        const sidebarOptions = [
          { id: "calendar", type: "main", label: "Calendar" },
          { id: "map", type: "main", label: "Location Map" },
          { id: "camera", type: "main", label: "Camera Feed" },
          { id: "reload", type: "system", label: "Reload" },
          { id: "sleep", type: "system", label: "Sleep" },
          { id: "settings", type: "system", label: "Settings" },
          { id: "exit", type: "system", label: "Exit" }
        ];
        const currentMainIndex = sidebarOptions.findIndex(item => item.id === state.currentMain);
        setFocus({ type: "menu", index: currentMainIndex >= 0 ? currentMainIndex : 0 });
        updateFocus(); // Call updateFocus here to apply the changes
        return;
      }
      newCol = col - 1;
      if (newCol < 1) newCol = 1; // Clamp to valid range
    }

    if (dir === "right") {
      newCol = col + 1;
      if (newCol > 2) newCol = 2; // Clamp to valid range
    }

    if (dir === "up") {
      newRow = row - 1;
      if (newRow < 1) newRow = 1; // Clamp to valid range
    }

    if (dir === "down") {
      newRow = row + 1;
      if (newRow > 3) newRow = 3; // Clamp to valid range
    }

    console.log(`AFTER: ${dir} navigation to (${newRow},${newCol})`);

    // Special handling for the main spanning widget (calendar at row 2-3, col 1)
    // Always treat the spanning widget as position (2,1) regardless of which half is selected
    if (newCol === 1 && (newRow === 2 || newRow === 3)) {
      newRow = 2; // Always use the top position of the spanning widget
    }

    // Always update focus to maintain highlighting
    setFocus({ type: "grid", row: newRow, col: newCol });
    
    // ALWAYS call updateFocus to ensure highlighting is maintained
    updateFocus();
    return; // Make sure we don't call updateFocus again at the end
  }

  if (state.focus.type === "menu") {
    const sidebarOptions = [
      { id: "calendar", type: "main", label: "Calendar" },
      { id: "map", type: "main", label: "Location Map" },
      { id: "camera", type: "main", label: "Camera Feed" },
      { id: "reload", type: "system", label: "Reload" },
      { id: "sleep", type: "system", label: "Sleep" },
      { id: "settings", type: "system", label: "Settings" },
      { id: "exit", type: "system", label: "Exit" }
    ];

    let { index } = state.focus;

    if (dir === "up") {
      index = Math.max(0, index - 1);
    }

    if (dir === "down") {
      index = Math.min(sidebarOptions.length - 1, index + 1);
    }

    if (dir === "right") {
      // Leave sidebar → go to grid
      setFocus({ type: "grid", row: 2, col: 1 });
      updateFocus(); // Call updateFocus here to apply the changes
      return;
    }

    setFocus({ type: "menu", index });
  }

  updateFocus();
}

// Handle Enter key for selection
export function handleEnter() {
  // Reset timer on Enter
  resetHighlightTimer();
  
  if (state.isAsleep || state.confirmDialog) return;
  
  // CRITICAL: If focus menu is active and we're in the menu, do NOT handle enter here
  // The enter key should ONLY send menu-item-selected to the widget, not trigger selection
  if (state.focusMenuState.active && state.focusMenuState.inMenu) {
    console.log('⚠️ handleEnter blocked - focus menu is active and in menu state');
    return;
  }

  if (state.focus.type === "grid") {
    // findWidget returns the widget config object, we need the actual DOM element
    const widgetConfig = findWidget(state.focus.row, state.focus.col);
    console.log(`Enter pressed on grid position (${state.focus.row},${state.focus.col}), found widget config:`, widgetConfig);
    
    if (widgetConfig) {
      // Find the actual DOM element using the grid position
      const widgetElement = document.querySelector(
        `.widget[data-row="${state.focus.row}"][data-col="${state.focus.col}"]`
      );
      console.log(`Found widget DOM element:`, widgetElement);
      
      if (widgetElement && widgetElement.classList) {
        setFocusedWidget(widgetElement);
        console.log(`Selected widget element:`, widgetElement);
        
        // ADDED: Send enter-focus message to the widget iframe
        const iframe = widgetElement.querySelector("iframe");
        if (iframe && iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({ action: "enter-focus" }, "*");
            console.log("✓ Sent 'enter-focus' message to widget iframe");
          } catch (error) {
            console.warn("Failed to send enter-focus message to widget:", error);
          }
        }
        
        updateFocus();
      } else {
        console.warn(`No valid widget DOM element found at position (${state.focus.row},${state.focus.col})`);
      }
    } else {
      console.warn(`No widget config found at position (${state.focus.row},${state.focus.col})`);
    }
  }

  if (state.focus.type === "menu") {
    const sidebarOptions = [
      { id: "calendar", type: "main", label: "Calendar" },
      { id: "map", type: "main", label: "Location Map" },
      { id: "camera", type: "main", label: "Camera Feed" },
      { id: "reload", type: "system", label: "Reload" },
      { id: "sleep", type: "system", label: "Sleep" },
      { id: "settings", type: "system", label: "Settings" },
      { id: "exit", type: "system", label: "Exit" }
    ];

    const selectedOption = sidebarOptions[state.focus.index];
    if (selectedOption && selectedOption.id) {
      handleMenuSelection(selectedOption.id);
    }
  }
}

// Handle Escape/Back key
export function handleBack() {
  console.log('🔙 handleBack called');
  console.log('  state.focusedWidget:', state.focusedWidget);
  console.log('  state.isAsleep:', state.isAsleep);
  console.log('  state.confirmDialog:', state.confirmDialog);
  
  if (state.isAsleep || state.confirmDialog) return;

  if (state.focusedWidget) {
    console.log('  ✓ Widget is focused, defocusing...');
    
    // NEW: Handle focus menu back navigation
    if (state.focusMenuState.active) {
      
      // If in widget content (menu visible but dimmed), focus menu on first ESC/BACK
      if (!state.focusMenuState.inMenu) {
        setWidgetActive(false);
        
        // Un-dim the menu to show it's now focused
        undimFocusMenu();
        
        // Remove visual indicator that widget was active AND restore scale
        if (state.focusedWidget) {
          console.log('🔵 BEFORE removing widget-active:', state.focusedWidget.className);
          state.focusedWidget.classList.remove('widget-active');
          
          // Restore scale back to 1.05 (focused state)
          const currentTransform = state.focusedWidget.style.transform;
          if (currentTransform && currentTransform.includes('translate')) {
            const translateMatch = currentTransform.match(/translate\(([^)]+)\)/);
            if (translateMatch) {
              const restoredTransform = `${translateMatch[0]} scale(1.05)`;
              state.focusedWidget.style.transform = restoredTransform;
              console.log('🔵 Restored transform to:', restoredTransform);
            }
          }
          
          console.log('🔵 AFTER removing widget-active:', state.focusedWidget.className);
        }
        
        // Update controls guide back to menu mode
        updateControlsGuide(true);
        
        sendToWidget({ action: 'exit-active' });
        
        // Send menu-active to notify widget which item is selected
        const widgetId = getWidgetIdFromElement(state.focusedWidget);
        const widgetMenuConfig = getWidgetMenuConfig(widgetId);
        sendToWidget({
          action: 'menu-active',
          selectedItem: widgetMenuConfig.items[widgetMenuConfig.defaultIndex || 0].id
        });
        
        console.log('← Focused menu (un-dimmed) from widget (ESC/BACK pressed)');
        return;
      }
      
      // If in menu, exit focus mode entirely
      if (state.focusMenuState.inMenu) {
        const widgetToCleanup = state.focusedWidget;
        
        const iframe = widgetToCleanup.querySelector("iframe");
        if (iframe && iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({ action: "exit-focus" }, "*");
            console.log("  ✓ Sent 'exit-focus' to widget");
          } catch (error) {
            console.warn("  ⚠️ Failed to send escape to widget:", error);
          }
        }
        
        console.log('  🔄 Removing widget centering...');
        removeCenteringTransform(widgetToCleanup);
        
        setTimeout(() => {
          setFocusedWidget(null);
          hideFocusOverlay(); // This will also clean up menu
          showHighlights();
          updateFocus();
          console.log('  ✅ Exited focus mode from menu');
        }, 10);
        return;
      }
    }
    
    // EXISTING: Regular widget (no menu) handling
    const widgetToCleanup = state.focusedWidget;
    
    // Send escape to widget before defocusing so it can clean up
    const iframe = widgetToCleanup.querySelector("iframe");
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage({ action: "escape" }, "*");
        console.log("  ✓ Sent 'escape' to widget");
      } catch (error) {
        console.warn("  ⚠️ Failed to send escape to widget:", error);
      }
    }
    
    // Clean up centering BEFORE clearing selectedCell
    console.log('  🔄 Removing widget centering...');
    removeCenteringTransform(widgetToCleanup);
    
    // Small delay to let widget process the escape, then defocus
    setTimeout(() => {
      console.log('  🔄 Clearing selection...');
      setFocusedWidget(null);
      console.log('    selectedCell is now:', state.focusedWidget);
      
      hideFocusOverlay();
      
      console.log('  🔄 Calling showHighlights...');
      showHighlights();
      
      console.log('  🔄 Calling updateFocus...');
      updateFocus();
      
      console.log('  ✅ handleBack complete');
    }, 10);
  } else if (state.focus.type === "grid" || state.focus.type === "menu") {
    console.log('  ℹ️ Not focused, hiding highlights');
    hideHighlights();
  }
}

function handleMenuSelection(optionId) {
  console.log(`Menu selection: ${optionId}`);
  
  switch(optionId) {
    case "calendar":
    case "map":
    case "camera":
      // These need to trigger the grid re-rendering with new main widget
      setCurrentMain(optionId);
      
      // Import and call the grid rendering functions
      import('../ui/grid.js').then(({ renderGrid, renderSidebar }) => {
        renderGrid();
        renderSidebar();
        
        // Close sidebar without setting grid focus (keeps dashboard clean)
        elements.sidebar.classList.remove("expanded");
        hideHighlights(); // Hide any highlights after switching
        
        console.log(`Switched main widget to: ${optionId}`);
      });
      break;
    case "reload":
      window.location.reload();
      break;
    case "sleep":
      // Import and trigger sleep mode - use correct function name
      import('../ui/modals.js').then(({ enterSleepMode }) => {
        enterSleepMode();
      }).catch(() => {
        console.log("Sleep function not available");
      });
      break;
    case "settings":
      // Import and open settings - use correct function name
      import('../settings/settings-main.js').then(({ showSettings }) => {
        showSettings();
      }).catch(() => {
        console.log("Settings function not available");
      });
      break;
    case "exit":
      // Import and show exit confirmation - use correct function name
      import('../ui/modals.js').then(({ showExitConfirmation }) => {
        showExitConfirmation();
      }).catch(() => {
        console.log("Exit confirmation not available");
      });
      break;
  }
}

// Open menu with current main widget selected
export function openMenuWithCurrentSelection() {
  if (state.isAsleep || state.confirmDialog || state.focusedWidget) return; // Don't open menu if widget is focused
  
  const sidebarOptions = [
    { id: "calendar", type: "main", label: "Calendar" },
    { id: "map", type: "main", label: "Location Map" },
    { id: "camera", type: "main", label: "Camera Feed" },
    { id: "reload", type: "system", label: "Reload" },
    { id: "sleep", type: "system", label: "Sleep" },
    { id: "settings", type: "system", label: "Settings" },
    { id: "exit", type: "system", label: "Exit" }
  ];
  
  // Find the index of the currently active main widget
  const currentMainIndex = sidebarOptions.findIndex(item => item.id === state.currentMain);
  setFocus({ type: "menu", index: currentMainIndex >= 0 ? currentMainIndex : 0 });
  elements.sidebar.classList.add("expanded");
  updateFocus();
}

// Initialize highlight system
export function initializeHighlightTimeout() {
  // Start with highlights hidden (clean dashboard on startup)
  isHighlightVisible = false;
  document.body.classList.add('highlights-hidden');
  
  // DON'T call resetHighlightTimer here - let the first navigation input show highlights
  
  console.log("Navigation highlight timeout system initialized - starting with hidden highlights");
}

// ---------------------
// HELPER FUNCTIONS
// ---------------------

/**
 * Get widget ID from DOM element
 * Derives widget type from the loaded URL to support swappable grid positions
 * @param {HTMLElement} element - Widget DOM element
 * @returns {string|null} Widget ID or null if not found
 */
function getWidgetIdFromElement(element) {
  // Try data-widget-id attribute first (future enhancement)
  if (element.dataset.widgetId) {
    return element.dataset.widgetId;
  }
  
  // Find widget config by grid position
  const row = element.dataset.row;
  const col = element.dataset.col;
  
  if (!row || !col) {
    console.warn('getWidgetIdFromElement: Missing row/col data attributes');
    return null;
  }
  
  const widgetConfig = findWidget(parseInt(row), parseInt(col));
  if (!widgetConfig) {
    console.warn(`getWidgetIdFromElement: No widget config found at (${row},${col})`);
    return null;
  }
  
  // Extract widget name from URL path
  // URL format: "/widgets/{name}/{file}.html"
  // Examples: "/widgets/dcal/calendar_dcal.html" → "dcal"
  //           "/widgets/photos/photos.html" → "photos"
  if (widgetConfig.url) {
    const urlMatch = widgetConfig.url.match(/\/widgets\/([^\/]+)\//); 
    if (urlMatch && urlMatch[1]) {
      console.log(`✓ Resolved widget ID from URL: ${urlMatch[1]} (grid position: ${widgetConfig.id})`);
      return urlMatch[1];
    }
  }
  
  // Fallback to grid position ID if URL parsing fails
  console.log(`⚠️ Using fallback grid ID: ${widgetConfig.id}`);
  return widgetConfig.id;
}

// ---------------------
// MESSAGE LISTENERS
// ---------------------

// Listen for widget configuration and control messages
window.addEventListener('message', (event) => {
  // Handle widget configuration messages
  if (event.data && event.data.type === 'widget-config') {
    const { widget, focusMenu } = event.data;
    
    if (focusMenu && focusMenu.enabled) {
      registerWidgetMenu(widget, focusMenu);
      console.log('📋 Registered widget menu config', { widget, itemCount: focusMenu.items?.length });
      
      // NEW: If this widget's menu is currently visible, refresh it with updated config
      if (state.focusMenuState.active && state.focusMenuState.widgetId === widget && state.focusedWidget) {
        console.log('🔄 Refreshing visible menu with updated config');
        
        // Update state with new config
        state.focusMenuState.menuConfig = focusMenu;
        
        // Rebuild the menu UI
        showFocusMenu(state.focusedWidget, focusMenu);
        
        // Restore menu selection to the updated item
        updateMenuSelection(state.focusMenuState.selectedIndex);
        
        console.log('✓ Menu refreshed with new active view');
      }
    }
  }
  
  // Handle widget requesting return to menu
  if (event.data && event.data.type === 'return-to-menu') {
    // CRITICAL: Do EXACTLY what escape/back does when returning from widget to menu
    if (state.focusMenuState.active && !state.focusMenuState.inMenu) {
      setWidgetActive(false);
      undimFocusMenu();
      
      // Remove visual indicator that widget was active AND restore scale
      if (state.focusedWidget) {
        console.log('🔵 [return-to-menu] BEFORE removing widget-active:', state.focusedWidget.className);
        state.focusedWidget.classList.remove('widget-active');
        
        // Restore scale back to 1.05 (focused state)
        const currentTransform = state.focusedWidget.style.transform;
        if (currentTransform && currentTransform.includes('translate')) {
          const translateMatch = currentTransform.match(/translate\(([^)]+)\)/);
          if (translateMatch) {
            const restoredTransform = `${translateMatch[0]} scale(1.05)`;
            state.focusedWidget.style.transform = restoredTransform;
            console.log('🔵 [return-to-menu] Restored transform to:', restoredTransform);
          }
        }
        
        console.log('🔵 [return-to-menu] AFTER removing widget-active:', state.focusedWidget.className);
      }
      
      // Update controls guide back to menu mode
      updateControlsGuide(true);
      
      sendToWidget({ action: 'exit-active' });
      console.log('← Widget requested return to menu');
    }
  }
});