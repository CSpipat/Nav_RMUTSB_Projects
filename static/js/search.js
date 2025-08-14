document.addEventListener("DOMContentLoaded", function () {
    const searchInput = document.getElementById("nav-search");
    const resultBox = document.getElementById("search-results");
    const searchPart = document.getElementById("nav-search-part");

    // ฟังก์ชันซ่อนกล่องผลลัพธ์แบบมี animation
    function hideResults() {
        resultBox.classList.remove("show");
        setTimeout(() => {
            resultBox.style.display = "none";
            resultBox.innerHTML = "";
        }, 400); // รอ animation จบก่อนซ่อนจริง
    }

    searchInput.addEventListener("input", function () {
        const query = this.value.trim();

        // ถ้าไม่มีการกรอกหรือพิมพ์น้อยกว่า 2 ตัว ซ่อนกล่องผลลัพธ์
        if (query.length < 1) {
            hideResults();
            return;
        }

        fetch(`/search?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                resultBox.innerHTML = "";

                if (!data || data.length === 0) {
                    resultBox.innerHTML = `
                        <div style="
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100%;
                            font-size: 14px;
                            color: #555;
                        ">
                            ไม่พบข้อมูล
                        </div>
                    `;
                } else {
                    data.forEach(item => {
                        const div = document.createElement("div");
                        div.style.padding = "8px";
                        div.style.cursor = "pointer";
                        div.style.borderBottom = "1px solid #eee";
                        div.textContent = `${item.name} (ชั้น ${item.floor})`;

                        div.addEventListener("click", function () {
                            if (item.type === "building") {
                                openBuildingModal(item.name);
                            }
                            if (item.type === "room") {
                                openIndoorNavigation(item.building_id, item.floor);
                            }
                            searchInput.value = item.name;
                            hideResults();
                        });

                        resultBox.appendChild(div);
                    });
                }

                // แสดงกล่องผลลัพธ์พร้อม animation
                resultBox.style.display = "block";
                setTimeout(() => {
                    resultBox.classList.add("show");
                }, 10);
            })
            .catch(err => {
                console.error("Search error:", err);
                resultBox.innerHTML = `
                    <div style="
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100%;
                        font-size: 14px;
                        color: #555;
                    ">
                        เกิดข้อผิดพลาด
                    </div>
                `;
                resultBox.style.display = "block";
                setTimeout(() => {
                    resultBox.classList.add("show");
                }, 10);
            });
    });

    // ซ่อนกล่องผลลัพธ์เมื่อคลิกนอกบริเวณช่องค้นหา
    document.addEventListener("click", function (event) {
        if (!searchPart.contains(event.target)) {
            hideResults();
        }
    });
});
