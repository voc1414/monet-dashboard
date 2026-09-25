/**
 * 店舗マスタ（Notion「DB_monet店舗一覧」の写し）から、生の店舗名を短縮名に畳む。
 *
 * 各データ源は店舗名を好き勝手な表記で送ってくる（例:
 *   サロンボード「モネ-monet- 白髪染めと髪質改善のサロン　岡山下伊福院」
 *   NPS「monet 岡本」／月末報告書「岡山下伊福院」）。
 * 以前は新店のたびに各フックの対応表へ手で書き足していたが、書き漏れると
 * その源のデータだけ店舗に紐づかず「¥0」「0件」に見える（見た目で気づけない）。
 * Notion に店舗を登録すれば、ここで自動的に拾えるようにする。
 *
 * 既存の対応表は残し、それで決まらなかったときの受け皿として使う。
 */
import { STORE_MASTER } from "@/data/storeMaster";

const compact = (s: string) => (s || "").replace(/[\s　]/g, "");

// 長い名前から照合する（「堀江院2nd」を「堀江院」に先取りさせない）。
const FULL = STORE_MASTER.map((s) => ({ key: compact(s.name), name: s.name })).sort(
  (a, b) => b.key.length - a.key.length
);
// 「院」を外した地名だけでも照合する（NPS は「monet 岡本」のように院が付かない）。
// 2文字未満の地名は誤爆しやすいので使わない。
const STEM = STORE_MASTER.map((s) => ({ key: compact(s.name).replace(/院/, ""), name: s.name }))
  .filter((s) => s.key.length >= 2)
  .sort((a, b) => b.key.length - a.key.length);

/** 店舗マスタのどれかに当たれば短縮名を、当たらなければ null を返す */
export function storeNameFromMaster(raw: string): string | null {
  const c = compact(raw);
  if (!c) return null;
  for (const s of FULL) if (c.includes(s.key)) return s.name;
  for (const s of STEM) if (c.includes(s.key)) return s.name;
  return null;
}

/**
 * 店舗が1つしかないエリア → その店舗名。
 * 広告の店舗欄が空で届いたとき、エリアから店舗を特定するのに使う。
 * 開店前の店も数える（開店予定の店があるエリアは、もう1店舗と決め打ちできない）。
 */
export function singleStoreAreas(): Record<string, string> {
  const byArea = new Map<string, string[]>();
  for (const s of STORE_MASTER) byArea.set(s.area, [...(byArea.get(s.area) || []), s.name]);
  const out: Record<string, string> = {};
  byArea.forEach((names, area) => {
    if (names.length === 1) out[area] = names[0];
  });
  return out;
}

/** 店舗マスタにあるエリア名（接尾辞なし。例: 「岡山」） */
export function masterRegionBases(): string[] {
  return Array.from(new Set(STORE_MASTER.map((s) => s.area.replace(/エリア$/, ""))));
}
