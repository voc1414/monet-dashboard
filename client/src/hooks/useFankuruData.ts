/*
 * ファンくる調査結果 — Google スプレッドシート CSV 自動取得方式
 * GASが1時間おきにファンくるメールをチェックし、PDFをDriveに保存、
 * スプレッドシートにリンクを記録。ダッシュボードはCSVから自動取得する。
 *
 * スプレッドシートCSVカラム: 店舗名,年月,日付,ファイル名,表示名,driveFileId,previewUrl,viewUrl
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  aliasKey,
  aliasesForStaff,
  partialAliasesForStaff,
  isAmbiguousPartialInput,
  GENERATED_ALIAS_TO_CANONICAL,
  STAFF_STORE_BY_NAME,
} from "@/lib/stylistAlias";
import { canonicalizeStaffName } from "@/lib/staffNameAlias";
import { isRetiredStaff } from "@/lib/newBadge";
import { STAFF_MASTER } from "@/data/staffMaster";

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
 * 担当者名の表記ゆれ（ひらがな/カタカナ/略称/ローマ字）は、スタッフマスタの「かな」から
 * 機械生成する。lib/stylistAlias.ts が正本。
 *
 * 2026-08-30: 手で並べたエイリアス表（旧 STYLIST_NAME_ALIASES・約30キー）を廃止した。
 * 表は腐るため — 名簿から消えた人のキーが3つ残り（藤田・石原葉子・かよ）、
 * 「坂手」は読みが清音で誤登録されていた（正しくは さかで）。
 * **別名を足したいときはコードを触らず、Notion「全スタッフ一覧」の「かな」を直す。**
 * 元データ側の打ち間違い（例: Minaho→Minato）だけは
 * lib/stylistAlias.ts の MANUAL_EXCEPTIONS に置く。
 */

/**
 * スタッフ名 → 所属店舗（旧 STAFF_STORE_MAP。スタッフマスタから自動生成）。
 * 表示名が複数店舗で重複する場合（Mika / Yu / Nao 等）は引けない＝全店舗を対象にする。
 */
const STAFF_STORE_MAP: Record<string, string> = STAFF_STORE_BY_NAME;

/** 別名 → 氏名 の逆引き（全店舗を通して一意な別名だけが載る） */
const ALIAS_TO_CANONICAL: Record<string, string> = GENERATED_ALIAS_TO_CANONICAL;

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
 *
 * 引き方が2通りあるのは、キーの作り方が2系統あるため:
 *   DB(stylist_aliases) … 小文字化のみ（空白を残す）
 *   機械生成            … aliasKey = 空白除去＋小文字化
 * 先に生の小文字で引き、外したら空白除去キーで引く。
 *
 * 最後に canonicalizeStaffName を通すのは、月末報告書・NPS 側の名寄せと
 * 同じ氏名に着地させるため（例: "坂手" → 坂手芳）。ここを通さないと
 * ファンくるだけ別の氏名になり、同じ人が2人に見える。
 */
export function normalizeStylistName(name: string): string {
  const trimmed = name.trim();
  const merged = getMergedAliasMap();
  const hit = merged[trimmed.toLowerCase()] ?? merged[aliasKey(trimmed)];
  return canonicalizeStaffName(hit ?? trimmed);
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

// 名前の表記ゆれを吸収: 空白除去＋末尾の敬称/会話調（さん/さま/様/さんです/です/。）除去。
// 例: "山口 純奈"→"山口純奈"、"サユリさんです。"→"サユリ"、"石橋様"→"石橋"。
// ※「様/さま」は 2026-08-19 追加。ファンくるの「石橋様」が石橋茜さんに紐づかず
//   覆面調査1件が取りこぼされていた（担当者欄はお客様の自由記述）。
function cleanName(s: string): string {
  return (s || "")
    .replace(/[\s　]/g, "")
    .replace(/(さんです。?|さんでした。?|さん。?|さま。?|様。?|です。?|でした。?)$/u, "")
    .replace(/[。.]+$/u, "")
    .trim();
}

/**
 * その月、その人はもう在籍していないか。
 *
 * 判定は newBadge の isRetiredStaff に任せる（DB優先・マスタfallback）が、
 * あちらのマスタ側フォールバックは **表示名**（Aki / Mika 等）をキーにしており、
 * DB側は氏名で登録されることがある。どちらの名前で呼ばれても効くように、
 * マスタで人を特定してから氏名・表示名の両方で問い合わせる。
 */
export function isRetiredInMonth(staffName: string, store: string, yearMonth: string): boolean {
  if (!yearMonth) return false;
  const key = aliasKey(staffName);
  const entry = STAFF_MASTER.find(
    (s) => s.store === store && (aliasKey(s.name) === key || aliasKey(s.displayName) === key)
  );
  const names = entry ? [entry.name, entry.displayName] : [staffName];
  return names.some((n) => isRetiredStaff(n, store, yearMonth));
}

export function matchesStylist(stylistRaw: string, staffName: string): boolean {
  if (!stylistRaw || !staffName) return false;
  const sClean = cleanName(stylistRaw);
  const tClean = cleanName(staffName);
  const stylist = sClean.toLowerCase();
  const target = tClean.toLowerCase();
  if (!stylist || !target) return false;

  if (nameContain(stylist, target)) return true;

  // かな/カタカナ/ローマ字のゆれ: そのスタッフの読みから生成した別名に当てる。
  // 例: 徳永さゆり の "sayuri"・木下夕季子 の "Yukiko"・谷口楓 の "かえで"。
  // 同一店舗内でぶつかる読み（楽々園院 井上恵子 と 前田慶子 の "けいこ"）は
  // stylistAlias.ts が落としてあるので、ここでは誰にも当たらない＝未マッチとして
  // 管理画面の検出パネルに出る（人が判断する）。
  const key = aliasKey(sClean);

  // ①完全一致: 生成した別名にそのまま一致する（"ヒロコ"・"sayuri"・"みなほ" 等）
  if (aliasesForStaff(tClean)?.has(key)) return true;

  // ②部分一致: お客様の自由記述は読みの一部しか書かないことがあり
  //   （"ナオ"←なおえ／"ユウ"←ゆうか）、逆に字が足されることもある
  //   （"由恵（よしえさん）"←よしえ）。実データにどちらもあるので部分一致は必要。
  //   ただし同一店舗の別人と紛れる別名は stylistAlias 側で外してある
  //   （土橋院 "まゆ" ⊂ "まゆこ"）ため、ここでは取り違えが起きない。
  //   加えて、入力そのものが同一店舗の2人に当たる語（楽々園院 "けいこ" は
  //   "いのうえけいこ" と "まえだけいこ" の両方に含まれる）は部分一致を諦める＝未マッチにする。
  const partial = partialAliasesForStaff(tClean);
  if (partial && !isAmbiguousPartialInput(STAFF_STORE_MAP[aliasKey(tClean)] ?? "", key)) {
    for (const alias of partial) {
      if (nameContain(key, alias)) return true;
    }
  }

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

  // スタッフの所属店舗を特定（引数 > スタッフマスタ > 全店舗）
  // マスタ側のキーは空白除去＋小文字化なので aliasKey を通してから引く
  const effectiveStore = storeName || STAFF_STORE_MAP[aliasKey(staffName)] || "";

  // スタッフ名でPDFをフィルタリング（エイリアス対応 + 店舗紞り込み）
  const pdfs = useMemo(() => {
    const result: FankuruPdf[] = [];
    if (!staffName.trim()) return result;
    for (const [pdfStoreName, storePdfs] of Object.entries(allData)) {
      // 店舗名が指定されている場合、その店舗のPDFのみ対象
      if (effectiveStore && pdfStoreName !== effectiveStore) continue;
      for (const pdf of storePdfs) {
        if (!pdf.stylist || !matchesStylist(pdf.stylist, staffName)) continue;
        // 退社後の月の調査は紐づけない。読みから別名を機械生成した結果、退職者の
        // 短い読み（例: 池内亜希子 の "Aki"）が在籍中の月以外にも当たるようになったため、
        // 在籍期間で切る（判定は newBadge の isRetiredStaff＝DB優先・マスタfallback）。
        if (isRetiredInMonth(staffName, pdfStoreName, pdf.yearMonth)) continue;
        result.push(pdf);
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
