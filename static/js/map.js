let map = null;
let startMarker = null;
let startCoords = [13.868429, 100.482303]; // ตำแหน่งเริ่มต้น
let destinationMarker = null;
let routeLayer = null;
let animatedPath = null;
let animationFrame = null;
let selectedBuilding = null;
let dashOffset = 0;
let mapModal = null;

// กำหนดไอคอนสำหรับ marker
const userIcon = L.icon({
    iconUrl: '/static/img/student.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

const destinationIcon = L.icon({
    iconUrl: '/static/img/goal.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

// เมื่อ DOM โหลดเสร็จแล้ว
document.addEventListener('DOMContentLoaded', function() {
    // เตรียม Bootstrap Modal
    mapModal = new bootstrap.Modal(document.getElementById('mapModal'));
    
    // ตรวจสอบและเตรียมองค์ประกอบ UI
    document.getElementById('mapModal').addEventListener('shown.bs.modal', function () {
        if (map) map.invalidateSize();
    });
    
    // เตรียม element สำหรับแสดงข้อมูล
    distanceInfo = document.getElementById('distance-info');
    distanceValue = document.getElementById('distance-value');
    loadingIndicator = document.getElementById('loading-indicator');
});

/**
 * เริ่มต้นแผนที่
 */
function initMap() {
    if (map === null) {
        map = L.map('map').setView([13.868404, 100.482293], 18);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // กำหนดตำแหน่งเริ่มต้นของผู้ใช้
        updateStartMarker(startCoords);

        map.on('click', function(e) {
            updateStartMarker([e.latlng.lat, e.latlng.lng]);
            if (selectedBuilding) {
                findRoute();
            }
        });
        
        // แสดง tooltip สำหรับการใช้งาน
        L.control.attribution({
            position: 'bottomleft',
            prefix: '<small>คลิกบนแผนที่เพื่อเปลี่ยนตำแหน่งเริ่มต้น</small>'
        }).addTo(map);
    }
}

/**
 * อัปเดตตำแหน่งของ marker เริ่มต้น
 * @param {Array} coords - พิกัด [latitude, longitude]
 */
function updateStartMarker(coords) {
    if (startMarker) map.removeLayer(startMarker);
    startCoords = coords;
    startMarker = L.marker(startCoords, { icon: userIcon })
        .addTo(map)
        .bindPopup('ตำแหน่งของคุณ')
        .openPopup();
}

/**
 * ติดตามตำแหน่งของผู้ใช้
 */
function watchUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            (position) => {
                console.log("Got position:", position.coords.latitude, position.coords.longitude);
                const userCoords = [position.coords.latitude, position.coords.longitude];
                updateStartMarker(userCoords);
                
                // ถ้ามีเส้นทางแสดงอยู่แล้ว ให้คำนวณใหม่
                if (selectedBuilding && routeLayer) {
                    findRoute();
                }
                
                // แสดง toast แจ้งเตือน
                showToast('อัปเดตตำแหน่งของคุณแล้ว');
            },
            (error) => {
                console.error("Geolocation error:", error);
                showToast('ไม่สามารถดึงตำแหน่งของคุณได้', 'danger');
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    } else {
        console.log("Geolocation not supported");
        showToast('เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง', 'warning');
    }
}

/**
 * แสดง Toast notification
 * @param {string} message - ข้อความแจ้งเตือน
 * @param {string} type - ประเภทของ toast (success, danger, warning)
 */
function showToast(message, type = 'success') {
    // สร้าง toast element
    const toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    
    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-white bg-${type} border-0`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    
    const toastFlex = document.createElement('div');
    toastFlex.className = 'd-flex';
    
    const toastBody = document.createElement('div');
    toastBody.className = 'toast-body';
    toastBody.textContent = message;
    
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn-close btn-close-white me-2 m-auto';
    closeButton.setAttribute('data-bs-dismiss', 'toast');
    closeButton.setAttribute('aria-label', 'Close');
    
    toastFlex.appendChild(toastBody);
    toastFlex.appendChild(closeButton);
    toastEl.appendChild(toastFlex);
    toastContainer.appendChild(toastEl);
    document.body.appendChild(toastContainer);
    
    // เปิด toast
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
    
    // ลบ toast container หลังจาก toast ถูกปิด
    toastEl.addEventListener('hidden.bs.toast', function() {
        document.body.removeChild(toastContainer);
    });
}

/**
 * แอนิเมชั่นสำหรับเส้นทาง
 */
function animatePath() {
    if (animatedPath) {
        dashOffset -= 0.5;
        const pathElement = animatedPath._path;
        if (pathElement) {
            pathElement.style.strokeDashoffset = dashOffset;
        }
        animationFrame = requestAnimationFrame(animatePath);
    }
}

/**
 * แสดงแผนที่สำหรับอาคารที่เลือก
 * @param {string} buildingName - ชื่ออาคาร
 */
function showMapForBuilding(buildingName) {
    document.getElementById("building-name").innerText = buildingName;
    selectedBuilding = buildingName;
    
    // เปิด Bootstrap Modal
    mapModal.show();
    
    // เริ่มต้นแผนที่ถ้ายังไม่มี
    initMap();
    
    // ดึงตำแหน่งปัจจุบันของผู้ใช้
    watchUserLocation();
    
    // ค้นหาเส้นทางอัตโนมัติ
    findRoute();
}

/**
 * ค้นหาเส้นทางไปยังอาคารปลายทาง
 */
function findRoute() {
    if (!selectedBuilding) {
        showToast('กรุณาเลือกอาคารปลายทาง!', 'warning');
        return;
    }

    if (!startCoords) {
        showToast('กรุณาคลิกเลือกจุดเริ่มต้นบนแผนที่!', 'warning');
        return;
    }

    // แสดงตัวบ่งชี้กำลังโหลด
    loadingIndicator.style.display = 'flex';
    distanceInfo.style.display = 'none';

    fetch('/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: startCoords, end: selectedBuilding })
    })
    .then(response => {
        if (!response.ok) throw new Error("Failed to fetch route");
        return response.json();
    })
    .then(data => {
        // ซ่อนตัวบ่งชี้กำลังโหลด
        loadingIndicator.style.display = 'none';
        
        if (!data.path_coords || data.path_coords.length === 0) {
            showToast('ไม่พบเส้นทางไปยังปลายทาง!', 'danger');
            return;
        }

        if (routeLayer) map.removeLayer(routeLayer);
        if (animatedPath) map.removeLayer(animatedPath);
        if (destinationMarker) map.removeLayer(destinationMarker);
        if (animationFrame) cancelAnimationFrame(animationFrame);

        // สร้างเส้นทางหลัก
        routeLayer = L.polyline(data.path_coords, { 
            color: '#0d6efd',
            weight: 8,
            opacity: 0.7
        }).addTo(map);
        
        // สร้างเส้นทางแบบแอนิเมชั่นด้วยรูปแบบเส้นประ
        animatedPath = L.polyline(data.path_coords, { 
            color: '#ffc107', 
            weight: 4, 
            dashArray: "20, 15",
            dashOffset: 0
        }).addTo(map);
        
        // ใส่แอนิเมชั่นให้กับเส้นทาง
        if (animatedPath._path) {
            dashOffset = 0;
            animationFrame = requestAnimationFrame(animatePath);
        }

        // เพิ่ม marker ปลายทาง
        const endCoords = data.path_coords[data.path_coords.length - 1];
        destinationMarker = L.marker(endCoords, { icon: destinationIcon })
            .addTo(map)
            .bindPopup(selectedBuilding)
            .openPopup();

        // ปรับมุมมองให้เห็นเส้นทางทั้งหมด
        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
        
        // แสดงระยะทาง
        if (data.distance) {
            distanceValue.innerText = data.distance;
            distanceInfo.style.display = 'block';
            
            // แสดง toast แจ้งเตือนระยะทาง
            showToast(`พบเส้นทางแล้ว: ${data.distance} เมตร`);
        }
    })
    .catch(error => {
        // ซ่อนตัวบ่งชี้กำลังโหลด
        loadingIndicator.style.display = 'none';
        
        console.error("Error:", error);
        showToast('เกิดข้อผิดพลาดในการค้นหาเส้นทาง กรุณาลองใหม่', 'danger');
    });
}