
// 3D 씬 기본 설정
let scene, camera, renderer;
let blocks = []; // 쌓인 블록들 (Mesh 객체)
let currentBlock = null; // 현재 움직이는 블록 (Mesh 객체)
let lastBlock = null; // 바로 아래에 쌓인 블록
let score = 0;
let gameRunning = true;

// 블록 설정
const BLOCK_HEIGHT = 1; // 블록 높이 (단위)
const INITIAL_SIZE = 10; // 초기 블록 폭과 깊이 (단위)
const SPEED = 0.1; // 블록 이동 속도
let direction = 1; // 1: +X축, -1: -X축
let isMovingX = true; // X축(좌우)으로 이동 중

// DOM 요소
const scoreDisplay = document.getElementById('scoreDisplay');
const container = document.body;

// 초기화 함수
function init() {
    // 1. Scene 설정
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // 하늘색 배경

    // 2. Camera 설정
    // 원근 카메라 (Fov, Aspect, Near, Far)
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // 카메라 위치 설정 (쌓이는 블록 위에서 내려다보는 시점)
    camera.position.set(20, 30, 20); 
    camera.lookAt(0, 0, 0);

    // 3. Renderer 설정
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true; // 그림자 활성화
    container.appendChild(renderer.domElement);

    // 4. Lighting 설정
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // 은은한 주변광
    scene.add(ambientLight);
    
    // 방향 광 (그림자용)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(15, 40, 15);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // 5. 첫 블록 (바닥) 생성
    createFirstBlock();

    // 6. 이벤트 리스너 설정
    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('click', handleStop);
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            handleStop();
        }
    });

    // 7. 게임 루프 시작
    animate();
}

// 창 크기 조절 시 카메라 비율 업데이트
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// 블록 생성 함수
function createBlock(width, depth, x, y, z, color) {
    const geometry = new THREE.BoxGeometry(width, BLOCK_HEIGHT, depth);
    const material = new THREE.MeshPhongMaterial({ color: color }); // 빛을 받는 재질
    const block = new THREE.Mesh(geometry, material);
    
    block.position.set(x, y, z);
    block.castShadow = true; // 그림자 투사
    block.receiveShadow = true; // 그림자 받기
    
    return block;
}

// 첫 번째 블록 (바닥) 생성
function createFirstBlock() {
    // 바닥은 정지된 상태이므로 Direction은 0
    const firstBlock = createBlock(INITIAL_SIZE, INITIAL_SIZE, 0, -BLOCK_HEIGHT / 2, 0, 0xaaaaaa);
    scene.add(firstBlock);
    blocks.push(firstBlock);
    lastBlock = firstBlock;
    
    currentBlock = createNextBlock();
}

// 다음 움직이는 블록 생성
function createNextBlock() {
    const prevSize = { width: lastBlock.scale.x * INITIAL_SIZE, depth: lastBlock.scale.z * INITIAL_SIZE };
    const nextY = lastBlock.position.y + BLOCK_HEIGHT;
    
    // X축 이동, Z축 고정으로 시작 (번갈아 가며)
    isMovingX = !isMovingX; 
    
    // 색상 랜덤 설정
    const color = new THREE.Color(`hsl(${Math.random() * 360}, 70%, 50%)`).getHex();

    const nextBlock = createBlock(prevSize.width, prevSize.depth, 0, nextY, 0, color);

    // Scale을 이용하여 크기를 조절할 수 있도록 초기 크기를 1로 설정
    nextBlock.scale.set(lastBlock.scale.x, 1, lastBlock.scale.z);

    // 시작 위치 설정 (화면 밖)
    if (isMovingX) {
        // Z축(깊이)은 고정, X축(좌우)으로 이동
        direction = Math.random() < 0.5 ? 1 : -1;
        nextBlock.position.set(direction === 1 ? -INITIAL_SIZE : INITIAL_SIZE, nextY, lastBlock.position.z);
    } else {
        // X축(좌우)은 고정, Z축(깊이)으로 이동
        direction = Math.random() < 0.5 ? 1 : -1;
        nextBlock.position.set(lastBlock.position.x, nextY, direction === 1 ? -INITIAL_SIZE : INITIAL_SIZE);
    }
    
    scene.add(nextBlock);
    return nextBlock;
}

// 블록 정지 및 절단 로직 (3D 핵심)
function handleStop() {
    if (!gameRunning || !currentBlock) return;

    // 1. 겹치는 영역 계산
    const overlapStart = isMovingX ? 
        Math.max(currentBlock.position.x - currentBlock.geometry.parameters.width * currentBlock.scale.x / 2, 
                    lastBlock.position.x - lastBlock.geometry.parameters.width * lastBlock.scale.x / 2) :
        Math.max(currentBlock.position.z - currentBlock.geometry.parameters.depth * currentBlock.scale.z / 2, 
                    lastBlock.position.z - lastBlock.geometry.parameters.depth * lastBlock.scale.z / 2);
    
    const overlapEnd = isMovingX ?
        Math.min(currentBlock.position.x + currentBlock.geometry.parameters.width * currentBlock.scale.x / 2, 
                    lastBlock.position.x + lastBlock.geometry.parameters.width * lastBlock.scale.x / 2) :
        Math.min(currentBlock.position.z + currentBlock.geometry.parameters.depth * currentBlock.scale.z / 2, 
                    lastBlock.position.z + lastBlock.geometry.parameters.depth * lastBlock.scale.z / 2);
    
    const overlapWidth = overlapEnd - overlapStart;
    
    // 2. 겹치는 영역이 없으면 게임 오버
    if (overlapWidth <= 0.01) { // 부동 소수점 오차를 고려해 작은 값 사용
        gameRunning = false;
        alert(`Game Over! 최종 점수: ${score}`);
        return;
    }

    // 3. 겹치는 영역으로 블록 업데이트 (절단)
    const newScale = overlapWidth / INITIAL_SIZE; // 새 스케일 비율
    const newCenter = (overlapStart + overlapEnd) / 2; // 새 중앙 위치
    
    if (isMovingX) {
        currentBlock.scale.x = newScale;
        currentBlock.position.x = newCenter;
    } else {
        currentBlock.scale.z = newScale;
        currentBlock.position.z = newCenter;
    }
    
    // 4. 새 블록을 쌓인 블록 배열에 추가하고 점수 업데이트
    blocks.push(currentBlock);
    score++;
    scoreDisplay.textContent = `점수: ${score}`;

    // 5. 다음 블록 준비
    lastBlock = currentBlock;
    currentBlock = createNextBlock();
    
    // 6. 카메라 이동 (화면 중앙 유지)
    scrollCamera();
}

// 카메라와 조명을 위로 스크롤하여 쌓이는 느낌 유지
function scrollCamera() {
    const targetY = lastBlock.position.y + 10;
    const scrollSpeed = 0.05;

    // 카메라 위치 Y축을 부드럽게 이동
    camera.position.y += (targetY - camera.position.y) * scrollSpeed;
    
    // 카메라가 블록을 바라보도록 갱신 (LookAt)
    camera.lookAt(lastBlock.position.x, lastBlock.position.y, lastBlock.position.z);

    // 조명도 함께 이동 (그림자 유지)
    scene.children.forEach(child => {
        if (child.isDirectionalLight) {
            child.position.y += (targetY - child.position.y + 30) * scrollSpeed;
        }
    });
}

// 게임 루프
function animate() {
    if (!gameRunning) return;

    requestAnimationFrame(animate);

    // 1. 움직이는 블록 이동
    if (currentBlock) {
        if (isMovingX) {
            // X축 (좌우) 이동
            currentBlock.position.x += direction * SPEED;
            // 경계 체크
            if (currentBlock.position.x > INITIAL_SIZE || currentBlock.position.x < -INITIAL_SIZE) {
                direction *= -1;
            }
        } else {
            // Z축 (깊이) 이동
            currentBlock.position.z += direction * SPEED;
            // 경계 체크
            if (currentBlock.position.z > INITIAL_SIZE || currentBlock.position.z < -INITIAL_SIZE) {
                direction *= -1;
            }
        }
    }

    // 2. 카메라 스크롤 (부드러운 움직임을 위해 매 프레임 호출)
    if (score > 0) {
        scrollCamera();
    }

    // 3. 렌더링
    renderer.render(scene, camera);
}

// 게임 시작
init();