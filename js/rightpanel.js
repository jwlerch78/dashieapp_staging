// rightpanel.js

// Helper to refresh map if it exists
function refreshMapIfReady() {
  if (typeof map !== "undefined" && map) {
    map.invalidateSize();
    if (typeof applyFormations === "function") applyFormations();
  }
}

window.addEventListener("message", (event) => {
  const { action } = event.data || {};

  switch (action) {
    case "showCalendar":
      showContainer("calendar-container");
      break;
    case "showLocation":
      showContainer("location-container");
      break;
    case "showCamera":
      showContainer("camera-container");
      break;
  }
});

function showContainer(id) {
  // Show/Hide the main containers
  ["calendar-container", "location-container", "camera-container"].forEach(c => {
    const el = document.getElementById(c);
    if (el) el.style.display = (c === id) ? "block" : "none";
  });

  // Toggle calendar header
  const header = document.getElementById("header-container");
  if (header) header.style.display = (id === "calendar-container") ? "block" : "none";

// Tell the location widget to update its mode (if loaded)
const locFrame = document.getElementById("location-frame");
if (locFrame && locFrame.contentWindow) {
  locFrame.contentWindow.postMessage(
    { action: id === "location-container" ? "enterLocationMode" : "exitLocationMode" },
    "*"
  );

  // Refresh map if location container is active
  if (id === "location-container") {
    refreshMapIfReady();
  }
}

// Optional: also call refreshMapIfReady after map initialization
if (typeof initMap === "function") {
  initMap();
  setTimeout(refreshMapIfReady, 100); // ensure map displays correctly on load
}
