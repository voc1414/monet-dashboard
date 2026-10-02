import { describe, expect, it } from "vitest";
import {
  reservationGoodImprove,
  reservationsNeeded,
  utilizationGoodImprove,
} from "../client/src/lib/staffSimpleAdvice";
import type { GoodImprove } from "../client/src/lib/staffSimpleAdvice";

const imp = (r: GoodImprove) => [r.improve.lead, ...r.improve.bullets, r.improve.note].filter(Boolean).join("\n");

describe("reservationsNeeded", () => {
  it("目標85%まであと何名か（よしえ 9月: 62名中32名 → 21名）", () => {
    expect(reservationsNeeded(62, 32)).toBe(21);
  });
  it("客数0なら0", () => {
    expect(reservationsNeeded(0, 0)).toBe(0);
  });
});

describe("reservationGoodImprove", () => {
  it("未達＋NPS高: 感動タイミングの文とマニュアルのトーク", () => {
    const r = reservationGoodImprove({ rate: 51.6, totalCustomers: 62, reserved: 32, npsScore: 79 });
    expect(r.good).toContain("感動しているタイミング");
    expect(imp(r)).toContain("あと21名");
    expect(imp(r)).toContain("必ず○月の○週まで");
    expect(r.source).toContain("カウンセリング");
  });
  it("未達＋NPSなし: 件数の文", () => {
    const r = reservationGoodImprove({ rate: 60, totalCustomers: 10, reserved: 6, npsScore: null });
    expect(r.good).toBe("総入客10名中6名に次回予約を案内できています。");
  });
  it("達成", () => {
    const r = reservationGoodImprove({ rate: 90, totalCustomers: 10, reserved: 9, npsScore: 100 });
    expect(r.good).toContain("目標85%を達成");
  });
});

describe("utilizationGoodImprove", () => {
  it("適正: あと何ポイントと予約管理ルール", () => {
    const r = utilizationGoodImprove({ rate: 93.9, nextReservationRate: 51.6, totalCustomers: 62 });
    expect(r.good).toContain("適正");
    expect(imp(r)).toContain("あと1.1ポイント");
    expect(imp(r)).toContain("平日の午前から優先的に");
    expect(r.source).toContain("予約管理");
    expect(r.improve.bullets).toHaveLength(2);
    expect(r.improve.bullets[1]).toContain("休憩時間や予約枠調整");
    expect(r.improve.note).toContain("**月間で5〜10件**");
    expect(r.improve.note).toContain("**7.5万円〜15万円**");
  });
  it("エクセレント（100%超も含む）", () => {
    const r = utilizationGoodImprove({ rate: 108.3, nextReservationRate: 65.4, totalCustomers: 26 });
    expect(r.good).toContain("エクセレント");
  });
  it("要改善＋次回予約率が高い", () => {
    const r = utilizationGoodImprove({ rate: 56.1, nextReservationRate: 97.3, totalCustomers: 37 });
    expect(r.good).toContain("リピートの土台");
  });
});
