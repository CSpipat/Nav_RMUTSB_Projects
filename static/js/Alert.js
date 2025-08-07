//
// let modalShown = false; // ใช้เพื่อไม่ให้แสดง modal ซ้ำ
//
// // ✅ 5. ฟังก์ชันปิด modal
// function hideSuccessModal() {
//   const modal = document.querySelector('.success-modal');
//   if (modal) {
//     modal.classList.remove('show');
//     modal.classList.add('hidden');
//     modalShown = false; // ถ้าต้องการให้เช็คใหม่อีกครั้งหลังจากปิด modal
//   }
// }
//
//
// // ✅ 7. Event ปุ่มปิด modal (ถ้าปิดด้วยปุ่ม)
// document.addEventListener("DOMContentLoaded", () => {
//   const closeBtn = document.querySelector('.success-modal button');
//   if (closeBtn) {
//     closeBtn.addEventListener('click', hideSuccessModal);
//   }
// });