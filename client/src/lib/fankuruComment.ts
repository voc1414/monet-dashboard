/**
 * 月末報告書「ファンくるの調査結果の感想」に、感想ではなく件数だけ書かれた回答を除く（2026-10-02 林さん指示）。
 * 実データでは「なし」のほか「0」「0件」「1件」「０件」「2」など数字だけの回答が混ざっている。
 */
export function isFankuruCommentShown(raw: string | null | undefined): boolean {
  const s = (raw || "").normalize("NFKC").replace(/[\s　]/g, "");
  if (s === "" || s === "なし") return false;
  if (/^\d+件?$/.test(s)) return false;
  return true;
}
