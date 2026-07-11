/**
 * スタッフ名の名寄せ層（全データソース共通）。
 *
 * 照合キー = 空白（半角/全角）除去 + 小文字化。
 * 優先順位: DB「名前マッピング」（管理者ページで登録・stylist_aliasesテーブル） > コード内蔵表。
 *
 * 用途:
 * - normalizeStaffKey: 比較用キー（NPS照合・退社判定など）
 * - canonicalizeStaffName: 表示名の正準化（月末報告書の本人入力ゆれ「坂手」→「坂手芳」等を統一）
 * （ファンくる側の照合は useFankuruData.ts が同じDBテーブルを参照する。登録は1箇所でOK）
 */
import { useSyncExternalStore } from "react";

/** コード内蔵の正規化済みエイリアス → 正準表示名（月末報告書の登録名ベース） */
const BUILTIN_ALIASES: Record<string, string> = {
  // 堀江院: NPSフォームは "akiko" 表記（林 確認 2026-07-06）
  "akiko": "小池明子",
  // 楽々園院: NPSフォームは "石原ようこ" 表記（林 確認 2026-07-06）
  "石原ようこ": "石原葉子",
  // 堀江院2nd: 月末報告書の本人入力が月により「坂手」「坂手芳」と揺れる（林 指摘 2026-07-10）
  "坂手": "坂手芳",
  // 堀江院2nd: 報告書の入力に注記が混入したケース「sayuri  ホットペッパー」
  "sayuriホットペッパー": "sayuri",
};

/** DB（管理者ページ「名前マッピング」）から注入されるエイリアス。コード内蔵表より優先 */
let _dbDisplayMap: Record<string, string> = {}; // 正規化済みalias → 正準表示名

// 変更通知（useMonthlyReport等がDBマップ到着後に名寄せをやり直すために使う）
let _version = 0;
const _listeners = new Set<() => void>();
const notify = () => {
  _version++;
  _listeners.forEach((l) => l());
};

const normalize = (s: string) => (s || "").replace(/[\s　]/g, "").toLowerCase();

/**
 * DBの名前マッピング（stylist_aliases）を注入する。StoreDataProviderが起動時に呼ぶ。
 */
export function setStaffAliasMapFromDb(aliases: Array<{ alias: string; canonicalName: string }>) {
  const map: Record<string, string> = {};
  for (const a of aliases) {
    if (a.alias && a.canonicalName) map[normalize(a.alias)] = a.canonicalName;
  }
  _dbDisplayMap = map;
  notify();
}

/** エイリアスマップの変更を購読するReactフック（変更で再レンダー） */
export function useStaffAliasVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      _listeners.add(cb);
      return () => _listeners.delete(cb);
    },
    () => _version,
    () => _version
  );
}

/**
 * 表示名の正準化。エイリアスに該当すれば正準表示名（例: "坂手"→"坂手芳"）、
 * 該当しなければ元の名前をそのまま返す。
 */
export function canonicalizeStaffName(name: string): string {
  const n = normalize(name);
  return _dbDisplayMap[n] || BUILTIN_ALIASES[n] || name;
}

/**
 * スタッフ名を比較用キーに正規化する（空白除去＋小文字化＋エイリアス解決）。
 * 両側に適用してから比較すること。
 */
export function normalizeStaffKey(name: string): string {
  const n = normalize(name);
  const canonical = _dbDisplayMap[n] || BUILTIN_ALIASES[n];
  return canonical ? normalize(canonical) : n;
}
