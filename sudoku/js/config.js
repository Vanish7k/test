/**
 * 全局排行榜配置（Supabase）
 *
 * 填好下面两项后，游戏里的“全球”榜才会启用；留空则只用本机排行榜。
 * 这两项都是公开信息，可以放在前端代码里 —— 真正的权限由 Supabase 的 RLS 策略控制。
 *
 * supabaseUrl:    Project Settings → Data API → Project URL，
 *                 形如 https://abcdefghijkl.supabase.co（也可用 https://<项目ref>.supabase.co）
 * supabaseAnonKey: 下面两种都可以，代码都兼容
 *                 - 新版：Settings → API Keys → Publishable key（sb_publishable_… 开头）
 *                 - 旧版：Settings → API Keys → Legacy anon, service_role → anon public（eyJ… 开头）
 */
window.SUDOKU_CONFIG = {
  supabaseUrl: 'https://mnkozzyqusriqszlvepr.supabase.co',
  supabaseAnonKey: 'sb_publishable_f8uUcUb3HRIBiFkuPe1vIw_cd5Fz1hL',
  table: 'sudoku_scores',
  table2048: 'game2048_scores',
};
