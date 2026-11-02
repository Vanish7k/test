/**
 * Supabase REST 客户端（全球排行榜）
 * 不引入 SDK，直接走 PostgREST 接口，避免额外体积。
 */
const RemoteBoard = (() => {
  const cfg = window.SUDOKU_CONFIG || {};
  const url = String(cfg.supabaseUrl || '').replace(/\/+$/, '');
  const key = String(cfg.supabaseAnonKey || '');
  const table = cfg.table || 'sudoku_scores';
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

  async function request(path, options = {}, timeout = 9000) {
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
        throw new Error(`HTTP ${res.status}${body ? ` ${body.slice(0, 120)}` : ''}`);
      }
      return res;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('连接超时');
      throw error;
    } finally {
      clearTimeout(timer);
    }
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

  function clearCache() {
    cache.clear();
  }

  return { enabled, top, submit, clearCache };
})();
