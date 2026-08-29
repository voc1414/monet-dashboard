#!/usr/bin/env node
/**
 * Notion「全スタッフ一覧」DB → client/src/data/staffMaster.ts を再生成する。
 *
 *   NOTION_TOKEN=ntn_xxx node scripts/sync-staff-master.mjs
 *   （npm run sync:staff）
 *
 * 前提: 対象DBが Notion 側でインテグレーションに接続されていること。
 *       接続していないと 404「Make sure the relevant pages ... are shared」が返る。
 *       接続手順 = Notion で「スタッフ管理」ページ → 右上「…」→ 接続 → 対象の
 *       インテグレーションを選ぶ（1回だけ・30秒）。
 *
 * 取り込む列は6つだけ（名前・店舗・サロンボード表示名・ニックネーム・退職月・進捗）。
 * 履歴書・労働契約書・雇用形態は人事の正本なので取得しない。
 *
 * 「ニックネーム」列が Notion 側に無い／空のあいだは null になり、画面は氏名表示に
 * フォールバックする（client/src/lib/staffDisplayName.ts）。同期は壊れない。
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const DATABASE_ID = "2dfab44d3cb98031a890e8de4ed0d1ff";
const NOTION_VERSION = "2022-06-28";
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../client/src/data/staffMaster.ts");

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error("NOTION_TOKEN が未設定です。NOTION_TOKEN=... node scripts/sync-staff-master.mjs");
  process.exit(1);
}

const plain = (prop) =>
  (prop?.rich_text ?? prop?.title ?? []).map((t) => t.plain_text).join("").trim();

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
      body: JSON.stringify({
        page_size: 100,
        start_cursor: cursor,
        filter: { property: "ダッシュボード対象", checkbox: { equals: true } },
      }),
    });
    if (!res.ok) {
      throw new Error(`Notion API ${res.status}: ${(await res.json()).message ?? ""}`);
    }
    const json = await res.json();
    out.push(...json.results);
    cursor = json.has_more ? json.next_cursor : undefined;
  } while (cursor);
  return out;
}

const pages = await fetchAll();

const staff = pages
  .map((p) => {
    const props = p.properties;
    const name = plain(props["名前"]);
    const store = props["店舗"]?.select?.name ?? "";
    const displayName = plain(props["サロンボード表示名"]) || name;
    // 画面表示用。照合には使わない（照合キーは name / displayName のまま）
    const nickname = plain(props["ニックネーム"]) || null;
    const retiredMonth = plain(props["退職月"]) || null;
    const status = props["進捗"]?.select?.name === "退職" ? "retired" : "active";
    return { name, store, displayName, nickname, status, retiredMonth };
  })
  .filter((s) => s.name)
  .sort((a, b) => a.store.localeCompare(b.store, "ja") || a.name.localeCompare(b.name, "ja"));

// 取りこぼしの検知: 退社なのに退社月が空だと、その人は在籍扱いのまま出続ける
const missing = staff.filter((s) => s.status === "retired" && !s.retiredMonth);
if (missing.length) {
  console.warn(`⚠ 退社月が空の退職者 ${missing.length}名: ${missing.map((s) => s.name).join(", ")}`);
  console.warn("  → Notion で退職月(YYYY-MM)を入れてください。空のままだと在籍扱いで表示され続けます。");
}
if (!staff.length) {
  console.error("0件でした。書き出しを中止します（誤って全員を消さないため）。");
  process.exit(1);
}

const j = (v) => JSON.stringify(v);
const body = `/**
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
  status: "active" | "retired";
  /** "YYYY-MM"。この月以降のデータを除外する。在籍者は null */
  retiredMonth: string | null;
};

export const STAFF_MASTER: StaffMasterEntry[] = [
${staff
  .map(
    (s) =>
      `  { name: ${j(s.name)}, store: ${j(s.store)}, displayName: ${j(
        s.displayName
      )}, nickname: ${s.nickname ? j(s.nickname) : "null"}, status: ${j(
        s.status
      )}, retiredMonth: ${s.retiredMonth ? j(s.retiredMonth) : "null"} },`
  )
  .join("\n")}
];

/** 退社者のみ（退社月が入っているもの） */
export const RETIRED_FROM_MASTER = STAFF_MASTER.filter(
  (s): s is StaffMasterEntry & { retiredMonth: string } =>
    s.status === "retired" && !!s.retiredMonth
);
`;

writeFileSync(OUT, body, "utf-8");
console.log(
  `staffMaster.ts を更新: ${staff.length}名（在籍 ${
    staff.filter((s) => s.status === "active").length
  } / 退社 ${staff.filter((s) => s.status === "retired").length}）`
);
