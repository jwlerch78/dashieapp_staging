// --- Globals ---
let map;
const markers = {};  // store Leaflet marker objects by device name
let locationInterval;
const PROXIMITY_THRESHOLD = 0.00015; // ~15 meters, tweak as needed

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
    console.log("Reverse geocode response:", json); // 👈 add this
    
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

  // Recompute formations on zoom/pan
  map.on('zoomend moveend', () => {
    applyFormations();
  });
}

// --- Compute formation offsets ---
function getFormationOffsets(count, radius = 0.0001) {
  const offsets = [];
  switch (count) {
    case 1:
      offsets.push([0, 0]);
      break;
    case 2:
      offsets.push([-radius/2, 0], [radius/2, 0]);
      break;
    case 3:
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * 2 * Math.PI;
        offsets.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
      }
      break;
    case 4:
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * 2 * Math.PI;
        offsets.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
      }
      break;
    case 5:
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * 2 * Math.PI;
        offsets.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
      }
      break;
    default:
      // For more than 5, spread in a circle
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * 2 * Math.PI;
        offsets.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
      }
  }
  return offsets;
}

// --- Apply formation-based offsets ---
function applyFormations() {
  if (!map) return;

  // Collect all marker positions
  const positions = DEVICES.map(d => {
    const marker = markers[d.name];
    if (!marker) return null;
    const latlng = marker.getLatLng();
    return { device: d, marker, lat: latlng.lat, lon: latlng.lng };
  }).filter(p => p);

  // Group markers by proximity
  const groups = [];
  const used = new Set();

  for (let i = 0; i < positions.length; i++) {
    if (used.has(i)) continue;
    const group = [positions[i]];
    used.add(i);
    for (let j = i + 1; j < positions.length; j++) {
      if (used.has(j)) continue;
      const dx = positions[i].lat - positions[j].lat;
      const dy = positions[i].lon - positions[j].lon;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist <= PROXIMITY_THRESHOLD) {
        group.push(positions[j]);
        used.add(j);
      }
    }
    groups.push(group);
  }

  // Apply offsets per group
  groups.forEach(group => {
    const count = group.length;
    const offsets = getFormationOffsets(count, PROXIMITY_THRESHOLD);
    // Compute group centroid
    const centroidLat = group.reduce((sum, m) => sum + m.lat, 0) / count;
    const centroidLon = group.reduce((sum, m) => sum + m.lon, 0) / count;

    group.forEach((item, idx) => {
      item.marker.setLatLng([
        centroidLat + offsets[idx][0],
        centroidLon + offsets[idx][1]
      ]);
    });
  });
}

// --- Update all device positions ---
// Store last positions for each device
const lastPositions = {};

async function updateLocations() {
  if (!map) return;

  const boundsArray = [];
  const now = Date.now();

  for (let device of DEVICES) {
    try {
      // Fetch the last 2 positions for more accurate speed/distance
      const response = await fetch(`${PROXY_URL}/positions?deviceId=${device.id}&limit=2`);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        const pos = data[0]; // most recent
        const prevPos = data[1]; // previous

        if (pos.latitude && pos.longitude) {

          // Determine zone or reverse geocode
          const zoneName = getZone(pos.latitude, pos.longitude) || await reverseGeocode(pos.latitude, pos.longitude);
          const poiName = pos.poi || '';

          // Distance and speed calculation using last two positions
          let speedMph = 0;
          let movementStatus = "No";
          if (prevPos && prevPos.latitude && prevPos.longitude && prevPos.serverTime) {
            const lat1 = prevPos.latitude * Math.PI / 180;
            const lat2 = pos.latitude * Math.PI / 180;
            const dLat = (pos.latitude - prevPos.latitude) * Math.PI / 180;
            const dLon = (pos.longitude - prevPos.longitude) * Math.PI / 180;
            const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distanceMeters = 6371e3 * c;

            const timeDiffMs = new Date(pos.serverTime).getTime() - new Date(prevPos.serverTime).getTime();
            const timeDiffHrs = timeDiffMs / 3600000;

            if (timeDiffHrs > 0) {
              speedMph = (distanceMeters * 0.000621371 / timeDiffHrs).toFixed(1); // mph
              if (speedMph >= 5) movementStatus = "Yes";   // Driving
              else if (speedMph >= 1) movementStatus = "Yes"; // Walking
              else movementStatus = "No";                  // Stationary
            }
          }

          // Update main location text (top row)
          const locEl = document.getElementById(`${device.name.toLowerCase()}-location`);
          if (locEl) locEl.textContent = `${zoneName} • ${speedMph} mph • ${movementStatus}`;

          // Extra info (expanded) below
          const extraEl = document.getElementById(`${device.name.toLowerCase()}-extra`);
          if (extraEl) {
            // Time at location
            let timeAtLocationText = "Unknown";
            if (pos.fixTime) {
              const durationMs = now - new Date(pos.fixTime).getTime();
              const mins = Math.floor(durationMs / 60000);
              if (mins > 1440) timeAtLocationText = ">24 hrs";
              else if (mins >= 60) timeAtLocationText = `${Math.floor(mins/60)} hr ${mins%60} min`;
              else timeAtLocationText = `${mins} min`;
            }

            // Time since last update
            let timeSinceUpdateText = "Unknown";
            if (pos.serverTime) {
              const durationMs = now - new Date(pos.serverTime).getTime();
              const mins = Math.floor(durationMs / 60000);
              if (mins > 1440) timeSinceUpdateText = ">24 hrs";
              else if (mins >= 60) timeSinceUpdateText = `${Math.floor(mins/60)} hr ${mins%60} min`;
              else timeSinceUpdateText = `${mins} min`;
            }

            // Distance from home
            const homeLat = HOME_LOCATION.lat;
            const homeLon = HOME_LOCATION.lon;
            const R = 6371e3;
            const φ1 = pos.latitude * Math.PI / 180;
            const φ2 = homeLat * Math.PI / 180;
            const Δφ = (homeLat - pos.latitude) * Math.PI / 180;
            const Δλ = (homeLon - pos.longitude) * Math.PI / 180;
            const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distanceMiles = (R * c * 0.000621371).toFixed(1); // meters to miles

            extraEl.innerHTML = `
              At Location: ${timeAtLocationText}<br>
              Since Update: ${timeSinceUpdateText}<br>
              Speed: ${speedMph} mph<br>
              Is Moving: ${movementStatus}<br>
              ${distanceMiles} mi away<br>
              ${poiName}
            `;
          }

          // Marker
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
      const extraEl = document.getElementById(`${device.name.toLowerCase()}-extra`);
      if (extraEl) extraEl.textContent = '';
    }
  }

  if (boundsArray.length > 0) {
    const bounds = L.latLngBounds(boundsArray);
    map.fitBounds(bounds, { padding: [50, 50] });
  }

  map.invalidateSize();
  applyFormations();

  if (!locationInterval) locationInterval = setInterval(updateLocations, 30000);
}


// --- Initialize ---
initMap();
updateLocations();
