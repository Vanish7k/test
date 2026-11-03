const DIFFICULTIES = {
  easy: { label: '简单', desc: '轻松热身' },
  medium: { label: '中等', desc: '动脑时刻' },
  hard: { label: '困难', desc: '深度专注' },
  expert: { label: '专家', desc: '线索极少' },
};

const STORE_KEY = 'paper-sudoku:v1';
const BEST_KEY = 'paper-sudoku:bests:v1';
const LEADERBOARD_KEY = 'paper-sudoku:leaderboard:v1';
const NICK_KEY = 'paper-sudoku:nickname:v1';
const LEADERBOARD_MAX = 10;
const HINT_LIMIT = 3;

const ICONS = {
  pause: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>',
  play: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5 19 12 8 18.5Z"/></svg>',
};

const boardEl = document.getElementById('board');
const padEl = document.getElementById('pad');
const diffListEl = document.getElementById('diffList');
const diffChipEl = document.getElementById('diffChip');
const timerEl = document.getElementById('timer');
const mistakesEl = document.getElementById('mistakes');
const hintsLeftEl = document.getElementById('hintsLeft');
const hintBadgeEl = document.getElementById('hintBadge');
const undoBtn = document.getElementById('undoBtn');
const eraseBtn = document.getElementById('eraseBtn');
const notesBtn = document.getElementById('notesBtn');
const hintBtn = document.getElementById('hintBtn');
const pauseBtn = document.getElementById('pauseBtn');
const newBtn = document.getElementById('newBtn');
const pauseOverlay = document.getElementById('pauseOverlay');
const winOverlay = document.getElementById('winOverlay');
const winStatsEl = document.getElementById('winStats');
const winBestEl = document.getElementById('winBest');
const resumeBtn = document.getElementById('resumeBtn');
const winNewBtn = document.getElementById('winNewBtn');
const winCloseBtn = document.getElementById('winCloseBtn');
const newOverlay = document.getElementById('newOverlay');
const cancelNewBtn = document.getElementById('cancelNewBtn');
const startNewBtn = document.getElementById('startNewBtn');
const toastEl = document.getElementById('toast');
const liveEl = document.getElementById('live');
const missingBarEl = document.getElementById('missingBar');
const missingRowEl = document.getElementById('missingRow');
const missingColEl = document.getElementById('missingCol');
const missingBoxEl = document.getElementById('missingBox');
const missingRowItemEl = document.getElementById('missingRowItem');
const missingColItemEl = document.getElementById('missingColItem');
const missingBoxItemEl = document.getElementById('missingBoxItem');
const updateBarEl = document.getElementById('updateBar');
const updateBtnEl = document.getElementById('updateBtn');
const updateDismissEl = document.getElementById('updateDismiss');

const leaderBtn = document.getElementById('leaderBtn');
const leaderOverlay = document.getElementById('leaderOverlay');
const leaderTabsEl = document.getElementById('leaderTabs');
const leaderListEl = document.getElementById('leaderList');
const leaderEmptyEl = document.getElementById('leaderEmpty');
const leaderCloseBtn = document.getElementById('leaderCloseBtn');
const leaderClearBtn = document.getElementById('leaderClearBtn');
const winRankEl = document.getElementById('winRank');
const winShareBtn = document.getElementById('winShareBtn');
const winGlobalEl = document.getElementById('winGlobal');
const winNickEl = document.getElementById('winNick');
const winSubmitBtn = document.getElementById('winSubmitBtn');
const winGlobalMsgEl = document.getElementById('winGlobalMsg');
const leaderScopeEl = document.getElementById('leaderScope');
const scopeGlobalBtn = document.getElementById('scopeGlobalBtn');
const leaderGamesEl = document.getElementById('leaderGames');
const leaderSubEl = document.getElementById('leaderSub');
const nickRowEl = document.getElementById('nickRow');
const nickInputEl = document.getElementById('nickInput');
const nickSaveBtn = document.getElementById('nickSaveBtn');

const cells = [];
const padButtons = [];

let state = null;
let modalOpen = false;
let sheetDifficulty = 'easy';
let leaderDifficulty = 'easy';
let leaderScope = 'local';
let leaderGame = 'sudoku';
let toastTimer = 0;
let saveTick = 0;
let leaderAutoPaused = false;

const PEERS = buildPeerMap();

function buildPeerMap() {
  return Array.from({ length: 81 }, (_, index) => {
    const row = Math.floor(index / 9);
    const col = index % 9;
    const peers = new Set();
    for (let c = 0; c < 9; c += 1) peers.add(row * 9 + c);
    for (let r = 0; r < 9; r += 1) peers.add(r * 9 + col);
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = boxRow; r < boxRow + 3; r += 1) {
      for (let c = boxCol; c < boxCol + 3; c += 1) peers.add(r * 9 + c);
    }
    peers.delete(index);
    return [...peers];
  });
}

function isPeer(a, b) {
  const rowA = Math.floor(a / 9);
  const colA = a % 9;
  const rowB = Math.floor(b / 9);
  const colB = b % 9;
  return (
    rowA === rowB ||
    colA === colB ||
    (Math.floor(rowA / 3) === Math.floor(rowB / 3) &&
      Math.floor(colA / 3) === Math.floor(colB / 3))
  );
}

function formatTime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (value) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
}

function elapsedSeconds() {
  if (!state) return 0;
  const running = state.runStart ? Date.now() - state.runStart : 0;
  return Math.floor((state.elapsedMs + running) / 1000);
}

function startRun() {
  if (!state || state.runStart) return;
  if (state.completed || state.paused || modalOpen || state.autoHeld) return;
  state.runStart = Date.now();
}

function commitRun() {
  if (!state || !state.runStart) return;
  state.elapsedMs += Date.now() - state.runStart;
  state.runStart = 0;
}

function buildBoard() {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 81; index += 1) {
    const row = Math.floor(index / 9);
    const col = index % 9;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.dataset.index = String(index);
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('tabindex', '-1');
    if (col === 2 || col === 5) cell.classList.add('box-r');
    if (row === 2 || row === 5) cell.classList.add('box-b');
    if (col === 8) cell.classList.add('last-col');
    if (row === 8) cell.classList.add('last-row');

    const valueEl = document.createElement('span');
    valueEl.className = 'value';
    const notesEl = document.createElement('span');
    notesEl.className = 'notes';
    for (let n = 1; n <= 9; n += 1) {
      const note = document.createElement('span');
      note.textContent = String(n);
      notesEl.appendChild(note);
    }
    cell.append(valueEl, notesEl);

    cells.push(cell);
    fragment.appendChild(cell);
  }
  boardEl.appendChild(fragment);
}

function buildPad() {
  for (let n = 1; n <= 9; n += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'num';
    button.dataset.n = String(n);
    const digit = document.createElement('span');
    digit.textContent = String(n);
    const count = document.createElement('span');
    count.className = 'count';
    button.append(digit, count);
    padButtons.push(button);
    padEl.appendChild(button);
  }
}

function buildDiffList() {
  for (const [key, info] of Object.entries(DIFFICULTIES)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'diff-option';
    button.dataset.difficulty = key;
    button.setAttribute('aria-pressed', 'false');
    const name = document.createElement('span');
    name.className = 'd-name';
    name.textContent = info.label;
    const desc = document.createElement('span');
    desc.className = 'd-desc';
    desc.textContent = info.desc;
    button.append(name, desc);
    button.addEventListener('click', () => {
      sheetDifficulty = key;
      updateDiffSelection();
    });
    diffListEl.appendChild(button);
  }
}

function updateDiffSelection() {
  for (const button of diffListEl.children) {
    const selected = button.dataset.difficulty === sheetDifficulty;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
}

function createState(difficulty) {
  const { puzzle, solution } = generatePuzzle(difficulty);
  const firstEmpty = puzzle.findIndex((value) => value === 0);
  return {
    difficulty,
    puzzle,
    solution,
    values: puzzle.slice(),
    notes: new Array(81).fill(0),
    selected: firstEmpty >= 0 ? firstEmpty : 0,
    notesMode: false,
    mistakes: 0,
    hints: HINT_LIMIT,
    elapsedMs: 0,
    runStart: Date.now(),
    autoHeld: false,
    paused: false,
    completed: false,
    undo: [],
  };
}

function canPlay() {
  return Boolean(state) && !state.completed && !state.paused && !modalOpen;
}

function render() {
  if (!state) return;
  const selectedIndex = state.selected;
  const selectedValue = selectedIndex >= 0 ? state.values[selectedIndex] : 0;

  for (let index = 0; index < 81; index += 1) {
    const cell = cells[index];
    const value = state.values[index];
    const isGiven = state.puzzle[index] !== 0;
    const valueEl = cell.firstElementChild;
    const notesEl = cell.lastElementChild;

    valueEl.textContent = value ? String(value) : '';

    const noteBits = state.notes[index];
    const hasNotes = !value && noteBits !== 0;
    notesEl.classList.toggle('hidden', !hasNotes);
    if (hasNotes) {
      for (let n = 1; n <= 9; n += 1) {
        notesEl.children[n - 1].classList.toggle('on', (noteBits & (1 << (n - 1))) !== 0);
      }
    }

    cell.classList.toggle('given', isGiven);
    cell.classList.toggle('user', !isGiven && value !== 0);
    cell.classList.toggle('selected', index === selectedIndex);
    cell.classList.toggle(
      'peer',
      selectedIndex >= 0 && index !== selectedIndex && isPeer(index, selectedIndex)
    );
    cell.classList.toggle(
      'same',
      index !== selectedIndex && selectedValue !== 0 && value === selectedValue
    );
    cell.classList.toggle('error', !isGiven && value !== 0 && value !== state.solution[index]);

    cell.setAttribute('tabindex', index === selectedIndex ? '0' : '-1');
    cell.setAttribute('aria-label', describeCell(index));
  }

  updateHud();
  updatePad();
  updateMissing();
}

function describeCell(index) {
  const row = Math.floor(index / 9) + 1;
  const col = (index % 9) + 1;
  const value = state.values[index];
  const isGiven = state.puzzle[index] !== 0;
  let label = `第 ${row} 行第 ${col} 列`;
  if (value) {
    label += `，${isGiven ? '题目数字' : '已填入'} ${value}`;
  } else if (state.notes[index]) {
    label += '，空格，有候选笔记';
  } else {
    label += '，空格';
  }
  return label;
}

function updateHud() {
  diffChipEl.textContent = DIFFICULTIES[state.difficulty].label;
  timerEl.textContent = formatTime(elapsedSeconds());
  mistakesEl.textContent = String(state.mistakes);
  hintsLeftEl.textContent = String(state.hints);
  hintBadgeEl.textContent = String(state.hints);
  notesBtn.classList.toggle('active', state.notesMode);
  notesBtn.setAttribute('aria-pressed', String(state.notesMode));
  const paused = state.paused;
  pauseBtn.innerHTML = paused ? ICONS.play : ICONS.pause;
  pauseBtn.setAttribute('aria-label', paused ? '继续' : '暂停');
  pauseBtn.title = paused ? '继续' : '暂停';
  undoBtn.disabled = state.completed || state.undo.length === 0;
}

function updatePad() {
  const counts = new Array(10).fill(0);
  for (const value of state.values) {
    if (value) counts[value] += 1;
  }
  for (let n = 1; n <= 9; n += 1) {
    const button = padButtons[n - 1];
    const remaining = 9 - counts[n];
    const countEl = button.querySelector('.count');
    countEl.textContent = remaining > 0 ? String(remaining) : '';
    button.classList.toggle('done', remaining <= 0);
    button.setAttribute(
      'aria-label',
      remaining > 0 ? `输入数字 ${n}，还剩 ${remaining} 个` : `输入数字 ${n}，已全部填完`
    );
  }
}

function unitIndices(index, kind) {
  const row = Math.floor(index / 9);
  const col = index % 9;
  if (kind === 'row') return Array.from({ length: 9 }, (_, c) => row * 9 + c);
  if (kind === 'col') return Array.from({ length: 9 }, (_, r) => r * 9 + col);
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  const list = [];
  for (let r = boxRow; r < boxRow + 3; r += 1) {
    for (let c = boxCol; c < boxCol + 3; c += 1) list.push(r * 9 + c);
  }
  return list;
}

function missingIn(indices) {
  const present = new Set();
  for (const index of indices) {
    const value = state.values[index];
    if (value) present.add(value);
  }
  const digits = [];
  for (let n = 1; n <= 9; n += 1) {
    if (!present.has(n)) digits.push(n);
  }
  return digits;
}

function fillMissingItem(itemEl, valueEl, label, digits) {
  valueEl.textContent = '';
  itemEl.classList.toggle('single', digits.length === 1);
  itemEl.setAttribute(
    'aria-label',
    digits.length ? `${label}还缺 ${digits.join('、')}` : `${label}已经填齐`
  );
  if (digits.length === 0) {
    const done = document.createElement('span');
    done.className = 'missing-done';
    done.textContent = '齐';
    valueEl.appendChild(done);
    return;
  }
  for (const digit of digits) {
    const chip = document.createElement('span');
    chip.className = 'missing-chip';
    chip.textContent = String(digit);
    valueEl.appendChild(chip);
  }
}

function updateMissing() {
  if (!state || state.completed || state.paused || state.selected < 0) {
    missingBarEl.hidden = true;
    return;
  }
  const index = state.selected;
  fillMissingItem(missingRowItemEl, missingRowEl, '本行', missingIn(unitIndices(index, 'row')));
  fillMissingItem(missingColItemEl, missingColEl, '本列', missingIn(unitIndices(index, 'col')));
  fillMissingItem(missingBoxItemEl, missingBoxEl, '本宫', missingIn(unitIndices(index, 'box')));
  missingBarEl.hidden = false;
}

function announce(message) {
  liveEl.textContent = message;
  toastEl.textContent = message;
  toastEl.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 1900);
}

function flash(index, animationClass) {
  const cell = cells[index];
  cell.classList.remove(animationClass);
  void cell.offsetWidth;
  cell.classList.add(animationClass);
  const cleanup = () => {
    cell.classList.remove(animationClass);
    cell.removeEventListener('animationend', cleanup);
  };
  cell.addEventListener('animationend', cleanup);
}

function pushUndo() {
  state.undo.push({
    values: state.values.slice(),
    notes: state.notes.slice(),
    mistakes: state.mistakes,
    hints: state.hints,
  });
  if (state.undo.length > 200) state.undo.shift();
}

function selectCell(index) {
  if (!state) return;
  state.selected = index;
  render();
  cells[index].focus({ preventScroll: true });
}

function moveSelection(dx, dy) {
  if (!state) return;
  const current = state.selected >= 0 ? state.selected : 0;
  const row = Math.floor(current / 9);
  const col = current % 9;
  const nextRow = Math.max(0, Math.min(8, row + dy));
  const nextCol = Math.max(0, Math.min(8, col + dx));
  selectCell(nextRow * 9 + nextCol);
}

function inputDigit(n) {
  if (!canPlay()) return;
  const index = state.selected;
  if (index < 0) {
    announce('先选择一个格子');
    return;
  }
  if (state.puzzle[index] !== 0) {
    flash(index, 'shake');
    announce('题目给定的数字不能修改');
    return;
  }

  if (state.notesMode) {
    if (state.values[index] !== 0) {
      announce('先擦除这个数字，再记笔记');
      return;
    }
    pushUndo();
    state.notes[index] ^= 1 << (n - 1);
    render();
    save();
    return;
  }

  pushUndo();
  state.values[index] = n;
  state.notes[index] = 0;
  const bit = 1 << (n - 1);
  for (const peer of PEERS[index]) state.notes[peer] &= ~bit;

  if (n !== state.solution[index]) {
    state.mistakes += 1;
    render();
    flash(index, 'shake');
    announce('这个数字不对，再想想');
    save();
    return;
  }

  render();
  flash(index, 'pop');
  save();
  if (hasWon()) finishGame();
}

function eraseCell() {
  if (!canPlay()) return;
  const index = state.selected;
  if (index < 0) {
    announce('先选择一个格子');
    return;
  }
  if (state.puzzle[index] !== 0) {
    announce('题目给定的数字不能擦除');
    return;
  }
  if (state.values[index] === 0 && state.notes[index] === 0) return;
  pushUndo();
  state.values[index] = 0;
  state.notes[index] = 0;
  render();
  save();
}

function toggleNotes() {
  if (!canPlay()) return;
  state.notesMode = !state.notesMode;
  render();
  announce(state.notesMode ? '笔记模式已开启' : '笔记模式已关闭');
}

function useHint() {
  if (!canPlay()) return;
  if (state.hints <= 0) {
    announce('本局提示次数已用完');
    return;
  }
  let index = state.selected;
  if (!(index >= 0 && state.puzzle[index] === 0 && state.values[index] !== state.solution[index])) {
    index = state.values.findIndex(
      (value, i) => state.puzzle[i] === 0 && value !== state.solution[i]
    );
  }
  if (index < 0) {
    announce(state.selected >= 0 ? '这个格子已经填对了' : '当前没有可提示的格子');
    return;
  }
  state.selected = index;

  pushUndo();
  const answer = state.solution[index];
  state.values[index] = answer;
  state.notes[index] = 0;
  const bit = 1 << (answer - 1);
  for (const peer of PEERS[index]) state.notes[peer] &= ~bit;
  state.hints -= 1;

  render();
  flash(index, 'hinted');
  save();
  announce(`已填入 ${answer}，剩余 ${state.hints} 次提示`);
  if (hasWon()) finishGame();
}

function undo() {
  if (!canPlay()) return;
  const snapshot = state.undo.pop();
  if (!snapshot) return;
  state.values = snapshot.values;
  state.notes = snapshot.notes;
  state.mistakes = snapshot.mistakes;
  state.hints = snapshot.hints;
  render();
  save();
}

function setPaused(paused) {
  if (!state || state.completed || modalOpen) return;
  state.paused = paused;
  if (paused) commitRun();
  else startRun();
  pauseOverlay.hidden = !paused;
  render();
  save();
  if (paused) {
    resumeBtn.focus();
  } else if (state.selected >= 0) {
    cells[state.selected].focus({ preventScroll: true });
  }
}

function hasWon() {
  for (let index = 0; index < 81; index += 1) {
    if (state.values[index] !== state.solution[index]) return false;
  }
  return true;
}

function readBests() {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function recordBest() {
  const bests = readBests();
  const previous = bests[state.difficulty];
  const time = elapsedSeconds();
  if (!previous || time < previous) {
    bests[state.difficulty] = time;
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(bests));
    } catch {
      /* storage unavailable */
    }
    return true;
  }
  return false;
}

function readLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const result = {};
    for (const key of Object.keys(DIFFICULTIES)) {
      result[key] = Array.isArray(parsed[key]) ? parsed[key].filter(validLeaderEntry) : [];
    }
    return result;
  } catch {
    return Object.fromEntries(Object.keys(DIFFICULTIES).map((k) => [k, []]));
  }
}

function validLeaderEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  const t = Number(entry.time);
  const m = Number(entry.mistakes);
  const d = Number(entry.date);
  if (!Number.isFinite(t) || t <= 0) return false;
  if (!Number.isInteger(m) || m < 0) return false;
  if (!Number.isFinite(d) || d <= 0) return false;
  return true;
}

function writeLeaderboard(data) {
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable */
  }
}

function addLeaderboardScore(difficulty, entry) {
  const board = readLeaderboard();
  const list = board[difficulty] || [];
  list.push(entry);
  list.sort((a, b) => a.time - b.time || a.mistakes - b.mistakes || a.date - b.date);
  if (list.length > LEADERBOARD_MAX) list.length = LEADERBOARD_MAX;
  board[difficulty] = list;
  writeLeaderboard(board);
  return list.findIndex((e) => e === entry) + 1;
}

function clearLeaderboard(difficulty) {
  const board = readLeaderboard();
  board[difficulty] = [];
  writeLeaderboard(board);
}

const SCORES_2048_KEY = 'paper-2048:scores:v1';

function read2048Scores() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SCORES_2048_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && Number(entry.score) > 0 && Number.isFinite(Number(entry.date)))
      .map((entry) => ({
        score: Number(entry.score),
        max: Number(entry.max) || 0,
        date: Number(entry.date),
      }))
      .sort((a, b) => b.score - a.score || a.date - b.date)
      .slice(0, 20);
  } catch {
    return [];
  }
}

function clear2048Scores() {
  try {
    localStorage.removeItem(SCORES_2048_KEY);
  } catch {
    /* storage unavailable */
  }
}

function formatLeaderDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  if (sameDay(date, now)) return '今天';
  if (sameDay(date, yesterday)) return '昨天';
  if (date.getFullYear() === now.getFullYear()) return `${mm}-${dd}`;
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/**
 * 庆祝动画：五彩纸屑爆裂 + 彩带飘落 + 亮点散开
 * 仅用 DOM + CSS keyframes，不引入额外依赖
 */
function celebrateVictory() {
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  const COLORS = ['#edc22e', '#f67c5f', '#77c2e3', '#96ceb4', '#d98cb3', '#6c5ce7', '#ff9f43', '#26de81'];
  const rand = (min, max) => Math.random() * (max - min) + min;

  const layer = document.createElement('div');
  layer.className = 'celebrate-layer';
  document.body.appendChild(layer);

  // 1. 中心爆裂的五彩纸屑（40 片）
  const burstCount = 40;
  for (let i = 0; i < burstCount; i += 1) {
    const piece = document.createElement('div');
    piece.className = 'confetti burst';
    const angle = (Math.PI * 2 * i) / burstCount + rand(-0.2, 0.2);
    const dist = rand(180, 420);
    piece.style.setProperty('--cx', `${Math.cos(angle) * dist}px`);
    piece.style.setProperty('--cy', `${Math.sin(angle) * dist}px`);
    piece.style.setProperty('--crx', `${rand(-720, 720)}deg`);
    piece.style.setProperty('--cd', `${rand(900, 1600)}ms`);
    piece.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
    piece.style.width = `${rand(6, 12)}px`;
    piece.style.height = `${rand(8, 18)}px`;
    if (Math.random() < 0.3) piece.style.borderRadius = '50%';
    layer.appendChild(piece);
  }

  // 2. 从顶部飘落的彩带（30 片）
  const fallCount = 30;
  for (let i = 0; i < fallCount; i += 1) {
    const piece = document.createElement('div');
    piece.className = 'confetti fall';
    piece.style.setProperty('--fx', `${rand(0, 100)}%`);
    piece.style.setProperty('--fsway', `${rand(-80, 80)}px`);
    piece.style.setProperty('--frx', `${rand(360, 1440)}deg`);
    piece.style.setProperty('--fd', `${rand(2400, 4200)}ms`);
    piece.style.setProperty('--fdelay', `${rand(0, 800)}ms`);
    piece.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
    piece.style.width = `${rand(8, 14)}px`;
    piece.style.height = `${rand(12, 22)}px`;
    layer.appendChild(piece);
  }

  // 3. 亮点光环（20 颗）
  const sparkleCount = 20;
  for (let i = 0; i < sparkleCount; i += 1) {
    const sp = document.createElement('div');
    sp.className = 'sparkle';
    const angle = (Math.PI * 2 * i) / sparkleCount;
    const dist = rand(100, 260);
    sp.style.setProperty('--sx', `${Math.cos(angle) * dist}px`);
    sp.style.setProperty('--sy', `${Math.sin(angle) * dist}px`);
    sp.style.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    sp.style.animationDelay = `${rand(0, 200)}ms`;
    layer.appendChild(sp);
  }

  // 4. 给胜利卡片加脉冲 + 弹跳（如果存在）
  const card = document.querySelector('#winOverlay .overlay-card');
  if (card) {
    card.classList.add('celebrate-bounce');
  }

  // 动画全部结束后清理容器
  const longest = 5000; // 彩带飘落最长 4200ms + 缓冲
  setTimeout(() => {
    layer.remove();
    if (card) card.classList.remove('celebrate-bounce');
  }, longest);
}

function finishGame() {
  commitRun();
  state.completed = true;
  state.paused = false;
  pauseOverlay.hidden = true;
  const isRecord = recordBest();
  const time = elapsedSeconds();

  const entry = {
    time,
    mistakes: state.mistakes,
    date: Date.now(),
    hintsUsed: HINT_LIMIT - state.hints,
  };
  const rank = addLeaderboardScore(state.difficulty, entry);

  winStatsEl.innerHTML = [
    `<div class="win-stat"><span class="k">难度</span><span class="v">${DIFFICULTIES[state.difficulty].label}</span></div>`,
    `<div class="win-stat"><span class="k">用时</span><span class="v">${formatTime(time)}</span></div>`,
    `<div class="win-stat"><span class="k">错误</span><span class="v">${state.mistakes}</span></div>`,
  ].join('');
  winBestEl.hidden = !isRecord;
  winGlobalMsgEl.hidden = true;
  winGlobalMsgEl.textContent = '';
  winSubmitBtn.disabled = false;
  winGlobalEl.hidden = !RemoteBoard.enabled;
  if (RemoteBoard.enabled) {
    winNickEl.value = readNickname();
    winSubmitBtn.textContent = '提交全球榜';
  }
  if (rank > 0 && rank <= LEADERBOARD_MAX) {
    winRankEl.hidden = false;
    winRankEl.textContent =
      rank === 1 ? '🏆 排行榜第 1 名！' : `排行榜第 ${rank} 名`;
  } else {
    winRankEl.hidden = true;
  }
  winOverlay.hidden = false;

  celebrateVictory();

  render();
  save();
  announce('完成！点“再来一局”继续。');
}

function startGame(difficulty) {
  state = createState(difficulty);
  closeNewSheet({ focus: false });
  winOverlay.hidden = true;
  pauseOverlay.hidden = true;
  render();
  save();
  announce(`新游戏开始 · ${DIFFICULTIES[difficulty].label}`);
  if (state.selected >= 0) cells[state.selected].focus({ preventScroll: true });
}

function openNewSheet() {
  if (!state) return;
  sheetDifficulty = state.difficulty;
  updateDiffSelection();
  commitRun();
  modalOpen = true;
  newOverlay.hidden = false;
  startNewBtn.focus();
}

function closeNewSheet({ focus = true } = {}) {
  modalOpen = false;
  newOverlay.hidden = true;
  startRun();
  if (focus) newBtn.focus();
}

function readNickname() {
  try {
    return (localStorage.getItem(NICK_KEY) || '').trim();
  } catch {
    return '';
  }
}

function saveNickname(value) {
  const name = normalizeNick(value);
  try {
    if (name) localStorage.setItem(NICK_KEY, name);
    else localStorage.removeItem(NICK_KEY);
  } catch {
    /* storage unavailable */
  }
  return name;
}

function normalizeNick(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12);
}

function nickIsValid(name) {
  return name.length >= 2 && name.length <= 12;
}

function buildLeaderTabs() {
  const fragment = document.createDocumentFragment();
  for (const [key, info] of Object.entries(DIFFICULTIES)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'leader-tab';
    btn.textContent = info.label;
    btn.dataset.difficulty = key;
    btn.setAttribute('role', 'tab');
    btn.addEventListener('click', () => {
      leaderDifficulty = key;
      renderLeaderboard();
    });
    fragment.appendChild(btn);
  }
  leaderTabsEl.appendChild(fragment);
}

function openLeaderboard() {
  leaderAutoPaused = Boolean(state && !state.completed && !state.paused);
  if (leaderAutoPaused) setPaused(true);
  modalOpen = true;
  if (state) leaderDifficulty = state.difficulty;
  renderLeaderboard();
  leaderOverlay.hidden = false;
  leaderCloseBtn.focus();
}

function closeLeaderboard() {
  modalOpen = false;
  leaderOverlay.hidden = true;
  if (leaderAutoPaused) {
    leaderAutoPaused = false;
    if (state && !state.completed) setPaused(false);
  }
  startRun();
  leaderBtn.focus();
}

function rankLabel(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

let leaderRequestToken = 0;

function renderLeaderboard() {
  const has2048Tab = typeof leaderGame === 'string' && leaderGamesEl;
  const is2048 = has2048Tab && leaderGame === '2048';
  if (is2048 && leaderScope === 'local') {
    const raw = localStorage.getItem(SCORES_2048_KEY);
    console.info('[排行榜·诊断] 2048 本机榜 key=', SCORES_2048_KEY, '原始值=', raw);
  }

  if (has2048Tab) {
    for (const btn of leaderGamesEl.children) {
      const active = btn.dataset.game === leaderGame;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    }
  }

  leaderTabsEl.hidden = is2048;
  leaderSubEl.textContent = is2048
    ? '按分数从高到低，取前 10'
    : '按用时从快到慢，每个难度取前 10';

  for (const btn of leaderScopeEl.children) {
    const active = btn.dataset.scope === leaderScope;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  }
  const remoteReady = is2048
    ? typeof RemoteBoard2048 !== 'undefined' && RemoteBoard2048.enabled
    : RemoteBoard.enabled;
  scopeGlobalBtn.disabled = !remoteReady;
  scopeGlobalBtn.title = remoteReady ? '所有玩家共享的成绩' : '未配置 Supabase';
  if (!remoteReady && leaderScope === 'global') leaderScope = 'local';

  nickRowEl.hidden = leaderScope !== 'global';
  leaderClearBtn.hidden = leaderScope === 'global';
  leaderClearBtn.textContent = is2048 ? '清空 2048 记录' : '清空当前难度';
  if (leaderScope === 'global') nickInputEl.value = readNickname();

  if (!is2048) {
    for (const tab of leaderTabsEl.children) {
      const active = tab.dataset.difficulty === leaderDifficulty;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    }
  }

  leaderRequestToken += 1;
  if (leaderScope === 'global') {
    if (is2048) renderGlobal2048Rows();
    else renderGlobalRows();
  } else if (is2048) {
    renderLocal2048Rows();
  } else {
    renderLocalRows();
  }
}

function makeRow(rank, detail) {
  const row = document.createElement('div');
  row.className = `leader-row rank-${Math.min(rank, 4)}${detail.global ? ' global' : ''}`;
  row.setAttribute('role', 'listitem');

  const rankEl = document.createElement('span');
  rankEl.className = 'leader-rank';
  rankEl.textContent = rankLabel(rank);
  row.appendChild(rankEl);

  if (detail.global) {
    const nameWrap = document.createElement('span');
    nameWrap.className = 'leader-name';
    const nickLine = document.createElement('span');
    nickLine.className = 'n';
    nickLine.textContent = detail.name;
    const metaLine = document.createElement('span');
    metaLine.className = 'm';
    metaLine.textContent = detail.meta;
    nameWrap.append(nickLine, metaLine);
    row.appendChild(nameWrap);
  }

  const timeEl = document.createElement('span');
  timeEl.className = 'leader-time';
  timeEl.textContent =
    detail.valueText !== undefined ? detail.valueText : formatTime(detail.time);
  row.appendChild(timeEl);

  if (!detail.global) {
    const metaEl = document.createElement('span');
    metaEl.className = 'leader-meta';
    metaEl.textContent = detail.meta;
    row.appendChild(metaEl);
  }

  return row;
}

function renderLocalRows() {
  const entries = (readLeaderboard()[leaderDifficulty] || []).slice(0, LEADERBOARD_MAX);
  leaderListEl.innerHTML = '';
  if (entries.length === 0) {
    leaderEmptyEl.textContent = '还没有记录，完成一局来上榜吧';
    leaderEmptyEl.hidden = false;
    leaderClearBtn.disabled = true;
    return;
  }
  leaderEmptyEl.hidden = true;
  leaderClearBtn.disabled = false;

  const fragment = document.createDocumentFragment();
  entries.forEach((entry, index) => {
    fragment.appendChild(
      makeRow(index + 1, {
        time: entry.time,
        meta: `错 ${entry.mistakes} · ${formatLeaderDate(entry.date)}`,
      })
    );
  });
  leaderListEl.appendChild(fragment);
}

async function renderGlobalRows() {
  const token = ++leaderRequestToken;
  const difficulty = leaderDifficulty;
  leaderListEl.innerHTML = '';
  leaderEmptyEl.hidden = true;

  const loading = document.createElement('p');
  loading.className = 'leader-empty';
  loading.textContent = '加载全球榜…';
  leaderListEl.appendChild(loading);

  try {
    const rows = await RemoteBoard.top(difficulty, LEADERBOARD_MAX);
    if (token !== leaderRequestToken) return;
    leaderListEl.innerHTML = '';
    if (rows.length === 0) {
      leaderEmptyEl.textContent = '全球榜还没有记录，来做第一个上榜的人';
      leaderEmptyEl.hidden = false;
      return;
    }
    const fragment = document.createDocumentFragment();
    rows.forEach((row, index) => {
      const hints = Number(row.hints_used) || 0;
      fragment.appendChild(
        makeRow(index + 1, {
          global: true,
          name: row.nickname,
          time: Number(row.time),
          meta: `错 ${row.mistakes}${hints ? ` · 提示 ${hints}` : ''} · ${formatLeaderDate(
            new Date(row.created_at).getTime()
          )}`,
        })
      );
    });
    leaderListEl.appendChild(fragment);
  } catch (error) {
    if (token !== leaderRequestToken) return;
    leaderListEl.innerHTML = '';
    const fail = document.createElement('p');
    fail.className = 'leader-empty leader-error';
    fail.textContent = `全球榜加载失败：${error.message}`;
    leaderListEl.appendChild(fail);
  }
}

function renderLocal2048Rows() {
  const entries = read2048Scores().slice(0, LEADERBOARD_MAX);
  leaderListEl.innerHTML = '';
  if (entries.length === 0) {
    leaderEmptyEl.textContent = '还没有记录，去玩一局 2048 吧';
    leaderEmptyEl.hidden = false;
    leaderClearBtn.disabled = true;
    return;
  }
  leaderEmptyEl.hidden = true;
  leaderClearBtn.disabled = false;

  const fragment = document.createDocumentFragment();
  entries.forEach((entry, index) => {
    fragment.appendChild(
      makeRow(index + 1, {
        valueText: `${entry.score} 分`,
        meta: `最大 ${entry.max} · ${formatLeaderDate(entry.date)}`,
      })
    );
  });
  leaderListEl.appendChild(fragment);
}

async function renderGlobal2048Rows() {
  const token = ++leaderRequestToken;
  leaderListEl.innerHTML = '';
  leaderEmptyEl.hidden = true;

  const loading = document.createElement('p');
  loading.className = 'leader-empty';
  loading.textContent = '加载全球榜…';
  leaderListEl.appendChild(loading);

  try {
    const rows = await RemoteBoard2048.top2048(LEADERBOARD_MAX, { force: true });
    if (token !== leaderRequestToken) return;
    leaderListEl.innerHTML = '';
    if (rows.length === 0) {
      leaderEmptyEl.textContent = '全球榜还没有记录，来做第一个上榜的人';
      leaderEmptyEl.hidden = false;
      return;
    }
    const fragment = document.createDocumentFragment();
    rows.forEach((row, index) => {
      fragment.appendChild(
        makeRow(index + 1, {
          global: true,
          name: row.nickname,
          valueText: `${Number(row.score)} 分`,
          meta: `最大 ${Number(row.max_tile) || 0} · ${formatLeaderDate(
            new Date(row.created_at).getTime()
          )}`,
        })
      );
    });
    leaderListEl.appendChild(fragment);
  } catch (error) {
    if (token !== leaderRequestToken) return;
    leaderListEl.innerHTML = '';
    const fail = document.createElement('p');
    fail.className = 'leader-empty leader-error';
    fail.textContent = `全球榜加载失败：${error.message}`;
    leaderListEl.appendChild(fail);
  }
}

function shareScore() {
  if (!state || !state.completed) return;
  const text = [
    `🧩 数独 · ${DIFFICULTIES[state.difficulty].label}`,
    `⏱ 用时 ${formatTime(elapsedSeconds())}`,
    `❌ 错误 ${state.mistakes}`,
    '',
    'https://vanish7k.github.io/test/sudoku/',
  ].join('\n');
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    announce(ok ? '成绩已复制到剪贴板' : '复制失败，请手动选择文字');
  };
  if (navigator.share) {
    navigator.share({ title: '数独成绩', text }).catch(() => fallback());
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => announce('成绩已复制到剪贴板'),
      fallback
    );
  } else {
    fallback();
  }
}

function setWinGlobalMsg(message, isError) {
  winGlobalMsgEl.hidden = false;
  winGlobalMsgEl.textContent = message;
  winGlobalMsgEl.classList.toggle('error', Boolean(isError));
}

async function submitGlobalScore() {
  if (!state || !state.completed || !RemoteBoard.enabled) return;
  if (winSubmitBtn.disabled) return;

  const name = saveNickname(winNickEl.value);
  winNickEl.value = name;
  if (!nickIsValid(name)) {
    setWinGlobalMsg('昵称需要 2-12 个字符', true);
    return;
  }

  winSubmitBtn.disabled = true;
  setWinGlobalMsg('提交中…', false);
  const difficulty = state.difficulty;
  try {
    const row = await RemoteBoard.submit({
      nickname: name,
      difficulty,
      time: elapsedSeconds(),
      mistakes: state.mistakes,
      hintsUsed: HINT_LIMIT - state.hints,
    });
    const rows = await RemoteBoard.top(difficulty, LEADERBOARD_MAX, { force: true });
    const index = rows.findIndex((item) => String(item.id) === String(row.id));
    if (index >= 0) {
      setWinGlobalMsg(`已上榜，全球第 ${index + 1} 名 🎉`, false);
      winSubmitBtn.textContent = '已提交';
    } else {
      setWinGlobalMsg('已提交，暂未进入前 10', false);
      winSubmitBtn.textContent = '再次提交';
      winSubmitBtn.disabled = false;
    }
  } catch (error) {
    setWinGlobalMsg(`提交失败：${error.message}`, true);
    winSubmitBtn.disabled = false;
  }
}

function save() {
  if (!state) return;
  commitRun();
  try {
    if (state.completed) {
      localStorage.removeItem(STORE_KEY);
      return;
    }
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        difficulty: state.difficulty,
        puzzle: state.puzzle,
        solution: state.solution,
        values: state.values,
        notes: state.notes,
        mistakes: state.mistakes,
        hints: state.hints,
        elapsed: Math.floor(state.elapsedMs / 1000),
        selected: state.selected,
      })
    );
  } catch {
    /* storage unavailable */
  }
  startRun();
}

function loadSaved() {
  let raw;
  try {
    raw = localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !data ||
    !Array.isArray(data.puzzle) ||
    !Array.isArray(data.solution) ||
    !Array.isArray(data.values) ||
    data.puzzle.length !== 81 ||
    data.solution.length !== 81 ||
    data.values.length !== 81
  ) {
    return null;
  }

  for (let index = 0; index < 81; index += 1) {
    const puzzleValue = data.puzzle[index];
    if (!Number.isInteger(puzzleValue) || puzzleValue < 0 || puzzleValue > 9) return null;
    const value = data.values[index];
    if (!Number.isInteger(value) || value < 0 || value > 9) return null;
    const solutionValue = data.solution[index];
    if (!Number.isInteger(solutionValue) || solutionValue < 1 || solutionValue > 9) return null;
    if (puzzleValue !== 0 && value !== puzzleValue) return null;
  }

  const notes =
    Array.isArray(data.notes) && data.notes.length === 81
      ? data.notes.map((note) => (Number(note) || 0) & 0x1ff)
      : new Array(81).fill(0);

  return {
    difficulty: DIFFICULTIES[data.difficulty] ? data.difficulty : 'easy',
    puzzle: data.puzzle.slice(),
    solution: data.solution.slice(),
    values: data.values.slice(),
    notes,
    selected:
      Number.isInteger(data.selected) && data.selected >= 0 && data.selected < 81
        ? data.selected
        : -1,
    notesMode: false,
    mistakes: Math.max(0, Number(data.mistakes) || 0),
    hints: Math.max(0, Number(data.hints) || 0),
    elapsedMs: Math.max(0, Number(data.elapsed) || 0) * 1000,
    runStart: 0,
    autoHeld: false,
    paused: false,
    completed: false,
    undo: [],
  };
}

function tick() {
  if (!state || state.completed) return;
  const running = !state.paused && !modalOpen && !state.autoHeld;
  if (!running) {
    commitRun();
    timerEl.textContent = formatTime(elapsedSeconds());
    return;
  }
  startRun();
  timerEl.textContent = formatTime(elapsedSeconds());
  saveTick = (saveTick + 1) % 15;
  if (saveTick === 0) save();
}

function bindEvents() {
  boardEl.addEventListener('click', (event) => {
    const cell = event.target.closest('.cell');
    if (!cell || !state || state.completed || state.paused) return;
    selectCell(Number(cell.dataset.index));
  });

  padEl.addEventListener('click', (event) => {
    const button = event.target.closest('.num');
    if (!button) return;
    inputDigit(Number(button.dataset.n));
  });

  undoBtn.addEventListener('click', undo);
  eraseBtn.addEventListener('click', eraseCell);
  notesBtn.addEventListener('click', toggleNotes);
  hintBtn.addEventListener('click', useHint);
  pauseBtn.addEventListener('click', () => setPaused(!state.paused));
  resumeBtn.addEventListener('click', () => setPaused(false));
  newBtn.addEventListener('click', openNewSheet);
  cancelNewBtn.addEventListener('click', () => closeNewSheet());
  startNewBtn.addEventListener('click', () => startGame(sheetDifficulty));
  winNewBtn.addEventListener('click', () => startGame(state.difficulty));
  winCloseBtn.addEventListener('click', () => {
    winOverlay.hidden = true;
  });
  winShareBtn.addEventListener('click', shareScore);
  winSubmitBtn.addEventListener('click', submitGlobalScore);

  leaderGamesEl.addEventListener('click', (event) => {
    const btn = event.target.closest('.game-tab');
    if (!btn) return;
    leaderGame = btn.dataset.game === '2048' ? '2048' : 'sudoku';
    renderLeaderboard();
  });

  leaderScopeEl.addEventListener('click', (event) => {
    const btn = event.target.closest('.scope-btn');
    if (!btn || btn.disabled) return;
    leaderScope = btn.dataset.scope === 'global' ? 'global' : 'local';
    renderLeaderboard();
  });

  nickSaveBtn.addEventListener('click', () => {
    const name = saveNickname(nickInputEl.value);
    nickInputEl.value = name;
    if (!nickIsValid(name)) {
      announce('昵称需要 2-12 个字符');
      return;
    }
    announce('昵称已保存');
    renderLeaderboard();
  });

  leaderBtn.addEventListener('click', openLeaderboard);
  leaderCloseBtn.addEventListener('click', closeLeaderboard);
  leaderClearBtn.addEventListener('click', () => {
    if (leaderGame === '2048') {
      if (!window.confirm('确定清空本机 2048 排行榜吗？此操作无法撤销。')) return;
      clear2048Scores();
      renderLeaderboard();
      announce('已清空 2048 排行榜');
      return;
    }
    const label = DIFFICULTIES[leaderDifficulty].label;
    if (!window.confirm(`确定清空「${label}」难度的本机排行榜吗？此操作无法撤销。`)) return;
    clearLeaderboard(leaderDifficulty);
    renderLeaderboard();
    announce(`已清空${label}排行榜`);
  });

  newOverlay.addEventListener('click', (event) => {
    if (event.target === newOverlay) closeNewSheet();
  });

  leaderOverlay.addEventListener('click', (event) => {
    if (event.target === leaderOverlay) closeLeaderboard();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (modalOpen) {
        event.preventDefault();
        if (!leaderOverlay.hidden) closeLeaderboard();
        else closeNewSheet();
        return;
      }
      if (state && state.paused && !state.completed) {
        event.preventDefault();
        setPaused(false);
      }
      return;
    }
    if (!state || modalOpen) return;
    if (state.completed) return;

    if (state.paused) {
      if (event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setPaused(false);
      }
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
      }
      return;
    }

    const key = event.key;
    if (key >= '1' && key <= '9') {
      if (!event.repeat) {
        event.preventDefault();
        inputDigit(Number(key));
      }
      return;
    }
    switch (key) {
      case 'Backspace':
      case 'Delete':
        event.preventDefault();
        eraseCell();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        moveSelection(-1, 0);
        break;
      case 'ArrowRight':
        event.preventDefault();
        moveSelection(1, 0);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveSelection(0, -1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        moveSelection(0, 1);
        break;
      default:
        break;
    }

    const lower = key.toLowerCase();
    if (lower === 'n') {
      event.preventDefault();
      toggleNotes();
    } else if (lower === 'h') {
      event.preventDefault();
      useHint();
    } else if (lower === 'u') {
      event.preventDefault();
      undo();
    } else if (lower === 'p') {
      event.preventDefault();
      setPaused(true);
    }
  });

  window.addEventListener('pagehide', () => {
    if (state) state.autoHeld = true;
    save();
  });
  document.addEventListener('visibilitychange', () => {
    if (!state) return;
    if (document.visibilityState === 'hidden') {
      state.autoHeld = true;
      commitRun();
      save();
      timerEl.textContent = formatTime(elapsedSeconds());
    } else if (!state.completed) {
      state.autoHeld = false;
      startRun();
      timerEl.textContent = formatTime(elapsedSeconds());
    }
  });
}

function init() {
  buildBoard();
  buildDiffList();
  buildPad();
  buildLeaderTabs();
  bindEvents();

  const saved = loadSaved();
  if (saved) {
    state = saved;
    if (state.selected < 0) {
      const firstEmpty = state.values.findIndex((value) => value === 0);
      state.selected = firstEmpty >= 0 ? firstEmpty : -1;
    }
    render();
    announce('已继续上次的对局');
  } else {
    state = createState('easy');
    render();
  }

  startRun();
  window.setInterval(tick, 1000);
  setupServiceWorker();
}

let updatePrompted = false;

function setupServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const hadController = Boolean(navigator.serviceWorker.controller);

  updateBtnEl.addEventListener('click', () => location.reload());
  updateDismissEl.addEventListener('click', () => {
    updateBarEl.hidden = true;
  });

  // 新版本接管后提示刷新，避免用户一直停留在旧页面
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || updatePrompted) return;
    updatePrompted = true;
    updateBarEl.hidden = false;
  });

  navigator.serviceWorker.register('sw.js').catch(() => {
    /* 离线缓存不可用，不影响游戏 */
  });
}

init();

(function hideAppLoader() {
  const loader = document.getElementById('appLoader');
  if (!loader) return;
  const start = performance.now();
  const MIN = 2200, MAX = 3700;
  const done = () => {
    const wait = Math.max(0, MIN - (performance.now() - start));
    setTimeout(() => {
      loader.hidden = true;
      loader.setAttribute('aria-hidden', 'true');
      setTimeout(() => loader.remove(), 500);
    }, wait);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', done, { once: true });
  } else {
    done();
  }
  setTimeout(done, MAX);
})();
