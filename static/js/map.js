// indoor-navigation.js
let nodeList = [];
let currentBuildingId = null;
let currentFloor = null;
let currentGraph = null;

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing indoor navigation...');
  
  // เริ่มต้นระบบ
  initializeIndoorNavigation();
  
  // เพิ่ม event listeners
  setupEventListeners();
});

async function initializeIndoorNavigation() {
  try {
    // โหลดข้อมูล nodes
    await loadNodes();
    
    console.log('Indoor navigation initialized successfully');
  } catch (error) {
    console.error('Error initializing indoor navigation:', error);
  }
}

function setupEventListeners() {
  // Event listener สำหรับ side menu
  const sideMenu = document.getElementById('sideMenu');
  if (sideMenu) {
    sideMenu.addEventListener('click', handleSideMenuClick);
  }

  // Event listener สำหรับ dropdown selection
  const destinationSelect = document.getElementById('destinationSelect');
  if (destinationSelect) {
    destinationSelect.addEventListener('change', handleDestinationChange);
  }

  // Event listener สำหรับ floor plan load
  const floorPlanImg = document.getElementById('floorPlan');
  if (floorPlanImg) {
    floorPlanImg.addEventListener('load', handleFloorPlanLoad);
  }
}

function handleSideMenuClick(event) {
  const target = event.target;
  
  // ตรวจสอบว่าคลิกที่ลิงก์อาคาร
  if (target.tagName === 'A' && target.hasAttribute('data-building')) {
    event.preventDefault();
    
    const building = target.getAttribute('data-building');
    const floor = target.getAttribute('data-floor');
    
    if (building && floor) {
      currentBuildingId = building;
      currentFloor = floor;
      
      console.log(`Selected building ${building}, floor ${floor}`);
      
      // อัพเดท floor plan
      updateFloorPlan(building, floor);
      
      // แสดง modal
      showIndoorModal();
    }
  }
}

function handleDestinationChange() {
  const select = document.getElementById('destinationSelect');
  const selectedRoom = select.value;
  
  console.log('Destination changed to:', selectedRoom);
  
  if (selectedRoom) {
    findAndDrawPath(selectedRoom);
  } else {
    clearPath();
  }
}

function handleFloorPlanLoad() {
  console.log('Floor plan loaded');
  setupCanvas();
}

async function loadNodes() {
  try {
    // ใช้ API endpoint เพื่อโหลดข้อมูล
    const response = await fetch('/get_building_info');
    if (!response.ok) {
      throw new Error('Failed to fetch building info');
    }
    
    // สำหรับตอนนี้ ใช้ข้อมูล mock เพื่อทดสอบ
    // ในอนาคตสามารถเปลี่ยนไปใช้ API จริง
    nodeList = await loadMockData();
    
    console.log('Nodes loaded:', nodeList.length);
    
  } catch (error) {
    console.error('Error loading nodes:', error);
    // ใช้ข้อมูล mock ในกรณีที่ API ไม่สำเร็จ
    nodeList = await loadMockData();
  }
}

async function loadMockData() {
  // ข้อมูล mock สำหรับทดสอบ
  return [
    { NodeID: 'E17F1', B_ID: '17', flor: '1', Type: 'Elevator', X: 100, Y: 100, Detail: 'ลิฟต์' },
    { NodeID: 'R17F1_01', B_ID: '17', flor: '1', Type: 'Room', X: 200, Y: 150, Detail: 'ห้อง 1701' },
    { NodeID: 'R17F1_02', B_ID: '17', flor: '1', Type: 'Room', X: 300, Y: 200, Detail: 'ห้อง 1702' },
    { NodeID: 'E17F2', B_ID: '17', flor: '2', Type: 'Elevator', X: 100, Y: 100, Detail: 'ลิฟต์' },
    { NodeID: 'R17F2_01', B_ID: '17', flor: '2', Type: 'Room', X: 200, Y: 150, Detail: 'ห้อง 1801' },
    { NodeID: 'R17F2_02', B_ID: '17', flor: '2', Type: 'Room', X: 300, Y: 200, Detail: 'ห้อง 1802' },
  ];
}

function updateFloorPlan(building, floor) {
  const floorPlanImg = document.getElementById('floorPlan');
  if (floorPlanImg) {
    floorPlanImg.src = `/static/img/planTower${building}Flor${floor}.png`;
    
    // โหลด dropdown rooms เมื่อรูปโหลดเสร็จ
    floorPlanImg.onload = () => {
      setupCanvas();
      populateRoomDropdown(building, floor);
    };
    
    // กรณีรูปโหลดไม่สำเร็จ
    floorPlanImg.onerror = () => {
      console.error('Failed to load floor plan image');
      // ใช้รูป default
      floorPlanImg.src = '/static/img/default-floor-plan.png';
    };
  }
}

function populateRoomDropdown(building, floor) {
  const select = document.getElementById('destinationSelect');
  if (!select) return;
  
  // เคลียร์ options เก่า
  select.innerHTML = '<option value="">🎯 เลือกห้องที่ต้องการไป</option>';
  
  console.log(`Looking for rooms in building ${building}, floor ${floor}`);
  
  // กรองห้องที่ตรงกับอาคารและชั้นที่เลือก
  const rooms = nodeList.filter(node => 
    node.B_ID === String(building) && 
    node.flor === String(floor) && 
    (node.Type === 'Room' || node.Type === 'Toilet')
  );
  
  console.log('Found rooms:', rooms);
  
  // เพิ่ม options
  rooms.forEach(room => {
    const option = document.createElement('option');
    option.value = room.NodeID;
    option.textContent = room.Detail || room.NodeID;
    select.appendChild(option);
  });
  
  if (rooms.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'ไม่พบห้องในชั้นนี้';
    option.disabled = true;
    select.appendChild(option);
  }
}

function setupCanvas() {
  const canvas = document.getElementById('pathCanvas');
  const img = document.getElementById('floorPlan');
  
  if (!canvas || !img) return;
  
  // ตั้งค่าขนาด canvas ให้เท่ากับรูป
  canvas.width = img.clientWidth;
  canvas.height = img.clientHeight;
  
  // ปรับ position ให้ทับกับรูป
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  
  // เคลียร์ canvas
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  console.log('Canvas setup complete:', canvas.width, 'x', canvas.height);
}

async function findAndDrawPath(destinationNodeId) {
  console.log('Finding path to:', destinationNodeId);
  
  if (!destinationNodeId) {
    clearPath();
    return;
  }
  
  try {
    // แสดง loading
    showLoadingIndicator();
    
    // ใช้ API สำหรับหา path
    const response = await fetch('/find_path', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        destination: destinationNodeId
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      drawPath(data.path);
      updatePathInfo(data.nodes);
    } else {
      // ถ้า API ไม่สำเร็จ ใช้วิธีวาดแบบง่าย
      drawSimplePath(destinationNodeId);
    }
    
  } catch (error) {
    console.error('Error finding path:', error);
    // วาดเส้นทางแบบง่าย
    drawSimplePath(destinationNodeId);
  } finally {
    hideLoadingIndicator();
  }
}

function drawSimplePath(destinationNodeId) {
  const destinationNode = nodeList.find(n => 
    n.NodeID === destinationNodeId && 
    n.B_ID === currentBuildingId && 
    n.flor === currentFloor
  );
  
  const startNode = nodeList.find(n => 
    n.Type === 'Elevator' && 
    n.B_ID === currentBuildingId && 
    n.flor === currentFloor
  );
  
  if (!destinationNode || !startNode) {
    console.error('Start or destination node not found');
    clearPath();
    return;
  }
  
  drawPath([
    { x: startNode.X, y: startNode.Y, node_id: startNode.NodeID },
    { x: destinationNode.X, y: destinationNode.Y, node_id: destinationNode.NodeID }
  ]);
  
  updatePathInfo([startNode.NodeID, destinationNode.NodeID]);
}

function drawPath(pathCoordinates) {
  const canvas = document.getElementById('pathCanvas');
  const ctx = canvas.getContext('2d');
  
  if (!pathCoordinates || pathCoordinates.length === 0) {
    clearPath();
    return;
  }
  
  // เคลียร์ canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // คำนวณอัตราส่วนการปรับขนาด
  const scaleX = canvas.width / 1080;  // สมมุติว่าแผนผังมีขนาด 1080x1080
  const scaleY = canvas.height / 1080;
  
  // วาดเส้นทาง
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  ctx.beginPath();
  pathCoordinates.forEach((point, index) => {
    const x = point.x * scaleX;
    const y = point.y * scaleY;
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
  
  // วาดจุดเริ่มต้น (สีน้ำเงิน)
  const startPoint = pathCoordinates[0];
  ctx.fillStyle = '#4444ff';
  ctx.beginPath();
  ctx.arc(startPoint.x * scaleX, startPoint.y * scaleY, 8, 0, 2 * Math.PI);
  ctx.fill();
  
  // วาดจุดปลายทาง (สีเขียว)
  const endPoint = pathCoordinates[pathCoordinates.length - 1];
  ctx.fillStyle = '#44ff44';
  ctx.beginPath();
  ctx.arc(endPoint.x * scaleX, endPoint.y * scaleY, 8, 0, 2 * Math.PI);
  ctx.fill();
  
  console.log('Path drawn successfully');
}

function updatePathInfo(pathNodes) {
  const pathInfoDiv = document.getElementById('pathInfo');
  if (!pathInfoDiv || !pathNodes || pathNodes.length < 2) return;
  
  const startNodeId = pathNodes[0];
  const endNodeId = pathNodes[pathNodes.length - 1];
  
  const startNode = nodeList.find(n => n.NodeID === startNodeId);
  const endNode = nodeList.find(n => n.NodeID === endNodeId);
  
  if (startNode && endNode) {
    pathInfoDiv.innerHTML = `
      <div class="path-info">
        <h5>🗺️ เส้นทางนำทาง</h5>
        <p><strong>จุดเริ่มต้น:</strong> ${startNode.Detail || startNode.NodeID}</p>
        <p><strong>จุดปลายทาง:</strong> ${endNode.Detail || endNode.NodeID}</p>
        <p><strong>จำนวนจุด:</strong> ${pathNodes.length} จุด</p>
      </div>
    `;
  }
}

function clearPath() {
  const canvas = document.getElementById('pathCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const pathInfoDiv = document.getElementById('pathInfo');
  if (pathInfoDiv) {
    pathInfoDiv.innerHTML = '';
  }
}

function showIndoorModal() {
  const modal = document.getElementById('indoorModal');
  if (modal) {
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  }
}

function showLoadingIndicator() {
  const indicator = document.getElementById('loadingIndicator');
  if (indicator) {
    indicator.style.display = 'block';
  }
}

function hideLoadingIndicator() {
  const indicator = document.getElementById('loadingIndicator');
  if (indicator) {
    indicator.style.display = 'none';
  }
}

// ฟังก์ชันสำหรับเรียกจาก HTML
function onDestinationChange() {
  handleDestinationChange();
}

// ฟังก์ชันสำหรับการซูม (ถ้าต้องการเพิ่มในอนาคต)
function zoomIn() {
  console.log('Zoom in');
  // TODO: Implement zoom functionality
}

function zoomOut() {
  console.log('Zoom out');
  // TODO: Implement zoom functionality
}

function resetView() {
  console.log('Reset view');
  setupCanvas();
}

// Export functions for global access
window.onDestinationChange = onDestinationChange;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetView = resetView;