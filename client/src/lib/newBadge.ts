/**
 * NEW バッジ管理 — 期限ベースの動的システム
 *
 * 【ルール】
 * - 店舗: オープン日から指定の終了月末まで「NEW」を表示
 * - スタッフ: NEW店舗に所属するスタッフは、ベテランリストに含まれない限り「NEW」を表示
 * - 新店舗自動検出: 月末報告書に未知の店舗名が出た場合、初回登場月から6ヶ月間NEWを自動点灯
 * - 退社スタッフ: 退社月以降のデータを表示しない
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

// 退社スタッフ管理（ハードコードフォールバック）
// key: スタッフ名, value: 退社月 "YYYY-MM"（この月以降のデータを除外）
const RETIRED_STAFF: Record<string, { store: string; retiredMonth: string }> = {
  "Hitomi": { store: "福島院", retiredMonth: "2026-04" },
  "hitomi": { store: "福島院", retiredMonth: "2026-04" },
};

/**
 * DB連携用: 退社スタッフのステータスマップ
 * useStaffStatusフックからsetRetiredStaffMapで注入される
 * key: "staffName|storeName", value: { status, retiredMonth }
 */
type RetiredStaffEntry = { status: "active" | "retired"; retiredMonth: string | null };
let dbRetiredStaffMap: Map<string, RetiredStaffEntry> | null = null;

/**
 * DB連携: 退社スタッフマップを設定する
 * useStaffStatusフックから呼ばれる
 */
export function setRetiredStaffMap(map: Map<string, RetiredStaffEntry> | null): void {
  dbRetiredStaffMap = map;
}

/**
 * DB連携: 退社スタッフマップが設定済みかどうか
 */
export function hasRetiredStaffMap(): boolean {
  return dbRetiredStaffMap !== null && dbRetiredStaffMap.size > 0;
}

/**
 * スタッフが退社済みかどうか判定
 * DB連携マップが設定されている場合はDBデータを優先し、
 * 未設定の場合はハードコードのフォールバックを使用する。
 * @param staffName スタッフ名
 * @param storeName 店舗名（省略可）
 * @param month 対象月 "YYYY-MM"（省略時は現在月）
 * @returns 退社済みなら true
 */
export function isRetiredStaff(staffName: string, storeName?: string, month?: string): boolean {
  const targetMonth = month || getCurrentYearMonth();

  // DB連携マップが設定されている場合はDBデータを使用
  if (dbRetiredStaffMap && dbRetiredStaffMap.size > 0) {
    // 店舗名指定ありの場合: 完全一致
    if (storeName) {
      const key = `${staffName}|${storeName}`;
      const entry = dbRetiredStaffMap.get(key);
      if (entry) {
        if (entry.status !== "retired") return false;
        if (entry.retiredMonth) return targetMonth >= entry.retiredMonth;
        return true;
      }
    }

    // 名前のみで検索（大文字小文字無視）
    const nameLower = staffName.trim().toLowerCase();
    for (const [mapKey, entry] of Array.from(dbRetiredStaffMap.entries())) {
      const [mapName, mapStore] = mapKey.split("|");
      if (mapName.trim().toLowerCase() !== nameLower) continue;
      if (storeName && mapStore !== storeName) continue;
      if (entry.status !== "retired") return false;
      if (entry.retiredMonth) return targetMonth >= entry.retiredMonth;
      return true;
    }

    // DBに登録されていない = 退社ではない
    return false;
  }

  // フォールバック: ハードコードデータを使用
  const nameKey = Object.keys(RETIRED_STAFF).find(
    k => k.toLowerCase() === staffName.trim().toLowerCase()
  );
  if (!nameKey) return false;
  const info = RETIRED_STAFF[nameKey];
  if (storeName && info.store !== storeName) return false;
  return targetMonth >= info.retiredMonth;
}

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
