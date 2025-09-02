// photo_widget.js - simplified without iframe messaging
document.addEventListener("DOMContentLoaded", function() {
  // --- Elements ---
  const photoImg = document.getElementById("photoImg");
  
  // --- Photo State ---
  let currentPhotoIndex = 0;
  let shuffledPhotos = [];
 
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

  // Make functions globally available for navigation
  window.photoNextPhoto = nextPhoto;
  window.photoPrevPhoto = prevPhoto;

  // --- Initialize Photos ---
  function initializePhotos() {
    shuffledPhotos = shuffleArray(photos);
    showPhoto(0);
    
    // Auto-advance every 15 seconds
    setInterval(nextPhoto, 15000);
  }

  initializePhotos();
});
