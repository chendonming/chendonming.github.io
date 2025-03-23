import * as THREE from 'three';

import {
    OrbitControls
} from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// 创建 GUI 控制面板
const gui = new dat.GUI();
const params = {
    lightDirection: { x: 1, y: 1, z: 1 },
    ambientColor: [0.1 * 255, 0.1 * 255, 0.1 * 255],
    diffuseColor: [4, 158, 244], // 0x049ef4
    specularColor: [255, 255, 255],
    shininess: 30,
    showLightDirectionHelper: false // 添加控制辅助线的显示参数
};

// 添加光照方向控制
const lightFolder = gui.addFolder('Light Direction');
lightFolder.add(params.lightDirection, 'x', -1, 1).onChange(updateLightDirection);
lightFolder.add(params.lightDirection, 'y', -1, 1).onChange(updateLightDirection);
lightFolder.add(params.lightDirection, 'z', -1, 1).onChange(updateLightDirection);
lightFolder.open();

// 添加颜色控制
const colorFolder = gui.addFolder('Colors');
colorFolder.addColor(params, 'ambientColor').onChange(updateColors);
colorFolder.addColor(params, 'diffuseColor').onChange(updateColors);
colorFolder.addColor(params, 'specularColor').onChange(updateColors);
colorFolder.open();

// 添加光泽度控制
gui.add(params, 'shininess', 1, 100).onChange(updateShininess);

// 添加显示光照方向辅助线的控制
gui.add(params, 'showLightDirectionHelper').name('Show Light Helper').onChange(updateLightHelperVisibility);

// 更新函数
function updateLightDirection() {
    const dir = new THREE.Vector3(
        params.lightDirection.x,
        params.lightDirection.y,
        params.lightDirection.z
    ).normalize();
    material.uniforms.uLightDirection.value.copy(dir);
    // 更新辅助线方向
    lightDirectionHelper.setDirection(dir);
}

function updateColors() {
    material.uniforms.uAmbientColor.value.setRGB(
        params.ambientColor[0] / 255,
        params.ambientColor[1] / 255,
        params.ambientColor[2] / 255
    );
    material.uniforms.uDiffuseColor.value.setRGB(
        params.diffuseColor[0] / 255,
        params.diffuseColor[1] / 255,
        params.diffuseColor[2] / 255
    );
    material.uniforms.uSpecularColor.value.setRGB(
        params.specularColor[0] / 255,
        params.specularColor[1] / 255,
        params.specularColor[2] / 255
    );
}

function updateShininess() {
    material.uniforms.uShininess.value = params.shininess;
}

function updateLightHelperVisibility(visible) {
    lightDirectionHelper.visible = visible;
}

// 光线方向
const lightDir = new THREE.Vector3(1, 1, 1).normalize();

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.ShaderMaterial({
    uniforms: {
        uLightDirection: {
            value: lightDir
        },
        uAmbientColor: {
            value: new THREE.Color().setRGB(0.1, 0.1, 0.1)
        },
        uDiffuseColor: {
            value: new THREE.Color(0x049ef4)
        },
        uSpecularColor: {
            value: new THREE.Color(0xffffff)
        },
        uShininess: {
            value: 30
        },
        uLightColor: {
            value: new THREE.Color(0xffffff)
        }
    },
    vertexShader: /* glsl */`
        varying vec3 vNormal;
        // 观察空间位置
        varying vec3 vViewDir;
    	void main() {
            vNormal = normalMatrix * normal;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewDir = -mvPosition.xyz;
    		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    	}
    `,
    fragmentShader: /* glsl */`
        #define RECIPROCAL_PI 0.3183098861837907
        varying vec3 vNormal;
        uniform vec3 uLightDirection;
        uniform vec3 uAmbientColor;
        uniform vec3 uDiffuseColor;
        uniform vec3 uSpecularColor;
        uniform float uShininess;
        uniform vec3 uLightColor;
        varying vec3 vViewDir;
    	void main() {
            vec3 N = normalize(vNormal);
            vec3 L = normalize(uLightDirection);
            vec3 V = normalize(vViewDir);

            // 环境光分量
            vec3 ambient = uAmbientColor * uDiffuseColor;
            
            // 漫反射分量
            float diff = max(dot(N, L), 0.0);
            vec3 diffuse = uLightColor * uDiffuseColor * diff;
            
            // Blinn-Phong 高光计算
            vec3 H = normalize(L + V); // 半程向量
            float spec = pow(max(dot(N, H), 0.0), uShininess);
            vec3 specular = uLightColor * uSpecularColor * spec;
            
            // 最终颜色合成
            vec3 finalColor = ambient + diffuse + specular;
            gl_FragColor = vec4(finalColor, 1.0);
    	}
    `
})

const cube = new THREE.Mesh(geometry, material);
scene.add(cube);
camera.position.z = 5;

// 创建光线方向辅助线
const lightDirectionHelper = new THREE.ArrowHelper(lightDir, new THREE.Vector3(0, 0, 0), 3, 0xff0000);
lightDirectionHelper.visible = params.showLightDirectionHelper; // 初始不可见
scene.add(lightDirectionHelper);

const animate = function () {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();