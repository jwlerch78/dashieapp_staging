// Rightpanel.js

window.addEventListener("message", (event) => {
  const action = event.data.action;
  switch(action) {
    case "showCalendar": showContainer("calendar-container"); break;
    case "showMap": showContainer("map-container"); break;
    case "showCamera": showContainer("camera-container"); break;
  }
});

function showContainer(id) {
  ["calendar-container","map-container","camera-container"].forEach(c => {
    document.getElementById(c).style.display = (c===id) ? "block" : "none";
  });
}
