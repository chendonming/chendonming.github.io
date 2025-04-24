import * as THREE from 'three';

const NUM_CASCADES = 3;

// Helper vectors and matrices reused across updates
const frustumCornersWorld = Array.from({ length: 8 }, () => new THREE.Vector3());
const frustumCenter = new THREE.Vector3();
const lightUp = new THREE.Vector3(0, 1, 0); // Assuming light direction is not straight up/down
const lightTarget = new THREE.Vector3();
const lightMatrix = new THREE.Matrix4();
const texelSize = new THREE.Vector2(); // For stabilizing projection
const shadowMatrixTmp = new THREE.Matrix4(); // Temporary matrix for stabilization calc

/**
 * Calculates the split distances for the cascades.
 * @param {number} numCascades
 * @param {number} near Camera near plane
 * @param {number} far Camera far plane
 * @param {string} scheme 'linear', 'logarithmic', 'practical'
 * @param {number} lambda Weighting factor for practical scheme
 * @param {Array<{near: number, far: number}>} outSplits Array to store results
 */
function calculateCascadeSplits(numCascades, near, far, scheme, lambda, outSplits) {
  const C = numCascades;
  const N = near;
  const F = far;

  for (let i = 0; i < C; i++) {
    const id = i + 1;
    let splitFar;
    if (scheme === 'linear') {
      splitFar = N + (F - N) * (id / C);
    } else if (scheme === 'logarithmic') {
      splitFar = N * Math.pow(F / N, id / C);
    } else { // practical
      const linearSplit = N + (F - N) * (id / C);
      const logSplit = N * Math.pow(F / N, id / C);
      splitFar = lambda * logSplit + (1.0 - lambda) * linearSplit;
    }
    outSplits[i].near = (i === 0) ? N : outSplits[i - 1].far;
    outSplits[i].far = splitFar;
  }
  // Ensure the last cascade covers the full far plane
  if (outSplits.length > 0) {
    outSplits[C - 1].far = F;
  }
}

/**
 * Calculates the 8 corners of a specific frustum slice in world space.
 * @param {THREE.PerspectiveCamera} camera Main camera
 * @param {number} near Near plane of the slice
 * @param {number} far Far plane of the slice
 * @param {Array<THREE.Vector3>} outCorners Array to store the 8 world space corners
 */
function getFrustumCornersWorld(camera, near, far, outCorners) {
  // Ensure camera matrix is up to date
  camera.updateMatrixWorld(true);

  const fov = camera.fov * Math.PI / 180;
  const aspect = camera.aspect;
  const nearHeight = 2 * Math.tan(fov / 2) * near;
  const nearWidth = nearHeight * aspect;
  const farHeight = 2 * Math.tan(fov / 2) * far;
  const farWidth = farHeight * aspect;

  // Calculate points on near and far planes in view space
  const nearTopLeft = new THREE.Vector3(-nearWidth / 2, nearHeight / 2, -near);
  const nearTopRight = new THREE.Vector3(nearWidth / 2, nearHeight / 2, -near);
  const nearBottomLeft = new THREE.Vector3(-nearWidth / 2, -nearHeight / 2, -near);
  const nearBottomRight = new THREE.Vector3(nearWidth / 2, -nearHeight / 2, -near);

  const farTopLeft = new THREE.Vector3(-farWidth / 2, farHeight / 2, -far);
  const farTopRight = new THREE.Vector3(farWidth / 2, farHeight / 2, -far);
  const farBottomLeft = new THREE.Vector3(-farWidth / 2, -farHeight / 2, -far);
  const farBottomRight = new THREE.Vector3(farWidth / 2, -farHeight / 2, -far);

  // Transform to world space
  const points = [nearTopLeft, nearTopRight, nearBottomLeft, nearBottomRight, farTopLeft, farTopRight, farBottomLeft, farBottomRight];
  for (let i = 0; i < 8; i++) {
    outCorners[i].copy(points[i]).applyMatrix4(camera.matrixWorld);
  }
}

/**
 * Manages Cascaded Shadow Mapping logic and data.
 */
class CSM {
  constructor(mainCamera, parentScene, parentGui, initialParams, initialUniforms) {
    this.mainCamera = mainCamera;
    this.parentScene = parentScene; // Needed to add helper cameras
    this.gui = parentGui;
    this.params = initialParams; // Reference to main params object
    this.uniforms = initialUniforms; // Reference to main uniforms object

    this.numCascades = NUM_CASCADES;
    this.cascadeSplits = []; // Stores { near, far } for each cascade in view space
    this.cascadeCameras = []; // Stores OrthographicCamera for each cascade
    this.cascadeMatrices = []; // Stores light view-projection matrices (for uniforms)
    this.shadowMapSize = 1024; // Default shadow map size, can be configured

    // Initialize cascade data structures
    for (let i = 0; i < this.numCascades; i++) {
      this.cascadeSplits.push({ near: 0, far: 0 });
      // Use more sensible near/far defaults for ortho cam
      const lightCamera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.01, 100);
      // Add camera helpers later if needed for debugging
      // this.parentScene.add(lightCamera);
      this.cascadeCameras.push(lightCamera);
      this.cascadeMatrices.push(new THREE.Matrix4());
    }

    // Initialize uniforms related to CSM
    this.uniforms.uCascadeSplits = { value: this.cascadeSplits.map(s => s.far) };
    this.uniforms.uCascadeMatrices = { value: this.cascadeMatrices };
    // Add shadow map size uniform (needed for stabilization and PCF)
    this.uniforms.uShadowMapSize = { value: new THREE.Vector2(this.shadowMapSize, this.shadowMapSize) };


    // Setup GUI
    this.setupGUI();

    // Initial calculation
    this.updateSettings(); // Calculate initial splits and cameras
  }

  setupGUI() {
    const csmFolder = this.gui.addFolder('CSM Settings');
    csmFolder.add(this.params.csm, 'splitScheme', ['linear', 'logarithmic', 'practical'])
      .name('Split Scheme').onChange(() => this.updateSettings());
    csmFolder.add(this.params.csm, 'lambda', 0, 1)
      .name('Lambda (Practical)').onChange(() => this.updateSettings());
    csmFolder.add(this.params.csm, 'autoUpdateLightCamera')
      .name('Auto Update Light Cam');
    // Add shadow map size control later if needed
    // csmFolder.add(this, 'shadowMapSize', [512, 1024, 2048]).name('Shadow Map Size').onChange(() => {
    //     this.uniforms.uShadowMapSize.value.set(this.shadowMapSize, this.shadowMapSize);
    //     this.updateSettings(); // Recalculate stabilization
    // });
    csmFolder.open();
  }

  updateSettings() {
    this.calculateSplits();
    // Update light cameras only if not auto-updating per frame,
    // or if settings like split scheme changed.
    if (!this.params.csm.autoUpdateLightCamera) {
      this.updateLightCameras(this.uniforms.uLightDirection.value);
    }
  }

  calculateSplits() {
    calculateCascadeSplits(
      this.numCascades,
      this.mainCamera.near,
      this.mainCamera.far,
      this.params.csm.splitScheme,
      this.params.csm.lambda,
      this.cascadeSplits
    );
    // Update the uniform with the far split distances (view space)
    this.uniforms.uCascadeSplits.value = this.cascadeSplits.map(split => split.far);
  }

  updateLightCameras(lightDirection) {
    frustumCenter.set(0, 0, 0); // Reset center

    for (let i = 0; i < this.numCascades; i++) {
      const cascadeNear = this.cascadeSplits[i].near;
      const cascadeFar = this.cascadeSplits[i].far;
      const lightCam = this.cascadeCameras[i];

      // 1. Get frustum corners for this cascade in world space
      getFrustumCornersWorld(this.mainCamera, cascadeNear, cascadeFar, frustumCornersWorld);

      // 2. Calculate the center of the frustum slice
      frustumCenter.set(0, 0, 0);
      for (const corner of frustumCornersWorld) {
        frustumCenter.add(corner);
      }
      frustumCenter.divideScalar(8);

      // 3. Position the light camera
      // Determine a suitable distance based on frustum size? For now, fixed offset.
      const lightDistance = 50; // Adjust as needed, should cover scene depth along light dir
      lightCam.position.copy(frustumCenter).addScaledVector(lightDirection, -lightDistance);
      lightTarget.copy(frustumCenter);
      lightCam.lookAt(lightTarget);
      lightCam.updateMatrixWorld(true);

      // 4. Find bounding box in light's view space
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;

      const lightViewMatrix = lightCam.matrixWorldInverse;
      for (const corner of frustumCornersWorld) {
        const cornerInLightView = corner.clone().applyMatrix4(lightViewMatrix);
        minX = Math.min(minX, cornerInLightView.x);
        maxX = Math.max(maxX, cornerInLightView.x);
        minY = Math.min(minY, cornerInLightView.y);
        maxY = Math.max(maxY, cornerInLightView.y);
        minZ = Math.min(minZ, cornerInLightView.z);
        maxZ = Math.max(maxZ, cornerInLightView.z);
      }

      // Add padding to avoid objects at the edge being clipped
      const padding = 1;
      minX -= padding; maxX += padding;
      minY -= padding; maxY += padding;
      // minZ -= padding; maxZ += padding; // Padding for Z might be less critical or handled by near/far

      // 5. Update orthographic projection
      lightCam.left = minX;
      lightCam.right = maxX;
      lightCam.top = maxY;
      lightCam.bottom = minY;

      // Adjust near/far to encompass the depth range in light space
      // Use a larger range initially, can be refined.
      // Near should be closer than the closest point (minZ), Far further than maxZ.
      lightCam.near = -(maxZ - minZ + lightDistance + 20); // Offset from maxZ towards light
      lightCam.far = lightDistance + 20; // Offset from minZ away from light

      // 6. Stabilize projection
      lightCam.updateProjectionMatrix(); // Update before stabilization
      shadowMatrixTmp.multiplyMatrices(lightCam.projectionMatrix, lightCam.matrixWorldInverse);

      // Project origin (0,0,0) into light clip space
      const projWorldOrigin = new THREE.Vector3(0, 0, 0).applyMatrix4(shadowMatrixTmp);
      const projWorldRounded = projWorldOrigin.clone();
      texelSize.set(1.0 / this.shadowMapSize, 1.0 / this.shadowMapSize);

      // Snap the projected origin to the nearest texel center in clip space (-1 to 1)
      // Clip space size is 2x2
      projWorldRounded.x = Math.round(projWorldRounded.x * this.shadowMapSize / 2) / (this.shadowMapSize / 2);
      projWorldRounded.y = Math.round(projWorldRounded.y * this.shadowMapSize / 2) / (this.shadowMapSize / 2);
      const projWorldOffset = projWorldRounded.clone().sub(projWorldOrigin);

      // Apply the offset to the projection matrix (pre-multiply)
      // This shifts the projection slightly to align with texels
      lightMatrix.makeTranslation(projWorldOffset.x, projWorldOffset.y, 0); // Use lightMatrix as temp
      lightCam.projectionMatrix.premultiply(lightMatrix);

      // 7. Update final projection matrix and combined light matrix uniform
      lightCam.updateProjectionMatrix(); // Final update after stabilization
      this.cascadeMatrices[i].multiplyMatrices(lightCam.projectionMatrix, lightCam.matrixWorldInverse);
      // Uniform is already referencing this.cascadeMatrices[i], no need to copy again
    }
  }

  // Call this method in the main animation loop
  update(lightDirection) {
    if (this.params.csm.autoUpdateLightCamera) {
      // Recalculate splits (camera near/far might change)
      this.calculateSplits();
      this.updateLightCameras(lightDirection);
    }
  }

  // Call this when main camera aspect ratio changes
  handleResize() {
    this.calculateSplits();
    this.updateLightCameras(this.uniforms.uLightDirection.value); // Use current light dir
  }

  // Call this when light direction param changes
  handleLightDirectionChange(newLightDirection) {
    if (!this.params.csm.autoUpdateLightCamera) {
      this.updateLightCameras(newLightDirection);
    }
    // If auto-update is on, the main loop's update() will handle it anyway
  }
}

export { CSM, NUM_CASCADES }; // Export the class and constant