/*
 * Googleマップ（GBP）自動更新の院ごとの状況（2026-11-26 林さん「その形で作って」）。
 * 元データは Notion「DB_monet GBP公開履歴」の写し（client/src/data/gbpHistory.ts）。
 */
export interface GbpEntry {
  /** ISO 日時 */
  at: string;
  store: string;
  kind: "投稿" | "写真" | string;
  result: "公開" | "停止" | "エラー" | string;
  theme: string;
  text: string;
  photoUrl: string;
  link: string;
  reason: string;
}

/** GBPを自動更新している院（taskSummary に置く。1日分のまとめでも同じ一覧を使うため） */
export { GBP_STORES };

import { GBP_STORES, RED_DAYS, TASKS, YELLOW_DAYS, calendarDaysLate, isScheduledGbp, scheduledTimes, type Lamp, type TaskStatus } from "./taskSummary";

/**
 * 院ごとの色も自動タスクと同じ決まり（2026-11-26 林さん「揃えて」）：
 * 最後に公開した後の、公開できていない最初の予定（月・木 10:00＋猶予）からの日数で
 * 🟢2日未満／🟡2日以上／🔴3日以上。予定が始まる前（記録を取り始める前）は灰。
 */
const GBP_DEF = TASKS.find((t) => t.source === "gbp")!;

export interface StoreStatus {
  store: string;
  lastPost?: string;
  lastPhoto?: string;
  posts: number;
  photos: number;
  /** 直近の記録が停止・エラーならその行 */
  problem?: GbpEntry;
  lamp: Lamp;
  /** 状態の一言 */
  label: string;
  /** こなせていない公開予定からの日数（遅れていなければ undefined） */
  lateDays?: number;
}

const DAY = 86_400_000;
const MIN = 60_000;

/** 自動公開が始まる前の記録（手動テスト）か */
export function isBeforeAuto(e: GbpEntry, def = GBP_DEF): boolean {
  return new Date(e.at).getTime() < new Date(def.since).getTime();
}

export function summarize(entries: GbpEntry[], now: Date, stores = GBP_STORES, def = GBP_DEF): StoreStatus[] {
  const times = scheduledTimes(def, now, 40, 0);
  const since = new Date(def.since).getTime();
  const t = now.getTime();
  return stores.map((store) => {
    const mine = entries.filter((e) => e.store === store).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)); // 日時の書式（+09:00／UTC）が混ざるので時刻で並べる
    // 件数・最後の公開は自動公開が始まってからの分だけ（開始前の手動テストは数えない）
    const auto = mine.filter((e) => !isBeforeAuto(e, def));
    const ok = auto.filter((e) => e.result === "公開");
    const lastPost = ok.find((e) => e.kind === "投稿")?.at;
    const lastPhoto = ok.find((e) => e.kind === "写真")?.at;
    const latest = auto[0];
    const problem = latest && latest.result !== "公開" ? latest : undefined;
    const base: Omit<StoreStatus, "lamp" | "label" | "lateDays"> = {
      store,
      lastPost,
      lastPhoto,
      posts: ok.filter((e) => e.kind === "投稿").length,
      photos: ok.filter((e) => e.kind === "写真").length,
      problem,
    };
    // 毎回「投稿」と「写真」を1件ずつ公開する。種類ごとに、最後に公開した後のこなせていない最初の予定を探す
    const missedOf = (last?: string) => {
      const doneAt = last ? new Date(last).getTime() : -Infinity;
      return times.find((x) => x >= since && x + def.graceMin * MIN <= t && x > doneAt + 5 * MIN);
    };
    const misses = [
      { kind: "投稿", at: missedOf(lastPost) },
      { kind: "写真", at: missedOf(lastPhoto) },
    ].filter((m) => m.at !== undefined) as { kind: string; at: number }[];
    const tests = mine.length - auto.length;
    if (!misses.length) {
      if (!ok.length) {
        const note = tests ? `（開始前のテスト ${tests}件）` : "";
        return { ...base, lamp: "gray" as Lamp, label: `自動公開は ${formatJst(def.since)} から${note}` };
      }
      return { ...base, lamp: "green" as Lamp, label: problem ? `直近が${problem.result}（${problem.kind}）` : "予定どおり" };
    }
    // 遅れている種類の、最後の失敗（停止・エラー）があれば理由として出す
    const missKinds = new Set(misses.map((m) => m.kind));
    // 最後に公開した後の失敗だけ（公開し直して解決済みの古い失敗は、今の原因として出さない）
    const lastOk = (kind: string) => (kind === "投稿" ? lastPost : lastPhoto);
    const failed = auto.find(
      (e) => missKinds.has(e.kind) && e.result !== "公開" && (!lastOk(e.kind) || Date.parse(e.at) > Date.parse(lastOk(e.kind)!)),
    );
    if (failed) base.problem = failed;
    const first = Math.min(...misses.map((m) => m.at));
    const lateDays = calendarDaysLate(first, t);
    const lamp: Lamp = lateDays >= RED_DAYS ? "red" : lateDays >= YELLOW_DAYS ? "yellow" : "green";
    // 種類ごとに日数と起点の日時を書く（投稿は0日・写真は3日のように違うとき、まとめて書かない）
    const parts = misses.map((m) => {
      const d = calendarDaysLate(m.at, t);
      const when = formatJst(new Date(m.at).toISOString());
      return d >= 1 ? `${m.kind}が${d}日遅れ（${when} から）` : `${m.kind}が未公開（${when} の分）`;
    });
    const label = parts.join("・");
    return { ...base, lamp, label, lateDays };
  });
}

/** 「11/26(木) 09:28」形式（日本時間） */
export function formatJst(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  const w = "日月火水木金土"[d.getUTCDay()];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${w}) ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

const RANK: Record<Lamp, number> = { gray: 0, green: 1, yellow: 2, red: 3 };

/**
 * Googleマップの行は、1日分のまとめではなく院ごとの判定（院×種類ごとに、最後に公開した後の未公開の予定）から決める。
 * 翌日のやり直しや予定外の追加実行で、公開済みの院まで遅れ扱いにしないため（2026-11-26 独立監査）。
 */
export function gbpTaskStatus(s: TaskStatus, stores: StoreStatus[], now: Date, def = GBP_DEF): TaskStatus {
  // Googleマップの行は、1日分のまとめではなく院ごとの判定（院×種類ごとに、最後に公開した後の未公開の予定）から決める。
  // 遅れている院と、失敗（エラー・停止）が直近にある院の両方を出す（片方だけだと帯からもう片方が消える・独立監査8回目）。
  if (!stores.some((x) => x.lamp !== "gray")) return s; // 自動公開の開始前
  const started = stores.filter((x) => x.lamp !== "gray");
  const names = (xs: StoreStatus[]) =>
    xs.length === started.length && xs.length > 1
      ? "全院"
      : `${xs.slice(0, 3).map((x) => x.store).join("・")}${xs.length > 3 ? ` ほか${xs.length - 3}院` : ""}`;
  // 理由：院ごとに1行。失敗は時刻と、定時の回か予定外かを書く（行の一言には時刻を入れない）
  const reasonOf = (xs: StoreStatus[]) =>
    xs
      .map((x) => {
        const p = x.problem;
        const fail = p ? `／${formatJst(p.at)} ${isScheduledGbp(p.at) ? "定時の回" : "予定外の実行"}で${p.result}` : "";
        return `${x.store}：${x.lateDays !== undefined ? x.label + fail : fail.slice(1)}`;
      })
      .join(" — ");
  const entry = (reason: string) => ({ ...(s.latest ?? { at: "", task: s.def.name, result: "" }), reason, count: null });
  const base = { ...s, waiting: undefined as string | undefined, expected: undefined as string | undefined };

  const late = stores
    .filter((x) => x.lateDays !== undefined)
    .sort((a, b) => RANK[b.lamp] - RANK[a.lamp] || b.lateDays! - a.lateDays!);
  const failed = stores.filter((x) => x.problem);
  const results = [...new Set(failed.map((x) => x.problem!.result))].join("・");
  const involved = [...late, ...failed.filter((x) => !late.includes(x))];

  if (late.length) {
    const max = late[0].lateDays!;
    // 「が遅れ」を2文字だけ次の行に落とさないよう、語の間に改行禁止の印（WORD JOINER）を入れる
    const latePart = `${names(late)}${max >= 1 ? "が\u2060遅れ" : "が\u2060未公開"}${max >= 1 ? `（最大${max}日）` : ""}`;
    const others = failed.filter((x) => !late.includes(x));
    const failPart = failed.length ? `・${others.length ? names(others) + "で" : ""}${results}\u2060あり` : "";
    return { ...base, latest: entry(reasonOf(involved)), lamp: late[0].lamp, lateDays: max, label: latePart + failPart };
  }
  const t = now.getTime();
  const pending = scheduledTimes(def, now, 1, 0).find((x) => x >= new Date(def.since).getTime() && x <= t && t < x + def.graceMin * MIN);
  if (failed.length) {
    return { ...base, latest: entry(reasonOf(failed)), lamp: "green", lateDays: 0, label: `${names(failed)}で${results}` };
  }
  if (pending !== undefined) {
    return { ...base, latest: entry(""), lamp: "green", lateDays: undefined, waiting: new Date(pending).toISOString(), label: `${formatJst(new Date(pending).toISOString())} の分を待っています` };
  }
  return { ...base, latest: s.latest ? { ...s.latest, result: "成功", reason: "", count: null } : s.latest, lamp: "green", lateDays: undefined, label: "成功" };
}
