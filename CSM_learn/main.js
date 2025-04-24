import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSM, NUM_CASCADES } from './csm_logic.js'; // Import CSM class

async function main() {
  // --- Basic Setup ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 15);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  console.log("Using WebGL version:", renderer.capabilities.isWebGL2 ? '2' : '1');
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0);
  controls.update();

  // --- Lighting Parameters & GUI ---
  const gui = new dat.GUI(); // dat.gui is global
  const params = {
    lightDirection: { x: 0.5, y: 0.8, z: 0.5 },
    ambientColor: [0.1 * 255, 0.1 * 255, 0.1 * 255],
    diffuseColor: [70, 130, 180],
    specularColor: [255, 255, 255],
    shininess: 30,
    lightColor: [255, 255, 255],
    csm: { // CSM specific params moved here for clarity
      splitScheme: 'practical',
      lambda: 0.65,
      autoUpdateLightCamera: true,
    }
  };

  // --- Uniforms ---
  // Note: CSM uniforms (uCascadeSplits, uCascadeMatrices, uShadowMapSize)
  // will be managed and added by the CSM class instance.
  const uniforms = {
    uLightDirection: { value: new THREE.Vector3().copy(params.lightDirection).normalize() },
    uAmbientColor: { value: new THREE.Color().fromArray(params.ambientColor.map(c => c / 255)) },
    uDiffuseColor: { value: new THREE.Color().fromArray(params.diffuseColor.map(c => c / 255)) },
    uSpecularColor: { value: new THREE.Color().fromArray(params.specularColor.map(c => c / 255)) },
    uShininess: { value: params.shininess },
    uLightColor: { value: new THREE.Color().fromArray(params.lightColor.map(c => c / 255)) },
    cameraPosition: { value: camera.position }
  };

  // --- GUI Setup ---
  const lightFolder = gui.addFolder('Light Direction');
  lightFolder.add(params.lightDirection, 'x', -1, 1).onChange(updateLightDirection);
  lightFolder.add(params.lightDirection, 'y', -1, 1).onChange(updateLightDirection);
  lightFolder.add(params.lightDirection, 'z', -1, 1).onChange(updateLightDirection);
  lightFolder.open();

  const colorFolder = gui.addFolder('Colors & Material');
  colorFolder.addColor(params, 'ambientColor').name('Ambient Light').onChange(updateColors);
  colorFolder.addColor(params, 'diffuseColor').name('Object Diffuse').onChange(updateColors);
  colorFolder.addColor(params, 'specularColor').name('Object Specular').onChange(updateColors);
  colorFolder.addColor(params, 'lightColor').name('Light Color').onChange(updateColors);
  colorFolder.add(params, 'shininess', 1, 100).onChange(updateShininess);
  colorFolder.open();

  // --- CSM Initialization ---
  // Pass necessary objects and references to the CSM class
  const csm = new CSM(camera, scene, gui, params, uniforms);

  // --- Update Functions ---
  function updateLightDirection() {
    const newLightDir = new THREE.Vector3().copy(params.lightDirection).normalize();
    uniforms.uLightDirection.value.copy(newLightDir);
    // Notify CSM instance about the change
    csm.handleLightDirectionChange(newLightDir);
  }

  function updateColors() {
    uniforms.uAmbientColor.value.fromArray(params.ambientColor.map(c => c / 255));
    uniforms.uDiffuseColor.value.fromArray(params.diffuseColor.map(c => c / 255));
    uniforms.uSpecularColor.value.fromArray(params.specularColor.map(c => c / 255));
    uniforms.uLightColor.value.fromArray(params.lightColor.map(c => c / 255));
  }

  function updateShininess() {
    uniforms.uShininess.value = params.shininess;
  }
  // Note: updateCSMSettings is now handled within the CSM class via its GUI callbacks

  // --- Load Shaders ---
  const fileLoader = new THREE.FileLoader();
  let vertexShader, fragmentShader;
  try {
    vertexShader = await fileLoader.loadAsync('shaders/phong_vert.glsl');
    fragmentShader = await fileLoader.loadAsync('shaders/phong_frag.glsl');
    console.log("Shaders loaded successfully.");
  } catch (error) {
    console.error("Error loading shaders:", error);
    document.body.innerHTML = `Error loading shaders. Check console. <pre>${error}</pre>`;
    return;
  }

  // --- Create Phong Material ---
  // Uniforms now include those managed by CSM
  const phongMaterial = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    lights: false,
    glslVersion: THREE.GLSL3
  });

  // --- Scene Objects ---
  // Ground Plane
  const planeGeometry = new THREE.PlaneGeometry(30, 30);
  const plane = new THREE.Mesh(planeGeometry, phongMaterial);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -0.5;
  scene.add(plane);

  // Pillars (Cubes)
  const pillarGeometry = new THREE.BoxGeometry(0.8, 3, 0.8);
  const pillarCount = 20;
  const spacing = 3;
  const rows = 2;
  const pillarsPerRow = pillarCount / rows;

  for (let i = 0; i < pillarCount; i++) {
    const pillar = new THREE.Mesh(pillarGeometry, phongMaterial);
    const row = Math.floor(i / pillarsPerRow);
    const col = i % pillarsPerRow;
    pillar.position.x = (col - (pillarsPerRow - 1) / 2) * spacing;
    pillar.position.y = 1.0;
    pillar.position.z = (row === 0 ? -spacing * 1.5 : spacing * 1.5);
    scene.add(pillar);
  }

  // --- Animation Loop ---
  function animate() {
    requestAnimationFrame(animate);

    controls.update(); // Update controls first

    // Update camera position uniform for lighting calculation
    uniforms.cameraPosition.value.copy(camera.position);

    // Update CSM logic (calculates splits, updates light cameras if needed)
    csm.update(uniforms.uLightDirection.value); // Pass current light direction

    // --- Render Pass (Placeholder for now) ---
    // 1. Render depth maps (Next Step)
    // 2. Render final scene (Later Step)

    renderer.render(scene, camera); // Render main scene (still without shadows)
  }

  // --- Handle Window Resize ---
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Notify CSM instance about the resize
    csm.handleResize();
  });

  // Start animation
  console.log("Starting animation loop...");
  animate();
}

main().catch(err => {
  console.error("Error in main execution:", err);
  document.body.innerHTML = `Fatal error during initialization. Check console. <pre>${err}</pre>`;
});