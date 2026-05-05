/**
 * 認証をバイパスしてnew-store-checkの処理を直接実行するスクリプト
 */
import 'dotenv/config';

// DATABASE_URLを環境変数から取得
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// ─── 月末報告書スプレッドシート ───
const SPREADSHEET_ID = "1DXAaFk0aLDZwXq28krOcrDSiTOwd6BeTzV-xFXbLuKI";
const GID = "505478524";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID}`;

// ─── サロンボードスプレッドシート ───
const SALONBOARD_SPREADSHEET_ID = "1pYQcY42rUS3ftfIkZxffCsy7zfW2hW7U_zxtXf5A5bI";
const SALONBOARD_HTMLVIEW_URL = `https://docs.google.com/spreadsheets/d/${SALONBOARD_SPREADSHEET_ID}/htmlview`;

// エリア自動判定ルール
const AREA_KEYWORDS = [
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

function detectArea(storeName) {
  for (const { keyword, area } of AREA_KEYWORDS) {
    if (storeName.includes(keyword)) return area;
  }
  return "未分類エリア";
}

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
      } else if (ch === ',') {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

// DB接続（mysql2直接使用）
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(DATABASE_URL);

async function getAllStoresFromDB() {
  const [rows] = await connection.execute('SELECT * FROM stores');
  return rows;
}

async function insertStoreIntoDB(store) {
  await connection.execute(
    'INSERT INTO stores (name, area, salonBoardSheetName, rawNameVariants, isAutoDetected, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, NOW(), NOW())',
    [store.name, store.area, store.salonBoardSheetName || null, store.rawNameVariants || null]
  );
  console.log(`  ✅ DB INSERT: ${store.name} (${store.area})`);
}

async function updateStoreSalonBoardSheetInDB(storeName, sheetName) {
  await connection.execute(
    'UPDATE stores SET salonBoardSheetName = ?, updatedAt = NOW() WHERE name = ?',
    [sheetName, storeName]
  );
  console.log(`  ✅ DB UPDATE: ${storeName} → シート名: ${sheetName}`);
}

// ─── Step 1: 新店舗検出 ───
async function detectNewStores() {
  console.log("\n=== Step 1: 新店舗検出 ===");
  
  const stores = await getAllStoresFromDB();
  const knownNames = new Set(stores.map(s => s.name));
  // reportNameAliasesからも既知名を追加
  for (const s of stores) {
    if (s.report_name_aliases) {
      const aliases = s.report_name_aliases.split(',').map(a => a.trim());
      aliases.forEach(a => knownNames.add(a));
    }
  }
  
  console.log(`  既知店舗: ${Array.from(knownNames).join(', ')}`);

  // CSVダウンロード
  const res = await fetch(CSV_URL);
  const csv = await res.text();
  const lines = csv.split('\n').filter(l => l.trim());
  
  if (lines.length < 2) {
    console.log("  CSVデータなし");
    return [];
  }

  // ヘッダー解析
  const headers = parseCSVLine(lines[0]);
  const storeIdx = headers.findIndex(h => h.includes("店舗"));
  const salesIdx = headers.findIndex(h => h.includes("総売上") || h.includes("売上"));
  const custIdx = headers.findIndex(h => h.includes("総客数") || h.includes("客数"));
  const nextResIdx = headers.findIndex(h => h.includes("次回予約率"));

  // 新店舗を検出
  const newStoreMap = new Map();
  
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const storeName = cols[storeIdx]?.trim();
    if (!storeName) continue;
    
    // 既知店舗に含まれるかチェック
    let isKnown = false;
    for (const known of knownNames) {
      if (storeName === known || storeName.includes(known) || known.includes(storeName)) {
        isKnown = true;
        break;
      }
    }
    
    if (!isKnown && !newStoreMap.has(storeName)) {
      const sales = parseInt((cols[salesIdx] || "0").replace(/[¥,]/g, "")) || 0;
      const customers = parseInt((cols[custIdx] || "0").replace(/[,]/g, "")) || 0;
      const nextRes = parseFloat((cols[nextResIdx] || "0").replace(/%/g, "")) || 0;
      
      newStoreMap.set(storeName, {
        name: storeName,
        area: detectArea(storeName),
        sales,
        customers,
        nextReservationRate: nextRes,
      });
    }
  }

  const newStores = Array.from(newStoreMap.values());
  
  if (newStores.length === 0) {
    console.log("  新店舗なし");
  } else {
    console.log(`  🆕 新店舗 ${newStores.length}件検出:`);
    for (const s of newStores) {
      console.log(`    - ${s.name} (${s.area}) 売上:¥${s.sales.toLocaleString()} 客数:${s.customers} 次回予約率:${s.nextReservationRate}%`);
      // DBに登録
      await insertStoreIntoDB({ name: s.name, area: s.area });
    }
  }

  return newStores;
}

// ─── Step 2: サロンボードシート名マッチング ───
async function matchSalonBoardSheets() {
  console.log("\n=== Step 2: サロンボードシート名マッチング ===");
  
  // htmlviewからシート名取得
  const res = await fetch(SALONBOARD_HTMLVIEW_URL);
  const html = await res.text();
  
  const sheetPattern = /monet[^"'<>\s]+_月別/g;
  const sheetNames = [...new Set(html.match(sheetPattern) || [])];
  console.log(`  シート名取得: ${sheetNames.join(', ')}`);

  // DBから未マッピング店舗を取得
  const stores = await getAllStoresFromDB();
  const unmapped = stores.filter(s => !s.salonBoardSheetName);
  
  if (unmapped.length === 0) {
    console.log("  全店舗マッピング済み");
    return { matched: [], unmatched: [] };
  }

  console.log(`  未マッピング店舗: ${unmapped.map(s => s.name).join(', ')}`);

  const matched = [];
  const unmatched = [];

  for (const store of unmapped) {
    // 店舗名からキーワードを抽出してシート名と照合
    const storeKeywords = store.name.replace(/院$/, '').replace(/エリア$/, '');
    let foundSheet = null;

    for (const sheet of sheetNames) {
      const sheetKeyword = sheet.replace(/^monet/, '').replace(/_月別$/, '').replace(/ﾆ号店/, '2nd');
      if (storeKeywords.includes(sheetKeyword) || sheetKeyword.includes(storeKeywords)) {
        foundSheet = sheet;
        break;
      }
    }

    if (foundSheet) {
      matched.push({ store: store.name, sheet: foundSheet });
      await updateStoreSalonBoardSheetInDB(store.name, foundSheet);
    } else {
      unmatched.push(store.name);
    }
  }

  if (matched.length > 0) {
    console.log(`  ✅ マッチ成功: ${matched.map(m => `${m.store} → ${m.sheet}`).join(', ')}`);
  }
  if (unmatched.length > 0) {
    console.log(`  ⚠️ マッチ失敗（手動対応必要）: ${unmatched.join(', ')}`);
  }

  return { matched, unmatched };
}

// ─── 実行 ───
console.log("🚀 新店舗検出 + サロンボードシート名マッチング 実行開始");
console.log(`  実行日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);

try {
  const newStores = await detectNewStores();
  const sheetMatch = await matchSalonBoardSheets();
  
  console.log("\n=== 実行結果サマリー ===");
  console.log(`  新店舗: ${newStores.length}件`);
  if (newStores.length > 0) {
    for (const s of newStores) {
      console.log(`    🆕 ${s.name} (${s.area}) - 売上:¥${s.sales.toLocaleString()} 客数:${s.customers} 次回予約率:${s.nextReservationRate}%`);
    }
  }
  console.log(`  シート名マッチ成功: ${sheetMatch.matched.length}件`);
  console.log(`  シート名マッチ失敗: ${sheetMatch.unmatched.length}件`);
  if (sheetMatch.unmatched.length > 0) {
    console.log(`    ⚠️ 手動対応必要: ${sheetMatch.unmatched.join(', ')}`);
  }
  
  console.log("\n✅ 完了");
} catch (err) {
  console.error("❌ エラー:", err.message);
} finally {
  await connection.end();
}
