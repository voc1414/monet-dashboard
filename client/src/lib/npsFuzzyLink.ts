/**
 * NPSの担当者名が、月末報告書の本名にもニックネーム（列20）にもそのまま一致しないときの
 * 自動の名寄せ（2026-10-03 林さん指示「配属店舗・他スタッフとの比較・氏名/ニックネームから逆算で自動判定」）。
 *
 * 判定の物差しはファンくると同じ `matchesStylist`（姓だけ・名だけ・かな/カタカナ/ローマ字のゆれ。
 * 読みは Notion「かな」から機械生成。lib/stylistAlias.ts）。そのうえで次の3つを必ず守る:
 *   1. 同じ店舗の中だけで探す（表示名は店舗をまたいで別人が実在する）
 *   2. 候補は「その店舗で報告書を出したことのある人」＋「スタッフマスタのその店舗の人」の両方。
 *      報告書をまだ出していない人もマスタに居れば候補に数える（土橋院「まゆ」＝中島真優は
 *      未提出でも候補。だから「まゆこ」＝湯木麻由子 にはつながらない）
 *   3. 当てはまる人が**ちょうど1人で、その人が報告書の人**のときだけつなぐ。
 *      2人以上・0人・マスタだけの人なら、つながない（誤って別人の数字を付けるより未マッチを選ぶ）
 */
import { STAFF_MASTER } from "@/data/staffMaster";
import { matchesStylist } from "@/hooks/useFankuruData";
import { npsStaffKey } from "@/lib/npsStaffMatch";
import { resolveStaffDisplayName } from "@/lib/staffDisplayName";
import { normalizeStaffKey } from "@/lib/staffNameAlias";
import { normalizeStoreKey } from "@/lib/storeKey";

export interface NameInStore {
  name: string;
  store: string;
}

/** 担当者を選ばなかった回答（名寄せの対象外） */
const isNoStaff = (name: string) => !name.trim() || name.trim() === "選択しない";

/**
 * NPSの名前 → 報告書の人 の対応表を作る。
 * @param npsNames NPS回答の担当者名と店舗（重複してよい）
 * @param reportPeople 月末報告書に出てくる人（全期間。重複してよい）
 * @returns key = npsStaffKey(NPSの名前, 店舗) → value = npsStaffKey(報告書の本名, 店舗)
 */
export function buildNpsFuzzyLinks(npsNames: NameInStore[], reportPeople: NameInStore[]): Map<string, string> {
  const links = new Map<string, string>();

  // 店舗ごとの報告書の人（本名で重複を畳む）
  const peopleByStore = new Map<string, Map<string, NameInStore>>();
  for (const p of reportPeople) {
    if (!p.name?.trim()) continue;
    const store = normalizeStoreKey(p.store);
    const list = peopleByStore.get(store) ?? new Map<string, NameInStore>();
    list.set(normalizeStaffKey(p.name), p);
    peopleByStore.set(store, list);
  }

  // そのまま一致する名前（本名・ニックネーム）。ここに当たるNPS名は既存の照合でつながる
  const exactKeys = new Set<string>();
  for (const list of Array.from(peopleByStore.values())) {
    for (const p of Array.from(list.values())) {
      exactKeys.add(npsStaffKey(p.name, p.store));
      exactKeys.add(npsStaffKey(resolveStaffDisplayName(p.name, p.store), p.store));
    }
  }

  const seen = new Set<string>();
  for (const n of npsNames) {
    if (!n.name || isNoStaff(n.name)) continue;
    const npsKey = npsStaffKey(n.name, n.store);
    if (seen.has(npsKey)) continue;
    seen.add(npsKey);
    if (exactKeys.has(npsKey)) continue;

    const store = normalizeStoreKey(n.store);
    // 候補: 人の識別キー → 報告書の本名（マスタだけの人は null）
    const candidates = new Map<string, string | null>();
    for (const [id, { name: reportName }] of Array.from(peopleByStore.get(store) ?? new Map<string, NameInStore>())) {
      const nickname = resolveStaffDisplayName(reportName, n.store);
      if (matchesStylist(n.name, reportName, n.store) || (nickname !== reportName && matchesStylist(n.name, nickname, n.store))) {
        candidates.set(id, reportName);
      }
    }
    for (const m of STAFF_MASTER) {
      if (normalizeStoreKey(m.store) !== store) continue;
      if (!matchesStylist(n.name, m.name, n.store)) continue;
      const id = normalizeStaffKey(m.name);
      if (!candidates.has(id)) candidates.set(id, null);
    }

    if (candidates.size !== 1) continue;
    const [reportName] = Array.from(candidates.values());
    if (!reportName) continue;
    links.set(npsKey, npsStaffKey(reportName, n.store));
  }
  return links;
}

/** buildNpsFuzzyLinks の結果を「報告書の人 → その人につながるNPS名のキー一覧」に引き直す */
export function invertNpsFuzzyLinks(links: Map<string, string>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [npsKey, personKey] of Array.from(links.entries())) {
    const list = out.get(personKey) ?? [];
    list.push(npsKey);
    out.set(personKey, list);
  }
  return out;
}
