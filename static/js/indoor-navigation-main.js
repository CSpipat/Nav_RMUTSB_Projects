// ======= Indoor Navigation Integration JavaScript =======
// ===== Vanilla Modal Controller =====
const Modal = (() => {
  let lastFocused = null;
  let escHandler = null;
  let focusTrapHandler = null;
  let observer = null;

  function open(modalEl) {
    if (!modalEl) return;
    lastFocused = document.activeElement;

    // show
    modalEl.hidden = false;
    requestAnimationFrame(() => modalEl.classList.add('is-open'));

    // lock scroll
    document.documentElement.style.overflow = 'hidden';

    // backdrop & close buttons
    modalEl.addEventListener('click', clickToClose);

    // Esc
    escHandler = (e) => { if (e.key === 'Escape') close(modalEl); };
    document.addEventListener('keydown', escHandler);

    // Focus trap
    trapFocus(modalEl);

    // custom event (แทน shown.bs.modal)
    modalEl.dispatchEvent(new CustomEvent('modal:shown', { bubbles: true }));
  }

  function close(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('is-open');

    // wait transition then hide
    const onEnd = () => {
      modalEl.hidden = true;
      modalEl.removeEventListener('transitionend', onEnd);
    };
    modalEl.addEventListener('transitionend', onEnd);

    // unlock scroll
    document.documentElement.style.overflow = '';

    modalEl.removeEventListener('click', clickToClose);
    document.removeEventListener('keydown', escHandler);
    releaseFocus();

    // custom event
    modalEl.dispatchEvent(new CustomEvent('modal:hidden', { bubbles: true }));

    // restore focus
    if (lastFocused && lastFocused.focus) { lastFocused.focus(); }
  }

  function clickToClose(e) {
    const target = e.target;
    if (target.matches('[data-close="true"]') || target.classList.contains('app-modal__backdrop')) {
      const modalEl = e.currentTarget; // root modal
      close(modalEl);
    }
  }

  function trapFocus(modalEl) {
    const focusables = modalEl.querySelectorAll(
      'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (first) first.focus();

    focusTrapHandler = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', focusTrapHandler);

    observer = new ResizeObserver(() => {});
    observer.observe(modalEl);
  }

  function releaseFocus() {
    document.removeEventListener('keydown', focusTrapHandler);
    if (observer) { observer.disconnect(); observer = null; }
  }

  return { open, close };
})();

// Global variables for indoor navigation
let currentBuildingId = null;
let currentFloor = null;

// Animation variables
let animationId = null;
let pulsePhase = 0;
let pathProgress = 0;
let isAnimating = false;

// Initialize on load
document.addEventListener('DOMContentLoaded', function () {
  initializeIndoorNavigation();
});

function initializeIndoorNavigation() {
  updateDropdownMenus();
  updateSideMenus();
}

// Update dropdown menus to include indoor navigation
function updateDropdownMenus() {
  const building16Items = document.querySelectorAll('#menu-desk-form .nav-item:nth-child(1) .dropdown-item');
  building16Items.forEach((item, index) => {
    const floor = index + 1;
    item.onclick = () => openIndoorNavigation(16, floor);
  });

  const building17Items = document.querySelectorAll('#menu-desk-form .nav-item:nth-child(2) .dropdown-item');
  building17Items.forEach((item, index) => {
    const floor = index + 1;
    item.onclick = () => openIndoorNavigation(17, floor);
  });

  const building18Items = document.querySelectorAll('#menu-desk-form .nav-item:nth-child(3) .dropdown-item');
  building18Items.forEach((item, index) => {
    const floor = index + 1;
    item.onclick = () => openIndoorNavigation(18, floor);
  });

  const building19Items = document.querySelectorAll('#menu-desk-form .nav-item:nth-child(4) .dropdown-item');
  building19Items.forEach((item, index) => {
    const floor = index + 1;
    item.onclick = () => openIndoorNavigation(19, floor);
  });

  const building20Items = document.querySelectorAll('#menu-desk-form .nav-item:nth-child(5) .dropdown-item');
  building20Items.forEach((item, index) => {
    const floor = index + 1;
    item.onclick = () => openIndoorNavigation(20, floor);
  });

  const building21Items = document.querySelectorAll('#menu-desk-form .nav-item:nth-child(6) .dropdown-item');
  building21Items.forEach((item, index) => {
    const floor = index + 1;
    item.onclick = () => openIndoorNavigation(21, floor);
  });
}

// Update side menu items
function updateSideMenus() {
  const sideMenuItems = document.querySelectorAll('.side-menu .dropdown-item[data-building][data-floor]');
  sideMenuItems.forEach(item => {
    const buildingId = parseInt(item.dataset.building);
    const floor = parseInt(item.dataset.floor);
    item.onclick = (e) => {
      e.preventDefault();
      openIndoorNavigation(buildingId, floor);
      setTimeout(() => {
        if (window.SlideMenu && window.SlideMenu.isOpen()) {
          window.SlideMenu.close();
        }
      }, 100);
    };
  });
}

// Main function to open indoor navigation
function openIndoorNavigation(buildingId, floor) {
  console.log(`Opening indoor navigation for Building ${buildingId}, Floor ${floor}`);
  currentBuildingId = buildingId;
  currentFloor = floor;

  closeAllModals();
  // Use the Promise version; no need to .then() here unlessต้องทำต่อ
  loadRoomsAndShowModal(buildingId, floor);
}

// Close all existing modals
function closeAllModals() {
  const indoor = document.getElementById('indoorModal');
  if (indoor && !indoor.hidden) Modal.close(indoor);
  if (window.SlideMenu && window.SlideMenu.isOpen()) {
    window.SlideMenu.close();
  }
}

// ===== Promise version ONLY (clean) =====
function loadRoomsAndShowModal(buildingId, floor) {
  return new Promise((resolve, reject) => {
    showLoadingIndicator();
    fetch(`/get_rooms/${buildingId}/${floor}`)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
      })
      .then(rooms => {
        hideLoadingIndicator();
        populateRoomSelect(rooms);
        loadFloorPlan(buildingId, floor);
        showIndoorModal();
        resolve();
      })
      .catch(error => {
        hideLoadingIndicator();
        console.error('Error loading rooms:', error);
        alert('ไม่สามารถโหลดข้อมูลห้องได้ กรุณาลองใหม่อีกครั้ง');
        reject(error);
      });
  });
}

// Populate room selection dropdown
function populateRoomSelect(rooms) {
  const select = document.getElementById('destinationSelect');
  select.innerHTML = '<option value="">🎯 เลือกห้องที่ต้องการไป</option>';
  rooms.forEach(room => {
    const option = document.createElement('option');
    option.value = room.NodeID;
    option.textContent = room.Detail;
    select.appendChild(option);
  });
}

// Load floor plan image
function loadFloorPlan(buildingId, floor) {
  const floorPlan = document.getElementById('floorPlan');
  const modalTitle = document.getElementById('indoorModalLabel');
  const container = document.querySelector('.navigation-container');

  modalTitle.textContent = `🗺️ แผนผังอาคาร ${buildingId} ชั้น ${floor}`;

  clearPath();

  if (container) {
    container.style.position = 'relative';
    container.style.display = 'inline-block';
    container.style.width = '100%';
  }

  floorPlan.src = `/static/img/planTower${buildingId}Floor${floor}.png`;

  floorPlan.onload = function () {
    console.log('Floor plan loaded successfully');
    setTimeout(() => { setupCanvas(); }, 200);
  };

  floorPlan.onerror = function () {
    console.error('Failed to load floor plan image');
    floorPlan.src = '/static/img/null.png';
  };
}

// Show indoor navigation modal
function showIndoorModal() {
  const modalEl = document.getElementById('indoorModal');
  Modal.open(modalEl);
}

// Show/Hide loading indicators
function showLoadingIndicator() {
  const el = document.getElementById('loadingIndicator');
  if (el) el.hidden = false;
}
function hideLoadingIndicator() {
  const el = document.getElementById('loadingIndicator');
  if (el) el.hidden = true;
}

// Handle destination selection change
function onDestinationChange() {
  const destination = document.getElementById('destinationSelect').value;
  if (destination) {
    setTimeout(() => {
      setupCanvas();
      findPath();
    }, 100);
  } else {
    clearPath();
    document.getElementById('pathInfo').innerHTML = '';
  }
}

// Setup canvas for path drawing
function setupCanvas() {
  const canvas = document.getElementById('pathCanvas');
  const img = document.getElementById('floorPlan');
  const container = document.querySelector('.navigation-container');

  if (!canvas || !img) {
    console.error('Canvas or image not found');
    return;
  }

  if (!img.complete || img.naturalWidth === 0) {
    console.log('Image not loaded yet, waiting...');
    img.onload = () => { setTimeout(() => setupCanvas(), 100); };
    return;
  }

  setTimeout(() => {
    try {
      const imgRect = img.getBoundingClientRect();

      const displayWidth = img.offsetWidth || img.clientWidth;
      const displayHeight = img.offsetHeight || img.clientHeight;

      console.log('Image dimensions:', {
        natural: { width: img.naturalWidth, height: img.naturalHeight },
        displayed: { width: displayWidth, height: displayHeight },
        rect: { width: imgRect.width, height: imgRect.height }
      });

      canvas.width = displayWidth;
      canvas.height = displayHeight;

      canvas.style.width = displayWidth + 'px';
      canvas.style.height = displayHeight + 'px';

      canvas.style.position = 'absolute';
      canvas.style.top = '0px';
      canvas.style.left = '0px';
      canvas.style.zIndex = '10';
      canvas.style.pointerEvents = 'none';

      if (container) {
        container.style.position = 'relative';
        container.style.display = 'inline-block';
      }

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      console.log('Canvas setup completed:', {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        cssWidth: canvas.style.width,
        cssHeight: canvas.style.height
      });

    } catch (error) {
      console.error('Error setting up canvas:', error);
    }
  }, 50);
}

// Find path to selected destination
function findPath() {
  const destination = document.getElementById('destinationSelect').value;
  if (!destination) return;

  showLoadingIndicator();
  clearPath();

  fetch('/find_path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destination: destination,
      building_id: currentBuildingId,
      floor: currentFloor
    })
  })
  .then(response => {
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    return response.json();
  })
  .then(data => handlePathData(data))
  .catch(err => handleError(err, 'findPath'));
}

// Handle path data response
function handlePathData(data) {
  hideLoadingIndicator();
  console.log('Path data received:', data);

  if (data.path && data.path.length > 0) {
    const scaledPath = scalePathToImageSize(data.path, data.img_width, data.img_height);
    startGoogleMapsAnimation(scaledPath);
    updatePathInfo(data.nodes || [], scaledPath);
  } else {
    document.getElementById('pathInfo').innerHTML =
      '<h3>ข้อมูลเส้นทาง</h3><p class="error">ไม่พบเส้นทางไปยังห้องที่เลือก</p>';
  }
}

// Enhanced clear path function
function clearPath() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  const canvas = document.getElementById('pathCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    console.log('Canvas cleared');
  }

  // Reset animation variables
  pulsePhase = 0;
  pathProgress = 0;
  isAnimating = false;

  const distanceIndicator = document.getElementById('distanceIndicator');
  if (distanceIndicator) distanceIndicator.style.display = 'none';

  const pathInfo = document.getElementById('pathInfo');
  if (pathInfo) pathInfo.innerHTML = '';
}

// Scale path coordinates to match current image size
function scalePathToImageSize(pathCoords, originalWidth, originalHeight) {
  const img = document.getElementById('floorPlan');
  const canvas = document.getElementById('pathCanvas');
  if (!img || !canvas) {
    console.error('Image or canvas not found for scaling');
    return pathCoords;
  }

  const currentWidth = canvas.width;
  const currentHeight = canvas.height;

  const scaleX = currentWidth / originalWidth;
  const scaleY = currentHeight / originalHeight;

  console.log('Scaling path coordinates:', {
    original: { width: originalWidth, height: originalHeight },
    current: { width: currentWidth, height: currentHeight },
    scale: { x: scaleX, y: scaleY }
  });

  const scaledCoords = pathCoords.map(point => ({
    x: Math.round(point.x * scaleX),
    y: Math.round(point.y * scaleY),
    node_id: point.node_id
  }));
  console.log('Sample scaled coordinates:', scaledCoords.slice(0, 3));
  return scaledCoords;
}

// Start Google Maps-like animation
function startGoogleMapsAnimation(pathCoords) {
  if (pathCoords.length < 2) return;

  const canvas = document.getElementById('pathCanvas');
  const ctx = canvas.getContext('2d');

  pathProgress = 0;
  pulsePhase = 0;
  isAnimating = true;

  const totalDistance = calculateTotalDistance(pathCoords);

  const distanceIndicator = document.getElementById('distanceIndicator');
  if (distanceIndicator) {
    distanceIndicator.textContent = `📏 ${Math.round(totalDistance * 0.01)} เมตร`;
    distanceIndicator.style.display = 'block';
  }

  function animate() {
    if (!isAnimating) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    pulsePhase += 0.15;

    if (pathProgress < 1) pathProgress += 0.02;

    drawBackgroundPath(ctx, pathCoords);
    drawGoogleMapsPath(ctx, pathCoords, pathProgress);
    drawAnimatedNodes(ctx, pathCoords, pathProgress);
    drawDirectionArrows(ctx, pathCoords, pathProgress);

    animationId = requestAnimationFrame(animate);
  }

  animate();
}

// Drawing functions
function drawBackgroundPath(ctx, pathCoords) {
  if (pathCoords.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(pathCoords[0].x, pathCoords[0].y);
  for (let i = 1; i < pathCoords.length; i++) {
    ctx.lineTo(pathCoords[i].x, pathCoords[i].y);
  }

  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.stroke();
}

function drawGoogleMapsPath(ctx, pathCoords, progress) {
  const visiblePoints = Math.floor(pathCoords.length * progress);
  if (visiblePoints < 2) return;

  const gradient = createPathGradient(ctx, pathCoords, visiblePoints);

  ctx.beginPath();
  ctx.moveTo(pathCoords[0].x, pathCoords[0].y);
  for (let i = 1; i < visiblePoints; i++) {
    ctx.lineTo(pathCoords[i].x, pathCoords[i].y);
  }

  ctx.lineWidth = 6;
  ctx.strokeStyle = gradient;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function createPathGradient(ctx, pathCoords, visiblePoints) {
  if (visiblePoints < 2) return '#4285F4';
  const startPoint = pathCoords[0];
  const endPoint = pathCoords[visiblePoints - 1];
  const gradient = ctx.createLinearGradient(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
  gradient.addColorStop(0, '#4285F4');
  gradient.addColorStop(0.5, '#34A853');
  gradient.addColorStop(1, '#FBBC05');
  return gradient;
}

function drawAnimatedNodes(ctx, pathCoords, progress) {
  const visiblePoints = Math.floor(pathCoords.length * progress);

  pathCoords.forEach((point, index) => {
    if (index >= visiblePoints) return;

    const isStart = index === 0;
    const isEnd = index === pathCoords.length - 1;
    const pulseSize = 2 + Math.sin(pulsePhase + index * 0.5) * 1;

    ctx.save();

    if (isStart) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 8 + pulseSize, 0, Math.PI * 2);
      ctx.fillStyle = '#4285F4';
      ctx.shadowColor = '#4285F4';
      ctx.shadowBlur = 10;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.shadowBlur = 0;
      ctx.fill();
    } else if (isEnd && index < visiblePoints) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 10 + pulseSize, 0, Math.PI * 2);
      ctx.fillStyle = '#EA4335';
      ctx.shadowColor = '#EA4335';
      ctx.shadowBlur = 15;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.shadowBlur = 0;
      ctx.fill();
    }

    ctx.restore();
  });
}

function drawDirectionArrows(ctx, pathCoords, progress) {
  const visiblePoints = Math.floor(pathCoords.length * progress);
  if (visiblePoints < 2) return;

  ctx.save();
  for (let i = 0; i < visiblePoints - 1; i += 3) {
    if (i + 1 >= pathCoords.length) break;

    const start = pathCoords[i];
    const end = pathCoords[i + 1];
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    ctx.translate(midX, midY);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(-5, -3);
    ctx.lineTo(5, 0);
    ctx.lineTo(-5, 3);
    ctx.closePath();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 3;
    ctx.fill();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  ctx.restore();
}

function calculateTotalDistance(pathCoords) {
  let total = 0;
  for (let i = 1; i < pathCoords.length; i++) {
    const dx = pathCoords[i].x - pathCoords[i - 1].x;
    const dy = pathCoords[i].y - pathCoords[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

function updatePathInfo(path, pathCoords) {
  if (!path || path.length === 0) return;

  let info = '<h3>🗺️ ข้อมูลเส้นทาง</h3><ol class="path-steps">';
  path.forEach((node, i) => {
    const name = node.detail || node.node_id;
    if (i === 0) {
      info += `<li class="step-start">เริ่มต้นจาก <strong>${name}</strong></li>`;
    } else if (i === path.length - 1) {
      info += `<li class="step-end">ถึง <strong>${name}</strong></li>`;
    } else {
      info += `<li class="step-through">ผ่าน ${name}</li>`;
    }
  });
  info += '</ol>';

  const totalDistance = calculateTotalDistance(pathCoords);
  const estimatedTime = Math.ceil(totalDistance * 0.01);

  info += `
    <div class="path-summary">
      <div class="summary-item">
        <span class="icon">📏</span>
        <span class="label">ระยะทาง:</span>
        <span class="value">${Math.round(totalDistance * 0.1)} เมตร</span>
      </div>
      <div class="summary-item">
        <span class="icon">⏱️</span>
        <span class="label">เวลาโดยประมาณ:</span>
        <span class="value">${estimatedTime} นาที</span>
      </div>
    </div>
  `;
  document.getElementById('pathInfo').innerHTML = info;
}

// Simple resize handler
window.addEventListener('resize', function () {
  setTimeout(function () {
    setupCanvas();
    const destination = document.getElementById('destinationSelect').value;
    if (destination) { findPath(); }
  }, 100);
});

// Cleanup animation on page unload
window.addEventListener('beforeunload', () => {
  if (animationId) cancelAnimationFrame(animationId);
});

// Open from search result (kept)
function openIndoorToRoom(buildingId, floor, roomId) {
  console.log(`Opening indoor navigation for Building ${buildingId}, Floor ${floor}, Room ${roomId}`);
  currentBuildingId = buildingId;
  currentFloor = floor;

  loadRoomsAndShowModal(buildingId, floor)
    .then(() => {
      const select = document.getElementById('destinationSelect');
      if (select) {
        select.value = roomId;
        setTimeout(() => { findPath(); }, 300);
      }
    })
    .catch(error => {
      console.error('Error in openIndoorToRoom:', error);
      alert('ไม่สามารถเปิดหน้าการนำทางได้ กรุณาลองใหม่อีกครั้ง');
    });
}
