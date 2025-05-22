// Global variables
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
let distanceInfo = null;
let distanceValue = null;
let loadingIndicator = null;

// Building coordinates from CSV - แก้ไขให้ใช้ชื่ออาคารที่มีรูปแบบตรงกับที่เรียกใช้
const buildingCoordinates = {
    "อาคาร16": [13.867497, 100.482877],
    "อาคาร17": [13.867502, 100.482749],
    "อาคาร18": [13.867895, 100.483017],
    "อาคาร19": [13.868197, 100.482832],
    "อาคาร20": [13.868567, 100.482821],
    "อาคาร21": [13.868789, 100.482722],
    "โรงอาหาร": [13.867333, 100.482813]
};

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
    console.log("DOM loaded, setting up modal");
    
    // Get DOM elements
    const mapModalElement = document.getElementById('mapModal');
    
    if (mapModalElement) {
        // เตรียม Bootstrap Modal
        mapModal = new bootstrap.Modal(mapModalElement);
        
        // ตรวจสอบและเตรียมองค์ประกอบ UI
        mapModalElement.addEventListener('shown.bs.modal', function () {
            console.log("Modal shown, invalidating map size");
            if (map) map.invalidateSize();
        });
    } else {
        console.error("Map modal element not found");
    }
    
    // เตรียม element สำหรับแสดงข้อมูล
    distanceInfo = document.getElementById('distance-info');
    distanceValue = document.getElementById('distance-value');
    loadingIndicator = document.getElementById('loading-indicator');
    
    // ยกเลิกการใช้ event listener เนื่องจากเราใช้ onclick attribute แล้ว
    // แก้ไขโดยนำส่วนนี้ออกเพื่อป้องกันการเรียกฟังก์ชันซ้ำซ้อน
    /*
    const searchButtons = document.querySelectorAll('.icons');
    searchButtons.forEach(button => {
        button.addEventListener('click', function() {
            const buildingNameElement = this.parentElement.querySelector('.tw-name');
            if (buildingNameElement) {
                const buildingName = buildingNameElement.textContent.split(' ')[0];
                console.log("Search button clicked for:", buildingName);
                showMapForBuilding(buildingName);
            }
        });
    });
    */
});

/**
 * เริ่มต้นแผนที่
 */
function initMap() {
    if (map === null) {
        console.log("Initializing map");
        try {
            // Check if the map container exists
            const mapContainer = document.getElementById('map');
            if (!mapContainer) {
                console.error("Map container not found");
                return;
            }
            
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
            
            console.log("Map initialized successfully");
        } catch (error) {
            console.error("Error initializing map:", error);
        }
    }
}

/**
 * อัปเดตตำแหน่งของ marker เริ่มต้น
 * @param {Array} coords - พิกัด [latitude, longitude]
 */
function updateStartMarker(coords) {
    if (!map) return;
    
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
    console.log("showMapForBuilding called with:", buildingName);
    
    // ต้องแน่ใจว่าชื่ออาคารที่รับเข้ามาตรงกับในตัวแปร buildingCoordinates
    // ตัดช่องว่างระหว่างคำออกเพื่อให้ตรงกับ key ใน buildingCoordinates
    buildingName = buildingName.replace(/\s+/g, '');
    
    const buildingNameElement = document.getElementById("building-name");
    if (buildingNameElement) {
        buildingNameElement.innerText = buildingName;
    }
    
    selectedBuilding = buildingName;
    
    // เพิ่ม debug เพื่อตรวจสอบว่าพิกัดที่เลือกมีอยู่จริง
    console.log("Selected building coordinates:", buildingCoordinates[buildingName]);
    
    // เปิด Bootstrap Modal
    if (mapModal) {
        console.log("Opening modal");
        mapModal.show();
    } else {
        console.error("mapModal is not initialized");
        const mapModalElement = document.getElementById('mapModal');
        if (mapModalElement) {
            mapModal = new bootstrap.Modal(mapModalElement);
            mapModal.show();
        } else {
            console.error("Map modal element not found");
            return;
        }
    }
    
    // เริ่มต้นแผนที่ถ้ายังไม่มี
    initMap();
    
    // ดึงตำแหน่งปัจจุบันของผู้ใช้
    // Commented out to avoid geolocation prompts during testing
    // watchUserLocation();
    
    // ค้นหาเส้นทางอัตโนมัติ
    findRoute();
}

/**
 * ค้นหาเส้นทางไปยังอาคารปลายทาง
 */
function findRoute() {
    if (!map) {
        console.error("Map not initialized");
        return;
    }
    
    if (!selectedBuilding) {
        showToast('กรุณาเลือกอาคารปลายทาง!', 'warning');
        return;
    }

    if (!startCoords) {
        showToast('กรุณาคลิกเลือกจุดเริ่มต้นบนแผนที่!', 'warning');
        return;
    }

    // แสดงตัวบ่งชี้กำลังโหลด
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
    }
    
    if (distanceInfo) {
        distanceInfo.style.display = 'none';
    }

    // Get the destination coordinates from our building data
    let destinationCoords = buildingCoordinates[selectedBuilding];
    if (!destinationCoords) {
        // เพิ่ม debugging เมื่อไม่พบพิกัดอาคาร
        console.error("Building coordinates not found for:", selectedBuilding);
        console.log("Available buildings:", Object.keys(buildingCoordinates));
        
        // Default coordinates if building not found
        destinationCoords = [13.868, 100.483];
        console.warn("Building coordinates not found, using default");
        
        // แสดง toast เตือนผู้ใช้
        showToast(`ไม่พบพิกัดสำหรับ ${selectedBuilding} กำลังใช้พิกัดเริ่มต้น`, 'warning');
    }

    // สำหรับการทดสอบ: จำลองการหาเส้นทางเพื่อแสดง UI ไปก่อน
    setTimeout(() => {
        // ซ่อนตัวบ่งชี้กำลังโหลด
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // สร้างเส้นทางจำลอง
        const dummyCoords = [
            startCoords,
            [startCoords[0] + 0.0005, startCoords[1] + 0.0005],
            [startCoords[0] + 0.001, startCoords[1]],
            destinationCoords
        ];
        
        if (routeLayer) map.removeLayer(routeLayer);
        if (animatedPath) map.removeLayer(animatedPath);
        if (destinationMarker) map.removeLayer(destinationMarker);
        if (animationFrame) cancelAnimationFrame(animationFrame);

        // สร้างเส้นทางหลัก
        routeLayer = L.polyline(dummyCoords, { 
            color: '#0d6efd',
            weight: 8,
            opacity: 0.7
        }).addTo(map);
        
        // สร้างเส้นทางแบบแอนิเมชั่นด้วยรูปแบบเส้นประ
        animatedPath = L.polyline(dummyCoords, { 
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
        destinationMarker = L.marker(destinationCoords, { icon: destinationIcon })
            .addTo(map)
            .bindPopup(selectedBuilding)
            .openPopup();

        // ปรับมุมมองให้เห็นเส้นทางทั้งหมด
        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
        
        // แสดงระยะทาง
        if (distanceValue && distanceInfo) {
            distanceValue.innerText = "250";
            distanceInfo.style.display = 'block';
        }
        
        // แสดง toast แจ้งเตือนระยะทาง
        showToast(`พบเส้นทางแล้ว: 250 เมตร`);
    }, 1000);

    /* ส่วนที่ต้องเปิดใช้เมื่อมี API จริง
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
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
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
        if (data.distance && distanceValue && distanceInfo) {
            distanceValue.innerText = data.distance;
            distanceInfo.style.display = 'block';
            
            // แสดง toast แจ้งเตือนระยะทาง
            showToast(`พบเส้นทางแล้ว: ${data.distance} เมตร`);
        }
    })
    .catch(error => {
        // ซ่อนตัวบ่งชี้กำลังโหลด
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        console.error("Error:", error);
        showToast('เกิดข้อผิดพลาดในการค้นหาเส้นทาง กรุณาลองใหม่', 'danger');
    });
    */
}