#!/usr/bin/env node
/**
 * Notion「DB_monet店舗一覧」→ client/src/data/storeMaster.ts を再生成する。
 *
 *   NOTION_TOKEN=ntn_xxx node scripts/sync-store-master.mjs
 *   （npm run sync:stores）
 *
 * 前提: 対象DBが Notion 側でインテグレーションに接続されていること。
 *       未接続だと 404「Make sure the relevant pages ... are shared」が返る。
 *
 * 取り込むのは 名前・エリア・開店日 の3つだけ。住所・電話・LP URL などは
 * ダッシュボードで使っていないので取得しない。
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const DATABASE_ID = "354ab44d3cb98068ad2ac3a3aa2e2af2";
const NOTION_VERSION = "2022-06-28";
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../client/src/data/storeMaster.ts");

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error("NOTION_TOKEN が未設定です。NOTION_TOKEN=... node scripts/sync-store-master.mjs");
  process.exit(1);
}

const plain = (p) => (p?.rich_text ?? p?.title ?? []).map((t) => t.plain_text).join("").trim();

async function fetchAll() {
  const out = [];
  let cursor;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });
    if (!res.ok) throw new Error(`Notion API ${res.status}: ${(await res.json()).message ?? ""}`);
    const json = await res.json();
    out.push(...json.results);
    cursor = json.has_more ? json.next_cursor : undefined;
  } while (cursor);
  return out;
}

const stores = (await fetchAll())
  .map((p) => {
    const props = p.properties;
    const area = props["エリア"]?.select?.name ?? "";
    return {
      name: plain(props["名前"]),
      area: area ? `${area}エリア` : "",
      openedOn: props["開店日"]?.date?.start ?? null,
    };
  })
  .filter((s) => s.name && s.area)
  .sort((a, b) => (a.openedOn || "9999").localeCompare(b.openedOn || "9999") || a.name.localeCompare(b.name, "ja"));

if (!stores.length) {
  console.error("0件でした。書き出しを中止します（誤って全店を消さないため）。");
  process.exit(1);
}
const noArea = stores.filter((s) => !s.area);
if (noArea.length) console.warn(`⚠ エリア未設定: ${noArea.map((s) => s.name).join(", ")}`);
const upcoming = stores.filter((s) => !s.openedOn);
if (upcoming.length) {
  console.warn(`ℹ 開店日が未定（＝営業中の一覧には出しません）: ${upcoming.map((s) => s.name).join(", ")}`);
}

const j = (v) => JSON.stringify(v, null, 0);
const body = `/**
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
${stores.map((s) => `  { name: ${j(s.name)}, area: ${j(s.area)}, openedOn: ${s.openedOn ? j(s.openedOn) : "null"} },`).join("\n")}
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
`;
writeFileSync(OUT, body, "utf-8");
console.log(`storeMaster.ts を更新: ${stores.length}店（開店済み ${stores.length - upcoming.length} / 未開店 ${upcoming.length}）`);
