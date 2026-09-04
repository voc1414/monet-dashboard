import { describe, it, expect, vi } from "vitest";

// ニックネームは Notion 移行が済むまで実データが空なので、
// 実マスタの3名にだけニックネームを差し込んで解決ロジックを検証する。
// （堀江院 Mika と福島院 Mika は別人＝店舗で切り分かることの確認が主眼）
vi.mock("@/data/staffMaster", async () => {
  const actual = await vi.importActual<typeof import("@/data/staffMaster")>("@/data/staffMaster");
  const NICKNAMES: Record<string, string> = {
    "西本 美華": "みかりん", // 堀江院
    "松野 美香": "みかっぺ", // 福島院
    "小池明子": "あっこ", // 堀江院（displayName = Akiko）
  };
  return {
    ...actual,
    STAFF_MASTER: actual.STAFF_MASTER.map((s) =>
      NICKNAMES[s.name] ? { ...s, nickname: NICKNAMES[s.name] } : s
    ),
  };
});

const { resolveStaffDisplayName, resolveStaffInitial, setReportNicknames } =
  await import("@/lib/staffDisplayName");
const { STAFF_MASTER } = await import("@/data/staffMaster");

describe("resolveStaffDisplayName", () => {
  it("氏名で引いてニックネームを返す", () => {
    expect(resolveStaffDisplayName("西本 美華", "堀江院")).toBe("みかりん");
    expect(resolveStaffDisplayName("松野 美香", "福島院")).toBe("みかっぺ");
  });

  it("サロンボード表示名で引いても同じニックネームを返す", () => {
    // 月末報告書の name が氏名でもローマ字でも同じ人に解決される
    expect(resolveStaffDisplayName("Mika", "堀江院")).toBe("みかりん");
    expect(resolveStaffDisplayName("Mika", "福島院")).toBe("みかっぺ");
  });

  it("同じ表示名の別人を店舗で切り分ける", () => {
    expect(resolveStaffDisplayName("Mika", "堀江院")).not.toBe(
      resolveStaffDisplayName("Mika", "福島院")
    );
  });

  it("店舗が分からず候補が割れるときは name のまま返す（別人の呼び名を出さない）", () => {
    expect(resolveStaffDisplayName("Mika")).toBe("Mika");
  });

  it("名寄せエイリアス経由でも解決する（akiko → 小池明子）", () => {
    expect(resolveStaffDisplayName("Akiko", "堀江院")).toBe("あっこ");
    expect(resolveStaffDisplayName("小池明子", "堀江院")).toBe("あっこ");
  });

  it("ニックネーム未入力なら氏名をそのまま返す", () => {
    expect(resolveStaffDisplayName("中島真優", "土橋院")).toBe("中島真優");
    expect(resolveStaffDisplayName("坂手芳", "堀江院2nd")).toBe("坂手芳");
  });

  it("マスタに居ない名前・空文字でも落ちない", () => {
    expect(resolveStaffDisplayName("佐々木 淳", "楽々園院")).toBe("佐々木 淳");
    expect(resolveStaffDisplayName("")).toBe("");
  });

  it("店舗が合わなければ氏名に落とす（全社フォールバックしない＝別人の呼び名を出さない）", () => {
    // 2026-09-04 の独立監査で実測された穴。以前はここが
    // 「マスタ全体でこの名前が1人なら店舗が合わなくても返す」だった。
    // 実データの発火点：NPS に「堀江院2nd / Akiko」の行が実在し、SurveyList.tsx が
    // NPS の (staff, storeShort) からスタッフ行を作るため、堀江院 小池明子の呼び名が
    // 堀江院2nd の画面に出ていた。
    expect(resolveStaffDisplayName("Akiko", "堀江院2nd")).toBe("Akiko");
    expect(resolveStaffDisplayName("小池明子", "堀江院2nd")).toBe("小池明子");
    // 店舗表記が揺れて空振りした場合も同じ扱い（救うと上と同じ穴になる）。
    // 直す場所はここではなく useMonthlyReport.ts の STORE_NAME_MAP_FALLBACK／Notion 店舗マスタ側
    expect(resolveStaffDisplayName("西本 美華", "存在しない院")).toBe("西本 美華");
  });

  it("①（Notion）の店舗違いヒットが②（報告書）の正しい直接ヒットを潰さない", () => {
    // ①が店舗違いでも返していた頃は、②に正しい「堀江院2nd / Akiko」があっても
    // ①の「堀江院 小池明子＝あっこ」が先に勝って上書きしていた（監査で実測）
    setReportNicknames([
      { name: "Akiko", store: "堀江院2nd", nickname: "あきこ2nd", answerDate: "2026-08-29 10:00:00" },
    ]);
    expect(resolveStaffDisplayName("Akiko", "堀江院2nd")).toBe("あきこ2nd");
    // 本人（堀江院 小池明子）には①の Notion 値が出続ける（優先順位は変えていない）
    expect(resolveStaffDisplayName("Akiko", "堀江院")).toBe("あっこ");
    setReportNicknames([]);
  });

  it("マスタ全員が nickname または氏名のどちらかに解決される", () => {
    for (const s of STAFF_MASTER) {
      const shown = resolveStaffDisplayName(s.name, s.store);
      expect(shown).toBe(s.nickname ?? s.name);
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
