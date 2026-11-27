/*
 * monet 自動タスクの総合状況（2026-11-26 林さん「この案で作って」）。
 * 元データ：
 *   - Notion「DB_monet 自動タスク実行記録」の写し（data/taskLog.ts）… Mac mini の3本＋ルーチン3本（成果物を見て記録）
 *   - Notion「DB_monet GBP公開履歴」の写し（data/gbpHistory.ts）… Googleマップ（Cloud Run）
 * 判定は「写しを作った時刻（syncedAt）」を基準にする。閲覧した時刻で判定すると、
 * 取り込み前に動いた分まで「動いていない」と赤になってしまうため。
 */
import type { GbpEntry } from "./gbpSummary";

export interface TaskLogEntry {
  /** ISO 日時 */
  at: string;
  task: string;
  result: "成功" | "要確認" | "エラー" | "停止" | "対象なし" | string;
  count: number | null;
  reason: string;
}

export interface TaskDef {
  name: string;
  /** どこで動いているか */
  where: string;
  /** 画面に出す予定の書き方 */
  scheduleLabel: string;
  /** 日本時間の時刻 "HH:MM" */
  times: string[];
  /** 日本時間の曜日（0=日）。無ければ毎日 */
  days?: number[];
  /** 予定時刻からこの分数たっても記録が無ければ「動いていない」 */
  graceMin: number;
  /** 記録を取り始めた最初の予定時刻（これより前の予定は判定しない） */
  since: string;
  /** 記録の出どころ */
  source: "log" | "gbp";
}

export const TASKS: TaskDef[] = [
  {
    name: "HPBブログ 原稿づくり",
    where: "Mac mini",
    scheduleLabel: "毎日 6:00",
    times: ["06:00"],
    graceMin: 60,
    since: "2026-11-27T06:00:00+09:00",
    source: "log",
  },
  {
    name: "サロンボード取得",
    where: "Mac mini",
    scheduleLabel: "毎日 7:30",
    times: ["07:30"],
    graceMin: 60,
    since: "2026-11-27T07:30:00+09:00",
    source: "log",
  },
  {
    name: "Googleマップ（GBP）",
    where: "クラウド",
    scheduleLabel: "月・木 10:00",
    times: ["10:00"],
    days: [1, 4],
    graceMin: 60,
    since: "2026-11-30T10:00:00+09:00",
    source: "gbp",
  },
  {
    name: "L Message集計",
    where: "ルーチン",
    // ルーチン本体は 毎日 2:00。13:30 に Mac mini（com.monet.tasklog.observe）が成果物を見て記録する
    scheduleLabel: "毎日 13:30 確認",
    times: ["13:30"],
    graceMin: 60,
    since: "2026-11-27T13:30:00+09:00",
    source: "log",
  },
  {
    name: "ブログ公開",
    where: "ルーチン",
    // ルーチン本体は 毎日 10:30。13:30 に Mac mini（com.monet.tasklog.observe）が成果物を見て記録する
    scheduleLabel: "毎日 13:30 確認",
    times: ["13:30"],
    graceMin: 60,
    since: "2026-11-27T13:30:00+09:00",
    source: "log",
  },
  {
    name: "口コミ返信",
    where: "ルーチン",
    // ルーチン本体は 毎日 12:00。13:30 に Mac mini（com.monet.tasklog.observe）が成果物を見て記録する
    scheduleLabel: "毎日 13:30 確認",
    times: ["13:30"],
    graceMin: 60,
    since: "2026-11-27T13:30:00+09:00",
    source: "log",
  },
  {
    name: "HPBブログ 予約登録",
    where: "Mac mini",
    scheduleLabel: "毎日 20:00",
    times: ["20:00"],
    // 1日27本×最大2週間分を順に予約するので長くかかる
    graceMin: 150,
    since: "2026-11-26T20:00:00+09:00",
    source: "log",
  },
];

export type OtherState = "running" | "stopped" | "scheduled" | "covered";

/**
 * 実行記録をまだ書いていないmonet関係の自動タスク。
 * 2026-10-28 に Cowork から claude.ai のルーチン（スケジュール済みタスク）へ移って動いている（一覧＝claude.ai/code/routines）。
 * 状態は 2026-11-26 にルーチン一覧と成果物を見て確かめた結果で、自動では変わらない。記録を書く仕組みを入れたら TASKS へ移す。
 */
export const OTHER_TASKS_CHECKED_ON = "2026-11-26";
export const OTHER_TASKS: { name: string; scheduleLabel: string; state: OtherState; evidence: string }[] = [
  { name: "カウンセリングシート 月次集計", scheduleLabel: "毎月1日", state: "running", evidence: "2026年5月〜10月分が入っている" },
  { name: "カウンセリングシート 四半期ダウンロード", scheduleLabel: "1・4・7・10月の1日", state: "scheduled", evidence: "次は1/1" },
  { name: "サロンボードの鮮度チェック", scheduleLabel: "毎日 10:00", state: "covered", evidence: "上の「サロンボード取得」と同じ役目" },
];

export const OTHER_STATE: Record<OtherState, { lamp: Lamp; label: string }> = {
  running: { lamp: "green", label: "動いている" },
  stopped: { lamp: "red", label: "止まっている" },
  scheduled: { lamp: "gray", label: "登録あり" },
  covered: { lamp: "gray", label: "代わりあり" },
};

export type Lamp = "green" | "yellow" | "red" | "gray";

export interface TaskStatus {
  def: TaskDef;
  lamp: Lamp;
  /** 一言の状態 */
  label: string;
  latest?: TaskLogEntry;
  /** 判定時点で、記録があるはずだった最後の予定時刻 */
  expected?: string;
  next?: string;
  /** こなせていない予定からの日数（遅れていなければ undefined）。0〜1日は緑のまま、文字で知らせる */
  lateDays?: number;
  /** 猶予の内側で、まだ記録を待っている予定 */
  waiting?: string;
}

const MIN = 60_000;
const JST = 9 * 60 * MIN;

/** 日本時間の日付 d（UTCの0時に置いた日付）と "HH:MM" から実時刻を作る */
function at(dayUtcMidnight: number, hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return dayUtcMidnight + (h * 60 + m) * MIN - JST;
}

/** 基準時刻の前後 days 日ぶんの予定時刻（昇順） */
export function scheduledTimes(def: TaskDef, base: Date, back = 10, ahead = 10): number[] {
  const j = new Date(base.getTime() + JST);
  const today = Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate());
  const out: number[] = [];
  for (let i = -back; i <= ahead; i++) {
    const day = today + i * 1440 * MIN;
    const wd = new Date(day).getUTCDay();
    if (def.days && !def.days.includes(wd)) continue;
    for (const t of def.times) out.push(at(day, t));
  }
  return out.sort((a, b) => a - b);
}

/** GBP公開履歴を「日本時間の1日＝1回の実行」にまとめる */
/** GBPを自動更新している院（monet-gbp の locations.json と同じ並び）。1回の公開で各院に「投稿」と「写真」を1件ずつ出す */
export const GBP_STORES = [
  "春日院", "本通院", "岡本院", "下伊福院", "姪浜院", "土橋院",
  "楽々園院", "福島院", "高槻院", "堀江院2nd", "堀江院",
];
const GBP_KINDS = ["投稿", "写真"];

/**
 * GBP公開履歴を「日本時間の1日＝1回の実行」にまとめる。
 * 院×種類ごとにその日の最後の結果を見る（同じ日にやり直して公開できていれば成功）。
 * 院×種類の記録が無いものも「記録なし」として失敗に数える。
 */
/** GBPの定時の回（月・木 10:00）とみなす時間帯：10:00〜12:00（日本時間）。それ以外の記録は予定外の実行 */
const GBP_RUN_START_MIN = 10 * 60;
const GBP_RUN_END_MIN = 12 * 60;

/** その記録が月・木の定時の回の時間帯か */
export function isScheduledGbp(at: string): boolean {
  const j = new Date(Date.parse(at) + JST);
  const min = j.getUTCHours() * 60 + j.getUTCMinutes();
  const wd = j.getUTCDay();
  return (wd === 1 || wd === 4) && min >= GBP_RUN_START_MIN && min < GBP_RUN_END_MIN;
}

/**
 * 「最近の記録」用に、GBP公開履歴を回ごとの事実にまとめる（定時の回と予定外の実行は別の回）。
 * ここでは「未公開」「成功」と言い切らない。公開した件数と失敗した院・時刻だけを書く。
 * 未公開かどうか（記録の欠け・遅れ）の判定は院ごとの判定（gbpSummary.summarize）だけで行う（2026-11-26 独立監査8回目）。
 */
export function gbpRuns(entries: GbpEntry[]): TaskLogEntry[] {
  const groups = new Map<string, GbpEntry[]>();
  for (const e of entries) {
    const day = new Date(Date.parse(e.at) + JST).toISOString().slice(0, 10);
    const key = `${day}-${isScheduledGbp(e.at) ? "S" : "X"}`;
    groups.set(key, [...(groups.get(key) || []), e]);
  }
  return [...groups.values()]
    .map((rows) => {
      const last = rows.reduce((m, r) => (Date.parse(r.at) > Date.parse(m) ? r.at : m), rows[0].at);
      const ok = rows.filter((r) => r.result === "公開").length;
      const bad = rows.filter((r) => r.result !== "公開").sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
      const scheduled = isScheduledGbp(rows[0].at);
      // 失敗のあとで同じ院・種類が公開できていれば、そう書き添える
      const later = (b: GbpEntry) =>
        entries.some((e) => e.store === b.store && e.kind === b.kind && e.result === "公開" && Date.parse(e.at) > Date.parse(b.at));
      const lines = bad.map((b) => `${b.store}（${b.kind}）${formatJstShort(b.at).slice(-5)} ${b.result}${later(b) ? " → のちに公開" : ""}`);
      // 定時の回は「全院×投稿・写真（22件）のうち何件を公開したか」を事実として書く。足りなければ緑にしない
      const expected = GBP_STORES.length * GBP_KINDS.length;
      const published = new Set(rows.filter((r) => r.result === "公開").map((r) => `${r.store}/${r.kind}`)).size;
      const partial = scheduled && published < expected;
      const head = scheduled
        ? `定時の回：${expected}件中 ${published}件を公開${bad.length ? `・失敗 ${bad.length}件` : ""}`
        : `予定外の実行：公開 ${ok}件${bad.length ? `・失敗 ${bad.length}件` : ""}`;
      return {
        at: last,
        task: "Googleマップ（GBP）",
        result: bad.length ? (bad.some((b) => b.result === "エラー") ? "エラー" : "停止") : partial ? "一部公開" : "公開",
        count: bad.length || partial ? null : ok,
        reason: bad.length || partial || !scheduled ? [head, ...lines].join(" — ") : "",
      };
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** 「やった」とみなす結果（要確認・対象なしも、動いて結果を出したので予定はこなした） */
const DONE = new Set(["成功", "公開", "要確認", "対象なし"]);
const DAY = 1440 * MIN;
/** 予定日からの遅れの判定（2026-11-26 林さん）：🟢予定どおり／🟡2日以上超過／🔴3日以上超過 */
export const YELLOW_DAYS = 2;
export const RED_DAYS = 3;

/** 予定日から何日たったか（日本時間の暦の日付で数える。11/26 の予定は 11/28 に「2日」） */
export function calendarDaysLate(missed: number, now: number): number {
  const day = (t: number) => Math.floor((t + 9 * 3600_000) / 86_400_000);
  return day(now) - day(missed);
}

export function summarizeTasks(log: TaskLogEntry[], gbp: GbpEntry[], syncedAt: Date, defs = TASKS): TaskStatus[] {
  return defs.map((def) => {
    const since = new Date(def.since).getTime();
    // GBP は自動公開が始まる前の記録（手動テスト）を、1日分にまとめる前に外す（同じ日に本番の回があっても混ざらない）
    const src =
      def.source === "gbp"
        ? gbpRuns(gbp.filter((e) => new Date(e.at).getTime() >= since))
        : log.filter((e) => e.task === def.name);
    // 日時の書式（+09:00／UTC）が混ざるので、文字ではなく時刻で並べる
    const mine = src.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const latest = mine[0];
    const lastDone = mine.find((e) => DONE.has(e.result));
    const times = scheduledTimes(def, syncedAt, 40, 10);
    const now = syncedAt.getTime();
    const next = times.find((t) => t > now);
    const doneAt = lastDone ? new Date(lastDone.at).getTime() : -Infinity;
    // 最後にこなした後の、こなせていない最初の予定（猶予を過ぎたもの）
    const missed = times.find((t) => t >= since && t + def.graceMin * MIN <= now && t > doneAt + 5 * MIN);
    // 猶予の内側でまだ記録が無い予定（実行中かもしれない）
    const pending = times.find((t) => t >= since && t <= now && now < t + def.graceMin * MIN && t > doneAt + 5 * MIN);
    const base = {
      def,
      latest,
      expected: missed !== undefined ? new Date(missed).toISOString() : undefined,
      next: next !== undefined ? new Date(next).toISOString() : undefined,
      waiting: pending !== undefined ? new Date(pending).toISOString() : undefined,
    };

    if (missed !== undefined) {
      const lateDays = calendarDaysLate(missed, now);
      const lamp: Lamp = lateDays >= RED_DAYS ? "red" : lateDays >= YELLOW_DAYS ? "yellow" : "green";
      const failed = latest && new Date(latest.at).getTime() >= missed - 5 * MIN && !DONE.has(latest.result) ? latest.result : undefined;
      // 括弧の中は日時だけにする（長いと 320px で括弧ごと収まらない）
      const label =
        lateDays >= 1
          ? `${lateDays}日遅れ${failed ? `・直近は${failed}` : ""}（${formatJstShort(base.expected)} から）`
          : `${failed ?? "遅れ・記録なし"}（${formatJstShort(base.expected)} の分）`;
      return { ...base, lamp, label, lateDays };
    }
    if (pending !== undefined) {
      // 猶予の内側でも、その回の記録が失敗（エラー・停止）なら待たずに失敗として出す
      // 最後にこなした後に失敗（予定外の時刻の手動実行を含む）があれば、待ち表示にせず失敗として出す
      if (latest && new Date(latest.at).getTime() > doneAt && !DONE.has(latest.result)) {
        const when = new Date(latest.at).getTime() >= pending - 5 * MIN ? `${formatJstShort(base.waiting)} の分` : `${formatJstShort(latest.at)} の実行`;
        return { ...base, lamp: "green" as Lamp, label: `${latest.result}（${when}）`, lateDays: 0 };
      }
      const prev = latest?.result === "要確認" ? "（前回は要確認）" : "";
      return { ...base, lamp: latest ? ("green" as Lamp) : ("gray" as Lamp), label: `${formatJstShort(base.waiting)} の分を待っています${prev}` };
    }
    if (!latest) {
      return { ...base, lamp: "gray", label: `記録は ${formatJstShort(def.since)} から` };
    }
    return { ...base, lamp: "green", label: latest.result };
  });
}

/** 写しが古すぎないか（取り込みは 8:30／21:30 で最大13時間空く。GitHub の定時実行の遅れを見込み16時間を超えたら止まっている） */
export const SYNC_STALE_HOURS = 16;
export function syncIsStale(syncedAt: Date, now: Date): boolean {
  return now.getTime() - syncedAt.getTime() > SYNC_STALE_HOURS * 60 * MIN;
}

export interface TaskHeadline {
  lamp: "yellow" | "red";
  text: string;
  sub: string[];
}

const FAIL_IN_LABEL = /エラー|停止/;
const SOFT_LATE = /遅れ|未公開/;

/**
 * 自動タスクページ先頭の帯。
 * 赤（取り込み停止・3日以上）と黄（2日以上）だけ帯を出す。
 * 直すことがないとき、および1日以内の遅れ・失敗・要確認だけのときは帯自体を出さない（null）。
 * 中身は各行のランプと文言に残す（2026-11-27 林さん。緑の帯は文言を変えるのではなく消す）。
 */
export function headlineForTasks(status: TaskStatus[], stale: boolean): TaskHeadline | null {
  const red = status.filter((s) => s.lamp === "red").length;
  const yellow = status.filter((s) => s.lamp === "yellow").length;
  const failed = status.filter(
    (s) => FAIL_IN_LABEL.test(s.label) || (s.lateDays === undefined && !s.waiting && FAIL_IN_LABEL.test(s.latest?.result ?? "")),
  ).length;
  const lateSoft = status.filter((s) => s.lamp === "green" && s.lateDays !== undefined && SOFT_LATE.test(s.label)).length;
  const check = status.filter((s) => s.lamp === "green" && s.lateDays === undefined && /要確認/.test(s.label)).length;
  const issues = [
    red && `3日以上の遅れ ${red}本`,
    yellow && `2日以上の遅れ ${yellow}本`,
    failed && `失敗あり ${failed}本`,
    lateSoft && `1日以内の遅れ ${lateSoft}本`,
    check && `要確認 ${check}本`,
  ].filter((x): x is string => Boolean(x));
  const total = status.filter(
    (s) =>
      s.lamp === "red" ||
      s.lamp === "yellow" ||
      s.lateDays !== undefined ||
      FAIL_IN_LABEL.test(s.label) ||
      /要確認/.test(s.label) ||
      (!s.waiting && FAIL_IN_LABEL.test(s.latest?.result ?? "")),
  ).length;
  if (stale) {
    return {
      lamp: "red",
      text: "取り込みが止まっています",
      sub: [`この画面は${SYNC_STALE_HOURS}時間以上更新されていません`, ...issues],
    };
  }
  if (red) return { lamp: "red", text: `直すことがあります（${total}本）`, sub: issues };
  if (yellow) return { lamp: "yellow", text: `確認することがあります（${total}本）`, sub: issues };
  return null;
}

/** 「11/26(木) 20:03」形式（日本時間） */
export function formatJstShort(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(new Date(iso).getTime() + JST);
  const w = "日月火水木金土"[d.getUTCDay()];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${w}) ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
