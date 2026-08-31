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
import { readFileSync } from "node:fs";
import path from "node:path";
import { STAFF_MASTER } from "../client/src/data/staffMaster";
import { aliasesForStaff, INTRA_STORE_AMBIGUOUS, ambiguousOwnersFor } from "../client/src/lib/stylistAlias";

let matchesStylist: (stylist: string, target: string, store?: string) => boolean;
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
          const hit = roster.filter((s) => matchesStylist(alias, s.name, store));
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
        const hit = roster.filter((s) => matchesStylist(input, s.name, store));
        if (hit.length > 1) {
          collisions.push(`${store} "${input}" → ${hit.map((s) => s.name).join(" / ")}`);
        }
      }
    }

    expect(checked).toBeGreaterThan(1000); // 候補生成が空回りしていないことの下限
    expect(collisions).toEqual([]);
  });

  /*
   * アンケート一覧のカードは、NPS側が表示名（"Mika"）・ファンくる側が氏名（西本 美華）で
   * 立つことがある。同一人物が2枚に割れないよう、店舗を渡せば氏名⇄表示名が必ず
   * 同一人物として合流できなければならない。
   */
  it("氏名と表示名は、店舗を渡せば必ず同一人物として合流する", () => {
    const bad: string[] = [];
    for (const s of STAFF_MASTER) {
      if (s.name === s.displayName) continue;
      if (!matchesStylist(s.name, s.displayName, s.store)) {
        bad.push(`${s.store} 氏名"${s.name}" → 表示名"${s.displayName}"`);
      }
      if (!matchesStylist(s.displayName, s.name, s.store)) {
        bad.push(`${s.store} 表示名"${s.displayName}" → 氏名"${s.name}"`);
      }
    }
    expect(bad).toEqual([]);
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

  /*
   * 表示名が複数店舗で別人として存在する場合（"Mika" = 堀江院 西本 美華 /
   * 福島院 松野 美香）、名前だけではどちらの読みも引けない＝かな書きの「ミカ」が
   * 本人に当たらない。アンケート一覧は店舗ごとに束ねているので店舗を渡して解く。
   * 2026-08-30 実画面で発覚: 堀江院 2026-07 のファンくる「ミカ」が西本 美華の
   * カードに合流せず、独立した「ミカ」カードになっていた。
   */
  it("表示名が複数店舗で重複する人は、店舗を渡せば読みで当たる", () => {
    expect(matchesStylist("ミカ", "Mika", "堀江院")).toBe(true); // 西本 美華
    expect(matchesStylist("ミカ", "Mika", "福島院")).toBe(true); // 松野 美香
    expect(matchesStylist("みか", "Mika", "堀江院")).toBe(true);
    // 氏名で呼ばれるなら店舗は要らない（氏名は全店で一意）
    expect(matchesStylist("ミカ", "西本 美華")).toBe(true);
    // 店舗を渡しても、その店舗の別人には当たらない
    expect(matchesStylist("ミカ", "Kaede", "堀江院")).toBe(false);
    expect(matchesStylist("ミカ", "Yoshie", "福島院")).toBe(false);
  });

  it("店舗を渡しても、同一店舗で読みが衝突する2人は救わない", () => {
    // 楽々園院「けいこ」は店舗が分かっても誰か1人には決まらない＝未マッチのまま
    expect(matchesStylist("けいこ", "井上 恵子", "楽々園院")).toBe(false);
    expect(matchesStylist("けいこ", "前田 慶子", "楽々園院")).toBe(false);
  });

  it("名簿に居ない人には当たらない", () => {
    // 姪浜院の過去スタッフ「ふじたみほ」。名簿から消えているので未マッチが正しい
    const meinohama = STAFF_MASTER.filter((s) => s.store === "姪浜院");
    expect(meinohama.filter((s) => matchesStylist("ふじたみほ", s.name))).toEqual([]);
  });
});

/*
 * 2026-08-31 独立監査の重大①: 「捨てた事実は管理画面に出す」と書いてあるのに、
 * INTRA_STORE_AMBIGUOUS を読む画面が1つも無かった（＝理由が誰にも見えず、
 * 判別不能な名前に［登録］が押せた）。押されると DB 由来の別名が生成別名より
 * 優先されるため、取り違えが確定して機械では戻せない。ここで配線を固定する。
 */
describe("判別不能な名前を管理画面に出すための入口", () => {
  it("完全一致から捨てた別名は、衝突している氏名つきで引ける", () => {
    const owners = ambiguousOwnersFor("楽々園院", "けいこ");
    expect(owners).toBeDefined();
    expect(owners!.length).toBeGreaterThan(1);
    expect(owners!.some((n) => n.includes("恵子"))).toBe(true);
    expect(owners!.some((n) => n.includes("慶子"))).toBe(true);
  });

  it("カタカナ・ローマ字・空白ゆれでも同じ判定になる", () => {
    for (const input of ["ケイコ", "keiko", " けいこ ", "Keiko"]) {
      expect(ambiguousOwnersFor("楽々園院", input), input).toBeDefined();
    }
  });

  it("判定は店舗ごと。衝突が無い店舗は他店舗の衝突を持ち込まない", () => {
    // 「けいこ」が判別不能なのは楽々園院だけ。堀江院に恵子/慶子は居ない
    expect(ambiguousOwnersFor("楽々園院", "けいこ")).toBeDefined();
    expect(ambiguousOwnersFor("堀江院", "けいこ")).toBeUndefined();
    // 店舗が分からない/マスタに無い場合だけ、安全側に倒して全店舗の合併で見る
    expect(ambiguousOwnersFor("", "けいこ")).toBeDefined();
  });

  it("普通に当たる名前・名簿外の名前は判別不能にしない", () => {
    expect(ambiguousOwnersFor("堀江院2nd", "さかで")).toBeUndefined();
    expect(ambiguousOwnersFor("姪浜院", "ふじたみほ")).toBeUndefined(); // 名簿外＝登録で直せる側
    expect(ambiguousOwnersFor("楽々園院", "")).toBeUndefined();
  });

  /*
   * 画面側の配線そのものを固定する。この repo に DOM テスト環境が無いため
   * （vitest.config.ts の environment: "node" / include: server/**）ソースを
   * 文字列で検査している。落ちたときは「配線が外れた」を意味する。
   */
  it("管理画面の未マッチパネルが実際にこの判定を使っている", () => {
    const src = readFileSync(
      path.resolve(import.meta.dirname, "../client/src/pages/admin/AdminSurveys.tsx"),
      "utf8"
    );
    expect(src).toContain('from "@/lib/stylistAlias"');
    expect(src).toContain("ambiguousOwnersFor(u.store, u.name)");
    // 該当行では Select と［登録］を出さない（三項の別枝で理由文を出す）
    expect(src).toContain("ambiguousOwners ? (");
    // 押せない状態でも登録処理側で二重に止める
    expect(src).toContain("ambiguousRows.get(rowKey)");
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
