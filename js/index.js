// ---------------------
// CONFIGURATION
// ---------------------

let widgets = [
  { id: "clock", row: 1, col: 1, rowSpan: 1, colSpan: 1, label: "⏰ Clock" },
  { id: "agenda", row: 2, col: 1, rowSpan: 1, colSpan: 1, label: "📝 Agenda" },
  { id: "photos", row: 3, col: 1, rowSpan: 1, colSpan: 1, label: "🖼️ Photos" },
  { id: "map", row: 1, col: 2, rowSpan: 1, colSpan: 1, label: "🗺️ Map" },
  { id: "main", row: 2, col: 2, rowSpan: 2, colSpan: 1, label: "🌟 Main Widget" }
];

const sidebarOptions = [
  { id: "calendar", icon: "📅" },
  { id: "map", icon: "🗺️" },
  { id: "camera", icon: "📷" },
  { id: "settings", icon: "⚙️" }
];

const sidebarMapping = {
  calendar: "📅 Calendar",
  map: "🗺️ Map",
  camera: "📷 Camera"
};

let currentMain = "calendar";

// ---------------------
// STATE
// ---------------------
const gridEl = document.getElementById("grid");
const sidebarEl = document.getElementById("sidebar");

let focus = { type: "grid", row: 1, col: 1 };
let selectedCell = null;

// Settings overlay
let settingsVisible = false;

// ---------------------
// RENDERING
// ---------------------

function renderGrid() {
  gridEl.innerHTML = "";
  widgets.forEach(w => {
    const div = document.createElement("div");
    div.classList.add("widget");
    div.dataset.row = w.row;
    div.dataset.col = w.col;
    div.style.gridRow = `${w.row} / span ${w.rowSpan}`;
    div.style.gridColumn = `${w.col} / span ${w.colSpan}`;

    div.textContent = w.id === "main" ? sidebarMapping[currentMain] : w.label;

    gridEl.appendChild(div);
  });
}

function renderSidebar() {
  sidebarEl.innerHTML = "";
  sidebarOptions.forEach((item, index) => {
    const div = document.createElement("div");
    div.classList.add("menu-item");
    div.dataset.menu = item.id;
    div.textContent = item.icon;

    // Mouse / touch support
    div.addEventListener("mouseover", () => {
      focus = { type: "menu", index };
      updateFocus();
    });
    div.addEventListener("click", () => {
      focus = { type: "menu", index };
      handleEnter();
    });

    sidebarEl.appendChild(div);
  });
}

function renderSettingsOverlay() {
  let overlay = document.getElementById("settingsOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "settingsOverlay";
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "60px";
    overlay.style.width = "180px";
    overlay.style.height = "100%";
    overlay.style.background = "rgba(0,0,0,0.7)";
    overlay.style.display = "none";
    overlay.style.flexDirection = "column";
    overlay.style.padding = "10px";
    overlay.style.zIndex = "100";
    document.body.appendChild(overlay);

    const refreshBtn = document.createElement("div");
    refreshBtn.textContent = "🔄 Refresh Dashie";
    refreshBtn.classList.add("settings-item");
    refreshBtn.addEventListener("click", () => window.location.reload());

    const exitBtn = document.createElement("div");
    exitBtn.textContent = "❌ Exit Dashie";
    exitBtn.classList.add("settings-item");
    exitBtn.addEventListener("click", () => alert("Exit Dashie triggered"));

    overlay.appendChild(refreshBtn);
    overlay.appendChild(exitBtn);
  }

  overlay.style.display = settingsVisible ? "flex" : "none";
}

// ---------------------
// FOCUS & HIGHLIGHTS
// ---------------------

function updateFocus() {
  document.querySelectorAll(".widget, .menu-item").forEach(el => {
    el.classList.remove("selected", "focused", "active");
  });

  // Grid focus
  if (focus.type === "grid") {
    const cell = document.querySelector(
      `.widget[data-row="${focus.row}"][data-col="${focus.col}"]`
    );
    if (cell) cell.classList.add("selected");
  }

  // Sidebar focus
  if (focus.type === "menu") {
    const items = sidebarEl.querySelectorAll(".menu-item");
    if (items[focus.index]) items[focus.index].classList.add("selected");
  }

  // Focused widget
  if (selectedCell) selectedCell.classList.add("focused");

  // Active main widget highlight on sidebar
  sidebarEl.querySelectorAll(".menu-item").forEach(el => {
    if (el.dataset.menu === currentMain) el.classList.add("active");
  });

  renderSettingsOverlay();
}

// ---------------------
// NAVIGATION HELPERS
// ---------------------

function findWidget(row, col) {
  return widgets.find(w => w.row === row && w.col === col);
}

function moveFocus(dir) {
  if (selectedCell) {
    return; // focused widget handles D-pad
  }

  if (focus.type === "grid") {
    let { row, col } = focus;
    if (dir === "left") col = col > 1 ? col - 1 : 1;
    if (dir === "right") col++;
    if (dir === "up") row = row > 1 ? row - 1 : 1;
    if (dir === "down") row++;

    if (findWidget(row, col)) focus = { type: "grid", row, col };
  } else if (focus.type === "menu") {
    if (dir === "up" && focus.index > 0) focus.index--;
    if (dir === "down" && focus.index < sidebarEl.children.length - 1)
      focus.index++;
    if (dir === "right") focus = { type: "grid", row: 1, col: 1 };
  }

  updateFocus();
}

// ---------------------
// ENTER / BACK
// ---------------------

function handleEnter() {
  if (focus.type === "grid") {
    const el = document.querySelector(
      `.widget[data-row="${focus.row}"][data-col="${focus.col}"]`
    );
    if (selectedCell === el) selectedCell = null;
    else selectedCell = el;
  } else if (focus.type === "menu") {
    const menuItem = sidebarEl.children[focus.index];
    const menuKey = menuItem.dataset.menu;
    if (menuKey === "settings") {
      settingsVisible = !settingsVisible;
    } else {
      currentMain = menuKey;
      renderGrid();
    }
  }
  updateFocus();
}

function handleBack() {
  selectedCell = null;
  settingsVisible = false;
  updateFocus();
}

// ---------------------
// KEY HANDLER
// ---------------------

document.addEventListener("keydown", e => {
  switch (e.key) {
    case "ArrowLeft": moveFocus("left"); break;
    case "ArrowRight": moveFocus("right"); break;
    case "ArrowUp": moveFocus("up"); break;
    case "ArrowDown": moveFocus("down"); break;
    case "Enter": handleEnter(); break;
    case "Escape":
    case "Backspace": handleBack(); break;
  }
});

// ---------------------
// INIT
// ---------------------

renderSidebar();
renderGrid();
updateFocus();
