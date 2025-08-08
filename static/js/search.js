document.addEventListener("DOMContentLoaded", function () {
    const searchInput = document.getElementById("nav-search");
    const resultBox = document.getElementById("search-results");

    searchInput.addEventListener("input", function () {
        const query = this.value.trim();
        if (query.length < 2) {
            resultBox.innerHTML = "";
            return;
        }

        fetch(`/search?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                resultBox.innerHTML = "";

                if (data.length === 0) {
                    resultBox.innerHTML = "<div style='padding: 8px;'>ไม่พบข้อมูล</div>";
                    return;
                }

                data.forEach(item => {
                    const div = document.createElement("div");
                    div.style.padding = "8px";
                    div.style.cursor = "pointer";
                    div.style.borderBottom = "1px solid #eee";

                    div.textContent = `${item.name} (ชั้น ${item.floor}) `;

                    div.addEventListener("click", function () {
                        if(item.type === "building"){
                            openBuildingModal(item.name)
                        }
                        if(item.type === "room"){
                            openIndoorNavigation(item.building_id,item.floor)
                        }
                        // alert(`คุณเลือก: ${item.name} | อาคาร ${item.building_id} | ชั้น ${item.floor}`);
                        searchInput.value = item.name;
                        resultBox.innerHTML = "";
                    });

                    resultBox.appendChild(div);
                });
            })
            .catch(err => {
                console.error("Search error:", err);
                resultBox.innerHTML = "<div style='padding: 8px;'>เกิดข้อผิดพลาด</div>";
            });
    });

    // ซ่อนกล่องผลลัพธ์เมื่อคลิกนอก
    document.addEventListener("click", function (event) {
        if (!document.getElementById("nav-search-part").contains(event.target)) {
            resultBox.innerHTML = "";
        }
    });
});
