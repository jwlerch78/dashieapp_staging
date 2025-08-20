// RightPanel calendar.js
const iframe = document.getElementById("frame");
let headerIframe = document.getElementById("header-frame");

// State
let modeIndex = 0;
let calendar_mode = MODES[modeIndex]; // use calendar_mode instead of mode
let currentStartDate = new Date();

// Scroll variables
let calendarScrollY = 0;
const scrollStep = 150;
const maxScroll = -150;
const minScroll = -700;

// Bottom labels
const labels = {
  weekly: document.getElementById("label-weekly"),
  monthly: document.getElementById("label-monthly"),
  work: document.getElementById("label-work")
};

function updateLabels() {
  Object.keys(labels).forEach(key => labels[key].classList.remove("active"));
  labels[calendar_mode].classList.add("active");
}

// Initialize start date
function initDate() {
  const today = new Date();
  if (calendar_mode === "weekly" || calendar_mode === "work") {
    const day = today.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    currentStartDate = new Date(today);
    currentStartDate.setDate(currentStartDate.getDate() + diff);
    currentStartDate.setHours(0,0,0,0);
  } else if (calendar_mode === "monthly") {
    currentStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  calendarScrollY = -450; // fixed initial scroll
  updateCalendarForMode();
  updateCalendarTransform();
}

// Update iframe display based on calendar_mode
function updateCalendarForMode() { 
  const headerContainer = document.getElementById("header-container");
  if (calendar_mode === "weekly" || calendar_mode === "work") { 
    iframe.style.height = "225%"; 
    iframe.style.position = "absolute"; 
    iframe.style.top = "0"; 
    iframe.style.left = "0"; 
    if (headerIframe) headerIframe.style.display = "block"; 
    if (headerContainer) headerContainer.style.display = "block";
  } else if (calendar_mode === "monthly") { 
    iframe.style.height = "100%"; 
    iframe.style.position = "static"; 
    iframe.style.transform = "translateY(0px)"; 
    if (headerIframe) headerIframe.style.display = "none"; 
    if (headerContainer) headerContainer.style.display = "none";
  }
}

// Apply CSS transform
function updateCalendarTransform() {
  iframe.style.transform = `translateY(${calendarScrollY}px)`;
}

// Helper to format YYYYMMDD for Google Calendar URLs
function formatYYYYMMDD(date) { 
    return date.toISOString().slice(0,10).replace(/-/g,''); 
}

// Build URL for iframe
function buildUrl() {
  const start = new Date(currentStartDate);
  const end = new Date(start);

  if (calendar_mode === "weekly") end.setDate(end.getDate()+6);
  else if (calendar_mode==="monthly") { end.setMonth(end.getMonth()+1); end.setDate(0); }
  else if (calendar_mode==="work") end.setDate(end.getDate()+4);

  let url = BASE_URL + "&mode=" + (calendar_mode==="monthly" ? "MONTH" : "WEEK");
  CALENDAR_SETS[calendar_mode].forEach(cal => { 
    url += `&src=${encodeURIComponent(cal.id)}&color=${cal.color}`; 
  });

  url += `&dates=${formatYYYYMMDD(start)}/${formatYYYYMMDD(end)}`;
  return url;
}

function updateIframe() { 
  iframe.src = buildUrl();
  if (headerIframe) headerIframe.src = buildUrl();
  updateLabels();
  updateCalendarForMode();
  updateCalendarTransform();
}

// --- Message listener ---
window.addEventListener("message", (event) => {
  const { action, mode } = event.data || {};
  
  // Only respond if calendar_mode === "calendar"
  if (mode !== "calendar") return;

  let shouldUpdateIframe = true;

  switch(action) {
    case "Up":
      if (calendar_mode === "weekly" || calendar_mode === "work") {
        calendarScrollY = Math.min(calendarScrollY + scrollStep, maxScroll);
        updateCalendarTransform();
      }
      shouldUpdateIframe = false;
      break;
    case "Down":
      if (calendar_mode === "weekly" || calendar_mode === "work") {
        calendarScrollY = Math.max(calendarScrollY - scrollStep, minScroll);
        updateCalendarTransform();
      }
      shouldUpdateIframe = false;
      break;
    case "Left":
      if (calendar_mode === "weekly" || calendar_mode === "work") {
        currentStartDate.setDate(currentStartDate.getDate() - 7);
        // Special case: send focus to LeftPanel
        window.parent.postMessage({ action: "focusLeftPanel" }, "*");
      } else if (calendar_mode === "monthly") {
        currentStartDate.setMonth(currentStartDate.getMonth() - 1);
      }
      break;
    case "Right":
      if (calendar_mode === "weekly" || calendar_mode === "work") {
        currentStartDate.setDate(currentStartDate.getDate() + 7);
      } else if (calendar_mode === "monthly") {
        currentStartDate.setMonth(currentStartDate.getMonth() + 1);
      }
      break;
    case "Prev":
      modeIndex = (modeIndex - 1 + MODES.length) % MODES.length;
      calendar_mode = MODES[modeIndex];
      initDate();
      break;
    case "Next":
      modeIndex = (modeIndex + 1) % MODES.length;
      calendar_mode = MODES[modeIndex];
      initDate();
      // If FocusMode was LeftPanel, send focus back
      window.parent.postMessage({ action: "focusRightPanel" }, "*");
      break;
  }

  if (shouldUpdateIframe) updateIframe();
});

// Initialize
initDate();
updateIframe();
setInterval(updateIframe, 900000); // auto-refresh
