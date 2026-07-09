/**
 * NPSアンケート等のスタッフ名を月末報告書の登録名へ名寄せするためのエイリアス層。
 *
 * 照合キー = 空白（半角/全角）除去 + 小文字化。
 * NPSフォームの選択肢表記が月末報告書の登録名と異なるスタッフをここに登録する。
 * （ファンくる側は useFankuruData.ts の STYLIST_NAME_ALIASES が担当。役割が違うので統合しない）
 */

/** 正規化済みエイリアス → 正規化済み正準名（月末報告書の登録名ベース） */
const NPS_STAFF_ALIASES: Record<string, string> = {
  // 堀江院: NPSフォームは "akiko" 表記（林 確認 2026-07-06）
  "akiko": "小池明子",
  // 楽々園院: NPSフォームは "石原ようこ" 表記（林 確認 2026-07-06）
  "石原ようこ": "石原葉子",
};

/**
 * スタッフ名を比較用キーに正規化する（空白除去＋小文字化＋エイリアス解決）。
 * NPSシート側・月末報告書側の両方に適用してから比較すること。
 */
export function normalizeStaffKey(name: string): string {
  const n = (name || "").replace(/[\s　]/g, "").toLowerCase();
  return NPS_STAFF_ALIASES[n] || n;
}
