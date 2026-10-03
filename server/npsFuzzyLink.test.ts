import { describe, it, expect } from "vitest";
import { buildNpsFuzzyLinks, invertNpsFuzzyLinks } from "../client/src/lib/npsFuzzyLink";
import { npsStaffKey } from "../client/src/lib/npsStaffMatch";

// NPSの名前が報告書の本名・ニックネームにそのまま一致しないときの自動名寄せ（2026-10-03 林さん指示）。
// 店舗・人は実在のスタッフマスタ（Notion「全スタッフ一覧」の写し）を使う。
const nps = (name: string, store: string) => ({ name, store });
const rep = (name: string, store: string) => ({ name, store });

describe("buildNpsFuzzyLinks", () => {
  it("名だけのNPS名（えりこ）は、同じ店舗の報告書の人（田中江梨子）にちょうど1人ならつながる", () => {
    const links = buildNpsFuzzyLinks([nps("えりこ", "楽々園院")], [rep("田中江梨子", "楽々園院")]);
    expect(links.get(npsStaffKey("えりこ", "楽々園院"))).toBe(npsStaffKey("田中江梨子", "楽々園院"));
  });

  it("土橋院「まゆ」は、報告書が湯木麻由子（まゆこ）だけでも つながない（マスタの中島真優が候補に居る）", () => {
    const links = buildNpsFuzzyLinks([nps("まゆ", "土橋院")], [rep("湯木麻由子", "土橋院")]);
    expect(links.size).toBe(0);
  });

  it("土橋院「まゆ」は、中島真優が報告書を出していれば中島真優につながる（湯木麻由子にはつながない）", () => {
    const links = buildNpsFuzzyLinks(
      [nps("まゆ", "土橋院")],
      [rep("湯木麻由子", "土橋院"), rep("中島真優", "土橋院")]
    );
    expect(links.get(npsStaffKey("まゆ", "土橋院"))).toBe(npsStaffKey("中島真優", "土橋院"));
  });

  it("同じ店舗で2人に当てはまる名前（楽々園院「けいこ」＝井上恵子・前田慶子）は つながない", () => {
    const links = buildNpsFuzzyLinks(
      [nps("けいこ", "楽々園院")],
      [rep("井上恵子", "楽々園院"), rep("前田慶子", "楽々園院")]
    );
    expect(links.size).toBe(0);
  });

  it("別の店舗の人には つながない", () => {
    const links = buildNpsFuzzyLinks([nps("えりこ", "土橋院")], [rep("田中江梨子", "楽々園院")]);
    expect(links.size).toBe(0);
  });

  it("マスタに居ない店舗でも、姓だけのNPS名が報告書の1人に当てはまればつながり、2人ならつながない", () => {
    const one = buildNpsFuzzyLinks([nps("中村", "テスト院")], [rep("中村夏菜子", "テスト院")]);
    expect(one.get(npsStaffKey("中村", "テスト院"))).toBe(npsStaffKey("中村夏菜子", "テスト院"));
    const two = buildNpsFuzzyLinks(
      [nps("中村", "テスト院")],
      [rep("中村夏菜子", "テスト院"), rep("中村さき", "テスト院")]
    );
    expect(two.size).toBe(0);
  });

  it("本名そのままのNPS名・「選択しない」は対象外（既存の照合でつながる／つながない）", () => {
    const links = buildNpsFuzzyLinks(
      [nps("田中 江梨子", "楽々園院"), nps("選択しない", "楽々園院"), nps("", "楽々園院")],
      [rep("田中江梨子", "楽々園院")]
    );
    expect(links.size).toBe(0);
  });

  it("invertNpsFuzzyLinks は報告書の人ごとにNPS名のキーを集める", () => {
    const links = buildNpsFuzzyLinks(
      [nps("えりこ", "楽々園院"), nps("エリコ", "楽々園院")],
      [rep("田中江梨子", "楽々園院")]
    );
    const inv = invertNpsFuzzyLinks(links);
    expect(inv.get(npsStaffKey("田中江梨子", "楽々園院"))?.sort()).toEqual(
      [npsStaffKey("えりこ", "楽々園院"), npsStaffKey("エリコ", "楽々園院")].sort()
    );
  });
});
