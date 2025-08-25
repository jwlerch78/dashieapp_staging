// --- Globals ---
let map;
const markers = {};  // store Leaflet marker objects by device name

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

  // start with world view
  map.setView([0, 0], 2);

  // immediately fetch and show locations
  updateLocations();
  setInterval(updateLocations, 30000);
}

// --- Update all device positions ---
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

          // update location text
          const locEl = document.getElementById(`${device.name.toLowerCase()}-location`);
          if (locEl) locEl.textContent = zoneName;

          // Ensure device.img exists; fallback if missing
          const imgUrl = device.img || "img/fallback.png";

          // create / update marker
          const icon = L.divIcon({
            className: "family-marker",
            html: `<img src="${imgUrl}" alt="${device.name}" width="50" height="50" 
                    onerror="this.src='img/fallback.png'">`,
            iconSize: [50, 50],
            iconAnchor: [25, 25]
          });

          if (markers[device.name]) {
            markers[device.name].setIcon(icon);         // update icon in case URL changed
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

  // Auto-fit bounds if at least one marker exists
  if (boundsArray.length > 0) {
    const bounds = L.latLngBounds(boundsArray);
    map.fitBounds(bounds, { padding: [50, 50] });
  }

  // Force Leaflet to recalc map size after container becomes visible
  map.invalidateSize();
}
