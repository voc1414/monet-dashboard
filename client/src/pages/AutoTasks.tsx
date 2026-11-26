/**
 * Page: monet 自動タスクの総合状況（管理者向けビルドだけ）
 * データソース：
 *   Notion「DB_monet 自動タスク実行記録」→ scripts/sync-task-log.mjs → data/taskLog.ts（毎日 8:30／21:30 取り込み）
 *   Notion「DB_monet GBP公開履歴」→ data/gbpHistory.ts（Googleマップタブと同じ写し）
 * 判定は写しを作った時刻（TASK_LOG_SYNCED_AT）を基準にする。理由は lib/taskSummary.ts の冒頭。
 */
import { useMemo } from "react";
import { Activity } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { GBP_HISTORY } from "@/data/gbpHistory";
import { TASK_LOG, TASK_LOG_SYNCED_AT } from "@/data/taskLog";
import {
  PAUSED_TASKS,
  SYNC_STALE_HOURS,
  formatJstShort,
  gbpRuns,
  summarizeTasks,
  syncIsStale,
  type Lamp,
} from "@/lib/taskSummary";

const LAMP: Record<Lamp, { dot: string; row: string; text: string }> = {
  green: { dot: "bg-emerald-500", row: "", text: "text-emerald-700" },
  yellow: { dot: "bg-amber-400", row: "bg-amber-50", text: "text-amber-800" },
  red: { dot: "bg-red-500", row: "bg-red-50", text: "text-red-700" },
  gray: { dot: "bg-slate-300", row: "", text: "text-muted-foreground" },
};

/** 理由文の「 — 」区切りを1区切り1行で出す（短い切れ端が1〜2文字で次の行に落ちないように） */
function Reason({ text }: { text: string }) {
  return (
    <>
      {text.split(" — ").map((t, i) => (
        <span key={i} className="block">
          {t}
        </span>
      ))}
    </>
  );
}

function Dot({ lamp }: { lamp: Lamp }) {
  return <span className={`inline-block h-2.5 w-2.5 flex-none rounded-full ${LAMP[lamp].dot}`} aria-hidden />;
}

export default function AutoTasks() {
  const syncedAt = useMemo(() => new Date(TASK_LOG_SYNCED_AT), []);
  const status = useMemo(() => summarizeTasks(TASK_LOG, GBP_HISTORY, syncedAt), [syncedAt]);
  const stale = syncIsStale(syncedAt, new Date());
  const red = status.filter((s) => s.lamp === "red").length;
  const yellow = status.filter((s) => s.lamp === "yellow").length;
  const recent = useMemo(
    () => [...TASK_LOG, ...gbpRuns(GBP_HISTORY)].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30),
    [],
  );

  const headline = stale
    ? { lamp: "red" as Lamp, text: "取り込みが止まっています", sub: `この画面は${SYNC_STALE_HOURS}時間以上更新されていません` }
    : red
      ? { lamp: "red" as Lamp, text: `直すこと ${red}本`, sub: "止まっている・失敗したタスクがあります" }
      : yellow
        ? { lamp: "yellow" as Lamp, text: `確認すること ${yellow}本`, sub: "動いたが、人が見る必要があります" }
        : { lamp: "green" as Lamp, text: "直すことはありません", sub: "すべて予定どおり動いています" };

  return (
    <DashboardLayout breadcrumbs={[{ label: "自動タスク" }]}>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Activity className="w-5 h-5 text-primary" />
            自動タスク
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {"monetの自動タスクが予定どおり動いたかの一覧です。毎日 8:30 と 21:30 に更新されます。予定の時刻を過ぎても記録が無いものは赤になります。"}
          </p>
        </div>

        <section
          className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border p-4 shadow-sm ${
            headline.lamp === "green" ? "border-emerald-200 bg-emerald-50" : headline.lamp === "yellow" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"
          }`}
          data-testid="tasks-headline"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Dot lamp={headline.lamp} />
            <span className={`text-lg font-bold whitespace-nowrap ${LAMP[headline.lamp].text}`}>{headline.text}</span>
          </div>
          <div className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">
            {headline.sub}・<span className="tabular-nums whitespace-nowrap">{formatJstShort(TASK_LOG_SYNCED_AT)} 時点</span>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-white/70 p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-foreground">動いている自動タスク</h2>
          <ul className="space-y-2 sm:hidden" data-testid="tasks-cards">
            {status.map((s) => (
              <li key={s.def.name} className={`rounded-xl border border-border/40 p-3 ${LAMP[s.lamp].row}`}>
                <div className="flex flex-wrap items-center gap-x-2">
                  <Dot lamp={s.lamp} />
                  <span className="font-bold whitespace-nowrap">{s.def.name}</span>
                  <span className={`ml-auto text-xs font-medium whitespace-nowrap ${LAMP[s.lamp].text}`}>
                    {s.label.length > 6 ? "" : s.label}
                    {s.latest?.count != null && s.label === s.latest.result && <span className="ml-1 font-normal tabular-nums">{s.latest.count}件</span>}
                  </span>
                </div>
                {s.label.length > 6 && <div className={`mt-1 pl-[18px] text-xs font-medium ${LAMP[s.lamp].text}`}>{s.label}</div>}
                {s.latest?.reason && s.lamp !== "green" && (
                  <div className={`mt-1 pl-[18px] text-xs break-words [word-break:auto-phrase] [text-wrap:pretty] ${LAMP[s.lamp].text} opacity-80`}><Reason text={s.latest.reason} /></div>
                )}
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 pl-[18px] text-xs">
                  <dt className="text-muted-foreground">予定</dt>
                  <dd>{s.def.scheduleLabel}（{s.def.where}）</dd>
                  <dt className="text-muted-foreground">最後に動いた</dt>
                  <dd className="tabular-nums">{formatJstShort(s.latest?.at)}</dd>
                  <dt className="text-muted-foreground">次の予定</dt>
                  <dd className="tabular-nums">{formatJstShort(s.next)}</dd>
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm" data-testid="tasks-status">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">タスク</th>
                  <th className="py-1.5 pr-3 font-medium">予定</th>
                  <th className="py-1.5 pr-3 font-medium">最後に動いた</th>
                  <th className="py-1.5 pr-3 font-medium">次の予定</th>
                  <th className="py-1.5 font-medium">状態</th>
                </tr>
              </thead>
              <tbody>
                {status.map((s) => (
                  <tr key={s.def.name} className={`border-t border-border/40 align-top ${LAMP[s.lamp].row}`}>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2 font-medium whitespace-nowrap">
                        <Dot lamp={s.lamp} />
                        {s.def.name}
                      </div>
                      <div className="pl-[18px] text-[11px] text-muted-foreground">{s.def.where}</div>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{s.def.scheduleLabel}</td>
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{formatJstShort(s.latest?.at)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{formatJstShort(s.next)}</td>
                    <td className={`py-2 text-xs ${LAMP[s.lamp].text}`}>
                      <div className="font-medium whitespace-nowrap">
                        {s.label}
                        {s.latest?.count != null && s.label === s.latest.result && (
                          <span className="ml-1 font-normal tabular-nums">{s.latest.count}件</span>
                        )}
                      </div>
                      {s.latest?.reason && s.lamp !== "green" && (
                        <div className="mt-0.5 min-w-[12rem] text-[11px] opacity-80 [word-break:auto-phrase] [text-wrap:pretty]"><Reason text={s.latest.reason} /></div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">最近の記録</h2>
          {recent.length === 0 && (
            <p className="text-sm text-muted-foreground">まだ記録がありません。各タスクが次に動いたときから並びます。</p>
          )}
          <ul className="divide-y divide-border/40 rounded-2xl border border-border/60 bg-white/70 shadow-sm">
            {recent.map((e, i) => {
              const lamp: Lamp = e.result === "成功" ? "green" : e.result === "要確認" ? "yellow" : e.result === "対象なし" ? "gray" : "red";
              return (
                <li key={`${e.at}-${e.task}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2 text-sm">
                  <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{formatJstShort(e.at)}</span>
                  <span className="font-medium whitespace-nowrap">{e.task}</span>
                  <span className={`inline-flex items-center gap-1.5 text-xs ${LAMP[lamp].text}`}>
                    <Dot lamp={lamp} />
                    {e.result}
                    {e.count != null && <span className="tabular-nums">{e.count}件</span>}
                  </span>
                  {e.reason && <span className="w-full text-[11px] text-muted-foreground break-words [word-break:auto-phrase] [text-wrap:pretty]"><Reason text={e.reason} /></span>}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-border/60 bg-white/70 p-4 shadow-sm">
          <h2 className="text-sm font-bold text-foreground">止まっている自動タスク（Cowork）</h2>
          <p className="mt-1 mb-3 text-xs text-muted-foreground">
            Coworkに登録されたまま、2026年10月28日以降すべてオフになっています。止めた理由の記録は見つかっていません。
          </p>
          <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2" data-testid="tasks-paused">
            {PAUSED_TASKS.map((t) => (
              <li key={t.name} className="flex items-baseline gap-2">
                <Dot lamp="gray" />
                <span className="min-w-0">
                  {t.name}
                  <span className="ml-1.5 text-xs text-muted-foreground whitespace-nowrap">
                    {t.scheduleLabel}・最後に動いた {t.lastRun ? t.lastRun.slice(5).replace("-", "/") : "記録なし"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </DashboardLayout>
  );
}
