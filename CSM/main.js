import * as THREE from 'three'
import {
  OrbitControls
} from 'three/addons/controls/OrbitControls.js';
import { PhongMaterial } from './phong.js';
import { CSM } from './CSM.js';

class Viewer {
  constructor() {
    this.init()

    const animate = () => {
      requestAnimationFrame(animate)
      this.renderer.render(this.scene, this.camera)
      this.controls.update()
    }

    animate()
  }

  init() {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);
    camera.position.set(0, 5, 15);
    this.camera = camera;

    const controls = new OrbitControls(this.camera, renderer.domElement);

    this.controls = controls;
    this.renderer = renderer


    this.setupScene()

    this.onWindowResize();
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  createLight() {
    // 只需要一个平行光做测试
    this.lightDir = new THREE.Vector3(1, 1, 1)
  }

  setupScene() {
    this.scene = new THREE.Scene();

    // 创建地面
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new PhongMaterial();
    groundMaterial.setColor(0xffffff)
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // 旋转使其水平
    ground.position.y = -2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 创建柱子的材质
    const pillarMaterial = new PhongMaterial();
    pillarMaterial.setColor(0x888888)

    // 创建柱子几何体
    const pillarGeometry = new THREE.BoxGeometry(0.8, 3, 0.8);

    // 创建第一排柱子
    for (let i = 0; i < 8; i++) {
      const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
      pillar.position.set(-8 + i * 2.5, -0.5, -4);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.scene.add(pillar);
    }

    // 创建第二排柱子
    for (let i = 0; i < 8; i++) {
      const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
      pillar.position.set(-8 + i * 2.5, -0.5, 4);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.scene.add(pillar);
    }
  }


  onWindowResize() {

    const aspect = window.innerWidth / window.innerHeight;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);

  }
}

new Viewer()

window.csm = new CSM()