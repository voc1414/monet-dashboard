/**
 * 機械生成した担当者別名（lib/stylistAlias.ts）の回帰テスト。
 *
 * 2026-08-30、手書きのエイリアス表（旧 STYLIST_NAME_ALIASES・約30キー）を廃止し、
 * Notion「全スタッフ一覧」の「かな」1列からカタカナ・ローマ字・姓名結合を生成する方式にした。
 * このファイルが守るのは次の3点で、いずれも実データ（ファンくるスプシ I列 78行）で確認した性質。
 *
 *   ① 同一店舗の別人を取り違えない（別名を店舗名簿に総当たりして1人しか当たらない）
 *   ② 表を捨てても実データが引き続き着地する（下の「実データで直った/維持できた例」）
 *   ③ 読みが同じ2人の別名はどちらにも紐づけない（誤配賦より未マッチを選ぶ）
 *
 * 別名を足したくなったらこのファイルではなく Notion の「かな」を直す。
 */
import { describe, it, expect, beforeAll } from "vitest";
import { STAFF_MASTER } from "../client/src/data/staffMaster";
import { aliasesForStaff, INTRA_STORE_AMBIGUOUS } from "../client/src/lib/stylistAlias";

let matchesStylist: (stylist: string, target: string) => boolean;
let isRetiredInMonth: (staffName: string, store: string, yearMonth: string) => boolean;

beforeAll(async () => {
  const m = await import("../client/src/hooks/useFankuruData");
  // DB 由来の別名は他テストと共有のグローバル状態。生成ロジックだけを見たいので空にする
  m.setStylistAliasMapFromDb([]);
  matchesStylist = m.matchesStylist;
  isRetiredInMonth = m.isRetiredInMonth;
});

describe("生成別名の取り違え検査（店舗内総当たり）", () => {
  /*
   * 生成した別名を「担当者欄にそう書かれた」と仮定して、同じ店舗の全員に当ててみる。
   * 2人以上に当たる別名が1つでもあれば、その店舗では誰かが取り違えられる。
   * 部分一致を許した副作用（"まゆ" ⊂ "まゆこ"）を検出するのがこのテストの主目的。
   */
  it("どの別名も同一店舗で2人以上に当たらない", () => {
    const stores = Array.from(new Set(STAFF_MASTER.map((s) => s.store)));
    const collisions: string[] = [];
    let checked = 0;

    for (const store of stores) {
      const roster = STAFF_MASTER.filter((s) => s.store === store);
      for (const owner of roster) {
        for (const alias of aliasesForStaff(owner.name) ?? []) {
          checked++;
          const hit = roster.filter((s) => matchesStylist(alias, s.name));
          if (hit.length > 1) {
            collisions.push(
              `${store} "${alias}"（${owner.name}の別名） → ${hit.map((s) => s.name).join(" / ")}`
            );
          }
        }
      }
    }

    expect(checked).toBeGreaterThan(400); // 生成が空回りしていないことの下限
    expect(collisions).toEqual([]);
  });

  /*
   * 上のテストは「別名そのもの」を入力にした場合しか見ていない。
   * お客様は読みの一部だけを書く（"ナオ"・"ユウ"）ので、入力は別名の部分文字列にもなる。
   * そこで別名の2〜4文字の部分文字列を全部「そう書かれた」と仮定して店舗名簿に当てる。
   * 楽々園院の "けいこ"（"いのうえけいこ" と "まえだけいこ" の両方に含まれる）が
   * 2人に当たっていたのをこの検査で見つけた（2026-08-30 修正）。
   */
  it("別名の部分文字列を入力にしても同一店舗で2人以上に当たらない", () => {
    const nonAscii = (s: string) => !/^[\x00-\x7F]+$/.test(s);
    const stores = Array.from(new Set(STAFF_MASTER.map((s) => s.store)));
    const collisions: string[] = [];
    let checked = 0;

    for (const store of stores) {
      const roster = STAFF_MASTER.filter((s) => s.store === store);
      const candidates = new Set<string>();
      for (const s of roster) {
        for (const alias of aliasesForStaff(s.name) ?? []) {
          if (!nonAscii(alias)) continue;
          for (let i = 0; i < alias.length; i++) {
            for (let len = 2; len <= 4 && i + len <= alias.length; len++) {
              const sub = alias.slice(i, i + len);
              if (nonAscii(sub)) candidates.add(sub);
            }
          }
        }
      }
      for (const input of candidates) {
        checked++;
        const hit = roster.filter((s) => matchesStylist(input, s.name));
        if (hit.length > 1) {
          collisions.push(`${store} "${input}" → ${hit.map((s) => s.name).join(" / ")}`);
        }
      }
    }

    expect(checked).toBeGreaterThan(1000); // 候補生成が空回りしていないことの下限
    expect(collisions).toEqual([]);
  });

  it("土橋院の「まゆ」と「まゆこ」は完全一致でそれぞれの本人にだけ当たる", () => {
    // 中島真優（なかしま まゆ）と湯木麻由子（ゆき まゆこ）は同じ店舗。
    // "まゆ" ⊂ "まゆこ" なので部分一致に任せると両方に当たる。完全一致で分ける。
    expect(matchesStylist("まゆ", "中島真優")).toBe(true);
    expect(matchesStylist("まゆ", "湯木麻由子")).toBe(false);
    expect(matchesStylist("まゆこ", "湯木麻由子")).toBe(true);
    expect(matchesStylist("まゆこ", "中島真優")).toBe(false);
  });

  it("同一店舗で読みが衝突する別名はどちらにも紐づけない", () => {
    // 楽々園院: 井上恵子・前田慶子 がどちらも「けいこ」
    expect(matchesStylist("けいこ", "井上恵子")).toBe(false);
    expect(matchesStylist("けいこ", "前田慶子")).toBe(false);
    expect(matchesStylist("ケイコ", "井上恵子")).toBe(false);
    expect(matchesStylist("keiko", "前田慶子")).toBe(false);
    // 捨てた事実は管理画面に出せるよう記録されている
    expect(
      INTRA_STORE_AMBIGUOUS.some((a) => a.store === "楽々園院" && a.alias === "けいこ")
    ).toBe(true);
  });
});

describe("実データで直った/維持できた着地（ファンくるスプシ I列 実測）", () => {
  it("かなの読みで当たる（旧表は「坂手」を清音で誤登録していた）", () => {
    // 正= さかで。旧 STYLIST_NAME_ALIASES は "さかて" で登録されており当たらなかった
    expect(matchesStylist("さかで", "坂手 芳")).toBe(true);
    expect(matchesStylist("サカデ", "坂手 芳")).toBe(true);
    expect(matchesStylist("坂手", "坂手 芳")).toBe(true);
  });

  it("読みの一部しか書かれていない担当者名が当たる（部分一致）", () => {
    expect(matchesStylist("ナオ", "橋本 尚江")).toBe(true); // かな= はしもと なおえ
    expect(matchesStylist("ユウ", "末次 優香")).toBe(true); // かな= すえつぐ ゆうか
    expect(matchesStylist("由恵（よしえさん）", "渡利 由恵")).toBe(true);
  });

  it("ローマ字のゆれが当たる", () => {
    expect(matchesStylist("junna", "山口純奈")).toBe(true);
    expect(matchesStylist("jyunna", "山口純奈")).toBe(true);
    expect(matchesStylist("ヒロコ", "杉本寛子")).toBe(true);
    expect(matchesStylist("sayuri", "徳永 さゆり")).toBe(true);
  });

  it("元データ側の打ち間違いは MANUAL_EXCEPTIONS で拾う", () => {
    expect(matchesStylist("Minato", "天野美奈穂")).toBe(true); // Minaho の打ち間違い
    expect(matchesStylist("純菜", "山口純奈")).toBe(true); // 純奈 の書き間違い
  });

  it("名簿に居ない人には当たらない", () => {
    // 姪浜院の過去スタッフ「ふじたみほ」。名簿から消えているので未マッチが正しい
    const meinohama = STAFF_MASTER.filter((s) => s.store === "姪浜院");
    expect(meinohama.filter((s) => matchesStylist("ふじたみほ", s.name))).toEqual([]);
  });
});

describe("退職月ガード", () => {
  /*
   * 読みから別名を機械生成した結果、退職者の短い読み（池内亜希子 の "Aki" 等）が
   * 在籍中以外の月にも当たるようになった。在籍期間で切る。
   * 判定は newBadge の isRetiredStaff に合わせ「退職月そのものも除外」（>=）。
   * 2026-08-30 林 承認: 月次集計と個別調査で在籍判定がズレる方が困るため既存に揃える。
   */
  it("退職月とそれ以降は紐づけない", () => {
    expect(isRetiredInMonth("池内 亜希子", "堀江院2nd", "2026-04")).toBe(true);
    expect(isRetiredInMonth("池内 亜希子", "堀江院2nd", "2026-05")).toBe(true);
    expect(isRetiredInMonth("池内 亜希子", "堀江院2nd", "2026-03")).toBe(false);
  });

  it("表示名でも氏名でも判定できる（newBadge 側は displayName キー）", () => {
    expect(isRetiredInMonth("Aki", "堀江院2nd", "2026-04")).toBe(true);
    expect(isRetiredInMonth("Hiromi", "堀江院2nd", "2026-07")).toBe(true);
    expect(isRetiredInMonth("Hiromi", "堀江院2nd", "2026-06")).toBe(false);
  });

  it("在籍者・年月不明は除外しない", () => {
    expect(isRetiredInMonth("坂手 芳", "堀江院2nd", "2026-08")).toBe(false);
    expect(isRetiredInMonth("池内 亜希子", "堀江院2nd", "")).toBe(false);
  });
});
