import * as THREE from 'three'


/**
 * 嘿嘿 关于CSM的一切
 */
class CSM {
  /**
   * 平均分割
   */
  uniformSplit(near, far, count) {
    const splits = [near];
    for (let i = 1; i <= count; i++) {
      splits.push(near + (far - near) * (i / count));
    }
    return splits;
  }

  /**
   * 草泥马分割
   */
  logarithmicSplit(near, far, count) {
    const splits = [near];
    for (let i = 1; i <= count; i++) {
      splits.push(near * Math.pow(far / near, i / count));
    }
    return splits;
  }

  practicalSplit(near, far, count, lambda = 0.5) {
    const uniformSplits = this.uniformSplit(near, far, count);
    const logSplits = this.logarithmicSplit(near, far, count);

    const splits = [near];
    for (let i = 1; i <= count; i++) {
      splits.push(
        lambda * logSplits[i] +
        (1 - lambda) * uniformSplits[i]
      );
    }
    return splits;
  }

  /**
   * 世界坐标-->光源矩阵
   * @param {THREE.Vector3} lightDir 
   * @param {THREE.Vector3[]} points 
   */
  getLightMatrixByworldCorners(
    points,
    lightDir
  ) {
    let averageX = 0,
      averageY = 0,
      averageZ = 0,
      len = points.length;
    for (let i = 0; i < len; i++) {
      averageX += points[i].x;
      averageY += points[i].y;
      averageZ += points[i].z;
    }

    averageX = averageX / len;
    averageY = averageY / len;
    averageZ = averageZ / len;

    const frustumCenter = new THREE.Vector3(averageX, averageY, averageZ);

    // 找到最远的那个距离
    let maxDistance = 0;

    for (let i = 0; i < len; i++) {
      maxDistance = Math.max(points[i].distanceTo(frustumCenter), maxDistance)
    }

    const distance = maxDistance
    // 虚拟的光源位置
    // 鲁棒性差
    const lightPosition = frustumCenter
      .clone()
      .add(lightDir.clone().multiplyScalar(-distance));

    // 构建观察矩阵
    const lightViewMatrix = new THREE.Matrix4().lookAt(
      lightPosition,
      frustumCenter,
      new THREE.Vector3(0, 1, 0)
    );

    // 对八个顶点坐标应用光源的观察矩阵，将其转换到光源的视图空间中
    const newPoints = [];
    for (let i = 0; i < len; i++) {
      const p = points[i];
      newPoints.push(p.clone().applyMatrix4(lightViewMatrix));
    }

    // 需要得到最小/最大，边界点
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;

    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (let i = 0; i < len; i++) {
      const newP = newPoints[i];
      minX = Math.min(newP.x, minX);
      minY = Math.min(newP.y, minY);
      minZ = Math.min(newP.z, minZ);

      maxX = Math.max(newP.x, maxX);
      maxY = Math.max(newP.y, maxY);
      maxZ = Math.max(newP.z, maxZ);
    }

    const lightOrthoMatrix = new THREE.Matrix4().makeOrthographic(
      minX,
      maxX,
      maxX,
      minY, // 尼玛，注意three的makeOrthographic函数签名，顺序不要错了
      minZ,
      maxZ
    );

    return {
      lightViewMatrix,
      lightOrthoMatrix,
    };
  }


  /**
   * 获取视锥体八个点的世界坐标
   * @param {THREE.Matrix4} projview 投影视图矩阵 proj*view
   * @param {number} [near=0] 近平面距离，范围[0,1]，0表示相机近平面
   * @param {number} [far=1] 远平面距离，范围[0,1]，1表示相机远平面
   * @returns {THREE.Vector3[]} 视锥体八个角点的世界坐标
   */
  getFrustumCornersWorldSpace(projview, near = 0, far = 1) {
    // 确保near和far在[0,1]范围内
    near = Math.max(0, Math.min(1, near));
    far = Math.max(0, Math.min(1, far));

    // 确保near <= far
    if (near > far) {
      [near, far] = [far, near];
    }

    // MVP矩阵得到NDC坐标，直接逆推可以得到世界坐标
    // m -> NDC坐标*inv(pv)
    const inv = copyMatrix4.copy(projview).invert();
    const frustumCorners = [];
    const point = new THREE.Vector4();

    // 计算近平面四个点
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        // 将z从[0,1]映射到[-1,1]空间
        const z = near * 2 - 1;
        point.set(2 * x - 1, 2 * y - 1, z, 1.0).applyMatrix4(inv);
        point.divideScalar(point.w);
        frustumCorners.push(new THREE.Vector3(point.x, point.y, point.z));
      }
    }

    // 计算远平面四个点
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        // 将z从[0,1]映射到[-1,1]空间
        const z = far * 2 - 1;
        point.set(2 * x - 1, 2 * y - 1, z, 1.0).applyMatrix4(inv);
        point.divideScalar(point.w);
        frustumCorners.push(new THREE.Vector3(point.x, point.y, point.z));
      }
    }

    return frustumCorners;
  }
}

export { CSM }