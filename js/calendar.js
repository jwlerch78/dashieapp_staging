// calendar.js
// Make sure config.js is loaded before this file

const iframe = document.getElementById("frame");

// State
let modeIndex = 0;
let mode = MODES[modeIndex];
let currentStartDate = new Date();

// Calendar scroll transform variables
let calendarScrollY = 0;
const scrollStep = 150; // pixels to scroll per button press
const maxScroll = 600; // maximum scroll in either direction
const minScroll = -600;

const labels = {
  weekly: document.getElementById("label-weekly"),
  monthly: document.getElementById("label-monthly"),
  work: document.getElementById("label-work")
};

function updateLabels() {
  Object.keys(labels).forEach(key => labels[key].classList.remove("active"));
  labels[mode].classList.add("active");
}

function calculateInitialScrollPosition() {
  if (mode !== "weekly" && mode !== "work") return 0; // No scroll for monthly
  
  const now = new Date();
  const hour = now.getHours(); // 0-23
  
  // Map 24-hour day to your scroll range
  // Assuming -600 (late night) to +600 (early morning)
  // 0am = maxScroll (+600), 12pm = 0, 11pm = minScroll (-600)
  
  if (hour <= 12) {
    // 0am-12pm: scroll from +600 to 0
    return (12 - hour) * (600 / 12); // +600 to 0
  } else {
    // 1pm-11pm: scroll from 0 to -600
    return -((hour - 12) * (600 / 11)); // 0 to -600
  }
}

function updateCalendarForMode() {
  if (mode === "weekly" || mode === "work") {
    // Enable scrolling: make iframe taller and position absolute
    iframe.style.height = "150%";
    iframe.style.position = "absolute";
    iframe.style.top = "0";
    iframe.style.left = "0";
    
    // Make sure container has overflow hidden
    const container = document.getElementById("calendar-container");
    if (container) {
      container.style.overflow = "hidden";
    }
  } else if (mode === "monthly") {
    // Disable scrolling: normal iframe size and positioning
    iframe.style.height = "100%";
    iframe.style.position = "static";
    iframe.style.transform = "translateY(0px)"; // Reset any scroll
    
    // Allow normal overflow for monthly
    const container = document.getElementById("calendar-container");
    if (container) {
      container.style.overflow = "visible";
    }
  }
}

function updateCalendarTransform() {
  // Apply CSS transform to create scrolling effect
  iframe.style.transform = `translateY(${calendarScrollY}px)`;
}

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
  updateCalendarForMode(); // Apply mode-specific CSS
  updateCalendarTransform();
}

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
  updateLabels();
  updateCalendarForMode(); // Apply mode-specific styling
  updateCalendarTransform(); // Apply current scroll position
}

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
      shouldUpdateIframe = false; // Don't reload iframe, just transform
      break;
    case "downCalendar":
      if (mode === "weekly" || mode === "work") {
        if (calendarScrollY > minScroll) {
          calendarScrollY -= scrollStep;
          updateCalendarTransform();
        }
      }
      shouldUpdateIframe = false; // Don't reload iframe, just transform
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

// Auto-refresh calendar every 5 minutes
setInterval(updateIframe, 300000);
