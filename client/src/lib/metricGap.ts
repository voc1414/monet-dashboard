/**
 * 診断画面と広告ページで、数値が無い・計算できないマスを「確認中」にする。
 * 日次の新規来店が行として渡されたときだけ合計する。無い数字は作らない。
 * 判定（A/B/C）はここでは扱わない。
 */
import { STORE_MASTER } from "@/data/storeMaster";
import { storeNameFromMaster } from "@/lib/storeNameFromMaster";

export const PENDING_LABEL = "確認中";

/** 春日は系列が 11/9 から。合計できるときはこの注記、行が無いときは下の注記。 */
export const KASUGA_PARTIAL_NOTE = "11/9以降の分（少なめに出ている可能性）";
export const KASUGA_PENDING_NOTE = "11/9以降の分のみ取得";

export interface MetricText {
  text: string;
  note: string | null;
}

export interface VisitRow {
  store: string;
  date: string;
  newCount: number;
}

export const BEFORE_OPENING_LABEL = "開店前";

/** サロンボードの長い店名も、診断の短い店名も、同じキーに畳む。 */
export function storeKey(name: string): string {
  const folded = storeNameFromMaster(name) || name || "";
  return folded.replace(/院/g, "").replace(/[\s　]/g, "");
}

function monthDay(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${Number(m[2])}/${Number(m[3])}`;
}

export function formatYen(n: number): MetricText {
  if (!Number.isFinite(n)) return { text: PENDING_LABEL, note: "数値が無い" };
  return { text: "¥" + Math.round(n).toLocaleString("ja-JP"), note: null };
}

export function formatCount(n: number): MetricText {
  if (!Number.isFinite(n)) return { text: PENDING_LABEL, note: "数値が無い" };
  return { text: Math.round(n).toLocaleString("ja-JP"), note: null };
}

export function parseYmdRange(text: string): { since: string; until: string } | null {
  const range = text.match(/\d{4}-\d{2}-\d{2}/g);
  if (!range || range.length < 2) return null;
  return { since: range[0], until: range[1] };
}

/** 期間内の行だけを足す。同じ店のキーは「院」と空白を除いて比べる。行が無ければ null。 */
export function sumVisitsInRange(
  rows: VisitRow[],
  storeName: string,
  since: string,
  until: string,
): { total: number; first: string } | null {
  const key = storeKey(storeName);
  let total = 0;
  let first: string | null = null;
  let hit = false;
  for (const row of rows) {
    if (storeKey(row.store) !== key) continue;
    if (row.date < since || row.date > until) continue;
    if (!Number.isFinite(row.newCount)) continue;
    hit = true;
    total += row.newCount;
    if (first == null || row.date < first) first = row.date;
  }
  if (!hit || first == null) return null;
  return { total, first };
}

function masterOf(storeName: string) {
  const key = storeKey(storeName);
  return STORE_MASTER.find((s) => storeKey(s.name) === key) ?? null;
}

/** 開店日が期間の終わりより後、または未定。asOf が空なら判定しない。 */
export function beforeOpening(name: string, asOf: string): boolean {
  if (!asOf) return false;
  const master = masterOf(name);
  if (!master) return false;
  if (!master.openedOn) return true;
  return master.openedOn > asOf;
}

function missingVisitNote(storeName: string, until: string, where: "snapshot" | "live"): string {
  if (storeKey(storeName) === "春日") return KASUGA_PENDING_NOTE;
  const master = masterOf(storeName);
  if (master?.openedOn && until && master.openedOn > until) {
    return `開店前（開店日 ${master.openedOn}）`;
  }
  if (master && !master.openedOn) return "開店日未定";
  return where === "snapshot" ? "日次の新規来店がリポジトリに無い" : "この期間の日次新規来店が無い";
}

/**
 * 診断の新規来店。日次の行があればその合計（期間の途中からなら注記）。
 * 行が無くスナップショットに数があればその数。どちらも無ければ確認中。
 */
export function diagnosisNewVisits(args: {
  storeName: string;
  snapshot: number | null;
  rows: VisitRow[];
  since: string;
  until: string;
}): MetricText {
  const summed = sumVisitsInRange(args.rows, args.storeName, args.since, args.until);
  if (summed) {
    const partial = summed.first > args.since;
    const startedOnKasuga = storeKey(args.storeName) === "春日" && summed.first === "2026-11-09";
    return {
      text: formatCount(summed.total).text,
      note: !partial ? null : startedOnKasuga ? KASUGA_PARTIAL_NOTE : `${monthDay(summed.first)}以降の分（少なめに出ている可能性）`,
    };
  }
  if (args.snapshot != null && Number.isFinite(args.snapshot)) {
    return formatCount(args.snapshot);
  }
  return { text: PENDING_LABEL, note: missingVisitNote(args.storeName, args.until, "snapshot") };
}

export function diagnosisSlots(store: {
  slotsCut: number | null;
  slotsColor: number | null;
  slotsNote: string | null;
}): MetricText {
  if (store.slotsCut == null || !Number.isFinite(store.slotsCut)) {
    return { text: PENDING_LABEL, note: store.slotsNote || "空き枠の取得データがリポジトリに無い" };
  }
  const color =
    store.slotsColor == null || !Number.isFinite(store.slotsColor) ? PENDING_LABEL : `${store.slotsColor}枠`;
  return {
    text: `カット ${store.slotsCut}枠 ／ カット＋カラー ${color}`,
    note: store.slotsNote,
  };
}

export function diagnosisLineUnit(spend: number, line: number, stored: number): MetricText {
  if (!Number.isFinite(line) || line <= 0) {
    return { text: PENDING_LABEL, note: "登録が無いため単価を出せない" };
  }
  if (!Number.isFinite(spend)) return { text: PENDING_LABEL, note: "広告費が無いため単価を出せない" };
  if (!Number.isFinite(stored)) return { text: PENDING_LABEL, note: "単価の数値が無い" };
  return formatYen(stored);
}

export interface StoreMetricInput {
  name: string;
  spend: number;
  /** 流入タグが無い店は null。0 は登録増分が 0。 */
  line: number | null;
  /** 日次・月次のどちらにも無い店は null。0 は来店 0。 */
  newVisits: number | null;
  periodUntil: string;
  /** 開店前の店は、無い新規来店・LINEを確認中にしない */
  beforeOpening?: boolean;
}

export interface StoreGap {
  store: string;
  metric: "広告費" | "LINE登録" | "LINE登録単価" | "新規来店";
  note: string;
}

export function storeMetricTexts(input: StoreMetricInput): {
  spend: MetricText;
  line: MetricText;
  lineUnit: MetricText;
  newVisits: MetricText;
  gaps: StoreGap[];
} {
  const spend = formatYen(input.spend);
  const line =
    input.line == null || !Number.isFinite(input.line)
      ? { text: PENDING_LABEL, note: "流入タグがこの店に紐づいていない" }
      : formatCount(input.line);
  let lineUnit: MetricText;
  if (input.line == null || !Number.isFinite(input.line)) {
    lineUnit = { text: PENDING_LABEL, note: "流入タグがこの店に紐づいていない" };
  } else if (input.line <= 0) {
    lineUnit = { text: PENDING_LABEL, note: "登録が0のため単価を出せない" };
  } else if (!Number.isFinite(input.spend) || input.spend <= 0) {
    lineUnit = { text: PENDING_LABEL, note: "広告費が無いため単価を出せない" };
  } else {
    lineUnit = formatYen(input.spend / input.line);
  }
  const blank: MetricText = { text: "—", note: null };
  const newVisits =
    input.newVisits != null && Number.isFinite(input.newVisits)
      ? formatCount(input.newVisits)
      : input.beforeOpening
        ? blank
        : { text: PENDING_LABEL, note: missingVisitNote(input.name, input.periodUntil, "live") };
  const lineShown = input.beforeOpening && line.text === PENDING_LABEL ? blank : line;
  const unitShown = input.beforeOpening && lineUnit.text === PENDING_LABEL ? blank : lineUnit;
  const gaps: StoreGap[] = [];
  const push = (metric: StoreGap["metric"], value: MetricText) => {
    if (!input.beforeOpening && value.text === PENDING_LABEL && value.note) {
      gaps.push({ store: input.name, metric, note: value.note });
    }
  };
  push("広告費", spend);
  push("LINE登録", lineShown);
  push("LINE登録単価", unitShown);
  push("新規来店", newVisits);
  return { spend, line: lineShown, lineUnit: unitShown, newVisits, gaps };
}

export interface DiagnosisMetricStore {
  name: string;
  spendYen: number;
  lineReg: number;
  costPerRegYen: number;
  newVisits: number | null;
  slotsCut: number | null;
  slotsColor: number | null;
  slotsNote: string | null;
}

/** 院の広告費を足した額と、診断に書いてある全店合計が違うときだけ返す。 */
export function spendRemainder(
  stores: { spendYen: number }[],
  totalSpendYen: number,
): { storeSum: number; total: number; diff: number } | null {
  const storeSum = stores.reduce((sum, store) => sum + store.spendYen, 0);
  if (!Number.isFinite(storeSum) || !Number.isFinite(totalSpendYen) || storeSum === totalSpendYen) return null;
  return { storeSum, total: totalSpendYen, diff: totalSpendYen - storeSum };
}

/** タップで開く「数値の確認中」。値が出せた項目は入れない。 */
export function diagnosisPendingLines(
  stores: DiagnosisMetricStore[],
  rows: VisitRow[],
  since: string,
  until: string,
  totalSpendYen: number,
  visitsReady = true,
): string[] {
  const lines: string[] = [];
  for (const store of stores) {
    if (beforeOpening(store.name, until)) continue;
    const spend = formatYen(store.spendYen);
    const line = formatCount(store.lineReg);
    const unit = diagnosisLineUnit(store.spendYen, store.lineReg, store.costPerRegYen);
    const visits = diagnosisNewVisits({
      storeName: store.name,
      snapshot: store.newVisits,
      rows,
      since,
      until,
    });
    const slots = diagnosisSlots(store);
    const parts: [string, MetricText][] = [
      ["広告費", spend],
      ["LINE登録", line],
      ["LINE登録単価", unit],
      ["新規来店", visits],
      ["空き枠", slots],
    ];
    for (const [metric, value] of parts) {
      if (!visitsReady && metric === "新規来店") continue;
      if (value.text === PENDING_LABEL) {
        lines.push(`${store.name}の${metric}：${PENDING_LABEL}（${value.note ?? "数値が無い"}）`);
      }
    }
  }
  const gap = spendRemainder(stores, totalSpendYen);
  if (gap) {
    lines.push(
      `全店の広告費 ${formatYen(gap.total).text} と、営業中の院の広告費を足した ${formatYen(gap.storeSum).text} は ${formatYen(Math.abs(gap.diff)).text} ずれる`,
    );
  }
  return lines;
}
