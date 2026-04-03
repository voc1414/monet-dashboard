/**
 * NEW バッジ管理 — 期限ベースの動的システム
 *
 * 【ルール】
 * - 店舗: オープン日から指定の終了月末まで「NEW」を表示
 * - スタッフ: NEW店舗に所属するスタッフは、ベテランリストに含まれない限り「NEW」を表示
 * - 新店舗自動検出: 月末報告書に未知の店舗名が出た場合、初回登場月から6ヶ月間NEWを自動点灯
 *
 * 【既知の店舗NEW期限】
 * - 高槻院: 2026年8月末まで
 * - 福島院: 2026年8月末まで
 * - 堀江院2nd: 2026年5月末まで
 */

// 店舗ごとのNEW終了月（この月の末日まで表示）
// 形式: "YYYY-MM" → その月末まで NEW を表示
const STORE_NEW_EXPIRY: Record<string, string> = {
  "高槻院": "2026-08",
  "福島院": "2026-08",
  "堀江院2nd": "2026-05",
};

// 入社6ヶ月以内ではない（＝NEWではない）スタッフ（店舗ごと）
// これらのスタッフ以外がNEW扱い
const VETERAN_STAFF: Record<string, Set<string>> = {
  "福島院": new Set(["YU", "Yu", "yu"]),
  "高槻院": new Set(["NAO", "Nao", "nao"]),
};

// 既知の店舗一覧（これに含まれない店舗が月末報告書に出たら「新店舗」扱い）
const KNOWN_STORES = new Set([
  "堀江院",
  "堀江院2nd",
  "姪浜院",
  "楽々園院",
  "福島院",
  "高槻院",
]);

// 動的に検出された新店舗のキャッシュ
// key: 店舗名, value: 初回検出月 "YYYY-MM"
const dynamicNewStores = new Map<string, string>();

/**
 * 現在の年月を "YYYY-MM" 形式で取得
 */
function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 指定月から N ヶ月後の "YYYY-MM" を計算
 */
function addMonths(yearMonth: string, months: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 店舗が NEW かどうか判定
 * - STORE_NEW_EXPIRY に登録されている場合: 期限内なら true
 * - 動的検出された新店舗: 初回検出月から6ヶ月間 true
 */
export function isNewStore(storeName: string): boolean {
  const current = getCurrentYearMonth();

  // 1. 手動登録された期限チェック
  const expiry = STORE_NEW_EXPIRY[storeName];
  if (expiry) {
    return current <= expiry;
  }

  // 2. 動的検出された新店舗チェック
  const firstSeen = dynamicNewStores.get(storeName);
  if (firstSeen) {
    const dynamicExpiry = addMonths(firstSeen, 6);
    return current <= dynamicExpiry;
  }

  return false;
}

/**
 * スタッフが NEW かどうか判定
 * - NEW店舗に所属 かつ ベテランリストに含まれない場合 true
 */
export function isNewStaff(staffName: string, storeName: string): boolean {
  // まず店舗がNEWかチェック
  if (!isNewStore(storeName)) return false;

  // ベテランリストに含まれていればNEWではない
  const veterans = VETERAN_STAFF[storeName];
  if (!veterans) return true; // ベテランリストがない＝全員NEW

  const nameUpper = staffName.trim().toUpperCase();
  let isVeteran = false;
  veterans.forEach((v) => {
    if (v.toUpperCase() === nameUpper) isVeteran = true;
  });
  return !isVeteran;
}

/**
 * 月末報告書のデータから未知の店舗を検出し、動的にNEW登録する
 * useMonthlyReport から呼ばれる
 */
export function registerNewStoresFromReports(storeNames: string[]): void {
  const current = getCurrentYearMonth();
  for (const name of storeNames) {
    if (!name) continue;
    // 既知の店舗でもなく、手動登録もなく、まだ動的登録もされていない場合
    if (!KNOWN_STORES.has(name) && !STORE_NEW_EXPIRY[name] && !dynamicNewStores.has(name)) {
      dynamicNewStores.set(name, current);
      console.log(`[newBadge] 新店舗を自動検出: ${name} (${current}から6ヶ月間NEW)`);
    }
  }
}

/**
 * 動的に検出された新店舗の一覧を取得（デバッグ用）
 */
export function getDynamicNewStores(): Map<string, string> {
  return new Map(dynamicNewStores);
}
