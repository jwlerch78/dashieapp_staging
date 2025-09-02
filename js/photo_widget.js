// photo_widget.js
// photos_widget.js
document.addEventListener("DOMContentLoaded", function() {
  // --- Elements ---
  const photoImg = document.getElementById("photoImg");
  const photoContainer = document.getElementById("photo-container");
  
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

  function resizeImage() {
    const containerWidth = photoContainer.clientWidth - 20; // 10px padding each side
    const containerHeight = photoContainer.clientHeight - 20; // 10px padding each side
    
    // Reset image size to get natural dimensions
    photoImg.style.width = 'auto';
    photoImg.style.height = 'auto';
    photoImg.style.maxWidth = 'none';
    photoImg.style.maxHeight = 'none';
    
    // Force a reflow to get actual image dimensions
    const naturalWidth = photoImg.naturalWidth;
    const naturalHeight = photoImg.naturalHeight;
    
    if (naturalWidth && naturalHeight) {
      // Calculate scale to fit within container
      const scaleX = containerWidth / naturalWidth;
      const scaleY = containerHeight / naturalHeight;
      const scale = Math.min(scaleX, scaleY); // Use smaller scale to ensure it fits
      
      // Apply calculated dimensions
      const newWidth = naturalWidth * scale;
      const newHeight = naturalHeight * scale;
      
      photoImg.style.width = newWidth + 'px';
      photoImg.style.height = newHeight + 'px';
      photoImg.style.maxWidth = newWidth + 'px';
      photoImg.style.maxHeight = newHeight + 'px';
    }
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
      resizeImage();
    };
    
    showPhoto(0);
    
    // Auto-advance every 15 seconds
    setInterval(nextPhoto, 15000);
  }

  // --- Message Handler for Navigation ---
  window.addEventListener('message', (event) => {
    const { action, mode } = event.data || {};
    
    switch(action) {
      case "Up":
        // Previous photo
        prevPhoto();
        break;
        
      case "Down":
        // Next photo
        nextPhoto();
        break;
    }
  });

  // Resize on window resize
  window.addEventListener('resize', resizeImage);

  initializePhotos();
});
