import { describe, it, expect } from "vitest";
import { normalizeStaffKey } from "../client/src/lib/staffNameAlias";

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
});
