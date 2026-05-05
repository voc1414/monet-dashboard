/**
 * Seed script: 既存6店舗の初期データをstoresテーブルに投入
 * 実行: node scripts/seed-stores.mjs
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const INITIAL_STORES = [
  {
    name: "堀江院",
    area: "大阪エリア",
    displayOrder: 1,
    rawNameVariants: "大阪堀江院,堀江院",
    salonBoardSheetName: "monet堀江_月別",
  },
  {
    name: "堀江院2nd",
    area: "大阪エリア",
    displayOrder: 2,
    rawNameVariants: "大阪堀江院2nd,堀江院2nd",
    salonBoardSheetName: "monet堀江ﾆ号店_月別",
  },
  {
    name: "福島院",
    area: "大阪エリア",
    displayOrder: 3,
    rawNameVariants: "大阪福島院,福島院",
    salonBoardSheetName: "monet福島院_月別",
  },
  {
    name: "高槻院",
    area: "大阪エリア",
    displayOrder: 4,
    rawNameVariants: "大阪高槻院,高槻院",
    salonBoardSheetName: "monet高槻_月別",
  },
  {
    name: "姪浜院",
    area: "福岡エリア",
    displayOrder: 1,
    rawNameVariants: "福岡姪浜院,姪浜院",
    salonBoardSheetName: "monet福岡姪浜院_月別",
  },
  {
    name: "楽々園院",
    area: "広島エリア",
    displayOrder: 1,
    rawNameVariants: "広島楽々園院,楽々園院",
    salonBoardSheetName: "monet広島_月別",
  },
];

async function main() {
  // Parse DATABASE_URL
  const url = new URL(DATABASE_URL);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: true },
  });

  console.log("Connected to database");

  for (const store of INITIAL_STORES) {
    try {
      await connection.execute(
        `INSERT INTO stores (name, area, displayOrder, rawNameVariants, salonBoardSheetName, isActive, isAutoDetected)
         VALUES (?, ?, ?, ?, ?, 1, 0)
         ON DUPLICATE KEY UPDATE
           area = VALUES(area),
           displayOrder = VALUES(displayOrder),
           rawNameVariants = VALUES(rawNameVariants),
           salonBoardSheetName = VALUES(salonBoardSheetName)`,
        [store.name, store.area, store.displayOrder, store.rawNameVariants, store.salonBoardSheetName]
      );
      console.log(`✓ ${store.name} (${store.area})`);
    } catch (err) {
      console.error(`✗ ${store.name}: ${err.message}`);
    }
  }

  // Verify
  const [rows] = await connection.execute("SELECT id, name, area, displayOrder FROM stores ORDER BY area, displayOrder");
  console.log("\n=== 登録済み店舗一覧 ===");
  for (const row of rows) {
    console.log(`  [${row.id}] ${row.name} — ${row.area} (order: ${row.displayOrder})`);
  }

  await connection.end();
  console.log("\nDone!");
}

main().catch(console.error);
