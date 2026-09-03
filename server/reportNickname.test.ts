import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * 月末報告書 列20 由来のニックネーム（解決順②・2026-09-03）。
 *
 * 呼び名の正本は L Message の必須入力欄で、その回答が月末報告書の列20 に毎月入る。
 * ダッシュボードは元々この報告書を実行時に読んでいるので、列20 を拾うだけで
 * 人手ゼロで反映される（CLAUDE.md §0 完全自動化）。
 *
 * ①Notion のニックネームは「人が直した値」なので②より優先される。
 * それを検証するため、実マスタの1名にだけ Notion 側ニックネームを差し込む。
 */
vi.mock("@/data/staffMaster", async () => {
  const actual = await vi.importActual<typeof import("@/data/staffMaster")>("@/data/staffMaster");
  return {
    ...actual,
    STAFF_MASTER: actual.STAFF_MASTER.map((s) =>
      s.name === "中島真優" ? { ...s, nickname: "Notionで直した名" } : s
    ),
  };
});

const { resolveStaffDisplayName, resolveStaffInitial, setReportNicknames, parseReportNickname, reportNicknameCount } =
  await import("@/lib/staffDisplayName");

beforeEach(() => {
  setReportNicknames([]);
});

describe("parseReportNickname（列20 の整形）", () => {
  it("ニックネーム文字列はそのまま通す", () => {
    expect(parseReportNickname("Akiko")).toBe("Akiko");
    expect(parseReportNickname("ちば")).toBe("ちば");
  });

  it("2026-08-29 より前の行に入っている写真URLは呼び名にしない", () => {
    // 列20 は「写真」列を差し替えたもの。過去行は画像URLが残っている
    expect(parseReportNickname("https://storage.googleapis.com/xxx/photo.jpg")).toBe("");
    expect(parseReportNickname("http://example.com/a.png")).toBe("");
    expect(parseReportNickname("HTTPS://EXAMPLE.COM/A.PNG")).toBe("");
  });

  it("空欄・未定義・空白だけの値は空にする", () => {
    expect(parseReportNickname("")).toBe("");
    expect(parseReportNickname(undefined)).toBe("");
    expect(parseReportNickname("   ")).toBe("");
    expect(parseReportNickname("　")).toBe("");
  });

  it("前後の空白は落とす（本人入力なので混ざる）", () => {
    expect(parseReportNickname("  Mayu  ")).toBe("Mayu");
  });
});

describe("報告書のニックネームで画面の呼び名が変わる", () => {
  it("店舗＋人で引いて呼び名を返す", () => {
    setReportNicknames([
      { name: "西本 美華", store: "堀江院", nickname: "みかりん", answerDate: "2026-08-29 10:00:00" },
    ]);
    expect(resolveStaffDisplayName("西本 美華", "堀江院")).toBe("みかりん");
  });

  it("同じ表示名の別人が入れ替わらない（堀江院 Mika と福島院 Mika は別人）", () => {
    setReportNicknames([
      { name: "西本 美華", store: "堀江院", nickname: "みかりん", answerDate: "2026-08-29 10:00:00" },
      { name: "松野 美香", store: "福島院", nickname: "みかっぺ", answerDate: "2026-08-29 10:00:00" },
    ]);
    expect(resolveStaffDisplayName("西本 美華", "堀江院")).toBe("みかりん");
    expect(resolveStaffDisplayName("松野 美香", "福島院")).toBe("みかっぺ");
  });

  it("店舗が渡らなくても全社で一意なら解決する", () => {
    setReportNicknames([
      { name: "西本 美華", store: "堀江院", nickname: "みかりん", answerDate: "2026-08-29 10:00:00" },
    ]);
    expect(resolveStaffDisplayName("西本 美華")).toBe("みかりん");
  });

  it("店舗表記が揺れて空振りしても、全社で一意なら解決する（土橋院/広島土橋院）", () => {
    setReportNicknames([
      { name: "西本 美華", store: "堀江院", nickname: "みかりん", answerDate: "2026-08-29 10:00:00" },
    ]);
    expect(resolveStaffDisplayName("西本 美華", "存在しない院")).toBe("みかりん");
  });

  it("同姓同名が別店舗に居て呼び名が割れるときは氏名のまま（別人の呼び名を出さない）", () => {
    setReportNicknames([
      { name: "山田 花子", store: "堀江院", nickname: "はなちゃん", answerDate: "2026-08-29 10:00:00" },
      { name: "山田 花子", store: "福島院", nickname: "やまちゃん", answerDate: "2026-08-29 10:00:00" },
    ]);
    expect(resolveStaffDisplayName("山田 花子")).toBe("山田 花子");
    // 店舗が分かれば正しく引ける
    expect(resolveStaffDisplayName("山田 花子", "堀江院")).toBe("はなちゃん");
  });

  it("同じ人が複数月ぶん答えていたら回答日が新しい呼び名を採る", () => {
    setReportNicknames([
      { name: "西本 美華", store: "堀江院", nickname: "ふるいなまえ", answerDate: "2026-08-29 10:00:00" },
      { name: "西本 美華", store: "堀江院", nickname: "あたらしいなまえ", answerDate: "2026-09-30 10:00:00" },
    ]);
    expect(resolveStaffDisplayName("西本 美華", "堀江院")).toBe("あたらしいなまえ");
  });

  it("回答の並び順が逆でも新しい方を採る", () => {
    setReportNicknames([
      { name: "西本 美華", store: "堀江院", nickname: "あたらしいなまえ", answerDate: "2026-09-30 10:00:00" },
      { name: "西本 美華", store: "堀江院", nickname: "ふるいなまえ", answerDate: "2026-08-29 10:00:00" },
    ]);
    expect(resolveStaffDisplayName("西本 美華", "堀江院")).toBe("あたらしいなまえ");
  });

  it("氏名をそのまま書いた回答でも害がない（そのまま表示になる）", () => {
    // 実データに「小田利恵」「石橋茜」のように氏名で答えた人が居る
    setReportNicknames([
      { name: "西本 美華", store: "堀江院", nickname: "西本 美華", answerDate: "2026-08-29 10:00:00" },
    ]);
    expect(resolveStaffDisplayName("西本 美華", "堀江院")).toBe("西本 美華");
  });

  it("アバターの頭文字も呼び名から取る", () => {
    setReportNicknames([
      { name: "小池明子", store: "堀江院", nickname: "Akiko", answerDate: "2026-08-29 10:00:00" },
    ]);
    expect(resolveStaffInitial("小池明子", "堀江院")).toBe("A");
  });
});

describe("解決順（①Notion → ②報告書 → ③氏名）", () => {
  it("Notion に人が入れた呼び名が報告書より優先される", () => {
    setReportNicknames([
      { name: "中島真優", store: "土橋院", nickname: "報告書の名", answerDate: "2026-08-29 10:00:00" },
    ]);
    expect(resolveStaffDisplayName("中島真優", "土橋院")).toBe("Notionで直した名");
  });

  it("Notion が空なら報告書が使われる", () => {
    setReportNicknames([
      { name: "坂手芳", store: "堀江院2nd", nickname: "よしちゃん", answerDate: "2026-08-29 10:00:00" },
    ]);
    expect(resolveStaffDisplayName("坂手芳", "堀江院2nd")).toBe("よしちゃん");
  });

  it("両方無ければ氏名のまま（導入前と同じ見た目）", () => {
    expect(resolveStaffDisplayName("坂手芳", "堀江院2nd")).toBe("坂手芳");
  });
});

describe("壊れた入力で落ちない", () => {
  it("未注入でも氏名を返す", () => {
    expect(reportNicknameCount()).toBe(0);
    expect(resolveStaffDisplayName("西本 美華", "堀江院")).toBe("西本 美華");
    expect(resolveStaffDisplayName("")).toBe("");
  });

  it("空の呼び名・空の氏名の行は取り込まない", () => {
    setReportNicknames([
      { name: "西本 美華", store: "堀江院", nickname: "", answerDate: "2026-08-29 10:00:00" },
      { name: "", store: "堀江院", nickname: "ゆうれい", answerDate: "2026-08-29 10:00:00" },
      { name: "   ", store: "堀江院", nickname: "   ", answerDate: "2026-08-29 10:00:00" },
    ]);
    expect(reportNicknameCount()).toBe(0);
    expect(resolveStaffDisplayName("西本 美華", "堀江院")).toBe("西本 美華");
  });

  it("注入は冪等（呼び直すと前回ぶんが消える）", () => {
    setReportNicknames([
      { name: "西本 美華", store: "堀江院", nickname: "みかりん", answerDate: "2026-08-29 10:00:00" },
    ]);
    expect(resolveStaffDisplayName("西本 美華", "堀江院")).toBe("みかりん");
    setReportNicknames([]);
    expect(resolveStaffDisplayName("西本 美華", "堀江院")).toBe("西本 美華");
  });

  it("回答日が空でも取り込める（列が欠けた行の保険）", () => {
    setReportNicknames([{ name: "西本 美華", store: "堀江院", nickname: "みかりん", answerDate: "" }]);
    expect(resolveStaffDisplayName("西本 美華", "堀江院")).toBe("みかりん");
  });
});

describe("配線（useMonthlyReport 側）", () => {
  const src = (relative: string) =>
    readFileSync(path.resolve(import.meta.dirname, "../client/src", relative), "utf8");

  it("列20 を NICKNAME として読む", () => {
    const s = src("hooks/useMonthlyReport.ts");
    expect(s).toContain("NICKNAME: 20");
    expect(s).toContain("parseReportNickname(r[COL.NICKNAME])");
  });

  it("StaffReport に nickname を持つ", () => {
    expect(src("hooks/useMonthlyReport.ts")).toMatch(/nickname:\s*string/);
  });

  it("名寄せ・重複排除の後に解決層へ注入する（rawData の useMemo 内）", () => {
    const s = src("hooks/useMonthlyReport.ts");
    expect(s).toContain("setReportNicknames(");
    // deduplicateReports の結果を渡していること（正準化前の name で引くと当たらない）
    expect(s).toContain("const deduped = deduplicateReports(canonicalized)");
    expect(s).toMatch(/setReportNicknames\(\s*deduped\.map/);
  });

  it("注入は useEffect ではなく useMemo 側で行う（初回描画が氏名のまま残るのを防ぐ）", () => {
    const s = src("hooks/useMonthlyReport.ts");
    const memoStart = s.indexOf("const rawData = useMemo(");
    const injectAt = s.indexOf("setReportNicknames(");
    const memoEnd = s.indexOf("}, [parsedReports, aliasVersion]);");
    expect(memoStart).toBeGreaterThan(-1);
    expect(injectAt).toBeGreaterThan(memoStart);
    expect(injectAt).toBeLessThan(memoEnd);
  });

  it("呼び名の解決順が3段でコメントに残っている", () => {
    const s = src("lib/staffDisplayName.ts");
    expect(s).toContain("findNickname(name, store) || findReportNickname(name, store) || name");
  });
});
