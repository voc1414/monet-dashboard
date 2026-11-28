/**
 * 2026-11-27 に取った Meta 広告セットの消化額（集客・求人）。
 * 診断の全店広告費 ¥587,529 は、このうち名前に「集客」がある行の合計。
 * 求人は入れない。集客の行はすべて11院のどれかに入る（未配賦は 0）。
 * 個人の情報は無い。元の広告アカウントは書き換えていない。
 */
export interface MetaAdsetSpend {
  name: string;
  results: number;
  spendYen: number;
}

export const META_ADSET_SPEND_20261127: MetaAdsetSpend[] = [
  { name: "モネ/大阪エリア/福島院/集客/直営", results: 284, spendYen: 90206 },
  { name: "モネ/大阪エリア/高槻院/集客/直営", results: 234, spendYen: 45086 },
  { name: "モネ/大阪エリア/堀江院2nd/集客/直営", results: 73, spendYen: 30016 },
  { name: "モネ/大阪エリア/堀江院/集客/直営", results: 141, spendYen: 45101 },
  { name: "モネ/大阪エリア/福島院/求人/直営", results: 16, spendYen: 30305 },
  { name: "モネ/大阪エリア/高槻院/求人/直営", results: 0, spendYen: 5978 },
  { name: "モネ/大阪エリア/堀江院/求人/直営", results: 36, spendYen: 87395 },
  { name: "モネ/福岡エリア/春日院/集客/FC/林プレゼント", results: 404, spendYen: 49781 },
  { name: "モネ/福岡エリア/春日院/集客/FC", results: 244, spendYen: 30094 },
  { name: "モネ/福岡エリア/姪浜院/集客/FC", results: 246, spendYen: 51427 },
  { name: "モネ/福岡エリア/求人/FC", results: 14, spendYen: 5985 },
  { name: "モネ/兵庫エリア/芦屋院/求人/FC", results: 10, spendYen: 7257 },
  { name: "モネ/兵庫エリア/岡本院/集客/FC", results: 336, spendYen: 60224 },
  { name: "モネ/兵庫エリア/求人/FC", results: 12, spendYen: 16323 },
  { name: "モネ/広島エリア/土橋院/集客/リード/FC", results: 172, spendYen: 44785 },
  { name: "モネ/広島エリア/楽々園院/集客/FC", results: 173, spendYen: 45079 },
  { name: "モネ/広島エリア/本通院/集客/FC", results: 283, spendYen: 29067 },
  { name: "モネ/広島エリア/本通院/集客/FC/林プレゼント", results: 143, spendYen: 25309 },
  { name: "モネ/広島エリア/楽々園院/求人/FC", results: 20, spendYen: 30042 },
  { name: "モネ/広島エリア/本通院/求人/FC", results: 38, spendYen: 54310 },
  { name: "テスト ― モネ/広島エリア/土橋院/集客/リード/FC", results: 3, spendYen: 276 },
  { name: "モネ/岡山エリア/下伊福院/集客/FC/眠れる美容室", results: 58, spendYen: 9838 },
  { name: "モネ/岡山エリア/下伊福院/集客/FC", results: 188, spendYen: 31240 },
  { name: "モネ/岡山エリア/求人/FC/A有力", results: 22, spendYen: 42620 },
];

/** 長い店名を先に見る（「堀江院2nd」を「堀江院」に吸わせない）。 */
const STORE_IN_ADSET: { needle: string; short: string }[] = [
  { needle: "堀江院2nd", short: "堀江2nd" },
  { needle: "福島院", short: "福島" },
  { needle: "高槻院", short: "高槻" },
  { needle: "堀江院", short: "堀江" },
  { needle: "春日院", short: "春日" },
  { needle: "姪浜院", short: "姪浜" },
  { needle: "岡本院", short: "岡本" },
  { needle: "土橋院", short: "土橋" },
  { needle: "楽々園院", short: "楽々園" },
  { needle: "本通院", short: "本通" },
  { needle: "下伊福院", short: "下伊福" },
  { needle: "芦屋院", short: "芦屋" },
  { needle: "高崎院", short: "高崎" },
];

export function isShukyakuAdset(name: string): boolean {
  return name.includes("集客");
}

export function storeOfAdset(name: string): string | null {
  const hit = STORE_IN_ADSET.find((store) => name.includes(store.needle));
  return hit ? hit.short : null;
}

/** 集客だけを院別に足す。求人は含めない。どの院にも入らない集客は unassigned。 */
export function shukyakuSpendByStore(rows: MetaAdsetSpend[] = META_ADSET_SPEND_20261127): {
  byStore: Record<string, number>;
  total: number;
  unassigned: number;
} {
  const byStore: Record<string, number> = {};
  let total = 0;
  let unassigned = 0;
  for (const row of rows) {
    if (!isShukyakuAdset(row.name) || !Number.isFinite(row.spendYen)) continue;
    total += row.spendYen;
    const store = storeOfAdset(row.name);
    if (!store) {
      unassigned += row.spendYen;
      continue;
    }
    byStore[store] = (byStore[store] ?? 0) + row.spendYen;
  }
  return { byStore, total, unassigned };
}
