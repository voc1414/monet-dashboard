import { describe, expect, it } from "vitest";
import { CURRENT_ADS_DIAGNOSIS, storesInGradeOrder } from "../client/src/data/adsDiagnosis";
import { shukyakuSpendByStore } from "../client/src/data/adsDiagnosis/metaAdsets";
import { STORE_MASTER } from "../client/src/data/storeMaster";
import {
  beforeOpening,
  diagnosisNewVisits,
  diagnosisPendingLines,
  diagnosisSlots,
  formatYen,
  KASUGA_PARTIAL_NOTE,
  KASUGA_PENDING_NOTE,
  parseYmdRange,
  PENDING_LABEL,
  storeMetricTexts,
  sumVisitsInRange,
  type VisitRow,
} from "../client/src/lib/metricGap";

const period = parseYmdRange(CURRENT_ADS_DIAGNOSIS.periodAds)!;

describe("診断と広告の数値の抜け", () => {
  it("日次の行が無い春日は確認中。行があれば診断期間の分だけ足す", () => {
    const kasuga = CURRENT_ADS_DIAGNOSIS.stores.find((s) => s.name === "春日")!;
    expect(kasuga.newVisits).toBeNull();
    expect(kasuga.grade).toBe("C");
    expect(kasuga.action).toBe("問題なし");

    const empty = diagnosisNewVisits({
      storeName: "春日",
      snapshot: kasuga.newVisits,
      rows: [],
      since: period.since,
      until: period.until,
    });
    expect(empty).toEqual({ text: PENDING_LABEL, note: KASUGA_PENDING_NOTE });

    const rows: VisitRow[] = [
      { store: "春日院", date: "2026-10-27", newCount: 100 },
      { store: "春日院", date: "2026-11-09", newCount: 2 },
      { store: "春日院", date: "2026-11-16", newCount: 3 },
      { store: "春日院", date: "2026-11-26", newCount: 4 },
      { store: "春日院", date: "2026-11-27", newCount: 100 },
      { store: "堀江院", date: "2026-11-09", newCount: 50 },
      { store: "monet 白髪染めと髪質改善のサロン 春日院【モネ】", date: "2026-11-10", newCount: 1 },
    ];
    const filled = diagnosisNewVisits({
      storeName: "春日",
      snapshot: null,
      rows,
      since: period.since,
      until: period.until,
    });
    const expected = sumVisitsInRange(rows, "春日", period.since, period.until)!;
    expect(expected.total).toBe(2 + 3 + 4 + 1);
    expect(expected.first).toBe("2026-11-09");
    expect(filled.text).toBe(String(expected.total));
    expect(filled.note).toBe(KASUGA_PARTIAL_NOTE);
    expect(kasuga.grade).toBe("C");
    expect(kasuga.newVisits).toBeNull();
  });

  it("スナップショットに数がある院は、日次が無くてもその数。0枠は確認中にしない", () => {
    const horie = CURRENT_ADS_DIAGNOSIS.stores.find((s) => s.name === "堀江")!;
    const shown = diagnosisNewVisits({
      storeName: "堀江",
      snapshot: horie.newVisits,
      rows: [],
      since: period.since,
      until: period.until,
    });
    expect(shown.text).toBe(String(horie.newVisits));
    expect(shown.note).toBeNull();

    const second = CURRENT_ADS_DIAGNOSIS.stores.find((s) => s.name === "堀江2nd")!;
    expect(second.slotsCut).toBe(0);
    const slots = diagnosisSlots(second);
    expect(slots.text).toContain("カット 0枠");
    expect(slots.text).not.toBe(PENDING_LABEL);

    const hon = CURRENT_ADS_DIAGNOSIS.stores.find((s) => s.name === "本通")!;
    const honSlots = diagnosisSlots(hon);
    expect(honSlots.text).toBe(PENDING_LABEL);
    expect(honSlots.note).toContain("未掲載");
  });

  it("本通・高崎・芦屋は開店前。春日は営業中。判定の記録は変えない", () => {
    expect(beforeOpening("本通", period.until)).toBe(true);
    expect(beforeOpening("本通院", period.until)).toBe(true);
    expect(beforeOpening("高崎院", period.until)).toBe(true);
    expect(beforeOpening("芦屋", period.until)).toBe(true);
    expect(beforeOpening("春日", period.until)).toBe(false);
    expect(beforeOpening("堀江院", period.until)).toBe(false);
    const hon = CURRENT_ADS_DIAGNOSIS.stores.find((s) => s.name === "本通")!;
    expect(hon.grade).toBe("C");
    expect(hon.newVisits).toBeNull();
    const master = STORE_MASTER.find((s) => s.name === "本通院")!;
    expect(master.openedOn! > period.until).toBe(true);
  });

  it("営業中の確認中は春日の日次が無いときだけ。広告費は広告セットの合計と一致する", () => {
    const withoutRows = diagnosisPendingLines(
      CURRENT_ADS_DIAGNOSIS.stores,
      [],
      period.since,
      period.until,
      CURRENT_ADS_DIAGNOSIS.totals.spendYen,
    );
    expect(withoutRows.some((line) => line.startsWith("春日の新規来店") && line.includes(KASUGA_PENDING_NOTE))).toBe(true);
    expect(withoutRows.some((line) => line.includes("本通"))).toBe(false);
    expect(withoutRows.some((line) => line.includes("ずれる"))).toBe(false);

    const withRows = diagnosisPendingLines(
      CURRENT_ADS_DIAGNOSIS.stores,
      [{ store: "春日院", date: "2026-11-09", newCount: 2 }],
      period.since,
      period.until,
      CURRENT_ADS_DIAGNOSIS.totals.spendYen,
    );
    expect(withRows).toEqual([]);

    const meta = shukyakuSpendByStore();
    expect(meta.unassigned).toBe(0);
    expect(meta.total).toBe(CURRENT_ADS_DIAGNOSIS.totals.spendYen);
    const funnel: Record<string, number> = {
      福島: 90205,
      高槻: 45083,
      春日: 79873,
      姪浜: 51426,
      土橋: 45052,
      下伊福: 41077,
    };
    let roundedOff = 0;
    for (const store of CURRENT_ADS_DIAGNOSIS.stores) {
      expect(store.spendYen).toBe(meta.byStore[store.name]);
      if (funnel[store.name] != null) roundedOff += store.spendYen - funnel[store.name];
    }
    expect(roundedOff).toBe(17);
    const storeSum = CURRENT_ADS_DIAGNOSIS.stores.reduce((sum, store) => sum + store.spendYen, 0);
    expect(storeSum).toBe(meta.total);
    expect(storesInGradeOrder(CURRENT_ADS_DIAGNOSIS.stores).map((s) => s.grade).join("")).toBe("AAABBBBCCCC");
    for (const store of CURRENT_ADS_DIAGNOSIS.stores) {
      expect(store.action).not.toContain(PENDING_LABEL);
    }
  });

  it("広告ページは0を残し、無いものだけ確認中。NaNは確認中", () => {
    const zero = storeMetricTexts({
      name: "高崎院",
      spend: 0,
      line: 0,
      newVisits: 0,
      periodUntil: period.until,
    });
    expect(zero.spend.text).toBe("¥0");
    expect(zero.line.text).toBe("0");
    expect(zero.newVisits.text).toBe("0");
    expect(zero.lineUnit.text).toBe(PENDING_LABEL);
    expect(zero.lineUnit.note).toContain("登録が0");
    expect(zero.gaps.map((gap) => gap.metric)).toEqual(["LINE登録単価"]);

    const missing = storeMetricTexts({
      name: "春日院",
      spend: Number.NaN,
      line: null,
      newVisits: null,
      periodUntil: period.until,
    });
    expect(missing.spend.text).toBe(PENDING_LABEL);
    expect(missing.line.note).toContain("流入タグ");
    expect(missing.newVisits.note).toBe(KASUGA_PENDING_NOTE);
    expect(missing.gaps.map((gap) => gap.metric)).toEqual(["広告費", "LINE登録", "LINE登録単価", "新規来店"]);

    const partial = storeMetricTexts({
      name: "春日院",
      spend: 100,
      line: 4,
      newVisits: 7,
      periodUntil: period.until,
    });
    expect(partial.lineUnit.text).toBe(formatYen(100 / 4).text);
    const shiftedSpend = storeMetricTexts({
      name: "堀江院",
      spend: 700,
      lineSpend: 800,
      line: 10,
      newVisits: 1,
      periodUntil: period.until,
    });
    expect(shiftedSpend.spend.text).toBe("¥700");
    expect(shiftedSpend.lineUnit.text).toBe(formatYen(800 / 10).text);
    expect(partial.newVisits.text).toBe("7");
    expect(partial.newVisits.note).toBeNull();
    expect(partial.gaps).toEqual([]);

    const unopened = storeMetricTexts({
      name: "本通院",
      spend: 54376,
      line: 185,
      newVisits: null,
      periodUntil: period.until,
      beforeOpening: true,
    });
    expect(unopened.spend.text).toBe("¥54,376");
    expect(unopened.line.text).toBe("185");
    expect(unopened.newVisits.text).toBe("—");
    expect(unopened.gaps).toEqual([]);

    const undecided = storeMetricTexts({
      name: "高崎院",
      spend: 0,
      line: null,
      newVisits: null,
      periodUntil: period.until,
      beforeOpening: true,
    });
    expect(undecided.spend.text).toBe("¥0");
    expect(undecided.line.text).toBe("—");
    expect(undecided.newVisits.text).toBe("—");
    expect(undecided.gaps).toEqual([]);
  });
});
