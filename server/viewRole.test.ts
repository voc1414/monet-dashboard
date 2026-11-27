/**
 * 管理者ビルドの「管理者 / スタッフ」表示切替。
 * 実効ロールの正本は appRole.effectiveRole。スタッフ向けビルドは切替を描かない。
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  VIEW_ROLE_STORAGE_KEY,
  effectiveRole,
  isAdminOnlyLocation,
  staffModeRedirect,
} from "../client/src/lib/appRole";
import { visibleMainTabs } from "../client/src/lib/navItems";

function readClientSource(relative: string): string {
  return readFileSync(path.resolve(import.meta.dirname, "../client/src", relative), "utf8");
}

function installStorage(initial: Record<string, string> = {}) {
  const mem = new Map(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => (mem.has(key) ? mem.get(key)! : null),
    setItem: (key: string, value: string) => {
      mem.set(key, value);
    },
    removeItem: (key: string) => {
      mem.delete(key);
    },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("実効ロール（切替の正本）", () => {
  it("スタッフ向けビルドは保存値が admin でも staff", () => {
    expect(effectiveRole(false, "admin")).toBe("staff");
    expect(effectiveRole(false, "staff")).toBe("staff");
    expect(effectiveRole(false, null)).toBe("staff");
  });

  it("管理者向けビルドは保存が staff のときだけ staff、それ以外は admin", () => {
    expect(effectiveRole(true, "staff")).toBe("staff");
    expect(effectiveRole(true, "admin")).toBe("admin");
    expect(effectiveRole(true, null)).toBe("admin");
    expect(effectiveRole(true, "other")).toBe("admin");
  });

  it("スタッフ表示では管理者専用の画面へ行かせず、共有画面は残す", () => {
    expect(staffModeRedirect("/", "staff")).toBe("/staff");
    expect(staffModeRedirect("/store/堀江院", "staff")).toBe("/staff");
    expect(staffModeRedirect("/store/堀江院/nps", "staff")).toBe("/staff");
    expect(staffModeRedirect("/ads", "staff")).toBe("/staff");
    expect(staffModeRedirect("/employment", "staff")).toBe("/staff");
    expect(staffModeRedirect("/next-reservation", "staff")).toBe("/staff");
    expect(staffModeRedirect("/next-reservation/堀江院/山田", "staff")).toBe("/staff");
    expect(staffModeRedirect("/google-map", "staff")).toBe("/staff");
    expect(staffModeRedirect("/auto-tasks", "staff")).toBe("/staff");
    expect(staffModeRedirect("/admin", "staff")).toBe("/staff");
    expect(staffModeRedirect("/admin/stores", "staff")).toBe("/staff");
    // 店舗のアンケート詳細はスタッフ向けサイトと同じく一覧へ戻す
    expect(staffModeRedirect("/survey/堀江院", "staff")).toBe("/survey");
    expect(staffModeRedirect("/staff", "staff")).toBeNull();
    expect(staffModeRedirect("/staff/堀江院/山田", "staff")).toBeNull();
    expect(staffModeRedirect("/survey", "staff")).toBeNull();
    expect(staffModeRedirect("/counseling", "staff")).toBeNull();
    // 管理者表示では送らない
    expect(staffModeRedirect("/ads", "admin")).toBeNull();
    expect(staffModeRedirect("/", "admin")).toBeNull();
  });

  it("店舗一覧（店舗ごとの売上）は管理者専用の場所", () => {
    expect(isAdminOnlyLocation("/")).toBe(true);
    expect(isAdminOnlyLocation("/staff")).toBe(false);
  });

  it("スタッフ表示のタブは店舗一覧・広告・雇用形態を含まない", () => {
    const role = effectiveRole(true, "staff");
    const hrefs = visibleMainTabs(role === "admin").map((t) => t.href);
    expect(hrefs).toEqual(["/staff", "/survey", "/counseling"]);
    expect(hrefs).not.toContain("/");
    expect(hrefs).not.toContain("/ads");
    expect(hrefs).not.toContain("/employment");
  });
});

describe("表示切替の描画", () => {
  it("スタッフ向けビルドは切替を描かない（保存値が admin でも）", async () => {
    installStorage({ [VIEW_ROLE_STORAGE_KEY]: "admin" });
    vi.stubEnv("VITE_ROLE", "staff");
    vi.resetModules();
    const { RoleViewSwitch } = await import("../client/src/components/RoleViewSwitch");
    const { ViewRoleProvider, useEffectiveRole: useRole } = await import(
      "../client/src/contexts/ViewRole"
    );

    function Probe() {
      const role = useRole();
      const tabs = visibleMainTabs(role === "admin");
      return createElement(
        "div",
        null,
        createElement(RoleViewSwitch),
        createElement(
          "nav",
          null,
          tabs.map((t) => createElement("span", { key: t.href }, t.href)),
        ),
        role === "admin" ? createElement("section", null, "店舗ごとの売上") : null,
      );
    }

    const html = renderToStaticMarkup(
      createElement(ViewRoleProvider, null, createElement(Probe)),
    );
    expect(html).not.toContain("表示の切替");
    expect(html).not.toContain("店舗ごとの売上");
    expect(html).toContain("/staff");
    expect(html).not.toContain("<span>/ads</span>");
    expect(html).not.toContain("<span>/</span>");
  });

  it("管理者ビルドのスタッフ表示は切替を出し、管理者専用のタブと店舗売上を隠す", async () => {
    installStorage({ [VIEW_ROLE_STORAGE_KEY]: "staff" });
    vi.stubEnv("VITE_ROLE", "admin");
    vi.resetModules();
    const { RoleViewSwitch } = await import("../client/src/components/RoleViewSwitch");
    const { ViewRoleProvider, useEffectiveRole } = await import("../client/src/contexts/ViewRole");
    const { staffModeRedirect: redirect } = await import("../client/src/lib/appRole");

    function Probe() {
      const role = useEffectiveRole();
      const tabs = visibleMainTabs(role === "admin");
      return createElement(
        "div",
        null,
        createElement(RoleViewSwitch),
        createElement(
          "nav",
          null,
          tabs.map((t) => createElement("span", { key: t.href }, t.href)),
        ),
        role === "admin" ? createElement("section", null, "店舗ごとの売上") : null,
        redirect("/", role) ? createElement("p", null, "店舗一覧は非表示") : null,
        redirect("/ads", role) ? createElement("p", null, "広告は非表示") : null,
        redirect("/employment", role) ? createElement("p", null, "雇用形態は非表示") : null,
        redirect("/staff", role) ? createElement("p", null, "スタッフ一覧まで隠れた") : null,
      );
    }

    const html = renderToStaticMarkup(
      createElement(ViewRoleProvider, null, createElement(Probe)),
    );
    expect(html).toContain('aria-label="表示の切替"');
    expect(html).toContain("管理者");
    expect(html).toContain("スタッフ");
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain("店舗ごとの売上");
    expect(html).toContain("店舗一覧は非表示");
    expect(html).toContain("広告は非表示");
    expect(html).toContain("雇用形態は非表示");
    expect(html).not.toContain("スタッフ一覧まで隠れた");
    expect(html).toContain("/staff");
    expect(html).toContain("/survey");
    expect(html).toContain("/counseling");
    expect(html).not.toContain("/ads");
    expect(html).not.toContain("/employment");
  });

  it("【字面】切替はスタッフ向けビルドの定数で消す", () => {
    const sw = readClientSource("components/RoleViewSwitch.tsx");
    expect(sw).toContain("if (!IS_ADMIN_BUILD) return null");
    const layout = readClientSource("components/DashboardLayout.tsx");
    expect(layout).toContain("IS_ADMIN_BUILD && (");
    expect(layout).toContain("<RoleViewSwitch />");
    expect(layout).toContain("useIsEffectiveAdmin()");
  });
});
