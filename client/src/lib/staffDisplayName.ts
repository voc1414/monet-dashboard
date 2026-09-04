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
import { normalizeStoreKey as normStore } from "@/lib/storeKey";

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
 *
 * **店舗が分かるときは「その店舗に居る同名者がちょうど1人」のときだけ返す。**
 * 空振り（店舗表記が揺れている・その店舗に居ない）は氏名に落とす。
 * 下の findReportNickname と同じ規律で、理由も同じ：
 * 「マスタ全体でこの名前は1人だけ」は「画面に出ているこの人がその1人」ではない。
 *
 * 2026-09-04 の独立監査で、ここに全社フォールバックが残っているのを実測された
 * （`resolveStaffDisplayName("Akiko","堀江院2nd")` が 堀江院 小池明子の呼び名を返す。
 *  SurveyList.tsx は NPS の (staff, storeShort) から行を作るので、実データで到達する）。
 * さらに①のこの誤ヒットは②の正しい直接ヒットを上書きするため、②だけ締めても無意味だった。
 * 現在マスタ36人の nickname が全て null で画面が壊れていないのは偶然であり、
 * Notion のニックネーム列に1件でも値が入れば発火する。
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
    return inStore.length === 1 ? inStore[0].nickname : null;
  }

  return matches.length === 1 ? matches[0].nickname : null;
}

/**
 * 月末報告書 列20 のニックネームを探す。見つからなければ null。
 *
 * **店舗が分かるときは「店舗＋名前」の直接ヒットだけを採る。** 空振りしたら氏名に落とす。
 * 列20 は本人が答えたときだけ埋まるので、「報告書にこの名前は1件しか無い」は
 * 「その1件がこの人のもの」を意味しない。証拠の不在を証拠として扱わない。
 *
 * 段階的に締めた経緯（消さない。同じ穴を2回開けたため）:
 *   - 第1版「2人以上と証明できたときだけ止める」→ Mika（複数店舗に別人が実在）は止まるが、
 *     Yu（そのときマスタ上は1人だけだった表示名）は、ある店舗の回答が別店舗の画面に
 *     「ゆうちゃん」として出た。名簿外の退職者（藤田・AKI。CLAUDE.md §3 で名簿外が正常）も
 *     素通りしていた。
 *   - 第2版「マスタでちょうど1人＋その人の所属店舗と一致」→ 別店舗の回答が、
 *     マスタ上ただ1人のその人の画面に出た。「マスタに1人しか居ない」は
 *     「回答者がその1人」ではない（名簿外の同名者が答えていれば別人の呼び名になる）。
 *     ※所属店舗は異動で変わる（例: 2026-10-01 に Yu が福島院→堀江院）。所属を判定材料に
 *       すること自体が時点依存で危うい、というのがこの版を捨てた理由でもある。
 *
 * 店舗が渡らない経路だけ全社フォールバックを残す（`/staff/:storeId/:staffId` からは常に
 * 店舗が入るので通らない防御的な経路）。そこでも「報告書側の候補が1つ」かつ
 * 「マスタ側もその名前でちょうど1人」を要求する。
 *
 * この締め付けで、店舗ラベルが未マップの店（例 岡山下伊福院）の人は氏名表示に落ちる。
 * それは安全側の劣化であり、直す場所はここではなく
 * `useMonthlyReport.ts` の `STORE_NAME_MAP_FALLBACK`／Notion 店舗マスタ側（CLAUDE.md §0）。
 */
function findReportNickname(name: string, store?: string): string | null {
  if (!name) return null;
  const key = normalizeStaffKey(name);
  if (!key) return null;

  if (store) {
    return reportNicknames.get(`${normStore(store)}__${key}`)?.nickname ?? null;
  }

  const suffix = `__${key}`;
  const candidates = new Set<string>();
  for (const [k, v] of reportNicknames) {
    if (k.endsWith(suffix)) candidates.add(v.nickname);
  }
  if (candidates.size !== 1) return null;

  const samePeople = STAFF_MASTER.filter(
    (s) => normalizeStaffKey(s.name) === key || normalizeStaffKey(s.displayName) === key
  );
  if (samePeople.length !== 1) return null;

  return Array.from(candidates)[0];
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
