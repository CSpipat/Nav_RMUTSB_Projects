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
    
    // เก็บค่า roomId ไว้ใช้หลังจากโหลดห้องเสร็จ
    const targetRoomId = roomId;
    
    selectFloor(floor, () => {
        // เลือกห้องที่ต้องการในตัวเลือก
        document.getElementById('destinationSelect').value = targetRoomId;
        // เรียกฟังก์ชันค้นหาเส้นทางและวาดเส้นทาง
        findPath();
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
            floorPlan.onload = function() {
                if (bootstrap.Modal.getInstance(document.getElementById('floorModal'))) {
                    bootstrap.Modal.getInstance(document.getElementById('floorModal')).hide();
                }
                const indoorModal = new bootstrap.Modal(document.getElementById('indoorModal'));
                indoorModal.show();
                setupCanvas();
                // เรียก callback หลังจากโหลดเสร็จ (ถ้ามี)
                if (callback) callback();
            };
            floorPlan.src = `/static/img/planTower${currentBuildingId}Flor${currentFloor}.png`;
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
        findPath();
    } else {
        // ถ้าไม่ได้เลือกห้อง (เลือกตัวเลือกแรก) ให้ล้าง canvas
        const canvas = document.getElementById('pathCanvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        document.getElementById('pathInfo').innerHTML = '';
    }
}