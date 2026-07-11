/**
 * サロンボード（ホットペッパー）のスタイリスト別実績を取得するフック
 *
 * データソース: GoogleSheet連携 Apps Script が出力する「stylist_flat」タブ。
 *   1行 = 店舗 × スタイリスト × 年月
 *   列: 店舗,スタイリスト,年月,売上,客数,客単価,指名数,新規,再来
 *   （元は salonboard-scraper/output/stylist_summary.csv → Drive → Apps Script）
 *
 * 用途: スタッフ一覧／詳細の「実績系」（売上・客数・新規・再来・指名）をサロンボード値に統一する。
 *   サロンボードに無いスタッフは呼び出し側で月末報告書へフォールバックする。
 *
 * 名寄せ: サロンボードの担当名を正（canonical）とし、stylist_aliases（DB）＋ハードコードの
 *   エイリアスで他ソースの表記ゆれをサロンボード名へ寄せる（useFankuruData の normalizeStylistName を再利用）。
 *
 * 注意: SPREADSHEET_ID は GoogleSheet連携 の「サロンボード売上」スプレッドシートのID。
 *   未設定（空文字）の場合は何も取得せず空配列を返し、呼び出し側は月末報告書フォールバックになる。
 */
import { useState, useEffect, useMemo } from "react";
import { normalizeStylistName } from "@/hooks/useFankuruData";

// 正本「サロンボード売上」スプレッドシートID（林さん作成・毎朝7:30自動更新の stylist_flat タブ）。
// DB/設定から差し込みたい場合は setSalonBoardStylistSpreadsheetId() で上書き可能。
let _spreadsheetId = "1nR36MMsbtAT8f2ccYLBTZjZ4ESin9odmgWN2xP3oVSE";

export function setSalonBoardStylistSpreadsheetId(id: string | undefined | null) {
  _spreadsheetId = (id || "").trim();
  // マッピング変更時はキャッシュを無効化
  cachedData = null;
  fetchPromise = null;
}

const SHEET_NAME = "stylist_flat";

// stylist_flat の列インデックス
const COL = {
  STORE: 0,
  STYLIST: 1,
  YEAR_MONTH: 2,
  SALES: 3,
  CUSTOMERS: 4,
  UNIT_PRICE: 5,
  NOMINATE: 6,
  NEW: 7,
  RETURN: 8,
  TECH: 9,    // 技術売上
  RETAIL: 10, // 店販売上
} as const;

/**
 * サロンボードの店舗名（例: "monet 白髪染めと髪質改善のサロン 堀江院【モネ】"）を
 * ダッシュボードの正規化店舗名（useMonthlyReport の storeNormalized と同じトークン）へ変換。
 * 「堀江院 2nd」を「堀江院」より先に判定する。
 */
const STORE_KEYWORDS: { keyword: string; storeName: string }[] = [
  { keyword: "堀江院 2nd", storeName: "堀江院2nd" },
  { keyword: "堀江院2nd", storeName: "堀江院2nd" },
  { keyword: "堀江院", storeName: "堀江院" },
  { keyword: "福島院", storeName: "福島院" },
  { keyword: "高槻院", storeName: "高槻院" },
  { keyword: "福岡姪浜院", storeName: "姪浜院" },
  { keyword: "姪浜院", storeName: "姪浜院" },
  { keyword: "土橋院", storeName: "土橋院" },
  { keyword: "広島楽々園院", storeName: "楽々園院" },
  { keyword: "楽々園院", storeName: "楽々園院" },
];

export function normalizeSalonBoardStore(raw: string): string {
  const s = (raw || "").trim();
  for (const { keyword, storeName } of STORE_KEYWORDS) {
    if (s.indexOf(keyword) >= 0) return storeName;
  }
  return s;
}

/**
 * スタイリスト名のルックアップキー。
 * エイリアス正規化（サロンボード名へ寄せる）＋ スペース除去 ＋ 小文字化で、
 * 月末報告書（スペース無し）とサロンボード（スペース有り）の差を吸収する。
 */
export function stylistKey(name: string): string {
  return normalizeStylistName(name || "")
    .replace(/[\s　]/g, "")
    .toLowerCase();
}

export interface SalonBoardStylistData {
  storeName: string;   // 正規化済み店舗名
  stylist: string;     // サロンボード上の担当名（原文）
  yearMonth: string;   // "2026-06"
  sales: number;       // 総売上（技術＋店販。その他=割引/オプションは除外）
  customers: number;
  unitPrice: number;
  nominate: number;
  newCustomers: number;
  returnCustomers: number;
  techSales: number;   // 技術売上
  retailSales: number; // 店販売上
}

// CSVパーサー（ダブルクォート対応・useSalonBoardData と同等）
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

function normalizeYearMonth(raw: string): string {
  const trimmed = (raw || "").trim().replace(/"/g, "").replace(/\//g, "-");
  if (!trimmed) return "";
  // 集計スクリプトの月ゼロ埋めゆれ「2026-6」→「2026-06」を吸収。
  // stylist_flat に両形式が混在し、非ゼロ埋め行（全店46行）が集計から
  // 欠落して新規数等がサロンボード公式と合わなくなっていた（2026-07-11発見）
  const m = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  return trimmed;
}

/**
 * stylist_flat の CSV テキストを SalonBoardStylistData[] にパースする（純関数・テスト対象）。
 */
export function parseStylistFlatCsv(text: string): SalonBoardStylistData[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const out: SalonBoardStylistData[] = [];
  // 1行目はヘッダー
  for (const line of lines.slice(1)) {
    const cols = parseCSVLine(line);
    if (cols.length < 9) continue;
    const yearMonth = normalizeYearMonth(cols[COL.YEAR_MONTH]);
    const stylist = (cols[COL.STYLIST] || "").trim();
    const storeRaw = (cols[COL.STORE] || "").trim();
    if (!yearMonth || !stylist || !storeRaw) continue;
    out.push({
      storeName: normalizeSalonBoardStore(storeRaw),
      stylist,
      yearMonth,
      sales: parseNum(cols[COL.SALES]),
      customers: parseNum(cols[COL.CUSTOMERS]),
      unitPrice: parseNum(cols[COL.UNIT_PRICE]),
      nominate: parseNum(cols[COL.NOMINATE]),
      newCustomers: parseNum(cols[COL.NEW]),
      returnCustomers: parseNum(cols[COL.RETURN]),
      techSales: cols.length > COL.TECH ? parseNum(cols[COL.TECH]) : 0,
      retailSales: cols.length > COL.RETAIL ? parseNum(cols[COL.RETAIL]) : 0,
    });
  }
  return out;
}

// キャッシュ
let cachedData: SalonBoardStylistData[] | null = null;
let fetchPromise: Promise<SalonBoardStylistData[]> | null = null;

async function fetchStylistData(): Promise<SalonBoardStylistData[]> {
  if (cachedData) return cachedData;
  if (fetchPromise) return fetchPromise;
  if (!_spreadsheetId) {
    cachedData = [];
    return cachedData;
  }

  fetchPromise = (async () => {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${_spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        cachedData = [];
        return cachedData;
      }
      const text = await resp.text();
      const data = parseStylistFlatCsv(text);
      cachedData = data;
      return data;
    } catch (err) {
      console.warn("サロンボード スタイリストデータ取得失敗:", err);
      cachedData = [];
      return cachedData;
    }
  })();

  return fetchPromise;
}

/**
 * 内部ルックアップ: `${storeNormalized}__${stylistKey}__${yearMonth}` → data
 */
function buildIndex(data: SalonBoardStylistData[]): Map<string, SalonBoardStylistData> {
  const idx = new Map<string, SalonBoardStylistData>();
  for (const d of data) {
    const key = `${d.storeName}__${stylistKey(d.stylist)}__${d.yearMonth}`;
    const existing = idx.get(key);
    if (!existing) {
      idx.set(key, d);
    } else {
      // 同一キー（エイリアス衝突）の場合は合算
      idx.set(key, {
        ...existing,
        sales: existing.sales + d.sales,
        customers: existing.customers + d.customers,
        nominate: existing.nominate + d.nominate,
        newCustomers: existing.newCustomers + d.newCustomers,
        returnCustomers: existing.returnCustomers + d.returnCustomers,
        techSales: existing.techSales + d.techSales,
        retailSales: existing.retailSales + d.retailSales,
        unitPrice:
          existing.customers + d.customers > 0
            ? Math.round((existing.sales + d.sales) / (existing.customers + d.customers))
            : 0,
      });
    }
  }
  return idx;
}

export function useSalonBoardStylistData() {
  const [data, setData] = useState<SalonBoardStylistData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const result = await fetchStylistData();
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "サロンボードのスタイリストデータ取得に失敗しました");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const index = useMemo(() => buildIndex(data), [data]);

  /** 特定店舗×スタイリスト×月のデータ。無ければ null。 */
  const getStylistMonth = useMemo(() => {
    return (storeNormalized: string, stylistName: string, month: string): SalonBoardStylistData | null => {
      return index.get(`${storeNormalized}__${stylistKey(stylistName)}__${month}`) || null;
    };
  }, [index]);

  /** 特定店舗×スタイリストの複数月を合算。months 未指定は全月合算。無ければ null。 */
  const getStylistMonthsAggregated = useMemo(() => {
    return (storeNormalized: string, stylistName: string, months?: string[]): SalonBoardStylistData | null => {
      const k = stylistKey(stylistName);
      let filtered = data.filter((d) => d.storeName === storeNormalized && stylistKey(d.stylist) === k);
      if (months && months.length > 0) {
        filtered = filtered.filter((d) => months.includes(d.yearMonth));
      }
      if (filtered.length === 0) return null;
      const sales = filtered.reduce((s, d) => s + d.sales, 0);
      const customers = filtered.reduce((s, d) => s + d.customers, 0);
      const nominate = filtered.reduce((s, d) => s + d.nominate, 0);
      const newCustomers = filtered.reduce((s, d) => s + d.newCustomers, 0);
      const returnCustomers = filtered.reduce((s, d) => s + d.returnCustomers, 0);
      const techSales = filtered.reduce((s, d) => s + d.techSales, 0);
      const retailSales = filtered.reduce((s, d) => s + d.retailSales, 0);
      return {
        storeName: storeNormalized,
        stylist: filtered[0].stylist,
        yearMonth: months && months.length === 1 ? months[0] : "",
        sales,
        customers,
        unitPrice: customers > 0 ? Math.round(sales / customers) : 0,
        nominate,
        newCustomers,
        returnCustomers,
        techSales,
        retailSales,
      };
    };
  }, [data]);

  /** サロンボードに該当データがあるか。 */
  const hasStylist = useMemo(() => {
    return (storeNormalized: string, stylistName: string, month?: string): boolean => {
      const k = stylistKey(stylistName);
      return data.some(
        (d) =>
          d.storeName === storeNormalized &&
          stylistKey(d.stylist) === k &&
          (month ? d.yearMonth === month : true)
      );
    };
  }, [data]);

  const availableMonths = useMemo(() => {
    return Array.from(new Set(data.map((d) => d.yearMonth))).sort().reverse();
  }, [data]);

  return {
    data,
    loading,
    error,
    availableMonths,
    getStylistMonth,
    getStylistMonthsAggregated,
    hasStylist,
  };
}
