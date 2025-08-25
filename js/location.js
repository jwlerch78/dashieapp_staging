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

  // start interval only once
  if (!locationInterval) {
    locationInterval = setInterval(updateLocations, 30000);
  }
}
