// --- Globals ---
let mapInitialized = false;

// Listen for messages to switch views
window.addEventListener("message", (event) => {
  const { action } = event.data || {};
  switch(action) {
    case "showCalendar":
      showContainer("calendar-container");
      break;
    case "showLocation":
      showContainer("location-container");
      if (!mapInitialized) {
        initMap(); // from location.js
        mapInitialized = true;
      }
      if (typeof map !== "undefined") {
        setTimeout(() => map.invalidateSize(), 200);
      }
      break;
    case "showCamera":
      showContainer("camera-container");
      break;
  }
});

// --- Show one container, hide the others ---
function showContainer(id) {
  ["calendar-container","location-container","camera-container"].forEach(c => {
    const el = document.getElementById(c);
    if (el) el.style.display = (c === id) ? "block" : "none";
  });

  // header only for calendar
  const header = document.getElementById("header-container");
  if (header) header.style.display = (id === "calendar-container") ? "block" : "none";

  // bottom view indicators only for calendar
  const indicators = document.querySelector(".view-indicators");
  if (indicators) indicators.style.display = (id === "calendar-container") ? "flex" : "none";
}
