import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let waterMesh, pillarMesh, group;
let particles = [];
let targetWaterY = -2; // Default hidden level
let currentWaterY = -2;

// Standard Materials (More reliable than Toon for debugging)
const materialWater = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
});

const materialPillar = new THREE.MeshStandardMaterial({
    color: 0x9ca3af, // Light gray pillar
});

const materialBase = new THREE.MeshStandardMaterial({
    color: 0x374151, // Dark base
});

export function init3DScene(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Get true dimensions, fallback to 400 if not rendered yet
    const width = container.offsetWidth || container.clientWidth || 800;
    const height = container.offsetHeight || container.clientHeight || 400;

    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0fdfa); // Light cyan background

    // 2. Camera Setup
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(15, 10, 25);
    camera.lookAt(0, 0, 0);

    // 3. Renderer Setup
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; // Shadows back on
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0x3b82f6, 0.5);
    backLight.position.set(-10, 10, -10);
    scene.add(backLight);

    // 5. Objects
    group = new THREE.Group();
    scene.add(group);

    // Base Platform
    const baseGeo = new THREE.CylinderGeometry(5, 6, 1, 32);
    const base = new THREE.Mesh(baseGeo, materialBase);
    base.position.y = -4;
    base.receiveShadow = true;
    group.add(base);

    // Sensor Pillar (The "FloodBoy")
    const pillarGeo = new THREE.CylinderGeometry(1, 1, 15, 16);
    pillarMesh = new THREE.Mesh(pillarGeo, materialPillar);
    pillarMesh.position.y = 3;
    pillarMesh.castShadow = true;
    pillarMesh.receiveShadow = true;
    group.add(pillarMesh);

    // Water Surface
    const waterGeo = new THREE.CylinderGeometry(4.8, 4.8, 8, 32);
    waterMesh = new THREE.Mesh(waterGeo, materialWater);
    waterMesh.position.y = -4; // Start empty
    waterMesh.receiveShadow = true;
    group.add(waterMesh);

    // Anime tech vibe grid
    const gridHelper = new THREE.GridHelper(10, 10, 0x3b82f6, 0xe5e7eb);
    gridHelper.position.y = -3.99;
    scene.add(gridHelper);

    // Particles (Anime Magic Dust)
    const particleGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });

    for (let i = 0; i < 50; i++) {
        const p = new THREE.Mesh(particleGeometry, particleMaterial);
        p.position.set(
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 6
        );
        p.userData = {
            speed: Math.random() * 0.02 + 0.01,
            offset: Math.random() * Math.PI * 2
        };
        group.add(p);
        particles.push(p);
    }

    // 6. Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.1;
    controls.minDistance = 5;
    controls.maxDistance = 30;
    controls.target.set(0, 1, 0);

    // 7. Event Listeners
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                renderer.setSize(width, height);
            }
        }
    });
    resizeObserver.observe(container);

    renderer.render(scene, camera);

    // 8. Start Loop
    animate();
}

// Global function to be called from app.js
window.update3DWaterLevel = function (levelRaw) {
    let mappedY = -2 + (levelRaw * 4);
    mappedY = Math.max(-2, Math.min(mappedY, 4));
    targetWaterY = mappedY;
}

function animate() {
    requestAnimationFrame(animate);

    // Smoothly interpolate water level
    currentWaterY += (targetWaterY - currentWaterY) * 0.05;
    waterMesh.position.y = currentWaterY;

    // Pulse water scale slightly
    const time = Date.now() * 0.001;
    waterMesh.scale.x = 1 + Math.sin(time * 2) * 0.02;
    waterMesh.scale.z = 1 + Math.sin(time * 2) * 0.02;

    group.rotation.y += 0.002;

    particles.forEach(p => {
        p.position.y += p.userData.speed;
        p.position.x += Math.sin(time + p.userData.offset) * 0.01;
        if (p.position.y > 6) {
            p.position.y = -2;
        }
    });

    controls.update();
    renderer.render(scene, camera);
}

function onWindowResize() {
    const container = document.getElementById('three-container');
    if (!container) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}
