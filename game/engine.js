import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Game Constants
const GRID_SIZE = 10;
const CELL_SIZE = 2;
const OFFSET = (GRID_SIZE * CELL_SIZE) / 2 - CELL_SIZE / 2;

let scene, camera, renderer, controls;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let gridTiles = [];
let towers = [];
let enemies = [];
let particles = [];

// Game State
let gameState = {
    lives: 20,
    coins: 100,
    wave: 0,
    isWaveActive: false,
    selectedTowerType: 'basic'
};

// Colors
const COLORS = {
    grid: 0x1e293b,
    gridHover: 0x38bdf8,
    towerBasic: 0x3b82f6,
    enemy: 0xf43f5e,
    path: 0x0f172a
};

function init() {
    // 1. Scene & Camera
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    scene.fog = new THREE.FogExp2(0x020617, 0.02);

    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(20, 20, 20);
    camera.lookAt(0, 0, 0);

    // 2. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-container').appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(10, 20, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    // 4. Grid
    createGrid();

    // 5. OrbitControls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 10;
    controls.maxDistance = 50;

    // 6. Listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onMouseClick);

    document.querySelectorAll('.tower-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.currentTarget.dataset.type;
            gameState.selectedTowerType = type;
            document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });

    document.getElementById('start-wave-btn').addEventListener('click', startWave);

    animate();
}

function createGrid() {
    const geometry = new THREE.BoxGeometry(CELL_SIZE - 0.1, 0.2, CELL_SIZE - 0.1);

    for (let x = 0; x < GRID_SIZE; x++) {
        for (let z = 0; z < GRID_SIZE; z++) {
            const material = new THREE.MeshStandardMaterial({
                color: COLORS.grid,
                transparent: true,
                opacity: 0.6
            });
            const tile = new THREE.Mesh(geometry, material);
            tile.position.set(x * CELL_SIZE - OFFSET, 0, z * CELL_SIZE - OFFSET);
            tile.receiveShadow = true;
            tile.userData = { x, z, hasTower: false };
            scene.add(tile);
            gridTiles.push(tile);
        }
    }

    // Path visual (simplistic straight path for now)
    gridTiles.forEach(tile => {
        if (tile.userData.x === 0 || tile.userData.z === 5) {
            tile.userData.isPath = true;
            tile.material.color.set(COLORS.path);
            tile.material.opacity = 0.9;
        }
    });

    // JIB Node (The Base)
    const baseGeo = new THREE.BoxGeometry(CELL_SIZE, 3, CELL_SIZE);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x39c5bb, emissive: 0x39c5bb, emissiveIntensity: 0.5 });
    const baseNode = new THREE.Mesh(baseGeo, baseMat);
    baseNode.position.set(GRID_SIZE * CELL_SIZE - OFFSET - CELL_SIZE, 1.5, 5 * CELL_SIZE - OFFSET);
    scene.add(baseNode);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(gridTiles);

    gridTiles.forEach(t => {
        if (!t.userData.isPath) t.material.color.set(COLORS.grid);
    });

    if (intersects.length > 0) {
        const tile = intersects[0].object;
        if (!tile.userData.isPath && !tile.userData.hasTower) {
            tile.material.color.set(COLORS.gridHover);
        }
    }
}

function onMouseClick() {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(gridTiles);

    if (intersects.length > 0) {
        const tile = intersects[0].object;
        if (!tile.userData.isPath && !tile.userData.hasTower) {
            placeTower(tile);
        }
    }
}

function placeTower(tile) {
    const cost = getTowerCost(gameState.selectedTowerType);
    if (gameState.coins >= cost) {
        gameState.coins -= cost;
        updateUI();

        const towerGeo = new THREE.CylinderGeometry(0.5, 0.8, 2, 8);
        const towerMat = new THREE.MeshStandardMaterial({ color: COLORS.towerBasic });
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.set(tile.position.x, 1, tile.position.z);
        tower.castShadow = true;
        scene.add(tower);

        towers.push({
            mesh: tower,
            type: gameState.selectedTowerType,
            range: 5,
            damage: 10,
            cooldown: 0,
            maxCooldown: 30
        });

        tile.userData.hasTower = true;
    } else {
        showMsg("NOT ENOUGH JIB!");
    }
}

function getTowerCost(type) {
    switch (type) {
        case 'heavy': return 60;
        case 'slow': return 40;
        default: return 25;
    }
}

function updateUI() {
    document.getElementById('lives-val').textContent = gameState.lives;
    document.getElementById('coins-val').textContent = gameState.coins;
}

function showMsg(text) {
    const overlay = document.getElementById('msg-overlay');
    const msgText = document.getElementById('msg-text');
    msgText.textContent = text;
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.add('hidden'), 2000);
}

function startWave() {
    if (gameState.isWaveActive) return;
    gameState.wave++;
    gameState.isWaveActive = true;
    showMsg(`WAVE ${gameState.wave}`);

    // Spawn enemies based on wave number
    for (let i = 0; i < 5 + gameState.wave; i++) {
        setTimeout(() => spawnEnemy(), i * 1000);
    }
}

function spawnEnemy() {
    const geo = new THREE.SphereGeometry(0.5, 8, 8);
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.enemy, emissive: COLORS.enemy, emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);

    // Start at beginning of path (0, 0) in grid coords
    mesh.position.set(0 * CELL_SIZE - OFFSET, 0.5, 5 * CELL_SIZE - OFFSET);
    scene.add(mesh);

    enemies.push({
        mesh: mesh,
        health: 20 + (gameState.wave * 10),
        speed: 0.05 + (Math.random() * 0.02),
        pathIndex: 0
    });
}

function animate() {
    requestAnimationFrame(animate);

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.mesh.position.x += e.speed;

        // Check if reached JIB Node
        if (e.mesh.position.x > GRID_SIZE * CELL_SIZE - OFFSET - CELL_SIZE) {
            gameState.lives--;
            updateUI();
            scene.remove(e.mesh);
            enemies.splice(i, 1);
            if (gameState.lives <= 0) showMsg("GAME OVER");
            continue;
        }

        // Tower logic
        towers.forEach(t => {
            if (t.cooldown <= 0) {
                const dist = t.mesh.position.distanceTo(e.mesh.position);
                if (dist < t.range) {
                    shoot(t, e);
                    t.cooldown = t.maxCooldown;
                }
            }
        });
    }

    towers.forEach(t => { if (t.cooldown > 0) t.cooldown--; });

    // Way to detect wave end
    if (gameState.isWaveActive && enemies.length === 0) {
        gameState.isWaveActive = false;
        gameState.coins += 50; // Wave bonus
        updateUI();
    }

    controls.update();
    renderer.render(scene, camera);
}

function shoot(tower, enemy) {
    enemy.health -= tower.damage;

    // Simple laser effect
    const points = [tower.mesh.position.clone(), enemy.mesh.position.clone()];
    points[0].y += 1;
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
    const line = new THREE.Line(lineGeo, lineMat);
    scene.add(line);
    setTimeout(() => scene.remove(line), 100);

    if (enemy.health <= 0) {
        const index = enemies.indexOf(enemy);
        if (index > -1) {
            scene.remove(enemy.mesh);
            enemies.splice(index, 1);
            gameState.coins += 10;
            updateUI();
        }
    }
}

init();
