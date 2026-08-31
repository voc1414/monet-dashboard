/**
 * 担当者名の表記ゆれを、スタッフマスタの「かな」から機械生成する層。
 *
 * ファンくるの担当者欄はお客様の自由記述で、同じ人が
 * 「山口」「やまぐち」「ヤマグチ」「yamaguchi」「じゅんな」「Junna」…と何通りにも書かれる。
 * 以前はこれを人が手で並べた表（STYLIST_NAME_ALIASES・約30キー）で吸収していたが、
 * 表は腐る: 名簿から消えた人のキーが3つ残り、「坂手」は読みが清音で誤登録され（正=さかで）、
 * 新人が入るたびに誰かが追記しなければ紐づかなかった。
 *
 * そこで **Notion「全スタッフ一覧」の「かな」1列だけを人が入れ**、
 * カタカナ・ローマ字（ヘボン式/訓令式のゆれ含む）・姓/名/姓名結合はここで機械生成する。
 * 新人が増えても、かなを入れれば別名は自動で付いてくる（コード変更は不要）。
 *
 * 漢字の姓のみ／名のみは生成しない。useFankuruData の nameContain が
 * 日本語の2文字以上の部分一致を既に許しているため（「杉本」→「杉本寛子」はそれで当たる）。
 *
 * 同じ店舗に同じ読みの人が2人いる別名（例: 楽々園院の井上恵子と前田慶子＝どちらも「けいこ」）は
 * **どちらにも紐づけない**。誤ってどちらかに付けるより、未マッチとして管理画面の
 * 検出パネルに出し、人が判断するほうが安全（データの信頼性を優先する）。
 */
import { STAFF_MASTER } from "@/data/staffMaster";

/** ひらがな → ローマ字。1つの音に複数の綴りがある場合は全部候補にする */
const HEPBURN: Array<[string, string[]]> = [
  // 拗音・特殊を先に（長い綴りから当てる）
  ["きゃ", ["kya"]], ["きゅ", ["kyu"]], ["きょ", ["kyo"]],
  ["ぎゃ", ["gya"]], ["ぎゅ", ["gyu"]], ["ぎょ", ["gyo"]],
  ["しゃ", ["sha", "sya"]], ["しゅ", ["shu", "syu"]], ["しょ", ["sho", "syo"]],
  ["じゃ", ["ja", "jya", "zya"]], ["じゅ", ["ju", "jyu", "zyu"]], ["じょ", ["jo", "jyo", "zyo"]],
  ["ちゃ", ["cha", "tya"]], ["ちゅ", ["chu", "tyu"]], ["ちょ", ["cho", "tyo"]],
  ["にゃ", ["nya"]], ["にゅ", ["nyu"]], ["にょ", ["nyo"]],
  ["ひゃ", ["hya"]], ["ひゅ", ["hyu"]], ["ひょ", ["hyo"]],
  ["びゃ", ["bya"]], ["びゅ", ["byu"]], ["びょ", ["byo"]],
  ["ぴゃ", ["pya"]], ["ぴゅ", ["pyu"]], ["ぴょ", ["pyo"]],
  ["みゃ", ["mya"]], ["みゅ", ["myu"]], ["みょ", ["myo"]],
  ["りゃ", ["rya"]], ["りゅ", ["ryu"]], ["りょ", ["ryo"]],
  ["あ", ["a"]], ["い", ["i"]], ["う", ["u"]], ["え", ["e"]], ["お", ["o"]],
  ["か", ["ka"]], ["き", ["ki"]], ["く", ["ku"]], ["け", ["ke"]], ["こ", ["ko"]],
  ["が", ["ga"]], ["ぎ", ["gi"]], ["ぐ", ["gu"]], ["げ", ["ge"]], ["ご", ["go"]],
  ["さ", ["sa"]], ["し", ["shi", "si"]], ["す", ["su"]], ["せ", ["se"]], ["そ", ["so"]],
  ["ざ", ["za"]], ["じ", ["ji", "zi"]], ["ず", ["zu"]], ["ぜ", ["ze"]], ["ぞ", ["zo"]],
  ["た", ["ta"]], ["ち", ["chi", "ti"]], ["つ", ["tsu", "tu"]], ["て", ["te"]], ["と", ["to"]],
  ["だ", ["da"]], ["ぢ", ["ji"]], ["づ", ["zu"]], ["で", ["de"]], ["ど", ["do"]],
  ["な", ["na"]], ["に", ["ni"]], ["ぬ", ["nu"]], ["ね", ["ne"]], ["の", ["no"]],
  ["は", ["ha"]], ["ひ", ["hi"]], ["ふ", ["fu", "hu"]], ["へ", ["he"]], ["ほ", ["ho"]],
  ["ば", ["ba"]], ["び", ["bi"]], ["ぶ", ["bu"]], ["べ", ["be"]], ["ぼ", ["bo"]],
  ["ぱ", ["pa"]], ["ぴ", ["pi"]], ["ぷ", ["pu"]], ["ぺ", ["pe"]], ["ぽ", ["po"]],
  ["ま", ["ma"]], ["み", ["mi"]], ["む", ["mu"]], ["め", ["me"]], ["も", ["mo"]],
  ["や", ["ya"]], ["ゆ", ["yu"]], ["よ", ["yo"]],
  ["ら", ["ra"]], ["り", ["ri"]], ["る", ["ru"]], ["れ", ["re"]], ["ろ", ["ro"]],
  ["わ", ["wa"]], ["ゐ", ["i"]], ["ゑ", ["e"]], ["を", ["o"]],
  ["ん", ["n"]],
];

/** 組合せ爆発の上限（「じゅんな」のように1音に3綴りある名前でも数十件で収まる） */
const MAX_VARIANTS = 64;

function hiraToKata(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

/** ひらがな → ローマ字のゆれ集合。促音・長音・連続母音の縮約も出す */
function toRomajiVariants(kana: string): string[] {
  let results: string[] = [""];
  let i = 0;
  while (i < kana.length) {
    const ch = kana[i];
    // 促音「っ」: 後続の子音を重ねる（例: いっせい → issei）
    if (ch === "っ") {
      const rest = toRomajiVariants(kana.slice(i + 1));
      const out = new Set<string>();
      for (const base of results) {
        for (const r of rest) {
          if (r) out.add(base + r[0] + r);
        }
      }
      return Array.from(out).slice(0, MAX_VARIANTS);
    }
    // 長音「ー」: 直前の母音を伸ばす形と伸ばさない形の両方（例: ゆーこ → yuko / yuuko）
    if (ch === "ー") {
      const out = new Set<string>();
      for (const base of results) {
        out.add(base);
        const last = base[base.length - 1];
        if (last && "aiueo".includes(last)) out.add(base + last);
      }
      results = Array.from(out).slice(0, MAX_VARIANTS);
      i += 1;
      continue;
    }
    let matched: [string, string[]] | null = null;
    for (const [k, vs] of HEPBURN) {
      if (kana.startsWith(k, i)) {
        matched = [k, vs];
        break;
      }
    }
    if (!matched) {
      i += 1; // 表に無い文字（想定外）は読み飛ばす
      continue;
    }
    const out = new Set<string>();
    for (const base of results) for (const v of matched[1]) out.add(base + v);
    results = Array.from(out).slice(0, MAX_VARIANTS);
    i += matched[0].length;
  }
  // 連続母音の縮約ゆれ（ゆうこ → yuuko と yuko の両方を出す）
  const withContractions = new Set(results);
  for (const r of results) {
    withContractions.add(r.replace(/uu/g, "u").replace(/oo/g, "o").replace(/ou/g, "o"));
  }
  return Array.from(withContractions).slice(0, MAX_VARIANTS);
}

/** 照合キー: 空白（半角/全角）除去＋小文字化。他の名寄せ層と同じ規則 */
export function aliasKey(s: string): string {
  return (s || "").replace(/[\s　]/g, "").toLowerCase();
}

/**
 * 1名分の別名集合を生成する（かな・カタカナ・ローマ字ゆれ／姓・名・姓名結合・名姓結合）。
 * かなが空の人は氏名と表示名だけになる（＝ローマ字・かな表記では当たらない）。
 */
export function generateAliases(entry: { name: string; displayName: string; kana: string }): Set<string> {
  const out = new Set<string>();
  const add = (s: string) => {
    const k = aliasKey(s);
    // 1文字の別名は誤爆しやすいので採らない
    if (k.length >= 2) out.add(k);
  };

  const [sei = "", mei = ""] = (entry.kana || "").trim().split(/[\s　]+/);
  const readings = [sei, mei, sei + mei, mei + sei].filter(Boolean);
  for (const r of readings) {
    add(r);                                  // ひらがな
    add(hiraToKata(r));                      // カタカナ
    for (const romaji of toRomajiVariants(r)) add(romaji); // ローマ字ゆれ
  }
  add(entry.name);         // 氏名（空白除去）
  add(entry.displayName);  // サロンボード表示名（ローマ字が多い）
  return out;
}

/**
 * 機械生成では出せない例外だけを手で持つ表。**ここを増やさないのが本来の運用**。
 * 読みの間違いは Notion の「かな」を直す。ここに足すのは次の2種類に限る:
 *   ① 元データ側の打ち間違い（かなからは絶対に導けない）
 *   ② 漢字の書き間違い（読みは合っているが字が違う）
 * キー = スタッフマスタの氏名。
 */
const MANUAL_EXCEPTIONS: Record<string, string[]> = {
  // ①「Minaho」を「Minato」と打ち間違えたPDFがある（林 確認済み 2026-07-06）
  "天野美奈穂": ["minato"],
  // ②「純奈」を「純菜」と書いたPDFがある
  "山口純奈": ["純菜"],
};

type StaffAlias = {
  name: string;
  store: string;
  displayName: string;
  /** 完全一致で使ってよい別名（店舗内で完全一致が衝突するものは除外済み） */
  aliases: Set<string>;
  /**
   * 部分一致で使ってよい別名。aliases の部分集合。
   * 担当者欄は自由記述なので、読みの一部しか書かれないことがある（"ナオ"←なおえ）。
   * 逆に余分な字が付くこともある（"由恵（よしえさん）"←よしえ）。だから部分一致は要る。
   * ただし部分一致は同一店舗の別人を巻き込む: 土橋院で「まゆ」（中島真優）は
   * 「まゆこ」（湯木麻由子）に含まれてしまう。この手の包含関係にある別名は
   * 部分一致から外す＝「まゆ」「まゆこ」はそれぞれ完全一致でだけ当てる。
   */
  partial: Set<string>;
};

function isAsciiOnly(s: string): boolean {
  return /^[\x00-\x7F]+$/.test(s);
}

/**
 * 別名 a と b が部分一致で取り違えを起こす関係か。
 * 判定は useFankuruData の nameContain と同じ物差し（英字同士は部分一致しない・
 * 2文字未満は見ない）。完全一致は別扱いなので false を返す。
 */
function overlaps(a: string, b: string): boolean {
  if (a === b) return false;
  if (a.length < 2 || b.length < 2) return false;
  if (isAsciiOnly(a) && isAsciiOnly(b)) return false;
  return a.includes(b) || b.includes(a);
}

/** 全スタッフの別名（店舗内で衝突するものは除外済み） */
const STAFF_ALIASES: StaffAlias[] = (() => {
  const built = STAFF_MASTER.map((s) => {
    const aliases = generateAliases(s);
    for (const extra of MANUAL_EXCEPTIONS[s.name] ?? []) aliases.add(aliasKey(extra));
    return {
      name: s.name,
      store: s.store,
      displayName: s.displayName,
      aliases,
      partial: new Set<string>(),
    };
  });

  // 同一店舗で2人以上が持つ別名は、どちらにも紐づけない（誤配賦より未マッチを選ぶ）
  const byStore = new Map<string, StaffAlias[]>();
  for (const s of built) {
    const list = byStore.get(s.store) ?? [];
    list.push(s);
    byStore.set(s.store, list);
  }
  for (const list of byStore.values()) {
    const count = new Map<string, number>();
    for (const s of list) for (const a of s.aliases) count.set(a, (count.get(a) ?? 0) + 1);
    for (const s of list) {
      for (const a of Array.from(s.aliases)) {
        // 氏名そのもの・表示名そのものは残す（この2つが店舗内で衝突するなら同姓同名＝別途対応）
        if ((count.get(a) ?? 0) > 1 && a !== aliasKey(s.name) && a !== aliasKey(s.displayName)) {
          s.aliases.delete(a);
        }
      }
    }
  }

  // 部分一致で使ってよい別名を決める。
  // 同じ店舗の別人の別名と包含関係にあるものは外す（"まゆ" ⊂ "まゆこ" 問題）。
  // 外しても完全一致は残るので、「まゆ」→中島真優／「まゆこ」→湯木麻由子 は当たる。
  for (const list of byStore.values()) {
    for (const s of list) {
      for (const a of s.aliases) {
        const clash = list.some(
          (other) => other !== s && Array.from(other.aliases).some((b) => overlaps(a, b))
        );
        if (!clash) s.partial.add(a);
      }
    }
  }
  return built;
})();

/**
 * 部分一致の**入力**として使うと、同一店舗の2人に当たってしまう文字列（店舗ごと）。
 *
 * 別名そのものを店舗内で重複排除しても、部分一致は取り違えを起こす:
 * 楽々園院の「けいこ」は完全一致から落としてあるが、姓名結合の
 * 「いのうえけいこ」「まえだけいこ」の**両方に含まれる**ため、
 * お客様が「けいこ」とだけ書くと井上恵子・前田慶子の両ページに紐づいてしまう（＝二重計上）。
 *
 * そこで、部分一致に使える別名（partial）の2文字以上の部分文字列を全部数え、
 * 同一店舗で2人以上が持つものを「部分一致の入力に使ってはいけない語」として禁止する。
 * 完全一致は別経路なので、「まゆ」→中島真優 のように本人が一意に決まる分は残る。
 */
const AMBIGUOUS_PARTIAL_INPUTS: Map<string, Map<string, string[]>> = (() => {
  const byStore = new Map<string, StaffAlias[]>();
  for (const s of STAFF_ALIASES) {
    const list = byStore.get(s.store) ?? [];
    list.push(s);
    byStore.set(s.store, list);
  }
  const out = new Map<string, Map<string, string[]>>();
  for (const [store, list] of byStore) {
    // 部分文字列 → それを持つ人の氏名
    const owners = new Map<string, Set<string>>();
    for (const s of list) {
      const subs = new Set<string>();
      for (const a of s.partial) {
        if (isAsciiOnly(a)) continue; // 英字同士は部分一致しない（nameContain の規則）
        for (let i = 0; i < a.length; i++) {
          for (let j = i + 2; j <= a.length; j++) {
            const sub = a.slice(i, j);
            if (!isAsciiOnly(sub)) subs.add(sub);
          }
        }
      }
      for (const sub of subs) {
        const names = owners.get(sub) ?? new Set<string>();
        names.add(s.name);
        owners.set(sub, names);
      }
    }
    // 禁止語 → それを含む2人以上の氏名（管理画面で理由を出すため氏名も残す）
    const banned = new Map<string, string[]>();
    for (const [sub, names] of owners) if (names.size > 1) banned.set(sub, Array.from(names));
    out.set(store, banned);
  }
  return out;
})();

/**
 * その文字列を部分一致の入力に使うと同一店舗で2人に当たるか。
 * store が空／マスタに無い店舗のときは全店舗の合併で判断する（安全側に倒す）。
 */
export function isAmbiguousPartialInput(store: string, key: string): boolean {
  if (key.length < 2) return false;
  const banned = AMBIGUOUS_PARTIAL_INPUTS.get(store);
  if (banned) return banned.has(key);
  for (const set of AMBIGUOUS_PARTIAL_INPUTS.values()) if (set.has(key)) return true;
  return false;
}

/** 同一店舗内で読みが衝突して、意図的に捨てた別名（管理画面での説明用） */
export const INTRA_STORE_AMBIGUOUS: Array<{ store: string; alias: string; names: string[] }> = (() => {
  const out: Array<{ store: string; alias: string; names: string[] }> = [];
  const byStore = new Map<string, typeof STAFF_MASTER>();
  for (const s of STAFF_MASTER) {
    const list = byStore.get(s.store) ?? [];
    list.push(s);
    byStore.set(s.store, list as typeof STAFF_MASTER);
  }
  for (const [store, list] of byStore) {
    const owners = new Map<string, string[]>();
    for (const s of list) {
      for (const a of generateAliases(s)) {
        const names = owners.get(a) ?? [];
        names.push(s.name);
        owners.set(a, names);
      }
    }
    for (const [alias, names] of owners) {
      if (names.length > 1) out.push({ store, alias, names });
    }
  }
  return out;
})();

/** INTRA_STORE_AMBIGUOUS を店舗→別名→氏名で引ける索引に畳んだもの */
const INTRA_STORE_AMBIGUOUS_INDEX: Map<string, Map<string, string[]>> = (() => {
  const out = new Map<string, Map<string, string[]>>();
  for (const { store, alias, names } of INTRA_STORE_AMBIGUOUS) {
    const byAlias = out.get(store) ?? new Map<string, string[]>();
    byAlias.set(alias, names);
    out.set(store, byAlias);
  }
  return out;
})();

/**
 * その担当者名が「同じ店舗に同じ読みの人が2人以上いるため、意図的にどちらにも
 * 紐づけなかった」名前か。該当すれば衝突している氏名を返し、しなければ undefined。
 *
 * 管理画面の未マッチ検出パネルがこれを使う。未マッチの理由が「名簿に居ない」なのか
 * 「読みが衝突していて機械では決められない」なのかで、人がやることが正反対になる:
 * 前者は別名を登録すれば直るが、後者は**登録してはいけない**（DB由来の別名は
 * 生成別名より優先されるため、登録すると取り違えが確定して元に戻せない）。
 * 後者の直し方は元データ（ファンくる／NPSの担当者欄）に氏名を書いてもらうことだけ。
 *
 * store がマスタに無いときは全店舗の合併で判断する（安全側に倒す）。
 */
export function ambiguousOwnersFor(store: string, input: string): string[] | undefined {
  const key = aliasKey(input);
  if (!key) return undefined;

  // 店舗がマスタに在るか。AMBIGUOUS_PARTIAL_INPUTS は在籍者の居る全店舗を必ず持つ
  // （衝突が無い店舗も空の Map を持つ）ので、ここで「店舗を知っているか」を判定できる。
  // 衝突が無いだけの店舗を「未知の店舗」と誤判定して他店舗の衝突を返さないための分岐。
  if (AMBIGUOUS_PARTIAL_INPUTS.has(store)) {
    // ① 完全一致から捨てた別名（楽々園院の「けいこ」型）
    const hit = INTRA_STORE_AMBIGUOUS_INDEX.get(store)?.get(key);
    if (hit) return hit;
    // ② 部分一致の入力として禁止した語（「いのうえけいこ」「まえだけいこ」に共通する部分）
    if (key.length < 2) return undefined;
    return AMBIGUOUS_PARTIAL_INPUTS.get(store)!.get(key);
  }

  // 店舗が分からない／マスタに無いときは全店舗の合併で判断する（安全側に倒す）
  for (const byAlias of INTRA_STORE_AMBIGUOUS_INDEX.values()) {
    const hit = byAlias.get(key);
    if (hit) return hit;
  }
  if (key.length < 2) return undefined;
  for (const byKey of AMBIGUOUS_PARTIAL_INPUTS.values()) {
    const hit = byKey.get(key);
    if (hit) return hit;
  }
  return undefined;
}

/** 氏名／表示名 → その人の別名集合 */
const ALIASES_BY_STAFF = new Map<string, Set<string>>();
/** 氏名／表示名 → その人の別名集合のうち、部分一致で使ってよいもの */
const PARTIAL_BY_STAFF = new Map<string, Set<string>>();
for (const s of STAFF_ALIASES) {
  ALIASES_BY_STAFF.set(aliasKey(s.name), s.aliases);
  PARTIAL_BY_STAFF.set(aliasKey(s.name), s.partial);
  // 表示名は複数店舗で重複する（Mika / Yu / Nao 等）。重複する表示名では引かせない
  const dkey = aliasKey(s.displayName);
  if (dkey && dkey !== aliasKey(s.name)) {
    const dup = STAFF_ALIASES.filter((x) => aliasKey(x.displayName) === dkey).length > 1;
    if (!dup) {
      ALIASES_BY_STAFF.set(dkey, s.aliases);
      PARTIAL_BY_STAFF.set(dkey, s.partial);
    }
  }
}

/**
 * スタッフ名（氏名でも表示名でもよい）から、その人の別名集合を引く。
 * マスタに居ない人（過去スタッフ等）は undefined。
 */
export function aliasesForStaff(staffName: string): Set<string> | undefined {
  return ALIASES_BY_STAFF.get(aliasKey(staffName));
}

/**
 * 同上だが、**部分一致に使ってよい別名だけ**を返す。
 * 完全一致には aliasesForStaff を使う（そちらの方が広い）。
 */
export function partialAliasesForStaff(staffName: string): Set<string> | undefined {
  return PARTIAL_BY_STAFF.get(aliasKey(staffName));
}

/**
 * 店舗＋（氏名または表示名）→ その人。
 *
 * 上の ALIASES_BY_STAFF は表示名が複数店舗で重複する人（"Mika" = 堀江院の西本 美華 と
 * 福島院の松野 美香）を**わざと引かせない**。名前だけで引くと別人を巻き込むためだが、
 * 店舗が分かっている画面（アンケート一覧は店舗ごとに束ねている）では引けないと困る:
 * 堀江院のファンくる「ミカ」が西本 美華のカードに合流せず、独立した「ミカ」カードになる。
 * そこで店舗をキーに含めた索引を別に持ち、店舗が分かる呼び出しではこちらを使う。
 */
const BY_STORE_AND_NAME = new Map<string, StaffAlias>();
{
  const dupInStore = new Set<string>();
  for (const s of STAFF_ALIASES) {
    for (const key of [aliasKey(s.name), aliasKey(s.displayName)]) {
      if (!key) continue;
      const k = `${s.store} ${key}`;
      const prev = BY_STORE_AND_NAME.get(k);
      // 同一店舗で同じ呼び名の人が2人いたら、どちらにも引かせない（誤配賦より未マッチ）
      if (prev && prev.name !== s.name) dupInStore.add(k);
      else BY_STORE_AND_NAME.set(k, s);
    }
  }
  for (const k of dupInStore) BY_STORE_AND_NAME.delete(k);
}

/**
 * 店舗を絞ってスタッフの別名集合を引く。氏名でも表示名でもよい。
 * その店舗にその名前の人が居ない（または同名2人）ときは undefined。
 */
export function aliasSetsForStaffInStore(
  store: string,
  staffName: string
): { name: string; aliases: Set<string>; partial: Set<string> } | undefined {
  if (!store) return undefined;
  const s = BY_STORE_AND_NAME.get(`${store} ${aliasKey(staffName)}`);
  return s ? { name: s.name, aliases: s.aliases, partial: s.partial } : undefined;
}

/**
 * 別名 → 氏名 の逆引き表。**全店舗を通して一意な別名だけ**を載せる。
 * 例:「みか」は堀江院の西本 美華と福島院の松野 美香の両方に当たるので載せない
 *（店舗が分かる文脈では aliasesForStaff を使う。こちらは店舗が分からない場面用）。
 */
export const GENERATED_ALIAS_TO_CANONICAL: Record<string, string> = (() => {
  const owners = new Map<string, Set<string>>();
  for (const s of STAFF_ALIASES) {
    for (const a of s.aliases) {
      const names = owners.get(a) ?? new Set<string>();
      names.add(s.name);
      owners.set(a, names);
    }
  }
  const map: Record<string, string> = {};
  for (const [alias, names] of owners) {
    if (names.size === 1) map[alias] = Array.from(names)[0];
  }
  return map;
})();

/** スタッフの所属店舗（氏名／表示名から引く。表示名が複数店舗で重複する場合は引けない） */
export const STAFF_STORE_BY_NAME: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const s of STAFF_ALIASES) map[aliasKey(s.name)] = s.store;
  const dupDisplay = new Set<string>();
  const seen = new Map<string, string>();
  for (const s of STAFF_ALIASES) {
    const d = aliasKey(s.displayName);
    if (!d) continue;
    if (seen.has(d) && seen.get(d) !== s.store) dupDisplay.add(d);
    seen.set(d, s.store);
  }
  for (const s of STAFF_ALIASES) {
    const d = aliasKey(s.displayName);
    if (d && !dupDisplay.has(d) && map[d] === undefined) map[d] = s.store;
  }
  return map;
})();
