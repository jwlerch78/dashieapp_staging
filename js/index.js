// Keep focus on index.html so key presses work
window.addEventListener("blur", () => window.focus());
window.focus();

function postToFrame(frameId, message) {
  const frame = document.getElementById(frameId);
  if (frame) frame.contentWindow.postMessage(message, "*");
}

document.addEventListener("keydown", (event) => {
  switch (event.key) {
    case "ArrowRight":
      postToFrame("right", { action: "next" });
      break;
    case "ArrowLeft":
      postToFrame("right", { action: "prev" });
      break;
    case "ArrowUp":
      postToFrame("right", { action: "nextCalendar" });
      break;
    case "ArrowDown":
      postToFrame("right", { action: "prevCalendar" });
      break;
    case "Enter":
      postToFrame("right", { action: "SelectButton" });
      break;
    case "PageUp":
      postToFrame("leftpanel", { action: "change_next" });
      break;
    case "PageDown":
      postToFrame("leftpanel", { action: "change_prev" });
      break;
  }
});
