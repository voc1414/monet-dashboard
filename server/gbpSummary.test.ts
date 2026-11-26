import { describe, expect, it } from "vitest";
import { STALE_DAYS, formatJst, summarize, type GbpEntry } from "../client/src/lib/gbpSummary";

const DAY = 86_400_000;
const now = new Date();
const ago = (d: number) => new Date(now.getTime() - d * DAY).toISOString();
const e = (store: string, kind: string, result: string, at: string): GbpEntry =>
  ({ at, store, kind, result, theme: "", text: "", photoUrl: "", link: "", reason: result === "公開" ? "" : "理由" });

describe("Googleマップ 院ごとの状況", () => {
  it("最後の投稿・写真と件数、正常判定", () => {
    const [s] = summarize([e("A", "投稿", "公開", ago(1)), e("A", "写真", "公開", ago(3)), e("A", "写真", "公開", ago(6))], now, ["A"]);
    expect(s.lastPost).toBe(ago(1));
    expect(s.lastPhoto).toBe(ago(3));
    expect([s.posts, s.photos]).toEqual([1, 2]);
    expect(s.alert).toBe("");
  });
  it("記録なし・止まっている・直近が停止は赤", () => {
    const rows = summarize(
      [e("B", "写真", "公開", ago(STALE_DAYS + 1)), e("C", "投稿", "公開", ago(2)), e("C", "投稿", "停止", ago(1))],
      now,
      ["A", "B", "C"],
    );
    expect(rows.map((r) => !!r.alert)).toEqual([true, true, true]);
    expect(rows[2].problem?.result).toBe("停止");
  });
  it("日本時間で表示する", () => {
    expect(formatJst("2026-11-26T00:28:00Z")).toBe("11/26(木) 09:28");
    expect(formatJst(undefined)).toBe("—");
  });
});
