/**
 * 雇用形態別の最大客数マッピングと稼働率計算ユーティリティ
 *
 * 稼働率 = (実客数 / 最大客数) × 100
 * 雇用形態が不明な場合は null を返す
 */
/** 雇用形態ごとの月間最大客数（正規化済みキー） */
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
 * スプレッドシートの省略表記・表記揺れに対応するエイリアスマッピング
 * 正規化後の文字列 → 正式名称（EMPLOYMENT_MAX_CUSTOMERSのキー）
 */
const EMPLOYMENT_ALIASES: Record<string, string> = {
  // 「公休」省略パターン
  "日短社員（週休2日＋2日）": "日短社員（週休2日＋公休2日）",
  // パートのみ（週数なし）→ 判定不可のためマッチさせない
};

/**
 * 雇用形態文字列を正規化する
 * スプレッドシートの表記揺れ（全角/半角括弧・スペース・プラス記号等）に対応
 *
 * 正規化ルール:
 * 1. 前後の空白を除去
 * 2. 全角スペース→半角スペース
 * 3. 連続スペースを1つに
 * 4. 半角括弧→全角括弧
 * 5. 半角プラス→全角プラス
 * 6. 名称と括弧の間のスペースを除去（例: "時短社員 （7時間）" → "時短社員（7時間）"）
 */
export function normalizeEmploymentType(raw: string): string {
  return raw
    .trim()
    .replace(/　/g, " ")             // 全角スペース→半角
    .replace(/\s+/g, " ")           // 連続スペースを1つに
    .replace(/\(/g, "（")            // 半角括弧→全角
    .replace(/\)/g, "）")
    .replace(/\+/g, "＋")            // 半角プラス→全角
    .replace(/ （/g, "（")           // 名称と括弧の間のスペースを除去
    .replace(/ ＋/g, "＋")           // プラス前のスペースを除去
    .replace(/＋ /g, "＋");          // プラス後のスペースを除去
}

/**
 * 表記ゆれ・省略表記を吸収して、EMPLOYMENT_MAX_CUSTOMERS の正式キーに寄せる。
 * どれにも当たらなければ null（例: 週数の無い「パート」は判定不可）。
 *
 * getMaxCustomers と同じ突き合わせ順（直接→正規化→エイリアス）を1箇所に集約したもの。
 * 雇用形態でグルーピングする画面は、これを使って同じ雇用形態を1つにまとめる。
 */
export function canonicalEmploymentType(raw: string): string | null {
  if (!raw) return null;

  if (EMPLOYMENT_MAX_CUSTOMERS[raw] !== undefined) return raw;

  const normalized = normalizeEmploymentType(raw);
  for (const key of Object.keys(EMPLOYMENT_MAX_CUSTOMERS)) {
    if (normalizeEmploymentType(key) === normalized) return key;
  }

  const aliasKey = EMPLOYMENT_ALIASES[normalized];
  if (aliasKey) {
    const aliasNorm = normalizeEmploymentType(aliasKey);
    for (const key of Object.keys(EMPLOYMENT_MAX_CUSTOMERS)) {
      if (normalizeEmploymentType(key) === aliasNorm) return key;
    }
  }

  return null;
}

/**
 * 雇用形態から最大客数を取得する
 * @returns 最大客数。不明な雇用形態の場合は null
 */
export function getMaxCustomers(employmentType: string): number | null {
  // 突き合わせ（直接→正規化→エイリアス）は canonicalEmploymentType に集約。
  // 週数の無い「パート」はここで null になる（週数が分からず最大客数を決められない）。
  const canonical = canonicalEmploymentType(employmentType);
  if (canonical === null) return null;
  return EMPLOYMENT_MAX_CUSTOMERS[canonical];
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
