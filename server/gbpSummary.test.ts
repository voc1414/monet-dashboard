import { describe, expect, it } from "vitest";
import { formatJst, summarize, type GbpEntry } from "../client/src/lib/gbpSummary";

const e = (store: string, kind: string, result: string, at: string): GbpEntry =>
  ({ at, store, kind, result, theme: "", text: "", photoUrl: "", link: "", reason: result === "公開" ? "" : "理由" });
const at = (s: string) => new Date(s);

// 自動公開は 月・木 10:00（猶予60分）、記録の判定は 2026-11-30(月) 10:00 から
describe("Googleマップ 院ごとの状況（予定日からの遅れで色）", () => {
  it("最後の投稿・写真と件数を出す", () => {
    const [s] = summarize(
      [e("A", "投稿", "公開", "2026-11-30T01:05:00Z"), e("A", "写真", "公開", "2026-11-30T01:06:00Z"), e("A", "写真", "公開", "2026-11-26T00:28:00Z")],
      at("2026-11-30T20:00:00+09:00"),
      ["A"],
    );
    expect([s.posts, s.photos]).toEqual([1, 2]);
    expect(s.lamp).toBe("green");
  });
  it("自動公開が始まる前に記録が無い院は灰", () => {
    const [s] = summarize([], at("2026-11-28T12:00:00+09:00"), ["A"]);
    expect(s.lamp).toBe("gray");
  });
  it("公開が無いまま：2日未満は緑・2日以上は黄・3日以上は赤", () => {
    const lamp = (now: string) => summarize([e("A", "投稿", "公開", "2026-11-26T00:28:00Z")], at(now), ["A"])[0];
    expect(lamp("2026-11-30T11:01:00+09:00").lamp).toBe("green"); // 11/30 10:00 の分が無い（当日）
    expect(lamp("2026-12-02T11:01:00+09:00").lamp).toBe("yellow"); // 2日遅れ
    expect(lamp("2026-12-03T11:01:00+09:00").lamp).toBe("red"); // 3日遅れ
    expect(lamp("2026-12-03T11:01:00+09:00").label).toContain("3日遅れ");
  });
  it("月曜に公開できていれば、木曜の予定までは緑", () => {
    const [s] = summarize([e("A", "投稿", "公開", "2026-11-30T01:05:00Z")], at("2026-12-03T10:30:00+09:00"), ["A"]);
    expect(s.lamp).toBe("green");
  });
  it("直近が停止・エラーでも2日未満は緑で理由を出す", () => {
    const [s] = summarize(
      [e("A", "投稿", "公開", "2026-11-26T00:28:00Z"), e("A", "投稿", "停止", "2026-11-30T01:05:00Z")],
      at("2026-11-30T12:00:00+09:00"),
      ["A"],
    );
    expect(s.lamp).toBe("green");
    expect(s.problem?.result).toBe("停止");
  });
  it("日本時間で表示する", () => {
    expect(formatJst("2026-11-26T00:28:00Z")).toBe("11/26(木) 09:28");
    expect(formatJst(undefined)).toBe("—");
  });
});
