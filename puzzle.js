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
  // Perform random valid moves to guarantee solvable state
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

function tryMove(tileIndex) {
  if (isAnimating) return;
  if (!getNeighbors(emptyIndex).includes(tileIndex)) return;

  if (!gameActive) {
    gameActive = true;
    startTimer();
  }

  const value = board[tileIndex];
  const destIndex = emptyIndex; // 이동 목적지(현재 빈칸 위치)를 미리 저장
  swap(tileIndex, emptyIndex);
  emptyIndex = tileIndex;
  moves++;
  movesEl.textContent = moves;

  animateTile(tileElements[value], tileIndex, destIndex);

  if (isSolved()) {
    setTimeout(showWin, 350);
  }
}

function isSolved() {
  for (let i = 0; i < 15; i++) {
    if (board[i] !== i + 1) return false;
  }
  return board[15] === 0;
}

// ===========================
// Rendering
// ===========================
function getTileSize() {
  const boardRect = boardEl.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(boardEl).gap) || 8;
  const padding = parseFloat(getComputedStyle(boardEl).padding) || 8;
  return (boardRect.width - padding * 2 - gap * 3) / SIZE;
}

function getTilePosition(idx) {
  const boardRect = boardEl.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(boardEl).gap) || 8;
  const padding = parseFloat(getComputedStyle(boardEl).padding) || 8;
  const size = (boardRect.width - padding * 2 - gap * 3) / SIZE;
  const col = idx % SIZE;
  const row = Math.floor(idx / SIZE);
  return {
    x: padding + col * (size + gap),
    y: padding + row * (size + gap),
    size,
  };
}

function renderBoard(animated = true) {
  const boardRect = boardEl.getBoundingClientRect();
  if (boardRect.width === 0) {
    requestAnimationFrame(() => renderBoard(animated));
    return;
  }

  if (!animated) {
    // Disable transitions for instant placement
    Object.values(tileElements).forEach(el => {
      el.style.transition = 'none';
    });
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
    // Re-enable transitions after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        Object.values(tileElements).forEach(el => {
          el.style.transition = '';
        });
      });
    });
  }
}

function animateTile(el, fromIdx, toIdx) {
  isAnimating = true;
  el.classList.add('moving');
  const { x, y } = getTilePosition(toIdx);
  el.style.transform = `translate(${x}px, ${y}px)`;

  // transitionend가 발생하지 않는 경우를 대비한 안전 타임아웃
  const safetyTimer = setTimeout(() => {
    el.classList.remove('moving');
    isAnimating = false;
  }, 500);

  el.addEventListener('transitionend', () => {
    clearTimeout(safetyTimer);
    el.classList.remove('moving');
    isAnimating = false;
  }, { once: true });
}


// ===========================
// Timer
// ===========================
function startTimer() {
  timerInterval = setInterval(() => {
    seconds++;
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
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
  // Tile click
  boardEl.addEventListener('click', (e) => {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    const value = parseInt(tile.textContent);
    const idx = board.indexOf(value);
    tryMove(idx);
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    const keyMap = {
      ArrowUp:    () => moveDirKey('up'),
      ArrowDown:  () => moveDirKey('down'),
      ArrowLeft:  () => moveDirKey('left'),
      ArrowRight: () => moveDirKey('right'),
    };
    if (keyMap[e.key]) {
      e.preventDefault();
      keyMap[e.key]();
    }
  });

  // Touch
  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const threshold = 30;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
      // Treat as tap — find tapped tile
      const el = document.elementFromPoint(
        e.changedTouches[0].clientX,
        e.changedTouches[0].clientY
      );
      const tile = el && el.closest('.tile');
      if (tile) {
        const value = parseInt(tile.textContent);
        const idx = board.indexOf(value);
        tryMove(idx);
      }
      return;
    }
    // Swipe: move the tile adjacent to empty in swipe direction
    if (Math.abs(dx) > Math.abs(dy)) {
      moveDirKey(dx > 0 ? 'right' : 'left');
    } else {
      moveDirKey(dy > 0 ? 'down' : 'up');
    }
  }, { passive: true });

  // Buttons
  document.getElementById('btn-new').addEventListener('click', newGame);
  document.getElementById('btn-shuffle').addEventListener('click', () => {
    stopTimer();
    shuffle();
    moves = 0;
    seconds = 0;
    movesEl.textContent = '0';
    timerEl.textContent = '00:00';
    gameActive = false;
    renderBoard(false);
  });
  document.getElementById('btn-play-again').addEventListener('click', newGame);

  // Theme
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      document.body.className = `theme-${theme}`;
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Resize / orientation
  window.addEventListener('resize', () => {
    renderBoard(false);
  });
}

// Keyboard: arrow key moves the tile INTO the empty space from that direction
// e.g. ArrowUp = move the tile BELOW the empty up into empty (empty moves down)
function moveDirKey(dir) {
  const eRow = Math.floor(emptyIndex / SIZE);
  const eCol = emptyIndex % SIZE;
  let targetIdx = -1;

  switch (dir) {
    case 'up':    if (eRow < SIZE - 1) targetIdx = emptyIndex + SIZE; break;
    case 'down':  if (eRow > 0)        targetIdx = emptyIndex - SIZE; break;
    case 'left':  if (eCol < SIZE - 1) targetIdx = emptyIndex + 1;    break;
    case 'right': if (eCol > 0)        targetIdx = emptyIndex - 1;    break;
  }
  if (targetIdx !== -1) tryMove(targetIdx);
}

// ===========================
// Start
// ===========================
window.addEventListener('DOMContentLoaded', init);
