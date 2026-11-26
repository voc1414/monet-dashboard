/**
 * Googleマップ（GBP）自動更新の院ごとの詳細。自動タスクタブの「Googleマップ（GBP）」から開く。
 * 2026-11-26 林さん：Gマップタブは分けず自動タスクタブにまとめる。
 * データソース: Notion「DB_monet GBP公開履歴」→ scripts/sync-gbp-history.mjs → data/gbpHistory.ts
 */
import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { GBP_HISTORY } from "@/data/gbpHistory";
import { formatJst, summarize } from "@/lib/gbpSummary";
import { TASK_LOG_SYNCED_AT } from "@/data/taskLog";
import type { Lamp } from "@/lib/taskSummary";

const ROW: Record<Lamp, string> = { green: "", gray: "", yellow: "bg-amber-50 text-amber-800", red: "bg-red-50 text-red-700" };
const TEXT: Record<Lamp, string> = { green: "text-emerald-600", gray: "text-muted-foreground", yellow: "text-amber-800", red: "text-red-700" };

export default function GbpDetail() {
  // 自動タスクと同じ時点（取り込んだ時刻）で判定する
  const status = useMemo(() => summarize(GBP_HISTORY, new Date(TASK_LOG_SYNCED_AT)), []);
  const recent = useMemo(
    () => [...GBP_HISTORY].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40),
    [],
  );
  const red = status.filter((s) => s.lamp === "red").length;
  const yellow = status.filter((s) => s.lamp === "yellow").length;

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground [text-wrap:pretty]">
        {"月・木 10:00 に最新情報と写真を自動公開。予定日より2日以上公開が無いと黄、3日以上で赤になります。"}
      </p>
    <section className="rounded-2xl border border-border/60 bg-white/70 p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-foreground">
        院ごとの状況
        <span className={`ml-2 inline-block whitespace-nowrap text-xs ${red ? "text-red-600" : yellow ? "text-amber-700" : "text-emerald-600"}`}>
          {red ? `直すこと ${red}院` : yellow ? `確認すること ${yellow}院` : "遅れている院はありません"}
        </span>
      </h3>
      <ul className="space-y-2 md:hidden" data-testid="gbp-status-cards">
        {status.map((s) => (
          <li key={s.store} className={`rounded-xl border border-border/40 p-3 text-xs ${ROW[s.lamp]}`}>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-bold whitespace-nowrap">{s.store}</span>
              <span className={`ml-auto font-medium [word-break:auto-phrase] ${TEXT[s.lamp]}`}>{s.label}</span>
            </div>
            {s.problem?.reason && <div className="mt-1 opacity-80 [word-break:auto-phrase] [text-wrap:pretty]">{s.problem.reason}</div>}
            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <dt className="text-muted-foreground">最後の投稿</dt>
              <dd className="tabular-nums">{formatJst(s.lastPost)}（{s.posts}件）</dd>
              <dt className="text-muted-foreground">最後の写真</dt>
              <dd className="tabular-nums">{formatJst(s.lastPhoto)}（{s.photos}件）</dd>
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm" data-testid="gbp-status">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1.5 pr-3 font-medium">院</th>
              <th className="py-1.5 pr-3 font-medium">最後の投稿</th>
              <th className="py-1.5 pr-3 font-medium">最後の写真</th>
              <th className="py-1.5 pr-3 font-medium text-right">投稿数</th>
              <th className="py-1.5 pr-3 font-medium text-right">写真数</th>
              <th className="py-1.5 font-medium">状態</th>
            </tr>
          </thead>
          <tbody>
            {status.map((s) => (
              <tr key={s.store} className={`border-t border-border/40 ${ROW[s.lamp]}`}>
                <td className="py-1.5 pr-3 font-medium whitespace-nowrap">{s.store}</td>
                <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">{formatJst(s.lastPost)}</td>
                <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">{formatJst(s.lastPhoto)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{s.posts}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{s.photos}</td>
                <td className="py-1.5 text-xs">
                  <span className={TEXT[s.lamp]}>{s.label}</span>
                  {s.problem?.reason && <div className="text-[11px] opacity-80">{s.problem.reason}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    <section className="space-y-3">
      <h3 className="text-sm font-bold text-foreground">最近の公開・停止</h3>
      {recent.length === 0 && <p className="text-sm text-muted-foreground">まだ記録がありません。</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {recent.map((e, i) => (
          <article
            key={`${e.at}-${e.store}-${e.kind}-${i}`}
            className={`rounded-2xl border p-4 shadow-sm ${e.result === "公開" ? "border-border/60 bg-white/70" : "border-red-200 bg-red-50"}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-foreground">{e.store}</span>
              <span className="rounded bg-muted px-1.5 py-0.5">{e.kind}</span>
              <span className={e.result === "公開" ? "text-emerald-600" : "text-red-600"}>{e.result}</span>
              <span className="text-muted-foreground tabular-nums">{formatJst(e.at)}</span>
              {e.link && (
                <a href={e.link} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-primary">
                  Googleで見る <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="flex gap-3">
              {e.photoUrl && (
                <img src={e.photoUrl} alt="" loading="lazy" className="h-24 w-24 flex-none rounded-lg object-cover" />
              )}
              <div className="min-w-0 text-sm">
                {e.theme && <div className="mb-1 text-xs text-muted-foreground">{e.theme}</div>}
                {e.text && <p className="whitespace-pre-wrap break-words line-clamp-6">{e.text}</p>}
                {e.reason && <p className="text-xs text-red-700">{e.reason}</p>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
    </div>
  );
}
