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

  it("店舗表記の空白ゆれ（末尾スペース）は吸収して直接ヒットする", () => {
    // 報告書側は「堀江院 」のように末尾に空白が入ることがある。照合キーで空白を落とす
    setReportNicknames([
      { name: "西本 美華", store: "堀江院 ", nickname: "みかりん", answerDate: "2026-08-29 10:00:00" },
    ]);
    expect(resolveStaffDisplayName("西本 美華", "堀江院")).toBe("みかりん");
  });

  it("報告書側と画面側で店舗ラベルの表記が違うと呼び名が消える（未マップ店の劣化。安全側へ倒す）", () => {
    // normalizeStoreName は未マップ名を素通しする（useMonthlyReport.ts:82）。新店（例 下伊福院）が
    // STORE_NAME_MAP_FALLBACK に無いと、報告書側は生ラベル「岡山下伊福院」のまま注入され、
    // 画面側は Notion 店舗マスタの短縮名「下伊福院」で引くため、両側が食い違って直接ヒットしない。
    setReportNicknames([
      { name: "小田りえ", store: "岡山下伊福院", nickname: "りえちゃん", answerDate: "2026-08-29 10:00:00" },
    ]);
    expect(resolveStaffDisplayName("小田りえ", "下伊福院")).toBe("小田りえ");
    // 消えているのはデータではなくラベルの対応。生ラベルで引けば当たる
    expect(resolveStaffDisplayName("小田りえ", "岡山下伊福院")).toBe("りえちゃん");
    // ここで救う（全社フォールバック）と別人の呼び名が出る経路そのものなので救わない。
    // 直す場所は STORE_NAME_MAP_FALLBACK／Notion 店舗マスタ側（CLAUDE.md §0）
  });

  it("同じ表示名の別人が居るとき、答えた片方の呼び名を他方に出さない（Mika＝堀江院 西本美華／福島院 松野美香）", () => {
    // 報告書の氏名列にはローマ字の表示名が入ることがある（実データに「yuko（←Yuko）」等）。
    // 列20 は本人が答えたときだけ埋まるので、福島院の Mika だけが答えている状態が普通に起きる。
    setReportNicknames([
      { name: "Mika", store: "福島院", nickname: "みかっぺ", answerDate: "2026-08-29 10:00:00" },
    ]);
    // 答えた本人には出る
    expect(resolveStaffDisplayName("Mika", "福島院")).toBe("みかっぺ");
    // 堀江院の Mika は別人。呼び名が無いので表示名のまま（他人の呼び名を出さない）
    expect(resolveStaffDisplayName("Mika", "堀江院")).toBe("Mika");
    // 店舗が分からないときも同じ
    expect(resolveStaffDisplayName("Mika")).toBe("Mika");
    expect(resolveStaffInitial("Mika", "堀江院")).toBe("M");
  });

  it("店舗が渡ったら「店舗＋名前」の直接ヒット以外は出さない（Yu は複数店舗に現れる表示名）", () => {
    // 2026-09-04 監査で実測した漏れ。「2人以上と証明できたときだけ止める」では素通りしていた。
    // 「マスタでちょうど1人＋その1人の所属店舗と一致」でも足りない:
    // 「マスタに1人しか居ない」は「回答者がその1人」ではない（名簿外の同名者が答えていれば別人の呼び名）。
    // 所属店舗は異動で変わる（例 2026-10-01 に Yu が福島院→堀江院）ため、
    // 所属を判定材料にする設計自体が時点依存で危うい。だから報告書側の組だけを見る。
    setReportNicknames([
      { name: "Yu", store: "堀江院", nickname: "ゆうちゃん", answerDate: "2026-08-29 10:00:00" },
    ]);
    // 回答が無い店舗の Yu には出さない（ここが漏れていた）
    expect(resolveStaffDisplayName("Yu", "姪浜院")).toBe("Yu");
    expect(resolveStaffDisplayName("Yu", "福島院")).toBe("Yu");
    // 「堀江院の Yu」は報告書に実在する組なので直接ヒットで出る（店舗＋名前が一致している）
    expect(resolveStaffDisplayName("Yu", "堀江院")).toBe("ゆうちゃん");
  });

  it("マスタに居ない名前は全社フォールバックしない（退職者 藤田・AKI は名簿外が正常＝CLAUDE.md §3）", () => {
    setReportNicknames([
      { name: "藤田", store: "堀江院", nickname: "ふじさん", answerDate: "2026-08-29 10:00:00" },
    ]);
    expect(resolveStaffDisplayName("藤田", "姪浜院")).toBe("藤田");
    expect(resolveStaffDisplayName("藤田")).toBe("藤田");
    // 本人の店舗で引けば直接ヒットするので、名簿外でも呼び名は出る
    expect(resolveStaffDisplayName("藤田", "堀江院")).toBe("ふじさん");
  });

  it("回答が複数店舗に割れているときは、店舗なしでは呼び名を出さない（異動の直後に起きる）", () => {
    // 異動すると前の店舗と新しい店舗の両方に回答が残る。マスタ上は1人（西本 美華）でも、
    // 店舗が渡らない経路ではどちらの回答を採るべきか決められないので氏名に落とす。
    // ＝「候補が割れたら出さない」分岐だけを見るケース（マスタ不在の分岐とは別物）
    setReportNicknames([
      { name: "西本 美華", store: "堀江院", nickname: "みかりん", answerDate: "2026-08-29 10:00:00" },
      { name: "西本 美華", store: "福島院", nickname: "みかみか", answerDate: "2026-09-30 10:00:00" },
    ]);
    expect(resolveStaffDisplayName("西本 美華")).toBe("西本 美華");
    // 店舗が分かればそれぞれ正しく引ける
    expect(resolveStaffDisplayName("西本 美華", "堀江院")).toBe("みかりん");
    expect(resolveStaffDisplayName("西本 美華", "福島院")).toBe("みかみか");
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
      { name: "坂手芳", store: "堀江院2nd", nickname: "かおるん", answerDate: "2026-08-29 10:00:00" },
    ]);
    expect(resolveStaffDisplayName("坂手芳", "堀江院2nd")).toBe("かおるん");
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

/**
 * ここから下は**挙動テストではない**。useMonthlyReport は React hook で、vitest は
 * environment: node（DOMなし）・server/**.test.ts しか拾わない。import 自体は通っても
 * hook を呼ぶ／描画することができないので、実挙動は検証できない。
 * よってソースの文字列を見張っているだけ＝**スプレッドシート側の列がズレても緑のまま通る**
 * （ソースの列番号が変われば落ちる。守れるのはコード側の書き換えだけ）。
 * 「配線が検証されている」と読まないこと（呼び名の実挙動は上の describe が検証する）。
 */
describe("ソース文字列の見張り（useMonthlyReport 側・挙動は見ていない）", () => {
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

  it("呼び名の解決順が3段のまま（式そのものを見張る。コメントではない）", () => {
    const s = src("lib/staffDisplayName.ts");
    expect(s).toContain("findNickname(name, store) || findReportNickname(name, store) || name");
  });
});
