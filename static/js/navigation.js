// Debug mode flag
let debugMode = false;

// Function to log debug information
function debugLog(message) {
    if (debugMode) {
        const debugInfo = document.getElementById('debugInfo');
        debugInfo.innerHTML += message + '<br>';
        console.log(message);
    }
}

// Initialize canvas when image loads
document.getElementById('floorPlan').onload = function () {
    setupCanvas();
};

// Set up canvas to match image size
function setupCanvas() {
    const canvas = document.getElementById('pathCanvas');
    const img = document.getElementById('floorPlan');

    // Get the actual displayed size of the image
    const imgWidth = img.clientWidth;
    const imgHeight = img.clientHeight;

    canvas.width = imgWidth;
    canvas.height = imgHeight;
    canvas.style.width = imgWidth + 'px';
    canvas.style.height = imgHeight + 'px';

    debugLog(`Canvas initialized with dimensions: ${canvas.width}x${canvas.height}`);
    debugLog(`Original image dimensions: ${img.getAttribute('data-width')}x${img.getAttribute('data-height')}`);
}

// Find path to selected destination
function findPath() {
    // Clear previous debug info
    if (debugMode) {
        document.getElementById('debugInfo').innerHTML = '';
    }

    const destination = document.getElementById('destinationSelect').value;
    if (!destination) {
        alert('กรุณาเลือกห้องที่ต้องการ');
        return;
    }

    // Show loading indicator
    document.getElementById('loadingIndicator').style.display = 'block';

    fetch('/find_path', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ destination: destination })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => handlePathData(data))
        .catch(handleError);
}

// Handle path data response
function handlePathData(data) {
    // Hide loading indicator
    document.getElementById('loadingIndicator').style.display = 'none';

    debugLog('Path data received from server:');
    debugLog(JSON.stringify(data));

    if (data.path && data.path.length > 0) {
        // Scale path coordinates to match current image size
        const scaledPath = scalePathToImageSize(data.path, data.img_width, data.img_height);
        debugLog('Scaled path coordinates:');
        debugLog(JSON.stringify(scaledPath));

        drawPath(scaledPath);
        updatePathInfo(data.nodes || [], scaledPath);
    } else {
        document.getElementById('pathInfo').innerHTML =
            '<h3>ข้อมูลเส้นทาง</h3><p class="error">ไม่พบเส้นทางไปยังห้องที่เลือก</p>';
        debugLog('No path found or empty path returned');
    }
}

// Handle error in path finding
function handleError(error) {
    document.getElementById('loadingIndicator').style.display = 'none';
    console.error('Error:', error);
    debugLog(`Error: ${error.message}`);
    document.getElementById('pathInfo').innerHTML =
        '<h3>ข้อมูลเส้นทาง</h3><p class="error">เกิดข้อผิดพลาดในการค้นหาเส้นทาง</p>';
}

// Scale path coordinates to match current image size
function scalePathToImageSize(pathCoords, originalWidth, originalHeight) {
    const img = document.getElementById('floorPlan');
    const currentWidth = img.clientWidth;
    const currentHeight = img.clientHeight;

    const scaleX = currentWidth / originalWidth;
    const scaleY = currentHeight / originalHeight;

    debugLog(`Scaling factors - X: ${scaleX}, Y: ${scaleY}`);
    debugLog(`Current image size: ${currentWidth}x${currentHeight}`);
    debugLog(`Original data size: ${originalWidth}x${originalHeight}`);

    return pathCoords.map(point => ({
        x: Math.round(point.x * scaleX),
        y: Math.round(point.y * scaleY),
        node_id: point.node_id
    }));
}

// Draw path animation
function drawPath(pathCoords) {
    const canvas = document.getElementById('pathCanvas');
    const ctx = canvas.getContext('2d');

    setupCanvas();

    let animationFrame;
    let offset = 0;
    const dashLength = 20;
    const animationSpeed = 1;

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw base path
        drawBasePath(ctx, pathCoords);
        
        // Draw animated path
        drawAnimatedPath(ctx, pathCoords, offset, dashLength);
        
        // Draw glowing effect
        drawGlowingPath(ctx, pathCoords, offset, dashLength);
        
        // Draw nodes
        drawNodes(ctx, pathCoords);

        // Update animation
        offset += animationSpeed;
        if (offset > 1000) offset = 0;

        animationFrame = requestAnimationFrame(animate);
    }

    if (window.pathAnimation) {
        cancelAnimationFrame(window.pathAnimation);
    }

    window.pathAnimation = requestAnimationFrame(animate);
}

// Draw base path
function drawBasePath(ctx, pathCoords) {
    ctx.beginPath();
    ctx.moveTo(pathCoords[0].x, pathCoords[0].y);
    for (let i = 1; i < pathCoords.length; i++) {
        ctx.lineTo(pathCoords[i].x, pathCoords[i].y);
    }
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.lineWidth = 8;
    ctx.stroke();
}

// Draw animated path
function drawAnimatedPath(ctx, pathCoords, offset, dashLength) {
    ctx.beginPath();
    ctx.moveTo(pathCoords[0].x, pathCoords[0].y);
    for (let i = 1; i < pathCoords.length; i++) {
        ctx.lineTo(pathCoords[i].x, pathCoords[i].y);
    }
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 8;
    ctx.setLineDash([dashLength]);
    ctx.lineDashOffset = -offset;
    ctx.stroke();
}

// Draw glowing path
function drawGlowingPath(ctx, pathCoords, offset, dashLength) {
    ctx.beginPath();
    ctx.moveTo(pathCoords[0].x, pathCoords[0].y);
    for (let i = 1; i < pathCoords.length; i++) {
        ctx.lineTo(pathCoords[i].x, pathCoords[i].y);
    }
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
    ctx.lineWidth = 4;
    ctx.setLineDash([dashLength]);
    ctx.lineDashOffset = -offset;
    ctx.shadowColor = '#FFFF00';
    ctx.shadowBlur = 10;
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
}

// Draw nodes
function drawNodes(ctx, pathCoords) {
    pathCoords.forEach((point, index) => {
        ctx.beginPath();

        if (index === 0) {
            ctx.fillStyle = '#2196F3';
            ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
        } else if (index === pathCoords.length - 1) {
            ctx.fillStyle = '#4CAF50';
            ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
        } else {
            ctx.fillStyle = '#FFC107';
            ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        }

        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 5;
        ctx.fill();
        ctx.shadowColor = 'transparent';
    });
}

// Calculate distance between two points
function calculateDistance(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// Update path information display
function updatePathInfo(path, pathCoords) {
    if (!path || path.length === 0) return;

    let info = '<h3>ข้อมูลเส้นทาง</h3><ol>';
    
    path.forEach((node, i) => {
        if (i === 0) {
            info += `<li>เริ่มต้นจาก <strong>${node}</strong></li>`;
        } else if (i === path.length - 1) {
            info += `<li>ถึงห้อง <strong>${node}</strong></li>`;
        } else if (node.startsWith('P')) {
            info += `<li>เดินผ่านจุด ${node}</li>`;
        } else {
            info += `<li>ผ่าน ${node}</li>`;
        }
    });

    info += '</ol>';

    const totalDistance = pathCoords.reduce((total, point, i) => {
        if (i === 0) return 0;
        return total + calculateDistance(pathCoords[i - 1], point);
    }, 0);

    info += `<p>รวมระยะทาง: ${Math.round(totalDistance)} พิกเซล</p>`;
    document.getElementById('pathInfo').innerHTML = info;
}

// Initialize canvas when page loads
window.onload = function () {
    if (document.getElementById('floorPlan').complete) {
        setupCanvas();
    }
};

// Handle window resize
window.addEventListener('resize', function () {
    setTimeout(function () {
        setupCanvas();
        const destination = document.getElementById('destinationSelect').value;
        if (destination) {
            findPath();
        }
    }, 100);
});

// Cleanup animation on page unload
window.addEventListener('beforeunload', () => {
    if (window.pathAnimation) {
        cancelAnimationFrame(window.pathAnimation);
    }
});