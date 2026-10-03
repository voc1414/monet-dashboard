/**
 * Page: 次回予約強化 — 個人ページ（管理者専用・2026-10-03）
 *
 * /next-reservation/:store/:name … 対象者一覧の名前から開く。
 * 1. 月ごとの推移 … 次回予約率・連続月数・強化シートの提出状況（全期間。測定開始前の月は「測定前」）
 * 2. 自己評価 17問 … 提出した全回の点数を横に並べる（2以下は赤字）
 * 3. 課題点・翌月のアクション … 提出した全回
 *
 * 個人の記述は管理者ビルドだけで出す（2026-10-03 林さん決定 A）。
 * 組み立ては lib/nextReservationBoost.ts の buildPersonBoostView。
 */
import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { AlertTriangle, ChevronLeft, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { useNextReservationBoostSheet } from "@/hooks/useNextReservationBoostSheet";
import { BOOST_THRESHOLD, INTERVIEW_STREAK, QUESTION_COUNT, buildPersonBoostView } from "@/lib/nextReservationBoost";
import { normalizeStaffKey } from "@/lib/staffNameAlias";
import { resolveStaffDisplayName } from "@/lib/staffDisplayName";
import { ScoreCell, StreakBadge, formatMonth, useBoostReports } from "./NextReservationBoost";

export default function NextReservationBoostPerson() {
  const params = useParams<{ store: string; name: string }>();
  const store = decodeURIComponent(params.store || "");
  const name = decodeURIComponent(params.name || "");

  const report = useMonthlyReport();
  const sheet = useNextReservationBoostSheet();
  const reports = useBoostReports(report.rawData);

  const view = useMemo(
    () => buildPersonBoostView({ reports, answers: sheet.answers, store, name, staffKey: normalizeStaffKey }),
    [reports, sheet.answers, store, name],
  );

  const busy = report.loading || sheet.loading;
  const errors = [report.error, sheet.error && `強化シート: ${sheet.error}`].filter(Boolean) as string[];
  const displayName = resolveStaffDisplayName(name, store);
  const labels = sheet.columns?.questionLabels ?? [];
  const latest = view.months.find((m) => m.reported);

  return (
    <DashboardLayout
      breadcrumbs={[{ label: "次回予約強化", href: "/next-reservation" }, { label: displayName }]}
    >
      <div className="space-y-6">
        <div>
          <Link
            href="/next-reservation"
            className="mb-2 inline-flex items-center text-xs text-muted-foreground hover:text-primary"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            対象者一覧へ戻る
          </Link>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
            <span className="text-sm text-muted-foreground">{store}</span>
            {latest && latest.isTarget && latest.streak >= INTERVIEW_STREAK && (
              <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">面談対象</span>
            )}
          </div>
          {latest && (
            <p className="mt-1 text-xs text-muted-foreground">
              最新 {formatMonth(latest.month)}：次回予約率{" "}
              <span className="font-mono-data font-bold text-foreground">
                {latest.rate === null ? "—" : `${latest.rate.toFixed(1)}%`}
              </span>
              {latest.isTarget && <> ／ {BOOST_THRESHOLD}%以下 </>}
            </p>
          )}
        </div>

        {errors.map((e) => (
          <Card key={e} className="border-destructive/40">
            <CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {e}
            </CardContent>
          </Card>
        ))}

        {busy && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            読み込み中…
          </div>
        )}

        {!busy && view.months.length === 0 && (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              この店舗・名前の月末報告書も強化シートも見つかりません。
            </CardContent>
          </Card>
        )}

        {!busy && view.months.length > 0 && (
          <>
            <Card>
              <CardContent className="py-4">
                <h2 className="mb-3 text-base font-bold text-foreground">月ごとの推移</h2>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-[11px] text-muted-foreground">
                        <th className="py-1.5 pr-2 text-left font-medium">月</th>
                        <th className="py-1.5 pr-2 text-right font-medium">次回予約率</th>
                        <th className="py-1.5 pr-2 text-right font-medium">連続月数</th>
                        <th className="py-1.5 text-left font-medium">強化シート</th>
                      </tr>
                    </thead>
                    <tbody>
                      {view.months.map((m) => (
                        <tr
                          key={m.month}
                          className={`border-b border-border/30 last:border-0 ${
                            m.isTarget && m.streak >= INTERVIEW_STREAK
                              ? "bg-red-50"
                              : m.isTarget && m.streak === 2
                                ? "bg-amber-50"
                                : ""
                          }`}
                        >
                          <td className="py-2 pr-2 text-xs">{formatMonth(m.month)}</td>
                          <td
                            className={`py-2 pr-2 text-right font-mono-data ${m.isTarget ? "font-bold text-red-600" : ""}`}
                          >
                            {!m.reported ? (
                              <span className="text-xs font-normal text-muted-foreground">報告書なし</span>
                            ) : m.rate === null ? (
                              "—"
                            ) : (
                              `${m.rate.toFixed(1)}%`
                            )}
                          </td>
                          <td className="py-2 pr-2 text-right">
                            {!m.measured ? (
                              <span className="text-xs text-muted-foreground">測定前</span>
                            ) : m.isTarget ? (
                              <StreakBadge streak={m.streak} />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2 text-xs">
                            {m.answer ? (
                              <span className="text-emerald-700">提出済み</span>
                            ) : !m.measured ? (
                              <span className="text-muted-foreground">測定前</span>
                            ) : m.isTarget ? (
                              <span className="font-medium text-amber-700">未提出</span>
                            ) : (
                              <span className="text-muted-foreground">対象外</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-4">
                <h2 className="mb-3 text-base font-bold text-foreground">自己評価（{QUESTION_COUNT}問）</h2>
                {view.answers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">強化シートの回答はまだありません。</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead>
                        <tr className="border-b border-border/60 text-[11px] text-muted-foreground">
                          <th className="py-1.5 pr-2 text-left font-medium">項目</th>
                          {view.answers.map((a) => (
                            <th key={a.targetMonth + a.answerDate} className="whitespace-nowrap py-1.5 px-2 text-center font-medium">
                              {formatMonth(a.targetMonth)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: QUESTION_COUNT }, (_, i) => (
                          <tr key={i} className="border-b border-border/30 last:border-0">
                            <td className="py-1.5 pr-2 text-xs text-foreground">{labels[i] || `Q${i + 1}`}</td>
                            {view.answers.map((a) => (
                              <td key={a.targetMonth + a.answerDate} className="py-1.5 px-2 text-center font-mono-data">
                                <ScoreCell v={a.scores[i]} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {view.answers.length > 0 && (
              <Card>
                <CardContent className="py-4">
                  <h2 className="mb-3 text-base font-bold text-foreground">課題点・翌月のアクション</h2>
                  <div className="space-y-3">
                    {view.answers.map((a) => (
                      <div key={a.targetMonth + a.answerDate} className="rounded-md bg-muted/40 p-3 text-xs">
                        <p className="mb-1 font-bold text-foreground">{formatMonth(a.targetMonth)}</p>
                        <p className="text-muted-foreground">課題点</p>
                        <p className="mb-2 whitespace-pre-wrap text-foreground">{a.issue || "（未記入）"}</p>
                        <p className="text-muted-foreground">翌月のアクション</p>
                        <p className="whitespace-pre-wrap text-foreground">{a.action || "（未記入）"}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
