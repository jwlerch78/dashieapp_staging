// main.js - Original functionality using config constants

const iframe = document.getElementById("frame");

// State variables
let modeIndex = 0;
let mode = CONFIG.calendar.modes[modeIndex];
let currentStartDate = new Date();
const labels = {
  weekly: document.getElementById("label-weekly"),
  monthly: document.getElementById("label-monthly"),
  work: document.getElementById("label-work")
};

function getZone(lat, lon) {
  for (let zone of CONFIG.zones) {
    const distance = Math.sqrt((lat - zone.lat)**2 + (lon - zone.lon)**2);
    if (distance <= zone.radius) return zone.name;
  }
  return null;
}

function updateLabels() {
  Object.keys(labels).forEach(key => labels[key].classList.remove("active"));
  labels[mode].classList.add("active");
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
}

function formatYYYYMMDD(date) { return date.toISOString().slice(0,10).replace(/-/g,''); }

function buildUrl() {
  const start = new Date(currentStartDate);
  const end = new Date(start);
  if (mode === "weekly") end.setDate(end.getDate()+6);
  else if (mode==="monthly") { end.setMonth(end.getMonth()+1); end.setDate(0); }
  else if (mode==="work") end.setDate(end.getDate()+4);

  let url = CONFIG.calendar.baseUrl + "&mode=" + (mode==="monthly" ? "MONTH" : "WEEK");
  url += `&dates=${formatYYYYMMDD(start)}/${formatYYYYMMDD(end)}`;
  CONFIG.calendar.calendarSets[mode].forEach(cal => { url += `&src=${encodeURIComponent(cal.id)}&color=${cal.color}`; });

  return url;
}

function updateIframe() { 
  iframe.src = buildUrl(); 
  updateLabels(); 
}

// Traccar location update
async function reverseGeocode(lat, lon) {
  try {
    const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
    const json = await resp.json();
    return json.address.city || json.address.town || json.address.village || json.display_name;
  } catch {
    return "Unknown location";
  }
}

async function updateLocations() {
  for (let device of CONFIG.devices) {
    try {
      const response = await fetch(`${CONFIG.proxyUrl}/positions/${device.id}`);
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const pos = data[0];
        if (pos.latitude && pos.longitude) {
          const zoneName = getZone(pos.latitude, pos.longitude) || await reverseGeocode(pos.latitude, pos.longitude);
          document.getElementById(`${device.name.toLowerCase()}-location`).textContent = zoneName;
        }
      }
    } catch (err) {
      console.error(`Error fetching ${device.name}:`, err);
      document.getElementById(`${device.name.toLowerCase()}-location`).textContent = "Error";
    }
  }
}

// Tracker toggle & calendar navigation
let trackerVisible = false;
window.addEventListener("message", (event) => {
  if (!event.data || typeof event.data.action !== "string") return;

  switch(event.data.action) {
    case "SelectButton":
      trackerVisible = !trackerVisible;
      document.getElementById("family-bar").style.display = trackerVisible ? "flex" : "none";
      break;
    case "upCalendar":
      // Placeholder for scrolling functionality
      break;
    case "downCalendar":
      // Placeholder for scrolling functionality  
      break;
    case "next":
      if (mode==="weekly" || mode==="work") currentStartDate.setDate(currentStartDate.getDate()+7);
      else if (mode==="monthly") currentStartDate.setMonth(currentStartDate.getMonth()+1);
      updateIframe();
      break;
    case "prev":
      if (mode==="weekly" || mode==="work") currentStartDate.setDate(currentStartDate.getDate()-7);
      else if (mode==="monthly") currentStartDate.setMonth(currentStartDate.getMonth()-1);
      updateIframe();
      break;
    case "nextCalendar":
      modeIndex = (modeIndex + 1) % CONFIG.calendar.modes.length;
      mode = CONFIG.calendar.modes[modeIndex];
      initDate();
      updateIframe();
      break;
    case "prevCalendar":
      modeIndex = (modeIndex - 1 + CONFIG.calendar.modes.length) % CONFIG.calendar.modes.length;
      mode = CONFIG.calendar.modes[modeIndex];
      initDate();
      updateIframe();
      break;
  }
});

// Initialize
initDate();
updateIframe();
updateLocations();
setInterval(updateLocations, CONFIG.intervals.locationUpdate);
setInterval(updateIframe, CONFIG.intervals.calendarRefresh);
