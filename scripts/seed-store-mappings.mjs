/**
 * Seed store mappings into the stores table.
 * Updates existing stores with npsAlias, reportAliases, fankuruAliases, knownSince.
 */
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(DATABASE_URL);

const mappings = [
  {
    name: "堀江院",
    npsAlias: "堀江院",
    reportAliases: "大阪堀江院,堀江院",
    fankuruAliases: "大阪堀江院,大阪|堀江院,堀江院",
    knownSince: "2020-01-01",
  },
  {
    name: "堀江院2nd",
    npsAlias: "堀江院2nd",
    reportAliases: "大阪堀江院2nd,堀江院2nd",
    fankuruAliases: "大阪堀江院2nd,堀江院2nd",
    knownSince: "2020-01-01",
  },
  {
    name: "福島院",
    npsAlias: "福島院",
    reportAliases: "大阪福島院,福島院",
    fankuruAliases: "大阪福島院,福島院",
    knownSince: "2020-01-01",
  },
  {
    name: "高槻院",
    npsAlias: "高槻院",
    reportAliases: "大阪高槻院,高槻院",
    fankuruAliases: "大阪高槻院,高槻院",
    knownSince: "2020-01-01",
  },
  {
    name: "姪浜院",
    npsAlias: "姪浜院",
    reportAliases: "福岡姪浜院,姪浜院",
    fankuruAliases: "福岡姪浜院,福岡経浜院,姪浜院",
    knownSince: "2020-01-01",
  },
  {
    name: "楽々園院",
    npsAlias: "楽々園院",
    reportAliases: "広島楽々園院,楽々園院",
    fankuruAliases: "広島楽々園院,楽々園院",
    knownSince: "2020-01-01",
  },
  {
    name: "広島土橋院",
    npsAlias: "広島土橋院",
    reportAliases: "広島土橋院,土橋院",
    fankuruAliases: "広島土橋院,土橋院",
    knownSince: "2026-05-01",
  },
];

for (const m of mappings) {
  const [result] = await conn.execute(
    `UPDATE stores SET npsAlias = ?, reportAliases = ?, fankuruAliases = ?, knownSince = ?, updatedAt = NOW() WHERE name = ?`,
    [m.npsAlias, m.reportAliases, m.fankuruAliases, m.knownSince, m.name]
  );
  console.log(`Updated ${m.name}: affectedRows=${result.affectedRows}`);
}

await conn.end();
console.log("Done!");
