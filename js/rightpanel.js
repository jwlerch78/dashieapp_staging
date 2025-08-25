// rightpanel.js
window.addEventListener("message", (event) => {
  const { action, mode } = event.data || {};

  switch(action) {
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
  ["calendar-container","location-container","camera-container"].forEach(c => {
    const el = document.getElementById(c);
    if (el) el.style.display = (c===id) ? "block" : "none";
  });
    // toggle header container only if calendar is active
  const header = document.getElementById("header-container");
  if (header) {
    header.style.display = (id === "calendar-container") ? "block" : "none";
  }
}
