/**
 * /api/scheduled/monthly-sync
 * 毎月6日に定期タスクから呼ばれるエンドポイント。
 *
 * 実行内容:
 * 1. 新店舗検出（既存のnew-store-checkと同じロジック）
 * 2. サロンボードシート名の自動マッチング
 * 3. 各データソースのマッピング整合性チェック
 *    - NPS: 未マッピングの店舗名パターンがないか確認
 *    - 月末報告書: 未マッピングの店舗名がないか確認
 *    - ファンくる: 未マッピングの店舗名がないか確認
 * 4. オーナーへ結果通知
 */
import { Router, Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { notifyOwner } from "../_core/notification";
import { getAllStores, insertStore, storeExists, updateStoreSalonBoardSheet } from "../db";

// ─── スプレッドシートURL ───
const MONTHLY_REPORT_SPREADSHEET_ID = "1DXAaFk0aLDZwXq28krOcrDSiTOwd6BeTzV-xFXbLuKI";
const MONTHLY_REPORT_GID = "505478524";
const MONTHLY_REPORT_CSV_URL = `https://docs.google.com/spreadsheets/d/${MONTHLY_REPORT_SPREADSHEET_ID}/export?format=csv&gid=${MONTHLY_REPORT_GID}`;

const SALONBOARD_SPREADSHEET_ID = "1pYQcY42rUS3ftfIkZxffCsy7zfW2hW7U_zxtXf5A5bI";
const SALONBOARD_HTMLVIEW_URL = `https://docs.google.com/spreadsheets/d/${SALONBOARD_SPREADSHEET_ID}/htmlview`;

const NPS_SPREADSHEET_ID = "1xSm2poTIeRPFviVmINdWNWmLT5d9pXXL2XzWEQsxiRU";
const NPS_CSV_URL = `https://docs.google.com/spreadsheets/d/${NPS_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("全店舗")}`;

const FANKURU_SPREADSHEET_ID = "1bbQT7eBb2Om1ODgsL_g0dx_bcw55j3RHRRJGr7xSwsg";
const FANKURU_CSV_URL = `https://docs.google.com/spreadsheets/d/${FANKURU_SPREADSHEET_ID}/gviz/tq?tqx=out:csv`;

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
      } else if (ch === ',') {
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

// ─── Step 1: 新店舗検出 ───
async function detectNewStores(): Promise<{ name: string; area: string; source: string }[]> {
  const newStores: { name: string; area: string; source: string }[] = [];
  try {
    // 月末報告書から店舗名を取得
    const resp = await fetch(MONTHLY_REPORT_CSV_URL);
    if (!resp.ok) return newStores;
    const text = await resp.text();
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) return newStores;

    // 既知店舗のDB情報を取得
    const dbStores = await getAllStores();
    const knownNames = new Set(dbStores.map(s => s.name));
    // rawNameVariantsからも既知名を構築
    const variantToName = new Map<string, string>();
    for (const s of dbStores) {
      if (s.rawNameVariants) {
        for (const v of s.rawNameVariants.split(",").map(x => x.trim())) {
          variantToName.set(v, s.name);
        }
      }
      // reportAliases
      if (s.reportAliases) {
        for (const a of s.reportAliases.split(",").map(x => x.trim())) {
          variantToName.set(a, s.name);
        }
      }
    }

    // CSVの店舗列（index 7）を収集
    const storeNamesInReport = new Set<string>();
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const storeName = cols[7]?.trim();
      if (storeName) storeNamesInReport.add(storeName);
    }

    // 未知の店舗名を検出
    for (const rawName of Array.from(storeNamesInReport)) {
      if (knownNames.has(rawName)) continue;
      if (variantToName.has(rawName)) continue;
      // 新店舗として登録
      const area = detectArea(rawName);
      const exists = await storeExists(rawName);
      if (!exists) {
        await insertStore({
          name: rawName,
          area,
          rawNameVariants: rawName,
          isAutoDetected: true,
        });
        newStores.push({ name: rawName, area, source: "月末報告書" });
      }
    }
  } catch (err) {
    console.error("[monthly-sync] detectNewStores error:", err);
  }
  return newStores;
}

// ─── Step 2: サロンボードシート名マッチング ───
async function matchSalonBoardSheets(): Promise<{
  matched: { store: string; sheetName: string }[];
  unmatched: string[];
  alreadyMapped: string[];
}> {
  const result = { matched: [] as { store: string; sheetName: string }[], unmatched: [] as string[], alreadyMapped: [] as string[] };
  try {
    // シート名一覧をHTMLから取得
    const resp = await fetch(SALONBOARD_HTMLVIEW_URL);
    if (!resp.ok) return result;
    const html = await resp.text();
    // シート名を抽出（<li id="sheet-button-..."><a ...>シート名</a></li>）
    const sheetNames: string[] = [];
    const regex = /id="sheet-button-\d+"[^>]*>.*?<a[^>]*>([^<]+)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      sheetNames.push(match[1].trim());
    }
    // 月別シートのみ対象
    const monthlySheets = sheetNames.filter(s => s.includes("_月別") || s.includes("月別"));

    // DB店舗情報
    const dbStores = await getAllStores();
    const alreadyMappedStores = dbStores.filter(s => s.salonBoardSheetName);
    result.alreadyMapped = alreadyMappedStores.map(s => `${s.name} → ${s.salonBoardSheetName}`);

    // 未マッピング店舗にシート名をマッチング
    const unmappedStores = dbStores.filter(s => !s.salonBoardSheetName);
    const usedSheets = new Set(alreadyMappedStores.map(s => s.salonBoardSheetName));

    for (const store of unmappedStores) {
      const keyword = extractKeywordFromStoreName(store.name);
      if (!keyword) continue;
      const matchedSheet = monthlySheets.find(
        sheet => !usedSheets.has(sheet) && sheet.includes(keyword)
      );
      if (matchedSheet) {
        await updateStoreSalonBoardSheet(store.name, matchedSheet);
        usedSheets.add(matchedSheet);
        result.matched.push({ store: store.name, sheetName: matchedSheet });
      }
    }

    // 未マッチのシート
    result.unmatched = monthlySheets.filter(s => !usedSheets.has(s));
  } catch (err) {
    console.error("[monthly-sync] matchSalonBoardSheets error:", err);
  }
  return result;
}

function extractKeywordFromStoreName(name: string): string | null {
  // "堀江院" → "堀江", "楽々園院" → "楽々園", "姪浜院" → "姪浜"
  const m = name.match(/^(.+?)院/);
  return m ? m[1] : null;
}

// ─── Step 3: マッピング整合性チェック ───
interface MappingGap {
  source: string;
  unmappedNames: string[];
}

async function checkMappingGaps(): Promise<MappingGap[]> {
  const gaps: MappingGap[] = [];
  const dbStores = await getAllStores();
  const knownNames = new Set(dbStores.map(s => s.name));

  // NPS: reportAliasesとnpsAliasからマッピング構築
  const npsAliasMap = new Map<string, string>();
  for (const s of dbStores) {
    if (s.npsAlias) npsAliasMap.set(s.npsAlias, s.name);
  }

  // NPS スプレッドシートの店舗名を確認
  try {
    const resp = await fetch(NPS_CSV_URL);
    if (resp.ok) {
      const text = await resp.text();
      const lines = text.split("\n").filter(l => l.trim());
      const npsStoreNames = new Set<string>();
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const rawName = cols[2]?.trim().replace(/"/g, "");
        if (rawName) npsStoreNames.add(rawName);
      }
      // マッチしない店舗名を検出
      const unmapped: string[] = [];
      for (const rawName of Array.from(npsStoreNames)) {
        let matched = false;
        // npsAliasMapのキーワードでマッチ試行
        for (const [alias] of Array.from(npsAliasMap)) {
          if (rawName.includes(alias)) { matched = true; break; }
        }
        // 既知店舗名の直接マッチ
        if (!matched) {
          for (const known of Array.from(knownNames)) {
            if (rawName.includes(known)) { matched = true; break; }
          }
        }
        if (!matched) unmapped.push(rawName);
      }
      if (unmapped.length > 0) {
        gaps.push({ source: "NPS", unmappedNames: Array.from(new Set(unmapped)).slice(0, 10) });
      }
    }
  } catch (err) {
    console.warn("[monthly-sync] NPS check failed:", err);
  }

  // 月末報告書の店舗名を確認
  try {
    const reportAliasMap = new Map<string, string>();
    for (const s of dbStores) {
      if (s.reportAliases) {
        for (const a of s.reportAliases.split(",").map(x => x.trim())) {
          reportAliasMap.set(a, s.name);
        }
      }
    }
    const resp = await fetch(MONTHLY_REPORT_CSV_URL);
    if (resp.ok) {
      const text = await resp.text();
      const lines = text.split("\n").filter(l => l.trim());
      const reportStoreNames = new Set<string>();
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const rawName = cols[7]?.trim();
        if (rawName) reportStoreNames.add(rawName);
      }
      const unmapped: string[] = [];
      for (const rawName of Array.from(reportStoreNames)) {
        if (knownNames.has(rawName)) continue;
        if (reportAliasMap.has(rawName)) continue;
        unmapped.push(rawName);
      }
      if (unmapped.length > 0) {
        gaps.push({ source: "月末報告書", unmappedNames: Array.from(new Set(unmapped)).slice(0, 10) });
      }
    }
  } catch (err) {
    console.warn("[monthly-sync] Report check failed:", err);
  }

  // ファンくるの店舗名を確認
  try {
    const fankuruAliasMap = new Map<string, string>();
    for (const s of dbStores) {
      if (s.fankuruAliases) {
        for (const a of s.fankuruAliases.split(",").map(x => x.trim())) {
          fankuruAliasMap.set(a, s.name);
        }
      }
    }
    const resp = await fetch(FANKURU_CSV_URL);
    if (resp.ok) {
      const text = await resp.text();
      const lines = text.split("\n").filter(l => l.trim());
      const fankuruStoreNames = new Set<string>();
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        // ファンくるスプレッドシートの店舗名列（列インデックスは実データに依存）
        const rawName = cols[2]?.trim().replace(/"/g, "");
        if (rawName) fankuruStoreNames.add(rawName);
      }
      const unmapped: string[] = [];
      for (const rawName of Array.from(fankuruStoreNames)) {
        if (knownNames.has(rawName)) continue;
        if (fankuruAliasMap.has(rawName)) continue;
        unmapped.push(rawName);
      }
      if (unmapped.length > 0) {
        gaps.push({ source: "ファンくる", unmappedNames: Array.from(new Set(unmapped)).slice(0, 10) });
      }
    }
  } catch (err) {
    console.warn("[monthly-sync] Fankuru check failed:", err);
  }

  return gaps;
}

// ─── 通知フォーマット ───
function formatNotification(
  newStores: { name: string; area: string; source: string }[],
  sheetMatch: { matched: { store: string; sheetName: string }[]; unmatched: string[]; alreadyMapped: string[] },
  gaps: MappingGap[]
): { title: string; content: string } {
  const parts: string[] = [];

  // 新店舗
  if (newStores.length > 0) {
    parts.push(`🏪 新店舗検出: ${newStores.length}件`);
    for (const s of newStores) {
      parts.push(`  • ${s.name}（${s.area}）← ${s.source}`);
    }
  } else {
    parts.push("✅ 新店舗: なし");
  }

  // サロンボードマッチング
  parts.push("");
  if (sheetMatch.matched.length > 0) {
    parts.push(`📊 サロンボード自動マッチ: ${sheetMatch.matched.length}件`);
    for (const m of sheetMatch.matched) {
      parts.push(`  • ${m.store} → ${m.sheetName}`);
    }
  }
  if (sheetMatch.unmatched.length > 0) {
    parts.push(`⚠️ 未マッチシート: ${sheetMatch.unmatched.join(", ")}`);
  }

  // マッピングギャップ
  if (gaps.length > 0) {
    parts.push("");
    parts.push("🔍 マッピング未設定の店舗名:");
    for (const g of gaps) {
      parts.push(`  [${g.source}] ${g.unmappedNames.join(", ")}`);
    }
    parts.push("");
    parts.push("→ 管理画面の「店舗管理」でエイリアスを追加してください");
  } else {
    parts.push("");
    parts.push("✅ 全データソースのマッピング: 正常");
  }

  const title = newStores.length > 0 || gaps.length > 0
    ? `[monet] 月次同期: ${newStores.length}件の新店舗 / ${gaps.length}件のマッピング要確認`
    : "[monet] 月次同期: 全て正常 ✅";

  return { title, content: parts.join("\n") };
}

// ─── Express Router ───
export function registerScheduledMonthlySyncRoute(app: import("express").Express) {
  const router = Router();

  router.post("/api/scheduled/monthly-sync", async (req: Request, res: Response) => {
    try {
      // 認証チェック
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (user.role !== "user" && user.role !== "admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      console.log(`[Scheduled] monthly-sync triggered by user: ${user.name} (${user.role})`);

      // Step 1: 新店舗検出
      const newStores = await detectNewStores();

      // Step 2: サロンボードシート名マッチング
      const sheetMatch = await matchSalonBoardSheets();

      // Step 3: マッピング整合性チェック
      const gaps = await checkMappingGaps();

      // Step 4: 通知送信
      const notification = formatNotification(newStores, sheetMatch, gaps);
      const notified = await notifyOwner(notification);

      res.json({
        success: true,
        newStoresFound: newStores.length,
        newStores,
        sheetMatching: {
          matched: sheetMatch.matched,
          unmatched: sheetMatch.unmatched,
          alreadyMapped: sheetMatch.alreadyMapped.length,
        },
        mappingGaps: gaps,
        notified,
        message: notification.title,
      });
    } catch (error) {
      console.error("[Scheduled] monthly-sync error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.use(router);
}
