import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 创建场景、相机和渲染器
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 创建轨道控制器
const controls = new OrbitControls(camera, renderer.domElement);

// 创建平面
const planeGeometry = new THREE.PlaneGeometry(5, 5);
const planeMaterial = new THREE.MeshPhongMaterial({ color: 0x808080, side: THREE.DoubleSide });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
scene.add(plane);

// 创建球体 (测试对象)
const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
const sphereMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphere.position.set(0, 1, 0);
scene.add(sphere);

// 创建遮挡物（一个大立方体）
const occluderGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const occluderMaterial = new THREE.MeshPhongMaterial({ color: 0x0000ff });
const occluder = new THREE.Mesh(occluderGeometry, occluderMaterial);
occluder.position.set(0, 1, 2); // 放在球体前面
scene.add(occluder);

// 添加灯光
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// 设置相机位置
camera.position.set(5, 5, 5);
camera.lookAt(0, 0, 0);

// 创建单独的场景用于遮挡测试
const occlusionScene = new THREE.Scene();
const occluderForTest = occluder.clone();
occlusionScene.add(occluderForTest);

// 创建遮挡查询
const gl = renderer.getContext();
const query = gl.createQuery();
let queryInProgress = false;

// 更新遮挡状态显示
function updateOcclusionStatus(isOccluded) {
    const status = document.getElementById('occlusionStatus');
    status.textContent = isOccluded ? '被遮挡' : '可见';
    status.style.color = isOccluded ? '#ff0000' : '#00ff00';
}

// 移动遮挡物
let direction = 0.02;
function moveOccluder() {
    occluder.position.z += direction;
    occluderForTest.position.copy(occluder.position);
    
    if (occluder.position.z > 3 || occluder.position.z < -1) {
        direction *= -1;
    }
}

// 执行遮挡查询
function performOcclusionQuery() {
    if (queryInProgress) {
        return;
    }
    
    // 保存当前渲染状态
    const currentClearColor = renderer.getClearColor(new THREE.Color());
    const currentClearAlpha = renderer.getClearAlpha();
    const currentAutoClear = renderer.autoClear;
    
    // 设置渲染器为仅深度测试模式
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0);
    gl.colorMask(false, false, false, false);
    gl.depthMask(true);
    renderer.clear();
    
    // 渲染遮挡物
    renderer.render(occlusionScene, camera);
    
    // 开始查询
    gl.beginQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE, query);
    
    // 渲染被测试物体
    const sphereClone = sphere.clone();
    const tempScene = new THREE.Scene();
    tempScene.add(sphereClone);
    renderer.render(tempScene, camera);
    
    // 结束查询
    gl.endQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE);
    queryInProgress = true;
    
    // 恢复渲染状态
    gl.colorMask(true, true, true, true);
    renderer.setClearColor(currentClearColor, currentClearAlpha);
    renderer.autoClear = currentAutoClear;
}

// 检查查询结果
function checkQueryResult() {
    if (!queryInProgress) {
        return;
    }
    
    if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
        const samplesPassed = gl.getQueryParameter(query, gl.QUERY_RESULT);
        const isOccluded = samplesPassed === 0;
        updateOcclusionStatus(isOccluded);
        queryInProgress = false;
    }
}

// 动画循环
function animate() {
    requestAnimationFrame(animate);
    
    // 旋转球体
    sphere.rotation.y += 0.01;
    
    // 移动遮挡物
    moveOccluder();
    
    // 执行遮挡查询
    performOcclusionQuery();
    
    // 检查查询结果
    checkQueryResult();
    
    // 更新控制器
    controls.update();
    
    // 渲染场景
    renderer.render(scene, camera);
}

// 处理窗口大小变化
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.renderer = renderer;
// 开始动画循环
animate();
