const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const GRID_SIZE = 20; // 网格大小
const CELL_SIZE = 25; // 单元格大小
const DELAY = 100; // 动画延迟（毫秒）

let startPoint = { x: 10, y: 10 };
let targetPoints = [{ x: 15, y: 15 }, { x: 5, y: 5 }];
let currentPoint = null;
let visitedPoints = new Set();
let animationId = null;
let foundTargets = new Set(); // 已找到的目标点
let searchStartTime = 0; // 搜索开始时间
let searchSteps = 0; // 搜索步数

// 绘制网格
function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制网格线
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= GRID_SIZE; i++) {
        // 垂直线
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE, 0);
        ctx.lineTo(i * CELL_SIZE, GRID_SIZE * CELL_SIZE);
        ctx.stroke();
        
        // 水平线
        ctx.beginPath();
        ctx.moveTo(0, i * CELL_SIZE);
        ctx.lineTo(GRID_SIZE * CELL_SIZE, i * CELL_SIZE);
        ctx.stroke();
    }
}

// 绘制点
function drawPoint(point, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(
        point.x * CELL_SIZE + CELL_SIZE / 2,
        point.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 3,
        0,
        Math.PI * 2
    );
    ctx.fill();
}

// 绘制所有点
function drawPoints() {
    // 绘制已访问的点
    visitedPoints.forEach(point => {
        const [x, y] = point.split(',').map(Number);
        drawPoint({ x, y }, '#ddd');
    });
    
    // 绘制目标点，已找到的用不同颜色
    targetPoints.forEach((point, index) => {
        const color = foundTargets.has(index) ? '#ff9900' : '#ff0000';
        drawPoint(point, color);
    });
    
    // 绘制起点
    drawPoint(startPoint, '#00ff00');
    
    // 绘制当前点
    if (currentPoint) {
        drawPoint(currentPoint, '#0000ff');
    }
}

// 检查点是否在网格范围内
function isValidPoint(point) {
    return point.x >= 0 && point.x < GRID_SIZE &&
           point.y >= 0 && point.y < GRID_SIZE;
}

// 检查是否找到目标点
function isTargetFound(point) {
    return targetPoints.some(target =>
        target.x === point.x && target.y === point.y
    );
}

// 螺旋搜索
function* spiralSearch() {
    const directions = [
        { x: 1, y: 0 },  // 右
        { x: 0, y: 1 },  // 下
        { x: -1, y: 0 }, // 左
        { x: 0, y: -1 }  // 上
    ];
    
    let x = startPoint.x;
    let y = startPoint.y;
    let directionIndex = 0;
    let steps = 1;
    let stepCount = 0;
    let turnCount = 0;
    
    // 起点
    yield { x, y };
    
    while (true) {
        // 更新方向和步数
        if (stepCount === steps) {
            directionIndex = (directionIndex + 1) % 4;
            stepCount = 0;
            turnCount++;
            
            if (turnCount === 2) {
                steps++;
                turnCount = 0;
            }
        }
        
        // 计算下一个点
        x += directions[directionIndex].x;
        y += directions[directionIndex].y;
        stepCount++;
        
        // 只有有效点才会被返回
        if (isValidPoint({ x, y })) {
            yield { x, y };
        }
        
        // 如果已经找到所有目标点，可以提前结束
        if (foundTargets.size === targetPoints.length) {
            return;
        }
    }
}

// 更新搜索状态显示
function updateSearchStatus() {
    const statusElement = document.getElementById('status');
    if (!statusElement) return;
    
    const elapsedTime = searchStartTime ? ((Date.now() - searchStartTime) / 1000).toFixed(2) : 0;
    const foundCount = foundTargets.size;
    const totalTargets = targetPoints.length;
    
    statusElement.innerHTML = `
        <p>搜索步数: ${searchSteps}</p>
        <p>已找到: ${foundCount}/${totalTargets} 个目标</p>
        <p>搜索时间: ${elapsedTime} 秒</p>
    `;
}

// 开始搜索
function startSearch() {
    if (animationId) return;
    
    const generator = spiralSearch();
    visitedPoints.clear();
    foundTargets.clear();
    currentPoint = null;
    searchSteps = 0;
    searchStartTime = Date.now();
    
    function animate() {
        // 控制搜索速度
        if (Date.now() - searchStartTime < searchSteps * DELAY) {
            animationId = requestAnimationFrame(animate);
            return;
        }
        
        const result = generator.next();
        if (result.done) {
            cancelAnimationFrame(animationId);
            animationId = null;
            updateSearchStatus();
            if (foundTargets.size === targetPoints.length) {
                alert('所有目标已找到！');
            } else {
                alert('搜索完成，但未找到所有目标！');
            }
            return;
        }
        
        const next = result.value;
        currentPoint = next;
        visitedPoints.add(`${next.x},${next.y}`);
        searchSteps++;
        
        // 检查是否找到目标点
        targetPoints.forEach((target, index) => {
            if (target.x === next.x && target.y === next.y) {
                foundTargets.add(index);
            }
        });
        
        drawGrid();
        drawPoints();
        updateSearchStatus();
        
        animationId = requestAnimationFrame(animate);
    }
    
    animationId = requestAnimationFrame(animate);
}

// 重置网格
function resetGrid() {
    if (searchInterval) {
        clearInterval(searchInterval);
        searchInterval = null;
    }
    
    visitedPoints.clear();
    currentPoint = null;
    drawGrid();
    drawPoints();
}

// 初始化
drawGrid();
drawPoints();