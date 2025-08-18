// calendar.js
// Make sure config.js is loaded before this file

const iframe = document.getElementById("frame");

// State
let modeIndex = 0;
let mode = MODES[modeIndex];
let currentStartDate = new Date();

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
      break;
    case "downCalendar":
      if (mode === "weekly" || mode === "work") {
        if (calendarScrollY > minScroll) {
        calendarScrollY -= scrollStep;
        updateCalendarTransform();
        }
      }
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
