/*
 * 次回予約強化フロー（管理者専用・2026-10-03）の集計ロジック。純関数のみ。
 *
 * 運用ルールの正本: Notion「GrandFusion法人 司令塔」末尾「monet 次回予約強化フロー」節
 *   - 毎月7日に月末報告書から前月の次回予約率を出し、70%以下のスタッフに
 *     L Message のフォーム「次回予約強化シート」（フォームID 244191）を送る
 *   - 次回予約率 ＝ 次回予約取得数 ÷（新規客数＋再来顧客数）。70%以下＝強化対象／70%超え＝クリア
 *   - 連続月数: 70%以下の月は +1、70%超えの月は 0 に戻す。報告書を出していない月は判定せず据え置き
 *   - 3ヶ月連続 70%以下で管理者と面談
 *   - 初回 2026-11-07 は 10月分の判定。よって強化シートの「対象月」＝月末報告書の報告月
 *
 * 強化シートの列（2026-10-03 実測: 回答0件でヘッダー行も空）:
 *   列番号は決め打ちせず、ヘッダーの設問名から解決する（月末報告書の reportColumns.ts と同じ方針）。
 *   Q1〜Q17 は設問名の先頭「Q数字」で引き、引けないときは中身（「4 いつもできている」形式）
 *   の列を左から順に使う。
 *
 * 個人の記述（課題点・アクション）を画面に出すのは管理者ビルドだけ（2026-10-03 林さん決定 A）。
 */
import { isTestName } from "./testDataFilter";
import { normalizeHeader } from "./reportColumns";

/** これ以下なら強化対象（%） */
export const BOOST_THRESHOLD = 70;
/** この連続月数以上で面談対象 */
export const INTERVIEW_STREAK = 3;
/** 自己評価の設問数 */
export const QUESTION_COUNT = 17;
/** 「できていない側」とみなす点数の上限（2・1） */
export const LOW_SCORE_MAX = 2;
/**
 * 測定を始める月（2026-10-03 林さん決定：2026年10月分の成果から）。
 * これより前の月は対象者にも連続月数にも数えない。
 */
export const BOOST_START_MONTH = "2026-10";

/** 測定対象の月か */
export function isMeasuredMonth(month: string, startMonth: string = BOOST_START_MONTH): boolean {
  return !!month && month >= startMonth;
}

// ───────────────────────── 次回予約率・連続月数 ─────────────────────────

/**
 * 次回予約率（%・小数1桁）。客数が0なら判定できないので null。
 * 月末報告書の useMonthlyReport と同じ丸め方にそろえる。
 */
export function nextReservationRate(
  nextReservation: number,
  newCustomers: number,
  returnCustomers: number,
): number | null {
  const total = newCustomers + returnCustomers;
  if (!(total > 0)) return null;
  return Math.round((nextReservation / total) * 1000) / 10;
}

/** 強化対象か（70%以下）。判定できない月は false */
export function isBoostTarget(rate: number | null): boolean {
  return rate !== null && rate <= BOOST_THRESHOLD;
}

/**
 * 連続月数を月ごとに出す。
 * months は判定に使う月の一覧（古い順でなくてもよい）。rateByMonth に無い月・率が null の月は
 * 「報告書を出していない月」として数字を変えない（前の値のまま）。
 * 返り値は months の全月ぶん（その月の判定後の値）。測定開始前の月は 0。
 */
export function streakByMonth(
  months: string[],
  rateByMonth: Map<string, number | null>,
  startMonth: string = BOOST_START_MONTH,
): Map<string, number> {
  const sorted = Array.from(new Set(months)).sort();
  const out = new Map<string, number>();
  let streak = 0;
  for (const m of sorted) {
    if (!isMeasuredMonth(m, startMonth)) {
      out.set(m, 0);
      continue;
    }
    if (rateByMonth.has(m)) {
      const rate = rateByMonth.get(m) ?? null;
      if (rate !== null) streak = isBoostTarget(rate) ? streak + 1 : 0;
    }
    out.set(m, streak);
  }
  return out;
}

// ───────────────────────── 強化シートの列解決 ─────────────────────────

export type BoostColumnKey =
  | "answerDate"
  | "systemName"
  | "name"
  | "store"
  | "targetMonth"
  | "issue"
  | "action";

export interface BoostColumnMap {
  index: Record<BoostColumnKey, number>;
  /** Q1〜Q17 の列。見つからない設問は -1 */
  questions: number[];
  /** 設問の見出し（ヘッダー文字列。空なら「Q番号」） */
  questionLabels: string[];
  /** 画面に出す注意書き */
  issues: string[];
  /** 名前・店舗・対象月が解決できたか。false なら回答を読まない */
  ok: boolean;
}

const COLUMN_SPECS: { key: BoostColumnKey; label: string; required: boolean; patterns: string[] }[] = [
  { key: "answerDate", label: "回答日時", required: false, patterns: ["回答日時"] },
  { key: "systemName", label: "システム表示名", required: false, patterns: ["システム表示名"] },
  { key: "name", label: "氏名", required: true, patterns: ["氏名"] },
  { key: "store", label: "所属店舗", required: true, patterns: ["所属店舗", "店舗"] },
  { key: "targetMonth", label: "対象月", required: true, patterns: ["対象月"] },
  { key: "issue", label: "次回予約に関する自身の課題点", required: false, patterns: ["課題"] },
  { key: "action", label: "翌月まで強化する具体的なアクション内容", required: false, patterns: ["アクション"] },
];

/** 自己評価の値か（「4 いつもできている」など、先頭が1〜4） */
export function parseScore(raw: string | undefined | null): number | null {
  const s = (raw || "").normalize("NFKC").trim();
  const m = s.match(/^([1-4])(?:\D|$)/);
  return m ? parseInt(m[1], 10) : null;
}

/** ヘッダーの「Q1」「Ｑ１.」「q01」などから設問番号を取る */
function questionNumberOf(normalizedHeader: string): number | null {
  const m = normalizedHeader.match(/^q0*(\d{1,2})(?!\d)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= QUESTION_COUNT ? n : null;
}

export function resolveBoostColumns(header: string[], dataRows: string[][] = []): BoostColumnMap {
  const norm = header.map(normalizeHeader);
  // 回答0件のうちはヘッダー行も空（2026-10-03 実測）。そのときは注意書きを出さない
  const hasHeader = norm.some(Boolean);
  const index = {} as Record<BoostColumnKey, number>;
  const issues: string[] = [];
  const taken = new Set<number>();

  // Q列を先に取る（設問文に「課題」「アクション」が含まれていても誤って拾わないように）
  const questions: number[] = Array(QUESTION_COUNT).fill(-1);
  norm.forEach((h, c) => {
    const q = questionNumberOf(h);
    if (q !== null && questions[q - 1] < 0) {
      questions[q - 1] = c;
      taken.add(c);
    }
  });

  for (const spec of COLUMN_SPECS) {
    let hit = -1;
    for (const p of spec.patterns) {
      hit = norm.findIndex((h, c) => !!h && !taken.has(c) && h.includes(p));
      if (hit >= 0) break;
    }
    index[spec.key] = hit;
    if (hit >= 0) taken.add(hit);
    else if (hasHeader && spec.required) {
      issues.push(`強化シートに「${spec.label}」の列が見つかりません。設問名が変わっていないか確認してください。`);
    }
  }

  // 設問名で引けなかったQは、中身が自己評価の列を左から順に当てる
  if (questions.some((c) => c < 0) && dataRows.length > 0) {
    const scoreCols: number[] = [];
    for (let c = 0; c < header.length; c++) {
      if (taken.has(c)) continue;
      const vals = dataRows.map((r) => (r[c] || "").trim()).filter(Boolean);
      if (vals.length > 0 && vals.every((v) => parseScore(v) !== null)) scoreCols.push(c);
    }
    const missing = questions.map((c, i) => (c < 0 ? i : -1)).filter((i) => i >= 0);
    if (scoreCols.length === missing.length) {
      missing.forEach((qi, k) => (questions[qi] = scoreCols[k]));
    }
  }
  const unresolved = questions.filter((c) => c < 0).length;
  if (hasHeader && unresolved > 0) {
    issues.push(`自己評価 ${QUESTION_COUNT}問のうち ${unresolved}問の列を特定できません。その設問は集計に入れていません。`);
  }

  const questionLabels = questions.map((c, i) => {
    const raw = c >= 0 ? (header[c] || "").trim() : "";
    return raw || `Q${i + 1}`;
  });

  const ok = COLUMN_SPECS.every((s) => !s.required || index[s.key] >= 0);
  return { index, questions, questionLabels, issues, ok };
}

// ───────────────────────── 回答の読み取り ─────────────────────────

export interface BoostAnswer {
  answerDate: string;
  systemName: string;
  name: string;
  /** フォームの所属店舗そのまま */
  store: string;
  /** 短縮名に畳んだ店舗 */
  storeNormalized: string;
  /** "YYYY-MM"。読めなければ "" */
  targetMonth: string;
  /** Q1〜Q17。未回答・読めない値は null */
  scores: (number | null)[];
  issue: string;
  action: string;
}

/** 「2026-10-01」「2026/10/1」「2026年10月」「Date(2026,9,1)」→ "2026-10" */
export function parseTargetMonth(raw: string | undefined | null): string {
  const s = (raw || "").normalize("NFKC").trim();
  let m = s.match(/^Date\((\d{4}),(\d{1,2})/); // gviz の日付表現（月は0始まり）
  if (m) return `${m[1]}-${String(parseInt(m[2], 10) + 1).padStart(2, "0")}`;
  m = s.match(/(\d{4})\s*[-/年.]\s*(\d{1,2})/);
  if (!m) return "";
  const mo = parseInt(m[2], 10);
  if (mo < 1 || mo > 12) return "";
  return `${m[1]}-${String(mo).padStart(2, "0")}`;
}

/**
 * CSV（ヘッダー行＋本文）から回答を読む。
 * 0件・ヘッダーが空のときは answers=[] で返す（画面は「まだ回答がありません」）。
 * 名前が「テスト」の回答は testDataFilter のルールで除外する。
 */
export function parseBoostAnswers(
  rows: string[][],
  normalizeStore: (raw: string) => string,
): { answers: BoostAnswer[]; columns: BoostColumnMap } {
  const header = rows[0] ?? [];
  const body = rows.slice(1).filter((r) => r.some((v) => (v || "").trim()));
  const columns = resolveBoostColumns(header, body);
  if (!columns.ok || body.length === 0) return { answers: [], columns };

  const at = (r: string[], c: number) => (c < 0 ? "" : (r[c] ?? "").trim());
  const answers = body
    .filter((r) => at(r, columns.index.name) || at(r, columns.index.systemName))
    .filter((r) => !isTestName(at(r, columns.index.name)) && !isTestName(at(r, columns.index.systemName)))
    .map<BoostAnswer>((r) => {
      const store = at(r, columns.index.store);
      return {
        answerDate: at(r, columns.index.answerDate),
        systemName: at(r, columns.index.systemName),
        name: at(r, columns.index.name),
        store,
        storeNormalized: store ? normalizeStore(store) : "",
        targetMonth: parseTargetMonth(at(r, columns.index.targetMonth)),
        scores: columns.questions.map((c) => parseScore(at(r, c))),
        issue: at(r, columns.index.issue),
        action: at(r, columns.index.action),
      };
    });
  return { answers, columns };
}

// ───────────────────────── 名前の照合 ─────────────────────────

/** 月末報告書側の1人（店舗＋名前の組で一意） */
export interface ReportStaff {
  store: string;
  name: string;
  /** 月末報告書のシステム表示名（L Message の表示名）。無ければ "" */
  systemName: string;
}

export type MatchResult =
  | { matched: true; store: string; name: string }
  | { matched: false; reason: string };

/**
 * 強化シートの回答を月末報告書のスタッフに照合する。必ず「店舗＋名前」の組で引く。
 * 名前は 強化シートの氏名 ↔ 報告書の氏名 または システム表示名 ↔ システム表示名 を、
 * 既存の名寄せキー（staffNameAlias の normalizeStaffKey）で比べる。
 * 同じ店舗で候補が0人・2人以上のときは「未照合」にする（勝手に誰かに寄せない）。
 */
export function matchBoostAnswer(
  answer: Pick<BoostAnswer, "name" | "systemName" | "storeNormalized">,
  staff: ReportStaff[],
  staffKey: (name: string) => string,
): MatchResult {
  if (!answer.storeNormalized) return { matched: false, reason: "所属店舗が空欄" };
  const inStore = staff.filter((s) => s.store === answer.storeNormalized);
  if (inStore.length === 0) return { matched: false, reason: "その店舗の月末報告書がありません" };

  const keys = new Set([answer.name, answer.systemName].filter(Boolean).map(staffKey));
  const hits = inStore.filter(
    (s) => keys.has(staffKey(s.name)) || (!!s.systemName && keys.has(staffKey(s.systemName))),
  );
  const unique = Array.from(new Map(hits.map((h) => [`${h.store}__${h.name}`, h])).values());
  if (unique.length === 1) return { matched: true, store: unique[0].store, name: unique[0].name };
  if (unique.length === 0) return { matched: false, reason: "同じ店舗に同じ名前のスタッフがいません" };
  return { matched: false, reason: `同じ店舗に候補が${unique.length}人います` };
}

// ───────────────────────── 画面用の組み立て ─────────────────────────

/** 月末報告書の1行（集計に要る項目だけ） */
export interface ReportRow {
  store: string;
  name: string;
  systemName: string;
  reportMonth: string;
  newCustomers: number;
  returnCustomers: number;
  nextReservation: number;
}

export interface TargetStaff {
  store: string;
  name: string;
  rate: number;
  streak: number;
  /** 連続 INTERVIEW_STREAK ヶ月以上 */
  needsInterview: boolean;
  submitted: boolean;
}

export interface QuestionStat {
  index: number;
  label: string;
  /** 回答者数（その設問に点数がついた人数） */
  count: number;
  average: number | null;
  /** 2・1 をつけた人数 */
  lowCount: number;
}

export interface UnmatchedAnswer {
  answer: BoostAnswer;
  reason: string;
}

export interface PersonHistory {
  store: string;
  name: string;
  /** 新しい順・最大3件 */
  answers: BoostAnswer[];
}

/** 同じ人・同じ対象月の回答が複数あれば回答日時が新しい方だけ残す */
function latestPerKey<T extends { answerDate: string }>(items: T[], keyOf: (t: T) => string): T[] {
  const map = new Map<string, T>();
  for (const it of items) {
    const k = keyOf(it);
    const prev = map.get(k);
    if (!prev || (it.answerDate || "") >= (prev.answerDate || "")) map.set(k, it);
  }
  return Array.from(map.values());
}

/** 報告書の人ごとに「月→次回予約率」をまとめる */
function ratesByPersonOf(reports: ReportRow[]) {
  const ratesByPerson = new Map<string, { store: string; name: string; rates: Map<string, number | null> }>();
  for (const r of reports) {
    if (!r.reportMonth) continue;
    const key = `${r.store}__${r.name}`;
    let p = ratesByPerson.get(key);
    if (!p) ratesByPerson.set(key, (p = { store: r.store, name: r.name, rates: new Map() }));
    p.rates.set(r.reportMonth, nextReservationRate(r.nextReservation, r.newCustomers, r.returnCustomers));
  }
  return ratesByPerson;
}

/** 回答を報告書のスタッフに照合し、同じ人・同じ月は新しい回答だけ残す */
function matchAnswers(reports: ReportRow[], answers: BoostAnswer[], staffKey: (name: string) => string) {
  const staffList: ReportStaff[] = latestPerKey(
    reports.map((r) => ({ store: r.store, name: r.name, systemName: r.systemName, answerDate: r.reportMonth })),
    (s) => `${s.store}__${s.name}`,
  );
  const matchedAnswers: { key: string; store: string; name: string; answer: BoostAnswer }[] = [];
  const unmatchedAll: UnmatchedAnswer[] = [];
  for (const a of answers) {
    const m = matchBoostAnswer(a, staffList, staffKey);
    if (m.matched) matchedAnswers.push({ key: `${m.store}__${m.name}`, store: m.store, name: m.name, answer: a });
    else unmatchedAll.push({ answer: a, reason: m.reason });
  }
  const dedupedMatched = latestPerKey(
    matchedAnswers.map((x) => ({ ...x, answerDate: x.answer.answerDate })),
    (x) => `${x.key}__${x.answer.targetMonth}`,
  );
  return { dedupedMatched, unmatchedAll };
}

export interface PersonBoostMonth {
  month: string;
  /** 次回予約率（月末報告書が無い・客数0なら null） */
  rate: number | null;
  /** 月末報告書を出していたか */
  reported: boolean;
  /** 測定開始月（BOOST_START_MONTH）以降か */
  measured: boolean;
  streak: number;
  isTarget: boolean;
  /** その月の強化シートの回答（無ければ null） */
  answer: BoostAnswer | null;
}

export interface PersonBoostView {
  store: string;
  name: string;
  /** 月ごとの推移（新しい順）。報告書か回答のどちらかがある月 */
  months: PersonBoostMonth[];
  /** 強化シートの回答（新しい順） */
  answers: BoostAnswer[];
}

/** 個人ページ用: 1人分の次回予約率の推移・連続月数・強化シートの回答をまとめる */
export function buildPersonBoostView(params: {
  reports: ReportRow[];
  answers: BoostAnswer[];
  store: string;
  name: string;
  staffKey: (name: string) => string;
  startMonth?: string;
}): PersonBoostView {
  const { reports, answers, store, name, staffKey } = params;
  const startMonth = params.startMonth ?? BOOST_START_MONTH;
  const key = `${store}__${name}`;
  const allMonths = Array.from(new Set(reports.map((r) => r.reportMonth).filter(Boolean))).sort();
  const rates = ratesByPersonOf(reports).get(key)?.rates ?? new Map<string, number | null>();
  const streaks = streakByMonth(allMonths, rates, startMonth);

  const { dedupedMatched } = matchAnswers(reports, answers, staffKey);
  const mine = dedupedMatched
    .filter((x) => x.key === key)
    .map((x) => x.answer)
    .sort((a, b) => b.targetMonth.localeCompare(a.targetMonth) || b.answerDate.localeCompare(a.answerDate));
  const answerByMonth = new Map(mine.filter((a) => a.targetMonth).map((a) => [a.targetMonth, a]));

  const monthSet = new Set<string>([...Array.from(rates.keys()), ...Array.from(answerByMonth.keys())]);
  const months: PersonBoostMonth[] = Array.from(monthSet)
    .sort()
    .reverse()
    .map((m) => {
      const rate = rates.get(m) ?? null;
      return {
        month: m,
        rate,
        reported: rates.has(m),
        measured: isMeasuredMonth(m, startMonth),
        streak: streaks.get(m) ?? 0,
        isTarget: isMeasuredMonth(m, startMonth) && isBoostTarget(rate),
        answer: answerByMonth.get(m) ?? null,
      };
    });

  return { store, name, months, answers: mine };
}

export interface BoostView {
  /** 選べる月（新しい順）＝月末報告書のある月 */
  months: string[];
  targets: TargetStaff[];
  questionStats: QuestionStat[];
  /** その月の回答数（照合できなかったものも含む） */
  answerCount: number;
  unmatched: UnmatchedAnswer[];
  people: PersonHistory[];
}

export function buildBoostView(params: {
  reports: ReportRow[];
  answers: BoostAnswer[];
  questionLabels: string[];
  month: string;
  staffKey: (name: string) => string;
  isRetired?: (name: string, store: string, month: string) => boolean;
  startMonth?: string;
}): BoostView {
  const { reports, answers, questionLabels, month, staffKey } = params;
  const startMonth = params.startMonth ?? BOOST_START_MONTH;
  const isRetired = params.isRetired ?? (() => false);

  const months = Array.from(new Set(reports.map((r) => r.reportMonth).filter(Boolean))).sort();

  // 人ごとの月→率
  const ratesByPerson = ratesByPersonOf(reports);

  // 照合
  const { dedupedMatched, unmatchedAll } = matchAnswers(reports, answers, staffKey);
  const submittedKeys = new Set(dedupedMatched.map((x) => `${x.key}__${x.answer.targetMonth}`));

  // 1. 対象者一覧
  const targets: TargetStaff[] = [];
  for (const [key, p] of Array.from(ratesByPerson.entries())) {
    if (!isMeasuredMonth(month, startMonth) || !p.rates.has(month)) continue;
    const rate = p.rates.get(month) ?? null;
    if (!isBoostTarget(rate)) continue;
    if (isRetired(p.name, p.store, month)) continue;
    const streak = streakByMonth(months, p.rates, startMonth).get(month) ?? 0;
    targets.push({
      store: p.store,
      name: p.name,
      rate: rate as number,
      streak,
      needsInterview: streak >= INTERVIEW_STREAK,
      submitted: submittedKeys.has(`${key}__${month}`),
    });
  }
  targets.sort((a, b) => b.streak - a.streak || a.rate - b.rate || a.store.localeCompare(b.store, "ja"));

  // 2. 項目ごとの集計（その月の回答。照合できなかった回答も点数は数える）
  const monthAnswers = [
    ...dedupedMatched.map((x) => x.answer),
    ...unmatchedAll.map((u) => u.answer),
  ].filter((a) => a.targetMonth === month);
  const questionStats: QuestionStat[] = Array.from({ length: QUESTION_COUNT }, (_, i) => {
    const vals = monthAnswers.map((a) => a.scores[i]).filter((v): v is number => v !== null && v !== undefined);
    const average = vals.length > 0 ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100 : null;
    return {
      index: i,
      label: questionLabels[i] || `Q${i + 1}`,
      count: vals.length,
      average,
      lowCount: vals.filter((v) => v <= LOW_SCORE_MAX).length,
    };
  });
  // 低い項目が上（平均が無い設問は最後）
  questionStats.sort((a, b) => {
    if (a.average === null && b.average === null) return a.index - b.index;
    if (a.average === null) return 1;
    if (b.average === null) return -1;
    return a.average - b.average || b.lowCount - a.lowCount || a.index - b.index;
  });

  // 3. 個人ごとの回答（選んだ月までの直近3回）
  const byPerson = new Map<string, PersonHistory>();
  for (const x of dedupedMatched) {
    if (x.answer.targetMonth && x.answer.targetMonth > month) continue;
    let p = byPerson.get(x.key);
    if (!p) byPerson.set(x.key, (p = { store: x.store, name: x.name, answers: [] }));
    p.answers.push(x.answer);
  }
  const people = Array.from(byPerson.values())
    .map((p) => ({
      ...p,
      answers: p.answers
        .sort((a, b) => b.targetMonth.localeCompare(a.targetMonth) || b.answerDate.localeCompare(a.answerDate))
        .slice(0, 3),
    }))
    // その月に提出した人だけ（過去分は横に並べて見る）
    .filter((p) => p.answers[0]?.targetMonth === month)
    .sort((a, b) => a.store.localeCompare(b.store, "ja") || a.name.localeCompare(b.name, "ja"));

  return {
    months: months.slice().reverse(),
    targets,
    questionStats,
    answerCount: monthAnswers.length,
    unmatched: unmatchedAll.filter((u) => !u.answer.targetMonth || u.answer.targetMonth === month),
    people,
  };
}
