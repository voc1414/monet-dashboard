/**
 * スタッフ個人の実績を月末報告書から算出する（正本ロジック）
 *
 * 林さんの決定は一貫して「店舗売上＝サロンボード／個人数値＝月末報告書」。
 * 2026-06〜09 のあいだ個人までサロンボード(stylist_flat)にしていたのは承認記録の無い変更
 * （fd724ae で優先化、dc932af で報告書フォールバックを削除。どちらもコミットに指示の記録が無い）。
 * 2026-09-03 の林さん指示で報告書へ戻した。
 *
 * ここに切り出した理由は2つ。
 * ① 画面（スタッフ詳細・スタッフ一覧・店舗内表彰・雇用形態別）で同じ計算を使うため
 * ② 期間合算をテストで検証できるようにするため
 *    （従来は画面の中で最新1行だけを見ており、全期間・年間を選んでも単月のままだった）
 */

/** 算出に必要な最小の形。月末報告書の1行（StaffReport）がそのまま入る */
export interface StaffReportMetricsInput {
  reportMonth: string;
  answerDate: string;
  techSales: number;
  retailSales: number;
  newCustomers: number;
  returnCustomers: number;
  nextReservation: number;
  employmentType: string;
}

export interface StaffReportMetrics {
  totalSales: number;
  techSales: number;
  retailSales: number;
  unitPrice: number;
  totalCustomers: number;
  newCustomers: number;
  returnCustomers: number;
  nextReservation: number;
  nextReservationRate: number;
  /** 合算した月数（1なら単月） */
  monthCount: number;
  /**
   * 1ヶ月あたりの平均客数（= 総客数 ÷ 合算月数）。
   * 稼働率は「1ヶ月に何人こなせるか」の枠で割る指標なので、
   * 複数月を合算した総客数をそのまま渡すと 400% などになる。稼働率にはこの値を使う。
   */
  avgMonthlyCustomers: number;
  employmentType: string;
  dataSource: "report";
}

/**
 * 同じ対象月に複数の回答があるときは回答日が新しい1行だけ残す（二重計上を防ぐ）。
 * 実データに重複あり（例: 石原葉子の 2026-07）。返り値は対象月の降順。
 */
export function pickLatestPerMonth<T extends { reportMonth: string; answerDate: string }>(rows: T[]): T[] {
  const latestByMonth = new Map<string, T>();
  rows.forEach(r => {
    const cur = latestByMonth.get(r.reportMonth);
    if (!cur || r.answerDate > cur.answerDate) latestByMonth.set(r.reportMonth, r);
  });
  return Array.from(latestByMonth.values()).sort((a, b) => b.reportMonth.localeCompare(a.reportMonth));
}

/**
 * 報告書の行を合算して個人実績にする。
 * 報告書に総売上・客単価の列は無いので、以下で算出する（林さん承認 2026-09-03）。
 *   総売上   = 技術売上 + 店販売上
 *   総客数   = 新規 + 再来
 *   客単価   = 総売上 ÷ 総客数
 *   次回予約率 = Σ次回予約数 ÷ Σ総客数
 * 行が無い（＝報告書を出していない）場合は null を返す。0円と「未提出」を混同しないため。
 */
export function aggregateStaffReportMetrics(rows: StaffReportMetricsInput[]): StaffReportMetrics | null {
  const deduped = pickLatestPerMonth(rows);
  if (deduped.length === 0) return null;

  const sum = (f: (r: StaffReportMetricsInput) => number) =>
    deduped.reduce((acc, r) => acc + (f(r) || 0), 0);

  const techSales = sum(r => r.techSales);
  const retailSales = sum(r => r.retailSales);
  const totalSales = techSales + retailSales;
  const newCustomers = sum(r => r.newCustomers);
  const returnCustomers = sum(r => r.returnCustomers);
  const totalCustomers = newCustomers + returnCustomers;
  const nextReservation = sum(r => r.nextReservation);

  return {
    totalSales,
    techSales,
    retailSales,
    unitPrice: totalCustomers > 0 ? Math.round(totalSales / totalCustomers) : 0,
    totalCustomers,
    newCustomers,
    returnCustomers,
    nextReservation,
    nextReservationRate: totalCustomers > 0 ? Math.round((nextReservation / totalCustomers) * 1000) / 10 : 0,
    monthCount: deduped.length,
    avgMonthlyCustomers: Math.round(totalCustomers / deduped.length),
    employmentType: deduped[0].employmentType,
    dataSource: "report",
  };
}

/** スタッフの識別キー。表示名は店舗をまたいで重複するので必ず「店舗＋名前」の組で扱う */
export function staffKeyOf(r: { name: string; storeNormalized: string }): string {
  return `${r.name}__${r.storeNormalized}`;
}

/**
 * 選択期間の報告書を「店舗＋名前」でまとめ、1人1件にして返す。
 * `rep` は期間内で最も新しい行（コメント・行動チェック・雇用形態の表示用）、
 * `metrics` はその期間ぶんを合算した実績。
 *
 * 従来は画面側で「各スタッフの最新1月」だけを選んでいたため、
 * 全期間・年間・複数月を選んでも数字が単月のままだった。
 *
 * @param months 対象月の配列。"all" なら期間で絞らない
 */
export function groupStaffReportsByStaff<
  T extends StaffReportMetricsInput & { name: string; storeNormalized: string }
>(rows: T[], months: string[] | "all"): Array<{ key: string; rep: T; metrics: StaffReportMetrics }> {
  const monthSet = months === "all" ? null : new Set(months);
  const groups = new Map<string, T[]>();
  rows.forEach(r => {
    if (monthSet && !monthSet.has(r.reportMonth)) return;
    const key = staffKeyOf(r);
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  });

  const result: Array<{ key: string; rep: T; metrics: StaffReportMetrics }> = [];
  groups.forEach((groupRows, key) => {
    const metrics = aggregateStaffReportMetrics(groupRows);
    const rep = pickLatestPerMonth(groupRows)[0];
    if (!metrics || !rep) return;
    result.push({ key, rep, metrics });
  });
  return result;
}
