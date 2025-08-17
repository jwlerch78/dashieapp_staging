// index.js

document.addEventListener("keydown", (event) => {
  // Prevent default browser behavior (like moving focus between iframes)
  event.preventDefault();
  event.stopPropagation();

  const iframe = document.getElementById("calendarFrame"); // calendar iframe
  if (!iframe) return;

  let command = null;

  switch (event.key) {
    case "ArrowRight":
      command = "nextCal";
      break;
    case "ArrowLeft":
      command = "prevCal";
      break;
    case "ArrowUp":
      command = "up";
      break;
    case "ArrowDown":
      command = "down";
      break;
    case "Enter":
      command = "SelectButton";
      break;
  }

  if (command) {
    iframe.contentWindow.postMessage(command, "*");
  }
});
