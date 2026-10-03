/**
 * Page: 次回予約強化（管理者専用・2026-10-03）
 *
 * 1. 対象者一覧 … 選んだ月に次回予約率70%以下だったスタッフ。連続月数・強化シートの提出状況つき
 * 2. 項目ごとの集計 … 強化シート Q1〜Q17 の自己評価の平均と「2・1」の人数（低い項目が上）
 * 3. 個人ごとの回答 … 17問の自己評価・課題点・翌月のアクション（直近3回を並べる）
 * 名前を押すと個人ページ（NextReservationBoostPerson.tsx）へ。全期間の推移と全回答を見られる。
 *
 * 次回予約率と連続月数は月末報告書（useMonthlyReport）から計算する。L Message の友だち情報
 * 「次回予約70%以下連続月数」はダッシュボードから読めないので使わない。
 * 個人の記述（課題点・アクション）は管理者ビルドだけで出す（2026-10-03 林さん決定 A）。
 * 集計ロジックは lib/nextReservationBoost.ts（純関数・server/nextReservationBoost.test.ts で検証）。
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, CalendarCheck, ChevronRight, Info, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { useNextReservationBoostSheet } from "@/hooks/useNextReservationBoostSheet";
import {
  BOOST_START_MONTH,
  isMeasuredMonth,
  BOOST_THRESHOLD,
  INTERVIEW_STREAK,
  LOW_SCORE_MAX,
  buildBoostView,
  type BoostAnswer,
  type PersonHistory,
  type QuestionStat,
  type ReportRow,
} from "@/lib/nextReservationBoost";
import { isRetiredStaff } from "@/lib/newBadge";
import { normalizeStaffKey } from "@/lib/staffNameAlias";
import { resolveStaffDisplayName } from "@/lib/staffDisplayName";

export const formatMonth = (ym: string) => {
  if (!ym) return "対象月不明";
  const [y, m] = ym.split("-");
  return `${y}年${parseInt(m)}月`;
};

/** 月末報告書を強化ロジックの入力形に変える（一覧・個人ページ共通） */
export function useBoostReports(rawData: ReturnType<typeof useMonthlyReport>["rawData"]): ReportRow[] {
  return useMemo(
    () =>
      rawData.map((r) => ({
        store: r.storeNormalized,
        name: r.name,
        systemName: r.systemName,
        reportMonth: r.reportMonth,
        newCustomers: r.newCustomers,
        returnCustomers: r.returnCustomers,
        nextReservation: r.nextReservation,
      })),
    [rawData],
  );
}

/** 個人ページへのリンク先 */
export const boostPersonHref = (store: string, name: string) =>
  `/next-reservation/${encodeURIComponent(store)}/${encodeURIComponent(name)}`;

export default function NextReservationBoost() {
  const report = useMonthlyReport();
  const sheet = useNextReservationBoostSheet();
  const [month, setMonth] = useState("");
  const reports = useBoostReports(report.rawData);
  // 測定は BOOST_START_MONTH（2026年10月分）から。それより前の月は選ばせない
  const months = useMemo(() => report.availableMonths.filter((m) => isMeasuredMonth(m)), [report.availableMonths]);

  // 既定は測定対象の月のうち一番新しい月
  useEffect(() => {
    if (!month && months.length > 0) setMonth(months[0]);
  }, [month, months]);

  const view = useMemo(() => {
    if (!month) return null;
    return buildBoostView({
      reports,
      answers: sheet.answers,
      questionLabels: sheet.columns?.questionLabels ?? [],
      month,
      staffKey: normalizeStaffKey,
      isRetired: (name, store, m) => isRetiredStaff(name, store, m),
    });
  }, [reports, sheet.answers, sheet.columns, month]);

  const busy = report.loading || sheet.loading;
  const errors = [report.error, sheet.error && `強化シート: ${sheet.error}`].filter(Boolean) as string[];

  return (
    <DashboardLayout breadcrumbs={[{ label: "次回予約強化" }]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
              <CalendarCheck className="w-5 h-5 text-primary" />
              次回予約強化
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              次回予約率 ＝ 次回予約取得数 ÷（新規客数＋再来顧客数）。{BOOST_THRESHOLD}%以下＝強化対象
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            対象月
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              data-testid="select-boost-month"
            >
              {months.length === 0 && <option value="">—</option>}
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {errors.map((e) => (
          <Card key={e} className="border-destructive/40">
            <CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {e}
            </CardContent>
          </Card>
        ))}

        {sheet.columns && sheet.columns.issues.length > 0 && (
          <Card className="border-amber-400/50 bg-amber-50/50">
            <CardContent className="space-y-1 py-3 text-xs text-amber-800">
              {sheet.columns.issues.map((i) => (
                <p key={i} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 w-3.5 h-3.5 shrink-0" />
                  {i}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

        {busy && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            読み込み中…
          </div>
        )}

        {!busy && months.length === 0 && (
          <Card>
            <CardContent className="flex items-start gap-2 py-6 text-sm text-muted-foreground">
              <Info className="mt-0.5 w-4 h-4 shrink-0" />
              <span>
                測定は{formatMonth(BOOST_START_MONTH)}分の成果から始めます。{formatMonth(BOOST_START_MONTH)}
                分の月末報告書（11月初めに提出）が入ると、ここに対象者一覧が出ます。
              </span>
            </CardContent>
          </Card>
        )}

        {!busy && view && (
          <>
            <TargetList view={view} month={month} />
            <QuestionStats stats={view.questionStats} answerCount={view.answerCount} />
            <People people={view.people} labels={sheet.columns?.questionLabels ?? []} />
            {view.unmatched.length > 0 && <Unmatched items={view.unmatched} />}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function TargetList({ view, month }: { view: NonNullable<ReturnType<typeof buildBoostView>>; month: string }) {
  const submitted = view.targets.filter((t) => t.submitted).length;
  const interview = view.targets.filter((t) => t.needsInterview).length;
  const twice = view.targets.filter((t) => t.streak === 2).length;
  const single = view.targets.length - interview - twice;
  return (
    <Card>
      <CardContent className="py-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-base font-bold text-foreground">対象者一覧（{formatMonth(month)}）</h2>
          <span className="text-[11px] text-muted-foreground">
            {view.targets.length}人（単月 {single}人・2ヶ月連続 {twice}人・{INTERVIEW_STREAK}ヶ月以上 {interview}人）
            ／ 強化シート提出 {submitted}人・未提出 {view.targets.length - submitted}人
          </span>
        </div>
        {view.targets.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            この月に次回予約率{BOOST_THRESHOLD}%以下のスタッフはいません。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-[11px] text-muted-foreground">
                  <th className="py-1.5 pr-2 text-left font-medium">店舗</th>
                  <th className="py-1.5 pr-2 text-left font-medium">名前</th>
                  <th className="py-1.5 pr-2 text-right font-medium">次回予約率</th>
                  <th className="py-1.5 pr-2 text-right font-medium">連続月数</th>
                  <th className="py-1.5 text-left font-medium">強化シート</th>
                </tr>
              </thead>
              <tbody>
                {view.targets.map((t) => (
                  <tr
                    key={`${t.store}__${t.name}`}
                    className={`border-b border-border/30 last:border-0 ${
                      t.needsInterview ? "bg-red-50" : t.streak === 2 ? "bg-amber-50" : ""
                    }`}
                  >
                    <td className="py-2 pr-2 text-xs text-muted-foreground">{t.store}</td>
                    <td className="py-2 pr-2 font-medium text-foreground">
                      <Link
                        href={boostPersonHref(t.store, t.name)}
                        className="underline decoration-border underline-offset-4 hover:text-primary hover:decoration-primary"
                      >
                        {resolveStaffDisplayName(t.name, t.store)}
                      </Link>
                      {t.needsInterview && (
                        <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          面談対象
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono-data">{t.rate.toFixed(1)}%</td>
                    <td className="py-2 pr-2 text-right">
                      <StreakBadge streak={t.streak} />
                    </td>
                    <td className="py-2 text-xs">
                      {t.submitted ? (
                        <span className="text-emerald-700">提出済み</span>
                      ) : (
                        <span className="font-medium text-amber-700">未提出</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 w-3 h-3 shrink-0" />
          連続月数：{BOOST_THRESHOLD}%以下の月は+1、超えた月は0に戻します。月末報告書を出していない月は数字を変えません。
          2ヶ月連続は黄色、{INTERVIEW_STREAK}ヶ月以上は赤のアラートで、面談対象です。
        </p>
      </CardContent>
    </Card>
  );
}

/** 連続月数の表示。単月は数字だけ、2ヶ月連続は黄色、面談対象（3ヶ月以上）は赤のアラートアイコン付き。 */
export function StreakBadge({ streak }: { streak: number }) {
  if (streak >= INTERVIEW_STREAK) {
    return (
      <span className="inline-flex items-center gap-1 font-mono-data font-bold text-red-600">
        <AlertTriangle className="w-3.5 h-3.5" aria-label={`${streak}ヶ月連続`} />
        {streak}ヶ月連続
      </span>
    );
  }
  if (streak === 2) {
    return (
      <span className="inline-flex items-center gap-1 font-mono-data font-bold text-amber-600">
        <AlertTriangle className="w-3.5 h-3.5" aria-label="2ヶ月連続" />
        2ヶ月連続
      </span>
    );
  }
  return <span className="font-mono-data text-muted-foreground">単月</span>;
}

function QuestionStats({ stats, answerCount }: { stats: QuestionStat[]; answerCount: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-base font-bold text-foreground">項目ごとの集計</h2>
          <span className="text-[11px] text-muted-foreground">回答 {answerCount}件 ／ 平均が低い順</span>
        </div>
        {answerCount === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">この月の強化シートの回答はまだありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-[11px] text-muted-foreground">
                  <th className="py-1.5 pr-2 text-left font-medium">項目</th>
                  <th className="py-1.5 pr-2 text-right font-medium">平均</th>
                  <th className="py-1.5 text-right font-medium">「2・1」の人数</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((q) => (
                  <tr key={q.index} className="border-b border-border/30 last:border-0">
                    <td className="py-2 pr-2 text-foreground">{q.label}</td>
                    <td className="py-2 pr-2 text-right font-mono-data">
                      {q.average === null ? "—" : q.average.toFixed(2)}
                    </td>
                    <td className={`py-2 text-right font-mono-data ${q.lowCount > 0 ? "font-bold text-red-600" : ""}`}>
                      {q.lowCount}人<span className="text-[10px] font-normal text-muted-foreground"> / {q.count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ScoreCell({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>;
  return <span className={v <= LOW_SCORE_MAX ? "font-bold text-red-600" : ""}>{v}</span>;
}

function People({ people, labels }: { people: PersonHistory[]; labels: string[] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold text-foreground">個人ごとの回答（直近3回）</h2>
      {people.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            この月に強化シートを提出したスタッフはまだいません。
          </CardContent>
        </Card>
      ) : (
        people.map((p) => <PersonCard key={`${p.store}__${p.name}`} person={p} labels={labels} />)
      )}
    </div>
  );
}

function PersonCard({ person, labels }: { person: PersonHistory; labels: string[] }) {
  const answers: BoostAnswer[] = person.answers;
  return (
    <Card>
      <CardContent className="py-4">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
          <h3 className="text-sm font-bold text-foreground">{resolveStaffDisplayName(person.name, person.store)}</h3>
          <span className="text-xs text-muted-foreground">{person.store}</span>
          <Link
            href={boostPersonHref(person.store, person.name)}
            className="ml-auto inline-flex items-center text-xs text-primary hover:underline"
          >
            個人ページ
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-[11px] text-muted-foreground">
                <th className="py-1.5 pr-2 text-left font-medium">項目</th>
                {answers.map((a) => (
                  <th key={a.targetMonth + a.answerDate} className="py-1.5 px-2 text-center font-medium">
                    {formatMonth(a.targetMonth)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: answers[0]?.scores.length ?? 0 }, (_, i) => (
                <tr key={i} className="border-b border-border/30 last:border-0">
                  <td className="py-1.5 pr-2 text-xs text-foreground">{labels[i] || `Q${i + 1}`}</td>
                  {answers.map((a) => (
                    <td key={a.targetMonth + a.answerDate} className="py-1.5 px-2 text-center font-mono-data">
                      <ScoreCell v={a.scores[i]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 space-y-3">
          {answers.map((a) => (
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
  );
}

function Unmatched({ items }: { items: { answer: BoostAnswer; reason: string }[] }) {
  return (
    <Card className="border-amber-400/50">
      <CardContent className="py-4">
        <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-foreground">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          未照合の回答（{items.length}件）
        </h2>
        <p className="mb-3 text-[11px] text-muted-foreground">
          月末報告書のスタッフと「店舗＋名前」で一致しなかった回答です。誰かに寄せずにそのまま出しています。
          項目ごとの集計には入っています。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-[11px] text-muted-foreground">
                <th className="py-1.5 pr-2 text-left font-medium">店舗（フォーム）</th>
                <th className="py-1.5 pr-2 text-left font-medium">氏名</th>
                <th className="py-1.5 pr-2 text-left font-medium">対象月</th>
                <th className="py-1.5 text-left font-medium">理由</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ answer, reason }) => (
                <tr key={answer.answerDate + answer.name} className="border-b border-border/30 last:border-0">
                  <td className="py-2 pr-2 text-xs text-muted-foreground">{answer.store || "—"}</td>
                  <td className="py-2 pr-2 text-foreground">{answer.name || answer.systemName}</td>
                  <td className="py-2 pr-2 text-xs">{formatMonth(answer.targetMonth)}</td>
                  <td className="py-2 text-xs text-amber-700">{reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
