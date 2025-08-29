// index.js
const rightIframe = document.getElementById('rightpanel');
const leftIframe = document.getElementById('leftpanel');
const keyLog = document.getElementById('keyLog');

let mode = "calendar"; // Track current rotating mode
let overlay = null;
let FocusMode = "RightPanel"; // Default

// --- MENU SETUP ---
let menuOpen = false;
let menuOptions = ["Calendar", "Map", "Camera", "Exit Dashie"];
let menuIndex = 0;

// Create the dropdown overlay
const menuOverlay = document.createElement("div");
menuOverlay.id = "menuOverlay";
document.body.appendChild(menuOverlay);

// Add after menuOverlay is created
const hamburgerBtn = document.getElementById("hamburgerBtn");
hamburgerBtn.addEventListener("click", openMenu);

function renderMenu() {
    menuOverlay.innerHTML = menuOptions.map((opt, i) => {
        return i === menuIndex ? `<div class="highlight">${opt}</div>` : `<div>${opt}</div>`;
    }).join("");
}

// --- Unified handler for key input from either JS keydown OR Android bridge ---
function handleRemoteInput(keyCode) {
    keyLog.textContent = `${keyCode}`;

    // --- BLOCK everything in black mode ---
    if (mode === "black") {
        if (keyCode === 179) {
            toggleBlack();
        }
        return;
    }

    // --- MENU MODE ---
    if (menuOpen) {
        switch(keyCode) {
            case 38: // up arrow
                menuIndex = (menuIndex - 1 + menuOptions.length) % menuOptions.length;
                renderMenu();
                break;
            case 40: // down arrow
                menuIndex = (menuIndex + 1) % menuOptions.length;
                renderMenu();
                break;
            case 13: // select / enter
                selectMenuOption(menuOptions[menuIndex]);
                break;
            case 4: // back
                closeMenu();
                break;
        }
        return;
    }

    // --- Normal handling when not black ---
    switch(keyCode) {
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
            if (FocusMode==="LeftPanel") {
                FocusMode = "RightPanel";
                document.body.classList.remove("left-focus"); // remove left focus border
                keyLog.textContent = `Right Panel Focus`;
                sendToFocus("RightFocus-Prev");
            }
            else  sendToFocus("Prev");
            break;
        case 228: // fast forward (Fire TV)
        case 190: // > (period) for PC testing
            if (FocusMode==="LeftPanel") {
                FocusMode = "RightPanel";
                document.body.classList.remove("left-focus"); // remove left focus border
                keyLog.textContent = `Right Panel Focus`;
                sendToFocus("RightFocus-Next");
            }
            else  sendToFocus("Next");
            break;
        case 13: // Enter → rotate modes
            toggleMode();
            break;
        case 4: // Android BACK button
            // handled later if needed
            break;
        case 82: // MENU button
        case 77: // (m) for PC testing
            openMenu();
            break;
    }
}

// --- Keep your old listener for desktop testing ---
document.addEventListener('keydown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleRemoteInput(event.keyCode);
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
            document.body.classList.add("left-focus"); // add focus mode left bottom border
            break;
    }
});

// Toggle through rotating modes (calendar → map → camera → calendar)
function toggleMode() {
    if (mode === "calendar") {
        mode = "map";
        rightIframe.contentWindow.postMessage({ action: "showLocation" }, "*");
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
    const isMorningWindow = (hours === 6 && minutes >= 30 && minutes < 45);

    if (isNight && mode !== "black") {
        toggleBlack(false, true);
    } else if (isMorningWindow && mode !== "black") {
        toggleBlack(false, true);
    } else if (!isNight && !isMorningWindow && mode === "black") {
        toggleBlack(true, false);
    }
}
setInterval(checkAutoMode, 10 * 60 * 1000);

// --- MENU FUNCTIONS ---
function openMenu() {
    menuOpen = true;
    menuIndex = 0;
    menuOverlay.style.display = "block";
    renderMenu();
}

function closeMenu() {
    menuOpen = false;
    menuOverlay.style.display = "none";
}

function selectMenuOption(option) {
    closeMenu();
    switch(option) {
        case "Calendar":
            rightIframe.contentWindow.postMessage({ action: "showCalendar" }, "*");
            break;
        case "Map":
            rightIframe.contentWindow.postMessage({ action: "showLocation" }, "*");
            break;
        case "Camera":
            rightIframe.contentWindow.postMessage({ action: "showCamera" }, "*");
            break;
        case "Exit Dashie":
            if (AndroidApp && AndroidApp.exitApp) AndroidApp.exitApp();
            break;
    }
}
