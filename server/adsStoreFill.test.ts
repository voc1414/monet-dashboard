import { describe, it, expect } from "vitest";
import { fillRegionAndStore, regionFromCampaign, getCampaignType, storeFromAdset, findMissingDates } from "@/hooks/useAdsData";

describe("広告: 空の店舗・地域をキャンペーン名から補う（2026-08-19 追加）", () => {
  it("キャンペーン名の3番目が地域", () => {
    expect(regionFromCampaign("集客/モネ/岡山/リード/FC")).toBe("岡山エリア");
    expect(regionFromCampaign("求人/モネ/兵庫/リード/FC")).toBe("兵庫エリア");
    expect(regionFromCampaign("")).toBeNull();
  });

  it("1エリア1店舗のエリアは店舗名まで補える", () => {
    // 岡山: 地域はあるが店舗が空
    expect(fillRegionAndStore("集客/モネ/岡山/リード/FC", "岡山エリア", ""))
      .toEqual({ region: "岡山エリア", tenpo: "下伊福院" });
    // 兵庫は 2026-11-28 から芦屋院（開店日未定）も店舗一覧に入ったので、地域だけでは店舗を決めない
    expect(fillRegionAndStore("集客/モネ/兵庫/リード/FC", "", ""))
      .toEqual({ region: "兵庫エリア", tenpo: "" });
    // 広告セット名に店舗があれば、兵庫でも店舗まで補える
    expect(fillRegionAndStore("集客/モネ/兵庫/リード/FC", "", "", "集客/モネ/兵庫/岡本/リード/FC", ["岡本院", "芦屋院"]))
      .toEqual({ region: "兵庫エリア", tenpo: "岡本院" });
    // 求人も同じ店舗に寄る
    expect(fillRegionAndStore("求人/モネ/岡山/リード/FC", "岡山エリア", "").tenpo)
      .toBe("下伊福院");
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

describe("広告: 2026-10-07 からの新しいキャンペーン名・店舗欄が空の行・日付の抜け（2026-11-27 追加）", () => {
  it("集客/求人 は「/」区切りのどこにあっても判定する", () => {
    expect(getCampaignType("集客/モネ/大阪/リード/直営")).toBe("集客");
    expect(getCampaignType("求人/モネ/大阪リード/直営")).toBe("求人");
    expect(getCampaignType("モネ/大阪エリア/集客/直営")).toBe("集客");
    expect(getCampaignType("モネ/群馬エリア/求人/FC")).toBe("求人");
    expect(getCampaignType("モネ/福岡エリア/集客/FC/林プレゼント")).toBe("集客");
    expect(getCampaignType("モネ/大阪エリア/直営")).toBe("");
    expect(getCampaignType("")).toBe("");
  });

  it("新形式のキャンペーン名から地域を読む", () => {
    expect(regionFromCampaign("モネ/大阪エリア/集客/直営")).toBe("大阪エリア");
    expect(regionFromCampaign("モネ/群馬エリア/求人/FC")).toBe("群馬エリア");
    expect(regionFromCampaign("モネ/広島/楽々園/求人/リード/FC")).toBeNull();
  });

  it("店舗欄が空なら広告セット名の店舗名で補う（シートの表記を優先）", () => {
    const known = ["堀江院", "堀江2nd院", "福島院", "堀江院2nd"];
    expect(storeFromAdset("モネ/大阪エリア/堀江院2nd/集客/直営", known)).toBe("堀江2nd院");
    expect(storeFromAdset("モネ/大阪エリア/堀江院/集客/直営", known)).toBe("堀江院");
    expect(storeFromAdset("モネ/大阪エリア/求人/直営", known)).toBeNull();
    expect(
      fillRegionAndStore("モネ/大阪エリア/集客/直営", "大阪エリア", "", "モネ/大阪エリア/堀江院2nd/集客/直営", known)
    ).toEqual({ region: "大阪エリア", tenpo: "堀江2nd院" });
    // 店舗欄に値があればそちら
    expect(
      fillRegionAndStore("モネ/大阪エリア/集客/直営", "大阪エリア", "福島院", "モネ/大阪エリア/堀江院2nd/集客/直営", known).tenpo
    ).toBe("福島院");
  });

  it("途中で抜けている日付を挙げる", () => {
    const dates = ["2026-11-17", "2026-11-18", "2026-11-20", "2026-11-25"];
    expect(findMissingDates(dates, "2026-11-17", "2026-11-25")).toEqual([
      "2026-11-19", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24",
    ]);
    expect(findMissingDates(dates, "2026-11-17", "2026-11-18")).toEqual([]);
    expect(findMissingDates(dates, "2026-11-30", "2026-12-01")).toEqual(["2026-11-30", "2026-12-01"]);
  });
});
