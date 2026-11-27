import { describe, expect, it } from "vitest";
import type { LmsgRow, MonetRow } from "../client/src/hooks/useAdsData";
import {
  LINE_DROP_HINT,
  detectLineRegistrationDrops,
  formatLineDrop,
} from "../client/src/lib/lineDropWarning";

const TODAY = "2026-11-27";

function lead(date: string, store: string, n: number, camp = "モネ/福岡エリア/集客/FC"): MonetRow {
  return { date, kubun: "FC", region: "福岡エリア", tenpo: store, camp, adset: "", lead: n, spend: 0, freq: 0, impr: 0, click: 0 };
}
function line(date: string, tagName: string, count: number, tagId = tagName): LmsgRow {
  return { date, botId: "b", botName: "", category: "集客", tagId, tagName, count };
}

describe("LINE登録の急落", () => {
  it("姪浜院：11/24〜26 がリード11・登録0なら赤（当日の登録は数えない）", () => {
    const monet = [
      lead("2026-11-24", "姪浜院", 4),
      lead("2026-11-25", "姪浜院", 1),
      lead("2026-11-26", "姪浜院", 6),
      lead("2026-11-27", "姪浜院", 4),
    ];
    const lmessage = [
      line("2026-11-23", "福岡姪浜流入", 1176),
      line("2026-11-26", "福岡姪浜流入", 1176),
      line("2026-11-27", "福岡姪浜流入", 1179),
    ];
    const [w] = detectLineRegistrationDrops(monet, lmessage, TODAY);
    expect(w.store).toBe("姪浜院");
    expect(w.zero3).toBe(true);
    expect(w.leads3).toBe(11);
    expect(w.regs3).toBe(0);
    expect(formatLineDrop(w)).toContain("姪浜院：直近3日 リード11・登録0");
    expect(LINE_DROP_HINT).toBe("LINEのタグ（区分＝集客）の振り分けを確認");
  });

  it("直近3日のリードが5未満、または登録が1件でもあればゼロ警告にしない", () => {
    const few = detectLineRegistrationDrops(
      [lead("2026-11-26", "春日院", 4)],
      [line("2026-11-23", "福岡春日流入", 10), line("2026-11-26", "福岡春日流入", 10)],
      TODAY,
    );
    expect(few).toEqual([]);
    const some = detectLineRegistrationDrops(
      [lead("2026-11-26", "春日院", 8)],
      [line("2026-11-23", "福岡春日流入", 10), line("2026-11-26", "福岡春日流入", 11)],
      TODAY,
    );
    expect(some).toEqual([]);
  });

  it("直近7日の登録率が、その前21日の半分未満（前の期間リード10以上）なら赤", () => {
    const monet: MonetRow[] = [];
    // その前21日は 10/30〜11/19。ここへリード20・登録10（50%）
    monet.push(lead("2026-10-30", "福島院", 1), lead("2026-10-31", "福島院", 1));
    for (let d = 1; d <= 18; d++) monet.push(lead(`2026-11-${String(d).padStart(2, "0")}`, "福島院", 1));
    // 直近7日 11/20〜11/26 はリード10・登録2（20% < 25%）
    for (let d = 20; d <= 25; d++) monet.push(lead(`2026-11-${d}`, "福島院", 1));
    monet.push(lead("2026-11-26", "福島院", 4));
    const lmessage = [
      line("2026-10-29", "大阪福島流入", 0),
      line("2026-11-19", "大阪福島流入", 10),
      line("2026-11-26", "大阪福島流入", 12),
    ];
    const [w] = detectLineRegistrationDrops(monet, lmessage, TODAY);
    expect(w.store).toBe("福島院");
    expect(w.half7).toBe(true);
    expect(w.zero3).toBe(false);
    expect(w.leadsPrev21).toBe(20);
    expect(w.regsPrev21).toBe(10);
    expect(w.leads7).toBe(10);
    expect(w.regs7).toBe(2);
    expect(w.rate7).toBeLessThan((w.ratePrev21 ?? 0) / 2);
  });

  it("前の期間のリードが10未満なら率の低下では警告しない", () => {
    const monet = [
      lead("2026-11-19", "高槻院", 9),
      lead("2026-11-20", "高槻院", 10),
      lead("2026-11-26", "高槻院", 4),
    ];
    const lmessage = [
      line("2026-11-18", "大阪高槻流入", 0),
      line("2026-11-19", "大阪高槻流入", 9),
      line("2026-11-26", "大阪高槻流入", 9),
    ];
    expect(detectLineRegistrationDrops(monet, lmessage, TODAY)).toEqual([]);
  });

  it("半分ちょうどは警告しない。求人のリードと求人タグは集客に入れない", () => {
    const monet = [
      lead("2026-11-10", "本通院", 10, "モネ/広島エリア/求人/直営"),
      lead("2026-11-26", "本通院", 10, "モネ/広島エリア/求人/直営"),
      lead("2026-11-19", "本通院", 10),
      lead("2026-11-26", "本通院", 4),
    ];
    const lmessage = [
      line("2026-11-18", "広島本通流入", 0),
      line("2026-11-19", "広島本通流入", 5),
      line("2026-11-26", "広島本通流入", 7),
      line("2026-11-26", "求人用", 0, "kyujin"),
    ];
    // 求人タグは category 集客ではないので上の line() は集客。求人は別行で足す
    lmessage.push({ date: "2026-11-26", botId: "b", botName: "", category: "求人", tagId: "q", tagName: "広島本通流入", count: 999 });
    const [w] = detectLineRegistrationDrops(monet, lmessage, TODAY);
    // 前21日リード10・登録5（50%）、直近7日リード4・登録2（50%）で半分未満ではない
    expect(w).toBeUndefined();
  });

  it("堀江院は堀江2ndのタグを吸わない", () => {
    const monet = [lead("2026-11-26", "堀江院", 6), lead("2026-11-26", "堀江2nd院", 6)];
    const lmessage = [
      line("2026-11-23", "大阪堀江流入", 100),
      line("2026-11-26", "大阪堀江流入", 106),
      line("2026-11-23", "大阪堀江2nd流入", 50, "2nd"),
      line("2026-11-26", "大阪堀江2nd流入", 50, "2nd"),
    ];
    const flagged = detectLineRegistrationDrops(monet, lmessage, TODAY).map((w) => w.store);
    expect(flagged).toEqual(["堀江2nd院"]);
  });
});
