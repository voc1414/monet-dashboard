import { describe, expect, it } from "vitest";
import {
  ADS_PERIOD_OPTIONS,
  DEFAULT_ADS_PERIOD,
  getDashboardData,
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
