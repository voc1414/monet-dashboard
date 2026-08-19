import { describe, it, expect } from "vitest";
import { STORE_MASTER, openedAreaStores } from "@/data/storeMaster";

describe("店舗マスタ（Notion「DB_monet店舗一覧」由来・2026-08-20 追加）", () => {
  it("9店すべてが入っている", () => {
    expect(STORE_MASTER).toHaveLength(9);
    expect(STORE_MASTER.map((s) => s.name)).toContain("下伊福院");
    expect(STORE_MASTER.map((s) => s.name)).toContain("岡本院");
  });

  it("開店日が未定の店は営業中の一覧に出さない", () => {
    const areas = openedAreaStores("2026-08-20");
    const names = areas.flatMap((a) => a.stores);
    expect(names).toHaveLength(7);
    expect(names).not.toContain("下伊福院"); // 開店日未定
    expect(names).not.toContain("岡本院");   // 開店日未定
  });

  it("開店日を過ぎた店は自動で並ぶ（コード修正が要らない）", () => {
    // 土橋院は2026-04-25開店。前日には出ず、当日から出る
    expect(openedAreaStores("2026-04-24").flatMap((a) => a.stores)).not.toContain("土橋院");
    expect(openedAreaStores("2026-04-25").flatMap((a) => a.stores)).toContain("土橋院");
  });

  it("エリアは最初に開店した日の順に並ぶ", () => {
    const areas = openedAreaStores("2026-08-20").map((a) => a.area);
    expect(areas).toEqual(["大阪エリア", "広島エリア", "福岡エリア"]);
  });

  it("開店前の1号店しかない時点では、そのエリアだけが出る", () => {
    expect(openedAreaStores("2023-06-01")).toEqual([{ area: "大阪エリア", stores: ["堀江院"] }]);
  });
});
