const rightIframe = document.getElementById('rightpanel');
const leftIframe = document.getElementById('leftpanel');
const keyLog = document.getElementById('keyLog');

let mode = "calendar"; // Track current mode
let overlay = null;

document.addEventListener('keydown', (event) => {
    event.preventDefault();
    event.stopPropagation();

    keyLog.textContent = `${event.keyCode}`;

switch(event.keyCode) {
    case 38: // up arrow
        if (mode === "calendar")
            rightIframe.contentWindow.postMessage({ action: "upCalendar" }, "*");
        break;
    case 40: // down arrow
        if (mode === "calendar")
            rightIframe.contentWindow.postMessage({ action: "downCalendar" }, "*");
        break;
    case 179: // play/pause
        if (mode === "calendar")
            leftIframe.contentWindow.postMessage({ action: "change_prev" }, "*");
        break;
    case 227: // rewind (Fire TV)
    case 188: // < (comma) for PC testing
        if (mode === "calendar")
            rightIframe.contentWindow.postMessage({ action: "prev" }, "*");
        break;
    case 228: // fast forward (Fire TV)
    case 190: // > (period) for PC testing
        if (mode === "calendar")
            rightIframe.contentWindow.postMessage({ action: "next" }, "*");
        break;
    case 37: // left arrow
        if (mode === "calendar")
            rightIframe.contentWindow.postMessage({ action: "prevCalendar" }, "*");
        break;
    case 39: // right arrow
        if (mode === "calendar")
            rightIframe.contentWindow.postMessage({ action: "nextCalendar" }, "*");
        break;
    case 13: // Enter → toggle modes
        toggleMode();
        break;
}
});

function toggleMode() {
    if (mode === "calendar") {
        // Switch to map view
        mode = "map";
        rightIframe.contentWindow.postMessage({ action: "showMap" }, "*");
    } else if (mode === "map") {
        // Switch to camera view
        mode = "camera";
        rightIframe.contentWindow.postMessage({ action: "showCamera" }, "*");
    } else if (mode === "camera") {
        // Switch to black overlay
        mode = "black";
        overlay = document.createElement("div");
        overlay.className = "black-overlay";
        document.body.appendChild(overlay);
    } else if (mode === "black") {
        // Cycle back to calendar
        mode = "calendar";
        if (overlay) {
            overlay.remove();
            overlay = null;
        }
        rightIframe.contentWindow.postMessage({ action: "showCalendar" }, "*");
    }
}



// Keep focus on dashboard
function focusDashboard() {
    window.focus();
    document.body.focus();
}
focusDashboard();
rightIframe.addEventListener('load', focusDashboard);
setInterval(focusDashboard, 1000);

// --- Auto black/dash schedule ---
function updateDisplayMode() {
    // Re-use toggleMode() style logic but force mode
    if (mode === "black") {
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.className = "black-overlay";
            document.body.appendChild(overlay);
        }
    } else {
        if (overlay) {
            overlay.remove();
            overlay = null;
        }
    }
}

function checkAutoMode() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Quiet hours = 10:00pm → 6:29am
    const isNight = (hours >= 22) || (hours < 6 || (hours === 6 && minutes < 30));

    if (isNight && mode !== "black") {
        mode = "black";
        updateDisplayMode();
    } else if (!isNight && mode !== "dashboard") {
        mode = "dashboard";
        updateDisplayMode();
    }
}

// Run every 15 minutes
setInterval(checkAutoMode, 10 * 60 * 1000);

