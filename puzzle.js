// ============================================================
// puzzle.js — Digit Puzzle 게임 로직
//
// 구조 개요:
//   1. 상태(State)          — 보드 배열, 빈칸 인덱스, 타이머 등
//   2. 초기화(Init)         — 타일 DOM 생성, 새 게임 시작
//   3. 게임 로직            — 셔플, 이웃 계산, 이동 처리
//   4. 렌더링               — 타일 위치 계산 및 배치
//   5. 애니메이션           — 슬라이딩 효과
//   6. 타이머               — 경과 시간 측정
//   7. 이벤트 바인딩        — 클릭·키보드·터치·리사이즈
// ============================================================


// ============================================================
// 1. 상태(State)
// ============================================================

const SIZE = 4; // 보드 한 변의 타일 수 (4×4)

// board: 길이 16의 1D 배열. 인덱스 = 보드 위치, 값 = 타일 숫자 (0 = 빈 칸)
// 예) [ 1,2,3,4, 5,6,7,8, 9,10,11,12, 13,14,15,0 ] = 완성 상태
let board = [];

// tileElements: 타일 숫자 → DOM 요소 매핑 (빠른 DOM 접근용)
let tileElements = {};

// emptyIndex: 현재 빈 칸의 보드 인덱스
let emptyIndex = 15;

let moves = 0;           // 누적 이동 횟수 (줄 이동 시 타일 수만큼 합산)
let seconds = 0;         // 경과 시간(초)
let timerInterval = null;// setInterval 핸들
let isAnimating = false; // 애니메이션 진행 중 여부 (중복 입력 방지)
let gameActive = false;  // 첫 이동 후 true (타이머 시작 기준)

// 터치 이벤트용 시작 좌표
let touchStartX = 0;
let touchStartY = 0;


// ============================================================
// 2. DOM 참조
// ============================================================

const boardEl     = document.getElementById('board');
const movesEl     = document.getElementById('moves');
const timerEl     = document.getElementById('timer');
const overlay     = document.getElementById('overlay');
const resultMoves = document.getElementById('result-moves');
const resultTime  = document.getElementById('result-time');


// ============================================================
// 3. 초기화(Init)
// ============================================================

function init() {
  createTileElements(); // 타일 DOM 요소 생성
  newGame();            // 보드 초기화 + 셔플
  bindEvents();         // 이벤트 리스너 등록
}

/**
 * 1~15 타일 DOM 요소를 생성하여 boardEl에 추가.
 * tileElements 맵에 (숫자 → 요소) 쌍으로 저장.
 */
function createTileElements() {
  boardEl.innerHTML = '';
  tileElements = {};
  for (let v = 1; v <= 15; v++) {
    const el = document.createElement('div');
    el.className = 'tile';
    el.textContent = v;
    boardEl.appendChild(el);
    tileElements[v] = el;
  }
}


// ============================================================
// 4. 게임 로직
// ============================================================

/**
 * 게임을 완전히 초기화하고 새로 시작.
 * - 타이머·카운터 리셋
 * - 완성 상태 배열 생성 후 셔플
 * - 보드 렌더링 (애니메이션 없이 즉시 배치)
 */
function newGame() {
  stopTimer();
  moves = 0;
  seconds = 0;
  isAnimating = false;
  movesEl.textContent = '0';
  timerEl.textContent = '00:00';
  overlay.classList.remove('show');
  gameActive = false;

  // 완성 상태: [1,2,...,15,0]
  board = [...Array(15).keys()].map(i => i + 1);
  board.push(0);
  emptyIndex = 15;

  shuffle();
  renderBoard(false); // 애니메이션 없이 즉시 배치
}

/**
 * 완성 상태에서 300회 유효 이동을 반복하여 랜덤하게 섞음.
 * 직전 빈 칸 위치(lastEmpty)는 제외하여 앞뒤로 왔다갔다 하는 패턴 방지.
 * → 항상 풀 수 있는(solvable) 배치 보장.
 */
function shuffle() {
  let lastEmpty = -1;
  for (let i = 0; i < 300; i++) {
    const neighbors = getNeighbors(emptyIndex).filter(n => n !== lastEmpty);
    const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
    lastEmpty = emptyIndex;
    swap(pick, emptyIndex);
    emptyIndex = pick;
  }
}

/**
 * 주어진 보드 인덱스의 상하좌우 인접 인덱스 배열 반환.
 * 보드 경계를 넘지 않는 인덱스만 포함.
 */
function getNeighbors(idx) {
  const row = Math.floor(idx / SIZE);
  const col = idx % SIZE;
  const result = [];
  if (row > 0)        result.push(idx - SIZE); // 위
  if (row < SIZE - 1) result.push(idx + SIZE); // 아래
  if (col > 0)        result.push(idx - 1);    // 왼쪽
  if (col < SIZE - 1) result.push(idx + 1);    // 오른쪽
  return result;
}

/** board 배열에서 두 인덱스의 값을 교환 */
function swap(a, b) {
  [board[a], board[b]] = [board[b], board[a]];
}

/**
 * 클릭/탭한 타일 인덱스를 받아 이동 가능 여부를 판단하고 처리.
 *
 * 이동 규칙:
 *   - 빈 칸과 같은 행: 사이의 모든 타일이 빈 칸 방향(좌/우)으로 동시 이동
 *   - 빈 칸과 같은 열: 사이의 모든 타일이 빈 칸 방향(상/하)으로 동시 이동
 *   - 행도 열도 아닌 경우: 무시
 *
 * 처리 순서:
 *   1. 이동할 타일 인덱스 시퀀스 생성 (클릭 타일 → 빈 칸 인접 타일 순)
 *   2. 각 타일의 목적지를 보드 업데이트 전에 저장
 *   3. board 배열 업데이트 (빈 칸 쪽부터 역순으로 처리하여 값 덮어쓰기)
 *   4. 모든 타일 동시 애니메이션
 */
function handleTileClick(tileIndex) {
  if (isAnimating) return;      // 애니메이션 중 입력 무시
  if (board[tileIndex] === 0) return; // 빈 칸 자체 클릭 무시

  const eRow = Math.floor(emptyIndex / SIZE);
  const eCol = emptyIndex % SIZE;
  const tRow = Math.floor(tileIndex / SIZE);
  const tCol = tileIndex % SIZE;

  // 이동 시퀀스: 클릭 타일부터 빈 칸 직전 타일까지의 인덱스 목록
  let sequence = [];

  if (tRow === eRow && tCol !== eCol) {
    // ── 같은 행: 수평 이동 ──────────────────────────────────────
    // step: 클릭 타일에서 빈 칸 방향(+1 = 오른쪽, -1 = 왼쪽)
    const step = tCol < eCol ? 1 : -1;
    for (let c = tCol; c !== eCol; c += step) {
      sequence.push(tRow * SIZE + c);
    }
  } else if (tCol === eCol && tRow !== eRow) {
    // ── 같은 열: 수직 이동 ──────────────────────────────────────
    // step: 클릭 타일에서 빈 칸 방향(+1 = 아래, -1 = 위)
    const step = tRow < eRow ? 1 : -1;
    for (let r = tRow; r !== eRow; r += step) {
      sequence.push(r * SIZE + tCol);
    }
  } else {
    return; // 이동 불가 위치: 무시
  }

  if (sequence.length === 0) return;

  // 첫 이동 시 타이머 시작
  if (!gameActive) {
    gameActive = true;
    startTimer();
  }

  // ── 목적지 계산 (보드 업데이트 전에 저장) ──────────────────────
  // sequence[k]의 타일은 sequence[k+1]로, 마지막 타일은 emptyIndex로 이동
  const destinations = sequence.map((_, k) =>
    k < sequence.length - 1 ? sequence[k + 1] : emptyIndex
  );

  // ── 보드 배열 업데이트 ──────────────────────────────────────────
  // 빈 칸 쪽(sequence 끝)부터 역순으로 처리하여 값을 덮어쓰지 않고 이동
  for (let k = sequence.length - 1; k >= 0; k--) {
    board[destinations[k]] = board[sequence[k]];
  }
  board[sequence[0]] = 0;   // 클릭한 타일 위치가 새 빈 칸
  emptyIndex = sequence[0]; // 빈 칸 인덱스 갱신

  // 이동 횟수 = 실제 이동한 타일 수
  moves += sequence.length;
  movesEl.textContent = moves;

  // ── 애니메이션 실행 ─────────────────────────────────────────────
  animateTiles(sequence, destinations);
}

/**
 * 방향키 또는 스와이프로 인접 타일 1개 이동.
 * 방향 해석: 키 방향 = 빈 칸의 이동 방향 (누르는 방향으로 빈 칸이 이동)
 *   ↑ → 빈 칸 아래 타일이 빈 칸으로 올라옴 (emptyIndex + SIZE)
 *   ↓ → 빈 칸 위 타일이 빈 칸으로 내려옴 (emptyIndex - SIZE)
 *   ← → 빈 칸 오른쪽 타일이 왼쪽으로 이동 (emptyIndex + 1)
 *   → → 빈 칸 왼쪽 타일이 오른쪽으로 이동 (emptyIndex - 1)
 */
function moveDirKey(dir) {
  if (isAnimating) return;
  const eRow = Math.floor(emptyIndex / SIZE);
  const eCol = emptyIndex % SIZE;
  let targetIdx = -1;

  switch (dir) {
    case 'up':    if (eRow < SIZE - 1) targetIdx = emptyIndex + SIZE; break;
    case 'down':  if (eRow > 0)        targetIdx = emptyIndex - SIZE; break;
    case 'left':  if (eCol < SIZE - 1) targetIdx = emptyIndex + 1;    break;
    case 'right': if (eCol > 0)        targetIdx = emptyIndex - 1;    break;
  }
  if (targetIdx !== -1) handleTileClick(targetIdx);
}

/**
 * 완성 여부 확인.
 * board[0~14] === 1~15 이고 board[15] === 0 이면 완성.
 */
function isSolved() {
  for (let i = 0; i < 15; i++) {
    if (board[i] !== i + 1) return false;
  }
  return board[15] === 0;
}


// ============================================================
// 5. 렌더링
// ============================================================

/**
 * 보드 인덱스 → 타일의 픽셀 위치(x, y) 및 크기(size) 계산.
 * boardEl의 실제 렌더링 크기를 기준으로 gap·padding을 반영.
 */
function getTilePosition(idx) {
  const rect  = boardEl.getBoundingClientRect();
  const style = getComputedStyle(boardEl);
  const gap   = parseFloat(style.gap)     || 8;
  const pad   = parseFloat(style.padding) || 8;
  // 타일 1개의 크기: (전체 너비 - 양쪽 패딩 - 3개의 gap) / 4
  const size  = (rect.width - pad * 2 - gap * 3) / SIZE;
  const col   = idx % SIZE;
  const row   = Math.floor(idx / SIZE);
  return {
    x: pad + col * (size + gap),
    y: pad + row * (size + gap),
    size,
  };
}

/**
 * 전체 보드를 현재 board 배열 상태에 맞게 렌더링.
 * animated = false: transition을 일시 비활성화하여 즉시 배치 (게임 시작·리셋·리사이즈 시)
 * animated = true : transition 활성화 상태로 렌더링 (일반적으로 사용 안 함)
 */
function renderBoard(animated = true) {
  const rect = boardEl.getBoundingClientRect();
  // boardEl이 아직 화면에 렌더링되지 않은 경우 다음 프레임에 재시도
  if (rect.width === 0) {
    requestAnimationFrame(() => renderBoard(animated));
    return;
  }

  if (!animated) {
    // transition 비활성화 → 위치 즉시 적용
    Object.values(tileElements).forEach(el => { el.style.transition = 'none'; });
  }

  for (let i = 0; i < board.length; i++) {
    const v = board[i];
    if (v === 0) continue; // 빈 칸은 DOM 요소 없음
    const el = tileElements[v];
    const { x, y, size } = getTilePosition(i);
    el.style.width     = size + 'px';
    el.style.height    = size + 'px';
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.style.fontSize  = Math.floor(size * 0.38) + 'px';
  }

  if (!animated) {
    // 두 프레임 후 transition 재활성화 (즉시 활성화 시 의도치 않은 애니메이션 방지)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        Object.values(tileElements).forEach(el => { el.style.transition = ''; });
      });
    });
  }
}


// ============================================================
// 6. 애니메이션
// ============================================================

/**
 * 여러 타일을 동시에 목적지로 슬라이딩 애니메이션.
 *
 * @param {number[]} sequence    - 이동할 타일들의 현재(출발) 인덱스 배열
 * @param {number[]} destinations - 각 타일의 목적지 인덱스 배열 (sequence와 1:1 대응)
 *
 * 동작:
 *   - board는 이미 업데이트된 상태이므로 board[destinations[k]] = 이동된 타일 값
 *   - 모든 타일에 CSS transform 적용 → 동시 슬라이딩
 *   - pending 카운터로 모든 타일의 transitionend 완료를 추적
 *   - transitionend 미발생 시 500ms 안전 타임아웃으로 isAnimating 강제 해제
 */
function animateTiles(sequence, destinations) {
  isAnimating = true;
  let pending = sequence.length; // 아직 애니메이션이 끝나지 않은 타일 수

  sequence.forEach((fromIdx, k) => {
    // board가 업데이트된 후이므로 destinations[k]에 올바른 값이 있음
    const value = board[destinations[k]];
    const el    = tileElements[value];
    el.classList.add('moving');

    // 목적지 위치로 transform 이동 → CSS transition이 슬라이딩 효과 생성
    const { x, y, size } = getTilePosition(destinations[k]);
    el.style.width     = size + 'px';
    el.style.height    = size + 'px';
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.style.fontSize  = Math.floor(size * 0.38) + 'px';

    // 한 타일의 애니메이션 완료 처리
    const done = () => {
      el.classList.remove('moving');
      pending--;
      if (pending === 0) {
        // 모든 타일 이동 완료
        isAnimating = false;
        if (isSolved()) setTimeout(showWin, 150);
      }
    };

    // 안전 타임아웃: transitionend가 발생하지 않아도 500ms 후 강제 해제
    // (예: 거리가 매우 짧거나 브라우저가 transition을 생략한 경우)
    const safetyTimer = setTimeout(done, 500);

    el.addEventListener('transitionend', () => {
      clearTimeout(safetyTimer);
      done();
    }, { once: true }); // { once: true } → 1회 실행 후 자동 제거
  });
}


// ============================================================
// 7. 타이머
// ============================================================

/** 1초 간격으로 seconds 증가, 화면에 MM:SS 형식으로 표시 */
function startTimer() {
  timerInterval = setInterval(() => {
    seconds++;
    timerEl.textContent = formatTime(seconds);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

/** 초 단위 정수 → "MM:SS" 문자열 변환 */
function formatTime(s) {
  const m   = String(Math.floor(s / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
}


// ============================================================
// 8. 완성 처리
// ============================================================

function showWin() {
  stopTimer();
  gameActive = false;
  resultMoves.textContent = moves + '번';
  resultTime.textContent  = formatTime(seconds);
  overlay.classList.add('show');
}


// ============================================================
// 9. 이벤트 바인딩
// ============================================================

function bindEvents() {

  // ── 타일 클릭 ──────────────────────────────────────────────
  boardEl.addEventListener('click', (e) => {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    const value = parseInt(tile.textContent);
    const idx   = board.indexOf(value);
    handleTileClick(idx);
  });

  // ── 키보드 방향키 ───────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    const keyMap = {
      ArrowUp: 'up', ArrowDown: 'down',
      ArrowLeft: 'left', ArrowRight: 'right',
    };
    if (keyMap[e.key]) {
      e.preventDefault(); // 페이지 스크롤 방지
      moveDirKey(keyMap[e.key]);
    }
  });

  // ── 터치 이벤트 ─────────────────────────────────────────────
  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const threshold = 30; // px 이하면 탭으로 판단

    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
      // ── 탭: 해당 위치의 타일을 클릭과 동일하게 처리 ──────
      const el   = document.elementFromPoint(
        e.changedTouches[0].clientX,
        e.changedTouches[0].clientY
      );
      const tile = el && el.closest('.tile');
      if (tile) {
        const value = parseInt(tile.textContent);
        const idx   = board.indexOf(value);
        handleTileClick(idx);
      }
      return;
    }

    // ── 스와이프: 더 큰 축의 방향으로 인접 타일 1개 이동 ──
    if (Math.abs(dx) > Math.abs(dy)) {
      moveDirKey(dx > 0 ? 'right' : 'left');
    } else {
      moveDirKey(dy > 0 ? 'down' : 'up');
    }
  }, { passive: true });

  // ── 버튼 ────────────────────────────────────────────────────
  document.getElementById('btn-new').addEventListener('click', newGame);

  document.getElementById('btn-shuffle').addEventListener('click', () => {
    stopTimer();
    isAnimating = false;
    shuffle();
    moves = 0;
    seconds = 0;
    movesEl.textContent = '0';
    timerEl.textContent = '00:00';
    gameActive = false;
    renderBoard(false);
  });

  document.getElementById('btn-play-again').addEventListener('click', newGame);

  // ── 테마 전환 ───────────────────────────────────────────────
  // body의 클래스를 교체하면 CSS 변수가 자동으로 전환됨
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.body.className = `theme-${btn.dataset.theme}`;
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // ── 화면 크기·방향 변경 ─────────────────────────────────────
  // 보드 DOM 크기가 바뀌므로 타일 위치를 애니메이션 없이 즉시 재계산
  window.addEventListener('resize', () => renderBoard(false));
}


// ============================================================
// 10. 진입점
// ============================================================

window.addEventListener('DOMContentLoaded', init);
