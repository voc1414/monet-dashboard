import { describe, it, expect } from "vitest";
import { hpbStartMonth, openedByMonth } from "@/lib/storeOpening";

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
