document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const menuButton = document.getElementById('menuButton');
    const closeButton = document.getElementById('closeMenu');
    const slideMenu = document.getElementById('slideMenu');
    
    // Toggle menu function
    function toggleMenu() {
        // If menu has 'open' class, remove it; otherwise, add it
        if (slideMenu.classList.contains('open')) {
            slideMenu.classList.remove('open');
        } else {
            slideMenu.classList.add('open');
        }
    }
    
    // Open menu when menu button is clicked
    menuButton.addEventListener('click', toggleMenu);
    
    // Close menu when close button is clicked
    closeButton.addEventListener('click', toggleMenu);
    
    // Optional: Close menu when clicking outside of it
    document.addEventListener('click', function(event) {
        // If click is outside menu and menu button, and menu is open
        if (!slideMenu.contains(event.target) && 
            !menuButton.contains(event.target) && 
            slideMenu.classList.contains('open')) {
            slideMenu.classList.remove('open');
        }
    });
    
    // Function to handle responsive state changes
    function handleResponsiveChange(mediaQuery) {
        if (!mediaQuery.matches && slideMenu.classList.contains('open')) {
            // If screen width becomes larger than 1198.98px and menu is open, close it
            slideMenu.classList.remove('open');
        }
    }
    
    // Create a media query list object to detect screen width changes
    const mediaQuery = window.matchMedia('(max-width: 1198.98px)');
    
    // Add listener for changes
    mediaQuery.addEventListener('change', handleResponsiveChange);
    
    // Initial check on page load
    handleResponsiveChange(mediaQuery);
});