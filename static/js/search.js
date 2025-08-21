document.addEventListener("DOMContentLoaded", function () {
    const searchInput = document.getElementById("nav-search");
    const resultBox = document.getElementById("search-results");
    const searchPart = document.getElementById("nav-search-part"); // ✅ container ของช่องค้นหา+ผลลัพธ์

    function hideResults() {
        resultBox.classList.remove("show");
        setTimeout(() => {
            resultBox.style.display = "none";
            resultBox.innerHTML = "";
        }, 400);
    }

    // (ถ้าจะให้ลื่นขึ้น แนะนำทำ debounce 200–300ms ได้ แต่ยังไม่ใส่ให้เพื่อความสั้น)
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
                        if (item.type === "building" ){
                            div.textContent = `${item.name} ( ${item.floor ?? '-'} ชั้น)`;
                        }else {
                            div.textContent = `${item.name} (ชั้น ${item.floor ?? '-'})`;
                        }
                        div.style.cursor = "pointer";
                        div.style.padding = "8px";
                        div.style.borderBottom = "1px solid #eee";

                        div.addEventListener("click", () => {
                            if (item.type === "building") {
                                if (typeof openBuildingModal === "function") {
                                    openBuildingModal(item.name);
                                }
                                searchInput.value = item.name;
                                hideResults();
                                return;
                            }

                            if (item.type === "room") {
                                const goIndoorDirect = () => {
                                    // เปิดแผนที่ indoor + set ห้อง + findPath
                                    if (typeof openIndoorToRoom === "function") {
                                        openIndoorToRoom(item.building_id, item.floor, item.id);
                                    } else if (typeof openIndoorNavigation === "function") {
                                        // fallback แบบง่าย (ไม่แนะนำเท่า helper แต่ใช้ได้)
                                        openIndoorNavigation(item.building_id, item.floor);
                                        setTimeout(() => {
                                            const sel = document.getElementById('destinationSelect');
                                            if (sel) {
                                                sel.value = item.id;
                                                if (typeof findPath === 'function') findPath();
                                            }
                                        }, 500);
                                    } else {
                                        console.warn("No indoor opener found");
                                    }
                                };

                                const tryOutdoor = () => {
                                    // ถ้าต้องการให้เห็นแผนที่ภายนอกด้วยก่อน จะเรียก modal outdoor ได้
                                    if (typeof showMapForBuilding === "function") {
                                        showMapForBuilding(item.building_name || item.name);
                                    }
                                    if (typeof startOutdoorNavigation === "function") {
                                        startOutdoorNavigation(item);
                                    } else {
                                        // ถ้าไม่มีฟังก์ชัน outdoor ให้ข้ามไป indoor
                                        goIndoorDirect();
                                    }
                                };

                                // 1) ไม่มี geolocation → เข้า indoor เลย
                                if (!('geolocation' in navigator)) {
                                    goIndoorDirect();
                                }
                                // 2) ใช้ Permissions API ถ้ามี: denied → indoor, granted/prompt → ลอง outdoor
                                else if (navigator.permissions && navigator.permissions.query) {
                                    navigator.permissions.query({name: 'geolocation'})
                                        .then(status => {
                                            if (status.state === 'denied') {
                                                goIndoorDirect();
                                            } else {
                                                tryOutdoor();
                                            }
                                        })
                                        .catch(() => tryOutdoor());
                                }
                                // 3) ไม่มี Permissions API → ลอง outdoor ตามปกติ (ถ้าผู้ใช้กดไม่ให้ ควร fallback ใน map.js ด้วย)
                                else {
                                    tryOutdoor();
                                }

                                searchInput.value = item.name;
                                hideResults();

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

    // ปิดผลลัพธ์เมื่อคลิกนอกบริเวณกล่องค้นหา (ใช้ container แทน input)
    document.addEventListener("click", e => {
        if (!searchPart || !searchPart.contains(e.target)) {
            hideResults();
        }
    });
});
