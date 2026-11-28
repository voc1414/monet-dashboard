/**
 * 店舗（集客）の LINE 登録が急に落ちたときの赤警告。
 * データは広告シートの既存列だけ（monet のリード、lmessage の累計友だち数）。新しい列は足さない。
 *
 * 当日はまだ増えている途中なので、窓の終わりは「今日の前日」か、シートの最新日がそれより前ならその日。
 * 2026-11-27 の姪浜院は 11/24〜26 がリード11・登録0。当日（11/27）の登録3を入れると警告が消える。
 */
import { getCampaignType, resolveLineWindow, type LmsgRow, type MonetRow } from "@/hooks/useAdsData";

/** 広告ページの店舗照合と同じ接頭辞（Ads.tsx の lookupStoreLine） */
const AREA_PREFIX = /^(大阪|広島|福岡|兵庫|岡山|京都|東京|北海道|帯広|神戸|名古屋|横浜)/;

export const LINE_DROP_HINT = "LINEのタグ（区分＝集客）の振り分けを確認";

export interface LineDropWarning {
  store: string;
  leads3: number;
  regs3: number;
  leads7: number;
  regs7: number;
  leadsPrev21: number;
  regsPrev21: number;
  /** リードが0のときは null */
  rate7: number | null;
  ratePrev21: number | null;
  /** 直近3日リード≥5 かつ 登録0 */
  zero3: boolean;
  /** 直近7日の登録率が、その前21日の半分未満（前の期間のリード≥10） */
  half7: boolean;
}

export function jstToday(now = new Date()): string {
  const j = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${j.getUTCFullYear()}-${p(j.getUTCMonth() + 1)}-${p(j.getUTCDate())}`;
}

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

function pct(n: number | null): string {
  if (n == null) return "—";
  return `${Math.round(n * 100)}%`;
}

export function formatLineDrop(w: LineDropWarning): string {
  return [
    `${w.store}：直近3日 リード${w.leads3}・登録${w.regs3}`,
    `直近7日 ${pct(w.rate7)}（登録${w.regs7}/リード${w.leads7}）`,
    `その前21日 ${pct(w.ratePrev21)}（登録${w.regsPrev21}/リード${w.leadsPrev21}）`,
  ].join("、");
}

function placeOf(tagName: string): string {
  return tagName.replace(/流入$/, "").replace(AREA_PREFIX, "");
}

interface Series {
  place: string;
  snaps: { date: string; count: number }[];
}

function lineSeries(rows: LmsgRow[]): Series[] {
  const map = new Map<string, Series>();
  for (const r of rows) {
    if (r.category !== "集客" || !r.date) continue;
    const place = placeOf(r.tagName || "");
    if (!place || place.startsWith("_")) continue;
    const key = `${r.botId}|${r.tagId}`;
    let g = map.get(key);
    if (!g) {
      g = { place, snaps: [] };
      map.set(key, g);
    }
    g.snaps.push({ date: r.date, count: r.count });
  }
  return [...map.values()];
}

/** 期間の登録数＝終了日までの累計 − 開始前日までの累計（負は0）。広告ページと同じ差分 */
function delta(snaps: Series["snaps"], since: string, until: string): number {
  const before = addDays(since, -1);
  let start: { date: string; count: number } | null = null;
  let end: { date: string; count: number } | null = null;
  for (const s of snaps) {
    if (s.date <= before && (!start || s.date > start.date || (s.date === start.date && s.count > start.count))) start = s;
    if (s.date <= until && (!end || s.date > end.date || (s.date === end.date && s.count > end.count))) end = s;
  }
  if (!end) return 0;
  return Math.max(0, end.count - (start ? start.count : 0));
}

/**
 * 登録数と、その差分が実際に使った起点・終点。
 * 端の行が無いときは countedSince/Until が選択期間とずれる。リードはこの日付で数える。
 */
function regsIn(
  series: Series[],
  store: string,
  since: string,
  until: string,
): { count: number; countedSince: string; countedUntil: string } {
  const places = [...new Set(series.map((g) => g.place))].filter((p) => store.includes(p));
  places.sort((a, b) => b.length - a.length);
  const best = places[0];
  if (!best) return { count: 0, countedSince: since, countedUntil: until };
  const matched = series.filter((g) => g.place === best);
  const window = resolveLineWindow(
    matched.flatMap((g) => g.snaps.map((s) => s.date)),
    since,
    until,
  );
  let total = 0;
  for (const g of matched) total += delta(g.snaps, since, until);
  return { count: total, countedSince: window.countedSince, countedUntil: window.countedUntil };
}

function leadsIn(rows: MonetRow[], store: string, since: string, until: string): number {
  let n = 0;
  for (const r of rows) {
    if (!r.date || r.date < since || r.date > until) continue;
    if (r.tenpo !== store) continue;
    if (getCampaignType(r.camp) !== "集客") continue;
    n += r.lead;
  }
  return n;
}

function latestDataDate(monet: MonetRow[], lmessage: LmsgRow[]): string {
  let max = "";
  for (const r of monet) {
    if (r.date && getCampaignType(r.camp) === "集客" && r.tenpo && r.date > max) max = r.date;
  }
  for (const r of lmessage) {
    if (r.date && r.category === "集客" && r.date > max) max = r.date;
  }
  return max;
}

export function detectLineRegistrationDrops(monet: MonetRow[], lmessage: LmsgRow[], today: string): LineDropWarning[] {
  const max = latestDataDate(monet, lmessage);
  if (!max || !today) return [];
  const yesterday = addDays(today, -1);
  const end = max >= today ? yesterday : max;
  const since3 = addDays(end, -2);
  const since7 = addDays(end, -6);
  const prevEnd = addDays(since7, -1);
  const prevStart = addDays(prevEnd, -20);
  const series = lineSeries(lmessage);
  const stores = new Set<string>();
  for (const r of monet) {
    if (r.tenpo && getCampaignType(r.camp) === "集客") stores.add(r.tenpo);
  }
  const out: LineDropWarning[] = [];
  for (const store of stores) {
    const regs3 = regsIn(series, store, since3, end);
    const leads3 = leadsIn(monet, store, regs3.countedSince, regs3.countedUntil);
    const regs7 = regsIn(series, store, since7, end);
    const leads7 = leadsIn(monet, store, regs7.countedSince, regs7.countedUntil);
    const regsPrev21 = regsIn(series, store, prevStart, prevEnd);
    const leadsPrev21 = leadsIn(monet, store, regsPrev21.countedSince, regsPrev21.countedUntil);
    const rate7 = leads7 > 0 ? regs7.count / leads7 : null;
    const ratePrev21 = leadsPrev21 > 0 ? regsPrev21.count / leadsPrev21 : null;
    const zero3 = leads3 >= 5 && regs3.count === 0;
    const half7 = leadsPrev21 >= 10 && rate7 != null && ratePrev21 != null && rate7 < ratePrev21 / 2;
    if (!zero3 && !half7) continue;
    out.push({
      store,
      leads3,
      regs3: regs3.count,
      leads7,
      regs7: regs7.count,
      leadsPrev21,
      regsPrev21: regsPrev21.count,
      rate7,
      ratePrev21,
      zero3,
      half7,
    });
  }
  out.sort((a, b) => a.store.localeCompare(b.store, "ja"));
  return out;
}
