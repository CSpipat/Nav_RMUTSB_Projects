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

// Building coordinates from CSV
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

            // ใช้ OpenStreetMap เป็น base layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);
            
            // เพิ่มชั้นข้อมูลสำหรับทางเท้าจาก OSM (เปิดให้เห็นเป็นค่าเริ่มต้น)
            var osmFootpathsLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
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
            
            // เพิ่มตัวควบคุมชั้นข้อมูล
            var baseLayers = {
                "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
            };
            
            var overlays = {
                "แสดงทางเท้า": osmFootpathsLayer
            };
            
            L.control.layers(baseLayers, overlays).addTo(map);
            
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
 * ค้นหาเส้นทางไปยังอาคารปลายทาง โดยใช้ OSRM API สำหรับเส้นทางเดินเท้า
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
    
    // ใช้ OSRM API เพื่อหาเส้นทางเดินเท้า (เน้นการเดินตามทางเท้า)
    // ต้องสลับ longitude/latitude ตาม API ของ OSRM
    const startLonLat = `${startCoords[1]},${startCoords[0]}`;
    const destLonLat = `${destinationCoords[1]},${destinationCoords[0]}`;
    
    // ใช้ OSRM API แบบสาธารณะ
    const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${startLonLat};${destLonLat}?overview=full&geometries=geojson`;
    
    console.log("Fetching route from OSRM API:", osrmUrl);
    
    // สร้างฟังก์ชันเพื่อประมวลผลเส้นทางจาก OSRM
    fetch(osrmUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // ซ่อนตัวบ่งชี้กำลังโหลด
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            
            if (!data.routes || data.routes.length === 0) {
                throw new Error('No route found');
            }
            
            // ดึงข้อมูลเส้นทางและระยะทาง
            const route = data.routes[0];
            const geometry = route.geometry.coordinates;
            
            // แปลงพิกัด [longitude, latitude] เป็น [latitude, longitude] ตามที่ Leaflet ต้องการ
            const pathCoords = geometry.map(coord => [coord[1], coord[0]]);
            
            // คำนวณระยะทางเป็นเมตร
                // คำนวณระยะทางโดยประมาณ (แบบเส้นตรงระหว่างแต่ละจุดใน path)
    let distanceInMeters = 0;
    for (let i = 0; i < pathCoords.length - 1; i++) {
        distanceInMeters += getDistance(pathCoords[i], pathCoords[i + 1]);
    }

    // ลบเส้นทางเดิม (ถ้ามี)
    if (routeLayer) map.removeLayer(routeLayer);
    if (animatedPath) map.removeLayer(animatedPath);
    if (destinationMarker) map.removeLayer(destinationMarker);
    if (animationFrame) cancelAnimationFrame(animationFrame);

    // วาดเส้นทางหลัก
    routeLayer = L.polyline(pathCoords, {
        color: '#6c757d',
        weight: 6,
        opacity: 0.6
    }).addTo(map);

    // วาดเส้นแอนิเมชันแบบ dashed
    animatedPath = L.polyline(pathCoords, {
        color: '#ffc107',
        weight: 3,
        dashArray: "15, 10",
        dashOffset: 0
    }).addTo(map);

    // เริ่มแอนิเมชัน
    if (animatedPath._path) {
        dashOffset = 0;
        animationFrame = requestAnimationFrame(animatePath);
    }

    // แสดง marker ปลายทาง
    destinationMarker = L.marker(destinationCoords, { icon: destinationIcon })
        .addTo(map)
        .bindPopup(selectedBuilding)
        .openPopup();

    // ปรับมุมมองให้เห็นเส้นทางทั้งหมด
    map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

    // แสดงข้อมูลระยะทาง
    if (distanceValue && distanceInfo) {
        distanceValue.innerText = Math.round(distanceInMeters);
        distanceInfo.style.display = 'block';
    }

    // แสดง toast แจ้งเตือน
    showToast(`ใช้เส้นทางสำรอง: ประมาณ ${Math.round(distanceInMeters)} เมตร`, 'warning');
},

/**
 * คำนวณระยะทางระหว่างจุด 2 จุดบนพื้นผิวโลก (Haversine formula)
 * @param {Array} coord1 - [lat, lng]
 * @param {Array} coord2 - [lat, lng]
 * @returns {number} ระยะทางเป็นเมตร
 */
    function getDistance(coord1, coord2) {
    const R = 6371000; // รัศมีของโลก (เมตร)
    const lat1 = coord1[0] * Math.PI / 180;
    const lat2 = coord2[0] * Math.PI / 180;
    const deltaLat = (coord2[0] - coord1[0]) * Math.PI / 180;
    const deltaLng = (coord2[1] - coord1[1]) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // ระยะทางเป็นเมตร


            
            // แสดง toast แจ้งเตือนระยะทาง
            showToast(`พบเส้นทางแล้ว: ${distanceInMeters} เมตร`);
        })
        .catch(error => {
            console.error("Error fetching route:", error);
            
            // ซ่อนตัวบ่งชี้กำลังโหลด
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            
            // แสดง toast แจ้งเตือนข้อผิดพลาด
            showToast('ไม่สามารถค้นหาเส้นทางได้ กำลังใช้เส้นทางสำรอง', 'warning');
            
            // ใช้เส้นทางสำรองในกรณีที่ API OSRM ไม่ทำงาน
            useFallbackRoute(startCoords, destinationCoords);
        });
}

/**
 * ใช้เส้นทางสำรองในกรณีที่ OSRM API ไม่ทำงาน
 * @param {Array} start - พิกัดเริ่มต้น [latitude, longitude]
 * @param {Array} end - พิกัดปลายทาง [latitude, longitude]
 */
function useFallbackRoute(start, end) {
    // คำนวณจุดกึ่งกลางระหว่างจุดเริ่มต้นและปลายทาง
    const midLat = (start[0] + end[0]) / 2;
    const midLng = (start[1] + end[1]) / 2;
    
    // สร้างเส้นทางจำลองที่มีการโค้งเพื่อให้ดูเหมือนเส้นทางจริงมากขึ้น
    // แทนที่จะเป็นเส้นตรงระหว่างจุดเริ่มต้นและปลายทาง
    const midPoint1 = [start[0] + (midLat - start[0]) * 0.33, start[1] + (midLng - start[1]) * 0.33];
    const midPoint2 = [start[0] + (midLat - start[0]) * 0.66, start[1] + (midLng - start[1]) * 0.66];
    
    // สร้างทางแยกเพื่อให้เส้นทางดูเหมือนตามถนนหรือทางเท้า
    const offset = 0.0001; // ประมาณ 10 เมตร
    midPoint1[1] += offset;
    midPoint2[1] -= offset;
    
    const pathCoords = [
        start,
        midPoint1,
        midPoint2,
        end
    ];
    
    // คำนวณระยะทางโดยประมาณ
    let distance = 0;
    for (let i = 0; i < pathCoords.length - 1; i++) {
        distance += calculateDistance(
            pathCoords[i][0], pathCoords[i][1],
            pathCoords[i+1][0], pathCoords[i+1][1]
        );
    }
    const distanceInMeters = Math.round(distance);
    
    if (routeLayer) map.removeLayer(routeLayer);
    if (animatedPath) map.removeLayer(animatedPath);
    if (destinationMarker) map.removeLayer(destinationMarker);
    if (animationFrame) cancelAnimationFrame(animationFrame);
    
    // สร้างเส้นทางหลัก
    routeLayer = L.polyline(pathCoords, { 
        color: '#0d6efd',
        weight: 8,
        opacity: 0.7
    }).addTo(map);
    
    // สร้างเส้นทางแบบแอนิเมชั่นด้วยรูปแบบเส้นประ
    animatedPath = L.polyline(pathCoords, { 
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
    destinationMarker = L.marker(end, { icon: destinationIcon })
        .addTo(map)
        .bindPopup(selectedBuilding)
        .openPopup();
        
    // ปรับมุมมองให้เห็นเส้นทางทั้งหมด
    map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
    
    // แสดงระยะทาง
    if (distanceValue && distanceInfo) {
        distanceValue.innerText = distanceInMeters;
        distanceInfo.style.display = 'block';
    }
}

/**
 * คำนวณระยะทางระหว่างจุดสองจุดบนพื้นผิวโลกด้วยสูตร Haversine
 * @param {number} lat1 - ละติจูดของจุดที่ 1
 * @param {number} lon1 - ลองจิจูดของจุดที่ 1
 * @param {number} lat2 - ละติจูดของจุดที่ 2
 * @param {number} lon2 - ลองจิจูดของจุดที่ 2
 * @returns {number} ระยะทางเป็นเมตร
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // รัศมีของโลกเป็นเมตร
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
}