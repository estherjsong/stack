// =======================================================
// 3D Stacking Game Opt 2: 수직 낙하 및 물리 붕괴 로직 최종 보강 (잔여 속도 제거)
// =======================================================

// 3D 씬 및 물리 설정
let scene, camera, renderer, world;
let blocks = []; 
let score = 0;
let gameRunning = true;

// 시간 관리
let lastTime;
const timeStep = 1 / 60; 

// 블록 설정
const BLOCK_HEIGHT = 1; 
const INITIAL_WIDTH = 8; 
const INITIAL_DEPTH = 8; 
const SPEED = 0.15; 

// 왕복 최대 거리 설정
const MAX_TRAVEL_DISTANCE = 15; 

let direction = 1; 
let isMovingX = true; 

let currentBlock = null; 
let lastBlock = null; 

// DOM 요소
const scoreDisplay = document.getElementById('scoreDisplay');

// 초기화 함수
function init() {
    // 1. Three.js 설정 (동일)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); 
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(15, 20, 15); 
    camera.lookAt(0, 0, 0); 

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true; 
    document.body.appendChild(renderer.domElement);

    // 2. Lighting 설정 (동일)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(15, 40, 15);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // 3. Cannon.js 물리 세계 설정 (동일)
    world = new CANNON.World();
    world.gravity.set(0, -9.82, 0); 
    world.broadphase = new CANNON.NaiveBroadphase(); 
    world.allowSleep = true; 

    // 물리 재질 설정 (동일)
    const defaultMaterial = new CANNON.Material('default');
    const defaultContactMaterial = new CANNON.ContactMaterial(
        defaultMaterial,
        defaultMaterial,
        {
            friction: 0.4,    
            restitution: 0.05, 
        }
    );
    world.addContactMaterial(defaultContactMaterial);
    world.defaultContactMaterial = defaultContactMaterial;

    // 4. 이벤트 리스너 설정 (동일)
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }, false);
    
    document.addEventListener('click', handleStop);
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault(); 
            handleStop();
        }
    });

    // 5. 첫 블록 (바닥) 생성
    createFirstBlock();
    
    // 6. 게임 루프 시작
    animate();
}

// Three.js Mesh와 Cannon.js Body를 생성하고 연결하는 함수 (동일)
function addBlock(width, depth, x, y, z, color, mass) {
    const geometry = new THREE.BoxGeometry(width, BLOCK_HEIGHT, depth);
    const material = new THREE.MeshPhongMaterial({ color: color }); 
    const blockMesh = new THREE.Mesh(geometry, material);
    blockMesh.position.set(x, y, z);
    blockMesh.castShadow = true; 
    blockMesh.receiveShadow = true; 
    scene.add(blockMesh);

    const blockShape = new CANNON.Box(new CANNON.Vec3(width / 2, BLOCK_HEIGHT / 2, depth / 2));
    
    const bodyType = mass === 0 ? CANNON.Body.KINEMATIC : CANNON.Body.DYNAMIC; 
    
    const blockBody = new CANNON.Body({ mass: mass, shape: blockShape, type: bodyType }); 
    blockBody.position.set(x, y, z);
    world.addBody(blockBody);
    
    blockMesh.userData.physicsBody = blockBody; 
    blocks.push(blockMesh);
    
    return blockMesh;
}

// 첫 번째 블록 (바닥) 생성 (동일)
function createFirstBlock() {
    // 1. 물리 세계의 바닥 (Static Body)
    const floorMesh = addBlock(100, 100, 0, -BLOCK_HEIGHT / 2, 0, 0xaaaaaa, 0); 
    floorMesh.userData.physicsBody.type = CANNON.Body.STATIC;

    // 2. 탑의 실제 시작점 (Static Body)
    const baseBlockMesh = addBlock(INITIAL_WIDTH, INITIAL_DEPTH, 0, BLOCK_HEIGHT/2, 0, 0x555555, 0); 
    baseBlockMesh.userData.physicsBody.type = CANNON.Body.STATIC;
    lastBlock = baseBlockMesh;

    currentBlock = createNextBlock();
}

// 다음 움직이는 블록 생성
function createNextBlock() {
    // **Y 좌표 수정:** 탑 바로 위 (높이 + 5)에 생성
    const nextY = lastBlock.position.y + BLOCK_HEIGHT + 5; 
    
    isMovingX = !isMovingX; 
    
    const color = new THREE.Color(`hsl(${Math.random() * 360}, 70%, 50%)`).getHex();

    let startX = 0, startZ = 0;
    
    const limit = MAX_TRAVEL_DISTANCE; 
    
    if (isMovingX) {
        direction = Math.random() < 0.5 ? 1 : -1;
        startX = direction === 1 ? -limit : limit; 
        startZ = 0;
    } else {
        direction = Math.random() < 0.5 ? 1 : -1;
        startX = 0;
        startZ = direction === 1 ? -limit : limit; 
    }
    
    const nextMesh = addBlock(INITIAL_WIDTH, INITIAL_DEPTH, startX, nextY, startZ, color, 0);
    
    return nextMesh;
}

// 블록 정지 로직 (클릭 시, 중력 활성화)
function handleStop() {
    if (!gameRunning || !currentBlock) return;

    const currentBody = currentBlock.userData.physicsBody;
    
    // 1. Kinematic -> Dynamic 변환: 중력 활성화
    currentBody.mass = 2; // 질량 증가
    currentBody.type = CANNON.Body.DYNAMIC; 
    currentBody.updateMassProperties();
    
    // **핵심 수정**: 수평 이동 속도와 각속도를 0으로 만들어 수직 낙하만 강제하고, 공중 부양 현상 방지
    currentBody.velocity.set(0, 0, 0); // 모든 속도 초기화 (순수한 중력 낙하만 남김)
    currentBody.angularVelocity.set(0, 0, 0); // 회전 속도 초기화
    
    // 2. 점수 업데이트 및 다음 블록 준비
    score++;
    scoreDisplay.textContent = `점수: ${score}`;

    lastBlock = currentBlock; // 낙하를 시작한 블록을 lastBlock으로 설정
    currentBlock = createNextBlock();
    
    // 3. 카메라 이동
    scrollCamera();
}

// 카메라와 조명을 위로 스크롤하여 쌓이는 느낌 유지 (동일)
function scrollCamera() {
    const targetY = lastBlock.position.y + 10;
    const scrollSpeed = 0.05;

    camera.position.y += (targetY - camera.position.y) * scrollSpeed;
    camera.lookAt(0, lastBlock.position.y, 0); 

    scene.children.forEach(child => {
        if (child.isDirectionalLight) {
            child.position.y += (targetY - child.position.y + 30) * scrollSpeed;
        }
    });
}

// 게임 오버 조건 체크: 물리적 붕괴 또는 심한 기울임
function checkGameOver() {
    if (blocks.length < 3) return false;

    // 물리 세계의 바닥 (y = -0.5)
    const floorY = blocks[0].position.y; 
    
    for (const block of blocks) {
        const body = block.userData.physicsBody;
        
        if (body.type === CANNON.Body.DYNAMIC) { 
            
            // 1. 수직 이탈 (바닥 아래로 완전히 떨어졌을 때)
            // 블록 중심이 물리 세계 바닥보다 1.5 블록 높이 이상 아래로 내려가면 실패
            if (block.position.y < floorY - BLOCK_HEIGHT * 1.5) { 
                return true; 
            }
            
            // 2. 수평 이탈 (튕겨 나가 화면 밖으로 이탈)
            if (Math.abs(block.position.x) > 25 || Math.abs(block.position.z) > 25) {
                 return true; 
            }
        }
    }
    
    // 3. 심한 기울임 체크: 가장 최근에 쌓인 블록(lastBlock)의 기울임 체크
    if (lastBlock && lastBlock.userData.physicsBody.type === CANNON.Body.DYNAMIC) {
        const lastBody = lastBlock.userData.physicsBody;
        const rotationThreshold = 0.4; 
        
        const rotationX = Math.abs(lastBody.quaternion.x);
        const rotationZ = Math.abs(lastBody.quaternion.z);

        if (rotationX > rotationThreshold || rotationZ > rotationThreshold) {
            return true; 
        }
    }
    
    return false;
}

// 게임 루프
function animate(time) {
    if (!gameRunning) return;

    requestAnimationFrame(animate);

    // 물리 엔진 업데이트
    if (lastTime !== undefined) {
        const dt = (time - lastTime) / 1000;
        world.step(timeStep, dt);
    }
    lastTime = time;

    // 1. 움직이는 블록 강제 이동 (Kinematic Body만 해당)
    if (currentBlock && currentBlock.userData.physicsBody.type === CANNON.Body.KINEMATIC) {
        
        const limit = MAX_TRAVEL_DISTANCE; 
        
        if (isMovingX) {
            currentBlock.position.x += direction * SPEED;
            
            if (currentBlock.position.x > limit || currentBlock.position.x < -limit) {
                direction *= -1;
            }
        } else {
            currentBlock.position.z += direction * SPEED;
            
            if (currentBlock.position.z > limit || currentBlock.position.z < -limit) {
                direction *= -1;
            }
        }
        
        currentBlock.userData.physicsBody.position.copy(currentBlock.position);
    }
    
    // 2. Three.js 객체와 Cannon.js Body 동기화 (Dynamic/Static Body 모두)
    for (const mesh of blocks) {
        const body = mesh.userData.physicsBody;
        if (body.type === CANNON.Body.DYNAMIC || body.type === CANNON.Body.STATIC) { 
            mesh.position.copy(body.position);
            mesh.quaternion.copy(body.quaternion);
        }
    }

    // 3. 카메라 스크롤
    if (score > 0) {
        scrollCamera();
    }
    
    // 4. 게임 오버 체크
    if (checkGameOver()) {
        gameRunning = false;
        alert(`물리적 붕괴! Game Over! 최종 점수: ${score}`);
        return;
    }

    // 5. 렌더링
    renderer.render(scene, camera);
}

// 게임 시작
init();