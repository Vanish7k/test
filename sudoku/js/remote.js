/**
 * Supabase REST 客户端（全球排行榜）
 * 不引入 SDK，直接走 PostgREST 接口，避免额外体积。
 */
const RemoteBoard = (() => {
  const cfg = window.SUDOKU_CONFIG || {};
  const url = String(cfg.supabaseUrl || '').replace(/\/+$/, '');
  const key = String(cfg.supabaseAnonKey || '');
  const table = cfg.table || 'sudoku_scores';
  const table2048 = cfg.table2048 || 'game2048_scores';
  const enabled = Boolean(url && key);
  const cache = new Map();
  const CACHE_MS = 60_000;

  function headers(extra) {
    const base = {
      apikey: key,
      'Content-Type': 'application/json',
    };
    // 旧版 anon key 是 JWT，需要同时放在 Authorization 里；
    // 新版 publishable key（sb_publishable_…）只需 apikey 头。
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

        // POST/PUT 等写操作不重试（避免重复提交）
        if (!RETRYABLE_METHODS.has(method)) {
          if (isAbort) throw new Error('请求超时，请检查网络');
          throw error;
        }

        // 只有网络抖动 / 5xx 才重试；4xx 直接失败
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

  async function top(difficulty, limit = 10, { force = false } = {}) {
    if (!enabled) throw new Error('未配置 Supabase');
    const cached = cache.get(difficulty);
    if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.rows;

    const query = [
      `select=id,nickname,time,mistakes,hints_used,created_at,difficulty`,
      `difficulty=eq.${encodeURIComponent(difficulty)}`,
      `order=time.asc,hints_used.asc,mistakes.asc`,
      `limit=${limit}`,
    ].join('&');
    const res = await request(`${table}?${query}`);
    const rows = await res.json();
    const list = Array.isArray(rows) ? rows : [];
    cache.set(difficulty, { at: Date.now(), rows: list });
    return list;
  }

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
    cache.delete(entry.difficulty);
    return row || {};
  }

  async function top2048(limit = 10, { force = false } = {}) {
    if (!enabled) throw new Error('未配置 Supabase');
    const cached = cache.get('2048');
    if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.rows;

    const query = [
      'select=id,nickname,score,max_tile,created_at',
      'order=score.desc,max_tile.desc,created_at.asc',
      `limit=${limit}`,
    ].join('&');
    const res = await request(`${table2048}?${query}`);
    const rows = await res.json();
    const list = Array.isArray(rows) ? rows : [];
    cache.set('2048', { at: Date.now(), rows: list });
    return list;
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
    cache.delete('2048');
    return row || {};
  }

  function clearCache() {
    cache.clear();
  }

  return { enabled, top, submit, top2048, submit2048, clearCache };
})();

const RemoteBoard2048 = RemoteBoard;
