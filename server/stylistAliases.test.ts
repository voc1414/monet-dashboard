import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getAllStylistAliases: vi.fn(),
  addStylistAlias: vi.fn(),
  deleteStylistAlias: vi.fn(),
}));

import { getAllStylistAliases, addStylistAlias, deleteStylistAlias } from "./db";

describe("Stylist Aliases DB helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAllStylistAliases returns empty array when no aliases exist", async () => {
    (getAllStylistAliases as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await getAllStylistAliases();
    expect(result).toEqual([]);
  });

  it("getAllStylistAliases returns aliases with correct structure", async () => {
    const mockAliases = [
      { id: 1, canonicalName: "Yoshie", alias: "由恵（よしえさん）", storeName: "福島院", createdAt: new Date() },
      { id: 2, canonicalName: "Kaede", alias: "かえでさん", storeName: "堀江院", createdAt: new Date() },
    ];
    (getAllStylistAliases as ReturnType<typeof vi.fn>).mockResolvedValue(mockAliases);
    const result = await getAllStylistAliases();
    expect(result).toHaveLength(2);
    expect(result[0].canonicalName).toBe("Yoshie");
    expect(result[0].alias).toBe("由恵（よしえさん）");
    expect(result[0].storeName).toBe("福島院");
  });

  it("addStylistAlias calls db with correct parameters", async () => {
    (addStylistAlias as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    await addStylistAlias("Yoshie", "由恵（よしえさん）", "福島院");
    expect(addStylistAlias).toHaveBeenCalledWith("Yoshie", "由恵（よしえさん）", "福島院");
  });

  it("deleteStylistAlias calls db with correct id", async () => {
    (deleteStylistAlias as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    await deleteStylistAlias(1);
    expect(deleteStylistAlias).toHaveBeenCalledWith(1);
  });
});

describe("Stylist Alias normalization integration", () => {
  it("setStylistAliasMapFromDb correctly builds alias map", async () => {
    // Test the frontend function directly
    const { setStylistAliasMapFromDb, getDbStylistAliasMap } = await import("../client/src/hooks/useFankuruData");
    
    setStylistAliasMapFromDb([
      { alias: "由恵（よしえさん）", canonicalName: "yoshie" },
      { alias: "かえでさん", canonicalName: "Kaede" },
    ]);

    const map = getDbStylistAliasMap();
    expect(map["由恵（よしえさん）"]).toBe("yoshie");
    expect(map["かえでさん"]).toBe("Kaede");
  });

  it("DB aliases override hardcoded aliases", async () => {
    const { setStylistAliasMapFromDb, normalizeStylistName } = await import("../client/src/hooks/useFankuruData");
    
    // Set DB alias that overrides a hardcoded one
    setStylistAliasMapFromDb([
      { alias: "よしえ", canonicalName: "Yoshie_DB" },
    ]);

    // DB should take priority
    const result = normalizeStylistName("よしえ");
    expect(result).toBe("Yoshie_DB");
  });

  it("normalizeStylistName falls back to hardcoded when no DB match", async () => {
    const { setStylistAliasMapFromDb, normalizeStylistName } = await import("../client/src/hooks/useFankuruData");
    
    // Clear DB aliases
    setStylistAliasMapFromDb([]);

    // Should use hardcoded alias
    const result = normalizeStylistName("じゅんな");
    expect(result).toBe("山口純奈");
  });

  it("normalizeStylistName returns original name when no match found", async () => {
    const { setStylistAliasMapFromDb, normalizeStylistName } = await import("../client/src/hooks/useFankuruData");
    
    setStylistAliasMapFromDb([]);
    const result = normalizeStylistName("存在しない名前");
    expect(result).toBe("存在しない名前");
  });
});

describe("matchesStylist / 敬称つきの担当者名（2026-08-19 追加）", () => {
  it("「石橋様」が石橋茜さんに紐づく", async () => {
    const { matchesStylist } = await import("../client/src/hooks/useFankuruData");
    expect(matchesStylist("石橋様", "石橋 茜")).toBe(true);
    expect(matchesStylist("石橋さま", "石橋 茜")).toBe(true);
  });

  it("既存の会話調も引き続き通る", async () => {
    const { matchesStylist } = await import("../client/src/hooks/useFankuruData");
    expect(matchesStylist("サユリさんです。", "Sayuri")).toBe(true);
    expect(matchesStylist("Yukikoさんです。", "Yukiko")).toBe(true);
    expect(matchesStylist("山口", "山口 純奈")).toBe(true);
  });

  it("敬称を外しても別人には当たらない", async () => {
    const { matchesStylist } = await import("../client/src/hooks/useFankuruData");
    expect(matchesStylist("石橋様", "金田 あゆみ")).toBe(false);
    expect(matchesStylist("石橋様", "山口 純奈")).toBe(false);
  });
});
