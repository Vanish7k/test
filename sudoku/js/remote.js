/**
 * Supabase REST 客户端（全球排行榜）
 * 不引入 SDK，直接走 PostgREST 接口，避免额外体积。
 *
 * 缓存策略：SWR（stale-while-revalidate）
 *   - 内存缓存 5 分钟（同会话内秒开）
 *   - localStorage 持久化（跨会话防冷启动）
 *   - 有缓存时立刻返回，无缓存才阻塞 fetch
 *   - 返回值：Promise<{ rows, fromCache, stale, error }>
 *     rows       —— 可用数据（可能是旧缓存，可能是新数据）
 *     fromCache  —— true 表示 rows 来自缓存
 *     stale      —— true 表示 rows 是缓存，后台正在静默刷新
 *     error      —— 远程请求失败的原因（只有在完全没缓存时才会有）
 */
const RemoteBoard = (() => {
  const cfg = window.SUDOKU_CONFIG || {};
  const url = String(cfg.supabaseUrl || '').replace(/\/+$/, '');
  const key = String(cfg.supabaseAnonKey || '');
  const table = cfg.table || 'sudoku_scores';
  const table2048 = cfg.table2048 || 'game2048_scores';
  const enabled = Boolean(url && key);
  const memCache = new Map();
  const MEM_MS = 5 * 60_000;
  const LS_PREFIX = 'sudoku_board_';

  // localStorage 安全封装（隐私模式/沙盒环境可能抛错）
  function lsGet(k) {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  }
  function lsDel(k) {
    try { localStorage.removeItem(k); } catch {}
  }

  function headers(extra) {
    const base = {
      apikey: key,
      'Content-Type': 'application/json',
    };
    if (!/^sb_publishable_/.test(key)) {
      base.Authorization = `Bearer ${key}`;
    }
    return Object.assign(base, extra || {});
  }

  const RETRYABLE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

  async function request(path, options = {}, timeout = 9000) {
    const method = (options.method || 'GET').toUpperCase();
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(`${url}/rest/v1/${path}`, {
          ...options,
          headers: headers(options.headers),
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          const err = new Error(`HTTP ${res.status}`);
          err.status = res.status;
          err.bodyPreview = body.slice(0, 120);
          throw err;
        }
        clearTimeout(timer);
        return res;
      } catch (error) {
        clearTimeout(timer);
        lastError = error;

        const isAbort = error.name === 'AbortError';
        const isTimeout = isAbort || error.message === 'Failed to fetch';
        const isServerError = error.status !== undefined && error.status >= 500 && error.status < 600;

        if (!RETRYABLE_METHODS.has(method)) {
          if (isAbort) throw new Error('请求超时，请检查网络');
          throw error;
        }

        if (!isTimeout && !isServerError) throw error;

        if (attempt >= 3) break;
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }

    const userMsg =
      lastError && lastError.status
        ? `全球榜暂时不可用（${lastError.status}）`
        : '全球榜连接失败，请稍后重试';
    const err = new Error(userMsg);
    err.cause = lastError;
    throw err;
  }

  /** 内部：真正的远程 fetch + 双写 mem + ls */
  async function _fetchAndCache(cacheKey, query) {
    const res = await request(query);
    const rows = await res.json();
    const list = Array.isArray(rows) ? rows : [];
    const entry = { at: Date.now(), rows: list };
    memCache.set(cacheKey, entry);
    lsSet(LS_PREFIX + cacheKey, entry);
    return list;
  }

  /** 后台静默刷新，不抛错 */
  function _backgroundRefresh(cacheKey, query) {
    _fetchAndCache(cacheKey, query).catch(() => {});
  }

  // ---------- 数独榜 ----------
  function _sudokuQuery(difficulty, limit) {
    return `${table}?${[
      `select=id,nickname,time,mistakes,hints_used,created_at,difficulty`,
      `difficulty=eq.${encodeURIComponent(difficulty)}`,
      `order=time.asc,hints_used.asc,mistakes.asc`,
      `limit=${limit}`,
    ].join('&')}`;
  }

  async function top(difficulty, limit = 10, { force = false } = {}) {
    if (!enabled) throw new Error('未配置 Supabase');
    const ck = difficulty;
    const query = _sudokuQuery(difficulty, limit);

    const mem = memCache.get(ck);
    const ls = lsGet(LS_PREFIX + ck);
    const freshMem = mem && Date.now() - mem.at < MEM_MS;

    // 1. 强制刷新 或 内存过期（但内存里有数据）→ 阻塞 fetch，失败降级到缓存
    if (force || (mem && !freshMem)) {
      try {
        const rows = await _fetchAndCache(ck, query);
        return { rows, fromCache: false, stale: false, error: null };
      } catch (e) {
        const fallback = (ls && ls.rows) ? ls.rows : (mem ? mem.rows : null);
        if (fallback) return { rows: fallback, fromCache: true, stale: true, error: e };
        return { rows: [], fromCache: false, stale: false, error: e };
      }
    }

    // 2. 内存新鲜 → 直接返回，且如果上次刷新已超过 1min 则后台静默刷新
    if (freshMem) {
      if (Date.now() - mem.at > 60_000) _backgroundRefresh(ck, query);
      return { rows: mem.rows, fromCache: false, stale: false, error: null };
    }

    // 3. 内存没，但 ls 有 → 立刻返回 ls，后台静默刷新
    if (ls && ls.rows) {
      _backgroundRefresh(ck, query);
      return { rows: ls.rows, fromCache: true, stale: true, error: null };
    }

    // 4. 完全没缓存 → 阻塞 fetch
    try {
      const rows = await _fetchAndCache(ck, query);
      return { rows, fromCache: false, stale: false, error: null };
    } catch (e) {
      return { rows: [], fromCache: false, stale: false, error: e };
    }
  }

  // ---------- 2048 榜 ----------
  const CK_2048 = '2048';

  function _2048Query(limit) {
    return `${table2048}?${[
      'select=id,nickname,score,max_tile,created_at',
      'order=score.desc,max_tile.desc,created_at.asc',
      `limit=${limit}`,
    ].join('&')}`;
  }

  async function top2048(limit = 10, { force = false } = {}) {
    if (!enabled) throw new Error('未配置 Supabase');
    const query = _2048Query(limit);

    const mem = memCache.get(CK_2048);
    const ls = lsGet(LS_PREFIX + CK_2048);
    const freshMem = mem && Date.now() - mem.at < MEM_MS;

    if (force || (mem && !freshMem)) {
      try {
        const rows = await _fetchAndCache(CK_2048, query);
        return { rows, fromCache: false, stale: false, error: null };
      } catch (e) {
        const fallback = (ls && ls.rows) ? ls.rows : (mem ? mem.rows : null);
        if (fallback) return { rows: fallback, fromCache: true, stale: true, error: e };
        return { rows: [], fromCache: false, stale: false, error: e };
      }
    }

    if (freshMem) {
      if (Date.now() - mem.at > 60_000) _backgroundRefresh(CK_2048, query);
      return { rows: mem.rows, fromCache: false, stale: false, error: null };
    }

    if (ls && ls.rows) {
      _backgroundRefresh(CK_2048, query);
      return { rows: ls.rows, fromCache: true, stale: true, error: null };
    }

    try {
      const rows = await _fetchAndCache(CK_2048, query);
      return { rows, fromCache: false, stale: false, error: null };
    } catch (e) {
      return { rows: [], fromCache: false, stale: false, error: e };
    }
  }

  // ---------- 提交 ----------
  async function submit(entry) {
    if (!enabled) throw new Error('未配置 Supabase');
    const res = await request(table, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        nickname: entry.nickname,
        difficulty: entry.difficulty,
        time: entry.time,
        mistakes: entry.mistakes,
        hints_used: entry.hintsUsed || 0,
      }),
    });
    const rows = await res.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : rows;
    memCache.delete(entry.difficulty);
    lsDel(LS_PREFIX + entry.difficulty);
    return row || {};
  }

  async function submit2048(entry) {
    if (!enabled) throw new Error('未配置 Supabase');
    const res = await request(table2048, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        nickname: entry.nickname,
        score: entry.score,
        max_tile: entry.maxTile || 0,
      }),
    });
    const rows = await res.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : rows;
    memCache.delete(CK_2048);
    lsDel(LS_PREFIX + CK_2048);
    return row || {};
  }

  function clearCache() {
    memCache.clear();
    try {
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const k = localStorage.key(i);
        if (k && k.startsWith(LS_PREFIX)) lsDel(k);
      }
    } catch {}
  }

  return { enabled, top, submit, top2048, submit2048, clearCache };
})();

const RemoteBoard2048 = RemoteBoard;
