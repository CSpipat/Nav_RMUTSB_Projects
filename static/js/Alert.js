// ✅ 1. กำหนดตำแหน่งทางเข้าอาคาร (จุดเดียว หรือหลายจุด)
const entrances = [
  { lat: 13.736717, lng: 100.523186 }, // ตัวอย่าง RMUTSB
  // เพิ่มจุดอื่นได้ตามต้องการ เช่น:
  // { lat: 13.737111, lng: 100.524999 },
];

let modalShown = false; // ใช้เพื่อไม่ให้แสดง modal ซ้ำ

// ✅ 2. ฟังก์ชันคำนวณระยะทาง (สูตร Haversine)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // รัศมีโลกเมตร
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ✅ 3. ฟังก์ชันเช็คตำแหน่งผู้ใช้งาน
function checkUserProximity() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;

      for (let entrance of entrances) {
        const distance = getDistance(userLat, userLng, entrance.lat, entrance.lng);

        console.log(`ระยะห่างจากจุด ${entrance.lat},${entrance.lng} = ${distance.toFixed(2)} เมตร`);

        if (distance < 30 && !modalShown) {
          showSuccessModal();
          break; // แสดง modal แล้วหยุดเช็ค
        }
      }
    }, (err) => {
      console.error("ไม่สามารถเข้าถึงตำแหน่งได้:", err.message);
    });
  } else {
    alert("เบราว์เซอร์ของคุณไม่รองรับ Geolocation");
  }
}

// ✅ 4. ฟังก์ชันแสดง modal
function showSuccessModal() {
  const modal = document.querySelector('.success-modal');
  if (modal) {
    modal.classList.add('show');
    modal.classList.remove('hidden');
    modalShown = true;
  }
}

// ✅ 5. ฟังก์ชันปิด modal
function hideSuccessModal() {
  const modal = document.querySelector('.success-modal');
  if (modal) {
    modal.classList.remove('show');
    modal.classList.add('hidden');
    modalShown = false; // ถ้าต้องการให้เช็คใหม่อีกครั้งหลังจากปิด modal
  }
}

// ✅ 6. เรียกฟังก์ชันตรวจสอบทุก 10 วินาที
setInterval(checkUserProximity, 10000);

// ✅ 7. Event ปุ่มปิด modal (ถ้าปิดด้วยปุ่ม)
document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.querySelector('.success-modal button');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideSuccessModal);
  }
});