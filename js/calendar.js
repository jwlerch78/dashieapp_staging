// Calendar.js - Clean version using CSS classes and config.js

// --- Elements ---
const headerIframe = document.getElementById("header-frame");
const headerContainer = document.getElementById("header-container");
const calendarContainer = document.getElementById("calendar-container");

// --- State ---
let modeIndex = 0;
let calendar_mode = MODES[modeIndex];
let currentStartDate = new Date();
let headerLastLoaded = null;

// --- Scroll variables (from config) ---
let calendarScrollY = SCROLL_CONFIG.initial;
const scrollStep = SCROLL_CONFIG.step;
const maxScroll = SCROLL_CONFIG.max;
const minScroll = SCROLL_CONFIG.min;

// --- Labels ---
const labels = {
  weekly: document.getElementById("label-weekly"),
  monthly: document.getElementById("label-monthly"),
  work: document.getElementById("label-work")
};

// --- Helpers ---
function updateLabels() {
  Object.keys(labels).forEach(key => {
    labels[key].classList.remove("active", "selected");
  });
  if (labels[calendar_mode]) {
    labels[calendar_mode].classList.add("active");
  }
}

function getActiveIframe() {
  return document.getElementById(`calendar-${calendar_mode}`);
}

// Apply CSS classes instead of inline styles
function updateHeaderFromActive() {
  if (!headerIframe || !headerContainer) return;

  if (calendar_mode === "weekly" || calendar_mode === "work") {
    headerIframe.classList.remove("hidden");
    headerContainer.classList.remove("hidden");
  } else {
    headerIframe.classList.add("hidden");
    headerContainer.classList.add("hidden");
  }
}

function updateCalendarTransform() {
  if (calendar_mode === "weekly" || calendar_mode === "work") {
    const activeIframe = getActiveIframe();
    if (activeIframe) {
      activeIframe.style.transform = `translateY(${calendarScrollY}px)`;
    }
  }
}

// --- Date Initialization ---
function initDate() {
  const today = new Date();
  if (calendar_mode === "weekly" || calendar_mode === "work") {
    const day = today.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    currentStartDate = new Date(today);
    currentStartDate.setDate(currentStartDate.getDate() + diff);
    currentStartDate.setHours(0, 0, 0, 0);
  } else if (calendar_mode === "monthly") {
    currentStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  // Reset scroll (from config)
  calendarScrollY = SCROLL_CONFIG.initial;
  updateCalendarForMode();
  updateCalendarTransform();
}

// --- Build iframe URL for a given mode ---
function formatYYYYMMDD(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function buildUrlForMode(mode) {
  const start = new Date(currentStartDate);
  const end = new Date(start);

  if (mode === "weekly") end.setDate(end.getDate() + 6);
  else if (mode === "monthly") { end.setMonth(end.getMonth() + 1); end.setDate(0); }
  else if (mode === "work") end.setDate(end.getDate() + 4);

  let url = BASE_URL + "&mode=" + (mode === "monthly" ? "MONTH" : "WEEK");
  CALENDAR_SETS[mode].forEach(cal => {
    url += `&src=${encodeURIComponent(cal.id)}&color=${cal.color}`;
  });

  url += `&dates=${formatYYYYMMDD(start)}/${formatYYYYMMDD(end)}`;
  return url;
}

// --- Preload all calendar iframes ---
function preloadCalendars() {
  Object.keys(CALENDAR_SETS).forEach(mode => {
    const iframe = document.getElementById(`calendar-${mode}`);
    if (iframe) iframe.src = buildUrlForMode(mode);
  });
}

// --- Show a specific mode using CSS classes ---
function showMode(mode) {
  // Hide all frames and remove mode classes
  document.querySelectorAll(".calendar-frame").forEach(el => {
    el.classList.remove("active", "weekly-mode", "work-mode", "monthly-mode");
  });
  
  // Remove container mode classes
  if (calendarContainer) {
    calendarContainer.classList.remove("weekly-mode", "work-mode", "monthly-mode");
  }
  
  // Show selected frame with appropriate mode class
  const iframe = document.getElementById(`calendar-${mode}`);
  if (iframe) {
    iframe.classList.add("active", `${mode}-mode`);
  }
  
  // Add mode class to container
  if (calendarContainer) {
    calendarContainer.classList.add(`${mode}-mode`);
  }

  calendar_mode = mode;
  updateLabels();
  updateCalendarTransform();
  updateHeaderFromActive();

  // Keep header iframe in sync with active iframe
  if (headerIframe && iframe && (mode === "weekly" || mode === "work")) {
    if (headerIframe.src !== iframe.src) {
      headerIframe.src = iframe.src;
      headerLastLoaded = iframe.src;
    }
  }
}

// --- Update calendar styling per mode (minimal now) ---
function updateCalendarForMode() {
  // Most styling is now handled by CSS classes in showMode()
  // Only handle dynamic scroll transform here
  updateCalendarTransform();
}

// --- Message listener for navigation ---
window.addEventListener("message", (event) => {
  const { action, mode } = event.data || {};
  if (mode !== "calendar") return;

  switch (action) {
    case "Up":
      if (calendar_mode === "weekly" || calendar_mode === "work") {
        calendarScrollY = Math.min(calendarScrollY + scrollStep, maxScroll);
        updateCalendarTransform();
      }
      break;
    case "Down":
      if (calendar_mode === "weekly" || calendar_mode === "work") {
        calendarScrollY = Math.max(calendarScrollY - scrollStep, minScroll);
        updateCalendarTransform();
      }
      break;
    case "Left":
      if (calendar_mode === "weekly" || calendar_mode === "work") {
        currentStartDate.setDate(currentStartDate.getDate() - 7);
      } else if (calendar_mode === "monthly") {
        currentStartDate.setMonth(currentStartDate.getMonth() - 1);
      }
      preloadCalendars();
      showMode(calendar_mode);
      break;
    case "Right":
      if (calendar_mode === "weekly" || calendar_mode === "work") {
        currentStartDate.setDate(currentStartDate.getDate() + 7);
      } else if (calendar_mode === "monthly") {
        currentStartDate.setMonth(currentStartDate.getMonth() + 1);
      }
      preloadCalendars();
      showMode(calendar_mode);
      break;
    case "Prev":
      if (modeIndex === 0) {
        window.parent.postMessage({ action: "focusLeftPanel" }, "*");
        labels[calendar_mode].classList.remove("active");
        labels[calendar_mode].classList.add("selected");
      } else {
        modeIndex = (modeIndex - 1 + MODES.length) % MODES.length;
        calendar_mode = MODES[modeIndex];
        showMode(calendar_mode);
      }
      break;
    case "Next":
      if (modeIndex === MODES.length-1) {
        window.parent.postMessage({ action: "focusLeftPanel" }, "*");
        labels[calendar_mode].classList.remove("active");
        labels[calendar_mode].classList.add("selected");
      } else {
        modeIndex = (modeIndex + 1) % MODES.length;
        calendar_mode = MODES[modeIndex];
        showMode(calendar_mode);
      }
      break;
    case "RightFocus-Next":
      modeIndex = 0;
      calendar_mode = MODES[modeIndex];
      updateLabels();
      break;
    case "RightFocus-Prev":
      modeIndex = MODES.length - 1;
      calendar_mode = MODES[modeIndex];
      updateLabels();
      break;
  }
});

// --- Add click handlers for bottom labels ---
function addClickHandlers() {
  Object.keys(labels).forEach(mode => {
    const label = labels[mode];
    if (label) {
      label.addEventListener('click', () => {
        // Find the target mode index
        const targetModeIndex = MODES.indexOf(mode);
        if (targetModeIndex !== -1 && targetModeIndex !== modeIndex) {
          // Use the same logic as Next/Prev to maintain consistent formatting
          modeIndex = targetModeIndex;
          calendar_mode = MODES[modeIndex];
          showMode(calendar_mode);
        }
      });
      
      // Add hover effects for better UX
      label.addEventListener('mouseenter', () => {
        if (!label.classList.contains('active')) {
          label.style.backgroundColor = '#333';
        }
      });
      
      label.addEventListener('mouseleave', () => {
        if (!label.classList.contains('active')) {
          label.style.backgroundColor = '';
        }
      });
    }
  });
}

// --- Initialize ---
document.addEventListener("DOMContentLoaded", () => {
  // Activate first iframe and label
  const firstFrame = document.querySelector(".calendar-frame");
  if (firstFrame) firstFrame.classList.add("active");
  const firstLabel = document.querySelector(".view-label");
  if (firstLabel) firstLabel.classList.add("active");

  // Add click handlers to bottom labels
  addClickHandlers();

  preloadCalendars();
  initDate();

  // Set header src once at page load to match initial calendar
  const activeIframe = getActiveIframe();
  if (headerIframe && activeIframe) {
    headerIframe.src = activeIframe.src;
    headerLastLoaded = activeIframe.src;
  }

  showMode(calendar_mode);

  // Auto-refresh hidden iframes using config interval
  setInterval(preloadCalendars, CALENDAR_SETTINGS.autoRefreshInterval);
});
