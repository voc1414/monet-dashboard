import { describe, it, expect } from "vitest";
import { calculateCompositeScore } from "../client/src/lib/compositeScore";

describe("calculateCompositeScore", () => {
  it("全データが揃っている場合、100点満点でスコアを算出する", () => {
    const result = calculateCompositeScore({
      npsScore: 100,
      npsResponseCount: 10,
      nextReservationRate: 100,
      utilizationRate: 100,
    });
    expect(result.total).toBeGreaterThanOrEqual(90);
    expect(result.total).toBeLessThanOrEqual(100);
    expect(result.dataCoverage).toBe(1);
    expect(result.rank.label).toBe("エクセレント");
  });

  it("NPSデータのみの場合、データ充足率10%で正規化される", () => {
    const result = calculateCompositeScore({
      npsScore: 50,
      npsResponseCount: 10,
      nextReservationRate: null,
      utilizationRate: null,
    });
    expect(result.dataCoverage).toBe(0.1);
    expect(result.available.nps).toBe(true);
    expect(result.available.reservation).toBe(false);
    expect(result.available.utilization).toBe(false);
    // NPS 50 → (150/200)*10 = 7.5 → 信頼度1.0 → 7.5/10 = 75%
    expect(result.total).toBe(75);
  });

  it("データが全くない場合はtotal=0", () => {
    const result = calculateCompositeScore({
      npsScore: null,
      npsResponseCount: 0,
      nextReservationRate: null,
      utilizationRate: null,
    });
    expect(result.total).toBe(0);
    expect(result.dataCoverage).toBe(0);
  });

  it("NPS回答数が少ない場合、信頼度で減衰する", () => {
    const result1 = calculateCompositeScore({
      npsScore: 80,
      npsResponseCount: 1,
      nextReservationRate: null,
      utilizationRate: null,
    });
    const result10 = calculateCompositeScore({
      npsScore: 80,
      npsResponseCount: 10,
      nextReservationRate: null,
      utilizationRate: null,
    });
    // 回答1件は信頼度60%、10件は100%
    expect(result1.npsComponent).toBeLessThan(result10.npsComponent);
  });

  it("次回予約率85%以上で満点（50点）", () => {
    const result = calculateCompositeScore({
      npsScore: null,
      npsResponseCount: 0,
      nextReservationRate: 90,
      utilizationRate: null,
    });
    expect(result.reservationComponent).toBe(50);
    expect(result.total).toBe(100); // 50/50 = 100%
  });

  it("稼働率95%以上で満点（40点）", () => {
    const result = calculateCompositeScore({
      npsScore: null,
      npsResponseCount: 0,
      nextReservationRate: null,
      utilizationRate: 95,
    });
    expect(result.utilizationComponent).toBe(40);
    expect(result.total).toBe(100); // 40/40 = 100%
  });

  it("稼働率60%以下で0点", () => {
    const result = calculateCompositeScore({
      npsScore: null,
      npsResponseCount: 0,
      nextReservationRate: null,
      utilizationRate: 55,
    });
    expect(result.utilizationComponent).toBe(0);
    expect(result.total).toBe(0);
  });

  it("ランク判定が正しい", () => {
    // エクセレント (85+)
    const excellent = calculateCompositeScore({
      npsScore: 100,
      npsResponseCount: 10,
      nextReservationRate: 100,
      utilizationRate: 100,
    });
    expect(excellent.rank.label).toBe("エクセレント");

    // 要改善 (0-39)
    const poor = calculateCompositeScore({
      npsScore: -80,
      npsResponseCount: 10,
      nextReservationRate: 10,
      utilizationRate: 55,
    });
    expect(poor.rank.label).toBe("要改善");
  });

  it("複合データで正しくスコアが合算される", () => {
    const result = calculateCompositeScore({
      npsScore: 50,
      npsResponseCount: 10,
      nextReservationRate: 85,
      utilizationRate: 90,
    });
    expect(result.dataCoverage).toBe(1);
    expect(result.npsComponent).toBeGreaterThan(0);
    expect(result.reservationComponent).toBe(50); // 85%で満点
    expect(result.utilizationComponent).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(50);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it("rawValuesに実数値が保持される", () => {
    const result = calculateCompositeScore({
      npsScore: 42,
      npsResponseCount: 5,
      nextReservationRate: 78.5,
      utilizationRate: 82.3,
    });
    expect(result.rawValues.npsScore).toBe(42);
    expect(result.rawValues.npsResponseCount).toBe(5);
    expect(result.rawValues.nextReservationRate).toBe(78.5);
    expect(result.rawValues.utilizationRate).toBe(82.3);
  });

  it("ファンくるパラメータなしでも正常に動作する", () => {
    // 新しいインターフェースにはfankuruパラメータがない
    const result = calculateCompositeScore({
      npsScore: 60,
      npsResponseCount: 8,
      nextReservationRate: 75,
      utilizationRate: 80,
    });
    expect(result.total).toBeGreaterThan(0);
    expect(result.available.nps).toBe(true);
    expect(result.available.reservation).toBe(true);
    expect(result.available.utilization).toBe(true);
  });

  it("新配点: 次回予約率50点・稼働率40点・NPS10点の配分が正しい", () => {
    // 次回予約率のみ100% → 50/50 = 100点
    const reservOnly = calculateCompositeScore({
      npsScore: null,
      npsResponseCount: 0,
      nextReservationRate: 100,
      utilizationRate: null,
    });
    expect(reservOnly.reservationComponent).toBe(50);
    expect(reservOnly.dataCoverage).toBe(0.5);

    // 稼働率のみ100% → 40/40 = 100点
    const utilOnly = calculateCompositeScore({
      npsScore: null,
      npsResponseCount: 0,
      nextReservationRate: null,
      utilizationRate: 100,
    });
    expect(utilOnly.utilizationComponent).toBe(40);
    expect(utilOnly.dataCoverage).toBe(0.4);

    // NPS最高のみ → 10/10 = 100点
    const npsOnly = calculateCompositeScore({
      npsScore: 100,
      npsResponseCount: 10,
      nextReservationRate: null,
      utilizationRate: null,
    });
    expect(npsOnly.npsComponent).toBe(10);
    expect(npsOnly.dataCoverage).toBe(0.1);
  });
});
