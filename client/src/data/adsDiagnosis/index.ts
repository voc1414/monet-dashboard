/**
 * 画面が読む診断スナップショット。次回は新しいファイルを足して、この1行を差し替える。
 */
export { ADS_DIAGNOSIS_20261127 as CURRENT_ADS_DIAGNOSIS } from "./2026-11-27";
export type { AdsDiagnosisSnapshot, DiagnosisGrade, DiagnosisStore, DiagnosisSource } from "./2026-11-27";

import type { AdsDiagnosisSnapshot, DiagnosisGrade, DiagnosisStore } from "./2026-11-27";

const GRADE_ORDER: Record<DiagnosisGrade, number> = { A: 0, B: 1, C: 2 };

function monthDay(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return ymd;
  return `${Number(m[2])}/${Number(m[3])}`;
}

/**
 * 診断がライブの広告ページと取り違えられないよう、期間と取得日を短く出す。
 * 例: 「10/28〜11/26の固定値（11/27取得）」
 */
export function snapshotFixedLabel(
  snapshot: Pick<AdsDiagnosisSnapshot, "id" | "periodAds" | "sources">,
): string {
  const fetched =
    snapshot.id.match(/\d{4}-\d{2}-\d{2}/)?.[0] ??
    snapshot.sources.map((s) => s.fetchedAt.match(/\d{4}-\d{2}-\d{2}/)?.[0]).find(Boolean) ??
    snapshot.id;
  const range = snapshot.periodAds.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  const from = range[0];
  const to = range[1];
  const period = from && to ? `${monthDay(from)}〜${monthDay(to)}` : snapshot.periodAds;
  return `${period}の固定値（${monthDay(fetched)}取得）`;
}

/** 個別注記が取得日を書いているか。共通の出典行と日付が二重にならないようにする */
function noteHasFetchedAt(note: string): boolean {
  return /\d{4}-\d{2}-\d{2}/.test(note) && note.includes("取得");
}

/**
 * LP欄の値と出典。注記に取得日時がある店は、その注記だけを出し、共通の出典行は出さない。
 * 「参考」「不合格」だけの院は、共通の出典行をそのまま出す。
 */
export function lpMetricLines(
  store: Pick<DiagnosisStore, "lpReachPct" | "lpNote">,
  commonSource: string,
): { value: string; source: string } {
  const value = store.lpReachPct == null ? store.lpNote : `${store.lpReachPct}% ${store.lpNote}`;
  return { value, source: noteHasFetchedAt(store.lpNote) ? "" : commonSource };
}

/** A（枠不足）→ B（広告・LP）→ C（問題なし）。同区分はスナップショットの並びを保つ */
export function storesInGradeOrder(stores: DiagnosisStore[]): DiagnosisStore[] {
  return stores
    .map((store, index) => ({ store, index }))
    .sort((a, b) => GRADE_ORDER[a.store.grade] - GRADE_ORDER[b.store.grade] || a.index - b.index)
    .map((x) => x.store);
}
