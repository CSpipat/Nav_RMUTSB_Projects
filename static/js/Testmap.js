let map = null;
let startMarker = null;
let startCoords = [13.868429, 100.482303]; // ตำแหน่งเริ่มต้น
let destinationMarker = null;
let routeLayer = null;
let animatedPath = null;
let animationFrame = null;
let selectedBuilding = null;
let dashOffset = 0;
const distanceInfo = document.getElementById('distance-info');
const distanceValue = document.getElementById('distance-value');
const loadingIndicator = document.getElementById('loading-indicator');

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
    }
}

/**
 * อัปเดตตำแหน่งของ marker เริ่มต้น
 * @param {Array} coords - พิกัด [latitude, longitude]
 */
function updateStartMarker(coords) {
    if (startMarker) map.removeLayer(startMarker);
    startCoords = coords;
    startMarker = L.marker(startCoords, { icon: userIcon }).addTo(map);
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
            },
            (error) => {
                console.error("Geolocation error:", error);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    } else {
        console.log("Geolocation not supported");
    }
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
    document.getElementById("modal-backdrop").style.display = "block";
    document.getElementById("map-modal").style.display = "block";
    document.getElementById("building-name").innerText = buildingName;

    selectedBuilding = buildingName;

    // เริ่มต้นแผนที่ถ้ายังไม่มี
    initMap();

    // ดึงตำแหน่งปัจจุบันของผู้ใช้
    watchUserLocation();

    // ค้นหาเส้นทางอัตโนมัติ
    findRoute();

    // ปรับขนาดแผนที่หลังจากแสดง modal เพื่อแก้ปัญหาการแสดงผล
    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 100);
}

/**
 * ปิด modal แผนที่
 */
function closeModal() {
    document.getElementById("modal-backdrop").style.display = "none";
    document.getElementById("map-modal").style.display = "none";

    // ล้างแอนิเมชั่นถ้าจำเป็น
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
}

/**
 * ค้นหาเส้นทางไปยังอาคารปลายทาง
 */
function findRoute() {
    if (!selectedBuilding) {
        alert("กรุณาเลือกอาคารปลายทาง!");
        return;
    }

    if (!startCoords) {
        alert("กรุณาคลิกเลือกจุดเริ่มต้นบนแผนที่!");
        return;
    }

    // แสดงตัวบ่งชี้กำลังโหลด
    loadingIndicator.style.display = 'block';
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
            alert("ไม่พบเส้นทางไปยังปลายทาง!");
            return;
        }

        if (routeLayer) map.removeLayer(routeLayer);
        if (animatedPath) map.removeLayer(animatedPath);
        if (destinationMarker) map.removeLayer(destinationMarker);
        if (animationFrame) cancelAnimationFrame(animationFrame);

        routeLayer = L.polyline(data.path_coords, { color: 'gray', weight: 9}).addTo(map);

        // สร้างเส้นทางแบบแอนิเมชั่นด้วยรูปแบบเส้นประ
        animatedPath = L.polyline(data.path_coords, {
            color: 'yellow',
            weight: 5,
            dashArray: "20, 15",
            dashOffset: 0
        }).addTo(map);

        // ใส่แอนิเมชั่นให้กับเส้นทาง
        if (animatedPath._path) {
            dashOffset = 0;
            animationFrame = requestAnimationFrame(animatePath);
        }

        const endCoords = data.path_coords[data.path_coords.length - 1];
        destinationMarker = L.marker(endCoords, { icon: destinationIcon }).addTo(map);

        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

        // แสดงระยะทาง
        if (data.distance) {
            distanceValue.innerText = data.distance;
            distanceInfo.style.display = 'block';
        }
    })
    .catch(error => {
        // ซ่อนตัวบ่งชี้กำลังโหลด
        loadingIndicator.style.display = 'none';

        console.error("Error:", error);
        alert("เกิดข้อผิดพลาดในการค้นหาเส้นทาง กรุณาลองใหม่");
    });
}