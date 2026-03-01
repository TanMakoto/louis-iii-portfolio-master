import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let waterMesh, pillarMesh, group;
let particles = [];
let targetWaterY = -2; // Default hidden level
let currentWaterY = -2;

// Toon Materials for Anime Look
const toonMaterialWater = new THREE.MeshToonMaterial({
    color: 0x3bb2f6, // Bright anime blue
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide
});

const toonMaterialPillar = new THREE.MeshToonMaterial({
    color: 0xe5e7eb, // Light gray pillar
});

const toonMaterialBase = new THREE.MeshToonMaterial({
    color: 0x4b5563, // Dark base
});

export function init3DScene(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f4f6); // Match UI background
    // Add subtle fog for depth
    scene.fog = new THREE.FogExp2(0xf3f4f6, 0.02);

    // 2. Camera Setup
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(8, 6, 12);

    // 3. Renderer Setup
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 4. Lighting (Anime style relies on strong directional + ambient)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Outline Light
    const backLight = new THREE.DirectionalLight(0x3b82f6, 0.5);
    backLight.position.set(-10, 10, -10);
    scene.add(backLight);

    // 5. Objects
    group = new THREE.Group();
    scene.add(group);

    // A. Base Platform
    const baseGeo = new THREE.CylinderGeometry(3, 3.5, 0.5, 32);
    const base = new THREE.Mesh(baseGeo, toonMaterialBase);
    base.position.y = -2;
    base.receiveShadow = true;
    group.add(base);

    // B. Sensor Pillar (The "FloodBoy")
    const pillarGeo = new THREE.CylinderGeometry(0.5, 0.5, 8, 16);
    pillarMesh = new THREE.Mesh(pillarGeo, toonMaterialPillar);
    pillarMesh.position.y = 2; // Rises from base
    pillarMesh.castShadow = true;
    pillarMesh.receiveShadow = true;
    group.add(pillarMesh);

    // C. Water Surface
    const waterGeo = new THREE.CylinderGeometry(2.8, 2.8, 4, 32);
    // We use a cylinder so it fits over the base
    waterMesh = new THREE.Mesh(waterGeo, toonMaterialWater);
    waterMesh.position.y = -2; // Start empty
    waterMesh.receiveShadow = true;
    group.add(waterMesh);

    // Add grid lines for anime tech vibe
    const gridHelper = new THREE.GridHelper(10, 10, 0x3b82f6, 0xe5e7eb);
    gridHelper.position.y = -1.99;
    scene.add(gridHelper);

    // D. Particles (Anime Magic Dust / Data)
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
    controls.maxPolarAngle = Math.PI / 2 - 0.1; // Don't go below ground
    controls.minDistance = 5;
    controls.maxDistance = 20;
    controls.target.set(0, 1, 0);

    // 7. Event Listeners
    window.addEventListener('resize', onWindowResize);

    // 8. Start Loop
    animate();
}

// Global function to be called from app.js
window.update3DWaterLevel = function (levelRaw) {
    // Determine mapping:
    // Let's say 0m = Y: -1.8 (bottom of pillar)
    // Let's say 1.0m = Y: +2.0 (high up the pillar)
    // Map linearly or use a visually appealing curve

    // Assume typical values are 0.4 - 0.6. Let's make 0m -> -2, 1m -> 2
    let mappedY = -2 + (levelRaw * 4);

    // Clamp values so it doesn't pop out weirdly
    mappedY = Math.max(-2, Math.min(mappedY, 4));

    targetWaterY = mappedY;
}

function animate() {
    requestAnimationFrame(animate);

    // Smoothly interpolate water level (Anime easing)
    currentWaterY += (targetWaterY - currentWaterY) * 0.05;
    waterMesh.position.y = currentWaterY;

    // Pulse water scale slightly for "breathing" effect
    const time = Date.now() * 0.001;
    waterMesh.scale.x = 1 + Math.sin(time * 2) * 0.02;
    waterMesh.scale.z = 1 + Math.sin(time * 2) * 0.02;

    // Rotate the whole group slowly
    group.rotation.y += 0.002;

    // Move particles
    particles.forEach(p => {
        p.position.y += p.userData.speed;
        p.position.x += Math.sin(time + p.userData.offset) * 0.01;

        if (p.position.y > 6) {
            p.position.y = -2; // Reset to bottom
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
