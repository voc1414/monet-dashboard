/**
 * スタッフ名の自動マッチング候補推定エンジン。
 *
 * 未マッチのアンケート表記（例: "akiko"）と月末報告書の正式名（例: "小池明子"）を、
 * 読み仮名ベースで突き合わせて候補を返す。確定はせず候補提示まで（承認は管理者）。
 *
 * 比較空間 = 「読みのローマ字を長音・表記ゆれで潰したキー」:
 *   小池明子 → (kuromoji) コイケアキコ → koikeakiko
 *   akiko    → (ASCII正規化) akiko
 *   → 名トークン "明子"(akiko) と一致 → 候補 confidence=mid
 */
import path from "node:path";
import { createRequire } from "node:module";
import kuromoji from "kuromoji";

// ===== かな→ローマ字 =====
const DIGRAPHS: Record<string, string> = {
  "キャ": "kya", "キュ": "kyu", "キョ": "kyo", "シャ": "sha", "シュ": "shu", "ショ": "sho",
  "チャ": "cha", "チュ": "chu", "チョ": "cho", "ニャ": "nya", "ニュ": "nyu", "ニョ": "nyo",
  "ヒャ": "hya", "ヒュ": "hyu", "ヒョ": "hyo", "ミャ": "mya", "ミュ": "myu", "ミョ": "myo",
  "リャ": "rya", "リュ": "ryu", "リョ": "ryo", "ギャ": "gya", "ギュ": "gyu", "ギョ": "gyo",
  "ジャ": "ja", "ジュ": "ju", "ジョ": "jo", "ビャ": "bya", "ビュ": "byu", "ビョ": "byo",
  "ピャ": "pya", "ピュ": "pyu", "ピョ": "pyo", "ファ": "fa", "フィ": "fi", "フェ": "fe", "フォ": "fo",
  "ウィ": "wi", "ウェ": "we", "ヴァ": "va", "ティ": "ti", "ディ": "di", "デュ": "du", "チェ": "che", "シェ": "she", "ジェ": "je",
};
const MONOGRAPHS: Record<string, string> = {
  "ア": "a", "イ": "i", "ウ": "u", "エ": "e", "オ": "o",
  "カ": "ka", "キ": "ki", "ク": "ku", "ケ": "ke", "コ": "ko",
  "サ": "sa", "シ": "shi", "ス": "su", "セ": "se", "ソ": "so",
  "タ": "ta", "チ": "chi", "ツ": "tsu", "テ": "te", "ト": "to",
  "ナ": "na", "ニ": "ni", "ヌ": "nu", "ネ": "ne", "ノ": "no",
  "ハ": "ha", "ヒ": "hi", "フ": "fu", "ヘ": "he", "ホ": "ho",
  "マ": "ma", "ミ": "mi", "ム": "mu", "メ": "me", "モ": "mo",
  "ヤ": "ya", "ユ": "yu", "ヨ": "yo",
  "ラ": "ra", "リ": "ri", "ル": "ru", "レ": "re", "ロ": "ro",
  "ワ": "wa", "ヲ": "o", "ン": "n",
  "ガ": "ga", "ギ": "gi", "グ": "gu", "ゲ": "ge", "ゴ": "go",
  "ザ": "za", "ジ": "ji", "ズ": "zu", "ゼ": "ze", "ゾ": "zo",
  "ダ": "da", "ヂ": "ji", "ヅ": "zu", "デ": "de", "ド": "do",
  "バ": "ba", "ビ": "bi", "ブ": "bu", "ベ": "be", "ボ": "bo",
  "パ": "pa", "ピ": "pi", "プ": "pu", "ペ": "pe", "ポ": "po",
  "ァ": "a", "ィ": "i", "ゥ": "u", "ェ": "e", "ォ": "o", "ッ": "", "ー": "",
};

/** ひらがな→カタカナ */
export function hiraToKata(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

/** カタカナ→ローマ字（Hepburn風・促音は次子音重ね） */
export function kataToRomaji(kata: string): string {
  let out = "";
  for (let i = 0; i < kata.length; i++) {
    const two = kata.slice(i, i + 2);
    if (DIGRAPHS[two]) {
      out += kata[i - 0] === "ッ" ? "" : "";
      out += DIGRAPHS[two];
      i++;
      continue;
    }
    const c = kata[i];
    if (c === "ッ") {
      // 次の音の先頭子音を重ねる
      const nxt = DIGRAPHS[kata.slice(i + 1, i + 3)] || MONOGRAPHS[kata[i + 1]] || "";
      out += nxt.charAt(0);
      continue;
    }
    out += MONOGRAPHS[c] ?? c;
  }
  return out;
}

/**
 * ローマ字表記ゆれの正規化＋長音潰し。
 * 例: jyunna→junna, yuuko/yūko→yuko, si→shi, tu→tsu
 */
export function collapseRomaji(s: string): string {
  let r = s.toLowerCase().replace(/[^a-zāīūēō]/g, "");
  r = r.replace(/ā/g, "a").replace(/ī/g, "i").replace(/ū/g, "u").replace(/ē/g, "e").replace(/ō/g, "o");
  // 訓令式→ヘボン式
  r = r.replace(/jy([auo])/g, "j$1").replace(/sy([auo])/g, "sh$1").replace(/ty([auo])/g, "ch$1").replace(/zy([auo])/g, "j$1");
  r = r.replace(/si/g, "shi").replace(/ti/g, "chi").replace(/tu/g, "tsu").replace(/hu/g, "fu").replace(/zi/g, "ji");
  // 長音・連母音を1つに潰す（ou/oo→o, uu→u, ...）
  r = r.replace(/ou/g, "o").replace(/([aiueo])\1+/g, "$1");
  // nn→n（ローマ字入力の「ん」）
  r = r.replace(/nn/g, "n");
  return r;
}

const isAscii = (s: string) => /^[\x20-\x7e]+$/.test(s);
const hasKanji = (s: string) => /[一-龯]/.test(s);

// ===== kuromoji tokenizer（初回のみ辞書ロード） =====
type Tokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>;
let _tokenizerPromise: Promise<Tokenizer> | null = null;

function getTokenizer(): Promise<Tokenizer> {
  if (_tokenizerPromise) return _tokenizerPromise;
  const require_ = createRequire(import.meta.url);
  const dicPath = path.join(path.dirname(require_.resolve("kuromoji/package.json")), "dict");
  _tokenizerPromise = new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath }).build((err, tokenizer) => {
      if (err) reject(err);
      else resolve(tokenizer);
    });
  });
  return _tokenizerPromise;
}

/** 名前の読みキー（collapsed romaji）と、トークン別キーを返す */
async function readingKeys(name: string): Promise<{ full: string; tokens: string[] }> {
  const clean = (name || "").replace(/[\s　]/g, "");
  if (!clean) return { full: "", tokens: [] };
  if (isAscii(clean)) {
    const k = collapseRomaji(clean);
    return { full: k, tokens: [k] };
  }
  if (!hasKanji(clean)) {
    // かなのみ → 直接読みに
    const k = collapseRomaji(kataToRomaji(hiraToKata(clean)));
    return { full: k, tokens: [k] };
  }
  const tokenizer = await getTokenizer();
  const tokens = tokenizer.tokenize(clean);
  const readings = tokens.map((t) =>
    t.reading && t.reading !== "*" ? t.reading : hiraToKata(t.surface_form)
  );
  const tokenKeys = readings.map((r) => collapseRomaji(kataToRomaji(r))).filter(Boolean);
  return { full: tokenKeys.join(""), tokens: tokenKeys };
}

export interface SuggestInput {
  /** 未マッチのアンケート表記 */
  names: string[];
  /** 月末報告書の正式名（名簿） */
  roster: string[];
}
export interface Suggestion {
  name: string;
  /** 候補の正式名（null=候補なし＝手動選択） */
  suggested: string | null;
  /** high=フルネーム読み一致 / mid=名 or 姓トークンの読み一致 */
  confidence: "high" | "mid" | null;
}

/** 未マッチ名それぞれに、名簿からの候補を読み仮名ベースで推定する */
export async function suggestStaffMatches(input: SuggestInput): Promise<Suggestion[]> {
  const rosterKeys = await Promise.all(
    input.roster.map(async (r) => ({ name: r, keys: await readingKeys(r) }))
  );
  const out: Suggestion[] = [];
  for (const name of input.names) {
    const k = await readingKeys(name);
    let suggested: string | null = null;
    let confidence: Suggestion["confidence"] = null;
    if (k.full) {
      // 1) フルネーム読み一致（高）
      const fullHit = rosterKeys.find((r) => r.keys.full && r.keys.full === k.full);
      if (fullHit) {
        suggested = fullHit.name;
        confidence = "high";
      } else {
        // 2) トークン（名 or 姓）読み一致（中）。複数店舗で同読みがいる場合は最初の1件
        const midHit = rosterKeys.find(
          (r) =>
            r.keys.tokens.some((t) => t.length >= 3 && (t === k.full || k.tokens.includes(t)))
        );
        if (midHit) {
          suggested = midHit.name;
          confidence = "mid";
        }
      }
    }
    out.push({ name, suggested, confidence });
  }
  return out;
}
