import { describe, expect, it } from "vitest";
import { CURRENT_ADS_DIAGNOSIS, storesInGradeOrder } from "../client/src/data/adsDiagnosis";
import { DIAGNOSIS_VISIT_ROWS } from "../client/src/data/adsDiagnosis/visitRows";
import { STORE_MASTER } from "../client/src/data/storeMaster";
import {
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
    expect(DIAGNOSIS_VISIT_ROWS).toEqual([]);

    const empty = diagnosisNewVisits({
      storeName: "春日",
      snapshot: kasuga.newVisits,
      rows: DIAGNOSIS_VISIT_ROWS,
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
    ];
    const filled = diagnosisNewVisits({
      storeName: "春日",
      snapshot: null,
      rows,
      since: period.since,
      until: period.until,
    });
    const expected = sumVisitsInRange(rows, "春日", period.since, period.until)!;
    expect(expected.total).toBe(2 + 3 + 4);
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

  it("本通の新規来店は開店日前なので確認中。判定は変えない", () => {
    const hon = CURRENT_ADS_DIAGNOSIS.stores.find((s) => s.name === "本通")!;
    const master = STORE_MASTER.find((s) => s.name === "本通院")!;
    expect(master.openedOn! > period.until).toBe(true);
    const shown = diagnosisNewVisits({
      storeName: "本通",
      snapshot: hon.newVisits,
      rows: [],
      since: period.since,
      until: period.until,
    });
    expect(hon.newVisits).toBeNull();
    expect(hon.grade).toBe("C");
    expect(shown.text).toBe(PENDING_LABEL);
    expect(shown.note).toContain(master.openedOn);
  });

  it("確認中の一覧は抜けだけ。広告費の端数は合計を書き換えない", () => {
    const lines = diagnosisPendingLines(
      CURRENT_ADS_DIAGNOSIS.stores,
      DIAGNOSIS_VISIT_ROWS,
      period.since,
      period.until,
      CURRENT_ADS_DIAGNOSIS.totals.spendYen,
    );
    expect(lines.some((line) => line.startsWith("春日の新規来店") && line.includes(KASUGA_PENDING_NOTE))).toBe(true);
    expect(lines.some((line) => line.startsWith("本通の新規来店") && line.includes("開店前"))).toBe(true);
    expect(lines.some((line) => line.startsWith("本通の空き枠") && line.includes("未掲載"))).toBe(true);
    expect(lines.some((line) => line.includes("堀江の新規来店"))).toBe(false);
    expect(lines.some((line) => line.includes("堀江2ndの空き枠"))).toBe(false);

    const storeSum = CURRENT_ADS_DIAGNOSIS.stores.reduce((sum, store) => sum + store.spendYen, 0);
    expect(storeSum).not.toBe(CURRENT_ADS_DIAGNOSIS.totals.spendYen);
    expect(lines.some((line) => line.includes(formatYen(storeSum).text) && line.includes(formatYen(CURRENT_ADS_DIAGNOSIS.totals.spendYen).text))).toBe(true);
    expect(CURRENT_ADS_DIAGNOSIS.totals.spendYen).toBe(587529);
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
    expect(partial.newVisits.text).toBe("7");
    expect(partial.newVisits.note).toBeNull();
    expect(partial.gaps).toEqual([]);

    const unopened = storeMetricTexts({
      name: "本通院",
      spend: 10,
      line: 2,
      newVisits: null,
      periodUntil: period.until,
    });
    expect(unopened.newVisits.text).toBe(PENDING_LABEL);
    expect(unopened.newVisits.note).toContain("開店前");
  });
});
