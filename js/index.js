const rightIframe = document.getElementById('rightpanel');
const leftIframe = document.getElementById('leftpanel');
const keyLog = document.getElementById('keyLog');

let mode = "calendar"; // Track current rotating mode
let overlay = null;
let FocusMode = "RightPanel"; // Default

document.addEventListener('keydown', (event) => {
    event.preventDefault();
    event.stopPropagation();

    keyLog.textContent = `${event.keyCode}`;

    // --- BLOCK everything in black mode ---
    if (mode === "black") {
        // Only allow play/pause (179) to toggle black on/off
        if (event.keyCode === 179) {
            toggleBlack();
        }
        return; // ignore everything else
    }

    // --- Normal handling when not black ---
    switch(event.keyCode) {
        case 38: // up arrow
            sendToFocus("Up");
            break;
        case 40: // down arrow
            sendToFocus("Down");
            break;
        case 37: // left arrow
            sendToFocus("Left");
            break;
        case 39: // right arrow
            sendToFocus("Right");
            break;
        case 179: // play/pause → toggle black
            toggleBlack();
            break;
        case 227: // rewind (Fire TV)
        case 188: // < (comma) for PC testing
            sendToFocus("Prev");
            break;
        case 228: // fast forward (Fire TV)
        case 190: // > (period) for PC testing
            if (FocusMode==="LeftPanel") {
                FocusMode = "RightPanel";
                leftPanel.style.borderBottom = "none"; // Google blue
                keyLog.textContent = `Right Panel Focus`;
            }
            else  sendToFocus("Next");
            break;
        case 13: // Enter → rotate modes (but not in black mode)
            toggleMode();
            break;
    }
});

// Helper: send message based on FocusMode
function sendToFocus(action) {
    const msg = { action, mode }; // include current mode
    if (FocusMode === "RightPanel") {
        rightIframe.contentWindow.postMessage(msg, "*");
    } else if (FocusMode === "LeftPanel") {
        leftIframe.contentWindow.postMessage(msg, "*");
    }
}

// --- Listen for messages from iframes to switch focus ---
window.addEventListener('message', (event) => {
    const { action } = event.data || {};
    if (!action) return;

    switch(action) {
        case "focusLeftPanel":
            FocusMode = "LeftPanel";
            keyLog.textContent = `Left Panel Focus`;
            leftPanel.style.borderBottom = "10px solid #4285f4"; // Google blue
            break;
    }
});

// Toggle through rotating modes (calendar → map → camera → calendar)
function toggleMode() {
    if (mode === "calendar") {
        mode = "map";
        rightIframe.contentWindow.postMessage({ action: "showMap" }, "*");
    } else if (mode === "map") {
        mode = "camera";
        rightIframe.contentWindow.postMessage({ action: "showCamera" }, "*");
    } else if (mode === "camera") {
        mode = "calendar";
        rightIframe.contentWindow.postMessage({ action: "showCalendar" }, "*");
    }
}

// Toggle black overlay on/off
function toggleBlack(forceOff = false, forceOn = false) {
    if ((mode === "black" && !forceOn) || forceOff) {
        mode = "calendar"; // Restore default after black
        if (overlay) {
            overlay.remove();
            overlay = null;
        }
        rightIframe.contentWindow.postMessage({ action: "showCalendar" }, "*");
    } else if (mode !== "black" || forceOn) {
        mode = "black";
        overlay = document.createElement("div");
        overlay.className = "black-overlay";
        document.body.appendChild(overlay);
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
function checkAutoMode() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const isNight = (hours >= 22) || (hours < 6 || (hours === 6 && minutes < 30));

    if (isNight && mode !== "black") {
        toggleBlack(false, true); // force ON
    } else if (!isNight && mode === "black") {
        toggleBlack(true, false); // force OFF
    }
}

// Run every 10 minutes
setInterval(checkAutoMode, 10 * 60 * 1000);
