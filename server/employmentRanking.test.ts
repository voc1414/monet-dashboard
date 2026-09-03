/*
 * 雇用形態別の売上ランキング／平均売上（2026-09-01 GF-EMPRANK）の集計を固定するテスト。
 *
 * ここで守っているのは「数字を嘘にしない」ための4つの約束：
 *   1. 売上データが無い月（サロンボードに行が無い）は平均の分母に入れない
 *   2. 同じ人・同じ月の二重提出を足し込まない
 *   3. 雇用形態は月ごとの報告どおりに分類する
 *   4. 表記ゆれ（半角/全角括弧・スペース）を同じグループにまとめる／
 *      週数の無い「パート」は正式な雇用形態と混ぜない
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  EMPLOYMENT_BLANK_GROUP,
  PART_TIME_UNSPECIFIED_GROUP,
  buildEmploymentRanking,
  dedupeByStaffMonth,
  employmentGroupOf,
} from "../client/src/lib/employmentRanking";
import type { EmploymentRankingInput } from "../client/src/lib/employmentRanking";

function row(
  name: string,
  store: string,
  month: string,
  employmentType: string,
  answerDate = `${month}-15`,
): EmploymentRankingInput {
  return { name, storeNormalized: store, reportMonth: month, answerDate, employmentType };
}

/** サロンボードの売上表を `店舗__氏名__月` で引く。無い月は null（= データ無し） */
function salesFrom(table: Record<string, number>) {
  return (store: string, name: string, month: string): number | null => {
    const key = `${store}__${name}__${month}`;
    return key in table ? table[key] : null;
  };
}

function groupOf(result: ReturnType<typeof buildEmploymentRanking>, name: string) {
  const g = result.groups.find((x) => x.employmentGroup === name);
  if (!g) throw new Error(`グループ「${name}」が無い: ${result.groups.map((x) => x.employmentGroup).join(", ")}`);
  return g;
}

describe("雇用形態のグループ分け", () => {
  it("表記ゆれ（半角括弧・スペース・半角プラス）を同じグループに寄せる", () => {
    expect(employmentGroupOf("時短社員(7時間)")).toBe("時短社員（7時間）");
    expect(employmentGroupOf("時短社員 （7時間）")).toBe("時短社員（7時間）");
    expect(employmentGroupOf("日短社員(週休3日)")).toBe("日短社員（週休3日）");
    // 「公休」が抜けた省略表記もエイリアスで正式名に寄る
    expect(employmentGroupOf("日短社員(週休2日+2日)")).toBe("日短社員（週休2日＋公休2日）");
    expect(employmentGroupOf("　フルタイム社員 ")).toBe("フルタイム社員");
  });

  it("週数の無い「パート」は正式な雇用形態と混ぜず、別枠にする", () => {
    expect(employmentGroupOf("パート")).toBe(PART_TIME_UNSPECIFIED_GROUP);
    expect(employmentGroupOf("パート 週3前後")).toBe("パート 週3前後");
    expect(employmentGroupOf("")).toBe(EMPLOYMENT_BLANK_GROUP);
    expect(employmentGroupOf("   ")).toBe(EMPLOYMENT_BLANK_GROUP);
  });

  it("想定外の表記は黙って消さず、そのままグループとして残す", () => {
    // 新しい雇用形態が増えたときに人が画面から消えないように
    expect(employmentGroupOf("業務委託")).toBe("業務委託");
  });
});

describe("同じ人・同じ月の二重提出", () => {
  it("回答日が新しい行だけを残す", () => {
    const rows = [
      row("石原葉子", "堀江院", "2026-07", "フルタイム社員", "2026-08-02"),
      row("石原葉子", "堀江院", "2026-07", "パート 週3前後", "2026-08-08"),
    ];
    const deduped = dedupeByStaffMonth(rows);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].employmentType).toBe("パート 週3前後");
  });

  it("二重提出があっても売上を2回足さない", () => {
    const result = buildEmploymentRanking(
      [
        row("石原葉子", "堀江院", "2026-07", "フルタイム社員", "2026-08-02"),
        row("石原葉子", "堀江院", "2026-07", "フルタイム社員", "2026-08-08"),
      ],
      {
        months: ["2026-07"],
        getSales: salesFrom({ "堀江院__石原葉子__2026-07": 1_000_000 }),
      },
    );
    const g = groupOf(result, "フルタイム社員");
    expect(g.records).toBe(1);
    expect(g.totalSales).toBe(1_000_000);
    expect(g.avgMonthlySales).toBe(1_000_000);
  });
});

describe("売上データが無い人の扱い", () => {
  const rows = [
    row("Aさん", "堀江院", "2026-07", "フルタイム社員"),
    row("Bさん", "堀江院", "2026-07", "フルタイム社員"),
    row("Cさん", "堀江院", "2026-07", "フルタイム社員"),
  ];

  it("平均の分母から除外し、¥0 として混ぜない", () => {
    const result = buildEmploymentRanking(rows, {
      months: ["2026-07"],
      getSales: salesFrom({
        "堀江院__Aさん__2026-07": 1_200_000,
        "堀江院__Bさん__2026-07": 800_000,
        // Cさんはサロンボードに行が無い
      }),
    });
    const g = groupOf(result, "フルタイム社員");
    expect(g.people).toBe(3);
    expect(g.records).toBe(3);
    expect(g.validRecords).toBe(2);
    expect(g.missingRecords).toBe(1);
    // 2,000,000 / 2 = 1,000,000（3で割った 666,667 にはしない）
    expect(g.avgMonthlySales).toBe(1_000_000);
  });

  it("データ無しの人は月平均 null・ランキング末尾になる", () => {
    const result = buildEmploymentRanking(rows, {
      months: ["2026-07"],
      getSales: salesFrom({
        "堀江院__Aさん__2026-07": 1_200_000,
        "堀江院__Bさん__2026-07": 800_000,
      }),
    });
    const g = groupOf(result, "フルタイム社員");
    expect(g.members.map((m) => m.name)).toEqual(["Aさん", "Bさん", "Cさん"]);
    expect(g.members[2].avgMonthlySales).toBeNull();
    expect(g.members[2].missingMonths).toEqual(["2026-07"]);
  });

  it("売上が実際に ¥0 の月はデータ無しと区別して分母に入れる", () => {
    const result = buildEmploymentRanking([row("Aさん", "堀江院", "2026-07", "フルタイム社員")], {
      months: ["2026-07"],
      getSales: salesFrom({ "堀江院__Aさん__2026-07": 0 }),
    });
    const g = groupOf(result, "フルタイム社員");
    expect(g.validRecords).toBe(1);
    expect(g.missingRecords).toBe(0);
    expect(g.avgMonthlySales).toBe(0);
  });

  it("グループ全員がデータ無しなら平均は null（¥0 と言い切らない）", () => {
    const result = buildEmploymentRanking([row("Aさん", "堀江院", "2026-07", "パート 週1前後")], {
      months: ["2026-07"],
      getSales: () => null,
    });
    const g = groupOf(result, "パート 週1前後");
    expect(g.avgMonthlySales).toBeNull();
    expect(g.totalSales).toBe(0);
  });
});

describe("複数月の集計", () => {
  const rows = [
    row("Aさん", "堀江院", "2026-06", "フルタイム社員"),
    row("Aさん", "堀江院", "2026-07", "フルタイム社員"),
    row("Bさん", "堀江院", "2026-07", "フルタイム社員"),
  ];
  const sales = salesFrom({
    "堀江院__Aさん__2026-06": 900_000,
    "堀江院__Aさん__2026-07": 1_100_000,
    "堀江院__Bさん__2026-07": 1_500_000,
  });

  it("選んだ全月を集計する（最新月だけにしない）", () => {
    const result = buildEmploymentRanking(rows, {
      months: ["2026-06", "2026-07"],
      getSales: sales,
    });
    const g = groupOf(result, "フルタイム社員");
    expect(g.records).toBe(3);
    expect(g.totalSales).toBe(3_500_000);
    // 1人あたり月間平均 = 3,500,000 / 3レコード
    expect(g.avgMonthlySales).toBe(Math.round(3_500_000 / 3));
  });

  it("在籍月数が違っても月平均で公平に並ぶ（合計だけだと2ヶ月いる人が有利になる）", () => {
    const result = buildEmploymentRanking(rows, {
      months: ["2026-06", "2026-07"],
      getSales: sales,
    });
    const g = groupOf(result, "フルタイム社員");
    // Aさん 合計 2,000,000（月平均 1,000,000）／ Bさん 合計 1,500,000（月平均 1,500,000）
    expect(g.members.map((m) => m.name)).toEqual(["Bさん", "Aさん"]);
    expect(g.members[0].avgMonthlySales).toBe(1_500_000);
    expect(g.members[1].avgMonthlySales).toBe(1_000_000);
    expect(g.members[1].totalSales).toBe(2_000_000);
  });

  it("months: \"all\" は期間を絞らない", () => {
    const result = buildEmploymentRanking(rows, { months: "all", getSales: sales });
    expect(result.months).toEqual(["2026-06", "2026-07"]);
    expect(groupOf(result, "フルタイム社員").records).toBe(3);
  });

  it("期間外の月は入らない", () => {
    const result = buildEmploymentRanking(rows, { months: ["2026-07"], getSales: sales });
    const g = groupOf(result, "フルタイム社員");
    expect(g.records).toBe(2);
    expect(g.totalSales).toBe(2_600_000);
  });
});

describe("期間中に雇用形態が変わった人", () => {
  const rows = [
    row("井上恵子", "楽々園院", "2026-06", "フルタイム社員"),
    row("井上恵子", "楽々園院", "2026-07", "日短社員（週休3日）"),
  ];
  const sales = salesFrom({
    "楽々園院__井上恵子__2026-06": 1_000_000,
    "楽々園院__井上恵子__2026-07": 600_000,
  });

  it("その月の報告どおりに、両方のグループへ該当月のぶんだけ入る", () => {
    const result = buildEmploymentRanking(rows, {
      months: ["2026-06", "2026-07"],
      getSales: sales,
    });
    expect(groupOf(result, "フルタイム社員").totalSales).toBe(1_000_000);
    expect(groupOf(result, "日短社員（週休3日）").totalSales).toBe(600_000);
  });

  it("全体の人数は二重に数えない", () => {
    const result = buildEmploymentRanking(rows, {
      months: ["2026-06", "2026-07"],
      getSales: sales,
    });
    expect(result.totals.people).toBe(1);
    expect(result.totals.records).toBe(2);
    expect(result.totals.totalSales).toBe(1_600_000);
  });
});

describe("除外と並び順", () => {
  it("退社・集計対象外のスタッフは落とす", () => {
    const result = buildEmploymentRanking(
      [
        row("在籍さん", "堀江院", "2026-07", "フルタイム社員"),
        row("退社さん", "堀江院", "2026-07", "フルタイム社員"),
      ],
      {
        months: ["2026-07"],
        getSales: salesFrom({
          "堀江院__在籍さん__2026-07": 1_000_000,
          "堀江院__退社さん__2026-07": 5_000_000,
        }),
        isRetired: (name) => name === "退社さん",
      },
    );
    const g = groupOf(result, "フルタイム社員");
    expect(g.members.map((m) => m.name)).toEqual(["在籍さん"]);
    expect(g.totalSales).toBe(1_000_000);
  });

  it("正式な雇用形態を先に、週数未記入・未記入は後ろに置く", () => {
    const result = buildEmploymentRanking(
      [
        row("Pさん", "堀江院", "2026-07", "パート"),
        row("Qさん", "堀江院", "2026-07", ""),
        row("Rさん", "堀江院", "2026-07", "フルタイム社員"),
      ],
      {
        months: ["2026-07"],
        // 判定できない枠の方が売上が高くても、正式な雇用形態より前には来ない
        getSales: salesFrom({
          "堀江院__Pさん__2026-07": 9_000_000,
          "堀江院__Qさん__2026-07": 8_000_000,
          "堀江院__Rさん__2026-07": 1_000_000,
        }),
      },
    );
    expect(result.groups.map((g) => g.employmentGroup)).toEqual([
      "フルタイム社員",
      PART_TIME_UNSPECIFIED_GROUP,
      EMPLOYMENT_BLANK_GROUP,
    ]);
  });

  it("正式な雇用形態同士は月間平均の降順、平均が出せないグループは末尾", () => {
    const result = buildEmploymentRanking(
      [
        row("Aさん", "堀江院", "2026-07", "パート 週1前後"),
        row("Bさん", "堀江院", "2026-07", "フルタイム社員"),
        row("Cさん", "堀江院", "2026-07", "時短社員（7時間）"),
      ],
      {
        months: ["2026-07"],
        getSales: salesFrom({
          "堀江院__Aさん__2026-07": 300_000,
          "堀江院__Bさん__2026-07": 1_200_000,
          // Cさんはデータ無し → 時短社員は平均が出せない
        }),
      },
    );
    expect(result.groups.map((g) => g.employmentGroup)).toEqual([
      "フルタイム社員",
      "パート 週1前後",
      "時短社員（7時間）",
    ]);
    expect(result.groups[2].avgMonthlySales).toBeNull();
  });
});

describe("画面側の配線", () => {
  function readClientSource(relative: string): string {
    return readFileSync(path.resolve(import.meta.dirname, "../client/src", relative), "utf8");
  }

  it("画面は集計ロジックを自前で書かず lib を使う", () => {
    const page = readClientSource("pages/EmploymentRanking.tsx");
    expect(page).toContain("buildEmploymentRanking");
    expect(page).toContain("isRetiredStaff");
  });

  it("売上は月末報告書（技術+店販）を正本にし、サロンボードを見ていない", () => {
    const page = readClientSource("pages/EmploymentRanking.tsx");
    // 「店舗売上＝サロンボード／個人数値＝月末報告書」（林さん指示 2026-09-03）
    expect(page).toContain("reportRowSales");
    expect(page).not.toContain("useSalonBoardStylistData");
    expect(page).not.toContain("getStylistMonth");
  });

  it("売上の足し方は正本ロジック1箇所（技術+店販）に集約されている", () => {
    const lib = readClientSource("lib/staffReportMetrics.ts");
    expect(lib).toContain("export function reportRowSales");
    expect(lib).toContain("(r.techSales || 0) + (r.retailSales || 0)");
  });

  it("同じ人・同じ月の二重提出は回答日が新しい行の売上を使う", () => {
    const page = readClientSource("pages/EmploymentRanking.tsx");
    // lib 側の dedupeByStaffMonth と同じ判定にそろえていないと、
    // 引き当てた売上が集計対象の行とズレる
    expect(page).toContain("answerDate");
    expect(page).toContain("salesByStaffMonth");
  });

  it("期間は既存の PeriodSelector をそのまま使う", () => {
    const page = readClientSource("pages/EmploymentRanking.tsx");
    expect(page).toContain("getFilterMonths(periodSelection, availableMonths)");
    expect(page).toContain("<PeriodSelector");
  });

  it("分母（有効件数・データ無し件数）を画面に必ず出す", () => {
    const page = readClientSource("pages/EmploymentRanking.tsx");
    expect(page).toContain("validRecords");
    expect(page).toContain("missingRecords");
  });
});
