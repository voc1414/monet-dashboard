/**
 * /api/scheduled/new-store-check
 * 定期タスクから呼ばれるエンドポイント。
 * スプレッドシートの月末報告書データを解析し、既知店舗以外の新店舗を検出して通知する。
 */
import { Router, Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { notifyOwner } from "../_core/notification";

const SPREADSHEET_ID = "1DXAaFk0aLDZwXq28krOcrDSiTOwd6BeTzV-xFXbLuKI";
const GID = "505478524";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID}`;

// 既知店舗一覧
const KNOWN_STORES = new Set([
  "堀江院", "堀江院2nd", "姪浜院", "楽々園院", "福島院", "高槻院",
]);

// 店舗名正規化マッピング
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
}

async function detectNewStores(): Promise<NewStoreData[]> {
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
    if (KNOWN_STORES.has(normalized)) continue;

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
    });
  }

  return results;
}

function formatNotification(stores: NewStoreData[]): { title: string; content: string } {
  if (stores.length === 0) {
    return {
      title: "【新店舗チェック】新店舗は検出されませんでした",
      content: `${new Date().toLocaleDateString("ja-JP")} の定期チェック結果:\n\n既知6店舗以外の新店舗データは見つかりませんでした。\n\n既知店舗: 堀江院、堀江院2nd、福島院、高槻院、姪浜院、楽々園院`,
    };
  }

  const storeDetails = stores.map(s => {
    return [
      `■ ${s.storeName}`,
      `  スタッフ: ${s.staffNames.join("、")}`,
      `  総売上: ¥${s.totalSales.toLocaleString()}（技術: ¥${s.techSales.toLocaleString()} / 店販: ¥${s.retailSales.toLocaleString()}）`,
      `  総客数: ${s.totalCustomers}名（新規: ${s.newCustomers} / リピート: ${s.returnCustomers}）`,
      `  次回予約率(平均): ${s.avgNextReservationRate}%`,
      `  データ件数: ${s.dataCount}件（最新: ${s.latestDate}）`,
    ].join("\n");
  }).join("\n\n");

  return {
    title: `【新店舗検出】${stores.map(s => s.storeName).join("、")} が見つかりました`,
    content: `${new Date().toLocaleDateString("ja-JP")} の定期チェック結果:\n\n${storeDetails}\n\n---\nダッシュボードへの反映が必要です。管理者に連絡してください。`,
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

      // 新店舗検出
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
