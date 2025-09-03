// index.js

// Define the grid layout (null = empty slot)
const layout = [
  ["calendar", "agenda", null, null],
  ["photos", "main", null, null],
  ["news", "main", null, null],
  [null, null, null, null]
];

// Map widget types to renderers (for now, simple placeholders)
const widgetRenderers = {
  calendar: () => "📅 Calendar",
  agenda: () => "📝 Agenda",
  photos: () => "🖼️ Photos",
  news: () => "📰 News",
  main: () => "🌟 Main Widget"
};

const gridEl = document.getElementById("grid");
const sidebarEl = document.getElementById("sidebar");

let focus = { type: "grid", row: 0, col: 0 }; // start in top-left
let selectedCell = null;

// Render grid
function renderGrid() {
  gridEl.innerHTML = "";
  layout.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell) {
        const div = document.createElement("div");
        div.classList.add("widget");
        if (cell === "main") {
          div.style.gridRow = "2 / span 2";
          div.style.gridColumn = "2";
        }
        div.dataset.row = r;
        div.dataset.col = c;
        div.textContent = widgetRenderers[cell]();
        gridEl.appendChild(div);
      }
    });
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

// Handle navigation
function moveFocus(dir) {
  if (focus.type === "grid") {
    let { row, col } = focus;

    if (dir === "left") {
      if (col === 0) {
        focus = { type: "menu", index: 0 };
        return;
      }
      col--;
    }
    if (dir === "right") col++;
    if (dir === "up") row--;
    if (dir === "down") row++;

    if (layout[row] && layout[row][col]) {
      focus = { type: "grid", row, col };
    }
  } else if (focus.type === "menu") {
    if (dir === "up" && focus.index > 0) focus.index--;
    if (dir === "down" && focus.index < sidebarEl.children.length - 1)
      focus.index++;
    if (dir === "right") {
      focus = { type: "grid", row: 0, col: 0 };
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
