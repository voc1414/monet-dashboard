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

// 店舗名の正規化マッピング（フォールバック用 — DBが利用不可の場合のみ使用）
const STORE_NAME_NORMALIZE_FALLBACK: Record<string, string> = {
  "大阪堀江院": "堀江院",
  "大阪堀江院2nd": "堀江院2nd",
  "福岡姪浜院": "姪浜院",
  "福岡経浜院": "姪浜院",  // 誤字対応
  "広島楽々園院": "楽々園院",
  "大阪福島院": "福島院",
  "大阪高槻院": "高槻院",
  "大阪|堀江院": "堀江院",  // スプレッドシートでパイプ区切りの表記
  // そのまま使えるケース
  "姪浜院": "姪浜院",
  "堀江院": "堀江院",
  "堀江院2nd": "堀江院2nd",
  "楽々園院": "楽々園院",
  "福島院": "福島院",
  "高槻院": "高槻院",
};

// Module-level alias map that can be updated from DB
let _fankuruAliasMap: Record<string, string> | undefined;

export function setFankuruAliasMap(map: Record<string, string> | undefined) {
  _fankuruAliasMap = map;
}

// Module-level stylist alias map from DB (alias → canonicalName)
let _dbStylistAliasMap: Record<string, string> = {};

export function setStylistAliasMapFromDb(aliases: Array<{ alias: string; canonicalName: string }>) {
  const map: Record<string, string> = {};
  for (const a of aliases) {
    map[a.alias.toLowerCase()] = a.canonicalName;
  }
  _dbStylistAliasMap = map;
}

export function getDbStylistAliasMap(): Record<string, string> {
  return _dbStylistAliasMap;
}

export function normalizeStoreName(raw: string): string {
  // DB-based map takes priority
  if (_fankuruAliasMap && Object.keys(_fankuruAliasMap).length > 0) {
    if (_fankuruAliasMap[raw]) return _fankuruAliasMap[raw];
  }
  return STORE_NAME_NORMALIZE_FALLBACK[raw] || raw;
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

export async function fetchPdfData(): Promise<Record<string, FankuruPdf[]>> {
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
        const stylist = (cols[8] || "").trim(); // 担当者列（GASが抽出）
        
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
          stylist,
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

// ファンくるフォルダが設定されている店舗（動的判定に移行済み — hasFolderMappingはデータの有無で判定）

/**
 * ファンくるのスタイリスト名（ひらがな/カタカナ/略称/ローマ字）と
 * 月末報告書のスタッフ名を紐づけるマッピングテーブル。
 * キー: ダッシュボード上のスタッフ名（正式名）
 * 値: ファンくるPDFに記載されうる別名一覧
 *
 * パターン: 姓のみ、名のみ、ひらがな、カタカナ、ローマ字（ヘボン式/訓令式）、漢字違い
 */
const STYLIST_NAME_ALIASES: Record<string, string[]> = {
  // === 姪浜院 ===
  "山口純奈": [
    "山口", "やまぐち", "ヤマグチ", "yamaguchi", "yamaguti",
    "純奈", "じゅんな", "ジュンナ", "junna", "jyunna",
    "純菜", "やまぐちじゅんな", "ヤマグチジュンナ",
  ],
  "金田あゆみ": [
    "金田", "かねだ", "カネダ", "kaneda",
    "あゆみ", "アユミ", "ayumi",
    "かねだあゆみ", "カネダアユミ",
  ],
  "石橋茜": [
    "石橋", "いしばし", "イシバシ", "ishibashi",
    "あかね", "アカネ", "akane",
    "いしばしあかね", "イシバシアカネ",
  ],
  // 藤田（過去スタッフ）
  "藤田": ["ふじた", "フジタ", "fujita", "ふじたみほ", "フジタミホ", "藤田美穂"],
  "尾上みゆき": [
    "尾上", "おがみ", "オガミ", "ogami",
    "みゆき", "ミユキ", "miyuki",
    "おがみみゆき", "オガミミユキ",
  ],

  // === 楽々園院 ===
  "井上 恵子": [
    "井上", "いのうえ", "イノウエ", "inoue",
    "恵子", "けいこ", "ケイコ", "keiko",
    "いのうえけいこ", "イノウエケイコ",
  ],
  "前田慶子": [
    "前田", "まえだ", "マエダ", "maeda",
    "慶子", "けいこ", "ケイコ", "keiko",
    "まえだけいこ", "マエダケイコ",
  ],
  "千葉祐子": [
    "千葉", "ちば", "チバ", "chiba",
    "祐子", "ゆうこ", "ユウコ", "yuuko", "yuko",
    "ちばゆうこ", "チバユウコ",
  ],
  "石原葉子": [
    "石原", "いしはら", "イシハラ", "ishihara",
    "葉子", "ようこ", "ヨウコ", "youko", "yoko",
    "いしはらようこ", "イシハラヨウコ",
  ],
  // 田中 江梨子（楽々園院のファンくる担当）
  "田中 江梨子": [
    "田中", "たなか", "タナカ", "tanaka",
    "江梨子", "えりこ", "エリコ", "eriko",
    "たなかえりこ", "タナカエリコ",
    "田中江梨子",
  ],

  // === 堀江院 ===
  "Kaede": ["かえで", "カエデ", "kaede", "楓"],
  // ファンくる側で "Akiko" と表記されるケースあり（林 確認済み 2026-07-06）
  "小池明子": ["akiko", "Akiko", "AKIKO", "あきこ", "アキコ", "小池", "こいけ", "コイケ", "koike", "こいけあきこ", "コイケアキコ", "小池明子"],
  // 堀江院のMika（スプレッドシートで「大阪|堀江院」として登録）
  // STAFF_STORE_MAPで福島院のMikaと区別

  // === 堀江院2nd ===
  "Mimi": ["みみ", "ミミ", "mimi"],
  "sayuri": ["さゆり", "サユリ", "sayuri", "小百合", "Sayuri"],
  "Aki": ["あき", "アキ", "aki", "AKI"],
  "Kazumi": ["かずみ", "カズミ", "kazumi"],
  "Hiromi": ["ひろみ", "ヒロミ", "hiromi"],
  // ファンくる側で "Minato" と表記されるケースあり（林 確認済み 2026-07-06）
  "Minaho": ["みなほ", "ミナホ", "minaho", "minato"],
  "坂手": ["さかて", "サカテ", "sakate"],

  // === 高槻院 ===
  "Yuko": ["ゆうこ", "ユウコ", "yuko", "yuuko"],
  "Asuka": ["あすか", "アスカ", "asuka"],
  "Mariko": ["まりこ", "マリコ", "mariko"],
  "Nao": ["なお", "ナオ", "nao"],

  // === 福島院 ===
  "Yu": ["ゆう", "ユウ", "yu", "yuu"],
  "Yukiko": ["ゆきこ", "ユキコ", "yukiko"],
  "yoshie": ["よしえ", "ヨシエ", "yoshie", "由恵（よしえさん）", "由恵"],
  // 杉本＝Hiroko（月末報告書の登録名はHiroko。林 確認済み 2026-07-06）
  "Hiroko": ["ひろこ", "ヒロコ", "hiroko", "杉本", "すぎもと", "スギモト", "sugimoto"],
  "Mika": ["みか", "ミカ", "mika"],
  "Hitomi": ["ひとみ", "ヒトミ", "hitomi"],
  "かよ": ["カヨ", "kayo"],

  // === 高槻院 追加エイリアス ===
  // ファンくるで「アスカさんです。」と記載されるケース対応
  // Asukaのエイリアスに追加
};

// Asukaのエイリアスにファンくる特有の表記を追加
STYLIST_NAME_ALIASES["Asuka"] = [
  ...(STYLIST_NAME_ALIASES["Asuka"] || []),
  "アスカさんです。", "アスカさんです", "アスカさん",
];

/**
 * スタッフ名と所属店舗の紐づけテーブル。
 * 同姓同名がある場合に、ファンくるのPDFがどの店舗のスタッフのものか判別するために使用。
 * キー: ダッシュボード表示名, 値: 所属店舗名
 */
const STAFF_STORE_MAP: Record<string, string> = {
  // 姪浜院
  "山口純奈": "姪浜院",
  "金田あゆみ": "姪浜院",
  "石橋茜": "姪浜院",
  "藤田": "姪浜院",
  "尾上みゆき": "姪浜院",
  // 楽々園院
  "井上 恵子": "楽々園院",
  "前田慶子": "楽々園院",
  "千葉祐子": "楽々園院",
  "石原葉子": "楽々園院",
  "田中 江梨子": "楽々園院",
  // 堀江院
  "Kaede": "堀江院",
  // 堀江院2nd
  "Mimi": "堀江院2nd",
  "sayuri": "堀江院2nd",
  "Aki": "堀江院2nd",
  "Kazumi": "堀江院2nd",
  "Hiromi": "堀江院2nd",
  "坂手": "堀江院2nd",
  // 高槻院
  "Yuko": "高槻院",
  "Asuka": "高槻院",
  "Mariko": "高槻院",
  "Nao": "高槻院",
  // 福島院
  "Yu": "福島院",
  "Yukiko": "福島院",
  "yoshie": "福島院",
  "Hiroko": "福島院",
  "Mika": "福島院",
  "Hitomi": "福島院",
  "杉本": "福島院",
  "かよ": "福島院",
};

// 逆引きマップを構築（エイリアス → 正式名）
const ALIAS_TO_CANONICAL: Record<string, string> = {};
for (const [canonical, aliases] of Object.entries(STYLIST_NAME_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_CANONICAL[alias.toLowerCase()] = canonical;
  }
  // 正式名自身も登録
  ALIAS_TO_CANONICAL[canonical.toLowerCase()] = canonical;
}

/**
 * 統合エイリアスマップを返す（ハードコード + DB）。
 * DB側が優先される（上書き）。
 */
function getMergedAliasMap(): Record<string, string> {
  return { ...ALIAS_TO_CANONICAL, ..._dbStylistAliasMap };
}

/**
 * スタイリスト名を正規化する。
 * エイリアスがあれば正式名に変換、なければそのまま返す。
 */
export function normalizeStylistName(name: string): string {
  const lower = name.trim().toLowerCase();
  const merged = getMergedAliasMap();
  return merged[lower] || name.trim();
}

/**
 * スタッフ名とスタイリスト名が一致するかチェックする。
 * 直接一致、部分一致、エイリアス経由の一致をすべてチェック。
 */
// 半角英数字のみか（ローマ字名の判定）
function isAsciiName(s: string): boolean {
  return /^[\x00-\x7F]+$/.test(s);
}
/**
 * 名前の包含一致を安全に判定する。
 * - 完全一致は常にOK。
 * - 英字（ローマ字）同士は「完全一致のみ」。"Yukiko" が "Yu" を含む等の誤マッチを防ぐ。
 * - 日本語（かな/漢字）を含む場合のみ部分一致を許可（「山口」→「山口純奈」等の姓/名一致）。
 *   1文字だけの部分一致は誤爆しやすいので2文字以上を要求。
 */
function nameContain(a: string, b: string): boolean {
  if (a === b) return true;
  if (isAsciiName(a) && isAsciiName(b)) return false; // 英字同士は完全一致のみ
  if (a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a))) return true;
  return false;
}

// 名前の表記ゆれを吸収: 空白除去＋末尾の敬称/会話調（さん/さんです/です/。）除去。
// 例: "山口 純奈"→"山口純奈"、"サユリさんです。"→"サユリ"、"石橋 茜"→"石橋茜"。
function cleanName(s: string): string {
  return (s || "")
    .replace(/[\s　]/g, "")
    .replace(/(さんです。?|さんでした。?|さん。?|です。?|でした。?)$/u, "")
    .replace(/[。.]+$/u, "")
    .trim();
}

export function matchesStylist(stylistRaw: string, staffName: string): boolean {
  if (!stylistRaw || !staffName) return false;
  const sClean = cleanName(stylistRaw);
  const tClean = cleanName(staffName);
  const stylist = sClean.toLowerCase();
  const target = tClean.toLowerCase();
  if (!stylist || !target) return false;

  if (nameContain(stylist, target)) return true;

  // エイリアス経由: 両方を正規化して比較（cleanNameで表記ゆれを吸収してから）
  const normalizedStylist = normalizeStylistName(sClean).toLowerCase();
  const normalizedTarget = normalizeStylistName(tClean).toLowerCase();
  if (normalizedStylist === normalizedTarget) return true;
  if (nameContain(normalizedStylist, normalizedTarget)) return true;

  return false;
}

/**
 * スタッフ名でファンくるPDFをフィルタリングするフック。
 * storeName を指定すると、その店舗のPDFのみに絞り込み（同姓同名対策）。
 * storeName が未指定の場合は、STAFF_STORE_MAPから自動判定を試みる。
 */
export function useFankuruDataByStaff(staffName: string, storeName?: string) {
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

  // スタッフの所属店舗を特定（引数 > STAFF_STORE_MAP > 全店舗）
  const effectiveStore = storeName || STAFF_STORE_MAP[staffName] || "";

  // スタッフ名でPDFをフィルタリング（エイリアス対応 + 店舗紞り込み）
  const pdfs = useMemo(() => {
    const result: FankuruPdf[] = [];
    if (!staffName.trim()) return result;
    for (const [pdfStoreName, storePdfs] of Object.entries(allData)) {
      // 店舗名が指定されている場合、その店舗のPDFのみ対象
      if (effectiveStore && pdfStoreName !== effectiveStore) continue;
      for (const pdf of storePdfs) {
        if (pdf.stylist && matchesStylist(pdf.stylist, staffName)) {
          result.push(pdf);
        }
      }
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [allData, staffName, effectiveStore]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    pdfs.forEach((p) => {
      if (p.yearMonth) months.add(p.yearMonth);
    });
    return Array.from(months).sort().reverse();
  }, [pdfs]);

  return { pdfs, loading, error, availableMonths };
}

export function useFankuruData(storeName: string) {
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

  // 動的判定: スプレッドシートにデータがあれば自動的にファンくるセクションを表示
  const hasFolderMapping = pdfs.length > 0;

  return {
    pdfs,
    loading,
    error,
    availableMonths,
    hasFolderMapping,
  };
}
