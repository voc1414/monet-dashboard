/**
 * スプレッドシートから既知6店舗以外のデータを抽出する
 */

const SPREADSHEET_ID = "1DXAaFk0aLDZwXq28krOcrDSiTOwd6BeTzV-xFXbLuKI";
const GID = "505478524";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID}`;

const KNOWN_STORES = new Set([
  "堀江院", "堀江院2nd", "姪浜院", "楽々園院", "福島院", "高槻院",
]);

// 月末報告書の正規化マッピング
const STORE_NAME_MAP = {
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

function normalizeStoreName(raw) {
  const trimmed = raw.trim();
  return STORE_NAME_MAP[trimmed] || trimmed;
}

// CSVパース
function parseCSVLine(line) {
  const result = [];
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

// COL indexes
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

async function main() {
  console.log("スプレッドシートからデータ取得中...");
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.split("\n").filter(l => l.trim());
  const dataLines = lines.slice(1); // ヘッダースキップ

  console.log(`全${dataLines.length}行のデータを解析中...\n`);

  // 全店舗名を収集
  const allStoreNames = new Set();
  const unknownStoreRows = [];

  for (const line of dataLines) {
    const cols = parseCSVLine(line);
    const rawStore = (cols[COL.STORE] || "").trim();
    if (!rawStore) continue;

    const normalized = normalizeStoreName(rawStore);
    allStoreNames.add(normalized);

    if (!KNOWN_STORES.has(normalized)) {
      unknownStoreRows.push({
        rawStore,
        normalized,
        name: (cols[COL.NAME] || "").trim(),
        answerDate: (cols[COL.ANSWER_DATE] || "").trim(),
        employmentType: (cols[COL.EMPLOYMENT_TYPE] || "").trim(),
        techSales: parseInt((cols[COL.TECH_SALES] || "0").replace(/[^0-9]/g, "")) || 0,
        retailSales: parseInt((cols[COL.RETAIL_SALES] || "0").replace(/[^0-9]/g, "")) || 0,
        newCustomers: parseInt((cols[COL.NEW_CUSTOMERS] || "0").replace(/[^0-9]/g, "")) || 0,
        returnCustomers: parseInt((cols[COL.RETURN_CUSTOMERS] || "0").replace(/[^0-9]/g, "")) || 0,
        nextReservation: (cols[COL.NEXT_RESERVATION] || "").trim(),
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
  const storeAgg = {};
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
  const SB_SPREADSHEET_ID = await getSalonBoardSpreadsheetId();
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
    const sheetMatches = html.matchAll(/\"sheet_name\":\"([^\"]+)\"/g);
    const sheets = [];
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
    console.log("サロンボードシート一覧の取得に失敗:", e.message);
  }
}

async function getSalonBoardSpreadsheetId() {
  // useSalonBoardData.tsからスプレッドシートIDを読み取る
  const fs = await import("fs");
  const content = fs.readFileSync("/home/ubuntu/monet-dashboard/client/src/hooks/useSalonBoardData.ts", "utf-8");
  const match = content.match(/SPREADSHEET_ID\s*=\s*["']([^"']+)["']/);
  return match ? match[1] : null;
}

main().catch(console.error);
