/*
 * ファンくる調査結果 — Google スプレッドシート CSV 自動取得方式
 * GASが1時間おきにファンくるメールをチェックし、PDFをDriveに保存、
 * スプレッドシートにリンクを記録。ダッシュボードはCSVから自動取得する。
 *
 * スプレッドシートCSVカラム: 店舗名,年月,日付,ファイル名,表示名,driveFileId,previewUrl,viewUrl
 */
import { useState, useEffect, useMemo, useCallback } from "react";

export interface FankuruPdf {
  id: string;
  name: string;
  displayName: string;
  folder: string;       // e.g. "2025/10"
  yearMonth: string;    // e.g. "2025-10"
  date: string;         // e.g. "2025/10/16"
  stylist: string;      // 担当スタイリスト名
  driveFileId: string;  // Google Drive file ID
  previewUrl: string;   // Google Drive preview URL (for iframe embed)
  viewUrl: string;      // Google Drive view URL (for opening in new tab)
  cdnUrl: string;       // CDN URL (for download)
}

// スプレッドシートCSV URL
const SPREADSHEET_ID = "1bbQT7eBb2Om1ODgsL_g0dx_bcw55j3RHRRJGr7xSwsg";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv`;

// 店舗名の正規化マッピング（スプレッドシートの店舗名 → ダッシュボードの店舗名）
const STORE_NAME_NORMALIZE: Record<string, string> = {
  "大阪堀江院": "堀江院",
  "大阪堀江院2nd": "堀江院2nd",
  "福岡姪浜院": "姪浜院",
  "福岡経浜院": "姪浜院",  // 誤字対応
  "広島楽々園院": "楽々園院",
  "大阪福島院": "福島院",
  "大阪高槻院": "高槻院",
  // そのまま使えるケース
  "姪浜院": "姪浜院",
  "堀江院": "堀江院",
  "堀江院2nd": "堀江院2nd",
  "楽々園院": "楽々園院",
  "福島院": "福島院",
  "高槻院": "高槻院",
};

function normalizeStoreName(raw: string): string {
  return STORE_NAME_NORMALIZE[raw] || raw;
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
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// ローカルにハードコードされた既存データ（スプレッドシート登録前のデータ）
const LEGACY_DATA: Record<string, FankuruPdf[]> = {
  "姪浜院": [
    {
      id: "meinohama_20251016",
      name: "モネ-monet- 白髪染めと髪質改善のサロン 福岡姪浜院_20251016_23572111.pdf",
      displayName: "2025/10/16 調査レポート #23572111",
      stylist: "山口純奈",
      folder: "2025/10",
      yearMonth: "2025-10",
      date: "2025/10/16",
      driveFileId: "1WYUtE9L8D-9LqiG3Q9UQLnHRNWVLTC5Q",
      previewUrl: "https://drive.google.com/file/d/1WYUtE9L8D-9LqiG3Q9UQLnHRNWVLTC5Q/preview",
      viewUrl: "https://drive.google.com/file/d/1WYUtE9L8D-9LqiG3Q9UQLnHRNWVLTC5Q/view",
      cdnUrl: "",
    },
    {
      id: "meinohama_20251023",
      name: "モネ-monet- 白髪染めと髪質改善のサロン 福岡姪浜院_20251023_23580257.pdf",
      displayName: "2025/10/23 調査レポート #23580257",
      stylist: "金田",
      folder: "2025/10",
      yearMonth: "2025-10",
      date: "2025/10/23",
      driveFileId: "1N3Rx-QMwzEi92bVaZJ6XtBGtX2bCF2MS",
      previewUrl: "https://drive.google.com/file/d/1N3Rx-QMwzEi92bVaZJ6XtBGtX2bCF2MS/preview",
      viewUrl: "https://drive.google.com/file/d/1N3Rx-QMwzEi92bVaZJ6XtBGtX2bCF2MS/view",
      cdnUrl: "",
    },
    {
      id: "meinohama_20251027",
      name: "モネ-monet- 白髪染めと髪質改善のサロン 福岡姪浜院_20251027_23569805.pdf",
      displayName: "2025/10/27 調査レポート #23569805",
      stylist: "藤田",
      folder: "2025/10",
      yearMonth: "2025-10",
      date: "2025/10/27",
      driveFileId: "1E9n_ZR5JS8edU7RQ19nQJgBP5FSW2ML3",
      previewUrl: "https://drive.google.com/file/d/1E9n_ZR5JS8edU7RQ19nQJgBP5FSW2ML3/preview",
      viewUrl: "https://drive.google.com/file/d/1E9n_ZR5JS8edU7RQ19nQJgBP5FSW2ML3/view",
      cdnUrl: "",
    },
    {
      id: "meinohama_20251028",
      name: "モネ-monet- 白髪染めと髪質改善のサロン 福岡姪浜院_20251028_23577141.pdf",
      displayName: "2025/10/28 調査レポート #23577141",
      stylist: "石橋",
      folder: "2025/10",
      yearMonth: "2025-10",
      date: "2025/10/28",
      driveFileId: "17ldgy2mTBKKU5-9ORGIjauOqh5OJ_0ca",
      previewUrl: "https://drive.google.com/file/d/17ldgy2mTBKKU5-9ORGIjauOqh5OJ_0ca/preview",
      viewUrl: "https://drive.google.com/file/d/17ldgy2mTBKKU5-9ORGIjauOqh5OJ_0ca/view",
      cdnUrl: "",
    },
  ],
};

// キャッシュ（セッション中に1回だけ取得）
let cachedData: Record<string, FankuruPdf[]> | null = null;
let fetchPromise: Promise<Record<string, FankuruPdf[]>> | null = null;

async function fetchPdfData(): Promise<Record<string, FankuruPdf[]>> {
  if (cachedData) return cachedData;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const response = await fetch(CSV_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const lines = text.split("\n").filter(l => l.trim());
      
      // ヘッダー行をスキップ
      const dataLines = lines.slice(1);
      
      const result: Record<string, FankuruPdf[]> = {};
      
      // レガシーデータをまずコピー
      for (const [store, pdfs] of Object.entries(LEGACY_DATA)) {
        result[store] = [...pdfs];
      }
      
      for (const line of dataLines) {
        const cols = parseCSVLine(line);
        if (cols.length < 8) continue;
        
        const rawStoreName = cols[0].trim();
        const yearMonth = cols[1].trim();
        const date = cols[2].trim();
        const fileName = cols[3].trim();
        const displayName = cols[4].trim();
        const driveFileId = cols[5].trim();
        const previewUrl = cols[6].trim();
        const viewUrl = cols[7].trim();
        
        const storeName = normalizeStoreName(rawStoreName);
        
        // フォルダ名を日付から生成
        const dateParts = date.split("/");
        const folder = dateParts.length >= 2 ? `${dateParts[0]}/${dateParts[1]}` : yearMonth.replace("-", "/");
        
        const pdf: FankuruPdf = {
          id: `${storeName}_${driveFileId.substring(0, 8)}`,
          name: fileName,
          displayName,
          folder,
          yearMonth,
          date,
          stylist: "",
          driveFileId,
          previewUrl,
          viewUrl,
          cdnUrl: "",
        };
        
        if (!result[storeName]) {
          result[storeName] = [];
        }
        
        // 重複チェック（driveFileIdで判定）
        const exists = result[storeName].some(p => p.driveFileId === driveFileId);
        if (!exists) {
          result[storeName].push(pdf);
        }
      }
      
      // 日付で降順ソート
      for (const store of Object.keys(result)) {
        result[store].sort((a, b) => b.date.localeCompare(a.date));
      }
      
      cachedData = result;
      return result;
    } catch (err) {
      console.warn("スプレッドシートからのデータ取得に失敗しました。ローカルデータを使用します:", err);
      cachedData = { ...LEGACY_DATA };
      return cachedData;
    }
  })();

  return fetchPromise;
}

// ファンくるフォルダが設定されている店舗
const FANKURU_ENABLED_STORES = new Set(["姪浜院", "堀江院", "堀江院2nd", "楽々園院"]);

export function useFankuruData(storeName: string) {
  const hasFolderMapping = FANKURU_ENABLED_STORES.has(storeName);
  const [allData, setAllData] = useState<Record<string, FankuruPdf[]>>(LEGACY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchPdfData();
      setAllData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "データ取得エラー");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pdfs = useMemo(() => {
    return allData[storeName] || [];
  }, [allData, storeName]);

  // Available year-months
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    pdfs.forEach((p) => {
      if (p.yearMonth) months.add(p.yearMonth);
    });
    return Array.from(months).sort().reverse();
  }, [pdfs]);

  return {
    pdfs,
    loading,
    error,
    availableMonths,
    hasFolderMapping,
  };
}
