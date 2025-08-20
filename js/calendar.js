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
  labels[mode].classList.add("active");
}

// Calculate initial scroll position based on current hour
function calculateInitialScrollPosition() {
  if (mode !== "weekly" && mode !== "work") return 0;
  
  const now = new Date();
  const hour = now.getHours();

  return -450
  //if (hour <= 12) return (12 - hour) * (maxScroll / 12);
  //else return -((hour - 12) * (maxScroll / 11));
}

// Update iframe styles based on mode
function updateCalendarForMode() { 
  const headerContainer = document.getElementById("header-container");
  if (mode === "weekly" || mode === "work") { 
    iframe.style.height = "225%"; 
    iframe.style.position = "absolute"; 
    iframe.style.top = "0"; 
    iframe.style.left = "0"; 
    if (headerIframe) 
      headerIframe.style.display = "block"; 
      if (headerContainer) headerContainer.style.display = "block";

    const container = document.getElementById("calendar-container"); 
    if (container) container.style.overflow = "hidden"; }  
  else if (mode === "monthly") { 
    iframe.style.height = "100%"; 
    iframe.style.position = "static"; 
    iframe.style.transform = "translateY(0px)"; 
    if (headerIframe)  headerIframe.style.display = "none"; 
    if (headerContainer) headerContainer.style.display = "none";

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
    case "up":
      if (mode === "weekly" || mode === "work") {
        if (calendarScrollY+scrollStep <= maxScroll) 
          calendarScrollY += scrollStep;
        else calendarScrollY = maxScroll;
        updateCalendarTransform();
      }
      shouldUpdateIframe = false;
      break;
    case "down":
      if (mode === "weekly" || mode === "work") {
        if (calendarScrollY-scrollStep >= minScroll) 
          calendarScrollY -= scrollStep;
        else calendarScrollY = minScroll;
          updateCalendarTransform();
        
      }
      shouldUpdateIframe = false;
      break;
    case "right":
      if (mode==="weekly" || mode==="work") currentStartDate.setDate(currentStartDate.getDate()+7);
      else if (mode==="monthly") currentStartDate.setMonth(currentStartDate.getMonth()+1);
      break;
    case "left":
      if (mode==="weekly" || mode==="work") currentStartDate.setDate(currentStartDate.getDate()-7);
      else if (mode==="monthly") currentStartDate.setMonth(currentStartDate.getMonth()-1);
      break;
    case "next":
      modeIndex = (modeIndex + 1) % MODES.length;
      mode = MODES[modeIndex];
      initDate();
      break;
    case "prev":
      modeIndex = (modeIndex - 1 + MODES.length) % MODES.length;
      mode = MODES[modeIndex];
      initDate();
      break;
  }

  if (shouldUpdateIframe) updateIframe();
});

// Auto-refresh every 15 minutes
setInterval(updateIframe, 900000);
