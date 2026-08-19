/**
 * 店舗マスタ — Notion「DB_monet店舗一覧」の写し（自動生成ファイル・手で編集しない）
 *
 * 正本: https://app.notion.com/p/354ab44d3cb98068ad2ac3a3aa2e2af2
 *       （data source: collection://354ab44d-3cb9-8076-b720-000bcf5ae4ef）
 * 生成: npm run sync:stores  （scripts/sync-store-master.mjs）
 *
 * 店舗を増やす・エリアを変えるときは **Notion を編集** してから再生成する。
 * ここを手で書き換えても次の同期で上書きされる。
 *
 * openedOn が null = 開店日が未定＝まだ開店していない。
 * 店舗一覧などの「営業中の店」には出さないが、広告のように開店前から
 * 数字が出るものには使う。開店日が決まったら Notion に入れること。
 */

export type StoreMasterEntry = {
  /** 店舗名（Notionの表記に合わせる。例: 下伊福院・岡本院） */
  name: string;
  /** 「大阪エリア」のようにエリア接尾辞つき */
  area: string;
  /** "YYYY-MM-DD"。未定なら null */
  openedOn: string | null;
};

export const STORE_MASTER: StoreMasterEntry[] = [
  { name: "堀江院", area: "大阪エリア", openedOn: "2023-05-17" },
  { name: "楽々園院", area: "広島エリア", openedOn: "2024-12-06" },
  { name: "姪浜院", area: "福岡エリア", openedOn: "2025-06-30" },
  { name: "堀江院2nd", area: "大阪エリア", openedOn: "2025-10-28" },
  { name: "福島院", area: "大阪エリア", openedOn: "2026-02-18" },
  { name: "高槻院", area: "大阪エリア", openedOn: "2026-02-18" },
  { name: "土橋院", area: "広島エリア", openedOn: "2026-04-25" },
  { name: "下伊福院", area: "岡山エリア", openedOn: null },
  { name: "岡本院", area: "兵庫エリア", openedOn: null },
];

/** 指定日（既定=今日）までに開店している店だけを、エリアごとにまとめる */
export function openedAreaStores(today?: string): { area: string; stores: string[] }[] {
  const d = today || new Date().toISOString().slice(0, 10);
  const opened = STORE_MASTER.filter((s) => !!s.openedOn && s.openedOn <= d);
  // エリアの並びは「そのエリアで最初に開店した日」順。店舗の並びも開店日順。
  const byArea = new Map<string, StoreMasterEntry[]>();
  for (const s of [...opened].sort((a, b) => (a.openedOn || "").localeCompare(b.openedOn || ""))) {
    const list = byArea.get(s.area) || [];
    list.push(s);
    byArea.set(s.area, list);
  }
  return Array.from(byArea.entries()).map(([area, stores]) => ({
    area,
    stores: stores.map((s) => s.name),
  }));
}
