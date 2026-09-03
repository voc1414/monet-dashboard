/**
 * Design: monet Brand Identity — 水彩ブルー × コンクリートモダン
 * Page: 雇用形態別の売上ランキング／平均売上（管理者専用・2026-09-01 GF-EMPRANK）
 *
 * 上段 = 雇用形態同士の比較（1人あたり月間平均売上）
 * 下段 = 各雇用形態の中での個人ランキング（期間合計＋月平均）
 *
 * データソース:
 *   雇用形態 … 月末報告書スプシ 列8（useMonthlyReport）
 *   売上     … 月末報告書の 技術売上 + 店販売上（reportRowSales）
 *              林さんの決定は「店舗売上＝サロンボード／個人数値＝月末報告書」。
 *              2026-09-03 の指示で個人系の画面をすべて報告書へ戻した
 * 集計ロジックは lib/employmentRanking.ts（純関数・server/employmentRanking.test.ts で検証）。
 */
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Loader2, AlertTriangle, Info, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";
import {
  PeriodSelector,
  getDefaultPeriodSelection,
  getFilterMonths,
  getPeriodLabel,
} from "@/components/PeriodSelector";
import type { PeriodSelection } from "@/components/PeriodSelector";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { buildEmploymentRanking } from "@/lib/employmentRanking";
import type { EmploymentGroup } from "@/lib/employmentRanking";
import { isRetiredStaff } from "@/lib/newBadge";
import { reportRowSales } from "@/lib/staffReportMetrics";
import { resolveStaffDisplayName } from "@/lib/staffDisplayName";

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;

const formatMonth = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${y}年${parseInt(m)}月`;
};

const RANK_COLORS = ["#C9A227", "#9AA3AB", "#B07A4A"];

export default function EmploymentRanking() {
  const { rawData, loading, error, availableMonths } = useMonthlyReport();

  const [periodSelection, setPeriodSelection] = useState<PeriodSelection>(
    getDefaultPeriodSelection(),
  );

  const filterMonths = useMemo(
    () => getFilterMonths(periodSelection, availableMonths),
    [periodSelection, availableMonths],
  );

  /**
   * 売上の引き当て表（店舗＋氏名＋月 → 技術売上 + 店販売上）。
   * 同じ人・同じ月の二重提出があるので、回答日が新しい行を採用する
   * （buildEmploymentRanking 側の dedupeByStaffMonth と同じ判定にそろえる）。
   */
  const salesByStaffMonth = useMemo(() => {
    const latest = new Map<string, { answerDate: string; sales: number }>();
    rawData.forEach(r => {
      const key = `${r.storeNormalized}__${r.name}__${r.reportMonth}`;
      const prev = latest.get(key);
      if (prev && (r.answerDate || "") <= prev.answerDate) return;
      latest.set(key, { answerDate: r.answerDate || "", sales: reportRowSales(r) });
    });
    return latest;
  }, [rawData]);

  const result = useMemo(() => {
    if (!rawData.length) return null;
    return buildEmploymentRanking(rawData, {
      months: filterMonths,
      // 報告書を出していない月は行そのものが無いので、ここは基本 null にならない。
      // 引き当てに失敗したときだけ null（¥0 に潰さず分母から外す）。
      getSales: (store, name, month) =>
        salesByStaffMonth.get(`${store}__${name}__${month}`)?.sales ?? null,
      isRetired: (name, store, month) => isRetiredStaff(name, store, month),
    });
  }, [rawData, filterMonths, salesByStaffMonth]);

  const busy = loading;

  return (
    <DashboardLayout breadcrumbs={[{ label: "雇用形態別の売上" }]}>
      <div className="space-y-6">
        {/* ヘッダ */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
              <BarChart3 className="w-5 h-5 text-primary" />
              雇用形態別の売上
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {getPeriodLabel(periodSelection)}
              {result && result.months.length > 0 && (
                <>
                  {" ／ "}
                  {result.months.length === 1
                    ? formatMonth(result.months[0])
                    : `${formatMonth(result.months[0])}〜${formatMonth(
                        result.months[result.months.length - 1],
                      )}（${result.months.length}ヶ月）`}
                </>
              )}
            </p>
          </div>
          <PeriodSelector
            allMonths={availableMonths}
            selection={periodSelection}
            onChange={setPeriodSelection}
          />
        </div>

        {error && (
          <Card className="border-destructive/40">
            <CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </CardContent>
          </Card>
        )}

        {busy && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            読み込み中…
          </div>
        )}

        {!busy && result && result.groups.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              この期間に対象の報告がありません。
            </CardContent>
          </Card>
        )}

        {!busy && result && result.groups.length > 0 && (
          <>
            {/* 数字の読み方（分母を必ず見せる） */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-4 space-y-1.5 text-xs text-muted-foreground">
                <p className="flex items-start gap-2 font-medium text-foreground">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                  この数字の読み方
                </p>
                <p>
                  平均は<strong className="text-foreground">「1人あたり月間平均売上」</strong>
                  ＝ 売上合計 ÷ 有効レコード数（人×月）。期間が何ヶ月でも意味が変わりません。
                </p>
                <p>
                  売上は<strong className="text-foreground">月末報告書</strong>
                  （自己申告）の 技術売上 + 店販売上です。個人の数値は報告書、
                  店舗の売上はサロンボードが正本です。報告書を出していない月は
                  <strong className="text-foreground">平均の分母に入りません</strong>
                  （¥0 として混ぜていません）。
                </p>
                <p>
                  雇用形態は<strong className="text-foreground">その月の報告どおり</strong>
                  で分類しています。期間中に雇用形態が変わった人は、変わる前と後の両方のグループに
                  その月のぶんだけ入ります。
                </p>
                <p>
                  対象期間の合計：{result.totals.people}人 ／ {result.totals.records}レコード（
                  有効 {result.totals.validRecords}・データ無し {result.totals.missingRecords}）
                  ／ 売上合計 {yen(result.totals.totalSales)}
                  {result.totals.avgMonthlySales !== null && (
                    <> ／ 全体の月間平均 {yen(result.totals.avgMonthlySales)}</>
                  )}
                </p>
              </CardContent>
            </Card>

            {/* 上段: 雇用形態同士の比較 */}
            <GroupComparison groups={result.groups} />

            {/* 下段: 各雇用形態の中での個人ランキング */}
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                <Trophy className="w-4 h-4 text-primary" />
                雇用形態の中での個人ランキング
              </h2>
              {result.groups.map((g) => (
                <GroupMembers key={g.employmentGroup} group={g} />
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

/** 上段：雇用形態ごとの1人あたり月間平均売上を横棒で比較 */
function GroupComparison({ groups }: { groups: EmploymentGroup[] }) {
  const max = Math.max(1, ...groups.map((g) => g.avgMonthlySales ?? 0));

  return (
    <Card>
      <CardContent className="py-5">
        <h2 className="mb-4 text-base font-bold text-foreground">
          雇用形態ごとの比較（1人あたり月間平均売上）
        </h2>
        <div className="space-y-3">
          {groups.map((g) => {
            const avg = g.avgMonthlySales;
            const width = avg === null ? 0 : Math.max(2, (avg / max) * 100);
            return (
              <div key={g.employmentGroup}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {g.employmentGroup}
                    {g.maxCustomers === null && (
                      <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                        （最大客数の設定が無い枠）
                      </span>
                    )}
                  </span>
                  <span className="font-mono-data text-sm font-bold text-foreground">
                    {avg === null ? "データ無し" : yen(avg)}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${width}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="h-full rounded-full bg-primary"
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {g.people}人 ／ {g.records}レコード中 {g.validRecords}件で計算
                  {g.missingRecords > 0 && <>（データ無し {g.missingRecords}件は除外）</>}
                  {" ／ 合計 "}
                  {yen(g.totalSales)}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/** 下段：1グループの個人ランキング */
function GroupMembers({ group }: { group: EmploymentGroup }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-sm font-bold text-foreground">{group.employmentGroup}</h3>
          <span className="text-[11px] text-muted-foreground">
            {group.people}人中 {group.members.filter((m) => m.validMonths > 0).length}人に売上データあり
            {group.avgMonthlySales !== null && <> ／ 平均 {yen(group.avgMonthlySales)}</>}
          </span>
        </div>

        {/* 狭い画面では横スクロール（body を横に伸ばさない） */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-[11px] text-muted-foreground">
                <th className="py-1.5 pr-2 text-left font-medium">順位</th>
                <th className="py-1.5 pr-2 text-left font-medium">氏名</th>
                <th className="py-1.5 pr-2 text-left font-medium">店舗</th>
                <th className="py-1.5 pr-2 text-right font-medium">月平均</th>
                <th className="py-1.5 pr-2 text-right font-medium">期間合計</th>
                <th className="py-1.5 text-right font-medium">対象月</th>
              </tr>
            </thead>
            <tbody>
              {group.members.map((m, i) => {
                const noData = m.validMonths === 0;
                const rankColor = !noData && i < 3 ? RANK_COLORS[i] : undefined;
                return (
                  <tr
                    key={`${m.store}__${m.name}`}
                    className="border-b border-border/30 last:border-0"
                  >
                    <td className="py-2 pr-2">
                      {noData ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <span
                          className="font-mono-data text-xs font-bold"
                          style={rankColor ? { color: rankColor } : undefined}
                        >
                          {i + 1}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2 font-medium text-foreground">
                      {resolveStaffDisplayName(m.name, m.store)}
                    </td>
                    <td className="py-2 pr-2 text-xs text-muted-foreground">{m.store}</td>
                    <td className="py-2 pr-2 text-right font-mono-data">
                      {noData ? (
                        <span className="text-xs text-muted-foreground">データ無し</span>
                      ) : (
                        yen(m.avgMonthlySales!)
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono-data text-muted-foreground">
                      {noData ? "—" : yen(m.totalSales)}
                    </td>
                    <td className="py-2 text-right text-xs text-muted-foreground">
                      {m.validMonths}/{m.months.length}ヶ月
                      {m.missingMonths.length > 0 && (
                        <span className="block text-[10px]">
                          無: {m.missingMonths.map(formatMonth).join("・")}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
