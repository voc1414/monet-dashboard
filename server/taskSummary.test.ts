import { describe, expect, it } from "vitest";
import { formatJstShort, gbpRuns, scheduledTimes, summarizeTasks, syncIsStale, type TaskDef, type TaskLogEntry } from "../client/src/lib/taskSummary";
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
  it("予定の時刻＋猶予を過ぎて記録が無ければ赤（前日の記録だけ）", () => {
    const [s] = summarizeTasks([log("2026-11-27T07:39:00+09:00", "成功")], [], new Date("2026-11-28T08:31:00+09:00"), [daily]);
    expect(s.lamp).toBe("red");
    expect(s.label).toContain("11/28(土) 07:30");
  });
  it("猶予の内側ならまだ赤にしない", () => {
    const [s] = summarizeTasks([log("2026-11-27T07:39:00+09:00", "成功")], [], new Date("2026-11-28T08:20:00+09:00"), [daily]);
    expect(s.lamp).toBe("green");
  });
  it("結果に応じた色：要確認は黄・エラーと停止は赤・対象なしは灰", () => {
    const at = new Date("2026-11-27T08:30:00+09:00");
    const lamp = (r: string) => summarizeTasks([log("2026-11-27T07:40:00+09:00", r)], [], at, [daily])[0].lamp;
    expect([lamp("要確認"), lamp("エラー"), lamp("停止"), lamp("対象なし")]).toEqual(["yellow", "red", "red", "gray"]);
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
});
