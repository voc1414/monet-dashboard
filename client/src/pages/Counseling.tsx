/**
 * Design: monet Brand Identity — 水彩ブルー × コンクリートモダン
 * Page: カウンセリングシート集計（サロンブレイン分析の院横断サマリー）
 * データソース: スプレッドシート counseling タブ（gviz）→ useCounselingData
 *   表示ラベルは counselingTaxonomy。集計値のみ・PIIなし・モネ7院合算（ヨルモネ除外）。
 */
import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Users, Info, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCounselingData } from "@/hooks/useCounselingData";
import type { CounselingQuestion } from "@/hooks/useCounselingData";

function ymLabel(ym: string): string {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  return `${m[1]}年${parseInt(m[2], 10)}月`;
}

function QuestionCard({
  q,
  index,
}: {
  q: CounselingQuestion;
  index: number;
}) {
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
  const { months, availableMonths, loading, error } = useCounselingData();
  const [selected, setSelected] = useState<string>("");

  // 既定は最新月（＝先月。店舗一覧・スタッフ一覧と同じ）
  useEffect(() => {
    if (!selected && availableMonths.length > 0) {
      setSelected(availableMonths[0]);
    }
  }, [availableMonths, selected]);

  const current = useMemo(
    () => months.find((m) => m.yearMonth === selected) ?? months[0],
    [months, selected]
  );

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

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-16 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          読み込み中…
        </div>
      )}

      {!loading && (!current || months.length === 0) && (
        <div className="rounded-xl border border-border/50 bg-muted/30 p-6 text-sm text-muted-foreground">
          集計データがまだありません。
          {error ? `（${error}）` : ""}
        </div>
      )}

      {!loading && current && (
        <>
          {/* Controls + summary */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">集計期間</span>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger className="w-[160px] h-9 bg-white/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((m) => (
                    <SelectItem key={m} value={m}>
                      {ymLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-white/70 px-4 py-1.5">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">回答者数</span>
              <span className="text-base font-bold text-foreground tabular-nums">
                {current.totalRespondents.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">名</span>
            </div>
          </div>

          {/* Questions grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {current.questions.map((q, i) => (
              <QuestionCard key={q.key} q={q} index={i} />
            ))}
          </div>

          {/* Source note */}
          <div className="mt-6 flex items-start gap-2 rounded-xl border border-border/40 bg-muted/30 p-4 text-xs text-muted-foreground">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              出典: サロンブレイン カウンセリングシート分析。モネ全7院（福岡姪浜 /
              高槻 / 堀江院2nd / 福島 / 堀江 / 土橋 / 広島）の合算で、ヨルモネは含みません。
              複数回答の設問は回答延べ数に対する比率です。集計値のみで、個人情報・自由記述の本文は含みません。
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
