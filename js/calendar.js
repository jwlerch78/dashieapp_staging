// Calendar.js

// --- Elements ---
const headerIframe = document.getElementById("header-frame");
const headerContainer = document.getElementById("header-container");

// --- State ---
let modeIndex = 0;
let calendar_mode = MODES[modeIndex];
let currentStartDate = new Date();
let headerLastLoaded = null; // Track when header was last updated

// --- Scroll variables ---
let calendarScrollY = -450;
const scrollStep = 150;
const maxScroll = -150;
const minScroll = -700;

// --- Labels ---
const labels = {
  weekly: document.getElementById("label-weekly"),
  monthly: document.getElementById("label-monthly"),
  work: document.getElementById("label-work")
};

// --- Helpers ---
function updateLabels() {
  Object.keys(labels).forEach(key => {
    labels[key].classList.remove("active");
    labels[key].classList.remove("selected");
  });
  if (labels[calendar_mode]) {
    labels[calendar_mode].classList.add("active");
  }
}

function getActiveIframe() {
  return document.getElementById(`calendar-${calendar_mode}`);
}

// Smart header update - only when needed
function updateHeaderFromActive() {
  if (!headerIframe) return;
  const activeIframe = getActiveIframe();
  if (!activeIframe) return;

  if (calendar_mode === "weekly" || calendar_mode === "work") {
    // Only update header if URL changed or first time loading
    const newUrl = activeIframe.src;
    if (headerLastLoaded !== newUrl && newUrl) {
      headerIframe.src = newUrl;
      headerLastLoaded = newUrl;
    }
    headerIframe.style.display = "block";
    headerContainer.style.display = "block";
  } else {
    headerIframe.style.display = "none";
    headerContainer.style.display = "none"; // Hide container entirely
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

  // Reset header tracking when reinitializing dates
  headerLastLoaded = null;
  
  calendarScrollY = -450;
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

// --- Show a specific mode ---
function showMode(mode) {
  // Hide all frames
  document.querySelectorAll(".calendar-frame").forEach(el => el.classList.remove("active"));
  
  // Show selected frame
  const iframe = document.getElementById(`calendar-${mode}`);
  if (iframe) iframe.classList.add("active");

  calendar_mode = mode;
  updateLabels();
  updateCalendarForMode();
  updateCalendarTransform();
  updateHeaderFromActive();
}

// --- Update calendar styling per mode ---
function updateCalendarForMode() {
  const activeIframe = getActiveIframe();
  if (!activeIframe) return;
  const container = document.getElementById("calendar-container");

  if (calendar_mode === "weekly" || calendar_mode === "work") {
    // Weekly/Work mode setup
    activeIframe.style.position = "absolute";
    activeIframe.style.top = "0";
    activeIframe.style.left = "0";
    activeIframe.style.width = "100%";
    activeIframe.style.height = "225%";
    activeIframe.style.transform = `translateY(${calendarScrollY}px)`;

    // Ensure header iframe stays correct
    if (headerIframe) {
      headerIframe.style.height = "700px";
      headerIframe.style.position = "relative";
      headerIframe.style.display = "block";
    }
    
    if (container) container.style.overflow = "hidden";
    if (headerContainer) headerContainer.style.display = "block";
    
  } else if (calendar_mode === "monthly") {
    // Monthly mode setup
    activeIframe.style.position = "static";
    activeIframe.style.height = "100%";
    activeIframe.style.transform = "translateY(0px)";

    // Hide header completely for monthly
    if (headerIframe) headerIframe.style.display = "none";
    if (headerContainer) headerContainer.style.display = "none";

    if (container) container.style.overflow = "visible";
  }
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
      // Header will update automatically via updateHeaderFromActive()
      break;
    case "Right":
      if (calendar_mode === "weekly" || calendar_mode === "work") {
        currentStartDate.setDate(currentStartDate.getDate() + 7);
      } else if (calendar_mode === "monthly") {
        currentStartDate.setMonth(currentStartDate.getMonth() + 1);
      }
      preloadCalendars();
      showMode(calendar_mode);
      // Header will update automatically via updateHeaderFromActive()
      break;
    case "Prev":
      if (modeIndex === 0) {
        window.parent.postMessage({ action: "focusLeftPanel" }, "*");
        labels[calendar_mode].classList.remove("active");
        labels[calendar_mode].classList.add("selected");
      } else {
        modeIndex = (modeIndex - 1 + MODES.length) % MODES.length;
        calendar_mode = MODES[modeIndex];
        //initDate();
        showMode(calendar_mode);
      }
      break;
    case "Next":
      modeIndex = (modeIndex + 1) % MODES.length;
      calendar_mode = MODES[modeIndex];
      //initDate();
      showMode(calendar_mode);
      break;
    case "RightFocus":
      updateLabels();
      break;
  }
});

// --- Initialize ---
document.addEventListener("DOMContentLoaded", () => {
  // Activate first iframe and label
  const firstFrame = document.querySelector(".calendar-frame");
  if (firstFrame) firstFrame.classList.add("active");
  const firstLabel = document.querySelector(".view-label");
  if (firstLabel) firstLabel.classList.add("active");

  preloadCalendars();
  initDate();
  showMode(calendar_mode);

  // Auto-refresh hidden iframes every 15 min (but not header unless needed)
  setInterval(preloadCalendars, 900000);
});
