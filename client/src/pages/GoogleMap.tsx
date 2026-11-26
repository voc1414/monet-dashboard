/**
 * Page: Googleマップ（GBP）自動更新の状況（管理者向けビルドだけ）
 * データソース: Notion「DB_monet GBP公開履歴」→ scripts/sync-gbp-history.mjs → data/gbpHistory.ts
 *   月・木 10:30（日本時間）に GitHub Actions が取り込む。公開は 10:00 の Cloud Run Job「monet-gbp」。
 */
import { useMemo } from "react";
import { MapPin, ExternalLink } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { GBP_HISTORY } from "@/data/gbpHistory";
import { STALE_DAYS, formatJst, summarize } from "@/lib/gbpSummary";

export default function GoogleMap() {
  const status = useMemo(() => summarize(GBP_HISTORY, new Date()), []);
  const recent = useMemo(
    () => [...GBP_HISTORY].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40),
    [],
  );
  const alerts = status.filter((s) => s.alert).length;

  return (
    <DashboardLayout breadcrumbs={[{ label: "Googleマップ" }]}>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <MapPin className="w-5 h-5 text-primary" />
            Googleマップ 自動更新
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            月・木 10:00 に最新情報と写真を自動公開。この画面は 10:30 に更新されます。
            赤は「直近が停止・エラー」か「{STALE_DAYS}日以上公開なし」の院です。
          </p>
        </div>

        <section className="rounded-2xl border border-border/60 bg-white/70 p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-foreground">
            院ごとの状況
            <span className={`ml-2 text-xs ${alerts ? "text-red-600" : "text-emerald-600"}`}>
              {alerts ? `要確認 ${alerts}院` : "全院正常"}
            </span>
          </h2>
          <div className="overflow-x-auto">
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
                  <tr key={s.store} className={`border-t border-border/40 ${s.alert ? "bg-red-50 text-red-700" : ""}`}>
                    <td className="py-1.5 pr-3 font-medium whitespace-nowrap">{s.store}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">{formatJst(s.lastPost)}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">{formatJst(s.lastPhoto)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{s.posts}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{s.photos}</td>
                    <td className="py-1.5 text-xs">
                      {s.alert || <span className="text-emerald-600">正常</span>}
                      {s.problem?.reason && <div className="text-[11px] opacity-80">{s.problem.reason}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-foreground">最近の公開・停止</h2>
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
    </DashboardLayout>
  );
}
