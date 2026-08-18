/**
 * NEW バッジ管理 — 初登場月ベースの動的システム
 *
 * 【ルール】
 * - 店舗: DB knownSince から6ヶ月以内なら「NEW」を表示（useStores.isNewStore で管理）
 * - スタッフ: 月末報告書データでの「初登場月」から3ヶ月以内なら「NEW」を表示
 * - 退社スタッフ: 退社月以降のデータを表示しない
 *
 * 【初登場月の検出方法】
 * - useMonthlyReport の rawData から、各スタッフの最も古い reportMonth を「初登場月」とする
 * - 初登場月から3ヶ月以内（当月含む）なら NEW バッジを表示
 * - 例: 初登場月が 2026-04 → 2026-04, 2026-05, 2026-06 まで NEW
 */

import { normalizeStaffKey as aliasStaffKey } from "@/lib/staffNameAlias";

// 退社スタッフ管理（ハードコードフォールバック）
// key: スタッフ名, value: 退社月 "YYYY-MM"（この月以降のデータを除外）
const RETIRED_STAFF: Record<string, { store: string; retiredMonth: string }> = {
  // 出典: Notion「全スタッフ一覧」の退職者 × サロンボード stylist_flat の最終稼働月（2026-08-18 突合）。
  // key はデータ側の表示名。照合は aliasStaffKey（空白除去+小文字化）なので大小文字違いの別キーは不要。
  "Hitomi": { store: "福島院", retiredMonth: "2026-04" },    // 尾﨑仁美
  "Kazumi": { store: "堀江院2nd", retiredMonth: "2026-03" },  // 三宅和美（実績最終月に合わせ 2026-02 から訂正）
  "Aki": { store: "堀江院2nd", retiredMonth: "2026-04" },     // 池内亜希子（従来この表から欠落）
  "Hiromi": { store: "堀江院2nd", retiredMonth: "2026-07" },  // 満川宏美（従来この表から欠落）
};

/**
 * 集計対象外スタッフ（退社とは別概念・店舗を問わず常に除外）。
 *
 * 「佐々木 淳」: 月末報告書に回答が3件あるが（最新 2026-08-04・楽々園院）、
 * monet のスタッフ名簿には存在しない。土橋院と楽々園院の両方に回答があり
 * 店舗別の RETIRED_STAFF では捕まえられないため、ここで一括除外する。
 * 林さん判断により集計から完全に除外（2026-08-18）。
 */
const EXCLUDED_STAFF: string[] = ["佐々木 淳"];

/** 集計対象外スタッフかどうか（店舗・月に関係なく判定） */
function isExcludedStaff(staffName: string): boolean {
  const key = aliasStaffKey(staffName);
  return EXCLUDED_STAFF.some((n) => aliasStaffKey(n) === key);
}

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
  // 集計対象外スタッフは店舗・月・DB連携の有無に関係なく常に除外する
  if (isExcludedStaff(staffName)) return true;

  const targetMonth = month || getCurrentYearMonth();

  // DB連携マップが設定されている場合はDBデータを使用
  if (dbRetiredStaffMap && dbRetiredStaffMap.size > 0) {
    // 名前は normalizeStaffKey で比較（全角/半角スペース・大小文字・エイリアスを吸収。
    // 例: DB登録「佐々木 淳」と月末報告書「佐々木　淳」のスペース違いで退社判定を
    // すり抜けていたバグへの対策 2026-07-10）
    const nameKey = aliasStaffKey(staffName);
    for (const [mapKey, entry] of Array.from(dbRetiredStaffMap.entries())) {
      const sep = mapKey.lastIndexOf("|");
      const mapName = mapKey.slice(0, sep);
      const mapStore = mapKey.slice(sep + 1);
      if (aliasStaffKey(mapName) !== nameKey) continue;
      if (storeName && mapStore.trim() !== storeName.trim()) continue;
      if (entry.status !== "retired") return false;
      if (entry.retiredMonth) return targetMonth >= entry.retiredMonth;
      return true;
    }

    // DBに登録されていない = 退社ではない
    return false;
  }

  // フォールバック: ハードコードデータを使用（比較はDB経路と同じ名寄せキー）
  const nameKey = Object.keys(RETIRED_STAFF).find(
    k => aliasStaffKey(k) === aliasStaffKey(staffName)
  );
  if (!nameKey) return false;
  const info = RETIRED_STAFF[nameKey];
  if (storeName && info.store !== storeName) return false;
  return targetMonth >= info.retiredMonth;
}

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

// ============================================================
// スタッフ初登場月マップ（module-level で保持）
// key: "staffName|storeName" (スペース除去・小文字正規化), value: 初登場月 "YYYY-MM"
// ============================================================
let _staffFirstAppearanceMap: Map<string, string> | null = null;

/**
 * スタッフ初登場月マップを設定する
 * StoreDataProvider等から呼ばれる
 */
export function setStaffFirstAppearanceMap(map: Map<string, string> | null): void {
  _staffFirstAppearanceMap = map;
}

/**
 * スタッフ初登場月マップが設定済みかどうか
 */
export function hasStaffFirstAppearanceMap(): boolean {
  return _staffFirstAppearanceMap !== null && _staffFirstAppearanceMap.size > 0;
}

/**
 * スタッフ名を正規化（スペース除去・小文字化）
 */
function normalizeStaffKey(staffName: string, storeName: string): string {
  const name = staffName.replace(/\s/g, "").toLowerCase();
  const store = storeName.replace(/\s/g, "").toLowerCase();
  return `${name}|${store}`;
}

/**
 * スタッフが NEW かどうか判定
 *
 * 月末報告書データでの「初登場月」から3ヶ月以内（当月含む）なら NEW を返す。
 * 例: 初登場月が 2026-04 → 2026-04, 2026-05, 2026-06 まで NEW
 *
 * @param staffName スタッフ名
 * @param storeName 店舗名
 * @returns NEW なら true
 */
export function isNewStaff(staffName: string, storeName: string): boolean {
  if (!_staffFirstAppearanceMap || _staffFirstAppearanceMap.size === 0) {
    return false;
  }

  const key = normalizeStaffKey(staffName, storeName);
  const firstMonth = _staffFirstAppearanceMap.get(key);
  if (!firstMonth) return false;

  const current = getCurrentYearMonth();
  // 初登場月から3ヶ月後の末日まで NEW（初登場月を含めて3ヶ月間）
  // 例: firstMonth = "2026-04" → expiry = "2026-06"
  const expiry = addMonths(firstMonth, 2); // 0,1,2 = 3ヶ月間
  return current <= expiry;
}

/**
 * 月末報告書の rawData からスタッフ初登場月マップを構築する
 * 各スタッフの最も古い reportMonth を「初登場月」とする
 *
 * 【重要】データの最古月と初登場月が一致するスタッフは、
 * 「データ開始前から在籍」とみなし、マップから除外する。
 * これにより、既存スタッフが誤ってNEW判定されることを防ぐ。
 *
 * @param reports 月末報告書データ配列
 * @returns Map<normalizedKey, firstMonth>
 */
export function buildStaffFirstAppearanceMap(
  reports: Array<{ name: string; storeNormalized: string; reportMonth: string }>
): Map<string, string> {
  const map = new Map<string, string>();

  // データ全体の最古月を特定
  let dataOldestMonth: string | null = null;
  for (const r of reports) {
    if (!r.reportMonth) continue;
    if (!dataOldestMonth || r.reportMonth < dataOldestMonth) {
      dataOldestMonth = r.reportMonth;
    }
  }

  for (const r of reports) {
    if (!r.name || !r.storeNormalized || !r.reportMonth) continue;

    const key = normalizeStaffKey(r.name, r.storeNormalized);
    const existing = map.get(key);

    if (!existing || r.reportMonth < existing) {
      map.set(key, r.reportMonth);
    }
  }

  // 初登場月がデータ最古月と一致するスタッフを除外
  // （データ開始前から在籍していた可能性が高いため）
  if (dataOldestMonth) {
    for (const [key, firstMonth] of Array.from(map.entries())) {
      if (firstMonth === dataOldestMonth) {
        map.delete(key);
      }
    }
  }

  return map;
}

// ============================================================
// 店舗NEW判定（レガシー互換 — useStores.isNewStore に移行済みだが一部で参照あり）
// ============================================================

// 店舗ごとのNEW終了月（この月の末日まで表示）
const STORE_NEW_EXPIRY: Record<string, string> = {
  "高槻院": "2026-08",
  "福島院": "2026-08",
  "堀江院2nd": "2026-05",
};

// 既知の店舗一覧
const KNOWN_STORES = new Set([
  "堀江院",
  "堀江院2nd",
  "姪浜院",
  "楽々園院",
  "福島院",
  "高槻院",
  "広島土橋院",
]);

// 動的に検出された新店舗のキャッシュ
const dynamicNewStores = new Map<string, string>();

/**
 * 店舗が NEW かどうか判定
 */
export function isNewStore(storeName: string): boolean {
  const current = getCurrentYearMonth();

  const expiry = STORE_NEW_EXPIRY[storeName];
  if (expiry) {
    return current <= expiry;
  }

  const firstSeen = dynamicNewStores.get(storeName);
  if (firstSeen) {
    const dynamicExpiry = addMonths(firstSeen, 6);
    return current <= dynamicExpiry;
  }

  return false;
}

/**
 * 月末報告書のデータから未知の店舗を検出し、動的にNEW登録する
 */
export function registerNewStoresFromReports(storeNames: string[]): void {
  const current = getCurrentYearMonth();
  for (const name of storeNames) {
    if (!name) continue;
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
