/*
 * Googleマップ（GBP）自動更新の院ごとの状況（2026-11-26 林さん「その形で作って」）。
 * 元データは Notion「DB_monet GBP公開履歴」の写し（client/src/data/gbpHistory.ts）。
 */
export interface GbpEntry {
  /** ISO 日時 */
  at: string;
  store: string;
  kind: "投稿" | "写真" | string;
  result: "公開" | "停止" | "エラー" | string;
  theme: string;
  text: string;
  photoUrl: string;
  link: string;
  reason: string;
}

/** GBPを自動更新している院（monet-gbp の locations.json と同じ並び） */
export const GBP_STORES = [
  "春日院", "本通院", "岡本院", "下伊福院", "姪浜院", "土橋院",
  "楽々園院", "福島院", "高槻院", "堀江院2nd", "堀江院",
];

/** 月・木の週2回なので、公開が8日以上空いたら止まっていると見なす */
export const STALE_DAYS = 8;

export interface StoreStatus {
  store: string;
  lastPost?: string;
  lastPhoto?: string;
  posts: number;
  photos: number;
  /** 直近の記録が停止・エラーならその行 */
  problem?: GbpEntry;
  stale: boolean;
  /** 赤で出す理由（空なら正常） */
  alert: string;
}

const DAY = 86_400_000;

export function summarize(entries: GbpEntry[], now: Date, stores = GBP_STORES): StoreStatus[] {
  return stores.map((store) => {
    const mine = entries.filter((e) => e.store === store).sort((a, b) => b.at.localeCompare(a.at));
    const ok = mine.filter((e) => e.result === "公開");
    const lastPost = ok.find((e) => e.kind === "投稿")?.at;
    const lastPhoto = ok.find((e) => e.kind === "写真")?.at;
    const last = ok[0]?.at;
    const latest = mine[0];
    const problem = latest && latest.result !== "公開" ? latest : undefined;
    const stale = !last || now.getTime() - new Date(last).getTime() >= STALE_DAYS * DAY;
    const alert = problem
      ? `直近が${problem.result}（${problem.kind}）`
      : !last
        ? "公開の記録なし"
        : stale
          ? `${STALE_DAYS}日以上公開なし`
          : "";
    return {
      store,
      lastPost,
      lastPhoto,
      posts: ok.filter((e) => e.kind === "投稿").length,
      photos: ok.filter((e) => e.kind === "写真").length,
      problem,
      stale,
      alert,
    };
  });
}

/** 「11/26(木) 09:28」形式（日本時間） */
export function formatJst(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  const w = "日月火水木金土"[d.getUTCDay()];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${w}) ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
