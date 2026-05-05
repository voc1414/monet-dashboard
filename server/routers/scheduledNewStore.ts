/**
 * /api/scheduled/new-store-check
 * 定期タスクから呼ばれるエンドポイント。
 * 1. スプレッドシートの月末報告書データを解析し、DB上の既知店舗以外の新店舗を検出・自動登録
 * 2. サロンボードスプレッドシートのシート名を取得し、未マッピング店舗に自動紐づけ
 */
import { Router, Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { notifyOwner } from "../_core/notification";
import { getAllStores, insertStore, storeExists, updateStoreSalonBoardSheet } from "../db";

// ─── 月末報告書スプレッドシート ───
const SPREADSHEET_ID = "1DXAaFk0aLDZwXq28krOcrDSiTOwd6BeTzV-xFXbLuKI";
const GID = "505478524";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID}`;

// ─── サロンボードスプレッドシート ───
const SALONBOARD_SPREADSHEET_ID = "1pYQcY42rUS3ftfIkZxffCsy7zfW2hW7U_zxtXf5A5bI";
const SALONBOARD_HTMLVIEW_URL = `https://docs.google.com/spreadsheets/d/${SALONBOARD_SPREADSHEET_ID}/htmlview`;

// エリア自動判定ルール
const AREA_KEYWORDS: { keyword: string; area: string }[] = [
  { keyword: "大阪", area: "大阪エリア" },
  { keyword: "堀江", area: "大阪エリア" },
  { keyword: "福島", area: "大阪エリア" },
  { keyword: "高槻", area: "大阪エリア" },
  { keyword: "福岡", area: "福岡エリア" },
  { keyword: "姪浜", area: "福岡エリア" },
  { keyword: "広島", area: "広島エリア" },
  { keyword: "楽々園", area: "広島エリア" },
  { keyword: "土橋", area: "広島エリア" },
];

function detectArea(storeName: string): string {
  for (const { keyword, area } of AREA_KEYWORDS) {
    if (storeName.includes(keyword)) return area;
  }
  return "未分類エリア";
}

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

// カラムインデックス
const COL = {
  ANSWER_DATE: 2,
  NAME: 6,
  STORE: 7,
  EMPLOYMENT_TYPE: 8,
  TECH_SALES: 11,
  RETAIL_SALES: 12,
  NEW_CUSTOMERS: 13,
  RETURN_CUSTOMERS: 14,
  NEXT_RESERVATION: 15,
};

interface NewStoreData {
  storeName: string;
  rawNames: string[];
  staffNames: string[];
  totalSales: number;
  techSales: number;
  retailSales: number;
  totalCustomers: number;
  newCustomers: number;
  returnCustomers: number;
  avgNextReservationRate: number;
  dataCount: number;
  latestDate: string;
  detectedArea: string;
  insertedToDB: boolean;
}

interface SheetMatchResult {
  storeName: string;
  sheetName: string;
  matchMethod: "exact" | "keyword";
}

interface SheetUnmatchedResult {
  sheetName: string;
  reason: string;
}

/**
 * DBから既知店舗の正規化マッピングを動的に構築する
 */
async function buildNormalizationMap(): Promise<Record<string, string>> {
  const dbStores = await getAllStores();
  const map: Record<string, string> = {};

  for (const store of dbStores) {
    map[store.name] = store.name;
    if (store.rawNameVariants) {
      const variants = store.rawNameVariants.split(",").map(v => v.trim());
      for (const variant of variants) {
        if (variant) map[variant] = store.name;
      }
    }
  }

  return map;
}

// ─── 新店舗検出ロジック ───

async function detectNewStores(): Promise<NewStoreData[]> {
  const dbStores = await getAllStores();
  const knownStoreNames = new Set(dbStores.map(s => s.name));
  const normMap = await buildNormalizationMap();

  function normalizeStoreName(raw: string): string {
    const trimmed = raw.trim();
    return normMap[trimmed] || trimmed;
  }

  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`スプレッドシート取得失敗: HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.split("\n").filter(l => l.trim());
  const dataLines = lines.slice(1);

  const storeAgg: Record<string, {
    rawNames: Set<string>;
    staffNames: Set<string>;
    techSales: number;
    retailSales: number;
    newCustomers: number;
    returnCustomers: number;
    nextReservationValues: number[];
    dataCount: number;
    latestDate: string;
  }> = {};

  for (const line of dataLines) {
    const cols = parseCSVLine(line);
    const rawStore = (cols[COL.STORE] || "").trim();
    if (!rawStore) continue;

    const normalized = normalizeStoreName(rawStore);
    if (knownStoreNames.has(normalized)) continue;

    if (!storeAgg[normalized]) {
      storeAgg[normalized] = {
        rawNames: new Set(),
        staffNames: new Set(),
        techSales: 0,
        retailSales: 0,
        newCustomers: 0,
        returnCustomers: 0,
        nextReservationValues: [],
        dataCount: 0,
        latestDate: "",
      };
    }

    const agg = storeAgg[normalized];
    agg.rawNames.add(rawStore);
    const staffName = (cols[COL.NAME] || "").trim();
    if (staffName) agg.staffNames.add(staffName);
    agg.techSales += parseInt((cols[COL.TECH_SALES] || "0").replace(/[^0-9]/g, "")) || 0;
    agg.retailSales += parseInt((cols[COL.RETAIL_SALES] || "0").replace(/[^0-9]/g, "")) || 0;
    agg.newCustomers += parseInt((cols[COL.NEW_CUSTOMERS] || "0").replace(/[^0-9]/g, "")) || 0;
    agg.returnCustomers += parseInt((cols[COL.RETURN_CUSTOMERS] || "0").replace(/[^0-9]/g, "")) || 0;
    agg.dataCount++;

    const nextRes = (cols[COL.NEXT_RESERVATION] || "").trim();
    const pctMatch = nextRes.match(/(\d+\.?\d*)/);
    if (pctMatch) agg.nextReservationValues.push(parseFloat(pctMatch[1]));

    const answerDate = (cols[COL.ANSWER_DATE] || "").trim().split(" ")[0] || "";
    if (answerDate > agg.latestDate) agg.latestDate = answerDate;
  }

  const results: NewStoreData[] = [];
  for (const [storeName, agg] of Object.entries(storeAgg)) {
    const avgNextRes = agg.nextReservationValues.length > 0
      ? agg.nextReservationValues.reduce((a, b) => a + b, 0) / agg.nextReservationValues.length
      : 0;

    const detectedArea = detectArea(storeName);

    let insertedToDB = false;
    try {
      const exists = await storeExists(storeName);
      if (!exists) {
        await insertStore({
          name: storeName,
          area: detectedArea,
          rawNameVariants: Array.from(agg.rawNames).join(","),
          isAutoDetected: true,
        });
        insertedToDB = true;
        console.log(`[Scheduled] 新店舗をDBに登録: ${storeName} (${detectedArea})`);
      }
    } catch (err) {
      console.error(`[Scheduled] 新店舗DB登録失敗: ${storeName}`, err);
    }

    results.push({
      storeName,
      rawNames: Array.from(agg.rawNames),
      staffNames: Array.from(agg.staffNames),
      totalSales: agg.techSales + agg.retailSales,
      techSales: agg.techSales,
      retailSales: agg.retailSales,
      totalCustomers: agg.newCustomers + agg.returnCustomers,
      newCustomers: agg.newCustomers,
      returnCustomers: agg.returnCustomers,
      avgNextReservationRate: Math.round(avgNextRes * 10) / 10,
      dataCount: agg.dataCount,
      latestDate: agg.latestDate,
      detectedArea,
      insertedToDB,
    });
  }

  return results;
}

// ─── サロンボードシート名自動マッチング ───

/**
 * サロンボードスプレッドシートのhtmlviewから全シート名を抽出する
 * パターン: "monet〇〇_月別" 形式のシート名
 */
async function fetchSalonBoardSheetNames(): Promise<string[]> {
  try {
    const res = await fetch(SALONBOARD_HTMLVIEW_URL);
    if (!res.ok) {
      console.warn(`[Scheduled] サロンボードスプレッドシート取得失敗: HTTP ${res.status}`);
      return [];
    }
    const html = await res.text();

    // htmlview内のJavaScriptデータから「_月別」を含むシート名を正規表現で抽出
    const monthlyPattern = /[^\s"',;{}()\[\]]{2,40}_月別/g;
    const matches = html.match(monthlyPattern) || [];

    // 重複排除
    const uniqueSheets = Array.from(new Set(matches));
    console.log(`[Scheduled] サロンボードシート名を${uniqueSheets.length}件取得:`, uniqueSheets);
    return uniqueSheets;
  } catch (err) {
    console.error("[Scheduled] サロンボードシート名取得エラー:", err);
    return [];
  }
}

/**
 * シート名から店舗キーワードを抽出する
 * 例: "monet堀江_月別" → "堀江"
 *     "monet福岡姪浜院_月別" → "福岡姪浜院"
 *     "monet堀江ﾆ号店_月別" → "堀江ﾆ号店"
 */
function extractKeywordFromSheetName(sheetName: string): string {
  // "monet" prefix を除去し、"_月別" suffix を除去
  let keyword = sheetName.replace(/^monet/, "").replace(/_月別$/, "");
  return keyword;
}

/**
 * サロンボードシート名とDB店舗を自動マッチングし、DBを更新する
 */
async function matchSalonBoardSheets(): Promise<{
  matched: SheetMatchResult[];
  unmatched: SheetUnmatchedResult[];
  alreadyMapped: string[];
}> {
  const sheetNames = await fetchSalonBoardSheetNames();
  if (sheetNames.length === 0) {
    return { matched: [], unmatched: [], alreadyMapped: [] };
  }

  const dbStores = await getAllStores();
  const matched: SheetMatchResult[] = [];
  const unmatched: SheetUnmatchedResult[] = [];
  const alreadyMapped: string[] = [];

  // 既にマッピング済みのシート名を収集
  const existingMappings = new Set(
    dbStores.filter(s => s.salonBoardSheetName).map(s => s.salonBoardSheetName!)
  );

  for (const sheetName of sheetNames) {
    // 既にマッピング済みならスキップ
    if (existingMappings.has(sheetName)) {
      alreadyMapped.push(sheetName);
      continue;
    }

    const keyword = extractKeywordFromSheetName(sheetName);
    let matchedStore: typeof dbStores[0] | undefined;
    let matchMethod: "exact" | "keyword" = "keyword";

    // 1. 完全一致: 店舗名にキーワードが完全に含まれる
    matchedStore = dbStores.find(s => {
      // 店舗名からキーワードを生成して比較
      // 例: "楽々園院" の "院" を除いた "楽々園" と keyword "広島" を比較
      const storeParts = s.name.replace(/院$/, "").replace(/2nd$/, "");
      return storeParts === keyword || s.name === keyword || s.name === keyword + "院";
    });

    if (matchedStore) {
      matchMethod = "exact";
    } else {
      // 2. キーワードマッチ: 店舗名にシートのキーワードが含まれる or キーワードに店舗名の一部が含まれる
      matchedStore = dbStores.find(s => {
        const storeBase = s.name.replace(/院$/, "").replace(/2nd$/, "");
        // シートキーワードに店舗ベース名が含まれる
        if (keyword.includes(storeBase) && storeBase.length >= 2) return true;
        // 店舗名にシートキーワードが含まれる
        if (s.name.includes(keyword) && keyword.length >= 2) return true;
        return false;
      });
    }

    // 堀江ﾆ号店 → 堀江院2nd の特殊対応
    if (!matchedStore && (keyword.includes("ﾆ号店") || keyword.includes("二号店") || keyword.includes("2号店"))) {
      const baseKeyword = keyword.replace(/[ﾆ二2]号店/, "");
      matchedStore = dbStores.find(s => s.name.includes(baseKeyword) && s.name.includes("2nd"));
      if (matchedStore) matchMethod = "keyword";
    }

    if (matchedStore) {
      // 既にsalonBoardSheetNameが設定されている店舗はスキップ
      if (matchedStore.salonBoardSheetName) {
        alreadyMapped.push(sheetName);
        continue;
      }

      // DBを更新
      try {
        await updateStoreSalonBoardSheet(matchedStore.name, sheetName);
        matched.push({
          storeName: matchedStore.name,
          sheetName,
          matchMethod,
        });
        console.log(`[Scheduled] シート名マッチ: ${sheetName} → ${matchedStore.name} (${matchMethod})`);
      } catch (err) {
        console.error(`[Scheduled] シート名DB更新失敗: ${sheetName}`, err);
        unmatched.push({ sheetName, reason: "DB更新エラー" });
      }
    } else {
      unmatched.push({ sheetName, reason: "マッチする店舗が見つからない" });
    }
  }

  return { matched, unmatched, alreadyMapped };
}

// ─── 通知フォーマット ───

function formatNotification(
  newStores: NewStoreData[],
  sheetMatch: { matched: SheetMatchResult[]; unmatched: SheetUnmatchedResult[]; alreadyMapped: string[] }
): { title: string; content: string } {
  const parts: string[] = [];
  parts.push(`${new Date().toLocaleDateString("ja-JP")} の定期チェック結果:\n`);

  // 新店舗セクション
  if (newStores.length === 0) {
    parts.push("【新店舗】検出なし\n");
  } else {
    parts.push(`【新店舗検出】${newStores.length}件\n`);
    for (const s of newStores) {
      parts.push([
        `■ ${s.storeName}`,
        `  エリア（自動判定）: ${s.detectedArea}`,
        `  DB登録: ${s.insertedToDB ? "✓ 自動登録済み" : "既に登録済み"}`,
        `  スタッフ: ${s.staffNames.join("、")}`,
        `  総売上: ¥${s.totalSales.toLocaleString()}（技術: ¥${s.techSales.toLocaleString()} / 店販: ¥${s.retailSales.toLocaleString()}）`,
        `  総客数: ${s.totalCustomers}名（新規: ${s.newCustomers} / リピート: ${s.returnCustomers}）`,
        `  次回予約率(平均): ${s.avgNextReservationRate}%`,
      ].join("\n"));
    }
  }

  // サロンボードシート名マッチングセクション
  parts.push("\n---\n");
  if (sheetMatch.matched.length > 0) {
    parts.push(`【シート名自動マッチ】${sheetMatch.matched.length}件成功`);
    for (const m of sheetMatch.matched) {
      parts.push(`  ✓ ${m.sheetName} → ${m.storeName} (${m.matchMethod})`);
    }
  }

  if (sheetMatch.unmatched.length > 0) {
    parts.push(`\n【シート名マッチ失敗】${sheetMatch.unmatched.length}件（手動対応が必要）`);
    for (const u of sheetMatch.unmatched) {
      parts.push(`  ✗ ${u.sheetName}: ${u.reason}`);
    }
  }

  if (sheetMatch.matched.length === 0 && sheetMatch.unmatched.length === 0) {
    parts.push("【シート名マッチ】全て設定済み（変更なし）");
  }

  // タイトル生成
  let title: string;
  if (newStores.length > 0) {
    title = `【新店舗検出・自動登録】${newStores.map(s => s.storeName).join("、")}`;
  } else if (sheetMatch.matched.length > 0) {
    title = `【シート名自動マッチ】${sheetMatch.matched.length}件の紐づけを完了`;
  } else {
    title = "【定期チェック完了】変更なし";
  }

  return { title, content: parts.join("\n") };
}

// ─── Express ルート登録 ───

export function registerScheduledNewStoreRoute(app: Router): void {
  app.post("/api/scheduled/new-store-check", async (req: Request, res: Response) => {
    try {
      // 認証チェック（user roleを許可）
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (user.role !== "user" && user.role !== "admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      console.log(`[Scheduled] new-store-check triggered by user: ${user.name} (${user.role})`);

      // Step 1: 新店舗検出 + DB自動INSERT
      const newStores = await detectNewStores();

      // Step 2: サロンボードシート名自動マッチング
      const sheetMatch = await matchSalonBoardSheets();

      // Step 3: 通知送信
      const notification = formatNotification(newStores, sheetMatch);
      const notified = await notifyOwner(notification);

      res.json({
        success: true,
        newStoresFound: newStores.length,
        stores: newStores,
        sheetMatching: {
          matched: sheetMatch.matched,
          unmatched: sheetMatch.unmatched,
          alreadyMapped: sheetMatch.alreadyMapped.length,
        },
        notified,
        message: notification.title,
      });
    } catch (error) {
      console.error("[Scheduled] new-store-check error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}
