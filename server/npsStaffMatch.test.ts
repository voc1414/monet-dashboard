import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isNpsRecordOfStaff, filterNpsRecordsForStaff } from "@/lib/npsStaffMatch";

/**
 * NPSの引き当ては「店舗＋名前」の組で行う（CLAUDE.md §3.1）。
 *
 * 値の形は実データに合わせる：
 * - 店舗は NPS 側 `storeShort`（parseStoreName の出力）＝短縮名「堀江院」「福島院」「堀江院2nd」
 * - スタッフ名は NPS フォームの HPB 掲載名で、ローマ字表示名（Mika / Akiko）が普通に入る
 * - Mika は堀江院＝西本美華／福島院＝松野美香の**別人**（client/src/data/staffMaster.ts）
 */
const rec = (staff: string, storeShort: string, date = "2026-08-01") => ({
  staff,
  storeShort,
  date,
});

describe("isNpsRecordOfStaff（店舗＋名前で引き当てる）", () => {
  it("同じ店舗の同じ名前だけ当たる", () => {
    expect(isNpsRecordOfStaff(rec("Mika", "堀江院"), "Mika", "堀江院")).toBe(true);
  });

  it("同じ表示名でも店舗が違えば当たらない（Mika は堀江院と福島院で別人）", () => {
    expect(isNpsRecordOfStaff(rec("Mika", "福島院"), "Mika", "堀江院")).toBe(false);
    expect(isNpsRecordOfStaff(rec("Mika", "堀江院"), "Mika", "福島院")).toBe(false);
  });

  it("堀江院と堀江院2nd を取り違えない", () => {
    expect(isNpsRecordOfStaff(rec("Sayuri", "堀江院2nd"), "Sayuri", "堀江院")).toBe(false);
    expect(isNpsRecordOfStaff(rec("Sayuri", "堀江院2nd"), "Sayuri", "堀江院2nd")).toBe(true);
  });

  it("空白・大小の登録ゆれは吸収する（NPSシートはスペースなし、報告書はスペースあり）", () => {
    expect(isNpsRecordOfStaff(rec("西本美華", "堀江院"), "西本 美華", "堀江院")).toBe(true);
    expect(isNpsRecordOfStaff(rec("MIKA", "堀江院"), "mika", "堀江院")).toBe(true);
    expect(isNpsRecordOfStaff(rec("Mika", "堀江院 "), "Mika", "堀江院")).toBe(true);
  });

  it("名寄せエイリアス経由でも当たる（akiko → 小池明子）", () => {
    expect(isNpsRecordOfStaff(rec("Akiko", "堀江院"), "小池明子", "堀江院")).toBe(true);
  });

  it("店舗が特定できないときは名前だけで引く（数字を丸ごと消さない）", () => {
    expect(isNpsRecordOfStaff(rec("Mika", "福島院"), "Mika")).toBe(true);
    expect(isNpsRecordOfStaff(rec("Mika", "福島院"), "Mika", "")).toBe(true);
  });

  it("回答者名が空・スタッフ名が空なら当てない", () => {
    expect(isNpsRecordOfStaff(rec("", "堀江院"), "Mika", "堀江院")).toBe(false);
    expect(isNpsRecordOfStaff(rec("Mika", "堀江院"), "", "堀江院")).toBe(false);
    expect(isNpsRecordOfStaff({}, "Mika", "堀江院")).toBe(false);
  });
});

describe("filterNpsRecordsForStaff（StaffDetail の再現）", () => {
  const records = [
    rec("Mika", "堀江院", "2026-07-10"),
    rec("Mika", "堀江院", "2026-08-05"),
    rec("Mika", "福島院", "2026-08-20"),
    rec("Akiko", "堀江院", "2026-08-21"),
  ];

  it("堀江院の Mika の詳細に、福島院の Mika の口コミが混ざらない", () => {
    const got = filterNpsRecordsForStaff(records, "Mika", "堀江院");
    expect(got).toHaveLength(2);
    expect(got.every((r) => r.storeShort === "堀江院")).toBe(true);
  });

  it("福島院の Mika 側も同じく1件だけ", () => {
    const got = filterNpsRecordsForStaff(records, "Mika", "福島院");
    expect(got).toHaveLength(1);
    expect(got[0].date).toBe("2026-08-20");
  });

  it("月の一覧も店舗で絞られる（他店の月が選択肢に出ない）", () => {
    const months = new Set(
      filterNpsRecordsForStaff(records, "Mika", "堀江院").map((r) => r.date.slice(0, 7))
    );
    expect(Array.from(months).sort()).toEqual(["2026-07", "2026-08"]);
  });

  it("店舗が分からない画面では従来どおり名前だけで引く", () => {
    expect(filterNpsRecordsForStaff(records, "Mika")).toHaveLength(3);
  });
});

/**
 * ここから下は**挙動テストではない**。ページは React コンポーネントで、vitest は
 * environment: node（DOMなし）・server/**.test.ts しか拾わないため描画できない。
 * よってソースの文字列を見張っているだけ。
 *
 * それでも置く理由：上の describe は「新設ライブラリが正しく絞れるか」しか見ておらず、
 * **StaffDetail.tsx を旧コード（名前だけの filter）に戻しても全部緑のまま通る**
 * （2026-09-04 の独立監査で実測）。今回閉じた事故そのもの＝「一覧だけ直って詳細が
 * 取り残される」を検知できないので、配線が外れたことだけは落ちるようにしておく。
 * 前例：server/employmentRanking.test.ts / server/navItems.test.ts も同じ手口。
 */
describe("ソース文字列の見張り（照合の正本を通っているか・挙動は見ていない）", () => {
  const src = (relative: string) =>
    readFileSync(path.resolve(import.meta.dirname, "../client/src", relative), "utf8");

  it("詳細（StaffDetail）は店舗込みで絞り込む", () => {
    const s = src("pages/StaffDetail.tsx");
    expect(s).toContain('from "@/lib/npsStaffMatch"');
    // 月の一覧・NPS集計の両方が同じ関数を通ること（片方だけ名前で絞ると別人が混ざる）
    const hits = s.match(/filterNpsRecordsForStaff\(records, staffName, staffStore\)/g) ?? [];
    expect(hits.length).toBe(2);
  });

  it("一覧（StaffList）は店舗込みでグルーピングする", () => {
    const s = src("pages/StaffList.tsx");
    expect(s).toContain('from "@/lib/npsStaffMatch"');
    expect(s).toContain("npsStaffKey(staffName, r.storeShort)");
    expect(s).toContain("npsStaffKey(s.name, s.storeNormalized)");
  });
});
