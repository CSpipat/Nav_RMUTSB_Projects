// /static/js/search-home.js
document.addEventListener("DOMContentLoaded", function () {
  const searchInput = document.getElementById("nav-search");
  const resultBox   = document.getElementById("search-results");
  const searchPart  = document.getElementById("nav-search-part");

  function hideResults() {
    resultBox.classList.remove("show");
    setTimeout(() => {
      resultBox.style.display = "none";
      resultBox.innerHTML = "";
    }, 400);
  }

  // เดินทางไปหน้า index พร้อมพารามิเตอร์ (เปิดในแท็บเดิม)
  function goToIndexWithParams(paramsObj) {
    const params = new URLSearchParams(paramsObj);
    // ต้องมีตัวแปร indexUrl ถูกฝังมาจาก template: const indexUrl = "{{ url_for('index') }}";
    const url = `${indexUrl}?${params.toString()}`;
    window.location.href = url; // เปิดในแท็บเดิม
  }

  // กด Enter โดยไม่คลิกผลลัพธ์ → ส่ง q ไปหน้า index ให้ทำงานต่อเอง
  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const q = (searchInput.value || "").trim();
        if (q) {
          hideResults();
          goToIndexWithParams({ q });
        }
      }
    });
  }

  // ค้นหาแบบพิมพ์สด
  searchInput?.addEventListener("input", function () {
    const query = this.value.trim();
    if (!query) {
      hideResults();
      return;
    }

    fetch(`/search?q=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(data => {
        resultBox.innerHTML = "";

        if (!data || data.length === 0) {
          resultBox.innerHTML = `<div style="text-align:center;color:#555;padding:8px;">ไม่พบข้อมูล</div>`;
        } else {
          data.forEach(item => {
            const div = document.createElement("div");
            if (item.type === "building") {
              div.textContent = `${item.name} ( ${item.floor ?? '-'} ชั้น)`;
            } else {
              div.textContent = `${item.name} (ชั้น ${item.floor ?? '-'})`;
            }
            div.style.cursor = "pointer";
            div.style.padding = "8px";
            div.style.borderBottom = "1px solid #eee";

            div.addEventListener("click", () => {
              // === กรณีปลายทางเป็น "อาคาร" ===
              if (item.type === "building") {
                searchInput.value = item.name;
                hideResults();
                // ส่ง type=building ไปให้หน้า index ตัดสินใจเปิด modal/outdoor ตามเดิม
                goToIndexWithParams({
                  type: "building",
                  building_id: item.building_id ?? item.id ?? "",
                  building_name: item.name,
                  q: item.name
                });
                return;
              }

              // === กรณีปลายทางเป็น "ห้อง" ===
              if (item.type === "room") {
                searchInput.value = item.name;
                hideResults();

                // ส่งข้อมูลที่เพียงพอให้หน้า index ตัดสินใจเหมือน search.js:
                // - ถ้า geolocation ใช้ได้ → เริ่ม outdoor ไปอาคาร แล้ว auto-switch เข้า indoor
                // - ถ้าไม่ได้ → เข้าหน้า indoor ตรงๆ
                goToIndexWithParams({
                  type: "room",
                  room_id: item.id,
                  building_id: item.building_id,
                  building_name: item.building_name || item.name,
                  floor: item.floor ?? "",
                  // เผื่อมีพิกัดอาคาร (ถ้ามีใน payload ของ /search)
                  building_lat: item.building_lat ?? "",
                  building_lng: item.building_lng ?? "",
                  q: item.name
                });
                return;
              }
            });

            resultBox.appendChild(div);
          });
        }

        resultBox.style.display = "block";
        setTimeout(() => resultBox.classList.add("show"), 10);
      })
      .catch(err => {
        console.error(err);
        resultBox.innerHTML = `<div style="text-align:center;color:#555;padding:8px;">เกิดข้อผิดพลาด</div>`;
        resultBox.style.display = "block";
        setTimeout(() => resultBox.classList.add("show"), 10);
      });
  });

  // คลิกนอกกล่อง → ปิดผลลัพธ์
  document.addEventListener("click", e => {
    if (!searchPart || !searchPart.contains(e.target)) {
      hideResults();
    }
  });
});
