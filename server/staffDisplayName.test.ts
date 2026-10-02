import { describe, it, expect, beforeEach } from "vitest";
import { resolveStaffDisplayName, resolveStaffInitial, setReportNicknames } from "@/lib/staffDisplayName";
import { STAFF_MASTER } from "@/data/staffMaster";

// 呼び名の正本は月末報告書のニックネーム列だけ（2026-10-02〜。Notion の列は読まない）。
// 実マスタの3名ぶんの回答を注入して解決ロジックを検証する。
// （堀江院 Mika と福島院 Mika は別人＝店舗で切り分かることの確認が主眼）
beforeEach(() => {
  setReportNicknames([
    { name: "西本 美華", store: "堀江院", nickname: "みかりん", answerDate: "2026-08-29 10:00:00" },
    { name: "Mika", store: "堀江院", nickname: "みかりん", answerDate: "2026-08-29 10:00:00" },
    { name: "松野 美香", store: "福島院", nickname: "みかっぺ", answerDate: "2026-08-29 10:00:00" },
    { name: "Mika", store: "福島院", nickname: "みかっぺ", answerDate: "2026-08-29 10:00:00" },
    { name: "小池明子", store: "堀江院", nickname: "あっこ", answerDate: "2026-08-29 10:00:00" },
  ]);
});

describe("resolveStaffDisplayName", () => {
  it("氏名で引いてニックネームを返す", () => {
    expect(resolveStaffDisplayName("西本 美華", "堀江院")).toBe("みかりん");
    expect(resolveStaffDisplayName("松野 美香", "福島院")).toBe("みかっぺ");
  });

  it("同じ表示名の別人を店舗で切り分ける", () => {
    expect(resolveStaffDisplayName("Mika", "堀江院")).toBe("みかりん");
    expect(resolveStaffDisplayName("Mika", "福島院")).toBe("みかっぺ");
  });

  it("店舗が分からず候補が割れるときは name のまま返す（別人の呼び名を出さない）", () => {
    expect(resolveStaffDisplayName("Mika")).toBe("Mika");
  });

  it("ニックネーム未回答なら氏名をそのまま返す", () => {
    expect(resolveStaffDisplayName("中島真優", "土橋院")).toBe("中島真優");
    expect(resolveStaffDisplayName("坂手芳", "堀江院2nd")).toBe("坂手芳");
  });

  it("マスタに居ない名前・空文字でも落ちない", () => {
    expect(resolveStaffDisplayName("佐々木 淳", "楽々園院")).toBe("佐々木 淳");
    expect(resolveStaffDisplayName("")).toBe("");
  });

  it("店舗が合わなければ氏名に落とす（全社フォールバックしない＝別人の呼び名を出さない）", () => {
    // 2026-09-04 の独立監査で実測された穴。NPS に「堀江院2nd / Akiko」の行が実在し、
    // 堀江院 小池明子の呼び名が 堀江院2nd の画面に出ていた。
    expect(resolveStaffDisplayName("小池明子", "堀江院2nd")).toBe("小池明子");
    // 直す場所はここではなく useMonthlyReport.ts の STORE_NAME_MAP_FALLBACK／Notion 店舗マスタ側
    expect(resolveStaffDisplayName("西本 美華", "存在しない院")).toBe("西本 美華");
  });

  it("Notion 側の値は呼び名に使わない（マスタに呼び名の項目自体が無い）", () => {
    for (const s of STAFF_MASTER) {
      expect(Object.keys(s)).not.toContain("nickname");
    }
  });
});

describe("resolveStaffInitial", () => {
  it("アバターの頭文字は表示名と同じ文字から取る", () => {
    // 氏名「小池明子」のまま頭文字を取ると「小」になり、名前「あっこ」と食い違う
    expect(resolveStaffInitial("小池明子", "堀江院")).toBe("あ");
    expect(resolveStaffInitial("中島真優", "土橋院")).toBe("中");
  });
});
