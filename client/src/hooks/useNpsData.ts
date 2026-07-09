import { useState, useEffect, useCallback } from "react";

const SPREADSHEET_ID = "1xSm2poTIeRPFviVmINdWNWmLT5d9pXXL2XzWEQsxiRU";
const SHEET_NAME = "全店舗";

export interface NpsRecord {
  no: string;
  date: string;
  storeName: string;
  storeShort: string;
  menu: string;
  staff: string;
  npsScore: number;
  priceComment: string;
  spaceComment: string;
  staffComment: string;
  finishComment: string;
  review: string;
}

export interface StoreStats {
  name: string;
  shortName: string;
  totalResponses: number;
  avgScore: number;
  npsScore: number;
  promoters: number;
  passives: number;
  detractors: number;
  promoterPct: number;
  passivePct: number;
  detractorPct: number;
}

/**
 * Parse store name from NPS spreadsheet full name.
 * Uses npsAliasMap from DB if available, otherwise falls back to keyword matching.
 */
function parseStoreName(fullName: string, npsAliasMap?: Record<string, string>): string {
  // If we have a DB-based alias map, try to match.
  // 長いエイリアスから照合（「堀江院 2nd」が「堀江院」に先取りされ2nd分が堀江院へ誤計上されるのを防ぐ）。
  // シート側は「堀江院 2nd」とスペース入りのため、空白を除去して比較する。
  if (npsAliasMap && Object.keys(npsAliasMap).length > 0) {
    const compact = fullName.replace(/[\s　]/g, "");
    const entries = Object.entries(npsAliasMap).sort((a, b) => b[0].length - a[0].length);
    for (const [alias, storeName] of entries) {
      if (compact.includes(alias.replace(/[\s　]/g, ""))) {
        return storeName;
      }
    }
  }

  // Fallback: hardcoded patterns (for when DB is unavailable)
  if (fullName.includes("堀江院 2nd") || fullName.includes("堀江院2nd")) return "堀江院2nd";
  if (fullName.includes("堀江院")) return "堀江院";
  if (fullName.includes("福島院")) return "福島院";
  if (fullName.includes("高槻院")) return "高槻院";
  if (fullName.includes("姪浜院")) return "姪浜院";
  if (fullName.includes("楽々園院")) return "楽々園院";
  if (fullName.includes("土橋院")) return "土橋院";

  // Generic: extract 「〇〇院」pattern
  const m = fullName.match(/([一-龥ぁ-ゖァ-ヶA-Za-z0-9]+院(?:2nd)?)/);
  if (m) return m[1];
  return fullName;
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
      } else if (ch === "\n") {
        row.push(current);
        current = "";
        if (row.length > 1) rows.push(row);
        row = [];
      } else if (ch !== "\r") {
        current += ch;
      }
    }
  }
  if (current || row.length > 0) {
    row.push(current);
    if (row.length > 1) rows.push(row);
  }
  return rows;
}

async function fetchSheetData(npsAliasMap?: Record<string, string>): Promise<NpsRecord[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch spreadsheet data");
  const text = await res.text();
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  // Skip header row
  return rows.slice(1).map((cols) => ({
    no: cols[0] || "",
    date: cols[1] || "",
    storeName: cols[2] || "",
    storeShort: parseStoreName(cols[2] || "", npsAliasMap),
    menu: cols[3] || "",
    staff: cols[4] || "",
    npsScore: parseInt(cols[5] || "0", 10),
    priceComment: cols[6] || "",
    spaceComment: cols[7] || "",
    staffComment: cols[8] || "",
    finishComment: cols[9] || "",
    review: cols[10] || "",
  }));
}

export function calculateStoreStats(records: NpsRecord[], storeList?: string[]): StoreStats[] {
  const storeMap = new Map<string, NpsRecord[]>();
  records.forEach((r) => {
    const existing = storeMap.get(r.storeShort) || [];
    existing.push(r);
    storeMap.set(r.storeShort, existing);
  });
  // Use provided store list or fall back to all stores found in data
  const storeOrder = storeList || Array.from(storeMap.keys());
  return storeOrder
    .filter((name) => storeMap.has(name))
    .map((shortName) => {
      const recs = storeMap.get(shortName)!;
      const total = recs.length;
      const avg = recs.reduce((s, r) => s + r.npsScore, 0) / total;
      const promoters = recs.filter((r) => r.npsScore >= 9).length;
      const passives = recs.filter((r) => r.npsScore >= 7 && r.npsScore <= 8).length;
      const detractors = recs.filter((r) => r.npsScore <= 6).length;
      const nps = Math.round(((promoters - detractors) / total) * 100);
      return {
        name: recs[0].storeName,
        shortName,
        totalResponses: total,
        avgScore: Math.round(avg * 10) / 10,
        npsScore: nps,
        promoters,
        passives,
        detractors,
        promoterPct: Math.round((promoters / total) * 100),
        passivePct: Math.round((passives / total) * 100),
        detractorPct: Math.round((detractors / total) * 100),
      };
    });
}

export function filterByMonth(records: NpsRecord[], yearMonth: string): NpsRecord[] {
  if (!yearMonth) return records;
  const slashMonth = yearMonth.replace(/-/g, "/");
  return records.filter((r) => r.date.startsWith(yearMonth) || r.date.startsWith(slashMonth));
}

export function getAvailableMonths(records: NpsRecord[]): string[] {
  const months = new Set<string>();
  records.forEach((r) => {
    if (r.date) {
      const ym = r.date.substring(0, 7).replace(/\//g, "-");
      months.add(ym);
    }
  });
  return Array.from(months).sort().reverse();
}

/**
 * useNpsData hook — fetches NPS data from spreadsheet.
 * Accepts optional npsAliasMap from useStores() to dynamically resolve store names.
 */
export function useNpsData(npsAliasMap?: Record<string, string>) {
  const [records, setRecords] = useState<NpsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSheetData(npsAliasMap);
      setRecords(data);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message || "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [npsAliasMap]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { records, loading, error, lastUpdated, refresh };
}
