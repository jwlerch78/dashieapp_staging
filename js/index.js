// index.js

const rows = 4;
const cols = 4;

let selectedCell = "cell-1-1";
let focusedCell = null;
let menuOpen = false;
let settingsOpen = false;

// D-pad keycodes: up=38, down=40, left=37, right=39, enter=13, back=27
document.addEventListener("keydown", (e) => {
  if(menuOpen) handleMenuInput(e);
  else if(settingsOpen) handleSettingsInput(e);
  else if(focusedCell) handleFocusedWidget(e);
  else handleGridNavigation(e);
  e.preventDefault();
});

function handleGridNavigation(e) {
  const current = document.getElementById(selectedCell);
  let row = parseInt(current.dataset.row);
  let col = parseInt(current.dataset.col);

  switch(e.keyCode) {
    case 38: row = Math.max(1, row - 1); break;
    case 40: 
      if(row < rows) row++; 
      else { openBottomMenu(); return; } 
      break;
    case 37: col = Math.max(1, col - 1); break;
    case 39: col = Math.min(cols, col + 1); break;
    case 13: focusCell(selectedCell); return;
    case 27: /* nothing when no focus */ return;
  }

  const newCell = document.querySelector(`.grid-cell[data-row='${row}'][data-col='${col}']`);
  if(newCell && newCell.textContent.trim() !== "") {
    selectCell(newCell.id);
  }
}

function selectCell(id) {
  if(selectedCell) document.getElementById(selectedCell).classList.remove("selected");
  selectedCell = id;
  document.getElementById(selectedCell).classList.add("selected");
}

function focusCell(id) {
  if(focusedCell) document.getElementById(focusedCell).classList.remove("focused");
  focusedCell = id;
  document.getElementById(focusedCell).classList.add("focused");
}

function unfocusCell() {
  if(focusedCell) document.getElementById(focusedCell).classList.remove("focused");
  focusedCell = null;
}

function handleFocusedWidget(e) {
  switch(e.keyCode) {
    case 27: unfocusCell(); break; // back
    default:
      console.log("Send to widget", focusedCell, e.keyCode);
  }
}

function openBottomMenu() {
  menuOpen = true;
  document.getElementById("bottom-menu").style.display = "flex";
}

function handleMenuInput(e) {
  switch(e.keyCode) {
    case 27: closeBottomMenu(); break;
    case 13: selectMenuItem(); break;
    default: break;
  }
}

function closeBottomMenu() {
  menuOpen = false;
  document.getElementById("bottom-menu").style.display = "none";
}

function selectMenuItem() {
  console.log("Menu action clicked (implement later)");
}

// Initialize
selectCell(selectedCell);
