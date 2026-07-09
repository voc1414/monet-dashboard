/**
 * NPSアンケート等のスタッフ名を月末報告書の登録名へ名寄せするためのエイリアス層。
 *
 * 照合キー = 空白（半角/全角）除去 + 小文字化。
 * 優先順位: DB「名前マッピング」（管理者ページで登録・stylist_aliasesテーブル） > コード内蔵表。
 * （ファンくる側の照合は useFankuruData.ts が同じDBテーブルを参照する。登録は1箇所でOK）
 */

/** コード内蔵の正規化済みエイリアス → 正規化済み正準名（月末報告書の登録名ベース） */
const NPS_STAFF_ALIASES: Record<string, string> = {
  // 堀江院: NPSフォームは "akiko" 表記（林 確認 2026-07-06）
  "akiko": "小池明子",
  // 楽々園院: NPSフォームは "石原ようこ" 表記（林 確認 2026-07-06）
  "石原ようこ": "石原葉子",
};

/** DB（管理者ページ「名前マッピング」）から注入されるエイリアス。コード内蔵表より優先 */
let _dbAliasMap: Record<string, string> = {};

const normalize = (s: string) => (s || "").replace(/[\s　]/g, "").toLowerCase();

/**
 * DBの名前マッピング（stylist_aliases）を注入する。StoreDataProviderが起動時に呼ぶ。
 * alias/canonicalName とも正規化して保持する。
 */
export function setStaffAliasMapFromDb(aliases: Array<{ alias: string; canonicalName: string }>) {
  const map: Record<string, string> = {};
  for (const a of aliases) {
    if (a.alias && a.canonicalName) map[normalize(a.alias)] = normalize(a.canonicalName);
  }
  _dbAliasMap = map;
}

/**
 * スタッフ名を比較用キーに正規化する（空白除去＋小文字化＋エイリアス解決）。
 * NPSシート側・月末報告書側の両方に適用してから比較すること。
 */
export function normalizeStaffKey(name: string): string {
  const n = normalize(name);
  return _dbAliasMap[n] || NPS_STAFF_ALIASES[n] || n;
}
