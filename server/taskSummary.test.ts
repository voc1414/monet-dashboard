import { describe, expect, it } from "vitest";
import { TASKS, formatJstShort, gbpRuns, scheduledTimes, summarizeTasks, syncIsStale, type TaskDef, type TaskLogEntry } from "../client/src/lib/taskSummary";
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
    const runs = gbpRuns([g("2026-11-30T01:01:00Z", "春日院", "公開"), g("2026-11-30T01:02:00Z", "本通院", "エラー")]);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ result: "エラー", count: 1, reason: "本通院：失敗の理由" });
    const [s] = summarizeTasks([], [g("2026-11-30T01:01:00Z", "春日院", "公開")], new Date("2026-11-30T21:30:00+09:00"), [gbp]);
    expect(s.lamp).toBe("green");
  });
  it("取り込みが14時間を超えて止まっていたら気付ける", () => {
    expect(syncIsStale(new Date("2026-11-27T08:30:00+09:00"), new Date("2026-11-27T21:31:00+09:00"))).toBe(false);
    expect(syncIsStale(new Date("2026-11-27T08:30:00+09:00"), new Date("2026-11-27T22:31:00+09:00"))).toBe(true);
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
});
