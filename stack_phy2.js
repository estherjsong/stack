import * as THREE from "https://unpkg.com/three@0.152.2/build/three.module.js";
import * as CANNON from "https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js";

// =====================
// GLOBALS
// =====================
let scene, camera, renderer;
let world;

let blocks = [];
let currentBlock = null;
let fallingBlock = null;

let moveAxis = "x";
let moveDir = 1;

let score = 0;
let lastTopY = 0;

const BLOCK_SIZE = 6;
const MOVE_SPEED = 0.08;
const DROP_OFFSET = 5;

// =====================
// INIT
// =====================
init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf2f2f2);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(10, 12, 16);
    camera.lookAt(0, 2, 0);

    renderer = new THREE.WebGLRenderer({
        canvas: document.querySelector("canvas"),
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const light = new THREE.DirectionalLight(0xffffff, 0.6);
    light.position.set(10, 20, 10);
    scene.add(light);

    world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -15, 0)
    });

    createBaseBlock();
    createMovingBlock();

    window.addEventListener("click", dropBlock);
    window.addEventListener("keydown", e => {
        if (e.code === "Space") dropBlock();
    });
}

// =====================
// BLOCKS
// =====================
function createBaseBlock() {
    const h = 1;

    const mesh = createMesh(BLOCK_SIZE, h, BLOCK_SIZE, 0x888888);
    mesh.position.set(0, h / 2, 0);
    scene.add(mesh);

    const body = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(BLOCK_SIZE / 2, h / 2, BLOCK_SIZE / 2)),
        position: new CANNON.Vec3(0, h / 2, 0)
    });

    world.addBody(body);
    blocks.push({ mesh, body, height: h });
    lastTopY = h;
}

function createMovingBlock() {
    const height = 0.7 + Math.random() * 0.6;
    const y = lastTopY + DROP_OFFSET;

    moveAxis = Math.random() > 0.5 ? "x" : "z";
    moveDir = Math.random() > 0.5 ? 1 : -1;

    const mesh = createMesh(BLOCK_SIZE, height, BLOCK_SIZE);
    scene.add(mesh);

    const body = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.KINEMATIC,
        shape: new CANNON.Box(new CANNON.Vec3(BLOCK_SIZE / 2, height / 2, BLOCK_SIZE / 2)),
        position: new CANNON.Vec3(
            moveAxis === "x" ? -8 : 0,
            y,
            moveAxis === "z" ? -8 : 0
        )
    });

    world.addBody(body);
    currentBlock = { mesh, body, height };
}

// =====================
// GAME LOGIC
// =====================
function dropBlock() {
    if (!currentBlock || fallingBlock) return;

    const body = currentBlock.body;
    body.type = CANNON.Body.DYNAMIC;
    body.mass = currentBlock.height * 6;
    body.updateMassProperties();

    fallingBlock = currentBlock;
    currentBlock = null;
}

function moveCurrentBlock() {
    if (!currentBlock) return;

    const p = currentBlock.body.position;
    p[moveAxis] += MOVE_SPEED * moveDir;

    if (Math.abs(p[moveAxis]) > 8) moveDir *= -1;
}

function checkLanding() {
    if (!fallingBlock) return;

    const body = fallingBlock.body;
    const targetY = lastTopY + fallingBlock.height / 2;

    // ✅ 반드시 "아래까지 내려왔을 때만" 착지
    if (
        body.position.y <= targetY + 0.05 &&
        Math.abs(body.velocity.y) < 0.1
    ) {
        blocks.push(fallingBlock);
        lastTopY = body.position.y + fallingBlock.height / 2;
        fallingBlock = null;

        score++;
        document.getElementById("scoreDisplay").textContent = `점수: ${score}`;

        camera.position.y = lastTopY + 10;
        camera.lookAt(0, lastTopY, 0);

        createMovingBlock();
    }

    if (body.position.y < -10) gameOver();
}

function gameOver() {
    alert(`Game Over! 점수: ${score}`);
    location.reload();
}

// =====================
// LOOP
// =====================
function animate() {
    requestAnimationFrame(animate);

    moveCurrentBlock();
    world.step(1 / 60);

    blocks.forEach(sync);
    if (currentBlock) sync(currentBlock);
    if (fallingBlock) sync(fallingBlock);

    checkLanding();
    renderer.render(scene, camera);
}

// =====================
// HELPERS
// =====================
function sync(b) {
    b.mesh.position.copy(b.body.position);
    b.mesh.quaternion.copy(b.body.quaternion);
}

function createMesh(w, h, d, color) {
    return new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
            color: color ?? new THREE.Color().setHSL(Math.random(), 0.6, 0.55)
        })
    );
}
