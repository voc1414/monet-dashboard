import { describe, expect, it } from "vitest";
import { CURRENT_ADS_DIAGNOSIS, snapshotFixedLabel, storesInGradeOrder } from "../client/src/data/adsDiagnosis";

describe("集客広告 店舗診断 2026-11-27", () => {
  const stores = storesInGradeOrder(CURRENT_ADS_DIAGNOSIS.stores);

  it("並びは A → B → C。Cは問題なし", () => {
    expect(stores.map((s) => s.grade).join("")).toBe("AAABBBBCCCC");
    expect(stores.filter((s) => s.grade === "C").every((s) => s.action === "問題なし")).toBe(true);
  });

  it("表の空欄はCSVの値。無いものは null のまま", () => {
    const by = Object.fromEntries(stores.map((s) => [s.name, s]));
    expect(by["堀江"].regRatePct).toBe(38.3);
    expect(by["堀江"].slotsCut).toBe(3);
    expect(by["春日"].slotsCut).toBe(97);
    expect(by["春日"].newVisits).toBeNull();
    expect(by["本通"].newVisits).toBeNull();
    expect(by["本通"].slotsCut).toBeNull();
    expect(by["本通"].slotsNote).toContain("未掲載");
    expect(by["堀江2nd"].lpReachPct).toBeNull();
    expect(by["姪浜"].regRateNote).toContain("41.1%");
    expect(by["姪浜"].slotsCut).toBe(6);
  });

  it("確認中は合計と院の判定に混ぜない", () => {
    expect(CURRENT_ADS_DIAGNOSIS.pending.length).toBeGreaterThan(0);
    expect(JSON.stringify(CURRENT_ADS_DIAGNOSIS.totals)).not.toContain("確認中");
    for (const store of stores) {
      expect(store.action).not.toContain("確認中");
    }
  });

  it("見出しは期間と取得日の固定値で、ライブの広告ページと区別できる", () => {
    expect(snapshotFixedLabel(CURRENT_ADS_DIAGNOSIS)).toBe("10/28〜11/26の固定値（11/27取得）");
    expect(
      snapshotFixedLabel({
        id: "custom",
        periodAds: "2026-10-28〜2026-11-26",
        sources: [{ id: "meta", label: "Meta", fetchedAt: "2026-11-27 15:05" }],
      }),
    ).toBe("10/28〜11/26の固定値（11/27取得）");
  });

  it("全店合計は診断の記載どおり", () => {
    expect(CURRENT_ADS_DIAGNOSIS.totals).toEqual({
      spendYen: 587529,
      leads: 2982,
      lineReg: 1103,
      costPerRegYen: 533,
      regRatePct: 37,
    });
  });
});
