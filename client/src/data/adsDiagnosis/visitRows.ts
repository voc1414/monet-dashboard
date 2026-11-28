/**
 * 診断期間に足す日次の新規来店。1行 = 店舗 × 日付 × 新規数。
 * このリポジトリには日次の行が無い。スナップショットの newVisits がある院はその数、
 * 無い院は画面で「確認中」（春日は「11/9以降の分のみ取得」）。
 * 行を足したときは、画面が診断期間に入る分だけを合計する。手で合計を書かない。
 */
export interface DiagnosisVisitRow {
  store: string;
  /** YYYY-MM-DD */
  date: string;
  newCount: number;
}

export const DIAGNOSIS_VISIT_ROWS: DiagnosisVisitRow[] = [];
