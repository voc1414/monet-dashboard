import { describe, expect, it } from "vitest";
import { formatJst, gbpTaskStatus, summarize, type GbpEntry } from "../client/src/lib/gbpSummary";
import { GBP_STORES, TASKS, gbpRuns, summarizeTasks } from "../client/src/lib/taskSummary";

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
    // 開始前（11/26）のテスト写真は数えない
    expect([s.posts, s.photos]).toEqual([1, 1]);
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
    const [s] = summarize([e("A", "投稿", "公開", "2026-11-30T01:05:00Z"), e("A", "写真", "公開", "2026-11-30T01:06:00Z")], at("2026-12-03T10:30:00+09:00"), ["A"]);
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
  it("開始前のテスト公開は「予定どおり」にせず、灰で件数を添える", () => {
    const [s] = summarize([e("A", "写真", "公開", "2026-11-26T00:28:00Z")], at("2026-11-27T21:30:00+09:00"), ["A"]);
    expect(s.lamp).toBe("gray");
    expect(s.label).toContain("テスト 1件");
    expect(s.photos).toBe(0);
  });
  it("投稿だけ公開されて写真が止まっていれば、写真の遅れとして出す", () => {
    const [s] = summarize(
      [e("A", "投稿", "公開", "2026-11-30T01:05:00Z"), e("A", "写真", "停止", "2026-11-30T01:06:00Z"), e("A", "投稿", "公開", "2026-12-03T01:05:00Z")],
      at("2026-12-03T21:30:00+09:00"),
      ["A"],
    );
    expect(s.lamp).toBe("red");
    expect(s.label).toContain("写真");
  });
  // 全11院×投稿・写真を、指定の時刻に公開した記録
  const all = (iso: string, except: string[] = [], result = "エラー") =>
    GBP_STORES.flatMap((st) =>
      ["投稿", "写真"].map((k) => e(st, k, except.includes(st) ? result : "公開", iso)),
    );
  const row = (entries: GbpEntry[], now: string) => {
    const gbpDef = TASKS.find((t) => t.source === "gbp")!;
    const [s] = summarizeTasks([], entries, at(now), [gbpDef]);
    return gbpTaskStatus(s, summarize(entries, at(now)), at(now));
  };
  it("翌日に1院だけやり直して公開できたら、全院公開済みとして緑・成功（20件の記録なしにしない）", () => {
    const entries = [...all("2026-11-30T01:05:00Z", ["本通院"]), e("本通院", "投稿", "公開", "2026-12-01T02:00:00Z"), e("本通院", "写真", "公開", "2026-12-01T02:01:00Z")];
    const r = row(entries, "2026-12-03T08:30:00+09:00");
    expect(r.lamp).toBe("green");
    expect(r.label).toBe("成功");
    // 最近の記録の12/1（予定日でない）も、記録のある本通院だけで判定して成功
    const runs = gbpRuns(entries);
    expect(runs.find((x) => x.at.startsWith("2026-12-01"))?.result).toBe("公開");
  });
  it("予定どおり公開した後の予定外の失敗は、遅れでなく緑のまま失敗として出す", () => {
    const entries = [...all("2026-12-03T01:03:00Z"), e("春日院", "投稿", "エラー", "2026-12-03T06:00:00Z")];
    const r = row(entries, "2026-12-05T21:30:00+09:00");
    expect(r.lamp).toBe("green");
    expect(r.label).toContain("エラー");
    expect(r.latest?.reason).toContain("予定外");
  });
  it("院が遅れていれば、一番重い院を先頭に・失敗の種類も行に出す", () => {
    const entries = [...all("2026-11-30T01:05:00Z", ["堀江院"]), ...all("2026-12-03T01:05:00Z", ["堀江院", "春日院"], "停止")];
    const r = row(entries, "2026-12-03T21:30:00+09:00");
    expect(r.lamp).toBe("red");
    expect(r.label.startsWith("堀江院")).toBe(true);
    expect(r.label).toContain("停止");
  });
  it("予定外の失敗のとき、行の理由に「未公開 N件」を出さない（院ごとの表と揃える）", () => {
    const entries = [...all("2026-12-03T01:03:00Z"), e("岡本院", "投稿", "エラー", "2026-12-03T07:00:00Z")];
    const r = row(entries, "2026-12-03T21:30:00+09:00");
    expect(r.latest?.reason ?? "").not.toContain("未公開");
    expect(r.latest?.reason).toContain("岡本院");
  });
  it("院の日時が混ざっても、後の公開を最新とみなす", () => {
    const entries = [...all("2026-11-30T01:05:00Z"), e("春日院", "投稿", "エラー", "2026-12-03T23:30:00+09:00"), e("春日院", "投稿", "公開", "2026-12-03T23:00:00Z")];
    const [st] = summarize(entries, at("2026-12-04T09:00:00+09:00"), ["春日院"]);
    expect(st.problem).toBeUndefined();
  });
  it("公開の最中に失敗した院があれば、待ち表示にせず失敗として出す（帯と揃える）", () => {
    const entries = [...all("2026-12-03T01:03:00Z"), e("春日院", "投稿", "エラー", "2026-12-07T01:05:00Z")];
    const r = row(entries, "2026-12-07T10:40:00+09:00");
    expect(r.label).toContain("エラー");
    expect(r.label).toContain("春日院");
    expect(r.lateDays).toBe(0);
    expect(r.waiting).toBeUndefined();
  });
  it("公開の最中で失敗が無ければ「待っています」。前の古い遅れの文言を残さない", () => {
    const entries = [...all("2026-12-03T01:03:00Z"), e("春日院", "投稿", "停止", "2026-12-03T10:00:00Z")];
    const r = row([...entries, ...all("2026-12-07T01:05:00Z")].filter((x) => !(x.store === "本通院" && x.at.startsWith("2026-12-07"))), "2026-12-07T10:40:00+09:00");
    expect(r.label).not.toContain("遅れ");
  });
  it("遅れている院と、別の院の失敗を、行に両方出す", () => {
    const entries = [
      ...all("2026-12-03T01:03:00Z").filter((x) => !(x.store === "本通院" && x.kind === "写真")),
      e("春日院", "投稿", "エラー", "2026-12-03T06:00:00Z"),
    ];
    const r = row(entries, "2026-12-04T21:30:00+09:00");
    expect(r.label).toContain("本通院");
    expect(r.label).toContain("春日院");
    expect(r.label).toContain("エラー");
    expect(r.latest?.reason).toContain("春日院");
  });
  it("公開し直して解決済みの古い失敗は、今の遅れの原因として出さない", () => {
    const entries = [
      ...all("2026-11-30T01:05:00Z", ["本通院"]),
      e("本通院", "投稿", "公開", "2026-11-30T06:00:00Z"),
      e("本通院", "写真", "公開", "2026-11-30T06:01:00Z"),
      ...all("2026-12-03T01:05:00Z").filter((x) => x.store !== "本通院"),
    ];
    const [st] = summarize(entries, at("2026-12-04T21:30:00+09:00"), ["本通院"]);
    expect(st.lateDays).toBe(1);
    expect(st.problem).toBeUndefined();
  });
});

