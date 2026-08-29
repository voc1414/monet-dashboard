/**
 * テスト回答の除外ルール（正本・ここ1箇所だけ）
 *
 * 背景（2026-08-29 決定・林さん）:
 * L Message の仕組み上、月末報告書スプレッドシートからテスト回答の行を
 * 削除できない。今後もテスト送信は行われる。
 * よって「テスト」と回答された人物はダッシュボードに表示しない。
 *
 * 判定対象の列（月末報告書）:
 *   - 5 システム表示名
 *   - 6 氏名
 *   - 20 ニックネーム（設問差し替え後・ヘッダー空欄）
 * LINE名（列4）は本人の実アカウント名であり誤爆するため判定に使わない。
 */

/** テスト回答と見なす名前（完全一致・大小文字とスペースは無視） */
const TEST_NAME_TOKENS = new Set([
  "テスト",
  "test",
  "てすと",
  "ﾃｽﾄ",
  "テストテスト",
]);

/** 1つの名前がテスト値かどうか */
export function isTestName(value: string | undefined | null): boolean {
  if (!value) return false;
  const norm = value.replace(/[\s　]/g, "").toLowerCase();
  if (!norm) return false;
  return TEST_NAME_TOKENS.has(norm);
}

/**
 * 月末報告書の1行がテスト回答かどうか。
 * システム表示名・氏名・ニックネームのいずれかが「テスト」ならテスト扱い。
 */
export function isTestReportRow(row: string[]): boolean {
  return isTestName(row[5]) || isTestName(row[6]) || isTestName(row[20]);
}
