/*
 * 店舗マスタの開店日から決めること（2026-11-28 点検で追加）。
 *
 * ■ HPB（ホットペッパービューティー）掲載費をいつの月から計上するか
 *
 * 開店前の店は掲載費が発生しないので、開始月より前の月には計上しない（Ads.tsx の既存方針）。
 * これまでは開始月を手書きの表（HPB_START_MONTH）だけで持っていたため、表に無い新店
 * （本通院 2026-12-21 開店予定・高崎院／芦屋院 開店日未定）まで「最初から掲載」扱いになり、
 * 過去30日で各 ¥110,000 が合計に入って CPA を悪化させていた。
 *
 * 決め方（上から順に）:
 *   1. 手書きの表にある店 → その月（林さん確認済みの値を優先）
 *   2. 店舗マスタ（Notion「DB_monet店舗一覧」の写し）に開店日がある店 → 開店日の月
 *   3. 店舗マスタにあるが開店日が未定の店 → 計上しない（null）
 *   4. 店舗マスタに無い店 → 最初から掲載（""＝どの月も計上）
 */
import { STORE_MASTER } from "@/data/storeMaster";

/** "" = すべての月を計上、null = 計上しない、"YYYY-MM" = その月から計上 */
export function hpbStartMonth(
  storeName: string,
  explicit: Record<string, string>,
  key: (name: string) => string,
): string | null {
  const k = key(storeName);
  const fromTable = Object.entries(explicit).find(([name]) => key(name) === k)?.[1];
  if (fromTable) return fromTable;
  const master = STORE_MASTER.find((s) => key(s.name) === k);
  if (!master) return "";
  if (!master.openedOn) return null;
  return master.openedOn.slice(0, 7);
}

/**
 * その月の末日までに開店していた店か（店舗一覧で、開店前の月に「—」だけのカードを出さないため）。
 * 店舗マスタに無い店は判定できないので true（今までどおり出す）。開店日未定の店は false。
 */
export function openedByMonth(storeName: string, ym: string): boolean {
  const master = STORE_MASTER.find((s) => s.name === storeName);
  if (!master) return true;
  if (!master.openedOn) return false;
  return master.openedOn <= `${ym}-31`;
}
