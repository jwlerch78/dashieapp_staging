// location.js
// -----------------------------
// Globals
let map;
const markers = {}; // store lat/lon for formations
const reverseGeoCache = {};
let locationInterval;
const PROXIMITY_THRESHOLD = 0.00015; // ~15 meters
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// -----------------------------
// Helper: zones
function getZone(lat, lon) {
  for (let zone of ZONES) {
    const dist = Math.sqrt((lat - zone.lat) ** 2 + (lon - zone.lon) ** 2);
    if (dist <= zone.radius) return zone.name;
  }
  return null;
}

// -----------------------------
// Reverse geocode cache
async function reverseGeocode(lat, lon) {
  const key = `${lat.toFixed(8)},${lon.toFixed(8)}`;
  const now = Date.now();

  if (reverseGeoCache[key] && now - reverseGeoCache[key].timestamp < CACHE_TTL_MS) {
    return reverseGeoCache[key].result;
  }

  try {
    const resp = await fetch(`${PROXY_URL}/reverse?lat=${lat}&lon=${lon}`);
    const json = await resp.json();

    console.log("Reverse geocode response:", json); // 👈 always log
    
    const addr = json.address || {};
    const result =
      addr.city || addr.town || addr.village || addr.hamlet ||
      addr.suburb || addr.county || addr.state || json.display_name || "Unknown location";

    reverseGeoCache[key] = { timestamp: now, result };
    return result;
  } catch (err) {
    console.error("Reverse geocode error:", err);
    return "Unknown location";
  }
}

// -----------------------------
// Formation offsets to avoid overlapping markers
function getFormationOffsets(count, radius = PROXIMITY_THRESHOLD) {
  const offsets = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI;
    offsets.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return offsets;
}

function applyFormations() {
  if (!map) return;
  const positions = Object.values(markers);
  if (!positions.length) return;

  // Simple grouping for proximity
  const groups = [];
  const used = new Set();

  positions.forEach((m, i) => {
    if (used.has(i)) return;
    const group = [m]; used.add(i);
    for (let j = i + 1; j < positions.length; j++) {
      if (used.has(j)) continue;
      const dx = m.lat - positions[j].lat;
      const dy = m.lon - positions[j].lon;
      if (Math.sqrt(dx * dx + dy * dy) <= PROXIMITY_THRESHOLD) {
        group.push(positions[j]);
        used.add(j);
      }
    }
    groups.push(group);
  });

  // Apply offsets
  groups.forEach(group => {
    const offsets = getFormationOffsets(group.length);
    const centroidLat = group.reduce((s, m) => s + m.lat, 0) / group.length;
    const centroidLon = group.reduce((s, m) => s + m.lon, 0) / group.length;

    group.forEach((item, idx) => {
      item.latOffset = centroidLat + offsets[idx][0];
      item.lonOffset = centroidLon + offsets[idx][1];
    });
  });
}

// -----------------------------
// Initialize hidden Leaflet map for calculations
function initMap() {
  const container = document.createElement("div");
  container.style.width = "1px";
  container.style.height = "1px";
  container.style.position = "absolute";
  container.style.top = "-9999px";
  document.body.appendChild(container);

  map = L.map(container, { zoomControl: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  map.setView([0, 0], 2);
}

// -----------------------------
// Update locations and notify widgets
async function updateLocations() {
  if (!map) return;

  const now = Date.now();
  const boundsArray = [];

  for (const device of DEVICES) {
    try {
      const resp = await fetch(`${PROXY_URL}/positions/${device.id}?limit=2`);
      const data = await resp.json();

      console.log(`Device ${device.id} Traccar response:`, data);
      
      if (!Array.isArray(data) || !data.length) continue;
      const pos = data[0];
      const prev = data[1];

      if (!pos.latitude || !pos.longitude) continue;

      // Zone + reverse geocode
      const zoneName = getZone(pos.latitude, pos.longitude) || await reverseGeocode(pos.latitude, pos.longitude);
      const poiName = pos.poi || '';

      // Speed / movement
      let speedMph = 0, movementStatus = "No";
      if (prev && prev.latitude && prev.longitude && prev.serverTime) {
        const lat1 = prev.latitude * Math.PI / 180;
        const lat2 = pos.latitude * Math.PI / 180;
        const dLat = (pos.latitude - prev.latitude) * Math.PI / 180;
        const dLon = (pos.longitude - prev.longitude) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceMeters = 6371e3 * c;
        const timeHrs = (new Date(pos.serverTime) - new Date(prev.serverTime)) / 3600000;
        if (timeHrs > 0) {
          speedMph = (distanceMeters * 0.000621371 / timeHrs).toFixed(1);
          movementStatus = speedMph >= 1 ? "Yes" : "No";
        }
      }

      // Distance from home
      const R = 6371e3;
      const φ1 = pos.latitude * Math.PI / 180;
      const φ2 = HOME_LOCATION.lat * Math.PI / 180;
      const Δφ = (HOME_LOCATION.lat - pos.latitude) * Math.PI / 180;
      const Δλ = (HOME_LOCATION.lon - pos.longitude) * Math.PI / 180;
      const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanceMiles = (R * c * 0.000621371).toFixed(1);

      // Save marker for formations
      markers[device.name] = { lat: pos.latitude, lon: pos.longitude };

      // -----------------------------
      // Notify location bar widget

if (window.frames) {
  console.log("Sending Device Data via postMessage");
  window.postMessage(
  {
    type: "locationUpdate",
    payload: [
      {
        name: device.name,            // <-- lowercase matches your IDs
        zone: zoneName,
        poi: poiName,
        speedMph,
        movementStatus,
        distance: distanceMiles
      }
    ]
  },
  "*"
);

}
      

      // Notify map widget
      if (typeof window.updateMapMarkers === "function") {
        window.updateMapMarkers({
          device: device.name,
          lat: pos.latitude,
          lon: pos.longitude,
          zoneName,
          poiName
        });
      }

      boundsArray.push([pos.latitude, pos.longitude]);

    } catch (err) {
      console.error(`Error fetching ${device.name}:`, err);
    }
  }

  applyFormations();

  // Repeat every 30s
  if (!locationInterval) locationInterval = setInterval(updateLocations, 30000);
}

// -----------------------------
// Initialize
initMap();
updateLocations();
