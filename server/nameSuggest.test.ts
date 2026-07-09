import { describe, it, expect } from "vitest";
import { hiraToKata, kataToRomaji, collapseRomaji, suggestStaffMatches } from "./nameSuggest";

describe("かな→ローマ字変換", () => {
  it("ひらがな→カタカナ", () => {
    expect(hiraToKata("あきこ")).toBe("アキコ");
    expect(hiraToKata("ようこ")).toBe("ヨウコ");
  });

  it("カタカナ→ローマ字（拗音・促音）", () => {
    expect(kataToRomaji("アキコ")).toBe("akiko");
    expect(kataToRomaji("ジュンナ")).toBe("junna");
    expect(kataToRomaji("マッキー")).toBe("makki");
  });

  it("collapseRomaji: 訓令式・長音のゆれを潰す", () => {
    expect(collapseRomaji("jyunna")).toBe(collapseRomaji("junna"));
    expect(collapseRomaji("yuuko")).toBe(collapseRomaji("yuko"));
    expect(collapseRomaji("youko")).toBe(collapseRomaji("yoko"));
    expect(collapseRomaji("si")).toBe(collapseRomaji("shi"));
  });
});

describe("suggestStaffMatches（読み仮名ベースの候補推定）", () => {
  const roster = ["小池明子", "石原葉子", "藤原 牧子", "Minaho", "山口純奈", "Kaede"];

  it("ローマ字表記から漢字名を推定する（名の読み一致）", async () => {
    const res = await suggestStaffMatches({ names: ["akiko", "AKIKO"], roster });
    expect(res[0].suggested).toBe("小池明子");
    expect(res[1].suggested).toBe("小池明子");
  });

  it("かな混じり表記からフルネーム読み一致で推定する（高確度）", async () => {
    const res = await suggestStaffMatches({ names: ["石原ようこ"], roster });
    expect(res[0].suggested).toBe("石原葉子");
    expect(res[0].confidence).toBe("high");
  });

  it("読みが一致しないニックネーム・typoは候補なし（誤マッチさせない）", async () => {
    const res = await suggestStaffMatches({ names: ["Minato", "みなちゃん"], roster });
    expect(res[0].suggested).toBeNull();
    expect(res[1].suggested).toBeNull();
  });

  it("名簿にいない読みは候補なし", async () => {
    const res = await suggestStaffMatches({ names: ["ふじたみほ"], roster });
    expect(res[0].suggested).toBeNull();
  });
});
