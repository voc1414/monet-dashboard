import { describe, it, expect, afterEach } from "vitest";
import { normalizeStaffKey, canonicalizeStaffName, setStaffAliasMapFromDb } from "../client/src/lib/staffNameAlias";

describe("normalizeStaffKey", () => {
  it("空白除去＋小文字化する", () => {
    expect(normalizeStaffKey("藤原 牧子")).toBe("藤原牧子");
    expect(normalizeStaffKey("石橋　茜")).toBe("石橋茜");
    expect(normalizeStaffKey("Yoshie")).toBe("yoshie");
  });

  it("NPSフォーム表記のエイリアスを月末報告書の登録名へ名寄せする", () => {
    // 堀江院: akiko → 小池明子（林 確認 2026-07-06）
    expect(normalizeStaffKey("akiko")).toBe("小池明子");
    expect(normalizeStaffKey("Akiko")).toBe("小池明子");
    expect(normalizeStaffKey("AKIKO")).toBe("小池明子");
    // 楽々園院: 石原ようこ → 石原葉子（林 確認 2026-07-06）
    expect(normalizeStaffKey("石原ようこ")).toBe("石原葉子");
    expect(normalizeStaffKey("石原 ようこ")).toBe("石原葉子");
  });

  it("エイリアス適用後のキー同士が一致する（両側正規化の前提）", () => {
    expect(normalizeStaffKey("akiko")).toBe(normalizeStaffKey("小池明子"));
    expect(normalizeStaffKey("石原ようこ")).toBe(normalizeStaffKey("石原　葉子"));
  });

  it("エイリアスに無い名前はそのまま（空文字も安全）", () => {
    expect(normalizeStaffKey("中島真優")).toBe("中島真優");
    expect(normalizeStaffKey("")).toBe("");
  });

  it("本人入力ゆれ: 坂手 と 坂手芳 は同一キーになる", () => {
    expect(normalizeStaffKey("坂手")).toBe(normalizeStaffKey("坂手芳"));
  });
});

describe("canonicalizeStaffName（表示名の正準化）", () => {
  it("エイリアス該当時は正準表示名を返す", () => {
    expect(canonicalizeStaffName("坂手")).toBe("坂手芳");
    expect(canonicalizeStaffName("akiko")).toBe("小池明子");
    expect(canonicalizeStaffName("石原 ようこ")).toBe("石原葉子");
  });

  it("該当なしは元の名前をそのまま返す（表示を壊さない）", () => {
    expect(canonicalizeStaffName("中島真優")).toBe("中島真優");
    expect(canonicalizeStaffName("坂手芳")).toBe("坂手芳");
  });
});

describe("setStaffAliasMapFromDb", () => {
  afterEach(() => setStaffAliasMapFromDb([]));

  it("DB名前マッピング（管理者ページ登録）が反映される", () => {
    setStaffAliasMapFromDb([{ alias: "みなちゃん", canonicalName: "Minaho" }]);
    expect(normalizeStaffKey("みなちゃん")).toBe("minaho");
    expect(normalizeStaffKey("みなちゃん")).toBe(normalizeStaffKey("Minaho"));
  });

  it("DB登録はコード内蔵表より優先される", () => {
    setStaffAliasMapFromDb([{ alias: "AKIKO", canonicalName: "別の正式名" }]);
    expect(normalizeStaffKey("akiko")).toBe("別の正式名");
    setStaffAliasMapFromDb([]);
    expect(normalizeStaffKey("akiko")).toBe("小池明子"); // 内蔵表に戻る
  });

  it("alias/canonicalNameは空白・大小文字を正規化して照合する", () => {
    setStaffAliasMapFromDb([{ alias: "石原 ヨウコ", canonicalName: "石原　葉子" }]);
    expect(normalizeStaffKey("石原ヨウコ")).toBe("石原葉子");
  });
});
