// rightpanel.js
window.addEventListener("message", (event) => {
  const { action, mode } = event.data || {};

  switch(action) {
    case "showCalendar":
      showContainer("calendar-container");
      break;
    case "showMap":
      showContainer("map-container");
      break;
    case "showCamera":
      showContainer("camera-container");
      break;
  }
});

function showContainer(id) {
  ["calendar-container","map-container","camera-container"].forEach(c => {
    const el = document.getElementById(c);
    if (el) el.style.display = (c===id) ? "block" : "none";
  });
}
