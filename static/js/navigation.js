// Debug mode flag
let debugMode = false;
let currentZoom = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Animation variables
let animationId = null;
let pulsePhase = 0;
let flowOffset = 0;
let glowIntensity = 0;
let pathProgress = 0;
let isAnimating = false;

// Function to log debug information
function debugLog(message) {
    if (debugMode) {
        const debugInfo = document.getElementById('debugInfo');
        if (debugInfo) {
            debugInfo.innerHTML += message + '<br>';
        }
        console.log(message);
    }
}

// Initialize canvas when image loads
document.getElementById('floorPlan').onload = function () {
    setupCanvas();
    setupInteractivity();
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
}

// Setup interactive features
function setupInteractivity() {
    const canvas = document.getElementById('pathCanvas');
    const container = document.querySelector('.navigation-container');

    // Mouse wheel zoom
    container.addEventListener('wheel', function(e) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        zoom(zoomFactor, e.clientX, e.clientY);
    });

    // Touch events for mobile
    let touchStartDistance = 0;
    container.addEventListener('touchstart', function(e) {
        if (e.touches.length === 2) {
            touchStartDistance = getTouchDistance(e.touches[0], e.touches[1]);
        }
    });

    container.addEventListener('touchmove', function(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
            const zoomFactor = currentDistance / touchStartDistance;
            zoom(zoomFactor, e.touches[0].clientX, e.touches[0].clientY);
            touchStartDistance = currentDistance;
        }
    });
}

function getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function zoom(factor, centerX, centerY) {
    const newZoom = Math.max(0.5, Math.min(3, currentZoom * factor));
    if (newZoom !== currentZoom) {
        currentZoom = newZoom;
        applyTransform();
    }
}

function zoomIn() {
    zoom(1.2);
}

function zoomOut() {
    zoom(0.8);
}

function resetView() {
    currentZoom = 1;
    panX = 0;
    panY = 0;
    applyTransform();
}

function applyTransform() {
    const container = document.querySelector('.navigation-container');
    const img = document.getElementById('floorPlan');
    const canvas = document.getElementById('pathCanvas');

    const transform = `scale(${currentZoom}) translate(${panX}px, ${panY}px)`;
    img.style.transform = transform;
    canvas.style.transform = transform;
}

// Find path to selected destination
function findPath() {
    const destination = document.getElementById('destinationSelect').value;
    if (!destination) {
        alert('กรุณาเลือกห้องที่ต้องการ');
        return;
    }

    // Show loading indicator with animation
    const loadingIndicator = document.getElementById('loadingIndicator');
    loadingIndicator.style.display = 'block';

    // Clear previous path
    clearPath();

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
    const loadingIndicator = document.getElementById('loadingIndicator');
    loadingIndicator.style.display = 'none';

    debugLog('Path data received from server:');
    debugLog(JSON.stringify(data));

    if (data.path && data.path.length > 0) {
        const scaledPath = scalePathToImageSize(data.path, data.img_width, data.img_height);
        debugLog('Scaled path coordinates:');
        debugLog(JSON.stringify(scaledPath));

        // Start Google Maps-like animation
        startGoogleMapsAnimation(scaledPath);
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

    return pathCoords.map(point => ({
        x: Math.round(point.x * scaleX),
        y: Math.round(point.y * scaleY),
        node_id: point.node_id
    }));
}

// Clear existing path
function clearPath() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    const canvas = document.getElementById('pathCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Reset animation variables
    pulsePhase = 0;
    flowOffset = 0;
    glowIntensity = 0;
    pathProgress = 0;
    isAnimating = false;

    // Hide distance indicator
    document.getElementById('distanceIndicator').style.display = 'none';
}

// Start Google Maps-like animation
function startGoogleMapsAnimation(pathCoords) {
    if (pathCoords.length < 2) return;

    const canvas = document.getElementById('pathCanvas');
    const ctx = canvas.getContext('2d');

    // Reset animation variables
    pathProgress = 0;
    pulsePhase = 0;
    flowOffset = 0;
    glowIntensity = 0;
    isAnimating = true;

    // Calculate total distance for animation timing
    const totalDistance = calculateTotalDistance(pathCoords);

    // Show distance indicator
    const distanceIndicator = document.getElementById('distanceIndicator');
    distanceIndicator.textContent = `📏 ${Math.round(totalDistance * 0.01 )} เมตร`;
    distanceIndicator.style.display = 'block';

    function animate() {
        if (!isAnimating) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update animation parameters
        pulsePhase += 0.15;
        flowOffset += 3;
        glowIntensity = (Math.sin(pulsePhase * 0.5) + 1) * 0.5;

        // Progressive path drawing
        if (pathProgress < 1) {
            pathProgress += 0.02; // Smooth progression
        }

        // Draw background path (always visible)
        drawBackgroundPath(ctx, pathCoords);

        // Draw animated path segments
        drawGoogleMapsPath(ctx, pathCoords, pathProgress);

        // Draw nodes with pulsing effect
        drawAnimatedNodes(ctx, pathCoords, pathProgress);

        // Draw direction arrows
        drawDirectionArrows(ctx, pathCoords, pathProgress);

        animationId = requestAnimationFrame(animate);
    }

    animate();
}

// Draw background path
function drawBackgroundPath(ctx, pathCoords) {
    if (pathCoords.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(pathCoords[0].x, pathCoords[0].y);

    for (let i = 1; i < pathCoords.length; i++) {
        ctx.lineTo(pathCoords[i].x, pathCoords[i].y);
    }

    // Background stroke
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // White inner stroke
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();
}

// Draw Google Maps-like animated path
function drawGoogleMapsPath(ctx, pathCoords, progress) {
    if (pathCoords.length < 2) return;

    const visiblePoints = Math.floor(pathCoords.length * progress);
    if (visiblePoints < 2) return;

    // Create gradient for the path
    const gradient = createPathGradient(ctx, pathCoords, visiblePoints);

    // Draw main animated path
    ctx.beginPath();
    ctx.moveTo(pathCoords[0].x, pathCoords[0].y);

    for (let i = 1; i < visiblePoints; i++) {
        ctx.lineTo(pathCoords[i].x, pathCoords[i].y);
    }

    // Main path with gradient
    ctx.lineWidth = 6;
    ctx.strokeStyle = gradient;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Flowing animation overlay
    drawFlowingOverlay(ctx, pathCoords, visiblePoints);

    // Glowing effect
    drawGlowEffect(ctx, pathCoords, visiblePoints);
}

// Create gradient for path
function createPathGradient(ctx, pathCoords, visiblePoints) {
    if (visiblePoints < 2) return '#4285F4';

    const startPoint = pathCoords[0];
    const endPoint = pathCoords[visiblePoints - 1];

    const gradient = ctx.createLinearGradient(
        startPoint.x, startPoint.y,
        endPoint.x, endPoint.y
    );

    gradient.addColorStop(0, '#4285F4');      // Google Blue
    gradient.addColorStop(0.5, '#34A853');   // Google Green
    gradient.addColorStop(1, '#FBBC05');     // Google Yellow

    return gradient;
}

// Draw flowing overlay animation
function drawFlowingOverlay(ctx, pathCoords, visiblePoints) {
    if (visiblePoints < 2) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pathCoords[0].x, pathCoords[0].y);

    for (let i = 1; i < visiblePoints; i++) {
        ctx.lineTo(pathCoords[i].x, pathCoords[i].y);
    }

    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.setLineDash([15, 10]);
    ctx.lineDashOffset = -flowOffset;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
}

// Draw glowing effect
function drawGlowEffect(ctx, pathCoords, visiblePoints) {
    if (visiblePoints < 2) return;

    ctx.save();
    ctx.shadowColor = '#4285F4';
    ctx.shadowBlur = 15 + (glowIntensity * 10);
    ctx.globalAlpha = 0.3 + (glowIntensity * 0.3);

    ctx.beginPath();
    ctx.moveTo(pathCoords[0].x, pathCoords[0].y);

    for (let i = 1; i < visiblePoints; i++) {
        ctx.lineTo(pathCoords[i].x, pathCoords[i].y);
    }

    ctx.lineWidth = 8;
    ctx.strokeStyle = '#4285F4';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.restore();
}

// Draw animated nodes
function drawAnimatedNodes(ctx, pathCoords, progress) {
    const visiblePoints = Math.floor(pathCoords.length * progress);

    pathCoords.forEach((point, index) => {
        if (index >= visiblePoints) return;

        const isStart = index === 0;
        const isEnd = index === pathCoords.length - 1;
        const pulseSize = 2 + Math.sin(pulsePhase + index * 0.5) * 1;

        ctx.save();

        if (isStart) {
            // Start point - blue with pulse
            ctx.beginPath();
            ctx.arc(point.x, point.y, 8 + pulseSize, 0, Math.PI * 2);
            ctx.fillStyle = '#4285F4';
            ctx.shadowColor = '#4285F4';
            ctx.shadowBlur = 10;
            ctx.fill();

            // Inner white dot
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.shadowBlur = 0;
            ctx.fill();

        } else if (isEnd && index < visiblePoints) {
            // End point - red with pulse
            ctx.beginPath();
            ctx.arc(point.x, point.y, 10 + pulseSize, 0, Math.PI * 2);
            ctx.fillStyle = '#EA4335';
            ctx.shadowColor = '#EA4335';
            ctx.shadowBlur = 15;
            ctx.fill();

            // Inner white dot
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.shadowBlur = 0;
            ctx.fill();

        } else {
            // Intermediate points - small dots
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2 + pulseSize * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.shadowColor = '#4285F4';
            ctx.shadowBlur = 5;
            ctx.fill();
        }

        ctx.restore();
    });
}

// Draw direction arrows
function drawDirectionArrows(ctx, pathCoords, progress) {
    const visiblePoints = Math.floor(pathCoords.length * progress);
    if (visiblePoints < 2) return;

    ctx.save();

    for (let i = 0; i < visiblePoints - 1; i += 3) { // Show arrow every 3 points
        if (i + 1 >= pathCoords.length) break;

        const start = pathCoords[i];
        const end = pathCoords[i + 1];

        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;

        // Draw arrow
        ctx.translate(midX, midY);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.moveTo(-5, -3);
        ctx.lineTo(5, 0);
        ctx.lineTo(-5, 3);
        ctx.closePath();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 3;
        ctx.fill();

        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    }

    ctx.restore();
}

// Calculate total distance
function calculateTotalDistance(pathCoords) {
    let total = 0;
    for (let i = 1; i < pathCoords.length; i++) {
        const dx = pathCoords[i].x - pathCoords[i-1].x;
        const dy = pathCoords[i].y - pathCoords[i-1].y;
        total += Math.sqrt(dx * dx + dy * dy);
    }
    return total;
}

// Update path information display
function updatePathInfo(path, pathCoords) {
    if (!path || path.length === 0) return;

    let info = '<h3>🗺️ ข้อมูลเส้นทาง</h3><ol class="path-steps">';

    path.forEach((node, i) => {
        if (i === 0) {
            info += `<li class="step-start">🚀 เริ่มต้นจาก <strong>${node}</strong></li>`;
        } else if (i === path.length - 1) {
            info += `<li class="step-end">🎯 ถึงห้อง <strong>${node}</strong></li>`;
        } else if (node.startsWith('P')) {
            info += `<li class="step-waypoint">📍 เดินผ่านจุด ${node}</li>`;
        } else {
            info += `<li class="step-through">➡️ ผ่าน ${node}</li>`;
        }
    });

    info += '</ol>';

    const totalDistance = calculateTotalDistance(pathCoords);
    const estimatedTime = Math.ceil(totalDistance * 0.01); // Rough time estimate

    info += `
        <div class="path-summary">
            <div class="summary-item">
                <span class="icon">📏</span>
                <span class="label">ระยะทาง:</span>
                <span class="value">${Math.round(totalDistance * 0.1)} เมตร</span>
            </div>
            <div class="summary-item">
                <span class="icon">⏱️</span>
                <span class="label">เวลาโดยประมาณ:</span>
                <span class="value">${estimatedTime} นาที</span>
            </div>
        </div>
    `;

    document.getElementById('pathInfo').innerHTML = info;
}

// Initialize canvas when page loads
window.onload = function () {
    if (document.getElementById('floorPlan').complete) {
        setupCanvas();
        setupInteractivity();
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
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
});

// Add CSS for path info styling
const pathInfoStyles = `
<style>
.path-steps {
    padding-left: 0;
    list-style: none;
}

.path-steps li {
    padding: 8px 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    gap: 8px;
}

.path-steps li:last-child {
    border-bottom: none;
}

.step-start {
    color: #4285F4;
    font-weight: bold;
}

.step-end {
    color: #EA4335;
    font-weight: bold;
}

.step-waypoint {
    color: #34A853;
}

.step-through {
    color: #666;
}

.path-summary {
    margin-top: 15px;
    padding: 15px;
    background: rgba(66, 133, 244, 0.1);
    border-radius: 8px;
    display: flex;
    justify-content: space-around;
    gap: 15px;
}

.summary-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
}

.summary-item .icon {
    font-size: 24px;
    margin-bottom: 5px;
}

.summary-item .label {
    font-size: 12px;
    color: #666;
    margin-bottom: 2px;
}

.summary-item .value {
    font-weight: bold;
    color: #4285F4;
}
</style>
`;

// Add styles to head
document.head.insertAdjacentHTML('beforeend', pathInfoStyles);