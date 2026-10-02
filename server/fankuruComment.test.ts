import { describe, it, expect } from "vitest";
import { isFankuruCommentShown } from "../client/src/lib/fankuruComment";

describe("isFankuruCommentShown", () => {
  it("空・なし・数字だけの回答は出さない", () => {
    for (const v of ["", "  ", "なし", "0", "0件", "1件", "０件", "2", " 1 件 ", null, undefined]) {
      expect(isFankuruCommentShown(v as string)).toBe(false);
    }
  });
  it("感想の文章は出す", () => {
    for (const v of ["すみません", "マッサージが気持ちよかったとのお声を頂きましたので今月も頑張ります", "なし\n\n下↓↓↓ポイント管理シートはまだありません。", "1件目は満足、2件目は改善"]) {
      expect(isFankuruCommentShown(v)).toBe(true);
    }
  });
});
