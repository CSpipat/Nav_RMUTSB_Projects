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

                // เติม startSelect = ห้องบน "ชั้นปัจจุบัน" + ค่าเริ่มต้นเป็น "ลิฟต์ชั้นนี้"
                const roomsThisFloor = allByFloor[String(floor)] || [];
                populateStartSelect(roomsThisFloor, buildingId, floor);

                // เติม destinationSelect = ห้อง "ทุกชั้น" (optgroup)
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

                // โหลดแผนผัง "ชั้นปัจจุบัน" เป็นดีฟอลต์ (โหมด single)
                ensureSinglePanel();
                loadFloorPlan(currentBuildingId, floor);
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
        return;
    }

    if (Number(info.floor) === Number(currentFloor)) {
        // ✅ ชั้นเดียวกัน
        ensureSinglePanel();
        loadFloorPlan(currentBuildingId, currentFloor, () => findPath());
        return;
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
                window.handlePathData(data);
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
    const SPEED_PX_PER_SEC = 80;

    // total distance
    const totalDistance = calculateTotalDistance(pathCoords);
    const distanceIndicator = document.getElementById('distanceIndicator');
    if (distanceIndicator) {
        distanceIndicator.textContent = `📏 ${Math.round(totalDistance * 0.01)} เมตร`;
        distanceIndicator.style.display = 'block';
    }

    function animate(now){
        if (!isAnimating) return;

        const dt = Math.min(50, now - last);
        last = now;
        runnerDist = (runnerDist + SPEED_PX_PER_SEC * (dt / 1000)) % (metricsAll.total || 1);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pulsePhase += 0.15;
        if (pathProgress < 1) pathProgress += 0.02;

        const visible = subPathByProgress(pathCoords, pathProgress);
        const mVis = buildPathMetrics(visible);

        // วาดเส้นทางแบบ Google Maps สีสดใส
        drawGoogleMapsPath(ctx, visible, 1);
        drawRunningLights(ctx, visible, mVis, runnerDist, { width: 6 });
        drawAnimatedNodes(ctx, visible, 1);

        animationId = requestAnimationFrame(animate);
    }

    cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(animate);
}

// ปรับปรุงการวาดเส้นทางให้สีสดใสเหมือน Google Maps
function drawGoogleMapsPath(ctx, pathCoords, progress) {
    if (pathCoords.length < 2) return;

    const visiblePoints = Math.floor(pathCoords.length * progress);
    if (visiblePoints < 2) return;

    ctx.save();

    // วาดเส้นพื้นหลังสีเข้ม (เงา)
    ctx.beginPath();
    ctx.moveTo(pathCoords[0].x, pathCoords[0].y);
    for (let i = 1; i < visiblePoints; i++) {
        ctx.lineTo(pathCoords[i].x, pathCoords[i].y);
    }

    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // วาดเส้นหลักสีขาวใส
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();

    // วาดเส้นทางหลักสีฟ้าสด Google Maps
    const gradient = ctx.createLinearGradient(
        pathCoords[0].x, pathCoords[0].y,
        pathCoords[visiblePoints - 1].x, pathCoords[visiblePoints - 1].y
    );
    gradient.addColorStop(0, '#1976D2');    // น้ำเงินเข้ม
    gradient.addColorStop(0.3, '#2196F3');  // น้ำเงิน Google
    gradient.addColorStop(0.7, '#03A9F4');  // ฟ้าสด
    gradient.addColorStop(1, '#00BCD4');    // ฟ้าอมเขียว

    ctx.lineWidth = 8;
    ctx.strokeStyle = gradient;
    ctx.shadowColor = '#2196F3';
    ctx.shadowBlur = 8;
    ctx.stroke();

    ctx.restore();
}

// ปรับปรุงการวาดจุดเริ่มต้นและปลายทาง
function drawAnimatedNodes(ctx, pathCoords, progress) {
    const visiblePoints = Math.floor(pathCoords.length * progress);

    pathCoords.forEach((point, index) => {
        if (index >= visiblePoints) return;

        const isStart = index === 0;
        const isEnd = index === pathCoords.length - 1;
        const pulseSize = 2 + Math.sin(pulsePhase + index * 0.5) * 1;

        ctx.save();

        if (isStart) {
            // จุดเริ่มต้นสีเขียวสด
            ctx.beginPath();
            ctx.arc(point.x, point.y, 10 + pulseSize, 0, Math.PI * 2);
            ctx.fillStyle = '#4CAF50';  // เขียว Google
            ctx.shadowColor = '#4CAF50';
            ctx.shadowBlur = 12;
            ctx.fill();

            // วงกลมขาวด้านใน
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.shadowBlur = 0;
            ctx.fill();

            // จุดตรงกลาง
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#4CAF50';
            ctx.fill();

        } else if (isEnd && index < visiblePoints) {
            // จุดปลายทางสีแดงสด
            ctx.beginPath();
            ctx.arc(point.x, point.y, 10 + pulseSize, 0, Math.PI * 2);
            ctx.fillStyle = '#F44336';  // แดง Google
            ctx.shadowColor = '#F44336';
            ctx.shadowBlur = 15;
            ctx.fill();

            // วงกลมขาวด้านใน
            ctx.beginPath();
            ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.shadowBlur = 0;
            ctx.fill();

            // จุดตรงกลาง
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#F44336';
            ctx.fill();
        }

        ctx.restore();
    });
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

        ensureStackMode();

        const imgFrom = document.getElementById('floorPlan_from');
        const imgTo = document.getElementById('floorPlan_to');
        const cvsFrom = document.getElementById('pathCanvas_from');
        const cvsTo = document.getElementById('pathCanvas_to');

        setupCanvasFor(imgFrom, cvsFrom);
        setupCanvasFor(imgTo, cvsTo);

        const scaledFrom = scalePathToImageSizeFor(imgFrom, cvsFrom, data.origin.path, data.origin.img_width, data.origin.img_height);
        const scaledTo = scalePathToImageSizeFor(imgTo, cvsTo, data.destination.path, data.destination.img_width, data.destination.img_height);

        startCrossFloorAnimation(scaledFrom, scaledTo);

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

// NEW: index ข้อมูลห้องทั้งหมดในอาคาร
let allRoomsIndex = {};

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
    initStackCanvasSizing();
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

// แอนิเมตแบบ cross-floor
function startCrossFloorAnimation(scaledFrom, scaledTo) {
    const cvsFrom = document.getElementById('pathCanvas_from');
    const cvsTo = document.getElementById('pathCanvas_to');
    const ctxFrom = cvsFrom.getContext('2d');
    const ctxTo = cvsTo.getContext('2d');

    let progressFrom = 0, progressTo = 0, phase = 0;
    let last = performance.now();
    const SPEED_PX_PER_SEC = 80;

    let distFrom = 0, distTo = 0;

    function drawSlide(ctx, coords, progress, runnerDist){
        const visible = subPathByProgress(coords, progress);
        const mVis = buildPathMetrics(visible);
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        drawGoogleMapsPath(ctx, visible, 1);
        drawRunningLights(ctx, visible, mVis, runnerDist, { width: 6 });
        pulsePhase = phase;
        drawAnimatedNodes(ctx, visible, 1);
    }

    function tick(now){
        phase += 0.15;
        const dt = Math.min(50, now - last);
        last = now;

        distFrom = (distFrom + SPEED_PX_PER_SEC * (dt / 1000)) % Math.max(1, buildPathMetrics(scaledFrom).total);
        distTo = (distTo + SPEED_PX_PER_SEC * (dt / 1000)) % Math.max(1, buildPathMetrics(scaledTo).total);
        if (progressFrom < 1) progressFrom += 0.02;
        if (progressTo < 1) progressTo += 0.02;

        drawSlide(ctxFrom, scaledFrom, progressFrom, distFrom);
        drawSlide(ctxTo, scaledTo, progressTo, distTo);

        animationId = requestAnimationFrame(tick);
    }

    cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(tick);
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
    const ow = originalWidth || imgEl.naturalWidth || cw || 1;
    const oh = originalHeight || imgEl.naturalHeight || ch || 1;
    const sx = cw / ow, sy = ch / oh;
    return pathCoords.map(p => ({ x: Math.round(p.x * sx), y: Math.round(p.y * sy), node_id: p.node_id }));
}

function syncCanvasToImage(imgEl, canvasEl) {
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

    imgFrom?.addEventListener('load', doSync);
    imgTo?.addEventListener('load', doSync);
    window.addEventListener('resize', doSync);
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

// ปรับปรุงไฟวิ่งให้สีสดใสขึ้น
function drawRunningLights(ctx, coords, metrics, headDist, opts = {}){
    if (!coords || coords.length < 2 || metrics.total === 0) return;

    const dash = opts.dash ?? 18;
    const gap = opts.gap ?? 12;
    const width = opts.width ?? 6;

    ctx.save();
    ctx.setLineDash([dash, gap]);
    ctx.lineDashOffset = - (headDist % (dash + gap));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over';

    // glow underlay - สีทองสดใส
    ctx.lineWidth = width + 2;
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';

    ctx.beginPath();
    ctx.moveTo(coords[0].x, coords[0].y);
    for (let i = 1; i < coords.length; i++) ctx.lineTo(coords[i].x, coords[i].y);
    ctx.stroke();

    // bright core - สีเหลืองสด
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(2, width - 2);
    ctx.strokeStyle = '#FFFF00';
    ctx.stroke();
    ctx.restore();

    // comet head + short tail
    const head = pointAtDistance(coords, metrics, headDist);
    const tail = pointAtDistance(coords, metrics, Math.max(0, headDist - (opts.tailLen ?? 40)));

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // tail segment - ไล่สีจากทองไปขาว
    const tailGrad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    tailGrad.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
    tailGrad.addColorStop(1, 'rgba(255, 255, 255, 0.9)');

    ctx.beginPath();
    ctx.lineWidth = width + 2;
    ctx.strokeStyle = tailGrad;
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(head.x, head.y);
    ctx.stroke();

    // head glow - สีขาวสดใส
    const R = opts.headRadius ?? 12;
    const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, R);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.5, 'rgba(255, 215, 0, 0.6)');
    g.addColorStop(1, 'rgba(255, 215, 0, 0)');
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





