document.addEventListener("DOMContentLoaded", function () {
    const searchInput = document.getElementById("nav-search");
    const resultBox = document.getElementById("search-results");
    const searchPart = document.getElementById("nav-search-part");

    function hideResults() {
        resultBox.classList.remove("show");
        setTimeout(() => {
            resultBox.style.display = "none";
            resultBox.innerHTML = "";
        }, 400);
    }

    searchInput.addEventListener("input", function () {
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
                            if (item.type === "building") {
                                // เปิด modal อาคารถ้าฟังก์ชันมี
                                if (typeof openBuildingModal === "function") {
                                    openBuildingModal(item.name);
                                }
                                searchInput.value = item.name;
                                hideResults();
                                window.location.href = "/index"; 
                                return;
                            }

                            if (item.type === "room") {
                                searchInput.value = item.name;
                                hideResults();
                                
                                // ✅ เรียกใช้ฟังก์ชันที่เชื่อมต่อกับระบบ Indoor Navigation
                                if (typeof openIndoorToRoom === "function") {
                                    openIndoorToRoom(item.building_id, item.floor, item.id);
                                } else {
                                    console.warn("ไม่พบฟังก์ชัน openIndoorToRoom");
                                    // หากไม่พบฟังก์ชัน ก็ให้กลับไปที่หน้าหลัก
                                    window.location.href = "/index";
                                }
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

    document.addEventListener("click", e => {
        if (!searchPart || !searchPart.contains(e.target)) {
            hideResults();
        }
    });
});