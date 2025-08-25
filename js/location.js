// location.js

// --- Globals ---
let map;
const markers = {};  // store Leaflet marker objects by device name
let locationInterval;
const PROXIMITY_THRESHOLD = 0.00015; // ~15 meters
const FORMATION_RADIUS_PX = 30;      // spacing in pixels for formations
let initialFitDone = false;

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

  // Recompute formations on zoom/pan
  map.on('zoomend moveend', applyFormations);
}

// --- Formation offsets in pixels ---
function getFormationOffsetsPixels(count, radiusPx = FORMATION_RADIUS_PX) {
  const offsets = [];
  switch (count) {
    case 1:
      offsets.push([0,0]);
      break;
    case 2:
      offsets.push([-radiusPx/2,0],[radiusPx/2,0]);
      break;
    case 3:
      for (let i=0;i<3;i++){
        const angle = (i/3)*2*Math.PI;
        offsets.push([radiusPx*Math.cos(angle), radiusPx*Math.sin(angle)]);
      }
      break;
    case 4:
      for (let i=0;i<4;i++){
        const angle = (i/4)*2*Math.PI;
        offsets.push([radiusPx*Math.cos(angle), radiusPx*Math.sin(angle)]);
      }
      break;
    case 5:
      for (let i=0;i<5;i++){
        const angle = (i/5)*2*Math.PI;
        offsets.push([radiusPx*Math.cos(angle), radiusPx*Math.sin(angle)]);
      }
      break;
    default:
      for (let i=0;i<count;i++){
        const angle = (i/count)*2*Math.PI;
        offsets.push([radiusPx*Math.cos(angle), radiusPx*Math.sin(angle)]);
      }
  }
  return offsets;
}

// --- Apply pixel-based formations ---
function applyFormations() {
  if (!map) return;

  // Collect markers with true GPS coords
  const positions = DEVICES.map(d => {
    const marker = markers[d.name];
    if (!marker || d.lat===undefined || d.lon===undefined) return null;
    return { device: d, marker, lat: d.lat, lon: d.lon };
  }).filter(p => p);

  // Group markers by proximity (GPS distance)
  const groups = [];
  const used = new Set();
  for (let i=0;i<positions.length;i++){
    if (used.has(i)) continue;
    const group = [positions[i]];
    used.add(i);
    for (let j=i+1;j<positions.length;j++){
      if (used.has(j)) continue;
      const dx = positions[i].lat - positions[j].lat;
      const dy = positions[i].lon - positions[j].lon;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist<=PROXIMITY_THRESHOLD){
        group.push(positions[j]);
        used.add(j);
      }
    }
    groups.push(group);
  }

  // Apply pixel offsets per group
  groups.forEach(group=>{
    const count = group.length;
    if(count===0) return;

    const centroidLat = group.reduce((sum,m)=>sum+m.device.lat,0)/count;
    const centroidLon = group.reduce((sum,m)=>sum+m.device.lon,0)/count;
    const centroidPoint = map.latLngToContainerPoint([centroidLat,centroidLon]);
    const offsetsPx = getFormationOffsetsPixels(count);

    group.forEach((item,idx)=>{
      const newPoint = L.point(
        centroidPoint.x + offsetsPx[idx][0],
        centroidPoint.y + offsetsPx[idx][1]
      );
      const newLatLng = map.containerPointToLatLng(newPoint);
      item.marker.setLatLng(newLatLng);
    });
  });
}

// --- Update all device positions ---
async function updateLocations() {
  if (!map) return;

  const boundsArray = [];

  for (let device of DEVICES) {
    try {
      const resp = await fetch(`${PROXY_URL}/positions/${device.id}`);
      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      const data = await resp.json();

      if(Array.isArray(data) && data.length>0){
        const pos = data[0];
        if(pos.latitude && pos.longitude){

          // store true GPS
          device.lat = pos.latitude;
          device.lon = pos.longitude;

          const zoneName = getZone(pos.latitude,pos.longitude) || await reverseGeocode(pos.latitude,pos.longitude);
          const locEl = document.getElementById(`${device.name.toLowerCase()}-location`);
          if(locEl) locEl.textContent = zoneName;

          const imgUrl = device.img || "img/fallback.png";
          const icon = L.divIcon({
            className:"family-marker",
            html:`<img src="${imgUrl}" alt="${device.name}" width="50" height="50"
                  onerror="this.src='img/fallback.png'">`,
            iconSize:[50,50],
            iconAnchor:[25,25]
          });

          if(markers[device.name]){
            markers[device.name].setIcon(icon);
            // temporarily move marker to GPS (will apply formation next)
            markers[device.name].setLatLng([pos.latitude,pos.longitude]);
          } else {
            markers[device.name] = L.marker([pos.latitude,pos.longitude],{icon}).addTo(map);
          }

          boundsArray.push([pos.latitude,pos.longitude]);
        }
      }
    } catch(err){
      console.error(`Error fetching ${device.name}:`,err);
      const locEl = document.getElementById(`${device.name.toLowerCase()}-location`);
      if(locEl) locEl.textContent="Unknown location";
    }
  }

  // Initial fitBounds only once
  if(!initialFitDone && boundsArray.length>0){
    const bounds = L.latLngBounds(boundsArray);
    map.fitBounds(bounds, { padding: [150,150] });
    initialFitDone = true;
  }

  map.invalidateSize();
  applyFormations();

  if(!locationInterval) locationInterval = setInterval(updateLocations,30000);
}

// --- Initialize ---
initMap();
updateLocations();
