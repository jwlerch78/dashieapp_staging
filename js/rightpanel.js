// rightpanel.js

let mapInitialized = false;

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

        // Delay the first location update slightly to let container fully render
        setTimeout(() => {
          updateLocations();
        }, 300);
      }

      // always recalc map size after container becomes visible
      if (typeof map !== "undefined") {
        setTimeout(() => map.invalidateSize(), 200);
      }
      break;
    case "showCamera":
      showContainer("camera-container");
      break;
  }
});

function showContainer(id) {
  ["calendar-container","location-container","camera-container"].forEach(c => {
    const el = document.getElementById(c);
    if (el) el.style.display = (c === id) ? "block" : "none";
  });

  const header = document.getElementById("header-container");
  if (header) header.style.display = (id === "calendar-container") ? "block" : "none";

  const indicators = document.querySelector(".view-indicators");
  if (indicators) indicators.style.display = (id === "calendar-container") ? "flex" : "none";
}
