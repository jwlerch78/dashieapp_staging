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

  // Toggle family bar height for location mode
  const bar = document.getElementById("family-bar");
  if (bar) {
    if (id === "location-container") bar.classList.add("location-mode");
    else bar.classList.remove("location-mode");
  }

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
