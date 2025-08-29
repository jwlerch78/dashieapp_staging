// index.js
const rightIframe = document.getElementById('rightpanel');
const leftIframe = document.getElementById('leftpanel');
const keyLog = document.getElementById('keyLog');

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

// --- Render menu ---
function renderMenu() {
    if (!menuOverlay) return;
    menuOverlay.innerHTML = menuOptions.map((opt, i) => {
        if (opt === "---") return `<hr style="border:0; border-top:1px solid rgba(255,255,255,0.3); margin:4px 0;">`;
        const highlightClass = (i === menuIndex) ? "highlight" : "";
        return `<div class="menu-item ${highlightClass}" data-index="${i}">${opt}</div>`;
    }).join("");

    // Bind click & hover for mouse/touch
    const items = menuOverlay.querySelectorAll(".menu-item");
    items.forEach(el => {
        const idx = parseInt(el.getAttribute("data-index"));
        el.addEventListener("click", () => selectMenuOption(menuOptions[idx]));
        el.addEventListener("mouseover", () => {
            menuIndex = idx;
            renderMenu();
        });
    });
}


function openMenu() {
    if (!menuOverlay) return;
    menuOpen = true;
    menuIndex = 0;
    menuOverlay.style.display = "block";
    renderMenu();
}

function closeMenu() {
    if (!menuOverlay) return;
    menuOpen = false;
    menuOverlay.style.display = "none";
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

// --- Menu selection ---
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
    document.addEventListener('keydown', e => {
        e.preventDefault();
        e.stopPropagation();
        handleRemoteInput(e.keyCode);
    });
});

// --- Send message to focus iframe ---
function sendToFocus(action) { 
    const msg={action, mode};
    if(FocusMode==="RightPanel") rightIframe.contentWindow.postMessage(msg,"*");
    else if(FocusMode==="LeftPanel") leftIframe.contentWindow.postMessage(msg,"*");
}

// --- Listen for iframe messages ---
window.addEventListener('message', (event)=>{
    const { action } = event.data || {};
    if (!action) return;
    if (action==="focusLeftPanel") { FocusMode="LeftPanel"; document.body.classList.add("left-focus"); }
});

// --- Rotating mode ---
function toggleMode() {
    if(mode==="calendar"){ mode="map"; rightIframe.contentWindow.postMessage({action:"showLocation"},"*"); }
    else if(mode==="map"){ mode="camera"; rightIframe.contentWindow.postMessage({action:"showCamera"},"*"); }
    else { mode="calendar"; rightIframe.contentWindow.postMessage({action:"showCalendar"},"*"); }
}

// --- Black overlay ---
function toggleBlack(forceOff=false, forceOn=false){
    if((mode==="black" && !forceOn) || forceOff){ 
        mode="calendar"; 
        if(overlay){ overlay.remove(); overlay=null; } 
        rightIframe.contentWindow.postMessage({action:"showCalendar"},"*"); 
    } else if(mode!=="black" || forceOn){ 
        mode="black"; 
        overlay=document.createElement("div"); 
        overlay.className="black-overlay"; 
        document.body.appendChild(overlay); 
    }
}

// --- Dashboard focus ---
function focusDashboard(){ window.focus(); document.body.focus(); }
focusDashboard();
rightIframe.addEventListener('load', focusDashboard);
setInterval(focusDashboard,1000);

// --- Auto black/dash schedule ---
function checkAutoMode(){
    const now=new Date();
    const hours=now.getHours(), minutes=now.getMinutes();
    const isNight=(hours>=22)||(hours<6||(hours===6&&minutes<30));
    const isMorningWindow=(hours===6&&minutes>=30&&minutes<45);
    if(isNight && mode!=="black") toggleBlack(false,true);
    else if(isMorningWindow && mode!=="black") toggleBlack(false,true);
    else if(!isNight && !isMorningWindow && mode==="black") toggleBlack(true,false);
}
setInterval(checkAutoMode,10*60*1000);
