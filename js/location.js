// --- Globals ---
let map;
let markers = {}; // store markers by device.name

// Zones helper
function getZone(lat, lon) {
  for (let zone of ZONES) {
    const distance = Math.sqrt((lat - zone.lat) ** 2 + (lon - zone.lon) ** 2);
    if (distance <= zone.radius) return zone.name;
  }
  return null;
}

// Reverse geocode helper
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

// Initialize the Leaflet map
function initMap() {
  if (map) return; // don’t reinit

  map = L.map("location-container").setView([27.96, -82.8], 11); // default center

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
  }).addTo(map);

  // preload markers with custom circular icons
  DEVICES.forEach((device) => {
    const icon = L.icon({
      iconUrl: `https://raw.githubusercontent.com/jwlerch78/family_calendar/main/images/${device.name}.png`,
      iconSize: [50, 50],
      className: "family-marker", // CSS makes it circular
    });

    markers[device.name] = L.marker([27.96, -82.8], {
      title: device.name,
      icon: icon,
    })
      .addTo(map)
      .bindPopup(`${device.name}<br>Loading...`);
  });
}

// Update all devices
async function updateLocations() {
  let bounds = L.latLngBounds(); // track all positions

  await Promise.all(
    DEVICES.map(async (device) => {
      try {
        const response = await fetch(`${PROXY_URL}/positions/${device.id}`);
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
          const pos = data[0];
          if (pos.latitude && pos.longitude) {
            const zoneName =
              getZone(pos.latitude, pos.longitude) ||
              (await reverseGeocode(pos.latitude, pos.longitude));

            // Update family bar
            document.getElementById(
              `${device.name.toLowerCase()}-location`
            ).textContent = zoneName;

            // Update marker
            if (markers[device.name]) {
              const latlng = [pos.latitude, pos.longitude];
              markers[device.name]
                .setLatLng(latlng)
                .setPopupContent(
                  `<div style="text-align:center;">
                     <img src="https://raw.githubusercontent.com/jwlerch78/family_calendar/main/images/${device.name}.png" 
                          style="width:40px;height:40px;border-radius:50%;border:2px solid white;box-shadow:0 0 5px rgba(0,0,0,0.5);"><br>
                     <b>${device.name}</b><br>${zoneName}
                   </div>`
                );
              bounds.extend(latlng);
            }
          }
        }
      } catch (err) {
        console.error(`Error fetching ${device.name}:`, err);
        document.getElementById(
          `${device.name.toLowerCase()}-location`
        ).textContent = "Unknown location";
      }
    })
  );

  // Auto-fit map to markers if we have valid bounds
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }
}

// --- Init ---
initMap();
updateLocations();
setInterval(updateLocations, 30000);
