// leftpanel.js
document.addEventListener("DOMContentLoaded", function() {
  // --- Elements ---
  const agendaFrame = document.getElementById("agenda-frame");
  const photoImg = document.getElementById("photoImg");

  // --- Agenda Setup ---
  const baseUrl = "https://calendar.google.com/calendar/embed?ctz=America/New_York&showTitle=0&showNav=0&showPrint=0&showTabs=0&showCalendars=0&showTz=0&mode=AGENDA&showDate=0";
  const calendars = AGENDA_CALENDARS;


  // --- Agenda Scroll Variables ---
  let agendaScrollY = 0; // Current scroll position
  const scrollStep = 100; // How much to scroll each time
  const maxScroll = 0; // Top position
  const minScroll = -1700; // Maximum scroll down (adjust based on content)

  // --- Photo State ---
  let currentPhotoIndex = 0;
  let shuffledPhotos = [];

  // --- Build Agenda URL ---
  function buildAgendaUrl() {
    const today = new Date();
    const startDate = today.toISOString().slice(0,10).replace(/-/g,'');
    const endDateObj = new Date(today);
    endDateObj.setDate(today.getDate() + 4);
    const endDate = endDateObj.toISOString().slice(0,10).replace(/-/g,'');
    
    let fullUrl = baseUrl + `&dates=${startDate}T000000/${endDate}T235959`;
    calendars.forEach(cal => {
      fullUrl += `&src=${encodeURIComponent(cal.id)}&color=${cal.color}`;
    });
    return fullUrl;
  }

  // --- Initialize Agenda ---
  function initializeAgenda() {
    const fullUrl = buildAgendaUrl();
    agendaFrame.src = fullUrl;
    
    // Auto-refresh every 15 minutes
    setInterval(() => {
      agendaFrame.src = fullUrl + "&t=" + Date.now();
    }, 900000);
  }

  // --- Update Agenda Transform ---
  function updateAgendaTransform() {
    // Combine the scale and translateY transforms
    agendaFrame.style.transform = `scale(0.8) translateY(${agendaScrollY}px)`;
  }

  // --- Photo Functions ---
  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function showPhoto(index) {
    if (index < 0) {
      currentPhotoIndex = shuffledPhotos.length - 1;
    } else if (index >= shuffledPhotos.length) {
      currentPhotoIndex = 0;
    } else {
      currentPhotoIndex = index;
    }
    photoImg.src = shuffledPhotos[currentPhotoIndex] + "?t=" + Date.now();
  }

  function nextPhoto() {
    showPhoto(currentPhotoIndex + 1);
  }

  function prevPhoto() {
    showPhoto(currentPhotoIndex - 1);
  }

  // --- Initialize Photos ---
  function initializePhotos() {
    shuffledPhotos = shuffleArray(photos);
    
    // Handle image load events for proper sizing
    photoImg.onload = function() {
      this.style.visibility = 'hidden';
      this.offsetHeight; // trigger reflow
      this.style.visibility = 'visible';
    };
    
    showPhoto(0);
    
    // Auto-advance every 15 seconds
    setInterval(nextPhoto, 15000);
  }

  // --- Message Handler for Navigation ---
  window.addEventListener('message', (event) => {
    const { action, mode } = event.data || {};
    // if (mode !== "leftpanel") return; // Only respond when left panel is focused - REMOVED, POTENTIALLY ADD A CHECK HERE LATER, BUT FOR NOW THIS FRAME ONLY GETS A MESSAGE WHEN MODE = LEFTPANEL

    switch(action) {
      case "Up":
        // Scroll agenda up
        agendaScrollY = Math.min(agendaScrollY + scrollStep, maxScroll);
        updateAgendaTransform();
        break;
        
      case "Down":
        // Scroll agenda down
        agendaScrollY = Math.max(agendaScrollY - scrollStep, minScroll);
        updateAgendaTransform();
        break;
        
      case "Left":
        // Previous photo
        prevPhoto();
        break;
        
      case "Right":
        // Next photo
        nextPhoto();
        break;
        
      case "LeftFocus":
        // Handle when left panel gets focus (if needed)
        break;
    }
  });

  // --- Initialize Everything ---
  initializeAgenda();
  initializePhotos();
});
