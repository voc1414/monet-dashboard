import { describe, it, expect } from "vitest";
import { generateStaffAdvice } from "../client/src/lib/staffAdvice";

describe("generateStaffAdvice", () => {
  it("高稼働率の場合に強みとして表示される", () => {
    const advice = generateStaffAdvice({
      totalScore: 84,
      rankLabel: "優秀",
      nextReservationRate: 62.9,
      utilizationRate: 93.9,
      npsScore: null,
      totalCustomers: 62,
      nextReservationCount: 39,
    });

    expect(advice.strength).not.toBeNull();
    expect(advice.strength).toContain("稼働率");
    expect(advice.strength).toContain("93.9%");
  });

  it("次回予約率が目標未達の場合に改善アドバイスが生成される", () => {
    const advice = generateStaffAdvice({
      totalScore: 84,
      rankLabel: "優秀",
      nextReservationRate: 62.9,
      utilizationRate: 93.9,
      npsScore: null,
      totalCustomers: 62,
      nextReservationCount: 39,
    });

    expect(advice.reservationAdvice).not.toBeNull();
    expect(advice.reservationAdvice!.achieved).toBe(false);
    expect(advice.reservationAdvice!.currentRate).toBe(62.9);
    expect(advice.reservationAdvice!.targetRate).toBe(85);
    // 62名 × 85% = 52.7 → 53名必要、現在39名 → あと14名
    expect(advice.reservationAdvice!.additionalNeeded).toBe(14);
    expect(advice.reservationAdvice!.projectedScore).toBeGreaterThan(84);
    expect(advice.reservationAdvice!.manualUrl).toContain("notion.site");
  });

  it("次回予約率85%以上の場合は達成済みフラグが立つ", () => {
    const advice = generateStaffAdvice({
      totalScore: 95,
      rankLabel: "エクセレント",
      nextReservationRate: 89.5,
      utilizationRate: 93.9,
      npsScore: 75,
      totalCustomers: 62,
      nextReservationCount: 55,
    });

    expect(advice.reservationAdvice).not.toBeNull();
    expect(advice.reservationAdvice!.achieved).toBe(true);
    expect(advice.reservationAdvice!.additionalNeeded).toBe(0);
  });

  it("次回予約率が高い場合は強みとして表示される", () => {
    const advice = generateStaffAdvice({
      totalScore: 95,
      rankLabel: "エクセレント",
      nextReservationRate: 90,
      utilizationRate: 80,
      npsScore: null,
      totalCustomers: 50,
      nextReservationCount: 45,
    });

    expect(advice.strength).not.toBeNull();
    // 稼働率80%は90未満なので強みにならない → 予約率が強みになる
    expect(advice.strength).toContain("次回予約率");
  });

  it("NPS+50以上の場合は強みとして表示される", () => {
    const advice = generateStaffAdvice({
      totalScore: 70,
      rankLabel: "優秀",
      nextReservationRate: 60,
      utilizationRate: 80,
      npsScore: 55,
      totalCustomers: 50,
      nextReservationCount: 30,
    });

    // 稼働率80%は90未満、予約率60%は85未満 → NPSが強み
    expect(advice.strength).not.toBeNull();
    expect(advice.strength).toContain("NPS");
  });

  it("データがない場合はnullを返す", () => {
    const advice = generateStaffAdvice({
      totalScore: 0,
      rankLabel: "要改善",
      nextReservationRate: null,
      utilizationRate: null,
      npsScore: null,
      totalCustomers: 0,
      nextReservationCount: 0,
    });

    expect(advice.strength).toBeNull();
    expect(advice.reservationAdvice).toBeNull();
  });

  it("予想スコアのランクラベルが正しく計算される", () => {
    const advice = generateStaffAdvice({
      totalScore: 84,
      rankLabel: "優秀",
      nextReservationRate: 62.9,
      utilizationRate: 93.9,
      npsScore: null,
      totalCustomers: 62,
      nextReservationCount: 39,
    });

    // 85%達成時のスコアはエクセレント（85以上）になるはず
    expect(advice.reservationAdvice!.projectedScore).toBeGreaterThanOrEqual(85);
    expect(advice.reservationAdvice!.projectedRankLabel).toBe("エクセレント");
  });

  it("全指標が強みの場合は稼働率が優先される", () => {
    const advice = generateStaffAdvice({
      totalScore: 98,
      rankLabel: "エクセレント",
      nextReservationRate: 92,
      utilizationRate: 96,
      npsScore: 80,
      totalCustomers: 50,
      nextReservationCount: 46,
    });

    // 稼働率が最初にチェックされるので稼働率が強みになる
    expect(advice.strength).toContain("稼働率");
  });

  it("客数0の場合はadditionalNeededが0になる", () => {
    const advice = generateStaffAdvice({
      totalScore: 50,
      rankLabel: "良好",
      nextReservationRate: 50,
      utilizationRate: 80,
      npsScore: null,
      totalCustomers: 0,
      nextReservationCount: 0,
    });

    expect(advice.reservationAdvice).not.toBeNull();
    expect(advice.reservationAdvice!.additionalNeeded).toBe(0);
  });
});
