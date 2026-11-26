#!/usr/bin/env node
/**
 * Notion「DB_monet 自動タスク実行記録」→ client/src/data/taskLog.ts を再生成する。
 *
 * 書き込み元は Mac mini の自動タスク（~/projects/monet-task-log/log.mjs を呼ぶ）：
 *   HPBブログ 原稿づくり 6:00／HPBブログ 予約登録 20:00／サロンボード取得 7:30
 * Googleマップ（GBP）は DB_monet GBP公開履歴（gbpHistory.ts）をそのまま使うので、ここでは読まない。
 * この写しは管理者向けビルドの「自動タスク」タブだけが読む。
 *
 *   NOTION_TOKEN=ntn_xxx node scripts/sync-task-log.mjs   （npm run sync:tasks）
 *
 * このリポジトリは公開なので、タスク名・時刻・結果・件数・短い理由だけを写す（番号・メールは伏せる）。
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const DS = process.env.NOTION_TASK_LOG_DS || "424ab44d-3cb9-8195-b5be-000b7cc75cb3";
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../client/src/data/taskLog.ts");

const plain = (p) => {
  if (!p) return "";
  const v = p[p.type];
  if (p.type === "title" || p.type === "rich_text") return v.map((x) => x.plain_text).join("").trim();
  if (p.type === "select") return v?.name || "";
  if (p.type === "date") return v?.start || "";
  if (p.type === "number") return v;
  return "";
};

export const scrub = (s = "") =>
  String(s)
    .replace(/accounts\/\d+(\/locations\/\d+)?/g, "accounts/…")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "（メール）")
    .replace(/\b\d{7,}\b/g, "…")
    .slice(0, 160);

export function toEntry(page) {
  const p = page.properties;
  const count = plain(p["件数"]);
  return {
    at: plain(p["日時"]),
    task: plain(p["タスク"]),
    result: plain(p["結果"]),
    count: typeof count === "number" ? count : null,
    reason: scrub(plain(p["理由"])),
  };
}

async function main() {
  const token = process.env.NOTION_TOKEN;
  if (!token) { console.error("NOTION_TOKEN がありません"); process.exit(1); }
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
    cursor = j.has_more && rows.length < 1000 ? j.next_cursor : undefined;
  } while (cursor);
  const entries = rows.filter((e) => e.at && e.task && e.result);
  const src = `/* 自動生成: scripts/sync-task-log.mjs（Notion「DB_monet 自動タスク実行記録」の写し）。手で直さない */
import type { TaskLogEntry } from "@/lib/taskSummary";

/** この写しを作った時刻。画面の判定はこの時刻を「いま」として行う */
export const TASK_LOG_SYNCED_AT = ${JSON.stringify(new Date().toISOString())};

export const TASK_LOG: TaskLogEntry[] = ${JSON.stringify(entries, null, 2)};
`;
  writeFileSync(OUT, src);
  console.log(`自動タスク実行記録: ${entries.length} 行`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
