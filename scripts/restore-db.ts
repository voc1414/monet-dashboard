/**
 * DB復元スクリプト — Railwayトライアル失効でDBが消失した際の完全復旧用（2026-07-11）。
 *
 * 実行: DATABASE_URL=... npx tsx scripts/restore-db.ts
 * 前提: drizzle-kit migrate 済み（テーブルが存在すること）
 * 冪等: 既存行があればスキップする（上書きしない）
 *
 * データの出所: 旧本番DBの内容（2026-07-09 に tRPC API から取得したスナップショット）。
 * stylist_aliases は旧DBでは空（名寄せはコード内蔵表で運用）。
 */
import { drizzle } from "drizzle-orm/mysql2";
import { stores, staffStatus } from "../drizzle/schema";

const STORES = [
  { name: "堀江院",   area: "大阪エリア", displayOrder: 1, salonBoardSheetName: null, npsAlias: "堀江院",   reportAliases: "堀江院",   fankuruAliases: "堀江院",   knownSince: "2020-01-01", isAutoDetected: false, rawNameVariants: "堀江院" },
  { name: "堀江院2nd", area: "大阪エリア", displayOrder: 2, salonBoardSheetName: null, npsAlias: "堀江院2nd", reportAliases: "堀江院2nd", fankuruAliases: "堀江院2nd", knownSince: "2020-01-01", isAutoDetected: false, rawNameVariants: "堀江院2nd" },
  { name: "福島院",   area: "大阪エリア", displayOrder: 3, salonBoardSheetName: null, npsAlias: "福島院",   reportAliases: "福島院",   fankuruAliases: "福島院",   knownSince: "2020-01-01", isAutoDetected: false, rawNameVariants: "福島院" },
  { name: "高槻院",   area: "大阪エリア", displayOrder: 4, salonBoardSheetName: null, npsAlias: "高槻院",   reportAliases: "高槻院",   fankuruAliases: "高槻院",   knownSince: "2020-01-01", isAutoDetected: false, rawNameVariants: "高槻院" },
  { name: "姪浜院",   area: "福岡エリア", displayOrder: 5, salonBoardSheetName: null, npsAlias: "姪浜院",   reportAliases: "姪浜院",   fankuruAliases: "姪浜院",   knownSince: "2020-01-01", isAutoDetected: false, rawNameVariants: "姪浜院" },
  { name: "楽々園院", area: "広島エリア", displayOrder: 6, salonBoardSheetName: null, npsAlias: "楽々園院", reportAliases: "楽々園院", fankuruAliases: "楽々園院", knownSince: "2020-01-01", isAutoDetected: false, rawNameVariants: "楽々園院" },
  { name: "土橋院",   area: "広島エリア", displayOrder: 7, salonBoardSheetName: null, npsAlias: "土橋院",   reportAliases: "土橋院",   fankuruAliases: "土橋院",   knownSince: "2026-04-01", isAutoDetected: false, rawNameVariants: "土橋院" },
];

const STAFF_STATUS: Array<{ staffName: string; storeName: string; status: "active" | "retired"; retiredMonth: string | null }> = [
  { staffName: "Kazumi",   storeName: "堀江院2nd", status: "retired", retiredMonth: "2026-02" },
  { staffName: "佐々木 淳", storeName: "土橋院",    status: "retired", retiredMonth: "2026-07" },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL を指定してください");
  const db = drizzle(url);

  const existingStores = await db.select().from(stores);
  if (existingStores.length === 0) {
    await db.insert(stores).values(STORES as (typeof stores.$inferInsert)[]);
    console.log(`stores: ${STORES.length}件 復元`);
  } else {
    console.log(`stores: 既存${existingStores.length}件 → スキップ`);
  }

  const existingStatus = await db.select().from(staffStatus);
  if (existingStatus.length === 0) {
    await db.insert(staffStatus).values(STAFF_STATUS);
    console.log(`staff_status: ${STAFF_STATUS.length}件 復元`);
  } else {
    console.log(`staff_status: 既存${existingStatus.length}件 → スキップ`);
  }

  console.log("復元完了");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
