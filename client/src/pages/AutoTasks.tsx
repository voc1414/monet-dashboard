/**
 * Page: monet 自動タスクの総合状況（管理者向けビルドだけ）
 * データソース：
 *   Notion「DB_monet 自動タスク実行記録」→ scripts/sync-task-log.mjs → data/taskLog.ts（毎日 8:30／21:30 取り込み）
 *   Notion「DB_monet GBP公開履歴」→ data/gbpHistory.ts（Googleマップタブと同じ写し）
 * 判定は写しを作った時刻（TASK_LOG_SYNCED_AT）を基準にする。理由は lib/taskSummary.ts の冒頭。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ChevronRight } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import GbpDetail from "@/components/GbpDetail";
import { Label } from "@/components/StatusLabel";
import { gbpTaskStatus, isBeforeAuto, summarize as summarizeStores } from "@/lib/gbpSummary";
import { GBP_HISTORY } from "@/data/gbpHistory";
import { TASK_LOG, TASK_LOG_SYNCED_AT } from "@/data/taskLog";
import {
  OTHER_STATE,
  OTHER_TASKS,
  OTHER_TASKS_CHECKED_ON,
  SYNC_STALE_HOURS,
  formatJstShort,
  gbpRuns,
  summarizeTasks,
  syncIsStale,
  type Lamp,
  type TaskStatus,
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
        <span key={i} className="block [overflow-wrap:anywhere]">
          {t}
        </span>
      ))}
    </>
  );
}

const RANK: Record<Lamp, number> = { gray: 0, green: 1, yellow: 2, red: 3 };

/** 文字の色：ランプは遅れの日数で決まる（2日で黄・3日で赤）。緑のままでも遅れ・失敗・要確認は文字で知らせる */
function tone(s: TaskStatus): string {
  if (s.lamp !== "green") return LAMP[s.lamp].text;
  const r = s.latest?.result;
  if (s.lateDays !== undefined) return /エラー|停止/.test(s.label) ? "text-red-700" : "text-amber-700";
  if (s.waiting) return "text-muted-foreground";
  if (r === "エラー" || r === "停止") return "text-red-700";
  if (r === "要確認") return "text-amber-700";
  return LAMP.green.text;
}

function Dot({ lamp }: { lamp: Lamp }) {
  return <span className={`inline-block h-2.5 w-2.5 flex-none rounded-full ${LAMP[lamp].dot}`} aria-hidden />;
}

export default function AutoTasks() {
  const syncedAt = useMemo(() => new Date(TASK_LOG_SYNCED_AT), []);
  const stores = useMemo(() => summarizeStores(GBP_HISTORY, syncedAt), [syncedAt]);
  const storeAlert = stores.some((x) => x.lamp === "yellow" || x.lamp === "red");
  const status = useMemo(
    () =>
      summarizeTasks(TASK_LOG, GBP_HISTORY, syncedAt).map((s) => (s.def.source === "gbp" ? gbpTaskStatus(s, stores, syncedAt) : s)),
    [syncedAt, stores],
  );
  const stale = syncIsStale(syncedAt, new Date());
  // Googleマップの院ごとの詳細（旧Gマップタブ）。/google-map から来たときは開いた状態で出す
  const [gbpOpen, setGbpOpen] = useState(
    () => storeAlert || (typeof window !== "undefined" && window.location.hash === "#gbp"),
  );
  const gbpRef = useRef<HTMLDetailsElement>(null);
  const openGbp = () => {
    setGbpOpen(true);
    // 開いた中身が描画されてから動かす（描画前だと位置がずれて動かないことがある）
    setTimeout(() => gbpRef.current?.scrollIntoView({ block: "start" }), 60);
  };
  useEffect(() => {
    // 院の遅れで開いた場合は動かさない（先に上の帯を見せる）。#gbp 付きで来たときだけ移動する
    if (typeof window !== "undefined" && window.location.hash === "#gbp") setTimeout(() => gbpRef.current?.scrollIntoView({ block: "start" }), 60);
    // 初回だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const red = status.filter((s) => s.lamp === "red").length;
  const yellow = status.filter((s) => s.lamp === "yellow").length;
  const FAIL = /エラー|停止/;
  // 失敗：色（遅れの日数）に関係なく、行の一言にエラー・停止と出ているもの。遅れの行と重なることもある
  const failed = status.filter((s) => FAIL.test(s.label) || (s.lateDays === undefined && !s.waiting && FAIL.test(s.latest?.result ?? ""))).length;
  // 1日以内の遅れ：緑のまま、行の一言に「遅れ」「未公開」と出ているもの（失敗と同じ行でも数える）
  const LATE = /遅れ|未公開/;
  const lateSoft = status.filter((s) => s.lamp === "green" && s.lateDays !== undefined && LATE.test(s.label)).length;
  // 要確認：行の文言に「要確認」と出ているもの（待ち表示でも「前回は要確認」と出ていれば数える）
  const check = status.filter((s) => s.lamp === "green" && s.lateDays === undefined && /要確認/.test(s.label)).length;
  // 帯には一番重いものだけでなく、ある問題を全部並べる
  const issues = [
    red && `3日以上の遅れ ${red}本`,
    yellow && `2日以上の遅れ ${yellow}本`,
    failed && `失敗あり ${failed}本`,
    lateSoft && `1日以内の遅れ ${lateSoft}本`,
    check && `要確認 ${check}本`,
  ].filter(Boolean) as string[];
  // 見出しの本数は、問題のあるタスクの数（同じ行を二重に数えない）
  const total = status.filter(
    (s) => s.lamp === "red" || s.lamp === "yellow" || s.lateDays !== undefined || FAIL.test(s.label) || /要確認/.test(s.label) || (!s.waiting && FAIL.test(s.latest?.result ?? "")),
  ).length;
  const recent = useMemo(
    // Googleマップの自動公開前の手動テストは「動いた記録」に並べない
    // 日時の書式が混ざる（GBPは +00:00、タスク記録は +09:00）ので、文字ではなく時刻で並べる
    () => [...TASK_LOG, ...gbpRuns(GBP_HISTORY.filter((e) => !isBeforeAuto(e)))].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 30),
    [],
  );

  const headline = stale
    ? { lamp: "red" as Lamp, text: "取り込みが止まっています", sub: [`この画面は${SYNC_STALE_HOURS}時間以上更新されていません`, ...issues] }
    : red
      ? { lamp: "red" as Lamp, text: `直すことがあります（${total}本）`, sub: issues }
      : yellow
        ? { lamp: "yellow" as Lamp, text: `確認することがあります（${total}本）`, sub: issues }
        : issues.length
          ? { lamp: "green" as Lamp, text: `気になることがあります（${total}本）`, sub: issues }
          : { lamp: "green" as Lamp, text: "直すことはありません", sub: ["遅れているタスクはありません"] };

  return (
    <DashboardLayout breadcrumbs={[{ label: "自動タスク" }]}>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Activity className="w-5 h-5 text-primary" />
            自動タスク
          </h1>
          <p className="mt-1 text-xs text-muted-foreground [word-break:auto-phrase] [text-wrap:pretty]">
            {"monetの自動タスクが予定どおり動いたかの一覧です。毎日 8:30 と 21:30 に更新されます。予定日より2日以上遅れると黄、3日以上遅れると赤になります。"}
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
            <span className={`text-lg font-bold [word-break:auto-phrase] ${LAMP[headline.lamp].text}`}><Label text={headline.text} /></span>
          </div>
          <div className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">
            {headline.sub.map((x) => (
              <span key={x}>
                <span className="whitespace-nowrap">{x} ／</span>{" "}
              </span>
            ))}
            <span className="tabular-nums whitespace-nowrap">{formatJstShort(TASK_LOG_SYNCED_AT)} 時点</span>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-white/70 p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-foreground">動いている自動タスク</h2>
          <ul className="space-y-2 lg:hidden" data-testid="tasks-cards">
            {status.map((s) => (
              <li key={s.def.name} className={`rounded-xl border border-border/40 p-3 ${LAMP[s.lamp].row}`}>
                <div className="flex flex-wrap items-center gap-x-2">
                  <Dot lamp={s.lamp} />
                  <span className="font-bold whitespace-nowrap">{s.def.name}</span>
                  <span className={`ml-auto text-xs font-medium whitespace-nowrap ${tone(s)}`}>
                    {s.label.length > 6 ? "" : s.label}
                    {s.latest?.count != null && s.label === s.latest.result && s.latest.result === "成功" && <span className="ml-1 font-normal tabular-nums">{s.latest.count}件</span>}
                  </span>
                </div>
                {s.label.length > 6 && <div className={`mt-1 pl-[18px] text-xs font-medium [word-break:auto-phrase] ${tone(s)}`}><Label text={s.label} /></div>}
                {s.latest?.reason && s.latest.result !== "成功" && (
                  <div className={`mt-1 pl-[18px] text-xs break-words [word-break:auto-phrase] [text-wrap:pretty] ${tone(s)} opacity-80`}><Reason text={s.latest.reason} /></div>
                )}
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 pl-[18px] text-xs">
                  <dt className="text-muted-foreground">予定</dt>
                  <dd>{s.def.scheduleLabel}<span className="whitespace-nowrap">（{s.def.where}）</span></dd>
                  <dt className="text-muted-foreground">最後の記録</dt>
                  <dd className="tabular-nums">{formatJstShort(s.latest?.at)}</dd>
                  <dt className="text-muted-foreground">次の予定</dt>
                  <dd className="tabular-nums">{formatJstShort(s.next)}</dd>
                </dl>
                {s.def.source === "gbp" && (
                  <button type="button" onClick={openGbp} className="mt-2 ml-[18px] inline-flex min-h-[44px] items-center text-xs font-medium text-primary">
                    院ごとの公開を見る
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm" data-testid="tasks-status">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">タスク</th>
                  <th className="py-1.5 pr-3 font-medium">予定</th>
                  <th className="py-1.5 pr-3 font-medium">最後の記録</th>
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
                      {s.def.source === "gbp" && (
                        <button type="button" onClick={openGbp} className="ml-[18px] inline-flex min-h-[44px] items-center text-xs font-medium text-primary hover:underline">
                          院ごとの公開を見る
                        </button>
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{s.def.scheduleLabel}</td>
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{formatJstShort(s.latest?.at)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{formatJstShort(s.next)}</td>
                    <td className={`py-2 text-xs ${tone(s)}`}>
                      <div className="font-medium whitespace-nowrap">
                        <Label text={s.label} />
                        {s.latest?.count != null && s.label === s.latest.result && s.latest.result === "成功" && (
                          <span className="ml-1 font-normal tabular-nums">{s.latest.count}件</span>
                        )}
                      </div>
                      {s.latest?.reason && s.latest.result !== "成功" && (
                        <div className="mt-0.5 min-w-[12rem] text-[11px] opacity-80 [word-break:auto-phrase] [text-wrap:pretty]"><Reason text={s.latest.reason} /></div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <details
          id="gbp"
          ref={gbpRef}
          open={gbpOpen}
          onToggle={(e) => setGbpOpen(e.currentTarget.open)}
          className="group scroll-mt-20 rounded-2xl border border-border/60 bg-white/70 px-4 shadow-sm"
          data-testid="gbp-detail"
        >
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-1.5 text-sm font-bold text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRight className="h-4 w-4 flex-none text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
            Googleマップ 院ごとの公開状況
          </summary>
          <div className="pb-4">{gbpOpen && <GbpDetail />}</div>
        </details>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">最近の記録</h2>
          {recent.length === 0 && (
            <p className="text-sm text-muted-foreground">まだ記録がありません。各タスクが次に動いたときから並びます。</p>
          )}
          <ul className="divide-y divide-border/40 rounded-2xl border border-border/60 bg-white/70 shadow-sm">
            {recent.map((e, i) => {
              const lamp: Lamp = e.result === "成功" || e.result === "公開" ? "green" : e.result === "一部公開" ? "yellow" : e.result === "要確認" ? "yellow" : e.result === "対象なし" ? "gray" : "red";
              return (
                <li key={`${e.at}-${e.task}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2 text-sm">
                  <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{formatJstShort(e.at)}</span>
                  <span className="font-medium whitespace-nowrap">{e.task}</span>
                  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs ${LAMP[lamp].text}`}>
                    <Dot lamp={lamp} />
                    {e.result}
                    {e.count != null && (e.result === "成功" || e.result === "公開") && <span className="tabular-nums">{e.count}件</span>}
                  </span>
                  {e.reason && <span className="w-full text-[11px] text-muted-foreground break-words [word-break:auto-phrase] [text-wrap:pretty]"><Reason text={e.reason} /></span>}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-border/60 bg-white/70 p-4 shadow-sm">
          <h2 className="text-sm font-bold text-foreground">記録をまだ書いていない自動タスク</h2>
          <p className="mt-1 mb-3 text-xs text-muted-foreground [word-break:auto-phrase] [text-wrap:pretty]">
            {`claude.aiのルーチンで動いているタスクです。${OTHER_TASKS_CHECKED_ON.slice(5).replace("-", "/")}に成果物を見て確かめた結果で、自動では変わりません。`}
          </p>
          <ul className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2" data-testid="tasks-other">
            {OTHER_TASKS.map((t) => {
              const st = OTHER_STATE[t.state];
              return (
                <li key={t.name} className="flex items-baseline gap-2">
                  <Dot lamp={st.lamp} />
                  <span className="min-w-0">
                    <span className="block">
                      {t.name.split(" ").map((w, i, all) => (
                        <span key={i}>
                          {i > 0 && " "}
                          <span className={all.length > 1 ? "whitespace-nowrap" : "[word-break:auto-phrase]"}>{w}</span>
                        </span>
                      ))}
                      <span className={`ml-1.5 text-xs font-medium whitespace-nowrap ${LAMP[st.lamp].text}`}>{st.label}</span>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      <span className="whitespace-nowrap">{t.scheduleLabel}</span>
                      {"・"}
                      <span className="whitespace-nowrap">{t.evidence}</span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </DashboardLayout>
  );
}
