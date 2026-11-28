import { describe, it, expect } from "vitest";
import { hpbStartMonth, openedByMonth, proratedMonthlyAmounts, proratedMonthlyFee } from "@/lib/storeOpening";

const key = (n: string) => n.replace(/院/g, "").replace(/[\s　]/g, "");
const TABLE = { "下伊福院": "2026-08", "岡本院": "2026-09" };

describe("HPB掲載費の計上開始月（2026-11-28 点検）", () => {
  it("手書きの表にある店はその月", () => {
    expect(hpbStartMonth("下伊福院", TABLE, key)).toBe("2026-08");
    expect(hpbStartMonth("岡本", TABLE, key)).toBe("2026-09");
  });
  it("表に無い店は店舗マスタの開店日の月", () => {
    expect(hpbStartMonth("春日院", TABLE, key)).toBe("2026-11");
    expect(hpbStartMonth("本通院", TABLE, key)).toBe("2026-12");
  });
  it("開店日が未定の店は計上しない", () => {
    expect(hpbStartMonth("高崎院", TABLE, key)).toBeNull();
    expect(hpbStartMonth("芦屋院", TABLE, key)).toBeNull();
  });
  it("広告側の表記ゆれ（堀江2nd院）でも店舗マスタに当たる", () => {
    expect(hpbStartMonth("堀江2nd院", TABLE, key)).toBe("2025-10");
  });
  it("店舗マスタに無い店は最初から計上", () => {
    expect(hpbStartMonth("どこか院", TABLE, key)).toBe("");
  });
});

describe("その月までに開店していた店か（店舗一覧の表示）", () => {
  it("開店月より前の月は出さない・開店月からは出す", () => {
    expect(openedByMonth("春日院", "2026-10")).toBe(false);
    expect(openedByMonth("春日院", "2026-11")).toBe(true);
    expect(openedByMonth("本通院", "2026-11")).toBe(false);
    expect(openedByMonth("堀江院", "2026-10")).toBe(true);
  });
  it("開店日未定は出さない・マスタに無い店は今までどおり出す", () => {
    expect(openedByMonth("高崎院", "2026-11")).toBe(false);
    expect(openedByMonth("どこか院", "2026-11")).toBe(true);
  });
});

describe("HPB掲載費の日数按分（提案）", () => {
  it("暦の1か月は月額ちょうど", () => {
    expect(proratedMonthlyFee(55000, "2026-10-01", "2026-10-31", "")).toBe(55000);
    expect(proratedMonthlyFee(55000, "2026-02-01", "2026-02-28", "")).toBe(55000);
  });
  it("月をまたぐ30日は約1か月分（2か月分にしない）", () => {
    // 10/29〜10/31 = 3/31、11/1〜11/27 = 27/30
    expect(proratedMonthlyFee(55000, "2026-10-29", "2026-11-27", "")).toBe(Math.round(55000 * 3 / 31 + 55000 * 27 / 30));
  });
  it("開始月より前は計上しない", () => {
    expect(proratedMonthlyFee(55000, "2026-10-29", "2026-11-27", "2026-11")).toBe(49500);
    expect(proratedMonthlyFee(55000, "2026-10-29", "2026-11-27", "2026-12")).toBe(0);
  });
});

describe("新規売上も同じ日数按分（ROASの分子）", () => {
  // 堀江院の過去30日（10/29〜11/27 = 10月3/31・11月27/30）。広告費は日次の合計なので按分しない。
  // 掲載費の月額は ¥55,000。月数で足すとこの期間は2か月分の ¥110,000 になる。
  const horie = { "2026-10": 554250, "2026-11": 577000 };
  const since = "2026-10-29";
  const until = "2026-11-27";
  const adSpend = 44872;

  it("30日跨ぎは各月を日数按分し、堀江院のROASまで一致する", () => {
    const sales = proratedMonthlyAmounts(horie, since, until);
    const hpb = proratedMonthlyFee(55000, since, until, "");
    expect(sales).toBe(572937);
    expect(hpb).toBe(54823);
    expect(55000 * 2).toBe(110000);
    expect(Math.round((sales / (adSpend + hpb)) * 100)).toBe(575);
  });

  it("暦の1か月ちょうど、および月をまるごと重ねた期間は月次の合計のまま", () => {
    expect(proratedMonthlyAmounts(horie, "2026-10-01", "2026-10-31")).toBe(554250);
    expect(proratedMonthlyAmounts(horie, "2026-11-01", "2026-11-30")).toBe(577000);
    expect(proratedMonthlyFee(55000, "2026-10-01", "2026-10-31", "")).toBe(55000);
    expect(proratedMonthlyAmounts(horie, "2026-10-01", "2026-11-30")).toBe(554250 + 577000);
  });
});
