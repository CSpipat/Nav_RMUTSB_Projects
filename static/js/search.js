document.addEventListener("DOMContentLoaded", function () {
    const searchInput = document.getElementById("nav-search");
    const resultBox = document.getElementById("search-results");

    searchInput.addEventListener("input", function () {
        const query = this.value.trim();

        if (query.length < 2) {
            resultBox.style.display = "none"; // ซ่อนถ้าพิมพ์น้อยกว่า 2 ตัว
            resultBox.innerHTML = "";
            return;
        }

        fetch(`/search?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                resultBox.innerHTML = "";

                if (data.length === 0) {
                    resultBox.innerHTML = "<div style='padding: 8px;'>ไม่พบข้อมูล</div>";
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
                            resultBox.style.display = "none"; // ซ่อนเมื่อเลือก
                        });

                        resultBox.appendChild(div);
                    });
                }

                resultBox.style.display = "block"; // << โชว์กล่องผลลัพธ์
            })
            .catch(err => {
                console.error("Search error:", err);
                resultBox.innerHTML = "<div style='padding: 8px;'>เกิดข้อผิดพลาด</div>";
                resultBox.style.display = "block";
            });
    });

    // ซ่อนเมื่อคลิกนอก
    document.addEventListener("click", function (event) {
        if (!document.getElementById("nav-search-part").contains(event.target)) {
            resultBox.style.display = "none";
        }
    });
});
