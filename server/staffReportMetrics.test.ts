/**
 * スタッフ個人実績（月末報告書ベース・期間合算）のテスト
 * ルール本体: client/src/lib/staffReportMetrics.ts
 *
 * 期待値は月末報告書スプシの実データ（山口純奈／姪浜院 2026-03〜2026-08）から算出したもの。
 * 従来の実装は最新1行しか見ておらず、全期間を選んでも 2026-08 単月のままだった。
 */
import { describe, it, expect } from "vitest";
import {
  aggregateStaffReportMetrics,
  groupStaffReportsByStaff,
  pickLatestPerMonth,
  type StaffReportMetricsInput,
} from "../client/src/lib/staffReportMetrics";

/** 月末報告書の1行を組み立てる */
function row(
  reportMonth: string,
  techSales: number,
  retailSales: number,
  newCustomers: number,
  returnCustomers: number,
  nextReservation: number,
  opts: { answerDate?: string; employmentType?: string } = {},
): StaffReportMetricsInput {
  return {
    reportMonth,
    answerDate: opts.answerDate ?? `${reportMonth}-28 10:00:00`,
    techSales,
    retailSales,
    newCustomers,
    returnCustomers,
    nextReservation,
    employmentType: opts.employmentType ?? "フルタイム社員",
  };
}

/** 山口純奈／姪浜院 の実データ（月末報告書 2026-03〜2026-08） */
const YAMAGUCHI: StaffReportMetricsInput[] = [
  row("2026-03", 837800, 3500, 14, 46, 46),
  row("2026-04", 851900, 3500, 11, 46, 49),
  row("2026-05", 842450, 27000, 14, 46, 53),
  row("2026-06", 839300, 26400, 5, 53, 52),
  row("2026-07", 784900, 19700, 5, 49, 46),
  row("2026-08", 743700, 15300, 4, 45, 44),
];

describe("aggregateStaffReportMetrics（月末報告書ベース・期間合算）", () => {
  it("単月：総売上=技術+店販、総客数=新規+再来、客単価=総売上÷総客数", () => {
    const m = aggregateStaffReportMetrics([YAMAGUCHI[5]])!;
    expect(m.techSales).toBe(743700);
    expect(m.retailSales).toBe(15300);
    expect(m.totalSales).toBe(759000);
    expect(m.newCustomers).toBe(4);
    expect(m.returnCustomers).toBe(45);
    expect(m.totalCustomers).toBe(49);
    expect(m.unitPrice).toBe(15490); // 759000 ÷ 49
    expect(m.nextReservationRate).toBe(89.8); // 44 ÷ 49
    expect(m.monthCount).toBe(1);
    expect(m.dataSource).toBe("report");
  });

  it("全期間：6ヶ月ぶんを合算する（従来は最新1行のままだった）", () => {
    const m = aggregateStaffReportMetrics(YAMAGUCHI)!;
    expect(m.monthCount).toBe(6);
    expect(m.techSales).toBe(4900050);
    expect(m.retailSales).toBe(95400);
    expect(m.totalSales).toBe(4995450);
    expect(m.newCustomers).toBe(53);
    expect(m.returnCustomers).toBe(285);
    expect(m.totalCustomers).toBe(338);
    expect(m.unitPrice).toBe(14779); // 4995450 ÷ 338
    expect(m.nextReservationRate).toBe(85.8); // 290 ÷ 338
    // 単月の値が漏れ出ていないこと
    expect(m.totalSales).not.toBe(759000);
  });

  it("期間を絞ればその範囲だけ合算する（2026-07〜08）", () => {
    const m = aggregateStaffReportMetrics(YAMAGUCHI.slice(4))!;
    expect(m.monthCount).toBe(2);
    expect(m.totalSales).toBe(784900 + 19700 + 743700 + 15300);
    expect(m.totalCustomers).toBe(5 + 49 + 4 + 45);
  });

  it("同じ対象月に複数回答があるときは回答日が新しい1行だけ使う（二重計上しない）", () => {
    const dup = [
      row("2026-07", 100000, 0, 1, 9, 8, { answerDate: "2026-08-01 09:00:00" }),
      row("2026-07", 200000, 0, 2, 18, 16, { answerDate: "2026-08-05 09:00:00" }),
    ];
    const m = aggregateStaffReportMetrics(dup)!;
    expect(m.monthCount).toBe(1);
    expect(m.techSales).toBe(200000);
    expect(m.totalCustomers).toBe(20);
  });

  it("報告書を出していなければ null（0円ではなく「未提出」として扱う）", () => {
    expect(aggregateStaffReportMetrics([])).toBeNull();
  });

  it("客数0でも0除算しない", () => {
    const m = aggregateStaffReportMetrics([row("2026-08", 0, 0, 0, 0, 0)])!;
    expect(m.unitPrice).toBe(0);
    expect(m.nextReservationRate).toBe(0);
  });

  it("雇用形態は期間内で最も新しい行のものを使う", () => {
    const m = aggregateStaffReportMetrics([
      row("2026-07", 1, 0, 1, 0, 0, { employmentType: "パート 週3前後" }),
      row("2026-08", 1, 0, 1, 0, 0, { employmentType: "フルタイム社員" }),
    ])!;
    expect(m.employmentType).toBe("フルタイム社員");
  });
});

describe("groupStaffReportsByStaff（スタッフ一覧の1人1行まとめ）", () => {
  /** 一覧用の行（店舗と名前つき） */
  function listRow(
    name: string,
    storeNormalized: string,
    reportMonth: string,
    techSales: number,
    newCustomers: number,
    returnCustomers: number,
  ) {
    return { ...row(reportMonth, techSales, 0, newCustomers, returnCustomers, 0), name, storeNormalized };
  }

  const ROWS = [
    listRow("山口純奈", "姪浜院", "2026-07", 784900, 5, 49),
    listRow("山口純奈", "姪浜院", "2026-08", 743700, 4, 45),
    // 表示名は店舗をまたいで重複する（堀江院の Mika と福島院の Mika は別人）
    listRow("Mika", "堀江院", "2026-08", 300000, 3, 20),
    listRow("Mika", "福島院", "2026-08", 400000, 5, 30),
    // 7月しか出していない人
    listRow("小田利恵", "土橋院", "2026-07", 500000, 2, 30),
  ];

  it("同姓同名でも店舗が違えば別人として分ける", () => {
    const got = groupStaffReportsByStaff(ROWS, ["2026-08"]);
    const mika = got.filter(g => g.rep.name === "Mika");
    expect(mika).toHaveLength(2);
    expect(mika.find(g => g.rep.storeNormalized === "堀江院")!.metrics.techSales).toBe(300000);
    expect(mika.find(g => g.rep.storeNormalized === "福島院")!.metrics.techSales).toBe(400000);
  });

  it("複数月を選ぶと1人1行にまとめて合算する", () => {
    const got = groupStaffReportsByStaff(ROWS, ["2026-07", "2026-08"]);
    const y = got.find(g => g.rep.name === "山口純奈")!;
    expect(got.filter(g => g.rep.name === "山口純奈")).toHaveLength(1);
    expect(y.metrics.monthCount).toBe(2);
    expect(y.metrics.techSales).toBe(784900 + 743700);
    expect(y.metrics.totalCustomers).toBe(5 + 49 + 4 + 45);
    // 代表行（コメント等の表示元）は期間内で最も新しい月
    expect(y.rep.reportMonth).toBe("2026-08");
  });

  it("選んだ期間に報告書を出していない人は一覧に出ない（母集団＝提出者）", () => {
    const got = groupStaffReportsByStaff(ROWS, ["2026-08"]);
    expect(got.map(g => g.rep.name)).not.toContain("小田利恵");
  });

  it('"all" なら期間で絞らず全部合算する', () => {
    const got = groupStaffReportsByStaff(ROWS, "all");
    const y = got.find(g => g.rep.name === "山口純奈")!;
    expect(y.metrics.monthCount).toBe(2);
    expect(got.map(g => g.rep.name)).toContain("小田利恵");
  });
});

describe("pickLatestPerMonth", () => {
  it("対象月の降順で返す", () => {
    const sorted = pickLatestPerMonth(YAMAGUCHI);
    expect(sorted.map(r => r.reportMonth)).toEqual([
      "2026-08", "2026-07", "2026-06", "2026-05", "2026-04", "2026-03",
    ]);
  });
});

describe("店舗詳細の個人セクション（人数の水増し防止）", () => {
  /** 姪浜院の2人が6ヶ月ぶん提出している状態 */
  const STORE_ROWS = [
    ...YAMAGUCHI.map(r => ({ ...r, name: "山口純奈", storeNormalized: "姪浜院" })),
    ...YAMAGUCHI.map(r => ({ ...r, name: "田中花子", storeNormalized: "姪浜院" })),
  ];

  it("全期間でも1人1行。行数（12）ではなく在籍者数（2）になる", () => {
    expect(STORE_ROWS).toHaveLength(12);
    const got = groupStaffReportsByStaff(STORE_ROWS, "all");
    expect(got).toHaveLength(2);
    expect(new Set(got.map(g => g.rep.name)).size).toBe(2);
  });

  it("全期間の総合点は合算した次回予約率で計算される（単月85.8%ではない）", () => {
    const got = groupStaffReportsByStaff(STORE_ROWS, "all");
    const y = got.find(g => g.rep.name === "山口純奈")!;
    // 89.8% は 2026-08 単月の値。合算では 85.8%
    expect(y.metrics.nextReservationRate).toBe(85.8);
    expect(y.metrics.nextReservationRate).not.toBe(89.8);
    expect(y.metrics.totalCustomers).toBe(338);
  });
});

describe("稼働率の分母（月平均客数）", () => {
  it("単月なら総客数と同じ", () => {
    const m = aggregateStaffReportMetrics([YAMAGUCHI[5]])!;
    expect(m.totalCustomers).toBe(49);
    expect(m.avgMonthlyCustomers).toBe(49);
  });

  it("複数月では月平均になる（合算客数をそのまま稼働率に渡すと400%超になる）", () => {
    const m = aggregateStaffReportMetrics(YAMAGUCHI)!;
    expect(m.totalCustomers).toBe(338);
    expect(m.monthCount).toBe(6);
    expect(m.avgMonthlyCustomers).toBe(56); // 338 ÷ 6 = 56.3
    expect(m.avgMonthlyCustomers).not.toBe(338);
  });
});
