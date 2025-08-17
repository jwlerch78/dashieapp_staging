// index.js

const rightIframe = document.getElementById('right');
const leftIframe = document.getElementById('leftpanel');
const keyLog = document.getElementById('keyLog');

document.addEventListener('keydown', (event) => {
    // Prevent default iframe focus behavior
    event.preventDefault();
    event.stopPropagation();

    keyLog.textContent = `${event.keyCode}`;

    switch(event.keyCode) {
        case 38: // up arrow → Scroll up on calendar
            rightIframe.contentWindow.postMessage({ action: "upCalendar" }, "*");
            break;
        case 40: // down arrow → Scroll down on calendar
            rightIframe.contentWindow.postMessage({ action: "downCalendar" }, "*");
            break;
        case 179: // play/pause → leftpanel prev
            leftIframe.contentWindow.postMessage({ action: "change_prev" }, "*");
            break;
        case 227: // Rewind → prev date range
            rightIframe.contentWindow.postMessage({ action: "prev" }, "*");
            break;
        case 228: // Fast Forward → next date range
            rightIframe.contentWindow.postMessage({ action: "next" }, "*");
            break;
        case 37: // Left arrow → prev calendar set
            rightIframe.contentWindow.postMessage({ action: "prevCalendar" }, "*");
            break;
        case 39: // Right arrow → next calendar set
            rightIframe.contentWindow.postMessage({ action: "nextCalendar" }, "*");
            break;
        case 13: // Enter → toggle family locations
            rightIframe.contentWindow.postMessage({ action: "SelectButton" }, "*");
            break;
    }
});

// Keep focus on dashboard
function focusDashboard() {
    window.focus();
    document.body.focus();
}
focusDashboard();
rightIframe.addEventListener('load', focusDashboard);
setInterval(focusDashboard, 1000);
