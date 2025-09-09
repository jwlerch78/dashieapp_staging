// js/ui/modals.js - Modal Dialog Management

import { state, setSleepMode, setConfirmDialog } from '../core/state.js';

// ---------------------
// SLEEP MODE
// ---------------------

export function enterSleepMode() {
  setSleepMode(true);
  
  // Create sleep overlay - pure black screen with no content
  const sleepOverlay = document.createElement("div");
  sleepOverlay.id = "sleep-overlay";
  sleepOverlay.className = "sleep-overlay";
  
  document.body.appendChild(sleepOverlay);
  
  // Fade in using CSS class
  setTimeout(() => {
    sleepOverlay.classList.add("visible");
  }, 10);
  
  // Add wake up listeners
  sleepOverlay.addEventListener("click", wakeUp);
}

export function wakeUp() {
  if (!state.isAsleep) return;
  
  setSleepMode(false);
  const sleepOverlay = document.getElementById("sleep-overlay");
  
  if (sleepOverlay) {
    sleepOverlay.classList.remove("visible");
    setTimeout(() => {
      sleepOverlay.remove();
    }, 500);
  }
}

// ---------------------
// EXIT CONFIRMATION
// ---------------------

export function showExitConfirmation() {
  if (state.confirmDialog) return; // Already showing
  
  // Create modal backdrop
  const backdrop = document.createElement("div");
  backdrop.id = "exit-backdrop";
  backdrop.className = "modal-backdrop";
  
  // Create confirmation dialog
  const dialog = document.createElement("div");
  dialog.id = "exit-dialog";
  dialog.className = "exit-dialog";
  
  // Dialog content - clean HTML without inline styles
  dialog.innerHTML = `
    <h2>Are you sure you want to exit?</h2>
    <div class="exit-buttons">
      <button class="exit-button" id="exit-yes">Yes</button>
      <button class="exit-button" id="exit-no">No</button>
    </div>
  `;
  
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);
  
  // Set up confirmation state
  const confirmDialog = {
    element: backdrop,
    selectedButton: "no", // default to "no"
    buttons: {
      yes: dialog.querySelector("#exit-yes"),
      no: dialog.querySelector("#exit-no")
    }
  };
  
  setConfirmDialog(confirmDialog);
  
  // Update button highlighting
  updateExitButtonHighlight();
  
  // Add event listeners
  confirmDialog.buttons.yes.addEventListener("click", () => handleExitChoice("yes"));
  confirmDialog.buttons.no.addEventListener("click", () => handleExitChoice("no"));
  
  // Add hover effects for mouse interaction
  Object.entries(confirmDialog.buttons).forEach(([key, button]) => {
    button.addEventListener("mouseenter", () => {
      state.confirmDialog.selectedButton = key;
      updateExitButtonHighlight();
    });
    
    button.addEventListener("mouseleave", () => {
      // Keep current selection, just update highlight
      updateExitButtonHighlight();
    });
  });
  
  // Click backdrop to cancel
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) {
      handleExitChoice("no");
    }
  });
}

export function updateExitButtonHighlight() {
  if (!state.confirmDialog) return;
  
  // Clear all highlights using CSS classes
  Object.values(state.confirmDialog.buttons).forEach(btn => {
    btn.classList.remove("selected", "focused");
  });
  
  // Highlight selected button using CSS class
  const selectedBtn = state.confirmDialog.buttons[state.confirmDialog.selectedButton];
  selectedBtn.classList.add("selected");
}

export function moveExitFocus(direction) {
  if (!state.confirmDialog) return;
  
  if (direction === "left" || direction === "right") {
    state.confirmDialog.selectedButton = state.confirmDialog.selectedButton === "yes" ? "no" : "yes";
    updateExitButtonHighlight();
  }
}

export function handleExitChoice(choice) {
  if (!state.confirmDialog) return;
  
  if (choice === "yes") {
    // In a real app, this would close the application
    alert("Exiting Dashie...");
    // For demo purposes, we'll just close the dialog
  }
  
  // Remove dialog
  state.confirmDialog.element.remove();
  setConfirmDialog(null);
}
