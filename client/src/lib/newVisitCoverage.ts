/**
 * 広告ページの新規来店が、選択期間の日次（daily_new）を何日分しか足していないか。
 * 行が無い日は来店 0 ではなく未取得なので、そのまま足すと少なめに見える。
 * 系列が期間の途中から始まる店（例: 春日が 11/9 から）は、その開始日も添える。
 * 全日そろっている店は返さない。問題が無いときの帯は出さない。
 */

export interface NewVisitCoverage {
  store: string;
  periodDays: number;
  coveredDays: number;
  /** 系列の初日が選択期間の途中なら "11/9"。期間より前からデータがある店は null */
  startsOnLabel: string | null;
  message: string;
}

function inclusiveDays(since: string, until: string): number {
  const a = Date.parse(`${since}T00:00:00Z`);
  const b = Date.parse(`${until}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

function monthDay(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${Number(m[2])}/${Number(m[3])}`;
}

function coverageMessage(periodDays: number, coveredDays: number, startsOnLabel: string | null): string {
  const base = `新規来店：${periodDays}日中${coveredDays}日分のみ（少なめに出ている可能性）`;
  return startsOnLabel ? `${base}・${startsOnLabel}以降の分` : base;
}

/**
 * 店舗名は呼び出し側で短縮名に揃えて渡す。日付は YYYY-MM-DD。
 * 系列の開始判定には期間外の行も使う（期間内だけ渡すと、前からの系列を途中開始と誤る）。
 */
export function newVisitCoverage(
  rows: { store: string; date: string }[],
  since: string,
  until: string,
): NewVisitCoverage[] {
  const periodDays = inclusiveDays(since, until);
  if (periodDays <= 0) return [];

  const byStore = new Map<string, { dates: Set<string>; first: string }>();
  for (const row of rows) {
    const store = (row.store || "").trim();
    const date = (row.date || "").trim();
    if (!store || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    let group = byStore.get(store);
    if (!group) {
      group = { dates: new Set(), first: date };
      byStore.set(store, group);
    }
    group.dates.add(date);
    if (date < group.first) group.first = date;
  }

  const out: NewVisitCoverage[] = [];
  for (const [store, group] of byStore) {
    // 系列がこの期間より後に始まる店は、この期間の欠測ではない
    if (group.first > until) continue;
    let coveredDays = 0;
    for (const date of group.dates) {
      if (date >= since && date <= until) coveredDays += 1;
    }
    if (coveredDays >= periodDays) continue;
    const startsInside = group.first > since && group.first <= until;
    const startsOnLabel = startsInside ? monthDay(group.first) : null;
    out.push({
      store,
      periodDays,
      coveredDays,
      startsOnLabel,
      message: coverageMessage(periodDays, coveredDays, startsOnLabel),
    });
  }
  out.sort((a, b) => a.coveredDays - b.coveredDays || a.store.localeCompare(b.store, "ja"));
  return out;
}
