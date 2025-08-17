const iframe = document.getElementById("frame");
const proxyUrl = "https://traccar-proxy-fcj3.onrender.com";

// All devices
const devices = [
  { name: "Dad", id: 1 },
  { name: "Mom", id: 2 },
  { name: "Charlie", id: 3 },
  { name: "Jack", id: 4 },
  { name: "Mary", id: 5 }
];

// Zones
const zones = [
  { name: "Home", lat: 27.93241, lon: -82.81062, radius: 0.003 },
  { name: "Osceola HS", lat: 27.8616, lon: -82.7711, radius: 0.004 },
  { name: "CFMS", lat: 27.977, lon: -82.765948, radius: 0.004 },
  { name: "Auntie's", lat: 27.9568, lon: -82.80285, radius: .003 },
  { name: "IRCS", lat: 27.8832, lon: -82.81443, radius: .004 },
  { name: "TBU", lat: 28.08333, lon: -82.6080, radius: .004 },
  { name: "SJ", lat:  27.8775866, lon: -82.814629, radius: .004 },
  { name: "Belleair Rec", lat:  27.9351627598, lon: 82.80202, radius: .003 },
  { name: "Sam's", lat:   27.95929, lon: -82.7317, radius: .003 },
  { name: "Publix", lat:   27.9166, lon: -82.8135976, radius: .003 },
  { name: "Molly's", lat:   28.0023296, lon: -82.76779518, radius: .004 },
  { name: "Julia's", lat:   28.071224355, lon: 82.682356, radius: .004 },
  { name: "Belcher", lat: 7.89895, lon: -82.74484, radius: .004 },
  { name: "Carlouel", lat: 28.006, lon: -82.826, radius: .004 },
  { name: "Soccer Field", lat: 27.9200, lon: -82.7700, radius: 0.002 }
];

function getZone(lat, lon) {
  for (let zone of zones) {
    const distance = Math.sqrt((lat - zone.lat)**2 + (lon - zone.lon)**2);
    if (distance <= zone.radius) return zone.name;
  }
  return null;
}

// Mode cycle & calendar sets
const baseUrl = "https://calendar.google.com/calendar/embed?ctz=America/New_York&showTitle=0&showNav=0&showPrint=0&showTabs=0&showCalendars=0&showTz=0&wkst=2";
const calendarSets = {
  weekly: [
    { id: "desilerch@gmail.com", color: "%23E67C73" },
    { id: "e48b36883ae237a9551de738523b7a246d5a1f6b15a3dbb6c78ee455a3aa4688@group.calendar.google.com", color: "%231565C0" },
    { id: "180b3d0e7c1ae0241b2e60ba9c566500949ff16a487adf11625cd72306b2310f@group.calendar.google.com", color: "%230B8043" },
    { id: "47489b378d24a631f96c2e6b4cbd6eda2876b98fa4d06fd1c83a8ac7badd5118@group.calendar.google.com", color: "%23d50000" },
    { id: "en.usa#holiday@group.v.calendar.google.com", color: "%23FDD835" }
  ],
  monthly: [
    { id: "desilerch@gmail.com", color: "%23E67C73" },
    { id: "0d9003b61604007a26868b678b71e5ad894354cbfdab1f071193207ed7e4b7e8@group.calendar.google.com", color: "%231565C0" },
    { id: "a2ffcf08f82cc50f9d7d0d055f80652074979d74a9a0664e11d6a029a8c8b1ed@group.calendar.google.com", color: "%230B8043" },
    { id: "47489b378d24a631f96c2e6b4cbd6eda2876b98fa4d06fd1c83a8ac7badd5118@group.calendar.google.com", color: "%23d50000" },
    { id: "en.usa#holiday@group.v.calendar.google.com", color: "%23FDD835" }
  ],
  work: [
    { id: "fd5949d42a667f6ca3e88dcf1feb27818463bbdc19c5e56d2e0da62b87d881c5@group.calendar.google.com", color: "%230B8043" }
  ]
};

const modes = ["weekly","monthly","work"];
let modeIndex = 0;
let mode = modes[modeIndex];
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
  let url = baseUrl + "&mode=" + (mode==="monthly" ? "MONTH" : "WEEK");
  url += `&dates=${formatYYYYMMDD(start)}/${formatYYYYMMDD(end)}`;
  calendarSets[mode].forEach(cal => { url += `&src=${encodeURIComponent(cal.id)}&color=${cal.color}`; });
  return url;
}

function updateIframe() { iframe.src = buildUrl(); updateLabels(); }

initDate();
updateIframe();

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
  for (let device of devices) {
    try {
      const response = await fetch(`${proxyUrl}/positions/${device.id}`);
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
updateLocations();
setInterval(updateLocations, 30000);

// Tracker toggle & calendar navigation
let trackerVisible = false;
window.addEventListener("message", (event) => {
  if (!event.data || typeof event.data.action !== "string") return;

  switch(event.data.action) {
    case "SelectButton":
      trackerVisible = !trackerVisible;
      document.getElementById("family-bar").style.display = trackerVisible ? "flex" : "none";
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
      modeIndex = (modeIndex + 1) % modes.length;
      mode = modes[modeIndex];
      initDate();
      break;
    case "prevCalendar":
      modeIndex = (modeIndex - 1 + modes.length) % modes.length;
      mode = modes[modeIndex];
      initDate();
      break;
  }

  updateIframe();
});

// Auto-refresh calendar every 5 min
setInterval(updateIframe, 300000);
