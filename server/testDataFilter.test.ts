/**
 * テスト回答除外ルールのテスト
 * ルール本体: client/src/lib/testDataFilter.ts
 */
import { describe, it, expect } from "vitest";
import { isTestName, isTestReportRow } from "../client/src/lib/testDataFilter";
import { resolveReportColumns } from "@/lib/reportColumns";

/** 2026-09-12 時点の実ヘッダ（列19・20 は設問名が出ていない） */
const REAL_HEADER = [
  "LINE ユーザーID", "回答ID", "回答日時", "回答者ID", "LINE名", "システム表示名", "氏名",
  "所属店舗", "雇用形態", "行動指標を守れていますか？", "ルールを守れていますか？",
  "先月の技術売上 [税込]", "先月の店販売上[税込]", "先月の新規客数", "先月の再来顧客数",
  "先月の次回予約取得数", "口コミの感想を教えてください", "NPSスコアの感想を教えてください",
  "ファンくるの調査結果の感想を教えてください", "", "",
];

/** 判定に使う列は解決結果から渡す（列番号の直書きはしない） */
const COLS = { systemName: 5, name: 6, nickname: 20 };

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
    expect(isTestReportRow(row({ systemName: "テスト", name: "テスト", nickname: "テスト" }), COLS)).toBe(true);
  });

  it("氏名だけがテストでも除外する", () => {
    expect(isTestReportRow(row({ systemName: "山田", name: "テスト" }), COLS)).toBe(true);
  });

  it("システム表示名だけがテストでも除外する", () => {
    expect(isTestReportRow(row({ systemName: "test", name: "山田沙也香" }), COLS)).toBe(true);
  });

  it("ニックネーム（列20）だけがテストでも除外する", () => {
    expect(isTestReportRow(row({ name: "山田沙也香", nickname: "テスト" }), COLS)).toBe(true);
  });

  it("通常の回答は除外しない", () => {
    expect(isTestReportRow(row({ systemName: "小池明子", name: "小池明子", nickname: "あっこ" }), COLS)).toBe(false);
  });

  it("LINE名が本名でも判定に影響しない（誤爆防止）", () => {
    const r = row({ systemName: "小池明子", name: "小池明子" });
    r[4] = "テスト"; // LINE名は判定対象外
    expect(isTestReportRow(r, COLS)).toBe(false);
  });

  it("列20が無い短い行でも落ちない", () => {
    const short = ["", "", "2026-08-29", "", "", "小池明子", "小池明子", "大阪堀江院"];
    expect(isTestReportRow(short, COLS)).toBe(false);
  });
});

describe("設問が増えて列がズレてもテスト回答を検出する（M3）", () => {
  it("先頭に設問が1つ増えた行でも、解決済みの列で判定すれば検出できる", () => {
    // 呼び名だけ「テスト」の行。列番号直書き（5/6/20）だと1列ズレた時点で検出できず、
    // テスト送信の売上が店舗集計に混入する。
    const shiftedHeader = ["新しい設問", ...REAL_HEADER];
    const rows: string[][] = [];
    for (let i = 0; i < 5; i++) {
      const r = ["新規回答", ...row({ systemName: "小池明子", name: "小池明子" })];
      r[21] = i === 0 ? "テスト" : `あっこ${i}`;
      rows.push(r);
    }
    const cols = resolveReportColumns(shiftedHeader, rows).index;
    expect(cols.nickname).toBe(21);
    expect(isTestReportRow(rows[0], cols)).toBe(true);
    expect(isTestReportRow(rows[1], cols)).toBe(false);
    // 旧実装と同じ 5/6/20 で見ると検出できない（＝これが直したかった失敗モード）
    expect(isTestReportRow(rows[0], COLS)).toBe(false);
  });

  it("呼び名の列が特定できていない（-1）ときは残り2列で判定する", () => {
    const cols = { systemName: 5, name: 6, nickname: -1 };
    expect(isTestReportRow(row({ name: "テスト" }), cols)).toBe(true);
    expect(isTestReportRow(row({ name: "小池明子", nickname: "テスト" }), cols)).toBe(false);
  });
});
