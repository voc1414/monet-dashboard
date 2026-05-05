/**
 * /api/scheduled/new-store-check
 * 定期タスクから呼ばれるエンドポイント。
 * スプレッドシートの月末報告書データを解析し、DB上の既知店舗以外の新店舗を検出。
 * 新店舗が見つかった場合はDBに自動INSERTし、オーナーに通知する。
 */
import { Router, Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { notifyOwner } from "../_core/notification";
import { getAllStores, insertStore, storeExists } from "../db";

const SPREADSHEET_ID = "1DXAaFk0aLDZwXq28krOcrDSiTOwd6BeTzV-xFXbLuKI";
const GID = "505478524";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID}`;

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

/**
 * DBから既知店舗の正規化マッピングを動的に構築する
 */
async function buildNormalizationMap(): Promise<Record<string, string>> {
  const dbStores = await getAllStores();
  const map: Record<string, string> = {};

  for (const store of dbStores) {
    // 店舗名そのものをマッピング
    map[store.name] = store.name;
    // rawNameVariants（カンマ区切り）を展開
    if (store.rawNameVariants) {
      const variants = store.rawNameVariants.split(",").map(v => v.trim());
      for (const variant of variants) {
        if (variant) map[variant] = store.name;
      }
    }
  }

  return map;
}

async function detectNewStores(): Promise<NewStoreData[]> {
  // DBから既知店舗セットと正規化マップを取得
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

    // DBに自動INSERT
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

function formatNotification(stores: NewStoreData[]): { title: string; content: string } {
  if (stores.length === 0) {
    return {
      title: "【新店舗チェック】新店舗は検出されませんでした",
      content: `${new Date().toLocaleDateString("ja-JP")} の定期チェック結果:\n\nDB登録済み店舗以外の新店舗データは見つかりませんでした。`,
    };
  }

  const storeDetails = stores.map(s => {
    return [
      `■ ${s.storeName}`,
      `  エリア（自動判定）: ${s.detectedArea}`,
      `  DB登録: ${s.insertedToDB ? "✓ 自動登録済み" : "既に登録済み"}`,
      `  スタッフ: ${s.staffNames.join("、")}`,
      `  総売上: ¥${s.totalSales.toLocaleString()}（技術: ¥${s.techSales.toLocaleString()} / 店販: ¥${s.retailSales.toLocaleString()}）`,
      `  総客数: ${s.totalCustomers}名（新規: ${s.newCustomers} / リピート: ${s.returnCustomers}）`,
      `  次回予約率(平均): ${s.avgNextReservationRate}%`,
      `  データ件数: ${s.dataCount}件（最新: ${s.latestDate}）`,
    ].join("\n");
  }).join("\n\n");

  return {
    title: `【新店舗検出・自動登録】${stores.map(s => s.storeName).join("、")}`,
    content: `${new Date().toLocaleDateString("ja-JP")} の定期チェック結果:\n\n${storeDetails}\n\n---\n上記の新店舗はダッシュボードに自動反映されました。\nエリア判定が正しいか確認してください。\nサロンボードのシート名マッピングは手動設定が必要です。`,
  };
}

export function registerScheduledNewStoreRoute(app: Router): void {
  app.post("/api/scheduled/new-store-check", async (req: Request, res: Response) => {
    try {
      // 認証チェック（user roleを許可）
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      // user.role == "user" or "admin" を許可
      if (user.role !== "user" && user.role !== "admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      console.log(`[Scheduled] new-store-check triggered by user: ${user.name} (${user.role})`);

      // 新店舗検出 + DB自動INSERT
      const newStores = await detectNewStores();

      // 通知送信
      const notification = formatNotification(newStores);
      const notified = await notifyOwner(notification);

      res.json({
        success: true,
        newStoresFound: newStores.length,
        stores: newStores,
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
