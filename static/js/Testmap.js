let map = null;
let startMarker = null;
let startCoords = [13.868429, 100.482303]; // ตำแหน่งเริ่มต้น
let destinationMarker = null;
let routeLayer = null;
let animatedPath = null;
let animationFrame = null;
let selectedBuilding = null;
let dashOffset = 0;
let hasArrived = false; // ใช้สำหรับเช็คว่าเคยแสดง modal แล้วหรือยัง
let modalShown = false;
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

        map.on('click', function (e) {
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
    startMarker = L.marker(startCoords, {icon: userIcon}).addTo(map);
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
                // ตรวจสอบระยะห่างจากจุดหมาย
                if (destinationMarker && destinationMarker.getLatLng) {
                    const endLatLng = destinationMarker.getLatLng();
                    const distanceToEnd = calculateDistance(
                        userCoords[0], userCoords[1],
                        endLatLng.lat, endLatLng.lng
                    );

                    console.log("ระยะห่างจากจุดหมาย:", distanceToEnd);

                    if (distanceToEnd < 10 && !hasArrived) {
                        hasArrived = true;
                        showSuccessModal(); // แสดง modal แจ้งเตือน
                    }

                }

                // ถ้ามีเส้นทางแสดงอยู่แล้ว ให้คำนวณใหม่
                if (selectedBuilding && routeLayer) {
                    findRoute();
                }
            },
            (error) => {
                console.error("Geolocation error:", error);
            },
            {enableHighAccuracy: true, timeout: 5000, maximumAge: 3000}
        );
    } else {
        console.log("Geolocation not supported");
    }
}

function showSuccessModal() {
  const modal = document.querySelector('.success-modal');
  if (modal) {
    modal.classList.add('show');
    modal.classList.remove('hidden');
    modalShown = true;
  }
}

function hideSuccessModal() {
  const modal = document.querySelector('.success-modal');
  if (modal) {
    modal.classList.remove('show');
    modal.classList.add('hidden');
    modalShown = false; // ถ้าต้องการให้เช็คใหม่อีกครั้งหลังจากปิด modal
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.querySelector('.success-modal button');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideSuccessModal);
  }
});

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
    hideSuccessModal()
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
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({start: startCoords, end: selectedBuilding})
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

            routeLayer = L.polyline(data.path_coords, {color: 'gray', weight: 9}).addTo(map);

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
            destinationMarker = L.marker(endCoords, {icon: destinationIcon}).addTo(map);

            map.fitBounds(routeLayer.getBounds(), {padding: [50, 50]});

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

// ===== Building Modal Functions =====

/**
 * เปิด Modal แสดงรายละเอียดอาคาร
 * @param {string} buildingName - ชื่ออาคาร
 */function openBuildingModal(buildingName) {
    let id = '';
    if (buildingName.startsWith('อาคาร')) {
        id = buildingName.replace('อาคาร', '').trim();
    } else if (buildingName === 'โรงอาหาร') {
        id = '0'; // หรือใช้ชื่อที่คุณตั้งจริง
    } else {
        // fallback: ใช้ชื่อเต็ม
        id = buildingName.trim();
    }

    const modal = document.getElementById(`building-modal-${id}`);
    if (modal) {
        modal.style.display = 'flex';
        const detailModal = modal.querySelector('.detail-building-modal');
        if (detailModal) {
            setTimeout(() => {
                detailModal.classList.add('show');
            }, 10);
        }
    } else {
        console.warn(`ไม่พบ modal: building-modal-${id}`);
    }
}


function closeBuildingModal(modalId) {
    if (!modalId) return; // ถ้าไม่มี id ก็ไม่ทำอะไร
    const modal = document.getElementById(modalId);
    if (modal) {
        const detailModal = modal.querySelector('.detail-building-modal');
        if (detailModal) {
            detailModal.classList.remove('show');
        }
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}


// ปิด modal เมื่อคลิกนอก modal (click backdrop)
// สมมติ modalContainer คือ element ที่มี id เช่น 'building-modal-21'
// เลือก modal ทุกตัวที่ id เริ่มต้นด้วย 'building-modal-'
const modalContainers = document.querySelectorAll('[id^="building-modal-"]');

modalContainers.forEach(modalContainer => {
    modalContainer.addEventListener('click', (e) => {
        if (e.target === modalContainer) {
            closeBuildingModal(modalContainer.id);
        }
    });

    // สมมติว่ามีปุ่มปิดใน modal
    const closeBtn = modalContainer.querySelector('.detail-building-modal .header div');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeBuildingModal(modalContainer.id);
        });
    }
});


// ===== Event Listeners =====

// เมื่อโหลดหน้าเว็บเสร็จ
document.addEventListener('DOMContentLoaded', function () {
    const modal = document.getElementById('building-modal');

    if (modal) {
        // ซ่อน Modal ตั้งแต่เริ่มต้น
        modal.style.display = 'none';

        // เพิ่ม Event Listener สำหรับปิด Modal เมื่อคลิกนอก Modal
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                closeBuildingModal();
            }
        });
    }

    // เพิ่ม Event Listener สำหรับปิด Modal ด้วยปุ่ม ESC
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('building-modal');
            if (modal && modal.style.display === 'block') {
                closeBuildingModal();
            }
        }
    });

    // เพิ่ม Event Listener สำหรับ building cards
    const buildingCards = document.querySelectorAll('.list-tower-card .icons');
    buildingCards.forEach(card => {
        card.addEventListener('click', function () {
            const fullName = this.parentElement.querySelector('.tw-name').textContent.trim();
            openBuildingModal(fullName); // fullName = เช่น "อาคาร 21"
        });
    });

});

// ===== CSS Animation Styles =====
// สร้าง CSS สำหรับ animation
const style = document.createElement('style');
style.textContent = `
    .detail-building-modal {
        opacity: 0;
        transition: opacity 0.3s ease;
        transform: scale(0.8);
    }
    
    .detail-building-modal.show {
        opacity: 1;
        transform: scale(1);
    }
    
    .detail-building-modal .modal-content {
        transform: scale(0.8);
        transition: transform 0.3s ease;
    }
    
    .detail-building-modal.show .modal-content {
        transform: scale(1);
    }
`;

// เพิ่ม CSS เข้าไปใน head เมื่อ DOM โหลดเสร็จ
if (document.head) {
    document.head.appendChild(style);
} else {
    document.addEventListener('DOMContentLoaded', function () {
        document.head.appendChild(style);
    });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
