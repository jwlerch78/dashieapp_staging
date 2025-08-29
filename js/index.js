// index.js
const rightIframe = document.getElementById('rightpanel');
const leftIframe = document.getElementById('leftpanel');
const keyLog = document.getElementById('keyLog');

let mode = "calendar";
let overlay = null;
let FocusMode = "RightPanel";

// --- MENU ---
let menuOpen = false;
let menuOptions = ["Calendar", "Map", "Camera", "Exit Dashie"];
let menuIndex = 0;

const menuOverlay = document.getElementById("menuOverlay");
const hamburgerBtn = document.getElementById("hamburgerBtn");
hamburgerBtn.addEventListener("click", openMenu);

// --- Exit popup ---
const exitPopup = document.getElementById("exitPopup");
const exitYesBtn = document.getElementById("exitYes");
const exitNoBtn = document.getElementById("exitNo");

exitYesBtn.addEventListener("click", () => {
    if (AndroidApp && AndroidApp.exitApp) AndroidApp.exitApp();
});
exitNoBtn.addEventListener("click", hideExitPopup);

function renderMenu() {
    menuOverlay.innerHTML = menuOptions.map((opt, i) => {
        const highlightClass = (i === menuIndex) ? "highlight" : "";
        return `<div class="${highlightClass}" onclick="selectMenuOption('${opt}')">${opt}</div>`;
    }).join("");
}

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

function showExitPopup() { exitPopup.style.display = "flex"; }
function hideExitPopup() { exitPopup.style.display = "none"; }

function selectMenuOption(option) {
    closeMenu();
    switch(option) {
        case "Calendar": rightIframe.contentWindow.postMessage({ action: "showCalendar" }, "*"); break;
        case "Map": rightIframe.contentWindow.postMessage({ action: "showLocation" }, "*"); break;
        case "Camera": rightIframe.contentWindow.postMessage({ action: "showCamera" }, "*"); break;
        case "Exit Dashie": showExitPopup(); break;
    }
}

// --- Key handling ---
function handleRemoteInput(keyCode) {
    keyLog.textContent = `${keyCode}`;

    if (mode === "black") { if (keyCode===179) toggleBlack(); return; }

    // BACK / Escape
    if (keyCode === 4 || keyCode === 27) {
        if (menuOpen) { closeMenu(); return; }
        else if (exitPopup.style.display !== "flex") { showExitPopup(); return; }
    }

    // MENU navigation
    if (menuOpen) {
        switch(keyCode) {
            case 38: menuIndex = (menuIndex - 1 + menuOptions.length) % menuOptions.length; renderMenu(); break;
            case 40: menuIndex = (menuIndex + 1) % menuOptions.length; renderMenu(); break;
            case 13: selectMenuOption(menuOptions[menuIndex]); break;
        }
        return;
    }

    switch(keyCode) {
        case 38: sendToFocus("Up"); break;
        case 40: sendToFocus("Down"); break;
        case 37: sendToFocus("Left"); break;
        case 39: sendToFocus("Right"); break;
        case 179: toggleBlack(); break;
        case 227: case 188: if(FocusMode==="LeftPanel"){ FocusMode="RightPanel"; document.body.classList.remove("left-focus"); sendToFocus("RightFocus-Prev");} else sendToFocus("Prev"); break;
        case 228: case 190: if(FocusMode==="LeftPanel"){ FocusMode="RightPanel"; document.body.classList.remove("left-focus"); sendToFocus("RightFocus-Next");} else sendToFocus("Next"); break;
        case 13: toggleMode(); break;
        case 82: case 77: openMenu(); break;
    }
}

document.addEventListener('keydown', e=>{ e.preventDefault(); e.stopPropagation(); handleRemoteInput(e.keyCode); });

function sendToFocus(action) { 
    const msg={action, mode};
    if(FocusMode==="RightPanel") rightIframe.contentWindow.postMessage(msg,"*");
    else if(FocusMode==="LeftPanel") leftIframe.contentWindow.postMessage(msg,"*");
}

window.addEventListener('message', (event)=>{
    const { action } = event.data || {};
    if (!action) return;
    if (action==="focusLeftPanel") { FocusMode="LeftPanel"; document.body.classList.add("left-focus"); }
});

// Rotating mode
function toggleMode() {
    if(mode==="calendar"){ mode="map"; rightIframe.contentWindow.postMessage({action:"showLocation"},"*"); }
    else if(mode==="map"){ mode="camera"; rightIframe.contentWindow.postMessage({action:"showCamera"},"*"); }
    else { mode="calendar"; rightIframe.contentWindow.postMessage({action:"showCalendar"},"*"); }
}

// Black overlay
function toggleBlack(forceOff=false, forceOn=false){
    if((mode==="black" && !forceOn) || forceOff){ mode="calendar"; if(overlay){ overlay.remove(); overlay=null; } rightIframe.contentWindow.postMessage({action:"showCalendar"},"*"); }
    else if(mode!=="black" || forceOn){ mode="black"; overlay=document.createElement("div"); overlay.className="black-overlay"; document.body.appendChild(overlay); }
}

// Dashboard focus
function focusDashboard(){ window.focus(); document.body.focus(); }
focusDashboard();
rightIframe.addEventListener('load', focusDashboard);
setInterval(focusDashboard,1000);

// Auto black/dash schedule
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
