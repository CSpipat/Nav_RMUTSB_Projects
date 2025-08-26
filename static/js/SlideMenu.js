document.addEventListener('DOMContentLoaded', function () {
    const menuButton = document.getElementById('menuButton');
    const sideMenu = document.getElementById('sideMenu');
    const overlay = document.getElementById('overlay');
    const buildingMenus = document.querySelectorAll('.building-menu');
    let isMenuOpen = false;

    function openMainMenu() {
        sideMenu.classList.add('active');
        menuButton.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        isMenuOpen = true;
    }

    function closeMainMenu() {
        sideMenu.classList.remove('active');
        menuButton.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        isMenuOpen = false;
        closeAllBuildingMenus();
    }

    function toggleMainMenu() {
        isMenuOpen ? closeMainMenu() : openMainMenu();
    }

    function toggleBuildingMenu(buildingMenu) {
        const isActive = buildingMenu.classList.contains('active');
        closeAllBuildingMenus();
        if (!isActive) {
            buildingMenu.classList.add('active');
            const icon = buildingMenu.querySelector('.toggle-icon i');
            if (icon) icon.style.transform = 'rotate(180deg)';
        }
    }

    function closeAllBuildingMenus() {
        buildingMenus.forEach(menu => {
            menu.classList.remove('active');
            const icon = menu.querySelector('.toggle-icon i');
            if (icon) icon.style.transform = 'rotate(0deg)';
        });
    }

    // Event Listeners
    menuButton?.addEventListener('click', e => {
        e.stopPropagation();
        toggleMainMenu();
    });

    overlay?.addEventListener('click', closeMainMenu);

    buildingMenus.forEach(menu => {
        menu.querySelector('.building-menu-header')?.addEventListener('click', e => {
            e.stopPropagation();
            toggleBuildingMenu(menu);
        });
    });

    document.addEventListener('click', function (e) {
        if (isMenuOpen && !sideMenu.contains(e.target) && !menuButton.contains(e.target)) {
            closeMainMenu();
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isMenuOpen) closeMainMenu();
    });

    window.addEventListener('resize', function () {
        const isDesktop = window.innerWidth >= 769;
        if (isDesktop && isMenuOpen) closeMainMenu();
        if (menuButton) menuButton.style.display = isDesktop ? 'none' : 'flex';
    });

    const menuLinks = document.querySelectorAll('.building-menu-content a');
    menuLinks.forEach(link => {
        link.addEventListener('click', closeMainMenu);
    });

    // Swipe support
    let touchStartX = 0, touchEndX = 0;
    document.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    });
    document.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchEndX - touchStartX;
        if (diff > 50 && touchStartX < 50 && !isMenuOpen) openMainMenu();
        else if (diff < -50 && isMenuOpen) closeMainMenu();
    });

    window.SlideMenu = {
        open: openMainMenu,
        close: closeMainMenu,
        toggle: toggleMainMenu,
        isOpen: () => isMenuOpen,
        closeAllBuildingMenus: closeAllBuildingMenus
    };

    // Run once for initial responsive state
    const isDesktop = window.innerWidth >= 769;
    if (menuButton) menuButton.style.display = isDesktop ? 'none' : 'flex';

    console.log('Slide Menu initialized successfully');
});
