/**
 * 雇用形態別の最大客数マッピングと稼働率計算ユーティリティ
 *
 * 稼働率 = (実客数 / 最大客数) × 100
 * 雇用形態が不明な場合は null を返す
 */
/** 雇用形態ごとの月間最大客数 */
export const EMPLOYMENT_MAX_CUSTOMERS: Record<string, number> = {
  "フルタイム社員": 66,
  "時短社員（6時間）": 44,
  "時短社員（7時間）": 60,
  "日短社員（週休3日）": 54,
  "日短社員（週休2日＋公休2日）": 60,
  "パート 週1前後": 8,
  "パート 週2前後": 16,
  "パート 週3前後": 24,
};
/**
 * スプレッドシートの省略表記に対応するエイリアスマッピング
 * 正規化後の文字列 → 正式名称
 */
const EMPLOYMENT_ALIASES: Record<string, string> = {
  "日短社員（週休2日＋2日）": "日短社員（週休2日＋公休2日）",
  "日短社員 （週休2日＋2日）": "日短社員（週休2日＋公休2日）",
};
/**
 * 雇用形態文字列を正規化して最大客数を取得する
 * スプレッドシートの表記揺れ（全角/半角スペース、括弧の違い等）に対応
 */
function normalizeEmploymentType(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")           // 連続スペースを1つに
    .replace(/　/g, " ")             // 全角スペース→半角
    .replace(/\(/g, "（")            // 半角括弧→全角
    .replace(/\)/g, "）")
    .replace(/\+/g, "＋");           // 半角プラス→全角
}
/**
 * 雇用形態から最大客数を取得する
 * @returns 最大客数。不明な雇用形態の場合は null
 */
export function getMaxCustomers(employmentType: string): number | null {
  // まず直接マッチ
  const direct = EMPLOYMENT_MAX_CUSTOMERS[employmentType];
  if (direct !== undefined) return direct;
  // 正規化してマッチ
  const normalized = normalizeEmploymentType(employmentType);
  for (const [key, value] of Object.entries(EMPLOYMENT_MAX_CUSTOMERS)) {
    if (normalizeEmploymentType(key) === normalized) {
      return value;
    }
  }
  // エイリアスマッチ（省略表記対応）
  const aliasKey = EMPLOYMENT_ALIASES[normalized];
  if (aliasKey) {
    const aliasNorm = normalizeEmploymentType(aliasKey);
    for (const [key, value] of Object.entries(EMPLOYMENT_MAX_CUSTOMERS)) {
      if (normalizeEmploymentType(key) === aliasNorm) {
        return value;
      }
    }
  }
  // 部分マッチは行わない。「パート」のみの場合は週数が不明のためnullを返す
  return null;
}
/**
 * 稼働率を計算する
 * @param totalCustomers 実客数（新規 + リピーター）
 * @param employmentType 雇用形態
 * @returns 稼働率（%）。雇用形態が不明または最大客数が0の場合は null
 */
export function calculateUtilizationRate(
  totalCustomers: number,
  employmentType: string
): number | null {
  const maxCustomers = getMaxCustomers(employmentType);
  if (maxCustomers === null || maxCustomers === 0) return null;
  return Math.round((totalCustomers / maxCustomers) * 1000) / 10; // 小数点1桁
}
/**
 * 稼働率に応じた色クラスを返す
 * - 95%以上: 緑（エクセレント！）
 * - 90〜94%: 黄（適正）
 * - 89%以下: 赤（要改善）
 */
export function getUtilizationColor(rate: number): string {
  if (rate >= 95) return "text-[#2D9C8F]";
  if (rate >= 90) return "text-[#E5B85C]";
  return "text-[#C75C5C]";
}
/**
 * 稼働率に応じたラベルを返す
 * - 95%以上: エクセレント！
 * - 90〜94%: 適正
 * - 89%以下: 要改善
 */
export function getUtilizationLabel(rate: number): string {
  if (rate >= 95) return "エクセレント！";
  if (rate >= 90) return "適正";
  return "要改善";
}
