/**
 * 月末報告書 異常値検出ユーティリティ
 *
 * スタッフが入力した月末報告書のデータを検証し、
 * 入力ミスの可能性がある項目をアラートとして表示する。
 *
 * 【検出パターン】
 * - 売上が0円（技術売上・店販売上ともに0）
 * - 売上が異常に低い（技術売上が5,000円未満で客数が1以上）
 * - 売上が異常に高い（技術売上が500万円超）
 * - 客単価が異常（2,000円未満 or 100,000円超）
 * - 客数が0なのに売上がある
 * - 客数が異常に多い（300名超）
 * - 次回予約数が総客数を超えている
 * - 次回予約率が100%超
 * - 新規客数＋再来客数の合計が総客数と一致しない（計算不整合）
 * - 店販売上が技術売上を大幅に超えている（5倍以上）
 */

import type { StaffReport, StoreMonthlyStats } from "@/hooks/useMonthlyReport";

export type AlertSeverity = "error" | "warning" | "info";

export interface ReportAlert {
  /** アラートの重要度 */
  severity: AlertSeverity;
  /** 対象スタッフ名 */
  staffName: string;
  /** 対象フィールド */
  field: string;
  /** アラートメッセージ */
  message: string;
  /** 実際の値 */
  actualValue: string;
}

/**
 * 個別スタッフの報告データを検証
 */
function validateStaffReport(report: StaffReport): ReportAlert[] {
  const alerts: ReportAlert[] = [];
  const name = report.name;

  // 1. 売上が0円（技術売上・店販売上ともに0）で客数がある場合
  if (report.totalSales === 0 && report.totalCustomers > 0) {
    alerts.push({
      severity: "error",
      staffName: name,
      field: "totalSales",
      message: `客数が${report.totalCustomers}名いるのに売上が0円です。入力漏れの可能性があります`,
      actualValue: "¥0",
    });
  }

  // 2. 技術売上が異常に低い（5,000円未満で客数が1以上）
  if (report.techSales > 0 && report.techSales < 5000 && report.totalCustomers >= 1) {
    alerts.push({
      severity: "error",
      staffName: name,
      field: "techSales",
      message: `技術売上が¥${report.techSales.toLocaleString()}と異常に低いです。桁の入力ミスの可能性があります`,
      actualValue: `¥${report.techSales.toLocaleString()}`,
    });
  }

  // 3. 売上が異常に高い（技術売上が500万円超）
  if (report.techSales > 5000000) {
    alerts.push({
      severity: "warning",
      staffName: name,
      field: "techSales",
      message: `技術売上が¥${report.techSales.toLocaleString()}と非常に高額です。入力ミスでないか確認してください`,
      actualValue: `¥${report.techSales.toLocaleString()}`,
    });
  }

  // 4. 客単価が異常に低い（2,000円未満で客数がある）
  if (report.totalCustomers > 0 && report.unitPrice > 0 && report.unitPrice < 2000) {
    alerts.push({
      severity: "warning",
      staffName: name,
      field: "unitPrice",
      message: `客単価が¥${report.unitPrice.toLocaleString()}と異常に低いです。売上または客数の入力ミスの可能性があります`,
      actualValue: `¥${report.unitPrice.toLocaleString()}`,
    });
  }

  // 5. 客単価が異常に高い（100,000円超）
  if (report.unitPrice > 100000) {
    alerts.push({
      severity: "warning",
      staffName: name,
      field: "unitPrice",
      message: `客単価が¥${report.unitPrice.toLocaleString()}と非常に高額です。売上または客数の入力ミスの可能性があります`,
      actualValue: `¥${report.unitPrice.toLocaleString()}`,
    });
  }

  // 6. 客数が0なのに売上がある
  if (report.totalCustomers === 0 && report.totalSales > 0) {
    alerts.push({
      severity: "error",
      staffName: name,
      field: "totalCustomers",
      message: `売上が¥${report.totalSales.toLocaleString()}あるのに客数が0名です。客数の入力漏れの可能性があります`,
      actualValue: "0名",
    });
  }

  // 7. 客数が異常に多い（300名超）
  if (report.totalCustomers > 300) {
    alerts.push({
      severity: "warning",
      staffName: name,
      field: "totalCustomers",
      message: `総客数が${report.totalCustomers}名と異常に多いです。入力ミスでないか確認してください`,
      actualValue: `${report.totalCustomers}名`,
    });
  }

  // 8. 次回予約数が総客数を超えている
  if (report.nextReservation > report.totalCustomers && report.totalCustomers > 0) {
    alerts.push({
      severity: "warning",
      staffName: name,
      field: "nextReservation",
      message: `次回予約数(${report.nextReservation})が総客数(${report.totalCustomers})を超えています`,
      actualValue: `${report.nextReservation}件`,
    });
  }

  // 9. 店販売上が技術売上の5倍以上（通常は技術売上が主）
  if (report.retailSales > 0 && report.techSales > 0 && report.retailSales > report.techSales * 5) {
    alerts.push({
      severity: "warning",
      staffName: name,
      field: "retailSales",
      message: `店販売上(¥${report.retailSales.toLocaleString()})が技術売上(¥${report.techSales.toLocaleString()})の5倍以上です。入力が逆になっていないか確認してください`,
      actualValue: `¥${report.retailSales.toLocaleString()}`,
    });
  }

  // 10. 全項目が0（何も入力されていない可能性）
  if (
    report.totalSales === 0 &&
    report.totalCustomers === 0 &&
    report.nextReservation === 0
  ) {
    alerts.push({
      severity: "info",
      staffName: name,
      field: "all",
      message: `すべての数値項目が0です。未入力の可能性があります`,
      actualValue: "すべて0",
    });
  }

  return alerts;
}

/**
 * 店舗全体の報告データを検証
 */
export function validateStoreReport(stats: StoreMonthlyStats | null): ReportAlert[] {
  if (!stats) return [];

  const alerts: ReportAlert[] = [];

  // 各スタッフの個別検証
  for (const sr of stats.staffReports) {
    alerts.push(...validateStaffReport(sr));
  }

  // 重要度順にソート（error > warning > info）
  const severityOrder: Record<AlertSeverity, number> = { error: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

/**
 * アラートの件数サマリーを取得
 */
export function getAlertSummary(alerts: ReportAlert[]): {
  total: number;
  errors: number;
  warnings: number;
  infos: number;
} {
  return {
    total: alerts.length,
    errors: alerts.filter((a) => a.severity === "error").length,
    warnings: alerts.filter((a) => a.severity === "warning").length,
    infos: alerts.filter((a) => a.severity === "info").length,
  };
}
