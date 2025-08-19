const rightIframe = document.getElementById('right');
const leftIframe = document.getElementById('leftpanel');
const keyLog = document.getElementById('keyLog');

let mode = "dashboard"; // Track current mode
let overlay = null;

document.addEventListener('keydown', (event) => {
    event.preventDefault();
    event.stopPropagation();

    keyLog.textContent = `${event.keyCode}`;

    switch(event.keyCode) {
        case 38: // up arrow
            if (mode === "dashboard")
                rightIframe.contentWindow.postMessage({ action: "upCalendar" }, "*");
            break;
        case 40: // down arrow
            if (mode === "dashboard")
                rightIframe.contentWindow.postMessage({ action: "downCalendar" }, "*");
            break;
        case 179: // play/pause
            if (mode === "dashboard")
                leftIframe.contentWindow.postMessage({ action: "change_prev" }, "*");
            break;
        case 227: // rewind
            if (mode === "dashboard")
                rightIframe.contentWindow.postMessage({ action: "prev" }, "*");
            break;
        case 228: // fast forward
            if (mode === "dashboard")
                rightIframe.contentWindow.postMessage({ action: "next" }, "*");
            break;
        case 37: // left arrow
            if (mode === "dashboard")
                rightIframe.contentWindow.postMessage({ action: "prevCalendar" }, "*");
            break;
        case 39: // right arrow
            if (mode === "dashboard")
                rightIframe.contentWindow.postMessage({ action: "nextCalendar" }, "*");
            break;
        case 13: // Enter → toggle modes
            toggleMode();
            break;
    }
});

function toggleMode() {
    if (mode === "dashboard") {
        mode = "black";
        overlay = document.createElement("div");
        overlay.className = "black-overlay";
        document.body.appendChild(overlay);
    } else {
        mode = "dashboard";
        if (overlay) {
            overlay.remove();
            overlay = null;
        }
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
setInterval(checkAutoMode, 15 * 60 * 1000);
// Run immediately at load
checkAutoMode();
