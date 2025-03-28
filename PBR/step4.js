import * as THREE from 'three';

// --- 基础设置 ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
// 推荐设置，确保输出颜色正确 (Three.js r152+ 默认)
// renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x333333); // 深灰色背景

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.5, 4); // 调整相机位置
camera.lookAt(0, 0, 0);

const geometry = new THREE.SphereGeometry(1, 64, 64); // 更平滑的球体

// --- GLSL 着色器代码 ---

// 顶点着色器 (Vertex Shader)
const vertexShader = /* glsl */`
    varying vec3 vWorldPosition;
    varying vec3 vWorldNormal;
    varying vec3 vViewDirection; // 从表面点指向相机的向量

    void main() {
        // 计算世界空间位置
        vec4 worldPosition4 = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition4.xyz;

        // 计算世界空间法线 (并归一化)
        vWorldNormal = normalize(normalMatrix * normal);

        // 计算世界空间中的视图方向 (并归一化)
        vViewDirection = normalize(cameraPosition - vWorldPosition);

        // 计算裁剪空间位置
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// 片元着色器 (Fragment Shader - 包含 PBR 函数和光照计算)
const fragmentShader = /* glsl */`
    #define MAX_POINT_LIGHTS 2  // 定义最大点光源数量
    #define MAX_DIR_LIGHTS 1   // 定义最大平行光数量
    #define PI 3.14159265359
    #define EPSILON 0.00001 // 使用稍小一点的 epsilon

    varying vec3 vWorldPosition;
    varying vec3 vWorldNormal;
    varying vec3 vViewDirection; // 从表面点指向相机的向量 (已经归一化)

    // --- Uniforms ---
    uniform vec3 uBaseColor;
    uniform float uMetallic;
    uniform float uRoughness;

    struct PointLight {
        vec3 position;
        vec3 color;
        float intensity;
    };
    struct DirectionalLight {
        vec3 direction; // 光线来的方向
        vec3 color;
        float intensity;
    };
    uniform int uNumPointLights;
    uniform PointLight uPointLights[MAX_POINT_LIGHTS];
    uniform int uNumDirLights;
    uniform DirectionalLight uDirLights[MAX_DIR_LIGHTS];

    // --- PBR 核心函数 ---

    // GGX/Trowbridge-Reitz 法线分布函数 (NDF)
    float NDF_GGX(vec3 N, vec3 H, float roughness) {
        float a = roughness * roughness;
        float a2 = a * a;
        float NdotH = max(dot(N, H), 0.0);
        float NdotH2 = NdotH * NdotH;

        float num = a2;
        float denom = (NdotH2 * (a2 - 1.0) + 1.0);
        denom = PI * denom * denom;

        return num / max(denom, EPSILON);
    }

    // Smith 几何函数 (针对 GGX 的 Schlick 近似)
    float GeometrySchlickGGX(float NdotV, float roughness) {
        float a = roughness * roughness;
        // 对于直接光照，k = (roughness + 1)^2 / 8 或 alpha / 2 都可以
        // k = (a + 1.0) * (a + 1.0) / 8.0; // Original Schlick-GGX k
        float k = a / 2.0; // More common for direct lighting

        float num = NdotV;
        float denom = NdotV * (1.0 - k) + k;

        return num / max(denom, EPSILON);
    }

    // Smith 几何函数 (结合光照和视角的遮蔽)
    float Geometry_Smith(vec3 N, vec3 V, vec3 L, float roughness) {
        float NdotV = max(dot(N, V), 0.0);
        float NdotL = max(dot(N, L), 0.0);
        float ggxV = GeometrySchlickGGX(NdotV, roughness); // Masking (from view)
        float ggxL = GeometrySchlickGGX(NdotL, roughness); // Shadowing (from light)

        return ggxV * ggxL;
    }

    // Schlick 菲涅尔近似
    vec3 Fresnel_Schlick(float cosTheta, vec3 F0) {
        return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
    }

    // 计算基础反射率 F0
    vec3 getF0(vec3 baseColor, float metallic) {
        return mix(vec3(0.04), baseColor, metallic);
    }


    void main() {
        // --- 获取表面属性和几何信息 ---
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(vViewDirection); // 从表面点指向相机
        vec3 baseColor = uBaseColor;
        float metallic = uMetallic;
        float roughness = uRoughness;
        vec3 worldPos = vWorldPosition;

        // --- 计算 F0 ---
        vec3 F0 = getF0(baseColor, metallic);

        // --- 初始化总光照 ---
        vec3 Lo = vec3(0.0); // Outgoing radiance

        // --- 计算直接光照 ---

        // 处理平行光
        for(int i = 0; i < uNumDirLights; ++i) {
            vec3 L = normalize(-uDirLights[i].direction); // 从表面指向光源
            vec3 H = normalize(V + L);
            vec3 radiance = uDirLights[i].color * uDirLights[i].intensity;

            float NdotL = max(dot(N, L), 0.0);
            if (NdotL > 0.0) {
                float NDF = NDF_GGX(N, H, roughness);
                float G = Geometry_Smith(N, V, L, roughness);
                vec3 F = Fresnel_Schlick(max(dot(H, V), 0.0), F0); // Use HdotV for Fresnel

                float NdotV = max(dot(N, V), 0.0);
                float denominator = 4.0 * NdotV * NdotL + EPSILON;
                vec3 specular = NDF * G * F / denominator;

                vec3 kS = F;
                vec3 kD = vec3(1.0) - kS;
                kD *= (1.0 - metallic); // Non-metals have diffuse

                vec3 diffuse = kD * baseColor / PI;

                Lo += (diffuse + specular) * radiance * NdotL;
            }
        }

        // 处理点光源
        for(int i = 0; i < uNumPointLights; ++i) {
            vec3 lightVec = uPointLights[i].position - worldPos;
            float distance = length(lightVec);
            float distanceSq = max(distance * distance, EPSILON * EPSILON); // Avoid division by zero
            vec3 L = normalize(lightVec);
            vec3 H = normalize(V + L);
            vec3 radiance = uPointLights[i].color * uPointLights[i].intensity;

            float attenuation = 1.0 / distanceSq;
            radiance *= attenuation;

            float NdotL = max(dot(N, L), 0.0);
            if (NdotL > 0.0) {
                float NDF = NDF_GGX(N, H, roughness);
                float G = Geometry_Smith(N, V, L, roughness);
                vec3 F = Fresnel_Schlick(max(dot(H, V), 0.0), F0);

                float NdotV = max(dot(N, V), 0.0);
                float denominator = 4.0 * NdotV * NdotL + EPSILON;
                vec3 specular = NDF * G * F / denominator;

                vec3 kS = F;
                vec3 kD = vec3(1.0) - kS;
                kD *= (1.0 - metallic);

                vec3 diffuse = kD * baseColor / PI;

                Lo += (diffuse + specular) * radiance * NdotL;
            }
        }

        // --- 添加简单的环境光 ---
        vec3 ambient = vec3(0.05) * baseColor * (1.0 - metallic); // Slightly increased ambient
        Lo += ambient;

        // --- 最终颜色 ---
        // Clamp final color to avoid potential issues with overly bright lights/materials
        // Lo = clamp(Lo, 0.0, 10.0); // Optional: Clamp if needed

        gl_FragColor = vec4(Lo, 1.0);

        // --- Gamma Correction (Handled by Three.js if renderer.outputColorSpace is SRGBColorSpace) ---
        // gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(1.0/2.2));
    }
`;

// --- PBR 参数对象 ---
const pbrParameters = {
  baseColor: 0xffffff, // White
  metallic: 0.1,
  roughness: 0.5 // Default roughness
};

// --- 光源数据 ---
const pointLightsData = [
  {
    position: new THREE.Vector3(3, 2, 3),
    color: new THREE.Color(0xffffff), // White light
    intensity: 1.5 // Increased intensity
  },
  { // Add a second point light for more interesting lighting
    position: new THREE.Vector3(-3, 1, -2),
    color: new THREE.Color(0xffddcc), // Warm light
    intensity: 1.0
  }
];

const dirLightsData = [
  {
    direction: new THREE.Vector3(0.5, -1, -0.5).normalize(), // Coming from upper right back
    color: new THREE.Color(0xccccff), // Cool light
    intensity: 0.5
  }
];

// --- ShaderMaterial ---
const material = new THREE.ShaderMaterial({
  vertexShader: vertexShader,
  fragmentShader: fragmentShader,
  uniforms: {
    // PBR Material
    uBaseColor: { value: new THREE.Color(pbrParameters.baseColor) },
    uMetallic: { value: pbrParameters.metallic },
    uRoughness: { value: pbrParameters.roughness },

    // Lighting
    // Make sure the lengths match the #define in the shader if you change the data arrays
    uNumPointLights: { value: pointLightsData.length },
    uPointLights: { value: pointLightsData },
    uNumDirLights: { value: dirLightsData.length },
    uDirLights: { value: dirLightsData }
    // cameraPosition is automatically provided by Three.js
  }
});

// --- 网格 (Mesh) ---
const sphere = new THREE.Mesh(geometry, material);
scene.add(sphere);

// --- GUI 设置 (使用 dat.gui) ---
const gui = new dat.GUI();

// PBR 材质文件夹
const materialFolder = gui.addFolder('PBR Material');
materialFolder.addColor(pbrParameters, 'baseColor')
  .name('Base Color')
  .onChange((value) => {
    material.uniforms.uBaseColor.value.set(value);
  });
materialFolder.add(pbrParameters, 'metallic', 0.0, 1.0, 0.01)
  .name('Metallic')
  .onChange((value) => {
    material.uniforms.uMetallic.value = value;
  });
materialFolder.add(pbrParameters, 'roughness', 0.0, 1.0, 0.01)
  .name('Roughness')
  .onChange((value) => {
    material.uniforms.uRoughness.value = value;
  });
materialFolder.open(); // Default open

// 光照文件夹
const lightFolder = gui.addFolder('Lighting');

// 控制点光源 (循环创建 GUI)
pointLightsData.forEach((light, index) => {
  if (index >= 2) return; // Limit GUI controls to MAX_POINT_LIGHTS if needed
  const pointLightFolder = lightFolder.addFolder(`Point Light ${index + 1}`);
  const lightProxy = { color: light.color.getHex() }; // Proxy for color

  pointLightFolder.add(light.position, 'x', -10, 10).name('Pos X').onChange(() => material.uniforms.uPointLights.value = pointLightsData);
  pointLightFolder.add(light.position, 'y', -10, 10).name('Pos Y').onChange(() => material.uniforms.uPointLights.value = pointLightsData);
  pointLightFolder.add(light.position, 'z', -10, 10).name('Pos Z').onChange(() => material.uniforms.uPointLights.value = pointLightsData);
  pointLightFolder.addColor(lightProxy, 'color').name('Color').onChange((value) => {
    light.color.set(value);
    material.uniforms.uPointLights.value = pointLightsData;
  });
  pointLightFolder.add(light, 'intensity', 0, 5, 0.01).name('Intensity').onChange(() => material.uniforms.uPointLights.value = pointLightsData); // Increased intensity range
  // pointLightFolder.open();
});

// 控制平行光 (循环创建 GUI)
dirLightsData.forEach((light, index) => {
  if (index >= 1) return; // Limit GUI controls to MAX_DIR_LIGHTS
  const dirLightFolder = lightFolder.addFolder(`Directional Light ${index + 1}`);
  const lightProxy = { color: light.color.getHex() }; // Proxy for color
  // Proxy for direction to handle normalization
  const dirProxy = { x: light.direction.x, y: light.direction.y, z: light.direction.z };

  const updateDirLight = () => {
    light.direction.set(dirProxy.x, dirProxy.y, dirProxy.z).normalize();
    // Update proxy in case normalization changed values significantly
    dirProxy.x = light.direction.x;
    dirProxy.y = light.direction.y;
    dirProxy.z = light.direction.z;
    gui.updateDisplay(); // Update GUI display
    material.uniforms.uDirLights.value = dirLightsData;
  };

  dirLightFolder.add(dirProxy, 'x', -1, 1, 0.01).name('Dir X').onChange(updateDirLight);
  dirLightFolder.add(dirProxy, 'y', -1, 1, 0.01).name('Dir Y').onChange(updateDirLight);
  dirLightFolder.add(dirProxy, 'z', -1, 1, 0.01).name('Dir Z').onChange(updateDirLight);
  dirLightFolder.addColor(lightProxy, 'color').name('Color').onChange((value) => {
    light.color.set(value);
    material.uniforms.uDirLights.value = dirLightsData;
  });
  dirLightFolder.add(light, 'intensity', 0, 5, 0.01).name('Intensity').onChange(() => material.uniforms.uDirLights.value = dirLightsData);
  // dirLightFolder.open();
});

// lightFolder.open();


// --- 窗口大小调整处理 ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

// --- 动画循环 ---
function animate() {
  requestAnimationFrame(animate);

  // Optional: Add rotation for better visualization
  // sphere.rotation.y += 0.005;

  renderer.render(scene, camera);
}

animate();