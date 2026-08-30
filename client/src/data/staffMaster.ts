/**
 * スタッフマスタ — Notion「全スタッフ一覧」DB の写し（自動生成ファイル・手で編集しない）
 *
 * 正本: https://app.notion.com/p/2dfab44d3cb98031a890e8de4ed0d1ff
 *       （data source: collection://2dfab44d-3cb9-8077-8b43-000bfbfa4de8）
 * 生成: npm run sync:staff  （scripts/sync-staff-master.mjs）
 * 対象: Notion 側で「ダッシュボード対象」にチェックのある行＝進捗が 入社済 / 退職 の人。
 *
 * 退社・在籍を直すときは **Notion を編集** してから再生成すること。
 * ここを手で書き換えても次の同期で上書きされる。
 *
 * 注意: displayName（サロンボード表示名）はローマ字が多く、Akiko / Mika / Yu / Nao /
 * Mayu / Minaho / Yukiko が複数店舗に重複する。照合は必ず store とセットで行う。
 *
 * nickname は画面表示専用。照合キーには使わない（lib/staffDisplayName.ts 参照）。
 *
 * kana（"せい めい"）は表記ゆれ照合の材料。カタカナ・ローマ字のゆれは lib/stylistAlias.ts が
 * ここから機械生成する。別名を手で並べた表は増やさない（読みを直すなら Notion の「かな」）。
 */

export type StaffMasterEntry = {
  /** Notion の氏名（人事上の正式名） */
  name: string;
  /** 所属店舗（正規化後の呼称。例: 堀江院2nd） */
  store: string;
  /** サロンボード・月末報告書に出る表示名 */
  displayName: string;
  /**
   * 画面に出す呼び名（Notion「ニックネーム」列）。未入力なら null。
   * 表示専用。照合キーには一切使わない（lib/staffDisplayName.ts が氏名へフォールバック）
   */
  nickname: string | null;
  /**
   * 氏名の読み。"せい めい"（ひらがな・半角スペース区切り）。Notion「かな」列が正本。
   * 表記ゆれ照合の材料で、未入力なら空文字（照合はできるが かな・ローマ字では当たらない）
   */
  kana: string;
  status: "active" | "retired";
  /** "YYYY-MM"。この月以降のデータを除外する。在籍者は null */
  retiredMonth: string | null;
};

export const STAFF_MASTER: StaffMasterEntry[] = [
  { name: "井上恵子", store: "楽々園院", displayName: "井上 恵子", nickname: null, kana: "いのうえ けいこ", status: "active", retiredMonth: null },
  { name: "石原ようこ", store: "楽々園院", displayName: "石原 ようこ", nickname: null, kana: "いしはら ようこ", status: "active", retiredMonth: null },
  { name: "千葉祐子", store: "楽々園院", displayName: "千葉 祐子", nickname: null, kana: "ちば ゆうこ", status: "active", retiredMonth: null },
  { name: "前田慶子", store: "楽々園院", displayName: "前田 慶子", nickname: null, kana: "まえだ けいこ", status: "active", retiredMonth: null },
  { name: "田中江梨子", store: "楽々園院", displayName: "田中 江梨子", nickname: null, kana: "たなか えりこ", status: "active", retiredMonth: null },
  { name: "橋本 尚江", store: "高槻院", displayName: "Nao", nickname: null, kana: "はしもと なおえ", status: "active", retiredMonth: null },
  { name: "原田 明日香", store: "高槻院", displayName: "Asuka", nickname: null, kana: "はらだ あすか", status: "active", retiredMonth: null },
  { name: "田中 莉子", store: "高槻院", displayName: "Mariko", nickname: null, kana: "たなか まりこ", status: "active", retiredMonth: null },
  { name: "藤谷 裕子", store: "高槻院", displayName: "Yuko", nickname: null, kana: "ふじたに ゆうこ", status: "active", retiredMonth: null },
  { name: "小田りえ", store: "土橋院", displayName: "小田 利恵", nickname: null, kana: "おだ りえ", status: "active", retiredMonth: null },
  { name: "中島真優", store: "土橋院", displayName: "中島 真優", nickname: null, kana: "なかしま まゆ", status: "active", retiredMonth: null },
  { name: "湯木麻由子", store: "土橋院", displayName: "湯木 麻由子", nickname: null, kana: "ゆき まゆこ", status: "active", retiredMonth: null },
  { name: "藤原牧子", store: "土橋院", displayName: "藤原 牧子", nickname: null, kana: "ふじわら まきこ", status: "active", retiredMonth: null },
  { name: "松野 美香", store: "福島院", displayName: "Mika", nickname: null, kana: "まつの みか", status: "active", retiredMonth: null },
  { name: "杉本寛子", store: "福島院", displayName: "Hiroko", nickname: null, kana: "すぎもと ひろこ", status: "active", retiredMonth: null },
  { name: "渡利 由恵", store: "福島院", displayName: "Yoshie", nickname: null, kana: "わたり よしえ", status: "active", retiredMonth: null },
  { name: "尾﨑仁美", store: "福島院", displayName: "Hitomi", nickname: null, kana: "おざき ひとみ", status: "retired", retiredMonth: "2026-04" },
  { name: "末次 優香", store: "福島院", displayName: "Yu", nickname: null, kana: "すえつぐ ゆうか", status: "active", retiredMonth: null },
  { name: "木下夕季子", store: "福島院", displayName: "Yukiko", nickname: null, kana: "きのした ゆきこ", status: "active", retiredMonth: null },
  { name: "齊藤 佳代", store: "福島院", displayName: "Kayo", nickname: null, kana: "さいとう かよ", status: "active", retiredMonth: null },
  { name: "小池明子", store: "堀江院", displayName: "Akiko", nickname: null, kana: "こいけ あきこ", status: "active", retiredMonth: null },
  { name: "西本 美華", store: "堀江院", displayName: "Mika", nickname: null, kana: "にしもと みか", status: "active", retiredMonth: null },
  { name: "谷口 楓", store: "堀江院", displayName: "Kaede", nickname: null, kana: "たにぐち かえで", status: "active", retiredMonth: null },
  { name: "安達 まり", store: "堀江院2nd", displayName: "Mimi", nickname: null, kana: "あだち まり", status: "active", retiredMonth: null },
  { name: "坂手 芳", store: "堀江院2nd", displayName: "坂手", nickname: null, kana: "さかで かおる", status: "active", retiredMonth: null },
  { name: "三宅 和美", store: "堀江院2nd", displayName: "Kazumi", nickname: null, kana: "みやけ かずみ", status: "retired", retiredMonth: "2026-03" },
  { name: "池内 亜希子", store: "堀江院2nd", displayName: "Aki", nickname: null, kana: "いけうち あきこ", status: "retired", retiredMonth: "2026-04" },
  { name: "天野美奈穂", store: "堀江院2nd", displayName: "Minaho", nickname: null, kana: "あまの みなほ", status: "active", retiredMonth: null },
  { name: "徳永 さゆり", store: "堀江院2nd", displayName: "Sayuri", nickname: null, kana: "とくなが さゆり", status: "active", retiredMonth: null },
  { name: "本吉真優", store: "堀江院2nd", displayName: "Mayu", nickname: null, kana: "もとよし まゆ", status: "active", retiredMonth: null },
  { name: "満川宏美", store: "堀江院2nd", displayName: "Hiromi", nickname: null, kana: "みつかわ ひろみ", status: "retired", retiredMonth: "2026-07" },
  { name: "金田あゆみ", store: "姪浜院", displayName: "金田 あゆみ", nickname: null, kana: "かねだ あゆみ", status: "active", retiredMonth: null },
  { name: "山口純奈", store: "姪浜院", displayName: "山口 純奈", nickname: null, kana: "やまぐち じゅんな", status: "active", retiredMonth: null },
  { name: "山田さやか", store: "姪浜院", displayName: "山田 沙也香", nickname: null, kana: "やまだ さやか", status: "active", retiredMonth: null },
  { name: "石橋茜", store: "姪浜院", displayName: "石橋 茜", nickname: null, kana: "いしばし あかね", status: "active", retiredMonth: null },
  { name: "尾上みゆき", store: "姪浜院", displayName: "尾上 みゆき", nickname: null, kana: "おがみ みゆき", status: "active", retiredMonth: null },
];

/** 退社者のみ（退社月が入っているもの） */
export const RETIRED_FROM_MASTER = STAFF_MASTER.filter(
  (s): s is StaffMasterEntry & { retiredMonth: string } =>
    s.status === "retired" && !!s.retiredMonth
);
