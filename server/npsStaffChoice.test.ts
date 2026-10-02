import { describe, it, expect } from "vitest";
import { parseStaffChoice } from "../client/src/hooks/useNpsData";

describe("NPSの「スタッフ選択」：数字だけの誤入力は選択なし扱い（林さん指示 2026-10-02・福島院 2579）", () => {
  it("数字だけは空にする", () => {
    expect(parseStaffChoice("2579")).toBe("");
    expect(parseStaffChoice(" ２５７９ ")).toBe("");
  });
  it("名前はそのまま", () => {
    expect(parseStaffChoice("Yu")).toBe("Yu");
    expect(parseStaffChoice("岡野")).toBe("岡野");
    expect(parseStaffChoice("選択しない")).toBe("選択しない");
  });
});
