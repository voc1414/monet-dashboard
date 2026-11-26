#!/usr/bin/env node
/**
 * Notion「DB_monet GBP公開履歴」→ client/src/data/gbpHistory.ts を再生成する。
 *
 * 書き込み元は Cloud Run Job「monet-gbp」（~/projects/monet-gbp）。月・木 10:00 JST に
 * Googleマップへ最新情報・写真を公開し、公開／停止／エラーのたびに1行足す。
 * この写しは管理者向けビルドの「Googleマップ」タブだけが読む。
 *
 *   NOTION_TOKEN=ntn_xxx node scripts/sync-gbp-history.mjs   （npm run sync:gbp）
 *   前提: DB が hayashin-guard インテグレーションに接続済み（2026-11-26 接続）。
 *
 * このリポジトリは公開なので、Googleに公開済みの内容だけを写す。
 *   - 公開した行 … 本文・写真URL・Googleで見る を含める
 *   - 停止／エラー … 本文は写さない（Googleに出ていない文章のため）。理由は短く・アカウント番号は伏せる
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const DS = process.env.NOTION_GBP_HISTORY_DS || "424ab44d-3cb9-81af-aafe-000b3282c1f8";
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../client/src/data/gbpHistory.ts");
const token = process.env.NOTION_TOKEN;
if (!token) { console.error("NOTION_TOKEN がありません"); process.exit(1); }

const plain = (p) => {
  if (!p) return "";
  const v = p[p.type];
  if (p.type === "title" || p.type === "rich_text") return v.map((x) => x.plain_text).join("").trim();
  if (p.type === "select") return v?.name || "";
  if (p.type === "url") return v || "";
  if (p.type === "date") return v?.start || "";
  return "";
};

export function toEntry(page) {
  const p = page.properties;
  const result = plain(p["結果"]);
  const published = result === "公開";
  const reason = plain(p["理由"]).replace(/accounts\/\d+(\/locations\/\d+)?/g, "accounts/…").slice(0, 120);
  return {
    at: plain(p["日時"]),
    store: plain(p["院"]),
    kind: plain(p["種類"]),
    result,
    theme: plain(p["テーマ"]),
    text: published ? plain(p["本文"]) : "",
    photoUrl: published ? plain(p["写真URL"]) : "",
    link: published ? plain(p["Googleで見る"]) : "",
    reason: published ? "" : reason,
  };
}

async function main() {
  const rows = [];
  let cursor;
  do {
    const r = await fetch(`https://api.notion.com/v1/data_sources/${DS}/query`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "notion-version": "2025-09-03", "content-type": "application/json" },
      body: JSON.stringify({ sorts: [{ property: "日時", direction: "descending" }], page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    if (!r.ok) throw new Error(`notion ${r.status} ${await r.text()}`);
    const j = await r.json();
    rows.push(...j.results.map(toEntry));
    cursor = j.has_more && rows.length < 2000 ? j.next_cursor : undefined;
  } while (cursor);
  const entries = rows.filter((e) => e.at && e.store && e.kind && e.result);
  const src = `/* 自動生成: scripts/sync-gbp-history.mjs（Notion「DB_monet GBP公開履歴」の写し）。手で直さない */
import type { GbpEntry } from "@/lib/gbpSummary";

export const GBP_HISTORY: GbpEntry[] = ${JSON.stringify(entries, null, 2)};
`;
  writeFileSync(OUT, src);
  console.log(`GBP公開履歴: ${entries.length} 行`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
