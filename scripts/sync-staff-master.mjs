#!/usr/bin/env node
/**
 * Notion「全スタッフ一覧」DB → client/src/data/staffMaster.ts を再生成する。
 *
 * 入力経路は2つある。どちらでも同じ staffMaster.ts が出る。
 *
 * ①インテグレーション・トークン経路（自動・CIから回せる）
 *   NOTION_TOKEN=ntn_xxx node scripts/sync-staff-master.mjs
 *   前提: 対象DBがそのインテグレーションに接続されていること。未接続だと
 *   404「Make sure the relevant pages ... are shared」が返る。
 *   2026-08-30時点、手元の2トークン（hayashin-guard / gf-crm）はどちらも未接続で404。
 *   注意: Notion の「Claudeコネクタ」(OAuth) を接続してもこの経路は通らない。
 *   別物なので、コネクタ側で接続済みでも下の②を使う。
 *
 * ②スナップショット経路（Claudeコネクタ／MCPで読めている場合。トークン不要）
 *   node scripts/sync-staff-master.mjs --from-json <path.json>
 *   JSON は Notion の列名そのままの配列。取得日を添える（鮮度が分かるように）:
 *     { "取得日": "2026-08-30",
 *       "rows": [ { "名前": "坂手 芳", "店舗": "堀江院2nd",
 *                   "サロンボード表示名": "坂手", "ニックネーム": null,
 *                   "かな": "さかで かおる", "進捗": "入社済", "退職月": null } ] }
 *   「ダッシュボード対象」の絞り込みは読み出し側で済ませておく（rows は対象者のみ）。
 *
 * 取り込む列は7つだけ（名前・店舗・サロンボード表示名・ニックネーム・かな・退職月・進捗）。
 * 履歴書・労働契約書・雇用形態は人事の正本なので取得しない。
 *
 * 「ニックネーム」列が Notion 側に無い／空のあいだは null になり、画面は氏名表示に
 * フォールバックする（client/src/lib/staffDisplayName.ts）。同期は壊れない。
 *
 * 「かな」列（"せい めい" 形式）は表記ゆれ照合の材料。ここから カタカナ・ローマ字ゆれを
 * 機械生成するので、別名を手で並べる表はもう増やさない（client/src/lib/stylistAlias.ts）。
 * 空のままでもクラッシュはしないが、その人はローマ字・かな表記で当たらなくなる。
 */
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const DATABASE_ID = "2dfab44d3cb98031a890e8de4ed0d1ff";
const NOTION_VERSION = "2022-06-28";
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../client/src/data/staffMaster.ts");

const jsonArgIndex = process.argv.indexOf("--from-json");
const jsonPath = jsonArgIndex >= 0 ? process.argv[jsonArgIndex + 1] : null;
const token = process.env.NOTION_TOKEN;

if (jsonArgIndex >= 0 && !jsonPath) {
  console.error("--from-json の後にJSONのパスを渡してください。");
  process.exit(1);
}
if (!jsonPath && !token) {
  console.error("入力がありません。次のどちらかで実行してください:");
  console.error("  ① NOTION_TOKEN=... node scripts/sync-staff-master.mjs");
  console.error("  ② node scripts/sync-staff-master.mjs --from-json <path.json>");
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

/**
 * 入力を「Notionの列名そのままのオブジェクト」の配列に揃える。
 * ①API経路は properties を剥がし、②JSON経路はそのまま使う。
 */
async function readRows() {
  if (jsonPath) {
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));
    const rows = Array.isArray(raw) ? raw : raw.rows;
    if (!Array.isArray(rows)) {
      console.error(`${jsonPath} の形式が違います。配列か { "rows": [...] } を渡してください。`);
      process.exit(1);
    }
    const asOf = Array.isArray(raw) ? null : raw["取得日"];
    console.log(
      `入力: ${jsonPath}（${rows.length}行${asOf ? ` / 取得日 ${asOf}` : " / 取得日なし"}）`
    );
    if (!asOf) {
      console.warn('⚠ 「取得日」が無いスナップショットです。いつのNotionか分からないので添えてください。');
    }
    return rows;
  }
  return (await fetchAll()).map((p) => {
    const props = p.properties;
    return {
      名前: plain(props["名前"]),
      店舗: props["店舗"]?.select?.name ?? "",
      サロンボード表示名: plain(props["サロンボード表示名"]),
      ニックネーム: plain(props["ニックネーム"]) || null,
      かな: plain(props["かな"]),
      進捗: props["進捗"]?.select?.name ?? "",
      退職月: plain(props["退職月"]) || null,
    };
  });
}

const rows = await readRows();

const staff = rows
  .map((r) => {
    const name = (r["名前"] ?? "").trim();
    const store = (r["店舗"] ?? "").trim();
    const displayName = (r["サロンボード表示名"] ?? "").trim() || name;
    // 画面表示用。照合には使わない（照合キーは name / displayName のまま）
    const nickname = (r["ニックネーム"] ?? "").trim() || null;
    // 表記ゆれ照合の材料。"せい めい"（半角スペース区切り）。全角スペースも受ける
    const kana = (r["かな"] ?? "").replace(/[\s　]+/g, " ").trim();
    const retiredMonth = (r["退職月"] ?? "").trim() || null;
    const status = (r["進捗"] ?? "").trim() === "退職" ? "retired" : "active";
    return { name, store, displayName, nickname, kana, status, retiredMonth };
  })
  .filter((s) => s.name)
  .sort((a, b) => a.store.localeCompare(b.store, "ja") || a.name.localeCompare(b.name, "ja"));

// 取りこぼしの検知: 退社なのに退社月が空だと、その人は在籍扱いのまま出続ける
const missing = staff.filter((s) => s.status === "retired" && !s.retiredMonth);
if (missing.length) {
  console.warn(`⚠ 退社月が空の退職者 ${missing.length}名: ${missing.map((s) => s.name).join(", ")}`);
  console.warn("  → Notion で退職月(YYYY-MM)を入れてください。空のままだと在籍扱いで表示され続けます。");
}
// 取りこぼしの検知: かなが無い人は、ローマ字・かな表記の担当者名で当たらなくなる
const noKana = staff.filter((s) => !/^[ぁ-んー]+ [ぁ-んー]+$/.test(s.kana));
if (noKana.length) {
  console.warn(`⚠ かなが未入力／形式外 ${noKana.length}名: ${noKana.map((s) => `${s.name}(${s.kana || "空"})`).join(", ")}`);
  console.warn('  → Notion「かな」に ひらがなで "せい めい"（半角スペース区切り）を入れてください。');
  console.warn("    空のままだと、その人はローマ字・かな表記のアンケート回答に紐づきません。");
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
 *
 * kana（"せい めい"）は表記ゆれ照合の材料。カタカナ・ローマ字のゆれは lib/stylistAlias.ts が
 * ここから機械生成する。別名を手で並べた表は増やさない（読みを直すなら Notion の「かな」）。
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
  /**
   * 氏名の読み。"せい めい"（ひらがな・半角スペース区切り）。Notion「かな」列が正本。
   * 表記ゆれ照合の材料で、未入力なら空文字（照合はできるが かな・ローマ字では当たらない）
   */
  kana: string;
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
      )}, nickname: ${s.nickname ? j(s.nickname) : "null"}, kana: ${j(
        s.kana
      )}, status: ${j(s.status)}, retiredMonth: ${
        s.retiredMonth ? j(s.retiredMonth) : "null"
      } },`
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
