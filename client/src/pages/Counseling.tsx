/**
 * Design: monet Brand Identity — 水彩ブルー × コンクリートモダン
 * Page: カウンセリングシート集計（サロンブレイン分析の院横断サマリー）
 * データソース: スプレッドシート counseling タブ（gviz）→ useCounselingData
 *   期間UIは店舗一覧・スタッフ一覧と同じ PeriodSelector（既定=先月）。
 *   集計値のみ・PIIなし・モネ7院合算（ヨルモネ除外）。
 */
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Users, Info, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  PeriodSelector,
  getDefaultPeriodSelection,
  getFilterMonths,
  getPeriodLabel,
} from "@/components/PeriodSelector";
import type { PeriodSelection } from "@/components/PeriodSelector";
import { useCounselingData, aggregateRows } from "@/hooks/useCounselingData";
import type { CounselingQuestion } from "@/hooks/useCounselingData";

function QuestionCard({ q, index }: { q: CounselingQuestion; index: number }) {
  const maxPct = Math.max(...q.options.map((o) => o.pct), 1);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
      className="rounded-2xl border border-border/60 bg-white/70 p-5 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-2 mb-4">
        <h3 className="text-sm font-bold text-foreground">{q.title}</h3>
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          {q.multi ? `回答延べ ${q.base}件` : `回答 ${q.base}件`}
        </span>
      </div>
      <div className="space-y-2.5">
        {q.options.map((o) => (
          <div key={o.key}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-foreground/80">{o.label}</span>
              <span className="font-medium text-foreground tabular-nums">
                {o.pct}%
                <span className="text-muted-foreground/70 ml-1">({o.count})</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/70"
                style={{ width: `${(o.pct / maxPct) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function Counseling() {
  const { rows, availableMonths, loading, error } = useCounselingData();
  const [selection, setSelection] = useState<PeriodSelection>(
    getDefaultPeriodSelection()
  );

  const filterMonths = useMemo(
    () => getFilterMonths(selection, availableMonths),
    [selection, availableMonths]
  );

  const agg = useMemo(
    () => aggregateRows(rows, filterMonths),
    [rows, filterMonths]
  );

  const hasData = agg.questions.length > 0;

  return (
    <DashboardLayout breadcrumbs={[{ label: "カウンセリング集計" }]}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">
            カウンセリングシート集計
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          サロンブレイン カウンセリングシート分析より・モネ全7院合算（ヨルモネ除く）
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <PeriodSelector
          allMonths={availableMonths}
          selection={selection}
          onChange={setSelection}
        />
        <span className="text-xs text-muted-foreground">
          {getPeriodLabel(selection)}
        </span>
        {hasData && (
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-white/70 px-4 py-1.5">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">回答者数</span>
            <span className="text-base font-bold text-foreground tabular-nums">
              {agg.totalRespondents.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">名</span>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-16 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          読み込み中…
        </div>
      )}

      {!loading && !hasData && (
        <div className="rounded-xl border border-border/50 bg-muted/30 p-6 text-sm text-muted-foreground">
          選択した期間の集計データがありません。
          {error ? `（${error}）` : ""}
        </div>
      )}

      {!loading && hasData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agg.questions.map((q, i) => (
              <QuestionCard key={q.key} q={q} index={i} />
            ))}
          </div>

          <div className="mt-6 flex items-start gap-2 rounded-xl border border-border/40 bg-muted/30 p-4 text-xs text-muted-foreground">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              出典: サロンブレイン カウンセリングシート分析。モネ全7院（福岡姪浜 /
              高槻 / 堀江院2nd / 福島 / 堀江 / 土橋 / 広島）の合算で、ヨルモネは含みません。
              複数月を選んだ場合は件数を合算して比率を再計算します。複数回答の設問は回答延べ数に対する比率です。集計値のみで、個人情報・自由記述の本文は含みません。
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
