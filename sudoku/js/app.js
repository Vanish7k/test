const DIFFICULTIES = {
  easy: { label: '简单', desc: '轻松热身' },
  medium: { label: '中等', desc: '动脑时刻' },
  hard: { label: '困难', desc: '深度专注' },
  expert: { label: '专家', desc: '线索极少' },
};

const STORE_KEY = 'paper-sudoku:v1';
const BEST_KEY = 'paper-sudoku:bests:v1';
const LEADERBOARD_KEY = 'paper-sudoku:leaderboard:v1';
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

const leaderBtn = document.getElementById('leaderBtn');
const leaderOverlay = document.getElementById('leaderOverlay');
const leaderTabsEl = document.getElementById('leaderTabs');
const leaderListEl = document.getElementById('leaderList');
const leaderEmptyEl = document.getElementById('leaderEmpty');
const leaderCloseBtn = document.getElementById('leaderCloseBtn');
const leaderClearBtn = document.getElementById('leaderClearBtn');
const winRankEl = document.getElementById('winRank');
const winShareBtn = document.getElementById('winShareBtn');

const cells = [];
const padButtons = [];

let state = null;
let modalOpen = false;
let sheetDifficulty = 'easy';
let leaderDifficulty = 'easy';
let toastTimer = 0;

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
    elapsed: 0,
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
  timerEl.textContent = formatTime(state.elapsed);
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
  const index = state.selected;
  if (index < 0) {
    announce('先选择一个空格');
    return;
  }
  if (state.puzzle[index] !== 0) {
    announce('请选择一个空格');
    return;
  }
  if (state.values[index] === state.solution[index]) {
    announce('这个格子已经填对了');
    return;
  }

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
  if (!previous || state.elapsed < previous) {
    bests[state.difficulty] = state.elapsed;
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

function finishGame() {
  state.completed = true;
  state.paused = false;
  pauseOverlay.hidden = true;
  const isRecord = recordBest();

  const entry = {
    time: state.elapsed,
    mistakes: state.mistakes,
    date: Date.now(),
    hintsUsed: HINT_LIMIT - state.hints,
  };
  const rank = addLeaderboardScore(state.difficulty, entry);

  winStatsEl.innerHTML = [
    `<div class="win-stat"><span class="k">难度</span><span class="v">${DIFFICULTIES[state.difficulty].label}</span></div>`,
    `<div class="win-stat"><span class="k">用时</span><span class="v">${formatTime(state.elapsed)}</span></div>`,
    `<div class="win-stat"><span class="k">错误</span><span class="v">${state.mistakes}</span></div>`,
  ].join('');
  winBestEl.hidden = !isRecord;
  if (rank > 0 && rank <= LEADERBOARD_MAX) {
    winRankEl.hidden = false;
    winRankEl.textContent =
      rank === 1 ? '🏆 排行榜第 1 名！' : `排行榜第 ${rank} 名`;
  } else {
    winRankEl.hidden = true;
  }
  winOverlay.hidden = false;

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
  modalOpen = true;
  newOverlay.hidden = false;
  startNewBtn.focus();
}

function closeNewSheet({ focus = true } = {}) {
  modalOpen = false;
  newOverlay.hidden = true;
  if (focus) newBtn.focus();
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
  if (state && !state.completed && !state.paused) setPaused(true);
  modalOpen = true;
  if (state) leaderDifficulty = state.difficulty;
  renderLeaderboard();
  leaderOverlay.hidden = false;
  leaderCloseBtn.focus();
}

function closeLeaderboard() {
  modalOpen = false;
  leaderOverlay.hidden = true;
  leaderBtn.focus();
}

function rankLabel(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

function renderLeaderboard() {
  for (const tab of leaderTabsEl.children) {
    const active = tab.dataset.difficulty === leaderDifficulty;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  }

  const entries = (readLeaderboard()[leaderDifficulty] || []).slice(0, LEADERBOARD_MAX);
  leaderListEl.innerHTML = '';

  if (entries.length === 0) {
    leaderEmptyEl.hidden = false;
    leaderClearBtn.disabled = true;
    return;
  }
  leaderEmptyEl.hidden = true;
  leaderClearBtn.disabled = false;

  const fragment = document.createDocumentFragment();
  entries.forEach((entry, index) => {
    const rank = index + 1;
    const row = document.createElement('div');
    row.className = 'leader-row' + (rank <= 3 ? ` rank-${rank}` : '');
    row.setAttribute('role', 'listitem');

    const rankEl = document.createElement('span');
    rankEl.className = 'leader-rank';
    rankEl.textContent = rankLabel(rank);

    const timeEl = document.createElement('span');
    timeEl.className = 'leader-time';
    timeEl.textContent = formatTime(entry.time);

    const metaEl = document.createElement('span');
    metaEl.className = 'leader-meta';
    metaEl.textContent = `错 ${entry.mistakes} · ${formatLeaderDate(entry.date)}`;

    row.append(rankEl, timeEl, metaEl);
    fragment.appendChild(row);
  });
  leaderListEl.appendChild(fragment);
}

function shareScore() {
  if (!state || !state.completed) return;
  const text = [
    `🧩 数独 · ${DIFFICULTIES[state.difficulty].label}`,
    `⏱ 用时 ${formatTime(state.elapsed)}`,
    `❌ 错误 ${state.mistakes}`,
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

function save() {
  if (!state) return;
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
        elapsed: state.elapsed,
        selected: state.selected,
      })
    );
  } catch {
    /* storage unavailable */
  }
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
    elapsed: Math.max(0, Number(data.elapsed) || 0),
    paused: false,
    completed: false,
    undo: [],
  };
}

function tick() {
  if (!state || state.completed || state.paused || modalOpen) return;
  state.elapsed += 1;
  timerEl.textContent = formatTime(state.elapsed);
  if (state.elapsed % 15 === 0) save();
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

  leaderBtn.addEventListener('click', openLeaderboard);
  leaderCloseBtn.addEventListener('click', closeLeaderboard);
  leaderClearBtn.addEventListener('click', () => {
    clearLeaderboard(leaderDifficulty);
    renderLeaderboard();
    announce(`已清空${DIFFICULTIES[leaderDifficulty].label}排行榜`);
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

  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
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

  window.setInterval(tick, 1000);
}

init();
