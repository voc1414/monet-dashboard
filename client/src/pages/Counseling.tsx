/**
 * Design: monet Brand Identity — 水彩ブルー × コンクリートモダン
 * Page: カウンセリングシート集計（サロンブレイン分析の院横断サマリー）
 * データソース: client/src/data/counselingSummary.ts（集計値のみ・PIIなし）
 */
import { motion } from "framer-motion";
import { ClipboardList, Users, Store, Info } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { counselingSummary as data } from "@/data/counselingSummary";

function QuestionCard({
  title,
  base,
  multi,
  options,
  index,
}: {
  title: string;
  base: number;
  multi?: boolean;
  options: { label: string; count: number; pct: number }[];
  index: number;
}) {
  const maxPct = Math.max(...options.map((o) => o.pct), 1);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
      className="rounded-2xl border border-border/60 bg-white/70 p-5 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-2 mb-4">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          {multi ? `回答延べ ${base}件` : `回答 ${base}件`}
        </span>
      </div>
      <div className="space-y-2.5">
        {options.map((o) => (
          <div key={o.label}>
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
  return (
    <DashboardLayout breadcrumbs={[{ label: "カウンセリング集計" }]}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">カウンセリングシート集計</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          サロンブレイン カウンセリングシート分析より・モネ全{data.storeCount}院合算（ヨルモネ除く）・{data.periodLabel}
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl border border-border/60 bg-white/70 p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Users className="w-3.5 h-3.5" /> 回答者数
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums">
            {data.totalRespondents.toLocaleString()}
            <span className="text-sm font-normal text-muted-foreground ml-1">名</span>
          </div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-white/70 p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Store className="w-3.5 h-3.5" /> 対象院
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums">
            {data.storeCount}
            <span className="text-sm font-normal text-muted-foreground ml-1">院</span>
          </div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-white/70 p-4 col-span-2 md:col-span-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <ClipboardList className="w-3.5 h-3.5" /> 集計期間
          </div>
          <div className="text-2xl font-bold text-foreground">{data.periodLabel}</div>
        </div>
      </div>

      {/* Store breakdown */}
      <div className="rounded-2xl border border-border/60 bg-white/70 p-5 mb-6">
        <h3 className="text-sm font-bold text-foreground mb-3">院別 回答数</h3>
        <div className="flex flex-wrap gap-2">
          {data.storeBreakdown.map((s) => (
            <div
              key={s.store}
              className="flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1.5"
            >
              <span className="text-xs text-foreground/80">{s.store}</span>
              <span className="text-xs font-bold text-primary tabular-nums">{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Questions grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.questions.map((q, i) => (
          <QuestionCard
            key={q.key}
            title={q.title}
            base={q.base}
            multi={q.multi}
            options={q.options}
            index={i}
          />
        ))}
      </div>

      {/* Source note */}
      <div className="mt-6 flex items-start gap-2 rounded-xl border border-border/40 bg-muted/30 p-4 text-xs text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          出典: {data.source}（{data.retrievedAt} 取得）。対象はモネ全{data.storeCount}院の合算で、ヨルモネは含みません。
          複数回答の設問は回答延べ数に対する比率を表示しています。本ページは集計値のみで、個人情報・自由記述の本文は含みません。
        </div>
      </div>
    </DashboardLayout>
  );
}
