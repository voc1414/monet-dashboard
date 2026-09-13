import { describe, it, expect } from "vitest";
import { normalizeSalonBoardStore } from "@/hooks/useSalonBoardStylistData";
import { normalizeStoreName as normalizeFankuruStore } from "@/hooks/useFankuruData";
import { normalizeStoreName as normalizeReportStore } from "@/hooks/useMonthlyReport";
import { parseStoreName as parseNpsStore } from "@/hooks/useNpsData";

/**
 * 新店を足したときの「店舗名の畳み込み」回帰テスト（2026-09-13 下伊福院の追加時に新設）。
 *
 * 4つのデータ源はそれぞれ別の表記で店舗名を書いてくる。どれか1つでも短縮名に落ちないと、
 * その源のデータだけが店舗に紐づかず、画面上は「売上 ¥0」「口コミ0件」に見える。
 * 見た目では気づけない壊れ方なので、実データにある文字列そのままで固定する。
 *
 * 値の出所（2026-09-13 に各シートを実際に取得して確認した表記）:
 *   サロンボード実績 stylist_flat … 「モネ-monet- 白髪染めと髪質改善のサロン　岡山下伊福院」
 *                                   （店名の直前は全角スペース U+3000）
 *   NPS 全店舗                   … 「monet 岡山下伊福院」
 *   月末報告書 / ファンくる       … 「岡山下伊福院」
 */
describe("新店の店舗名が4つのデータ源すべてで短縮名に落ちる（下伊福院）", () => {
  it("サロンボード実績（全角スペース入りの正式サロン名）", () => {
    expect(
      normalizeSalonBoardStore("モネ-monet- 白髪染めと髪質改善のサロン　岡山下伊福院"),
    ).toBe("下伊福院");
  });

  it("NPS（口コミ）", () => {
    expect(parseNpsStore("monet 岡山下伊福院")).toBe("下伊福院");
  });

  it("月末報告書", () => {
    expect(normalizeReportStore("岡山下伊福院")).toBe("下伊福院");
  });

  it("ファンくる", () => {
    expect(normalizeFankuruStore("岡山下伊福院")).toBe("下伊福院");
  });

  it("地域の接頭辞が付かない「下伊福院」もそのまま通る", () => {
    expect(normalizeSalonBoardStore("モネ-monet-　下伊福院")).toBe("下伊福院");
    expect(parseNpsStore("monet 下伊福院")).toBe("下伊福院");
    expect(normalizeReportStore("下伊福院")).toBe("下伊福院");
    expect(normalizeFankuruStore("下伊福院")).toBe("下伊福院");
  });
});

describe("既存店の畳み込みが新店追加で壊れていない", () => {
  // NPS は「〇〇院」を拾う汎用の正規表現を最後に持っている。新店を足すとき、
  // 「岡山下伊福院」を丸ごと拾ってしまう事故が起きやすいのがこの経路。
  it("NPS：地域接頭辞つきの既存店", () => {
    expect(parseNpsStore("monet 広島土橋院")).toBe("土橋院");
    expect(parseNpsStore("monet 広島楽々園院")).toBe("楽々園院");
    expect(parseNpsStore("monet 福岡姪浜院")).toBe("姪浜院");
  });

  it("サロンボード実績：既存店", () => {
    expect(normalizeSalonBoardStore("monet 白髪染めと髪質改善のサロン 堀江院【モネ】")).toBe("堀江院");
    expect(normalizeSalonBoardStore("モネ-monet- 白髪染めと髪質改善のサロン 堀江院 2nd")).toBe("堀江院2nd");
    expect(normalizeSalonBoardStore("モネ-monet-　広島楽々園院")).toBe("楽々園院");
  });

  it("月末報告書：既存店", () => {
    expect(normalizeReportStore("大阪堀江院")).toBe("堀江院");
    expect(normalizeReportStore("広島土橋院")).toBe("土橋院");
  });
});
