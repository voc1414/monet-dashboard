/**
 * 画面に出す呼び名の解決 — 表示名と照合キーを分離する層。
 *
 * ダッシュボードの内部処理は一貫して「月末報告書の name」を照合キーに使う
 * （NPS・サロンボード・ファンくる・退社判定・NEW判定・URL /staff/:storeId/:staffId）。
 * ここで差し替えるのは **画面に出る文字だけ**。name は絶対に書き換えない。
 *
 * 解決順（林さん決定 2026-08-29・2段）:
 *   ① Notion「全スタッフ一覧」のニックネーム
 *   ② 氏名（＝照合キーそのまま）
 *
 * ニックネームは L Message 側で必須入力なので、②は Notion への移行が済むまでの
 * 過渡期のフォールバック。Notion に「ニックネーム」列が無い／空のあいだは
 * 全員②になり、見た目は導入前と変わらない。
 *
 * 照合は必ず「店舗＋人」の組で行う。displayName（Akiko / Mika / Yu / Nao / Mayu /
 * Minaho / Yukiko）は複数店舗に別人として実在するため、名前だけで引くと入れ替わる。
 */
import { STAFF_MASTER } from "@/data/staffMaster";
import { normalizeStaffKey } from "@/lib/staffNameAlias";

const normStore = (s: string) => (s || "").replace(/[\s　]/g, "").toLowerCase();

/**
 * 月末報告書の name にひもづくニックネームを探す。見つからなければ null。
 *
 * name は氏名（「小池明子」）で来ることもサロンボード表示名（「Akiko」）で来ることも
 * あるため、マスタ側は name / displayName の両方を照合対象にする。
 * どちらに転んでも誤爆しないよう、候補が2件以上に割れたときは null を返す
 * （＝氏名表示のまま。別人のニックネームを出すより安全）。
 */
function findNickname(name: string, store?: string): string | null {
  if (!name) return null;
  const key = normalizeStaffKey(name);

  const matches = STAFF_MASTER.filter(
    (s) => normalizeStaffKey(s.name) === key || normalizeStaffKey(s.displayName) === key
  );
  if (!matches.length) return null;

  if (store) {
    const st = normStore(store);
    const inStore = matches.filter((s) => normStore(s.store) === st);
    if (inStore.length === 1) return inStore[0].nickname;
    // 同一店舗に同名が2人 = 判別不能。店舗表記が揺れている（土橋院/広島土橋院）
    // 場合は inStore が空になるので、下の全社一意判定に落とす。
    if (inStore.length > 1) return null;
  }

  return matches.length === 1 ? matches[0].nickname : null;
}

/**
 * 画面に出す呼び名を返す。ニックネームが無ければ渡された name をそのまま返す。
 * @param name 月末報告書の name（照合キー。書き換えない）
 * @param store 店舗名（正規化前でよい。同名の別人を切り分けるために渡す）
 */
export function resolveStaffDisplayName(name: string, store?: string): string {
  return findNickname(name, store) || name;
}

/** アバターの頭文字。表示名と必ず同じ文字から取る（氏名「小」とニックネーム「Akiko」の食い違いを防ぐ） */
export function resolveStaffInitial(name: string, store?: string): string {
  return resolveStaffDisplayName(name, store).charAt(0);
}
