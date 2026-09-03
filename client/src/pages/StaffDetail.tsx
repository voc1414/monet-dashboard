/*
 * Design: monet Brand Identity — 水彩ブルー × コンクリートモダン
 * Page: スタッフ個別ページ
 * セクション順: 個人売上 → 個別アドバイス → ファンくるデータ → NPS結果
 */
import { useParams } from "wouter";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, BarChart3, DollarSign, Scissors,
  FileText, ExternalLink, Loader2, FolderOpen, Eye,
  Lightbulb, CheckCircle2, Target, ArrowUpRight,
  Trophy, ThumbsUp, AlertTriangle, AlertCircle,
  ChevronDown, ChevronUp, Users, Quote, Star, MessageSquare, Building2, ClipboardCheck,
  Sparkles, CalendarCheck, Gauge, CircleCheck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PeriodSelector, getDefaultPeriodSelection, getFilterMonths, getPeriodLabel } from "@/components/PeriodSelector";
import type { PeriodSelection } from "@/components/PeriodSelector";
import { Badge } from "@/components/ui/badge";
import ScoreDetailModal from "@/components/ScoreDetailModal";
import DashboardLayout from "@/components/DashboardLayout";
import { useNpsData, filterByMonth, getAvailableMonths } from "@/hooks/useNpsData";
import type { NpsRecord, StoreStats } from "@/hooks/useNpsData";
import { getNpsClass, NPS_INDUSTRY_AVERAGE } from "@/lib/npsClass";
import { generateStoreAdvice } from "@/lib/npsAdvice";
import type { NpsAdvice } from "@/lib/npsAdvice";
import { useFankuruDataByStaff } from "@/hooks/useFankuruData";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import type { StaffReport } from "@/hooks/useMonthlyReport";
import { aggregateStaffReportMetrics, pickLatestPerMonth } from "@/lib/staffReportMetrics";
import { isNewStaff } from "@/lib/newBadge";
import { useStores } from "@/hooks/useStores";
import { calculateUtilizationRate, getUtilizationColor } from "@/lib/utilizationRate";
import { calculateCompositeScore } from "@/lib/compositeScore";
import type { CompositeScoreResult } from "@/lib/compositeScore";
import { generateStaffAdvice } from "@/lib/staffAdvice";
import type { StaffAdvice } from "@/lib/staffAdvice";
import { normalizeStaffKey } from "@/lib/staffNameAlias";
import { resolveStaffDisplayName } from "@/lib/staffDisplayName";
import type { FankuruPdf } from "@/hooks/useFankuruData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

const NPS_COLORS = {
  promoter: "#2D9C8F",
  passive: "#E5B85C",
  detractor: "#C75C5C",
};

const formatCurrency = (n: number) => {
  return `¥${n.toLocaleString()}`;
};

// --- NPS Gauge ---
function NpsGauge({ score }: { score: number }) {
  const npsClass = getNpsClass(score);
  return (
    <div className="flex flex-col items-center">
      <div className="w-28 h-28 rounded-full border-4 flex items-center justify-center" style={{ borderColor: npsClass.color }}>
        <div className="text-center">
          <div className="font-mono-data text-3xl font-bold" style={{ color: npsClass.color }}>
            {score > 0 ? "+" : ""}{score}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">NPS</div>
        </div>
      </div>
      <div className="mt-2 flex flex-col items-center gap-1">
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ color: npsClass.color, backgroundColor: npsClass.bgColor, border: `1px solid ${npsClass.borderColor}` }}
        >
          {npsClass.label}
        </span>
        <span className="text-[10px] text-muted-foreground">
          業界平均: {NPS_INDUSTRY_AVERAGE}
        </span>
      </div>
    </div>
  );
}

// --- Category Analysis ---
function CategoryAnalysis({ records, field, label }: { records: NpsRecord[]; field: keyof NpsRecord; label: string }) {
  const analysis = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach((r) => {
      const val = r[field] as string;
      if (!val) return;
      val.split(",").forEach((v) => {
        const trimmed = v.trim();
        if (trimmed) counts[trimmed] = (counts[trimmed] || 0) + 1;
      });
    });
    const total = records.length;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, pct: Math.round((value / total) * 100) }));
  }, [records, field]);

  if (analysis.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-semibold text-foreground mb-3">{label}</h4>
      <div className="space-y-2">
        {analysis.map((item) => (
          <div key={item.name} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground truncate">{item.name}</span>
                <span className="text-xs font-mono-data text-foreground ml-2">{item.pct}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all duration-500"
                  style={{ width: `${item.pct}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Advice Section ---
const ADVICE_ICONS = {
  trophy: Trophy,
  thumbsUp: ThumbsUp,
  target: Target,
  alertTriangle: AlertTriangle,
  alertCircle: AlertCircle,
};

function AdviceSection({ stats, records }: { stats: StoreStats; records: NpsRecord[] }) {
  const advice = useMemo(() => generateStoreAdvice(stats, records), [stats, records]);
  const npsClass = getNpsClass(stats.npsScore);
  const IconComponent = ADVICE_ICONS[advice.icon];

  return (
    <section className="mb-8 pt-6 border-t-2 border-[#E5B85C]/20">
      <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-[#E5B85C]" />
        個別アドバイス
      </h2>
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex items-start gap-3" style={{ backgroundColor: npsClass.bgColor }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: npsClass.color + "18" }}>
            <IconComponent className="w-5 h-5" style={{ color: npsClass.color }} />
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{advice.summary}</p>
        </div>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <CheckCircle2 className="w-4 h-4 text-[#2D9C8F]" />
                <h4 className="text-sm font-semibold text-foreground">強み</h4>
              </div>
              <ul className="space-y-2">
                {advice.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                    <span className="w-1 h-1 rounded-full bg-[#2D9C8F] mt-1.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <Target className="w-4 h-4 text-[#E5B85C]" />
                <h4 className="text-sm font-semibold text-foreground">改善ポイント</h4>
              </div>
              <ul className="space-y-2">
                {advice.improvements.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                    <span className="w-1 h-1 rounded-full bg-[#E5B85C] mt-1.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <ArrowUpRight className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-semibold text-foreground">アクションプラン</h4>
              </div>
              <ul className="space-y-2">
                {advice.actionItems.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                    <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

// --- Review Card ---
function ReviewCard({ record, index }: { record: NpsRecord; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index }}
    >
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-mono-data font-bold"
                style={{
                  backgroundColor:
                    record.npsScore >= 9 ? NPS_COLORS.promoter : record.npsScore >= 7 ? NPS_COLORS.passive : NPS_COLORS.detractor,
                }}
              >
                {record.npsScore}
              </div>
              <span className="text-xs text-muted-foreground">{record.menu}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{record.date.split(" ")[0]}</span>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">{record.review}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ネガティブキーワード
const NEGATIVE_KEYWORDS = [
  "残念", "不満", "改善", "高い", "待ち時間", "長い", "微妙", "期待外れ",
  "雑", "不安", "痛", "ムラ", "合わな", "違う", "もう少し", "気になる",
  "狭", "汚", "臭", "がっかり", "ひどい", "最悪", "二度と", "嫌",
];

// ===== Main Component =====
export default function StaffDetail() {
  const params = useParams<{ storeId: string; staffId: string }>();
  const staffName = decodeURIComponent(params.staffId || "");
  const storeParam = decodeURIComponent(params.storeId || "");
  const { npsAliasMap } = useStores();
  const { records, loading: npsLoading, lastUpdated, refresh } = useNpsData(npsAliasMap);
  const { rawData, loading: reportLoading, availableMonths: reportMonths } = useMonthlyReport();
  const loading = npsLoading || reportLoading;

  // スタッフの所属店舗を特定（URLパラメータ優先）
  const staffStore = useMemo(() => {
    if (storeParam) return storeParam;
    const staffData = rawData.find(r => r.name === staffName);
    return staffData?.storeNormalized || "";
  }, [rawData, staffName, storeParam]);

  // ファンくるデータ（店舗名で絞り込み、同姓同名対策）
  const { pdfs: fankuruPdfs, loading: fankuruLoading } = useFankuruDataByStaff(staffName, staffStore);

  // スタッフの雇用形態を取得
  const staffEmploymentType = useMemo(() => {
    const staffData = rawData.find(r => r.name === staffName && r.storeNormalized === staffStore)
      || rawData.find(r => r.name === staffName);
    return staffData?.employmentType || "";
  }, [rawData, staffName, staffStore]);

  // スタッフ名比較用ヘルパー（NPSシートはスペースなし、月末報告書はスペースあり。大文字小文字の登録違いも吸収）
  const normalizeStaffName = (name: string) => normalizeStaffKey(name);

  // 月の管理
  const npsMonths = useMemo(() => {
    const norm = normalizeStaffName(staffName);
    const staffRecords = records.filter(r => normalizeStaffName(r.staff?.trim() || "") === norm);
    return getAvailableMonths(staffRecords);
  }, [records, staffName]);

  const fankuruMonths = useMemo(() => {
    const months = new Set<string>();
    fankuruPdfs.forEach(p => months.add(p.yearMonth));
    return Array.from(months).sort().reverse();
  }, [fankuruPdfs]);

  const staffReportMonths = useMemo(() => {
    const months = new Set<string>();
    rawData.filter(r => r.name === staffName && (!staffStore || r.storeNormalized === staffStore)).forEach(r => months.add(r.reportMonth));
    return Array.from(months).sort().reverse();
  }, [rawData, staffName, staffStore]);

  const allMonths = useMemo(() => {
    const set = new Set([...npsMonths, ...fankuruMonths, ...staffReportMonths]);
    return Array.from(set).sort().reverse();
  }, [npsMonths, fankuruMonths, staffReportMonths]);

  const [periodSelection, setPeriodSelection] = useState<PeriodSelection>(getDefaultPeriodSelection());
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<FankuruPdf | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const filterM = useMemo(() => getFilterMonths(periodSelection, allMonths), [periodSelection, allMonths]);
  const isAllPeriod = filterM === "all";
  /** 単一月を取得（月末報告書のような単月データ用） */
  const singleMonth = useMemo(() => {
    if (isAllPeriod) return undefined;
    const months = filterM as string[];
    return months.length === 1 ? months[0] : undefined;
  }, [filterM, isAllPeriod]);

  /**
   * 個人の実績（総売上・技術・店販・客単価・総客数・新規・再来・次回予約率）は【月末報告書のみ】。
   * 林さんの決定は一貫して「店舗売上＝サロンボード／個人数値＝月末報告書」。
   * 2026-06〜09 のあいだ個人までサロンボード(stylist_flat)にしていたのは承認記録の無い変更
   * （fd724ae で優先化、dc932af で報告書フォールバックを削除。どちらもコミットに指示の記録が無い）。
   * 2026-09-03 の林さん指示で報告書へ戻す。
   *
   * 選択期間に入る報告書の行はすべて合算する。従来は最新1行だけを見ており、
   * 全期間・年間を選んでも単月のままだった（Manus実装時からの不具合。出どころとは別の問題）。
   * 同じ対象月に複数回答があるときは回答日が新しい1行だけ採用する（二重計上を防ぐ）。
   * 報告書に総売上・客単価の列は無いので
   * 総売上＝技術売上＋店販売上／客単価＝総売上÷(新規＋再来) で算出する（林さん承認 2026-09-03）。
   */
  const reportRowsInPeriod = useMemo(() => {
    const staffRows = rawData.filter(r => r.name === staffName && (!staffStore || r.storeNormalized === staffStore));
    const inPeriod = isAllPeriod
      ? staffRows
      : staffRows.filter(r => (filterM as string[]).includes(r.reportMonth));
    return pickLatestPerMonth(inPeriod);
  }, [rawData, staffName, staffStore, filterM, isAllPeriod]);

  // コメント・行動チェック等は期間内で最も新しい1件を出す
  const staffReport = useMemo(() => reportRowsInPeriod[0] || null, [reportRowsInPeriod]);

  const metrics = useMemo(() => aggregateStaffReportMetrics(reportRowsInPeriod), [reportRowsInPeriod]);

  // 次回予約率も期間合算（Σ次回予約数 ÷ Σ客数）
  const nextResRate = metrics?.nextReservationRate ?? 0;

  // NPS: スタッフ名でフィルタ（スペース正規化して比較）
  const staffNpsRecords = useMemo(() => {
    const norm = normalizeStaffName(staffName);
    const filtered = records.filter(r => normalizeStaffName(r.staff?.trim() || "") === norm);
    if (isAllPeriod) return filtered;
    return filtered.filter(r => {
      if (!r.date) return false;
      const ym = r.date.substring(0, 7).replace(/\//g, "-");
      return (filterM as string[]).includes(ym);
    });
  }, [records, staffName, filterM, isAllPeriod]);

  // スタッフ個人のStoreStats相当を計算
  const staffNpsStats = useMemo((): StoreStats | null => {
    if (staffNpsRecords.length === 0) return null;
    const total = staffNpsRecords.length;
    const avg = staffNpsRecords.reduce((s, r) => s + r.npsScore, 0) / total;
    const promoters = staffNpsRecords.filter(r => r.npsScore >= 9).length;
    const passives = staffNpsRecords.filter(r => r.npsScore >= 7 && r.npsScore <= 8).length;
    const detractors = staffNpsRecords.filter(r => r.npsScore <= 6).length;
    const nps = Math.round(((promoters - detractors) / total) * 100);
    return {
      name: staffName,
      shortName: staffName,
      totalResponses: total,
      avgScore: Math.round(avg * 10) / 10,
      npsScore: nps,
      promoters,
      passives,
      detractors,
      promoterPct: Math.round((promoters / total) * 100),
      passivePct: Math.round((passives / total) * 100),
      detractorPct: Math.round((detractors / total) * 100),
    };
  }, [staffNpsRecords, staffName]);

  // スコア分布
  const scoreDistribution = useMemo(() => {
    const dist: Record<number, number> = {};
    for (let i = 0; i <= 10; i++) dist[i] = 0;
    staffNpsRecords.forEach(r => {
      if (r.npsScore >= 0 && r.npsScore <= 10) dist[r.npsScore]++;
    });
    return Object.entries(dist).map(([score, count]) => ({
      score: parseInt(score),
      count,
      fill: parseInt(score) >= 9 ? NPS_COLORS.promoter : parseInt(score) >= 7 ? NPS_COLORS.passive : NPS_COLORS.detractor,
    }));
  }, [staffNpsRecords]);

  // 円グラフ
  const pieData = useMemo(() => {
    if (!staffNpsStats) return [];
    return [
      { name: "推奨者 (9-10)", value: staffNpsStats.promoters, fill: NPS_COLORS.promoter },
      { name: "中立者 (7-8)", value: staffNpsStats.passives, fill: NPS_COLORS.passive },
      { name: "批判者 (0-6)", value: staffNpsStats.detractors, fill: NPS_COLORS.detractor },
    ];
  }, [staffNpsStats]);

  // ファンくるPDF: 月でフィルタ
  const filteredFankuruPdfs = useMemo(() => {
    if (isAllPeriod) return fankuruPdfs;
    return fankuruPdfs.filter(p => (filterM as string[]).includes(p.yearMonth));
  }, [fankuruPdfs, filterM, isAllPeriod]);

  // ファンくるコメント（月末報告書から）
  const filteredFankuruComments = useMemo(() => {
    return rawData
      .filter(r => r.name === staffName && (isAllPeriod || (filterM as string[]).includes(r.reportMonth)))
      .filter(r => r.fankuruComment && r.fankuruComment.trim() !== "" && r.fankuruComment.trim() !== "なし")
      .map(r => ({ month: r.reportMonthLabel, comment: r.fankuruComment }));
  }, [rawData, filterM, isAllPeriod, staffName]);

  const hasFankuruData = filteredFankuruPdfs.length > 0 || filteredFankuruComments.length > 0;

  // トップ3レビュー
  const topReviews = useMemo(() => {
    return staffNpsRecords
      .filter(r => r.npsScore >= 9 && r.review && r.review.trim().length > 0)
      .sort((a, b) => (b.review?.length || 0) - (a.review?.length || 0))
      .slice(0, 3);
  }, [staffNpsRecords]);

  // ワースト3レビュー
  const worstReviews = useMemo(() => {
    return staffNpsRecords
      .filter(r => r.npsScore <= 8 && r.review && r.review.trim().length > 0)
      .map(r => {
        let harshScore = 0;
        const reviewText = r.review || "";
        NEGATIVE_KEYWORDS.forEach(kw => { if (reviewText.includes(kw)) harshScore += 3; });
        harshScore += Math.min(reviewText.length / 20, 5);
        harshScore += (8 - r.npsScore) * 2;
        return { record: r, harshScore };
      })
      .sort((a, b) => b.harshScore - a.harshScore)
      .slice(0, 3)
      .map(h => h.record);
  }, [staffNpsRecords]);

  const remainingReviews = useMemo(() => {
    const shown = new Set([...topReviews, ...worstReviews]);
    return staffNpsRecords.filter(r => !shown.has(r) && r.review && r.review.trim().length > 0);
  }, [staffNpsRecords, topReviews, worstReviews]);



  // 総合点スコア計算
  const compositeScore = useMemo((): CompositeScoreResult | null => {
    // データが何もない場合はnull
    if (!staffNpsStats && !staffReport && !hasFankuruData) return null;
    const utilRate = metrics ? calculateUtilizationRate(metrics.avgMonthlyCustomers, metrics.employmentType) : null;
    return calculateCompositeScore({
      npsScore: staffNpsStats?.npsScore ?? null,
      npsResponseCount: staffNpsStats?.totalResponses ?? 0,
      nextReservationRate: metrics?.nextReservationRate ?? null,
      utilizationRate: utilRate,
    });
  }, [staffNpsStats, staffReport, hasFankuruData]);

  // アドバイス生成
  const staffAdvice = useMemo((): StaffAdvice | null => {
    if (!compositeScore) return null;
    const utilRate = metrics ? calculateUtilizationRate(metrics.avgMonthlyCustomers, metrics.employmentType) : null;
    return generateStaffAdvice({
      totalScore: compositeScore.total,
      rankLabel: compositeScore.rank.label,
      nextReservationRate: metrics?.nextReservationRate ?? null,
      utilizationRate: utilRate,
      npsScore: staffNpsStats?.npsScore ?? null,
      totalCustomers: metrics?.totalCustomers ?? 0,
      nextReservationCount: metrics?.nextReservation ?? 0,
    });
  }, [compositeScore, staffReport, staffNpsStats]);

  // 画面に出す呼び名。staffName は URL 由来の照合キーなので触らない
  const shownName = resolveStaffDisplayName(staffName, staffStore);

  const breadcrumbs = [
    { label: "スタッフ一覧", href: "/staff" },
    { label: shownName },
  ];

  return (
    <DashboardLayout
      breadcrumbs={breadcrumbs}
      lastUpdated={lastUpdated}
      onRefresh={refresh}
      loading={loading}
    >
      {/* Staff Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-primary font-bold text-2xl">{shownName.charAt(0)}</span>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                {shownName}
                {staffStore && isNewStaff(staffName, staffStore) && (
                  <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">NEW</span>
                )}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                {staffStore && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {staffStore}
                  </span>
                )}
                {staffEmploymentType && (
                  <span className="text-xs text-muted-foreground">
                    {staffEmploymentType}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Period Selector */}
        <PeriodSelector allMonths={allMonths} selection={periodSelection} onChange={setPeriodSelection} />
      </div>

      {/* ===== 0. 月末報告書 回答ステータス ===== */}
      {singleMonth && (() => {
        const hasSubmitted = !!staffReport;
        return (
          <div className="flex items-center gap-2 mb-4">
            <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">月末報告書</span>
            {hasSubmitted ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                {getPeriodLabel(periodSelection)} 回答済み
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="w-3 h-3" />
                {getPeriodLabel(periodSelection)} 未回答
              </span>
            )}
          </div>
        );
      })()}

      {/* ===== 総合点スコア ===== */}
      {compositeScore && !loading && (
        <section className="mb-6 pt-6 border-t-2 border-primary/20">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            総合点
            {!isAllPeriod && (
              <span className="text-xs font-normal text-muted-foreground">— {getPeriodLabel(periodSelection)}</span>
            )}
          </h2>

          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              {/* メインスコア */}
              <div className="flex flex-col sm:flex-row">
                {/* 左: スコア円 */}
                <div className="flex flex-col items-center justify-center p-6 sm:p-8 sm:w-56 shrink-0"
                  style={{ backgroundColor: compositeScore.rank.bgColor }}
                >
                  <div
                    className="w-24 h-24 rounded-full border-4 flex items-center justify-center mb-3"
                    style={{ borderColor: compositeScore.rank.color }}
                  >
                    <div className="text-center">
                      <div className="font-mono-data text-3xl font-bold" style={{ color: compositeScore.rank.color }}>
                        {compositeScore.total}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">/100</div>
                    </div>
                  </div>
                  <span
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold border"
                    style={{
                      color: compositeScore.rank.color,
                      backgroundColor: compositeScore.rank.bgColor,
                      borderColor: compositeScore.rank.borderColor,
                    }}
                  >
                    {compositeScore.rank.icon === "star" && <Star className="w-3.5 h-3.5" />}
                    {compositeScore.rank.icon === "trophy" && <Trophy className="w-3.5 h-3.5" />}
                    {compositeScore.rank.icon === "check" && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {compositeScore.rank.icon === "target" && <Target className="w-3.5 h-3.5" />}
                    {compositeScore.rank.icon === "alert" && <AlertTriangle className="w-3.5 h-3.5" />}
                    {compositeScore.rank.label}
                  </span>
                  {compositeScore.dataCoverage < 1 && (
                    <div className="text-[10px] text-muted-foreground mt-2 text-center">
                      データ充足率: {Math.round(compositeScore.dataCoverage * 100)}%
                    </div>
                  )}
                </div>

                {/* 右: 内訳バー */}
                <div className="flex-1 p-5 sm:p-6 space-y-3">
                  {/* NPS */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" /> NPS評価
                      </span>
                      <span className="text-xs font-mono-data font-bold text-foreground">
                        {compositeScore.available.nps ? `NPS ${compositeScore.rawValues.npsScore! > 0 ? "+" : ""}${compositeScore.rawValues.npsScore}（${compositeScore.rawValues.npsResponseCount}件）` : "—"}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${compositeScore.available.nps && compositeScore.rawValues.npsScore !== null ? ((compositeScore.rawValues.npsScore + 100) / 200) * 100 : 0}%`,
                          backgroundColor: compositeScore.available.nps ? "#2D9C8F" : "#d4d4d4",
                        }}
                      />
                    </div>
                  </div>

                  {/* 次回予約率 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <CalendarCheck className="w-3 h-3" /> 次回予約率
                      </span>
                      <span className="text-xs font-mono-data font-bold text-foreground">
                        {compositeScore.available.reservation ? `${compositeScore.rawValues.nextReservationRate!.toFixed(1)}%` : "—"}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${compositeScore.available.reservation && compositeScore.rawValues.nextReservationRate !== null ? compositeScore.rawValues.nextReservationRate : 0}%`,
                          backgroundColor: compositeScore.available.reservation ? "#E5B85C" : "#d4d4d4",
                        }}
                      />
                    </div>
                  </div>

                  {/* 稼働率 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Gauge className="w-3 h-3" /> 稼働率
                      </span>
                      <span className="text-xs font-mono-data font-bold text-foreground">
                        {compositeScore.available.utilization ? `${compositeScore.rawValues.utilizationRate!.toFixed(1)}%` : "—"}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${compositeScore.available.utilization && compositeScore.rawValues.utilizationRate !== null ? compositeScore.rawValues.utilizationRate : 0}%`,
                          backgroundColor: compositeScore.available.utilization ? "#8B5CF6" : "#d4d4d4",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ===== アドバイスセクション ===== */}
      {staffAdvice && (staffAdvice.strength || staffAdvice.reservationAdvice) && !loading && (
        <section className="mb-6">
          <Card className="border-primary/20 shadow-sm bg-gradient-to-r from-blue-50/40 to-sky-50/30 overflow-hidden">
            <CardContent className="p-3 sm:p-5">
              {/* モバイル: アイコンとタイトルを上部に配置 */}
              <div className="flex items-center gap-2 mb-3 sm:hidden">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Lightbulb className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-xs font-bold text-primary">アドバイス</span>
              </div>

              <div className="flex items-start gap-3">
                {/* PC: 左アイコン */}
                <div className="w-8 h-8 rounded-lg bg-primary/10 hidden sm:flex items-center justify-center shrink-0 mt-0.5">
                  <Lightbulb className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 space-y-3 sm:space-y-2.5">
                  {/* 強み */}
                  {staffAdvice.strength && (
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <p className="text-[13px] sm:text-sm text-foreground leading-relaxed">
                        <span className="font-bold text-emerald-700">強み：</span>{staffAdvice.strength}
                      </p>
                    </div>
                  )}

                  {/* 次回予約率改善アドバイス */}
                  {staffAdvice.reservationAdvice && !staffAdvice.reservationAdvice.achieved && (
                    <div className="flex items-start gap-2">
                      <Target className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div className="space-y-2 sm:space-y-1.5">
                        <p className="text-[13px] sm:text-sm text-foreground leading-relaxed">
                          <span className="font-bold text-primary">予約率 {staffAdvice.reservationAdvice.currentRate}%</span>
                          <span className="text-muted-foreground"> → 目標 </span>
                          <span className="font-bold text-primary">{staffAdvice.reservationAdvice.targetRate}%</span>
                        </p>
                        {staffAdvice.reservationAdvice.additionalNeeded > 0 && (
                          <p className="text-[13px] sm:text-sm text-muted-foreground leading-relaxed">
                            あと<span className="font-bold text-foreground">{staffAdvice.reservationAdvice.additionalNeeded}名</span>の次回予約で達成。総合点<span className="font-bold text-foreground">{staffAdvice.reservationAdvice.projectedScore}点（{staffAdvice.reservationAdvice.projectedRankLabel}）</span>に。
                          </p>
                        )}
                        <a
                          href={staffAdvice.reservationAdvice.manualUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors mt-1.5 py-1.5 px-2.5 bg-primary/5 rounded-md sm:bg-transparent sm:p-0 sm:rounded-none"
                        >
                          <FileText className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                          次回予約率の改善マニュアル
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* 目標達成済み */}
                  {staffAdvice.reservationAdvice?.achieved && (
                    <div className="flex items-start gap-2">
                      <Trophy className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[13px] sm:text-sm text-foreground leading-relaxed">
                        <span className="font-bold text-amber-600">予約率 {staffAdvice.reservationAdvice.currentRate}%</span>
                        <span className="text-muted-foreground"> — 目標達成！この調子を維持しましょう。</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ===== 0. 次回予約率・稼働率 ===== */}
      {staffReport && (() => {
        const utilRate = calculateUtilizationRate(metrics?.avgMonthlyCustomers ?? 0, staffReport.employmentType);
        return (
          <section className="mb-6 pt-6 border-t-2 border-primary/20">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 次回予約率 */}
              <div className={`rounded-xl px-4 sm:px-5 py-4 border ${
                nextResRate >= 85
                  ? "bg-gradient-to-r from-amber-50/60 to-yellow-50/40 border-amber-200/60"
                  : nextResRate >= 70
                    ? "bg-amber-50/30 border-amber-200/40"
                    : "bg-red-50/40 border-red-200/50"
              }`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <CalendarCheck className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">次回予約率</span>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className={`font-mono-data text-2xl sm:text-3xl font-bold ${
                    nextResRate >= 85 ? "text-[#2D9C8F]" :
                    nextResRate >= 70 ? "text-[#E5B85C]" :
                    "text-[#C75C5C]"
                  }`}>
                    {nextResRate}%
                  </span>
                  <div className="shrink-0">
                    {nextResRate >= 85 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-bold text-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-full px-2 py-1 shadow-sm">
                        <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
                        エクセレント！
                      </span>
                    )}
                    {nextResRate >= 70 && nextResRate <= 84 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-bold text-[#E5B85C] bg-amber-50/60 border border-amber-200/60 rounded-full px-2 py-1">
                        <CircleCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#E5B85C]" />
                        適正
                      </span>
                    )}
                    {nextResRate <= 69 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                        <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        要改善
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {/* 稼働率 */}
              <div className={`rounded-xl px-4 sm:px-5 py-4 border ${
                utilRate === null
                  ? "bg-muted/20 border-border/40"
                  : utilRate >= 95
                    ? "bg-gradient-to-r from-emerald-50/60 to-teal-50/40 border-emerald-200/60"
                    : utilRate >= 90
                      ? "bg-amber-50/30 border-amber-200/40"
                      : "bg-red-50/40 border-red-200/50"
              }`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Gauge className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">稼働率</span>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {utilRate !== null ? (
                    <>
                      <span className={`font-mono-data text-2xl sm:text-3xl font-bold ${getUtilizationColor(utilRate)}`}>
                        {utilRate}%
                      </span>
                      <div className="shrink-0">
                        {utilRate >= 95 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-bold text-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-full px-2 py-1 shadow-sm">
                            <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
                            エクセレント！
                          </span>
                        )}
                        {utilRate >= 90 && utilRate < 95 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-bold text-[#E5B85C] bg-amber-50/60 border border-amber-200/60 rounded-full px-2 py-1">
                            <CircleCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#E5B85C]" />
                            適正
                          </span>
                        )}
                        {utilRate <= 89 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                            <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            要改善
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">— (パート)</span>
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* ===== 1. 個人売上 ===== */}
      <section className="mb-8 pt-6 border-t-2 border-primary/20">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          個人売上
          {!isAllPeriod && (
            <span className="text-xs font-normal text-muted-foreground">— {getPeriodLabel(periodSelection)}</span>
          )}
        </h2>

        {staffReport ? (
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-5">
              {metrics && (
                <div className="mb-3">
                  <span className="text-[10px] font-medium text-primary/70 bg-primary/5 border border-primary/20 rounded px-1.5 py-0.5">
                    月末報告書{metrics.monthCount > 1 ? `（${metrics.monthCount}ヶ月分を合算）` : ""}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">総売上</div>
                  <div className="font-mono-data text-lg font-bold text-foreground">{formatCurrency(metrics?.totalSales ?? staffReport.totalSales)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">技術売上</div>
                  <div className="font-mono-data text-lg font-bold text-foreground">{formatCurrency(metrics?.techSales ?? staffReport.techSales)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">店販売上</div>
                  <div className="font-mono-data text-lg font-bold text-foreground">{formatCurrency(metrics?.retailSales ?? staffReport.retailSales)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">客単価</div>
                  <div className="font-mono-data text-lg font-bold text-foreground">{formatCurrency(metrics?.unitPrice ?? staffReport.unitPrice)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">総客数</div>
                  <div className="font-mono-data text-lg font-bold text-foreground">{metrics?.totalCustomers ?? staffReport.totalCustomers}名</div>
                  <div className="text-[9px] text-muted-foreground/70">新規{metrics?.newCustomers ?? 0} / 再来{metrics?.returnCustomers ?? staffReport.returnCustomers}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">次回予約率</div>
                  <div className="font-mono-data text-lg font-bold text-foreground">{nextResRate}%</div>
                </div>
              </div>

              {/* 行動チェック・ルールチェック */}
              {(staffReport.behaviorCheck || staffReport.ruleCheck) && (
                <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {staffReport.behaviorCheck && (
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-1">行動チェック</div>
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{staffReport.behaviorCheck}</p>
                    </div>
                  )}
                  {staffReport.ruleCheck && (
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-1">ルールチェック</div>
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{staffReport.ruleCheck}</p>
                    </div>
                  )}
                </div>
              )}

              {/* コメント */}
              {(staffReport.reviewComment || staffReport.npsComment) && (
                <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {staffReport.reviewComment && (
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-1">口コミ振り返り</div>
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{staffReport.reviewComment}</p>
                    </div>
                  )}
                  {staffReport.npsComment && (
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-1">NPS振り返り</div>
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{staffReport.npsComment}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50 border-dashed">
            <CardContent className="p-6 text-center text-muted-foreground">
              <DollarSign className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-sm">この期間の売上データはありません</p>
            </CardContent>
          </Card>
        )}
      </section>


      {/* ===== 2. 個別アドバイス ===== */}
      {staffNpsStats && (
        <AdviceSection stats={staffNpsStats} records={staffNpsRecords} />
      )}

      {/* ===== 3. ファンくるデータ ===== */}
      <section className="mb-8 pt-6 border-t-2 border-sage/20">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-sage" />
          ファンくる調査結果
          {(filteredFankuruPdfs.length > 0 || filteredFankuruComments.length > 0) && (
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">
              {filteredFankuruPdfs.length + filteredFankuruComments.length}件
            </span>
          )}
        </h2>

        {fankuruLoading ? (
          <Card className="border-border/50">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin opacity-50" />
              <p className="text-sm">ファンくるデータを読み込み中...</p>
            </CardContent>
          </Card>
        ) : !hasFankuruData ? (
          <Card className="border-border/50 border-dashed">
            <CardContent className="p-8 text-center text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">この期間のファンくるデータはありません</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ファンくるPDFリスト */}
            {filteredFankuruPdfs.length > 0 && (
              <div className="grid gap-3 mb-4">
                {filteredFankuruPdfs.map((pdf, i) => (
                  <motion.div
                    key={pdf.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                  >
                    <Card
                      className={`border-border/50 shadow-sm hover:shadow-md transition-all cursor-pointer group ${
                        selectedPdf?.id === pdf.id ? "ring-2 ring-sage/40 border-sage/30" : ""
                      }`}
                      onClick={() => setSelectedPdf(selectedPdf?.id === pdf.id ? null : pdf)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-sage/10 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-sage" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-foreground group-hover:text-sage transition-colors">
                              {pdf.displayName}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              フォルダ: {pdf.folder || "ルート"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              selectedPdf?.id === pdf.id
                                ? "bg-sage text-white"
                                : "bg-sage/10 text-sage group-hover:bg-sage/20"
                            }`}>
                              <Eye className="w-3 h-3" />
                              {selectedPdf?.id === pdf.id ? "閉じる" : "詳細を見る"}
                            </span>
                            <a
                              href={pdf.viewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                              onClick={(e) => e.stopPropagation()}
                              title="Google Driveで開く"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

            {/* PDF Preview */}
            <AnimatePresence>
              {selectedPdf && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-4"
                >
                  <Card className="border-border/50 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between bg-sage/5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-sage" />
                        <span className="text-sm font-medium text-foreground">{selectedPdf.displayName}</span>
                      </div>
                      <a
                        href={selectedPdf.viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-sage hover:text-sage/80 transition-colors"
                      >
                        Google Driveで開く
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="w-full" style={{ height: "80vh", minHeight: "500px" }}>
                      <iframe
                        src={selectedPdf.previewUrl}
                        className="w-full h-full border-0"
                        title={selectedPdf.displayName}
                        allow="autoplay"
                      />
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ファンくるコメント */}
            {filteredFankuruComments.length > 0 && (
              <div className="space-y-3">
                {filteredFankuruComments.map((f, i) => (
                  <Card key={i} className="border-border/50 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Quote className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-amber-700">ファンくるコメント</span>
                            <span className="text-xs text-muted-foreground">{f.month}</span>
                          </div>
                          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{f.comment}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ===== 4. NPS調査結果 ===== */}
      <section className="mb-8 pt-6 border-t-2 border-[#2D9C8F]/20">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#2D9C8F]" />
          NPS調査結果
          {!isAllPeriod && (
            <span className="text-xs font-normal text-muted-foreground">— {getPeriodLabel(periodSelection)}</span>
          )}
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="border-border/50 animate-pulse">
                <CardContent className="p-6"><div className="h-32 bg-muted rounded" /></CardContent>
              </Card>
            ))}
          </div>
        ) : staffNpsStats ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* NPS Score Card */}
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-6 flex flex-col items-center justify-center">
                  <NpsGauge score={staffNpsStats.npsScore} />
                  <div className="mt-4 grid grid-cols-3 gap-4 w-full text-center">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">推奨者</div>
                      <div className="font-mono-data text-sm md:text-base font-bold text-[#2D9C8F]">{staffNpsStats.promoterPct}%</div>
                      <div className="text-[10px] text-muted-foreground">{staffNpsStats.promoters}件</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">中立者</div>
                      <div className="font-mono-data text-sm md:text-base font-bold text-[#B8922A]">{staffNpsStats.passivePct}%</div>
                      <div className="text-[10px] text-muted-foreground">{staffNpsStats.passives}件</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">批判者</div>
                      <div className="font-mono-data text-sm md:text-base font-bold text-[#C75C5C]">{staffNpsStats.detractorPct}%</div>
                      <div className="text-[10px] text-muted-foreground">{staffNpsStats.detractors}件</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Score Distribution */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-foreground">スコア分布</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={scoreDistribution} margin={{ top: 5, right: 5, bottom: 5, left: -20 }} style={{ cursor: "pointer" }} onClick={(state: any) => { if (state && state.activePayload && state.activePayload[0]) { const d = state.activePayload[0].payload; if (d.count > 0) setSelectedScore(d.score); } }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                      <XAxis dataKey="score" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
                        formatter={(value: number) => [`${value}件`, "回答数"]}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} cursor="pointer">
                        {scoreDistribution.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} className="hover:opacity-80 transition-opacity" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-[10px] text-muted-foreground text-center mt-1">棒グラフをタップで該当アンケートを表示</p>
                </CardContent>
              </Card>

              {/* Pie Chart */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-foreground">回答者構成</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
                        formatter={(value: number, name: string) => [`${value}件`, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Category Analysis */}
            <Card className="border-border/50 shadow-sm mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">カテゴリ別評価</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <CategoryAnalysis records={staffNpsRecords} field="priceComment" label="金額" />
                  <CategoryAnalysis records={staffNpsRecords} field="spaceComment" label="空間" />
                  <CategoryAnalysis records={staffNpsRecords} field="staffComment" label="スタッフ" />
                  <CategoryAnalysis records={staffNpsRecords} field="finishComment" label="仕上がり" />
                </div>
              </CardContent>
            </Card>

            {/* Top Reviews */}
            {topReviews.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-[#2D9C8F]" />
                  高評価レビュー TOP3
                </h3>
                <div className="grid gap-3">
                  {topReviews.map((r, i) => (
                    <ReviewCard key={r.no} record={r} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Worst Reviews */}
            {worstReviews.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#C75C5C]" />
                  改善ポイントレビュー
                </h3>
                <div className="grid gap-3">
                  {worstReviews.map((r, i) => (
                    <ReviewCard key={r.no} record={r} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Remaining Reviews */}
            {remainingReviews.length > 0 && (
              <div>
                <button
                  onClick={() => setShowAllReviews(!showAllReviews)}
                  className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors mb-3"
                >
                  {showAllReviews ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  その他のレビュー ({remainingReviews.length}件)
                </button>
                <AnimatePresence>
                  {showAllReviews && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid gap-3 overflow-hidden"
                    >
                      {remainingReviews.map((r, i) => (
                        <ReviewCard key={r.no} record={r} index={i} />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        ) : (
          <Card className="border-border/50 border-dashed">
            <CardContent className="p-8 text-center text-muted-foreground">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">この期間のNPSデータはありません</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Score Detail Modal */}
      {selectedScore !== null && (
        <ScoreDetailModal
          selectedScore={selectedScore}
          records={staffNpsRecords.filter(r => r.npsScore === selectedScore)}
          onClose={() => setSelectedScore(null)}
        />
      )}
    </DashboardLayout>
  );
}
