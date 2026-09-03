/**
 * 画面に出す呼び名の解決 — 表示名と照合キーを分離する層。
 *
 * ダッシュボードの内部処理は一貫して「月末報告書の name」を照合キーに使う
 * （NPS・サロンボード・ファンくる・退社判定・NEW判定・URL /staff/:storeId/:staffId）。
 * ここで差し替えるのは **画面に出る文字だけ**。name は絶対に書き換えない。
 *
 * 解決順（3段・2026-09-03 に②を追加）:
 *   ① Notion「全スタッフ一覧」のニックネーム（人が直した値。最優先）
 *   ② 月末報告書 列20 のニックネーム（L Message の必須入力。自動で毎月増える）
 *   ③ 氏名（＝照合キーそのまま）
 *
 * ②を挟む理由：ニックネームの正本は L Message 側の必須入力欄であり、その回答は
 * 月末報告書スプレッドシートの列20 に毎月入ってくる（2026-08-29 に「写真」列から
 * 差し替え）。ダッシュボードは元々この報告書を実行時に読んでいるので、列20 を
 * 拾うだけで人手ゼロで反映される。Notion へ人が写す運用は作らない
 * （CLAUDE.md §0 完全自動化の原則）。
 *
 * ①を②より上に置くのは、Notion で人が直した呼び名を機械が上書きしないため。
 *
 * 照合は必ず「店舗＋人」の組で行う。displayName（Akiko / Mika / Yu / Nao / Mayu /
 * Minaho / Yukiko）は複数店舗に別人として実在するため、名前だけで引くと入れ替わる。
 */
import { STAFF_MASTER } from "@/data/staffMaster";
import { normalizeStaffKey } from "@/lib/staffNameAlias";

const normStore = (s: string) => (s || "").replace(/[\s　]/g, "").toLowerCase();

/** 月末報告書 列20 由来のニックネーム。useMonthlyReport が実行時に注入する */
export interface ReportNicknameEntry {
  name: string;
  store: string;
  nickname: string;
  answerDate: string;
}

const reportNicknames = new Map<string, { nickname: string; answerDate: string }>();

/**
 * 月末報告書 列20 の生の値を呼び名として使えるかたちに整える。
 *
 * 列20 は 2026-08-29 に「写真」から「ニックネーム」へ差し替えられたため、
 * それ以前の行には写真URL（https://…）が入っている。URL は呼び名ではないので捨てる。
 */
export function parseReportNickname(raw: string | undefined): string {
  const v = (raw || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return "";
  return v;
}

/**
 * 報告書由来のニックネームを差し替える（useMonthlyReport から呼ぶ）。
 *
 * 同じ人が複数月ぶん回答していれば回答日が新しい行を採る（呼び名を変えた人に追従する）。
 * 呼び出しは冪等（毎回 clear してから詰め直す）。
 */
export function setReportNicknames(entries: ReportNicknameEntry[]): void {
  reportNicknames.clear();
  for (const e of entries) {
    const nickname = (e.nickname || "").trim();
    const name = (e.name || "").trim();
    if (!nickname || !name) continue;
    const key = `${normStore(e.store)}__${normalizeStaffKey(name)}`;
    const prev = reportNicknames.get(key);
    const answerDate = e.answerDate || "";
    if (!prev || answerDate > prev.answerDate) {
      reportNicknames.set(key, { nickname, answerDate });
    }
  }
}

/** テスト用。注入済みの件数を見る */
export function reportNicknameCount(): number {
  return reportNicknames.size;
}

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
 * 月末報告書 列20 のニックネームを探す。見つからなければ null。
 *
 * 店舗が渡れば「店舗＋人」で引く。店舗が渡らない／店舗表記が揺れて空振りしたときは
 * 全社で呼び名が一意に決まる場合だけ返す（2件以上に割れたら null＝別人の呼び名を出さない）。
 */
function findReportNickname(name: string, store?: string): string | null {
  if (!name) return null;
  const key = normalizeStaffKey(name);
  if (!key) return null;

  if (store) {
    const hit = reportNicknames.get(`${normStore(store)}__${key}`);
    if (hit) return hit.nickname;
  }

  const suffix = `__${key}`;
  const candidates = new Set<string>();
  for (const [k, v] of reportNicknames) {
    if (k.endsWith(suffix)) candidates.add(v.nickname);
  }
  return candidates.size === 1 ? Array.from(candidates)[0] : null;
}

/**
 * 画面に出す呼び名を返す。ニックネームが無ければ渡された name をそのまま返す。
 * @param name 月末報告書の name（照合キー。書き換えない）
 * @param store 店舗名（正規化前でよい。同名の別人を切り分けるために渡す）
 */
export function resolveStaffDisplayName(name: string, store?: string): string {
  return findNickname(name, store) || findReportNickname(name, store) || name;
}

/** アバターの頭文字。表示名と必ず同じ文字から取る（氏名「小」とニックネーム「Akiko」の食い違いを防ぐ） */
export function resolveStaffInitial(name: string, store?: string): string {
  return resolveStaffDisplayName(name, store).charAt(0);
}
