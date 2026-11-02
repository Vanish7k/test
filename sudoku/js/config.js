/**
 * 全局排行榜配置（Supabase）
 *
 * 填好下面两项后，游戏里的“全球”榜才会启用；留空则只用本机排行榜。
 * 这两项都是公开信息，可以放在前端代码里 —— 真正的权限由 Supabase 的 RLS 策略控制。
 *
 * supabaseUrl:    项目设置 → API → Project URL，形如 https://abcdefgh.supabase.co
 * supabaseAnonKey: 项目设置 → API → anon public key
 */
window.SUDOKU_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  table: 'sudoku_scores',
};
