(function () {
  'use strict';

  const SIZE = 4;
  const STORE_KEY = 'paper-2048:state:v1';
  const BEST_KEY = 'paper-2048:best:v1';
  const SCORES_KEY = 'paper-2048:scores:v1';
  const NICK_KEY = 'paper-sudoku:nickname:v1';
  const MERGE_MS = 120;
  const SWIPE_MIN = 22;

  const boardEl = document.getElementById('board');
  const cellsEl = document.getElementById('cells');
  const tilesEl = document.getElementById('tiles');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const undoBtn = document.getElementById('undoBtn');
  const lbBtn = document.getElementById('lbBtn');
  const endBtn = document.getElementById('endBtn');
  const lbEl = document.getElementById('lb');
  const lbSub = document.getElementById('lbSub');
  const lbLocal = document.getElementById('lbLocal');
  const lbGlobal = document.getElementById('lbGlobal');
  const lbClose = document.getElementById('lbClose');
  const lbList = document.getElementById('lbList');
  const lbEmpty = document.getElementById('lbEmpty');
  const lbMsg = document.getElementById('lbMsg');
  const lbNote = document.getElementById('lbNote');
  const overlayEl = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlaySub = document.getElementById('overlaySub');
  const keepBtn = document.getElementById('keepBtn');
  const againBtn = document.getElementById('againBtn');
  const ovGlobal = document.getElementById('ovGlobal');
  const ovNick = document.getElementById('ovNick');
  const ovSubmit = document.getElementById('ovSubmit');
  const ovMsg = document.getElementById('ovMsg');

  let grid = new Array(SIZE * SIZE).fill(null);
  let score = 0;
  let best = 0;
  let over = false;
  let keepPlaying = false;
  let winShown = false;
  let history = [];
  let tiles = new Map();
  let nextId = 1;
  let cellSize = 70;
  let gap = 10;
  let pendingSpawn = 0;
  let pendingRemovals = [];
  let pointerStart = null;
  let runSaved = false;

  // ---------- 背景格 ----------

  for (let i = 0; i < SIZE * SIZE; i += 1) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cellsEl.appendChild(cell);
  }

  // ---------- 尺寸 ----------

  function measure() {
    const width = boardEl.clientWidth;
    if (!width) return;
    gap = Math.max(6, Math.round(width * 0.026));
    cellSize = (width - gap * 5) / 4;
    boardEl.style.setProperty('--gap', gap + 'px');
    tilesEl.classList.add('no-anim');
    tiles.forEach((rec) => {
      rec.wrap.style.width = cellSize + 'px';
      rec.wrap.style.height = cellSize + 'px';
      rec.face.style.fontSize = fontSizeFor(rec.value) + 'px';
      place(rec, rec.index);
    });
    window.requestAnimationFrame(() => tilesEl.classList.remove('no-anim'));
  }

  function fontSizeFor(value) {
    const digits = String(value).length;
    if (digits <= 2) return cellSize * 0.42;
    if (digits === 3) return cellSize * 0.33;
    if (digits === 4) return cellSize * 0.26;
    return cellSize * 0.21;
  }

  function valueClass(value) {
    return value <= 2048 ? 'v' + value : 'v-super';
  }

  // ---------- 图块 DOM ----------

  function createTileEl(tile, index) {
    const wrap = document.createElement('div');
    wrap.className = 'tile';
    const face = document.createElement('div');
    const span = document.createElement('span');
    face.appendChild(span);
    wrap.appendChild(face);
    tilesEl.appendChild(wrap);

    const rec = { wrap, face, span, value: tile.value, index };
    tiles.set(tile.id, rec);

    wrap.style.width = cellSize + 'px';
    wrap.style.height = cellSize + 'px';
    setFace(rec, tile.value);
    place(rec, index);
    return rec;
  }

  function setFace(rec, value) {
    rec.value = value;
    rec.face.className = 'face ' + valueClass(value);
    rec.span.textContent = String(value);
    rec.face.style.fontSize = fontSizeFor(value) + 'px';
  }

  function place(rec, index) {
    rec.index = index;
    const r = Math.floor(index / SIZE);
    const c = index % SIZE;
    rec.wrap.style.transform =
      'translate3d(' + c * (cellSize + gap) + 'px, ' + r * (cellSize + gap) + 'px, 0)';
  }

  function popTile(id) {
    const rec = tiles.get(id);
    if (!rec) return;
    rec.face.classList.remove('pop');
    void rec.face.offsetWidth;
    rec.face.classList.add('pop');
  }

  // ---------- 生成与清理 ----------

  function spawnNow() {
    const empty = [];
    for (let i = 0; i < SIZE * SIZE; i += 1) if (!grid[i]) empty.push(i);
    if (!empty.length) return;
    const index = empty[(Math.random() * empty.length) | 0];
    const tile = { id: nextId++, value: Math.random() < 0.9 ? 2 : 4 };
    grid[index] = tile;
    const rec = createTileEl(tile, index);
    rec.face.classList.add('spawn');
    rec.face.addEventListener('animationend', () => rec.face.classList.remove('spawn'), {
      once: true,
    });
  }

  function scheduleSpawn() {
    clearTimeout(pendingSpawn);
    pendingSpawn = window.setTimeout(() => {
      pendingSpawn = 0;
      spawnNow();
      save();
      checkOver();
    }, MERGE_MS);
  }

  function flushSpawn() {
    if (!pendingSpawn) return;
    clearTimeout(pendingSpawn);
    pendingSpawn = 0;
    spawnNow();
  }

  function flushRemovals() {
    pendingRemovals.forEach((item) => {
      clearTimeout(item.timer);
      const rec = tiles.get(item.id);
      if (rec) rec.wrap.remove();
      tiles.delete(item.id);
    });
    pendingRemovals = [];
  }

  function rebuild(values) {
    flushRemovals();
    flushSpawn();
    tiles.forEach((rec) => rec.wrap.remove());
    tiles.clear();
    grid = new Array(SIZE * SIZE).fill(null);

    values.forEach((value, index) => {
      if (!value) return;
      const tile = { id: nextId++, value };
      grid[index] = tile;
      createTileEl(tile, index);
    });
  }

  function hideOverlay() {
    overlayEl.hidden = true;
  }

  function clearBoard() {
    rebuild(new Array(SIZE * SIZE).fill(0));
    over = false;
    keepPlaying = false;
    winShown = false;
    hideOverlay();
  }

  function reset() {
    recordRun();
    clearBoard();
    score = 0;
    history = [];
    runSaved = false;
    spawnNow();
    spawnNow();
    updateHud();
    save();
  }

  // ---------- 结束这一局 ----------

  function finishRun() {
    if (!overlayEl.hidden || !lbEl.hidden) return;
    clearTimeout(pendingSpawn);
    pendingSpawn = 0;
    flushRemovals();
    over = true;
    recordRun();
    showOverlay('over');
    save();
  }

  // ---------- 排行榜 ----------

  let lbScope = 'local';
  let lbRequest = 0;

  function readLocalScores() {
    let list = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(SCORES_KEY) || '[]');
      if (Array.isArray(parsed)) {
        list = parsed.filter((item) => item && Number(item.score) > 0);
      }
    } catch {
      list = [];
    }
    return list.slice(0, 10);
  }

  function formatDay(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const day = date.getTime();
    if (day >= start) return '今天';
    if (day >= start - 86400000) return '昨天';
    const sameYear = date.getFullYear() === now.getFullYear();
    const month = date.getMonth() + 1;
    const d = date.getDate();
    return sameYear ? `${month}月${d}日` : `${date.getFullYear()}年${month}月${d}日`;
  }

  function renderLb(entries) {
    lbList.textContent = '';
    const hasRows = entries.length > 0;
    lbList.hidden = !hasRows;
    lbEmpty.hidden = hasRows;
    entries.forEach((entry, i) => {
      const li = document.createElement('li');
      li.className = 'lb-row';

      const rank = document.createElement('span');
      rank.className = 'lb-rank' + (i < 3 ? ' is-top' : '');
      rank.textContent = i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1);

      const body = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'lb-name';
      name.textContent = entry.name;
      const meta = document.createElement('div');
      meta.className = 'lb-meta';
      meta.textContent = [entry.max ? '最大 ' + entry.max : '', entry.when]
        .filter(Boolean)
        .join(' · ');
      body.appendChild(name);
      body.appendChild(meta);

      const value = document.createElement('span');
      value.className = 'lb-score';
      value.textContent = String(entry.score);

      li.appendChild(rank);
      li.appendChild(body);
      li.appendChild(value);
      lbList.appendChild(li);
    });
  }

  function showScope(scope) {
    lbScope = scope;
    const isLocal = scope === 'local';
    lbLocal.classList.toggle('is-active', isLocal);
    lbGlobal.classList.toggle('is-active', !isLocal);
    lbLocal.setAttribute('aria-selected', String(isLocal));
    lbGlobal.setAttribute('aria-selected', String(!isLocal));
    lbSub.textContent = isLocal ? '本机前 10 名' : '全球前 10 名';
    lbMsg.hidden = true;
    lbMsg.classList.remove('error');
    lbNote.hidden = true;

    if (isLocal) {
      lbRequest += 1;
      renderLb(
        readLocalScores().map((entry) => ({
          name: '本机记录',
          score: entry.score,
          max: entry.max,
          when: formatDay(entry.date),
        }))
      );
      return;
    }
    loadGlobalBoard();
  }

  async function loadGlobalBoard() {
    if (!remoteReady()) {
      renderLb([]);
      lbEmpty.hidden = true;
      lbMsg.hidden = false;
      lbMsg.classList.add('error');
      lbMsg.textContent = '全球榜未配置';
      return;
    }

    const seq = (lbRequest += 1);
    renderLb([]);
    lbEmpty.hidden = true;
    lbMsg.hidden = false;
    lbMsg.classList.remove('error');
    lbMsg.textContent = '加载中…';

    try {
      const rows = await RemoteBoard2048.top2048(10, { force: true });
      if (seq !== lbRequest) return;
      lbMsg.hidden = true;
      renderLb(
        rows.map((row) => ({
          name: row.nickname,
          score: row.score,
          max: row.max_tile,
          when: formatDay(row.created_at),
        }))
      );
      lbNote.hidden = rows.length > 0;
    } catch (error) {
      if (seq !== lbRequest) return;
      renderLb([]);
      lbEmpty.hidden = true;
      lbMsg.hidden = false;
      lbMsg.classList.add('error');
      lbMsg.textContent = `加载失败：${error.message}`;
    }
  }

  function openLeaderboard() {
    if (!lbEl.hidden) return;
    lbEl.hidden = false;
    const raw = localStorage.getItem(SCORES_KEY);
    console.info('[2048排行榜·诊断] key=', SCORES_KEY, '原始值=', raw);
    showScope(lbScope);
  }

  function closeLeaderboard() {
    lbEl.hidden = true;
    lbRequest += 1;
  }


  // ---------- 移动 ----------

  function linesFor(dir) {
    const lines = [];
    for (let i = 0; i < SIZE; i += 1) {
      const line = [];
      for (let j = 0; j < SIZE; j += 1) {
        let index;
        if (dir === 'left') index = i * SIZE + j;
        else if (dir === 'right') index = i * SIZE + (SIZE - 1 - j);
        else if (dir === 'up') index = j * SIZE + i;
        else index = (SIZE - 1 - j) * SIZE + i;
        line.push(index);
      }
      lines.push(line);
    }
    return lines;
  }

  function move(dir) {
    if (over || !overlayEl.hidden || !lbEl.hidden) return;
    if (pendingSpawn) {
      flushSpawn();
      save();
      checkOver();
      if (over || !overlayEl.hidden) return;
    }
    flushRemovals();

    const prev = grid;
    const next = new Array(SIZE * SIZE).fill(null);
    const slides = [];
    let gained = 0;
    let changed = false;

    for (const line of linesFor(dir)) {
      let write = 0;
      for (let k = 0; k < SIZE; k += 1) {
        const tile = prev[line[k]];
        if (!tile) continue;

        const last = write > 0 ? next[line[write - 1]] : null;
        if (last && last.value === tile.value && !last.merged) {
          last.value *= 2;
          last.merged = true;
          gained += last.value;
          slides.push({ id: tile.id, toIndex: line[write - 1], remove: true });
          changed = true;
          continue;
        }

        const toIndex = line[write];
        next[toIndex] = { id: tile.id, value: tile.value, merged: false };
        slides.push({ id: tile.id, toIndex, remove: false });
        if (line[k] !== toIndex) changed = true;
        write += 1;
      }
    }

    if (!changed) return;

    history.push({ values: prev.map((tile) => (tile ? tile.value : 0)), score });
    if (history.length > 20) history.shift();

    score += gained;
    grid = next;

    slides.forEach((slide) => {
      const rec = tiles.get(slide.id);
      if (!rec) return;
      place(rec, slide.toIndex);
      if (slide.remove) {
        const id = slide.id;
        const timer = window.setTimeout(() => {
          const node = tiles.get(id);
          if (node) node.wrap.remove();
          tiles.delete(id);
          pendingRemovals = pendingRemovals.filter((item) => item.id !== id);
        }, MERGE_MS);
        pendingRemovals.push({ id, timer });
      }
    });

    grid.forEach((tile) => {
      if (!tile || !tile.merged) return;
      const rec = tiles.get(tile.id);
      if (rec) {
        setFace(rec, tile.value);
        rec.wrap.style.zIndex = '2';
        window.setTimeout(() => {
          popTile(tile.id);
          rec.wrap.style.zIndex = '';
        }, MERGE_MS);
      }
    });

    updateHud();
    if (!winShown && !keepPlaying && grid.some((tile) => tile && tile.value >= 2048)) {
      winShown = true;
      showOverlay('win');
    }
    scheduleSpawn();
    save();
  }

  // ---------- 状态 ----------

  function canMove() {
    for (let i = 0; i < SIZE * SIZE; i += 1) if (!grid[i]) return true;
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const value = grid[r * SIZE + c].value;
        if (c < SIZE - 1 && grid[r * SIZE + c + 1].value === value) return true;
        if (r < SIZE - 1 && grid[(r + 1) * SIZE + c].value === value) return true;
      }
    }
    return false;
  }


  /**
   * 庆祝动画：五彩纸屑爆裂 + 彩带飘落 + 亮点散开
   */
  function celebrateVictory() {
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const COLORS = ['#edc22e', '#f67c5f', '#77c2e3', '#96ceb4', '#d98cb3', '#6c5ce7', '#ff9f43', '#26de81'];
    const rand = (min, max) => Math.random() * (max - min) + min;

    const layer = document.createElement('div');
    layer.className = 'celebrate-layer';
    document.body.appendChild(layer);

    // 中心爆裂的五彩纸屑（40 片）
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

    // 从顶部飘落的彩带（30 片）
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

    // 亮点光环（20 颗）
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

    // 给 overlay 卡片加弹跳
    const card = document.querySelector('.ov-card');
    if (card) card.classList.add('celebrate-bounce');

    setTimeout(() => {
      layer.remove();
      if (card) card.classList.remove('celebrate-bounce');
    }, 5000);
  }

  function checkOver() {
    if (over || !overlayEl.hidden) return;
    if (canMove()) return;
    over = true;
    recordRun();
    showOverlay('over');
    save();
  }

  function showOverlay(kind) {
    if (kind === 'win') {
      overlayTitle.textContent = '达成 2048';
      overlaySub.textContent = '分数 ' + score + ' · 还能继续冲更高';
      keepBtn.hidden = false;
      ovGlobal.hidden = true;
    } else {
      overlayTitle.textContent = '没有可移动的格子了';
      overlaySub.textContent = '本局得分 ' + score;
      keepBtn.hidden = true;
      ovGlobal.hidden = !(remoteReady() && score > 0);
      ovMsg.hidden = true;
      ovNick.value = readNickname();
    }
    overlayEl.hidden = false;
    if (kind === "win") celebrateVictory();
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    if (score > best) {
      best = score;
      try {
        localStorage.setItem(BEST_KEY, String(best));
      } catch {
        /* ignore */
      }
    }
    bestEl.textContent = String(best);
    undoBtn.disabled = history.length === 0;
  }

  // ---------- 成绩记录 ----------

  function maxTile() {
    let max = 0;
    grid.forEach((tile) => {
      if (tile && tile.value > max) max = tile.value;
    });
    return max;
  }

  function recordRun() {
    if (runSaved || score <= 0) return;
    runSaved = true;
    const entry = { score, max: maxTile(), date: Date.now() };
    let list = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(SCORES_KEY) || '[]');
      if (Array.isArray(parsed)) list = parsed.filter((item) => item && Number(item.score) > 0);
    } catch {
      list = [];
    }
    list.push(entry);
    list.sort((a, b) => Number(b.score) - Number(a.score) || Number(a.date) - Number(b.date));
    list.length = Math.min(list.length, 20);
    try {
      localStorage.setItem(SCORES_KEY, JSON.stringify(list));
    } catch {
      /* storage unavailable */
    }
  }

  function normalizeNick(value) {
    return String(value || '')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12);
  }

  function readNickname() {
    try {
      return localStorage.getItem(NICK_KEY) || '';
    } catch {
      return '';
    }
  }

  function setOvMsg(text, error) {
    ovMsg.hidden = false;
    ovMsg.textContent = text;
    ovMsg.classList.toggle('error', Boolean(error));
  }

  function remoteReady() {
    return typeof RemoteBoard2048 !== 'undefined' && RemoteBoard2048.enabled;
  }

  async function submitGlobal() {
    if (!remoteReady() || ovSubmit.disabled) return;
    const name = normalizeNick(ovNick.value);
    ovNick.value = name;
    if (name.length < 2) {
      setOvMsg('昵称需要 2-12 个字符', true);
      return;
    }
    ovSubmit.disabled = true;
    setOvMsg('提交中…', false);
    try {
      await RemoteBoard2048.submit2048({ nickname: name, score, maxTile: maxTile() });
      try {
        localStorage.setItem(NICK_KEY, name);
      } catch {
        /* storage unavailable */
      }
      setOvMsg('已提交，可在本页右上角排行榜查看', false);
    } catch (error) {
      setOvMsg(`提交失败：${error.message}`, true);
    } finally {
      ovSubmit.disabled = false;
    }
  }

  // ---------- 存档 ----------

  function save() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          values: grid.map((tile) => (tile ? tile.value : 0)),
          score,
          keepPlaying,
        })
      );
    } catch {
      /* storage unavailable */
    }
  }

  function restore() {
    let data = null;
    try {
      data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    } catch {
      data = null;
    }
    if (!data || !Array.isArray(data.values) || data.values.length !== SIZE * SIZE) {
      return false;
    }

    clearBoard();
    score = Number(data.score) || 0;
    keepPlaying = Boolean(data.keepPlaying);
    winShown = keepPlaying;

    const values = data.values.map((value) => (Number(value) > 0 ? Number(value) : 0));
    if (!values.some(Boolean)) return false;

    values.forEach((value, index) => {
      if (!value) return;
      const tile = { id: nextId++, value };
      grid[index] = tile;
      createTileEl(tile, index);
    });

    over = !canMove();
    updateHud();
    if (over) showOverlay('over');
    return true;
  }

  // ---------- 撤销与重开 ----------

  function undo() {
    const snapshot = history.pop();
    if (!snapshot) return;
    rebuild(snapshot.values);
    score = snapshot.score;
    over = false;
    winShown = keepPlaying;
    hideOverlay();
    updateHud();
    save();
  }

  // ---------- 输入 ----------

  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Escape' && !lbEl.hidden) {
      event.preventDefault();
      closeLeaderboard();
      return;
    }
    const key = event.key.toLowerCase();
    const dir = {
      arrowleft: 'left',
      arrowright: 'right',
      arrowup: 'up',
      arrowdown: 'down',
      a: 'left',
      d: 'right',
      w: 'up',
      s: 'down',
    }[key];
    if (!dir) return;
    event.preventDefault();
    move(dir);
  });

  boardEl.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });

  boardEl.addEventListener('pointerup', (event) => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    if (Math.abs(dx) >= Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
    else move(dy > 0 ? 'down' : 'up');
  });

  boardEl.addEventListener('pointercancel', () => {
    pointerStart = null;
  });

  // ---------- 按钮 ----------

  undoBtn.addEventListener('click', undo);
  endBtn.addEventListener('click', finishRun);
  lbBtn.addEventListener('click', openLeaderboard);
  lbClose.addEventListener('click', closeLeaderboard);
  lbLocal.addEventListener('click', () => showScope('local'));
  lbGlobal.addEventListener('click', () => showScope('global'));
  lbEl.addEventListener('click', (event) => {
    if (event.target === lbEl) closeLeaderboard();
  });

  keepBtn.addEventListener('click', () => {
    keepPlaying = true;
    winShown = true;
    hideOverlay();
    save();
  });

  againBtn.addEventListener('click', reset);
  ovSubmit.addEventListener('click', submitGlobal);

  // ---------- 初始化 ----------

  function init() {
    try {
      best = Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      best = 0;
    }
    measure();
    if (!restore()) reset();
    updateHud();
    measure();

    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(measure).observe(boardEl);
    } else {
      window.addEventListener('resize', measure);
    }

    window.addEventListener('pagehide', save);

    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('sw.js').catch(() => {
        /* 离线缓存不可用，不影响游戏 */
      });
    }
  }

  init();

  (function hideAppLoader() {
    const loader = document.getElementById('appLoader');
    if (!loader) return;
    const start = performance.now();
    const MIN = 800, MAX = 3000;
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
})();
