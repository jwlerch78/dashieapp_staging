// index.js - COMPLETE VERSION WITH WIDGET SYSTEM
const rightIframe = document.getElementById('rightpanel');
const keyLog = document.getElementById('keyLog');

// Get all iframes that might interfere with touch
const allIframes = document.querySelectorAll('iframe');

// --- Widget Configuration ---
const widgets = {
    rightBottom: {
        current: "calendar",
        options: {
            calendar: "widget_calendar.html",
            map: "widget_map.html", 
            camera: "widget_camera.html"
        }
    }
    // Future: you could add other locations like leftTop, leftMiddle, etc.
};

// --- State ---
let mode = "calendar";
let overlay = null;
let FocusMode = "RightPanel";

// --- MENU ---
let menuOpen = false;
let menuOptions = ["Calendar", "Map", "Camera", "---", "Reload Dashie", "---", "Exit Dashie"];
let menuIndex = 0;

const menuOverlay = document.getElementById("menuOverlay");
const hamburgerBtn = document.getElementById("hamburgerBtn");

hamburgerBtn?.addEventListener("click", openMenu);

// --- Exit popup ---
const exitPopup = document.getElementById("exitPopup");
const exitYesBtn = document.getElementById("exitYes");
const exitNoBtn = document.getElementById("exitNo");
let exitChoiceIndex = 0; // 0=Yes, 1=No

exitYesBtn?.addEventListener("click", () => {
    if (AndroidApp && AndroidApp.exitApp) {
        AndroidApp.exitApp();
    } else {
        console.log("Exit Dashie triggered (desktop fallback)");
        window.location.href = "about:blank";
    }
});

exitNoBtn?.addEventListener("click", hideExitPopup);

function highlightExitChoice() {
    exitYesBtn.classList.toggle("highlight", exitChoiceIndex === 0);
    exitNoBtn.classList.toggle("highlight", exitChoiceIndex === 1);
}

// --- Widget Management Functions ---
function switchWidget(location, widgetType) {
    const widgetConfig = widgets[location];
    if (!widgetConfig || !widgetConfig.options[widgetType]) {
        console.error(`Invalid widget: ${location} -> ${widgetType}`);
        return;
    }

    const widgetUrl = widgetConfig.options[widgetType];
    widgetConfig.current = widgetType;
    mode = widgetType; // Update global mode

    console.log(`Switching ${location} to ${widgetType} (${widgetUrl})`);

    // Update the iframe source
    if (location === "rightBottom") {
        const rightIframe = document.getElementById('rightpanel');
        if (rightIframe) {
            rightIframe.src = widgetUrl;
        }
    }

    // Handle special widget interactions
    handleWidgetInteractions(widgetType);
}

function handleWidgetInteractions(widgetType) {
    const locationFrame = document.getElementById("location-frame");
    
    switch(widgetType) {
        case "map":
            // Tell location widget to expand/show more details
            if (locationFrame && locationFrame.contentWindow) {
                locationFrame.contentWindow.postMessage(
                    { action: "enterLocationMode" }, "*"
                );
            }
            break;
        
        case "calendar":
        case "camera":
            // Tell location widget to collapse
            if (locationFrame && locationFrame.contentWindow) {
                locationFrame.contentWindow.postMessage(
                    { action: "exitLocationMode" }, "*"
                );
            }
            break;
    }
}

// --- Render menu ---
function renderMenu() {
    if (!menuOverlay) return;

    menuOverlay.innerHTML = menuOptions.map((opt, i) => {
        if (opt === "---") {
            return `<hr style="border:0; border-top:1px solid rgba(255,255,255,0.3); margin:4px 0;">`;
        }
        const highlightClass = (i === menuIndex) ? "highlight" : "";
        return `<div class="menu-item ${highlightClass}" data-index="${i}">${opt}</div>`;
    }).join("");

    // --- Bind mouse click and hover listeners ---
    const items = menuOverlay.querySelectorAll(".menu-item");
    items.forEach(el => {
        const idx = parseInt(el.getAttribute("data-index"));

        // Mouse click selects the menu option
        el.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectMenuOption(menuOptions[idx]);
        });

        // Hover updates highlight (but don't re-render immediately)
        el.addEventListener("mouseover", () => {
            menuIndex = idx;
            // Update highlight without full re-render to prevent click issues
            items.forEach((item, i) => {
                item.classList.toggle("highlight", i === idx);
            });
        });
    });
}

// --- Menu functions with proper touch support ---
function openMenu() {
    menuOpen = true;
    menuIndex = 0;
    menuOverlay.style.display = "block";
    
    // Disable pointer events on all iframes to prevent touch interference
    allIframes.forEach(iframe => {
        iframe.style.pointerEvents = "none";
    });
    
    renderMenu();
}

function closeMenu() {
    menuOpen = false;
    menuOverlay.style.display = "none";
    
    // Re-enable pointer events on all iframes
    allIframes.forEach(iframe => {
        iframe.style.pointerEvents = "auto";
    });
}

function showExitPopup() {
    if (exitPopup) {
        exitPopup.style.display = "flex";
        exitChoiceIndex = 0;
        highlightExitChoice();
    }
}

function hideExitPopup() {
    if (exitPopup) exitPopup.style.display = "none";
}

// --- Updated Menu Selection Function ---
function selectMenuOption(option) {
    closeMenu();
    switch(option) {
        case "Calendar":
            switchWidget("rightBottom", "calendar");
            break;
        case "Map":
            switchWidget("rightBottom", "map");
            break;
        case "Camera":
            switchWidget("rightBottom", "camera");
            break;
        case "Reload Dashie":
            window.location.reload();
            break;
        case "Exit Dashie":
            showExitPopup();
            break;
    }
}

// --- Key handling ---
function handleRemoteInput(keyCode) {
    keyLog.textContent = `${keyCode}`;

    // BLACK MODE
    if (mode === "black") {
        if (keyCode === 179) toggleBlack();
        return;
    }

    // BACK / ESC
    if (keyCode === 4 || keyCode === 27) {
        if (menuOpen) { closeMenu(); return; }
        else if (exitPopup && exitPopup.style.display === "flex") { hideExitPopup(); return; }
        else { showExitPopup(); return; }
    }

    // EXIT POPUP NAVIGATION
    if (exitPopup && exitPopup.style.display === "flex") {
        switch(keyCode) {
            case 37: // left
            case 39: // right
                exitChoiceIndex = 1 - exitChoiceIndex; // toggle
                highlightExitChoice();
                break;
            case 13: // enter
                if(exitChoiceIndex === 0) exitYesBtn.click();
                else exitNoBtn.click();
                break;
        }
        return;
    }

    // MENU NAVIGATION
    if (menuOpen) {
        switch(keyCode) {
            case 38: // Up
                do { menuIndex = (menuIndex - 1 + menuOptions.length) % menuOptions.length; }
                while(menuOptions[menuIndex] === "---");
                renderMenu();
                break;
            case 40: // Down
                do { menuIndex = (menuIndex + 1) % menuOptions.length; }
                while(menuOptions[menuIndex] === "---");
                renderMenu();
                break;
            case 13: // Enter
                selectMenuOption(menuOptions[menuIndex]);
                break;
        }
        return;
    }

    // --- Default focus handling ---
    switch(keyCode) {
        case 38: sendToFocus("Up"); break;
        case 40: sendToFocus("Down"); break;
        case 37: sendToFocus("Left"); break;
        case 39: sendToFocus("Right"); break;
        case 179: toggleBlack(); break;
        case 227: case 188:
            if(FocusMode==="LeftPanel"){ FocusMode="RightPanel"; document.body.classList.remove("left-focus"); sendToFocus("RightFocus-Prev");} 
            else sendToFocus("Prev"); 
            break;
        case 228: case 190:
            if(FocusMode==="LeftPanel"){ FocusMode="RightPanel"; document.body.classList.remove("left-focus"); sendToFocus("RightFocus-Next");} 
            else sendToFocus("Next"); 
            break;
        case 13: toggleMode(); break;
        case 82: // R key
        case 77: // M key for PC menu testing
            openMenu();
            break;
    }
}

// --- Listeners ---
window.addEventListener('DOMContentLoaded', () => {
    // Set initial widget
    switchWidget("rightBottom", "calendar");
    
    document.addEventListener('keydown', e => {
        e.preventDefault();
        e.stopPropagation();
        handleRemoteInput(e.keyCode);
    });
});

// --- Send message to focus iframe ---
function sendToFocus(action) { 
    const msg = { action, mode };
    if(FocusMode === "RightPanel") {
        const rightIframe = document.getElementById('rightpanel');
        if (rightIframe && rightIframe.contentWindow) {
            rightIframe.contentWindow.postMessage(msg, "*");
        }
    } else if(FocusMode === "LeftPanel") {
        // Left panel focus handling - you may need to implement this based on your needs
        console.log("Left panel focus not implemented");
    }
}

// --- Listen for iframe messages ---
window.addEventListener('message', (event) => {
    const { action } = event.data || {};
    if (!action) return;
    if (action === "focusLeftPanel") { 
        FocusMode = "LeftPanel"; 
        document.body.classList.add("left-focus"); 
    }
});

// --- Updated Toggle Mode Function ---
function toggleMode() {
    const currentWidget = widgets.rightBottom.current;
    
    if(currentWidget === "calendar") { 
        switchWidget("rightBottom", "map");
    }
    else if(currentWidget === "map") { 
        switchWidget("rightBottom", "camera");
    }
    else { 
        switchWidget("rightBottom", "calendar");
    }
}

// --- Black overlay ---
function toggleBlack(forceOff = false, forceOn = false) {
    if((mode === "black" && !forceOn) || forceOff) { 
        switchWidget("rightBottom", "calendar");
        if(overlay) { 
            overlay.remove(); 
            overlay = null; 
        } 
    } else if(mode !== "black" || forceOn) { 
        mode = "black"; 
        overlay = document.createElement("div"); 
        overlay.className = "black-overlay"; 
        document.body.appendChild(overlay); 
    }
}

// --- Dashboard focus ---
function focusDashboard() { 
    window.focus(); 
    document.body.focus(); 
}

focusDashboard();

// Focus dashboard when right iframe loads
const rightIframe = document.getElementById('rightpanel');
if (rightIframe) {
    rightIframe.addEventListener('load', focusDashboard);
}

setInterval(focusDashboard, 1000);

// --- Auto black/dash schedule ---
function checkAutoMode() {
    const now = new Date();
    const hours = now.getHours(), minutes = now.getMinutes();
    const isNight = (hours >= 22) || (hours < 6 || (hours === 6 && minutes < 30));
    const isMorningWindow = (hours === 6 && minutes >= 30 && minutes < 45);
    
    if(isNight && mode !== "black") toggleBlack(false, true);
    else if(isMorningWindow && mode !== "black") toggleBlack(false, true);
    else if(!isNight && !isMorningWindow && mode === "black") toggleBlack(true, false);
}

setInterval(checkAutoMode, 10 * 60 * 1000);
