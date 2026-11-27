/**
 * 画面が読む診断スナップショット。次回は新しいファイルを足して、この1行を差し替える。
 */
export { ADS_DIAGNOSIS_20261127 as CURRENT_ADS_DIAGNOSIS } from "./2026-11-27";
export type { AdsDiagnosisSnapshot, DiagnosisGrade, DiagnosisStore, DiagnosisSource } from "./2026-11-27";

import type { DiagnosisGrade, DiagnosisStore } from "./2026-11-27";

const GRADE_ORDER: Record<DiagnosisGrade, number> = { A: 0, B: 1, C: 2 };

/** A（枠不足）→ B（広告・LP）→ C（問題なし）。同区分はスナップショットの並びを保つ */
export function storesInGradeOrder(stores: DiagnosisStore[]): DiagnosisStore[] {
  return stores
    .map((store, index) => ({ store, index }))
    .sort((a, b) => GRADE_ORDER[a.store.grade] - GRADE_ORDER[b.store.grade] || a.index - b.index)
    .map((x) => x.store);
}
