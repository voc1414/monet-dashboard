/**
 * OPEN半年以内の店舗・入社6ヶ月以内のスタッフに「\ NEW /」バッジを表示するための定義
 */

// OPEN半年以内の店舗
export const NEW_STORES: Set<string> = new Set([
  "福島院",
  "高槻院",
]);

// 入社6ヶ月以内ではない（＝NEWではない）スタッフ（店舗ごと）
// これらのスタッフ以外がNEW扱い
const VETERAN_STAFF: Record<string, Set<string>> = {
  "福島院": new Set(["YU", "Yu", "yu"]),
  "高槻院": new Set(["NAO", "Nao", "nao"]),
};

export function isNewStore(storeName: string): boolean {
  return NEW_STORES.has(storeName);
}

export function isNewStaff(staffName: string, storeName: string): boolean {
  const veterans = VETERAN_STAFF[storeName];
  if (!veterans) return false; // NEW対象店舗でなければNEWスタッフなし
  // ベテランリストに含まれていなければNEW
  const nameUpper = staffName.trim().toUpperCase();
  let isVeteran = false;
  veterans.forEach((v) => {
    if (v.toUpperCase() === nameUpper) isVeteran = true;
  });
  return !isVeteran;
}
