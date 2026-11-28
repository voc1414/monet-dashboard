import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TASKS, formatJstShort, gbpRuns, headlineForTasks, scheduledTimes, statusDot, summarizeTasks, syncIsStale, type TaskDef, type TaskLogEntry, type TaskStatus } from "../client/src/lib/taskSummary";
import type { GbpEntry } from "../client/src/lib/gbpSummary";

const daily: TaskDef = {
  name: "サロンボード取得", where: "Mac mini", scheduleLabel: "毎日 7:30", times: ["07:30"],
  graceMin: 60, since: "2026-11-27T07:30:00+09:00", source: "log",
};
const gbp: TaskDef = {
  name: "Googleマップ（GBP）", where: "クラウド", scheduleLabel: "月・木 10:00", times: ["10:00"], days: [1, 4],
  graceMin: 60, since: "2026-11-30T10:00:00+09:00", source: "gbp",
};
const log = (at: string, result: string, count: number | null = 1, task = "サロンボード取得"): TaskLogEntry => ({ at, task, result, count, reason: result === "成功" ? "" : "理由" });
const g = (at: string, store: string, result: string): GbpEntry =>
  ({ at, store, kind: "投稿", result, theme: "", text: "", photoUrl: "", link: "", reason: result === "公開" ? "" : "失敗の理由" });

describe("自動タスク 総合", () => {
  it("記録を取り始める前は灰色", () => {
    const [s] = summarizeTasks([], [], new Date("2026-11-26T21:30:00+09:00"), [daily]);
    expect(s.lamp).toBe("gray");
    expect(formatJstShort(s.next)).toBe("11/27(金) 07:30");
  });
  it("予定どおり動いて成功なら緑", () => {
    const [s] = summarizeTasks([log("2026-11-27T07:39:00+09:00", "成功", 14)], [], new Date("2026-11-27T08:30:00+09:00"), [daily]);
    expect(s.lamp).toBe("green");
    expect(s.latest?.count).toBe(14);
  });
  it("猶予の内側ならまだ赤にしない", () => {
    const [s] = summarizeTasks([log("2026-11-27T07:39:00+09:00", "成功")], [], new Date("2026-11-28T08:20:00+09:00"), [daily]);
    expect(s.lamp).toBe("green");
  });
  it("GBPは月・木だけを予定とし、その日の公開をまとめて1回と数える", () => {
    const times = scheduledTimes(gbp, new Date("2026-11-30T12:00:00+09:00"), 3, 4).map((t) => formatJstShort(new Date(t).toISOString()));
    expect(times).toEqual(["11/30(月) 10:00", "12/3(木) 10:00"]);
    const two = ["春日院", "本通院"];
    const ph = (at: string, store: string, result: string) => ({ ...g(at, store, result), kind: "写真" });
    const runs = gbpRuns(
      [g("2026-11-30T01:01:00Z", "春日院", "公開"), ph("2026-11-30T01:01:30Z", "春日院", "公開"), g("2026-11-30T01:02:00Z", "本通院", "エラー"), ph("2026-11-30T01:02:30Z", "本通院", "公開")],
      two,
    );
    expect(runs).toHaveLength(1);
    // 1院でも未公開なら、その回は失敗。件数は出さず、理由に未公開の院を全部並べる
    expect(runs[0].result).toBe("エラー");
    expect(runs[0].count).toBeNull();
    expect(runs[0].reason).toContain("22件中 3件を公開・失敗 1件");
    expect(runs[0].reason).toContain("本通院（投稿）");
    const [s] = summarizeTasks([], [g("2026-11-30T01:01:00Z", "春日院", "公開")], new Date("2026-11-30T21:30:00+09:00"), [gbp]);
    expect(s.lamp).toBe("green");
  });
  it("取り込みが16時間を超えて止まっていたら気付ける", () => {
    expect(syncIsStale(new Date("2026-11-27T08:30:00+09:00"), new Date("2026-11-28T00:29:00+09:00"))).toBe(false);
    expect(syncIsStale(new Date("2026-11-27T08:30:00+09:00"), new Date("2026-11-28T00:31:00+09:00"))).toBe(true);
  });
  it("予定日からの遅れで色を決める：2日未満は緑・2日以上は黄・3日以上は赤", () => {
    const lamp = (now: string) => summarizeTasks([log("2026-11-27T07:39:00+09:00", "成功")], [], new Date(now), [daily])[0];
    // 11/28 7:30 の予定をこなしていない
    const d1 = lamp("2026-11-28T08:31:00+09:00");
    expect(d1.lamp).toBe("green");
    expect(d1.label).toContain("11/28(土) 07:30");
    expect(lamp("2026-11-29T08:31:00+09:00").lamp).toBe("green"); // 1日遅れ
    expect(lamp("2026-11-30T08:31:00+09:00").lamp).toBe("yellow"); // 2日遅れ
    expect(lamp("2026-12-01T08:31:00+09:00").lamp).toBe("red"); // 3日遅れ
    expect(lamp("2026-12-01T08:31:00+09:00").label).toContain("3日遅れ");
  });
  it("エラー・停止はこなしていない扱い。要確認・対象なしはこなした扱い", () => {
    const at = (r: string, now: string) => summarizeTasks([log("2026-11-27T07:40:00+09:00", r)], [], new Date(now), [daily])[0].lamp;
    expect(at("エラー", "2026-11-27T08:41:00+09:00")).toBe("green"); // 当日はまだ緑（理由は出る）
    expect(at("エラー", "2026-11-29T08:41:00+09:00")).toBe("yellow");
    expect(at("停止", "2026-11-30T08:41:00+09:00")).toBe("red");
    expect(at("要確認", "2026-11-27T08:41:00+09:00")).toBe("green");
    expect(at("対象なし", "2026-11-27T08:41:00+09:00")).toBe("green");
  });
  it("ルーチン3本は13:30の確認記録で判定する", () => {
    const blog = TASKS.find((t) => t.name === "ブログ公開")!;
    expect(blog.times).toEqual(["13:30"]);
    const ok = summarizeTasks([log("2026-11-27T13:30:05+09:00", "成功", 1, "ブログ公開")], [], new Date("2026-11-27T21:30:00+09:00"), [blog]);
    expect(ok[0].lamp).toBe("green");
    const late = summarizeTasks([log("2026-11-27T13:30:05+09:00", "成功", 1, "ブログ公開")], [], new Date("2026-11-30T14:31:00+09:00"), [blog]);
    expect(late[0].lamp).toBe("yellow");
  });
  it("1日以内の遅れは緑のままだが遅れ日数と文言で知らせる", () => {
    const [s] = summarizeTasks([log("2026-11-27T07:39:00+09:00", "成功")], [], new Date("2026-11-28T08:31:00+09:00"), [daily]);
    expect(s.lamp).toBe("green");
    expect(s.lateDays).toBe(0);
    expect(s.label).toContain("遅れ");
  });
  it("猶予の内側は「待っています」", () => {
    const [s] = summarizeTasks([log("2026-11-27T07:39:00+09:00", "成功")], [], new Date("2026-11-28T07:50:00+09:00"), [daily]);
    expect(s.label).toContain("待っています");
    expect(s.lateDays).toBeUndefined();
  });
  it("GBPは自動公開が始まる前の記録（手動テスト）を成功に数えない", () => {
    const test = g("2026-11-26T00:28:00Z", "堀江院", "公開");
    const [s] = summarizeTasks([], [test], new Date("2026-11-27T21:30:00+09:00"), [gbp]);
    expect(s.lamp).toBe("gray");
    expect(s.latest).toBeUndefined();
  });
  it("猶予の内側でも、その回が失敗なら「待っています」にしない", () => {
    const hpb = TASKS.find((t) => t.name === "HPBブログ 予約登録")!;
    const [s] = summarizeTasks(
      [log("2026-12-02T20:40:00+09:00", "成功", 1, hpb.name), log("2026-12-03T20:40:00+09:00", "エラー", null, hpb.name)],
      [], new Date("2026-12-03T21:30:00+09:00"), [hpb],
    );
    expect(s.label).toContain("エラー");
    expect(s.label).not.toContain("待っています");
    expect(s.lateDays).toBe(0);
  });
  it("遅れは暦の日付で数える（11/26 20:00 の分は 11/28 に2日）", () => {
    const hpb = TASKS.find((t) => t.name === "HPBブログ 予約登録")!;
    const [s] = summarizeTasks([log("2026-11-25T20:40:00+09:00", "成功", 1, hpb.name)], [], new Date("2026-11-28T08:30:00+09:00"), [hpb]);
    expect(s.lateDays).toBe(2);
    expect(s.lamp).toBe("yellow");
  });
  it("GBP：定時の回（10:00〜12:00）と、その後のやり直しは別の回として並べる", () => {
    const ph = (at: string, store: string, result: string) => ({ ...g(at, store, result), kind: "写真" });
    const runs = gbpRuns([g("2026-12-03T01:03:00Z", "春日院", "エラー"), ph("2026-12-03T01:04:00Z", "春日院", "公開"), g("2026-12-03T05:00:00Z", "春日院", "公開")], ["春日院"]);
    expect(runs).toHaveLength(2);
    // 新しい順：14:00 のやり直しは成功、10:03 の定時の回はエラー
    expect(runs[0].result).toBe("公開");
    expect(runs[0].reason).toContain("予定外");
    // 10:03 の失敗には「のちに公開」と書き添える
    expect(runs[1].reason).toContain("のちに公開");
    expect(runs[1].result).toBe("エラー");
    expect(runs[1].reason).toContain("定時の回");
  });
  it("GBP：定時の回の最中（猶予の内側）は、まだ記録の無い院を未公開と数えない", () => {
    const runs = gbpRuns([g("2026-12-07T01:05:00Z", "春日院", "公開")], ["春日院", "本通院"], Date.parse("2026-12-07T10:40:00+09:00"));
    expect(runs[0].reason).not.toContain("記録なし");
  });
  it("GBP：最近の記録は事実だけ（院の記録が欠けていても「未公開」と言い切らない・判定は院ごとの表で行う）", () => {
    const ph = (at: string, store: string, result: string) => ({ ...g(at, store, result), kind: "写真" });
    const runs = gbpRuns([g("2026-12-03T01:03:00Z", "春日院", "公開"), ph("2026-12-03T01:04:00Z", "春日院", "公開")]);
    // 定時の回で22件そろっていなければ、緑の「公開」にせず「一部公開」と件数で書く
    expect(runs[0].result).toBe("一部公開");
    expect(runs[0].reason).toContain("22件中 2件を公開");
    expect(runs[0].reason).not.toContain("未公開");
  });
  it("予定外の時刻の失敗は、待ち表示の間も失敗として出す", () => {
    const hpb = TASKS.find((t) => t.name === "HPBブログ 予約登録")!;
    const [s] = summarizeTasks(
      [log("2026-12-02T20:40:00+09:00", "成功", 1, hpb.name), log("2026-12-03T15:00:00+09:00", "エラー", null, hpb.name)],
      [], new Date("2026-12-03T21:30:00+09:00"), [hpb],
    );
    expect(s.label).toContain("エラー");
    expect(s.label).not.toContain("待っています");
  });
  it("直近がエラーなら遅れが1日以内でも状態の点は黄。ランプは緑のままなので文字の赤と帯は変わらない", () => {
    const sameDay = summarizeTasks([log("2026-11-27T07:40:00+09:00", "エラー")], [], new Date("2026-11-27T08:41:00+09:00"), [daily])[0];
    expect(sameDay.lamp).toBe("green");
    expect(sameDay.lateDays).toBe(0);
    expect(sameDay.latest?.result).toBe("エラー");
    expect(statusDot(sameDay)).toBe("yellow");
    expect(headlineForTasks([sameDay], false)).toBeNull();

    const withinGrace = summarizeTasks([log("2026-11-27T07:40:00+09:00", "エラー")], [], new Date("2026-11-27T08:00:00+09:00"), [daily])[0];
    expect(withinGrace.lamp).toBe("green");
    expect(statusDot(withinGrace)).toBe("yellow");

    const oneDay = summarizeTasks([log("2026-11-27T07:40:00+09:00", "エラー")], [], new Date("2026-11-28T08:41:00+09:00"), [daily])[0];
    expect(oneDay.lateDays).toBe(1);
    expect(oneDay.lamp).toBe("green");
    expect(statusDot(oneDay)).toBe("yellow");

    const stopped = summarizeTasks([log("2026-11-27T07:40:00+09:00", "停止")], [], new Date("2026-11-27T08:41:00+09:00"), [daily])[0];
    expect(stopped.lamp).toBe("green");
    expect(statusDot(stopped)).toBe("green");

    const okLate = summarizeTasks([log("2026-11-27T07:39:00+09:00", "成功")], [], new Date("2026-11-28T08:31:00+09:00"), [daily])[0];
    expect(statusDot(okLate)).toBe("green");

    const red = summarizeTasks([log("2026-11-27T07:40:00+09:00", "エラー")], [], new Date("2026-11-30T08:41:00+09:00"), [daily])[0];
    expect(red.lamp).toBe("red");
    expect(statusDot(red)).toBe("red");
  });
  it("日時の書き方が混ざっても（+09:00 と UTC）時刻の順で最新を選ぶ", () => {
    const hpb = TASKS.find((t) => t.name === "HPBブログ 予約登録")!;
    // 20:10 にエラー（+09:00）、23:50 に再試行して成功（UTC で 14:50Z）
    const [s] = summarizeTasks(
      [log("2026-12-03T20:10:00+09:00", "エラー", null, hpb.name), log("2026-12-03T14:50:00Z", "成功", 1, hpb.name)],
      [], new Date("2026-12-04T08:30:00+09:00"), [hpb],
    );
    expect(s.latest?.result).toBe("成功");
    expect(s.lamp).toBe("green");
    expect(s.label).toBe("成功");
  });
});

const sampleDef: TaskDef = {
  name: "サンプル", where: "試験", scheduleLabel: "毎日 7:30", times: ["07:30"],
  graceMin: 60, since: "2026-11-01T00:00:00+09:00", source: "log",
};
function row(over: Partial<TaskStatus> & Pick<TaskStatus, "lamp" | "label">): TaskStatus {
  return { def: sampleDef, ...over };
}

describe("自動タスク先頭の帯", () => {
  it("直すことがなければ帯自体を出さない", () => {
    expect(headlineForTasks([row({ lamp: "green", label: "成功" })], false)).toBeNull();
  });

  it("1日以内の遅れ・失敗・要確認だけでも帯を出さない", () => {
    const soft = [
      row({ lamp: "green", label: "1日遅れ（11/26(木) 21:30 から）", lateDays: 1 }),
      row({ lamp: "green", label: "エラー（11/27(金) 07:30 の分）", lateDays: 0, latest: { at: "2026-11-27T07:40:00+09:00", task: "サンプル", result: "エラー", count: null, reason: "落ちた" } }),
      row({ lamp: "green", label: "要確認" }),
    ];
    expect(headlineForTasks(soft, false)).toBeNull();
  });

  it("赤と黄の帯は本数と内訳を残す", () => {
    const red = headlineForTasks([
      row({ lamp: "red", label: "3日遅れ（11/24(火) 21:30 から）", lateDays: 3 }),
      row({ lamp: "green", label: "1日遅れ（11/26(木) 21:30 から）", lateDays: 1 }),
    ], false);
    expect(red.lamp).toBe("red");
    expect(red.text).toBe("直すことがあります（2本）");
    expect(red.sub).toContain("3日以上の遅れ 1本");
    expect(red.sub).toContain("1日以内の遅れ 1本");

    const yellow = headlineForTasks([
      row({ lamp: "yellow", label: "2日遅れ（11/25(水) 21:30 から）", lateDays: 2 }),
    ], false);
    expect(yellow).toEqual({
      lamp: "yellow",
      text: "確認することがあります（1本）",
      sub: ["2日以上の遅れ 1本"],
    });
  });

  it("記録をまだ書いていない欄は画面から消している", () => {
    const src = readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/AutoTasks.tsx"), "utf8");
    expect(src).not.toContain("記録をまだ書いていない");
    expect(src).not.toContain("OTHER_TASKS");
    expect(src).toContain('data-testid="tasks-recent"');
    expect(src).toContain("statusDot");
    expect(src).toContain("text-red-700");
  });

  it("取り込みが止まっていれば赤のまま", () => {
    const h = headlineForTasks([row({ lamp: "green", label: "成功" })], true);
    expect(h.lamp).toBe("red");
    expect(h.text).toBe("取り込みが止まっています");
    expect(h.sub[0]).toContain("16時間以上更新されていません");
  });
});

