import * as THREE from 'three'

class PhongMaterial extends THREE.ShaderMaterial {
  constructor(options = {}) {
    const defaultColor = options.color || new THREE.Color(1, 1, 1);
    const shininess = options.shininess || 30.0;
    const specularColor = options.specularColor || new THREE.Color(1, 1, 1);

    super({
      vertexShader: /* glsl */`
        out vec3 vNormal;
        out vec3 vViewPosition;

        void main() {
          // 计算顶点位置
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          // 传递法线和视图位置到片段着色器
          vNormal = normalMatrix * normal;
          vViewPosition = -mvPosition.xyz;
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 diffuseColor;
        uniform vec3 specularColor;
        uniform float shininess;
        uniform vec3 lightDir;

        in vec3 vNormal;
        in vec3 vViewPosition;
        
        out vec4 fragColor;

        void main() {
          // 标准化向量
          vec3 normal = normalize(vNormal);
          vec3 lightDirection = normalize(lightDir);
          vec3 viewDirection = normalize(vViewPosition);
          
          // 计算漫反射
          float lambertian = max(dot(normal, lightDirection), 0.0);
          
          // 计算高光反射 (Blinn-Phong模型)
          vec3 halfVector = normalize(lightDirection + viewDirection);
          float specularIntensity = pow(max(dot(normal, halfVector), 0.0), shininess);
          
          // 环境光
          vec3 ambient = diffuseColor * 0.2;
          
          // 漫反射
          vec3 diffuse = diffuseColor * lambertian;
          
          // 高光
          vec3 specular = specularColor * specularIntensity;
          
          // 最终颜色
          vec3 finalColor = ambient + diffuse + specular;
          
          fragColor = vec4(finalColor, 1.0);
        }
      `,
      glslVersion: THREE.GLSL3,
      uniforms: {
        lightDir: {
          value: new THREE.Vector3(1, 1, 1).normalize() // 平行光默认方向
        },
        diffuseColor: {
          value: defaultColor // 漫反射颜色
        },
        specularColor: {
          value: specularColor // 高光颜色
        },
        shininess: {
          value: shininess // 高光亮度
        }
      }
    });
  }

  // 设置漫反射颜色
  setColor(color) {
    if (color instanceof THREE.Color) {
      this.uniforms.diffuseColor.value = color;
    } else {
      this.uniforms.diffuseColor.value = new THREE.Color(color);
    }
    return this;
  }

  // 设置高光颜色
  setSpecularColor(color) {
    if (color instanceof THREE.Color) {
      this.uniforms.specularColor.value = color;
    } else {
      this.uniforms.specularColor.value = new THREE.Color(color);
    }
    return this;
  }

  // 设置高光亮度
  setShininess(value) {
    this.uniforms.shininess.value = value;
    return this;
  }

  // 设置光源方向
  setLightDirection(direction) {
    if (direction instanceof THREE.Vector3) {
      this.uniforms.lightDir.value.copy(direction).normalize();
    } else {
      this.uniforms.lightDir.value.set(direction[0], direction[1], direction[2]).normalize();
    }
    return this;
  }
}

export { PhongMaterial }
