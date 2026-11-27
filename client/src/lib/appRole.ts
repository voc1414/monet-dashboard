/*
 * この画面が誰向けにビルドされたか（2026-08-31 スタッフ向け／管理者向けの仕分け）。
 *
 * 同じコードを2回ビルドして別URLで配信する。ビルド時に確定するので、
 * 未使用側のページはルートに登録されず、バンドルにも積まれない。
 *   VITE_ROLE 未指定 / staff … スタッフ向け（既存URL。広告・設定は無い）
 *   VITE_ROLE=admin      … 管理者向け（新URL。既存の全タブ＋広告＋設定）
 *
 * 既定を staff にしてあるのは安全側に倒すため。指定を忘れたビルドで
 * 広告費がスタッフに出るより、管理者の画面が足りない方が事故が小さい。
 *
 * 管理者向けビルドだけ、画面上の切替（contexts/ViewRole.tsx）で
 * 「今スタッフ向けと同じ中身を見る」ことができる。実効ロールの計算は
 * effectiveRole。スタッフ向けビルドは保存値に関係なく常に staff。
 */
export const IS_ADMIN_BUILD = import.meta.env.VITE_ROLE === "admin";

export type AppRole = "admin" | "staff";

/** 管理者ビルドの表示切替。値は "admin" | "staff"。 */
export const VIEW_ROLE_STORAGE_KEY = "monet.viewRole";

/**
 * 実効ロール。スタッフ向けビルドは常に staff。
 * 管理者向けビルドは保存値が "staff" のときだけ staff、それ以外は admin。
 */
export function effectiveRole(isAdminBuild: boolean, stored: string | null | undefined): AppRole {
  if (!isAdminBuild) return "staff";
  return stored === "staff" ? "staff" : "admin";
}

function pathOnly(location: string): string {
  const path = (location || "/").split("?")[0].split("#")[0];
  return path === "" ? "/" : path;
}

/**
 * スタッフ向けサイトにページが無い画面。
 * 「/」は店舗一覧（店舗ごとの売上）なのでスタッフには出さない。
 */
export function isAdminOnlyLocation(location: string): boolean {
  const path = pathOnly(location);
  if (path === "/") return true;
  if (/^\/survey\/.+/.test(path)) return true;
  const prefixes = [
    "/store",
    "/employment",
    "/next-reservation",
    "/ads",
    "/diagnosis",
    "/google-map",
    "/auto-tasks",
    "/admin",
  ];
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * スタッフ表示のとき、その画面に留まれなければ送り先を返す。
 * 店舗のアンケート詳細だけはスタッフ向けと同じくアンケート一覧へ戻す。
 */
export function staffModeRedirect(location: string, role: AppRole): "/staff" | "/survey" | null {
  if (role === "admin") return null;
  const path = pathOnly(location);
  if (/^\/survey\/.+/.test(path)) return "/survey";
  if (isAdminOnlyLocation(path)) return "/staff";
  return null;
}
