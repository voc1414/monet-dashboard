import { describe, it, expect } from "vitest";
import { getReportMonth } from "@/hooks/useMonthlyReport";

/**
 * 月末報告書は「回答した月の前月」の報告として集計する。
 *
 * 元の実装は Date#setMonth(getMonth() - 1) で前月へ動かしていたため、
 * 提出日が月末だと前月に31日が無く、日が溢れて当月に戻ってしまっていた。
 * 例: 2026-03-31 → setMonth で「2月31日」→ 3月3日 → 報告月が 2026-03（正しくは 2026-02）。
 *
 * 回答日時の形は実スプシ（L Message 書き出し）の "YYYY-MM-DD h:mm:ss am/pm"。
 */

describe("getReportMonth — 回答日時 → 報告月", () => {
  it("月の途中に提出した回答は前月になる", () => {
    expect(getReportMonth("2026-08-03 9:12:44 am")).toBe("2026-07");
    expect(getReportMonth("2026-05-01 11:41:04 pm")).toBe("2026-04");
    expect(getReportMonth("2026-01-06 8:00:00 pm")).toBe("2025-12");
  });

  // 前月の日数が足りない日。ここが元のバグで当月に落ちていた
  const monthEnds: [string, string][] = [
    ["2026-03-29 10:00:00 pm", "2026-02"],
    ["2026-03-30 10:00:00 pm", "2026-02"],
    ["2026-03-31 11:41:04 pm", "2026-02"],
    ["2026-05-31 9:00:00 pm", "2026-04"],
    ["2026-07-31 9:00:00 pm", "2026-06"],
    ["2026-10-31 9:00:00 pm", "2026-09"],
    ["2026-12-31 11:59:00 pm", "2026-11"],
  ];
  it.each(monthEnds)("月末提出 %s は %s の報告になる", (answered, expected) => {
    expect(getReportMonth(answered)).toBe(expected);
  });

  it("うるう年の 2/29 提出も1月になる", () => {
    expect(getReportMonth("2028-02-29 8:00:00 pm")).toBe("2028-01");
  });

  it("1月提出は前年12月になる", () => {
    expect(getReportMonth("2026-01-31 11:00:00 pm")).toBe("2025-12");
  });

  it("読めない値は空文字（行を落とす）", () => {
    expect(getReportMonth("")).toBe("");
    expect(getReportMonth("未回答")).toBe("");
  });
});
