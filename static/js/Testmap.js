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

            routeLayer = L.polyline(data.path_coords, { color: 'gray', weight: 9 }).addTo(map);

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

// ===== Building Modal Functions =====

/**
 * เปิด Modal แสดงรายละเอียดอาคาร
 * @param {string} buildingName - ชื่ออาคาร
 */function openBuildingModal(buildingName) {
    const modalContainer = document.getElementById('building-modal');
    const modal = modalContainer.querySelector('.detail-building-modal');

    if (buildingName) {
        modal.querySelector('.header h2').textContent = buildingName;
        updateBuildingData(buildingName, modal);

        // ✅ เก็บชื่ออาคารไว้ใน attribute
        modal.dataset.buildingName = buildingName;
    }

    modalContainer.style.display = 'flex';

    setTimeout(() => {
        modalContainer.classList.add('show');
    }, 10);
}


function closeBuildingModal() {
    const modalContainer = document.getElementById('building-modal');
    modalContainer.classList.remove('show');

    setTimeout(() => {
        modalContainer.style.display = 'none';
    },);
}

// ปิด modal เมื่อคลิกนอก modal (click backdrop)
const modalContainer = document.getElementById('building-modal');
modalContainer.addEventListener('click', (e) => {
    // ถ้าคลิกตรง backdrop (ไม่ใช่ใน detail-building-modal)
    if (e.target === modalContainer) {
        closeBuildingModal();
    }
});

// ปุ่มปิด modal ใน header
const modal = modalContainer.querySelector('.detail-building-modal');
const closeBtn = modal.querySelector('.header div'); // สมมติ div นี้คือปุ่มปิด
closeBtn.addEventListener('click', () => {
    closeBuildingModal();
});

/**
 * อัพเดตข้อมูลอาคารใน Modal
 * @param {string} buildingName - ชื่ออาคาร
 * @param {HTMLElement} modal - Element ของ Modal
 */
function updateBuildingData(buildingName, modal) {
    // ข้อมูลอาคารแต่ละหลัง
    const buildingData = {
        'อาคาร 21': {
            buildingName: 'อาคาร21',
            description: 'อาคารปฏิบัติการเทคโนโลยีออกแบบวิศวกรรมศาสตร์และสถาปัตยกรรมศาสตร์',
            floors: [
                'ชั้น 1: ห้องปฏิบัติการคอมพิวเตอร์',
                'ชั้น 2: ห้องเรียนทฤษฎี',
                'ชั้น 3: ห้องปฏิบัติการออกแบบ',
                'ชั้น 4: ห้องประชุม'
            ],
            image: 'https://via.placeholder.com/100?text=Building+21'
        },
        'อาคาร 20': {
            buildingName: 'อาคาร20',
            description: 'อาคารเรียนรวมและปฏิบัติการคณะบริหารและเทคโนโลยีสารสนเทศ',
            floors: [
                'ชั้น 1: ห้องสมุด',
                'ชั้น 2: ห้องเรียน',
                'ชั้น 3: ห้องปฏิบัติการคอมพิวเตอร์',
                'ชั้น 4: ห้องสำนักงาน'
            ],
            image: 'https://via.placeholder.com/100?text=Building+20'
        },
        'อาคาร 19': {
            buildingName: 'อาคาร19',
            description: 'อาคารสำนักวิทยบริการและเทคโนโลยีสารสนเทศ',
            floors: [
                'ชั้น 1: ห้องบริการ',
                'ชั้น 2: ห้องสมุด',
                'ชั้น 3: ห้องปฏิบัติการ IT'
            ],
            image: 'https://via.placeholder.com/100?text=Building+19'
        },
        'อาคาร 18': {
            buildingName: 'อาคาร18',
            description: 'อาคารคณะวิศวกรรมศาสตร์และสถาปัตยกรรมศาสตร์',
            floors: [
                'ชั้น 1: ห้องสำนักงาน',
                'ชั้น 2: ห้องเรียน',
                'ชั้น 3: ห้องปฏิบัติการ',
                'ชั้น 4: ห้องแขก'
            ],
            image: 'https://via.placeholder.com/100?text=Building+18'
        },
        'อาคาร17': {
            buildingName: 'อาคาร17',
            description: 'อาคารเฉลิมพระเกียรติ (ตึกคณะวิทยาศาสตร์และเทคโนโลยี)',
            floors: [
                'ชั้น 1: ห้องปฏิบัติการเคมี',
                'ชั้น 2: ห้องปฏิบัติการฟิสิกส์',
                'ชั้น 3: ห้องปฏิบัติการชีววิทยา',
                'ชั้น 4: ห้องเรียน'
            ],
            image: 'https://via.placeholder.com/100?text=Building+17'
        },
        'อาคาร 16': {
            buildingName: 'อาคาร16',
            description: 'อาคารสาขาวิศวกรรมเครื่องกล',
            floors: [
                'ชั้น 1: ห้องปฏิบัติการเครื่องกล',
                'ชั้น 2: ห้องเรียน',
                'ชั้น 3: ห้องสำนักงาน'
            ],
            image: 'https://via.placeholder.com/100?text=Building+16'
        },
        'โรงอาหาร': {
            buildingName: 'โรงอาหาร',
            description: 'โรงอาหารของมหาวิทยาลัย',
            floors: [
                'ชั้น 1: ร้านอาหาร',
                'ชั้น 2: พื้นที่นั่งรับประทานอาหาร'
            ],
            image: 'https://via.placeholder.com/100?text=Cafeteria'
        }
    };

    // ตรวจสอบว่ามีข้อมูลอาคารหรือไม่
    if (buildingData[buildingName]) {
        const data = buildingData[buildingName];

        // อัพเดตรายละเอียด
        const descElement = modal.querySelector('.desc p');
        if (descElement) {
            descElement.textContent = data.description;
        }

        // อัพเดตรูปภาพ
        const imgElement = modal.querySelector('.image img');
        if (imgElement) {
            imgElement.src = data.image;
            imgElement.alt = buildingName;
        }

        // อัพเดตรายการชั้น
        const listElement = modal.querySelector('.list ul');
        if (listElement) {
            listElement.innerHTML = '';
            data.floors.forEach(floor => {
                const li = document.createElement('li');
                li.textContent = floor;
                listElement.appendChild(li);
            });
        }

        // อัพเดตปุ่มนำทาง
        const navButton = modal.querySelector('.btn-nav');
        if (navButton) {
            navButton.onclick = () => {
                const buildingName = modal.dataset.buildingName;
                const buildingInfo = buildingData[buildingName];
                if (buildingInfo && buildingInfo.buildingName) {
                    showMapForBuilding(buildingInfo.buildingName);
                    closeBuildingModal();
                } else {
                    console.warn('ไม่พบข้อมูลอาคาร:', buildingName);
                }
            };
        }



    } else {
        // ถ้าไม่มีข้อมูล ใช้ข้อมูล default
        const descElement = modal.querySelector('.desc p');
        if (descElement) {
            descElement.textContent = 'รายละเอียดของอาคาร เช่น ข้อมูลพื้นฐาน ทำเล หรือความสำคัญของอาคาร';
        }

        // รีเซ็ตรูปภาพและรายการชั้น
        const imgElement = modal.querySelector('.image img');
        if (imgElement) {
            imgElement.src = 'https://via.placeholder.com/100';
            imgElement.alt = 'Building';
        }

        const listElement = modal.querySelector('.list ul');
        if (listElement) {
            listElement.innerHTML = `
                <li>ชั้น 1: สำนักงาน</li>
                <li>ชั้น 2: ห้องเรียน</li>
                <li>ชั้น 3: ห้องปฏิบัติการ</li>
            `;
        }

        // กำหนดปุ่มนำทางให้ปิด modal เฉย ๆ
        const navButton = modal.querySelector('.btn-nav');
        if (navButton) {
            navButton.onclick = () => {
                modal.style.display = 'none';
                const backdrop = document.getElementById('modal-backdrop');
                if (backdrop) {
                    backdrop.style.display = 'none';
                }
            };
        }
    }
}

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
            const buildingName = this.parentElement.querySelector('.tw-name').textContent.split(' ')[0] + ' ' + this.parentElement.querySelector('.tw-name').textContent.split(' ')[1];
            openBuildingModal(buildingName.trim());
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