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

import { RED_DAYS, TASKS, YELLOW_DAYS, scheduledTimes, type Lamp } from "./taskSummary";

/**
 * 院ごとの色も自動タスクと同じ決まり（2026-11-26 林さん「揃えて」）：
 * 最後に公開した後の、公開できていない最初の予定（月・木 10:00＋猶予）からの日数で
 * 🟢2日未満／🟡2日以上／🔴3日以上。予定が始まる前（記録を取り始める前）は灰。
 */
const GBP_DEF = TASKS.find((t) => t.source === "gbp")!;

export interface StoreStatus {
  store: string;
  lastPost?: string;
  lastPhoto?: string;
  posts: number;
  photos: number;
  /** 直近の記録が停止・エラーならその行 */
  problem?: GbpEntry;
  lamp: Lamp;
  /** 状態の一言 */
  label: string;
  /** こなせていない公開予定からの日数（遅れていなければ undefined） */
  lateDays?: number;
}

const DAY = 86_400_000;
const MIN = 60_000;

/** 自動公開が始まる前の記録（手動テスト）か */
export function isBeforeAuto(e: GbpEntry, def = GBP_DEF): boolean {
  return new Date(e.at).getTime() < new Date(def.since).getTime() - 5 * MIN;
}

export function summarize(entries: GbpEntry[], now: Date, stores = GBP_STORES, def = GBP_DEF): StoreStatus[] {
  const times = scheduledTimes(def, now, 40, 0);
  const since = new Date(def.since).getTime();
  const t = now.getTime();
  return stores.map((store) => {
    const mine = entries.filter((e) => e.store === store).sort((a, b) => b.at.localeCompare(a.at));
    const ok = mine.filter((e) => e.result === "公開");
    const lastPost = ok.find((e) => e.kind === "投稿")?.at;
    const lastPhoto = ok.find((e) => e.kind === "写真")?.at;
    const auto = mine.filter((e) => !isBeforeAuto(e, def));
    const autoOk = auto.filter((e) => e.result === "公開");
    const latest = auto[0];
    const problem = latest && latest.result !== "公開" ? latest : undefined;
    const doneAt = autoOk[0] ? new Date(autoOk[0].at).getTime() : -Infinity;
    const missed = times.find((x) => x >= since && x + def.graceMin * MIN <= t && x > doneAt + 5 * MIN);
    const base = {
      store,
      lastPost,
      lastPhoto,
      posts: ok.filter((e) => e.kind === "投稿").length,
      photos: ok.filter((e) => e.kind === "写真").length,
      problem,
    };
    const tests = mine.length - auto.length;
    if (missed === undefined) {
      if (!autoOk.length) {
        const note = tests ? `（開始前のテスト ${tests}件）` : "";
        return { ...base, lamp: "gray" as Lamp, label: `自動公開は ${formatJst(def.since)} から${note}` };
      }
      return { ...base, lamp: "green" as Lamp, label: problem ? `直近が${problem.result}（${problem.kind}）` : "予定どおり" };
    }
    const lateDays = Math.floor((t - missed) / DAY);
    const lamp: Lamp = lateDays >= RED_DAYS ? "red" : lateDays >= YELLOW_DAYS ? "yellow" : "green";
    const label = lateDays >= 1 ? `${lateDays}日遅れ（${formatJst(new Date(missed).toISOString())} から公開なし）` : `遅れ：${formatJst(new Date(missed).toISOString())} の公開なし`;
    return { ...base, lamp, label, lateDays };
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
