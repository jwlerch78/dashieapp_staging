// Explicit widget layout
const widgets = [
  { id: "calendar", row: 1, col: 1, rowSpan: 1, colSpan: 1 },
  { id: "agenda",   row: 1, col: 2, rowSpan: 1, colSpan: 1 },
  { id: "photos",   row: 2, col: 1, rowSpan: 1, colSpan: 1 },
  { id: "news",     row: 3, col: 1, rowSpan: 1, colSpan: 1 },
  { id: "main",     row: 2, col: 2, rowSpan: 2, colSpan: 1 }
];

// Map widget IDs to renderers
const widgetRenderers = {
  calendar: () => "📅 Calendar",
  agenda: () => "📝 Agenda",
  photos: () => "🖼️ Photos",
  news: () => "📰 News",
  main: () => "🌟 Main Widget"
};

const gridEl = document.getElementById("grid");
const sidebarEl = document.getElementById("sidebar");

let focus = { type: "grid", row: 1, col: 1 };
let selectedCell = null;

// Render grid
function renderGrid() {
  gridEl.innerHTML = "";
  widgets.forEach(w => {
    const div = document.createElement("div");
    div.classList.add("widget");
    div.dataset.row = w.row;
    div.dataset.col = w.col;
    div.style.gridRow = `${w.row} / span ${w.rowSpan}`;
    div.style.gridColumn = `${w.col} / span ${w.colSpan}`;
    div.textContent = widgetRenderers[w.id]();
    gridEl.appendChild(div);
  });
}

// Update highlighting
function updateFocus() {
  document.querySelectorAll(".widget, .menu-item")
    .forEach(el => el.classList.remove("selected", "focused"));

  if (focus.type === "grid") {
    const cell = document.querySelector(
      `.widget[data-row="${focus.row}"][data-col="${focus.col}"]`
    );
    if (cell) cell.classList.add("selected");
  } else if (focus.type === "menu") {
    const items = sidebarEl.querySelectorAll(".menu-item");
    items[focus.index].classList.add("selected");
  }

  if (selectedCell) {
    selectedCell.classList.add("focused");
  }
}

// Navigation matrix helper
function findWidget(row, col) {
  return widgets.find(w => w.row === row && w.col === col);
}

// Handle navigation
function moveFocus(dir) {
  if (focus.type === "grid") {
    let { row, col } = focus;

    if (dir === "left") {
      if (col === 1) {
        focus = { type: "menu", index: 0 };
        return;
      }
      col--;
    }
    if (dir === "right") col++;
    if (dir === "up") row--;
    if (dir === "down") row++;

    if (findWidget(row, col)) {
      focus = { type: "grid", row, col };
    }
  } else if (focus.type === "menu") {
    if (dir === "up" && focus.index > 0) focus.index--;
    if (dir === "down" && focus.index < sidebarEl.children.length - 1)
      focus.index++;
    if (dir === "right") {
      focus = { type: "grid", row: 1, col: 1 };
    }
  }
}

// Handle select/deselect
function handleEnter() {
  if (focus.type === "grid") {
    const el = document.querySelector(
      `.widget[data-row="${focus.row}"][data-col="${focus.col}"]`
    );
    if (selectedCell === el) {
      selectedCell = null;
    } else {
      selectedCell = el;
    }
  } else if (focus.type === "menu") {
    alert(`Menu option: ${sidebarEl.children[focus.index].dataset.menu}`);
  }
}

function handleBack() {
  selectedCell = null;
}

// Key handling
document.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") moveFocus("left");
  if (e.key === "ArrowRight") moveFocus("right");
  if (e.key === "ArrowUp") moveFocus("up");
  if (e.key === "ArrowDown") moveFocus("down");
  if (e.key === "Enter") handleEnter();
  if (e.key === "Backspace") handleBack();

  updateFocus();
});

// Init
renderGrid();
updateFocus();
