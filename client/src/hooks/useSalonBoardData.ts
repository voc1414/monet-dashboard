/**
 * サロンボードアナリティクス（スプレッドシート）から店舗月別データを取得するフック
 *
 * データソース: https://docs.google.com/spreadsheets/d/1pYQcY42rUS3ftfIkZxffCsy7zfW2hW7U_zxtXf5A5bI
 * 各店舗の「_月別」シートから総売上・客単価・総客数・新規数を取得する。
 *
 * 注意: このデータは店舗レベルの数値のみに使用する。
 * スタッフ個別ページやアンケートの抽出方法は変更しない。
 */
import { useState, useEffect, useMemo } from "react";

const SPREADSHEET_ID = "1pYQcY42rUS3ftfIkZxffCsy7zfW2hW7U_zxtXf5A5bI";

// シート名 → ダッシュボード店舗名マッピング（フォールバック用）
const SHEET_STORE_MAP_FALLBACK: { sheetName: string; storeName: string }[] = [
  { sheetName: "monet堀江_月別", storeName: "堀江院" },
  { sheetName: "monet広島_月別", storeName: "楽々園院" },
  { sheetName: "monet福岡姪浜院_月別", storeName: "姪浜院" },
  { sheetName: "monet堀江ﾆ号店_月別", storeName: "堀江院2nd" },
  { sheetName: "monet高槻_月別", storeName: "高槻院" },
  { sheetName: "monet福島院_月別", storeName: "福島院" },
];

// Module-level sheet map that can be updated from DB
let _salonBoardSheetMap: Record<string, string> | undefined;

export function setSalonBoardSheetMap(map: Record<string, string> | undefined) {
  _salonBoardSheetMap = map;
  // Invalidate cache when map changes so next fetch uses new mapping
  cachedData = null;
  fetchPromise = null;
}

function getSheetStoreMap(): { sheetName: string; storeName: string }[] {
  if (_salonBoardSheetMap && Object.keys(_salonBoardSheetMap).length > 0) {
    return Object.entries(_salonBoardSheetMap).map(([storeName, sheetName]) => ({ sheetName, storeName }));
  }
  return SHEET_STORE_MAP_FALLBACK;
}

// CSVの列インデックス
const COL = {
  YEAR_MONTH: 0,    // 日付/年月 (例: "2025/03")
  NET_SALES: 1,     // 純売上
  TECH_SALES: 2,    // 技術内訳
  RETAIL_SALES: 3,  // 店販内訳
  OPTION_SALES: 4,  // オプション内訳
  TOTAL_SALES: 5,   // 総売上
  DISCOUNT: 6,      // 割引
  UNIT_PRICE: 7,    // 客単価
  TOTAL_CUSTOMERS: 8, // 総客数
  NEW_CUSTOMERS: 9,   // 新規
  RETURN_CUSTOMERS: 10, // 再来
} as const;

export interface SalonBoardMonthlyData {
  storeName: string;
  yearMonth: string;   // "2026-03" 形式（ダッシュ区切り）
  totalSales: number;
  techSales: number;
  retailSales: number;
  unitPrice: number;
  totalCustomers: number;
  newCustomers: number;
  returnCustomers: number;
}

// CSVパーサー（ダブルクォート対応）
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
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
        result.push(current);
        current = "";
      } else if (ch === "\r") {
        // skip
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function parseNum(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/[￥,\s"]/g, "").trim();
  if (!cleaned) return 0;
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * スプレッドシートの年月形式 "2025/03" をダッシュボードの形式 "2025-03" に変換
 */
function normalizeYearMonth(raw: string): string {
  const trimmed = raw.trim().replace(/"/g, "");
  if (!trimmed || trimmed === "") return "";
  // "2025/03" → "2025-03"
  return trimmed.replace("/", "-");
}

// キャッシュ
let cachedData: SalonBoardMonthlyData[] | null = null;
let fetchPromise: Promise<SalonBoardMonthlyData[]> | null = null;

async function fetchAllStoreData(): Promise<SalonBoardMonthlyData[]> {
  if (cachedData) return cachedData;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    const allData: SalonBoardMonthlyData[] = [];

    // 各店舗の月別シートからデータを取得
    const fetchPromises = getSheetStoreMap().map(async ({ sheetName, storeName }) => {
      try {
        const encodedSheet = encodeURIComponent(sheetName);
        const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodedSheet}`;
        const resp = await fetch(url);
        if (!resp.ok) return [];

        const text = await resp.text();
        const lines = text.split("\n").filter(l => l.trim());

        // ヘッダー行をスキップ
        const dataLines = lines.slice(1);
        const storeData: SalonBoardMonthlyData[] = [];

        for (const line of dataLines) {
          const cols = parseCSVLine(line);
          if (cols.length < 11) continue;

          const rawYearMonth = cols[COL.YEAR_MONTH]?.trim().replace(/"/g, "");
          // 合計行（年月が空）をスキップ
          if (!rawYearMonth || rawYearMonth === "") continue;

          const yearMonth = normalizeYearMonth(rawYearMonth);
          if (!yearMonth) continue;

          const totalSales = parseNum(cols[COL.TOTAL_SALES]);
          const totalCustomers = parseNum(cols[COL.TOTAL_CUSTOMERS]);

          // データが全て0の行はスキップ（まだデータが入っていない月）
          if (totalSales === 0 && totalCustomers === 0) continue;

          storeData.push({
            storeName,
            yearMonth,
            totalSales,
            techSales: parseNum(cols[COL.TECH_SALES]),
            retailSales: parseNum(cols[COL.RETAIL_SALES]),
            unitPrice: parseNum(cols[COL.UNIT_PRICE]),
            totalCustomers,
            newCustomers: parseNum(cols[COL.NEW_CUSTOMERS]),
            returnCustomers: parseNum(cols[COL.RETURN_CUSTOMERS]),
          });
        }

        return storeData;
      } catch (err) {
        console.warn(`サロンボードデータ取得失敗 (${sheetName}):`, err);
        return [];
      }
    });

    const results = await Promise.all(fetchPromises);
    for (const storeData of results) {
      allData.push(...storeData);
    }

    cachedData = allData;
    return allData;
  })();

  return fetchPromise;
}

/**
 * サロンボードアナリティクスの月別データを取得するフック
 */
export function useSalonBoardData() {
  const [data, setData] = useState<SalonBoardMonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const result = await fetchAllStoreData();
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "サロンボードデータの取得に失敗しました");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // 利用可能な月一覧
  const availableMonths = useMemo(() => {
    const months = new Set(data.map(d => d.yearMonth));
    return Array.from(months).sort().reverse();
  }, [data]);

  /**
   * 特定店舗・特定月のデータを取得
   */
  const getStoreMonth = useMemo(() => {
    return (storeName: string, month: string): SalonBoardMonthlyData | null => {
      return data.find(d => d.storeName === storeName && d.yearMonth === month) || null;
    };
  }, [data]);

  /**
   * 特定店舗の全月データを取得
   */
  const getStoreAllMonths = useMemo(() => {
    return (storeName: string): SalonBoardMonthlyData[] => {
      return data.filter(d => d.storeName === storeName).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    };
  }, [data]);

  /**
   * 特定月の全店舗データを取得
   */
  const getAllStoresForMonth = useMemo(() => {
    return (month: string): SalonBoardMonthlyData[] => {
      return data.filter(d => d.yearMonth === month);
    };
  }, [data]);

  /**
   * サロンボードにデータがあるかチェック
   */
  const hasData = useMemo(() => {
    return (storeName: string, month?: string): boolean => {
      if (month) {
        return data.some(d => d.storeName === storeName && d.yearMonth === month);
      }
      return data.some(d => d.storeName === storeName);
    };
  }, [data]);

  /**
   * 特定店舗の複数月データを合算して返す
   * months が指定されない場合は全月合算
   */
  const getStoreMonthsAggregated = useMemo(() => {
    return (storeName: string, months?: string[]): SalonBoardMonthlyData | null => {
      let filtered = data.filter(d => d.storeName === storeName);
      if (months && months.length > 0) {
        filtered = filtered.filter(d => months.includes(d.yearMonth));
      }
      if (filtered.length === 0) return null;

      const totalSales = filtered.reduce((s, d) => s + d.totalSales, 0);
      const techSales = filtered.reduce((s, d) => s + d.techSales, 0);
      const retailSales = filtered.reduce((s, d) => s + d.retailSales, 0);
      const totalCustomers = filtered.reduce((s, d) => s + d.totalCustomers, 0);
      const newCustomers = filtered.reduce((s, d) => s + d.newCustomers, 0);
      const returnCustomers = filtered.reduce((s, d) => s + d.returnCustomers, 0);
      const unitPrice = totalCustomers > 0 ? Math.round(totalSales / totalCustomers) : 0;

      return {
        storeName,
        yearMonth: months && months.length === 1 ? months[0] : "",
        totalSales,
        techSales,
        retailSales,
        unitPrice,
        totalCustomers,
        newCustomers,
        returnCustomers,
      };
    };
  }, [data]);

  return {
    data,
    loading,
    error,
    availableMonths,
    getStoreMonth,
    getStoreAllMonths,
    getAllStoresForMonth,
    getStoreMonthsAggregated,
    hasData,
  };
}
