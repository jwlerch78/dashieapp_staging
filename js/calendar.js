// calendar.js
// Make sure config.js is loaded before this file

const iframe = document.getElementById("frame");
let headerIframe = document.getElementById("header-frame");

// State
let modeIndex = 0;
let mode = MODES[modeIndex];
let currentStartDate = new Date();

// Scroll variables
let calendarScrollY = 0;
const scrollStep = 150;
const maxScroll = 600;
const minScroll = -600;

// Bottom labels
const labels = {
  weekly: document.getElementById("label-weekly"),
  monthly: document.getElementById("label-monthly"),
  work: document.getElementById("label-work")
};

function updateLabels() {
  Object.keys(labels).forEach(key => labels[key].classList.remove("active"));
  labels[mode].classList.add("active");
}

// Calculate initial scroll position based on current hour
function calculateInitialScrollPosition() {
  if (mode !== "weekly" && mode !== "work") return 0;
  
  const now = new Date();
  const hour = now.getHours();
  
  if (hour <= 12) return (12 - hour) * (maxScroll / 12);
  else return -((hour - 12) * (maxScroll / 11));
}

// Update iframe styles based on mode
function updateCalendarForMode() {
  if (mode === "weekly" || mode === "work") {
    iframe.style.height = "200%";
    iframe.style.position = "absolute";
    iframe.style.top = "0";
    iframe.style.left = "0";

    if (headerIframe) headerIframe.style.display = "block";

    const container = document.getElementById("calendar-container");
    if (container) container.style.overflow = "hidden";
  } else if (mode === "monthly") {
    iframe.style.height = "100%";
    iframe.style.position = "static";
    iframe.style.transform = "translateY(0px)";
    
    if (headerIframe) headerIframe.style.display = "none";

    const container = document.getElementById("calendar-container");
    if (container) container.style.overflow = "visible";
  }
}

// Apply CSS transform to scroll calendar iframe
function updateCalendarTransform() {
  iframe.style.transform = `translateY(${calendarScrollY}px)`;
}

// Initialize start date
function initDate() {
  const today = new Date();
  if (mode === "weekly" || mode === "work") {
    const day = today.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    currentStartDate = new Date(today);
    currentStartDate.setDate(currentStartDate.getDate() + diff);
    currentStartDate.setHours(0,0,0,0);
  } else if (mode === "monthly") {
    currentStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  calendarScrollY = calculateInitialScrollPosition();
  updateCalendarForMode();
  updateCalendarTransform();
}

// Build URL for iframe
function formatYYYYMMDD(date) { 
  return date.toISOString().slice(0,10).replace(/-/g,''); 
}

function buildUrl() {
  const start = new Date(currentStartDate);
  const end = new Date(start);

  if (mode === "weekly") end.setDate(end.getDate()+6);
  else if (mode==="monthly") { end.setMonth(end.getMonth()+1); end.setDate(0); }
  else if (mode==="work") end.setDate(end.getDate()+4);

  let url = BASE_URL + "&mode=" + (mode==="monthly" ? "MONTH" : "WEEK");
  CALENDAR_SETS[mode].forEach(cal => { 
    url += `&src=${encodeURIComponent(cal.id)}&color=${cal.color}`; 
  });

  url += `&dates=${formatYYYYMMDD(start)}/${formatYYYYMMDD(end)}`;
  return url;
}

function updateIframe() { 
  iframe.src = buildUrl();
  if (headerIframe) headerIframe.src = buildUrl(); // sync header
  updateLabels();
  updateCalendarForMode();
  updateCalendarTransform();
}

// Initialize
initDate();
updateIframe();

// Tracker toggle & calendar navigation
let trackerVisible = true;

window.addEventListener("message", (event) => {
  if (!event.data || typeof event.data.action !== "string") return;

  let shouldUpdateIframe = true;

  switch(event.data.action) {
    case "SelectButton":
      trackerVisible = !trackerVisible;
      document.getElementById("family-bar").style.display = trackerVisible ? "flex" : "none";
      shouldUpdateIframe = false;
      break;
    case "upCalendar":
      if (mode === "weekly" || mode === "work") {
        if (calendarScrollY < maxScroll) {
          calendarScrollY += scrollStep;
          updateCalendarTransform();
        }
      }
      shouldUpdateIframe = false;
      break;
    case "downCalendar":
      if (mode === "weekly" || mode === "work") {
        if (calendarScrollY > minScroll) {
          calendarScrollY -= scrollStep;
          updateCalendarTransform();
        }
      }
      shouldUpdateIframe = false;
      break;
    case "next":
      if (mode==="weekly" || mode==="work") currentStartDate.setDate(currentStartDate.getDate()+7);
      else if (mode==="monthly") currentStartDate.setMonth(currentStartDate.getMonth()+1);
      break;
    case "prev":
      if (mode==="weekly" || mode==="work") currentStartDate.setDate(currentStartDate.getDate()-7);
      else if (mode==="monthly") currentStartDate.setMonth(currentStartDate.getMonth()-1);
      break;
    case "nextCalendar":
      modeIndex = (modeIndex + 1) % MODES.length;
      mode = MODES[modeIndex];
      initDate();
      break;
    case "prevCalendar":
      modeIndex = (modeIndex - 1 + MODES.length) % MODES.length;
      mode = MODES[modeIndex];
      initDate();
      break;
  }

  if (shouldUpdateIframe) updateIframe();
});

// Auto-refresh every 5 minutes
setInterval(updateIframe, 300000);
