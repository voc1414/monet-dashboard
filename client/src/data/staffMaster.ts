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
 */

export type StaffMasterEntry = {
  /** Notion の氏名（人事上の正式名） */
  name: string;
  /** 所属店舗（正規化後の呼称。例: 堀江院2nd） */
  store: string;
  /** サロンボード・月末報告書に出る表示名 */
  displayName: string;
  status: "active" | "retired";
  /** "YYYY-MM"。この月以降のデータを除外する。在籍者は null */
  retiredMonth: string | null;
};

export const STAFF_MASTER: StaffMasterEntry[] = [
  { name: "中島真優", store: "土橋院", displayName: "中島 真優", status: "active", retiredMonth: null },
  { name: "小田りえ", store: "土橋院", displayName: "小田 利恵", status: "active", retiredMonth: null },
  { name: "湯木麻由子", store: "土橋院", displayName: "湯木 麻由子", status: "active", retiredMonth: null },
  { name: "藤原牧子", store: "土橋院", displayName: "藤原 牧子", status: "active", retiredMonth: null },
  { name: "小池明子", store: "堀江院", displayName: "Akiko", status: "active", retiredMonth: null },
  { name: "西本 美華", store: "堀江院", displayName: "Mika", status: "active", retiredMonth: null },
  { name: "谷口 楓", store: "堀江院", displayName: "Kaede", status: "active", retiredMonth: null },
  { name: "三宅 和美", store: "堀江院2nd", displayName: "Kazumi", status: "retired", retiredMonth: "2026-03" },
  { name: "坂手 芳", store: "堀江院2nd", displayName: "坂手", status: "active", retiredMonth: null },
  { name: "天野美奈穂", store: "堀江院2nd", displayName: "Minaho", status: "active", retiredMonth: null },
  { name: "安達 まり", store: "堀江院2nd", displayName: "Mimi", status: "active", retiredMonth: null },
  { name: "徳永 さゆり", store: "堀江院2nd", displayName: "Sayuri", status: "active", retiredMonth: null },
  { name: "本吉真優", store: "堀江院2nd", displayName: "Mayu", status: "active", retiredMonth: null },
  { name: "池内 亜希子", store: "堀江院2nd", displayName: "Aki", status: "retired", retiredMonth: "2026-04" },
  { name: "満川宏美", store: "堀江院2nd", displayName: "Hiromi", status: "retired", retiredMonth: "2026-07" },
  { name: "尾上みゆき", store: "姪浜院", displayName: "尾上 みゆき", status: "active", retiredMonth: null },
  { name: "山口純奈", store: "姪浜院", displayName: "山口 純奈", status: "active", retiredMonth: null },
  { name: "山田さやか", store: "姪浜院", displayName: "山田 沙也香", status: "active", retiredMonth: null },
  { name: "石橋茜", store: "姪浜院", displayName: "石橋 茜", status: "active", retiredMonth: null },
  { name: "金田あゆみ", store: "姪浜院", displayName: "金田 あゆみ", status: "active", retiredMonth: null },
  { name: "井上恵子", store: "楽々園院", displayName: "井上 恵子", status: "active", retiredMonth: null },
  { name: "前田慶子", store: "楽々園院", displayName: "前田 慶子", status: "active", retiredMonth: null },
  { name: "千葉祐子", store: "楽々園院", displayName: "千葉 祐子", status: "active", retiredMonth: null },
  { name: "田中江梨子", store: "楽々園院", displayName: "田中 江梨子", status: "active", retiredMonth: null },
  { name: "石原ようこ", store: "楽々園院", displayName: "石原 ようこ", status: "active", retiredMonth: null },
  { name: "尾﨑仁美", store: "福島院", displayName: "Hitomi", status: "retired", retiredMonth: "2026-04" },
  { name: "木下夕季子", store: "福島院", displayName: "Yukiko", status: "active", retiredMonth: null },
  { name: "末次 優香", store: "福島院", displayName: "Yu", status: "active", retiredMonth: null },
  { name: "杉本寛子", store: "福島院", displayName: "Hiroko", status: "active", retiredMonth: null },
  { name: "松野 美香", store: "福島院", displayName: "Mika", status: "active", retiredMonth: null },
  { name: "渡利 由恵", store: "福島院", displayName: "Yoshie", status: "active", retiredMonth: null },
  { name: "齊藤 佳代", store: "福島院", displayName: "Kayo", status: "active", retiredMonth: null },
  { name: "原田 明日香", store: "高槻院", displayName: "Asuka", status: "active", retiredMonth: null },
  { name: "橋本 尚江", store: "高槻院", displayName: "Nao", status: "active", retiredMonth: null },
  { name: "田中 莉子", store: "高槻院", displayName: "Mariko", status: "active", retiredMonth: null },
  { name: "藤谷 裕子", store: "高槻院", displayName: "Yuko", status: "active", retiredMonth: null },
];

/** 退社者のみ（退社月が入っているもの） */
export const RETIRED_FROM_MASTER = STAFF_MASTER.filter(
  (s): s is StaffMasterEntry & { retiredMonth: string } =>
    s.status === "retired" && !!s.retiredMonth
);
