import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADS_PERIOD_OPTIONS,
  DEFAULT_ADS_PERIOD,
  formatLineWindowNote,
  getDashboardData,
  getLmessageData,
  kyujinAreaLineTotal,
  kyujinOtherSummary,
  kyujinOtherTotal,
  lineRegistrationTotal,
  missingDatesInSpan,
  resolvePeriod,
  type LmsgRow,
  type MonetRow,
  type RawAds,
} from "../client/src/hooks/useAdsData";

const TODAY = new Date(2026, 10, 27); // 2026-11-27

function monet(date: string, spend: number, lead: number): MonetRow {
  return {
    date,
    kubun: "直営",
    region: "大阪",
    tenpo: "堀江院",
    camp: "集客/モネ/大阪/リード/直営",
    adset: "堀江",
    spend,
    lead,
    freq: 1,
    impr: 100,
    click: 10,
  };
}

function line(date: string, count: number): LmsgRow {
  return {
    date,
    botId: "b",
    botName: "monet",
    category: "集客",
    tagId: "t",
    tagName: "大阪堀江流入",
    count,
  };
}

function raw(rows: MonetRow[], lmessage: LmsgRow[]): RawAds {
  return { monet: rows, lmessage, adsetMeta: {} };
}

function ymds(from: string, to: string, skip: string[]): string[] {
  const out: string[] = [];
  const p = from.split("-").map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  for (let i = 0; i < 400; i++) {
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!skip.includes(s)) out.push(s);
    if (s >= to) break;
    d.setDate(d.getDate() + 1);
  }
  return out;
}

describe("広告の期間", () => {
  it("初期値は過去30日で、選択肢に過去7日・今月・先月がある", () => {
    expect(DEFAULT_ADS_PERIOD).toBe("30");
    const labels = ADS_PERIOD_OPTIONS.map((o) => o.label);
    expect(labels).toEqual(expect.arrayContaining(["過去7日", "過去30日", "今月", "先月"]));
  });

  it("過去30日は昨日までの30日。当日は入らない", () => {
    const p = resolvePeriod("30", TODAY);
    expect(p).toMatchObject({
      label: "過去30日",
      value: "30",
      sinceStr: "2026-10-28",
      untilStr: "2026-11-26",
      prevSinceStr: "2026-09-28",
      prevUntilStr: "2026-10-27",
      days: 30,
    });
    expect(resolvePeriod("7", TODAY)).toMatchObject({
      sinceStr: "2026-11-20",
      untilStr: "2026-11-26",
      days: 7,
    });
    expect(resolvePeriod("7", new Date(2026, 0, 1))).toMatchObject({
      sinceStr: "2025-12-25",
      untilStr: "2025-12-31",
    });
  });

  it("今月は当月1日から今日、先月は前月の丸ごと", () => {
    expect(resolvePeriod("this-month", TODAY)).toMatchObject({
      label: "今月",
      sinceStr: "2026-11-01",
      untilStr: "2026-11-27",
    });
    expect(resolvePeriod("last-month", TODAY)).toMatchObject({
      label: "先月",
      sinceStr: "2026-10-01",
      untilStr: "2026-10-31",
    });
  });

  it("合計・店舗行・LINE登録は選んだ期間だけを足す", () => {
    const data = raw(
      [
        monet("2026-10-15", 999, 9),
        monet("2026-11-01", 10, 1),
        monet("2026-11-26", 20, 2),
        monet("2026-11-27", 999, 9),
      ],
      [line("2026-09-30", 80), line("2026-10-27", 100), line("2026-11-26", 140), line("2026-11-27", 155)],
    );
    const last30 = getDashboardData(data, "30", TODAY);
    expect(last30.cur.shukyaku.spend).toBe(30);
    expect(last30.cur.shukyaku.lead).toBe(3);
    expect(last30.chokuei.find((s) => s.name === "堀江院")?.shukyaku.spend).toBe(30);
    expect(last30.lmessage.byStoreShort["大阪堀江"]).toBe(40);
    expect(last30.series.labels).toEqual(["2026-11-01", "2026-11-26"]);

    const lastMonth = getDashboardData(data, "last-month", TODAY);
    expect(lastMonth.cur.shukyaku.spend).toBe(999);
    expect(lastMonth.lmessage.byStoreShort["大阪堀江"]).toBe(20);
  });

  it("LINE登録の抜けは選択期間の中だけを出す", () => {
    const dates = ymds("2026-10-01", "2026-11-27", ["2026-10-02", "2026-11-19"]);
    expect(missingDatesInSpan(dates, "2026-10-28", "2026-11-26")).toEqual(["2026-11-19"]);
    expect(missingDatesInSpan(dates, "2026-10-01", "2026-10-31")).toEqual(["2026-10-02"]);
  });
});

const SINCE = "2026-11-21";
const UNTIL = "2026-11-27";

function daysOf(from: string, to: string, skip: string[] = []): string[] {
  const out: string[] = [];
  const p = from.split("-").map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  for (let i = 0; i < 40; i++) {
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!skip.includes(s)) out.push(s);
    if (s >= to) break;
    d.setDate(d.getDate() + 1);
  }
  return out;
}

describe("LINE登録の欠損", () => {
  it("端が欠損すると、実際に使った起点・終点と日数を返し、消化額とリードもその日で数える", () => {
    // 11/28 の過去7日は 11/21〜11/27。起点の 11/20 が無いので 11/19 の行を使い、11/20〜11/27 の8日分。
    const counts: Record<string, number> = { "2026-11-19": 100, "2026-11-27": 140 };
    const rows = daysOf("2026-11-19", "2026-11-27", ["2026-11-20"]).map((date) =>
      line(date, counts[date] ?? 110),
    );
    const lm = getLmessageData(rows, SINCE, UNTIL);
    expect(lm.byStoreShort["大阪堀江"]).toBe(40);
    expect(lm.window).toMatchObject({
      baselineDate: "2026-11-19",
      endDate: "2026-11-27",
      countedSince: "2026-11-20",
      countedUntil: "2026-11-27",
      countedDays: 8,
      edgeShifted: true,
      missingEdges: ["2026-11-20"],
    });
    expect(formatLineWindowNote(lm.window)).toBe("11/20の行なし。LINE登録は11/20〜11/27の8日分で計算");

    const data = raw(
      [
        monet("2026-11-20", 1000, 10),
        monet("2026-11-21", 100, 1),
        monet("2026-11-27", 200, 2),
      ],
      rows,
    );
    const dash = getDashboardData(data, "7", new Date(2026, 10, 28));
    expect(dash.period).toMatchObject({ since: SINCE, until: UNTIL });
    expect(dash.cur.shukyaku.spend).toBe(300);
    expect(dash.cur.shukyaku.lead).toBe(3);
    expect(dash.lineAligned.shukyaku.spend).toBe(1300);
    expect(dash.lineAligned.shukyaku.lead).toBe(13);
    expect(dash.lineAligned.shukyakuByStore["堀江院"]).toEqual({ spend: 1300, lead: 13 });
  });

  it("途中だけの欠損は合計を変えず、端の日付もずらさない", () => {
    const holed = daysOf("2026-11-20", "2026-11-27", ["2026-11-24"]).map((date, i) => line(date, 100 + i * 5));
    const filled = daysOf("2026-11-20", "2026-11-27").map((date) => {
      const hit = holed.find((r) => r.date === date);
      if (hit) return hit;
      const prev = [...holed].reverse().find((r) => r.date < date);
      return line(date, prev ? prev.count : 100);
    });
    const a = getLmessageData(holed, SINCE, UNTIL);
    const b = getLmessageData(filled, SINCE, UNTIL);
    expect(a.byStoreShort["大阪堀江"]).toBe(b.byStoreShort["大阪堀江"]);
    expect(a.window.edgeShifted).toBe(false);
    expect(a.window.missingEdges).toEqual([]);
    expect(a.window.countedSince).toBe(SINCE);
    expect(a.window.countedUntil).toBe(UNTIL);
    expect(a.window.countedDays).toBe(7);
    expect(formatLineWindowNote(a.window)).toBeNull();
    expect(missingDatesInSpan(holed.map((r) => r.date), SINCE, UNTIL)).toEqual(["2026-11-24"]);
  });

  it("欠損が無いときは選択期間の前日と終了日の行を使う", () => {
    const rows = daysOf("2026-11-20", "2026-11-27").map((date, i) => line(date, 100 + i * 10));
    const lm = getLmessageData(rows, SINCE, UNTIL);
    expect(lm.byStoreShort["大阪堀江"]).toBe(70);
    expect(lm.window).toMatchObject({
      baselineDate: "2026-11-20",
      endDate: UNTIL,
      countedSince: SINCE,
      countedUntil: UNTIL,
      countedDays: 7,
      edgeShifted: false,
      missingEdges: [],
    });
    expect(formatLineWindowNote(lm.window)).toBeNull();
    expect(missingDatesInSpan(rows.map((r) => r.date), SINCE, UNTIL)).toEqual([]);
  });

  it("集客でも _ で始まる試験タグは足さない", () => {
    const rows = [
      line("2026-11-20", 100),
      line("2026-11-27", 170),
      { ...line("2026-11-20", 1), tagId: "ping", tagName: "_ping2" },
      { ...line("2026-11-27", 9), tagId: "ping", tagName: "_ping2" },
    ];
    const lm = getLmessageData(rows, SINCE, UNTIL);
    expect(lm.byStoreShort["大阪堀江"]).toBe(70);
    expect(lm.byStoreShort["_ping2"]).toBeUndefined();
    expect(lm.kyujinOther).toEqual([]);
  });
});

function kyujin(date: string, count: number, tagName: string, tagId: string, botId = "2E6jG1"): LmsgRow {
  return {
    date,
    botId,
    botName: "求人",
    category: "求人",
    tagId,
    tagName,
    count,
  };
}

describe("求人のエリアなし流入", () => {
  function rows(): LmsgRow[] {
    return [
      kyujin("2026-11-20", 10, "大阪流入", "osaka"),
      kyujin("2026-11-27", 18, "大阪流入", "osaka"),
      kyujin("2026-11-20", 1, "神戸流入", "kobe"),
      kyujin("2026-11-27", 4, "神戸流入", "kobe"),
      kyujin("2026-11-20", 100, "ウェビナー流入", "2523411"),
      kyujin("2026-11-27", 108, "ウェビナー流入", "2523411"),
      kyujin("2026-11-20", 50, "IGストーリー流入", "2626811"),
      kyujin("2026-11-27", 55, "IGストーリー流入", "2626811"),
      // 名前をコードに書いていなくても、エリアが決まらなければその他へ
      kyujin("2026-11-20", 0, "会社説明会流入", "future", "another-bot"),
      kyujin("2026-11-27", 2, "会社説明会流入", "future", "another-bot"),
      kyujin("2026-11-20", 5, "空の説明会流入", "zero"),
      kyujin("2026-11-27", 5, "空の説明会流入", "zero"),
      kyujin("2026-11-20", 1, "_社内テスト", "ping"),
      kyujin("2026-11-27", 9, "_社内テスト", "ping"),
      { ...line("2026-11-20", 20), tagName: "ウェビナー流入", tagId: "shu-web" },
      { ...line("2026-11-27", 23), tagName: "ウェビナー流入", tagId: "shu-web" },
    ];
  }

  it("都道府県も都市名も無い求人タグはエリアに足さず、その他に分ける", () => {
    const lm = getLmessageData(rows(), SINCE, UNTIL);
    expect(lm.byRegion["大阪エリア"]).toBe(8);
    expect(lm.byRegion["兵庫エリア"]).toBe(3);
    expect(kyujinAreaLineTotal(lm.byRegion)).toBe(11);
    expect(lm.byRegion["その他"]).toBeUndefined();
    expect(lm.byRegion["その他（エリアなし）"]).toBeUndefined();
    expect(lm.kyujinOther).toEqual([
      { tagId: "2523411", tagName: "ウェビナー流入", count: 8 },
      { tagId: "2626811", tagName: "IGストーリー流入", count: 5 },
      { tagId: "future", tagName: "会社説明会流入", count: 2 },
    ]);
    expect(lm.kyujinOther.some((t) => t.tagName.startsWith("_"))).toBe(false);
    expect(lm.kyujinOther.some((t) => t.tagName === "空の説明会流入")).toBe(false);
    // 集客の同名タグは店舗側のまま。求人のその他には混ぜない
    expect(lm.byStoreShort["ウェビナー"]).toBe(3);
    expect(lm.kyujinOther.filter((t) => t.tagId === "shu-web")).toEqual([]);
  });

  it("その他は全体のLINE登録・エリア合計・単価の分子に入らない", () => {
    const lm = getLmessageData(rows(), SINCE, UNTIL);
    const area = kyujinAreaLineTotal(lm.byRegion);
    const other = kyujinOtherTotal(lm.kyujinOther);
    const total = lineRegistrationTotal(lm);
    expect(other).toBe(15);
    expect(total).toBe(area + 3);
    expect(total).not.toBe(area + other + 3);
    const spend = 30000;
    expect(Math.round(spend / total)).not.toBe(Math.round(spend / (total + other)));
    expect(kyujinOtherSummary(lm.kyujinOther)).toBe("その他（エリアなし） 15人");
    expect(kyujinOtherSummary(lm.kyujinOther)).not.toContain("ウェビナー");
    expect(kyujinOtherSummary([])).toBeNull();
    expect(kyujinOtherSummary([{ tagId: "a", tagName: "増えていない流入", count: 0 }])).toBeNull();

    const dash = getDashboardData(raw([], rows()), "7", new Date(2026, 10, 28));
    expect(dash.lmessage.kyujinOther.map((t) => t.tagId)).toEqual(["2523411", "2626811", "future"]);
    expect(lineRegistrationTotal(dash.lmessage)).toBe(total);
    expect(kyujinAreaLineTotal(dash.lmessage.byRegion)).toBe(area);
  });

  it("数字の定義にその他を合計へ含めないと書き、0人のときは帯を出さない", () => {
    const ads = readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/Ads.tsx"), "utf8");
    expect(ads).toContain(
      "その他（エリアなし）は求人のエリア合計・全体のLINE登録合計・登録単価・登録率に含めない",
    );
    const start = ads.indexOf("function KyujinOtherNote");
    const end = ads.indexOf("// キャンペーン別/広告セット別テーブル");
    const fn = ads.slice(start, end);
    expect(fn).toContain("if (!summary) return null");
    expect(fn).toContain("<details");
    expect(fn).toContain("<summary");
    expect(fn).toContain("kyujinOtherSummary");
    expect(fn).not.toMatch(/emerald|bg-green|text-green/);
    expect(ads).toContain("{showKyujin && <KyujinOtherNote lines={D.lmessage.kyujinOther} />}");
    expect(ads).toContain("const lineTot = lineRegistrationTotal(D.lmessage)");
  });
});
