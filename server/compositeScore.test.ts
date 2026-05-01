import { describe, it, expect } from "vitest";
import { calculateCompositeScore } from "../client/src/lib/compositeScore";

describe("calculateCompositeScore", () => {
  it("全データが揃っている場合、100点満点でスコアを算出する", () => {
    const result = calculateCompositeScore({
      npsScore: 100,
      npsResponseCount: 10,
      nextReservationRate: 100,
      utilizationRate: 100,
      fankuruPdfCount: 3,
      fankuruCommentCount: 1,
    });
    expect(result.total).toBeGreaterThanOrEqual(90);
    expect(result.total).toBeLessThanOrEqual(100);
    expect(result.dataCoverage).toBe(1);
    expect(result.rank.label).toBe("エクセレント");
  });

  it("NPSデータのみの場合、データ充足率40%で正規化される", () => {
    const result = calculateCompositeScore({
      npsScore: 50,
      npsResponseCount: 10,
      nextReservationRate: null,
      utilizationRate: null,
      fankuruPdfCount: 0,
      fankuruCommentCount: 0,
    });
    expect(result.dataCoverage).toBe(0.4);
    expect(result.available.nps).toBe(true);
    expect(result.available.reservation).toBe(false);
    expect(result.available.fankuru).toBe(false);
    expect(result.available.utilization).toBe(false);
    // NPS 50 → (150/200)*40 = 30 → 信頼度1.0 → 30/40 = 75%
    expect(result.total).toBe(75);
  });

  it("データが全くない場合はnull相当（total=0）", () => {
    const result = calculateCompositeScore({
      npsScore: null,
      npsResponseCount: 0,
      nextReservationRate: null,
      utilizationRate: null,
      fankuruPdfCount: 0,
      fankuruCommentCount: 0,
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
      fankuruPdfCount: 0,
      fankuruCommentCount: 0,
    });
    const result10 = calculateCompositeScore({
      npsScore: 80,
      npsResponseCount: 10,
      nextReservationRate: null,
      utilizationRate: null,
      fankuruPdfCount: 0,
      fankuruCommentCount: 0,
    });
    // 回答1件は信頼度60%、10件は100%
    expect(result1.npsComponent).toBeLessThan(result10.npsComponent);
  });

  it("次回予約率85%以上で満点（25点）", () => {
    const result = calculateCompositeScore({
      npsScore: null,
      npsResponseCount: 0,
      nextReservationRate: 90,
      utilizationRate: null,
      fankuruPdfCount: 0,
      fankuruCommentCount: 0,
    });
    expect(result.reservationComponent).toBe(25);
    expect(result.total).toBe(100); // 25/25 = 100%
  });

  it("稼働率95%以上で満点（15点）", () => {
    const result = calculateCompositeScore({
      npsScore: null,
      npsResponseCount: 0,
      nextReservationRate: null,
      utilizationRate: 95,
      fankuruPdfCount: 0,
      fankuruCommentCount: 0,
    });
    expect(result.utilizationComponent).toBe(15);
    expect(result.total).toBe(100); // 15/15 = 100%
  });

  it("稼働率60%以下で0点", () => {
    const result = calculateCompositeScore({
      npsScore: null,
      npsResponseCount: 0,
      nextReservationRate: null,
      utilizationRate: 55,
      fankuruPdfCount: 0,
      fankuruCommentCount: 0,
    });
    expect(result.utilizationComponent).toBe(0);
    expect(result.total).toBe(0);
  });

  it("ファンくるPDF3件+コメントで20点", () => {
    const result = calculateCompositeScore({
      npsScore: null,
      npsResponseCount: 0,
      nextReservationRate: null,
      utilizationRate: null,
      fankuruPdfCount: 3,
      fankuruCommentCount: 1,
    });
    expect(result.fankuruComponent).toBe(20);
    expect(result.total).toBe(100); // 20/20 = 100%
  });

  it("ランク判定が正しい", () => {
    // エクセレント (85+)
    const excellent = calculateCompositeScore({
      npsScore: 100,
      npsResponseCount: 10,
      nextReservationRate: 100,
      utilizationRate: 100,
      fankuruPdfCount: 3,
      fankuruCommentCount: 1,
    });
    expect(excellent.rank.label).toBe("エクセレント");

    // 要改善 (0-39)
    const poor = calculateCompositeScore({
      npsScore: -80,
      npsResponseCount: 10,
      nextReservationRate: 10,
      utilizationRate: 55,
      fankuruPdfCount: 0,
      fankuruCommentCount: 0,
    });
    expect(poor.rank.label).toBe("要改善");
  });

  it("複合データで正しくスコアが合算される", () => {
    const result = calculateCompositeScore({
      npsScore: 50,
      npsResponseCount: 10,
      nextReservationRate: 85,
      utilizationRate: 90,
      fankuruPdfCount: 1,
      fankuruCommentCount: 0,
    });
    expect(result.dataCoverage).toBe(1);
    expect(result.npsComponent).toBeGreaterThan(0);
    expect(result.reservationComponent).toBe(25);
    expect(result.fankuruComponent).toBe(8);
    expect(result.utilizationComponent).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(50);
    expect(result.total).toBeLessThanOrEqual(100);
  });
});
