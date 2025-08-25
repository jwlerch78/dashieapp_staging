// location.js
// --- Globals ---
let map;
const markers = {};  // store Leaflet marker objects by device name
let locationInterval;

// --- Zones helper ---
function getZone(lat, lon) {
  for (let zone of ZONES) {
    const distance = Math.sqrt((lat - zone.lat)**2 + (lon - zone.lon)**2);
    if (distance <= zone.radius) return zone.name;
  }
  return null;
}

// --- Reverse geocode helper ---
async function reverseGeocode(lat, lon) {
  try {
    const resp = await fetch(`${PROXY_URL}/reverse?lat=${lat}&lon=${lon}`);
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const json = await resp.json();
    const addr = json.address || {};
    return (
      addr.city ||
      addr.town ||
      addr.village ||
      addr.hamlet ||
      addr.suburb ||
      addr.county ||
      addr.state ||
      json.display_name ||
      "Unknown location"
    );
  } catch (err) {
    console.error("Reverse geocode error:", err);
    return "Unknown location";
  }
}

// --- Initialize Leaflet map ---
function initMap() {
  const container = document.getElementById("location-container");
  if (!container) return;

  map = L.map("location-container", { zoomControl: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  map.setView([0, 0], 2);

  // Recompute marker offsets on zoom/pan
  map.on('zoomend moveend', () => {
    applyVisualOffsets();
  });
}

// --- Compute circular offsets for a group ---
function getOffsetsForGroup(count, radius = 0.0001) {
  const offsets = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI;
    offsets.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return offsets;
}

// --- Apply offsets to prevent visual overlap ---
function applyVisualOffsets() {
  if (!map) return;

  // Convert all marker positions to pixel points
  const points = DEVICES.map(d => {
    const marker = markers[d.name];
    if (!marker) return null;
    const point = map.latLngToLayerPoint(marker.getLatLng());
    return { device: d, marker, point };
  }).filter(p => p);

  // Simple grouping: group markers that are closer than 50px
  const groups = [];
  const used = new Set();

  for (let i = 0; i < points.length; i++) {
    if (used.has(i)) continue;
    const group = [points[i]];
    used.add(i);

    for (let j = i + 1; j < points.length; j++) {
      if (used.has(j)) continue;
      const dx = points[i].point.x - points[j].point.x;
      const dy = points[i].point.y - points[j].point.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 50) {  // threshold in pixels
        group.push(points[j]);
        used.add(j);
      }
    }

    groups.push(group);
  }

  // Apply offsets for each group
  groups.forEach(group => {
    const offsets = getOffsetsForGroup(group.length, 0.0001); // ~10m offsets
    group.forEach((item, idx) => {
      const latlng = item.marker.getLatLng();
      item.marker.setLatLng([latlng.lat + offsets[idx][0], latlng.lng + offsets[idx][1]]);
    });
  });
}

// --- Update all device positions ---
async function updateLocations() {
  if (!map) return;

  const boundsArray = [];

  for (let device of DEVICES) {
    try {
      const response = await fetch(`${PROXY_URL}/positions/${device.id}`);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        const pos = data[0];
        if (pos.latitude && pos.longitude) {
          const zoneName = getZone(pos.latitude, pos.longitude) || await reverseGeocode(pos.latitude, pos.longitude);
          const locEl = document.getElementById(`${device.name.toLowerCase()}-location`);
          if (locEl) locEl.textContent = zoneName;

          const imgUrl = device.img || "img/fallback.png";

          const icon = L.divIcon({
            className: "family-marker",
            html: `<img src="${imgUrl}" alt="${device.name}" width="50" height="50"
                    onerror="this.src='img/fallback.png'">`,
            iconSize: [50, 50],
            iconAnchor: [25, 25]
          });

          if (markers[device.name]) {
            markers[device.name].setIcon(icon);
            markers[device.name].setLatLng([pos.latitude, pos.longitude]);
          } else {
            markers[device.name] = L.marker([pos.latitude, pos.longitude], { icon }).addTo(map);
          }

          boundsArray.push([pos.latitude, pos.longitude]);
        }
      }
    } catch (err) {
      console.error(`Error fetching ${device.name}:`, err);
      const locEl = document.getElementById(`${device.name.toLowerCase()}-location`);
      if (locEl) locEl.textContent = "Unknown location";
    }
  }

  if (boundsArray.length > 0) {
    const bounds = L.latLngBounds(boundsArray);
    map.fitBounds(bounds, { padding: [50, 50] });
  }

  map.invalidateSize();
  applyVisualOffsets();

  if (!locationInterval) locationInterval = setInterval(updateLocations, 30000);
}

// --- Initialize ---
initMap();
updateLocations();
