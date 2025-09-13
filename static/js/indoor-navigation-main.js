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
        escHandler = (e) => {
            if (e.key === 'Escape') close(modalEl);
        };
        document.addEventListener('keydown', escHandler);

        // Focus trap
        trapFocus(modalEl);

        // custom event (แทน shown.bs.modal)
        modalEl.dispatchEvent(new CustomEvent('modal:shown', {bubbles: true}));
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
        modalEl.dispatchEvent(new CustomEvent('modal:hidden', {bubbles: true}));

        // restore focus
        if (lastFocused && lastFocused.focus) {
            lastFocused.focus();
        }
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
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', focusTrapHandler);

        observer = new ResizeObserver(() => {
        });
        observer.observe(modalEl);
    }

    function releaseFocus() {
        document.removeEventListener('keydown', focusTrapHandler);
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    }

    return {open, close};
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

function populateStartSelect(rooms, buildingId, floor) {
    const select = document.getElementById('startSelect');
    if (!select) return;

    // เคลียร์
    select.innerHTML = '';

    // ตัวเลือกดีฟอลต์: ปล่อย value ว่าง เพื่อให้ backend auto-pick ลิฟต์ของชั้นนี้
    const optDefault = document.createElement('option');
    optDefault.value = '';
    optDefault.textContent = `⬆️ ลิฟต์ชั้นนี้ (แนะนำ) — อาคาร ${buildingId} ชั้น ${floor}`;
    select.appendChild(optDefault);

    // (ตัวเลือกเสริม) เติม node/ห้องบนชั้นนี้ให้เลือกเป็น start ได้
    rooms.forEach(room => {
        const option = document.createElement('option');
        option.value = room.NodeID;
        option.textContent = room.Detail;
        select.appendChild(option);
    });

    // ตั้งค่าเริ่มต้น = ลิฟต์ชั้นนี้ (ปล่อยให้ backend เลือก NodeID จริง)
    select.value = '';
}


// ===== Promise version ONLY (clean) =====
function loadRoomsAndShowModal(buildingId, floor) {
    return new Promise((resolve, reject) => {
        showLoadingIndicator();
        // 1) ดึงห้องทุกชั้น เพื่อลิสต์ปลายทางแบบข้ามชั้นได้
        fetch(`/get_rooms_all_floors/${buildingId}`)
            .then(r => {
                if (!r.ok) throw new Error(r.status);
                return r.json();
            })
            .then(allByFloor => {
                // สร้าง index NodeID -> {floor, detail}
                allRoomsIndex = {};
                Object.keys(allByFloor).forEach(fl => {
                    allByFloor[fl].forEach(it => allRoomsIndex[it.NodeID] = {floor: Number(fl), detail: it.Detail});
                });

                // เติม startSelect = ห้องบน “ชั้นปัจจุบัน” + ค่าเริ่มต้นเป็น “ลิฟต์ชั้นนี้”
                const roomsThisFloor = allByFloor[String(floor)] || [];
                populateStartSelect(roomsThisFloor, buildingId, floor);

                // เติม destinationSelect = ห้อง “ทุกชั้น” (optgroup)
                const sel = document.getElementById('destinationSelect');
                sel.innerHTML = '<option value="">🎯 เลือกห้องที่ต้องการไป</option>';
                Object.keys(allByFloor).sort((a, b) => Number(a) - Number(b)).forEach(fl => {
                    const og = document.createElement('optgroup');
                    og.label = `ชั้น ${fl}`;
                    allByFloor[fl].forEach(r => {
                        const opt = document.createElement('option');
                        opt.value = r.NodeID;
                        opt.textContent = r.Detail;
                        opt.dataset.floor = fl;
                        og.appendChild(opt);
                    });
                    sel.appendChild(og);
                });

                // โหลดแผนผัง “ชั้นปัจจุบัน” เป็นดีฟอลต์ (โหมด single)
                ensureSinglePanel();
                loadFloorPlan(currentBuildingId, floor); // ใช้ตัวเดิม (single)
                showIndoorModal();
                hideLoadingIndicator();
                resolve();
            })
            .catch(err => {
                hideLoadingIndicator();
                console.error('Error load all floors:', err);
                alert('ไม่สามารถโหลดข้อมูลห้องได้ กรุณาลองใหม่อีกครั้ง');
                reject(err);
            });
    });
}

// Load floor plan image (เพิ่มพารามิเตอร์ afterLoaded)
function loadFloorPlan(buildingId, floor, afterLoaded) {
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
        setTimeout(() => {
            setupCanvas();
            if (typeof afterLoaded === 'function') afterLoaded();
        }, 200);
    };
    floorPlan.onerror = function () {
        floorPlan.src = '/static/img/null.png';
        if (typeof afterLoaded === 'function') afterLoaded();
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
  const sel = document.getElementById('destinationSelect');
  const dest = sel.value;
  if (!dest) { clearPath(); document.getElementById('pathInfo').innerHTML = ''; return; }

  const info = allRoomsIndex[dest];

  // ข้อมูลไม่ครบ → โหมดชั้นเดียว
  if (!info) {
    ensureSinglePanel();
    loadFloorPlan(currentBuildingId, currentFloor, () => findPath());
    return; // ✅ สำคัญ
  }

  if (Number(info.floor) === Number(currentFloor)) {
    // ✅ ชั้นเดียวกัน
    ensureSinglePanel();
    loadFloorPlan(currentBuildingId, currentFloor, () => findPath());
    return; // ✅ สำคัญ: หยุดที่นี่ ไม่ให้หลุดเข้าโหมด stack
  } else {
    // ✅ ข้ามชั้น
    ensureStackMode();
    window.__navTargetFloor = Number(info.floor);

    const imgFrom = document.getElementById('floorPlan_from');
    const imgTo   = document.getElementById('floorPlan_to');
    imgFrom.src = `/static/img/planTower${currentBuildingId}Floor${currentFloor}.png`;
    imgTo.src   = `/static/img/planTower${currentBuildingId}Floor${info.floor}.png`;

    let loaded = 0;
    const tryDraw = () => {
      if (++loaded === 2) { initStackCanvasSizing(); findPath(); }
    };
    imgFrom.onload = tryDraw; imgFrom.onerror = tryDraw;
    imgTo.onload   = tryDraw; imgTo.onerror   = tryDraw;
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
        img.onload = () => {
            setTimeout(() => setupCanvas(), 100);
        };
        return;
    }

    setTimeout(() => {
        try {
            const imgRect = img.getBoundingClientRect();

            const displayWidth = img.offsetWidth || img.clientWidth;
            const displayHeight = img.offsetHeight || img.clientHeight;

            console.log('Image dimensions:', {
                natural: {width: img.naturalWidth, height: img.naturalHeight},
                displayed: {width: displayWidth, height: displayHeight},
                rect: {width: imgRect.width, height: imgRect.height}
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
    const start = document.getElementById('startSelect') ? document.getElementById('startSelect').value : '';
    if (!destination) return;

    showLoadingIndicator();
    clearPath();

    const destInfo = allRoomsIndex[destination];
    const isCross = destInfo && Number(destInfo.floor) !== Number(currentFloor);

    const url = isCross ? '/find_path_cross' : '/find_path';
    const body = {
        start: start || null,
        destination: destination,
        building_id: currentBuildingId,
        floor: currentFloor
    };

    fetch(url, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    })
        .then(r => {
            if (!r.ok) throw new Error(r.status);
            return r.json();
        })
        .then(data => {
            hideLoadingIndicator();
            if (isCross) {
                handlePathDataCross(data);
            } else {
                window.handlePathData(data); // เดิม
            }
        })
        .catch(err => window.handleError(err, 'findPath'));
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
        original: {width: originalWidth, height: originalHeight},
        current: {width: currentWidth, height: currentHeight},
        scale: {x: scaleX, y: scaleY}
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
  if (!pathCoords || pathCoords.length < 2) return;

  const canvas = document.getElementById('pathCanvas');
  const ctx = canvas.getContext('2d');

  pathProgress = 0;
  pulsePhase = 0;
  isAnimating = true;

  // metrics & runner state
  let last = performance.now();
  let runnerDist = 0;
  let metricsAll = buildPathMetrics(pathCoords);
  const SPEED_PX_PER_SEC = 220; // ↔ ปรับความเร็วไฟวิ่งได้

  // total distance (สำหรับตัวแสดงผลเดิมของคุณ)
  const totalDistance = calculateTotalDistance(pathCoords);
  const distanceIndicator = document.getElementById('distanceIndicator');
  if (distanceIndicator) {
    distanceIndicator.textContent = `📏 ${Math.round(totalDistance * 0.01)} เมตร`;
    distanceIndicator.style.display = 'block';
  }

  function animate(now){
    if (!isAnimating) return;

    // dt (ms) และอัปเดตไฟวิ่ง
    const dt = Math.min(50, now - last); // cap เพื่อความนิ่ง
    last = now;
    runnerDist = (runnerDist + SPEED_PX_PER_SEC * (dt / 1000)) % (metricsAll.total || 1);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pulsePhase += 0.15;
    if (pathProgress < 1) pathProgress += 0.02;

    // เผยทีละส่วนตาม progress
    const visible = subPathByProgress(pathCoords, pathProgress);
    const mVis = buildPathMetrics(visible);

    // พื้นหลัง + เส้นหลัก
    drawBackgroundPath(ctx, visible);
    drawGoogleMapsPath(ctx, visible, 1);          // วาดเต็มส่วนที่มองเห็น
    drawRunningLights(ctx, visible, mVis, runnerDist, { width: 6 }); // 🔥 ไฟวิ่ง
    drawAnimatedNodes(ctx, visible, 1);
    drawDirectionArrows(ctx, visible, 1);

    animationId = requestAnimationFrame(animate);
  }

  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(animate);
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
        if (destination) {
            findPath();
        }
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
                setTimeout(() => {
                    findPath();
                }, 300);
            }
        })
        .catch(error => {
            console.error('Error in openIndoorToRoom:', error);
            alert('ไม่สามารถเปิดหน้าการนำทางได้ กรุณาลองใหม่อีกครั้ง');
        });
}

function handleError(err, where = '') {
    hideLoadingIndicator();
    console.error('Error at', where, err);
    alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
}

function onStartChange() {
    const destination = document.getElementById('destinationSelect').value;
    if (destination) {
        setTimeout(() => {
            setupCanvas();
            findPath();
        }, 100);
    }
}

// === Global-safe helpers ===
window.handleError = window.handleError || function (err, where = '') {
    hideLoadingIndicator();
    console.error('Error at', where, err);
    alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
};

window.handlePathData = window.handlePathData || function (data) {
    hideLoadingIndicator();
    console.log('Path data received:', data);

    if (data && data.path && data.path.length > 0) {
        const scaledPath = scalePathToImageSize(data.path, data.img_width, data.img_height);
        startGoogleMapsAnimation(scaledPath);
        updatePathInfo(data.nodes || [], scaledPath);
    } else {
        document.getElementById('pathInfo').innerHTML =
            '<h3>ข้อมูลเส้นทาง</h3><p class="error">ไม่พบเส้นทางไปยังห้องที่เลือก</p>';
    }
};

function handlePathDataCross(data) {
    try {
        if (!data || data.mode !== 'cross') {
            document.getElementById('pathInfo').innerHTML = '<p class="error">ไม่พบเส้นทางข้ามชั้น</p>';
            return;
        }

        // ✅ ใช้ Carousel (ถ้ายังไม่อยู่โหมดนี้)
        ensureStackMode();

        // เตรียม canvas ให้พอดีกับภาพ
        const imgFrom = document.getElementById('floorPlan_from');
        const imgTo = document.getElementById('floorPlan_to');
        const cvsFrom = document.getElementById('pathCanvas_from');
        const cvsTo = document.getElementById('pathCanvas_to');

        setupCanvasFor(imgFrom, cvsFrom);
        setupCanvasFor(imgTo, cvsTo);

        // สเกลพาธให้ตรงกับขนาดรูปปัจจุบัน
        const scaledFrom = scalePathToImageSizeFor(imgFrom, cvsFrom, data.origin.path, data.origin.img_width, data.origin.img_height);
        const scaledTo = scalePathToImageSizeFor(imgTo, cvsTo, data.destination.path, data.destination.img_width, data.destination.img_height);

        // 🔄 แอนิเมชัน: วาดทีละสไลด์
        startCrossFloorAnimation(scaledFrom, scaledTo);

        // อัปเดตสรุปเส้นทาง
        const steps = (data.nodes || []).map((n, i) => {
            const name = n.detail || n.node_id;
            if (i === 0) return `<li class="step-start">เริ่มจาก <strong>${name}</strong> (ชั้น ${data.origin.floor})</li>`;
            if (i === data.nodes.length - 1) return `<li class="step-end">ถึง <strong>${name}</strong> (ชั้น ${data.destination.floor})</li>`;
            return `<li class="step-through">ผ่าน ${name}</li>`;
        }).join('');

        const liftNote = data.elevator_id ? `
      <div class="summary-item">
        <span class="icon">⬆️</span>
        <span class="label">ลิฟต์:</span>
        <span class="value">ID ${data.elevator_id} (ชั้น ${data.origin.floor} ➜ ${data.destination.floor})</span>
      </div>` : '';

        const len = arr => arr.reduce((s, p, i) => i ? s + Math.hypot(p.x - arr[i - 1].x, p.y - arr[i - 1].y) : 0, 0);
        const distM = Math.round((len(scaledFrom) + len(scaledTo)) * 0.1);
        const timeMin = Math.max(1, Math.ceil(distM / 60));

        document.getElementById('pathInfo').innerHTML = `
      <h3>🗺️ ข้อมูลเส้นทาง (ข้ามชั้น)</h3>
      <ol class="path-steps">${steps}</ol>
      <div class="path-summary">
        <div class="summary-item"><span class="icon">📏</span><span class="label">ระยะทาง:</span><span class="value">${distM} เมตร</span></div>
        <div class="summary-item"><span class="icon">⏱️</span><span class="label">เวลาโดยประมาณ:</span><span class="value">${timeMin} นาที</span></div>
        ${liftNote}
      </div>
    `;
    } catch (e) {
        console.error(e);
        document.getElementById('pathInfo').innerHTML = '<p class="error">เกิดข้อผิดพลาดในการแสดงเส้นทาง</p>';
    }
}

// NEW: index ข้อมูลห้องทั้งหมดในอาคาร -> ใช้รู้ว่า NodeID อยู่ชั้นไหน
let allRoomsIndex = {}; // { NodeID: { floor, detail } }

// NEW: โครงสร้าง panel 2 ฝั่ง เมื่อข้ามชั้น
function ensureDualPanels() {
    const container = document.querySelector('.navigation-container');
    if (!container) return;
    if (container.dataset.mode === 'dual') return;

    container.innerHTML = `
    <div id="navGrid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="panel" data-panel="from" style="position:relative;">
        <img id="floorPlan_from" alt="แผนผังชั้นต้นทาง" style="width:100%;">
        <canvas id="pathCanvas_from" aria-hidden="true" style="position:absolute;top:0;left:0;"></canvas>
      </div>
      <div class="panel" data-panel="to" style="position:relative;">
        <img id="floorPlan_to" alt="แผนผังชั้นปลายทาง" style="width:100%;">
        <canvas id="pathCanvas_to" aria-hidden="true" style="position:absolute;top:0;left:0;"></canvas>
      </div>
    </div>
  `;
    container.dataset.mode = 'dual';
}

function ensureSinglePanel() {
    const container = document.querySelector('.navigation-container');
    if (!container) return;
    if (container.dataset.mode === 'single') return;

    container.innerHTML = `
    <img id="floorPlan" src="" alt="แผนผังชั้นของอาคาร" style="width: 100%;">
    <canvas id="pathCanvas" aria-hidden="true" style="position:absolute;top:0;left:0;"></canvas>
  `;
    container.dataset.mode = 'single';
}

// ===== Two-panel (ข้ามชั้นแบบสองรูปบน-ล่าง) =====
function ensureStackMode() {
    const container = document.querySelector('.navigation-container');
    if (!container) return;
    if (container.dataset.mode === 'stack') return;

    container.innerHTML = `
    <div class="indoor-stack" id="indoorStack">
      <section class="indoor-stack__panel" data-role="from">
        <header class="indoor-stack__label">ชั้นต้นทาง</header>
        <div class="indoor-stack__media" style="position:relative">
          <img id="floorPlan_from" alt="ชั้นต้นทาง" style="display:block;width:100%;height:auto;">
          <canvas id="pathCanvas_from"
                  style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;"></canvas>
        </div>
      </section>
      <section class="indoor-stack__panel" data-role="to">
        <header class="indoor-stack__label">ชั้นปลายทาง</header>
        <div class="indoor-stack__media" style="position:relative">
          <img id="floorPlan_to" alt="ชั้นปลายทาง" style="display:block;width:100%;height:auto;">
          <canvas id="pathCanvas_to"
                  style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;"></canvas>
        </div>
      </section>
    </div>
  `;
    container.dataset.mode = 'stack';

    // ✅ สำคัญ: ให้แคนวาสตรงขนาดรูป
    initStackCanvasSizing();
}

// ===== Carousel (ข้ามชั้น) =====
function ensureCarouselMode() {
    const container = document.querySelector('.navigation-container');
    if (!container) return;
    if (container.dataset.mode === 'carousel') return;

    container.innerHTML = `
    <div class="indoor-carousel" id="indoorCarousel" data-index="0">
      <div class="indoor-carousel__track" id="indoorCarouselTrack">
        <div class="indoor-carousel__slide" data-role="from">
          <img id="floorPlan_from" alt="ชั้นต้นทาง">
          <canvas id="pathCanvas_from"></canvas>
        </div>
        <div class="indoor-carousel__slide" data-role="to">
          <img id="floorPlan_to" alt="ชั้นปลายทาง">
          <canvas id="pathCanvas_to"></canvas>
        </div>
      </div>
      <div class="indoor-carousel__nav">
        <button class="indoor-carousel__btn" id="indoorPrev">‹</button>
        <button class="indoor-carousel__btn" id="indoorNext">›</button>
      </div>
      <div class="indoor-carousel__dots">
        <div class="indoor-carousel__dot is-active" data-dot="0"></div>
        <div class="indoor-carousel__dot" data-dot="1"></div>
      </div>
    </div>
  `;
    container.dataset.mode = 'carousel';

    bindCarouselControls();
}

function bindCarouselControls() {
    const wrap = document.getElementById('indoorCarousel');
    const track = document.getElementById('indoorCarouselTrack');
    const dots = Array.from(wrap.querySelectorAll('.indoor-carousel__dot'));
    const prev = document.getElementById('indoorPrev');
    const next = document.getElementById('indoorNext');

    const go = (idx) => {
        idx = Math.max(0, Math.min(1, idx));
        wrap.dataset.index = String(idx);
        track.style.transform = `translateX(${idx * -100}%)`;
        dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));

        // เมื่อเปลี่ยนสไลด์ ให้รีสตาร์ทแอนิเมชันของสไลด์นั้น
        if (window.__crossAnim && typeof window.__crossAnim.restart === 'function') {
            window.__crossAnim.restart(idx);
        }
    };

    prev.onclick = () => go(Number(wrap.dataset.index || 0) - 1);
    next.onclick = () => go(Number(wrap.dataset.index || 0) + 1);

    // รองรับปัดซ้าย/ขวา
    let sx = 0;
    track.addEventListener('touchstart', e => {
        sx = e.changedTouches[0].clientX;
    }, {passive: true});
    track.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - sx;
        if (dx > 50) prev.click();
        else if (dx < -50) next.click();
    }, {passive: true});
}

// เคลียร์ทั้ง single และ cross-floor canvases
function clearPath() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    const ids = ['pathCanvas', 'pathCanvas_from', 'pathCanvas_to'];
    ids.forEach(id => {
        const c = document.getElementById(id);
        if (c) {
            const ctx = c.getContext('2d');
            ctx.clearRect(0, 0, c.width, c.height);
        }
    });

    pulsePhase = 0;
    pathProgress = 0;
    isAnimating = false;

    const di = document.getElementById('distanceIndicator');
    if (di) di.style.display = 'none';

    const info = document.getElementById('pathInfo');
    if (info) info.innerHTML = '';
}

// แอนิเมตแบบ cross-floor (ทีละสไลด์)
function startCrossFloorAnimation(scaledFrom, scaledTo) {
  const cvsFrom = document.getElementById('pathCanvas_from');
  const cvsTo   = document.getElementById('pathCanvas_to');
  const ctxFrom = cvsFrom.getContext('2d');
  const ctxTo   = cvsTo.getContext('2d');

  let progressFrom = 0, progressTo = 0, phase = 0;
  let last = performance.now();
  const SPEED_PX_PER_SEC = 100;

  // โหมดปัจจุบัน
  const container = document.querySelector('.navigation-container');
  const mode = container?.dataset.mode || 'stack'; // 'stack' | 'carousel'
  let active = 0;
  if (mode === 'carousel') {
    const wrap = document.getElementById('indoorCarousel');
    active = Number(wrap?.dataset.index || 0);
  }

  let distFrom = 0, distTo = 0;

  function drawSlide(ctx, coords, progress, runnerDist){
    const visible = subPathByProgress(coords, progress);
    const mVis = buildPathMetrics(visible);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    drawBackgroundPath(ctx, visible);
    drawGoogleMapsPath(ctx, visible, 1);
    drawRunningLights(ctx, visible, mVis, runnerDist, { width: 6 }); // 🔥 ไฟวิ่ง
    pulsePhase = phase;
    drawAnimatedNodes(ctx, visible, 1);
    drawDirectionArrows(ctx, visible, 1);
  }

  function tick(now){
    phase += 0.15;
    const dt = Math.min(50, now - last);
    last = now;

    if (mode === 'carousel') {
      if (active === 0) {
        distFrom = (distFrom + SPEED_PX_PER_SEC * (dt / 1000)) % Math.max(1, buildPathMetrics(scaledFrom).total);
        if (progressFrom < 1) progressFrom += 0.02;
      } else {
        distTo = (distTo + SPEED_PX_PER_SEC * (dt / 1000)) % Math.max(1, buildPathMetrics(scaledTo).total);
        if (progressTo < 1) progressTo += 0.02;
      }
    } else {
      // STACK: เดินพร้อมกันทั้งสองผืน
      distFrom = (distFrom + SPEED_PX_PER_SEC * (dt / 1000)) % Math.max(1, buildPathMetrics(scaledFrom).total);
      distTo   = (distTo   + SPEED_PX_PER_SEC * (dt / 1000)) % Math.max(1, buildPathMetrics(scaledTo).total);
      if (progressFrom < 1) progressFrom += 0.02;
      if (progressTo   < 1) progressTo   += 0.02;
    }

    drawSlide(ctxFrom, scaledFrom, progressFrom, distFrom);
    drawSlide(ctxTo,   scaledTo,   progressTo,   distTo);

    animationId = requestAnimationFrame(tick);
  }

  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(tick);

  // รองรับเฉพาะ carousel
  window.__crossAnim = {
    restart: (idx) => {
      if (mode !== 'carousel') return;
      active = idx;
      if (idx === 0) progressFrom = 0; else progressTo = 0;
    }
  };
}

// panel-aware helpers
function setupCanvasFor(imgEl, canvasEl) {
    if (!imgEl || !canvasEl) return;
    const displayWidth = imgEl.offsetWidth || imgEl.clientWidth;
    const displayHeight = imgEl.offsetHeight || imgEl.clientHeight;
    canvasEl.width = displayWidth;
    canvasEl.height = displayHeight;
    canvasEl.style.width = displayWidth + 'px';
    canvasEl.style.height = displayHeight + 'px';
    const ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
}

function scalePathToImageSizeFor(imgEl, canvasEl, pathCoords, originalWidth, originalHeight) {
  const cw = canvasEl.width, ch = canvasEl.height;
  const ow = originalWidth  || imgEl.naturalWidth  || cw || 1;
  const oh = originalHeight || imgEl.naturalHeight || ch || 1;
  const sx = cw / ow, sy = ch / oh;
  return pathCoords.map(p => ({ x: Math.round(p.x * sx), y: Math.round(p.y * sy), node_id: p.node_id }));
}

function syncCanvasToImage(imgEl, canvasEl) {
    // ใช้ขนาดที่แสดงจริงบนหน้าจอ
    const rect = imgEl.getBoundingClientRect();
    canvasEl.width = Math.max(1, Math.round(rect.width));
    canvasEl.height = Math.max(1, Math.round(rect.height));
}

function initStackCanvasSizing() {
    const imgFrom = document.getElementById('floorPlan_from');
    const imgTo = document.getElementById('floorPlan_to');
    const cvFrom = document.getElementById('pathCanvas_from');
    const cvTo = document.getElementById('pathCanvas_to');

    const doSync = () => {
        if (imgFrom && cvFrom && imgFrom.complete) syncCanvasToImage(imgFrom, cvFrom);
        if (imgTo && cvTo && imgTo.complete) syncCanvasToImage(imgTo, cvTo);
    };

    // ซิงก์เมื่อรูปโหลดและเมื่อรีไซซ์หน้าต่าง
    imgFrom?.addEventListener('load', doSync);
    imgTo?.addEventListener('load', doSync);
    window.addEventListener('resize', doSync);

    // เรียกครั้งแรกทันที
    doSync();
}

// === Running-light utilities ===
function buildPathMetrics(coords){
  if (!coords || coords.length < 2) return { total: 0, segLengths: [], cum: [0] };
  const segLengths = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++){
    const dx = coords[i].x - coords[i-1].x;
    const dy = coords[i].y - coords[i-1].y;
    const len = Math.hypot(dx, dy);
    segLengths.push(len);
    total += len;
  }
  const cum = [0];
  for (const l of segLengths) cum.push(cum[cum.length - 1] + l);
  return { total, segLengths, cum };
}

function pointAtDistance(coords, metrics, d){
  const { total, cum } = metrics;
  if (!coords || coords.length === 0) return { x: 0, y: 0 };
  if (total === 0) return coords[0];
  d = Math.max(0, Math.min(d, total));
  let i = 1;
  while (i < cum.length && cum[i] < d) i++;
  const i0 = Math.max(1, i) - 1;
  const a = coords[i0], b = coords[i0 + 1] || coords[i0];
  const segLen = metrics.segLengths[i0] || 1;
  const t = segLen ? (d - cum[i0]) / segLen : 0;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function drawRunningLights(ctx, coords, metrics, headDist, opts = {}){
  if (!coords || coords.length < 2 || metrics.total === 0) return;

  const dash  = opts.dash  ?? 18;
  const gap   = opts.gap   ?? 12;
  const width = opts.width ?? 6;

  ctx.save();
  ctx.setLineDash([dash, gap]);
  ctx.lineDashOffset = - (headDist % (dash + gap));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';

  // glow underlay
  ctx.lineWidth   = width;
  ctx.shadowColor = opts.glowColor   ?? 'rgba(250, 204, 21, 0.9)'; // amber
  ctx.shadowBlur  = opts.shadowBlur  ?? 12;
  ctx.strokeStyle = opts.strokeColor ?? 'rgba(250, 204, 21, 0.85)';

  ctx.beginPath();
  ctx.moveTo(coords[0].x, coords[0].y);
  for (let i = 1; i < coords.length; i++) ctx.lineTo(coords[i].x, coords[i].y);
  ctx.stroke();

  // bright core
  ctx.shadowBlur  = 0;
  ctx.lineWidth   = Math.max(2, width - 2);
  ctx.strokeStyle = opts.coreColor ?? '#fde047';
  ctx.stroke();
  ctx.restore();

  // comet head + short tail
  const head = pointAtDistance(coords, metrics, headDist);
  const tail = pointAtDistance(coords, metrics, Math.max(0, headDist - (opts.tailLen ?? 40)));

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // tail segment
  ctx.beginPath();
  ctx.lineWidth   = width + 2;
  ctx.strokeStyle = opts.tailColor ?? 'rgba(253, 224, 71, 0.9)';
  ctx.moveTo(tail.x, tail.y);
  ctx.lineTo(head.x, head.y);
  ctx.stroke();

  // head glow
  const R = opts.headRadius ?? 10;
  const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, R);
  g.addColorStop(0, '#fff7ed'); // warm white
  g.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(head.x, head.y, R, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function subPathByProgress(coords, progress){
  if (!coords || coords.length < 2) return coords || [];
  if (progress >= 1) return coords;
  const n = Math.max(2, Math.ceil(coords.length * progress));
  return coords.slice(0, n);
}





