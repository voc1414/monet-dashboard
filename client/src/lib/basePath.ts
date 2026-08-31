/*
 * 配信サブパスを付けた絶対パスを作る（2026-08-31）。
 *
 * GitHub Pages ではサイトが /monet-dashboard/ 配下に置かれ、さらにスタッフ向け／
 * 管理者向けの2ビルドで /monet-dashboard/admin-view/ も入口になる。
 * wouter の Link / navigate は Router base が自動で付くが、
 * window.location.href への直代入は付かないので、サイトの外へ飛んでしまう。
 * 画面遷移を location で行う箇所は必ずこれを通す。
 */
export function withBasePath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}${path}`;
}
