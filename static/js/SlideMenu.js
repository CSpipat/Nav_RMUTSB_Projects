document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const menuButton = document.getElementById('menuButton');
    const sideMenu = document.getElementById('sideMenu');
    const overlay = document.getElementById('overlay');

    // Building menu elements
    const buildingMenus = document.querySelectorAll('.building-menu');

    // Initialize menu state
    let isMenuOpen = false;

    // Toggle main slide menu
    function toggleMainMenu() {
        isMenuOpen = !isMenuOpen;

        if (isMenuOpen) {
            openMainMenu();
        } else {
            closeMainMenu();
        }
    }

    // Open main menu
    function openMainMenu() {
        sideMenu.classList.add('active');
        menuButton.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        isMenuOpen = true;
    }

    // Close main menu
    function closeMainMenu() {
        sideMenu.classList.remove('active');
        menuButton.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
        isMenuOpen = false;

        // Close any open building menus when main menu closes
        closeAllBuildingMenus();
    }

    // Toggle building menu
    function toggleBuildingMenu(buildingMenu) {
        const isCurrentlyActive = buildingMenu.classList.contains('active');

        // Close all building menus first
        closeAllBuildingMenus();

        // If the clicked menu wasn't active, open it
        if (!isCurrentlyActive) {
            buildingMenu.classList.add('active');

            // Rotate the icon
            const icon = buildingMenu.querySelector('.toggle-icon i');
            if (icon) {
                icon.style.transform = 'rotate(180deg)';
            }
        }
    }

    // Close all building menus
    function closeAllBuildingMenus() {
        buildingMenus.forEach(menu => {
            menu.classList.remove('active');
            const icon = menu.querySelector('.toggle-icon i');
            if (icon) {
                icon.style.transform = 'rotate(0deg)';
            }
        });
    }

    // Event Listeners

    // Main menu button click
    if (menuButton) {
        menuButton.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleMainMenu();
        });
    }

    // Overlay click to close menu
    if (overlay) {
        overlay.addEventListener('click', closeMainMenu);
    }

    // Building menu headers click
    buildingMenus.forEach(buildingMenu => {
        const header = buildingMenu.querySelector('.building-menu-header');
        if (header) {
            header.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleBuildingMenu(buildingMenu);
            });
        }
    });

    // Close menu when clicking outside (for desktop)
    document.addEventListener('click', function(event) {
        // Only close if menu is open and click is outside menu area
        if (isMenuOpen &&
            !sideMenu.contains(event.target) &&
            !menuButton.contains(event.target)) {
            closeMainMenu();
        }
    });

    // Handle keyboard navigation
    document.addEventListener('keydown', function(event) {
        // Close menu on Escape key
        if (event.key === 'Escape' && isMenuOpen) {
            closeMainMenu();
        }
    });

    // Handle responsive changes
    function handleResponsiveChange() {
        const isDesktop = window.innerWidth >= 769;

        if (isDesktop && isMenuOpen) {
            // Close menu when switching to desktop view
            closeMainMenu();
        }

        // Show/hide menu button based on screen size
        if (menuButton) {
            menuButton.style.display = isDesktop ? 'none' : 'flex';
        }
    }

    // Listen for window resize
    window.addEventListener('resize', handleResponsiveChange);

    // Initial responsive check
    handleResponsiveChange();

    // Smooth scrolling for menu links
    const menuLinks = document.querySelectorAll('.building-menu-content a');
    menuLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Add any navigation logic here if needed
            // For now, just close the menu when a link is clicked
            closeMainMenu();
        });
    });

    // Add touch support for mobile devices
    let touchStartX = 0;
    let touchEndX = 0;

    // Touch start
    document.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
    });

    // Touch end
    document.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipeGesture();
    });

    // Handle swipe gestures
    function handleSwipeGesture() {
        const swipeThreshold = 50;
        const swipeDistance = touchEndX - touchStartX;

        // Swipe right to open menu (only if menu is closed and swipe starts from left edge)
        if (swipeDistance > swipeThreshold && touchStartX < 50 && !isMenuOpen) {
            openMainMenu();
        }

        // Swipe left to close menu (only if menu is open)
        if (swipeDistance < -swipeThreshold && isMenuOpen) {
            closeMainMenu();
        }
    }

    // Utility function to get building name from menu
    function getBuildingName(buildingMenu) {
        const header = buildingMenu.querySelector('.building-menu-header span');
        return header ? header.textContent.trim() : '';
    }

    // Public API for external scripts
    window.SlideMenu = {
        open: openMainMenu,
        close: closeMainMenu,
        toggle: toggleMainMenu,
        isOpen: () => isMenuOpen,
        closeAllBuildingMenus: closeAllBuildingMenus
    };

    // Debug logging (remove in production)
    console.log('Slide Menu initialized successfully');
    console.log('Found building menus:', buildingMenus.length);
});