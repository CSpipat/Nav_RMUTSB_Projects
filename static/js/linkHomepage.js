(function homeDeepLinkBootstrap() {
  function ready(fn) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(fn, 0);
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  ready(() => {
    const p = new URLSearchParams(window.location.search);
    const type          = p.get('type');   // 'building' | 'room' | null
    const q             = p.get('q') || '';
    const buildingId    = p.get('building_id');
    const buildingName  = p.get('building_name');
    const roomId        = p.get('room_id');
    const floor         = p.get('floor');
    const buildingLat   = p.get('building_lat');
    const buildingLng   = p.get('building_lng');

    // เติมค่าในช่องค้นหา (ถ้ามี)
    const searchInput = document.getElementById('nav-search') || document.getElementById('searchInput');
    if (q && searchInput) searchInput.value = q;

    // ยูทิลรอฟังก์ชันพร้อม
    function waitFor(name, cb, timeoutMs = 3000) {
      const t0 = Date.now();
      const itv = setInterval(() => {
        if (typeof window[name] === 'function') {
          clearInterval(itv);
          cb(window[name]);
        } else if (Date.now() - t0 > timeoutMs) {
          clearInterval(itv);
          console.warn(`[homeDeepLink] function ${name} not found in time`);
        }
      }, 50);
    }

    // ===== ตรรกะเดียวกับ search.js =====
    if (type === 'building' && (buildingId || buildingName)) {
      // เปิด modal อาคาร หรือถ้ามี outdoor ให้ใช้ได้ตามเดิม
      waitFor('openBuildingModal', (fn) => {
        // ถ้าของคุณรับชื่อ ให้ส่งชื่อ; ถ้ารับ id ให้ส่ง id — เลือกอย่างใดอย่างหนึ่ง
        if (buildingName) fn(buildingName);
        else fn(buildingId);
      });
      return;
    }

    if (type === 'room' && buildingId && roomId) {
      // สร้าง target object แบบเดียวกับที่ search.js/outdoor ใช้
      const target = {
        type: 'room',
        id: roomId,
        building_id: Number(buildingId),
        floor: floor ? Number(floor) : undefined,
        name: q || roomId,
        building_name: buildingName || '',
        building_lat: buildingLat ? Number(buildingLat) : undefined,
        building_lng: buildingLng ? Number(buildingLng) : undefined
      };

      // ฟังก์ชันพาเข้าหน้า indoor ทันที
      const goIndoorDirect = () => {
        waitFor('openIndoorToRoom', (fn) => {
          fn(target.building_id, target.floor, target.id);
        });
      };

      // ฟังก์ชันทดลองเริ่ม outdoor ก่อน (เหมือน search.js)
      const tryOutdoor = () => {
        // โชว์ modal แผนที่ภายนอก (ถ้ามี)
        if (typeof window.showMapForBuilding === 'function') {
          window.showMapForBuilding(target.building_name || target.name);
        }
        // เริ่มนำทางภายนอกเพื่อเดินไปยังอาคาร แล้วค่อยสลับเข้า indoor อัตโนมัติ
        if (typeof window.startOutdoorNavigation === 'function') {
          window.startOutdoorNavigation(target);
        } else {
          // ถ้าไม่มี outdoor ให้เข้าหน้า indoor เลย
          goIndoorDirect();
        }
      };

      // ตัดสินใจตามสิทธิ์ geolocation (เหมือนใน search.js)
      if (!('geolocation' in navigator)) {
        goIndoorDirect();
      } else if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' })
          .then(st => {
            if (st.state === 'denied') goIndoorDirect();
            else tryOutdoor();
          })
          .catch(() => tryOutdoor());
      } else {
        tryOutdoor();
      }

      return;
    }

    // ไม่มี type แต่มี q → ให้เรียกค้นหาทั่วไปในหน้า index
    if (q) {
      if (typeof window.runSearch === 'function') window.runSearch(q);
      else if (typeof window.triggerSearch === 'function') window.triggerSearch();
      else document.getElementById('searchButton')?.click();
    }
  });
})();
