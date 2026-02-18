// ============================================
// LASER DEFENDER - Retro Start Screen
// ============================================
// This file handles the start screen interaction
// When the "INSERT COIN" button is clicked, it launches the game
// The start screen features a retro Minecraft-inspired design
// with pixel art aesthetics that match the game in project.html
// ============================================

// ============================================
// DOM Content Loaded Event
// This ensures the HTML is fully loaded before
// attempting to access DOM elements
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  // Get the start button element
  const startBtn = document.getElementById("startBtn");

  // Check if button exists (safety check)
  if (startBtn) {
    // Add click event listener to the start button
    startBtn.addEventListener("click", () => {
      // Navigate to the game page (project.html)
      // This immediately launches the game without showing the menu
      window.location.href = "project.html";
    });
  }
});

// ============================================
// END OF SCRIPT
// ============================================
```

Now let me add comprehensive comments to the CSS file as well:
