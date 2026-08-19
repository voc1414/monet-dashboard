import { describe, it, expect } from "vitest";
import { fillRegionAndStore, regionFromCampaign } from "@/hooks/useAdsData";

describe("広告: 空の店舗・地域をキャンペーン名から補う（2026-08-19 追加）", () => {
  it("キャンペーン名の3番目が地域", () => {
    expect(regionFromCampaign("集客/モネ/岡山/リード/FC")).toBe("岡山エリア");
    expect(regionFromCampaign("求人/モネ/兵庫/リード/FC")).toBe("兵庫エリア");
    expect(regionFromCampaign("")).toBeNull();
  });

  it("1エリア1店舗のエリアは店舗名まで補える", () => {
    // 岡山: 地域はあるが店舗が空
    expect(fillRegionAndStore("集客/モネ/岡山/リード/FC", "岡山エリア", ""))
      .toEqual({ region: "岡山エリア", tenpo: "岡山下伊福院" });
    // 兵庫の集客: 地域も店舗も空
    expect(fillRegionAndStore("集客/モネ/兵庫/リード/FC", "", ""))
      .toEqual({ region: "兵庫エリア", tenpo: "岡本院" });
    // 求人も同じ店舗に寄る
    expect(fillRegionAndStore("求人/モネ/岡山/リード/FC", "岡山エリア", "").tenpo)
      .toBe("岡山下伊福院");
  });

  it("複数店舗のエリアは店舗を推測しない", () => {
    expect(fillRegionAndStore("求人/モネ/大阪/リード/直営", "大阪エリア", ""))
      .toEqual({ region: "大阪エリア", tenpo: "" });
    expect(fillRegionAndStore("求人/モネ/広島/リード/FC", "広島エリア", "").tenpo).toBe("");
    expect(fillRegionAndStore("求人/モネ/福岡/リード/FC", "福岡エリア", "").tenpo).toBe("");
  });

  it("元の値が入っていれば必ずそちらを優先する", () => {
    expect(fillRegionAndStore("集客/モネ/岡山/リード/FC", "岡山エリア", "既存店名"))
      .toEqual({ region: "岡山エリア", tenpo: "既存店名" });
    expect(fillRegionAndStore("集客/モネ/岡山/リード/FC", "別エリア", "").region).toBe("別エリア");
  });
});
