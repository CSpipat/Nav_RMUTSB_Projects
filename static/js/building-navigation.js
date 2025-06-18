let currentBuildingId = null;
let currentFloor = null;
let searchTimeout = null;

// Load buildings when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadBuildings();
    
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', performSearch);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
});

function navigateToRoom(buildingId, floor, roomId) {
    currentBuildingId = buildingId;
    const targetRoomId = roomId;

    selectFloor(floor, () => {
        document.getElementById('destinationSelect').value = targetRoomId;
        
        // รอให้ modal แสดงและ DOM เสถียรก่อนวาดเส้น
        setTimeout(() => {
            setupCanvas();
            findPath();
        }, 100);
    });
}

function selectBuilding(buildingId) {
    currentBuildingId = buildingId;
    fetch(`/get_floor_info/${buildingId}`)
        .then(response => response.json())
        .then(floors => {
            const floorList = document.getElementById('floorList');
            floorList.innerHTML = '';
            floors.forEach(floor => {
                const button = document.createElement('button');
                button.className = 'list-group-item list-group-item-action';
                button.textContent = `ชั้น ${floor}`;
                button.onclick = () => selectFloor(floor);
                floorList.appendChild(button);
            });
            
            // ซ่อน modal ผลการค้นหาและ building modal
            document.getElementById('searchResults').style.display = 'none';
            if (bootstrap.Modal.getInstance(document.getElementById('buildingModal'))) {
                bootstrap.Modal.getInstance(document.getElementById('buildingModal')).hide();
            }
            // แสดง floor modal
            const floorModal = new bootstrap.Modal(document.getElementById('floorModal'));
            floorModal.show();
        });
}

function selectFloor(floor, callback = null) {
    currentFloor = floor;
    fetch(`/get_rooms/${currentBuildingId}/${floor}`)
        .then(response => response.json())
        .then(rooms => {
            const select = document.getElementById('destinationSelect');
            select.innerHTML = '<option value="">เลือกห้องที่ต้องการไป</option>';
            rooms.forEach(room => {
                const option = document.createElement('option');
                option.value = room;
                option.textContent = `ห้อง ${room}`;
                select.appendChild(option);
            });

            const floorPlan = document.getElementById('floorPlan');
            
            // ปิด floor modal ก่อน
            if (bootstrap.Modal.getInstance(document.getElementById('floorModal'))) {
                bootstrap.Modal.getInstance(document.getElementById('floorModal')).hide();
            }
            
            // แสดง indoor modal
            const indoorModal = new bootstrap.Modal(document.getElementById('indoorModal'));
            indoorModal.show();
            
            // รอให้ modal แสดงเสร็จแล้วจึงโหลดรูป
            setTimeout(() => {
                floorPlan.onload = function() {
                    // รอให้รูปโหลดเสร็จและ DOM เสถียร
                    setTimeout(() => {
                        setupCanvas();
                        // เรียก callback หลังจากโหลดเสร็จ (ถ้ามี)
                        if (callback) callback();
                    }, 50);
                };
                
                // ถ้ารูปโหลดแล้ว ให้เรียก onload ทันที
                if (floorPlan.complete && floorPlan.naturalWidth > 0) {
                    floorPlan.onload();
                } else {
                    floorPlan.src = `/static/img/planTower${currentBuildingId}Flor${currentFloor}.png`;
                }
            }, 300); // รอให้ modal animation เสร็จ
        });
}

// แก้ไขฟังก์ชัน performSearch เพื่อให้ซ่อน modal ต่างๆ เมื่อแสดงผลการค้นหา
function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    const resultsContainer = document.getElementById('searchResults');

    if (query.length < 2) {
        resultsContainer.style.display = 'none';
        return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        fetch(`/search?q=${encodeURIComponent(query)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(results => {
                // ซ่อน modals ทั้งหมด
                ['buildingModal', 'floorModal', 'indoorModal'].forEach(modalId => {
                    const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
                    if (modal) modal.hide();
                });

                if (results.error) {
                    resultsContainer.innerHTML = `<div class="list-group-item text-danger">
                        เกิดข้อผิดพลาด: ${results.message || 'ไม่สามารถค้นหาได้'}</div>`;
                } else if (results.length === 0) {
                    resultsContainer.innerHTML = '<div class="list-group-item">ไม่พบผลลัพธ์</div>';
                } else {
                    resultsContainer.innerHTML = results.map(result => {
                        if (result.type === 'building') {
                            return `
                                <button class="list-group-item list-group-item-action" 
                                    onclick="selectBuilding(${result.id})">
                                    <div class="d-flex w-100 justify-content-between">
                                        <h6 class="mb-1">${result.name}</h6>
                                        <small>${result.floor} ชั้น</small>
                                    </div>
                                    ${result.keywords && result.keywords.length > 0 ? 
                                        `<small class="text-muted">คำสำคัญ: ${result.keywords.join(', ')}</small>` : ''}
                                </button>`;
                        } else {
                            return `
                                <button class="list-group-item list-group-item-action" 
                                    onclick="navigateToRoom(${result.building_id}, ${result.floor}, '${result.id}')">
                                    <div class="d-flex w-100 justify-content-between">
                                        <h6 class="mb-1">${result.name}</h6>
                                        <small>ห้อง ${result.id}</small>
                                    </div>
                                    <small>ตึก ${result.building_id} ชั้น ${result.floor}</small>
                                </button>`;
                        }
                    }).join('');
                }
                resultsContainer.style.display = 'block';
            })
            .catch(error => {
                console.error('Error:', error);
                resultsContainer.innerHTML = `<div class="list-group-item text-danger">
                    เกิดข้อผิดพลาดในการค้นหา: ${error.message}</div>`;
                resultsContainer.style.display = 'block';
            });
    }, 300);
}

function loadBuildings() {
    fetch('/get_building_info')
        .then(response => response.json())
        .then(buildings => {
            const buildingList = document.getElementById('buildingList');
            buildingList.innerHTML = '';
            buildings.forEach(building => {
                const button = document.createElement('button');
                button.className = 'list-group-item list-group-item-action';
                button.textContent = `${building.Name} (${building.Floor} ชั้น)`;
                button.onclick = () => selectBuilding(building.B_ID);
                buildingList.appendChild(button);
            });
        });
}

function onDestinationChange() {
    const destination = document.getElementById('destinationSelect').value;
    if (destination) {
        // รอสักครู่เพื่อให้ DOM เสถียร
        setTimeout(() => {
            setupCanvas();
            findPath();
        }, 100);
    } else {
        // ถ้าไม่ได้เลือกห้อง (เลือกตัวเลือกแรก) ให้ล้าง canvas
        const canvas = document.getElementById('pathCanvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        document.getElementById('pathInfo').innerHTML = '';
    }
}

function setupCanvas() {
    const canvas = document.getElementById('pathCanvas');
    const img = document.getElementById('floorPlan');

    // รอให้ image โหลดเสร็จและมีขนาดจริง
    if (!img.complete || img.naturalWidth === 0) {
        // ถ้ารูปยังไม่โหลดเสร็จ รอแล้วเรียกใหม่
        setTimeout(() => setupCanvas(), 100);
        return;
    }

    // รอให้ DOM render เสร็จ
    setTimeout(() => {
        // ปรับขนาด canvas ให้เท่ากับรูปแผนผัง
        const imgRect = img.getBoundingClientRect();
        canvas.width = img.clientWidth || imgRect.width;
        canvas.height = img.clientHeight || imgRect.height;

        // ถ้ายังไม่มีขนาด ให้ใช้ขนาดจริงของรูป
        if (canvas.width === 0 || canvas.height === 0) {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
        }

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        console.log('Canvas setup - Width:', canvas.width, 'Height:', canvas.height);
    }, 50);
}

// เพิ่มฟังก์ชันสำหรับจัดการ resize
window.addEventListener('resize', function() {
    if (currentBuildingId && currentFloor) {
        setTimeout(() => {
            setupCanvas();
            const destination = document.getElementById('destinationSelect').value;
            if (destination) {
                findPath();
            }
        }, 100);
    }
});

// เพิ่มฟังก์ชันสำหรับการซูม (ถ้ายังไม่มี)
function zoomIn() {
    const img = document.getElementById('floorPlan');
    const container = img.parentElement;
    const currentScale = parseFloat(img.dataset.scale || '1');
    const newScale = Math.min(currentScale * 1.2, 3);
    
    img.style.transform = `scale(${newScale})`;
    img.dataset.scale = newScale;
    
    setTimeout(() => {
        setupCanvas();
        const destination = document.getElementById('destinationSelect').value;
        if (destination) {
            findPath();
        }
    }, 100);
}

function zoomOut() {
    const img = document.getElementById('floorPlan');
    const currentScale = parseFloat(img.dataset.scale || '1');
    const newScale = Math.max(currentScale / 1.2, 0.5);
    
    img.style.transform = `scale(${newScale})`;
    img.dataset.scale = newScale;
    
    setTimeout(() => {
        setupCanvas();
        const destination = document.getElementById('destinationSelect').value;
        if (destination) {
            findPath();
        }
    }, 100);
}

function resetView() {
    const img = document.getElementById('floorPlan');
    img.style.transform = 'scale(1)';
    img.dataset.scale = '1';
    
    setTimeout(() => {
        setupCanvas();
        const destination = document.getElementById('destinationSelect').value;
        if (destination) {
            findPath();
        }
    }, 100);
}