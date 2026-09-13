/*
 * スタッフ向け／管理者向けの画面仕分け（2026-08-31）を固定するテスト。
 * 「広告タブがスタッフに出ない」は運用上の約束なので、ここが崩れたら気づけるようにする。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  MAIN_TABS,
  SETTINGS_PAGES,
  SETTINGS_TAB,
  shouldShowSettingsTab,
  visibleMainTabs,
} from "../client/src/lib/navItems";

function readClientSource(relative: string): string {
  return readFileSync(path.resolve(import.meta.dirname, "../client/src", relative), "utf8");
}

describe("画面の仕分け（スタッフ向け／管理者向け）", () => {
  it("スタッフ向けは4タブで、広告が含まれない", () => {
    const staffTabs = visibleMainTabs(false);
    expect(staffTabs.map((t) => t.href)).toEqual(["/", "/staff", "/survey", "/counseling"]);
    expect(staffTabs.some((t) => t.href === "/ads")).toBe(false);
    expect(staffTabs.some((t) => t.href === "/employment")).toBe(false);
  });

  it("管理者向けは既存の全タブ＋雇用形態別の売上＋広告", () => {
    const adminTabs = visibleMainTabs(true);
    expect(adminTabs.map((t) => t.href)).toEqual([
      "/",
      "/staff",
      "/survey",
      "/counseling",
      "/employment",
      "/ads",
    ]);
  });

  it("雇用形態別の売上・広告・設定は管理者専用フラグが立っている", () => {
    const ads = MAIN_TABS.find((t) => t.href === "/ads");
    expect(ads?.adminOnly).toBe(true);
    // 雇用形態は人事情報。スタッフ同士で見えてはいけない（2026-09-01）
    const employment = MAIN_TABS.find((t) => t.href === "/employment");
    expect(employment?.adminOnly).toBe(true);
    expect(SETTINGS_TAB.adminOnly).toBe(true);
  });

  it("設定の中身は従来の管理ページ4枚", () => {
    expect(SETTINGS_PAGES.map((p) => p.href)).toEqual([
      "/admin",
      "/admin/stores",
      "/admin/staff",
      "/admin/surveys",
    ]);
    // /admin は完全一致で判定しないと配下の全ページで現在地になってしまう
    expect(SETTINGS_PAGES.find((p) => p.href === "/admin")?.exact).toBe(true);
  });

  it("現在地判定：店舗詳細は店舗一覧タブ、NPSは別扱い", () => {
    const home = MAIN_TABS[0];
    expect(home.isActive("/")).toBe(true);
    expect(home.isActive("/store/horie")).toBe(true);
    expect(home.isActive("/store/horie/nps")).toBe(false);
    expect(home.isActive("/staff")).toBe(false);
  });

  it("画面側が実際にこの出し分けを使っている", () => {
    const layout = readClientSource("components/DashboardLayout.tsx");
    expect(layout).toContain("visibleMainTabs(isAdmin)");
    expect(layout).toContain("IS_ADMIN_BUILD");
    // 旧実装のように広告タブを直書きしていない
    expect(layout).not.toContain('href="/ads"');

    const admin = readClientSource("components/AdminLayout.tsx");
    expect(admin).toContain("MAIN_TABS.map");
    expect(admin).toContain("SETTINGS_PAGES.map");
  });

  it("ロールはビルド時に確定し、既定はスタッフ向け", () => {
    const appRole = readClientSource("lib/appRole.ts");
    // 実行時のログイン状態ではなく VITE_ROLE で決める（本番は静的配信でサーバAPIが無い）
    expect(appRole).toContain('import.meta.env.VITE_ROLE === "admin"');
  });

  it("広告と設定のルートは管理者向けビルドにしか登録されない", () => {
    const app = readClientSource("App.tsx");
    const adminOnlyRoutes = [
      "/employment",
      "/ads",
      "/admin/login",
      "/admin",
      "/admin/stores",
      "/admin/staff",
      "/admin/surveys",
    ];
    for (const path of adminOnlyRoutes) {
      // 例: {IS_ADMIN_BUILD && <Route path="/ads" component={Ads} />}
      const guarded = new RegExp(
        `\\{IS_ADMIN_BUILD && <Route path="${path}"[^\\n]*\\/>\\}`,
      );
      expect(app, `${path} が IS_ADMIN_BUILD で囲まれていない`).toMatch(guarded);
    }
    // 素の <Route path="/ads"> が残っていたら常時登録されてしまう
    expect(app).not.toMatch(/^\s*<Route path="\/ads"/m);
    expect(app).not.toMatch(/^\s*<Route path="\/employment"/m);
    expect(app).not.toMatch(/^\s*<Route path="\/admin/m);
  });

  it("location での画面遷移は配信サブパスを付ける", () => {
    // /monet-dashboard/admin-view/ 配下から "/admin/login" へ直に飛ぶとサイトの外に出る
    for (const file of ["hooks/useAdminAuth.ts", "pages/admin/AdminLogin.tsx"]) {
      const src = readClientSource(file);
      expect(src, `${file} に素の絶対パス遷移が残っている`).not.toMatch(
        /window\.location\.href\s*=\s*"\//,
      );
      expect(src).toContain("withBasePath(");
    }
  });
});

/*
 * 設定タブを画面から外した件（2026-09-13）。
 * 設定の4枚は AdminLayout がサーバAPI（/api/trpc の admin.me）で認証を確かめるが、
 * 本番は GitHub Pages の静的配信でそのAPIが無い。押すとログイン画面へ飛ばされ、
 * 何を入れても照合する相手がいないので設定画面には入れない。
 */
describe("設定タブは画面に出さない", () => {
  it("管理者向けビルドでも出さない", () => {
    expect(shouldShowSettingsTab(true)).toBe(false);
  });

  it("スタッフ向けビルドでも出さない", () => {
    expect(shouldShowSettingsTab(false)).toBe(false);
  });

  it("設定ページの定義そのものは消さない（サーバを立て直したら戻せるように）", () => {
    expect(SETTINGS_TAB.href).toBe("/admin");
    expect(SETTINGS_PAGES).toHaveLength(4);
  });

  /*
   * 以下2件はソースの字面を見るだけで、描画そのものは検証していない。
   * vitest は environment: node（DOMなし）で client のコンポーネントを描画できないため、
   * 「設定リンクの表示条件を isAdmin に戻す」という改悪を検出する手段がこれしかない。
   */
  it("【字面検査】設定リンクの表示条件が isAdmin 直参照に戻っていない", () => {
    const layout = readClientSource("components/DashboardLayout.tsx");
    expect(layout).toContain("shouldShowSettingsTab(isAdmin)");
    // 上下2箇所の設定リンクは showSettings で囲う。isAdmin に戻すと管理者に再び出てしまう
    expect(layout).not.toMatch(/\{isAdmin && \(/);
    // 下部ナビの行数判定。いまは主タブ6個なので 6+1 も 6+0 も2行で挙動は変わらないが、
    // 主タブが5個になった将来に「存在しないタブ1個」を数えないための保険
    expect(layout).not.toContain("(isAdmin ? 1 : 0)");
  });

  it("【字面検査】設定画面への案内リンクが画面に残っていない", () => {
    // アンケート画面の未マッチ警告から /admin/surveys へ誘導していた（2026-09-13 に文面ごと差し替え）。
    // 入れない画面へ「ここから追加してください」と誘導すると、タブを消した意味が無くなる
    const survey = readClientSource("pages/SurveyList.tsx");
    expect(survey).not.toContain("/admin");
    expect(survey).toContain("「かな」");
  });
});
