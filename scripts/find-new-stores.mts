/**
 * 月末報告書スプレッドシートから、店舗マスタに無い店舗のデータを抽出して表示する（手動実行の調査用）。
 *
 *   npx tsx scripts/find-new-stores.mts
 *
 * 列は設問名から実行時に解決する（@/lib/reportColumns）。
 * 2026-09-12 まで .mjs で列番号（2 / 6 / 7 / …）を直書きしていた。設問が1つ増えて列が
 * ズレると、店舗名のつもりで別の設問の自由記述を読み、実在しない店舗を「新店舗」として
 * 報告してしまう。同じ CSV を読む server/routers/scheduledNewStore.ts と判定を揃える。
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { cellOf, resolveReportColumns } from "@/lib/reportColumns";

const SPREADSHEET_ID = "1DXAaFk0aLDZwXq28krOcrDSiTOwd6BeTzV-xFXbLuKI";
const GID = "505478524";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID}`;

const KNOWN_STORES = new Set([
  "堀江院", "堀江院2nd", "姪浜院", "楽々園院", "福島院", "高槻院",
]);

// 月末報告書の正規化マッピング
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

// CSVパース
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

function toInt(v: string): number {
  return parseInt(v.replace(/[^0-9]/g, "")) || 0;
}

interface UnknownStoreRow {
  rawStore: string;
  normalized: string;
  name: string;
  answerDate: string;
  employmentType: string;
  techSales: number;
  retailSales: number;
  newCustomers: number;
  returnCustomers: number;
  nextReservation: string;
}

async function main() {
  console.log("スプレッドシートからデータ取得中...");
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.split("\n").filter(l => l.trim());
  const rows = lines.map(parseCSVLine);
  const header = rows[0] ?? [];
  const dataRows = rows.slice(1);

  // 必須列が1つでも決まらないときは、店舗名を読み違えたまま報告しないよう中止する
  const col = resolveReportColumns(header, dataRows);
  for (const issue of col.issues) {
    console.log(`  [${issue.severity}] ${issue.message}`);
  }
  if (!col.ok) {
    throw new Error("月末報告書の列を特定できないため中止しました（上の error を参照）");
  }

  console.log(`全${dataRows.length}行のデータを解析中...\n`);

  // 全店舗名を収集
  const allStoreNames = new Set<string>();
  const unknownStoreRows: UnknownStoreRow[] = [];

  for (const cols of dataRows) {
    const rawStore = cellOf(cols, col.index, "store").trim();
    if (!rawStore) continue;

    const normalized = normalizeStoreName(rawStore);
    allStoreNames.add(normalized);

    if (!KNOWN_STORES.has(normalized)) {
      unknownStoreRows.push({
        rawStore,
        normalized,
        name: cellOf(cols, col.index, "name").trim(),
        answerDate: cellOf(cols, col.index, "answerDate").trim(),
        employmentType: cellOf(cols, col.index, "employmentType").trim(),
        techSales: toInt(cellOf(cols, col.index, "techSales")),
        retailSales: toInt(cellOf(cols, col.index, "retailSales")),
        newCustomers: toInt(cellOf(cols, col.index, "newCustomers")),
        returnCustomers: toInt(cellOf(cols, col.index, "returnCustomers")),
        nextReservation: cellOf(cols, col.index, "nextReservation").trim(),
      });
    }
  }

  console.log("=== 全店舗名一覧 ===");
  for (const name of [...allStoreNames].sort()) {
    const marker = KNOWN_STORES.has(name) ? "  [既知]" : "  [★新店舗]";
    console.log(`  ${name}${marker}`);
  }

  if (unknownStoreRows.length === 0) {
    console.log("\n既知6店舗以外のデータは見つかりませんでした。");

    // サロンボードも確認
    console.log("\n--- サロンボードデータも確認します ---");
    await checkSalonBoard();
    return;
  }

  console.log(`\n=== 新店舗データ（${unknownStoreRows.length}行） ===\n`);

  // 店舗ごとに集計
  const storeAgg: Record<string, {
    rawNames: Set<string>;
    staffNames: Set<string>;
    rows: UnknownStoreRow[];
    totalTechSales: number;
    totalRetailSales: number;
    totalNewCustomers: number;
    totalReturnCustomers: number;
    nextReservationValues: number[];
  }> = {};
  for (const row of unknownStoreRows) {
    if (!storeAgg[row.normalized]) {
      storeAgg[row.normalized] = {
        rawNames: new Set(),
        staffNames: new Set(),
        rows: [],
        totalTechSales: 0,
        totalRetailSales: 0,
        totalNewCustomers: 0,
        totalReturnCustomers: 0,
        nextReservationValues: [],
      };
    }
    const agg = storeAgg[row.normalized];
    agg.rawNames.add(row.rawStore);
    agg.staffNames.add(row.name);
    agg.rows.push(row);
    agg.totalTechSales += row.techSales;
    agg.totalRetailSales += row.retailSales;
    agg.totalNewCustomers += row.newCustomers;
    agg.totalReturnCustomers += row.returnCustomers;
    if (row.nextReservation) {
      // パーセント値を抽出
      const pctMatch = row.nextReservation.match(/(\d+\.?\d*)/);
      if (pctMatch) agg.nextReservationValues.push(parseFloat(pctMatch[1]));
    }
  }

  for (const [storeName, agg] of Object.entries(storeAgg)) {
    const totalSales = agg.totalTechSales + agg.totalRetailSales;
    const totalCustomers = agg.totalNewCustomers + agg.totalReturnCustomers;
    const avgNextRes = agg.nextReservationValues.length > 0
      ? (agg.nextReservationValues.reduce((a, b) => a + b, 0) / agg.nextReservationValues.length).toFixed(1)
      : "N/A";

    console.log(`■ ${storeName}`);
    console.log(`  生データ表記: ${[...agg.rawNames].join(", ")}`);
    console.log(`  スタッフ: ${[...agg.staffNames].join(", ")}`);
    console.log(`  データ行数: ${agg.rows.length}`);
    console.log(`  総売上: ¥${totalSales.toLocaleString()} (技術: ¥${agg.totalTechSales.toLocaleString()} / 店販: ¥${agg.totalRetailSales.toLocaleString()})`);
    console.log(`  総客数: ${totalCustomers} (新規: ${agg.totalNewCustomers} / リピート: ${agg.totalReturnCustomers})`);
    console.log(`  次回予約率(平均): ${avgNextRes}%`);
    console.log(`  回答日: ${agg.rows.map(r => r.answerDate.split(" ")[0]).join(", ")}`);
    console.log("");
  }

  // サロンボードも確認
  await checkSalonBoard();
}

async function checkSalonBoard() {
  // サロンボードのスプレッドシートも確認
  // useSalonBoardData.tsから取得
  const SB_SPREADSHEET_ID = getSalonBoardSpreadsheetId();
  if (!SB_SPREADSHEET_ID) {
    console.log("サロンボードスプレッドシートIDを取得できませんでした");
    return;
  }

  console.log(`\nサロンボードスプレッドシート(${SB_SPREADSHEET_ID})のシート一覧を確認...\n`);

  // HTMLからシート一覧を取得
  try {
    const htmlRes = await fetch(`https://docs.google.com/spreadsheets/d/${SB_SPREADSHEET_ID}/edit`);
    const html = await htmlRes.text();
    // シート名を抽出
    const sheetMatches = html.matchAll(/"sheet_name":"([^"]+)"/g);
    const sheets: string[] = [];
    for (const m of sheetMatches) {
      sheets.push(m[1]);
    }
    if (sheets.length > 0) {
      console.log("サロンボードシート一覧:");
      for (const s of sheets) {
        console.log(`  - ${s}`);
      }
    } else {
      // 別の方法で取得
      const gidMatches = html.matchAll(/gid=(\d+)[^>]*>([^<]+)</g);
      for (const m of gidMatches) {
        console.log(`  - ${m[2]} (gid=${m[1]})`);
      }
    }
  } catch (e) {
    console.log("サロンボードシート一覧の取得に失敗:", (e as Error).message);
  }
}

function getSalonBoardSpreadsheetId(): string | null {
  // useSalonBoardData.ts からスプレッドシートIDを読み取る。
  // 2026-09-12 まで /home/ubuntu/monet-dashboard/... を直書きしており、この関数は
  // 手元では必ず失敗していた。リポジトリ内の相対パスで引く。
  const path = resolve(import.meta.dirname, "../client/src/hooks/useSalonBoardData.ts");
  const content = readFileSync(path, "utf-8");
  const match = content.match(/SPREADSHEET_ID\s*=\s*["']([^"']+)["']/);
  return match ? match[1] : null;
}

main().catch(console.error);
