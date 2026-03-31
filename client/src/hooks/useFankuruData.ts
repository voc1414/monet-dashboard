/*
 * ファンくる調査結果 — Google Drive プレビューリンク方式
 * PDFはGoogle Driveの /preview エンドポイントでiframe埋め込み表示
 * Google Driveにファイルが追加された場合は、ここにエントリを追加する
 * 
 * 構造: 店舗名 → PDF一覧（年月・日付・Google DriveファイルID）
 */
import { useMemo } from "react";

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

// 店舗ごとのファンくるPDFデータ
// 新しいPDFがGoogle Driveに追加されたら、ここにエントリを追加してください
const FANKURU_DATA: Record<string, FankuruPdf[]> = {
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
      cdnUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663489426081/aLPZvLfFDC4rFYToBquZNR/meinohama_20251016_23572111_3148f00c.pdf",
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
      cdnUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663489426081/aLPZvLfFDC4rFYToBquZNR/meinohama_20251023_23580257_358d1338.pdf",
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
      cdnUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663489426081/aLPZvLfFDC4rFYToBquZNR/meinohama_20251027_23569805_d5c320c8.pdf",
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
      cdnUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663489426081/aLPZvLfFDC4rFYToBquZNR/meinohama_20251028_23577141_15a4fb8a.pdf",
    },
  ],
  "堀江院": [],
  "堀江院2nd": [],
  "楽々園院": [],
  // 福島院・高槻院はファンくるフォルダなし
};

// ファンくるフォルダが設定されている店舗
const FANKURU_ENABLED_STORES = new Set(["姪浜院", "堀江院", "堀江院2nd", "楽々園院"]);

export function useFankuruData(storeName: string) {
  const hasFolderMapping = FANKURU_ENABLED_STORES.has(storeName);
  const pdfs = useMemo(() => {
    return FANKURU_DATA[storeName] || [];
  }, [storeName]);

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
    loading: false,
    error: null,
    availableMonths,
    hasFolderMapping,
  };
}
