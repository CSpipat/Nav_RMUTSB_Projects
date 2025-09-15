// ===================== Globals =====================
let map = null;
let startMarker = null;
let startCoords = [13.868429, 100.482303]; // ตำแหน่งเริ่มต้น
let destinationMarker = null;
let routeLayer = null;
let animatedPath = null;
let animationFrame = null;
let selectedBuilding = null;
let dashOffset = 0;
let hasArrived = false; // เช็คว่าเคยแสดง modal แล้วหรือยัง
let modalShown = false;

// New guards / controls
let gpsWatchId = null;            // watchPosition id ของ watchUserLocation()
let isRouting = false;            // กัน findRoute ซ้อน
let routeController = null;       // AbortController สำหรับยกเลิก fetch /route เก่า
let routeSeq = 0;                 // ลำดับคำขอ route ปัจจุบัน
let lastHandledSeq = -1;          // ลำดับล่าสุดที่ประมวลผลแล้ว
let hasFitOnce = false;           // fitBounds ครั้งแรกครั้งเดียว
let lastRerouteOrigin = null;     // ตำแหน่งล่าสุดที่ใช้คำนวณ route
const MIN_MOVE_TO_REROUTE_M = 5;  // ขยับเกิน 8m ค่อย reroute
let routeDebounceTimer = null;    // ตัวหน่วงเรียก findRoute
let lastDestKey = null;           // ไว้ตรวจว่าปลายทางเปลี่ยนไหม

// Helper: ปลอดภัยแม้ element ยังไม่พร้อม
const byId = (id) => document.getElementById(id);
const distanceInfo = byId('distance-info') || { style: {} };
const distanceValue = byId('distance-value') || { innerText: '' };
const loadingIndicator = byId('loading-indicator') || { style: {} };

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

// ===================== Loading / Debounce =====================
function setLoading(v) {
  if (!loadingIndicator || !distanceInfo) return;
  loadingIndicator.style.display = v ? 'block' : 'none';
  distanceInfo.style.display = v ? 'none' : 'block';
}

function scheduleFindRoute(delay = 250) {
  clearTimeout(routeDebounceTimer);
  routeDebounceTimer = setTimeout(() => findRoute(), delay);
}

// ===================== Map Init =====================
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
        scheduleFindRoute(150); // ใช้ debounce
      }
    });
  }
}

// ===================== Marker =====================
function updateStartMarker(coords) {
  if (startMarker) map.removeLayer(startMarker);
  startCoords = coords;
  startMarker = L.marker(startCoords, { icon: userIcon }).addTo(map);
}

// ===================== Geolocation (outdoor re-route control) =====================
let lastUpdate = 0;

function watchUserLocation() {
  if (!navigator.geolocation) {
    console.log("Geolocation not supported");
    return;
  }

  // กันซ้อน watch เดิม
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }

  gpsWatchId = navigator.geolocation.watchPosition(
    (position) => {
      const now = Date.now();
      if (now - lastUpdate < 5000) return; // throttle 5s
      lastUpdate = now;

      const userCoords = [position.coords.latitude, position.coords.longitude];
      updateStartMarker(userCoords);

      // เช็คถึงปลายทาง (outdoor case)
      if (destinationMarker && destinationMarker.getLatLng) {
        const endLatLng = destinationMarker.getLatLng();
        const distanceToEnd = calculateDistance(
          userCoords[0], userCoords[1],
          endLatLng.lat, endLatLng.lng
        );
        if (distanceToEnd < 30 && !hasArrived) {
          hasArrived = true;
          showSuccessModal();
        }
      }

      // กันคำนวณถี่: reroute เมื่อขยับเกิน threshold
      if (selectedBuilding && routeLayer) {
        if (!lastRerouteOrigin) {
          lastRerouteOrigin = { lat: userCoords[0], lng: userCoords[1] };
          scheduleFindRoute(150);
        } else {
          const moved = calculateDistance(
            userCoords[0], userCoords[1],
            lastRerouteOrigin.lat, lastRerouteOrigin.lng
          );
          if (moved >= MIN_MOVE_TO_REROUTE_M) {
            scheduleFindRoute(150);
          }
        }
      }
    },
    (error) => {
      console.error("Geolocation error:", error);
      // alert("ไม่สามารถเข้าถึงตำแหน่งได้ โปรดเปิด Location/อนุญาตสิทธิ์"); // ถ้าต้องการ
    },
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
  );
}

// ===================== Success Modal =====================
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
    modalShown = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.querySelector('.success-modal button');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideSuccessModal);
  }
});

// ===================== Path Animation =====================
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

// ===================== Show/Close Map Modal =====================
function showMapForBuilding(buildingName) {
  byId("modal-backdrop").style.display = "block";
  byId("map-modal").style.display = "block";
  byId("building-name").innerText = buildingName;

  // รีเซ็ต state เมื่อเริ่มปลายทางใหม่
  selectedBuilding = buildingName;
  hasArrived = false;
  modalShown = false;
  hasFitOnce = false;
  lastRerouteOrigin = null;
  lastDestKey = JSON.stringify({ name: selectedBuilding });

  initMap();
  watchUserLocation();

  // หาเส้นทางหลัง UI พร้อม
  scheduleFindRoute(50);

  setTimeout(() => { if (map) map.invalidateSize(); }, 120);
}

function closeModal() {
  byId("modal-backdrop").style.display = "none";
  byId("map-modal").style.display = "none";

  // ยกเลิก fetch/animation/watch ทุกอย่าง
  if (routeController) { try { routeController.abort(); } catch(_){} routeController = null; }
  if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null; }
  if (gpsWatchId !== null) { navigator.geolocation.clearWatch(gpsWatchId); gpsWatchId = null; }
  if (geoWatchId !== null) { navigator.geolocation.clearWatch(geoWatchId); geoWatchId = null; }

  // เคลียร์เลเยอร์กันซ้อน
  try {
    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    if (animatedPath) { map.removeLayer(animatedPath); animatedPath = null; }
    if (destinationMarker) { map.removeLayer(destinationMarker); destinationMarker = null; }
  } catch(e){ console.warn(e); }

  setLoading(false);
  hideSuccessModal();
}

// ===================== Routing =====================
function findRoute() {
  if (!selectedBuilding) { alert("กรุณาเลือกอาคารปลายทาง!"); return; }
  if (!startCoords) { alert("กรุณาคลิกเลือกจุดเริ่มต้นบนแผนที่!"); return; }

  // ถ้าปลายทางเปลี่ยน ให้รีเซ็ตธงถึงปลายทาง
  const currentDestKey = JSON.stringify({ name: selectedBuilding });
  if (currentDestKey !== lastDestKey) {
    hasArrived = false;
    lastDestKey = currentDestKey;
  }

  // ยกเลิกคำขอก่อนหน้า + กัน response เก่าทับใหม่
  if (routeController) { try { routeController.abort(); } catch(_){} }
  routeController = new AbortController();
  const mySeq = ++routeSeq;
  isRouting = true;
  setLoading(true);

  fetch('/route', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ start: startCoords, end: selectedBuilding }),
    signal: routeController.signal
  })
  .then(response => {
    if (!response.ok) throw new Error(`Failed to fetch route: ${response.status}`);
    return response.json();
  })
  .then(data => {
    // เมิน response เก่าถ้าไม่ใช่ลำดับล่าสุด
    if (mySeq < routeSeq) return;

    if (!data.path_coords || data.path_coords.length === 0) {
      alert("ไม่พบเส้นทางไปยังปลายทาง!");
      return;
    }

    // ล้างของเดิม
    if (routeLayer) map.removeLayer(routeLayer);
    if (animatedPath) map.removeLayer(animatedPath);
    if (destinationMarker) map.removeLayer(destinationMarker);
    if (animationFrame) cancelAnimationFrame(animationFrame);

    routeLayer = L.polyline(data.path_coords, { color: 'gray', weight: 9 }).addTo(map);

    animatedPath = L.polyline(data.path_coords, {
      color: 'yellow',
      weight: 5,
      dashArray: "20, 15",
      dashOffset: 0
    }).addTo(map);

    if (animatedPath._path) {
      dashOffset = 0;
      animationFrame = requestAnimationFrame(animatePath);
    }

    const endCoords = data.path_coords[data.path_coords.length - 1];
    destinationMarker = L.marker(endCoords, { icon: destinationIcon }).addTo(map);

    // fitBounds ครั้งแรกเท่านั้น
    if (!hasFitOnce) {
      hasFitOnce = true;
      map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
    }

    // แสดงระยะทาง
    if (data.distance) {
      distanceValue.innerText = data.distance;
    } else {
      // คำนวณเองถ้า backend ไม่ส่ง
      try {
        let sum = 0;
        const coords = data.path_coords;
        for (let i = 1; i < coords.length; i++) {
          sum += calculateDistance(coords[i-1][0], coords[i-1][1], coords[i][0], coords[i][1]);
        }
        distanceValue.innerText = (sum >= 1000 ? (sum/1000).toFixed(2) + ' km' : Math.round(sum) + ' m');
      } catch(_) {}
    }
  })
  .catch(error => {
    // ถ้าเป็น abort จะมาที่นี่ ไม่ต้องเตือนผู้ใช้
    if (error.name !== 'AbortError') {
      console.error("Error:", error);
      alert("เกิดข้อผิดพลาดในการค้นหาเส้นทาง กรุณาลองใหม่");
    }
  })
  .finally(() => {
    // ปิดโหลดเฉพาะถ้าเป็นคำขอล่าสุด
    if (mySeq >= lastHandledSeq) {
      lastHandledSeq = mySeq;
      isRouting = false;
      setLoading(false);
      // บันทึก origin ที่ใช้ route ครั้งนี้
      if (startCoords) {
        lastRerouteOrigin = { lat: startCoords[0], lng: startCoords[1] };
      }
    }
  });
}

// ===================== Building Detail Modal (ของเดิม) =====================
function openBuildingModal(buildingName) {
  let id = '';
  if (buildingName.startsWith('อาคาร')) {
    id = buildingName.replace('อาคาร', '').trim();
  } else if (buildingName === 'โรงอาหาร') {
    id = '0'; // กรณีพิเศษ
  } else {
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
  }
}

function closeBuildingModal(modalId) {
  if (!modalId) return;
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

// ปิด modal เมื่อคลิก backdrop และปุ่มปิด
const modalContainers = document.querySelectorAll('[id^="building-modal-"]');
modalContainers.forEach(modalContainer => {
  modalContainer.addEventListener('click', (e) => {
    if (e.target === modalContainer) {
      closeBuildingModal(modalContainer.id);
    }
  });

  const closeBtn = modalContainer.querySelector('.detail-building-modal .header div');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeBuildingModal(modalContainer.id);
    });
  }
});

// เมื่อโหลดหน้าเสร็จ: ซ่อน modal หลัก + ESC
document.addEventListener('DOMContentLoaded', function () {
  const modal = document.getElementById('building-modal');

  if (modal) {
    modal.style.display = 'none';
    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        closeBuildingModal();
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      const m = document.getElementById('building-modal');
      if (m && m.style.display === 'block') {
        closeBuildingModal();
      }
    }
  });

  // เพิ่มคลิกที่การ์ดอาคาร
  const buildingCards = document.querySelectorAll('.list-tower-card .icons');
  buildingCards.forEach(card => {
    card.addEventListener('click', function () {
      const fullName = this.parentElement.querySelector('.tw-name').textContent.trim();
      openBuildingModal(fullName); // เช่น "อาคาร 21"
    });
  });
});

// ===================== CSS Animation inject =====================
const style = document.createElement('style');
style.textContent = `
  .detail-building-modal { opacity: 0; transition: opacity 0.3s ease; transform: scale(0.8); }
  .detail-building-modal.show { opacity: 1; transform: scale(1); }
  .detail-building-modal .modal-content { transform: scale(0.8); transition: transform 0.3s ease; }
  .detail-building-modal.show .modal-content { transform: scale(1); }
`;
if (document.head) {
  document.head.appendChild(style);
} else {
  document.addEventListener('DOMContentLoaded', function () {
    document.head.appendChild(style);
  });
}

// ===================== Utils =====================
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

// ===================== Outdoor Navigation Hand-off =====================
// ตัวแปรควบคุมบนสุด
let outdoorTarget = null;   // เก็บ item จาก search.js ทั้ง building/room
let geoWatchId = null;      // watchPosition id สำหรับ arrival watcher
let arrivalGuard = false;   // กันทริกเกอร์ซ้ำตอนถึงอาคาร

function startOutdoorNavigation(target) {
  // เคลียร์ของเก่า
  if (geoWatchId !== null) {
    navigator.geolocation.clearWatch(geoWatchId);
    geoWatchId = null;
  }
  arrivalGuard = false;
  outdoorTarget = target;

  // ... โค้ดแสดงเส้นทาง outdoor ของคุณ ...

  // ถ้าเป็น room ให้เริ่มติดตาม GPS เพื่อเช็คเข้าอาคาร
  if (target.type === "room" && target.building_lat && target.building_lng) {
    startArrivalWatcher(target);
  }
}

function startArrivalWatcher(target) {
  if (!navigator.geolocation) return;

  const ARRIVAL_RADIUS_M = 30; // ถึงอาคาร

  geoWatchId = navigator.geolocation.watchPosition(
    pos => {
      if (arrivalGuard) return;
      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;

      const d = calculateDistance(
        userLat, userLng,
        target.building_lat, target.building_lng
      );

      // ถึงอาคารแล้ว
      if (d <= ARRIVAL_RADIUS_M) {
        arrivalGuard = true;

        // หยุดดูตำแหน่ง outdoor
        if (geoWatchId !== null) {
          navigator.geolocation.clearWatch(geoWatchId);
          geoWatchId = null;
        }

        // ปิด/หยุดแอนิเมชัน outdoor ที่เกี่ยวข้องถ้ามี
        try {
          if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null; }
          // เคลียร์ layer/marker อื่น ๆ ตามที่มี
        } catch (e) { console.warn(e); }

        // จุดตัดสินใจที่เดียว
        if (outdoorTarget?.type === 'room') {
          // ไม่โชว์ success outdoor เพื่อกันซ้อน
          if (typeof openIndoorNavigation === "function") {
            openIndoorNavigation(outdoorTarget.building_id, outdoorTarget.floor);
          } else {
            console.warn("openIndoorNavigation() not found");
          }
        } else {
          // ปลายทางเป็น building → โชว์ success
          showSuccessModal();
        }

        // กันยิงซ้ำเพิ่มเติมช่วงสั้น ๆ
        setTimeout(() => { arrivalGuard = false; }, 3000);
      }
    },
    err => console.error("Geolocation error:", err),
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 3000 }
  );
}

// export ให้เรียกจากที่อื่นได้
window.startOutdoorNavigation = startOutdoorNavigation;
window.showMapForBuilding = showMapForBuilding;

// ===================== Visibility Saver =====================
// หยุด watch/animation เมื่อแท็บไม่ active (ประหยัดแบตและกันบั๊ก)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (gpsWatchId !== null) { navigator.geolocation.clearWatch(gpsWatchId); gpsWatchId = null; }
    if (geoWatchId !== null) { navigator.geolocation.clearWatch(geoWatchId); geoWatchId = null; }
    if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null; }
  } else {
    if (map && selectedBuilding) {
      watchUserLocation();
      if (animatedPath && animatedPath._path) {
        animationFrame = requestAnimationFrame(animatePath);
      }
    }
  }
});
