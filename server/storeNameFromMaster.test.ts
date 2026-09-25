import { describe, it, expect } from "vitest";
import { storeNameFromMaster, singleStoreAreas, masterRegionBases } from "@/lib/storeNameFromMaster";
import { normalizeSalonBoardStore } from "@/hooks/useSalonBoardStylistData";
import { normalizeStoreName as normalizeFankuruStore } from "@/hooks/useFankuruData";
import { normalizeStoreName as normalizeReportStore } from "@/hooks/useMonthlyReport";
import { parseStoreName as parseNpsStore } from "@/hooks/useNpsData";
import { fillRegionAndStore } from "@/hooks/useAdsData";

/**
 * 新店のたびに各データ源の対応表へ手で書き足さなくても、Notion の店舗一覧に
 * 登録してあれば短縮名に畳めることを固定する（2026-09-25 新設）。
 *
 * 本通院・春日院は店舗一覧にはあるが、どの対応表にも書いていない店＝
 * 「次に開く新店」の代わりとして使う。表記は既存店の実データの書式に合わせた。
 */
describe("店舗一覧からの自動読み替え", () => {
  it("どの対応表にも無い新店でも、4つのデータ源すべてで短縮名に落ちる", () => {
    expect(normalizeSalonBoardStore("モネ-monet- 白髪染めと髪質改善のサロン　広島本通院")).toBe("本通院");
    expect(parseNpsStore("monet 広島本通院")).toBe("本通院");
    expect(normalizeReportStore("広島本通院")).toBe("本通院");
    expect(normalizeFankuruStore("福岡春日院")).toBe("春日院");
  });

  it("「院」が付かない表記（NPS の「monet 岡本」型）も拾う", () => {
    expect(storeNameFromMaster("monet 春日")).toBe("春日院");
  });

  it("長い名前が先に当たる（堀江院2nd を 堀江院 に取られない）", () => {
    expect(storeNameFromMaster("モネ-monet- 白髪染めと髪質改善のサロン 堀江院 2nd")).toBe("堀江院2nd");
    expect(storeNameFromMaster("monet 白髪染めと髪質改善のサロン 堀江院【モネ】")).toBe("堀江院");
  });

  it("店舗一覧に無い名前は null（勝手な店に寄せない）", () => {
    expect(storeNameFromMaster("monet 本部")).toBeNull();
    expect(storeNameFromMaster("")).toBeNull();
  });

  it("既存店の読み替えは今までどおり", () => {
    expect(normalizeSalonBoardStore("モネ-monet- 白髪染めと髪質改善のサロン　岡山下伊福院")).toBe("下伊福院");
    expect(normalizeSalonBoardStore("モネ-monet- 白髪染めと髪質改善のサロン 福岡姪浜院")).toBe("姪浜院");
    expect(parseNpsStore("monet 岡本")).toBe("岡本院");
  });
});

describe("1店舗だけのエリア（広告の店舗欄が空のときの補完）", () => {
  it("店舗一覧から決まる。開店前の店があるエリア（広島・福岡）は含めない", () => {
    expect(singleStoreAreas()).toEqual({ 岡山エリア: "下伊福院", 兵庫エリア: "岡本院" });
  });

  it("キャンペーン名のエリアから店舗を補う動きは変わらない", () => {
    expect(fillRegionAndStore("集客/モネ/岡山/リード/FC", "", "")).toEqual({ region: "岡山エリア", tenpo: "下伊福院" });
    expect(fillRegionAndStore("集客/モネ/大阪/リード/直営", "", "")).toEqual({ region: "大阪エリア", tenpo: "" });
  });

  it("エリア一覧は店舗一覧から取れる", () => {
    expect(masterRegionBases().sort()).toEqual(["兵庫", "大阪", "岡山", "広島", "福岡"].sort());
  });
});
