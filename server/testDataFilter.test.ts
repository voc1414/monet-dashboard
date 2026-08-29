/**
 * テスト回答除外ルールのテスト
 * ルール本体: client/src/lib/testDataFilter.ts
 */
import { describe, it, expect } from "vitest";
import { isTestName, isTestReportRow } from "../client/src/lib/testDataFilter";

/** 月末報告書の1行を組み立てる（21列） */
function row(opts: { systemName?: string; name?: string; nickname?: string }): string[] {
  const r = new Array(21).fill("");
  r[2] = "2026-08-29 11:06:34 am";
  r[4] = "はやしゆうま";
  r[5] = opts.systemName ?? "";
  r[6] = opts.name ?? "";
  r[7] = "大阪堀江院";
  r[20] = opts.nickname ?? "";
  return r;
}

describe("isTestName", () => {
  it("「テスト」をテスト値と判定する", () => {
    expect(isTestName("テスト")).toBe(true);
  });

  it("大小文字・空白を無視する", () => {
    expect(isTestName(" Test ")).toBe(true);
    expect(isTestName("ＴＥＳＴ".toLowerCase())).toBe(false); // 全角は対象外（実データに無い）
    expect(isTestName("test")).toBe(true);
    expect(isTestName("てすと")).toBe(true);
  });

  it("空・未定義はテスト値でない", () => {
    expect(isTestName("")).toBe(false);
    expect(isTestName(undefined)).toBe(false);
    expect(isTestName(null)).toBe(false);
    expect(isTestName("　")).toBe(false);
  });

  it("実在スタッフ名を誤ってテスト扱いしない", () => {
    for (const n of ["小池明子", "西本 美華", "松野美香", "山田沙也香", "テストー", "テスト太郎"]) {
      expect(isTestName(n)).toBe(false);
    }
  });
});

describe("isTestReportRow", () => {
  it("氏名が「テスト」の行を除外する（実データ 回答ID 15567744 相当）", () => {
    expect(isTestReportRow(row({ systemName: "テスト", name: "テスト", nickname: "テスト" }))).toBe(true);
  });

  it("氏名だけがテストでも除外する", () => {
    expect(isTestReportRow(row({ systemName: "山田", name: "テスト" }))).toBe(true);
  });

  it("システム表示名だけがテストでも除外する", () => {
    expect(isTestReportRow(row({ systemName: "test", name: "山田沙也香" }))).toBe(true);
  });

  it("ニックネーム（列20）だけがテストでも除外する", () => {
    expect(isTestReportRow(row({ name: "山田沙也香", nickname: "テスト" }))).toBe(true);
  });

  it("通常の回答は除外しない", () => {
    expect(isTestReportRow(row({ systemName: "小池明子", name: "小池明子", nickname: "あっこ" }))).toBe(false);
  });

  it("LINE名が本名でも判定に影響しない（誤爆防止）", () => {
    const r = row({ systemName: "小池明子", name: "小池明子" });
    r[4] = "テスト"; // LINE名は判定対象外
    expect(isTestReportRow(r)).toBe(false);
  });

  it("列20が無い短い行でも落ちない", () => {
    const short = ["", "", "2026-08-29", "", "", "小池明子", "小池明子", "大阪堀江院"];
    expect(isTestReportRow(short)).toBe(false);
  });
});
