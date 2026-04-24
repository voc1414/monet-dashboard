import { describe, it, expect } from "vitest";
import {
  getMaxCustomers,
  calculateUtilizationRate,
  getUtilizationColor,
  getUtilizationLabel,
  EMPLOYMENT_MAX_CUSTOMERS,
} from "../client/src/lib/utilizationRate";

describe("utilizationRate", () => {
  describe("getMaxCustomers", () => {
    it("フルタイム社員の最大客数は66", () => {
      expect(getMaxCustomers("フルタイム社員")).toBe(66);
    });

    it("時短社員（6時間）の最大客数は44", () => {
      expect(getMaxCustomers("時短社員（6時間）")).toBe(44);
    });

    it("時短社員（7時間）の最大客数は60", () => {
      expect(getMaxCustomers("時短社員（7時間）")).toBe(60);
    });

    it("日短社員（週休3日）の最大客数は54", () => {
      expect(getMaxCustomers("日短社員（週休3日）")).toBe(54);
    });

    it("日短社員（週休2日＋公休2日）の最大客数は60", () => {
      expect(getMaxCustomers("日短社員（週休2日＋公休2日）")).toBe(60);
    });

    it("パート 週1前後の最大客数は8（半角スペース）", () => {
      expect(getMaxCustomers("パート 週1前後")).toBe(8);
    });

    it("パート　週2前後の最大客数は16（全角スペース）", () => {
      expect(getMaxCustomers("パート　週2前後")).toBe(16);
    });

    it("パート 週3前後の最大客数は24", () => {
      expect(getMaxCustomers("パート 週3前後")).toBe(24);
    });

    it("半角括弧でも正規化されてマッチする", () => {
      expect(getMaxCustomers("時短社員(6時間)")).toBe(44);
    });

    it("前後にスペースがあっても正規化される", () => {
      expect(getMaxCustomers("  フルタイム社員  ")).toBe(66);
    });

    it("不明な雇用形態はnullを返す", () => {
      expect(getMaxCustomers("アルバイト")).toBeNull();
      expect(getMaxCustomers("")).toBeNull();
    });

    it("日短社員(週休2日+2日)の省略表記でもマッチする", () => {
      expect(getMaxCustomers("日短社員(週休2日+2日)")).toBe(60);
    });

    it("「パート」のみの場合はnullを返す（週数不明）", () => {
      expect(getMaxCustomers("パート")).toBeNull();
    });
  });

  describe("calculateUtilizationRate", () => {
    it("フルタイム社員で33客 → 50%", () => {
      expect(calculateUtilizationRate(33, "フルタイム社員")).toBe(50);
    });

    it("フルタイム社員で66客 → 100%", () => {
      expect(calculateUtilizationRate(66, "フルタイム社員")).toBe(100);
    });

    it("パート 週1前後で4客 → 50%", () => {
      expect(calculateUtilizationRate(4, "パート 週1前後")).toBe(50);
    });

    it("パート 週3前後で24客 → 100%", () => {
      expect(calculateUtilizationRate(24, "パート 週3前後")).toBe(100);
    });

    it("時短社員（6時間）で22客 → 50%", () => {
      expect(calculateUtilizationRate(22, "時短社員（6時間）")).toBe(50);
    });

    it("0客 → 0%", () => {
      expect(calculateUtilizationRate(0, "フルタイム社員")).toBe(0);
    });

    it("最大客数を超える場合も正しく計算", () => {
      const rate = calculateUtilizationRate(70, "フルタイム社員");
      expect(rate).toBeGreaterThan(100);
    });

    it("不明な雇用形態はnullを返す", () => {
      expect(calculateUtilizationRate(30, "不明")).toBeNull();
    });

    it("小数点1桁で丸められる", () => {
      // 40 / 66 = 60.606... → 60.6
      expect(calculateUtilizationRate(40, "フルタイム社員")).toBe(60.6);
    });
  });

  describe("getUtilizationColor", () => {
    it("95%以上は緑（エクセレント！）", () => {
      expect(getUtilizationColor(95)).toBe("text-[#2D9C8F]");
      expect(getUtilizationColor(100)).toBe("text-[#2D9C8F]");
      expect(getUtilizationColor(105)).toBe("text-[#2D9C8F]");
    });

    it("90〜94%は黄（適正）", () => {
      expect(getUtilizationColor(90)).toBe("text-[#E5B85C]");
      expect(getUtilizationColor(92)).toBe("text-[#E5B85C]");
      expect(getUtilizationColor(94)).toBe("text-[#E5B85C]");
    });

    it("89%以下は赤（要改善）", () => {
      expect(getUtilizationColor(89)).toBe("text-[#C75C5C]");
      expect(getUtilizationColor(75)).toBe("text-[#C75C5C]");
      expect(getUtilizationColor(50)).toBe("text-[#C75C5C]");
      expect(getUtilizationColor(30)).toBe("text-[#C75C5C]");
    });
  });

  describe("getUtilizationLabel", () => {
    it("95%以上はエクセレント！", () => {
      expect(getUtilizationLabel(95)).toBe("エクセレント！");
      expect(getUtilizationLabel(100)).toBe("エクセレント！");
      expect(getUtilizationLabel(105)).toBe("エクセレント！");
    });

    it("90〜94%は適正", () => {
      expect(getUtilizationLabel(90)).toBe("適正");
      expect(getUtilizationLabel(92)).toBe("適正");
      expect(getUtilizationLabel(94)).toBe("適正");
    });

    it("89%以下は要改善", () => {
      expect(getUtilizationLabel(89)).toBe("要改善");
      expect(getUtilizationLabel(75)).toBe("要改善");
      expect(getUtilizationLabel(50)).toBe("要改善");
      expect(getUtilizationLabel(30)).toBe("要改善");
    });
  });
});
