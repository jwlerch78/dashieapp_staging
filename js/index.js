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
