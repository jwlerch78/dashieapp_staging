// location.js - Updated for new dashboard structure
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

    console.log("Reverse geocode response:", json);
    
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
// Helper function to find widget iframes in new grid system
function findLocationWidget() {
  // Method 1: Try to find by widget ID in the new grid system
  const locationGridItem = document.querySelector('[data-widget-id="map"]');
  if (locationGridItem) {
    const iframe = locationGridItem.querySelector('iframe');
    if (iframe) {
      console.log("Found location widget via grid system");
      return iframe;
    }
  }

  // Method 2: Try to find by iframe source containing "location"
  const locationFrames = document.querySelectorAll('iframe[src*="location"]');
  if (locationFrames.length > 0) {
    console.log("Found location widget via iframe source");
    return locationFrames[0];
  }

  // Method 3: Try legacy ID (for backward compatibility)
  const legacyFrame = document.getElementById("location-frame");
  if (legacyFrame) {
    console.log("Found location widget via legacy ID");
    return legacyFrame;
  }

  console.warn("Location widget iframe not found");
  return null;
}

// -----------------------------
// Update locations and notify widgets
async function updateLocations() {
  if (!map) return;

  console.log("Starting location update cycle...");
  const now = Date.now();
  const boundsArray = [];

  for (const device of DEVICES) {
    try {
      const resp = await fetch(`${PROXY_URL}/positions/${device.id}?limit=2`);
      const data = await resp.json();

      console.log(`Device ${device.id} (${device.name}) Traccar response:`, data);
      
      if (!Array.isArray(data) || !data.length) {
        console.warn(`No position data for device ${device.name}`);
        continue;
      }
      
      const pos = data[0];
      const prev = data[1];

      if (!pos.latitude || !pos.longitude) {
        console.warn(`Invalid coordinates for device ${device.name}:`, pos);
        continue;
      }

      // Zone + reverse geocode
      const zoneName = getZone(pos.latitude, pos.longitude) || await reverseGeocode(pos.latitude, pos.longitude);
      const poiName = pos.poi || '';

      // Speed / movement calculation
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

      // Distance from home calculation
      const R = 6371e3;
      const φ1 = pos.latitude * Math.PI / 180;
      const φ2 = HOME_LOCATION.lat * Math.PI / 180;
      const Δφ = (HOME_LOCATION.lat - pos.latitude) * Math.PI / 180;
      const Δλ = (HOME_LOCATION.lon - pos.longitude) * Math.PI / 180;
      const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanceMiles = (R * c * 0.000621371).toFixed(1);

      // Calculate time at location (you can implement this based on your needs)
      const timeAtLocation = "Unknown"; // Placeholder - implement based on position history

      // Save marker for formations
      markers[device.name] = { lat: pos.latitude, lon: pos.longitude };

      // -----------------------------
      // Notify location widget using new grid system
      const locationWidget = findLocationWidget();
      if (locationWidget && locationWidget.contentWindow) {
        console.log(`Sending location update for ${device.name}:`, {
          device: device.name,
          zone: zoneName,
          poi: poiName,
          speedMph,
          movementStatus,
          distance: distanceMiles,
          timeAtLocation
        });
        
        locationWidget.contentWindow.postMessage(
          {
            type: "locationUpdate",
            payload: {
              device: device.name,
              zone: zoneName,
              poi: poiName,
              speedMph,
              movementStatus,
              distance: distanceMiles,
              timeAtLocation
            }
          },
          "*"
        );
      } else {
        console.warn("Location widget not found - cannot send update");
      }

      // Notify map widget (if you have a separate map widget)
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
      console.error(`Error fetching location for ${device.name}:`, err);
    }
  }

  applyFormations();
  console.log("Location update cycle completed");

  // Schedule next update
  if (!locationInterval) {
    locationInterval = setInterval(updateLocations, 30000);
    console.log("Location update interval started (30 seconds)");
  }
}

// -----------------------------
// Initialize location system when ready
function initLocationSystem() {
  console.log("Initializing location system...");
  
  // Wait for widgets to be ready
  const checkWidgets = (attempts = 0) => {
    const maxAttempts = 10;
    const locationWidget = findLocationWidget();
    
    if (locationWidget) {
      console.log("Location widget found, starting location system");
      initMap();
      updateLocations();
    } else if (attempts < maxAttempts) {
      console.log(`Location widget not ready, retrying in 1 second... (attempt ${attempts + 1}/${maxAttempts})`);
      setTimeout(() => checkWidgets(attempts + 1), 1000);
    } else {
      console.error("Failed to find location widget after maximum attempts");
    }
  };

  // Start checking for widgets
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => checkWidgets(0));
  } else {
    checkWidgets(0);
  }
}

// Auto-initialize when script loads
initLocationSystem();
