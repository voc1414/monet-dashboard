import { describe, it, expect } from "vitest";
import {
  resolveReportColumns,
  findNicknameColumnByContent,
  normalizeHeader,
  cellOf,
} from "@/lib/reportColumns";

/**
 * 月末報告書の列解決（台帳 GF-MDASH-M3）。
 *
 * これは**挙動テスト**。resolveReportColumns は React に依存しない純関数なので、
 * 実スプレッドシートと同じ形のヘッダ・値を食わせて結果を検証できる。
 *
 * ヘッダ行は 2026-09-12 に実スプレッドシート
 * （1DXAaFk0aLDZwXq28krOcrDSiTOwd6BeTzV-xFXbLuKI / gid=505478524）から取った現物。
 * 本文は実在する値の「形」に合わせた合成データ（氏名・売上の実値は repo に置かない）。
 */
const REAL_HEADER = [
  "LINE ユーザーID",
  "回答ID",
  "回答日時",
  "回答者ID",
  "LINE名",
  "システム表示名",
  "氏名",
  "所属店舗",
  "雇用形態",
  "行動指標を守れていますか？",
  "ルールを守れていますか？",
  "先月の技術売上 [税込]",
  "先月の店販売上[税込]",
  "先月の新規客数",
  "先月の再来顧客数",
  "先月の次回予約取得数",
  "口コミの感想を教えてください",
  "NPSスコアの感想を教えてください",
  "ファンくるの調査結果の感想を教えてください",
  "", // 列19: 写真（設問名がヘッダに出ていない）
  "", // 列20: ニックネーム（同上）
];

/** 実データと同じ形の行を作る。列19 は写真URL、列20 はニックネーム。 */
function makeRow(over: Partial<Record<number, string>> = {}): string[] {
  const r = [
    "U1234567890abcdef",
    "24403746",
    "2026-09-05 09:21:56 am",
    "000000",
    "ミミ",
    "ミミ",
    "山田 花子",
    "堀江院",
    "正社員",
    "はい",
    "はい",
    "1,234,567",
    "89,012",
    "12",
    "34",
    "20",
    "口コミは増えました",
    "NPSは横ばいです",
    "ファンくるは良かったです",
    "https://form-upload.example.invalid/images/000000/000000/form/abc.jpg",
    "Mimi",
  ];
  for (const [k, v] of Object.entries(over)) r[Number(k)] = v as string;
  return r;
}

describe("normalizeHeader（設問名のゆれ吸収）", () => {
  it("全半角・空白・括弧を落として比較できる形にする", () => {
    expect(normalizeHeader("先月の技術売上 [税込]")).toBe("先月の技術売上税込");
    expect(normalizeHeader("先月の店販売上[税込]")).toBe("先月の店販売上税込");
    expect(normalizeHeader("ＮＰＳスコアの感想を教えてください")).toBe("npsスコアの感想を教えてください");
    expect(normalizeHeader("")).toBe("");
  });
});

describe("resolveReportColumns（実スプレッドシートのヘッダ）", () => {
  // ニックネームの中身判定には下限件数（3件）があるので、実データと同じく複数行を渡す
  const rows = [makeRow(), makeRow({ 20: "Momo" }), makeRow({ 20: "リン" })];
  const map = resolveReportColumns(REAL_HEADER, rows);

  it("必須列がすべて解決でき、集計してよい状態になる", () => {
    expect(map.ok).toBe(true);
    expect(map.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("2026-09-12 時点の実際の列位置に解決される（旧 COL 直書きと同じ）", () => {
    expect(map.index).toMatchObject({
      lineUserId: 0,
      answerId: 1,
      answerDate: 2,
      answererId: 3,
      lineName: 4,
      systemName: 5,
      name: 6,
      store: 7,
      employmentType: 8,
      behaviorCheck: 9,
      ruleCheck: 10,
      techSales: 11,
      retailSales: 12,
      newCustomers: 13,
      returnCustomers: 14,
      nextReservation: 15,
      reviewComment: 16,
      npsComment: 17,
      fankuruComment: 18,
      nickname: 20,
    });
  });

  it("行の長さチェックに使う必須列の右端は 15（＝旧実装の r.length >= 16 と同じ）", () => {
    expect(map.maxRequiredIndex).toBe(15);
  });

  it("ニックネーム列はヘッダが空欄なので中身から特定したことを参考情報として出す", () => {
    const info = map.issues.filter((i) => i.severity === "info");
    expect(info).toHaveLength(1);
    expect(info[0].key).toBe("nickname");
    expect(info[0].message).toContain("21列目");
  });
});

describe("設問が増減して列がズレても正しい列を引く（M3 の本題）", () => {
  it("先頭に設問が1つ増えても売上・客数は名前で追随する", () => {
    const shifted = ["新しい設問", ...REAL_HEADER];
    const shiftedRows = [makeRow(), makeRow({ 20: "Momo" }), makeRow({ 20: "リン" })].map((r) => [
      "新規回答",
      ...r,
    ]);
    const map = resolveReportColumns(shifted, shiftedRows);
    expect(map.ok).toBe(true);
    expect(map.index.techSales).toBe(12);
    expect(map.index.retailSales).toBe(13);
    expect(map.index.newCustomers).toBe(14);
    expect(map.index.returnCustomers).toBe(15);
    expect(map.index.nextReservation).toBe(16);
    expect(map.index.nickname).toBe(21);
  });

  it("途中の設問が消えても正しい値が取れる", () => {
    const removed = REAL_HEADER.filter((h) => h !== "ルールを守れていますか？");
    const row = makeRow().filter((_, i) => i !== 10);
    const map = resolveReportColumns(removed, [row]);
    expect(map.ok).toBe(true);
    expect(cellOf(row, map.index, "techSales")).toBe("1,234,567");
    expect(cellOf(row, map.index, "nextReservation")).toBe("20");
    // 消えた設問は「集計値には影響しない」警告として出る
    const w = map.issues.filter((i) => i.severity === "warning");
    expect(w.map((i) => i.key)).toContain("ruleCheck");
  });
});

describe("列が見つからないときは黙って0にせず止める（達成条件②）", () => {
  it("技術売上の設問名が消えると ok=false になり、error の警告が出る", () => {
    const broken = REAL_HEADER.map((h) => (h === "先月の技術売上 [税込]" ? "先月の売り上げを教えてください" : h));
    const map = resolveReportColumns(broken, [makeRow()]);
    expect(map.ok).toBe(false);
    const err = map.issues.filter((i) => i.severity === "error");
    expect(err.map((i) => i.key)).toEqual(["techSales"]);
    expect(err[0].message).toContain("集計を止めています");
    // 解決できていない列は 0 ではなく空文字（呼び出し側で 0 扱いされない）
    expect(map.index.techSales).toBe(-1);
    expect(cellOf(makeRow(), map.index, "techSales")).toBe("");
  });

  it("必須列が複数消えても全部まとめて出る", () => {
    const broken = REAL_HEADER.map((h) =>
      h === "先月の新規客数" ? "A" : h === "先月の再来顧客数" ? "B" : h
    );
    const map = resolveReportColumns(broken, [makeRow()]);
    expect(map.ok).toBe(false);
    expect(map.issues.filter((i) => i.severity === "error").map((i) => i.key).sort()).toEqual([
      "newCustomers",
      "returnCustomers",
    ]);
  });
});

describe("ニックネーム列の特定", () => {
  it("ヘッダが空でも、写真URLの列ではない方を中身で選ぶ", () => {
    const rows = [
      makeRow(),
      makeRow({ 19: "https://form-upload.example.invalid/images/000000/000000/form/def.jpg", 20: "Momo" }),
      makeRow({ 19: "https://form-upload.example.invalid/images/000000/000000/form/ghi.jpg", 20: "リン" }),
    ];
    expect(findNicknameColumnByContent(REAL_HEADER, rows)).toBe(20);
  });

  it("過去行に写真URLが残っていても（実データと同じ混在）ニックネーム列を選ぶ", () => {
    // 2026-09-12 実測: 列20 は 185件中 URL 154・ニックネーム 31。列19 は 185件すべて URL。
    // 「写真」設問を差し替えた列なので過去行に URL が残る。比率では判定できない。
    const rows: string[][] = [];
    for (let i = 0; i < 154; i++) {
      rows.push(makeRow({ 20: `https://form-upload.example.invalid/images/000000/000000/form/old${i}.jpeg` }));
    }
    for (let i = 0; i < 31; i++) {
      rows.push(makeRow({ 20: `Mimi${i}` }));
    }
    expect(findNicknameColumnByContent(REAL_HEADER, rows)).toBe(20);
    const map = resolveReportColumns(REAL_HEADER, rows);
    expect(map.index.nickname).toBe(20);
  });

  it("ニックネームがまだ1件も入っていなければ特定せず警告を出す", () => {
    const rows = [makeRow({ 20: "" }), makeRow({ 20: "" })];
    const map = resolveReportColumns(REAL_HEADER, rows);
    expect(map.index.nickname).toBe(-1);
    expect(map.issues.find((i) => i.key === "nickname")?.severity).toBe("warning");
    // 必須ではないので集計自体は続く
    expect(map.ok).toBe(true);
  });

  it("設問名がヘッダに出るようになったら名前で解決する（中身判定より優先）", () => {
    const named = [...REAL_HEADER];
    named[20] = "ニックネーム（お客様からの呼ばれ方）";
    const map = resolveReportColumns(named, [makeRow()]);
    expect(map.index.nickname).toBe(20);
    expect(map.issues.filter((i) => i.key === "nickname")).toEqual([]);
  });
});

describe("似た設問名が増えたときは黙って左端を使わない（達成条件②）", () => {
  it("技術売上に一致する列が2つになったら集計を止める", () => {
    // フォームに設問を足すとき一番起きやすいのが「既存の設問名を含む新しい設問」。
    // 左端を黙って使うと自由記述を売上として読み、全スタッフが ¥0 になる。
    const header = [...REAL_HEADER];
    header.splice(11, 0, "先月の技術売上の内訳を教えてください");
    const map = resolveReportColumns(header, [makeRow()]);
    expect(map.ok).toBe(false);
    const err = map.issues.filter((i) => i.severity === "error");
    expect(err).toHaveLength(1);
    expect(err[0].key).toBe("techSales");
    expect(err[0].message).toContain("集計を止めています");
  });

  it("所属店舗が改名され「店舗」を含む自由記述が増えたら集計を止める", () => {
    // 誤って掴むと storeNormalized が文章になり、新店舗の自動登録まで走ってしまう。
    const header = [...REAL_HEADER];
    header[7] = "勤務店舗";
    header.splice(6, 0, "新店舗についての要望");
    const map = resolveReportColumns(header, [makeRow()]);
    expect(map.ok).toBe(false);
    expect(map.issues.find((i) => i.severity === "error")?.key).toBe("store");
  });

  it("任意列が重複しただけなら集計は続ける（左端を使い warning）", () => {
    const header = [...REAL_HEADER];
    header.splice(16, 0, "口コミの件数を教えてください");
    const map = resolveReportColumns(header, [makeRow()]);
    expect(map.ok).toBe(true);
    const w = map.issues.find((i) => i.key === "reviewComment");
    expect(w?.severity).toBe("warning");
    expect(w?.message).toContain("左端を使いました");
  });
});

describe("ニックネームの中身判定が誤爆しない", () => {
  it("写真列に非URLが1件混ざっただけでは写真列を選ばない", () => {
    const rows: string[][] = [];
    for (let i = 0; i < 20; i++) rows.push(makeRow({ 20: "" }));
    rows[0][19] = "（写真を撮り忘れました）";
    expect(findNicknameColumnByContent(REAL_HEADER, rows)).toBe(-1);
  });

  it("ヘッダが空の列が他にもできたら黙って選ばず警告を出す", () => {
    const header = [...REAL_HEADER, ""]; // 列21 も設問名が出ていない
    const rows: string[][] = [];
    for (let i = 0; i < 40; i++) {
      const r = makeRow({ 20: i < 10 ? `Momo${i}` : "" });
      r[21] = `今月は${i}件の口コミをいただきました`;
      rows.push(r);
    }
    const map = resolveReportColumns(header, rows);
    const issue = map.issues.find((i) => i.key === "nickname");
    expect(issue?.severity).toBe("warning");
    expect(issue?.message).toContain("確認してください");
    expect(map.ok).toBe(true); // 呼び名は任意列なので集計自体は続ける
  });

  it("長い自由記述だけの列はニックネーム候補にしない", () => {
    const header = [...REAL_HEADER, ""];
    const rows: string[][] = [];
    for (let i = 0; i < 40; i++) {
      const r = makeRow({ 20: `Momo${i}` });
      r[21] = "今月は新規のお客様が増えて、次回予約もしっかり取れるようになってきました。";
      rows.push(r);
    }
    const map = resolveReportColumns(header, rows);
    expect(map.index.nickname).toBe(20);
    expect(map.issues.find((i) => i.key === "nickname")?.severity).toBe("info");
  });
});
