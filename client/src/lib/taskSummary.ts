/*
 * monet 自動タスクの総合状況（2026-11-26 林さん「この案で作って」）。
 * 元データ：
 *   - Notion「DB_monet 自動タスク実行記録」の写し（data/taskLog.ts）… Mac mini の3本
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
  { name: "monet-gokan.com ブログ公開", scheduleLabel: "毎日 10:30", state: "running", evidence: "11/24・25・26に公開あり" },
  { name: "L Message 流入タグの集計", scheduleLabel: "毎日 2:00", state: "running", evidence: "広告画面に過去7日のLINE登録212件" },
  { name: "口コミ返信（Google・サロンボード）", scheduleLabel: "毎日 12:00", state: "running", evidence: "11/26まで実行ログに成功" },
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
export function gbpRuns(entries: GbpEntry[]): TaskLogEntry[] {
  const byDay = new Map<string, GbpEntry[]>();
  for (const e of entries) {
    const day = new Date(new Date(e.at).getTime() + JST).toISOString().slice(0, 10);
    byDay.set(day, [...(byDay.get(day) || []), e]);
  }
  return [...byDay.values()]
    .map((rows) => {
      const last = rows.map((r) => r.at).sort().pop()!;
      const bad = rows.find((r) => r.result === "エラー") || rows.find((r) => r.result === "停止");
      const ok = rows.filter((r) => r.result === "公開").length;
      return {
        at: last,
        task: "Googleマップ（GBP）",
        result: bad ? bad.result : "成功",
        count: ok,
        reason: bad ? `${bad.store}：${bad.reason}` : "",
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

const LAMP_OF: Record<string, Lamp> = { 成功: "green", 要確認: "yellow", エラー: "red", 停止: "red", 対象なし: "gray" };

export function summarizeTasks(log: TaskLogEntry[], gbp: GbpEntry[], syncedAt: Date, defs = TASKS): TaskStatus[] {
  const gbpLog = gbpRuns(gbp);
  return defs.map((def) => {
    const mine = (def.source === "gbp" ? gbpLog : log.filter((e) => e.task === def.name)).sort((a, b) =>
      b.at.localeCompare(a.at),
    );
    const latest = mine[0];
    const times = scheduledTimes(def, syncedAt);
    const since = new Date(def.since).getTime();
    const now = syncedAt.getTime();
    const due = times.filter((t) => t >= since && t + def.graceMin * MIN <= now).pop();
    const next = times.find((t) => t > now);
    const expected = due !== undefined ? new Date(due).toISOString() : undefined;
    const base = { def, latest, expected, next: next !== undefined ? new Date(next).toISOString() : undefined };

    // 予定の時刻を過ぎたのに、その時刻以降の記録が無い＝動いていない
    if (due !== undefined && (!latest || new Date(latest.at).getTime() < due - 5 * MIN)) {
      return { ...base, lamp: "red", label: `${formatJstShort(expected)} の実行記録がない` };
    }
    if (!latest) {
      return { ...base, lamp: "gray", label: `記録は ${formatJstShort(def.since)} から` };
    }
    return { ...base, lamp: LAMP_OF[latest.result] || "yellow", label: latest.result };
  });
}

/** 写しが古すぎないか（1日2回の取り込みなので14時間を超えたら止まっている） */
export const SYNC_STALE_HOURS = 14;
export function syncIsStale(syncedAt: Date, now: Date): boolean {
  return now.getTime() - syncedAt.getTime() > SYNC_STALE_HOURS * 60 * MIN;
}

/** 「11/26(木) 20:03」形式（日本時間） */
export function formatJstShort(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(new Date(iso).getTime() + JST);
  const w = "日月火水木金土"[d.getUTCDay()];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${w}) ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
