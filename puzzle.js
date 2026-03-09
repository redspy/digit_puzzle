// ===========================
// State
// ===========================
const SIZE = 4;
let board = [];        // 1D array, 0 = empty
let tileElements = {}; // value -> DOM element
let emptyIndex = 15;
let moves = 0;
let seconds = 0;
let timerInterval = null;
let isAnimating = false;
let gameActive = false;

// Touch state
let touchStartX = 0;
let touchStartY = 0;

// ===========================
// DOM refs
// ===========================
const boardEl = document.getElementById('board');
const movesEl = document.getElementById('moves');
const timerEl = document.getElementById('timer');
const overlay = document.getElementById('overlay');
const resultMoves = document.getElementById('result-moves');
const resultTime = document.getElementById('result-time');

// ===========================
// Init
// ===========================
function init() {
  createTileElements();
  newGame();
  bindEvents();
}

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

// ===========================
// Game Logic
// ===========================
function newGame() {
  stopTimer();
  moves = 0;
  seconds = 0;
  isAnimating = false;
  movesEl.textContent = '0';
  timerEl.textContent = '00:00';
  overlay.classList.remove('show');
  gameActive = false;

  board = [...Array(15).keys()].map(i => i + 1);
  board.push(0);
  emptyIndex = 15;

  shuffle();
  renderBoard(false);
}

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

function getNeighbors(idx) {
  const row = Math.floor(idx / SIZE);
  const col = idx % SIZE;
  const result = [];
  if (row > 0) result.push(idx - SIZE);
  if (row < SIZE - 1) result.push(idx + SIZE);
  if (col > 0) result.push(idx - 1);
  if (col < SIZE - 1) result.push(idx + 1);
  return result;
}

function swap(a, b) {
  [board[a], board[b]] = [board[b], board[a]];
}

// ===========================
// Move Logic
// ===========================

// 클릭/탭한 타일 인덱스를 받아 이동 가능 여부 판단 후 처리
// - 빈칸과 같은 행 또는 열이면 사이의 모든 타일을 한꺼번에 이동
// - 같은 행/열이 아니면 무시
function handleTileClick(tileIndex) {
  if (isAnimating) return;
  if (board[tileIndex] === 0) return;

  const eRow = Math.floor(emptyIndex / SIZE);
  const eCol = emptyIndex % SIZE;
  const tRow = Math.floor(tileIndex / SIZE);
  const tCol = tileIndex % SIZE;

  // 이동할 타일들의 순서: 클릭한 타일 → 빈칸에 인접한 타일
  let sequence = [];

  if (tRow === eRow && tCol !== eCol) {
    // 같은 행: 좌우 이동
    const step = tCol < eCol ? 1 : -1;
    for (let c = tCol; c !== eCol; c += step) {
      sequence.push(tRow * SIZE + c);
    }
  } else if (tCol === eCol && tRow !== eRow) {
    // 같은 열: 상하 이동
    const step = tRow < eRow ? 1 : -1;
    for (let r = tRow; r !== eRow; r += step) {
      sequence.push(r * SIZE + tCol);
    }
  } else {
    return; // 이동 불가 위치
  }

  if (sequence.length === 0) return;

  // 게임 시작
  if (!gameActive) {
    gameActive = true;
    startTimer();
  }

  // 각 타일의 이동 목적지 계산 (보드 업데이트 전)
  // sequence[k] → sequence[k+1], 마지막 타일 → emptyIndex
  const destinations = sequence.map((_, k) =>
    k < sequence.length - 1 ? sequence[k + 1] : emptyIndex
  );

  // 보드 상태 업데이트 (빈칸 쪽부터 처리)
  for (let k = sequence.length - 1; k >= 0; k--) {
    board[destinations[k]] = board[sequence[k]];
  }
  board[sequence[0]] = 0;
  emptyIndex = sequence[0];

  moves += sequence.length;
  movesEl.textContent = moves;

  // 모든 타일 동시 애니메이션
  animateTiles(sequence, destinations);
}

// 방향키/스와이프: 빈칸 인접 타일 1개만 이동
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

// ===========================
// Rendering
// ===========================
function getTilePosition(idx) {
  const rect = boardEl.getBoundingClientRect();
  const style = getComputedStyle(boardEl);
  const gap = parseFloat(style.gap) || 8;
  const pad = parseFloat(style.padding) || 8;
  const size = (rect.width - pad * 2 - gap * 3) / SIZE;
  const col = idx % SIZE;
  const row = Math.floor(idx / SIZE);
  return {
    x: pad + col * (size + gap),
    y: pad + row * (size + gap),
    size,
  };
}

function renderBoard(animated = true) {
  const rect = boardEl.getBoundingClientRect();
  if (rect.width === 0) {
    requestAnimationFrame(() => renderBoard(animated));
    return;
  }

  if (!animated) {
    Object.values(tileElements).forEach(el => { el.style.transition = 'none'; });
  }

  for (let i = 0; i < board.length; i++) {
    const v = board[i];
    if (v === 0) continue;
    const el = tileElements[v];
    const { x, y, size } = getTilePosition(i);
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.style.fontSize = Math.floor(size * 0.38) + 'px';
  }

  if (!animated) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        Object.values(tileElements).forEach(el => { el.style.transition = ''; });
      });
    });
  }
}

function animateTiles(sequence, destinations) {
  isAnimating = true;
  let pending = sequence.length;

  // board는 이미 업데이트된 상태 → destinations[k]에 올바른 값이 있음
  sequence.forEach((fromIdx, k) => {
    const value = board[destinations[k]];
    const el = tileElements[value];
    el.classList.add('moving');

    const { x, y, size } = getTilePosition(destinations[k]);
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.style.fontSize = Math.floor(size * 0.38) + 'px';

    const done = () => {
      el.classList.remove('moving');
      pending--;
      if (pending === 0) {
        isAnimating = false;
        if (isSolved()) setTimeout(showWin, 150);
      }
    };

    const safetyTimer = setTimeout(done, 500);
    el.addEventListener('transitionend', () => {
      clearTimeout(safetyTimer);
      done();
    }, { once: true });
  });
}

function isSolved() {
  for (let i = 0; i < 15; i++) {
    if (board[i] !== i + 1) return false;
  }
  return board[15] === 0;
}

// ===========================
// Timer
// ===========================
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

function formatTime(s) {
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

// ===========================
// Win
// ===========================
function showWin() {
  stopTimer();
  gameActive = false;
  resultMoves.textContent = moves + '번';
  resultTime.textContent = formatTime(seconds);
  overlay.classList.add('show');
}

// ===========================
// Events
// ===========================
function bindEvents() {
  // 타일 클릭
  boardEl.addEventListener('click', (e) => {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    const value = parseInt(tile.textContent);
    const idx = board.indexOf(value);
    handleTileClick(idx);
  });

  // 키보드 방향키
  document.addEventListener('keydown', (e) => {
    const keyMap = {
      ArrowUp:    'up',
      ArrowDown:  'down',
      ArrowLeft:  'left',
      ArrowRight: 'right',
    };
    if (keyMap[e.key]) {
      e.preventDefault();
      moveDirKey(keyMap[e.key]);
    }
  });

  // 터치
  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const threshold = 30;

    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
      // 탭: 해당 타일 클릭 처리
      const el = document.elementFromPoint(
        e.changedTouches[0].clientX,
        e.changedTouches[0].clientY
      );
      const tile = el && el.closest('.tile');
      if (tile) {
        const value = parseInt(tile.textContent);
        const idx = board.indexOf(value);
        handleTileClick(idx);
      }
      return;
    }

    // 스와이프: 방향키와 동일하게 처리
    if (Math.abs(dx) > Math.abs(dy)) {
      moveDirKey(dx > 0 ? 'right' : 'left');
    } else {
      moveDirKey(dy > 0 ? 'down' : 'up');
    }
  }, { passive: true });

  // 버튼
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

  // 테마
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.body.className = `theme-${btn.dataset.theme}`;
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 화면 크기/방향 변경
  window.addEventListener('resize', () => renderBoard(false));
}

// ===========================
// Start
// ===========================
window.addEventListener('DOMContentLoaded', init);
