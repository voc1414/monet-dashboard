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
    expect(by["堀江2nd"].lpReachPct).toBe(23.93);
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

  it("堀江2ndのLPは取得済み。未登録の表示は残さない", () => {
    const second = CURRENT_ADS_DIAGNOSIS.stores.find((s) => s.name === "堀江2nd")!;
    expect(second.lpReachPct).toBe(23.93);
    expect(second.lpNote).toBe(
      "Clarity『モネ集客総合』スマホ過去30日・2026-11-28 21:40頃取得（他院は11/27取得）",
    );
    expect(second.lpNote).not.toContain("未登録");
    expect(JSON.stringify(CURRENT_ADS_DIAGNOSIS)).not.toContain("未登録");
    expect(CURRENT_ADS_DIAGNOSIS.missing).toEqual(["動画ごとの数字"]);
    const others = Object.fromEntries(
      CURRENT_ADS_DIAGNOSIS.stores.filter((s) => s.name !== "堀江2nd").map((s) => [s.name, s.lpReachPct]),
    );
    expect(others).toEqual({
      堀江: 27.24,
      楽々園: 20.79,
      福島: 22.35,
      高槻: 32.82,
      姪浜: 30.25,
      土橋: 26.04,
      春日: 38.93,
      岡本: 29.45,
      本通: 42.69,
      下伊福: 27.38,
    });
    const otherNotes = Object.fromEntries(
      CURRENT_ADS_DIAGNOSIS.stores.filter((s) => s.name !== "堀江2nd").map((s) => [s.name, s.lpNote]),
    );
    expect(otherNotes).toEqual({
      堀江: "参考",
      楽々園: "参考",
      福島: "不合格",
      高槻: "不合格",
      姪浜: "不合格",
      土橋: "不合格",
      春日: "参考",
      岡本: "参考",
      本通: "参考",
      下伊福: "参考",
    });
  });

  it("A/B/Cは登録単価とカット空き、LPは40%で決まる。堀江2ndは枠不足のAのまま", () => {
    // ルール文と同じしきい値。LPが40%未満でも、¥600超かつカット5枠以下はAが先。
    const gradeOf = (store: { costPerRegYen: number; slotsCut: number | null }) => {
      if (store.costPerRegYen <= 600) return "C" as const;
      if (store.slotsCut != null && store.slotsCut <= 5) return "A" as const;
      return "B" as const;
    };
    const lpOf = (pct: number | null): "合格" | "LP見直し" | null => {
      if (pct == null) return null;
      return pct >= 40 ? "合格" : "LP見直し";
    };
    expect(CURRENT_ADS_DIAGNOSIS.rules.join("\n")).toContain("40%以上で合格");
    expect(CURRENT_ADS_DIAGNOSIS.rules.join("\n")).toContain("¥600");
    expect(CURRENT_ADS_DIAGNOSIS.rules.join("\n")).toContain("5枠以下");

    for (const store of CURRENT_ADS_DIAGNOSIS.stores) {
      expect(store.grade).toBe(gradeOf(store));
    }
    const second = CURRENT_ADS_DIAGNOSIS.stores.find((s) => s.name === "堀江2nd")!;
    expect(gradeOf(second)).toBe("A");
    expect(second.grade).toBe("A");
    expect(second.action).toBe("予約枠を増やす");
    expect(second.costPerRegYen).toBe(968);
    expect(second.slotsCut).toBe(0);
    expect(lpOf(second.lpReachPct)).toBe("LP見直し");
    const passed = CURRENT_ADS_DIAGNOSIS.stores.filter((s) => lpOf(s.lpReachPct) === "合格").map((s) => s.name);
    expect(passed).toEqual(["本通"]);
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
