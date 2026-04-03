import { useState, useEffect, useMemo } from "react";
import { registerNewStoresFromReports } from "@/lib/newBadge";

// 新モネ月末報告書 スプレッドシート
const SPREADSHEET_ID = "1DXAaFk0aLDZwXq28krOcrDSiTOwd6BeTzV-xFXbLuKI";
const GID = "505478524";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID}`;

// カラムインデックス
const COL = {
  LINE_USER_ID: 0,
  ANSWER_ID: 1,
  ANSWER_DATE: 2,
  ANSWERER_ID: 3,
  LINE_NAME: 4,
  SYSTEM_NAME: 5,
  NAME: 6,
  STORE: 7,
  EMPLOYMENT_TYPE: 8,
  BEHAVIOR_CHECK: 9,
  RULE_CHECK: 10,
  TECH_SALES: 11,
  RETAIL_SALES: 12,
  NEW_CUSTOMERS: 13,
  RETURN_CUSTOMERS: 14,
  NEXT_RESERVATION: 15,
  REVIEW_COMMENT: 16,
  NPS_COMMENT: 17,
  FANKURU_COMMENT: 18,
  PHOTO_URL_1: 19,
  PHOTO_URL_2: 20,
} as const;

// テストデータ除外: 2026-04-01以前の回答を除外
const DATA_START_DATE = "2026-04-01";

function isAfterStartDate(answerDateStr: string): boolean {
  if (!answerDateStr) return false;
  // "2026-03-31 11:41:04 pm" → "2026-03-31" を抽出
  const dateMatch = answerDateStr.trim().match(/(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) return false;
  return dateMatch[1] >= DATA_START_DATE;
}

// 店舗名の正規化マッピング
const STORE_NAME_MAP: Record<string, string> = {
  "大阪堀江院": "堀江院",
  "堀江院": "堀江院",
  "大阪堀江院2nd": "堀江院2nd",
  "堀江院2nd": "堀江院2nd",
  "大阪福島院": "福島院",
  "福島院": "福島院",
  "高槻院": "高槻院",
  "大阪高槻院": "高槻院",
  "福岡姪浜院": "姪浜院",
  "姪浜院": "姪浜院",
  "広島楽々園院": "楽々園院",
  "楽々園院": "楽々園院",
};

function normalizeStoreName(raw: string): string {
  const trimmed = raw.trim();
  return STORE_NAME_MAP[trimmed] || trimmed;
}

// 回答日時から報告月を算出（-1ヶ月）
function getReportMonth(answerDateStr: string): string {
  try {
    // "2026-03-31 11:41:04 pm" → Date
    const cleaned = answerDateStr.trim().replace(/\s+(am|pm)/i, (_, p) => ` ${p.toUpperCase()}`);
    const date = new Date(cleaned);
    if (isNaN(date.getTime())) {
      // フォールバック: 手動パース
      const parts = answerDateStr.trim().match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(am|pm)?/i);
      if (!parts) return "";
      let [, year, month, day, hour, min, sec, ampm] = parts;
      let h = parseInt(hour);
      if (ampm?.toLowerCase() === "pm" && h < 12) h += 12;
      if (ampm?.toLowerCase() === "am" && h === 12) h = 0;
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), h, parseInt(min), parseInt(sec));
      // -1ヶ月
      d.setMonth(d.getMonth() - 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    date.setMonth(date.getMonth() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

/**
 * 数値パース（ピリオド区切り自動判定付き）
 *
 * 美容室の売上データでは、ピリオド「.」が桁区切りとして使われるケースがある。
 * 例: "406.100" → 小数点ではなく桁区切りと判定 → 406100
 *
 * 判定ルール:
 * 1. ピリオドの後にちょうど3桁の数字が続く場合 → 桁区切りと判定（例: 406.100, 1.234.567）
 * 2. ピリオドが複数ある場合 → 桁区切りと判定（例: 1.234.567）
 * 3. 結果が1000未満になる場合、ピリオドを除去した値が妥当な美容室売上範囲（5000円以上）なら桁区切りと判定
 */
function parseNumber(val: string): number {
  if (!val) return 0;
  // カンマ、￥記号、スペースを除去
  const cleaned = val.replace(/[￥,\s]/g, "").trim();
  if (!cleaned) return 0;

  // ピリオドが含まれる場合の判定
  if (cleaned.includes(".")) {
    const dotCount = (cleaned.match(/\./g) || []).length;

    // ピリオドが複数 → 確実に桁区切り（例: "1.234.567"）
    if (dotCount > 1) {
      const num = parseFloat(cleaned.replace(/\./g, ""));
      return isNaN(num) ? 0 : num;
    }

    // ピリオド1つの場合
    const parts = cleaned.split(".");
    const afterDot = parts[1];

    // ピリオド後がちょうど3桁 → 桁区切りと判定（例: "406.100" → 406100）
    if (afterDot && afterDot.length === 3) {
      const asThousandSep = parseFloat(cleaned.replace(".", ""));
      const asDecimal = parseFloat(cleaned);

      // 小数点として解釈すると1000未満になり、桁区切りとして解釈すると5000以上になる場合
      // → 桁区切りと判定（美容室の売上は通常数千円以上）
      if (asDecimal < 1000 && asThousandSep >= 5000) {
        return isNaN(asThousandSep) ? 0 : asThousandSep;
      }

      // 桁区切りとして解釈しても小さい場合はそのまま桁区切りと判定
      // （例: "5.000" → 5000, "10.500" → 10500）
      if (asThousandSep >= 1000) {
        return isNaN(asThousandSep) ? 0 : asThousandSep;
      }
    }
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export interface StaffReport {
  answerId: string;
  answerDate: string;
  reportMonth: string; // "2026-02" 形式
  reportMonthLabel: string; // "2月" 形式
  lineUserId: string;
  name: string;
  store: string;
  storeNormalized: string;
  employmentType: string;
  behaviorCheck: string;
  ruleCheck: string;
  techSales: number;
  retailSales: number;
  totalSales: number;
  newCustomers: number;
  returnCustomers: number;
  totalCustomers: number;
  unitPrice: number;
  nextReservation: number;
  nextReservationRate: number;
  reviewComment: string;
  npsComment: string;
  fankuruComment: string;
  photoUrl1: string;
  photoUrl2: string;
}

export interface StoreMonthlyStats {
  store: string;
  month: string;
  monthLabel: string;
  totalSales: number;
  totalTechSales: number;
  totalRetailSales: number;
  totalCustomers: number;
  totalNewCustomers: number;
  totalReturnCustomers: number;
  avgUnitPrice: number;
  totalNextReservation: number;
  nextReservationRate: number;
  staffCount: number;
  staffReports: StaffReport[];
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(current);
        current = "";
      } else if (ch === "\r") {
        // skip
      } else if (ch === "\n") {
        row.push(current);
        current = "";
        rows.push(row);
        row = [];
      } else {
        current += ch;
      }
    }
  }
  if (current || row.length > 0) {
    row.push(current);
    rows.push(row);
  }
  return rows;
}

/**
 * 同じ店舗×同じスタッフ名×同じ報告月の重複を排除し、回答日時が新しい方を残す
 * → 異なる店舗に同名スタッフがいる場合も正しく両方表示される
 */
function deduplicateReports(reports: StaffReport[]): StaffReport[] {
  const map = new Map<string, StaffReport>();
  for (const r of reports) {
    const key = `${r.storeNormalized}__${r.name}__${r.reportMonth}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, r);
    } else {
      // answerDateが新しい方を残す
      if (r.answerDate > existing.answerDate) {
        map.set(key, r);
      }
    }
  }
  return Array.from(map.values());
}

export function useMonthlyReport() {
  const [rawData, setRawData] = useState<StaffReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        const resp = await fetch(CSV_URL);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        const rows = parseCSV(text);

        if (rows.length < 2) {
          setRawData([]);
          return;
        }

        // ヘッダー行をスキップ
        const dataRows = rows.slice(1).filter((r) => r.length >= 16 && r[COL.STORE]?.trim());

        const reports: StaffReport[] = dataRows
          .filter((r) => isAfterStartDate(r[COL.ANSWER_DATE] || ""))
          .map((r) => {
          const techSales = parseNumber(r[COL.TECH_SALES] || "");
          const retailSales = parseNumber(r[COL.RETAIL_SALES] || "");
          const totalSales = techSales + retailSales;
          const newCustomers = parseNumber(r[COL.NEW_CUSTOMERS] || "");
          const returnCustomers = parseNumber(r[COL.RETURN_CUSTOMERS] || "");
          const totalCustomers = newCustomers + returnCustomers;
          const unitPrice = totalCustomers > 0 ? Math.round(totalSales / totalCustomers) : 0;
          const nextReservation = parseNumber(r[COL.NEXT_RESERVATION] || "");
          const nextReservationRate = totalCustomers > 0 ? Math.round((nextReservation / totalCustomers) * 1000) / 10 : 0;
          const reportMonth = getReportMonth(r[COL.ANSWER_DATE] || "");
          const monthNum = reportMonth ? parseInt(reportMonth.split("-")[1]) : 0;

          return {
            answerId: r[COL.ANSWER_ID] || "",
            answerDate: r[COL.ANSWER_DATE] || "",
            reportMonth,
            reportMonthLabel: monthNum > 0 ? `${monthNum}月` : "",
            lineUserId: r[COL.LINE_USER_ID] || "",
            name: r[COL.NAME] || "",
            store: r[COL.STORE]?.trim() || "",
            storeNormalized: normalizeStoreName(r[COL.STORE] || ""),
            employmentType: r[COL.EMPLOYMENT_TYPE] || "",
            behaviorCheck: r[COL.BEHAVIOR_CHECK] || "",
            ruleCheck: r[COL.RULE_CHECK] || "",
            techSales,
            retailSales,
            totalSales,
            newCustomers,
            returnCustomers,
            totalCustomers,
            unitPrice,
            nextReservation,
            nextReservationRate,
            reviewComment: r[COL.REVIEW_COMMENT] || "",
            npsComment: r[COL.NPS_COMMENT] || "",
            fankuruComment: r[COL.FANKURU_COMMENT] || "",
            photoUrl1: r[COL.PHOTO_URL_1] || "",
            photoUrl2: r[COL.PHOTO_URL_2] || "",
          };
        });

        // 同じスタッフ×同月の重複排除: 回答日時が新しい方を残す
        const deduped = deduplicateReports(reports);

        // 新店舗自動検出: 未知の店舗名があれば自動的にNEW登録（初回検出月から6ヶ月間）
        const storeNames = Array.from(new Set(deduped.map(r => r.storeNormalized).filter(Boolean)));
        registerNewStoresFromReports(storeNames);

        if (!cancelled) {
          setRawData(deduped);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "データ取得に失敗しました");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  // 利用可能な月一覧
  const availableMonths = useMemo(() => {
    const months = new Set(rawData.map((r) => r.reportMonth).filter(Boolean));
    return Array.from(months).sort().reverse();
  }, [rawData]);

  // 店舗×月の集計
  const getStoreMonthlyStats = useMemo(() => {
    return (storeName: string, month?: string): StoreMonthlyStats | null => {
      const normalizedTarget = normalizeStoreName(storeName);
      let filtered = rawData.filter((r) => r.storeNormalized === normalizedTarget);
      if (month) {
        filtered = filtered.filter((r) => r.reportMonth === month);
      }
      if (filtered.length === 0) return null;

      const totalTechSales = filtered.reduce((s, r) => s + r.techSales, 0);
      const totalRetailSales = filtered.reduce((s, r) => s + r.retailSales, 0);
      const totalSales = totalTechSales + totalRetailSales;
      const totalNewCustomers = filtered.reduce((s, r) => s + r.newCustomers, 0);
      const totalReturnCustomers = filtered.reduce((s, r) => s + r.returnCustomers, 0);
      const totalCustomers = totalNewCustomers + totalReturnCustomers;
      const avgUnitPrice = totalCustomers > 0 ? Math.round(totalSales / totalCustomers) : 0;
      const totalNextReservation = filtered.reduce((s, r) => s + r.nextReservation, 0);
      const nextReservationRate = totalCustomers > 0 ? Math.round((totalNextReservation / totalCustomers) * 1000) / 10 : 0;
      const monthLabel = month ? `${parseInt(month.split("-")[1])}月` : "";

      return {
        store: normalizedTarget,
        month: month || "",
        monthLabel,
        totalSales,
        totalTechSales,
        totalRetailSales,
        totalCustomers,
        totalNewCustomers,
        totalReturnCustomers,
        avgUnitPrice,
        totalNextReservation,
        nextReservationRate,
        staffCount: filtered.length,
        staffReports: filtered,
      };
    };
  }, [rawData]);

  // 全店舗の集計（特定月）
  const getAllStoresStats = useMemo(() => {
    return (month?: string): StoreMonthlyStats[] => {
      const storeArr = Array.from(new Set(rawData.map((r) => r.storeNormalized)));
      const results: StoreMonthlyStats[] = [];
      for (const store of storeArr) {
        const stats = getStoreMonthlyStats(store, month);
        if (stats) results.push(stats);
      }
      return results.sort((a, b) => b.totalSales - a.totalSales);
    };
  }, [rawData, getStoreMonthlyStats]);

  return {
    rawData,
    loading,
    error,
    availableMonths,
    getStoreMonthlyStats,
    getAllStoresStats,
  };
}
