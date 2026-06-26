import { describe, it, expect } from "vitest";
import { aggregateStoreFromStylistCsv } from "@/hooks/useSalonBoardData";

const HEADER = "店舗,スタイリスト,年月,売上,客数,客単価,指名数,新規,再来,技術売上,店販売上";
const STORE = "monet 白髪染めと髪質改善のサロン 福島院【モネ】";

describe("aggregateStoreFromStylistCsv（店舗＝Σスタイリストの保証）", () => {
  it("同一店舗×月のスタイリスト行を合算し、店舗値＝スタイリスト合計になる", () => {
    // ¥0店販のみの「フリー」担当（技術売上0）も正しく合算されること（旧バグの回帰防止）
    const rows = [
      `"${STORE}","Yoshie",2026-06,482500,39,12372,7,18,21,480000,2500`,
      `"${STORE}","Yu",2026-06,468950,40,11724,29,12,28,461600,7350`,
      `"${STORE}","フリー",2026-06,0,7,0,0,0,7,0,0`,
    ];
    const csv = [HEADER, ...rows].join("\n");
    const agg = aggregateStoreFromStylistCsv(csv);
    expect(agg).toHaveLength(1);
    const d = agg[0];
    expect(d.storeName).toBe("福島院");
    expect(d.yearMonth).toBe("2026-06");
    // 売上 = 482500 + 468950 + 0 = 951450（＝Σスタイリスト売上）
    expect(d.totalSales).toBe(951450);
    expect(d.techSales).toBe(480000 + 461600);
    expect(d.retailSales).toBe(2500 + 7350);
    // 客数 = 39 + 40 + 7 = 86（フリーの7が欠落しないこと）
    expect(d.totalCustomers).toBe(86);
    expect(d.newCustomers).toBe(18 + 12 + 0);
    expect(d.returnCustomers).toBe(21 + 28 + 7);
    expect(d.unitPrice).toBe(Math.round(951450 / 86));
  });

  it("複数店舗・複数月を別レコードに分けて合算する", () => {
    const csv = [
      HEADER,
      `"${STORE}","A",2026-05,100000,10,10000,0,5,5,100000,0`,
      `"${STORE}","B",2026-05,50000,5,10000,0,2,3,48000,2000`,
      `"モネ-monet- 白髪染めと髪質改善のサロン　土橋院","C",2026-05,200000,20,10000,0,8,12,190000,10000`,
    ].join("\n");
    const agg = aggregateStoreFromStylistCsv(csv);
    const fukushima = agg.find((d) => d.storeName === "福島院" && d.yearMonth === "2026-05");
    const dobashi = agg.find((d) => d.storeName === "土橋院" && d.yearMonth === "2026-05");
    expect(fukushima?.totalSales).toBe(150000);
    expect(fukushima?.totalCustomers).toBe(15);
    expect(dobashi?.totalSales).toBe(200000);
    expect(dobashi?.totalCustomers).toBe(20);
  });
});
