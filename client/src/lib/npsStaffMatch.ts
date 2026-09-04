/**
 * NPS回答をスタッフ1人へ引き当てる照合。
 *
 * 照合は必ず「店舗＋名前」の組で行う。サロンボード表示名（Akiko / Mika / Yu / Nao /
 * Mayu / Minaho / Yukiko）は複数店舗に別人として実在するため、名前だけで引くと
 * 別人の口コミ・点数が混ざる（CLAUDE.md §3.1）。
 *
 * 一覧側（StaffList.tsx）は 2026-08-19 に「店舗＋名前」へ直っていたが、
 * 詳細側（StaffDetail.tsx）は名前だけのまま取り残されていた。同じ判定を2箇所で
 * 書き直すとまた片方だけ直る事故になるので、ここを1本の正本にする
 * （一覧はグルーピング用に `npsStaffKey`、詳細は絞り込み用に `filterNpsRecordsForStaff` を使う。
 *  どちらも同じキーの作り方を通るので、正規化が片方だけズレることが起きない）。
 *
 * 店舗キーは NPS 側 `storeShort`（parseStoreName の出力＝短縮名）と
 * スタッフ側 `storeNormalized` / URL の storeId を突き合わせる。どちらも
 * 「堀江院」「堀江院2nd」「福島院」…の短縮名なので、空白除去＋小文字化で比較する。
 *
 * ★新店を開けるときの注意: `parseStoreName`（useNpsData.ts）が短縮名に落とせない店舗ラベルは
 * 生値のまま返るため、この照合が空振りして**詳細画面の口コミ・NPSが0件になる**。
 * CLAUDE.md §3.2 の「新店は useAdsData と Ads.tsx にも足す」と同じ列に、
 * `parseStoreName` の店舗リストも入る。
 *
 * ★同一店舗に同名2人が居る場合は原理的に分離できない（口コミが合算される）。
 * 現マスタには存在しない。根治は URL に安定IDを持たせる上流の話。
 */
import { normalizeStaffKey } from "@/lib/staffNameAlias";
import { normalizeStoreKey } from "@/lib/storeKey";

/** 照合に必要な最小の形（NpsRecord のサブセット。テストから素で組める） */
export interface NpsStaffMatchable {
  staff?: string;
  storeShort?: string;
}

/** 「店舗＋名前」の照合キー。一覧のグルーピングと詳細の絞り込みで同じものを使う */
export const npsStaffKey = (name: string, store: string): string =>
  `${normalizeStaffKey(name)}__${normalizeStoreKey(store)}`;

/**
 * この回答が「その店舗のその人」のものか。
 *
 * store を渡さないときは名前だけで判定する。現状の呼び出し元（ルートが
 * `/staff/:storeId/:staffId` なので storeId は必ず入る）では通らない防御的な経路だが、
 * 店舗が特定できない画面から呼ばれたときに数字が丸ごと消えるのを避けるために残す。
 * **店舗が分かるときだけ厳しくなる**、という意味であって推奨経路ではない。
 */
export function isNpsRecordOfStaff(
  record: NpsStaffMatchable,
  staffName: string,
  store?: string
): boolean {
  const nameKey = normalizeStaffKey(staffName);
  if (!nameKey) return false;
  if (normalizeStaffKey(record.staff?.trim() || "") !== nameKey) return false;
  if (!store) return true;
  return npsStaffKey(record.staff || "", record.storeShort || "") === npsStaffKey(staffName, store);
}

/** 「店舗＋名前」で絞り込む。StaffDetail の月一覧・NPS集計の両方がこれを通る */
export function filterNpsRecordsForStaff<T extends NpsStaffMatchable>(
  records: T[],
  staffName: string,
  store?: string
): T[] {
  return records.filter((r) => isNpsRecordOfStaff(r, staffName, store));
}
