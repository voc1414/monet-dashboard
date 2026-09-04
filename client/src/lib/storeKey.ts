/**
 * 店舗名を照合キーに落とす（空白（半角/全角）除去＋小文字化）。
 *
 * 「店舗＋名前」で人を引き当てる処理が複数ある（NPSの引き当て＝`npsStaffMatch.ts`、
 * 呼び名の解決＝`staffDisplayName.ts`）。同じ正規化を各所で書き直すと、
 * 片方だけ揺れを吸収して片方は吸収しない、という食い違いが起きるため、ここを正本にする。
 *
 * 短縮名どうしの比較にだけ使う（「堀江院」「堀江院2nd」「福島院」…）。
 * 「広島土橋院」→「土橋院」のような接頭辞の畳み込みは別の話で、
 * `useMonthlyReport.ts` の `normalizeStoreName`／`STORE_NAME_MAP_FALLBACK` の担当。
 * ここでは "院" を落とさない（`Ads.tsx` の `canonicalStore` は落とす。用途が違う）。
 */
export const normalizeStoreKey = (s: string): string =>
  (s || "").replace(/[\s　]/g, "").toLowerCase();
