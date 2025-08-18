// location.js
const PROXY_URL = "https://traccar-proxy-fcj3.onrender.com";

// Zones helper
function getZone(lat, lon) {
  for (let zone of ZONES) {
    const distance = Math.sqrt((lat - zone.lat)**2 + (lon - zone.lon)**2);
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

// Update all devices
async function updateLocations() {
  DEVICES.forEach(async (device) => {
    try {
      const response = await fetch(`${PROXY_URL}/positions/${device.id}`);
      if (!response.ok) throw new Error(`Status ${response.status}`);
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
      document.getElementById(`${device.name.toLowerCase()}-location`).textContent = "Unknown location";
    }
  });
}

updateLocations();
setInterval(updateLocations, 30000);
