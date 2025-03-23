import * as THREE from 'three';

import {
    OrbitControls
} from 'three/addons/controls/OrbitControls.js';

// 创建光源相机
const lightCamera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.5, 10);
lightCamera.position.set(2, 4, 2); // 设置光源相机位置
lightCamera.lookAt(0, 0, 0); // 让光源相机看向场景中心

// 创建渲染目标
const depthRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat
});

// 创建深度材质
const depthMaterial = new THREE.ShaderMaterial({
    vertexShader: /*glsl*/ `
        void main() {
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /*glsl*/ `
        void main() {
            // 将深度值编码到 RGBA 中（由于 WebGL 1.0 的限制）
            float depth = gl_FragCoord.z / gl_FragCoord.w;
            gl_FragColor = vec4(vec3(depth), 1.0);
        }
    `
});

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

    // 更新光源相机位置和朝向
    lightCamera.position.copy(dir.clone().multiplyScalar(5)); // 假设光源距离场景中心为 5
    lightCamera.lookAt(0, 0, 0);
     // 更新光源的投影视图矩阵
    const lightMatrix = new THREE.Matrix4();
    lightMatrix.multiplyMatrices(lightCamera.projectionMatrix, lightCamera.matrixWorldInverse);
    material.uniforms.uLightMatrix.value.copy(lightMatrix);
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
        },
        uShadowMap: { value: depthRenderTarget.texture }, // 深度贴图
        uLightMatrix: { value: new THREE.Matrix4() }, // 光源的投影视图矩阵
        uShadowMapSize: { value: new THREE.Vector2() },
        uPCFRadius: {value: 1.0}
    },
    vertexShader: /* glsl */`
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec4 vWorldPosition;

     void main() {
            vNormal = normalMatrix * normal;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewDir = -mvPosition.xyz;
            vWorldPosition = modelMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
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

        // 阴影相关
        uniform sampler2D uShadowMap;
        uniform mat4 uLightMatrix;
        varying vec4 vWorldPosition;
        uniform vec2 uShadowMapSize;
        uniform float uPCFRadius;

        float unpackDepth(const in vec4 rgbaDepth) {
            const vec4 bitShift = vec4(1.0, 1.0/255.0, 1.0/(255.0*255.0), 1.0/(255.0*255.0*255.0));
            return dot(rgbaDepth, bitShift);
        }

       float sampleShadowMap(sampler2D shadowMap, vec4 lightSpacePos) {
            vec3 shadowCoord = (lightSpacePos.xyz / lightSpacePos.w) / 2.0 + 0.5;
            float shadow = 0.0;
            float texelSizeX = 1.0 / uShadowMapSize.x;
            float texelSizeY = 1.0 / uShadowMapSize.y;
            float radius = uPCFRadius;
            int samples = int(2.0 * radius + 1.0);
            for (int x = -int(radius); x <= int(radius); ++x) {
                for (int y = -int(radius); y <= int(radius); ++y) {
                    float pcfDepth = unpackDepth(texture2D(shadowMap, shadowCoord.xy + vec2(float(x) * texelSizeX, float(y) * texelSizeY)));
                    shadow += step(shadowCoord.z - 0.005, pcfDepth);
                }
            }
            shadow /= float(samples * samples);
            return shadow;
        }

     void main() {
            vec3 N = normalize(vNormal);
            vec3 L = normalize(uLightDirection);
            vec3 V = normalize(vViewDir);

            // 计算阴影
            vec4 lightSpacePos = uLightMatrix * vWorldPosition;
            float shadow = sampleShadowMap(uShadowMap, lightSpacePos);


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
            // vec3 finalColor = ambient + diffuse + specular; // 先不考虑阴影
            vec3 finalColor = ambient + shadow * (diffuse + specular); // 考虑阴影
            gl_FragColor = vec4(finalColor, 1.0);
     }
    `
})

const cube = new THREE.Mesh(geometry, material);
scene.add(cube);
gui.add(material.uniforms.uPCFRadius, 'value', 0, 5, 1).name('PCF Radius');

// 创建平面
const planeGeometry = new THREE.PlaneGeometry(5, 5); // 假设平面大小为 5x5
const plane = new THREE.Mesh(planeGeometry, material);
plane.position.set(0, -1, 0); // 放置在立方体下方
plane.rotation.x = -Math.PI / 2; // 旋转平面以面向相机
scene.add(plane);

camera.position.z = 5;
// 稍微调整下相机位置，并看向场景中心
camera.position.y = 2;
controls.target.set(0, 0, 0);

// 创建光线方向辅助线
const lightDirectionHelper = new THREE.ArrowHelper(lightDir, new THREE.Vector3(0, 0, 0), 3, 0xff0000);
lightDirectionHelper.visible = params.showLightDirectionHelper; // 初始不可见
scene.add(lightDirectionHelper);

const animate = function () {
    requestAnimationFrame(animate);

    // 更新光源的投影视图矩阵
    const lightMatrix = new THREE.Matrix4();
    lightMatrix.multiplyMatrices(lightCamera.projectionMatrix, lightCamera.matrixWorldInverse);
    material.uniforms.uLightMatrix.value.copy(lightMatrix);
    material.uniforms.uShadowMapSize.value.set(window.innerWidth, window.innerHeight);

    // 1. 渲染深度贴图
    renderer.setRenderTarget(depthRenderTarget);
    renderer.clear();
    scene.overrideMaterial = depthMaterial; // 使用 depthMaterial 渲染场景
    renderer.render(scene, lightCamera);
    scene.overrideMaterial = null;

    // 2. 使用 Phong shader 渲染场景
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);

    controls.update();
    // renderer.render(scene, camera);
}

animate();