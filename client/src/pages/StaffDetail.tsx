/*
 * Design: monet Brand Identity — 水彩ブルー × コンクリートモダン
 * Page: スタッフ個別ページ
 * セクション順: 個人売上 → 個別アドバイス → ファンくるデータ → NPS結果
 */
import { useParams } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Calendar, BarChart3, DollarSign, UserCheck, Scissors,
  TrendingUp, FileText, ExternalLink, Loader2, FolderOpen, Eye,
  Lightbulb, CheckCircle2, Target, ArrowUpRight,
  Trophy, ThumbsUp, AlertTriangle, AlertCircle,
  ChevronDown, ChevronUp, Users, Quote, Star, MessageSquare, Building2, ClipboardCheck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { isNewStaff } from "@/lib/newBadge";
import { useStaffOverrides } from "@/hooks/useStaffOverrides";
import type { FankuruPdf } from "@/hooks/useFankuruData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart
} from "recharts";

const NPS_COLORS = {
  promoter: "#2D9C8F",
  passive: "#E5B85C",
  detractor: "#C75C5C",
};

const formatCurrency = (n: number) => {
  if (n === 0) return "—";
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
  const params = useParams<{ staffId: string }>();
  const staffName = decodeURIComponent(params.staffId || "");
  const { records, loading: npsLoading, lastUpdated, refresh } = useNpsData();
  const { rawData, loading: reportLoading, availableMonths: reportMonths, getStaffTrend } = useMonthlyReport();
  const { getDisplayName } = useStaffOverrides();
  const loading = npsLoading || reportLoading;

  // スタッフの所属店舗を特定
  const staffStore = useMemo(() => {
    const staffData = rawData.find(r => r.name === staffName);
    return staffData?.storeNormalized || "";
  }, [rawData, staffName]);

  // DBオーバーライドを適用した表示名
  const staffDisplayName = useMemo(() => {
    if (!staffStore) return staffName;
    return getDisplayName(staffName, staffStore);
  }, [staffName, staffStore, getDisplayName]);

  // ファンくるデータ（店舗名で絞り込み、同姓同名対策）
  const { pdfs: fankuruPdfs, loading: fankuruLoading } = useFankuruDataByStaff(staffName, staffStore);

  // スタッフの写真URLを取得
  const staffPhoto = useMemo(() => {
    const staffData = rawData.find(r => r.name === staffName && r.photoUrl2);
    return staffData?.photoUrl2 || "";
  }, [rawData, staffName]);

  // スタッフの雇用形態を取得
  const staffEmploymentType = useMemo(() => {
    const staffData = rawData.find(r => r.name === staffName);
    return staffData?.employmentType || "";
  }, [rawData, staffName]);

  // 月の管理
  const npsMonths = useMemo(() => {
    const staffRecords = records.filter(r => r.staff?.trim() === staffName);
    return getAvailableMonths(staffRecords);
  }, [records, staffName]);

  const fankuruMonths = useMemo(() => {
    const months = new Set<string>();
    fankuruPdfs.forEach(p => months.add(p.yearMonth));
    return Array.from(months).sort().reverse();
  }, [fankuruPdfs]);

  const staffReportMonths = useMemo(() => {
    const months = new Set<string>();
    rawData.filter(r => r.name === staffName).forEach(r => months.add(r.reportMonth));
    return Array.from(months).sort().reverse();
  }, [rawData, staffName]);

  const allMonths = useMemo(() => {
    const set = new Set([...npsMonths, ...fankuruMonths, ...staffReportMonths]);
    return Array.from(set).sort().reverse();
  }, [npsMonths, fankuruMonths, staffReportMonths]);

  const defaultMonth = useMemo(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const ym = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
    if (allMonths.includes(ym)) return ym;
    if (staffReportMonths.length > 0) return staffReportMonths[0];
    return allMonths[0] || "all";
  }, [allMonths, staffReportMonths]);

  const [selectedMonth, setSelectedMonth] = useState<string>("__init__");
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<FankuruPdf | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);

  useEffect(() => {
    if (selectedMonth === "__init__" && !npsLoading && !reportLoading && !fankuruLoading && allMonths.length > 0) {
      setSelectedMonth(defaultMonth);
    }
  }, [allMonths, defaultMonth, selectedMonth, npsLoading, reportLoading, fankuruLoading]);

  const activeMonth = selectedMonth === "__init__" ? defaultMonth : selectedMonth;

  // 月末報告書データ（スタッフ個人）
  const staffReport = useMemo(() => {
    if (activeMonth === "all") {
      // 全期間: 最新月のデータを返す
      const reports = rawData.filter(r => r.name === staffName).sort((a, b) => b.reportMonth.localeCompare(a.reportMonth));
      return reports[0] || null;
    }
    return rawData.find(r => r.name === staffName && r.reportMonth === activeMonth) || null;
  }, [rawData, staffName, activeMonth]);

  // NPS: スタッフ名でフィルタ
  const staffNpsRecords = useMemo(() => {
    const filtered = records.filter(r => r.staff?.trim() === staffName);
    if (activeMonth === "all") return filtered;
    return filterByMonth(filtered, activeMonth);
  }, [records, staffName, activeMonth]);

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
    if (activeMonth === "all") return fankuruPdfs;
    return fankuruPdfs.filter(p => p.yearMonth === activeMonth);
  }, [fankuruPdfs, activeMonth]);

  // ファンくるコメント（月末報告書から）
  const filteredFankuruComments = useMemo(() => {
    return rawData
      .filter(r => r.name === staffName && (activeMonth === "all" || r.reportMonth === activeMonth))
      .filter(r => r.fankuruComment && r.fankuruComment.trim() !== "" && r.fankuruComment.trim() !== "なし")
      .map(r => ({ month: r.reportMonthLabel, comment: r.fankuruComment }));
  }, [rawData, activeMonth, staffName]);

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

  const formatMonth = (ym: string) => {
    if (!ym || ym === "all" || ym === "__init__") return "";
    const [y, m] = ym.split("-");
    return `${y}年${parseInt(m)}月`;
  };

  const breadcrumbs = [
    { label: "スタッフ一覧", href: "/staff" },
    { label: staffDisplayName },
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
            {staffPhoto ? (
              <img src={staffPhoto} alt={staffName} className="w-14 h-14 rounded-xl object-cover object-center shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-7 h-7 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                {staffDisplayName}
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

        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={activeMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="期間を選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全期間</SelectItem>
              {allMonths.map(m => (
                <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ===== 0. 月末報告書 回答ステータス ===== */}
      {activeMonth && activeMonth !== "all" && activeMonth !== "__init__" && (() => {
        const hasSubmitted = !!staffReport;
        return (
          <section className="mb-6 pt-6 border-t-2 border-primary/20">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary" />
              月末報告書
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">
                {formatMonth(activeMonth)}
              </span>
            </h2>
            <Card className={`border-border/50 shadow-sm ${
              hasSubmitted ? 'border-l-4 border-l-emerald-400' : 'border-l-4 border-l-amber-400'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {hasSubmitted ? (
                    <>
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-emerald-700">回答済み</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {formatMonth(activeMonth)}の月末報告書は提出されています
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-amber-700">未回答</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {formatMonth(activeMonth)}の月末報告書がまだ提出されていません
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        );
      })()}

      {/* ===== 1. 個人売上 ===== */}
      <section className="mb-8 pt-6 border-t-2 border-primary/20">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          個人売上
          {activeMonth !== "all" && activeMonth !== "__init__" && (
            <span className="text-xs font-normal text-muted-foreground">— {formatMonth(activeMonth)}</span>
          )}
        </h2>

        {staffReport ? (
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">総売上</div>
                  <div className="font-mono-data text-lg font-bold text-foreground">{formatCurrency(staffReport.totalSales)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">技術売上</div>
                  <div className="font-mono-data text-lg font-bold text-foreground">{formatCurrency(staffReport.techSales)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">店販売上</div>
                  <div className="font-mono-data text-lg font-bold text-foreground">{formatCurrency(staffReport.retailSales)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">客単価</div>
                  <div className="font-mono-data text-lg font-bold text-foreground">{formatCurrency(staffReport.unitPrice)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">総客数</div>
                  <div className="font-mono-data text-lg font-bold text-foreground">{staffReport.totalCustomers}名</div>
                  <div className="text-[9px] text-muted-foreground/70">新規{staffReport.newCustomers} / 再来{staffReport.returnCustomers}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">次回予約率</div>
                  <div className="font-mono-data text-lg font-bold text-foreground">{staffReport.nextReservationRate}%</div>
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
              <p className="text-sm">この期間の売上データはまだありません</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ===== 1.5 月次トレンドグラフ ===== */}
      {(() => {
        // スタッフの月次トレンドデータを取得
        const staffTrendData = staffStore ? getStaffTrend(staffStore).find(t => t.staffName === staffName) : null;
        const trendPoints = staffTrendData?.data.filter(d => d.hasData) || [];
        if (trendPoints.length < 2) return null;

        const COLORS = {
          sales: "#2D9C8F",
          techSales: "#3B82F6",
          retailSales: "#E5B85C",
          customers: "#2D9C8F",
          newCustomers: "#3B82F6",
          returnCustomers: "#E5B85C",
          unitPrice: "#8B5CF6",
          nextReservation: "#F59E0B",
        };

        // 前月比の計算
        const latest = trendPoints[trendPoints.length - 1];
        const prev = trendPoints[trendPoints.length - 2];
        const salesDiff = latest.sales - prev.sales;
        const salesPct = prev.sales > 0 ? Math.round((salesDiff / prev.sales) * 100) : 0;
        const custDiff = latest.customers - prev.customers;
        const custPct = prev.customers > 0 ? Math.round((custDiff / prev.customers) * 100) : 0;
        const unitDiff = latest.unitPrice - prev.unitPrice;
        const unitPct = prev.unitPrice > 0 ? Math.round((unitDiff / prev.unitPrice) * 100) : 0;

        const DiffBadge = ({ diff, pct, unit = "" }: { diff: number; pct: number; unit?: string }) => (
          <span className={`inline-flex items-center gap-0.5 text-xs font-mono-data font-semibold ${
            diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-500" : "text-muted-foreground"
          }`}>
            {diff > 0 ? "↑" : diff < 0 ? "↓" : "→"}
            {unit === "¥" ? `¥${Math.abs(diff).toLocaleString()}` : `${Math.abs(diff).toLocaleString()}${unit}`}
            <span className="text-[10px] opacity-70">({diff > 0 ? "+" : ""}{pct}%)</span>
          </span>
        );

        return (
          <section className="mb-8 pt-6 border-t-2 border-primary/20">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              月次トレンド
            </h2>

            {/* 前月比サマリーカード */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <div className="text-[10px] text-muted-foreground mb-1">総売上 前月比</div>
                  <DiffBadge diff={salesDiff} pct={salesPct} unit="¥" />
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <div className="text-[10px] text-muted-foreground mb-1">客数 前月比</div>
                  <DiffBadge diff={custDiff} pct={custPct} unit="名" />
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <div className="text-[10px] text-muted-foreground mb-1">客単価 前月比</div>
                  <DiffBadge diff={unitDiff} pct={unitPct} unit="¥" />
                </CardContent>
              </Card>
            </div>

            {/* 売上推移グラフ */}
            <Card className="border-border/50 shadow-sm mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">売上推移</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={trendPoints} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.sales} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={COLORS.sales} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="techGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.techSales} stopOpacity={0.1} />
                        <stop offset="95%" stopColor={COLORS.techSales} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : v.toLocaleString()} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
                      formatter={(value: number, name: string) => [`¥${value.toLocaleString()}`, name]}
                    />
                    <Area type="monotone" dataKey="sales" name="総売上" stroke={COLORS.sales} fill="url(#salesGrad)" strokeWidth={2.5} dot={{ r: 4, fill: COLORS.sales }} activeDot={{ r: 6 }} />
                    <Area type="monotone" dataKey="techSales" name="技術売上" stroke={COLORS.techSales} fill="url(#techGrad)" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 3, fill: COLORS.techSales }} />
                    <Line type="monotone" dataKey="retailSales" name="店販売上" stroke={COLORS.retailSales} strokeWidth={1.5} strokeDasharray="3 3" dot={{ r: 3, fill: COLORS.retailSales }} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-4 mt-2">
                  <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="w-3 h-0.5 rounded" style={{ backgroundColor: COLORS.sales }} /> 総売上
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="w-3 h-0.5 rounded border-dashed" style={{ backgroundColor: COLORS.techSales }} /> 技術売上
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="w-3 h-0.5 rounded" style={{ backgroundColor: COLORS.retailSales }} /> 店販売上
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 客数推移グラフ */}
            <Card className="border-border/50 shadow-sm mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">客数推移</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trendPoints} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <defs>
                      <linearGradient id="custGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.customers} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={COLORS.customers} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
                      formatter={(value: number, name: string) => [`${value}名`, name]}
                    />
                    <Area type="monotone" dataKey="customers" name="総客数" stroke={COLORS.customers} fill="url(#custGrad)" strokeWidth={2.5} dot={{ r: 4, fill: COLORS.customers }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="newCustomers" name="新規" stroke={COLORS.newCustomers} strokeWidth={1.5} dot={{ r: 3, fill: COLORS.newCustomers }} />
                    <Line type="monotone" dataKey="returnCustomers" name="再来" stroke={COLORS.returnCustomers} strokeWidth={1.5} dot={{ r: 3, fill: COLORS.returnCustomers }} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-4 mt-2">
                  <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="w-3 h-0.5 rounded" style={{ backgroundColor: COLORS.customers }} /> 総客数
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="w-3 h-0.5 rounded" style={{ backgroundColor: COLORS.newCustomers }} /> 新規
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="w-3 h-0.5 rounded" style={{ backgroundColor: COLORS.returnCustomers }} /> 再来
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 客単価・次回予約率推移 */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">客単価・次回予約率推移</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendPoints} margin={{ top: 5, right: 40, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
                      formatter={(value: number, name: string) => {
                        if (name === "客単価") return [`¥${value.toLocaleString()}`, name];
                        return [`${value}%`, name];
                      }}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="unitPrice" name="客単価" stroke={COLORS.unitPrice} strokeWidth={2} dot={{ r: 4, fill: COLORS.unitPrice }} />
                    <Line yAxisId="right" type="monotone" dataKey="nextReservationRate" name="次回予約率" stroke={COLORS.nextReservation} strokeWidth={2} dot={{ r: 4, fill: COLORS.nextReservation }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-4 mt-2">
                  <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="w-3 h-0.5 rounded" style={{ backgroundColor: COLORS.unitPrice }} /> 客単価
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="w-3 h-0.5 rounded" style={{ backgroundColor: COLORS.nextReservation }} /> 次回予約率
                  </span>
                </div>
              </CardContent>
            </Card>
          </section>
        );
      })()}

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
          {activeMonth !== "all" && activeMonth !== "__init__" && (
            <span className="text-xs font-normal text-muted-foreground">— {formatMonth(activeMonth)}</span>
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
