/**
 * 広告ページの新規来店（daily_new）の読み方。
 *
 * サロンボード公式の売上明細を12ヶ月分まとめて毎朝取り直している。
 * その日に取り消し以外の会計が無いと行を書かない（0件の行は作らない）。
 * 行が無い日は来店ゼロで、公式の月次合計とも一致する。
 *
 * 店の系列の最初の日から daily_new 全体の最新日までのあいだで行が無い日は
 * 0件として数え、欠損としては警告しない。
 * 警告は、全体の最新日が選択期間の最終日より前のときだけ（データが新しくない）。
 * 系列が期間の途中から始まる店は警告にせず、その店への注記だけ返す。
 * 問題が無いときは stale を null にする（緑の帯は出さない）。
 * 要対応（stale）だけを最上段に出す。途中開始の注記は店の行に付ける。
 *
 * 系列の開始と全体の最新日には、選択期間の外の行も使う
 * （期間内だけ渡すと、前からの系列を途中開始と誤る）。
 */

export interface NewVisitStale {
  /** daily_new 全体の最新日（YYYY-MM-DD） */
  latest: string;
  message: string;
}

export interface NewVisitStartNote {
  store: string;
  /** 系列の初日（YYYY-MM-DD）。選択期間の途中 */
  startsOn: string;
  /** 「11/9から集計（開店前の日は含まない）」 */
  message: string;
}

export interface NewVisitCoverage {
  /** 最新日が選択期間の最終日以降なら null。帯は出さない */
  stale: NewVisitStale | null;
  /** 期間の途中から系列が始まる店。警告ではない */
  startNotes: NewVisitStartNote[];
  /**
   * 選択期間について来店数を確定できる店。
   * 系列の開始から全体の最新日までが期間と重なる。行が無い日は 0件。
   * 期間より後に始まる店、データが期間の開始より前で止まっている店は含まない。
   */
  knownStores: string[];
}

const EMPTY: NewVisitCoverage = { stale: null, startNotes: [], knownStores: [] };

function monthDay(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${Number(m[2])}/${Number(m[3])}`;
}

function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * 店舗名は呼び出し側で短縮名に揃えて渡す。日付は YYYY-MM-DD。
 */
export function newVisitCoverage(
  rows: { store: string; date: string }[],
  since: string,
  until: string,
): NewVisitCoverage {
  if (!isYmd(since) || !isYmd(until) || until < since) return EMPTY;

  const byStore = new Map<string, string>();
  let latest = "";
  for (const row of rows) {
    const store = (row.store || "").trim();
    const date = (row.date || "").trim();
    if (!store || !isYmd(date)) continue;
    if (date > latest) latest = date;
    const first = byStore.get(store);
    if (first == null || date < first) byStore.set(store, date);
  }
  if (!latest) return EMPTY;

  // 最新日より後の日はまだ取り込まれていない。それより前の行無しは来店ゼロ。
  const stale: NewVisitStale | null =
    latest < until
      ? { latest, message: `新規来店：データは${latest}まで（選択期間の最終日より前）` }
      : null;

  // データが期間の開始より前で止まっていると、期間内を 0件とは確定できない
  const reachesPeriod = latest >= since;
  const startNotes: NewVisitStartNote[] = [];
  const knownStores: string[] = [];
  for (const [store, first] of byStore) {
    // 系列がこの期間より後に始まる店は、この期間の注記でも 0件でもない
    if (first > until) continue;
    if (reachesPeriod) knownStores.push(store);
    // 期間の初日以前から系列がある店は、行の無い日を 0件として扱うだけ
    if (first <= since) continue;
    const label = monthDay(first);
    startNotes.push({
      store,
      startsOn: first,
      message: `${label}から集計（開店前の日は含まない）`,
    });
  }
  startNotes.sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.store.localeCompare(b.store, "ja"));
  knownStores.sort((a, b) => a.localeCompare(b, "ja"));
  return { stale, startNotes, knownStores };
}
